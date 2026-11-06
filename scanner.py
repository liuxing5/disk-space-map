"""Fast, resilient disk tree scanner.

The scanner walks a Windows drive without following junctions, symlinks or
other reparse points.  Every directory is written to a small SQLite database
with its aggregate size, so the web UI can drill into the tree instantly after
one scan.

Only the Python standard library is used.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import queue
import sqlite3
import stat as stat_module
import threading
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

SCHEMA_VERSION = 2
FILE_ATTRIBUTE_REPARSE_POINT = 0x400
WRITE_BATCH = 4000
SCAN_WORKERS = 4


# ---------------------------------------------------------------------------
# Statistics shared with the HTTP layer
# ---------------------------------------------------------------------------


class ScanStats:
    """Thread-safe counters for a running scan."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.stage = "starting"
        self.files = 0
        self.dirs = 0
        self.bytes = 0
        self.errors = 0
        self.skipped = 0
        self.current = ""
        self.done_roots = 0
        self.total_roots = 0
        self.started_at = time.time()

    def add_files(self, count: int, size: int) -> None:
        if not count and not size:
            return
        with self._lock:
            self.files += count
            self.bytes += size

    def add_dir(self) -> None:
        with self._lock:
            self.dirs += 1

    def add_error(self) -> None:
        with self._lock:
            self.errors += 1

    def add_skipped(self) -> None:
        with self._lock:
            self.skipped += 1

    def set_current(self, path: str) -> None:
        with self._lock:
            self.current = path

    def root_done(self) -> None:
        with self._lock:
            self.done_roots += 1

    def set_total_roots(self, value: int) -> None:
        with self._lock:
            self.total_roots = value

    def set_stage(self, value: str) -> None:
        with self._lock:
            self.stage = value

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "stage": self.stage,
                "files": self.files,
                "dirs": self.dirs,
                "bytes": self.bytes,
                "errors": self.errors,
                "skipped": self.skipped,
                "current": self.current,
                "done_roots": self.done_roots,
                "total_roots": self.total_roots,
                "elapsed": max(0.0, time.time() - self.started_at),
            }


# ---------------------------------------------------------------------------
# Database writer
# ---------------------------------------------------------------------------


SCHEMA_SQL = """
CREATE TABLE dirs (
    key         TEXT PRIMARY KEY,
    path        TEXT NOT NULL,
    parent_key  TEXT NOT NULL,
    name        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    files_size  INTEGER NOT NULL,
    files_count INTEGER NOT NULL,
    dirs_count  INTEGER NOT NULL,
    mtime       REAL NOT NULL DEFAULT 0,
    error       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE files (
    parent_key TEXT NOT NULL,
    name       TEXT NOT NULL,
    name_lower TEXT NOT NULL,
    size       INTEGER NOT NULL,
    mtime      REAL NOT NULL,
    ext        TEXT NOT NULL,
    system     INTEGER NOT NULL DEFAULT 0
);
CREATE VIRTUAL TABLE files_fts USING fts5(
    name,
    content='files',
    content_rowid='rowid',
    tokenize='trigram'
);
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class _DbWriter(threading.Thread):
    def __init__(self, db_path: str) -> None:
        super().__init__(name="disk-map-db-writer", daemon=True)
        self.db_path = db_path
        self.rows: queue.Queue[tuple | list[tuple] | None] = queue.Queue()
        self.error: BaseException | None = None
        self.ready = threading.Event()
        self._finished = threading.Event()

    def put(self, row: tuple) -> None:
        if self.error is not None:
            raise RuntimeError(f"数据库写入失败: {self.error}")
        self.rows.put(row)

    def put_files(self, rows: list[tuple]) -> None:
        if not rows:
            return
        if self.error is not None:
            raise RuntimeError(f"数据库写入失败: {self.error}")
        # The scanner clears its per-folder staging list immediately after
        # handing it over, so enqueue a snapshot rather than the live list.
        self.rows.put(list(rows))

    def finish(self) -> None:
        self.rows.put(None)
        self._finished.wait()

    def run(self) -> None:  # noqa: D401 - thread entry point
        conn: sqlite3.Connection | None = None
        try:
            if os.path.exists(self.db_path):
                os.remove(self.db_path)
            conn = sqlite3.connect(self.db_path, timeout=60)
            conn.execute("PRAGMA journal_mode=OFF")
            conn.execute("PRAGMA synchronous=OFF")
            conn.execute("PRAGMA locking_mode=EXCLUSIVE")
            conn.execute("PRAGMA temp_store=MEMORY")
            conn.execute("PRAGMA cache_size=-80000")
            conn.executescript(SCHEMA_SQL)
            conn.commit()
            self.ready.set()

            dir_batch: list[tuple] = []
            file_batch: list[tuple] = []
            insert_dir_sql = (
                "INSERT OR REPLACE INTO dirs "
                "(key,path,parent_key,name,size,files_size,files_count,dirs_count,mtime,error) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)"
            )
            insert_file_sql = (
                "INSERT INTO files "
                "(parent_key,name,name_lower,size,mtime,ext,system) VALUES (?,?,?,?,?,?,?)"
            )
            while True:
                item = self.rows.get()
                if item is None:
                    break
                if isinstance(item, list):
                    file_batch.extend(item)
                else:
                    dir_batch.append(item)
                if len(dir_batch) >= WRITE_BATCH:
                    conn.executemany(insert_dir_sql, dir_batch)
                    dir_batch.clear()
                if len(file_batch) >= WRITE_BATCH:
                    conn.executemany(insert_file_sql, file_batch)
                    file_batch.clear()
                if not dir_batch and not file_batch:
                    conn.commit()
            if dir_batch:
                conn.executemany(insert_dir_sql, dir_batch)
            if file_batch:
                conn.executemany(insert_file_sql, file_batch)
            conn.commit()
            conn.execute("CREATE INDEX idx_dirs_parent ON dirs(parent_key, size DESC)")
            conn.execute("CREATE INDEX idx_files_size ON files(size DESC)")
            conn.execute("CREATE INDEX idx_files_parent ON files(parent_key)")
            conn.execute("INSERT INTO files_fts(files_fts) VALUES('rebuild')")
            conn.commit()
        except BaseException as exc:  # keep the queue drained so scanners do not block
            self.error = exc
            self.ready.set()
            try:
                while True:
                    item = self.rows.get()
                    if item is None:
                        break
            except Exception:
                pass
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            self._finished.set()


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------


@dataclass
class _Frame:
    path: str
    key: str
    parent_key: str
    name: str
    iterator: Any
    mtime: float
    total: int = 0
    files_size: int = 0
    files_count: int = 0
    dirs_count: int = 0
    error: int = 0
    file_rows: list[tuple] = field(default_factory=list)


class DriveScanner:
    def __init__(self, root: str, db_path: str, excluded_paths: list[str] | None = None) -> None:
        self.root = os.path.abspath(root)
        self.root_key = _key(self.root)
        self.db_path = db_path
        self.stats = ScanStats()
        self.writer = _DbWriter(db_path)
        self.excluded = {_key(p) for p in (excluded_paths or [])}

    # -- helpers ---------------------------------------------------------

    def _is_excluded(self, key: str) -> bool:
        for ex in self.excluded:
            if key == ex or key.startswith(ex + "\\"):
                return True
        return False

    def _emit(self, row: tuple) -> None:
        self.writer.put(row)

    def _flush_files(self, frame: _Frame) -> None:
        if frame.file_rows:
            self.writer.put_files(frame.file_rows)
            frame.file_rows.clear()

    def _row(
        self,
        path: str,
        parent_key: str,
        name: str,
        total: int,
        files_size: int,
        files_count: int,
        dirs_count: int,
        mtime: float,
        error: int = 0,
    ) -> tuple:
        return (
            _key(path),
            path,
            parent_key,
            name,
            max(0, int(total)),
            max(0, int(files_size)),
            int(files_count),
            int(dirs_count),
            float(mtime or 0),
            int(error),
        )

    # -- directory walk --------------------------------------------------

    def _scan_dir(self, path: str, parent_key: str, name: str, mtime: float) -> int:
        self.stats.set_current(path)
        key = _key(path)
        try:
            iterator = os.scandir(path)
        except OSError:
            self.stats.add_error()
            self._emit(self._row(path, parent_key, name, 0, 0, 0, 0, mtime, 1))
            return 0

        stack: list[_Frame] = [
            _Frame(path, key, parent_key, name, iterator, mtime)
        ]
        try:
            while stack:
                frame = stack[-1]
                try:
                    entry = next(frame.iterator)
                except StopIteration:
                    try:
                        frame.iterator.close()
                    except Exception:
                        pass
                    stack.pop()
                    self._flush_files(frame)
                    self.stats.add_files(frame.files_count, frame.files_size)
                    self._emit(
                        self._row(
                            frame.path,
                            frame.parent_key,
                            frame.name,
                            frame.total,
                            frame.files_size,
                            frame.files_count,
                            frame.dirs_count,
                            frame.mtime,
                            frame.error,
                        )
                    )
                    if stack:
                        parent = stack[-1]
                        parent.total += frame.total
                        parent.dirs_count += 1
                    else:
                        return frame.total
                    continue
                except OSError:
                    self.stats.add_error()
                    frame.error = 1
                    try:
                        frame.iterator.close()
                    except Exception:
                        pass
                    stack.pop()
                    self._flush_files(frame)
                    self._emit(
                        self._row(
                            frame.path,
                            frame.parent_key,
                            frame.name,
                            frame.total,
                            frame.files_size,
                            frame.files_count,
                            frame.dirs_count,
                            frame.mtime,
                            1,
                        )
                    )
                    if stack:
                        parent = stack[-1]
                        parent.total += frame.total
                        parent.dirs_count += 1
                    else:
                        return frame.total
                    continue

                try:
                    st = entry.stat(follow_symlinks=False)
                except OSError:
                    self.stats.add_error()
                    continue

                attrs = getattr(st, "st_file_attributes", 0)
                if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
                    self.stats.add_skipped()
                    continue

                mode = st.st_mode
                if stat_module.S_ISDIR(mode):
                    child_path = entry.path
                    child_key = _key(child_path)
                    if self._is_excluded(child_key):
                        self.stats.add_skipped()
                        continue
                    try:
                        child_iter = os.scandir(child_path)
                    except OSError:
                        self.stats.add_error()
                        frame.dirs_count += 1
                        self._emit(
                            self._row(
                                child_path,
                                frame.key,
                                entry.name,
                                0,
                                0,
                                0,
                                0,
                                st.st_mtime,
                                1,
                            )
                        )
                        continue
                    self.stats.add_dir()
                    stack.append(
                        _Frame(
                            child_path,
                            child_key,
                            frame.key,
                            entry.name,
                            child_iter,
                            st.st_mtime,
                        )
                    )
                elif stat_module.S_ISREG(mode):
                    size = max(0, int(st.st_size))
                    frame.files_count += 1
                    frame.files_size += size
                    frame.total += size
                    frame.file_rows.append(
                        (
                            frame.key,
                            entry.name,
                            entry.name.casefold(),
                            size,
                            float(st.st_mtime),
                            os.path.splitext(entry.name)[1].lower(),
                            1 if attrs & 0x4 else 0,
                        )
                    )
                    if len(frame.file_rows) >= 512:
                        self._flush_files(frame)
                else:
                    # Devices, pipes and other unusual entries do not consume
                    # meaningful disk space in Explorer either.
                    self.stats.add_skipped()
        finally:
            for frame in stack:
                try:
                    frame.iterator.close()
                except Exception:
                    pass
        return 0

    # -- top level -------------------------------------------------------

    def run(self) -> dict[str, Any]:
        started = time.time()
        self.stats.set_stage("正在读取磁盘根目录")
        self.writer.start()
        self.writer.ready.wait(timeout=30)
        if self.writer.error is not None:
            raise RuntimeError(f"无法创建扫描数据库: {self.writer.error}")

        top_dirs: list[tuple[str, str, float]] = []
        root_files_size = 0
        root_files_count = 0
        root_file_rows: list[tuple] = []
        try:
            with os.scandir(self.root) as iterator:
                for entry in iterator:
                    try:
                        st = entry.stat(follow_symlinks=False)
                    except OSError:
                        self.stats.add_error()
                        continue
                    attrs = getattr(st, "st_file_attributes", 0)
                    if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
                        self.stats.add_skipped()
                        continue
                    if stat_module.S_ISDIR(st.st_mode):
                        if self._is_excluded(_key(entry.path)):
                            self.stats.add_skipped()
                            continue
                        top_dirs.append((entry.path, entry.name, st.st_mtime))
                    elif stat_module.S_ISREG(st.st_mode):
                        size = max(0, int(st.st_size))
                        root_files_count += 1
                        root_files_size += size
                        root_file_rows.append(
                            (
                                self.root_key,
                                entry.name,
                                entry.name.casefold(),
                                size,
                                float(st.st_mtime),
                                os.path.splitext(entry.name)[1].lower(),
                                1 if attrs & 0x4 else 0,
                            )
                        )
        except OSError as exc:
            raise RuntimeError(f"无法读取 {self.root}: {exc}") from exc

        self.writer.put_files(root_file_rows)
        self.stats.add_files(root_files_count, root_files_size)
        self.stats.set_total_roots(len(top_dirs))
        self.stats.set_stage("正在扫描目录")

        total = root_files_size
        try:
            if top_dirs:
                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=min(SCAN_WORKERS, len(top_dirs)),
                    thread_name_prefix="disk-map-scan",
                ) as pool:
                    futures = {
                        pool.submit(self._scan_dir, path, self.root_key, name, mtime): (path, name)
                        for path, name, mtime in top_dirs
                    }
                    for future in concurrent.futures.as_completed(futures):
                        path, name = futures[future]
                        try:
                            size = future.result()
                        except BaseException as exc:
                            self.stats.add_error()
                            self.writer.put(
                                self._row(path, self.root_key, name, 0, 0, 0, 0, 0, 1)
                            )
                            print(f"[scan] failed {path}: {exc}", flush=True)
                            size = 0
                        total += size
                        self.stats.root_done()

            self.stats.set_stage("正在建立索引")
            self._emit(
                self._row(
                    self.root,
                    "",
                    os.path.basename(self.root.rstrip("\\")) or self.root,
                    total,
                    root_files_size,
                    root_files_count,
                    len(top_dirs),
                    os.stat(self.root).st_mtime,
                    0,
                )
            )
            self.writer.finish()
            if self.writer.error is not None:
                raise RuntimeError(f"写入扫描数据库失败: {self.writer.error}")

            meta = {
                "schema": SCHEMA_VERSION,
                "root": self.root,
                "total": total,
                "files": self.stats.files,
                "files_indexed": self.stats.files,
                "dirs": self.stats.dirs,
                "errors": self.stats.errors,
                "skipped": self.stats.skipped,
                "elapsed": round(time.time() - started, 2),
                "scanned_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                "scanned_at_ts": time.time(),
                "db_name": os.path.basename(self.db_path),
            }
            conn = sqlite3.connect(self.db_path, timeout=30)
            try:
                conn.executemany(
                    "INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)",
                    [(k, json.dumps(v, ensure_ascii=False)) for k, v in meta.items()],
                )
                conn.commit()
            finally:
                conn.close()
            self.stats.set_stage("完成")
            return meta
        except BaseException:
            # The writer may still be waiting for its sentinel.
            try:
                self.writer.finish()
            except Exception:
                pass
            raise


# ---------------------------------------------------------------------------
# Helpers used by the server as well
# ---------------------------------------------------------------------------


def _key(path: str) -> str:
    return os.path.normcase(os.path.normpath(path))


def human_bytes(value: int | float) -> str:
    value = float(value or 0)
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    index = 0
    while abs(value) >= 1024 and index < len(units) - 1:
        value /= 1024.0
        index += 1
    if index == 0:
        return f"{value:.0f} {units[index]}"
    if value >= 100:
        return f"{value:.0f} {units[index]}"
    if value >= 10:
        return f"{value:.1f} {units[index]}"
    return f"{value:.2f} {units[index]}"


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scan one drive into a SQLite cache")
    parser.add_argument("root")
    parser.add_argument("database")
    parser.add_argument("--exclude", action="append", default=[])
    args = parser.parse_args()
    scanner = DriveScanner(args.root, args.database, args.exclude)
    try:
        result = scanner.run()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception:
        traceback.print_exc()
        raise
