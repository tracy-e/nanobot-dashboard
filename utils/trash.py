"""Safe file/directory deletion with trash support."""

import shutil
import subprocess
from pathlib import Path

_HAS_TRASH = shutil.which("trash") is not None


def safe_delete(filepath: Path) -> None:
    """Delete a file or directory, preferring trash when available."""
    if _HAS_TRASH:
        subprocess.run(["trash", str(filepath)], check=True)
    elif filepath.is_dir():
        shutil.rmtree(str(filepath))
    else:
        filepath.unlink()
