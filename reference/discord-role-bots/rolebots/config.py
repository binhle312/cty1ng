"""Runtime settings, read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so the project has no extra dependency for it.

    Existing environment variables win, so production can override the file.
    """
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


@dataclass(frozen=True)
class Settings:
    owner_ids: set[str]  # platform-qualified, e.g. {"discord:1234"}
    project_channel_prefix: str
    data_dir: Path
    bots_dir: Path
    job_lease_seconds: int
    job_max_attempts: int
    worker_poll_seconds: float

    @property
    def db_path(self) -> Path:
        return self.data_dir / "rolebots.sqlite3"

    @property
    def workspaces_dir(self) -> Path:
        return self.data_dir / "workspaces"

    @property
    def transcripts_dir(self) -> Path:
        return self.data_dir / "transcripts"


def load_settings(root: Path | None = None) -> Settings:
    root = root or Path.cwd()
    _load_dotenv(root / ".env")

    # One owner id per platform you use: OWNER_DISCORD_ID, later OWNER_SLACK_ID, ...
    owner_ids = {
        f"{key[len('OWNER_'):-len('_ID')].lower()}:{value.strip()}"
        for key, value in os.environ.items()
        if key.startswith("OWNER_") and key.endswith("_ID") and value.strip()
    }
    if not owner_ids:
        raise SystemExit("Set your user id for at least one platform, e.g. OWNER_DISCORD_ID")

    data_dir = Path(os.environ.get("DATA_DIR", "./data")).resolve()
    return Settings(
        owner_ids=owner_ids,
        project_channel_prefix=os.environ.get("PROJECT_CHANNEL_PREFIX", "project-"),
        data_dir=data_dir,
        bots_dir=(root / "bots").resolve(),
        job_lease_seconds=int(os.environ.get("JOB_LEASE_SECONDS", "900")),
        job_max_attempts=int(os.environ.get("JOB_MAX_ATTEMPTS", "3")),
        worker_poll_seconds=float(os.environ.get("WORKER_POLL_SECONDS", "1.0")),
    )
