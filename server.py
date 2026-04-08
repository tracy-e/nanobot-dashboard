"""Nanobot Dashboard — standalone web dashboard for nanobot."""

import logging
import sys
from pathlib import Path

import aiohttp
from aiohttp import web

# Ensure dashboard package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dashboard.config import HOST, PORT, DASHBOARD_LOG
from dashboard.utils.auth import auth_middleware
from dashboard.routes import status, sessions, cron, memory, config_view, skills, logs, media, chat, search


def create_app() -> web.Application:
    app = web.Application(middlewares=[auth_middleware])

    # Register API routes
    status.setup(app)
    sessions.setup(app)
    cron.setup(app)
    memory.setup(app)
    config_view.setup(app)
    skills.setup(app)
    logs.setup(app)
    media.setup(app)
    chat.setup(app)
    search.setup(app)

    # Shared HTTP client for outbound requests (e.g. nanobot API)
    async def _on_startup(app_: web.Application):
        app_['http_client'] = aiohttp.ClientSession()

    async def _on_cleanup(app_: web.Application):
        await app_['http_client'].close()

    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)

    # Serve frontend static files
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.router.add_static("/assets", static_dir / "assets", show_index=False)

        # SPA fallback: serve index.html for all non-API, non-asset routes
        async def spa_handler(request: web.Request) -> web.Response:
            index = static_dir / "index.html"
            if index.exists():
                return web.FileResponse(index)
            raise web.HTTPNotFound(text="Frontend not built. Run: cd frontend && npm run build")

        app.router.add_get("/{path:.*}", spa_handler)

    return app


def setup_logging():
    fmt = logging.Formatter("%(asctime)s [dashboard] %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    fh = logging.FileHandler(DASHBOARD_LOG, encoding="utf-8")
    fh.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(fh)
    # Also keep stderr output
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(sh)


def main():
    setup_logging()
    app = create_app()
    logging.getLogger().info(f"Dashboard starting on http://{HOST}:{PORT}")
    web.run_app(app, host=HOST, port=PORT, print=None, access_log=None)


if __name__ == "__main__":
    main()
