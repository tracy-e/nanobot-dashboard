"""Log file viewer endpoints."""

import os

from aiohttp import web

from dashboard.config import NANOBOT_ROOT


async def list_logs(request: web.Request) -> web.Response:
    """List all .log files in NANOBOT_ROOT."""
    files = []
    try:
        for entry in sorted(NANOBOT_ROOT.iterdir()):
            if entry.is_file() and entry.suffix == ".log":
                try:
                    stat = entry.stat()
                    files.append({
                        "name": entry.name,
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                    })
                except OSError:
                    continue
    except OSError:
        pass
    return web.json_response({"files": files})


async def get_log(request: web.Request) -> web.Response:
    """Read tail of a specific log file."""
    name = request.match_info["name"]

    # Security: only allow .log files directly in NANOBOT_ROOT
    if "/" in name or "\\" in name or not name.endswith(".log"):
        return web.json_response({"error": "Invalid log file name"}, status=400)

    log_path = NANOBOT_ROOT / name
    if not log_path.is_file():
        return web.json_response({"lines": [], "note": f"{name} not found"})

    lines = int(request.query.get("lines", "500"))
    lines = min(lines, 5000)

    try:
        # Read from end efficiently for large files
        size = log_path.stat().st_size
        if size > 512_000:
            # For large files, read last ~512KB
            with open(log_path, "rb") as f:
                f.seek(max(0, size - 512_000))
                if size > 512_000:
                    f.readline()  # skip partial first line
                text = f.read().decode("utf-8", errors="replace")
        else:
            text = log_path.read_text(errors="replace")

        all_lines = text.strip().split("\n")
        tail = all_lines[-lines:] if all_lines != [""] else []
        return web.json_response({"lines": tail, "totalSize": size})
    except Exception as e:
        return web.json_response({"lines": [], "error": str(e)})


def setup(app: web.Application):
    app.router.add_get("/api/logs", list_logs)
    app.router.add_get("/api/logs/{name}", get_log)
