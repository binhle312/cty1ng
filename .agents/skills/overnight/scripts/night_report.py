"""What status, check and report.md show, from the state alone. Pure: no file, no clock, no environment."""

import re

from night_format import Refused, FULL_SHA, CODES, DEFAULT_MAX_GAP_MIN, entry_time, iso, minutes
from night_rules import fold, owner_only_paths
from night_review import accepted_findings


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
    stop = entry_time(night.go["stop"]) if night.go else None
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
    for target, entry in night.capped.items():
        spec = entry["spec"]
        findings = "\n".join(f"{f['severity']} {f['text']}" for f in spec["findings"])
        rows.append((target, "review cap", spec["done"], f"{findings} | Next: {spec['next']}", f"chief entry E{entry['id']}"))
    for target, review in night.reviews.items():
        start = night.review_starts.get(target)
        if target in night.capped or start is None or len(night.review_pairs[target]) < start["cap"]:
            continue
        findings = accepted_findings(night, review)
        advice = night.advice.get(review["id"], {})
        if findings["p3"] and (advice.get("advisor") != "allow" or "hold" in advice.get("consultants", [])):
            rows.append((target, "P3 advice at review cap", "", "Chief records the advice or owner decides the next step",
                         f"chief entry E{review['id']}"))
    if night.go:
        for target, task in night.task_specs.items():
            if task["class"] == "owner":
                rows.append((target, "owner task under project rules", "", ", ".join(task["criteria"]), f"E{night.go['id']}"))
            elif (start := night.review_starts.get(target)) and (paths := owner_only_paths(start["files"])):
                rows.append((target, "owner-only path under project rules", "", ", ".join(paths), f"E{start['id']}"))
    if night.pending_grant is not None:
        grant = night.grants[night.pending_grant]
        rows.append((grant["target"], "grant waits for confirmation", "", grant["head"], f"E{grant['id']}"))
    for name, (kind, source) in night.items.items():
        if kind == "owner" and name not in night.denied and name not in night.held:
            rows.append((name, "owner action from the card", "", "", f"E{source}"))
    return rows


def merge_rows(records):
    results = {(e["target"], e["of"]): e for e in records if e.get("kind") == "merge-result"}
    rows = []
    for attempt in records:
        if attempt.get("kind") != "merge-attempt":
            continue
        target, number = attempt["target"], attempt["id"]
        reply = results.get((target, number))
        if not reply:
            state, sha, detail = "send uncertain", "", ""
        else:
            state = "unconfirmed" if reply["outcome"] == "unknown" else reply["outcome"]
            sha, detail = reply.get("sha") or "", reply.get("code") or ""
        rows.append((target, state, attempt["head"], sha, detail, attempt["t"], f"leader entry E{number}"))
    return rows


def cleanup_rows(records):
    deleted, needs = [], []
    finished = {(e["target"], e["of"]) for e in records if e.get("kind") == "clean-result"}
    for e in records:
        if e["kind"] == "leader-gap":
            needs.append((e["target"], e["code"], "", e["detail"], "leader journal"))
            continue
        key = f"{e['target']} leader E{e['id']}"
        if e.get("kind") == "merge-result" and e["outcome"] != "merged":
            needs.append((e["target"], e.get("code") or e["outcome"], "", "reconcile on GitHub", key))
        if e.get("kind") == "clean-result":
            deleted.append((e["item"], e["subject"], e["size"], e["sha"], key, e.get("outcome", "removed")))
        elif e.get("kind") == "clean-refusal":
            needs.append((e["target"], e["code"], e["subject"], e["detail"], key))
        elif e.get("kind") == "clean-intent" and (e["target"], e["id"]) not in finished:
            needs.append((e["target"], "cleanup intent has no result", e["subject"], "check actual state", key))
    return deleted, needs


def card_targets(night):
    return {row[0]: target for target, row in night.merge_rows.items()}


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

    items = [(name, kind, f"E{source}") for name, (kind, source) in night.items.items()]
    targets = card_targets(night)
    typed_targets = [(name, target, *night.merge_rows[target][3:]) for name, target in targets.items()]
    records = report.get("merges", [])
    merges = merge_rows(records)
    deleted, cleanup_needs = cleanup_rows(records)
    audit = next((e for e in reversed(night.entries) if e["kind"] == "audit"), None)
    audit_rows = list(audit["rows"]) if audit else []
    if audit and go and audit["end"] < go["stop"]:
        audit_rows.extend([repo, "coverage gap", f"{audit['end']} to {go['stop']}", "interval not read"]
                          for repo in audit["repositories"])
    rulings = {(e["review"], e["source"], e["finding"]): e for e in night.entries if e["kind"] == "ruling"}
    p3 = [(entry["target"], finding, f"chief entry E{entry['id']}", report["source"],
           f"{ruling['severity']}: {ruling['reason']}" if (ruling := rulings.get((entry["id"], report["source"], finding))) else "open")
          for entry in night.entries if entry["kind"] in ("review", "cap")
          for report in entry["reports"] for finding in report["p3"]]
    advice = [(e["target"], e["advisor"], ", ".join(e["consultants"]) or "not authorized", f"E{e['id']}")
              for e in night.entries if e["kind"] == "advice"]
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
        end = entry_time(night.close["t"])
        stop = entry_time(night.go["stop"]) if night.go else None
        permissions = (f"Night permissions ended at the close (E{night.close['id']})." if stop is None or end < stop
                       else f"Night permissions ended at stop ({night.go['stop']}).")
    else:
        state = "The night is not closed."
        permissions = "Night permissions end at stop or at an earlier close."
    goal = {"set": "set by the owner's /goal line", "no-goal-command": "none: no /goal command here; heartbeat only"}
    text = [
        f"<!-- night.py record: report E{report['id']}, {'closed' if closed else 'open'}{test} -->",
        f"# Morning report: {night.run}{test}\n",
        f"Report E{report['id']}: the counts up to E{report['id']} (made at {report['t']}). {state}",
        f"Go: {go['t']}. Stop time: {go['stop']}. Session goal: {goal[go['goal']]}. "
        f"Rehearsal: {go['rehearsal']}.\n" if go else "Go: none.\n",
        "## Owner's words (exact)\n", fenced(night.words or ""), "",
        "## Items\n", table(items, ["Name", "Kind", "From"]),
        "## Merge targets\n", table(typed_targets, ["Item", "PR", "Base", "Method", "Leader"]),
        "## Needs you\n", table(needs_you(night) + cleanup_needs, ["Item", "Why", "Command", "Blocks", "Entry"]),
        "## Merge attempts\n", table(merges, ["PR", "State", "Reviewed head", "Merge commit", "Detail", "Time", "Source"]),
        "## Cleanup deletions\n", table(deleted, ["Item", "Path or ref", "Bytes", "SHA", "Source", "Outcome"]),
        "## Merge audit\n", table(audit_rows, ["PR or repository", "State", "Time or interval", "Evidence"]),
        "## P3 findings\n", table(p3, ["PR", "Finding", "Entry", "Report", "Disposition"]),
        "## P3 advice\n", table(advice, ["PR", "Advisor", "Consultants", "Entry"]),
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
    items = [{"name": name, "kind": kind, "from": f"E{source}"}
             for name, (kind, source) in night.items.items()]
    targets = card_targets(night)
    for item in items:
        if item["name"] in targets:
            item["target"] = targets[item["name"]]
    newest = night.newest_report()
    return {
        "run": night.run, "phase": night.phase, "test": night.test,
        "last": f"E{night.last['id']} {night.last['kind']} {night.last['t']}" if night.last else None,
        "closed": f"E{night.close['id']} NIGHT CLOSED {night.run} reason {night.close['reason']}" if night.close else None,
        "stop": night.go["stop"] if night.go else None, "items": items,
        "review_cap": night.go["review_cap"] if night.go else None,
        "merge_main_bonus": night.go.get("merge_main_bonus") if night.go else None,
        "review_rounds": {target: len(pairs) for target, pairs in night.review_pairs.items()},
        "pending_grant": night.pending_grant,
        "capped": night.capped,
        "timers": [e["timer"] for e in night.entries if e["kind"] == "timer"],
        "audit": next((e for e in reversed(night.entries) if e["kind"] == "audit"), None),
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


def audit_pr(pr, target, number, endpoint, matches, attempts, start, end):
    if not isinstance(pr, dict) or pr.get("number") != number:
        raise Refused("MERGE_READ_FAILED", endpoint)
    if pr.get("merged") is False:
        return None
    merged_at = entry_time(pr.get("merged_at"))
    sha = pr.get("merge_commit_sha")
    if pr.get("merged") is not True or not merged_at or not isinstance(sha, str) or not FULL_SHA.fullmatch(sha):
        raise Refused("MERGE_READ_FAILED", endpoint)
    actor = pr.get("merged_by") or {}
    head = pr.get("head")
    result = matches.get((target, head.get("sha") if isinstance(head, dict) else None, sha))
    matched = (result and entry_time(result.get("sent_at")) and
               entry_time(result["sent_at"]) <= merged_at <= entry_time(result["t"]))
    evidence = f"{endpoint}; {sha}; actor {actor.get('login', 'unknown')}"
    if matched:
        evidence += f"; leader result E{result['id']}"
    if start <= merged_at < end:
        state = "verified" if matched else "clock order uncertain" if result else "unmatched"
        return [target, state, iso(merged_at), evidence]
    elif end <= merged_at and target in attempts and matched:
        return [target, "verified late", iso(merged_at), evidence]
    elif end <= merged_at and target in attempts:
        return [target, "late merge without proven match", iso(merged_at), evidence]


def search_candidates(pages, repo):
    if not isinstance(pages, list) or not pages or not all(isinstance(page, dict) for page in pages):
        raise ValueError("pagination")
    counts = {page["total_count"] for page in pages}
    if len(counts) != 1 or any(page["incomplete_results"] is not False for page in pages):
        raise ValueError("incomplete search")
    count = counts.pop()
    if type(count) is not int or count < 0:
        raise ValueError("invalid count")
    rows = [row for page in pages for row in page["items"]]
    numbers = {row["number"] for row in rows if isinstance(row, dict) and
               type(row.get("number")) is int and row["number"] > 0 and
               row.get("repository_url", "").rstrip("/").lower().endswith("/repos/" + repo)}
    return count, numbers, len(rows)
