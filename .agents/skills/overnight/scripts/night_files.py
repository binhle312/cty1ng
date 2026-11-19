"""All file, clock and environment access of night.py: the clock, the lock, the journal, the card, and the checks that read files."""

import errno
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

from night_format import (
    CARD, DEFAULT_LOCK_STALE_S, DEFAULT_LOCK_WAIT_S, DEFAULT_MAX_GAP_MIN, FENCE, JOURNAL, LOCK, REPORT, Refused,
    parse_row, schema_problem)
from night_report import gap_text, gaps, render, stop_passed


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


def journal_bytes(folder):
    try:
        with open(journal_path(folder), "rb") as handle:
            return handle.read()
    except FileNotFoundError:
        return None


def read_journal(folder):
    """All entries, or None if there is no journal. A cut, broken or bad-shaped line refuses."""
    path = journal_path(folder)
    data = journal_bytes(folder)
    if data is None:
        return None
    if data and not data.endswith(b"\n"):
        tail = len(data) - (data.rfind(b"\n") + 1)
        raise Refused("TORN_LINE", f"{tail} bytes after the last newline of {path}")
    return parse_lines(data)


def parse_lines(data):
    """The entries of whole lines. A broken or bad-shaped line refuses."""
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
            rest = memoryview(data)
            while rest:  # os.write can write fewer bytes than it gets (a full disk, a signal)
                written = os.write(handle, rest)
                if written <= 0:
                    raise OSError(errno.EIO, "the write stopped before the end of the entry")
                rest = rest[written:]
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


def state_problems(night, folder, now, gap_to_now):
    found = [(night.last["id"], "NO_GO", "") for _ in [1] if night.go is None and night.last is not None]
    found += [(e["id"], "INTENT_NO_RESULT", f"{e['item']}: `{e.get('command', '')}`") for e in night.open_intents()]
    found += [(gap[0], "GAP", gap_text(night, gap)) for gap in gaps(night, now if gap_to_now else None)]
    if stop_passed(night, now):
        found.append((night.last["id"], "STOP_NOT_CLOSED", f"stop {night.go['stop']}"))
    if night.last is not None:
        found += [(night.last["id"], "CUT_UNRECORDED", name) for name in unrecorded_cuts(folder, night)]
    if night.reports:
        try:
            with open(os.path.join(folder, REPORT), encoding="utf-8") as handle:
                current = handle.read()
        except (OSError, UnicodeDecodeError):
            current = None
        if current != render(night.entries):
            found.append((night.newest_report()["id"], "REPORT_FILE", "missing" if current is None else "different"))
    return found


def parse_card(folder):
    """The rows of the one night-items block in card.md. Fences inside other fences do not count."""
    path = os.path.join(folder, CARD)
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except (OSError, UnicodeDecodeError):
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


def read_words(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    except (OSError, UnicodeDecodeError) as error:
        raise Refused("WORDS_FILE", f"{path}: {getattr(error, 'strerror', None) or 'not UTF-8'}") from None


def need_night(folder):
    if not os.path.exists(journal_path(folder)):
        raise Refused("NO_NIGHT", folder)


def max_gap_env():
    raw = os.environ.get("NIGHT_MAX_GAP_MIN")
    if raw is None:
        return DEFAULT_MAX_GAP_MIN
    if not raw.isdigit() or not 1 <= int(raw) <= DEFAULT_MAX_GAP_MIN:
        raise Refused("MAX_GAP_ENV", repr(raw))
    return int(raw)


def cut_files(folder):
    return sorted(name for name in os.listdir(folder) if re.fullmatch(r"journal\.cut-\d+\.txt", name))


def unrecorded_cuts(folder, night):
    recorded = {e["cut_file"] for e in night.entries if e["kind"] == "repair"}
    return [name for name in cut_files(folder) if name not in recorded]
