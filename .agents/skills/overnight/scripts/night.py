#!/usr/bin/env python3
"""Journal of one overnight run. Python standard library only. Run it with `python3 -I`.

`check` uses the clock only for the stop time and, with --now, for the gap up to now.

Commands (each takes `--dir <night folder>`): new, items, go, log, status, check, report, render,
close, repair. The journal (journal.jsonl) is the record. Each write command takes the lock,
reads and folds the journal, builds its entry, runs the rules on it, and appends it only if no
rule refuses it. `check` runs the same rules on each entry of the journal (the fold), so a
journal edited by hand gets the same rules as a live command.

Times come from the clock and are stored in UTC. The owner's exact words come in only through
`--words-file` (write the file with a quoted heredoc).

Values, each with its default here: DEFAULT_HEARTBEAT_MIN, DEFAULT_MAX_GAP_MIN (the highest gap
alarm; NIGHT_MAX_GAP_MIN can only lower it), DEFAULT_LOCK_WAIT_S (NIGHT_LOCK_WAIT_S) and
DEFAULT_LOCK_STALE_S (NIGHT_LOCK_STALE_S). NIGHT_FAKE_NOW (an ISO time with an offset) replaces
the clock only with NIGHT_TEST_MODE=1; each entry that it writes gets "fake_clock": true.

Exit codes: 0 = done, 1 = `check` found problems, 2 = bad arguments, 3 = refused (also when the
journal cannot be read). Each refusal and problem has a code: see CODES.
"""

import argparse
import json
import os
import re
import signal
import sys
import time
from datetime import datetime, timedelta, timezone

JOURNAL = "journal.jsonl"
CARD = "card.md"
REPORT = "report.md"
LOCK = "journal.lock"
FORMAT = 1

DEFAULT_HEARTBEAT_MIN = 30
DEFAULT_MAX_GAP_MIN = 60
DEFAULT_LOCK_WAIT_S = 10.0
DEFAULT_LOCK_STALE_S = 60.0

LOG_KINDS = ("alive", "aware", "error", "reserve", "decision", "intent", "result", "denied", "hold", "wait",
             "amend", "answer", "pagecheck")
KINDS = ("new", "go", "report", "close", "repair") + LOG_KINDS
OUTCOMES = ("done", "failed", "unknown", "denied")
FINAL_OUTCOMES = ("done", "failed", "denied")
GOALS = ("set", "no-goal-command")
REHEARSALS = ("passed", "owner-override", "none")
REHEARSALS_FOR_ACTION = ("passed", "owner-override")
CLOSE_REASONS = ("goal-met", "nothing-left", "stop-time", "stopped")
PAGE_CHECKS = ("mechanics", "truth", "counts")
PAGE_OUTCOMES = ("pass", "fail")
ITEM_KINDS = ("commit", "no-commit", "owner")
KEEPS_REPORT_FRESH = ("pagecheck", "alive")
ITEM_EVENTS = ("intent", "denied", "hold", "wait", "decision", "aware", "error", "reserve")

PHASE_KINDS = {
    "prepared": {"go", "alive", "aware", "error", "reserve", "decision", "amend", "repair"},
    "running": set(LOG_KINDS) | {"report", "close", "repair"},
    "closed": {"aware", "error", "answer", "repair"},
}

FULL_SHA = re.compile(r"[0-9a-f]{40}")
ANY_SHA = re.compile(r"(?<![0-9A-Fa-f])[0-9A-Fa-f]{40}(?![0-9A-Fa-f])")
OPTION = re.compile(r"-{1,2}[A-Za-z0-9][A-Za-z0-9-]*")
FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")

# code: (class, message). "final" = do not retry; "fix" = correct the input and run again.
CODES = {
    # Before an entry exists (PRE_EVENT_CODES).
    "NO_NIGHT": ("fix", "no night in this folder: run `new` first"),
    "BAD_ARGUMENT": ("fix", "an argument has bytes that are not UTF-8"),
    "WORDS_FILE": ("fix", "the words file cannot be read as UTF-8 text"),
    "WORDS_AS_ARGUMENT": ("fix", "the owner's exact words go in only through --words-file, not as an argument"),
    "ARG_NOT_FOR_KIND": ("fix", "this kind of entry does not take this option"),
    "ITEM_MISSING": ("fix", "this kind of entry needs --item <exact card name>"),
    "ITEM_LINE": ("fix", "an item row is `<name> | commit | <head-match option>`, `<name> | no-commit` or `<name> | owner`"),
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
    "REPAIR_NOTHING": ("fix", "the journal ends with a full line: there is nothing to repair"),
    "ID_NOT_REPORT": ("fix", "this entry is not a report entry"),
    "WRITE_FAILED": ("final", "a file write failed"),
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
    "ITEM_KIND": ("fix", "an item kind is commit, no-commit or owner"),
    "ITEM_OPTION": ("fix", "a commit row names its head-match option (such as --match-head-commit); other rows name none"),
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
    "COMMIT_NEEDS_HEAD": ("fix", "a commit item needs --head <40-character sha> and its head-match option in the "
                                 "command; --no-head is only for no-commit items. Do not change the kind of the item"),
    "HEAD_FORM": ("fix", "--head must be the full 40-character lower-case sha"),
    "HEAD_OPTION_MISSING": ("fix", "the command must give the head with the head-match option of the item"),
    "NO_COMMIT_HAS_HEAD": ("fix", "a no-commit item takes no --head"),
    "NO_COMMIT_NEEDS_REASON": ("fix", "a no-commit item needs --no-head <reason>"),
    "NO_COMMIT_HAS_SHA": ("final", "a command on a no-commit item must not name a commit sha"),
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
}
PRE_EVENT_CODES = frozenset((
    "NO_NIGHT", "BAD_ARGUMENT", "WORDS_FILE", "WORDS_AS_ARGUMENT", "ARG_NOT_FOR_KIND", "ITEM_MISSING", "ITEM_LINE",
    "EVENT_ID", "RESULT_FIELDS", "PAGECHECK_FIELDS", "CARD_MISSING", "CARD_NO_BLOCK", "CARD_TWO_BLOCKS",
    "CARD_OPEN_FENCE", "MAX_GAP_ENV", "FAKE_CLOCK_NO_TEST", "FAKE_CLOCK_FORM", "LOCK_HELD", "LOCK_STALE", "TORN_LINE",
    "BAD_LINE", "SCHEMA", "REPAIR_NOTHING", "ID_NOT_REPORT", "WRITE_FAILED", "INTERNAL",
))
STATE_CODES = frozenset(("NO_GO", "INTENT_NO_RESULT", "GAP", "STOP_NOT_CLOSED", "REPORT_FILE"))
CLASS_TEXT = {"final": "final: do not retry", "fix": "correct it and run again"}


class Refused(Exception):
    def __init__(self, code, detail="", event=None):
        super().__init__(code)
        self.code, self.detail, self.event = code, detail, event


def line_for(code, detail="", prefix="REFUSED", event_id=None):
    kind, message = CODES[code]
    where = f" E{event_id}" if event_id is not None else ""
    text = f"{prefix} [{code}]{where} ({CLASS_TEXT[kind]}): {message}"
    return text + (f". {detail}" if detail else "")


# ---------- time ----------

def test_mode():
    return os.environ.get("NIGHT_TEST_MODE") == "1"


def clock():
    """The time now, in UTC, and whether it is a fake test time."""
    fake = os.environ.get("NIGHT_FAKE_NOW")
    if fake is None:
        return datetime.now(timezone.utc).replace(microsecond=0), False
    if not test_mode():
        raise Refused("FAKE_CLOCK_NO_TEST")
    try:
        value = datetime.fromisoformat(fake)
    except ValueError:
        raise Refused("FAKE_CLOCK_FORM", repr(fake)) from None
    if value.tzinfo is None:
        raise Refused("FAKE_CLOCK_FORM", repr(fake))
    return value.astimezone(timezone.utc).replace(microsecond=0), True


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
    """--stop: HH:MM (the next such local time), a local date and time, or ISO with a zone."""
    text = text.strip()
    if re.fullmatch(r"\d{1,2}:\d{2}", text):
        hour, minute = (int(part) for part in text.split(":"))
        today = now.astimezone().replace(hour=hour, minute=minute, second=0, microsecond=0)
        return (today if today > now else today + timedelta(days=1)).astimezone(timezone.utc)
    value = datetime.fromisoformat(text)
    if value.tzinfo is None:
        value = value.astimezone()
    return value.astimezone(timezone.utc)


def minutes(a, b):
    return round((entry_time(b) - entry_time(a)).total_seconds() / 60)


# ---------- the journal file ----------

def journal_path(folder):
    return os.path.join(folder, JOURNAL)


class Lock:
    """An exclusive lock file with the process id in it. night.py never removes a lock it does not own."""

    def __init__(self, folder):
        self.path = os.path.join(folder, LOCK)
        self.owned = False

    def __enter__(self):
        wait = env_number("NIGHT_LOCK_WAIT_S", DEFAULT_LOCK_WAIT_S)
        end = time.monotonic() + wait
        while True:
            try:
                handle = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
            except FileExistsError:
                if time.monotonic() >= end:
                    raise self.refusal() from None
                time.sleep(0.01)
                continue
            self.owned = True
            try:
                os.write(handle, str(os.getpid()).encode())
            finally:
                os.close(handle)
            return self

    def refusal(self):
        try:
            with open(self.path, encoding="utf-8", errors="replace") as handle:
                text = handle.read().strip()
            age = time.time() - os.path.getmtime(self.path)
        except FileNotFoundError:
            return Refused("LOCK_HELD", "the lock went away during the wait")
        repair = (f"If no night.py runs (check with `ps -p <pid>`), remove {self.path} by hand, "
                  "then run `check` before you go on")
        if not text.isdigit() or int(text) <= 0:
            return Refused("LOCK_STALE", f"the lock file has no process id ({text!r}). {repair}")
        pid = int(text)
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return Refused("LOCK_STALE", f"process {pid} is not running. {repair}")
        except PermissionError:
            pass
        stale = env_number("NIGHT_LOCK_STALE_S", DEFAULT_LOCK_STALE_S)
        if age > stale:
            return Refused("LOCK_STALE", f"process {pid} has held it for {age:.0f} s (more than {stale:.0f} s). {repair}")
        return Refused("LOCK_HELD", f"process {pid}")

    def __exit__(self, *exc):
        if self.owned:
            os.remove(self.path)
            self.owned = False


def env_number(name, default):
    """A test-mode setting (seconds). Outside test mode the default holds."""
    if not test_mode():
        return default
    try:
        value = float(os.environ.get(name, default))
    except ValueError:
        return default
    return value if value >= 0 else default


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def is_row(value):
    return isinstance(value, list) and len(value) in (2, 3) and all(isinstance(part, str) for part in value)


TYPES = {
    "str": lambda v: isinstance(v, str),
    "int": is_int,
    "bool": lambda v: isinstance(v, bool),
    "time": lambda v: entry_time(v) is not None,
    "row": is_row,
    "rows": lambda v: isinstance(v, list) and all(is_row(row) for row in v),
    "counts": lambda v: isinstance(v, dict) and all(isinstance(k, str) and is_int(n) for k, n in v.items()),
}
FIELDS = {
    "new": {"run": "str", "words": "str", "test": "bool", "format": (FORMAT,)},
    "go": {"stop": "time", "heartbeat_min": "int", "gap_min": "int", "max_gap_min": "int", "goal": GOALS,
           "rehearsal": REHEARSALS, "items": "rows"},
    "intent": {"item": "str", "command": "str", "head": "str", "no_head": "str"},
    "result": {"of": "int", "outcome": OUTCOMES, "blocks": "str", "text": "str"},
    "denied": {"item": "str", "command": "str", "blocks": "str", "text": "str"},
    "hold": {"item": "str", "text": "str"},
    "wait": {"item": "str", "text": "str"},
    "decision": {"text": "str", "item": "str", "source": "str", "check": "bool", "resolves": "int"},
    "alive": {"text": "str"},
    "reserve": {"text": "str", "item": "str"},
    "aware": {"text": "str", "item": "str"},
    "error": {"text": "str", "item": "str"},
    "amend": {"words": "str", "reopen": "str", "add_item": "row"},
    "answer": {"words": "str"},
    "pagecheck": {"name": PAGE_CHECKS, "outcome": PAGE_OUTCOMES, "report": "int", "text": "str"},
    "report": {"counts": "counts"},
    "close": {"reason": CLOSE_REASONS, "without_page": "str"},
    "repair": {"cut_file": "str", "bytes": "int"},
}
REQUIRED = {
    "new": ("run",), "go": tuple(FIELDS["go"]), "intent": ("item",), "result": ("of", "outcome"), "denied": ("item",),
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


def read_journal(folder):
    """All entries, or None if there is no journal. A cut, broken or bad-shaped line refuses."""
    path = journal_path(folder)
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except FileNotFoundError:
        return None
    if data and not data.endswith(b"\n"):
        tail = len(data) - (data.rfind(b"\n") + 1)
        raise Refused("TORN_LINE", f"{tail} bytes after the last newline of {path}")
    entries = []
    for number, raw in enumerate(data.split(b"\n")[:-1], 1):
        try:
            entry = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise Refused("BAD_LINE", f"line {number}") from None
        if not isinstance(entry, dict):
            raise Refused("BAD_LINE", f"line {number}")
        problem = schema_problem(entry)
        if problem:
            raise Refused("SCHEMA", f"line {number}: {problem}")
        entries.append(entry)
    return entries


def append(folder, entry, first):
    path = journal_path(folder)
    data = (json.dumps(entry, ensure_ascii=False) + "\n").encode("utf-8")
    try:
        handle = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
        try:
            os.write(handle, data)
            os.fsync(handle)
        finally:
            os.close(handle)
        if first:
            sync_folder(folder)
    except OSError as error:
        raise Refused("WRITE_FAILED", f"{path}: {error.strerror}") from None


def sync_folder(folder):
    handle = os.open(folder, os.O_RDONLY)
    try:
        os.fsync(handle)
    finally:
        os.close(handle)


def write_file(folder, name, text):
    """Write a whole file through a temp file and a rename, so a reader never sees half of it."""
    path = os.path.join(folder, name)
    temp = os.path.join(folder, f".{name}.{os.getpid()}.tmp")
    try:
        for old in os.listdir(folder):
            if old.startswith(f".{name}.") and old.endswith(".tmp"):
                os.remove(os.path.join(folder, old))
        with open(temp, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    except OSError as error:
        raise Refused("WRITE_FAILED", f"{path}: {error.strerror}") from None


# ---------- the state of a night ----------

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


# ---------- the rules: one judge for a live command and for the fold ----------

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


def row_problems(row, known):
    """The problems of one card row; `known` maps name keys of the names already on the card."""
    name, kind, rest = row[0], row[1], row[2:]
    found = []
    if not name or name != name.strip() or "|" in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
        found.append(("ITEM_NAME", repr(name)))
    if kind not in ITEM_KINDS:
        found.append(("ITEM_KIND", f"{name!r} has kind {kind!r}"))
    elif (kind == "commit") != bool(rest) or (rest and not OPTION.fullmatch(rest[0])):
        found.append(("ITEM_OPTION", f"{' | '.join(row)}"))
    if name_key(name) in known:
        found.append(("ITEM_DUPLICATE" if known is not None and not isinstance(known, dict) else "ITEM_ON_CARD",
                      f"{name!r} and {known[name_key(name)]!r}" if isinstance(known, dict) else repr(name)))
    return found


def rule_go(night, entry):
    if entry["kind"] != "go":
        return []
    found = []
    if not entry["items"]:
        found.append(("ITEMS_EMPTY", ""))
    seen = {}
    for row in entry["items"]:
        for code, detail in row_problems(row, {}):
            found.append((code, detail))
        key = name_key(row[0])
        if key in seen:
            found.append(("ITEM_DUPLICATE", f"{row[0]!r} and {seen[key]!r}"))
        seen.setdefault(key, row[0])
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
        row = entry["add_item"]
        found.extend(p for p in row_problems(row, {}) if p[0] != "ITEM_DUPLICATE")
        known = {name_key(name): name for name in night.items}
        if name_key(row[0]) in known:
            found.append(("ITEM_ON_CARD", f"{row[0]!r} and {known[name_key(row[0])]!r}"))
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
    if "command" not in entry:
        return [("INTENT_FIELDS", "")]
    command = entry["command"]
    if kind == "commit":
        if "head" not in entry or "no_head" in entry:
            return [("COMMIT_NEEDS_HEAD", repr(item))]
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
        if not found and not entry.get("without_page"):
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


# ---------- what check, status and the report show ----------

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

    items = [(name, kind, option or "", f"E{source}") for name, (kind, option, source) in night.items.items()]
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
        "## Items\n", table(items, ["Name", "Kind", "Head-match option", "From"]),
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
        text += [f"## After E{report['id']}\n", table([(f"E{e['id']}", e["kind"], e["t"]) for e in later],
                                                      ["Entry", "Kind", "Time"])]
    text += ["## Permissions\n", permissions + "\n"]
    return "\n".join(text)


def state_problems(night, folder, now, gap_to_now):
    found = [(night.last["id"], "NO_GO", "") for _ in [1] if night.go is None and night.last is not None]
    found += [(e["id"], "INTENT_NO_RESULT", f"{e['item']}: `{e.get('command', '')}`") for e in night.open_intents()]
    found += [(gap[0], "GAP", gap_text(night, gap)) for gap in gaps(night, now if gap_to_now else None)]
    if stop_passed(night, now):
        found.append((night.last["id"], "STOP_NOT_CLOSED", f"stop {night.go['stop']}"))
    if night.reports:
        try:
            with open(os.path.join(folder, REPORT), encoding="utf-8") as handle:
                current = handle.read()
        except (FileNotFoundError, UnicodeDecodeError):
            current = None
        if current != render(night.entries):
            found.append((night.newest_report()["id"], "REPORT_FILE", "missing" if current is None else "different"))
    return found


# ---------- the card ----------

def parse_row(line):
    parts = [part.strip() for part in line.split("|")]
    if len(parts) not in (2, 3):
        raise Refused("ITEM_LINE", repr(line.strip()))
    return parts


def parse_card(folder):
    """The rows of the one night-items block in card.md. Fences inside other fences do not count."""
    path = os.path.join(folder, CARD)
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except (FileNotFoundError, UnicodeDecodeError):
        raise Refused("CARD_MISSING", path) from None
    blocks, fence, info, body = [], None, None, []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = line.strip()
        if fence is None:
            match = FENCE.match(stripped)
            if match:
                fence, info, body = match.group(1), match.group(2).strip(), []
        elif stripped and set(stripped) == {fence[0]} and len(stripped) >= len(fence):
            if info == "night-items":
                blocks.append(body)
            fence = None
        else:
            body.append(line)
    if fence is not None:
        raise Refused("CARD_OPEN_FENCE", f"{fence}{info}")
    if not blocks:
        raise Refused("CARD_NO_BLOCK", path)
    if len(blocks) > 1:
        raise Refused("CARD_TWO_BLOCKS", f"{len(blocks)} blocks")
    return [parse_row(line) for line in blocks[0] if line.strip()]


# ---------- commands ----------

def event_id(text):
    match = re.fullmatch(r"[Ee]?(\d+)", (text or "").strip())
    if not match:
        raise Refused("EVENT_ID", repr(text))
    return int(match.group(1))


def read_words(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    except (OSError, UnicodeDecodeError) as error:
        raise Refused("WORDS_FILE", f"{path}: {getattr(error, 'strerror', None) or 'not UTF-8'}") from None


def need_night(folder):
    if not os.path.exists(journal_path(folder)):
        raise Refused("NO_NIGHT", folder)


def write_entry(folder, kind, fields, then=None, prepare=None):
    """Lock, `prepare()`, read, clock, fold, build, judge, append, then `then(night, entry)`, all under the lock.
    The clock is read after the wait for the lock, so the entry time is never before an earlier entry."""
    with Lock(folder):
        extra = prepare() if prepare else {}
        entries = read_journal(folder) or []
        now, fake = clock()
        night = fold(entries)
        entry = {"id": night.last["id"] + 1 if night.last else 1, "t": iso(now), "kind": kind}
        given = dict(fields(night, now) if callable(fields) else fields, **extra)
        entry.update({k: v for k, v in given.items() if v is not None})
        if fake:
            entry["fake_clock"] = True
        problem = schema_problem(entry)
        if problem:
            raise Refused("SCHEMA", f"the new entry: {problem}")
        found = judge(night, entry)
        if found:
            raise Refused(found[0][0], found[0][1], event=entry)
        append(folder, entry, first=not entries)
        apply(night, entry)
        if then:
            then(night, entry)
    return entry


def cmd_new(args):
    words = read_words(args.words_file) if args.words_file else None
    os.makedirs(args.dir, exist_ok=True)

    def fields(night, now):
        return {"run": "night-" + now.strftime("%Y%m%dT%H%MZ"), "words": words, "format": FORMAT,
                "test": True if test_mode() else None}

    def card(night, entry):
        run = entry["run"]
        if not os.path.exists(os.path.join(args.dir, CARD)):
            write_file(args.dir, CARD, f"# Night card {run}\n\nMade: {entry['t']}.\n\n## Owner's words (exact)\n\n"
                                       f"{fenced(words)}\n\nFill the other parts from the night card reference of "
                                       "the skill, with one night-items block.\n")
    entry = write_entry(args.dir, "new", fields, card)
    print(f"E{entry['id']} new {entry['run']}" + (" TEST JOURNAL" if test_mode() else ""))


def cmd_items(args):
    rows = parse_card(args.dir)
    seen = {}
    for row in rows:
        for code, detail in row_problems(row, {}):
            raise Refused(code, detail)
        if name_key(row[0]) in seen:
            raise Refused("ITEM_DUPLICATE", f"{row[0]!r} and {seen[name_key(row[0])]!r}")
        seen[name_key(row[0])] = row[0]
    if not rows:
        raise Refused("ITEMS_EMPTY")
    for row in rows:
        print(" | ".join(row))


def max_gap_env():
    raw = os.environ.get("NIGHT_MAX_GAP_MIN")
    if raw is None:
        return DEFAULT_MAX_GAP_MIN
    if not raw.isdigit() or not 1 <= int(raw) <= DEFAULT_MAX_GAP_MIN:
        raise Refused("MAX_GAP_ENV", repr(raw))
    return int(raw)


def cmd_go(args):
    need_night(args.dir)
    limit = max_gap_env()
    rows = parse_card(args.dir)
    gap = args.gap_min if args.gap_min is not None else 2 * args.heartbeat_min

    def fields(night, now):
        return {"stop": iso(parse_stop(args.stop, now)), "heartbeat_min": args.heartbeat_min, "gap_min": gap,
                "max_gap_min": limit, "goal": args.goal, "rehearsal": args.rehearsal, "items": rows}
    entry = write_entry(args.dir, "go", fields)
    print(f"E{entry['id']} GO stop {entry['stop']} heartbeat {args.heartbeat_min} min gap alarm {gap} min "
          f"goal {args.goal} rehearsal {args.rehearsal}")
    print("Items from the card (read them back to the owner):")
    for row in rows:
        print("  " + " | ".join(row))


ALLOWED = {
    "alive": {"text"}, "reserve": {"text", "item"}, "aware": {"text", "item"}, "error": {"text", "item"},
    "decision": {"text", "item", "source", "check", "resolves"},
    "intent": {"item", "command", "head", "no_head"},
    "result": {"of", "outcome", "blocks", "text"},
    "denied": {"item", "command", "blocks", "text"},
    "hold": {"item", "text"}, "wait": {"item", "text"},
    "amend": {"words_file", "reopen", "add_item"}, "answer": {"words_file"},
    "pagecheck": {"name", "outcome", "report", "text"},
}
OPTIONS = ("text", "item", "command", "head", "no_head", "of", "outcome", "blocks", "source", "check", "resolves",
           "words_file", "reopen", "add_item", "name", "report")


def log_fields(args):
    """The fields of a log entry from the arguments. Only argument checks here; the rules come later."""
    kind = args.kind
    if kind in ("amend", "answer") and args.text is not None:
        raise Refused("WORDS_AS_ARGUMENT")
    given = [name for name in OPTIONS if getattr(args, name) not in (None, False)]
    extra = [name for name in given if name not in ALLOWED[kind]]
    if extra:
        raise Refused("ARG_NOT_FOR_KIND", f"{kind} does not take --{extra[0].replace('_', '-')}")
    if kind in ("intent", "denied", "hold", "wait") and args.item is None:
        raise Refused("ITEM_MISSING", kind)
    fields = {"text": args.text, "item": args.item.strip() if args.item is not None else None,
              "command": args.command, "head": args.head, "no_head": args.no_head, "blocks": args.blocks,
              "source": args.source, "check": True if args.check else None}
    if kind == "result":
        if args.of is None or args.outcome not in OUTCOMES:
            raise Refused("RESULT_FIELDS")
        fields.update(of=event_id(args.of), outcome=args.outcome)
    if kind == "pagecheck":
        if args.name not in PAGE_CHECKS or args.outcome not in PAGE_OUTCOMES or args.report is None:
            raise Refused("PAGECHECK_FIELDS")
        fields.update(name=args.name, outcome=args.outcome, report=event_id(args.report))
    if args.resolves is not None:
        fields["resolves"] = event_id(args.resolves)
    if kind in ("amend", "answer"):
        fields["words"] = read_words(args.words_file) if args.words_file else None
        fields["reopen"] = args.reopen.strip() if args.reopen is not None else None
        fields["add_item"] = parse_row(args.add_item) if args.add_item is not None else None
    return fields


def cmd_log(args):
    fields = log_fields(args)
    need_night(args.dir)
    entry = write_entry(args.dir, args.kind, fields)
    print(f"E{entry['id']} {args.kind}" + (f" {entry['item']}" if entry.get("item") else ""))
    if "add_item" in entry:
        print(f"ADDED ITEM: {' | '.join(entry['add_item'])} (E{entry['id']}): read it back to the owner "
              "before you act on it.")


def cmd_report(args):
    need_night(args.dir)

    def write(night, entry):
        write_file(args.dir, REPORT, render(night.entries))
    entry = write_entry(args.dir, "report", lambda night, now: {"counts": counts_with(night, "report")}, write)
    print(f"E{entry['id']} report written: {os.path.join(args.dir, REPORT)}")


def cmd_render(args):
    need_night(args.dir)
    with Lock(args.dir):
        entries = read_journal(args.dir) or []
        night = fold(entries)
        if not night.reports:
            raise Refused("REPORT_NONE_YET")
        write_file(args.dir, REPORT, render(entries))
    print(f"report.md written again from the journal (report E{night.newest_report()['id']})")


def cmd_close(args):
    need_night(args.dir)
    notes = []

    def write(night, entry):
        write_file(args.dir, REPORT, render(night.entries))
        notes.extend(f"{row[0]}: {row[1]} ({row[4]})" for row in needs_you(night))
        notes.extend(gap_text(night, gap) for gap in gaps(night))
    entry = write_entry(args.dir, "close", {"reason": args.reason, "without_page": args.without_page}, write)
    night = fold(read_journal(args.dir))
    for line in notes:
        print(f"NOTE: {line} (it is on the report)")
    print(f"E{entry['id']} NIGHT CLOSED {night.run} reason {args.reason}" + (" TEST JOURNAL" if night.test else ""))


def cmd_repair(args):
    need_night(args.dir)
    path = journal_path(args.dir)

    def cut():
        with open(path, "rb") as handle:
            data = handle.read()
        if not data or data.endswith(b"\n"):
            raise Refused("REPAIR_NOTHING")
        keep = data.rfind(b"\n") + 1
        number = 1 + sum(1 for name in os.listdir(args.dir) if name.startswith("journal.cut-"))
        cut_name = f"journal.cut-{number}.txt"
        try:
            with open(os.path.join(args.dir, cut_name), "wb") as handle:
                handle.write(data[keep:])
                handle.flush()
                os.fsync(handle.fileno())
            os.truncate(path, keep)
        except OSError as error:
            raise Refused("WRITE_FAILED", f"{path}: {error.strerror}") from None
        return {"cut_file": cut_name, "bytes": len(data) - keep}
    entry = write_entry(args.dir, "repair", {}, prepare=cut)
    print(f"E{entry['id']} repair: {entry['bytes']} bytes moved to {entry['cut_file']}")


def read_for_view(folder):
    need_night(folder)
    with Lock(folder):
        entries = read_journal(folder) or []
        now, fake = clock()
    night = fold(entries)
    if fake and not night.test:
        raise Refused("FAKE_CLOCK", "a fake clock cannot read a real journal")
    return night, now


def cmd_check(args):
    night, now = read_for_view(args.dir)
    found = list(night.faults) + state_problems(night, args.dir, now, args.now)
    for entry_id, code, detail in found:
        print(line_for(code, detail, prefix="PROBLEM", event_id=entry_id))
    if not found:
        print("check: OK")
    return 1 if found else 0


def status_data(night, now):
    def short(entries, item=lambda e: e.get("item")):
        return [f"E{e['id']} {item(e)}" for e in entries]
    items = [{"name": name, "kind": kind, "option": option, "from": f"E{source}"}
             for name, (kind, option, source) in night.items.items()]
    newest = night.newest_report()
    return {
        "run": night.run, "phase": night.phase, "test": night.test,
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


def cmd_status(args):
    night, now = read_for_view(args.dir)
    if args.report is not None:
        wanted = event_id(args.report)
        report = next((e for e in night.reports if e["id"] == wanted), None)
        if report is None:
            raise Refused("ID_NOT_REPORT", f"E{wanted}")
        data = {"report": f"E{wanted}", "counts": report["counts"], "test": night.test}
    else:
        data = status_data(night, now)
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return 0
    if night.test:
        print("TEST JOURNAL")
    for key, value in data.items():
        print(f"{key}: {value}")
    return 0


# ---------- arguments ----------

def parser():
    top = argparse.ArgumentParser(prog="night.py", description=__doc__.splitlines()[0], allow_abbrev=False)
    sub = top.add_subparsers(dest="command_name", required=True)

    def add(name, helptext):
        cmd = sub.add_parser(name, help=helptext, allow_abbrev=False)
        cmd.add_argument("--dir", required=True, help="the night folder")
        return cmd

    new = add("new", "start the journal and the card with the owner's exact words")
    new.add_argument("--words-file", help="a file with the owner's exact /overnight arguments")
    add("items", "print the rows of the night-items block of card.md (for the read-back)")
    go = add("go", "record the owner's go; the items come from the night-items block of card.md")
    go.add_argument("--stop", required=True, help="HH:MM (the next such local time), a local date and time, or ISO with a zone")
    go.add_argument("--goal", required=True, choices=GOALS)
    go.add_argument("--rehearsal", required=True, choices=REHEARSALS)
    go.add_argument("--heartbeat-min", type=int, default=DEFAULT_HEARTBEAT_MIN)
    go.add_argument("--gap-min", type=int, help="the gap alarm (default 2 times the heartbeat)")
    log = add("log", "add one entry")
    log.add_argument("kind", choices=LOG_KINDS)
    log.add_argument("text", nargs="?", default=None)
    log.add_argument("--words-file", help="amend, answer: a file with the owner's exact words")
    log.add_argument("--item", help="an exact name from the card")
    log.add_argument("--command", dest="command")
    log.add_argument("--head", help="intent on a commit item: the full 40-character sha")
    log.add_argument("--no-head", help="intent on a no-commit item: why it acts on no commit")
    log.add_argument("--of", help="result: the intent id (12 or E12)")
    log.add_argument("--outcome", help="result: done, failed, unknown or denied; pagecheck: pass or fail")
    log.add_argument("--blocks")
    log.add_argument("--source")
    log.add_argument("--check", action="store_true", help="decision: the owner should check it")
    log.add_argument("--resolves", help="decision: the id of the wait row that it ends")
    log.add_argument("--reopen", help="amend: the denied or held item that the owner opens again")
    log.add_argument("--add-item", help='amend: "<name> | <kind>" or "<name> | commit | <head-match option>"')
    log.add_argument("--name", help="pagecheck: " + ", ".join(PAGE_CHECKS))
    log.add_argument("--report", help="pagecheck: the report entry that the page shows (E12)")
    status = add("status", "show the state")
    status.add_argument("--json", action="store_true")
    status.add_argument("--report", help="show the frozen counts of this report entry")
    check = add("check", "run the rules on each entry and find gaps, open intents and an old report.md")
    check.add_argument("--now", action="store_true", help="also the gap from the last entry to now")
    add("report", "add a report entry with frozen counts and write report.md")
    add("render", "write report.md again from the journal (after a crash); adds no entry")
    close = add("close", "close the night; report.md becomes the record")
    close.add_argument("--reason", required=True, choices=CLOSE_REASONS)
    close.add_argument("--without-page", help="the reason why there is no checked page")
    add("repair", "move a cut last line to a side file and record it")
    return top


HANDLERS = {"new": cmd_new, "items": cmd_items, "go": cmd_go, "log": cmd_log, "status": cmd_status,
            "check": cmd_check, "report": cmd_report, "render": cmd_render, "close": cmd_close, "repair": cmd_repair}


def stop_on_term(signum, frame):
    raise SystemExit(128 + signum)


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(errors="backslashreplace")
    signal.signal(signal.SIGTERM, stop_on_term)
    raw = sys.argv[1:] if argv is None else argv
    args = parser().parse_args(argv)
    try:
        for value in raw:
            value.encode("utf-8")
    except UnicodeEncodeError:
        print(line_for("BAD_ARGUMENT"), file=sys.stderr)
        return 3
    try:
        return HANDLERS[args.command_name](args) or 0
    except Refused as refusal:
        print(line_for(refusal.code, refusal.detail), file=sys.stderr)
        if refusal.event is not None and test_mode():
            print("REFUSED EVENT: " + json.dumps(refusal.event, ensure_ascii=False), file=sys.stderr)
        return 3
    except Exception as error:  # the last net: a code, never a traceback
        print(line_for("INTERNAL", type(error).__name__), file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
