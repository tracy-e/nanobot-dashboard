"""Media file browser endpoints.

Serves files from NANOBOT_ROOT/media/ — supports images, audio, video, text.
"""

import mimetypes
import os
from pathlib import Path

from aiohttp import web

from dashboard.config import MEDIA_DIR
from dashboard.utils.sanitize import safe_resolve


def _classify(mime: str) -> str:
    """Classify a MIME type into a simple category."""
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("audio/"):
        return "audio"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("text/") or mime in (
        "application/json",
        "application/xml",
        "application/javascript",
    ):
        return "text"
    return "other"


async def list_media(request: web.Request) -> web.Response:
    """List all files in the media directory (recursive)."""
    if not MEDIA_DIR.exists():
        return web.json_response({"exists": False, "files": []})

    files = []
    media_root = str(MEDIA_DIR)
    for dirpath, _dirnames, filenames in os.walk(MEDIA_DIR, followlinks=True):
        for fname in sorted(filenames):
            if fname.startswith("."):
                continue
            fullpath = os.path.join(dirpath, fname)
            rel = os.path.relpath(fullpath, media_root)
            mime, _ = mimetypes.guess_type(fname)
            mime = mime or "application/octet-stream"
            try:
                stat = os.stat(fullpath)
                files.append({
                    "name": fname,
                    "path": rel,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "mime": mime,
                    "type": _classify(mime),
                })
            except OSError:
                continue

    files.sort(key=lambda f: f["path"])
    return web.json_response({"exists": True, "files": files})


async def get_media_file(request: web.Request) -> web.Response:
    """Serve a media file with correct content-type."""
    path = request.match_info["path"]

    try:
        filepath = safe_resolve(MEDIA_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    return web.FileResponse(filepath)


async def delete_media_file(request: web.Request) -> web.Response:
    """Delete a media file."""
    path = request.match_info["path"]

    try:
        filepath = safe_resolve(MEDIA_DIR, path)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    filepath.unlink()
    return web.json_response({"deleted": path})


def setup(app: web.Application):
    app.router.add_get("/api/media", list_media)
    app.router.add_get("/api/media/{path:.+}", get_media_file)
    app.router.add_delete("/api/media/{path:.+}", delete_media_file)
