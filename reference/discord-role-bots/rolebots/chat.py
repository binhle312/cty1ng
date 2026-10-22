"""The boundary between the bots and a chat platform (Discord today, Slack later).

The service only speaks these neutral types. An adapter translates a platform's
events into IncomingMessage / ButtonPress and implements ChatAdapter for output.

Ids are strings qualified by platform ("discord:1234", later "slack:C0ABC"),
so state from two platforms can never collide in the database or on disk.

What every adapter must provide, and why the design needs it:
  * one identity per bot role   -> you @mention the BA, not "the bot"
  * threads under a channel     -> one task per thread, history keyed by thread
  * buttons, one with a note    -> Approve / Request changes / Reject
  * file attachments both ways  -> inbox/ in, files under review out
Discord and Slack both have all four.
"""

from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Awaitable, Callable, Literal, Protocol

if TYPE_CHECKING:
    from .service import RoleBotsService


@dataclass(frozen=True)
class IncomingFile:
    filename: str
    size: int
    fetch: Callable[[Path], Awaitable[None]]  # download the bytes to this path


@dataclass(frozen=True)
class IncomingMessage:
    platform: str
    bot_role: str            # the bot whose connection received this message
    message_id: str
    channel_id: str          # the project channel (the thread's parent when in a thread)
    channel_name: str
    thread_id: str | None    # None when posted in the channel itself
    author_id: str
    author_is_bot: bool
    text: str                # with this bot's own mention removed
    mentions_me: bool
    mentions_other_bot: bool
    files: list[IncomingFile] = field(default_factory=list)


@dataclass(frozen=True)
class Button:
    action: str              # "approve" | "changes" | "reject"
    label: str
    value: str               # opaque to the adapter; the handoff id here
    style: Literal["primary", "secondary", "danger"] = "secondary"
    needs_note: bool = False  # the adapter collects a short text (modal) before reporting the press


@dataclass(frozen=True)
class ButtonPress:
    platform: str
    bot_role: str
    user_id: str
    action: str
    value: str
    note: str = ""


@dataclass(frozen=True)
class OutgoingFile:
    path: Path
    filename: str


class ChatAdapter(Protocol):
    platform: str
    max_message_len: int

    async def run(self, service: "RoleBotsService") -> None:
        """Connect every bot and deliver events to the service until stopped."""

    async def wait_ready(self) -> None: ...

    async def open_thread(self, role: str, channel_id: str, title: str,
                          from_message_id: str | None = None) -> str:
        """Create a thread as this bot and return its id."""

    async def post(self, role: str, thread_id: str, text: str,
                   files: list[OutgoingFile] | None = None, buttons: list[Button] | None = None) -> str:
        """Post a message as this bot and return its id."""

    async def acknowledge(self, message: IncomingMessage) -> None:
        """Show that the order was received (a reaction)."""

    def typing(self, role: str, thread_id: str) -> AbstractAsyncContextManager:
        """Indicate the bot is working, where the platform supports it."""

    def mention(self, user_id: str) -> str:
        """How to @mention a user in a message on this platform."""


def chunk(text: str, size: int) -> list[str]:
    """Split a reply into platform-sized messages, preferring line breaks."""
    parts, rest = [], text or "(no reply)"
    while len(rest) > size:
        cut = rest.rfind("\n", 0, size)
        cut = cut if cut > size // 2 else size
        parts.append(rest[:cut])
        rest = rest[cut:].lstrip("\n")
    parts.append(rest)
    return parts


def platform_of(qualified_id: str) -> str:
    return qualified_id.split(":", 1)[0]


def local_id(qualified_id: str) -> str:
    return qualified_id.split(":", 1)[1]
