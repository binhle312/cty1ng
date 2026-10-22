"""Discord adapter: one discord.py client per bot role.

Translates Discord events into the neutral types in rolebots.chat, and posts
messages, threads and buttons back. All behaviour lives in RoleBotsService;
this file only knows Discord.

Discord specifics handled here:
  * each bot is its own Discord application, so @BA autocompletes as a real member
  * the Message Content intent must be enabled for each bot in the Developer Portal
  * button interactions must be acknowledged within 3 seconds
  * buttons carry everything in custom_id, so they keep working after a restart
"""

from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import discord

from ..botdef import BotDefinition
from ..chat import Button, ButtonPress, IncomingFile, IncomingMessage, OutgoingFile, local_id

if TYPE_CHECKING:
    from ..service import RoleBotsService

log = logging.getLogger("rolebots.discord")

PLATFORM = "discord"
STYLES = {"primary": discord.ButtonStyle.success, "secondary": discord.ButtonStyle.secondary,
          "danger": discord.ButtonStyle.danger}
THREAD_ARCHIVE_MINUTES = 10080  # a week
RECENT_MESSAGES = 500  # kept so we can react to / branch threads from a message we just received


def q(raw_id: int) -> str:
    return f"{PLATFORM}:{raw_id}"


def custom_id(button: Button) -> str:
    return f"rb:{button.action}:{button.value}:{'note' if button.needs_note else '-'}"


class NoteModal(discord.ui.Modal):
    def __init__(self, adapter: "DiscordAdapter", role: str, action: str, value: str, label: str):
        super().__init__(title=label[:45], timeout=600)
        self.adapter, self.role, self.action, self.value = adapter, role, action, value
        self.note = discord.ui.TextInput(label="What should change?", style=discord.TextStyle.paragraph,
                                         max_length=1500)
        self.add_item(self.note)

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await self.adapter.finish_press(interaction, self.role, self.action, self.value, str(self.note.value))


class RoleClient(discord.Client):
    def __init__(self, adapter: "DiscordAdapter", bot: BotDefinition):
        intents = discord.Intents.default()
        intents.message_content = True  # privileged: enable it for each bot in the Developer Portal
        super().__init__(intents=intents)
        self.adapter, self.bot = adapter, bot

    async def on_ready(self) -> None:
        log.info("%s connected as %s", self.bot.role, self.user)

    async def on_message(self, message: discord.Message) -> None:
        try:
            await self.adapter.on_message(self, message)
        except Exception:
            log.exception("failed to handle message %s for %s", message.id, self.bot.role)

    async def on_interaction(self, interaction: discord.Interaction) -> None:
        if interaction.type != discord.InteractionType.component:
            return
        cid = (interaction.data or {}).get("custom_id", "")
        if cid.startswith("rb:"):
            await self.adapter.on_button(self, interaction, cid)


class DiscordAdapter:
    platform = PLATFORM
    max_message_len = 1980  # Discord's limit is 2000

    def __init__(self, bots: dict[str, BotDefinition]):
        self.bots = {role: bot for role, bot in bots.items() if PLATFORM in bot.platforms}
        self.clients = {role: RoleClient(self, bot) for role, bot in self.bots.items()}
        self.service: RoleBotsService | None = None
        self._recent: OrderedDict[str, discord.Message] = OrderedDict()

    # -- lifecycle --------------------------------------------------------

    async def run(self, service: "RoleBotsService") -> None:
        self.service = service
        await asyncio.gather(*(c.start(self.bots[role].secret(PLATFORM, "token_env"))
                               for role, c in self.clients.items()))

    async def wait_ready(self) -> None:
        for c in self.clients.values():
            await c.wait_until_ready()

    # -- inbound ----------------------------------------------------------

    def _remember(self, message: discord.Message) -> None:
        self._recent[q(message.id)] = message
        while len(self._recent) > RECENT_MESSAGES:
            self._recent.popitem(last=False)

    async def on_message(self, client: RoleClient, message: discord.Message) -> None:
        channel = message.channel
        parent = channel.parent if isinstance(channel, discord.Thread) else channel
        if not isinstance(parent, discord.TextChannel):
            return  # DMs, voice text, forums: not project channels
        self._remember(message)
        other_bots = {c.user for c in self.clients.values() if c is not client}
        text = message.clean_content.replace(f"@{client.user.display_name}", "").strip()
        msg = IncomingMessage(
            platform=PLATFORM,
            bot_role=client.bot.role,
            message_id=q(message.id),
            channel_id=q(parent.id),
            channel_name=parent.name,
            thread_id=q(channel.id) if isinstance(channel, discord.Thread) else None,
            author_id=q(message.author.id),
            author_is_bot=message.author.bot,
            text=text,
            mentions_me=client.user in message.mentions,
            mentions_other_bot=bool(other_bots & set(message.mentions)),
            files=[IncomingFile(a.filename, a.size, (lambda path, a=a: a.save(path))) for a in message.attachments],
        )
        await self.service.handle_message(msg)

    async def on_button(self, client: RoleClient, interaction: discord.Interaction, cid: str) -> None:
        _, action, value, note_flag = cid.split(":", 3)
        if not self.service.is_owner(q(interaction.user.id)):
            await interaction.response.send_message("Only the project owner can decide on handoffs.", ephemeral=True)
            return
        if note_flag == "note":
            # A modal must be the first response, so no defer here.
            label = next((c.label for row in interaction.message.components for c in row.children
                          if getattr(c, "custom_id", None) == cid), "Add a note")
            await interaction.response.send_modal(NoteModal(self, client.bot.role, action, value, label))
            return
        await interaction.response.defer()  # acknowledge within Discord's 3-second window
        await self.finish_press(interaction, client.bot.role, action, value, "")

    async def finish_press(self, interaction: discord.Interaction, role: str, action: str, value: str,
                           note: str) -> None:
        if not interaction.response.is_done():
            await interaction.response.defer()
        decision = await self.service.handle_button(
            ButtonPress(PLATFORM, role, q(interaction.user.id), action, value, note)
        )
        # Replace the buttons with the outcome, so the thread keeps a readable record.
        stamp = decision.message + (f"\n> {note[:300]}" if note else "")
        await interaction.edit_original_response(
            content=f"{interaction.message.content}\n\n**{interaction.user.display_name}:** {stamp}", view=None
        )
        if not decision.ok:
            await interaction.followup.send(decision.message, ephemeral=True)

    # -- outbound ---------------------------------------------------------

    async def _channel(self, role: str, qualified_id: str):
        client = self.clients[role]
        raw = int(local_id(qualified_id))
        return client.get_channel(raw) or await client.fetch_channel(raw)

    async def open_thread(self, role: str, channel_id: str, title: str, from_message_id: str | None = None) -> str:
        title = title[:100] or "Task"
        source = self._recent.get(from_message_id) if from_message_id else None
        if source is not None:
            try:
                # Fetch the message through this bot's own client so the thread is created as this bot.
                own = await (await self._channel(role, channel_id)).fetch_message(source.id)
                thread = await own.create_thread(name=title, auto_archive_duration=THREAD_ARCHIVE_MINUTES)
                return q(thread.id)
            except discord.HTTPException:
                # Only one thread per message: when two bots are mentioned together,
                # the second gets its own thread and links back to the order.
                pass
        channel = await self._channel(role, channel_id)
        thread = await channel.create_thread(name=title, type=discord.ChannelType.public_thread,
                                             auto_archive_duration=THREAD_ARCHIVE_MINUTES)
        if source is not None:
            await thread.send(f"Picking up {source.jump_url}")
        return q(thread.id)

    async def post(self, role: str, thread_id: str, text: str, files: list[OutgoingFile] | None = None,
                   buttons: list[Button] | None = None) -> str:
        channel = await self._channel(role, thread_id)
        kwargs = {}
        if files:
            kwargs["files"] = [discord.File(f.path, filename=f.filename) for f in files]
        if buttons:
            view = discord.ui.View(timeout=None)
            for b in buttons:
                view.add_item(discord.ui.Button(style=STYLES[b.style], label=b.label, custom_id=custom_id(b)))
            kwargs["view"] = view
        message = await channel.send(text, **kwargs)
        return q(message.id)

    async def acknowledge(self, message: IncomingMessage) -> None:
        original = self._recent.get(message.message_id)
        if original is not None:
            await original.add_reaction("👀")

    @asynccontextmanager
    async def typing(self, role: str, thread_id: str):
        channel = await self._channel(role, thread_id)
        async with channel.typing():
            yield

    def mention(self, user_id: str | None) -> str:
        return f"<@{local_id(user_id)}>" if user_id else ""
