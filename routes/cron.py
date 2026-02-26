"""Cron job management endpoints."""

import asyncio
import fcntl
import json
import secrets
import time

from aiohttp import web

from dashboard.config import CRON_JOBS_FILE
from dashboard.utils.nanobot import read_cron_jobs, write_cron_jobs


def _lock_and_write(data: dict):
    """Write cron jobs with file locking."""
    CRON_JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CRON_JOBS_FILE, "w") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            json.dump(data, f, indent=2, ensure_ascii=False)
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


async def list_jobs(request: web.Request) -> web.Response:
    data = read_cron_jobs()
    return web.json_response(data)


async def create_job(request: web.Request) -> web.Response:
    body = await request.json()

    name = body.get("name", "").strip()
    if not name:
        raise web.HTTPBadRequest(text="Job name is required")

    cron_expr = body.get("schedule", "").strip()
    if not cron_expr:
        raise web.HTTPBadRequest(text="Cron schedule expression is required")

    message = body.get("message", "").strip()
    if not message:
        raise web.HTTPBadRequest(text="Message is required")

    now_ms = int(time.time() * 1000)
    job = {
        "id": secrets.token_hex(4),
        "name": name,
        "enabled": body.get("enabled", True),
        "schedule": {
            "kind": "cron",
            "atMs": None,
            "everyMs": None,
            "expr": cron_expr,
            "tz": body.get("tz"),
        },
        "payload": {
            "kind": "agent_turn",
            "message": message,
            "deliver": body.get("deliver", False),
            "channel": body.get("channel"),
            "to": body.get("to"),
        },
        "state": {
            "nextRunAtMs": None,
            "lastRunAtMs": None,
            "lastStatus": None,
            "lastError": None,
        },
        "createdAtMs": now_ms,
        "updatedAtMs": now_ms,
        "deleteAfterRun": False,
    }

    data = read_cron_jobs()
    data["jobs"].append(job)
    _lock_and_write(data)

    return web.json_response(job, status=201)


async def delete_job(request: web.Request) -> web.Response:
    job_id = request.match_info["id"]
    data = read_cron_jobs()

    jobs = data["jobs"]
    idx = next((i for i, j in enumerate(jobs) if j["id"] == job_id), None)
    if idx is None:
        raise web.HTTPNotFound(text="Job not found")

    removed = jobs.pop(idx)
    _lock_and_write(data)
    return web.json_response({"deleted": removed["id"]})


async def update_job(request: web.Request) -> web.Response:
    job_id = request.match_info["id"]
    body = await request.json()
    data = read_cron_jobs()

    job = next((j for j in data["jobs"] if j["id"] == job_id), None)
    if job is None:
        raise web.HTTPNotFound(text="Job not found")

    if "enabled" in body:
        job["enabled"] = bool(body["enabled"])
    if "name" in body:
        job["name"] = body["name"]
    if "schedule" in body:
        job["schedule"]["expr"] = body["schedule"]
    if "message" in body:
        job["payload"]["message"] = body["message"]

    job["updatedAtMs"] = int(time.time() * 1000)
    _lock_and_write(data)
    return web.json_response(job)


async def run_job(request: web.Request) -> web.Response:
    job_id = request.match_info["id"]

    # Verify job exists
    data = read_cron_jobs()
    job = next((j for j in data["jobs"] if j["id"] == job_id), None)
    if job is None:
        raise web.HTTPNotFound(text="Job not found")

    try:
        proc = await asyncio.create_subprocess_exec(
            "nanobot", "cron", "run", job_id,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
        return web.json_response({
            "triggered": job_id,
            "returncode": proc.returncode or 0,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
        })
    except asyncio.TimeoutError:
        return web.json_response({
            "triggered": job_id,
            "note": "Command started but timed out waiting for output (job may still be running)",
        })
    except FileNotFoundError:
        raise web.HTTPServiceUnavailable(text="nanobot CLI not found")


def setup(app: web.Application):
    app.router.add_get("/api/cron/jobs", list_jobs)
    app.router.add_post("/api/cron/jobs", create_job)
    app.router.add_delete("/api/cron/jobs/{id}", delete_job)
    app.router.add_patch("/api/cron/jobs/{id}", update_job)
    app.router.add_post("/api/cron/jobs/{id}/run", run_job)
