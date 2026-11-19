"""The state of a night (the fold) and the rules on each entry. Pure: no file, no clock, no environment."""

import re

from night_format import (
    ANY_SHA, DEFAULT_MAX_GAP_MIN, FINAL_OUTCOMES, FULL_SHA, ITEM_EVENTS, ITEM_KINDS, KEEPS_REPORT_FRESH, OPTION,
    PAGE_CHECKS, PHASE_KINDS, REHEARSALS_FOR_ACTION, entry_time)


def name_key(name):
    return " ".join(name.split()).casefold()


class Night:
    """The state that the journal entries make. `apply` changes it; it holds no rules."""

    def __init__(self):
        self.phase = "none"
        self.run = self.words = self.go = self.close = self.last = None
        self.test = False
        self.items = {}         # exact name -> (kind, option or None, source entry id)
        self.intents = {}       # intent id -> entry
        self.latest = {}        # item -> the id of its newest intent
        self.results = {}       # intent id -> its newest result
        self.denied = {}        # item -> the open denial (a denied row or a denied result)
        self.held = {}          # item -> the open hold
        self.waits = {}         # wait id -> entry, while open
        self.reports = []       # report entries
        self.pagechecks = {}    # report id -> {name: outcome}
        self.made_old_by = []   # entries after the newest report that make it old
        self.counts = {}
        self.entries = []
        self.faults = []        # (entry id, code, detail)

    def open_intents(self):
        return [self.intents[i] for i in sorted(self.intents) if i not in self.results]

    def unknown(self):
        return [r for i, r in sorted(self.results.items()) if r["outcome"] == "unknown"]

    def newest_report(self):
        return self.reports[-1] if self.reports else None

    def item_of(self, entry):
        return self.intents[entry["of"]]["item"] if entry["kind"] == "result" else entry.get("item")


def apply(night, entry):
    kind = entry["kind"]
    night.entries.append(entry)
    night.last = entry
    night.counts[kind] = night.counts.get(kind, 0) + 1
    if night.reports and kind not in KEEPS_REPORT_FRESH:
        night.made_old_by.append(entry)
    if kind == "new" and night.phase == "none":
        night.phase, night.run, night.words, night.test = "prepared", entry["run"], entry.get("words"), bool(entry.get("test"))
    elif kind == "go" and night.go is None:
        night.go = entry
        night.phase = "running" if night.phase == "prepared" else night.phase
        for row in entry["items"]:
            night.items[row[0]] = (row[1], row[2] if len(row) > 2 else None, entry["id"])
    elif kind == "intent":
        night.intents[entry["id"]] = entry
        night.latest[entry["item"]] = entry["id"]
    elif kind == "result" and entry["of"] in night.intents:
        night.results[entry["of"]] = entry
        if entry["outcome"] == "denied":
            night.denied[night.intents[entry["of"]]["item"]] = entry
    elif kind == "denied":
        night.denied[entry["item"]] = entry
    elif kind == "hold":
        night.held[entry["item"]] = entry
    elif kind == "wait":
        night.waits[entry["id"]] = entry
    elif kind == "decision" and "resolves" in entry:
        night.waits.pop(entry["resolves"], None)
    elif kind == "amend":
        if "reopen" in entry:
            night.denied.pop(entry["reopen"], None)
            night.held.pop(entry["reopen"], None)
        if "add_item" in entry:
            row = entry["add_item"]
            night.items.setdefault(row[0], (row[1], row[2] if len(row) > 2 else None, entry["id"]))
    elif kind == "report":
        night.reports.append(entry)
        night.pagechecks[entry["id"]] = {}
        night.made_old_by = []
    elif kind == "pagecheck":
        night.pagechecks.setdefault(entry["report"], {})[entry["name"]] = entry["outcome"]
    elif kind == "close" and night.close is None:
        night.close = entry
        night.phase = "closed"


def rule_order(night, entry):
    if night.last is None:
        found = [] if entry["kind"] == "new" else [("FIRST_NOT_NEW", f"it is {entry['kind']}")]
        return found + ([] if entry["id"] == 1 else [("ID_ORDER", f"the first id is {entry['id']}")])
    found = [("NEW_TWICE", f"{night.run}")] if entry["kind"] == "new" else []
    if entry["id"] != night.last["id"] + 1:
        found.append(("ID_ORDER", f"E{entry['id']} after E{night.last['id']}"))
    return found


def rule_clock(night, entry):
    test = entry.get("test") if entry["kind"] == "new" and night.last is None else night.test
    return [("FAKE_CLOCK", "")] if entry.get("fake_clock") and not test else []


def rule_time(night, entry):
    if night.last and entry_time(entry["t"]) < entry_time(night.last["t"]):
        return [("TIME_BACK", f"{entry['t']} is before E{night.last['id']} at {night.last['t']}")]
    return []


def rule_phase(night, entry):
    kind, phase = entry["kind"], night.phase
    if kind == "new" or phase == "none":
        return []
    if phase == "closed" and kind not in PHASE_KINDS["closed"]:
        return [("CLOSED", f"closed at E{night.close['id']}")]
    if kind == "go" and phase == "running":
        return [("GO_TWICE", f"E{night.go['id']}")]
    if phase == "prepared" and (kind not in PHASE_KINDS["prepared"] or "reopen" in entry or "add_item" in entry):
        return [("NOT_STARTED", "")]
    return []


def rule_words(night, entry):
    if entry["kind"] not in ("new", "amend", "answer"):
        return []
    if "words" not in entry:
        return [("WORDS_MISSING", "")]
    return [("WORDS_EMPTY", "")] if not entry["words"].strip() else []


def rule_action_allowed(night, entry):
    """For an intent, the final reasons come first: a retry cannot fix them."""
    if entry["kind"] != "intent" or night.go is None:
        return []
    if entry_time(entry["t"]) >= entry_time(night.go["stop"]):
        return [("AFTER_STOP", f"the stop time {night.go['stop']} has passed")]
    if night.go["rehearsal"] not in REHEARSALS_FOR_ACTION:
        return [("NO_REHEARSAL", f"the go says rehearsal {night.go['rehearsal']}")]
    if night.faults:
        return [("JOURNAL_FAULTS", ", ".join(f"E{i} {code}" for i, code, _ in night.faults[:5]))]
    return []


def card_names(night):
    return "the card names: " + ", ".join(night.items) if night.items else "the card has no items yet"


def rule_item_on_card(night, entry):
    names = []
    if entry["kind"] in ITEM_EVENTS and "item" in entry:
        names.append(entry["item"])
    if entry["kind"] == "amend" and "reopen" in entry:
        names.append(entry["reopen"])
    for name in names:
        if name not in night.items:
            return [("ITEM_NOT_ON_CARD", f"{name!r}; {card_names(night)}")]
    return []


def rows_problems(rows, known=(), same="ITEM_DUPLICATE"):
    """The problems of card rows. `known` holds the names already on the card; `same` is the code for a name twice."""
    found, seen = [], {name_key(name): name for name in known}
    for row in rows:
        name, kind, rest = row[0], row[1], row[2:]
        if not name or name != name.strip() or "|" in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
            found.append(("ITEM_NAME", repr(name)))
        if kind not in ITEM_KINDS:
            found.append(("ITEM_KIND", f"{name!r} has kind {kind!r}"))
        elif (kind == "commit") != bool(rest) or (rest and not OPTION.fullmatch(rest[0])):
            found.append(("ITEM_OPTION", f"{' | '.join(row)}"))
        if name_key(name) in seen:
            found.append((same, f"{name!r} and {seen[name_key(name)]!r}"))
        seen.setdefault(name_key(name), name)
    return found


def rule_go(night, entry):
    if entry["kind"] != "go":
        return []
    found = rows_problems(entry["items"]) if entry["items"] else [("ITEMS_EMPTY", "")]
    if entry_time(entry["stop"]) <= entry_time(entry["t"]):
        found.append(("GO_STOP_NOT_FUTURE", f"stop {entry['stop']}, now {entry['t']}"))
    if entry["heartbeat_min"] <= 0:
        found.append(("HEARTBEAT_NOT_POSITIVE", f"{entry['heartbeat_min']}"))
    limit = min(entry["max_gap_min"], DEFAULT_MAX_GAP_MIN)
    if entry["gap_min"] > limit:
        found.append(("GAP_TOO_HIGH", f"it is {entry['gap_min']} min; it must be at most {limit} min. "
                                      f"Use a heartbeat of at most {limit // 2} min, or a lower --gap-min"))
    if entry["gap_min"] < entry["heartbeat_min"]:
        found.append(("GAP_BELOW_HEARTBEAT", f"gap {entry['gap_min']} min, heartbeat {entry['heartbeat_min']} min"))
    return found


def rule_amend(night, entry):
    if entry["kind"] != "amend":
        return []
    found = []
    if "reopen" in entry and entry["reopen"] in night.items:
        if entry["reopen"] not in night.denied and entry["reopen"] not in night.held:
            found.append(("REOPEN_NOT_BLOCKED", repr(entry["reopen"])))
    if "add_item" in entry:
        found.extend(rows_problems([entry["add_item"]], night.items, "ITEM_ON_CARD"))
    return found


def rule_intent(night, entry):
    if entry["kind"] != "intent" or entry["item"] not in night.items:
        return []
    item = entry["item"]
    kind, option, _ = night.items[item]
    if kind == "owner":
        return [("OWNER_ITEM", repr(item))]
    if item in night.denied:
        return [("ITEM_DENIED", f"{item!r} at E{night.denied[item]['id']}")]
    if item in night.held:
        return [("ITEM_HELD", f"{item!r} at E{night.held[item]['id']}")]
    latest = night.latest.get(item)
    if latest is not None:
        last_result = night.results.get(latest)
        if last_result is None:
            before = night.intents[latest]
            return [("OPEN_INTENT", f"E{latest} at {before['t']}: `{before.get('command', '')}` has no result")]
        if last_result["outcome"] == "unknown":
            return [("UNKNOWN_RESULT", f"E{last_result['id']} on E{latest} is unknown")]
    if not entry.get("command", "").strip():
        return [("INTENT_FIELDS", "")]
    command = entry["command"]
    if kind == "commit":
        if "head" not in entry or "no_head" in entry:
            return [("COMMIT_NEEDS_HEAD", repr(item))]
        if option is None:  # only a hand-written journal has a commit row with no option (go refuses it)
            return [("HEAD_OPTION_MISSING", f"the card row of {item!r} names no head-match option")]
        if not FULL_SHA.fullmatch(entry["head"]):
            return [("HEAD_FORM", repr(entry["head"]))]
        if not re.search(rf"(?<![\w-]){re.escape(option)}(?:=|\s+){entry['head']}(?![0-9A-Fa-f])", command):
            return [("HEAD_OPTION_MISSING", f"the command needs `{option} {entry['head']}`")]
        return []
    if "head" in entry:
        return [("NO_COMMIT_HAS_HEAD", repr(item))]
    if not entry.get("no_head", "").strip():
        return [("NO_COMMIT_NEEDS_REASON", repr(item))]
    if ANY_SHA.search(command):
        return [("NO_COMMIT_HAS_SHA", repr(item))]
    return []


def rule_result(night, entry):
    if entry["kind"] != "result":
        return []
    if entry["of"] not in night.intents:
        return [("RESULT_NOT_INTENT", f"E{entry['of']}")]
    before = night.results.get(entry["of"])
    if before and before["outcome"] in FINAL_OUTCOMES:
        return [("RESULT_FINAL", f"E{before['id']}: {before['outcome']}")]
    if entry["outcome"] == "denied" and not entry.get("blocks", "").strip():
        return [("DENIED_NEEDS_BLOCKS", "")]
    return []


def rule_rows(night, entry):
    kind = entry["kind"]
    if kind == "denied":
        if not entry.get("command", "").strip() or not entry.get("blocks", "").strip():
            return [("DENIED_FIELDS", "")]
        latest = night.latest.get(entry["item"])
        if latest is not None and latest not in night.results:
            return [("DENIED_OPEN_INTENT", f"E{latest}")]
    if kind in ("hold", "wait", "decision", "aware", "error") and not entry.get("text", "").strip():
        return [("TEXT_MISSING", kind)]
    if kind == "decision":
        if not entry.get("source", "").strip() and not entry.get("check"):
            return [("DECISION_SOURCE", "")]
        if "resolves" in entry and entry["resolves"] not in night.waits:
            return [("RESOLVES_NOT_OPEN_WAIT", f"E{entry['resolves']}")]
    return []


def report_fresh(night, found):
    report = night.newest_report()
    if report is None:
        found.append(("REPORT_NONE_YET", ""))
    elif night.made_old_by:
        found.append(("REPORT_OLD", f"E{report['id']} is older than " + ", ".join(f"E{e['id']}" for e in night.made_old_by[:5])))
    return found


def rule_report_close(night, entry):
    kind = entry["kind"]
    if kind == "pagecheck":
        report = night.newest_report()
        if report and entry["report"] != report["id"]:
            return [("PAGECHECK_REPORT", f"the newest report is E{report['id']}")]
        return report_fresh(night, [])
    if kind == "close":
        pending = night.open_intents()
        if pending:
            return [("CLOSE_OPEN_INTENT", ", ".join(f"E{e['id']} {e['item']}" for e in pending))]
        found = report_fresh(night, [])
        if not found and not entry.get("without_page", "").strip():
            checks = night.pagechecks.get(night.newest_report()["id"], {})
            missing = [name for name in PAGE_CHECKS if checks.get(name) != "pass"]
            if missing:
                found.append(("PAGE_CHECKS", "not passed: " + ", ".join(missing)))
        return found
    if kind == "report" and entry["counts"] != counts_with(night, "report"):
        return [("COUNTS_WRONG", f"the journal gives {counts_with(night, 'report')}")]
    return []


RULES = (rule_order, rule_clock, rule_time, rule_phase, rule_words, rule_action_allowed, rule_item_on_card, rule_go,
         rule_amend, rule_intent, rule_result, rule_rows, rule_report_close)


def judge(night, entry):
    """All rule problems of one new entry against the state before it."""
    found = []
    for rule in RULES:
        found.extend(rule(night, entry))
    return found


def fold(entries):
    night = Night()
    for entry in entries:
        for code, detail in judge(night, entry):
            night.faults.append((entry["id"], code, detail))
        apply(night, entry)
    return night


def counts_with(night, kind):
    counts = dict(night.counts)
    counts[kind] = counts.get(kind, 0) + 1
    return counts
