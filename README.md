[中文文档](README_CN.md)

# Nanobot Dashboard

A standalone web dashboard for managing [nanobot](https://github.com/HKUDS/nanobot) — an ultra-lightweight personal AI assistant.

Reads and writes nanobot's filesystem data directly (JSON, JSONL, Markdown) without modifying the nanobot source code. Zero intrusion, independent deployment.

## Features

- **Status Overview** — Gateway process detection, active model display, channel status, cron/skills/knowledge summary cards
- **Session Browser** — Channel-grouped session list with message history (Markdown rendering), notes, and search
- **Cron Manager** — Full CRUD for scheduled tasks with manual trigger support and file-level locking
- **Memory & Knowledge** — File tree navigation, inline Markdown editor with preview and syntax highlighting
- **Skills Viewer** — Browse and edit skill definitions (YAML frontmatter + Markdown)
- **Log Viewer** — Multi-file tab switching with auto-scroll and efficient tail reading for large files
- **Config Editor** — Sanitized config display with raw editing modal; secrets are redacted in read-only view

## Architecture

```
dashboard/
├── server.py              # aiohttp entry point
├── config.py              # Environment-based configuration
├── routes/
│   ├── status.py          # GET /api/status
│   ├── sessions.py        # /api/sessions CRUD + notes
│   ├── cron.py            # /api/cron/jobs CRUD + manual run
│   ├── memory.py          # /api/memory/files browser/editor
│   ├── skills.py          # /api/skills browser/editor
│   ├── config_view.py     # /api/config (sanitized + raw + write)
│   └── logs.py            # /api/logs multi-file viewer
├── utils/
│   ├── auth.py            # Optional Bearer token middleware
│   ├── nanobot.py         # Gateway detection, config/cron readers
│   └── sanitize.py        # Path traversal prevention, secret redaction
├── frontend/              # Lit + Vite + TypeScript
│   └── src/
│       ├── app.ts         # Hash-based SPA router
│       ├── api/client.ts  # Centralized fetch wrapper
│       ├── components/
│       │   ├── nav-sidebar.ts   # Navigation with SVG icons
│       │   └── file-viewer.ts   # Abstract base for Memory/Knowledge pages
│       ├── pages/         # One component per route
│       └── utils/
│           └── markdown.ts      # marked + highlight.js
└── static/                # Vite build output (gitignored)
```

**Backend**: Python aiohttp — modular route handlers, optional Bearer token auth, `fcntl.flock` for safe cron writes.

**Frontend**: Lit 3 Web Components — hash-based routing, CSS custom properties design system (dark theme), `marked` + `highlight.js` for Markdown.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A running [nanobot](https://github.com/HKUDS/nanobot) installation at `~/.nanobot/`

### Install & Run

```bash
cd ~/.nanobot/dashboard

# Install frontend dependencies & build
cd frontend && npm install && npm run build && cd ..

# Start the server
make serve
# → http://127.0.0.1:18791
```

### Development

```bash
# Frontend dev server with hot reload (proxied to backend)
make dev

# Backend only
make serve

# Full rebuild
make build && make serve
```

## Configuration

All settings via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NANOBOT_ROOT` | `~/.nanobot` | Nanobot installation directory |
| `NANOBOT_DASHBOARD_HOST` | `127.0.0.1` | Server bind address |
| `NANOBOT_DASHBOARD_PORT` | `18791` | Server port |
| `NANOBOT_DASHBOARD_TOKEN` | *(empty)* | Bearer token for API auth (optional) |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | System status (gateway, model, channels, cron) |
| `GET` | `/api/sessions` | List sessions (`?channel=` filter) |
| `GET` | `/api/sessions/{key}` | Session messages + metadata |
| `PATCH` | `/api/sessions/{key}` | Update session note |
| `DELETE` | `/api/sessions/{key}` | Delete session |
| `GET` | `/api/cron/jobs` | List cron jobs |
| `POST` | `/api/cron/jobs` | Create cron job |
| `PATCH` | `/api/cron/jobs/{id}` | Update cron job |
| `DELETE` | `/api/cron/jobs/{id}` | Delete cron job |
| `POST` | `/api/cron/jobs/{id}/run` | Trigger cron job manually |
| `GET` | `/api/memory/files` | List workspace files (grouped) |
| `GET` | `/api/memory/files/{path}` | Read file content |
| `PUT` | `/api/memory/files/{path}` | Update file content |
| `GET` | `/api/skills` | List skills with frontmatter |
| `GET` | `/api/skills/{id}/{file}` | Read skill file |
| `PUT` | `/api/skills/{id}/{file}` | Update skill file |
| `DELETE` | `/api/skills/{id}` | Delete skill directory |
| `GET` | `/api/config` | Sanitized config (secrets redacted) |
| `GET` | `/api/config/raw` | Raw config (for editing) |
| `PUT` | `/api/config` | Save config |
| `GET` | `/api/logs` | List `.log` files |
| `GET` | `/api/logs/{name}` | Read log tail (`?lines=500`) |

## Data Paths

All paths relative to `NANOBOT_ROOT`:

| Data | Path | Format |
|------|------|--------|
| Active model | `.state.json` | `{"model": "...", "compact_model": "..."}` |
| Config | `config.json` | JSON (contains secrets) |
| Cron jobs | `cron/jobs.json` | JSON with `version` + `jobs[]` |
| Sessions | `workspace/sessions/*.jsonl` | Line 1: metadata, rest: messages |
| Session notes | `workspace/sessions/.notes.json` | `{key: note}` map |
| Workspace files | `workspace/` | `.md` files, grouped by subdirectory |
| Knowledge | `workspace/knowledge/` | Symlink to external directory |
| Skills | `workspace/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| Logs | `*.log` | Plain text log files |

## Security

- **Authentication**: Optional Bearer token via `NANOBOT_DASHBOARD_TOKEN`
- **Path traversal**: `safe_resolve()` uses `os.path.normpath` (not `Path.resolve()`) to prevent `../` escapes while supporting symlinks
- **Config redaction**: Keys matching sensitive patterns are replaced with `***` in the read-only view
- **Cron write safety**: `fcntl.flock(LOCK_EX)` prevents concurrent writes with the gateway process
- **Local-first**: Binds to `127.0.0.1` by default

## Design

Dark theme with CSS custom properties, inspired by modern dashboard aesthetics. Plus Jakarta Sans for UI text, JetBrains Mono for code. Green accent (`#4ADE80`) with orange highlights.

## TODO

- [ ] Mobile UX polish — basic responsive layout done, details need refinement
- [ ] Automated tests — backend API + frontend component + e2e

## License

MIT
