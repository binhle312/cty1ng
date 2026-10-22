"""Durable state in SQLite: projects, sessions, events, jobs, handoffs.

The chat platform is never the source of truth. If the process dies at any point, these
tables say what was asked, what ran, and what is waiting for approval.

The two constraints that carry most of the safety:
  * events.event_id is the primary key, so a redelivered chat message is a no-op.
  * claim_next_job never starts a job for a session that already has a live
    running job, so two orders to the same bot in the same thread run in order.

SQLite is fine for one process. Moving to Postgres later means swapping
BEGIN IMMEDIATE for SELECT ... FOR UPDATE SKIP LOCKED in claim_next_job.
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from pathlib import Path

import aiosqlite

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    channel_id      TEXT PRIMARY KEY,          -- platform-qualified, e.g. "discord:1234"
    name            TEXT NOT NULL,
    workspace_path  TEXT NOT NULL,
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    session_key     TEXT PRIMARY KEY,          -- "<role>|<channel_id>|<thread_id>"
    role            TEXT NOT NULL,
    channel_id      TEXT NOT NULL,
    thread_id       TEXT NOT NULL,
    created_at      REAL NOT NULL,
    last_active_at  REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_thread ON sessions(thread_id);

-- Conversation history, appended once per successful run. Stored in Pydantic AI's
-- provider-neutral message format, so a bot can change model between runs.
CREATE TABLE IF NOT EXISTS session_messages (
    run_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key     TEXT NOT NULL REFERENCES sessions(session_key),
    job_id          INTEGER NOT NULL UNIQUE REFERENCES jobs(job_id),
    messages_json   BLOB NOT NULL,
    created_at      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    event_id        TEXT PRIMARY KEY,          -- "<message_id>:<role>", or "handoff:<id>", "changes:<id>"
    session_key     TEXT NOT NULL REFERENCES sessions(session_key),
    author_id       TEXT NOT NULL,
    content         TEXT NOT NULL,
    attachments     TEXT NOT NULL DEFAULT '[]',   -- JSON list of saved files (see attachments.py)
    received_at     REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    job_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key     TEXT NOT NULL REFERENCES sessions(session_key),
    event_id        TEXT NOT NULL UNIQUE REFERENCES events(event_id),
    status          TEXT NOT NULL DEFAULT 'queued',   -- queued | running | done | failed
    attempts        INTEGER NOT NULL DEFAULT 0,
    locked_until    REAL,
    last_error      TEXT,
    created_at      REAL NOT NULL,
    finished_at     REAL
);
CREATE INDEX IF NOT EXISTS jobs_by_status ON jobs(status, created_at);

-- A handoff is a bot's proposal to pass files on, pinned to one commit,
-- plus your decision on it. (The design doc splits approvals into their own
-- table; with one approver per handoff a single row is simpler.)
CREATE TABLE IF NOT EXISTS handoffs (
    handoff_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id      TEXT NOT NULL,
    thread_id       TEXT NOT NULL,
    from_role       TEXT NOT NULL,
    to_role         TEXT NOT NULL,             -- a role, or "human" for a final review
    files           TEXT NOT NULL,             -- JSON list of workspace-relative paths
    summary         TEXT NOT NULL,
    commit_sha      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | changes_requested | rejected | stale
    message_id      TEXT,                      -- the chat message holding the buttons
    created_by_job  INTEGER REFERENCES jobs(job_id),
    created_at      REAL NOT NULL,
    decided_at      REAL
);
"""


@dataclass(frozen=True)
class Session:
    session_key: str
    role: str
    channel_id: str
    thread_id: str


@dataclass(frozen=True)
class Job:
    job_id: int
    session_key: str
    event_id: str
    attempts: int


@dataclass(frozen=True)
class Event:
    event_id: str
    session_key: str
    author_id: str
    content: str
    attachments: list[dict]


@dataclass(frozen=True)
class Handoff:
    handoff_id: int
    channel_id: str
    thread_id: str
    from_role: str
    to_role: str
    files: list[str]
    summary: str
    commit_sha: str
    status: str
    message_id: str | None
    created_by_job: int | None


def session_key(role: str, channel_id: str, thread_id: str) -> str:
    return f"{role}|{channel_id}|{thread_id}"


class Store:
    def __init__(self, conn: aiosqlite.Connection, lease_seconds: int, max_attempts: int):
        self._conn = conn
        self._lock = asyncio.Lock()  # one writer transaction at a time on this connection
        self.lease_seconds = lease_seconds
        self.max_attempts = max_attempts

    @classmethod
    async def open(cls, path: Path | str, lease_seconds: int = 900, max_attempts: int = 3) -> "Store":
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        conn = await aiosqlite.connect(str(path), isolation_level=None)  # we manage transactions
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.executescript(SCHEMA)
        return cls(conn, lease_seconds, max_attempts)

    async def close(self) -> None:
        await self._conn.close()

    # -- projects ---------------------------------------------------------

    async def ensure_project(self, channel_id: str, name: str, workspace_path: Path) -> None:
        async with self._lock:
            await self._conn.execute(
                "INSERT OR IGNORE INTO projects(channel_id, name, workspace_path, created_at) VALUES (?,?,?,?)",
                (channel_id, name, str(workspace_path), time.time()),
            )

    # -- sessions ---------------------------------------------------------

    async def get_or_create_session(self, role: str, channel_id: str, thread_id: str) -> Session:
        key = session_key(role, channel_id, thread_id)
        now = time.time()
        async with self._lock:
            await self._conn.execute(
                "INSERT OR IGNORE INTO sessions(session_key, role, channel_id, thread_id, created_at, last_active_at)"
                " VALUES (?,?,?,?,?,?)",
                (key, role, channel_id, thread_id, now, now),
            )
        return await self.get_session(key)

    async def get_session(self, key: str) -> Session:
        cur = await self._conn.execute("SELECT * FROM sessions WHERE session_key = ?", (key,))
        row = await cur.fetchone()
        if row is None:
            raise KeyError(key)
        return _session(row)

    async def project_name(self, channel_id: str) -> str | None:
        cur = await self._conn.execute("SELECT name FROM projects WHERE channel_id = ?", (channel_id,))
        row = await cur.fetchone()
        return row["name"] if row else None

    async def session_owning_thread(self, thread_id: str) -> Session | None:
        """The bot that opened this thread, so you can reply there without @mentioning it."""
        cur = await self._conn.execute(
            "SELECT * FROM sessions WHERE thread_id = ? ORDER BY created_at LIMIT 1", (thread_id,)
        )
        row = await cur.fetchone()
        return _session(row) if row else None

    async def load_history(self, key: str) -> list[bytes]:
        """The JSON-encoded messages of every completed run, oldest first."""
        cur = await self._conn.execute(
            "SELECT messages_json FROM session_messages WHERE session_key = ? ORDER BY run_id", (key,)
        )
        return [row["messages_json"] for row in await cur.fetchall()]

    async def complete_job_with_history(self, job_id: int, key: str, messages_json: bytes) -> None:
        """Append the run's messages and mark the job done in one transaction.

        If the process dies before this commits, the job is retried and the
        half-finished run leaves no trace in the history.
        """
        now = time.time()
        async with self._lock:
            await self._conn.execute("BEGIN IMMEDIATE")
            try:
                await self._conn.execute(
                    "INSERT OR IGNORE INTO session_messages(session_key, job_id, messages_json, created_at)"
                    " VALUES (?,?,?,?)",
                    (key, job_id, messages_json, now),
                )
                await self._conn.execute(
                    "UPDATE jobs SET status = 'done', locked_until = NULL, finished_at = ? WHERE job_id = ?",
                    (now, job_id),
                )
                await self._conn.execute(
                    "UPDATE sessions SET last_active_at = ? WHERE session_key = ?", (now, key)
                )
                await self._conn.execute("COMMIT")
            except BaseException:
                await self._conn.execute("ROLLBACK")
                raise

    # -- events and jobs --------------------------------------------------

    async def record_event_and_enqueue(self, event_id: str, key: str, author_id: str, content: str,
                                       attachments: list[dict] | None = None) -> int | None:
        """Store an inbound event and queue a job for it, atomically.

        Returns the job id, or None when this event was already recorded
        (platform redelivery, double click), in which case nothing happens.
        """
        now = time.time()
        async with self._lock:
            await self._conn.execute("BEGIN IMMEDIATE")
            try:
                cur = await self._conn.execute(
                    "INSERT OR IGNORE INTO events(event_id, session_key, author_id, content, attachments, received_at)"
                    " VALUES (?,?,?,?,?,?)",
                    (event_id, key, author_id, content, json.dumps(attachments or []), now),
                )
                if cur.rowcount == 0:
                    await self._conn.execute("ROLLBACK")
                    return None
                cur = await self._conn.execute(
                    "INSERT INTO jobs(session_key, event_id, created_at) VALUES (?,?,?)", (key, event_id, now)
                )
                job_id = cur.lastrowid
                await self._conn.execute("COMMIT")
                return job_id
            except BaseException:
                await self._conn.execute("ROLLBACK")
                raise

    async def claim_next_job(self, now: float | None = None) -> Job | None:
        """Lease the oldest runnable job.

        Runnable = queued, or running with an expired lease (its worker died).
        A session with a live running job is skipped, which serialises work per
        (bot, channel, thread) while different sessions run in parallel.
        """
        now = time.time() if now is None else now
        async with self._lock:
            await self._conn.execute("BEGIN IMMEDIATE")
            try:
                # A worker that died on its last allowed attempt leaves a running
                # job with an expired lease. Fail it so it stops blocking its session.
                await self._conn.execute(
                    "UPDATE jobs SET status = 'failed', last_error = 'lease expired on final attempt',"
                    " finished_at = :now WHERE status = 'running' AND locked_until < :now AND attempts >= :max",
                    {"now": now, "max": self.max_attempts},
                )
                cur = await self._conn.execute(
                    """
                    SELECT j.* FROM jobs j
                    WHERE (j.status = 'queued' OR (j.status = 'running' AND j.locked_until < :now))
                      AND NOT EXISTS (
                        SELECT 1 FROM jobs r
                        WHERE r.session_key = j.session_key AND r.job_id != j.job_id
                          AND r.status = 'running' AND r.locked_until >= :now)
                      AND NOT EXISTS (
                        SELECT 1 FROM jobs earlier
                        WHERE earlier.session_key = j.session_key AND earlier.job_id < j.job_id
                          AND earlier.status IN ('queued', 'running'))
                    ORDER BY j.job_id
                    LIMIT 1
                    """,
                    {"now": now},
                )
                row = await cur.fetchone()
                if row is None:
                    await self._conn.execute("COMMIT")
                    return None
                await self._conn.execute(
                    "UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_until = ? WHERE job_id = ?",
                    (now + self.lease_seconds, row["job_id"]),
                )
                await self._conn.execute("COMMIT")
                return Job(row["job_id"], row["session_key"], row["event_id"], row["attempts"] + 1)
            except BaseException:
                await self._conn.execute("ROLLBACK")
                raise

    async def complete_job(self, job_id: int) -> None:
        async with self._lock:
            await self._conn.execute(
                "UPDATE jobs SET status = 'done', locked_until = NULL, finished_at = ? WHERE job_id = ?",
                (time.time(), job_id),
            )

    async def fail_job(self, job_id: int, error: str) -> bool:
        """Record a failure. Returns True if the job will be retried."""
        async with self._lock:
            cur = await self._conn.execute("SELECT attempts FROM jobs WHERE job_id = ?", (job_id,))
            row = await cur.fetchone()
            retry = row is not None and row["attempts"] < self.max_attempts
            await self._conn.execute(
                "UPDATE jobs SET status = ?, locked_until = NULL, last_error = ?, finished_at = ? WHERE job_id = ?",
                ("queued" if retry else "failed", error[:2000], None if retry else time.time(), job_id),
            )
            return retry

    async def get_event(self, event_id: str) -> Event:
        cur = await self._conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,))
        row = await cur.fetchone()
        return Event(row["event_id"], row["session_key"], row["author_id"], row["content"],
                     json.loads(row["attachments"]))

    async def job_status(self, job_id: int) -> str:
        cur = await self._conn.execute("SELECT status FROM jobs WHERE job_id = ?", (job_id,))
        row = await cur.fetchone()
        return row["status"]

    # -- handoffs ---------------------------------------------------------

    async def create_handoff(
        self,
        *,
        channel_id: str,
        thread_id: str,
        from_role: str,
        to_role: str,
        files: list[str],
        summary: str,
        commit_sha: str,
        created_by_job: int | None,
    ) -> int:
        async with self._lock:
            await self._conn.execute("BEGIN IMMEDIATE")
            try:
                # A new proposal from the same bot in the same thread replaces any
                # older pending one, so you never approve an outdated draft.
                await self._conn.execute(
                    "UPDATE handoffs SET status = 'stale', decided_at = ?"
                    " WHERE thread_id = ? AND from_role = ? AND status = 'pending'",
                    (time.time(), thread_id, from_role),
                )
                cur = await self._conn.execute(
                    "INSERT INTO handoffs(channel_id, thread_id, from_role, to_role, files, summary, commit_sha,"
                    " created_by_job, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (channel_id, thread_id, from_role, to_role, json.dumps(files), summary, commit_sha,
                     created_by_job, time.time()),
                )
                handoff_id = cur.lastrowid
                await self._conn.execute("COMMIT")
                return handoff_id
            except BaseException:
                await self._conn.execute("ROLLBACK")
                raise

    async def get_handoff(self, handoff_id: int) -> Handoff | None:
        cur = await self._conn.execute("SELECT * FROM handoffs WHERE handoff_id = ?", (handoff_id,))
        row = await cur.fetchone()
        return _handoff(row) if row else None

    async def pending_handoffs_for_job(self, job_id: int) -> list[Handoff]:
        cur = await self._conn.execute(
            "SELECT * FROM handoffs WHERE created_by_job = ? AND status = 'pending' AND message_id IS NULL",
            (job_id,),
        )
        return [_handoff(r) for r in await cur.fetchall()]

    async def set_handoff_message(self, handoff_id: int, message_id: str) -> None:
        async with self._lock:
            await self._conn.execute(
                "UPDATE handoffs SET message_id = ? WHERE handoff_id = ?", (message_id, handoff_id)
            )

    async def decide_handoff(self, handoff_id: int, new_status: str) -> bool:
        """Move a pending handoff to a decision. Returns False if it was not pending.

        The WHERE status = 'pending' guard makes a double click or a retried
        interaction a no-op instead of a second approval.
        """
        async with self._lock:
            cur = await self._conn.execute(
                "UPDATE handoffs SET status = ?, decided_at = ? WHERE handoff_id = ? AND status = 'pending'",
                (new_status, time.time(), handoff_id),
            )
            return cur.rowcount == 1

    async def handoffs_since(self, channel_id: str, since: float) -> int:
        cur = await self._conn.execute(
            "SELECT COUNT(*) AS n FROM handoffs WHERE channel_id = ? AND created_at >= ?", (channel_id, since)
        )
        return (await cur.fetchone())["n"]


def _session(row: aiosqlite.Row) -> Session:
    return Session(row["session_key"], row["role"], row["channel_id"], row["thread_id"])


def _handoff(row: aiosqlite.Row) -> Handoff:
    return Handoff(row["handoff_id"], row["channel_id"], row["thread_id"], row["from_role"], row["to_role"],
                   json.loads(row["files"]), row["summary"], row["commit_sha"], row["status"],
                   row["message_id"], row["created_by_job"])
