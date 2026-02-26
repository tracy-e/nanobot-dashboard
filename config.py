"""Dashboard configuration."""

import os
from pathlib import Path

# Nanobot root directory
NANOBOT_ROOT = Path(os.environ.get("NANOBOT_ROOT", Path.home() / ".nanobot"))

# Derived paths
CONFIG_FILE = NANOBOT_ROOT / "config.json"
CRON_JOBS_FILE = NANOBOT_ROOT / "cron" / "jobs.json"
SESSIONS_DIR = NANOBOT_ROOT / "workspace" / "sessions"
WORKSPACE_DIR = NANOBOT_ROOT / "workspace"
MEMORY_DIR = NANOBOT_ROOT / "workspace" / "memory"
MEDIA_DIR = NANOBOT_ROOT / "media"
GATEWAY_LOG = NANOBOT_ROOT / "gateway.log"

# Server settings
HOST = os.environ.get("NANOBOT_DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.environ.get("NANOBOT_DASHBOARD_PORT", "18791"))
AUTH_TOKEN = os.environ.get("NANOBOT_DASHBOARD_TOKEN", "")
