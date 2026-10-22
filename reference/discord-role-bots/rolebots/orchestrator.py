"""Handoff decisions: approve, request changes, reject.

Kept free of chat-platform types so it can be tested directly. The service
calls these methods from button presses and turns the Decision into messages.

The rules that matter:
  * Only the owner can decide.
  * A decision applies only while the handoff is pending (double clicks are no-ops).
  * An approval covers one commit; if the files changed since, the handoff is stale.
  * Bots never wake each other. Only an approval here starts the next role.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

from .botdef import BotDefinition
from .db import Handoff, Store
from .workspace import Workspace


@dataclass(frozen=True)
class Decision:
    ok: bool
    message: str  # what to show on the approval message
    handoff: Handoff | None = None
    start_role: str | None = None  # set when an approved handoff should start the next bot


class Orchestrator:
    def __init__(self, store: Store, bots: dict[str, BotDefinition], workspaces_dir: Path,
                 owner_ids: set[str]):
        self.store = store
        self.bots = bots
        self.workspaces_dir = workspaces_dir
        self.owner_ids = owner_ids  # platform-qualified, one per platform

    def workspace(self, channel_id: str) -> Workspace:
        return Workspace.for_channel(self.workspaces_dir, channel_id)

    async def _load(self, handoff_id: int, user_id: str) -> tuple[Handoff | None, Decision | None]:
        if user_id not in self.owner_ids:
            return None, Decision(False, "Only the project owner can decide on handoffs.")
        handoff = await self.store.get_handoff(handoff_id)
        if handoff is None:
            return None, Decision(False, f"Handoff #{handoff_id} does not exist.")
        if handoff.status != "pending":
            return handoff, Decision(False, f"Handoff #{handoff_id} is already {handoff.status}.", handoff)
        return handoff, None

    async def approve(self, handoff_id: int, user_id: str) -> Decision:
        handoff, refusal = await self._load(handoff_id, user_id)
        if refusal:
            return refusal
        ws = self.workspace(handoff.channel_id)
        if await asyncio.to_thread(ws.changed_since, handoff.commit_sha, handoff.files):
            await self.store.decide_handoff(handoff_id, "stale")
            return Decision(False, f"Handoff #{handoff_id} is stale: the files changed after "
                                   f"commit {handoff.commit_sha[:8]}. Ask the bot to propose it again.", handoff)
        if not await self.store.decide_handoff(handoff_id, "approved"):
            return Decision(False, f"Handoff #{handoff_id} was already decided.", handoff)
        if handoff.to_role == "human":
            return Decision(True, f"Approved at commit {handoff.commit_sha[:8]}. Final, no next bot.", handoff)
        return Decision(True, f"Approved at commit {handoff.commit_sha[:8]}. Passing to "
                              f"{self.bots[handoff.to_role].display_name}.", handoff, start_role=handoff.to_role)

    async def start_next(self, handoff: Handoff, thread_id: str, owner_id: str) -> int | None:
        """Queue the next bot's first job in its new thread. Safe to call twice."""
        role = handoff.to_role
        session = await self.store.get_or_create_session(role, handoff.channel_id, thread_id)
        files = "\n".join(f"- {f}" for f in handoff.files)
        prompt = (
            f"The owner approved handoff #{handoff.handoff_id} from the "
            f"{self.bots[handoff.from_role].display_name} at commit {handoff.commit_sha[:8]}.\n"
            f"Summary: {handoff.summary}\nFiles:\n{files}\n\n"
            "Read these files and your memory notes, then start your part of the work. "
            "Ask the owner anything you need to know before you begin."
        )
        return await self.store.record_event_and_enqueue(
            f"handoff:{handoff.handoff_id}", session.session_key, owner_id, prompt
        )

    async def request_changes(self, handoff_id: int, user_id: str, note: str) -> Decision:
        handoff, refusal = await self._load(handoff_id, user_id)
        if refusal:
            return refusal
        if not await self.store.decide_handoff(handoff_id, "changes_requested"):
            return Decision(False, f"Handoff #{handoff_id} was already decided.", handoff)
        session = await self.store.get_or_create_session(handoff.from_role, handoff.channel_id, handoff.thread_id)
        await self.store.record_event_and_enqueue(
            f"changes:{handoff_id}", session.session_key, user_id,
            f"The owner requested changes to handoff #{handoff_id} ({handoff.summary}):\n\n{note}\n\n"
            "Revise the files, then propose the handoff again.",
        )
        return Decision(True, "Changes requested. The bot is revising.", handoff)

    async def reject(self, handoff_id: int, user_id: str) -> Decision:
        handoff, refusal = await self._load(handoff_id, user_id)
        if refusal:
            return refusal
        if not await self.store.decide_handoff(handoff_id, "rejected"):
            return Decision(False, f"Handoff #{handoff_id} was already decided.", handoff)
        return Decision(True, "Rejected. Nothing was passed on.", handoff)
