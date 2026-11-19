#!/usr/bin/env python3
"""Journal of one overnight run. Python standard library only. Run it with `python3 -I`.

Commands: new, go, log, status, check, report, close. Each takes `--dir <night folder>`.
The script takes each time from the clock and stores it in UTC. Do not type times in a text.
NIGHT_FAKE_NOW (an ISO time) replaces the clock. Only the tests set it.

Exit codes: 0 = done, 1 = `check` found problems, 2 = bad arguments, 3 = the journal refused.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

JOURNAL = "journal.jsonl"
CARD = "card.md"
REPORT = "report.md"
LOCK = "journal.lock"

LOG_KINDS = (
    "decision", "wait", "denied", "aware", "error", "alive",
    "intent", "result", "amend", "reserve", "pagecheck", "answer",
)
AFTER_CLOSE = {"aware", "error", "answer"}
AFTER_REPORT = {"pagecheck", "alive"}
PAGE_CHECKS = ("mechanics", "truth", "counts")
OUTCOMES = ("done", "failed", "unknown")
CLOSE_REASONS = ("goal-met", "nothing-left", "stop-time", "stopped")
DEFAULT_HEARTBEAT_MIN = 30

EXIT_PROBLEMS = 1
EXIT_REFUSED = 3


class Refused(Exception):
    """The journal refuses a command. The message says why."""


# ---------- time ----------

def parse_time(text):
    value = datetime.fromisoformat(text.strip())
    if value.tzinfo is None:
        value = value.astimezone()  # a time with no zone is local time
    return value.astimezone(timezone.utc)


def now():
    fake = os.environ.get("NIGHT_FAKE_NOW")
    return parse_time(fake) if fake else datetime.now(timezone.utc)


def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def local(text):
    return parse_time(text).astimezone().strftime("%Y-%m-%d %H:%M %z")


def minutes(a, b):
    return (parse_time(b) - parse_time(a)).total_seconds() / 60


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
                    raise Refused(
                        f"{LOCK} is held. Remove it only if no night.py process runs."
                    ) from None
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


def open_denials(events):
    """Denied items that no later owner amendment opened again."""
    denied = {}
    for event in events:
        if event["kind"] == "denied":
            denied[event["item"]] = event
        elif event["kind"] == "amend" and event.get("reopen") in denied:
            denied.pop(event["reopen"])
    return denied


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


# ---------- commands ----------

def cmd_new(args):
    os.makedirs(args.dir, exist_ok=True)
    if read(args.dir):
        raise Refused(f"{args.dir} already has a journal. One folder holds one night.")
    words = args.words
    if args.words_file:
        with open(args.words_file, encoding="utf-8") as handle:
            words = handle.read().strip()
    if not words:
        raise Refused("give the owner's exact words with --words or --words-file")
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
    event = append(args.dir, "go", stop=iso(stop), heartbeat_min=args.heartbeat_min, goal=args.goal)
    print(
        f"{label(event)} GO {found['run']} stop {local(event['stop'])} "
        f"heartbeat {args.heartbeat_min} min goal {args.goal}"
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
    fields = {
        "text": args.text, "item": args.item, "command": args.command, "blocks": args.blocks,
        "source": args.source, "check": args.check, "resolves": args.resolves,
    }
    if args.resolves is not None:
        target = next((e for e in events if e["id"] == args.resolves), None)
        need(target and target["kind"] == "wait", f"--resolves E{args.resolves} is not a wait row")

    if kind == "decision":
        need(args.source or args.check, "a decision needs --source (the rule) or --check (the owner should check)")
    elif kind == "wait":
        need(args.item, "a wait row needs --item")
    elif kind == "denied":
        need(args.item and args.command and args.blocks, "a denied row needs --item, --command and --blocks")
    elif kind == "amend":
        fields["reopen"] = args.reopen
    elif kind == "intent":
        need(args.item and args.command, "an intent needs --item and --command")
        need(found["go"], "no go: an action that cannot be undone needs a night that started")
        if now() >= parse_time(found["go"]["stop"]):
            raise Refused(f"the stop time {local(found['go']['stop'])} has passed: close the night")
        denial = open_denials(events).get(args.item)
        if denial:
            raise Refused(
                f"denied stays denied: {args.item} was denied ({label(denial)}). "
                "Only an owner message can open it again (log amend --reopen)."
            )
        if any(e["item"] == args.item for e in open_intents(events)):
            raise Refused(f"{args.item} has an intent with no result: check the real state and log the result first")
    elif kind == "result":
        need(args.of is not None and args.outcome, "a result needs --of <intent id> and --outcome")
        intent = next((e for e in events if e["id"] == args.of and e["kind"] == "intent"), None)
        need(intent, f"E{args.of} is not an intent")
        earlier = results_by_intent(events).get(args.of)
        if earlier and earlier["outcome"] != "unknown":
            raise Refused(f"E{args.of} already has the result {earlier['outcome']} ({label(earlier)})")
        fields.update({"of": args.of, "outcome": args.outcome, "item": intent["item"]})
    elif kind == "pagecheck":
        need(args.name in PAGE_CHECKS and args.outcome in ("pass", "fail"),
             f"a pagecheck needs --name {'|'.join(PAGE_CHECKS)} and --outcome pass|fail")
        fields.update({"name": args.name, "outcome": args.outcome})
    event = append(args.dir, kind, **fields)
    print(f"{label(event)} {kind} logged")


def summary(events, at=None):
    found = state(events)
    counts = {}
    for event in events:
        counts[event["kind"]] = counts.get(event["kind"], 0) + 1
    last = events[-1] if events else None
    data = {
        "run": found["run"],
        "phase": found["phase"],
        "go": found["go"]["t"] if found["go"] else None,
        "stop": found["go"]["stop"] if found["go"] else None,
        "heartbeat_min": found["go"]["heartbeat_min"] if found["go"] else None,
        "goal": found["go"]["goal"] if found["go"] else None,
        "counts": counts,
        "open_intents": [label(e) + " " + e["item"] for e in open_intents(events)],
        "unknown_results": [label(e) + " " + e["item"] for e in unknown_results(events)],
        "open_denials": sorted(open_denials(events)),
        "open_waits": [label(e) + " " + e["item"] for e in open_waits(events)],
        "decisions_to_check": sum(1 for e in events if e["kind"] == "decision" and e.get("check")),
        "last_event": last["t"] if last else None,
        "minutes_since_last": round(minutes(last["t"], iso(at or now())), 1) if last else None,
    }
    return data


def cmd_status(args):
    data = summary(read(args.dir))
    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return
    for key, value in data.items():
        if key in ("go", "stop", "last_event") and value:
            value = local(value)
        print(f"{key}: {value}")


def problems(events, at=None):
    found = state(events)
    out = []
    if found["phase"] == "none":
        return ["no night: the journal has no `new` event"]
    go = found["go"]
    if not go:
        out.append("no go: the owner did not start the night")
    previous = None
    denied = {}
    for event in events:
        if previous and parse_time(event["t"]) < parse_time(previous["t"]):
            out.append(f"time goes back at {label(event)} ({event['t']} is before {previous['t']})")
        kind = event["kind"]
        if kind == "denied":
            if not (event.get("command") and event.get("blocks")):
                out.append(f"denied row {label(event)} has no exact command or no 'blocks'")
            denied[event.get("item")] = event
        elif kind == "amend" and event.get("reopen") in denied:
            denied.pop(event["reopen"])
        elif kind == "decision" and not (event.get("source") or event.get("check")):
            out.append(f"decision {label(event)} has no source and no owner check")
        elif kind == "intent":
            if event.get("item") in denied:
                out.append(f"intent {label(event)} acts on {event['item']}, which was denied ({label(denied[event['item']])})")
            if not go or parse_time(event["t"]) < parse_time(go["t"]):
                out.append(f"intent {label(event)} comes before the go")
            elif parse_time(event["t"]) >= parse_time(go["stop"]):
                out.append(f"intent {label(event)} comes after the stop time")
        previous = event
    for event in open_intents(events):
        out.append(f"intent {label(event)} ({event['item']}) has no result: check the real state")
    if go:
        limit = 2 * go["heartbeat_min"]
        end = found["close"]["t"] if found["close"] else None
        if not end and at is not None:
            end = iso(min(at, parse_time(go["stop"])))
        timeline = [e for e in events if parse_time(e["t"]) >= parse_time(go["t"])]
        if found["close"]:
            timeline = [e for e in timeline if e["id"] <= found["close"]["id"]]
        points = [(label(e), e["t"]) for e in timeline]
        if end and (not points or parse_time(end) > parse_time(points[-1][1])):
            points.append(("now" if not found["close"] else "close", end))
        for (name_a, t_a), (name_b, t_b) in zip(points, points[1:]):
            gap = minutes(t_a, t_b)
            if gap > limit:
                out.append(f"gap of {gap:.0f} min from {name_a} to {name_b} (limit {limit} min)")
    return out


def cmd_check(args):
    at = now() if args.now else None
    found = problems(read(args.dir), at)
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


def cmd_report(args):
    events = read(args.dir)
    found = state(events)
    if found["phase"] == "none":
        raise Refused("no night here: run `new` first")
    data = summary(events)
    last = events[-1]
    go = found["go"]
    needs = [(e["item"], "denied", e.get("command"), e.get("blocks"), label(e)) for e in open_denials(events).values()]
    needs += [(e["item"], "waits: " + (e.get("text") or ""), e.get("command"), e.get("blocks"), label(e)) for e in open_waits(events)]
    needs += [(e["item"], "result unknown", "check the real state", "", label(e)) for e in unknown_results(events)]
    needs += [(e["item"], "intent with no result", "check the real state", "", label(e)) for e in open_intents(events)]
    intents = {e["id"]: e for e in events if e["kind"] == "intent"}
    results = results_by_intent(events).values()
    done = [(r["item"], intents[r["of"]].get("command"), local(r["t"]), r.get("text"), label(r)) for r in results if r["outcome"] == "done"]
    failed = [(r["item"], intents[r["of"]].get("command"), local(r["t"]), r.get("text"), label(r)) for r in results if r["outcome"] == "failed"]
    errors = [(local(e["t"]), e.get("text"), label(e)) for e in events if e["kind"] == "error"]
    amends = [(local(e["t"]), e.get("text"), e.get("reopen"), label(e)) for e in events if e["kind"] == "amend"]
    to_check = [(e.get("item"), e.get("text"), label(e)) for e in events if e["kind"] == "decision" and e.get("check")]
    issues = problems(events, now() if found["phase"] == "running" else None)
    closing = (
        f"Night permissions ended at the close ({label(found['close'])}, reason {found['close']['reason']})."
        if found["close"] else "The night is not closed. Its permissions still hold until the close."
    )
    text = [
        f"# Morning report: {found['run']}\n",
        f"Made by night.py at {local(iso(now()))}, from the journal up to {label(last)}.",
        f"Go: {local(go['t']) if go else 'none'}. Stop time: {local(go['stop']) if go else 'none'}. "
        f"Session goal: {go['goal'] if go else 'none'}. Phase: {found['phase']}.\n",
        "## Owner's words (exact)\n", "```text", found["words"], "```\n",
        "## Needs you\n", table(needs, ["Item", "Why", "Command", "Blocks", "Event"]),
        "## My errors\n", table(errors, ["Time", "Error and correction", "Event"]),
        "## Done and not reversible\n", table(done, ["Item", "Command", "Time", "Evidence", "Event"]),
        "## Failed\n", table(failed, ["Item", "Command", "Time", "What happened", "Event"]),
        "## Owner messages after the start\n", table(amends, ["Time", "Exact words", "Opens again", "Event"]),
        "## Stops and gaps\n", ("None.\n" if not issues else "\n".join(f"- {p}" for p in issues) + "\n"),
        f"## Decisions to check ({len(to_check)})\n", table(to_check, ["Item", "Decision", "Event"]),
        "## Counts\n", table(sorted(data["counts"].items()), ["Kind", "Count"]),
        "## Permissions\n", closing + "\n",
    ]
    with open(os.path.join(args.dir, REPORT), "w", encoding="utf-8") as handle:
        handle.write("\n".join(text))
    event = append(args.dir, "report", covers=last["id"])
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
    issues = problems(events)
    event = append(args.dir, "close", reason=args.reason, without_page=args.without_page)
    for line in issues:
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
    new.add_argument("--words")
    new.add_argument("--words-file")
    go = add("go", "record the owner's go")
    go.add_argument("--stop", required=True, help="stop time, YYYY-MM-DD HH:MM (local) or ISO with a zone")
    go.add_argument("--goal", required=True, choices=("set", "not-set"), help="did the owner send the /goal line?")
    go.add_argument("--heartbeat-min", type=int, default=DEFAULT_HEARTBEAT_MIN)
    log = add("log", "add one entry")
    log.add_argument("kind", choices=LOG_KINDS)
    log.add_argument("text", nargs="?", default=None)
    log.add_argument("--item")
    log.add_argument("--command", dest="command")
    log.add_argument("--blocks")
    log.add_argument("--source")
    log.add_argument("--check", action="store_true", help="the owner should check this decision")
    log.add_argument("--of", type=int, help="the intent id of a result")
    log.add_argument("--outcome", choices=OUTCOMES + ("pass", "fail"))
    log.add_argument("--name", help="pagecheck name: " + ", ".join(PAGE_CHECKS))
    log.add_argument("--reopen", help="amend: the denied item that this owner message opens again")
    log.add_argument("--resolves", type=int, help="the id of the wait row that this entry ends")
    status = add("status", "show the state and the counts")
    status.add_argument("--json", action="store_true")
    check = add("check", "find gaps, open intents and broken rows")
    check.add_argument("--now", action="store_true", help="also count the gap from the last entry to now")
    add("report", "write report.md from the journal")
    close = add("close", "close the night")
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
    except ValueError as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        return EXIT_REFUSED


if __name__ == "__main__":
    sys.exit(main())
