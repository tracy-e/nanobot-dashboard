"""Chat endpoint — nanobot API first, subprocess fallback."""

import asyncio
import json
import logging
import os
import re
import secrets
import time

import aiohttp
from aiohttp import web

from dashboard.config import NANOBOT_API_URL, NANOBOT_ROOT, SESSIONS_DIR, WORKSPACE_DIR

logger = logging.getLogger(__name__)

# --- ANSI / spinner filters (for subprocess fallback path) ---
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\[\?[0-9;]*[a-zA-Z]")
_SPINNER_RE = re.compile(r"^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+.*(thinking|loading|processing).*$", re.IGNORECASE)

# --- API health cache ---
_api_healthy: bool = False
_api_checked_at: float = 0.0
_API_CACHE_TTL = 30.0  # seconds


async def _check_api_health(client: aiohttp.ClientSession) -> bool:
    """Check if nanobot API server is reachable (cached for 30s)."""
    global _api_healthy, _api_checked_at
    now = time.monotonic()
    if now - _api_checked_at < _API_CACHE_TTL:
        return _api_healthy
    try:
        async with client.get(
            f"{NANOBOT_API_URL}/health",
            timeout=aiohttp.ClientTimeout(total=2),
        ) as resp:
            _api_healthy = resp.status == 200
    except Exception:
        _api_healthy = False
    _api_checked_at = now
    return _api_healthy


async def _chat_via_api(
    client: aiohttp.ClientSession,
    message: str,
    session_id: str,
    send_event,
) -> None:
    """Send message via nanobot HTTP API."""
    await send_event("progress", {"text": ""})

    try:
        async with client.post(
            f"{NANOBOT_API_URL}/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": message}],
                "session_id": session_id,
            },
            timeout=aiohttp.ClientTimeout(total=180),
        ) as resp:
            data = await resp.json()
            if resp.status != 200:
                error_msg = data.get("error", {}).get("message", f"API error {resp.status}")
                await send_event("error", {"message": error_msg})
                return

            content = data["choices"][0]["message"]["content"]
            await send_event("done", {
                "session_id": session_id,
                "response": content,
            })
    except asyncio.TimeoutError:
        await send_event("error", {"message": "响应超时 (180s)"})
    except Exception as e:
        logger.exception("nanobot API call failed")
        await send_event("error", {"message": str(e)})


async def _chat_via_subprocess(
    message: str,
    session_id: str,
    send_event,
) -> None:
    """Fallback: send message via nanobot CLI subprocess."""
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    try:
        proc = await asyncio.create_subprocess_exec(
            "nanobot", "agent", "-m", message, "-s", session_id, "--no-markdown",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    except FileNotFoundError:
        await send_event("error", {"message": "nanobot CLI not found"})
        return

    response_lines: list[str] = []
    try:
        assert proc.stdout is not None
        while True:
            line = await asyncio.wait_for(proc.stdout.readline(), timeout=180)
            if not line:
                break
            text = line.decode("utf-8", errors="replace").rstrip("\n")
            text = _ANSI_RE.sub("", text)
            if text.startswith("🐈") or _SPINNER_RE.match(text):
                continue
            if text.startswith("↳"):
                await send_event("progress", {"text": text.lstrip("↳ ")})
            else:
                response_lines.append(text)

        await proc.wait()
        full_response = "\n".join(response_lines).strip()
        await send_event("done", {
            "session_id": session_id,
            "response": full_response,
        })
    except asyncio.TimeoutError:
        proc.kill()
        await send_event("error", {"message": "响应超时 (180s)"})
    except Exception as e:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        await send_event("error", {"message": str(e)})


async def chat_send(request: web.Request) -> web.StreamResponse:
    """POST /api/chat — send a message, stream response via SSE."""
    body = await request.json()
    message = body.get("message", "").strip()
    if not message:
        raise web.HTTPBadRequest(text="message is required")

    session_id = body.get("session_id") or f"dashboard_chat_{secrets.token_hex(4)}"

    # Inject dashboard context if provided
    context = body.get("context")
    if context and isinstance(context, dict):
        page = context.get("page", "")
        file_path = context.get("file", "")
        if file_path:
            if file_path.startswith("logs/"):
                abs_path = NANOBOT_ROOT / file_path
            else:
                abs_path = WORKSPACE_DIR / file_path
            message = (
                f"[Dashboard Context]\n"
                f"当前页面: {page}\n"
                f"当前文件: {abs_path}\n\n"
                f"{message}"
            )

    resp = web.StreamResponse(
        status=200,
        reason="OK",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
    await resp.prepare(request)

    async def send_event(event: str, data: dict):
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        await resp.write(payload.encode("utf-8"))

    # Try nanobot API first, fallback to subprocess
    client: aiohttp.ClientSession = request.app['http_client']
    if await _check_api_health(client):
        logger.info("Chat via API: session=%s", session_id)
        await _chat_via_api(client, message, session_id, send_event)
    else:
        logger.info("Chat via subprocess (API unavailable): session=%s", session_id)
        await _chat_via_subprocess(message, session_id, send_event)

    try:
        await resp.write_eof()
    except Exception:
        pass
    return resp


async def chat_history(request: web.Request) -> web.Response:
    """GET /api/chat/{session_id}/history — load conversation history."""
    session_id = request.match_info["session_id"]
    safe_name = session_id.replace(":", "_")

    # Try API-style filename first (api:session_id -> api_session_id.jsonl), then legacy
    candidates = [
        SESSIONS_DIR / f"api_{safe_name}.jsonl",
        SESSIONS_DIR / f"{safe_name}.jsonl",
    ]
    filepath = next((p for p in candidates if p.exists()), None)
    if not filepath:
        return web.json_response({"messages": []})

    messages = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("_type") == "metadata":
                continue
            role = obj.get("role")
            if role not in ("user", "assistant"):
                continue
            content = obj.get("content")
            if content is None:
                continue
            # Strip ANSI escape sequences and spinner lines from stored messages
            if isinstance(content, str):
                content = _ANSI_RE.sub("", content)
                content = "\n".join(
                    ln for ln in content.split("\n")
                    if not _SPINNER_RE.match(ln)
                )
            # Strip runtime context prefix from user messages
            if role == "user" and isinstance(content, str):
                content = re.sub(r"\[Current Time:[^\]]*\]\n?", "", content)
                content = re.sub(r"\[Runtime Context\]\n(?:[^\n]*\n?)*", "", content)
                content = re.sub(r"\[Dashboard Context\]\n(?:[^\n]*\n)*\n?", "", content)
                content = content.strip()
            messages.append({
                "role": role,
                "content": content,
                "timestamp": obj.get("timestamp"),
            })

    return web.json_response({"messages": messages})


async def chat_new(request: web.Request) -> web.Response:
    """POST /api/chat/new — generate a new session ID."""
    session_id = f"dashboard_chat_{secrets.token_hex(4)}"
    return web.json_response({"session_id": session_id})


def setup(app: web.Application):
    app.router.add_post("/api/chat", chat_send)
    app.router.add_get("/api/chat/{session_id}/history", chat_history)
    app.router.add_post("/api/chat/new", chat_new)
