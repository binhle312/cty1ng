"""End-to-end behaviour through a fake chat platform: routing, threads, replies, approvals.

FakeChat implements the same ChatAdapter interface as the Discord adapter, so
these tests cover everything above the platform layer without a network.
"""

from __future__ import annotations

import itertools
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel

from rolebots.chat import ButtonPress, IncomingFile, IncomingMessage
from rolebots.config import Settings
from rolebots.service import RoleBotsService

from .conftest import CH_A, OWNER

ROOT = Path(__file__).resolve().parents[1]


class FakeChat:
    platform = "fake"
    max_message_len = 200

    def __init__(self):
        self.ids = itertools.count(1)
        self.threads: list[tuple[str, str, str]] = []  # (role, channel, title)
        self.posts: list[dict] = []
        self.acks: list[str] = []

    async def run(self, service):  # pragma: no cover - not used in tests
        pass

    async def wait_ready(self):
        pass

    async def open_thread(self, role, channel_id, title, from_message_id=None):
        self.threads.append((role, channel_id, title))
        return f"fake:t{next(self.ids)}"

    async def post(self, role, thread_id, text, files=None, buttons=None):
        self.posts.append({"role": role, "thread": thread_id, "text": text,
                           "files": [f.filename for f in files or []], "buttons": buttons or []})
        return f"fake:m{next(self.ids)}"

    async def acknowledge(self, message):
        self.acks.append(message.message_id)

    @asynccontextmanager
    async def typing(self, role, thread_id):
        yield

    def mention(self, user_id):
        return f"@{user_id}"


FAKE_OWNER = "fake:owner"


def msg(text, *, role="ba", mid="fake:1", thread=None, author=FAKE_OWNER, me=True, other=False,
        channel="fake:100", name="project-a", files=None):
    return IncomingMessage("fake", role, mid, channel, name, thread, author, False, text, me, other, files or [])


class ScriptedModel:
    """Per-run scripts: each run pops the next list of tool calls, then replies with text."""

    def __init__(self):
        self.runs: list[tuple[list[ToolCallPart], str]] = []
        self.tool_results: list[str] = []

    def add_run(self, *calls, reply="ok"):
        self.runs.append((list(calls), reply))

    def model(self):
        current: dict = {}

        def fn(messages, info):
            last = messages[-1]
            for part in last.parts:
                if isinstance(part, ToolReturnPart):
                    self.tool_results.append(str(part.content))
            if not any(isinstance(p, ToolReturnPart) for p in last.parts):
                current["plan"], current["reply"] = self.runs.pop(0)
            if current["plan"]:
                return ModelResponse(parts=[current["plan"].pop(0)])
            return ModelResponse(parts=[TextPart(current["reply"])])

        return FunctionModel(fn)


@pytest.fixture
def chat():
    return FakeChat()


@pytest.fixture
def script():
    return ScriptedModel()


@pytest.fixture
def service(tmp_path, store, bots, chat, script):
    settings = Settings(owner_ids={FAKE_OWNER, OWNER}, project_channel_prefix="project-", data_dir=tmp_path,
                        bots_dir=ROOT / "bots", job_lease_seconds=60, job_max_attempts=3, worker_poll_seconds=0.01)
    return RoleBotsService(settings, store, bots, {"fake": chat}, model_override=script.model())


async def drain(service):
    """Run queued jobs until none are left, like the worker loop does."""
    while (job := await service.store.claim_next_job()) is not None:
        await service._run_job_guarded(job)


async def test_mention_opens_a_thread_and_the_bot_replies_there(service, chat, script):
    script.add_run(reply="Hi! Who are the users?")
    assert await service.handle_message(msg("@BA I need a login page")) is not None
    assert chat.threads == [("ba", "fake:100", "BA: @BA I need a login page")]
    assert chat.acks == ["fake:1"]

    await drain(service)
    [post] = chat.posts
    assert post == {"role": "ba", "thread": "fake:t1", "text": "Hi! Who are the users?", "files": [],
                    "buttons": []}


async def test_reply_in_own_thread_needs_no_mention(service, chat, script):
    script.add_run(reply="q1")
    script.add_run(reply="thanks")
    await service.handle_message(msg("start"))
    await drain(service)
    # Your answer in the BA's thread, without @BA, still reaches the BA...
    assert await service.handle_message(msg("admins only", mid="fake:2", thread="fake:t1", me=False)) is not None
    # ...but the Designer's connection sees the same message and ignores it.
    assert await service.handle_message(msg("admins only", role="designer", mid="fake:2", thread="fake:t1",
                                            me=False)) is None
    await drain(service)
    assert [p["text"] for p in chat.posts] == ["q1", "thanks"]


async def test_ignored_messages(service, chat):
    assert await service.handle_message(msg("hi", author="fake:stranger")) is None  # not the owner
    assert await service.handle_message(msg("hi", name="general")) is None  # not a project channel
    assert await service.handle_message(msg("hi", me=False)) is None  # not addressed
    assert chat.threads == [] and chat.acks == []


async def test_redelivered_message_runs_once(service, chat, script):
    script.add_run(reply="once")
    await service.handle_message(msg("hello"))
    assert await service.handle_message(msg("hello", thread="fake:t1")) is None
    await drain(service)
    assert len(chat.posts) == 1


async def test_long_reply_is_split_for_the_platform(service, chat, script):
    script.add_run(reply="\n".join("x" * 50 for _ in range(10)))
    await service.handle_message(msg("go"))
    await drain(service)
    assert len(chat.posts) > 1 and all(len(p["text"]) <= chat.max_message_len for p in chat.posts)


async def test_attachment_is_saved_and_listed(service, chat, script):
    async def fetch(path):
        path.write_text("# Existing PRD")

    script.add_run(ToolCallPart("read_file", {"path": "inbox/fake-1/prd.md"}), reply="read it")
    await service.handle_message(msg("see attached", files=[IncomingFile("prd.md", 14, fetch)]))
    event = await service.store.get_event("fake:1:ba")
    assert "inbox/fake-1/prd.md" in event.content
    await drain(service)
    assert script.tool_results == ["# Existing PRD"]


async def test_full_handoff_from_ba_to_designer(service, chat, script):
    script.add_run(
        ToolCallPart("write_file", {"path": "docs/stories.md", "content": "# Login\n### S1"}),
        ToolCallPart("propose_handoff", {"to": "designer", "files": ["docs/stories.md"], "summary": "Login stories"}),
        reply="Stories ready.",
    )
    script.add_run(reply="HTML prototypes (default) or a Markdown spec?")
    await service.handle_message(msg("@BA write the stories"))
    await drain(service)

    approval = chat.posts[-1]
    assert approval["files"] == ["stories.md"]
    assert [b.action for b in approval["buttons"]] == ["approve", "changes", "reject"]
    handoff_id = approval["buttons"][0].value

    stranger = await service.handle_button(ButtonPress("fake", "ba", "fake:stranger", "approve", handoff_id))
    assert not stranger.ok

    decision = await service.handle_button(ButtonPress("fake", "ba", FAKE_OWNER, "approve", handoff_id))
    assert decision.ok and decision.start_role == "designer"
    assert chat.threads[-1] == ("designer", CH_A.replace("discord", "fake"), "Designer: Login stories")
    assert chat.posts[-1]["text"] == f"@{FAKE_OWNER} picking up handoff #{handoff_id}."
    designer_thread = chat.posts[-1]["thread"]

    await drain(service)
    assert chat.posts[-1] == {"role": "designer", "thread": designer_thread,
                              "text": "HTML prototypes (default) or a Markdown spec?", "files": [], "buttons": []}


async def test_request_changes_sends_the_note_back_to_the_ba(service, chat, script):
    script.add_run(
        ToolCallPart("write_file", {"path": "docs/stories.md", "content": "v1"}),
        ToolCallPart("propose_handoff", {"to": "designer", "files": ["docs/stories.md"], "summary": "v1"}),
    )
    script.add_run(reply="Revising.")
    await service.handle_message(msg("@BA write"))
    await drain(service)
    handoff_id = chat.posts[-1]["buttons"][0].value

    d = await service.handle_button(ButtonPress("fake", "ba", FAKE_OWNER, "changes", handoff_id,
                                                note="Add password reset"))
    assert d.ok
    job = await service.store.claim_next_job()
    event = await service.store.get_event(job.event_id)
    assert "Add password reset" in event.content
    session = await service.store.get_session(job.session_key)
    assert (session.role, session.thread_id) == ("ba", "fake:t1")
