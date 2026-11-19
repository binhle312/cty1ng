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

sys.dont_write_bytecode = True  # no __pycache__ in the skill folder
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops the script folder
try:
    from night_format import (
        CARD, CLOSE_REASONS, DEFAULT_HEARTBEAT_MIN, FIELDS, FORMAT, GOALS, LOG_KINDS, OUTCOMES, PAGE_CHECKS,
        PAGE_OUTCOMES, REHEARSALS, REPORT, Refused, event_id, iso, line_for, parse_row, parse_stop, schema_problem)
    from night_rules import apply, counts_with, fold, judge, rows_problems
    from night_report import fenced, gap_text, gaps, needs_you, render, status_data
    from night_files import (
        Lock, append, clock, cut_files, journal_bytes, journal_path, max_gap_env, need_night, parse_card, parse_lines,
        read_journal, read_words, state_problems, sync_folder, test_mode, unrecorded_cuts, write_file)
except ImportError as error:  # a copy of night.py without its modules
    print(f"REFUSED [INTERNAL] (final: do not retry): night.py cannot import its modules ({error}). Copy the whole scripts folder.", file=sys.stderr)
    sys.exit(3)


def write_entry(folder, kind, fields, then=None, read=read_journal, before_append=None):
    """Lock, read, clock, fold, build, judge, `before_append()`, append, then `then(night, entry)`, all under the lock.
    The clock is read after the wait for the lock, so the entry time is never before an earlier entry.
    `before_append` runs only after the rules pass, so a refused command changes no file."""
    with Lock(folder):
        entries = read(folder) or []
        now, fake = clock()
        night = fold(entries)
        entry = {"id": night.last["id"] + 1 if night.last else 1, "t": iso(now), "kind": kind}
        given = fields(night, now) if callable(fields) else fields
        entry.update({k: v for k, v in given.items() if v is not None})
        if fake:
            entry["fake_clock"] = True
        problem = schema_problem(entry)
        if problem:
            raise Refused("SCHEMA", f"the new entry: {problem}")
        found = judge(night, entry)
        if found:
            raise Refused(found[0][0], found[0][1], event=entry)
        if before_append:
            before_append()
        append(folder, entry, first=not entries)
        apply(night, entry)
        if then:
            try:
                then(night, entry)
            except Refused as refusal:
                if refusal.code == "WRITE_FAILED":
                    refusal.detail += f"; entry E{entry['id']} is in the journal: run `render`"
                raise
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
    for code, detail in rows_problems(rows) if rows else [("ITEMS_EMPTY", "")]:
        raise Refused(code, detail)
    for row in rows:
        print(" | ".join(row))


def cmd_go(args):
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


# The options of each log kind are its fields (FIELDS); the owner's words come in through --words-file.
ALLOWED = {kind: {"words_file" if name == "words" else name for name in FIELDS[kind]} for kind in LOG_KINDS}


OPTIONS = sorted(set().union(*ALLOWED.values()))


def log_fields(args):
    """The fields of a log entry from the arguments. Only argument checks here; the rules come later."""
    kind = args.kind
    if kind in ("amend", "answer") and args.text is not None:
        raise Refused("WORDS_AS_ARGUMENT")
    given = [name for name in OPTIONS if getattr(args, name) not in (None, False)]
    extra = [name for name in given if name not in ALLOWED[kind]]
    if extra:
        raise Refused("ARG_NOT_FOR_KIND", f"{kind} does not take " + ("a text" if extra[0] == "text" else
                                                                       f"--{extra[0].replace('_', '-')}"))
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
    entry = write_entry(args.dir, args.kind, fields)
    print(f"E{entry['id']} {args.kind}" + (f" {entry['item']}" if entry.get("item") else ""))
    if "add_item" in entry:
        print(f"ADDED ITEM: {' | '.join(entry['add_item'])} (E{entry['id']}): read it back to the owner "
              "before you act on it.")


def cmd_report(args):

    def write(night, entry):
        write_file(args.dir, REPORT, render(night.entries))
    entry = write_entry(args.dir, "report", lambda night, now: {"counts": counts_with(night, "report")}, write)
    print(f"E{entry['id']} report written: {os.path.join(args.dir, REPORT)}")


def cmd_render(args):
    with Lock(args.dir):
        entries = read_journal(args.dir) or []
        night = fold(entries)
        if not night.reports:
            raise Refused("REPORT_NONE_YET")
        write_file(args.dir, REPORT, render(entries))
    print(f"report.md written again from the journal (report E{night.newest_report()['id']})")


def cmd_close(args):
    notes, state = [], {}

    def write(night, entry):
        state["night"] = night
        write_file(args.dir, REPORT, render(night.entries))
        notes.extend(f"{row[0]}: {row[1]} ({row[4]})" for row in needs_you(night))
        notes.extend(gap_text(night, gap) for gap in gaps(night))
    entry = write_entry(args.dir, "close", {"reason": args.reason, "without_page": args.without_page}, write)
    night = state["night"]
    for line in notes:
        print(f"NOTE: {line} (it is on the report)")
    print(f"E{entry['id']} NIGHT CLOSED {night.run} reason {args.reason}" + (" TEST JOURNAL" if night.test else ""))


def cmd_repair(args):
    """Move a cut last line to a side file and record it, or record a side file that a crash left with no entry.
    The rules run before any file changes; the side file is written before the cut, so a crash loses no byte."""
    path = journal_path(args.dir)
    plan = {}

    def read(folder):
        data = journal_bytes(folder) or b""
        keep = data.rfind(b"\n") + 1 if data and not data.endswith(b"\n") else len(data)
        entries = parse_lines(data[:keep])
        if keep < len(data):
            number = 1 + max((int(re.search(r"\d+", n).group()) for n in cut_files(folder)), default=0)
            plan.update(name=f"journal.cut-{number}.txt", cut=data[keep:], keep=keep)
        else:
            missing = unrecorded_cuts(folder, fold(entries))
            if not missing:
                raise Refused("REPAIR_NOTHING")
            plan.update(name=missing[0], cut=None)
        return entries

    def fields(night, now):
        size = len(plan["cut"]) if plan["cut"] is not None else os.path.getsize(os.path.join(args.dir, plan["name"]))
        return {"cut_file": plan["name"], "bytes": size}

    def cut():
        if plan["cut"] is None:
            return
        try:
            with open(os.path.join(args.dir, plan["name"]), "wb") as handle:
                handle.write(plan["cut"])
                handle.flush()
                os.fsync(handle.fileno())
            sync_folder(args.dir)
            os.truncate(path, plan["keep"])
        except OSError as error:
            raise Refused("WRITE_FAILED", f"{path}: {error.strerror}") from None
    entry = write_entry(args.dir, "repair", fields, read=read, before_append=cut)
    print(f"E{entry['id']} repair: {entry['bytes']} bytes in {entry['cut_file']}")


def read_for_view(folder):
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
    log.add_argument("--add-item", help='amend: "<name> | owner" or "<name> | commit|no-commit | <command>"')
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
        clock()  # NIGHT_FAKE_NOW with no test mode stops each command, also one that reads no time
        if args.command_name not in ("new", "items"):
            need_night(args.dir)
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
