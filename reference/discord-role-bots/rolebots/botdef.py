"""Bot definitions: one folder per role under bots/, versioned in git.

    bots/<role>/
      bot.yaml        model, write scope, handoff targets, limits, chat credentials per platform
      persona.md      who the bot is and how it works with you
      skills/<name>/SKILL.md   step-by-step playbooks, loaded on demand

Changing a role is a reviewed commit, never an edit to a live prompt.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    path: Path

    def body(self) -> str:
        return _split_frontmatter(self.path.read_text())[1].strip()


@dataclass(frozen=True)
class BotDefinition:
    role: str
    display_name: str
    folder: Path
    platforms: dict[str, dict[str, str]]  # platform -> {setting: ENV_VAR_NAME}, e.g. discord.token_env
    model: str  # "<provider>:<model name>", resolved by Pydantic AI
    persona: str
    skills: dict[str, Skill]
    write_paths: list[str]  # entries ending in "/" are folders, anything else one file
    handoff_to: list[str]  # other roles, or "human" for a final review
    request_limit: int = 30
    max_reply_chars: int = 6000
    multimodal: bool = False  # true if the model accepts images and PDFs

    def secret(self, platform: str, key: str) -> str:
        """Read a credential named in bot.yaml (platforms.<platform>.<key>) from the environment."""
        env_name = self.platforms.get(platform, {}).get(key)
        if not env_name:
            raise SystemExit(f"bots/{self.role}/bot.yaml has no platforms.{platform}.{key}")
        value = os.environ.get(env_name, "")
        if not value:
            raise SystemExit(f"{env_name} is not set ({platform} {key} for {self.role})")
        return value

    @property
    def all_write_paths(self) -> list[str]:
        # Every bot may also keep notes about the current project in memory/<role>.md.
        return [*self.write_paths, f"memory/{self.role}.md"]


def _split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    _, meta, body = text.split("---", 2)
    return yaml.safe_load(meta) or {}, body


def _load_skills(folder: Path) -> dict[str, Skill]:
    skills = {}
    skills_dir = folder / "skills"
    if not skills_dir.exists():
        return skills
    for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
        meta, _ = _split_frontmatter(skill_md.read_text())
        name = meta.get("name", skill_md.parent.name)
        if not meta.get("description"):
            raise ValueError(f"{skill_md} needs a description in its frontmatter")
        skills[name] = Skill(name=name, description=meta["description"].strip(), path=skill_md)
    return skills


def load_bot(folder: Path) -> BotDefinition:
    cfg = yaml.safe_load((folder / "bot.yaml").read_text())
    return BotDefinition(
        role=cfg["role"],
        display_name=cfg.get("display_name", cfg["role"]),
        folder=folder.resolve(),
        platforms={p: dict(v or {}) for p, v in (cfg.get("platforms") or {}).items()},
        model=cfg["model"],
        persona=(folder / "persona.md").read_text(),
        skills=_load_skills(folder),
        write_paths=list(cfg["write_paths"]),
        handoff_to=list(cfg.get("handoff_to", [])),
        request_limit=int(cfg.get("request_limit", 30)),
        max_reply_chars=int(cfg.get("max_reply_chars", 6000)),
        multimodal=bool(cfg.get("multimodal", False)),
    )


def load_all_bots(bots_dir: Path) -> dict[str, BotDefinition]:
    bots = {}
    for folder in sorted(bots_dir.iterdir()):
        if (folder / "bot.yaml").exists():
            bot = load_bot(folder)
            if bot.role in bots:
                raise ValueError(f"duplicate role {bot.role!r} in {bots_dir}")
            bots[bot.role] = bot
    for bot in bots.values():
        unknown = [r for r in bot.handoff_to if r not in bots and r != "human"]
        if unknown:
            raise ValueError(f"{bot.role} hands off to unknown roles: {unknown}")
    return bots
