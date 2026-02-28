"""Chat endpoint — streams nanobot agent responses via SSE."""

import asyncio
import json
import os
import re
import secrets

from aiohttp import web

from dashboard.config import NANOBOT_ROOT, SESSIONS_DIR, WORKSPACE_DIR


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
        await resp.write_eof()
        return resp

    response_lines: list[str] = []
    try:
        async def read_stream():
            assert proc.stdout is not None
            while True:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=180)
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").rstrip("\n")
                # Skip the nanobot banner line
                if text.startswith("🐈"):
                    continue
                if text.startswith("↳"):
                    await send_event("progress", {"text": text.lstrip("↳ ")})
                else:
                    response_lines.append(text)

        await read_stream()
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

    try:
        await resp.write_eof()
    except Exception:
        pass
    return resp


async def chat_history(request: web.Request) -> web.Response:
    """GET /api/chat/{session_id}/history — load conversation history."""
    session_id = request.match_info["session_id"]
    # Session files use underscore-separated names
    filename = session_id.replace(":", "_") + ".jsonl"
    filepath = SESSIONS_DIR / filename
    if not filepath.exists():
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
            # Skip metadata line
            if obj.get("_type") == "metadata":
                continue
            role = obj.get("role")
            if role not in ("user", "assistant"):
                continue
            content = obj.get("content")
            if content is None:
                continue
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
