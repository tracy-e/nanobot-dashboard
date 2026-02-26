"""Path safety and API key sanitization."""

import re
from pathlib import Path


def safe_resolve(base: Path, user_path: str) -> Path:
    """Resolve a user-provided path within a base directory.

    Uses normpath on the *logical* path (without resolving symlinks)
    to catch traversal like '../../../etc/passwd', then returns the
    un-resolved path so symlinks inside base still work.

    Raises ValueError if the normalized path escapes the base directory.
    """
    import os
    # Normalize without resolving symlinks
    logical = os.path.normpath(os.path.join(str(base), user_path))
    base_str = str(base)
    if not (logical == base_str or logical.startswith(base_str + os.sep)):
        raise ValueError(f"Path traversal detected: {user_path}")
    return Path(logical)


def sanitize_config(config: dict) -> dict:
    """Replace API keys and secrets with '***'."""
    sensitive_keys = {
        "apiKey", "api_key", "appSecret", "app_secret",
        "token", "secret", "secret_key", "secretKey",
        "encryptKey", "encrypt_key", "verificationToken",
        "verification_token", "password", "api_base", "apiBase",
    }

    def _sanitize(obj):
        if isinstance(obj, dict):
            return {
                k: "***" if k in sensitive_keys and isinstance(v, str) and v else _sanitize(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [_sanitize(i) for i in obj]
        return obj

    return _sanitize(config)
