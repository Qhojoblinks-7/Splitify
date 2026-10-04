"""Fail fast when the wrong Python is running the project.

The project's dependencies live in `backend/.venv`, not in the system interpreter. Nothing
enforces that, and the failure is extremely confusing when it goes wrong: a system Python with
Django 4.x reports

    TypeError: CheckConstraint.__init__() got an unexpected keyword argument 'condition'

from deep inside a model definition, with no hint that the real problem is that the wrong
interpreter is running. `CheckConstraint(condition=...)` replaced `check=` in Django 5.1.

Called from `growl.settings`, which is the one thing both `manage.py` and pytest-django load
before any application code runs. Checking here means every entry point gets the same message.
"""

import sys
from pathlib import Path

# `CheckConstraint(condition=...)` and the partial unique constraints the ledger relies on need
# 5.1. Raising this rather than matching it exactly, so a future bump is one line.
MINIMUM_DJANGO = (5, 1)

VENV = Path(__file__).resolve().parent.parent / ".venv"


def virtualenv_python():
    """The interpreter this project expects to be run with, if it exists."""
    candidates = (
        [VENV / "Scripts" / "python.exe", VENV / "Scripts" / "python"]
        if sys.platform == "win32"
        else [VENV / "bin" / "python"]
    )
    return next((path for path in candidates if path.exists()), None)


def require_supported_django():
    import django

    if django.VERSION[:2] >= MINIMUM_DJANGO:
        return

    expected = virtualenv_python()
    hint = f"\n\nRun it with the project's interpreter:\n    {expected} manage.py <command>" if expected else (
        "\n\nInstall the project's dependencies into backend/.venv first."
    )

    raise SystemExit(
        f"Growl needs Django {MINIMUM_DJANGO[0]}.{MINIMUM_DJANGO[1]} or newer, but this is "
        f"Django {django.get_version()} running on {sys.executable}.\n"
        f"You are using a system interpreter, not the project's virtual environment."
        f"{hint}"
    )