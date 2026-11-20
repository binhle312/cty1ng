"""All file, clock and environment access of night.py: the clock, the lock, the journal, the card, and the checks that read files."""

import errno
import base64
import fcntl
import hashlib
import stat
import tempfile
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

from night_format import (
    CARD, FORMAT, DEFAULT_LOCK_STALE_S, DEFAULT_LOCK_WAIT_S, DEFAULT_MAX_GAP_MIN, FENCE, JOURNAL, LOCK, REPORT, Refused,
    parse_row, schema_problem, iso, entry_time, FULL_SHA, report_pair, cap_spec, entry_bytes)
from night_rules import apply, fold, judge
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


class SharedLock:
    """The chief creates this stable inode once. Leaders only open it for reading."""

    name = "night.flock"

    def __init__(self, folder):
        self.path = os.path.join(folder, self.name)

    def __enter__(self):
        try:
            self.fd = os.open(self.path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        except OSError:
            raise Refused("LOCK_STALE", self.path) from None
        end = time.monotonic() + env_number("NIGHT_LOCK_WAIT_S", DEFAULT_LOCK_WAIT_S)
        try:
            if not stat.S_ISREG(os.fstat(self.fd).st_mode):
                raise Refused("LOCK_STALE", self.path)
            while True:
                try:
                    fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= end:
                        raise Refused("LOCK_HELD", self.path) from None
                    time.sleep(0.01)
            if not os.path.samestat(os.fstat(self.fd), os.stat(self.path, follow_symlinks=False)):
                raise Refused("LOCK_STALE", self.path)
        except OSError:
            self.__exit__()
            raise Refused("LOCK_STALE", self.path) from None
        except BaseException:
            self.__exit__()
            raise
        return self

    def __exit__(self, *exc):
        os.close(self.fd)


class Lock:
    """An exclusive lock file with the process id in it. night.py never removes a lock it does not own."""

    def __init__(self, folder):
        self.shared = SharedLock(folder)
        self.path = os.path.join(folder, LOCK)
        self.owned = False

    def __enter__(self):
        # The marker remains for crash diagnosis. The stable lock also covers leader writes.
        self.has_shared = os.path.lexists(self.shared.path)
        if self.has_shared:
            try:
                self.shared.__enter__()
            except Refused as refused:
                if refused.code == "LOCK_HELD" and os.path.exists(self.path):
                    raise self.refusal() from None
                raise
        try:
            return self.acquire_marker()
        except BaseException:
            if self.has_shared:
                self.shared.__exit__()
            raise

    def acquire_marker(self):
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
            self.identity = os.fstat(handle)
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
        try:
            if self.owned and os.path.samestat(self.identity, os.stat(self.path, follow_symlinks=False)):
                os.remove(self.path)
        except FileNotFoundError:
            pass
        finally:
            self.owned = False
            if self.has_shared:
                self.shared.__exit__()


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


def json_record(raw, number):
    try:
        entry = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise Refused("BAD_LINE", f"line {number}") from None
    if not isinstance(entry, dict):
        raise Refused("BAD_LINE", f"line {number}")
    return entry


def check_version(data):
    first, sep, _ = data.partition(b"\n")
    if first and sep:
        entry = json_record(first, 1)
        if type(entry.get("format")) is not int or entry["format"] != FORMAT:
            raise Refused("FORMAT_UNSUPPORTED", f"first entry format {entry.get('format')!r}")


def read_journal(folder):
    """Read under the caller's lock. Check the version before reading later lines."""
    path = journal_path(folder)
    data = journal_bytes(folder)
    if data is None:
        return None
    check_version(data)
    if data and not data.endswith(b"\n"):
        tail = len(data) - (data.rfind(b"\n") + 1)
        raise Refused("TORN_LINE", f"{tail} bytes after the last newline of {path}")
    return parse_lines(data)


def parse_lines(data):
    entries = []
    check_version(data)
    for number, raw in enumerate(data.split(b"\n")[:-1], 1):
        entry = json_record(raw, number)
        problem = schema_problem(entry)
        if problem:
            raise Refused("SCHEMA", f"line {number}: {problem}")
        entries.append(entry)
    return entries


def append(folder, entry, first, name=JOURNAL):
    path = os.path.join(folder, name)
    data = entry_bytes(entry)
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
        # A sync can report an error after the whole entry reached the file.
        try:
            with open(path, "rb") as handle:
                observed = handle.read()
            found = observed is not None and observed.endswith(data)
        except OSError:
            found = False
        note = f"; entry E{entry['id']} is visible, durability uncertain" if found else "; entry status uncertain"
        raise Refused("WRITE_FAILED", f"{path}: {error.strerror}{note}") from None


def sync_folder(folder):
    handle = os.open(folder, os.O_RDONLY)
    try:
        os.fsync(handle)
    finally:
        os.close(handle)


def write_file(folder, name, text):
    """Write a whole file through a temp file and a rename, so a reader never sees half of it."""
    path = os.path.join(folder, name)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=folder, prefix=f".{name}.", suffix=".tmp", delete=False) as handle:
            identity = os.fstat(handle.fileno())
            temp = handle.name
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
        temp = None
        sync_folder(folder)
    except OSError as error:
        raise Refused("WRITE_FAILED", f"{path}: {error.strerror}") from None
    finally:
        if temp is not None:
            try:
                if os.path.samestat(identity, os.stat(temp, follow_symlinks=False)):
                    os.unlink(temp)
            except FileNotFoundError:
                pass


def state_problems(night, folder, now, gap_to_now):
    found = [(night.last["id"], "NO_GO", "") for _ in [1] if night.go is None and night.last is not None]
    found += [(e["id"], "INTENT_NO_RESULT", f"{e['item']}: `{e.get('command', '')}`") for e in night.open_intents()]
    found += [(gap[0], "GAP", gap_text(night, gap)) for gap in gaps(night, now if gap_to_now else None)]
    if stop_passed(night, now):
        found.append((night.last["id"], "STOP_NOT_CLOSED", f"stop {night.go['stop']}"))
    if night.last is not None:
        recorded = {e["cut_file"] for e in night.entries if e["kind"] == "repair"}
        found += [(night.last["id"], "CUT_UNRECORDED", name) for name in cut_files(folder) if name not in recorded]
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


def staged_repair(folder, data, entries):
    """Return the one side record whose identity matches these bytes."""
    recorded = {e["cut_file"]: e for e in entries if e["kind"] == "repair"}
    pending = []
    for name in cut_files(folder):
        path = os.path.join(folder, name)
        try:
            with open(path, encoding="utf-8") as handle:
                side = json.load(handle)
            entry = side["entry"]
            cut = base64.b64decode(side["cut"], validate=True)
            length = side["prefix_bytes"]
            if type(length) is not int or length < 1 or length > len(data):
                raise ValueError("prefix size")
            prefix, suffix = data[:length], data[length:]
            if (not prefix.endswith(b"\n") or hashlib.sha256(prefix).hexdigest() != side["prefix_sha256"]
                    or not cut or b"\n" in cut or entry["cut_file"] != name or entry["bytes"] != len(cut)
                    or schema_problem(entry)):
                raise ValueError("side record identity")
            if name in recorded:
                if entry != recorded[name]:
                    raise ValueError("recorded entry differs")
                continue
            if suffix != cut and not entry_bytes(entry).startswith(suffix):
                raise ValueError("partial write differs")
            pending.append((prefix, entry))
        except (OSError, TypeError, ValueError, AttributeError, KeyError):
            raise Refused("REPAIR_PENDING", name) from None
    if len(pending) > 1:
        raise Refused("REPAIR_PENDING", "multiple side records")
    return pending[0] if pending else None


def stage_repair(folder, prefix, cut, entry):
    side = {"prefix_bytes": len(prefix), "prefix_sha256": hashlib.sha256(prefix).hexdigest(),
            "cut": base64.b64encode(cut).decode("ascii"), "entry": entry}
    write_file(folder, entry["cut_file"], json.dumps(side) + "\n")


def finish_repair(folder, prefix, entry):
    # A staged file must be durable even if the previous call died directly after rename.
    try:
        sync_folder(folder)
        os.truncate(journal_path(folder), len(prefix))
    except OSError as error:
        raise Refused("WRITE_FAILED", f"staged repair: {error.strerror}") from None
    append(folder, entry, first=False)


LEADER_JOURNAL = "leader-events.jsonl"


def leader_path(chief, night, target):
    assignment = night.assignments[target]
    worktree = assignment["worktree"]
    child = os.path.join(worktree, ".overnight", night.run, target.replace("/", "_").replace("#", "-"))
    if (os.path.commonpath((os.path.abspath(chief), worktree)) in (chief, worktree) or os.path.realpath(child) != child):
        raise Refused("MERGE_JOURNAL_PATH", child)
    return child


def leader_events(chief, night, target):
    """Read the PR journal under the same lock as the chief journal."""
    folder = leader_path(chief, night, target)
    path = os.path.join(folder, LEADER_JOURNAL)
    if os.path.realpath(path) != path:
        raise Refused("MERGE_JOURNAL_PATH", path)
    try:
        with open(path, "rb") as handle:
            content = handle.read()
    except FileNotFoundError:
        return []
    except OSError:
        raise Refused("MERGE_JOURNAL_PATH", folder) from None
    if content and not content.endswith(b"\n"):
        raise Refused("TORN_LINE", folder)
    entries, attempts, results, pairs, capped = [], {}, set(), set(), False
    for number, raw in enumerate(content.split(b"\n")[:-1], 1):
        entry = json_record(raw, number)
        kind = entry.get("kind")
        if (entry.get("id") != number or entry.get("run") != night.run or entry.get("target") != target
                or not entry_time(entry.get("t")) or (entries and entry_time(entry["t"]) < entry_time(entries[-1]["t"]))):
            raise Refused("JOURNAL_FAULTS", f"{folder} line {number}")
        if kind == "merge-attempt":
            grant_id = entry.get("grant")
            grant = night.grants.get(grant_id) if type(grant_id) is int else None
            if (not grant or grant_id in attempts.values() or
                    any(entry.get(k) != grant[k] for k in ("target", "head", "base", "method", "leader"))):
                raise Refused("JOURNAL_FAULTS", f"{folder} attempt {number}")
            attempts[number] = grant_id
        elif kind in ("review", "cap"):
            reports = entry.get("reports")
            assignment_id = entry.get("assignment")
            assignment = next((e for e in night.entries if e["id"] == assignment_id and e["kind"] == "assign"), None)
            if (capped or not assignment or assignment["target"] != target or assignment["leader"] != entry.get("leader")
                    or not report_pair(reports) or [r["who"] for r in reports] != assignment["reviewers"]
                    or len({r["head"] for r in reports}) != 1 or len({r["source"] for r in reports}) != 2):
                raise Refused("JOURNAL_FAULTS", f"{folder} review {number}")
            key = tuple((r["head"], r["source"]) for r in reports)
            should_cap = (len(pairs) + 1 >= night.go["review_cap"] and any(r["p1"] or r["p2"] for r in reports))
            if key in pairs or (kind == "cap") != should_cap or (should_cap and not cap_spec(entry.get("spec"))):
                raise Refused("JOURNAL_FAULTS", f"{folder} review cap {number}")
            pairs.add(key)
            capped = should_cap
        elif kind == "merge-invalidate":
            grant_id = entry.get("grant")
            if type(grant_id) is not int or night.grants.get(grant_id, {}).get("target") != target:
                raise Refused("JOURNAL_FAULTS", f"{folder} invalidation {number}")
        elif kind == "merge-result":
            of = entry.get("of")
            outcome = entry.get("outcome")
            sha = entry.get("sha")
            if (type(of) is not int or of not in attempts or of in results
                    or outcome not in ("merged", "failed", "unknown", "unsent")
                    or outcome != "unsent" and not entry_time(entry.get("sent_at"))
                    or (outcome == "merged" and (not isinstance(sha, str) or not FULL_SHA.fullmatch(sha)))):
                raise Refused("JOURNAL_FAULTS", f"{folder} result {number}")
            results.add(of)
        else:
            raise Refused("JOURNAL_FAULTS", f"{folder} entry kind {kind!r}")
        entries.append(entry)
    return entries


def leader_append(chief, night, target, records, kind, now, fields):
    folder = leader_path(chief, night, target)
    os.makedirs(folder, exist_ok=True)
    entry = {"kind": kind, "id": len(records) + 1, "t": iso(now), "run": night.run, "target": target, **fields}
    if records and now < entry_time(records[-1]["t"]):
        raise Refused("TIME_BACK", "leader journal is ahead of the clock")
    append(folder, entry, first=not records, name=LEADER_JOURNAL)
    records.append(entry)
    return entry


def merge_snapshot(chief, night):
    return [e for target in sorted(night.assignments) for e in leader_events(chief, night, target)]


def checked_night(folder):
    if cut_files(folder):
        data = journal_bytes(folder) or b""
        entries = parse_lines(data[:data.rfind(b"\n") + 1])
        if staged_repair(folder, data, entries):
            raise Refused("REPAIR_PENDING")
    return fold(read_journal(folder) or [])


def add_entry(folder, night, kind, given, now, fake):
    entry = {"id": night.last["id"] + 1 if night.last else 1, "t": iso(now), "kind": kind}
    entry.update({k: v for k, v in given.items() if v is not None})
    if fake:
        entry["fake_clock"] = True
    if problem := schema_problem(entry):
        if kind in ("assign", "merge-permission") and problem.startswith("field 'reviewers'"):
            raise Refused("REVIEWER_NOT_ASSIGNED", problem)
        code = "MERGE_EVIDENCE_INVALID" if kind in ("assign", "merge-permission", "review", "cap") else "SCHEMA"
        raise Refused(code, problem)
    if found := judge(night, entry):
        raise Refused(*found[0], event=entry)
    append(folder, entry, first=not night.entries)
    apply(night, entry)
    return entry


def write_entry(folder, kind, fields, then=None):
    with Lock(folder):
        night = checked_night(folder)
        now, fake = clock()
        given = fields(night, now) if callable(fields) else fields
        entry = add_entry(folder, night, kind, given, now, fake)
        if then:
            then(night, entry)
        return entry


def require_merge_snapshot(folder, night):
    if night.newest_report() and night.newest_report().get("merges", []) != merge_snapshot(folder, night):
        raise Refused("REPORT_OLD", "leader journal changed")


def repair(folder):
    with Lock(folder):
        data = journal_bytes(folder) or b""
        keep = data.rfind(b"\n") + 1
        prefix, cut = data[:keep], data[keep:]
        entries = parse_lines(prefix)
        if staged := staged_repair(folder, data, entries):
            prefix, entry = staged
            found = judge(fold(parse_lines(prefix)), entry)
        elif cut:
            now, fake = clock()
            night = fold(entries)
            number = 1 + max((int(re.search(r"\d+", n).group()) for n in cut_files(folder)), default=0)
            entry = {"id": night.last["id"] + 1 if night.last else 1, "kind": "repair", "t": iso(now),
                     "cut_file": f"journal.cut-{number}.txt", "bytes": len(cut)}
            if fake:
                entry["fake_clock"] = True
            found = judge(night, entry)
            if not found:
                stage_repair(folder, prefix, cut, entry)
        else:
            raise Refused("REPAIR_NOTHING")
        if found:
            raise Refused(*found[0], event=entry)
        finish_repair(folder, prefix, entry)
    return entry


def view_locked(folder):
    night = fold(read_journal(folder) or [])
    now, fake = clock()
    if fake and not night.test:
        raise Refused("FAKE_CLOCK", "a fake clock cannot read a real journal")
    return night, now


def bound_night(folder):
    if os.path.realpath(folder) != os.path.abspath(folder):
        raise Refused("MERGE_JOURNAL_PATH", folder)
    journal = os.path.join(folder, "journal.jsonl")
    if os.path.realpath(journal) != os.path.abspath(journal):
        raise Refused("MERGE_JOURNAL_PATH", journal)
    night = checked_night(folder)
    if not night.entries or night.entries[0]["chief_path"] != os.path.abspath(folder):
        raise Refused("MERGE_JOURNAL_PATH", folder)
    return night

def recorded_report(folder, night, entry):
    try:
        write_file(folder, REPORT, render(night.entries))
    except Refused as refusal:
        refusal.detail += f"; entry E{entry['id']} is in the journal: run `render`"
        raise
