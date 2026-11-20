"""The journal format of night.py: the constants, the codes and the shape of each entry. Pure: no file, no clock, no environment."""

import json
import re
from datetime import datetime, timedelta, timezone

JOURNAL = "journal.jsonl"

CARD = "card.md"

REPORT = "report.md"

LOCK = "journal.lock"

FORMAT = 4

DEFAULT_READY_READS = 5
DEFAULT_READY_DELAY_S = 3
DEFAULT_REVIEW_CAP = 5
DEFAULT_MERGE_MAIN_BONUS = 3
MERGE_METHODS = ("merge", "squash", "rebase")
MERGE_KINDS = ("assign", "merge-permission", "review", "cap", "merge-invalidate", "audit", "timer",
               "plan", "review-start", "ruling", "advice", "confirm", "withdraw")

DEFAULT_HEARTBEAT_MIN = 30

DEFAULT_MAX_GAP_MIN = 60

DEFAULT_LOCK_WAIT_S = 10.0

DEFAULT_LOCK_STALE_S = 60.0

LOG_KINDS = ("alive", "aware", "error", "reserve", "decision", "intent", "result", "denied", "hold", "wait",
             "amend", "answer", "pagecheck")

KINDS = ("new", "go", "report", "close", "repair") + LOG_KINDS + MERGE_KINDS

OUTCOMES = ("done", "failed", "unknown", "denied")


FINAL_OUTCOMES = ("done", "failed", "denied")


GOALS = ("set", "no-goal-command")


REHEARSALS = ("passed", "owner-override", "none")


REHEARSALS_FOR_ACTION = ("passed", "owner-override")


CLOSE_REASONS = ("goal-met", "nothing-left", "stop-time", "stopped")


PAGE_CHECKS = ("mechanics", "truth", "counts")


PAGE_OUTCOMES = ("pass", "fail")


ITEM_KINDS = ("night", "owner", "merge")


KEEPS_REPORT_FRESH = ("pagecheck", "alive")


ITEM_EVENTS = ("intent", "denied", "hold", "wait", "decision", "aware", "error", "reserve")


PHASE_KINDS = {
    "prepared": {"go", "alive", "aware", "error", "reserve", "decision", "amend", "repair"},
    "running": set(LOG_KINDS + MERGE_KINDS) | {"report", "close", "repair"},
    "closed": {"aware", "error", "answer", "repair"},
}


HOST = r"(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?"
TARGET = re.compile(rf"({HOST})/([A-Za-z0-9][A-Za-z0-9-]*)/([A-Za-z0-9_][A-Za-z0-9_.-]*)#([1-9][0-9]{{0,9}})")
LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")
RUN_ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
FULL_SHA = re.compile(r"[0-9a-f]{40}")


FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")


# code: (class, message). "final" = do not retry; "fix" = correct the input and run again.
CODES = {
    "REVIEW_OWNER_TASK": ("fix", "the task needs the owner under the project rules"),
    "REVIEW_PLAN_REQUIRED": ("fix", "the chief must check the plan and test strategy first"),
    "REVIEW_START_REQUIRED": ("fix", "the chief must start this review of the pushed head"),
    "REVIEW_CHECKOUT": ("fix", "use a clean detached checkout of the pushed head"),
    "REVIEW_REPORT": ("fix", "the original report or its verdict does not match the review"),
    "REVIEW_SCOPE": ("fix", "the live PR diff is incomplete or includes a file outside the owned paths"),
    "REVIEW_FINDINGS_OPEN": ("fix", "fix the open findings and ask for a new round"),
    "REVIEW_ADVICE_REQUIRED": ("fix", "record the required advisor and consultant answers"),
    "REVIEW_REPLACEMENT": ("fix", "record the old assignment and the release of its writer"),
    "MERGE_NOT_CONFIRMED": ("fix", "GitHub has not confirmed the grant's merge on main"),
    # Before an entry exists (PRE_EVENT_CODES).
    "NO_NIGHT": ("fix", "no night in this folder: run `new` first"),
    "FORMAT_UNSUPPORTED": ("final", f"use the writer revision of this journal or start a new format {FORMAT} night"),
    "REPAIR_PENDING": ("final", "a repair is staged or has an invalid side record; check the repair before further writes"),
    "REVIEW_CAP_FORM": ("fix", "the review cap must be a positive integer"),
    "REVIEW_CAP_REACHED": ("final", "this PR reached the review cap; the owner decides the next step"),
    "MERGE_TARGET_FORM": ("fix", "use host/owner/repository#PR and a valid base, method and leader"),
    "HEAD_FORM": ("fix", "use the full 40-character lowercase GitHub SHA"),
    "MERGE_PR_NOT_ON_CARD": ("final", "the frozen card does not name this PR"),
    "MERGE_NOT_ALLOWED": ("final", "the card does not allow this merge method, base or assignment"),
    "MERGE_CHIEF_ONLY": ("final", "the chief label differs from the frozen card"),
    "MERGE_LEADER_ONLY": ("final", "the leader label differs from the frozen card"),
    "MERGE_JOURNAL_PATH": ("final", "the journal path differs from the canonical path fixed at dispatch"),
    "LEADER_JOURNAL_GAP": ("final", "the dispatch journal is missing or its init differs; reconcile before further writes"),
    "MERGE_EVIDENCE_INVALID": ("fix", "provide complete review, CI, ledger and P3 evidence"),
    "MERGE_PERMISSION_DUPLICATE": ("final", "this PR and head already have a grant"),
    "MERGE_PERMISSION_MISSING": ("fix", "the chief journal has no such grant"),
    "MERGE_PERMISSION_NIGHT": ("final", "the permission belongs to a different night"),
    "MERGE_PERMISSION_PR": ("final", "the permission belongs to a different PR"),
    "MERGE_PERMISSION_HEAD": ("final", "the expected head differs from the granted head"),
    "MERGE_PERMISSION_INACTIVE": ("final", "a replacement, hold or denial ended this grant"),
    "MERGE_PERMISSION_USED": ("final", "an attempt already consumed this grant"),
    "MERGE_PENDING": ("retry", "reconcile the reserved PR before requesting another grant"),
    "MERGE_READ_FAILED": ("final", "GitHub did not provide a valid PR or repository read"),
    "MERGE_PR_INELIGIBLE": ("final", "GitHub state or project policy bars a direct merge"),
    "MERGE_EFFECT_UNCLEAR": ("final", "the merge effect could not be established"),
    "MERGE_CI_UNKNOWN": ("final", "the effective required checks or their source could not be established"),
    "MERGE_CI_NOT_GREEN": ("final", "a required check on the granted head is not green"),
    "MERGE_HEAD_CHANGED": ("final", "GitHub reported a different PR head"),
    "MERGE_READY_FAILED": ("final", "the Ready request failed or its outcome is unknown"),
    "MERGE_REQUEST_BUDGET": ("final", "the attempt exhausted its GitHub request budget"),
    "MERGE_REJECTED": ("final", "GitHub refused the merge request"),
    "MERGE_OUTCOME_UNKNOWN": ("final", "read back both journals and GitHub before any further action"),
    "CLEAN_ASSIGNMENT": ("fix", "use the fixed paths and branch of the chief dispatch"),
    "CLEAN_REPO": ("fix", "the Git repository identity differs from the dispatch"),
    "CLEAN_CWD": ("fix", "run the installed tool from outside the assigned worktree"),
    "CLEAN_NO_MERGE": ("fix", "this leader journal has no single proven merge result"),
    "CLEAN_GITHUB": ("fix", "GitHub did not provide a definite cleanup check"),
    "CLEAN_PR_NOT_MERGED": ("fix", "GitHub has not confirmed that this PR is merged"),
    "CLEAN_PR_SCOPE": ("fix", "the PR branch, repository or leader differs from the dispatch"),
    "CLEAN_PR_HEAD": ("fix", "the PR head or merge commit differs from the journal"),
    "CLEAN_DEFAULT_BRANCH": ("fix", "a default or protected branch name cannot be cleaned"),
    "CLEAN_OPEN_HEAD": ("fix", "an open PR uses the head branch"),
    "CLEAN_WORKTREE": ("fix", "Git could not verify or remove the assigned worktree"),
    "CLEAN_OUTPUT_MOUNT": ("fix", "an output mount or another device prevents worktree removal"),
    "CLEAN_WORKTREE_DIRTY": ("fix", "the worktree has changes outside recorded temp files"),
    "CLEAN_LOCAL_IN_USE": ("fix", "a worktree still has the branch checked out"),
    "CLEAN_LOCAL_HEAD": ("fix", "the local ref differs from the merged head or the delete failed"),
    "CLEAN_REMOTE_PROTECTED": ("fix", "GitHub reports protection on the head branch"),
    "CLEAN_REMOTE_HEAD": ("fix", "the remote ref differs from the merged head"),
    "CLEAN_REMOTE_URL": ("fix", "Git config rewrites the exact PR repository URL"),
    "CLEAN_REMOTE_PUSH": ("fix", "Git did not confirm the leased remote deletion"),
    "CLEAN_TEMP_SCOPE": ("fix", "the file is outside its allowed paths or is tracked"),
    "CLEAN_TEMP_IDENTITY": ("fix", "the file identity or content differs from the temp record"),
    "CLEAN_TEMP_ACTOR": ("fix", "the actor is not the assigned leader or a recorded helper"),
    "CLEAN_TEMP_RECORD": ("fix", "the temp file is already recorded or cleanup has started"),
    "CLEAN_INTERRUPTED": ("fix", "an earlier cleanup intent still needs evidence"),
    "CLEAN_GIT": ("fix", "Git did not provide a definite cleanup check"),
    "CLEAN_FILE": ("fix", "the temp file could not be checked or removed"),
    "REVIEWER_NOT_ASSIGNED": ("fix", "use the current chief assignment and obtain matching reports"),
    "BAD_ARGUMENT": ("fix", "an argument has bytes that are not UTF-8"),
    "WORDS_FILE": ("fix", "the words file cannot be read as UTF-8 text"),
    "WORDS_AS_ARGUMENT": ("fix", "the owner's exact words go in only through --words-file, not as an argument"),
    "ARG_NOT_FOR_KIND": ("fix", "this kind of entry does not take this option"),
    "ITEM_MISSING": ("fix", "this kind of entry needs --item <exact card name>"),
    "ITEM_LINE": ("fix", "use `name | night`, `name | owner` or `name | merge | target | base | method | leader`"),
    "EVENT_ID": ("fix", "an entry id is a number such as 12 or E12"),
    "RESULT_FIELDS": ("fix", "a result needs --of <intent id> and --outcome done, failed, unknown or denied"),
    "PAGECHECK_FIELDS": ("fix", "a page check needs --name mechanics, truth, counts, --outcome pass or fail, and --report E<n>"),
    "CARD_MISSING": ("fix", "card.md is missing or cannot be read in the night folder"),
    "CARD_NO_BLOCK": ("fix", "card.md has no night-items block"),
    "CARD_TWO_BLOCKS": ("fix", "card.md has more than one night-items block; keep one"),
    "CARD_OPEN_FENCE": ("fix", "card.md has a code fence with no end"),
    "MAX_GAP_ENV": ("fix", f"NIGHT_MAX_GAP_MIN must be a whole number from 1 to {DEFAULT_MAX_GAP_MIN}"),
    "FAKE_CLOCK_NO_TEST": ("fix", "NIGHT_FAKE_NOW works only with NIGHT_TEST_MODE=1"),
    "FAKE_CLOCK_FORM": ("fix", "NIGHT_FAKE_NOW must be a full ISO time with an offset"),
    "LOCK_HELD": ("fix", "another night.py holds the journal lock; run the command again"),
    "LOCK_STALE": ("final", "the journal lock looks stale, and night.py never removes it"),
    "TORN_LINE": ("fix", "the journal ends in a cut line (no newline at its end); run `repair`"),
    "BAD_LINE": ("final", "a journal line is not one JSON object"),
    "SCHEMA": ("final", "a journal entry has a bad shape"),
    "REPAIR_NOTHING": ("fix", "the journal ends with a full line and each side file has its entry: there is nothing to repair"),
    "STOP_NO_OFFSET": ("fix", "--stop needs its offset: `YYYY-MM-DDTHH:MM+07:00` or `HH:MM+07:00` (the zone of the card, "
                              "not of this computer)"),
    "ID_NOT_REPORT": ("fix", "this entry is not a report entry"),
    "WRITE_FAILED": ("final", "a file write failed; read back under lock before deciding what happened"),
    "INTERNAL": ("final", "an unexpected error in night.py; run `check` and tell the owner"),
    # Rules on an entry (the same for a live command and for the fold in `check`).
    "FIRST_NOT_NEW": ("final", "the first journal entry is not `new`"),
    "NEW_TWICE": ("final", "this folder already has a journal. One folder holds one night"),
    "ID_ORDER": ("final", "an entry id is not the id before it plus 1"),
    "FAKE_CLOCK": ("final", "a fake clock time in a journal that is not a test journal"),
    "TIME_BACK": ("fix", "time goes back: the time is earlier than the entry before it; check the clock"),
    "CLOSED": ("final", "the night is closed; after the close only aware, error and answer entries"),
    "GO_TWICE": ("final", "this night already has a go"),
    "NOT_STARTED": ("fix", "no go yet: this needs a running night"),
    "WORDS_MISSING": ("fix", "this needs the owner's exact words through --words-file"),
    "WORDS_EMPTY": ("fix", "the words file is empty; it must hold the owner's exact words"),
    "ITEMS_EMPTY": ("fix", "the night-items block has no rows"),
    "ITEM_NAME": ("fix", "an item name must not be empty, must have no spaces at its ends, no `|` and no control characters"),
    "ITEM_KIND": ("fix", "an item kind is night, owner or merge"),
    "ITEM_DUPLICATE": ("fix", "two card names are the same or differ only in case or spaces"),
    "ITEM_ON_CARD": ("fix", "this name, or a name that differs from it only in case or spaces, is already on the card"),
    "ITEM_NOT_ON_CARD": ("fix", "the item is not an exact name from the card"),
    "REOPEN_NOT_BLOCKED": ("fix", "--reopen names an item with no open denial and no hold"),
    "GO_STOP_NOT_FUTURE": ("fix", "the stop time is not in the future"),
    "HEARTBEAT_NOT_POSITIVE": ("fix", "the heartbeat must be more than 0 minutes"),
    "GAP_TOO_HIGH": ("fix", "the gap alarm is too high"),
    "GAP_BELOW_HEARTBEAT": ("fix", "the gap alarm must be at least the heartbeat"),
    "AFTER_STOP": ("final", "an intent after the stop time: the stop time has passed, no new action"),
    "NO_REHEARSAL": ("final", "no passed rehearsal and no owner override: no action at night"),
    "JOURNAL_FAULTS": ("final", "the journal breaks a rule (run `check`): no new action until the owner looks"),
    "OWNER_ITEM": ("final", "this item stays for the owner: no action at night"),
    "ITEM_DENIED": ("final", "an intent on an item which was denied: denied stays denied until the owner's --reopen"),
    "ITEM_HELD": ("final", "an intent on an item which was held: hold stays hold until the owner's --reopen"),
    "UNKNOWN_RESULT": ("final", "the last result on this item is unknown: check the real state and log a new result first"),
    "OPEN_INTENT": ("fix", "an intent on this item has no result: log its result first (run `status`)"),
    "INTENT_FIELDS": ("fix", "an intent needs --command"),
    "RESULT_NOT_INTENT": ("fix", "--of must name an intent"),
    "RESULT_FINAL": ("final", "this intent already has the result"),
    "DENIED_NEEDS_BLOCKS": ("fix", "a denied result needs --blocks <what it blocks>"),
    "DENIED_FIELDS": ("fix", "a denied row with no exact command or no blocks needs --command and --blocks"),
    "DENIED_OPEN_INTENT": ("fix", "this item has an open intent: log the denial as its result with --outcome denied"),
    "TEXT_MISSING": ("fix", "this kind of entry needs a text; a hold or a wait needs --item and the reason"),
    "DECISION_SOURCE": ("fix", "a decision with no source and no owner check needs --source <rule> or --check"),
    "RESOLVES_NOT_OPEN_WAIT": ("fix", "--resolves must name an open wait row"),
    "REPORT_NONE_YET": ("fix", "no report yet: run `report` first"),
    "REPORT_OLD": ("fix", "the newest report is older than later entries: run `report` again"),
    "PAGECHECK_REPORT": ("fix", "--report must name the newest report"),
    "PAGE_CHECKS": ("fix", "the newest page checks of the newest report are not all pass (mechanics, truth, counts); "
                           "or give --without-page <reason>"),
    "CLOSE_OPEN_INTENT": ("fix", "intents with no result: check the real state and log each result first"),
    "COUNTS_WRONG": ("final", "the counts of the report entry do not match the journal"),
    # Problems that only `check` finds (STATE_CODES).
    "NO_GO": ("fix", "no go: the owner did not start the night"),
    "INTENT_NO_RESULT": ("fix", "an intent has no result: check the real state and log its result"),
    "GAP": ("fix", "a silent stretch is longer than the gap alarm"),
    "STOP_NOT_CLOSED": ("fix", "the stop time has passed and the night is not closed: close it"),
    "REPORT_FILE": ("fix", "report.md does not match the journal: run `render`"),
    "CUT_UNRECORDED": ("fix", "a side file of cut bytes has no repair entry (a crash after the cut): run `repair`"),
}


PRE_EVENT_CODES = frozenset((
    "FORMAT_UNSUPPORTED", "REPAIR_PENDING", "NO_NIGHT", "BAD_ARGUMENT", "WORDS_FILE", "WORDS_AS_ARGUMENT", "ARG_NOT_FOR_KIND", "ITEM_MISSING", "ITEM_LINE",
    "EVENT_ID", "RESULT_FIELDS", "PAGECHECK_FIELDS", "CARD_MISSING", "CARD_NO_BLOCK", "CARD_TWO_BLOCKS",
    "CARD_OPEN_FENCE", "MAX_GAP_ENV", "FAKE_CLOCK_NO_TEST", "FAKE_CLOCK_FORM", "LOCK_HELD", "LOCK_STALE", "TORN_LINE",
    "BAD_LINE", "SCHEMA", "REPAIR_NOTHING", "ID_NOT_REPORT", "WRITE_FAILED", "INTERNAL", "STOP_NO_OFFSET",
))


STATE_CODES = frozenset(("NO_GO", "INTENT_NO_RESULT", "GAP", "STOP_NOT_CLOSED", "REPORT_FILE", "CUT_UNRECORDED"))


CLASS_TEXT = {"retry": "retry after reconciliation", "final": "final: do not retry", "fix": "correct it and run again"}


class Refused(Exception):
    def __init__(self, code, detail="", event=None):
        super().__init__(code)
        self.code, self.detail, self.event = code, detail, event


def line_for(code, detail="", prefix="REFUSED", event_id=None):
    kind, message = CODES[code]
    where = f" E{event_id}" if event_id is not None else ""
    text = f"{prefix} [{code}]{where} ({CLASS_TEXT[kind]}): {message}"
    return text + (f". {detail}" if detail else "")


def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def entry_time(text):
    """A strict entry time: a full ISO time with an offset. None if it is not one."""
    if not isinstance(text, str) or "T" not in text:
        return None
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        return None
    return value if value.tzinfo else None


def parse_stop(text, now):
    """--stop: a date and time with its offset, or HH:MM with its offset (the next such time).
    The zone of this computer is never used: it need not be the zone of the card."""
    text = text.strip()
    zone_parts = re.search(r"([+-])(\d{2}):(\d{2})$", text)
    if zone_parts and (int(zone_parts[2]) > 23 or int(zone_parts[3]) > 59):
        raise Refused("STOP_NO_OFFSET", repr(text))
    clock_only = re.fullmatch(r"(\d{1,2}):(\d{2})(Z|[+-]\d{2}:\d{2})", text)
    if clock_only:
        hour, minute, zone = int(clock_only.group(1)), int(clock_only.group(2)), clock_only.group(3)
        offset = timezone.utc if zone == "Z" else datetime.strptime(zone.replace(":", ""), "%z").tzinfo
        try:
            today = now.astimezone(offset).replace(hour=hour, minute=minute, second=0, microsecond=0)
        except ValueError:
            raise Refused("STOP_NO_OFFSET", repr(text)) from None
        return (today if today > now else today + timedelta(days=1)).astimezone(timezone.utc)
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        raise Refused("STOP_NO_OFFSET", repr(text)) from None
    if value.tzinfo is None:
        raise Refused("STOP_NO_OFFSET", repr(text))
    return value.astimezone(timezone.utc)


def minutes(a, b):
    return round((entry_time(b) - entry_time(a)).total_seconds() / 60)


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def is_text(value):
    """A str that can be written as UTF-8 (JSON allows a lone surrogate, which no file can hold)."""
    if not isinstance(value, str):
        return False
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def is_row(value):
    return isinstance(value, list) and len(value) in (2, 6) and all(is_text(part) for part in value)

def parsed_target(value):
    match = TARGET.fullmatch(value) if is_text(value) else None
    if not match:
        return None
    host, owner, repo, number = match.groups()
    return host, f"{owner.lower()}/{repo.lower()}", int(number)


def target_key(value):
    host, repo, number = parsed_target(value)
    return f"{host}/{repo}#{number}"


def valid_base(value):
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", value)
                and all(part and not part.startswith(".") and not part.endswith((".", ".lock"))
                        for part in value.split("/")) and ".." not in value)


def text_list(value):
    return isinstance(value, list) and all(is_text(s) and s.strip() for s in value)


def reviewer(value):
    return (isinstance(value, dict) and set(value) == {"provider", "model", "effort", "role"}
            and all(is_text(v) for v in value.values()) and value["model"].strip()
            and value["provider"] in ("claude", "codex") and value["effort"] in ("low", "medium", "high"))


def pair(value):
    return (isinstance(value, list) and len(value) == 2 and all(reviewer(who) for who in value)
            and [who["provider"] for who in value] == ["claude", "codex"])


def review_policy(value):
    return (isinstance(value, dict) and set(value) == {"allowed", "roles"} and pair(value["allowed"])
            and isinstance(value["roles"], dict) and all(reviewer(who) and label == f"{who['provider']}:{who['role']}"
                                                       for label, who in value["roles"].items()))


def report_pair(value):
    return (isinstance(value, list) and len(value) == 2
            and all(isinstance(r, dict) and set(r) == {"who", "head", "source", "p1", "p2", "p3", "binding"} and isinstance(r["binding"], dict)
                    and all(type(r["binding"].get(key)) is int for key in ("assignment", "plan_check", "start", "round"))
                    and reviewer(r["who"]) and is_text(r["source"]) and r["source"].strip()
                    and is_text(r["head"]) and FULL_SHA.fullmatch(r["head"])
                    and all(text_list(r[key]) for key in ("p1", "p2", "p3")) for r in value))


def cap_spec(value):
    return (isinstance(value, dict) and set(value) == {"done", "findings", "next"}
            and all(is_text(value[key]) and value[key].strip() for key in ("done", "next"))
            and isinstance(value["findings"], list) and value["findings"]
            and all(isinstance(f, dict) and set(f) == {"severity", "text"} and f["severity"] in ("P1", "P2", "P3")
                    and is_text(f["text"]) and f["text"].strip() for f in value["findings"]))


def grant_evidence(value):
    return (isinstance(value, dict) and set(value) == {"reports", "ci", "ledger", "p3", "checks", "effects"}
            and isinstance(value["checks"], dict) and isinstance(value["effects"], dict)
            and all(text_list(value[k]) for k in ("reports", "ci", "ledger", "p3")) and len(value["reports"]) == 2
            and bool(value["ledger"]))


def tasks(value):
    return isinstance(value, dict) and all(
        parsed_target(target) and target_key(target) == target and isinstance(task, dict)
        and set(task) == {"class", "criteria", "owned"} and task["class"] in ("night", "owner")
        and all(text_list(task[key]) and task[key] and all(text.strip() for text in task[key])
                for key in ("criteria", "owned"))
        and len(set(task["owned"])) == len(task["owned"])
        and all(not path.startswith("/") and all(part not in ("", ".", "..") for part in path.split("/"))
                for path in task["owned"])
        for target, task in value.items())


TYPES = {
    "cleanup": lambda v: isinstance(v, dict) and set(v) == {"folder", "repo", "branch", "identity"}
    and all(is_text(v[k]) and v[k] for k in ("folder", "repo", "branch"))
    and isinstance(v["identity"], list) and len(v["identity"]) == 3
    and is_text(v["identity"][0]) and all(is_int(n) for n in v["identity"][1:]),
    "lock_identity": lambda v: isinstance(v, list) and len(v) == 2 and all(is_int(n) for n in v),
    "dict": lambda v: isinstance(v, dict),
    "str": is_text,
    "run": lambda value: is_text(value) and RUN_ID.fullmatch(value),
    "pair": pair,
    "tasks": tasks,
    "policy": review_policy,
    "reports": report_pair,
    "spec": cap_spec,
    "evidence": grant_evidence,
    "texts": text_list,
    "audit": lambda value: isinstance(value, list) and all(text_list(row) for row in value),
    "list": lambda value: isinstance(value, list) and all(isinstance(e, dict) for e in value),
    "int": is_int,
    "bool": lambda v: isinstance(v, bool),
    "time": lambda v: entry_time(v) is not None,
    "row": is_row,
    "rows": lambda v: isinstance(v, list) and all(is_row(row) for row in v),
    "counts": lambda v: isinstance(v, dict) and all(is_text(k) and is_int(n) for k, n in v.items()),
}


FIELDS = {
    "new": {"automation": "dict", "run": "run", "chief_path": "str", "lock_identity": "lock_identity", "words": "str", "test": "bool", "format": (FORMAT,)},
    "go": {"stop": "time", "heartbeat_min": "int", "gap_min": "int", "max_gap_min": "int", "goal": GOALS,
           "rehearsal": REHEARSALS, "items": "rows", "run": "run", "review_cap": "int", "chief": "str",
           "ready_reads": "int", "ready_delay": "int", "review_policy": "policy", "allow_empty_checks": "bool", "tasks": "tasks",
           "merge_main_bonus": "int", "consultants": "bool"},
    "assign": {"chief": "str", "target": "str", "leader": "str", "reviewers": "pair", "helpers": "texts",
               "worktree": "str", "folder": "str", "run": "run", "replaces": "int", "released": "str", "cleanup": "cleanup"},
    "merge-permission": {"chief": "str", "run": "run", "target": "str", "head": "str", "leader": "str", "base": "str",
                         "method": MERGE_METHODS, "head_ref": "str", "repo_id": "int", "assignment": "int", "reviewers": "pair", "evidence": "evidence",
                         "review": "int", "review_base": "str", "files": "texts"},
    "plan": {"chief": "str", "target": "str", "assignment": "int", "plan": "str", "strategy": "str"},
    "review-start": {"chief": "str", "target": "str", "assignment": "int", "head": "str", "leader": "str",
                     "checkout": "str", "brief": "str", "base_sha": "str", "merge_base": "str",
                     "main_merges": "texts", "bonus_merges": "texts", "files": "texts",
                     "intersections": "texts", "cap": "int", "plan_check": "int", "round": "int"},
    "review": {"target": "str", "leader": "str", "reports": "reports", "spec": "spec",
               "chief": "str", "start": "int", "assignment": "int", "digests": "texts", "ledger": "texts"},
    "ruling": {"chief": "str", "target": "str", "assignment": "int", "start": "int", "review": "int",
               "source": "str", "finding": "str", "severity": ("p1", "p2", "p3", "drop"), "reason": "str"},
    "advice": {"chief": "str", "target": "str", "assignment": "int", "start": "int", "review": "int",
               "advisor": ("allow", "hold"), "consultants": "texts"},
    "confirm": {"chief": "str", "target": "str", "grant": "int", "head": "str", "main": "str", "sha": "str", "checks": "list"},
    "withdraw": {"chief": "str", "target": "str", "grant": "int", "reason": "str"},
    "merge-invalidate": {"target": "str", "grant": "int"},
    "audit": {"rows": "audit", "start": "time", "end": "time", "repositories": "texts"},
    "timer": {"timer": "str", "run": "run"},
    "intent": {"item": "str", "command": "str"},
    "result": {"of": "int", "outcome": OUTCOMES, "blocks": "str", "text": "str"},
    "denied": {"item": "str", "command": "str", "blocks": "str", "text": "str"},
    "hold": {"item": "str", "text": "str"},
    "wait": {"item": "str", "text": "str"},
    "decision": {"text": "str", "item": "str", "source": "str", "check": "bool", "resolves": "int"},
    "alive": {"text": "str"},
    "reserve": {"text": "str", "item": "str"},
    "aware": {"text": "str", "item": "str"},
    "error": {"text": "str", "item": "str"},
    "amend": {"words": "str", "reopen": "str", "add_item": "row", "tasks": "tasks"},
    "answer": {"words": "str"},
    "pagecheck": {"name": PAGE_CHECKS, "outcome": PAGE_OUTCOMES, "report": "int", "text": "str"},
    "report": {"counts": "counts", "merges": "list"},
    "close": {"reason": CLOSE_REASONS, "without_page": "str"},
    "repair": {"cut_file": "str", "bytes": "int"},
}


FIELDS["cap"] = FIELDS["review"]

REQUIRED = {
    "new": ("run", "format", "chief_path", "lock_identity"), "go": tuple(k for k in FIELDS["go"] if k != "review_policy"),
    **{kind: tuple(FIELDS[kind]) for kind in MERGE_KINDS if kind not in ("review", "cap", "assign", "merge-permission")},
    "assign": tuple(k for k in FIELDS["assign"] if k not in ("replaces", "released", "cleanup")),
    "merge-permission": tuple(FIELDS["merge-permission"]),
    "review": tuple(k for k in FIELDS["review"] if k != "spec"), "cap": tuple(FIELDS["cap"]), "intent": ("item",), "result": ("of", "outcome"), "denied": ("item",),
    "hold": ("item",), "wait": ("item",), "pagecheck": ("name", "outcome", "report"), "report": ("counts",),
    "close": ("reason",), "repair": ("cut_file", "bytes"),
}


def fits(spec, value):
    return value in spec if isinstance(spec, tuple) else TYPES[spec](value)


def schema_problem(entry):
    """The first shape problem of one entry, or None."""
    if not is_int(entry.get("id")):
        return "the id is not a whole number"
    if entry.get("kind") not in KINDS:
        return f"unknown kind {entry.get('kind')!r}"
    if not fits("time", entry.get("t")):
        return f"the time {entry.get('t')!r} is not a full ISO time with an offset"
    fields = FIELDS.get(entry["kind"], {})
    for name, value in entry.items():
        if name in ("id", "t", "kind"):
            continue
        if name == "release_grant" and entry["kind"] in ("assign", "plan", "review-start", "review", "cap", "ruling"):
            if not is_int(value):
                return "release_grant must be an entry ID"
            continue
        if name == "fake_clock":
            if value is not True:
                return "fake_clock must be true"
            continue
        if name not in fields:
            return f"field {name!r} is not a field of {entry['kind']}"
        if not fits(fields[name], value):
            return f"field {name!r} has a bad value {value!r}"
    missing = [name for name in REQUIRED.get(entry["kind"], ()) if name not in entry]
    return f"missing field {missing[0]!r}" if missing else None


def parse_row(line):
    parts = [part.strip() for part in line.split("|")]
    if not is_row(parts):
        raise Refused("ITEM_LINE", repr(line.strip()))
    return parts


def event_id(text):
    match = re.fullmatch(r"[Ee]?(\d+)", (text or "").strip())
    if not match:
        raise Refused("EVENT_ID", repr(text))
    return int(match.group(1))


def canonical_target(raw):
    if not parsed_target(raw):
        raise Refused("MERGE_TARGET_FORM")
    return target_key(raw)


def entry_bytes(entry):
    return (json.dumps(entry, ensure_ascii=False) + "\n").encode("utf-8")


def input_record(text):
    try:
        data = json.loads(text)
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise Refused("MERGE_EVIDENCE_INVALID", "read a UTF-8 JSON object")
    return data

def clean_entry(entry, intents, results, temps):
    """Check the record before reports or retries use its cleanup fields."""
    kind, subject = entry["kind"], entry.get("subject")
    if not isinstance(subject, str) or not subject:
        return False
    if kind == "clean-refusal":
        return (entry.get("item") in ("cleanup", "temp", "worktree", "local", "remote")
                and isinstance(entry.get("code"), str) and entry["code"] in CODES
                and isinstance(entry.get("detail"), str))
    size, sha = entry.get("size"), entry.get("sha")
    if size is not None and (type(size) is not int or size < 0):
        return False
    if kind == "temp-record":
        identity = entry.get("identity")
        if (intents or subject in temps or size is None or not isinstance(entry.get("actor"), str)
                or not isinstance(sha, str) or not re.fullmatch("[0-9a-f]{64}", sha)
                or not isinstance(identity, list) or len(identity) != 4 or any(type(n) is not int for n in identity)):
            return False
        temps.add(subject)
        return True
    item = entry.get("item")
    if item not in ("temp", "worktree", "local", "remote") or not isinstance(sha, str):
        return False
    if item == "temp":
        if subject not in temps or size is None or not re.fullmatch("[0-9a-f]{64}", sha):
            return False
    elif not FULL_SHA.fullmatch(sha) or (size is None) != (item in ("local", "remote")):
        return False
    fields = (item, subject, size, sha)
    if kind == "clean-intent":
        if intents.keys() - results or fields in intents.values():
            return False
        intents[entry["id"]] = fields
        return True
    of = entry.get("of")
    if type(of) is not int or of in results or intents.get(of) != fields:
        return False
    results.add(of)
    return True
