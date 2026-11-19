#!/usr/bin/env python3
"""Journal of one overnight run. Python standard library only. Run it with `python3 -I`.

Commands: new, go, log, status, check, report, close. Each takes `--dir <night folder>`.
The script takes each time from the clock and stores it in UTC. Do not type times in a text.
The owner's exact words come in through `--words-file` (write the file with a quoted heredoc).

Values: the heartbeat default (DEFAULT_HEARTBEAT_MIN) and the maximum gap alarm
(DEFAULT_MAX_GAP_MIN) are written here one time. A project can set a lower or higher maximum with
the environment variable NIGHT_MAX_GAP_MIN. A night can set a lower gap alarm, never a higher one.
NIGHT_FAKE_NOW (an ISO time) replaces the clock. Only the tests set it.

Exit codes: 0 = done, 1 = `check` found problems, 2 = bad arguments, 3 = the journal refused.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone

JOURNAL = "journal.jsonl"
CARD = "card.md"
REPORT = "report.md"
LOCK = "journal.lock"

LOG_KINDS = (
    "decision", "wait", "denied", "hold", "aware", "error", "alive",
    "intent", "result", "amend", "reserve", "pagecheck", "answer",
)
WORDS_KINDS = {"amend", "answer"}  # the owner's exact words: only from --words-file
AFTER_CLOSE = {"aware", "error", "answer"}
AFTER_REPORT = {"pagecheck", "alive"}
PAGE_CHECKS = ("mechanics", "truth", "counts")
OUTCOMES = ("done", "failed", "unknown", "denied")
GOAL_STATES = ("set", "no-goal-command")
REHEARSAL_STATES = ("passed", "owner-override", "none")
CLOSE_REASONS = ("goal-met", "nothing-left", "stop-time", "stopped")
DEFAULT_HEARTBEAT_MIN = 30
DEFAULT_MAX_GAP_MIN = 60
MIN_HEAD_CHARS = 7

EXIT_PROBLEMS = 1
EXIT_REFUSED = 3


class Refused(Exception):
    """The journal refuses a command. The message says why."""


# ---------- time and values ----------

def now():
    fake = os.environ.get("NIGHT_FAKE_NOW")
    if fake:
        value = datetime.fromisoformat(fake)
        return (value if value.tzinfo else value.astimezone()).astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def parse_time(text):
    text = text.strip()
    if re.fullmatch(r"\d{1,2}:\d{2}", text):  # a bare time of day: the next such local time
        hour, minute = (int(part) for part in text.split(":"))
        today = now().astimezone().replace(hour=hour, minute=minute, second=0, microsecond=0)
        return (today if today > now() else today + timedelta(days=1)).astimezone(timezone.utc)
    value = datetime.fromisoformat(text)
    if value.tzinfo is None:
        value = value.astimezone()  # a time with no zone is local time
    return value.astimezone(timezone.utc)


def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def local(text):
    return parse_time(text).astimezone().strftime("%Y-%m-%d %H:%M %z")


def minutes(a, b):
    return (parse_time(b) - parse_time(a)).total_seconds() / 60


def max_gap():
    raw = os.environ.get("NIGHT_MAX_GAP_MIN", str(DEFAULT_MAX_GAP_MIN))
    if not raw.isdigit() or int(raw) <= 0:
        raise Refused(f"NIGHT_MAX_GAP_MIN must be a whole number of minutes above 0, not {raw!r}")
    return int(raw)


def gap_limit(go):
    """The gap alarm of a night, never above the maximum (also for a journal edited by hand)."""
    return min(go.get("gap_min", 2 * go["heartbeat_min"]), max_gap())


# ---------- journal ----------

class Lock:
    """One writer at a time. An O_EXCL lock file works on each platform."""

    def __init__(self, folder):
        self.path = os.path.join(folder, LOCK)
        self.fd = None

    def __enter__(self):
        deadline = time.monotonic() + 10
        while True:
            try:
                self.fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                return self
            except FileExistsError:
                if time.monotonic() > deadline:
                    raise Refused(f"{LOCK} is held. Remove it only if no night.py process runs.") from None
                time.sleep(0.05)

    def __exit__(self, *exc):
        os.close(self.fd)
        os.remove(self.path)


def read(folder):
    path = os.path.join(folder, JOURNAL)
    if not os.path.exists(path):
        return []
    events = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                raise Refused(f"{JOURNAL} line {number} is not valid JSON") from None
    return events


def append(folder, kind, **fields):
    with Lock(folder):
        events = read(folder)
        event = {"id": max((e["id"] for e in events), default=0) + 1, "t": iso(now()), "kind": kind}
        event.update({k: v for k, v in fields.items() if v is not None and v is not False})
        with open(os.path.join(folder, JOURNAL), "a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    return event


def state(events):
    found = {"run": None, "words": None, "go": None, "close": None, "report": None}
    for event in events:
        kind = event["kind"]
        if kind == "new":
            found["run"], found["words"] = event["run"], event["words"]
        elif kind in ("go", "close", "report"):
            found[kind] = event
    if found["close"]:
        found["phase"] = "closed"
    elif found["go"]:
        found["phase"] = "running"
    elif found["run"]:
        found["phase"] = "prepared"
    else:
        found["phase"] = "none"
    return found


def label(event):
    return f"E{event['id']}"


def key(item):
    """One name for one item. Each form of a PR or issue number gives that number."""
    text = re.sub(r"\s+", " ", (item or "").strip().lower()).rstrip(".")
    for pattern in (
        r"(?:pr|pull request|pull|issue)?\s*[-#/ ]*\s*(\d+)",  # 3, #3, PR 3, PR-3, pr#3, pull/3
        r"(?:https?://)?\S*/(?:pull|issues)/(\d+)/?",  # https://host/owner/repo/pull/3, owner/repo/pull/3
        r"[\w.-]+/[\w.-]+#(\d+)",  # owner/repo#3
    ):
        match = re.fullmatch(pattern, text)
        if match:
            return f"#{int(match.group(1))}"
    return text


def blocking_results(events):
    return [e for e in results_by_intent(events).values() if e["outcome"] == "denied"]


def open_blocks(events, kinds=("denied", "hold")):
    """Denied or held items that no later owner amendment opened again, by item key.

    A `denied` result of an intent blocks its item in the same write as the result.
    """
    blocked = {}
    newest_result = {e["id"] for e in results_by_intent(events).values()}
    for event in events:
        is_denied_result = event["kind"] == "result" and event.get("outcome") == "denied" and event["id"] in newest_result
        if event["kind"] in kinds or ("denied" in kinds and is_denied_result):
            blocked[key(event["item"])] = event
        elif event["kind"] == "amend" and key(event.get("reopen")) in blocked:
            blocked.pop(key(event["reopen"]))
    return blocked


def open_denials(events):
    return open_blocks(events, ("denied",))


def results_by_intent(events):
    results = {}
    for event in events:
        if event["kind"] == "result":
            results[event["of"]] = event  # the newest result wins
    return results


def open_intents(events):
    results = results_by_intent(events)
    return [e for e in events if e["kind"] == "intent" and e["id"] not in results]


def unknown_results(events):
    return [r for r in results_by_intent(events).values() if r["outcome"] == "unknown"]


def open_waits(events):
    resolved = {e["resolves"] for e in events if e.get("resolves")}
    return [e for e in events if e["kind"] == "wait" and e["id"] not in resolved]


def event_id(text):
    """Accept an event id as 12 or E12."""
    match = re.fullmatch(r"[Ee]?(\d+)", str(text).strip())
    if not match:
        raise Refused(f"{text} is not an event id (use 12 or E12)")
    return int(match.group(1))


def read_words(path):
    if not path:
        raise Refused("give the owner's exact words with --words-file (write the file with a quoted heredoc)")
    with open(path, encoding="utf-8") as handle:
        words = handle.read().strip()
    if not words:
        raise Refused(f"{path} is empty: the owner's exact words are necessary")
    return words


def same_head(a, b):
    a, b = a.strip().lower(), b.strip().lower()
    if len(a) < MIN_HEAD_CHARS or len(b) < MIN_HEAD_CHARS:
        raise Refused(f"a head needs at least {MIN_HEAD_CHARS} characters of its id")
    return a.startswith(b) or b.startswith(a)


# ---------- commands ----------

def cmd_new(args):
    os.makedirs(args.dir, exist_ok=True)
    if read(args.dir):
        raise Refused(f"{args.dir} already has a journal. One folder holds one night.")
    words = read_words(args.words_file)
    run = "night-" + now().strftime("%Y%m%dT%H%MZ")
    event = append(args.dir, "new", run=run, words=words)
    card = os.path.join(args.dir, CARD)
    if not os.path.exists(card):
        with open(card, "w", encoding="utf-8") as handle:
            handle.write(
                f"# Night card {run}\n\nMade: {local(event['t'])}.\n\n"
                "## Owner's words (exact)\n\n```text\n" + words + "\n```\n\n"
                "Fill the other parts from references/night-card.md.\n"
            )
    print(f"{label(event)} new {run}")


def cmd_go(args):
    events = read(args.dir)
    found = state(events)
    if found["phase"] == "none":
        raise Refused("no night here: run `new` first")
    if found["phase"] != "prepared":
        raise Refused(f"this night already has a go ({label(found['go'])})")
    stop = parse_time(args.stop)
    if stop <= now():
        raise Refused(f"the stop time {local(iso(stop))} is not in the future")
    if args.heartbeat_min <= 0:
        raise Refused("--heartbeat-min must be more than 0")
    limit = max_gap()
    gap = args.gap_min if args.gap_min is not None else 2 * args.heartbeat_min
    if gap > limit:
        raise Refused(
            f"the gap alarm must be at most {limit} min (NIGHT_MAX_GAP_MIN); it is {gap} min. "
            f"Use a heartbeat of at most {limit // 2} min, or a lower --gap-min."
        )
    if gap < args.heartbeat_min:
        raise Refused(f"--gap-min ({gap}) must be at least the heartbeat ({args.heartbeat_min})")
    event = append(args.dir, "go", stop=iso(stop), heartbeat_min=args.heartbeat_min, gap_min=gap,
                   goal=args.goal, rehearsal=args.rehearsal)
    print(
        f"{label(event)} GO {found['run']} stop {local(event['stop'])} heartbeat {args.heartbeat_min} min "
        f"gap alarm {gap} min goal {args.goal} rehearsal {args.rehearsal}"
    )


def need(value, message):
    if not value:
        raise Refused(message)


def cmd_log(args):
    events = read(args.dir)
    found = state(events)
    kind = args.kind
    if found["phase"] == "none":
        raise Refused("no night here: run `new` first")
    if found["phase"] == "closed" and kind not in AFTER_CLOSE:
        raise Refused(f"the night is closed; after the close only {sorted(AFTER_CLOSE)} are allowed")
    text = args.text
    if kind in WORDS_KINDS:
        if text:
            raise Refused(f"the owner's words of `{kind}` go in only with --words-file, not as an argument")
        text = read_words(args.words_file)
    fields = {
        "text": text, "item": args.item, "command": args.command, "blocks": args.blocks,
        "source": args.source, "check": args.check,
        "resolves": event_id(args.resolves) if args.resolves is not None else None,
    }
    if fields["resolves"] is not None:
        target = next((e for e in events if e["id"] == fields["resolves"]), None)
        need(target and target["kind"] == "wait", f"--resolves E{fields['resolves']} is not a wait row")

    if kind == "decision":
        need(args.source or args.check, "a decision needs --source (the rule) or --check (the owner should check)")
    elif kind == "wait":
        need(args.item, "a wait row needs --item")
    elif kind == "denied":
        need(args.item and args.command and args.blocks, "a denied row needs --item, --command and --blocks")
        pending = [e for e in open_intents(events) if key(e["item"]) == key(args.item)]
        if pending:
            raise Refused(
                f"{args.item} has an open intent ({label(pending[0])}): log "
                f"`result --of {label(pending[0])} --outcome denied --blocks ...` instead"
            )
    elif kind == "hold":
        need(args.item and text, "a hold needs --item and the reason as text")
    elif kind == "amend":
        fields["reopen"] = args.reopen
    elif kind == "intent":
        need(args.item and args.command, "an intent needs --item and --command")
        need(found["go"], "no go: an action that cannot be undone needs a night that started")
        if found["go"].get("rehearsal", "none") == "none":
            raise Refused(
                "no rehearsal passed and no owner override on the card: this night has no actions "
                "that cannot be undone (go --rehearsal)"
            )
        if now() >= parse_time(found["go"]["stop"]):
            raise Refused(f"the stop time {local(found['go']['stop'])} has passed: close the night")
        if args.no_head:
            need(not (args.head or args.head_now), "give --head and --head-now, or --no-head, not both")
            fields["no_head"] = args.no_head
        else:
            need(args.head, "an intent needs --head <the reviewed head> (or --no-head <reason>)")
            need(args.head_now, "an intent needs --head-now <the head that you read just now>")
            if not same_head(args.head, args.head_now):
                raise Refused(f"the head moved: reviewed {args.head}, now {args.head_now}. Check the new head first.")
            fields.update({"head": args.head, "head_now": args.head_now})
        block = open_blocks(events).get(key(args.item))
        if block:
            name = "denied" if block["kind"] in ("denied", "result") else block["kind"]
            raise Refused(
                f"{name} stays {name}: {args.item} ({label(block)}). "
                "Only an owner message can open it again (log amend --reopen)."
            )
        if any(key(e["item"]) == key(args.item) for e in open_intents(events)):
            raise Refused(f"{args.item} has an intent with no result: check the real state and log the result first")
        unknown = [r for r in unknown_results(events) if key(r["item"]) == key(args.item)]
        if unknown:
            raise Refused(
                f"the result of {args.item} is unknown ({label(unknown[0])}): "
                "check the real state and log a new result first"
            )
    elif kind == "result":
        need(args.of is not None and args.outcome in OUTCOMES,
             "a result needs --of <intent id> and --outcome " + "|".join(OUTCOMES))
        of = event_id(args.of)
        intent = next((e for e in events if e["id"] == of and e["kind"] == "intent"), None)
        need(intent, f"E{of} is not an intent")
        earlier = results_by_intent(events).get(of)
        if earlier and earlier["outcome"] != "unknown":
            raise Refused(f"E{of} already has the result {earlier['outcome']} ({label(earlier)})")
        if args.outcome == "denied":
            need(args.blocks, "a denied result needs --blocks (what waits for the owner)")
        fields.update({"of": of, "outcome": args.outcome, "item": intent["item"],
                       "command": intent.get("command")})
    elif kind == "pagecheck":
        need(args.name in PAGE_CHECKS and args.outcome in ("pass", "fail"),
             f"a pagecheck needs --name {'|'.join(PAGE_CHECKS)} and --outcome pass|fail")
        fields.update({"name": args.name, "outcome": args.outcome})
    event = append(args.dir, kind, **fields)
    print(f"{label(event)} {kind} logged")


def summary(events):
    found = state(events)
    counts = {}
    for event in events:
        counts[event["kind"]] = counts.get(event["kind"], 0) + 1
    last = events[-1] if events else None
    go = found["go"]
    return {
        "run": found["run"],
        "phase": found["phase"],
        "go": go["t"] if go else None,
        "stop": go["stop"] if go else None,
        "heartbeat_min": go["heartbeat_min"] if go else None,
        "gap_alarm_min": gap_limit(go) if go else None,
        "goal": go["goal"] if go else None,
        "rehearsal": go.get("rehearsal") if go else None,
        "counts": counts,
        "open_intents": [label(e) + " " + e["item"] for e in open_intents(events)],
        "unknown_results": [label(e) + " " + e["item"] for e in unknown_results(events)],
        "open_denials": [label(e) + " " + e["item"] for e in open_denials(events).values()],
        "open_holds": [label(e) + " " + e["item"] for e in open_blocks(events, ("hold",)).values()],
        "open_waits": [label(e) + " " + e["item"] for e in open_waits(events)],
        "decisions_to_check": sum(1 for e in events if e["kind"] == "decision" and e.get("check")),
        "last_event": last["t"] if last else None,
        "minutes_since_last": round(minutes(last["t"], iso(now())), 1) if last else None,
    }


def cmd_status(args):
    data = summary(read(args.dir))
    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return
    for name, value in data.items():
        if name in ("go", "stop", "last_event") and value:
            value = local(value)
        print(f"{name}: {value}")


def problems(events, at=None, clock=None):
    """Faults of the record. `at`: also count the gap up to that time. `clock`: the time now,
    for the check that a night past its stop time is closed."""
    found = state(events)
    out = []
    if found["phase"] == "none":
        return ["no night: the journal has no `new` event"]
    go = found["go"]
    if not go:
        out.append("no go: the owner did not start the night")
    previous = None
    blocked = {}
    newest_result = {e["id"] for e in results_by_intent(events).values()}
    for event in events:
        if previous and parse_time(event["t"]) < parse_time(previous["t"]):
            out.append(f"time goes back at {label(event)} ({event['t']} is before {previous['t']})")
        kind = event["kind"]
        if kind in ("denied", "hold"):
            if kind == "denied" and not (event.get("command") and event.get("blocks")):
                out.append(f"denied row {label(event)} has no exact command or no 'blocks'")
            blocked[key(event.get("item"))] = event
        elif kind == "result" and event.get("outcome") == "denied" and event["id"] in newest_result:
            blocked[key(event.get("item"))] = event
        elif kind == "amend" and key(event.get("reopen")) in blocked:
            blocked.pop(key(event["reopen"]))
        elif kind == "decision" and not (event.get("source") or event.get("check")):
            out.append(f"decision {label(event)} has no source and no owner check")
        elif kind == "intent":
            block = blocked.get(key(event.get("item")))
            if block:
                name = "held" if block["kind"] == "hold" else "denied"
                out.append(f"intent {label(event)} acts on {event['item']}, which was {name} ({label(block)})")
            if not go or parse_time(event["t"]) < parse_time(go["t"]):
                out.append(f"intent {label(event)} comes before the go")
            elif parse_time(event["t"]) >= parse_time(go["stop"]):
                out.append(f"intent {label(event)} comes after the stop time")
        previous = event
    for event in open_intents(events):
        out.append(f"intent {label(event)} ({event['item']}) has no result: check the real state")
    if go:
        limit = gap_limit(go)
        timeline = [e for e in events if parse_time(e["t"]) >= parse_time(go["t"])]
        if found["close"]:
            timeline = [e for e in timeline if e["id"] <= found["close"]["id"]]
        points = [(label(e), e["t"]) for e in timeline]
        if not found["close"] and at is not None:
            end = iso(at)
            if not points or parse_time(end) > parse_time(points[-1][1]):
                points.append(("now", end))
        for (name_a, t_a), (name_b, t_b) in zip(points, points[1:]):
            gap = minutes(t_a, t_b)
            if gap > limit:
                out.append(f"gap of {gap:.0f} min from {name_a} to {name_b} (limit {limit} min)")
        if not found["close"] and clock is not None and clock >= parse_time(go["stop"]):
            out.append(f"the stop time {local(go['stop'])} has passed and the night is not closed")
    return out


def cmd_check(args):
    clock = now()
    found = problems(read(args.dir), clock if args.now else None, clock)
    if not found:
        print("check: OK")
        return 0
    for line in found:
        print(f"PROBLEM: {line}")
    return EXIT_PROBLEMS


def table(rows, header):
    if not rows:
        return "None.\n"
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for row in rows:
        lines.append("| " + " | ".join(str(c or "").replace("|", "\\|").replace("\n", " ") for c in row) + " |")
    return "\n".join(lines) + "\n"


def write_report(folder, events):
    """Write report.md from the journal. The caller appends its event first, so it counts."""
    found = state(events)
    data = summary(events)
    last = events[-1]
    go = found["go"]
    needs = []
    for e in open_denials(events).values():
        needs.append((e["item"], "denied", e.get("command"), e.get("blocks"), label(e)))
    for e in open_blocks(events, ("hold",)).values():
        needs.append((e["item"], "held: " + e.get("text", ""), e.get("command"), e.get("blocks"), label(e)))
    for e in open_waits(events):
        needs.append((e["item"], "waits: " + (e.get("text") or ""), e.get("command"), e.get("blocks"), label(e)))
    for e in unknown_results(events):
        needs.append((e["item"], "result unknown", "check the real state", "", label(e)))
    for e in open_intents(events):
        needs.append((e["item"], "intent with no result", "check the real state", "", label(e)))
    intents = {e["id"]: e for e in events if e["kind"] == "intent"}
    results = list(results_by_intent(events).values())

    def rows(outcome):
        return [(r["item"], intents[r["of"]].get("command"), local(r["t"]), r.get("text"), label(r))
                for r in results if r["outcome"] == outcome]

    errors = [(local(e["t"]), e.get("text"), label(e)) for e in events if e["kind"] == "error"]
    amends = [(local(e["t"]), e.get("text"), e.get("reopen"), label(e)) for e in events if e["kind"] == "amend"]
    notes = [(local(e["t"]), e.get("item"), e.get("text"), label(e)) for e in events if e["kind"] == "aware"]
    to_check = [(e.get("item"), e.get("text"), label(e)) for e in events if e["kind"] == "decision" and e.get("check")]
    clock = now()
    issues = problems(events, clock if found["phase"] == "running" else None, clock)
    if found["close"]:
        closing = f"Night permissions ended at the close ({label(found['close'])}, reason {found['close']['reason']})."
    else:
        closing = "The night is not closed. Its permissions end at the close."
    goal = {"set": "set by the owner's /goal line", "no-goal-command": "none: no /goal command here; heartbeat only"}
    text = [
        f"# Morning report: {found['run']}\n",
        f"Made by night.py at {local(iso(clock))}, from the journal up to {label(last)}.",
        f"Go: {local(go['t']) if go else 'none'}. Stop time: {local(go['stop']) if go else 'none'}. "
        f"Session goal: {goal.get(go['goal'], go['goal']) if go else 'none'}. "
        f"Rehearsal: {go.get('rehearsal') if go else 'none'}. Phase: {found['phase']}.\n",
        "## Owner's words (exact)\n", "```text", found["words"], "```\n",
        "## Needs you\n", table(needs, ["Item", "Why", "Command", "Blocks", "Event"]),
        "## My errors\n", table(errors, ["Time", "Error and correction", "Event"]),
        "## Done and not reversible\n", table(rows("done"), ["Item", "Command", "Time", "Evidence", "Event"]),
        "## Failed\n", table(rows("failed"), ["Item", "Command", "Time", "What happened", "Event"]),
        "## Owner messages after the start\n", table(amends, ["Time", "Exact words", "Opens again", "Event"]),
        "## Notes for the owner\n", table(notes, ["Time", "Item", "Note", "Event"]),
        "## Stops and gaps\n", ("None.\n" if not issues else "\n".join(f"- {p}" for p in issues) + "\n"),
        f"## Decisions to check ({len(to_check)})\n", table(to_check, ["Item", "Decision", "Event"]),
        "## Counts\n", table(sorted(data["counts"].items()), ["Kind", "Count"]),
        "## Permissions\n", closing + "\n",
    ]
    with open(os.path.join(folder, REPORT), "w", encoding="utf-8") as handle:
        handle.write("\n".join(text))


def cmd_report(args):
    events = read(args.dir)
    if state(events)["phase"] == "none":
        raise Refused("no night here: run `new` first")
    event = append(args.dir, "report", covers=events[-1]["id"])
    write_report(args.dir, read(args.dir))
    print(f"{label(event)} report written: {os.path.join(args.dir, REPORT)}")


def cmd_close(args):
    events = read(args.dir)
    found = state(events)
    if found["phase"] == "none":
        raise Refused("no night here: run `new` first")
    if found["phase"] == "prepared":
        raise Refused("no go: there is no night to close")
    if found["phase"] == "closed":
        raise Refused(f"already closed ({label(found['close'])})")
    pending = open_intents(events)
    if pending:
        raise Refused("intents with no result: " + ", ".join(label(e) for e in pending) + ". Check the real state first.")
    report = found["report"]
    if not report:
        raise Refused("no report: run `report` first")
    late = [e for e in events if e["id"] > report["id"] and e["kind"] not in AFTER_REPORT]
    if late:
        raise Refused("the report is older than " + ", ".join(label(e) for e in late) + ": run `report` again")
    if not args.without_page:
        newest = {}
        for event in events:
            if event["kind"] == "pagecheck" and event["id"] > report["id"]:
                newest[event["name"]] = event["outcome"]
        missing = [name for name in PAGE_CHECKS if newest.get(name) != "pass"]
        if missing:
            raise Refused(
                "page checks not passed after the report: " + ", ".join(missing)
                + ". Or give --without-page <reason>."
            )
    event = append(args.dir, "close", reason=args.reason, without_page=args.without_page)
    events = read(args.dir)
    write_report(args.dir, events)  # the report of record includes the close and its gaps
    for line in problems(events):
        print(f"NOTE: {line} (it is on the report)")
    print(f"{label(event)} NIGHT CLOSED {found['run']} reason {args.reason}")


# ---------- arguments ----------

def parser():
    top = argparse.ArgumentParser(prog="night.py", description=__doc__.splitlines()[0])
    sub = top.add_subparsers(dest="command_name", required=True)

    def add(name, helptext):
        cmd = sub.add_parser(name, help=helptext)
        cmd.add_argument("--dir", required=True, help="the night folder")
        return cmd

    new = add("new", "start the journal and the card with the owner's exact words")
    new.add_argument("--words-file", required=True, help="a file with the owner's exact /overnight arguments")
    go = add("go", "record the owner's go")
    go.add_argument("--stop", required=True, help="stop time: HH:MM (the next such local time), YYYY-MM-DD HH:MM (local) or ISO with a zone")
    go.add_argument("--goal", required=True, choices=GOAL_STATES,
                    help="set = the owner sent the /goal line; no-goal-command = this environment has no /goal (say it on the card)")
    go.add_argument("--rehearsal", required=True, choices=REHEARSAL_STATES,
                    help="passed = a rehearsal of this skill passed in this project; owner-override = the owner's words on the card; none = no action that cannot be undone tonight")
    go.add_argument("--heartbeat-min", type=int, default=DEFAULT_HEARTBEAT_MIN)
    go.add_argument("--gap-min", type=int, help="the gap alarm (default 2 times the heartbeat; at most NIGHT_MAX_GAP_MIN)")
    log = add("log", "add one entry")
    log.add_argument("kind", choices=LOG_KINDS)
    log.add_argument("text", nargs="?", default=None)
    log.add_argument("--words-file", help="amend, answer: a file with the owner's exact words")
    log.add_argument("--item")
    log.add_argument("--command", dest="command")
    log.add_argument("--blocks")
    log.add_argument("--source")
    log.add_argument("--check", action="store_true", help="the owner should check this decision")
    log.add_argument("--of", help="the intent id of a result (12 or E12)")
    log.add_argument("--outcome", choices=OUTCOMES + ("pass", "fail"))
    log.add_argument("--name", help="pagecheck name: " + ", ".join(PAGE_CHECKS))
    log.add_argument("--reopen", help="amend: the denied or held item that this owner message opens again")
    log.add_argument("--resolves", help="the id of the wait row that this entry ends (12 or E12)")
    log.add_argument("--head", help="intent: the head that the reviews and checks saw")
    log.add_argument("--head-now", help="intent: the head that you read just before the action")
    log.add_argument("--no-head", help="intent: why this action has no head")
    status = add("status", "show the state and the counts")
    status.add_argument("--json", action="store_true")
    check = add("check", "find gaps, open intents and broken rows")
    check.add_argument("--now", action="store_true", help="also count the gap from the last entry to now")
    add("report", "write report.md from the journal")
    close = add("close", "close the night (it writes report.md again)")
    close.add_argument("--reason", required=True, choices=CLOSE_REASONS)
    close.add_argument("--without-page", help="the reason why there is no checked page")
    return top


def main(argv=None):
    args = parser().parse_args(argv)
    handlers = {
        "new": cmd_new, "go": cmd_go, "log": cmd_log, "status": cmd_status,
        "check": cmd_check, "report": cmd_report, "close": cmd_close,
    }
    try:
        return handlers[args.command_name](args) or 0
    except Refused as refusal:
        print(f"REFUSED: {refusal}", file=sys.stderr)
        return EXIT_REFUSED
    except (ValueError, OSError) as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        return EXIT_REFUSED


if __name__ == "__main__":
    sys.exit(main())
