"""Workspace file viewer/editor endpoints.

Serves workspace root files (SOUL.md, AGENTS.md, etc.),
memory/ subdirectory, knowledge/ (symlink), and heartbeat/.
Uses os.walk(followlinks=True) to correctly traverse symlinked dirs.
"""

import os
from pathlib import Path

from aiohttp import web

from dashboard.config import WORKSPACE_DIR
from dashboard.utils.sanitize import safe_resolve

# Only allow these extensions
ALLOWED_EXTENSIONS = {".md", ".json", ".jsonl", ".txt"}

# Directories to skip entirely
SKIP_DIRS = {"sessions", "skills", "__pycache__", ".DS_Store"}


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
            if fp.suffix in ALLOWED_EXTENSIONS and not fname.startswith("."):
                # Path relative to WORKSPACE_DIR (logical, not resolved)
                rel = os.path.relpath(str(fp), str(WORKSPACE_DIR))
                files.append({
                    "path": rel,
                    "name": fname,
                    "sizeBytes": fp.stat().st_size,
                    "group": group,
                })
    return files


def _scan_files():
    """Scan workspace for viewable files, organized by group."""
    files = []
    if not WORKSPACE_DIR.exists():
        return files

    # Workspace root .md files (non-recursive)
    for f in sorted(WORKSPACE_DIR.glob("*.md")):
        if not f.name.startswith("."):
            files.append({
                "path": f.name,
                "name": f.name,
                "sizeBytes": f.stat().st_size,
                "group": "workspace",
            })

    # memory/ tree — exclude knowledge/ subdir (it gets its own group)
    memory_dir = WORKSPACE_DIR / "memory"
    if memory_dir.exists():
        for dirpath, dirnames, filenames in os.walk(str(memory_dir), followlinks=True):
            # Skip knowledge/ — handled separately
            dirnames[:] = [d for d in dirnames if d != "knowledge" and not d.startswith(".") and d not in SKIP_DIRS]
            for fname in sorted(filenames):
                fp = Path(dirpath) / fname
                if fp.suffix in ALLOWED_EXTENSIONS and not fname.startswith("."):
                    rel = os.path.relpath(str(fp), str(WORKSPACE_DIR))
                    files.append({
                        "path": rel,
                        "name": fname,
                        "sizeBytes": fp.stat().st_size,
                        "group": "memory",
                    })

    # knowledge/ (symlink under memory/)
    files.extend(_walk_dir(memory_dir / "knowledge", "knowledge"))

    # heartbeat/
    files.extend(_walk_dir(WORKSPACE_DIR / "heartbeat", "heartbeat"))

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

    if filepath.suffix not in ALLOWED_EXTENSIONS:
        raise web.HTTPBadRequest(text=f"File type {filepath.suffix} not allowed")

    content = filepath.read_text(encoding="utf-8")
    return web.json_response({
        "path": path,
        "content": content,
        "sizeBytes": filepath.stat().st_size,
    })


async def update_file(request: web.Request) -> web.Response:
    path = request.match_info["path"]
    try:
        filepath = safe_resolve(WORKSPACE_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if filepath.suffix not in ALLOWED_EXTENSIONS:
        raise web.HTTPBadRequest(text=f"File type {filepath.suffix} not allowed")

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


def setup(app: web.Application):
    app.router.add_get("/api/memory/files", list_files)
    app.router.add_get(r"/api/memory/files/{path:.+}", get_file)
    app.router.add_put(r"/api/memory/files/{path:.+}", update_file)
