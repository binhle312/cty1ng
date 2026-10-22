"""Entry point: `rolebots` (or `python -m rolebots.main`) from the project root."""

from __future__ import annotations

import asyncio
import logging

from .botdef import load_all_bots
from .chat import ChatAdapter, platform_of
from .config import Settings, load_settings
from .db import Store
from .service import RoleBotsService


def build_adapters(settings: Settings, bots) -> dict[str, ChatAdapter]:
    """One adapter per platform you have an owner id for (OWNER_DISCORD_ID, ...)."""
    adapters: dict[str, ChatAdapter] = {}
    for platform in sorted({platform_of(o) for o in settings.owner_ids}):
        if platform == "discord":
            from .adapters.discord_adapter import DiscordAdapter
            adapters[platform] = DiscordAdapter(bots)
        else:
            raise SystemExit(f"No adapter for platform {platform!r} yet")
        for bot in bots.values():
            bot.secret(platform, "token_env")  # fail fast on a missing token, before connecting
    return adapters


async def _amain() -> None:
    settings = load_settings()
    bots = load_all_bots(settings.bots_dir)
    adapters = build_adapters(settings, bots)
    store = await Store.open(settings.db_path, settings.job_lease_seconds, settings.job_max_attempts)
    logging.getLogger("rolebots").info(
        "platforms: %s; bots: %s", ", ".join(adapters), ", ".join(f"{b.role} ({b.model})" for b in bots.values())
    )
    try:
        await RoleBotsService(settings, store, bots, adapters).run()
    finally:
        await store.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(_amain())


if __name__ == "__main__":
    main()
