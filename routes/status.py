"""System status endpoint."""

import json

from aiohttp import web

from dashboard.config import NANOBOT_ROOT
from dashboard.utils.nanobot import is_gateway_running, read_config, read_cron_jobs
from dashboard.utils.sanitize import sanitize_config


def _read_active_models(config: dict) -> dict:
    """Read model + compact_model: .state.json > config.json defaults."""
    defaults = config.get("agents", {}).get("defaults", {})
    result = {
        "model": defaults.get("model", "unknown"),
        "compact_model": defaults.get("compact_model", ""),
    }
    state_file = NANOBOT_ROOT / ".state.json"
    if state_file.is_file():
        try:
            data = json.loads(state_file.read_text(encoding="utf-8"))
            if data.get("model"):
                result["model"] = data["model"]
            if data.get("compact_model"):
                result["compact_model"] = data["compact_model"]
        except Exception:
            pass
    return result


async def get_status(request: web.Request) -> web.Response:
    gateway = await is_gateway_running()

    config = read_config()
    models = _read_active_models(config)

    channels = {}
    for name, ch in config.get("channels", {}).items():
        channels[name] = {"enabled": ch.get("enabled", False)}

    cron_data = read_cron_jobs()
    jobs = cron_data.get("jobs", [])
    cron_summary = {
        "total": len(jobs),
        "enabled": sum(1 for j in jobs if j.get("enabled")),
    }

    return web.json_response({
        "gateway": gateway,
        "model": models["model"],
        "compactModel": models["compact_model"],
        "channels": channels,
        "cron": cron_summary,
    })


def setup(app: web.Application):
    app.router.add_get("/api/status", get_status)
