"""The agent loop every bot runs, on whichever model its bot.yaml names.

There is one Agent definition. What makes the BA differ from the Designer is
the per-run context (RunDeps): its persona, skills, write scope and handoff
targets. The model is passed per run, so switching provider is a one-line
change in bot.yaml.

Tools are ours, not a framework's, so the isolation rules live in code:
every file tool goes through Workspace, which only sees one channel.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import BinaryContent, ModelMessage, ModelMessagesTypeAdapter, UserContent
from pydantic_ai.models import Model
from pydantic_ai.usage import UsageLimits

from .attachments import kind_of, media_type, strip_binary
from .botdef import BotDefinition
from .db import Session, Store
from .workspace import PathError, Workspace

HANDOFF_DAILY_LIMIT = 5  # per project channel; a runaway loop stops here and asks you


@dataclass
class RunDeps:
    bot: BotDefinition
    workspace: Workspace
    store: Store
    session: Session
    job_id: int
    project_name: str
    proposed_handoffs: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class RunOutcome:
    reply: str
    new_messages_json: bytes
    input_tokens: int
    output_tokens: int
    requests: int
    duration_s: float


agent: Agent[RunDeps, str] = Agent(deps_type=RunDeps, name="rolebot")


@agent.instructions
def _instructions(ctx: RunContext[RunDeps]) -> str:
    d = ctx.deps
    skills = "\n".join(f"- {s.name}: {s.description}" for s in d.bot.skills.values()) or "- (none)"
    targets = ", ".join(d.bot.handoff_to) or "nobody"
    return f"""{d.bot.persona.strip()}

## Where you are
You are the {d.bot.display_name} bot in the project channel #{d.project_name} of a team chat.
You are talking with the project owner in a chat thread. Keep replies short and conversational;
chat shows at most a few screens of text, so put long content in files and summarise.

## Your workspace
This project has its own folder. Tools: list_files, read_file, write_file, view_file.
Files the owner attaches in chat are saved under inbox/ (read-only); read text files with
read_file and look at images and PDFs with view_file.
Paths are relative to the project folder (for example docs/stories.md).
You may write only to: {", ".join(d.bot.all_write_paths)}. Everything else is read-only to you.
Other projects do not exist as far as you can tell; never ask about or refer to them.
Keep durable notes about this project (decisions, the owner's answers, open questions)
in memory/{d.bot.role}.md, and read it at the start of a new task.

## Skills
Call load_skill(name) to get the full playbook before doing the matching kind of work:
{skills}

## Handing off
When a piece of work is ready for review, call propose_handoff with the files and a one-line
summary. You may hand off to: {targets}. The owner approves or requests changes with buttons;
never claim work was approved, and never start another role's work yourself."""


def _workspace_error(e: Exception) -> str:
    return f"Error: {e}"


@agent.tool
async def list_files(ctx: RunContext[RunDeps], path: str = ".") -> str:
    """List files in the project workspace, optionally under a sub-folder."""
    try:
        files = ctx.deps.workspace.list_files(path)
    except PathError as e:
        return _workspace_error(e)
    return "\n".join(files) or "(no files)"


@agent.tool
async def read_file(ctx: RunContext[RunDeps], path: str) -> str:
    """Read a text file from the project workspace."""
    if kind_of(path) in ("image", "pdf"):
        return f"Error: {path!r} is not a text file; use view_file to look at it"
    try:
        return ctx.deps.workspace.read_text(path)
    except PathError as e:
        return _workspace_error(e)


@agent.tool
async def write_file(ctx: RunContext[RunDeps], path: str, content: str) -> str:
    """Create or overwrite a text file in the project workspace (within your write scope)."""
    try:
        rel = ctx.deps.workspace.write_text(path, content, ctx.deps.bot.all_write_paths)
    except PathError as e:
        return _workspace_error(e)
    return f"Wrote {rel} ({len(content)} characters)"


@agent.tool
async def view_file(ctx: RunContext[RunDeps], path: str) -> BinaryContent | str:
    """Look at an image (PNG, JPEG, WebP, GIF) or PDF in the project workspace."""
    if kind_of(path) not in ("image", "pdf"):
        return f"Error: view_file is for images and PDFs; use read_file for {path!r}"
    if not ctx.deps.bot.multimodal:
        return "Error: your current model cannot view images or PDFs; ask the owner to describe the file"
    try:
        target = ctx.deps.workspace.resolve(path)
    except PathError as e:
        return _workspace_error(e)
    if not target.is_file():
        return f"Error: {path!r} does not exist"
    return BinaryContent(data=target.read_bytes(), media_type=media_type(path), identifier=path)


@agent.tool
async def load_skill(ctx: RunContext[RunDeps], name: str) -> str:
    """Load the full instructions of one of your skills by name."""
    skill = ctx.deps.bot.skills.get(name)
    if skill is None:
        return f"Error: unknown skill {name!r}. Available: {', '.join(ctx.deps.bot.skills) or 'none'}"
    return skill.body()


@agent.tool
async def propose_handoff(ctx: RunContext[RunDeps], to: str, files: list[str], summary: str) -> str:
    """Ask the owner to approve these files and pass them to the next role.

    Args:
        to: the role to hand off to, or "human" when the work is final.
        files: workspace-relative paths of the files to review.
        summary: one line saying what is ready.
    """
    d = ctx.deps
    if to not in d.bot.handoff_to:
        return f"Error: you can hand off to {d.bot.handoff_to}, not {to!r}"
    if not files:
        return "Error: list at least one file for the owner to review"
    try:
        for f in files:
            if not d.workspace.resolve(f).is_file():
                return f"Error: {f!r} does not exist; write it first"
    except PathError as e:
        return _workspace_error(e)

    since = time.time() - 24 * 3600
    if await d.store.handoffs_since(d.session.channel_id, since) >= HANDOFF_DAILY_LIMIT:
        return (f"Error: this project already has {HANDOFF_DAILY_LIMIT} handoffs in the last 24 hours. "
                "Tell the owner and wait for their instruction.")

    sha = await asyncio.to_thread(
        d.workspace.commit, f"{d.bot.display_name}: {summary}", files
    )
    handoff_id = await d.store.create_handoff(
        channel_id=d.session.channel_id,
        thread_id=d.session.thread_id,
        from_role=d.bot.role,
        to_role=to,
        files=files,
        summary=summary,
        commit_sha=sha,
        created_by_job=d.job_id,
    )
    d.proposed_handoffs.append(handoff_id)
    return (f"Handoff #{handoff_id} proposed at commit {sha[:8]}. Approval buttons will appear "
            "under your reply. Tell the owner briefly what to review.")


def decode_history(blobs: list[bytes]) -> list[ModelMessage]:
    messages: list[ModelMessage] = []
    for blob in blobs:
        messages.extend(ModelMessagesTypeAdapter.validate_json(blob))
    return messages


async def run_bot(deps: RunDeps, prompt: str | list[UserContent], history: list[ModelMessage],
                  model: Model | str | None = None) -> RunOutcome:
    """Run one agent turn: the prompt plus prior history in, a reply and new messages out."""
    started = time.monotonic()
    result = await agent.run(
        prompt,
        deps=deps,
        model=model or deps.bot.model,
        message_history=history,
        usage_limits=UsageLimits(request_limit=deps.bot.request_limit),
    )
    usage = result.usage
    reply = result.output.strip()
    if len(reply) > deps.bot.max_reply_chars:
        reply = reply[: deps.bot.max_reply_chars] + "\n\n(reply truncated; the full text is in the files)"
    return RunOutcome(
        reply=reply,
        # Images and PDFs are replaced by a placeholder before storing, so later
        # turns don't resend (and pay for) them; view_file brings one back on demand.
        new_messages_json=ModelMessagesTypeAdapter.dump_json(strip_binary(result.new_messages())),
        input_tokens=usage.input_tokens or 0,
        output_tokens=usage.output_tokens or 0,
        requests=usage.requests,
        duration_s=time.monotonic() - started,
    )
