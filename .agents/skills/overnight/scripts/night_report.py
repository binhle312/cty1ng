"""What status, check and report.md show, from the state alone. Pure: no file, no clock, no environment."""

import re

from night_format import CODES, DEFAULT_MAX_GAP_MIN, entry_time, iso, minutes
from night_rules import fold


def alarm(go):
    return min(go["gap_min"], go["max_gap_min"], DEFAULT_MAX_GAP_MIN)


def gaps(night, until=None):
    """(from id, to label, minutes) for each silent stretch longer than the gap alarm, from the go on."""
    if night.go is None:
        return []
    limit = alarm(night.go)
    end = night.close["id"] if night.close else night.last["id"]
    timeline = [e for e in night.entries if night.go["id"] <= e["id"] <= end]
    found = []
    for before, after in zip(timeline, timeline[1:]):
        length = minutes(before["t"], after["t"])
        if length > limit:
            found.append((before["id"], f"E{after['id']}", length))
    if until is not None and night.close is None and timeline:
        length = minutes(timeline[-1]["t"], iso(until))
        if length > limit:
            found.append((timeline[-1]["id"], "now", length))
    return found


def gap_text(night, gap):
    return f"gap of {gap[2]} min from E{gap[0]} to {gap[1]} (alarm {alarm(night.go)} min)"


def stop_passed(night, now=None):
    if night.go is None or night.close is not None or night.last is None:
        return False
    stop = entry_time(night.go["stop"])
    return entry_time(night.last["t"]) >= stop or (now is not None and now >= stop)


def needs_you(night):
    rows = []
    for item, entry in night.denied.items():
        command = night.intents[entry["of"]].get("command") if entry["kind"] == "result" else entry.get("command")
        rows.append((item, "denied", command, entry.get("blocks"), f"E{entry['id']}"))
    for item, entry in night.held.items():
        rows.append((item, "held: " + entry.get("text", ""), "", "", f"E{entry['id']}"))
    for entry in night.waits.values():
        rows.append((entry["item"], "waits: " + entry.get("text", ""), "", "", f"E{entry['id']}"))
    for entry in night.unknown():
        rows.append((night.item_of(entry), "result unknown", "check the real state", "", f"E{entry['id']}"))
    for entry in night.open_intents():
        rows.append((entry["item"], "intent with no result", "check the real state", "", f"E{entry['id']}"))
    return rows


def cell(value):
    text = "" if value is None else str(value)
    return text.replace("<", "&lt;").replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def table(rows, header):
    if not rows:
        return "None.\n"
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def fenced(text):
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}text\n{text}\n{fence}"


def after_text(entry):
    """The facts of an entry after the report, for the closed record (a failed check must show)."""
    if entry["kind"] == "pagecheck":
        return f"check {entry['name']} of E{entry['report']}: {entry['outcome']}" + (f"; {entry['text']}" if "text" in entry else "")
    if entry["kind"] == "close":
        return f"reason {entry['reason']}" + (f"; no checked page: {entry['without_page']}" if "without_page" in entry else "")
    return " ".join(str(entry[k]) for k in ("item", "text") if k in entry)


def render(entries):
    """report.md for the newest report, from the journal alone (no clock, no environment)."""
    full = fold(entries)
    report = full.newest_report()
    cut = full.close["id"] if full.close else report["id"]
    night = fold([e for e in entries if e["id"] <= cut])
    closed = night.close is not None
    test = " TEST JOURNAL" if night.test else ""
    go = night.go
    results = [r for r in night.results.values()]

    def outcome_rows(outcome):
        return [(night.item_of(r), night.intents[r["of"]].get("command"), r["t"], r.get("text"), f"E{r['id']}")
                for r in results if r["outcome"] == outcome]

    items = [(name, kind, command or "", f"E{source}") for name, (kind, command, source) in night.items.items()]
    errors = [(e["t"], e.get("text"), f"E{e['id']}") for e in night.entries if e["kind"] == "error"]
    messages = [(e["t"], e.get("words"), e.get("reopen") or "", " | ".join(e.get("add_item", [])), f"E{e['id']}")
                for e in night.entries if e["kind"] in ("amend", "answer")]
    notes = [(e["t"], e.get("item"), e.get("text"), f"E{e['id']}") for e in night.entries if e["kind"] == "aware"]
    to_check = [(e.get("item"), e.get("text"), f"E{e['id']}") for e in night.entries
                if e["kind"] == "decision" and e.get("check")]
    stops = [gap_text(night, gap) for gap in gaps(night)]
    stops += [f"rule fault at E{i}: {code} ({CODES[code][1]}){'. ' + detail if detail else ''}"
              for i, code, detail in night.faults]
    stops += [f"repair at E{e['id']}: {e['bytes']} cut bytes moved to {e['cut_file']}"
              for e in night.entries if e["kind"] == "repair"]
    if closed:
        state = f"The night is closed at {night.close['t']} (E{night.close['id']}, reason {night.close['reason']})."
        permissions = f"Night permissions ended at the close (E{night.close['id']})."
    else:
        state = "The night is not closed."
        permissions = "The night is not closed. Its permissions stay until the close."
    goal = {"set": "set by the owner's /goal line", "no-goal-command": "none: no /goal command here; heartbeat only"}
    text = [
        f"<!-- night.py record: report E{report['id']}, {'closed' if closed else 'open'}{test} -->",
        f"# Morning report: {night.run}{test}\n",
        f"Report E{report['id']}: the counts up to E{report['id']} (made at {report['t']}). {state}",
        f"Go: {go['t']}. Stop time: {go['stop']}. Session goal: {goal[go['goal']]}. "
        f"Rehearsal: {go['rehearsal']}.\n" if go else "Go: none.\n",
        "## Owner's words (exact)\n", fenced(night.words or ""), "",
        "## Items\n", table(items, ["Name", "Kind", "Command", "From"]),
        "## Needs you\n", table(needs_you(night), ["Item", "Why", "Command", "Blocks", "Entry"]),
        "## My errors\n", table(errors, ["Time", "Error and correction", "Entry"]),
        "## Done and not reversible\n", table(outcome_rows("done"), ["Item", "Command", "Time", "Evidence", "Entry"]),
        "## Failed\n", table(outcome_rows("failed"), ["Item", "Command", "Time", "What happened", "Entry"]),
        "## Owner messages after the start\n", table(messages, ["Time", "Exact words", "Opens again", "Adds", "Entry"]),
        "## Notes for the owner\n", table(notes, ["Time", "Item", "Note", "Entry"]),
        "## Stops and gaps\n", ("None.\n" if not stops else "\n".join(f"- {cell(s)}" for s in stops) + "\n"),
        f"## Decisions to check ({len(to_check)})\n", table(to_check, ["Item", "Decision", "Entry"]),
        f"## Counts (report E{report['id']})\n", table(sorted(report["counts"].items()), ["Kind", "Count"]),
    ]
    later = [e for e in night.entries if e["id"] > report["id"]]
    if closed and later:
        text += [f"## After E{report['id']}\n", table([(f"E{e['id']}", e["kind"], e["t"], after_text(e)) for e in later],
                                                      ["Entry", "Kind", "Time", "What it says"])]
    text += ["## Permissions\n", permissions + "\n"]
    return "\n".join(text)


def status_data(night, now):
    def short(entries, item=lambda e: e.get("item")):
        return [f"E{e['id']} {item(e)}" for e in entries]
    items = [{"name": name, "kind": kind, "command": command, "from": f"E{source}"}
             for name, (kind, command, source) in night.items.items()]
    newest = night.newest_report()
    return {
        "run": night.run, "phase": night.phase, "test": night.test,
        "last": f"E{night.last['id']} {night.last['kind']} {night.last['t']}" if night.last else None,
        "closed": f"E{night.close['id']} NIGHT CLOSED {night.run} reason {night.close['reason']}" if night.close else None,
        "stop": night.go["stop"] if night.go else None, "items": items,
        "open_intents": short(night.open_intents()),
        "open_denials": short(night.denied.values(), night.item_of),
        "open_holds": short(night.held.values()),
        "open_waits": short(night.waits.values()),
        "unknown_results": short(night.unknown(), night.item_of),
        "newest_report": f"E{newest['id']}" if newest else None,
        "report_old_by": [f"E{e['id']}" for e in night.made_old_by] if newest else [],
        "gaps": [gap_text(night, gap) for gap in gaps(night, now)],
        "stop_passed": stop_passed(night, now),
        "faults": [f"E{i} {code}" for i, code, _ in night.faults],
        "counts": night.counts,
    }
