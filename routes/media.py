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
    """List all files in the media directory."""
    if not MEDIA_DIR.exists():
        return web.json_response({"exists": False, "files": []})

    files = []
    for entry in sorted(MEDIA_DIR.iterdir()):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        mime, _ = mimetypes.guess_type(entry.name)
        mime = mime or "application/octet-stream"
        try:
            stat = entry.stat()
            files.append({
                "name": entry.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "mime": mime,
                "type": _classify(mime),
            })
        except OSError:
            continue

    return web.json_response({"exists": True, "files": files})


async def get_media_file(request: web.Request) -> web.Response:
    """Serve a media file with correct content-type."""
    name = request.match_info["name"]

    try:
        filepath = safe_resolve(MEDIA_DIR, name)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    return web.FileResponse(filepath)


async def delete_media_file(request: web.Request) -> web.Response:
    """Delete a media file."""
    name = request.match_info["name"]

    try:
        filepath = safe_resolve(MEDIA_DIR, name)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    filepath.unlink()
    return web.json_response({"deleted": name})


def setup(app: web.Application):
    app.router.add_get("/api/media", list_media)
    app.router.add_get("/api/media/{name}", get_media_file)
    app.router.add_delete("/api/media/{name}", delete_media_file)
