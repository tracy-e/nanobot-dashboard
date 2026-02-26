"""Nanobot Dashboard — standalone web dashboard for nanobot."""

import sys
from pathlib import Path

from aiohttp import web

# Ensure dashboard package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dashboard.config import HOST, PORT
from dashboard.utils.auth import auth_middleware
from dashboard.routes import status, sessions, cron, memory, config_view, skills, logs, media


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


def main():
    app = create_app()
    print(f"Nanobot Dashboard starting on http://{HOST}:{PORT}")
    web.run_app(app, host=HOST, port=PORT, print=None)


if __name__ == "__main__":
    main()
