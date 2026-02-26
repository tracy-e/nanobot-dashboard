"""Skills management endpoints.

Scans workspace/skills/ for skill directories, parses SKILL.md frontmatter.
"""

import os
import re
from pathlib import Path

from aiohttp import web

from dashboard.config import WORKSPACE_DIR
from dashboard.utils.sanitize import safe_resolve

SKILLS_DIR = WORKSPACE_DIR / "skills"


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


def _scan_skills() -> list[dict]:
    """Scan skills directory for all skill definitions."""
    skills = []
    if not SKILLS_DIR.exists():
        return skills

    for entry in sorted(SKILLS_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue

        skill_md = entry / "SKILL.md"
        info: dict = {
            "id": entry.name,
            "name": entry.name,
            "description": "",
            "hasSkillMd": skill_md.exists(),
            "files": [],
        }

        if skill_md.exists():
            try:
                content = skill_md.read_text(encoding="utf-8")
                fm = _parse_frontmatter(content)
                info["name"] = fm.get("name", entry.name)
                info["description"] = fm.get("description", "")
            except Exception:
                pass

        # List files in skill dir
        for f in sorted(entry.iterdir()):
            if f.is_file() and not f.name.startswith("."):
                info["files"].append(f.name)

        skills.append(info)
    return skills


async def list_skills(request: web.Request) -> web.Response:
    skills = _scan_skills()
    return web.json_response({"skills": skills})


async def get_skill_file(request: web.Request) -> web.Response:
    """Read a file from a skill directory."""
    skill_id = request.match_info["id"]
    filename = request.match_info["filename"]

    try:
        filepath = safe_resolve(SKILLS_DIR, f"{skill_id}/{filename}")
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
    """Update a file in a skill directory."""
    skill_id = request.match_info["id"]
    filename = request.match_info["filename"]

    try:
        filepath = safe_resolve(SKILLS_DIR, f"{skill_id}/{filename}")
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

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
    """Delete a skill directory."""
    import shutil
    skill_id = request.match_info["id"]

    try:
        dirpath = safe_resolve(SKILLS_DIR, skill_id)
    except ValueError:
        raise web.HTTPForbidden(text="Path traversal detected")

    if not dirpath.exists() or not dirpath.is_dir():
        raise web.HTTPNotFound(text="Skill not found")

    shutil.rmtree(str(dirpath))
    return web.json_response({"deleted": skill_id})


def setup(app: web.Application):
    app.router.add_get("/api/skills", list_skills)
    app.router.add_get("/api/skills/{id}/{filename}", get_skill_file)
    app.router.add_put("/api/skills/{id}/{filename}", update_skill_file)
    app.router.add_delete("/api/skills/{id}", delete_skill)
