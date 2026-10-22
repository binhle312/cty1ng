"""Per-channel workspaces: one git repo per project channel.

This module is the isolation boundary. Every file a bot touches goes through
Workspace.resolve, which refuses anything outside the channel's own folder,
so a bot working in project-a cannot read or write project-b however the
model phrases the path.
"""

from __future__ import annotations

import subprocess
import threading
from pathlib import Path, PurePosixPath

STARTER_DIRS = ("docs", "design", "memory", "inbox")
MAX_READ_BYTES = 200_000

# git keeps one index per repo; two commits at once fail on index.lock.
# Commits run in worker threads (asyncio.to_thread), so this is a thread lock.
_repo_locks: dict[Path, threading.Lock] = {}
_registry_lock = threading.Lock()


def _repo_lock(root: Path) -> threading.Lock:
    with _registry_lock:
        return _repo_locks.setdefault(root, threading.Lock())


class PathError(ValueError):
    """A path the bot is not allowed to use. The message is shown to the model."""


class Workspace:
    def __init__(self, root: Path):
        self.root = root.resolve()

    @classmethod
    def for_channel(cls, workspaces_dir: Path, channel_id: str) -> "Workspace":
        """One folder per platform-qualified channel id, e.g. workspaces/discord-1234/."""
        return cls(workspaces_dir / channel_id.replace(":", "-"))

    # -- setup ------------------------------------------------------------

    def ensure(self, project_name: str) -> None:
        """Create the folder and its git repo the first time a channel is used."""
        if (self.root / ".git").exists():
            return
        self.root.mkdir(parents=True, exist_ok=True)
        for d in STARTER_DIRS:
            (self.root / d).mkdir(exist_ok=True)
            (self.root / d / ".gitkeep").touch()
        (self.root / "README.md").write_text(
            f"# {project_name}\n\nWorkspace for the #{project_name} project channel.\n"
            "docs/ holds requirements, design/ holds UI prototypes, memory/ holds each bot's notes,\n"
            "inbox/ holds files the owner attached in chat.\n"
        )
        self._git("init", "-q", "-b", "main")
        self._git("config", "user.name", "rolebots")
        self._git("config", "user.email", "rolebots@localhost")
        self._git("add", "-A")
        self._git("commit", "-q", "-m", "Create project workspace")

    # -- path guard -------------------------------------------------------

    def resolve(self, rel: str) -> Path:
        """Map a workspace-relative path to a real path, or raise PathError."""
        rel = (rel or ".").strip()
        if PurePosixPath(rel).is_absolute() or (len(rel) > 1 and rel[1] == ":"):
            raise PathError(f"{rel!r}: use a path relative to the project workspace, like docs/stories.md")
        candidate = (self.root / rel).resolve()  # resolves ".." and symlinks
        if candidate != self.root and self.root not in candidate.parents:
            raise PathError(f"{rel!r} is outside this project's workspace")
        if ".git" in candidate.relative_to(self.root).parts:
            raise PathError("the .git folder is managed by the system")
        return candidate

    def relative(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def check_writable(self, rel: str, write_paths: list[str]) -> Path:
        path = self.resolve(rel)
        rel_posix = self.relative(path)
        for allowed in write_paths:
            if allowed.endswith("/") and rel_posix.startswith(allowed):
                return path
            if rel_posix == allowed:
                return path
        raise PathError(f"{rel_posix!r} is outside your write scope {write_paths}")

    # -- file operations --------------------------------------------------

    def read_text(self, rel: str) -> str:
        path = self.resolve(rel)
        if not path.is_file():
            raise PathError(f"{rel!r} does not exist")
        data = path.read_bytes()
        if len(data) > MAX_READ_BYTES:
            raise PathError(f"{rel!r} is {len(data)} bytes; the limit is {MAX_READ_BYTES}")
        return data.decode("utf-8", errors="replace")

    def write_text(self, rel: str, content: str, write_paths: list[str]) -> str:
        path = self.check_writable(rel, write_paths)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return self.relative(path)

    def list_files(self, rel: str = ".") -> list[str]:
        base = self.resolve(rel)
        if base.is_file():
            return [self.relative(base)]
        out = []
        for p in sorted(base.rglob("*")):
            if p.is_file() and ".git" not in p.relative_to(self.root).parts and p.name != ".gitkeep":
                out.append(self.relative(p))
        return out

    def inbox_path(self, message_id: str, filename: str) -> Path:
        """Where an attachment from one chat message is stored (inbox/<message_id>/<name>)."""
        path = self.resolve(f"inbox/{message_id.replace(':', '-')}/{filename}")
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    # -- git --------------------------------------------------------------

    def commit(self, message: str, paths: list[str]) -> str:
        """Commit the given files (if changed) and return the HEAD sha."""
        rels = [self.relative(self.resolve(p)) for p in paths]
        with _repo_lock(self.root):
            self._git("add", "--", *rels)
            if self._git("diff", "--cached", "--quiet", check=False).returncode != 0:
                self._git("commit", "-q", "-m", message)
            return self.head()

    def head(self) -> str:
        return self._git("rev-parse", "HEAD").stdout.strip()

    def changed_since(self, sha: str, paths: list[str]) -> bool:
        """True if any of the files differ from that commit, committed or not."""
        rels = [self.relative(self.resolve(p)) for p in paths]
        committed = self._git("diff", "--quiet", sha, "HEAD", "--", *rels, check=False).returncode != 0
        working = bool(self._git("status", "--porcelain", "--", *rels).stdout.strip())
        return committed or working

    def _git(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["git", "-C", str(self.root), *args], capture_output=True, text=True, check=check
        )
