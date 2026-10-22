import pytest

from rolebots.orchestrator import Orchestrator
from rolebots.workspace import Workspace

from .conftest import OWNER

CHANNEL, THREAD = "discord:100", "discord:1000"


@pytest.fixture
async def setup(tmp_path, store, bots):
    ws = Workspace.for_channel(tmp_path / "ws", CHANNEL)
    ws.ensure("project-a")
    ws.write_text("docs/stories.md", "# Stories", ["docs/"])
    sha = ws.commit("BA: stories", ["docs/stories.md"])
    hid = await store.create_handoff(channel_id=CHANNEL, thread_id=THREAD, from_role="ba", to_role="designer",
                                     files=["docs/stories.md"], summary="Login stories", commit_sha=sha,
                                     created_by_job=None)
    orch = Orchestrator(store, bots, tmp_path / "ws", {OWNER})
    return orch, ws, hid


async def test_only_owner_can_decide(setup):
    orch, _, hid = setup
    d = await orch.approve(hid, user_id="discord:999")
    assert not d.ok and "owner" in d.message
    assert (await orch.store.get_handoff(hid)).status == "pending"


async def test_approve_starts_next_role_once(setup):
    orch, _, hid = setup
    d = await orch.approve(hid, OWNER)
    assert d.ok and d.start_role == "designer"

    again = await orch.approve(hid, OWNER)  # double click
    assert not again.ok and "already approved" in again.message

    job = await orch.start_next(d.handoff, "discord:2000", OWNER)
    assert job is not None
    assert await orch.start_next(d.handoff, "discord:2000", OWNER) is None  # idempotent

    claimed = await orch.store.claim_next_job()
    session = await orch.store.get_session(claimed.session_key)
    event = await orch.store.get_event(claimed.event_id)
    assert (session.role, session.channel_id, session.thread_id) == ("designer", CHANNEL, "discord:2000")
    assert "docs/stories.md" in event.content


async def test_edit_after_proposal_makes_approval_stale(setup):
    orch, ws, hid = setup
    ws.write_text("docs/stories.md", "# Stories, edited later", ["docs/"])
    d = await orch.approve(hid, OWNER)
    assert not d.ok and "stale" in d.message
    assert (await orch.store.get_handoff(hid)).status == "stale"


async def test_request_changes_goes_back_to_the_same_bot_and_thread(setup):
    orch, _, hid = setup
    d = await orch.request_changes(hid, OWNER, "Add a forgot-password story")
    assert d.ok
    job = await orch.store.claim_next_job()
    session = await orch.store.get_session(job.session_key)
    event = await orch.store.get_event(job.event_id)
    assert (session.role, session.thread_id) == ("ba", THREAD)
    assert "forgot-password" in event.content


async def test_reject_passes_nothing_on(setup):
    orch, _, hid = setup
    assert (await orch.reject(hid, OWNER)).ok
    assert await orch.store.claim_next_job() is None
