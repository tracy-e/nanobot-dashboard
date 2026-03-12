"""Workspace file viewer/editor endpoints.

Dynamically discovers all subdirectories under workspace/,
excluding sessions/ and skills/ (they have dedicated pages).
Uses os.walk(followlinks=True) to correctly traverse symlinked dirs.
"""

import os
import shutil
import subprocess
from pathlib import Path

from aiohttp import web

from dashboard.config import WORKSPACE_DIR
from dashboard.utils.sanitize import safe_resolve

# Text-editable extensions (for get/update content as text)
TEXT_EXTENSIONS = {".md", ".json", ".jsonl", ".txt", ".py", ".html", ".css", ".js", ".ts",
                   ".yaml", ".yml", ".sh", ".toml", ".cfg", ".ini", ".xml", ".csv"}

# Extensions to hide from listing
HIDDEN_EXTENSIONS = {".DS_Store"}

# Directories to skip entirely
SKIP_DIRS = {"sessions", "skills", "__pycache__", ".DS_Store"}

_HAS_TRASH = shutil.which("trash") is not None


def _trash_or_unlink(filepath: Path) -> None:
    """Move file to trash if available, otherwise unlink."""
    if _HAS_TRASH:
        subprocess.run(["trash", str(filepath)], check=True)
    else:
        filepath.unlink()


def _walk_dir(base: Path, group: str) -> list[dict]:
    """Walk a directory tree (follows symlinks) and collect viewable files."""
    files = []
    if not base.exists():
        return files

    for dirpath, dirnames, filenames in os.walk(str(base), followlinks=True):
        # Prune hidden/unwanted dirs
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in SKIP_DIRS]

        for fname in sorted(filenames):
            fp = Path(dirpath) / fname
            if not fname.startswith(".") and fp.suffix not in HIDDEN_EXTENSIONS:
                st = fp.stat()
                # Path relative to WORKSPACE_DIR (logical, not resolved)
                rel = os.path.relpath(str(fp), str(WORKSPACE_DIR))
                files.append({
                    "path": rel,
                    "name": fname,
                    "sizeBytes": st.st_size,
                    "mtime": st.st_mtime,
                    "group": group,
                })
    return files


def _scan_files():
    """Scan workspace for viewable files, organized by group.

    Dynamically discovers all subdirectories, excluding sessions/ and skills/.
    Special handling: memory/knowledge/ gets its own "knowledge" group.
    """
    files = []
    if not WORKSPACE_DIR.exists():
        return files

    # Workspace root files (non-recursive)
    for f in sorted(WORKSPACE_DIR.glob("*.md")):
        if not f.name.startswith("."):
            st = f.stat()
            files.append({
                "path": f.name,
                "name": f.name,
                "sizeBytes": st.st_size,
                "mtime": st.st_mtime,
                "group": "workspace",
            })

    # Enumerate all subdirectories dynamically
    for entry in sorted(WORKSPACE_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name in SKIP_DIRS:
            continue

        if entry.name == "memory":
            # memory/ tree — exclude knowledge/ subdir (it gets its own group)
            for dirpath, dirnames, filenames in os.walk(str(entry), followlinks=True):
                dirnames[:] = [d for d in dirnames if d != "knowledge" and not d.startswith(".") and d not in SKIP_DIRS]
                for fname in sorted(filenames):
                    fp = Path(dirpath) / fname
                    if not fname.startswith(".") and fp.suffix not in HIDDEN_EXTENSIONS:
                        st = fp.stat()
                        rel = os.path.relpath(str(fp), str(WORKSPACE_DIR))
                        files.append({
                            "path": rel,
                            "name": fname,
                            "sizeBytes": st.st_size,
                            "mtime": st.st_mtime,
                            "group": "memory",
                        })
            # knowledge/ (symlink under memory/)
            files.extend(_walk_dir(entry / "knowledge", "knowledge"))
        else:
            # Generic subdirectory → group = directory name
            files.extend(_walk_dir(entry, entry.name))

    return files


async def list_files(request: web.Request) -> web.Response:
    files = _scan_files()
    return web.json_response({"files": files})


async def get_file(request: web.Request) -> web.Response:
    path = request.match_info["path"]
    try:
        filepath = safe_resolve(WORKSPACE_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.exists() or not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    if filepath.suffix not in TEXT_EXTENSIONS:
        raise web.HTTPBadRequest(text=f"File type {filepath.suffix} is not text-editable")

    content = filepath.read_text(encoding="utf-8")
    return web.json_response({
        "path": path,
        "content": content,
        "sizeBytes": filepath.stat().st_size,
    })


async def get_raw_file(request: web.Request) -> web.Response:
    """Serve a workspace file with its native content-type (for images etc.)."""
    path = request.match_info["path"]
    try:
        filepath = safe_resolve(WORKSPACE_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.exists() or not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    return web.FileResponse(filepath)


async def update_file(request: web.Request) -> web.Response:
    path = request.match_info["path"]
    try:
        filepath = safe_resolve(WORKSPACE_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if filepath.suffix not in TEXT_EXTENSIONS:
        raise web.HTTPBadRequest(text=f"File type {filepath.suffix} is not text-editable")

    body = await request.json()
    content = body.get("content")
    if content is None:
        raise web.HTTPBadRequest(text="Content is required")

    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(content, encoding="utf-8")

    return web.json_response({
        "path": path,
        "sizeBytes": filepath.stat().st_size,
        "updated": True,
    })


async def delete_file(request: web.Request) -> web.Response:
    path = request.match_info["path"]
    try:
        filepath = safe_resolve(WORKSPACE_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.exists() or not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    _trash_or_unlink(filepath)

    return web.json_response({"path": path, "deleted": True})


async def batch_delete(request: web.Request) -> web.Response:
    body = await request.json()
    paths = body.get("paths", [])
    if not paths or not isinstance(paths, list):
        raise web.HTTPBadRequest(text="paths[] is required")

    deleted = []
    errors = []
    for path in paths:
        try:
            filepath = safe_resolve(WORKSPACE_DIR, path)
        except ValueError:
            errors.append({"path": path, "error": "Path traversal detected"})
            continue

        if not filepath.exists() or not filepath.is_file():
            errors.append({"path": path, "error": "File not found"})
            continue

        _trash_or_unlink(filepath)
        deleted.append(path)

    return web.json_response({"deleted": deleted, "errors": errors})


def setup(app: web.Application):
    app.router.add_get("/api/memory/files", list_files)
    app.router.add_get(r"/api/memory/raw/{path:.+}", get_raw_file)
    app.router.add_get(r"/api/memory/files/{path:.+}", get_file)
    app.router.add_put(r"/api/memory/files/{path:.+}", update_file)
    app.router.add_delete(r"/api/memory/files/{path:.+}", delete_file)
    app.router.add_post("/api/memory/batch-delete", batch_delete)
