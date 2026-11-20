"""The leader journal for one exact dispatch. Call under the common lock."""

import json
import os
import stat

import night_files
from night_files import (Lock, bound_night, clock, cut_files, finish_repair, json_record,
                         stage_repair, staged_repair, sync_folder)
from night_format import FULL_SHA, Refused, clean_entry, entry_time, iso


LEADER_JOURNAL = "leader-events.jsonl"


def leader_path(chief, night, target):
    assignment = night.assignments[target]
    return checked_leader_folder(chief, assignment)


def checked_leader_folder(chief, assignment):
    child, worktree = assignment["folder"], assignment["worktree"]
    if (not os.path.isabs(child) or os.path.realpath(child) != child or not os.path.isdir(child)
            or any(os.path.commonpath((child, root)) in (child, root) for root in (worktree, os.path.abspath(chief)))):
        raise Refused("MERGE_JOURNAL_PATH", child)
    return child


def init_leader(chief, night, assignment, now):
    folder = checked_leader_folder(chief, assignment)
    path = os.path.join(folder, LEADER_JOURNAL)
    if assignment["target"] in night.assignments:
        leader_events(chief, night, assignment["target"])
        return
    expected = {key: assignment[key] for key in ("run", "leader", "target")}
    if not os.path.lexists(path):
        night_files.append(folder, dict(id=1, t=iso(now), kind="leader-init", **expected), first=True, name=LEADER_JOURNAL)
        return
    if os.path.realpath(path) != path:
        raise Refused("MERGE_JOURNAL_PATH", path)
    try:
        with open(path, "rb") as handle:
            content = handle.read()
            record = json.loads(content)
            if (not content.endswith(b"\n") or content.count(b"\n") != 1
                    or record.get("id") != 1 or not entry_time(record.get("t"))
                    or record.get("kind") != "leader-init" or any(record.get(k) != v for k, v in expected.items())):
                raise Refused("LEADER_JOURNAL_GAP", path)
            os.fsync(handle.fileno())
        sync_folder(folder)
    except (ValueError, AttributeError):
        raise Refused("LEADER_JOURNAL_GAP", path) from None
    except OSError:
        raise Refused("WRITE_FAILED", path) from None


def journal_content(folder):
    path = os.path.join(folder, LEADER_JOURNAL)
    if os.path.realpath(path) != path:
        raise Refused("MERGE_JOURNAL_PATH", path)
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as handle:
            if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
                raise Refused("MERGE_JOURNAL_PATH", path)
            content = handle.read()
    except FileNotFoundError:
        return b""
    except OSError:
        raise Refused("MERGE_JOURNAL_PATH", folder) from None
    return content


def repair_shape(entry):
    return not (entry.get("kind") == "repair" and type(entry.get("id")) is int
                and isinstance(entry.get("cut_file"), str) and type(entry.get("bytes")) is int
                and entry["bytes"] > 0 and entry_time(entry.get("t")))


def leader_events(chief, night, target):
    """Read the PR journal under the same lock as the chief journal."""
    folder = leader_path(chief, night, target)
    data = journal_content(folder)
    prefix = data[:data.rfind(b"\n") + 1]
    events = leader_prefix(folder, night, target, prefix)
    if cut_files(folder) and staged_repair(folder, data, events, LEADER_JOURNAL, repair_shape):
        raise Refused("REPAIR_PENDING", folder)
    if data != prefix:
        raise Refused("TORN_LINE", folder)
    return events


def leader_prefix(folder, night, target, content):
    path = os.path.join(folder, LEADER_JOURNAL)
    if not content:
        raise Refused("LEADER_JOURNAL_GAP", path)
    if not content.endswith(b"\n"):
        raise Refused("TORN_LINE", folder)
    entries, attempts, ready, results = [], {}, set(), set()
    clean_intents, clean_results, temps = {}, set(), set()
    stage_entries = set()
    for number, raw in enumerate(content.split(b"\n")[:-1], 1):
        entry = json_record(raw, number)
        kind = entry.get("kind")
        if (entry.get("id") != number or entry.get("run") != night.run or entry.get("target") != target
                or not entry_time(entry.get("t")) or (entries and entry_time(entry["t"]) < entry_time(entries[-1]["t"]))):
            raise Refused("JOURNAL_FAULTS", f"{folder} line {number}")
        if number == 1:
            first = night.first_assignments[target]
            if kind != "leader-init" or entry.get("leader") != first["leader"]:
                raise Refused("LEADER_JOURNAL_GAP", path)
        elif kind == "merge-attempt":
            grant_id = entry.get("grant")
            grant = night.grants.get(grant_id) if type(grant_id) is int else None
            if (not grant or grant_id in attempts.values() or
                    any(entry.get(k) != grant[k] for k in ("target", "head", "base", "method", "leader"))):
                raise Refused("JOURNAL_FAULTS", f"{folder} attempt {number}")
            attempts[number] = grant_id
        elif kind == "merge-invalidate":
            grant_id = entry.get("grant")
            if type(grant_id) is not int or night.grants.get(grant_id, {}).get("target") != target:
                raise Refused("JOURNAL_FAULTS", f"{folder} invalidation {number}")
        elif kind == "repair":
            if repair_shape(entry):
                raise Refused("JOURNAL_FAULTS", f"{folder} recovery {number}")
        elif kind == "merge-ready":
            of = entry.get("of")
            if type(of) is not int or of not in attempts or of in ready or of in results or entry.get("outcome") not in (
                    "ready", "failed", "unknown"):
                raise Refused("JOURNAL_FAULTS", f"{folder} Ready result {number}")
            ready.add(of)
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
        elif kind in ("clean-stage", "clean-restore"):
            of = entry.get("of")
            slot = os.path.join(folder, ".cleanup-stage", f"E{of}")
            if (type(of) is not int or of not in clean_intents or of in clean_results or of in stage_entries
                    or entry.get("item") != "temp" or clean_intents[of][:2] != ("temp", entry.get("subject"))
                    or entry.get("slot") != slot):
                raise Refused("JOURNAL_FAULTS", f"{folder} cleanup stage {number}")
            stage_entries.add(of)
        elif kind in ("temp-record", "clean-intent", "clean-result", "clean-refusal"):
            if not clean_entry(entry, clean_intents, clean_results, temps):
                raise Refused("JOURNAL_FAULTS", f"{folder} cleanup entry {number}")
        else:
            raise Refused("JOURNAL_FAULTS", f"{folder} entry kind {kind!r}")
        entries.append(entry)
    return entries


def leader_append(chief, night, target, records, kind, now, fields):
    folder = leader_path(chief, night, target)
    entry = {"kind": kind, "id": len(records) + 1, "t": iso(now), "run": night.run, "target": target, **fields}
    if records and now < entry_time(records[-1]["t"]):
        raise Refused("TIME_BACK", "leader journal is ahead of the clock")
    night_files.append(folder, entry, first=not records, name=LEADER_JOURNAL)
    records.append(entry)
    return entry


def repair_leader(chief, target):
    with Lock(chief):
        night = bound_night(chief)
        now, fake = clock()
        if fake and not night.test:
            raise Refused("FAKE_CLOCK")
        if night.faults:
            raise Refused("JOURNAL_FAULTS")
        if night.close:
            raise Refused("CLOSED")
        if target not in night.assignments:
            raise Refused("MERGE_PR_NOT_ON_CARD", target)
        folder = leader_path(chief, night, target)
        data = journal_content(folder)
        keep = data.rfind(b"\n") + 1
        prefix, tail = data[:keep], data[keep:]
        records = leader_prefix(folder, night, target, prefix)
        if staged := staged_repair(folder, data, records, LEADER_JOURNAL, repair_shape):
            prefix, entry = staged
        elif tail:
            if now < entry_time(records[-1]["t"]):
                raise Refused("TIME_BACK")
            existing = cut_files(folder)
            number = 1 + max((int(name.split("-")[-1].split(".")[0]) for name in existing), default=0)
            entry = dict(id=len(records) + 1, kind="repair", run=night.run, target=target,
                         t=iso(now), cut_file=f"journal.cut-{number}.txt", bytes=len(tail))
            stage_repair(folder, prefix, tail, entry, LEADER_JOURNAL)
        else:
            raise Refused("REPAIR_NOTHING")
        checked = leader_prefix(folder, night, target, prefix + night_files.entry_bytes(entry))
        finish_repair(folder, prefix, checked[-1], LEADER_JOURNAL)
        return entry


def merge_snapshot(chief, night, *, allow_gaps=False):
    records = []
    for target in sorted(night.assignments):
        try:
            records.extend(leader_events(chief, night, target))
        except Refused as refusal:
            if not allow_gaps:
                raise
            records.append(dict(kind="leader-gap", target=target, code=refusal.code, detail=refusal.detail))
    return records


def require_merge_snapshot(folder, night):
    if night.newest_report() and night.newest_report().get("merges", []) != merge_snapshot(folder, night):
        raise Refused("REPORT_OLD", "leader journal changed")
