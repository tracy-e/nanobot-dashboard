# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Nanobot Dashboard — a standalone web UI for managing a personal [nanobot](https://github.com/HKUDS/nanobot) AI assistant deployment. It reads/writes nanobot's filesystem data directly (JSON, JSONL, Markdown files) without modifying nanobot source code.

**Backend**: Python aiohttp (port 18791) — `dashboard/server.py`
**Frontend**: Lit Web Components + Vite + TypeScript — `dashboard/frontend/`

## Commands

```bash
# Build frontend → static/
make build

# Run backend (serves static/ + API)
make serve

# Frontend dev with hot reload (proxied to :18791)
make dev

# Full restart
make build && make serve
```

Frontend build: `cd frontend && npm run build` (runs `tsc && vite build`, outputs to `../static/`)

## Architecture

### Backend (aiohttp)

Each feature domain is a module in `routes/` with a `setup(app)` function that registers endpoints:
- `status.py` — Gateway process detection, active model (`.state.json` > `config.json`), channels, cron summary
- `sessions.py` — JSONL session files CRUD + notes (stored in `.notes.json`)
- `cron.py` — `cron/jobs.json` CRUD with `fcntl.flock` for write safety; manual trigger via `nanobot cron run`
- `memory.py` — Workspace file browser/editor; groups files by type (workspace/memory/knowledge/heartbeat)
- `skills.py` — Skill directory scanner with YAML frontmatter parsing
- `config_view.py` — Sanitized config view + log tail

Key utilities:
- `utils/sanitize.py` — `safe_resolve()` uses `os.path.normpath` (not `Path.resolve()`) to support symlinks while preventing path traversal
- `utils/auth.py` — Optional Bearer token middleware (`NANOBOT_DASHBOARD_TOKEN` env var)
- `utils/nanobot.py` — Gateway process detection via `pgrep`, config/cron JSON readers

SPA fallback: non-API, non-static requests return `static/index.html`.

### Frontend (Lit + Vite)

- **Routing**: Hash-based SPA (`#status`, `#sessions`, etc.) in `app.ts`
- **API client**: `api/client.ts` — centralized fetch wrapper with Bearer token from localStorage
- **Design system**: CSS custom properties defined in `index.html` (dark theme, Plus Jakarta Sans + JetBrains Mono)
- **FileViewer base class**: `components/file-viewer.ts` — abstract class inherited by `memory-page` and `knowledge-page`; provides tree navigation, search, markdown preview, and inline editing
- **Markdown**: `utils/markdown.ts` — `marked` + `highlight.js` with registered language subset

## Data Paths

All paths relative to `NANOBOT_ROOT` (default `~/.nanobot`):

| Data | Path | Format |
|------|------|--------|
| Active model | `.state.json` | `{"model": "..."}` |
| Config | `config.json` | JSON (contains secrets) |
| Cron jobs | `cron/jobs.json` | JSON with `version` + `jobs[]` |
| Sessions | `workspace/sessions/*.jsonl` | Line 1: metadata, rest: messages |
| Session notes | `workspace/sessions/.notes.json` | `{key: note}` map |
| Memory/workspace | `workspace/` | .md files, grouped by subdirectory |
| Knowledge | `workspace/knowledge/` | Symlink to external dir |
| Skills | `workspace/skills/*/SKILL.md` | YAML frontmatter + markdown |

## Key Constraints

- `knowledge/` directory is a **symlink** — must use `os.walk(followlinks=True)` and `normpath` instead of `Path.resolve()`
- Cron writes use **file locking** (`fcntl.flock`) to avoid conflicts with the running gateway
- Session JSONL files are **append-only by gateway** — dashboard only reads them (notes stored separately)
- Config view **redacts secrets** — any key matching `key|token|secret|password` patterns

## Language

Always respond in Chinese (中文).
