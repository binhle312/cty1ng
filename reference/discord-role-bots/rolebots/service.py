"""The bots' behaviour, independent of any chat platform.

Flow for one order:
  you @mention a bot  ->  handle_message writes an event + job (deduplicated)
  worker claims job   ->  runs the agent in that channel's workspace
  worker posts reply  ->  plus approval buttons for any handoff the bot proposed
  you press Approve   ->  orchestrator checks the commit, starts the next bot in a new thread

Adapters (rolebots/adapters/) turn platform events into calls on this class and
implement ChatAdapter for output. Everything that must survive a restart is in
the Store, so a crash loses connections, not work.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time

from pydantic_ai.models import Model

from . import agent as agent_mod
from .attachments import MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, SavedAttachment, build_prompt, describe, kind_of, safe_name
from .botdef import BotDefinition
from .chat import Button, ButtonPress, ChatAdapter, IncomingMessage, OutgoingFile, chunk, platform_of
from .config import Settings
from .db import Handoff, Job, Store
from .orchestrator import Decision, Orchestrator
from .workspace import Workspace

log = logging.getLogger("rolebots")

MAX_CONCURRENT_JOBS = 4
MAX_REVIEW_FILE_BYTES = 8 * 1024 * 1024
MAX_REVIEW_FILES = 10


def approval_buttons(handoff_id: int) -> list[Button]:
    value = str(handoff_id)
    return [
        Button("approve", "Approve", value, style="primary"),
        Button("changes", "Request changes", value, needs_note=True),
        Button("reject", "Reject", value, style="danger"),
    ]


class RoleBotsService:
    def __init__(self, settings: Settings, store: Store, bots: dict[str, BotDefinition],
                 adapters: dict[str, ChatAdapter], model_override: Model | None = None):
        self.settings, self.store, self.bots = settings, store, bots
        self.adapters = adapters  # platform -> adapter
        self.orchestrator = Orchestrator(store, bots, settings.workspaces_dir, settings.owner_ids)
        self.model_override = model_override  # tests swap in a scripted model

    def is_owner(self, user_id: str) -> bool:
        return user_id in self.settings.owner_ids

    def _owner_on(self, platform: str) -> str | None:
        return next((o for o in self.settings.owner_ids if platform_of(o) == platform), None)

    def _workspace(self, channel_id: str) -> Workspace:
        return Workspace.for_channel(self.settings.workspaces_dir, channel_id)

    # -- inbound messages ---------------------------------------------------

    async def _is_addressed(self, msg: IncomingMessage) -> bool:
        if msg.mentions_me:
            return True
        # In a thread this bot owns, you can just reply without @mentioning it,
        # as long as you are not addressing another bot.
        if msg.thread_id and not msg.mentions_other_bot:
            owner = await self.store.session_owning_thread(msg.thread_id)
            return owner is not None and owner.role == msg.bot_role
        return False

    async def handle_message(self, msg: IncomingMessage) -> int | None:
        """Turn an addressed message into a queued job. Returns the job id, if one was queued."""
        if msg.author_is_bot or msg.author_id not in self.settings.owner_ids:
            return None
        if not msg.channel_name.startswith(self.settings.project_channel_prefix):
            return None
        if not await self._is_addressed(msg):
            return None

        adapter = self.adapters[msg.platform]
        bot = self.bots[msg.bot_role]
        ws = self._workspace(msg.channel_id)
        await asyncio.to_thread(ws.ensure, msg.channel_name)
        await self.store.ensure_project(msg.channel_id, msg.channel_name, ws.root)

        thread_id = msg.thread_id or await adapter.open_thread(
            bot.role, msg.channel_id, f"{bot.display_name}: {msg.text[:60]}".strip(), from_message_id=msg.message_id
        )
        session = await self.store.get_or_create_session(bot.role, msg.channel_id, thread_id)
        saved, skipped = await self._save_attachments(ws, msg)
        job_id = await self.store.record_event_and_enqueue(
            f"{msg.message_id}:{bot.role}", session.session_key, msg.author_id,
            msg.text + describe(saved, skipped), [a.to_dict() for a in saved],
        )
        if job_id is not None:
            await adapter.acknowledge(msg)
        return job_id

    async def _save_attachments(self, ws: Workspace, msg: IncomingMessage) -> tuple[list[SavedAttachment], list[str]]:
        """Download your attachments into inbox/<message_id>/ and commit them.

        Saved before the job is queued, so the job never runs without its files.
        When two bots are mentioned, both save the same files to the same paths,
        which is harmless.
        """
        saved, skipped = [], []
        for f in msg.files:
            kind = kind_of(f.filename)
            if len(saved) >= MAX_ATTACHMENTS:
                skipped.append(f"{f.filename} (more than {MAX_ATTACHMENTS} files)")
            elif kind is None:
                skipped.append(f"{f.filename} (unsupported type)")
            elif f.size > MAX_ATTACHMENT_BYTES:
                skipped.append(f"{f.filename} (over {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB)")
            else:
                path = ws.inbox_path(msg.message_id, safe_name(f.filename))
                await f.fetch(path)
                saved.append(SavedAttachment(ws.relative(path), kind, f.size, f.filename))
        if saved:
            await asyncio.to_thread(ws.commit, f"Owner attached {len(saved)} file(s)", [a.path for a in saved])
        return saved, skipped

    # -- worker ---------------------------------------------------------------

    async def run_worker(self) -> None:
        for adapter in self.adapters.values():
            await adapter.wait_ready()
        slots = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
        log.info("worker started")
        while True:
            await slots.acquire()
            job = await self.store.claim_next_job()
            if job is None:
                slots.release()
                await asyncio.sleep(self.settings.worker_poll_seconds)
                continue
            asyncio.create_task(self._run_job_guarded(job, slots))

    async def _run_job_guarded(self, job: Job, slots: asyncio.Semaphore | None = None) -> None:
        try:
            await self.run_job(job)
        except Exception as e:
            log.exception("job %s failed", job.job_id)
            retry = await self.store.fail_job(job.job_id, f"{type(e).__name__}: {e}")
            if not retry:
                await self._post_failure(job, e)
        finally:
            if slots:
                slots.release()

    async def run_job(self, job: Job) -> None:
        session = await self.store.get_session(job.session_key)
        event = await self.store.get_event(job.event_id)
        bot = self.bots[session.role]
        adapter = self.adapters[platform_of(session.channel_id)]

        deps = agent_mod.RunDeps(
            bot=bot,
            workspace=self._workspace(session.channel_id),
            store=self.store,
            session=session,
            job_id=job.job_id,
            project_name=await self.store.project_name(session.channel_id) or session.channel_id,
        )
        history = agent_mod.decode_history(await self.store.load_history(session.session_key))
        saved = [SavedAttachment(**a) for a in event.attachments]
        prompt = build_prompt(event.content, saved, deps.workspace.root, bot.multimodal)
        async with adapter.typing(bot.role, session.thread_id):
            outcome = await agent_mod.run_bot(deps, prompt, history, model=self.model_override)

        # Posting happens before the job is marked done, so a crash right here
        # can repeat a reply on retry. Accepted for the MVP; the history and
        # the handoff rows stay consistent either way.
        for part in chunk(outcome.reply, adapter.max_message_len):
            await adapter.post(bot.role, session.thread_id, part)
        for handoff in await self.store.pending_handoffs_for_job(job.job_id):
            await self._post_approval(adapter, handoff)

        await self.store.complete_job_with_history(job.job_id, session.session_key, outcome.new_messages_json)
        self._log_run(job, bot, outcome)

    def _log_run(self, job: Job, bot: BotDefinition, outcome: agent_mod.RunOutcome) -> None:
        record = {
            "ts": time.time(), "job_id": job.job_id, "session": job.session_key, "role": bot.role,
            "model": bot.model, "attempt": job.attempts, "requests": outcome.requests,
            "input_tokens": outcome.input_tokens, "output_tokens": outcome.output_tokens,
            "duration_s": round(outcome.duration_s, 2),
        }
        log.info("run %s", json.dumps(record))
        self.settings.transcripts_dir.mkdir(parents=True, exist_ok=True)
        path = self.settings.transcripts_dir / f"job-{job.job_id}-attempt-{job.attempts}.json"
        path.write_bytes(outcome.new_messages_json)

    async def _post_failure(self, job: Job, error: Exception) -> None:
        try:
            session = await self.store.get_session(job.session_key)
            adapter = self.adapters[platform_of(session.channel_id)]
            await adapter.post(session.role, session.thread_id,
                               f"I couldn't finish this after {job.attempts} attempts "
                               f"({type(error).__name__}). Send the request again when you're ready.")
        except Exception:
            log.exception("could not report failure of job %s", job.job_id)

    # -- approvals ------------------------------------------------------------

    async def _post_approval(self, adapter: ChatAdapter, handoff: Handoff) -> None:
        ws = self._workspace(handoff.channel_id)
        target = "final review" if handoff.to_role == "human" else self.bots[handoff.to_role].display_name
        files = []
        for rel in handoff.files:
            path = ws.resolve(rel)
            if path.stat().st_size <= MAX_REVIEW_FILE_BYTES and len(files) < MAX_REVIEW_FILES:
                files.append(OutgoingFile(path, path.name))
        text = (f"**Handoff #{handoff.handoff_id}: {self.bots[handoff.from_role].display_name} → {target}**\n"
                f"{handoff.summary}\n"
                f"Files: {', '.join(f'`{f}`' for f in handoff.files)} at `{handoff.commit_sha[:8]}`")
        message_id = await adapter.post(handoff.from_role, handoff.thread_id, text, files=files,
                                        buttons=approval_buttons(handoff.handoff_id))
        await self.store.set_handoff_message(handoff.handoff_id, message_id)

    async def handle_button(self, press: ButtonPress) -> Decision:
        """Apply a button press. The adapter shows decision.message where the buttons were."""
        handoff_id = int(press.value)
        if press.action == "approve":
            decision = await self.orchestrator.approve(handoff_id, press.user_id)
        elif press.action == "changes":
            decision = await self.orchestrator.request_changes(handoff_id, press.user_id, press.note)
        elif press.action == "reject":
            decision = await self.orchestrator.reject(handoff_id, press.user_id)
        else:
            return Decision(False, f"Unknown action {press.action!r}.")
        if decision.ok and decision.start_role:
            await self._start_next_bot(press.platform, decision)
        return decision

    async def _start_next_bot(self, platform: str, decision: Decision) -> None:
        handoff = decision.handoff
        bot = self.bots[decision.start_role]
        adapter = self.adapters[platform]
        owner = self._owner_on(platform)
        thread_id = await adapter.open_thread(bot.role, handoff.channel_id, f"{bot.display_name}: {handoff.summary}")
        await adapter.post(bot.role, thread_id,
                           f"{adapter.mention(owner)} picking up handoff #{handoff.handoff_id}.")
        await self.orchestrator.start_next(handoff, thread_id, owner)

    # -- lifecycle -------------------------------------------------------------

    async def run(self) -> None:
        await asyncio.gather(*(a.run(self) for a in self.adapters.values()), self.run_worker())
