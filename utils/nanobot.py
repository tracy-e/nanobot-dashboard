"""Nanobot process detection and data utilities."""

import asyncio
import json
from pathlib import Path

from dashboard.config import CONFIG_FILE, CRON_JOBS_FILE


async def is_gateway_running() -> dict:
    """Check if nanobot gateway process is running."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "pgrep", "-f", "nanobot gateway",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        pids = stdout.decode().strip().split("\n") if stdout.decode().strip() else []
        return {"running": len(pids) > 0, "pids": pids}
    except Exception:
        return {"running": False, "pids": []}


def read_config() -> dict:
    """Read nanobot config.json."""
    if not CONFIG_FILE.exists():
        return {}
    try:
        return json.loads(CONFIG_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def read_cron_jobs() -> dict:
    """Read cron/jobs.json."""
    if not CRON_JOBS_FILE.exists():
        return {"version": 1, "jobs": []}
    try:
        return json.loads(CRON_JOBS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "jobs": []}


def write_cron_jobs(data: dict):
    """Write cron/jobs.json with atomic rename."""
    tmp = CRON_JOBS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    tmp.rename(CRON_JOBS_FILE)
