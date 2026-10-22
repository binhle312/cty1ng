"""Agent loop tests with a scripted model: no network, no API key.

FunctionModel plays the LLM. Each test scripts the tool calls a real model
might make, and checks what the tools let through.
"""

from __future__ import annotations

import pytest
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel

from rolebots import agent as agent_mod
from rolebots.workspace import Workspace

from .conftest import CH_A, CH_B, OWNER


def scripted(*calls: ToolCallPart, final: str = "Done."):
    """A model that makes the given tool calls one per turn, then replies with `final`.

    It also records every tool result so tests can assert on what the tool returned.
    """
    results: list[str] = []
    plan = list(calls)

    def fn(messages, info):
        for part in messages[-1].parts:
            if isinstance(part, ToolReturnPart):
                results.append(str(part.content))
        if plan:
            return ModelResponse(parts=[plan.pop(0)])
        return ModelResponse(parts=[TextPart(final)])

    return FunctionModel(fn), results


@pytest.fixture
async def deps(tmp_path, store, bots):
    ws_a = Workspace.for_channel(tmp_path / "ws", CH_A)
    ws_b = Workspace.for_channel(tmp_path / "ws", CH_B)
    ws_a.ensure("project-a")
    ws_b.ensure("project-b")
    ws_b.write_text("docs/secret.md", "project b only", ["docs/"])
    session = await store.get_or_create_session("ba", CH_A, "discord:1000")
    job = await store.record_event_and_enqueue("m1:ba", session.session_key, OWNER, "write stories")
    return agent_mod.RunDeps(bot=bots["ba"], workspace=ws_a, store=store, session=session,
                             job_id=job, project_name="project-a")


async def test_ba_writes_stories_and_proposes_handoff(deps):
    model, results = scripted(
        ToolCallPart("load_skill", {"name": "write-user-stories"}),
        ToolCallPart("write_file", {"path": "docs/stories.md", "content": "# Login\n\n### S1. Sign in"}),
        ToolCallPart("propose_handoff", {"to": "designer", "files": ["docs/stories.md"],
                                         "summary": "Login stories"}),
        final="Stories are ready for review.",
    )
    outcome = await agent_mod.run_bot(deps, "write the login stories", [], model=model)

    assert outcome.reply == "Stories are ready for review."
    assert "Acceptance criteria" in results[0]
    assert results[1].startswith("Wrote docs/stories.md")
    assert results[2].startswith("Handoff #")
    [handoff] = await deps.store.pending_handoffs_for_job(deps.job_id)
    assert handoff.to_role == "designer"
    assert handoff.commit_sha == deps.workspace.head()


async def test_ba_cannot_read_another_project_or_write_outside_scope(deps):
    model, results = scripted(
        ToolCallPart("read_file", {"path": "../discord-200/docs/secret.md"}),
        ToolCallPart("write_file", {"path": "design/home.html", "content": "<html>"}),
        ToolCallPart("propose_handoff", {"to": "frontend", "files": ["docs/stories.md"], "summary": "x"}),
    )
    await agent_mod.run_bot(deps, "try things", [], model=model)
    assert "outside this project's workspace" in results[0]
    assert "outside your write scope" in results[1]
    assert "you can hand off to" in results[2]
    assert not (deps.workspace.root / "design" / "home.html").exists()
    assert await deps.store.pending_handoffs_for_job(deps.job_id) == []


async def test_history_round_trips_between_runs(deps):
    model, _ = scripted(final="First answer.")
    first = await agent_mod.run_bot(deps, "hello", [], model=model)
    history = agent_mod.decode_history([first.new_messages_json])

    seen = {}

    def fn(messages, info):
        seen["count"] = len(messages)
        return ModelResponse(parts=[TextPart("Second answer.")])

    await agent_mod.run_bot(deps, "and again", history, model=FunctionModel(fn))
    assert seen["count"] == 3  # first request, first response, new request


async def test_persona_and_skills_reach_the_model(deps):
    captured = {}

    def fn(messages, info):
        captured["instructions"] = messages[-1].instructions
        return ModelResponse(parts=[TextPart("ok")])

    await agent_mod.run_bot(deps, "hi", [], model=FunctionModel(fn))
    text = captured["instructions"]
    assert "Business Analyst" in text
    assert "write-user-stories" in text
    assert "#project-a" in text
    assert "docs/, memory/ba.md" in text
