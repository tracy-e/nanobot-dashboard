"""Bearer token authentication middleware."""

from aiohttp import web

from dashboard.config import AUTH_TOKEN


@web.middleware
async def auth_middleware(request: web.Request, handler):
    # Skip auth for static files and root
    if not request.path.startswith("/api/"):
        return await handler(request)

    # Skip if no token configured
    if not AUTH_TOKEN:
        return await handler(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise web.HTTPUnauthorized(text="Missing Bearer token")

    token = auth_header[7:]
    if token != AUTH_TOKEN:
        raise web.HTTPForbidden(text="Invalid token")

    return await handler(request)
