"""Global file search — BM25 ranked filename + content matching across workspace.

Ported from nanobot's memory_search tool (memory_tool.py), adapted for
file-level results with line-number snippets.
"""

import math
import os
import re
from collections import Counter

from aiohttp import web

from dashboard.config import WORKSPACE_DIR
from dashboard.routes.memory import _scan_files

# File extensions eligible for content search
CONTENT_EXTENSIONS = {".md", ".txt", ".log", ".json", ".jsonl"}

MAX_FILES = 20
MAX_MATCHES_PER_FILE = 3
MIN_QUERY_LEN = 2
CONTEXT_CHARS = 80  # chars around match in snippet

FILENAME_BONUS = 5.0  # extra score when query appears in filename
SUBSTRING_BONUS = 3.0  # extra score when raw query appears as substring in content

# CJK Unicode ranges (CJK Unified Ideographs + Extension A + Compat)
_CJK_RE = re.compile(
    r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]"
)

# ---------------------------------------------------------------------------
# BM25 helpers (from nanobot memory_tool.py, with CJK-aware tokenizer)
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """Tokenize: ASCII/digit words kept whole, CJK characters split individually.

    "hello微信读书world" → ["hello", "微", "信", "读", "书", "world"]
    This ensures Chinese substrings like "微信" match inside "微信读书".
    """
    tokens: list[str] = []
    for word in re.findall(r"\w+", text.lower()):
        if _CJK_RE.search(word):
            # Split mixed token: keep ASCII runs, split CJK chars
            for part in re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", word):
                tokens.append(part)
        else:
            tokens.append(word)
    return tokens


def _bm25_score_file(
    query_tokens: list[str],
    file_tokens: list[str],
    df: Counter,
    n: int,
    avgdl: float,
    k1: float = 1.5,
    b: float = 0.75,
) -> float:
    """Compute BM25 score for a single file against the query."""
    if not file_tokens:
        return 0.0

    tf = Counter(file_tokens)
    dl = len(file_tokens)
    score = 0.0

    for t in query_tokens:
        if df[t] == 0:
            continue
        idf = math.log((n - df[t] + 0.5) / (df[t] + 0.5) + 1)
        score += idf * (tf[t] * (k1 + 1)) / (tf[t] + k1 * (1 - b + b * dl / avgdl))

    return score


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def _search(query: str) -> list[dict]:
    q = query.lower()
    query_tokens = _tokenize(query)
    files = _scan_files()

    # Phase 1: read all file contents and tokenize
    file_data: list[dict] = []
    for f in files:
        filepath = WORKSPACE_DIR / f["path"]
        ext = os.path.splitext(f["name"])[1].lower()
        content_lines: list[str] = []
        tokens: list[str] = []

        if ext in CONTENT_EXTENSIONS and filepath.exists():
            try:
                text = filepath.read_text(encoding="utf-8")
                content_lines = text.splitlines()
                tokens = _tokenize(text)
            except (OSError, UnicodeDecodeError):
                pass

        file_data.append({**f, "_lines": content_lines, "_tokens": tokens})

    # Phase 2: compute document frequencies across all files
    n = len(file_data)
    if n == 0:
        return []

    df: Counter = Counter()
    for fd in file_data:
        for token in set(fd["_tokens"]):
            df[token] += 1

    avgdl = sum(len(fd["_tokens"]) for fd in file_data) / n if n else 1

    # Phase 3: score each file with BM25 + relevance filter + bonuses
    min_overlap = math.ceil(len(query_tokens) * 0.6) if len(query_tokens) > 1 else 1
    scored: list[tuple[float, dict]] = []
    for fd in file_data:
        file_token_set = set(fd["_tokens"])
        content_text = "\n".join(fd["_lines"]).lower() if fd["_lines"] else ""

        has_substring = bool(content_text and q in content_text)
        has_filename = q in fd["path"].lower()

        # Token overlap filter: require enough query tokens present in file
        # Bypass for exact substring or filename matches (guaranteed relevant)
        if not has_substring and not has_filename:
            overlap = sum(1 for t in query_tokens if t in file_token_set)
            if overlap < min_overlap:
                continue

        score = _bm25_score_file(query_tokens, fd["_tokens"], df, n, avgdl)

        if has_filename:
            score += FILENAME_BONUS
        if has_substring:
            score += SUBSTRING_BONUS

        if score <= 0:
            continue

        # Extract matching line snippets (for display)
        # Try exact substring first; fall back to any-token match for multi-word queries
        matches: list[dict] = []
        for i, line in enumerate(fd["_lines"], 1):
            ll = line.lower()
            # Exact substring match
            if q in ll:
                idx = ll.index(q)
            elif len(query_tokens) > 1 and any(t in ll for t in query_tokens):
                # Multi-word: find first matching token position
                idx = next(ll.index(t) for t in query_tokens if t in ll)
            else:
                continue
            start = max(0, idx - CONTEXT_CHARS)
            end = min(len(line), idx + len(query) + CONTEXT_CHARS)
            snippet = line[start:end]
            if start > 0:
                snippet = "…" + snippet
            if end < len(line):
                snippet = snippet + "…"
            matches.append({"line": i, "text": snippet})
            if len(matches) >= MAX_MATCHES_PER_FILE:
                break

        scored.append((score, {
            "path": fd["path"],
            "name": fd["name"],
            "group": fd["group"],
            "score": round(score, 2),
            "matches": matches,
        }))

    # Sort by score descending, drop low-relevance tail, take top N
    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        threshold = scored[0][0] * 0.35
        scored = [(s, d) for s, d in scored if s >= threshold]
    return [item for _, item in scored[:MAX_FILES]]


async def search_files(request: web.Request) -> web.Response:
    q = request.query.get("q", "").strip()
    if len(q) < MIN_QUERY_LEN:
        return web.json_response({"results": []})
    return web.json_response({"results": _search(q)})


def setup(app: web.Application):
    app.router.add_get("/api/search", search_files)
