from __future__ import annotations

import dataclasses

import pytest
from pydantic_ai.messages import BinaryContent, ModelResponse, TextPart, ToolCallPart, ToolReturnPart, UserPromptPart
from pydantic_ai.models.function import FunctionModel

from rolebots import agent as agent_mod
from rolebots.attachments import SavedAttachment, build_prompt, describe, kind_of, safe_name
from rolebots.workspace import PathError, Workspace

from .conftest import CH_A, OWNER

# A valid 1x1 PNG.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


def test_kinds_and_names():
    assert kind_of("Sketch.PNG") == "image"
    assert kind_of("prd.pdf") == "pdf"
    assert kind_of("notes.md") == "text"
    assert kind_of("setup.exe") is None
    assert safe_name("../../etc/passwd") == "passwd"
    assert safe_name("my sketch (1).png") == "my_sketch_1_.png"
    assert safe_name("...") == "file"


def test_describe_lists_saved_and_skipped():
    text = describe([SavedAttachment("inbox/1/a.png", "image", 2048, "a.png")], ["b.exe (unsupported type)"])
    assert "inbox/1/a.png (image, 2 KB; open with view_file)" in text
    assert "not saved: b.exe" in text


@pytest.fixture
def ws(tmp_path):
    w = Workspace.for_channel(tmp_path / "ws", CH_A)
    w.ensure("project-a")
    path = w.inbox_path("discord:555", "sketch.png")
    path.write_bytes(PNG)
    w.commit("Owner attached 1 file(s)", ["inbox/discord-555/sketch.png"])
    return w


def test_prompt_includes_image_only_for_multimodal_models(ws):
    saved = [SavedAttachment("inbox/discord-555/sketch.png", "image", len(PNG), "sketch.png")]
    parts = build_prompt("design this", saved, ws.root, multimodal=True)
    assert parts[0] == "design this"
    assert isinstance(parts[1], BinaryContent) and parts[1].media_type == "image/png"

    text = build_prompt("design this", saved, ws.root, multimodal=False)
    assert isinstance(text, str) and "cannot view images" in text


def test_inbox_is_read_only_for_bots(ws, bots):
    with pytest.raises(PathError):
        ws.write_text("inbox/discord-555/sketch.png", "x", bots["designer"].all_write_paths)


async def test_event_keeps_attachment_metadata(store):
    s = await store.get_or_create_session("designer", CH_A, "discord:1000")
    meta = [SavedAttachment("inbox/discord-555/sketch.png", "image", 70, "sketch.png").to_dict()]
    job = await store.record_event_and_enqueue("555:designer", s.session_key, OWNER, "hi", meta)
    claimed = await store.claim_next_job()
    event = await store.get_event(claimed.event_id)
    assert claimed.job_id == job and event.attachments == meta


@pytest.fixture
async def deps(ws, store, bots):
    session = await store.get_or_create_session("designer", CH_A, "discord:1000")
    job = await store.record_event_and_enqueue("555:designer", session.session_key, OWNER, "x")
    return agent_mod.RunDeps(bot=bots["designer"], workspace=ws, store=store, session=session,
                             job_id=job, project_name="project-a")


async def test_model_sees_image_then_history_stores_only_a_placeholder(deps):
    seen = {}
    plan = [ToolCallPart("view_file", {"path": "inbox/discord-555/sketch.png"}),
            ToolCallPart("read_file", {"path": "inbox/discord-555/sketch.png"})]

    def fn(messages, info):
        for part in messages[-1].parts:
            if isinstance(part, UserPromptPart) and not isinstance(part.content, str):
                seen.setdefault("prompt_binary", any(isinstance(c, BinaryContent) for c in part.content))
            if isinstance(part, ToolReturnPart):
                seen.setdefault("returns", []).append(part.content)
        if plan:
            return ModelResponse(parts=[plan.pop(0)])
        return ModelResponse(parts=[TextPart("Nice sketch.")])

    saved = [SavedAttachment("inbox/discord-555/sketch.png", "image", len(PNG), "sketch.png")]
    prompt = build_prompt("Here is my sketch", saved, deps.workspace.root, multimodal=True)
    outcome = await agent_mod.run_bot(deps, prompt, [], model=FunctionModel(fn))

    assert seen["prompt_binary"] is True
    assert any("not a text file" in str(r) for r in seen["returns"])  # read_file refuses images
    stored = outcome.new_messages_json.decode()
    assert "was shown here" in stored
    assert '"kind":"binary"' not in stored  # no image bytes kept in history


async def test_text_only_model_cannot_view_images(deps):
    deps.bot = dataclasses.replace(deps.bot, multimodal=False)
    results = []

    def fn(messages, info):
        for part in messages[-1].parts:
            if isinstance(part, ToolReturnPart):
                results.append(str(part.content))
        if not results:
            return ModelResponse(parts=[ToolCallPart("view_file", {"path": "inbox/discord-555/sketch.png"})])
        return ModelResponse(parts=[TextPart("ok")])

    await agent_mod.run_bot(deps, "look", [], model=FunctionModel(fn))
    assert "cannot view images" in results[0]
