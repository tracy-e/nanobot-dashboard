"""Session browser endpoints."""

import json
from pathlib import Path

from aiohttp import web

from dashboard.config import SESSIONS_DIR

NOTES_FILE = SESSIONS_DIR / ".notes.json"


def _load_notes() -> dict:
    """Load session notes from .notes.json."""
    if NOTES_FILE.exists():
        try:
            return json.loads(NOTES_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_notes(notes: dict):
    """Save session notes to .notes.json."""
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    NOTES_FILE.write_text(json.dumps(notes, ensure_ascii=False, indent=2))


def _parse_channel(filename: str) -> str:
    """Extract channel from filename like 'discord_123.jsonl' -> 'discord'."""
    name = filename.rsplit(".", 1)[0]  # remove .jsonl
    parts = name.split("_", 1)
    return parts[0] if len(parts) > 1 else "unknown"


def _read_metadata(filepath: Path) -> dict | None:
    """Read first line metadata from a session JSONL file."""
    try:
        with open(filepath, "r") as f:
            first_line = f.readline().strip()
            if first_line:
                data = json.loads(first_line)
                if data.get("_type") == "metadata":
                    return data
    except Exception:
        pass
    return None



async def list_sessions(request: web.Request) -> web.Response:
    channel_filter = request.query.get("channel")

    if not SESSIONS_DIR.exists():
        return web.json_response({"sessions": []})

    notes = _load_notes()
    sessions = []
    for f in sorted(SESSIONS_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        channel = _parse_channel(f.name)
        if channel_filter and channel != channel_filter:
            continue

        meta = _read_metadata(f)
        key = f.stem  # filename without extension
        sessions.append({
            "key": key,
            "channel": channel,
            "filename": f.name,
            "sizeBytes": f.stat().st_size,
            "createdAt": meta.get("created_at") if meta else None,
            "updatedAt": meta.get("updated_at") if meta else None,
            "metadataKey": meta.get("key") if meta else None,
            "note": notes.get(key, ""),
        })

    return web.json_response({"sessions": sessions})


async def get_session(request: web.Request) -> web.Response:
    key = request.match_info["key"]
    filepath = SESSIONS_DIR / f"{key}.jsonl"

    if not filepath.exists() or not filepath.is_file():
        raise web.HTTPNotFound(text="Session not found")

    # Verify the file is within SESSIONS_DIR
    if not str(filepath.resolve()).startswith(str(SESSIONS_DIR.resolve())):
        raise web.HTTPForbidden(text="Access denied")

    messages = []
    metadata = None
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get("_type") == "metadata":
                    metadata = data
                else:
                    messages.append(data)
            except json.JSONDecodeError:
                continue

    notes = _load_notes()
    return web.json_response({
        "key": key,
        "metadata": metadata,
        "messages": messages,
        "note": notes.get(key, ""),
    })


async def update_session_note(request: web.Request) -> web.Response:
    key = request.match_info["key"]
    filepath = SESSIONS_DIR / f"{key}.jsonl"

    if not filepath.exists():
        raise web.HTTPNotFound(text="Session not found")

    body = await request.json()
    note = body.get("note", "").strip()

    notes = _load_notes()
    if note:
        notes[key] = note
    else:
        notes.pop(key, None)
    _save_notes(notes)

    return web.json_response({"key": key, "note": note})


async def delete_session(request: web.Request) -> web.Response:
    key = request.match_info["key"]
    filepath = SESSIONS_DIR / f"{key}.jsonl"

    if not filepath.exists():
        raise web.HTTPNotFound(text="Session not found")

    if not str(filepath.resolve()).startswith(str(SESSIONS_DIR.resolve())):
        raise web.HTTPForbidden(text="Access denied")

    filepath.unlink()

    # Clean up note
    notes = _load_notes()
    if key in notes:
        del notes[key]
        _save_notes(notes)

    return web.json_response({"deleted": key})


def setup(app: web.Application):
    app.router.add_get("/api/sessions", list_sessions)
    app.router.add_get("/api/sessions/{key}", get_session)
    app.router.add_patch("/api/sessions/{key}", update_session_note)
    app.router.add_delete("/api/sessions/{key}", delete_session)
