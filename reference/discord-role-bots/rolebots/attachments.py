"""Files you attach to a message: saved into the project, shown to the bot.

Attachments land in the channel's workspace under inbox/<message_id>/ and are
committed, so they are versioned with the project and stay isolated per channel.
Bots can read inbox/ but never write to it.

Images and PDFs are passed to the model only in the run where you sent them,
and only for bots whose model accepts them (multimodal: true in bot.yaml).
Stored history keeps a text placeholder instead of the bytes; otherwise every
later turn would resend the image and pay for it again. A bot that needs
another look calls view_file.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path

from pydantic_ai.messages import BinaryContent, ModelMessage, ModelRequest, ToolReturnPart, UserPromptPart

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
MAX_ATTACHMENTS = 10

TEXT_SUFFIXES = {".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".html", ".htm", ".css", ".js", ".ts",
                 ".py", ".sql", ".xml", ".svg"}
IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
               ".gif": "image/gif"}
PDF_TYPE = "application/pdf"


@dataclass(frozen=True)
class SavedAttachment:
    path: str  # workspace-relative
    kind: str  # text | image | pdf
    size: int
    original_name: str

    def to_dict(self) -> dict:
        return asdict(self)


def kind_of(filename: str) -> str | None:
    suffix = Path(filename).suffix.lower()
    if suffix in TEXT_SUFFIXES:
        return "text"
    if suffix in IMAGE_TYPES:
        return "image"
    if suffix == ".pdf":
        return "pdf"
    return None


def media_type(path: str) -> str:
    suffix = Path(path).suffix.lower()
    return IMAGE_TYPES.get(suffix, PDF_TYPE)


def safe_name(name: str) -> str:
    """Chat filenames are user input; keep them boring and path-free."""
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).name).strip("._") or "file"
    return stem[:100]


def describe(saved: list[SavedAttachment], skipped: list[str]) -> str:
    if not saved and not skipped:
        return ""
    lines = ["", "Attached files (saved in the project workspace):"]
    for a in saved:
        how = {"text": "read_file", "image": "view_file", "pdf": "view_file"}[a.kind]
        lines.append(f"- {a.path} ({a.kind}, {a.size // 1024 or 1} KB; open with {how})")
    for s in skipped:
        lines.append(f"- not saved: {s}")
    return "\n".join(lines)


def build_prompt(text: str, saved: list[SavedAttachment], root: Path, multimodal: bool):
    """The user prompt for the run: text, plus image/PDF bytes when the model can take them."""
    if not multimodal:
        visual = [a for a in saved if a.kind != "text"]
        if visual:
            text += ("\n\nYour current model cannot view images or PDFs. If their content matters, "
                     "ask the owner to describe it or paste the text.")
        return text
    parts: list = [text]
    for a in saved:
        if a.kind in ("image", "pdf"):
            parts.append(BinaryContent(data=(root / a.path).read_bytes(), media_type=media_type(a.path),
                                       identifier=a.path))
    return parts if len(parts) > 1 else text


def _placeholder(item) -> str:
    return f"[{item.media_type} {item.identifier or ''} was shown here; call view_file to see it again]"


def strip_binary(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Replace image/PDF bytes in user prompts and tool results with a short note."""
    for msg in messages:
        if not isinstance(msg, ModelRequest):
            continue
        for part in msg.parts:
            if isinstance(part, UserPromptPart) and not isinstance(part.content, str):
                part.content = [_placeholder(c) if isinstance(c, BinaryContent) else c for c in part.content]
            elif isinstance(part, ToolReturnPart):
                if isinstance(part.content, BinaryContent):
                    part.content = _placeholder(part.content)
                elif isinstance(part.content, list):
                    part.content = [_placeholder(c) if isinstance(c, BinaryContent) else c for c in part.content]
    return messages
