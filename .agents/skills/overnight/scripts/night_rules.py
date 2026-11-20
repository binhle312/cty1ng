"""The state of a night (the fold) and the rules on each entry. Pure: no file, no clock, no environment."""

from night_format import (
    DEFAULT_MAX_GAP_MIN, FINAL_OUTCOMES, ITEM_EVENTS, ITEM_KINDS, KEEPS_REPORT_FRESH, PAGE_CHECKS,
    PHASE_KINDS, REHEARSALS_FOR_ACTION, Refused, FULL_SHA, LABEL, iso, schema_problem, MERGE_METHODS, entry_time, parsed_target, target_key, valid_base)

from night_review import CHIEF_EVENTS, accepted_findings, grant_findings, owned_scope, review_problem, task_for


def name_key(name):
    return " ".join(name.split()).casefold()


class Night:
    """The state that the journal entries make. `apply` changes it; it holds no rules."""

    def __init__(self):
        self.phase = "none"
        self.run = self.words = self.go = self.close = self.last = None
        self.test = False
        self.merge_rows = {}    # target -> typed card row
        self.assignments = {}
        self.task_specs = {}
        self.plans = {}
        self.review_starts = {}
        self.reviews = {}
        self.rulings = {}
        self.advice = {}
        self.pending_grant = None
        self.grants = {}
        self.granted = set()
        self.active_grants = {}
        self.capped = {}
        self.review_pairs = {}
        self.items = {}         # exact name -> (kind, source entry id)
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

    def add_item(self, row, where):
        self.items.setdefault(row[0], (row[1], where))
        if row[1] == "merge" and not merge_row_problem(row):
            self.merge_rows.setdefault(target_key(row[2]), row)

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
        night.task_specs.update(entry["tasks"])
        for row in entry["items"]:
            night.add_item(row, entry["id"])
    elif kind == "intent":
        night.intents[entry["id"]] = entry
        night.latest[entry["item"]] = entry["id"]
    elif kind == "result" and entry["of"] in night.intents:
        night.results[entry["of"]] = entry
        if entry["outcome"] == "denied":
            night.denied[night.intents[entry["of"]]["item"]] = entry
    elif kind == "denied":
        night.denied[entry["item"]] = entry
        invalidate_held(night, entry["item"])
    elif kind == "hold":
        night.held[entry["item"]] = entry
        invalidate_held(night, entry["item"])
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
            night.add_item(row, entry["id"])
            night.task_specs.update(entry.get("tasks", {}))
    elif kind == "assign":
        night.assignments[entry["target"]] = entry
        night.active_grants.pop(entry["target"], None)
    elif kind == "plan":
        night.plans[entry["target"]] = entry
    elif kind == "review-start":
        night.review_starts[entry["target"]] = entry
    elif kind == "ruling":
        night.rulings[(entry["review"], entry["source"], entry["finding"])] = entry["severity"]
        review = night.reviews[entry["target"]]
        start = night.review_starts[entry["target"]]
        findings = accepted_findings(night, review)
        if len(night.review_pairs[entry["target"]]) >= start["cap"]:
            if findings["p1"] or findings["p2"]:
                spec = dict(done=f"Reviewed {start['head']}", next="The owner decides the next work",
                            findings=[dict(severity=level.upper(), text=text)
                                      for level, texts in findings.items() for text in texts])
                night.capped[entry["target"]] = dict(review, spec=spec)
            else:
                night.capped.pop(entry["target"], None)
    elif kind == "advice":
        night.advice[entry["review"]] = entry
    elif kind in ("confirm", "withdraw"):
        night.pending_grant = None
        night.active_grants.pop(entry["target"], None)
    elif kind == "merge-permission":
        night.pending_grant = entry["id"]
        night.granted.add((entry["target"], entry["head"]))
        night.grants[entry["id"]] = entry
        night.active_grants[entry["target"]] = entry["id"]
    elif kind == "merge-invalidate":
        night.active_grants.pop(entry["target"], None)
    elif kind in ("review", "cap"):
        night.reviews[entry["target"]] = entry
        night.review_pairs.setdefault(entry["target"], set()).add(review_key(entry))
        if kind == "cap":
            night.capped[entry["target"]] = entry
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
    if entry["kind"] not in ("intent", "merge-permission", "review-start", "assign", "plan") or night.go is None:
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


def merge_row_problem(row):
    if len(row) != 6 or not parsed_target(row[2]) or not valid_base(row[3]) or row[4] not in MERGE_METHODS:
        return True
    return not LABEL.fullmatch(row[5])


def rows_problems(rows, known=(), same="ITEM_DUPLICATE", targets=()):
    found, seen = [], {name_key(name): name for name in known}
    targets = set(targets)
    for row in rows:
        name, kind = row[:2]
        if not name or name != name.strip() or "|" in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
            found.append(("ITEM_NAME", repr(name)))
        if kind not in ITEM_KINDS:
            found.append(("ITEM_KIND", f"{name!r} has kind {kind!r}"))
        elif kind == "merge":
            if merge_row_problem(row):
                found.append(("MERGE_TARGET_FORM", repr(row)))
            else:
                target = target_key(row[2])
                if target in targets:
                    found.append(("ITEM_DUPLICATE", target))
                targets.add(target)
        elif len(row) != 2:
            found.append(("ITEM_LINE", repr(row)))
        if name_key(name) in seen:
            found.append((same, f"{name!r} and {seen[name_key(name)]!r}"))
        seen.setdefault(name_key(name), name)
    return found


def invalidate_held(night, item):
    for target, row in night.merge_rows.items():
        if row[0] == item:
            night.active_grants.pop(target, None)


def rule_go(night, entry):
    if entry["kind"] != "go":
        return []
    found = rows_problems(entry["items"]) if entry["items"] else [("ITEMS_EMPTY", "")]
    if entry["run"] != night.run:
        found.append(("MERGE_PERMISSION_NIGHT", "go"))
    if entry["review_cap"] <= 0 or entry.get("merge_main_bonus", 0) < 0:
        found.append(("REVIEW_CAP_FORM", ""))
    if any(row[1] == "merge" for row in entry["items"]) and (
            not LABEL.fullmatch(entry["chief"]) or "review_policy" not in entry):
        found.append(("MERGE_NOT_ALLOWED", "a merge row needs the chief and approved review policy"))
    if set(entry["tasks"]) != {target_key(row[2]) for row in entry["items"] if row[1] == "merge"}:
        found.append(("REVIEW_OWNER_TASK", "every merge target needs a task spec"))
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
    row = entry.get("add_item")
    if row:
        found.extend(rows_problems([row], night.items, "ITEM_ON_CARD", night.merge_rows))
    target = {target_key(row[2])} if row and row[1] == "merge" and not found else set()
    if not found and set(entry.get("tasks", {})) != target:
        found.append(("REVIEW_OWNER_TASK", "an amended merge target needs a task spec"))
    return found


def rule_intent(night, entry):
    if entry["kind"] != "intent" or entry["item"] not in night.items:
        return []
    item = entry["item"]
    kind, _ = night.items[item]
    if kind == "owner":
        return [("OWNER_ITEM", repr(item))]
    if kind == "merge":
        return [("MERGE_NOT_ALLOWED", "use the typed merge command")]
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


def review_key(entry):
    return tuple((r["head"], r["source"]) for r in entry["reports"])


def review_kind(night, entry):
    blocked = any(r["p1"] or r["p2"] for r in entry["reports"])
    cap = night.review_starts[entry["target"]]["cap"]
    return "cap" if blocked and len(night.review_pairs.get(entry["target"], ())) + 1 >= cap else "review"


def tier_allowed(go, pair):
    policy = go.get("review_policy")
    if not policy:
        return False
    # The card records the approved provider/model/effort for this run. Roles resolve to that same tuple.
    for actual, allowed in zip(pair, policy["allowed"]):
        if any(actual[key] != allowed[key] for key in ("provider", "model", "effort")):
            return False
        if actual["role"] and policy["roles"].get(f"{actual['provider']}:{actual['role']}") != actual:
            return False
    return True


def merge_item(night, target, leader=None):
    row = night.merge_rows.get(target)
    if not row:
        return "MERGE_PR_NOT_ON_CARD"
    if leader is not None and leader != night.assignments.get(target, {}).get("leader", row[5]):
        return "MERGE_LEADER_ONLY"
    name = row[0]
    if target in night.capped:
        return "REVIEW_CAP_REACHED"
    if name in night.denied:
        return "ITEM_DENIED"
    if name in night.held:
        return "ITEM_HELD"
    return None


def rule_merge(night, entry):
    kind = entry["kind"]
    if kind == "timer":
        return [] if entry["run"] == night.run else [("MERGE_PERMISSION_NIGHT", "timer")]
    if problem := review_problem(night, entry):
        return [(problem, entry.get("target", ""))]
    if kind not in ("assign", "merge-permission", "review", "cap", "merge-invalidate") or night.go is None:
        return []
    target = entry["target"]
    if not parsed_target(target) or target_key(target) != target:
        return [("MERGE_TARGET_FORM", repr(target))]
    problem = merge_item(night, target, None if kind == "assign" and target in night.assignments else entry.get("leader"))
    if problem:
        return [(problem, target)]
    if kind in ("assign", "merge-permission"):
        if entry["run"] != night.run:
            return [("MERGE_PERMISSION_NIGHT", target)]
        if entry["chief"] != night.go["chief"]:
            return [("MERGE_CHIEF_ONLY", target)]
    if kind == "assign":
        previous = night.assignments.get(target)
        task = task_for(night, target)
        if not task or task["class"] == "owner":
            return [("REVIEW_OWNER_TASK", target)]
        if previous and (entry["leader"] != previous["leader"] or "replaces" in entry) and (
                entry.get("replaces") != previous["id"] or not entry.get("released", "").strip()):
            return [("REVIEW_REPLACEMENT", target)]
        if previous and night.pending_grant in night.grants and night.grants[night.pending_grant]["target"] == target:
            return [("MERGE_PENDING", target)]
        if (not tier_allowed(night.go, entry["reviewers"]) or not entry["worktree"].startswith("/")
                or entry["chief"] == entry["leader"]):
            return [("REVIEWER_NOT_ASSIGNED", target)]
        if target in night.assignments and entry["worktree"] != night.assignments[target]["worktree"]:
            return [("MERGE_NOT_ALLOWED", "replacement reviewers must use the original worktree")]
        if any(pr != target and (e["leader"] == entry["leader"] or e["worktree"] == entry["worktree"])
               for pr, e in night.assignments.items()):
            return [("MERGE_NOT_ALLOWED", "each PR needs its own leader and worktree")]
        return []
    assignment = night.assignments.get(target)
    if kind == "merge-permission":
        task = task_for(night, target)
        if not task or task["class"] == "owner":
            return [("REVIEW_OWNER_TASK", target)]
        if night.pending_grant is not None:
            return [("MERGE_PENDING", target)]
        review = night.reviews.get(target)
        start = night.review_starts.get(target)
        if (not review or not start or review["start"] != start["id"] or review["id"] != entry.get("review")
                or start["head"] != entry["head"] or start["base_sha"] != entry.get("review_base")
                or start["assignment"] != entry["assignment"] or start["plan_check"] != night.plans[target]["id"]):
            return [("REVIEW_START_REQUIRED", target)]
        if entry["files"] != start["files"] or not owned_scope(night, target, entry["files"]):
            return [("REVIEW_SCOPE", target)]
        try:
            if grant_findings(night, review) != entry["evidence"]["p3"]:
                return [("REVIEW_REPORT", target)]
        except Refused as error:
            return [(error.code, target)]
        if not FULL_SHA.fullmatch(entry["head"]):
            return [("HEAD_FORM", repr(entry["head"]))]
        if entry["base"] != night.merge_rows[target][3] or entry["method"] != night.merge_rows[target][4]:
            return [("MERGE_NOT_ALLOWED", target)]
        if (not assignment or entry["assignment"] != assignment["id"]
                or entry["reviewers"] != assignment["reviewers"]):
            return [("REVIEWER_NOT_ASSIGNED", target)]
        if (target, entry["head"]) in night.granted:
            return [("MERGE_PERMISSION_DUPLICATE", target)]
    if kind in ("review", "cap"):
        reports = entry["reports"]
        if (not assignment or [r["who"] for r in reports] != assignment["reviewers"]
                or len({r["head"] for r in reports}) != 1 or len({r["source"] for r in reports}) != 2):
            return [("REVIEWER_NOT_ASSIGNED", target)]
        if review_key(entry) in night.review_pairs.get(target, ()):
            return [] if kind == "review" else [("REVIEW_CAP_FORM", "a replayed pair cannot stop a PR")]
        if kind != review_kind(night, entry):
            return [("REVIEW_CAP_FORM", "the record must match the frozen cap and findings")]
    if kind == "merge-invalidate" and night.active_grants.get(target) != entry["grant"]:
        return [("MERGE_PERMISSION_INACTIVE", target)]
    return []


RULES = (rule_order, rule_clock, rule_time, rule_phase, rule_words, rule_action_allowed, rule_item_on_card, rule_go,
         rule_amend, rule_intent, rule_result, rule_rows, rule_report_close, rule_merge)


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
        if not night.faults or night.faults[-1][0] != entry["id"] or entry["kind"] not in (
                "assign", "merge-permission", "merge-invalidate", *CHIEF_EVENTS):
            apply(night, entry)
        else:
            night.last = entry
    return night


def counts_with(night, kind):
    counts = dict(night.counts)
    counts[kind] = counts.get(kind, 0) + 1
    return counts


def pending_attempt(records):
    done = {e["of"] for e in records if e["kind"] == "merge-result" and e["outcome"] != "unknown"}
    return any(e["kind"] == "merge-attempt" and e["id"] not in done for e in records)


def check_grant(night, args, target, entry_id, now, fake):
    if fake and not night.test:
        raise Refused("FAKE_CLOCK")
    if night.last and now < entry_time(night.last["t"]):
        raise Refused("TIME_BACK")
    if night.faults:
        raise Refused("JOURNAL_FAULTS")
    if night.close:
        raise Refused("CLOSED")
    if not night.go:
        raise Refused("NOT_STARTED")
    if now >= entry_time(night.go["stop"]):
        raise Refused("AFTER_STOP")
    if night.go["rehearsal"] == "none":
        raise Refused("NO_REHEARSAL")
    if problem := merge_item(night, target, args.leader):
        raise Refused(problem)
    if args.run != night.run:
        raise Refused("MERGE_PERMISSION_NIGHT")
    if not (grant := night.grants.get(entry_id)):
        raise Refused("MERGE_PERMISSION_MISSING")
    if grant["target"] != target:
        raise Refused("MERGE_PERMISSION_PR")
    if grant["head"] != args.head:
        raise Refused("MERGE_PERMISSION_HEAD")
    return grant
