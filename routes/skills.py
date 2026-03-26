"""Skills management endpoints.

Scans workspace/skills/ and nanobot built-in skills for skill directories, parses SKILL.md frontmatter.
"""

import os
import re
from pathlib import Path

from aiohttp import web

from dashboard.config import NANOBOT_ROOT, WORKSPACE_DIR
from dashboard.utils.sanitize import safe_resolve
from dashboard.utils.trash import safe_delete

WORKSPACE_SKILLS_DIR = WORKSPACE_DIR / "skills"
NANOBOT_SKILLS_DIR = NANOBOT_ROOT / "nanobot-src" / "nanobot" / "skills"


def _parse_frontmatter(text: str) -> dict:
    """Extract YAML frontmatter from a SKILL.md file (simple parser)."""
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    fm: dict = {}
    for line in m.group(1).split("\n"):
        line = line.strip()
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and val:
                fm[key] = val
    return fm


def _scan_skills_dir(skills_dir: Path, builtin: bool = False) -> list[dict]:
    """Scan a skills directory for skill definitions."""
    skills = []
    if not skills_dir.exists():
        return skills

    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue

        skill_md = entry / "SKILL.md"
        info: dict = {
            "id": entry.name,
            "name": entry.name,
            "description": "",
            "hasSkillMd": skill_md.exists(),
            "files": [],
            "builtin": builtin,
        }

        if skill_md.exists():
            try:
                content = skill_md.read_text(encoding="utf-8")
                fm = _parse_frontmatter(content)
                info["name"] = fm.get("name", entry.name)
                info["description"] = fm.get("description", "")
                info["frontmatter"] = fm
            except Exception:
                pass

        # List files recursively in skill dir
        skip_dirs = {"__pycache__", "node_modules", ".venv", "venv"}
        for dirpath, dirnames, filenames in os.walk(str(entry)):
            dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in skip_dirs]
            for fname in sorted(filenames):
                if fname.startswith(".") or fname.endswith((".pyc", ".pyo")):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, fname), str(entry))
                info["files"].append(rel)

        skills.append(info)
    return skills


def _scan_skills() -> list[dict]:
    """Scan both workspace and built-in skills directories."""
    skills = []
    
    # Scan built-in skills first
    builtin_skills = _scan_skills_dir(NANOBOT_SKILLS_DIR, builtin=True)
    skills.extend(builtin_skills)
    
    # Then scan workspace skills
    workspace_skills = _scan_skills_dir(WORKSPACE_SKILLS_DIR, builtin=False)
    skills.extend(workspace_skills)
    
    return skills


async def list_skills(request: web.Request) -> web.Response:
    skills = _scan_skills()
    return web.json_response({"skills": skills})


async def get_skill_file(request: web.Request) -> web.Response:
    """Read a file from a skill directory."""
    skill_id = request.match_info["id"]
    filename = request.match_info["filename"]

    # Determine which skills directory to use
    # Check workspace first, then built-in
    skills_dir = WORKSPACE_SKILLS_DIR
    if not (skills_dir / skill_id).exists():
        skills_dir = NANOBOT_SKILLS_DIR

    try:
        filepath = safe_resolve(skills_dir, f"{skill_id}/{filename}")
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.exists() or not filepath.is_file():
        raise web.HTTPNotFound(text="File not found")

    content = filepath.read_text(encoding="utf-8")
    return web.json_response({
        "skill": skill_id,
        "filename": filename,
        "content": content,
        "sizeBytes": filepath.stat().st_size,
    })


async def update_skill_file(request: web.Request) -> web.Response:
    """Update a file in a skill directory (workspace only)."""
    skill_id = request.match_info["id"]
    filename = request.match_info["filename"]

    # Only allow updates to workspace skills
    try:
        filepath = safe_resolve(WORKSPACE_SKILLS_DIR, f"{skill_id}/{filename}")
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not filepath.exists() and not (WORKSPACE_SKILLS_DIR / skill_id).exists():
        raise web.HTTPNotFound(text="Skill not found or is built-in (read-only)")

    body = await request.json()
    content = body.get("content")
    if content is None:
        raise web.HTTPBadRequest(text="Content is required")

    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(content, encoding="utf-8")

    return web.json_response({
        "skill": skill_id,
        "filename": filename,
        "sizeBytes": filepath.stat().st_size,
        "updated": True,
    })


async def delete_skill(request: web.Request) -> web.Response:
    """Delete a skill directory (workspace only)."""
    skill_id = request.match_info["id"]

    try:
        dirpath = safe_resolve(WORKSPACE_SKILLS_DIR, skill_id)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not dirpath.exists() or not dirpath.is_dir():
        raise web.HTTPNotFound(text="Skill not found or is built-in (cannot delete)")

    safe_delete(dirpath)
    return web.json_response({"deleted": skill_id})


def setup(app: web.Application):
    app.router.add_get("/api/skills", list_skills)
    app.router.add_get(r"/api/skills/{id}/{filename:.+}", get_skill_file)
    app.router.add_put(r"/api/skills/{id}/{filename:.+}", update_skill_file)
    app.router.add_delete("/api/skills/{id}", delete_skill)
