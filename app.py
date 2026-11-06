"""Local disk space map server.

Run with pythonw for a completely hidden background service:

    pythonw.exe app.py --open

The server binds to 127.0.0.1 only and serves a small single-page app from the
``static`` directory.  Scan caches are stored next to the script in ``data``.
"""

from __future__ import annotations

import ctypes
import glob
import json
import mimetypes
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from cleaner import CleanupError, CleanupManager
from mover import MoveError, MoveManager
from scanner import DriveScanner, SCHEMA_VERSION, _key

APP_NAME = "disk-space-map"
APP_TITLE = "磁盘空间地图"
APP_VERSION = 2
DEFAULT_PORT = 8765
REFRESH_MAX_AGE = 60  # seconds; page-open refreshes caches older than this
KEEP_CACHES = 1

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
PORT_FILE = os.path.join(DATA_DIR, "port.txt")
LOG_FILE = os.path.join(DATA_DIR, "server.log")
MOVE_LOG = os.path.join(DATA_DIR, "moves.log")
CLEAN_LOG = os.path.join(DATA_DIR, "cleanups.log")

DRIVE_TYPES = {2: "removable", 3: "fixed", 4: "network", 5: "cdrom", 6: "ramdisk"}


# ---------------------------------------------------------------------------
# Windows drive helpers
# ---------------------------------------------------------------------------

try:
    _kernel32 = ctypes.windll.kernel32
except Exception:  # pragma: no cover - only relevant off Windows
    _kernel32 = None


def _connect_ro(path: str) -> sqlite3.Connection:
    """Open SQLite read-only without creating journal files on Windows."""
    uri = "file:///" + urllib.parse.quote(path.replace("\\", "/"), safe="/:")
    return sqlite3.connect(uri + "?mode=ro", uri=True, timeout=10)


def _log(message: str) -> None:
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(f"[{datetime.now().isoformat(timespec='seconds')}] {message}\n")
    except Exception:
        pass


def list_drive_roots() -> list[str]:
    if _kernel32 is None:
        return []
    size = 1024
    buffer = ctypes.create_unicode_buffer(size)
    length = _kernel32.GetLogicalDriveStringsW(size, buffer)
    if not length:
        return []
    roots = []
    for part in buffer[:length].split("\x00"):
        if part and len(part) >= 2 and part[1] == ":":
            root = part.rstrip("\\") + "\\"
            drive_type = int(_kernel32.GetDriveTypeW(root))
            if drive_type in (2, 3, 6):
                roots.append(root)
    return roots


def _volume_info(root: str) -> tuple[str, str]:
    if _kernel32 is None:
        return "", ""
    label = ctypes.create_unicode_buffer(261)
    fs_name = ctypes.create_unicode_buffer(261)
    serial = ctypes.c_uint()
    max_component = ctypes.c_uint()
    flags = ctypes.c_uint()
    ok = _kernel32.GetVolumeInformationW(
        root,
        label,
        261,
        ctypes.byref(serial),
        ctypes.byref(max_component),
        ctypes.byref(flags),
        fs_name,
        261,
    )
    if not ok:
        return "", ""
    return label.value.strip(), fs_name.value.strip()


def disk_information(root: str) -> dict[str, Any]:
    total = used = free = 0
    try:
        usage = shutil.disk_usage(root)
        total, used, free = int(usage.total), int(usage.used), int(usage.free)
    except OSError:
        pass
    label, fs_name = _volume_info(root)
    drive_type = int(_kernel32.GetDriveTypeW(root)) if _kernel32 else 0
    return {
        "root": root,
        "letter": root[0].upper(),
        "label": label or "本地磁盘",
        "fs": fs_name or "",
        "kind": DRIVE_TYPES.get(drive_type, "disk"),
        "total": total,
        "used": used,
        "free": free,
        "percent": round((used / total * 100.0) if total else 0.0, 1),
    }


# ---------------------------------------------------------------------------
# Scan job
# ---------------------------------------------------------------------------


class ScanJob:
    def __init__(self, letter: str, root: str, used: int, trigger: str) -> None:
        self.letter = letter
        self.root = root
        self.used = used
        self.trigger = trigger
        self.id = f"{int(time.time())}-{letter}"
        self.status = "scanning"
        self.started_at = time.time()
        self.finished_at: float | None = None
        self.error: str | None = None
        self.stats = None
        self.db_path: str | None = None
        self._lock = threading.Lock()

    def set_status(self, value: str, error: str | None = None) -> None:
        with self._lock:
            self.status = value
            if error is not None:
                self.error = error
            if value in ("done", "error"):
                self.finished_at = time.time()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            status = self.status
            error = self.error
            finished = self.finished_at
        stats = self.stats.snapshot() if self.stats is not None else None
        percent = 0.0
        scanned = 0
        if stats:
            scanned = stats["bytes"]
            if status == "done":
                percent = 100.0
            elif self.used > 0:
                percent = min(99.0, stats["bytes"] / self.used * 100.0)
        return {
            "id": self.id,
            "letter": self.letter,
            "status": status,
            "trigger": self.trigger,
            "started_at": self.started_at,
            "finished_at": finished,
            "elapsed": round((finished or time.time()) - self.started_at, 1),
            "percent": round(percent, 1),
            "scanned": scanned,
            "target": self.used,
            "error": error,
            "stats": stats,
        }


# ---------------------------------------------------------------------------
# Drive manager / cache
# ---------------------------------------------------------------------------


class DriveManager:
    def __init__(self) -> None:
        self.base_dir = BASE_DIR
        self.data_dir = DATA_DIR
        self.lock = threading.RLock()
        self.states: dict[str, dict[str, Any]] = {}
        os.makedirs(self.data_dir, exist_ok=True)
        self._cleanup_temp_files()
        self.refresh_drives()
        self._load_caches()

    # -- cache discovery -------------------------------------------------

    def _drive_dir(self, letter: str) -> str:
        path = os.path.join(self.data_dir, letter)
        os.makedirs(path, exist_ok=True)
        return path

    def _state_for(self, letter: str, root: str) -> dict[str, Any]:
        state = self.states.get(letter)
        if state is None:
            state = {
                "letter": letter,
                "root": root,
                "meta": None,
                "db_path": None,
                "job": None,
                "last_error": None,
            }
            self.states[letter] = state
        return state

    def _cleanup_temp_files(self) -> None:
        for path in glob.glob(os.path.join(self.data_dir, "*", "*.tmp")):
            try:
                os.remove(path)
            except OSError:
                pass

    def _load_caches(self) -> None:
        self.refresh_drives()
        for root in list_drive_roots():
            letter = root[0].upper()
            state = self._state_for(letter, root)
            drive_dir = self._drive_dir(letter)
            candidates = sorted(
                glob.glob(os.path.join(drive_dir, "scan_*.json")),
                key=lambda p: os.path.getmtime(p),
                reverse=True,
            )
            for json_path in candidates:
                try:
                    with open(json_path, "r", encoding="utf-8") as handle:
                        meta = json.load(handle)
                    if int(meta.get("schema", 0)) != SCHEMA_VERSION:
                        continue
                    db_path = os.path.join(drive_dir, meta.get("db_name", ""))
                    if not os.path.isfile(db_path) or os.path.getsize(db_path) < 4096:
                        continue
                    state["meta"] = meta
                    state["db_path"] = db_path
                    break
                except Exception as exc:
                    _log(f"ignore cache {json_path}: {exc}")
            self._prune_caches(letter)

    def _prune_caches(self, letter: str) -> None:
        drive_dir = self._drive_dir(letter)
        caches = sorted(
            glob.glob(os.path.join(drive_dir, "scan_*.sqlite")),
            key=lambda p: os.path.getmtime(p),
            reverse=True,
        )
        current = None
        state = self.states.get(letter)
        if state:
            current = state.get("db_path")
        for path in caches[KEEP_CACHES:]:
            if os.path.normcase(path) == os.path.normcase(current or ""):
                continue
            try:
                os.remove(path)
            except OSError:
                pass
            json_path = os.path.splitext(path)[0] + ".json"
            try:
                os.remove(json_path)
            except OSError:
                pass

    # -- listing ---------------------------------------------------------

    def refresh_drives(self) -> None:
        roots = list_drive_roots()
        present = {root[0].upper() for root in roots}
        with self.lock:
            for root in roots:
                letter = root[0].upper()
                state = self._state_for(letter, root)
                state.pop("removed", None)
                info = disk_information(root)
                state.update(
                    {
                        "root": root,
                        "label": info["label"],
                        "fs": info["fs"],
                        "kind": info["kind"],
                        "total": info["total"],
                        "used": info["used"],
                        "free": info["free"],
                        "percent": info["percent"],
                    }
                )
            for letter, state in list(self.states.items()):
                if letter not in present:
                    state["removed"] = True

    def _cache_summary(self, state: dict[str, Any]) -> dict[str, Any] | None:
        meta = state.get("meta")
        if not meta:
            return None
        age = max(0.0, time.time() - float(meta.get("scanned_at_ts", 0)))
        return {
            "scanned_at": meta.get("scanned_at"),
            "scanned_at_ts": meta.get("scanned_at_ts"),
            "age": round(age, 1),
            "total": meta.get("total", 0),
            "files": meta.get("files", 0),
            "dirs": meta.get("dirs", 0),
            "errors": meta.get("errors", 0),
            "skipped": meta.get("skipped", 0),
            "elapsed": meta.get("elapsed", 0),
            "db_name": meta.get("db_name"),
        }

    def list_drives(self) -> dict[str, Any]:
        self.refresh_drives()
        drives = []
        with self.lock:
            states = [s for s in self.states.values() if not s.get("removed")]
        for state in sorted(states, key=lambda s: s["letter"]):
            job = state.get("job")
            job_snapshot = job.snapshot() if job else None
            cache = self._cache_summary(state)
            drives.append(
                {
                    "letter": state["letter"],
                    "root": state["root"],
                    "label": state.get("label") or "本地磁盘",
                    "fs": state.get("fs") or "",
                    "kind": state.get("kind") or "disk",
                    "total": state.get("total", 0),
                    "used": state.get("used", 0),
                    "free": state.get("free", 0),
                    "percent": state.get("percent", 0),
                    "cache": cache,
                    "scan": job_snapshot,
                    "last_error": state.get("last_error"),
                }
            )
        return {"drives": drives, "server_time": time.time()}

    # -- scanning --------------------------------------------------------

    def start_scan(self, letter: str, force: bool = False, trigger: str = "manual") -> dict[str, Any]:
        letter = letter.upper()
        self.refresh_drives()
        state = self.states.get(letter)
        if not state or state.get("removed"):
            raise ValueError(f"磁盘 {letter}: 不存在")
        root = state["root"]

        with self.lock:
            job = state.get("job")
            if job and job.status in ("scanning",):
                return {"started": False, "reason": "already_scanning", "job": job.snapshot()}
            meta = state.get("meta")
            if meta:
                age = time.time() - float(meta.get("scanned_at_ts", 0))
                # Even a forced refresh is skipped for a few seconds so opening
                # the page twice does not launch overlapping full scans.
                if (age < 4 and trigger not in ("move", "cleanup")) or (
                    not force and age < REFRESH_MAX_AGE
                ):
                    return {
                        "started": False,
                        "reason": "fresh",
                        "age": round(age, 1),
                        "cache": self._cache_summary(state),
                    }
            job = ScanJob(letter, root, int(state.get("used", 0)), trigger)
            new_job = job
            state["job"] = new_job
            state["last_error"] = None

        drive_dir = self._drive_dir(letter)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique = f"{stamp}_{int(time.time() * 1000) % 1000:03d}"
        final_db = os.path.join(drive_dir, f"scan_{unique}.sqlite")
        tmp_db = final_db + ".tmp"
        scanner = DriveScanner(root, tmp_db, excluded_paths=[DATA_DIR])
        new_job.stats = scanner.stats
        new_job.db_path = final_db
        thread = threading.Thread(
            target=self._scan_worker,
            args=(state, new_job, scanner, tmp_db, final_db),
            name=f"disk-map-{letter}",
            daemon=True,
        )
        thread.start()
        return {"started": True, "job": new_job.snapshot()}

    def _scan_worker(
        self,
        state: dict[str, Any],
        job: ScanJob,
        scanner: DriveScanner,
        tmp_db: str,
        final_db: str,
    ) -> None:
        try:
            meta = scanner.run()
            info = disk_information(job.root)
            meta.update(
                {
                    "drive": job.letter,
                    "label": info["label"],
                    "used": info["used"],
                    "free": info["free"],
                    "capacity": info["total"],
                    "db_name": os.path.basename(final_db),
                }
            )
            if os.path.exists(tmp_db):
                os.replace(tmp_db, final_db)
            json_path = os.path.splitext(final_db)[0] + ".json"
            tmp_json = json_path + ".tmp"
            with open(tmp_json, "w", encoding="utf-8") as handle:
                json.dump(meta, handle, ensure_ascii=False, indent=2)
            os.replace(tmp_json, json_path)
            with self.lock:
                state["meta"] = meta
                state["db_path"] = final_db
                state["last_error"] = None
            job.set_status("done")
            self._prune_caches(job.letter)
        except BaseException as exc:
            try:
                if os.path.exists(tmp_db):
                    os.remove(tmp_db)
            except OSError:
                pass
            message = f"{type(exc).__name__}: {exc}"
            _log(f"scan {job.letter}: failed: {message}\n{traceback.format_exc()}")
            with self.lock:
                state["last_error"] = message
            job.set_status("error", message)

    # -- querying --------------------------------------------------------

    def _validate_path(self, state: dict[str, Any], path: str) -> tuple[str, str]:
        root = state["root"]
        root_key = _key(root)
        if not path:
            path = root
        path = os.path.normpath(path)
        key = _key(path)
        prefix = root_key.rstrip("\\") + "\\"
        if key != root_key and not key.startswith(prefix):
            raise PermissionError("路径不在该磁盘内")
        return path, key

    def get_tree(self, letter: str, path: str, limit: int = 500) -> dict[str, Any]:
        letter = letter.upper()
        state = self.states.get(letter)
        if not state or state.get("removed"):
            raise ValueError(f"磁盘 {letter}: 不存在")
        path, key = self._validate_path(state, path)
        db_path = state.get("db_path")
        meta = state.get("meta")
        job = state.get("job")
        job_snapshot = job.snapshot() if job else None
        if not db_path or not meta or not os.path.isfile(db_path):
            return {
                "ready": False,
                "drive": {
                    "letter": letter,
                    "root": state["root"],
                    "label": state.get("label"),
                },
                "scan": job_snapshot,
                "cache": None,
                "path": path,
            }
        limit = max(1, min(int(limit or 500), 5000))
        conn = _connect_ro(db_path)
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                "SELECT path,parent_key,name,size,files_size,files_count,dirs_count,error "
                "FROM dirs WHERE key = ?",
                (key,),
            ).fetchone()
            if row is None:
                raise FileNotFoundError("该目录不在扫描缓存中，可能已被移动或删除")
            totals = conn.execute(
                "SELECT COUNT(*) AS count, COALESCE(SUM(size),0) AS size "
                "FROM dirs WHERE parent_key = ?",
                (key,),
            ).fetchone()
            rows = conn.execute(
                "SELECT path,name,size,files_count,dirs_count,error FROM dirs "
                "WHERE parent_key = ? ORDER BY size DESC, name COLLATE NOCASE ASC LIMIT ?",
                (key, limit),
            ).fetchall()
        finally:
            conn.close()

        children = [
            {
                "kind": "dir",
                "name": child["name"],
                "path": child["path"],
                "size": int(child["size"]),
                "files": int(child["files_count"]),
                "dirs": int(child["dirs_count"]),
                "error": bool(child["error"]),
            }
            for child in rows
        ]
        shown = sum(item["size"] for item in children)
        total_count = int(totals["count"])
        total_size = int(totals["size"])
        return {
            "ready": True,
            "drive": {
                "letter": letter,
                "root": state["root"],
                "label": state.get("label"),
            },
            "path": row["path"],
            "name": row["name"],
            "size": int(row["size"]),
            "parent": _parent_path(row["path"], state["root"]),
            "files_size": int(row["files_size"]),
            "files_count": int(row["files_count"]),
            "dirs_count": int(row["dirs_count"]),
            "error": bool(row["error"]),
            "children": children,
            "other_count": max(0, total_count - len(children)),
            "other_size": max(0, total_size - shown),
            "limit": limit,
            "cache": self._cache_summary(state) | {"drive": letter},
            "scan": job_snapshot,
        }

    def get_files(self, letter: str, path: str, limit: int = 1000) -> dict[str, Any]:
        letter = letter.upper()
        state = self.states.get(letter)
        if not state or state.get("removed"):
            raise ValueError(f"磁盘 {letter}: 不存在")
        path, _ = self._validate_path(state, path)
        if not os.path.isdir(path):
            raise FileNotFoundError("目录不存在")
        files: list[dict[str, Any]] = []
        total_size = 0
        total_count = 0
        errors = 0
        try:
            with os.scandir(path) as iterator:
                for entry in iterator:
                    try:
                        st = entry.stat(follow_symlinks=False)
                        if getattr(st, "st_file_attributes", 0) & 0x400:
                            continue
                        if not os.path.isfile(entry.path):
                            continue
                        size = max(0, int(st.st_size))
                        total_size += size
                        total_count += 1
                        files.append(
                            {
                                "name": entry.name,
                                "path": entry.path,
                                "size": size,
                                "modified": st.st_mtime,
                                "system": bool(getattr(st, "st_file_attributes", 0) & 0x4),
                            }
                        )
                    except OSError:
                        errors += 1
        except OSError as exc:
            raise PermissionError(f"无法读取目录: {exc}") from exc
        files.sort(key=lambda item: item["size"], reverse=True)
        limit = max(1, min(int(limit or 1000), 5000))
        return {
            "path": path,
            "files": files[:limit],
            "total_count": total_count,
            "total_size": total_size,
            "shown": min(len(files), limit),
            "errors": errors,
        }

    def get_dir_size(self, path: str) -> int | None:
        """Return an indexed directory size, or None when the path is not cached."""
        letter = os.path.splitdrive(os.path.normpath(path))[0][:1].upper()
        state = self.states.get(letter)
        if not state:
            return None
        db_path = state.get("db_path")
        if not db_path or not os.path.isfile(db_path):
            return None
        try:
            conn = _connect_ro(db_path)
            try:
                row = conn.execute("SELECT size FROM dirs WHERE key = ?", (_key(path),)).fetchone()
                return int(row[0]) if row else None
            finally:
                conn.close()
        except Exception:
            return None

    def search_files(
        self,
        query: str,
        letter: str | None = None,
        limit: int = 300,
    ) -> dict[str, Any]:
        query = (query or "").strip()
        if not query:
            return {"query": "", "results": [], "truncated": False, "searched_drives": []}
        needle = query.casefold()[:200]
        limit = max(1, min(int(limit or 300), 500))
        states = []
        if letter:
            state = self.states.get(letter.upper())
            if state:
                states = [state]
        else:
            states = [s for s in self.states.values() if not s.get("removed")]
        results: list[dict[str, Any]] = []
        searched: list[str] = []
        for state in sorted(states, key=lambda s: s["letter"]):
            db_path = state.get("db_path")
            if not db_path or not os.path.isfile(db_path):
                continue
            searched.append(state["letter"])
            try:
                conn = _connect_ro(db_path)
                conn.row_factory = sqlite3.Row
                try:
                    if len(needle) >= 3:
                        fts_query = '"' + needle.replace('"', '""') + '"'
                        rows = conn.execute(
                            "SELECT f.name, f.size, f.mtime, f.system, d.path AS parent_path, "
                            "CASE WHEN f.name_lower = ? THEN 0 "
                            "     WHEN substr(f.name_lower, 1, ?) = ? THEN 1 "
                            "     ELSE 2 END AS rank "
                            "FROM files_fts "
                            "JOIN files f ON f.rowid = files_fts.rowid "
                            "JOIN dirs d ON d.key = f.parent_key "
                            "WHERE files_fts MATCH ? "
                            "ORDER BY rank, f.size DESC LIMIT ?",
                            (needle, len(needle), needle, fts_query, limit),
                        ).fetchall()
                    else:
                        rows = conn.execute(
                            "SELECT f.name, f.size, f.mtime, f.system, d.path AS parent_path, "
                            "CASE WHEN f.name_lower = ? THEN 0 "
                            "     WHEN substr(f.name_lower, 1, ?) = ? THEN 1 "
                            "     ELSE 2 END AS rank "
                            "FROM files f JOIN dirs d ON d.key = f.parent_key "
                            "WHERE instr(f.name_lower, ?) > 0 "
                            "ORDER BY rank, f.size DESC LIMIT ?",
                            (needle, len(needle), needle, needle, limit),
                        ).fetchall()
                finally:
                    conn.close()
            except Exception as exc:
                _log(f"search {state['letter']}: {exc}")
                continue
            for row in rows:
                parent_path = row["parent_path"]
                results.append(
                    {
                        "drive": state["letter"],
                        "name": row["name"],
                        "parent": parent_path,
                        "path": os.path.join(parent_path, row["name"]),
                        "size": int(row["size"]),
                        "mtime": float(row["mtime"] or 0),
                        "system": bool(row["system"]),
                        "rank": int(row["rank"]),
                    }
                )
        results.sort(key=lambda item: (item["rank"], -(item["size"] or 0), item["name"].casefold()))
        truncated = len(results) >= limit
        return {
            "query": query,
            "results": results[:limit],
            "truncated": truncated,
            "searched_drives": searched,
        }

    def find_large_files(self, threshold: int, limit: int = 200) -> list[dict[str, Any]]:
        threshold = max(0, int(threshold or 0))
        limit = max(1, min(int(limit or 200), 500))
        results: list[dict[str, Any]] = []
        for state in sorted(self.states.values(), key=lambda s: s["letter"]):
            if state.get("removed"):
                continue
            db_path = state.get("db_path")
            if not db_path or not os.path.isfile(db_path):
                continue
            try:
                conn = _connect_ro(db_path)
                conn.row_factory = sqlite3.Row
                try:
                    rows = conn.execute(
                        "SELECT f.name, f.size, f.mtime, f.system, d.path AS parent_path "
                        "FROM files f JOIN dirs d ON d.key = f.parent_key "
                        "WHERE f.size >= ? AND f.system = 0 "
                        "ORDER BY f.size DESC LIMIT ?",
                        (threshold, limit),
                    ).fetchall()
                finally:
                    conn.close()
            except Exception as exc:
                _log(f"large files {state['letter']}: {exc}")
                continue
            for row in rows:
                parent_path = row["parent_path"]
                results.append(
                    {
                        "drive": state["letter"],
                        "name": row["name"],
                        "parent": parent_path,
                        "path": os.path.join(parent_path, row["name"]),
                        "size": int(row["size"]),
                        "mtime": float(row["mtime"] or 0),
                        "system": False,
                    }
                )
        results.sort(key=lambda item: item["size"], reverse=True)
        return results[:limit]

    def stats(self) -> dict[str, Any]:
        with self.lock:
            jobs = []
            for state in self.states.values():
                if state.get("job"):
                    jobs.append(state["job"].snapshot())
            return {"jobs": jobs}


def _parent_path(path: str, root: str) -> str | None:
    norm = os.path.normpath(path)
    if _key(norm) == _key(root):
        return None
    parent = os.path.dirname(norm)
    if _key(parent) == _key(root):
        return root
    return parent


# ---------------------------------------------------------------------------
# HTTP layer
# ---------------------------------------------------------------------------


class QuietServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request: Any, client_address: Any) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError)):
            return
        super().handle_error(request, client_address)


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


class Handler(BaseHTTPRequestHandler):
    server_version = "DiskSpaceMap/1.0"
    protocol_version = "HTTP/1.1"
    manager: DriveManager
    moves: MoveManager
    cleaner: CleanupManager

    def log_message(self, fmt: str, *args: Any) -> None:
        # Polling every second would otherwise fill a log file with noise.
        pass

    # -- response helpers ------------------------------------------------

    def _send(self, status: int, body: bytes, content_type: str, extra: dict[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        if extra:
            for key, value in extra.items():
                self.send_header(key, value)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def error_json(self, message: str, status: int = 400) -> None:
        self.send_json({"ok": False, "error": message}, status)

    def read_json_body(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            length = 0
        if not length:
            return {}
        if length > 1024 * 1024:
            raise ApiError("请求过大", 413)
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception as exc:
            raise ApiError("无效的 JSON") from exc

    def query(self) -> dict[str, str]:
        parsed = urllib.parse.urlparse(self.path)
        return {k: v[-1] for k, v in urllib.parse.parse_qs(parsed.query, keep_blank_values=True).items()}

    # -- request routing -------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        try:
            if route.startswith("/api/"):
                self._handle_api_get(route)
            else:
                self._serve_static(route)
        except (ApiError, MoveError, CleanupError) as exc:
            self.error_json(exc.message, exc.status)
        except PermissionError as exc:
            self.error_json(str(exc), 403)
        except FileNotFoundError as exc:
            self.error_json(str(exc), 404)
        except ValueError as exc:
            self.error_json(str(exc), 400)
        except Exception as exc:
            _log(f"GET {self.path}: {type(exc).__name__}: {exc}\n{traceback.format_exc()}")
            self.error_json(f"服务器内部错误: {exc}", 500)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        try:
            body = self.read_json_body()
            params = self.query()
            params.update({key: str(value) for key, value in body.items() if not isinstance(value, (dict, list))})
            if route == "/api/refresh":
                letter = params.get("drive", "").upper()
                if not letter:
                    raise ApiError("缺少 drive 参数")
                if self.moves.busy_on_drive(letter):
                    raise ApiError(f"{letter}: 正在迁移文件，完成后才能刷新索引", 409)
                force = str(params.get("force", "0")).lower() in ("1", "true", "yes")
                trigger = params.get("trigger", "manual")
                result = self.manager.start_scan(letter, force=force, trigger=trigger)
                self.send_json({"ok": True, **result})
                return
            if route == "/api/move/start":
                if self.cleaner.is_busy():
                    raise ApiError("正在清理文件，完成后再迁移", 409)
                source = params.get("source", "")
                destination = params.get("destination", "")
                try:
                    size_hint = int(params.get("size", "0") or 0)
                except ValueError:
                    size_hint = 0
                job = self.moves.start(source, destination, size_hint)
                self.send_json({"ok": True, "job": job.snapshot()})
                return
            if route == "/api/cleanup/start":
                if self.moves.is_busy():
                    raise ApiError("正在迁移文件，完成后再清理", 409)
                ids = body.get("ids")
                if not isinstance(ids, list):
                    raise ApiError("缺少 ids 参数")
                ids = [str(item_id) for item_id in ids if isinstance(item_id, (str, int))]
                job = self.cleaner.start(ids)
                self.send_json({"ok": True, "job": job.snapshot()})
                return
            if route == "/api/cleanup/cancel":
                job_id = params.get("id", "")
                if not job_id:
                    raise ApiError("缺少任务 id")
                self.send_json({"ok": True, "job": self.cleaner.cancel(job_id)})
                return
            if route == "/api/move/cancel":
                job_id = params.get("id", "")
                if not job_id:
                    raise ApiError("缺少任务 id")
                self.send_json({"ok": True, "job": self.moves.cancel(job_id)})
                return
            if route == "/api/mkdir":
                parent = params.get("parent", "")
                name = params.get("name", "")
                path = self.moves.create_folder(parent, name)
                self.send_json({"ok": True, "path": path})
                return
            if route == "/api/open":
                path = params.get("path", "")
                self._open_folder(path)
                self.send_json({"ok": True})
                return
            if route == "/api/reveal":
                path = params.get("path", "")
                self._reveal_file(path)
                self.send_json({"ok": True})
                return
            raise ApiError("未知的接口", 404)
        except (ApiError, MoveError, CleanupError) as exc:
            self.error_json(exc.message, exc.status)
        except PermissionError as exc:
            self.error_json(str(exc), 403)
        except FileNotFoundError as exc:
            self.error_json(str(exc), 404)
        except ValueError as exc:
            self.error_json(str(exc), 400)
        except Exception as exc:
            _log(f"POST {self.path}: {type(exc).__name__}: {exc}\n{traceback.format_exc()}")
            self.error_json(f"服务器内部错误: {exc}", 500)

    def _handle_api_get(self, route: str) -> None:
        params = self.query()
        if route == "/api/ping":
            self.send_json({"ok": True, "app": APP_NAME, "version": APP_VERSION})
            return
        if route == "/api/drives":
            self.send_json({"ok": True, **self.manager.list_drives()})
            return
        if route == "/api/tree":
            letter = params.get("drive", "").upper()
            if not letter:
                raise ApiError("缺少 drive 参数")
            limit = int(params.get("limit", "500") or 500)
            data = self.manager.get_tree(letter, params.get("path", ""), limit=limit)
            self.send_json({"ok": True, **data})
            return
        if route == "/api/files":
            letter = params.get("drive", "").upper()
            if not letter:
                raise ApiError("缺少 drive 参数")
            limit = int(params.get("limit", "1000") or 1000)
            data = self.manager.get_files(letter, params.get("path", ""), limit=limit)
            self.send_json({"ok": True, **data})
            return
        if route == "/api/search":
            query = params.get("q", "")
            letter = params.get("drive", "").upper() or None
            try:
                limit = int(params.get("limit", "300") or 300)
            except ValueError:
                limit = 300
            self.send_json({"ok": True, **self.manager.search_files(query, letter, limit)})
            return
        if route == "/api/cleanup/scan":
            try:
                threshold = int(params.get("threshold", str(500 * 1024 * 1024)) or 500 * 1024 * 1024)
            except ValueError:
                threshold = 500 * 1024 * 1024
            self.send_json({"ok": True, **self.cleaner.scan(threshold)})
            return
        if route == "/api/cleanup/status":
            job_id = params.get("id", "")
            if not job_id:
                raise ApiError("缺少任务 id")
            self.send_json({"ok": True, "job": self.cleaner.get(job_id)})
            return
        if route == "/api/browse":
            path = params.get("path", "")
            source = params.get("source") or None
            self.send_json({"ok": True, **self.moves.browse(path, source)})
            return
        if route == "/api/move/status":
            job_id = params.get("id", "")
            if not job_id:
                raise ApiError("缺少任务 id")
            self.send_json({"ok": True, "job": self.moves.get(job_id)})
            return
        if route == "/api/status":
            self.send_json({"ok": True, **self.manager.list_drives()})
            return
        raise ApiError("未知的接口", 404)

    # -- actions ---------------------------------------------------------

    def _allowed_existing_path(self, path: str) -> str:
        if not path:
            raise ApiError("缺少 path 参数")
        path = os.path.normpath(path)
        if not os.path.isabs(path):
            raise ApiError("必须使用绝对路径")
        roots = list_drive_roots()
        if not any(_key(path) == _key(root) or _key(path).startswith(_key(root).rstrip("\\") + "\\") for root in roots):
            raise PermissionError("路径不在本地磁盘内")
        if not os.path.exists(path):
            raise FileNotFoundError("路径不存在")
        return path

    def _open_folder(self, path: str) -> None:
        path = self._allowed_existing_path(path)
        if not os.path.isdir(path):
            raise ApiError("这不是一个文件夹")
        os.startfile(path)  # type: ignore[attr-defined]

    def _reveal_file(self, path: str) -> None:
        path = self._allowed_existing_path(path)
        if os.path.isdir(path):
            os.startfile(path)  # type: ignore[attr-defined]
            return
        subprocess.Popen(["explorer.exe", f"/select,{path}"])

    # -- static files ----------------------------------------------------

    def _serve_static(self, route: str) -> None:
        if route in ("/", ""):
            route = "/index.html"
        relative = urllib.parse.unquote(route).lstrip("/")
        full = os.path.abspath(os.path.join(STATIC_DIR, relative))
        static_root = os.path.abspath(STATIC_DIR)
        if not (full == static_root or full.startswith(static_root + os.sep)):
            raise ApiError("禁止访问", 403)
        if not os.path.isfile(full):
            raise FileNotFoundError("页面不存在")
        with open(full, "rb") as handle:
            body = handle.read()
        mime = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if full.endswith(".js"):
            mime = "text/javascript; charset=utf-8"
        elif full.endswith(".css"):
            mime = "text/css; charset=utf-8"
        elif full.endswith(".svg"):
            mime = "image/svg+xml"
        elif mime.startswith("text/") and "charset" not in mime:
            mime += "; charset=utf-8"
        self._send(200, body, mime)

    def do_HEAD(self) -> None:  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------


def _ping(url: str, timeout: float = 0.25) -> bool:
    try:
        with urllib.request.urlopen(url + "/api/ping", timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("app") == APP_NAME
    except Exception:
        return False


def _running_url() -> str | None:
    """Find an already running instance quickly.

    Windows can make a connection attempt to an unused localhost port wait for
    nearly a second. Checking ten ports used to delay startup by ~9 seconds, so
    only the recorded port and the default port are checked.
    """
    ports: list[int] = []
    try:
        with open(PORT_FILE, "r", encoding="utf-8") as handle:
            ports.append(int(handle.read().strip()))
    except Exception:
        pass
    if DEFAULT_PORT not in ports:
        ports.append(DEFAULT_PORT)
    for port in ports[:2]:
        url = f"http://127.0.0.1:{port}"
        if _ping(url, timeout=0.35):
            return url
    return None


def _find_free_port() -> int:
    for port in range(DEFAULT_PORT, DEFAULT_PORT + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("找不到可用端口")


def _redirect_stdout_to_log() -> None:
    """Give pythonw a sane UTF-8 stream for prints and unexpected tracebacks."""
    is_pythonw = os.path.basename(sys.executable).lower().startswith("pythonw")
    if not is_pythonw and sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(DATA_DIR, exist_ok=True)
    stream = open(LOG_FILE, "a", encoding="utf-8", errors="replace", buffering=1)
    sys.stdout = stream
    sys.stderr = stream


def main() -> int:
    os.makedirs(DATA_DIR, exist_ok=True)
    _redirect_stdout_to_log()

    existing = _running_url()
    if existing:
        print(f"already running at {existing}")
        if "--no-browser" not in sys.argv:
            webbrowser.open(existing)
        return 0

    try:
        port = _find_free_port()
    except Exception as exc:
        _log(f"startup: {exc}")
        return 1

    manager = DriveManager()
    moves = MoveManager(
        BASE_DIR,
        DATA_DIR,
        MOVE_LOG,
        list_drive_roots,
    )
    cleaner = CleanupManager(manager, BASE_DIR, DATA_DIR, CLEAN_LOG)
    Handler.manager = manager
    Handler.moves = moves
    Handler.cleaner = cleaner
    try:
        server = QuietServer(("127.0.0.1", port), Handler)
    except OSError as exc:
        _log(f"bind {port}: {exc}")
        return 1
    url = f"http://127.0.0.1:{port}"
    with open(PORT_FILE, "w", encoding="utf-8") as handle:
        handle.write(str(port))
    print(f"{APP_TITLE} running at {url}", flush=True)
    _log(f"started at {url}")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
