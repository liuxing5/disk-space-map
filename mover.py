"""Safe file and folder migration engine.

Moves are intentionally conservative:

* a move on the same volume is a single atomic rename;
* a cross-volume move copies, verifies and only then deletes the source;
* reparse points, system files and Windows folders are refused;
* a failed or cancelled copy removes the partial destination and leaves the
  source untouched.

The web UI talks to this module through a small job API.
"""

from __future__ import annotations

import json
import os
import shutil
import stat as stat_module
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Callable

FILE_ATTRIBUTE_REPARSE_POINT = 0x400
FILE_ATTRIBUTE_SYSTEM = 0x4
COPY_CHUNK = 4 * 1024 * 1024
FREE_SPACE_MARGIN = 64 * 1024 * 1024
TERMINAL_STATUSES = {"done", "error", "cancelled", "partial"}
INVALID_NAME_CHARS = set('<>:"/\\|?*')


class MoveError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


class MoveCancelled(Exception):
    pass


class MoveDeleteError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def _key(path: str) -> str:
    return os.path.normcase(os.path.normpath(path))


def _within(path: str, parent: str) -> bool:
    p = _key(path)
    root = _key(parent).rstrip("\\")
    return p == root or p.startswith(root + "\\")


def _drive_letter(path: str) -> str:
    drive = os.path.splitdrive(os.path.normpath(path))[0]
    return drive[:1].upper() if drive else ""


def _remove_readonly(func: Callable[..., Any], path: str, exc_info: Any) -> None:
    try:
        os.chmod(path, stat_module.S_IWRITE)
        func(path)
    except Exception:
        pass


class MoveJob:
    def __init__(self, source: str, destination: str, size_hint: int) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.source = os.path.normpath(source)
        self.destination = os.path.normpath(destination)
        self.size_hint = max(0, int(size_hint or 0))
        self.source_drive = _drive_letter(self.source)
        self.destination_drive = _drive_letter(self.destination)
        self.same_volume = self.source_drive == self.destination_drive
        self.source_is_dir = os.path.isdir(self.source)
        self.status = "pending"
        self.stage = "准备中"
        self.total = self.size_hint
        self.copied = 0
        self.total_files = 0
        self.copied_files = 0
        self.current = ""
        self.target: str | None = None
        self.error: str | None = None
        self.started_at = time.time()
        self.finished_at: float | None = None
        self.cancel_event = threading.Event()
        self.deleting = False
        self._lock = threading.Lock()

    def update(self, **values: Any) -> None:
        with self._lock:
            for key, value in values.items():
                setattr(self, key, value)

    def add_copied(self, count: int, files: int = 0) -> None:
        if not count and not files:
            return
        with self._lock:
            self.copied += max(0, int(count))
            self.copied_files += int(files)

    def request_cancel(self) -> bool:
        with self._lock:
            if self.status in TERMINAL_STATUSES or self.deleting:
                return False
            self.cancel_event.set()
            self.stage = "正在取消…"
            return True

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            status = self.status
            total = max(0, self.total)
            copied = max(0, self.copied)
            if status == "done":
                percent = 100.0
            elif total > 0:
                percent = min(99.0, copied / total * 100.0)
            else:
                percent = 0.0
            elapsed = max(0.0, (self.finished_at or time.time()) - self.started_at)
            speed = copied / elapsed if elapsed > 0 else 0.0
            return {
                "id": self.id,
                "status": status,
                "stage": self.stage,
                "source": self.source,
                "destination": self.destination,
                "target": self.target,
                "source_drive": self.source_drive,
                "destination_drive": self.destination_drive,
                "same_volume": self.same_volume,
                "source_is_dir": self.source_is_dir,
                "total": total,
                "copied": copied,
                "total_files": self.total_files,
                "copied_files": self.copied_files,
                "current": self.current,
                "error": self.error,
                "percent": round(percent, 1),
                "speed": speed,
                "elapsed": round(elapsed, 1),
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "cancel_requested": self.cancel_event.is_set(),
            }


class MoveManager:
    def __init__(
        self,
        app_dir: str,
        data_dir: str,
        log_path: str,
        drive_roots_provider: Callable[[], list[str]],
    ) -> None:
        self.app_dir = os.path.normpath(app_dir)
        self.data_dir = os.path.normpath(data_dir)
        self.log_path = log_path
        self.roots_provider = drive_roots_provider
        self._lock = threading.RLock()
        self.jobs: dict[str, MoveJob] = {}
        self.active_id: str | None = None
        self._protected_source_subtrees = self._build_protected_source_subtrees()
        self._protected_source_exact = self._build_protected_source_exact()
        self._protected_destination_subtrees = self._build_protected_destination_subtrees()

    # -- path policy -----------------------------------------------------

    def _build_protected_source_subtrees(self) -> list[str]:
        paths = [self.app_dir, self.data_dir]
        for env in ("WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData", "LOCALAPPDATA", "APPDATA"):
            value = os.environ.get(env)
            if value:
                paths.append(value)
        home = os.path.expanduser("~")
        if home:
            paths.append(os.path.join(home, "AppData"))
        system_drive = os.environ.get("SystemDrive", "C:") + "\\"
        paths.extend(
            [
                os.path.join(system_drive, "Windows"),
                os.path.join(system_drive, "Program Files"),
                os.path.join(system_drive, "Program Files (x86)"),
                os.path.join(system_drive, "ProgramData"),
                os.path.join(system_drive, "Recovery"),
                os.path.join(system_drive, "System Volume Information"),
                os.path.join(system_drive, "$Recycle.Bin"),
            ]
        )
        return [p for p in paths if p and os.path.isabs(p)]

    def _build_protected_source_exact(self) -> list[str]:
        home = os.path.expanduser("~")
        paths = []
        if home:
            paths.extend([home, os.path.join(home, "Desktop")])
        system_drive = os.environ.get("SystemDrive", "C:") + "\\"
        paths.extend([os.path.join(system_drive, "Users"), system_drive])
        return [p for p in paths if p and os.path.isabs(p)]

    def _build_protected_destination_subtrees(self) -> list[str]:
        paths = [self.app_dir, self.data_dir]
        for env in ("WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"):
            value = os.environ.get(env)
            if value:
                paths.append(value)
        system_drive = os.environ.get("SystemDrive", "C:") + "\\"
        paths.extend(
            [
                os.path.join(system_drive, "Windows"),
                os.path.join(system_drive, "Program Files"),
                os.path.join(system_drive, "Program Files (x86)"),
                os.path.join(system_drive, "ProgramData"),
                os.path.join(system_drive, "System Volume Information"),
                os.path.join(system_drive, "$Recycle.Bin"),
            ]
        )
        return [p for p in paths if p and os.path.isabs(p)]

    def _drive_root(self, path: str) -> str | None:
        candidates = self.roots_provider()
        for root in candidates:
            if _within(path, root):
                return root
        return None

    def _root_protected_reason(self, path: str) -> str | None:
        blocked_names = {
            "$Recycle.Bin",
            "System Volume Information",
            "Recovery",
            "Windows",
            "Windows.old",
            "Program Files",
            "Program Files (x86)",
            "ProgramData",
            "Boot",
            "EFI",
            "$WinREAgent",
        }
        for root in self.roots_provider():
            for name in blocked_names:
                protected = os.path.join(root, name)
                if _within(path, protected):
                    return "系统、程序或卷信息目录不能移动"
        return None

    def _is_protected_source(self, path: str) -> str | None:
        for exact in self._protected_source_exact:
            if _key(path) == _key(exact):
                return "这是系统或用户目录的根位置，不能整体移动"
        for parent in self._protected_source_subtrees:
            if _within(path, parent):
                return "系统、程序或缓存目录不能移动"
        root = self._drive_root(path)
        if root is not None and _key(path) == _key(root):
            return "不能移动整个磁盘根目录"
        return self._root_protected_reason(path)

    def _is_protected_destination(self, path: str) -> str | None:
        for parent in self._protected_destination_subtrees:
            if _within(path, parent):
                return "不能把文件移入系统、程序或程序缓存目录"
        return self._root_protected_reason(path)

    def _stat(self, path: str) -> os.stat_result:
        try:
            return os.stat(path, follow_symlinks=False)
        except OSError as exc:
            raise MoveError(f"无法读取 {path}: {exc}") from exc

    def _source_error(self, path: str) -> str | None:
        path = os.path.normpath(path)
        if not os.path.exists(path):
            return "源项目不存在"
        if self._drive_root(path) is None:
            return "源路径不在本地磁盘内"
        st = self._stat(path)
        if getattr(st, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT:
            return "符号链接、Junction 或云占位项目不支持迁移，请使用资源管理器"
        attrs = getattr(st, "st_file_attributes", 0)
        if stat_module.S_ISREG(st.st_mode) and attrs & FILE_ATTRIBUTE_SYSTEM:
            return "系统文件不能移动"
        root = self._drive_root(path)
        if (
            stat_module.S_ISDIR(st.st_mode)
            and root is not None
            and attrs & FILE_ATTRIBUTE_SYSTEM
            and _key(os.path.dirname(path)) == _key(root)
        ):
            return "磁盘根目录下的系统文件夹不能移动"
        protected = self._is_protected_source(path)
        if protected:
            return protected
        return None

    def _destination_error(self, path: str) -> str | None:
        path = os.path.normpath(path)
        if not os.path.isdir(path):
            return "目标位置不是一个文件夹"
        if self._drive_root(path) is None:
            return "目标位置不在本地磁盘内"
        st = self._stat(path)
        if getattr(st, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT:
            return "目标位置是符号链接或云目录，暂不支持"
        protected = self._is_protected_destination(path)
        if protected:
            return protected
        return None

    def selection_error(self, source: str, destination: str) -> str | None:
        source = os.path.normpath(source)
        destination = os.path.normpath(destination)
        source_error = self._source_error(source)
        if source_error:
            return source_error
        destination_error = self._destination_error(destination)
        if destination_error:
            return destination_error
        if _key(source) == _key(destination):
            return "目标就是源文件夹本身"
        if os.path.isdir(source) and _within(destination, source):
            return "不能移动到源文件夹内部"
        if _key(os.path.dirname(source)) == _key(destination):
            return "源项目已经在这个文件夹里"
        return None

    # -- public browse/create API ---------------------------------------

    def browse(self, path: str, source: str | None = None) -> dict[str, Any]:
        if not path:
            raise MoveError("缺少目标路径")
        path = os.path.normpath(path)
        if not os.path.isabs(path):
            raise MoveError("目标路径必须是绝对路径")
        root = self._drive_root(path)
        if root is None:
            raise MoveError("目标路径不在本地磁盘内")
        if not os.path.isdir(path):
            raise MoveError("目标文件夹不存在", 404)
        source = os.path.normpath(source) if source else None
        try:
            usage = shutil.disk_usage(root)
            free, total = int(usage.free), int(usage.total)
        except OSError:
            free = total = 0

        dirs: list[dict[str, Any]] = []
        try:
            with os.scandir(path) as iterator:
                for entry in iterator:
                    try:
                        st = entry.stat(follow_symlinks=False)
                    except OSError:
                        continue
                    if not stat_module.S_ISDIR(st.st_mode):
                        continue
                    attrs = getattr(st, "st_file_attributes", 0)
                    reason = None
                    if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
                        reason = "符号链接或云目录"
                    elif self._is_protected_destination(entry.path):
                        reason = "系统/程序目录"
                    elif source and _within(entry.path, source):
                        reason = "位于源文件夹内部"
                    dirs.append(
                        {
                            "name": entry.name,
                            "path": entry.path,
                            "disabled": reason,
                        }
                    )
        except OSError as exc:
            raise MoveError(f"无法读取目标文件夹: {exc}") from exc
        dirs.sort(key=lambda item: (item["disabled"] is not None, item["name"].lower()))
        reason = self.selection_error(source, path) if source else self._destination_error(path)
        return {
            "path": path,
            "parent": None if _key(path) == _key(root) else os.path.dirname(path),
            "drive": root,
            "letter": root[0].upper(),
            "total": total,
            "free": free,
            "dirs": dirs,
            "can_select": reason is None,
            "reason": reason,
        }

    def create_folder(self, parent: str, name: str) -> str:
        parent = os.path.normpath(parent or "")
        name = (name or "").strip()
        if not name:
            raise MoveError("文件夹名称不能为空")
        if name in (".", "..") or name.endswith((" ", ".")):
            raise MoveError("文件夹名称不合法")
        if any(ch in INVALID_NAME_CHARS or ord(ch) < 32 for ch in name):
            raise MoveError("文件夹名称包含非法字符")
        if len(name) > 180:
            raise MoveError("文件夹名称过长")
        stem = name.split(".")[0].upper()
        if stem in {"CON", "PRN", "AUX", "NUL"} or stem in {f"COM{i}" for i in range(1, 10)} or stem in {
            f"LPT{i}" for i in range(1, 10)
        }:
            raise MoveError("文件夹名称是 Windows 保留名称")
        error = self._destination_error(parent)
        if error:
            raise MoveError(error)
        target = os.path.join(parent, name)
        if os.path.lexists(target):
            raise MoveError("同名文件夹已经存在", 409)
        try:
            os.mkdir(target)
        except OSError as exc:
            raise MoveError(f"创建文件夹失败: {exc}") from exc
        return target

    # -- job lifecycle ---------------------------------------------------

    def _active_job(self) -> MoveJob | None:
        with self._lock:
            job = self.jobs.get(self.active_id or "")
            if job and job.status not in TERMINAL_STATUSES:
                return job
            return None

    def is_busy(self) -> bool:
        return self._active_job() is not None

    def busy_on_drive(self, letter: str) -> bool:
        job = self._active_job()
        if not job:
            return False
        letter = letter.upper()
        return job.source_drive == letter or job.destination_drive == letter

    def start(self, source: str, destination: str, size_hint: int = 0) -> MoveJob:
        if not source or not destination:
            raise MoveError("缺少源或目标路径")
        source = os.path.normpath(source)
        destination = os.path.normpath(destination)
        error = self.selection_error(source, destination)
        if error:
            raise MoveError(error, 409 if "空间不足" in error else 400)
        with self._lock:
            if self._active_job() is not None:
                raise MoveError("已有迁移任务正在进行，请等它完成", 409)
            job = MoveJob(source, destination, size_hint)
            self.jobs[job.id] = job
            self.active_id = job.id
            # Trim finished jobs, never the active one.
            if len(self.jobs) > 30:
                for job_id, old in list(self.jobs.items()):
                    if job_id != self.active_id and old.status in TERMINAL_STATUSES:
                        self.jobs.pop(job_id, None)
        thread = threading.Thread(target=self._run, args=(job,), name=f"disk-map-move-{job.id}", daemon=True)
        thread.start()
        return job

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self.jobs.get(job_id)
        if not job:
            raise MoveError("迁移任务不存在", 404)
        return job.snapshot()

    def cancel(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self.jobs.get(job_id)
        if not job:
            raise MoveError("迁移任务不存在", 404)
        job.request_cancel()
        return job.snapshot()

    # -- worker ----------------------------------------------------------

    def _run(self, job: MoveJob) -> None:
        created_target: str | None = None
        try:
            job.update(status="running", stage="检查项目")
            error = self.selection_error(job.source, job.destination)
            if error:
                raise MoveError(error)
            st = self._stat(job.source)
            is_dir = stat_module.S_ISDIR(st.st_mode)
            job.update(source_is_dir=is_dir)

            if job.same_volume:
                job.update(stage="正在移动")
                target = self._unique_target(job.destination, os.path.basename(job.source.rstrip("\\")), is_dir)
                job.update(target=target)
                try:
                    os.rename(job.source, target)
                except OSError as exc:
                    raise MoveError(f"移动失败: {exc}") from exc
                total = max(0, int(st.st_size)) if not is_dir else job.size_hint
                job.update(
                    status="done",
                    stage="完成",
                    copied=total,
                    total=total,
                    total_files=0 if is_dir else 1,
                    copied_files=0 if is_dir else 1,
                    finished_at=time.time(),
                    deleting=False,
                )
                return

            # Cross-volume path: copy first, verify, then remove the source.
            job.update(status="copying", stage="正在计算大小")
            if is_dir:
                total, files = self._measure(job.source, job)
            else:
                total, files = max(0, int(st.st_size)), 1
            job.update(total=total, total_files=files)
            if job.cancel_event.is_set():
                raise MoveCancelled()
            destination_root = self._drive_root(job.destination) or job.destination
            try:
                free = int(shutil.disk_usage(destination_root).free)
            except OSError:
                free = 0
            if free < total + FREE_SPACE_MARGIN:
                raise MoveError(
                    f"目标磁盘空间不足：需要 {total + FREE_SPACE_MARGIN:,} 字节，可用 {free:,} 字节"
                )

            target = self._unique_target(job.destination, os.path.basename(job.source.rstrip("\\")), is_dir)
            job.update(target=target, stage="正在复制", status="copying")
            if is_dir:
                try:
                    os.mkdir(target)
                except FileExistsError as exc:
                    raise MoveError("目标位置出现了同名项目，请重新选择") from exc
                created_target = target
                self._copy_directory(job.source, target, job)
                if job.copied != total or job.copied_files != files:
                    raise MoveError("源文件夹在移动过程中发生变化，已取消并保留原文件")
            else:
                try:
                    with open(target, "xb"):
                        pass
                except FileExistsError as exc:
                    raise MoveError("目标位置出现了同名文件，请重新选择") from exc
                created_target = target
                self._copy_file(job.source, target, job, reserved=True)
                if job.copied != total or job.copied_files != files:
                    raise MoveError("源文件在移动过程中发生变化，已取消并保留原文件")
            if job.cancel_event.is_set():
                raise MoveCancelled()

            job.update(status="deleting", stage="正在删除原位置", deleting=True)
            self._delete_source(job.source, is_dir)
            job.update(
                status="done",
                stage="完成",
                finished_at=time.time(),
                deleting=False,
            )
        except MoveCancelled:
            if created_target:
                self._remove_partial(created_target)
            job.update(status="cancelled", stage="已取消", error="已取消，原文件未受影响", finished_at=time.time())
        except MoveDeleteError as exc:
            # The copy is complete and valid. Keep it, even though the source
            # could not be removed (for example because a file is locked).
            job.update(
                status="partial",
                stage="已复制，原文件未删除",
                error=exc.message,
                finished_at=time.time(),
                deleting=False,
            )
        except MoveError as exc:
            if created_target:
                self._remove_partial(created_target)
            job.update(status="error", stage="失败", error=str(exc), finished_at=time.time(), deleting=False)
        except Exception as exc:  # noqa: BLE001 - report unexpected I/O failures
            if created_target:
                self._remove_partial(created_target)
            job.update(
                status="error",
                stage="失败",
                error=f"{type(exc).__name__}: {exc}",
                finished_at=time.time(),
                deleting=False,
            )
        finally:
            with self._lock:
                if self.active_id == job.id:
                    self.active_id = None
            self._write_log(job)

    def _unique_target(self, destination: str, name: str, is_dir: bool) -> str:
        name = name or "未命名"
        if is_dir:
            stem, ext = name, ""
        else:
            stem, ext = os.path.splitext(name)
        candidate = name
        index = 1
        while os.path.lexists(os.path.join(destination, candidate)):
            candidate = f"{stem} ({index}){ext}"
            index += 1
            if index > 9999:
                raise MoveError("目标文件夹中同名项目过多，无法自动重命名")
        return os.path.join(destination, candidate)

    def _measure(self, source: str, job: MoveJob) -> tuple[int, int]:
        total = 0
        files = 0
        stack = [source]
        while stack:
            if job.cancel_event.is_set():
                raise MoveCancelled()
            current = stack.pop()
            job.update(current=current, stage="正在计算大小")
            try:
                with os.scandir(current) as iterator:
                    for entry in iterator:
                        if job.cancel_event.is_set():
                            raise MoveCancelled()
                        try:
                            st = entry.stat(follow_symlinks=False)
                        except OSError as exc:
                            raise MoveError(f"无法读取 {entry.path}: {exc}") from exc
                        attrs = getattr(st, "st_file_attributes", 0)
                        if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
                            raise MoveError("待迁移文件夹包含符号链接或云占位项目，请使用资源管理器")
                        if stat_module.S_ISDIR(st.st_mode):
                            stack.append(entry.path)
                        elif stat_module.S_ISREG(st.st_mode):
                            total += max(0, int(st.st_size))
                            files += 1
            except OSError as exc:
                raise MoveError(f"无法读取 {current}: {exc}") from exc
        return total, files

    def _copy_directory(self, source: str, target: str, job: MoveJob) -> None:
        directories: list[tuple[str, str]] = [(source, target)]
        stack = [(source, target)]
        while stack:
            if job.cancel_event.is_set():
                raise MoveCancelled()
            src_dir, dst_dir = stack.pop()
            job.update(current=src_dir)
            try:
                with os.scandir(src_dir) as iterator:
                    entries = list(iterator)
            except OSError as exc:
                raise MoveError(f"无法读取 {src_dir}: {exc}") from exc
            for entry in entries:
                if job.cancel_event.is_set():
                    raise MoveCancelled()
                try:
                    st = entry.stat(follow_symlinks=False)
                except OSError as exc:
                    raise MoveError(f"无法读取 {entry.path}: {exc}") from exc
                attrs = getattr(st, "st_file_attributes", 0)
                if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
                    raise MoveError("待迁移文件夹包含符号链接或云占位项目，请使用资源管理器")
                dst_path = os.path.join(dst_dir, entry.name)
                if stat_module.S_ISDIR(st.st_mode):
                    os.mkdir(dst_path)
                    directories.append((entry.path, dst_path))
                    stack.append((entry.path, dst_path))
                elif stat_module.S_ISREG(st.st_mode):
                    self._copy_file(entry.path, dst_path, job)
        for src_dir_path, dst_dir_path in reversed(directories):
            try:
                shutil.copystat(src_dir_path, dst_dir_path, follow_symlinks=False)
            except OSError:
                pass

    def _copy_file(self, source: str, target: str, job: MoveJob, reserved: bool = False) -> None:
        job.update(current=source)
        try:
            mode = "wb" if reserved else "xb"
            with open(source, "rb") as source_file, open(target, mode) as target_file:
                while True:
                    if job.cancel_event.is_set():
                        raise MoveCancelled()
                    chunk = source_file.read(COPY_CHUNK)
                    if not chunk:
                        break
                    target_file.write(chunk)
                    job.add_copied(len(chunk))
        except MoveCancelled:
            raise
        except OSError as exc:
            raise MoveError(f"复制失败 {source}: {exc}") from exc
        try:
            shutil.copystat(source, target, follow_symlinks=False)
        except OSError:
            pass
        job.add_copied(0, files=1)

    def _delete_source(self, source: str, is_dir: bool) -> None:
        try:
            if is_dir:
                shutil.rmtree(source, onerror=_remove_readonly)
            else:
                try:
                    os.remove(source)
                except PermissionError:
                    os.chmod(source, stat_module.S_IWRITE)
                    os.remove(source)
            if os.path.lexists(source):
                raise MoveDeleteError("已成功复制到目标位置，但原位置仍有项目未能删除")
        except MoveDeleteError:
            raise
        except OSError as exc:
            raise MoveDeleteError(f"已成功复制到目标位置，但删除原文件失败：{exc}") from exc

    def _remove_partial(self, path: str) -> None:
        try:
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path, onerror=_remove_readonly)
            elif os.path.lexists(path):
                os.chmod(path, stat_module.S_IWRITE)
                os.remove(path)
        except Exception:
            pass

    def _write_log(self, job: MoveJob) -> None:
        entry = {
            "time": datetime.now().astimezone().isoformat(timespec="seconds"),
            "id": job.id,
            "source": job.source,
            "target": job.target,
            "destination": job.destination,
            "status": job.status,
            "bytes": job.copied,
            "files": job.copied_files,
            "error": job.error,
        }
        try:
            with open(self.log_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass
