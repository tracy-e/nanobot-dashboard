"""Configuration viewer endpoints."""

import json

from aiohttp import web

from dashboard.config import NANOBOT_ROOT
from dashboard.utils.nanobot import read_config
from dashboard.utils.sanitize import sanitize_config


async def get_config(request: web.Request) -> web.Response:
    config = read_config()
    return web.json_response(sanitize_config(config))


async def get_config_raw(request: web.Request) -> web.Response:
    """Return raw config.json without sanitization (for editing)."""
    config = read_config()
    return web.json_response(config)


async def put_config(request: web.Request) -> web.Response:
    """Write config.json."""
    body = await request.json()
    config_text = body.get("content", "")
    # Validate JSON
    try:
        parsed = json.loads(config_text)
    except json.JSONDecodeError as e:
        return web.json_response({"error": f"Invalid JSON: {e}"}, status=400)

    config_file = NANOBOT_ROOT / "config.json"
    config_file.write_text(
        json.dumps(parsed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return web.json_response({"ok": True})


def setup(app: web.Application):
    app.router.add_get("/api/config", get_config)
    app.router.add_get("/api/config/raw", get_config_raw)
    app.router.add_put("/api/config", put_config)
