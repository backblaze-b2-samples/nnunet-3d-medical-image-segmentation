"""Load the repo-root .env before anything reads configuration.

Single source of truth: the repo-root .env, anchored to this file's path so it
resolves correctly regardless of where the process is invoked from (local
`cd services/api`, a script run by path, a Docker WORKDIR, etc.). A deployment
that ships only this service has no repo root above it — there the file simply
does not exist and configuration comes from real environment variables, so we
anchor on this service's root and let load_dotenv be the no-op it already is.

Call `load_repo_root_env()` BEFORE importing `app.config`, so `Settings()` sees
the values (main.py and the `scripts/` entrypoints all do this at their top).
"""

from pathlib import Path

from dotenv import load_dotenv

_API_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _API_ROOT.parents[1] if len(_API_ROOT.parents) > 1 else _API_ROOT
REPO_ROOT_ENV = _REPO_ROOT / ".env"


def load_repo_root_env() -> None:
    """Load the anchored repo-root .env (a no-op when the file is absent)."""
    load_dotenv(REPO_ROOT_ENV)
