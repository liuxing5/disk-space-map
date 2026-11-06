"""Smart cleanup scanner and conservative deletion engine.

Only server-generated candidates can be deleted.  Cache candidates remove the
*contents* of known cache folders and keep the folder itself; large files are
individual user-selected files.  Every deletion is explicit and auditable.
"""

from __future__ import annotations

import glob
import hashlib
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
TERMINAL_STATUSES = {"done", "error", "cancelled"}
MIN_CACHE_SIZE = 1024 * 1024
DANGEROUS_EXTENSIONS = {
    # Virtual machine / container disks contain live data and must not be
    # offered as "large files" for one-click cleanup.
    ".vhd",
    ".vhdx",
    ".avhdx",
    ".vmdk",
    ".vdi",
    ".qcow2",
    ".ova",
    ".ovf",
    ".pvm",
    ".vmem",
    ".vmsn",
    # Binaries, libraries and code repositories.
    ".dll",
    ".lib",
    ".sys",
    ".drv",
    ".pyd",
    ".so",
    ".dylib",
    ".node",
    ".py",
    ".pyc",
    ".class",
    ".jar",
    # Application/database payloads that are easy to lose and hard to rebuild.
    ".pak",
    ".cab",
    ".msi",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".mdb",
    ".edb",
}


class CleanupError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


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


class CleanupJob:
    def __init__(self, candidates: list[dict[str, Any]]) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.candidates = candidates
        self.total = len(candidates)
        self.total_bytes = sum(max(0, int(c["size"])) for c in candidates)
        self.status = "running"
        self.stage = "准备清理"
        self.completed = 0
        self.freed = 0
        self.current = ""
        self.errors: list[dict[str, str]] = []
        self.error_count = 0
        self.started_at = time.time()
        self.finished_at: float | None = None
        self.cancel_event = threading.Event()
        self._lock = threading.Lock()

    def update(self, **values: Any) -> None:
        with self._lock:
            for key, value in values.items():
                setattr(self, key, value)

    def add_freed(self, size: int) -> None:
        if size:
            with self._lock:
                self.freed += max(0, int(size))

    def add_error(self, path: str, message: str) -> None:
        with self._lock:
            self.error_count += 1
            if len(self.errors) < 30:
                self.errors.append({"path": path, "error": message})

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            completed = self.completed
            total = max(1, self.total)
            freed = self.freed
            total_bytes = max(1, self.total_bytes)
            if self.status == "done":
                percent = 100.0
            else:
                percent = min(99.0, max(completed / total, freed / total_bytes) * 100.0)
            return {
                "id": self.id,
                "status": self.status,
                "stage": self.stage,
                "total": self.total,
                "completed": completed,
                "total_bytes": self.total_bytes,
                "freed": freed,
                "current": self.current,
                "errors": list(self.errors),
                "error_count": self.error_count,
                "percent": round(percent, 1),
                "elapsed": round(max(0.0, (self.finished_at or time.time()) - self.started_at), 1),
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "cancel_requested": self.cancel_event.is_set(),
            }


class CleanupManager:
    def __init__(
        self,
        drive_manager: Any,
        app_dir: str,
        data_dir: str,
        log_path: str,
    ) -> None:
        self.drive_manager = drive_manager
        self.app_dir = os.path.normpath(app_dir)
        self.data_dir = os.path.normpath(data_dir)
        self.log_path = log_path
        self._lock = threading.RLock()
        self.last_scan: dict[str, dict[str, Any]] = {}
        self.last_scan_at = 0.0
        self.active_id: str | None = None
        self.jobs: dict[str, CleanupJob] = {}
        self._drive_roots: list[str] = []

    def _refresh_drive_roots(self) -> list[str]:
        try:
            drives = self.drive_manager.list_drives().get("drives", [])
            self._drive_roots = [drive["root"] for drive in drives if not drive.get("removed")]
        except Exception:
            self._drive_roots = []
        return self._drive_roots

    # -- candidate discovery --------------------------------------------

    def _chromium_cache_paths(self, base: str, label: str) -> list[tuple[str, str, str, str]]:
        paths: list[tuple[str, str, str, str]] = []
        if not base or not os.path.isdir(base):
            return paths
        for profile in glob.glob(os.path.join(base, "*")):
            if not os.path.isdir(profile):
                continue
            profile_name = os.path.basename(profile)
            for child, pretty in (
                ("Cache", "网页缓存"),
                ("Code Cache", "脚本缓存"),
                ("GPUCache", "GPU 缓存"),
                ("DawnCache", "图形缓存"),
                ("GrShaderCache", "着色器缓存"),
                ("ShaderCache", "着色器缓存"),
                (os.path.join("Service Worker", "CacheStorage"), "Service Worker 缓存"),
            ):
                path = os.path.join(profile, child)
                if os.path.isdir(path):
                    paths.append(
                        (
                            path,
                            f"{label} {profile_name} · {pretty}",
                            "浏览器缓存",
                            "浏览器运行时可能跳过部分正在使用的文件",
                        )
                    )
        return paths

    def _known_cache_targets(self) -> list[tuple[str, str, str, str]]:
        local = os.environ.get("LOCALAPPDATA") or ""
        roaming = os.environ.get("APPDATA") or ""
        temp = os.environ.get("TEMP") or ""
        windir = os.environ.get("WINDIR") or ""
        targets: list[tuple[str, str, str, str]] = []
        if temp:
            targets.append((temp, "用户临时文件", "临时文件", "正在使用的文件会自动跳过"))
        if windir:
            targets.append((os.path.join(windir, "Temp"), "Windows 临时文件", "系统临时文件", "部分文件可能需要管理员权限"))
        if local:
            targets.extend(
                [
                    (os.path.join(local, "CrashDumps"), "应用崩溃转储", "崩溃转储", ""),
                    (os.path.join(local, "pip", "Cache"), "pip 缓存", "开发工具缓存", ""),
                    (os.path.join(local, "npm-cache"), "npm 缓存", "开发工具缓存", ""),
                    (os.path.join(local, "pnpm-cache"), "pnpm 缓存", "开发工具缓存", ""),
                    (os.path.join(local, "pnpm-store"), "pnpm 内容仓库", "开发工具缓存", ""),
                    (os.path.join(local, "Yarn", "Cache"), "Yarn 缓存", "开发工具缓存", ""),
                    (os.path.join(local, "uv", "cache"), "uv 缓存", "开发工具缓存", ""),
                    (os.path.join(local, "D3DSCache"), "DirectX 着色器缓存", "显卡缓存", ""),
                    (os.path.join(local, "NVIDIA", "DXCache"), "NVIDIA 着色器缓存", "显卡缓存", ""),
                    (os.path.join(local, "Microsoft", "Windows", "INetCache"), "系统网络缓存", "系统缓存", "部分文件可能正在使用"),
                ]
            )
            targets.extend(self._chromium_cache_paths(os.path.join(local, "Microsoft", "Edge", "User Data"), "Edge"))
            targets.extend(self._chromium_cache_paths(os.path.join(local, "Google", "Chrome", "User Data"), "Chrome"))
            targets.extend(self._chromium_cache_paths(os.path.join(local, "BraveSoftware", "Brave-Browser", "User Data"), "Brave"))
        if roaming:
            firefox = os.path.join(roaming, "Mozilla", "Firefox", "Profiles")
            for profile in glob.glob(os.path.join(firefox, "*")):
                path = os.path.join(profile, "cache2")
                if os.path.isdir(path):
                    targets.append((path, f"Firefox {os.path.basename(profile)} · 缓存", "浏览器缓存", ""))
        return targets

    def _is_protected(self, path: str) -> bool:
        windows_temp = os.path.join(os.environ.get("WINDIR") or "C:\\Windows", "Temp")
        if _within(path, windows_temp):
            return False
        roots = [
            self.app_dir,
            self.data_dir,
            os.environ.get("WINDIR") or "C:\\Windows",
            os.environ.get("ProgramFiles") or "C:\\Program Files",
            os.environ.get("ProgramFiles(x86)") or "C:\\Program Files (x86)",
            os.environ.get("ProgramData") or "C:\\ProgramData",
        ]
        for root in roots:
            if root and _within(path, root):
                return True
        for root in self._drive_roots:
            for name in (
                "Windows",
                "Windows.old",
                "Program Files",
                "Program Files (x86)",
                "ProgramData",
                "Boot",
                "EFI",
                "$WinREAgent",
                "Recovery",
                "System Volume Information",
                "$Recycle.Bin",
            ):
                if _within(path, os.path.join(root, name)):
                    return True
        return False

    def _large_file_block_reason(self, path: str) -> str | None:
        if self._is_protected(path):
            return "受保护的系统/程序路径"
        lower = path.casefold()
        parts = {part for part in lower.replace("/", "\\").split("\\") if part}
        home = os.path.expanduser("~")
        for data_root in (
            os.path.join(home, "AppData") if home else "",
            os.environ.get("LOCALAPPDATA") or "",
            os.environ.get("APPDATA") or "",
        ):
            if data_root and _within(path, data_root):
                return "应用数据目录，不在智能清理的大文件列表中"
        for component in (".git", "node_modules", "site-packages", "__pycache__", "winsxs"):
            if component in parts:
                return "代码/依赖/系统组件目录，已排除"
        ext = os.path.splitext(path)[1].lower()
        if ext in DANGEROUS_EXTENSIONS:
            return "虚拟机磁盘、程序库或数据库文件，已排除"
        return None

    def _drive_root(self, path: str) -> str | None:
        roots = self._drive_roots
        if not roots:
            roots = self._refresh_drive_roots()
        for root in roots:
            if _within(path, root):
                return root
        return None

    def _candidate_id(self, kind: str, path: str) -> str:
        return hashlib.sha1(f"{kind}\0{_key(path)}".encode("utf-8")).hexdigest()[:16]

    def scan(self, threshold: int = 500 * 1024 * 1024) -> dict[str, Any]:
        self._refresh_drive_roots()
        threshold = max(50 * 1024 * 1024, int(threshold or 500 * 1024 * 1024))
        seen: set[str] = set()
        cache_candidates: list[dict[str, Any]] = []
        cache_roots: list[str] = []
        for path, label, category, warning in self._known_cache_targets():
            if not path or not os.path.isdir(path):
                continue
            key = _key(path)
            if key in seen:
                continue
            seen.add(key)
            if self._is_protected(path):
                continue
            size = self.drive_manager.get_dir_size(path)
            if not size or size < MIN_CACHE_SIZE:
                continue
            candidate = {
                "id": self._candidate_id("cache", path),
                "kind": "cache",
                "name": label,
                "path": path,
                "size": int(size),
                "category": category,
                "warning": warning,
                "recommended": True,
                "drive": _drive_letter(path),
            }
            cache_candidates.append(candidate)
            cache_roots.append(path)
        cache_candidates.sort(key=lambda item: item["size"], reverse=True)

        large_candidates: list[dict[str, Any]] = []
        try:
            large_files = self.drive_manager.find_large_files(threshold, 300)
        except Exception:
            large_files = []
        for item in large_files:
            path = item["path"]
            if item.get("system"):
                continue
            if self._large_file_block_reason(path):
                continue
            if any(_within(path, root) for root in cache_roots):
                continue
            key = _key(path)
            if key in seen:
                continue
            seen.add(key)
            candidate = {
                "id": self._candidate_id("file", path),
                "kind": "file",
                "name": item["name"],
                "path": path,
                "size": int(item["size"]),
                "category": "大文件",
                "warning": "请确认不再需要；删除后无法恢复",
                "recommended": False,
                "drive": item["drive"],
                "mtime": item.get("mtime", 0),
            }
            large_candidates.append(candidate)
            if len(large_candidates) >= 200:
                break
        large_candidates.sort(key=lambda item: item["size"], reverse=True)

        all_candidates = cache_candidates + large_candidates
        with self._lock:
            self.last_scan = {item["id"]: item for item in all_candidates}
            self.last_scan_at = time.time()
        return {
            "generated_at": self.last_scan_at,
            "threshold": threshold,
            "caches": cache_candidates,
            "large_files": large_candidates,
            "cache_total": sum(item["size"] for item in cache_candidates),
            "large_total": sum(item["size"] for item in large_candidates),
            "candidate_count": len(all_candidates),
        }

    # -- deletion --------------------------------------------------------

    def _active_job(self) -> CleanupJob | None:
        with self._lock:
            job = self.jobs.get(self.active_id or "")
            if job and job.status not in TERMINAL_STATUSES:
                return job
            return None

    def is_busy(self) -> bool:
        return self._active_job() is not None

    def start(self, ids: list[str]) -> CleanupJob:
        if not ids:
            raise CleanupError("请选择要删除的项目")
        self._refresh_drive_roots()
        with self._lock:
            if self._active_job() is not None:
                raise CleanupError("已有清理任务正在进行", 409)
            selected: list[dict[str, Any]] = []
            for item_id in ids:
                candidate = self.last_scan.get(item_id)
                if candidate:
                    selected.append(candidate)
            if not selected:
                raise CleanupError("清理列表已过期，请重新扫描", 409)
            job = CleanupJob(selected)
            self.jobs[job.id] = job
            self.active_id = job.id
        thread = threading.Thread(target=self._run, args=(job,), name=f"disk-map-clean-{job.id}", daemon=True)
        thread.start()
        return job

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self.jobs.get(job_id)
        if not job:
            raise CleanupError("清理任务不存在", 404)
        return job.snapshot()

    def cancel(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self.jobs.get(job_id)
        if not job:
            raise CleanupError("清理任务不存在", 404)
        job.cancel_event.set()
        job.update(stage="正在取消…")
        return job.snapshot()

    def _run(self, job: CleanupJob) -> None:
        try:
            for candidate in job.candidates:
                if job.cancel_event.is_set():
                    break
                path = candidate["path"]
                job.update(current=path, stage="正在删除")
                if candidate["kind"] == "cache":
                    self._delete_contents(path, job)
                else:
                    self._delete_file(path, job)
                job.update(completed=job.completed + 1)
            if job.cancel_event.is_set():
                job.update(status="cancelled", stage="已取消", finished_at=time.time())
            else:
                job.update(status="done", stage="完成", finished_at=time.time())
        except Exception as exc:  # noqa: BLE001 - report cleanup failures
            job.update(
                status="error",
                stage="清理失败",
                finished_at=time.time(),
            )
            job.add_error("", f"{type(exc).__name__}: {exc}")
        finally:
            with self._lock:
                if self.active_id == job.id:
                    self.active_id = None
            self._write_log(job)

    def _delete_file(self, path: str, job: CleanupJob) -> None:
        try:
            st = os.stat(path, follow_symlinks=False)
        except OSError as exc:
            job.add_error(path, str(exc))
            return
        if getattr(st, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT:
            job.add_error(path, "跳过符号链接/云文件")
            return
        blocked = self._large_file_block_reason(path)
        if blocked:
            job.add_error(path, blocked)
            return
        try:
            os.remove(path)
            job.add_freed(max(0, int(st.st_size)))
        except PermissionError:
            try:
                os.chmod(path, stat_module.S_IWRITE)
                os.remove(path)
                job.add_freed(max(0, int(st.st_size)))
            except OSError as exc:
                job.add_error(path, str(exc))
        except OSError as exc:
            job.add_error(path, str(exc))

    def _delete_contents(self, root: str, job: CleanupJob) -> None:
        try:
            st = os.stat(root, follow_symlinks=False)
        except OSError as exc:
            job.add_error(root, str(exc))
            return
        if getattr(st, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT:
            job.add_error(root, "跳过符号链接/云目录")
            return
        if self._is_protected(root) and not _within(
            root, os.path.join(os.environ.get("WINDIR") or "C:\\Windows", "Temp")
        ):
            job.add_error(root, "受保护路径")
            return
        try:
            with os.scandir(root) as iterator:
                entries = list(iterator)
        except OSError as exc:
            job.add_error(root, str(exc))
            return
        for entry in entries:
            if job.cancel_event.is_set():
                return
            self._delete_entry(entry.path, job, 0)

    def _delete_entry(self, path: str, job: CleanupJob, depth: int) -> int:
        if depth > 80:
            job.add_error(path, "目录层级过深，已跳过")
            return 0
        if job.cancel_event.is_set():
            return 0
        try:
            st = os.stat(path, follow_symlinks=False)
        except OSError as exc:
            job.add_error(path, str(exc))
            return 0
        attrs = getattr(st, "st_file_attributes", 0)
        if attrs & FILE_ATTRIBUTE_REPARSE_POINT:
            job.add_error(path, "跳过符号链接/云文件")
            return 0
        if stat_module.S_ISDIR(st.st_mode):
            freed = 0
            try:
                with os.scandir(path) as iterator:
                    entries = list(iterator)
            except OSError as exc:
                job.add_error(path, str(exc))
                return 0
            for entry in entries:
                freed += self._delete_entry(entry.path, job, depth + 1)
                if job.cancel_event.is_set():
                    break
            if not job.cancel_event.is_set():
                try:
                    os.rmdir(path)
                except PermissionError:
                    try:
                        os.chmod(path, stat_module.S_IWRITE)
                        os.rmdir(path)
                    except OSError as exc:
                        job.add_error(path, str(exc))
                except OSError as exc:
                    job.add_error(path, str(exc))
            return freed
        if stat_module.S_ISREG(st.st_mode):
            job.update(current=path)
            size = max(0, int(st.st_size))
            try:
                os.remove(path)
                job.add_freed(size)
                return size
            except PermissionError:
                try:
                    os.chmod(path, stat_module.S_IWRITE)
                    os.remove(path)
                    job.add_freed(size)
                    return size
                except OSError as exc:
                    job.add_error(path, str(exc))
            except OSError as exc:
                job.add_error(path, str(exc))
        return 0

    def _write_log(self, job: CleanupJob) -> None:
        entry = {
            "time": datetime.now().astimezone().isoformat(timespec="seconds"),
            "id": job.id,
            "status": job.status,
            "items": [item["path"] for item in job.candidates],
            "freed": job.freed,
            "error_count": job.error_count,
        }
        try:
            with open(self.log_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass
