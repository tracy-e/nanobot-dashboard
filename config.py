"""Dashboard configuration."""

import json
import os
from pathlib import Path

# Nanobot root directory
NANOBOT_ROOT = Path(os.environ.get("NANOBOT_ROOT", Path.home() / ".nanobot"))

# Derived paths
CONFIG_FILE = NANOBOT_ROOT / "config.json"
CRON_JOBS_FILE = NANOBOT_ROOT / "workspace" / "cron" / "jobs.json"
SESSIONS_DIR = NANOBOT_ROOT / "workspace" / "sessions"
WORKSPACE_DIR = NANOBOT_ROOT / "workspace"
MEMORY_DIR = NANOBOT_ROOT / "workspace" / "memory"
MEDIA_DIR = NANOBOT_ROOT / "media"
GATEWAY_LOG = NANOBOT_ROOT / "gateway.log"
DASHBOARD_LOG = NANOBOT_ROOT / "dashboard.log"

# Server settings
HOST = os.environ.get("NANOBOT_DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.environ.get("NANOBOT_DASHBOARD_PORT", "18791"))
AUTH_TOKEN = os.environ.get("NANOBOT_DASHBOARD_TOKEN", "")


# Nanobot API server URL (from config.json api section, default 127.0.0.1:8900)
def _get_api_url() -> str:
    try:
        cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        api = cfg.get("api", {})
        host = api.get("host", "127.0.0.1")
        port = api.get("port", 8900)
        return f"http://{host}:{port}"
    except Exception:
        return "http://127.0.0.1:8900"


NANOBOT_API_URL = _get_api_url()
