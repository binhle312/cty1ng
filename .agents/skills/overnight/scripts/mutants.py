#!/usr/bin/env python3
"""Mutant runner for night.py. Run: `python3 -I mutants.py [name ...]` in this folder.

Each mutant changes one rule of night.py (one text replace). The runner writes the changed copy
to a temp folder, runs test_night.py on it (NIGHT_PY, stop at the first failure), and prints the
first test that fails. A mutant that no test kills SURVIVED. Exit 1 if a mutant survives or if its
old text is not in night.py exactly one time (then the list needs an update after a code change).
NIGHT_PY names another night.py to mutate.
A race mutant runs RACE_ROUNDS times. The test hook slows each journal append, so one round is enough.
An entry can be a list of (old, new) pairs: several edits make one mutant.
"""

import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
RACE_ROUNDS = 1  # the hook slows each append, so one round shows a race (advisor point 2)

MUTANTS = [
    # Lock and order (score: lock not exclusive; check before the lock).
    ("lock not exclusive", "os.O_CREAT | os.O_EXCL | os.O_WRONLY", "os.O_CREAT | os.O_WRONLY"),
    ("decide before the lock",
     "    with Lock(folder):\n        extra = prepare() if prepare else {}\n        entries = read_journal(folder) or []\n"
     "        now, fake = clock()\n        night = fold(entries)\n",
     "    entries = read_journal(folder) or []\n    night = fold(entries)\n    with Lock(folder):\n"
     "        extra = prepare() if prepare else {}\n        now, fake = clock()\n"),
    ("a dead lock is removed", 'return Refused("LOCK_STALE", f"process {pid} is not running. {repair}")',
     'return os.remove(self.path) or Refused("LOCK_STALE", f"process {pid} is not running. {repair}")'),
    ("a dead lock looks held", 'except ProcessLookupError:\n            return Refused("LOCK_STALE"',
     'except ProcessLookupError:\n            return Refused("LOCK_HELD"'),
    # Reading the journal (score: a bad JSON line is skipped).
    ("a bad line is skipped", 'raise Refused("BAD_LINE", f"line {number}") from None', "continue"),
    ("a cut line is read", 'if data and not data.endswith(b"\\n"):', "if False:"),
    ("an unknown field is allowed", "return f\"field {name!r} is not a field of {entry['kind']}\"", "continue"),
    ("field types are not checked", "if not fits(fields[name], value):", "if False:"),
    ("a bad argument byte passes", 'value.encode("utf-8")', 'value.encode("utf-8", "surrogateescape")'),
    # Clock.
    ("a fake clock without test mode", 'if not test_mode():\n        raise Refused("FAKE_CLOCK_NO_TEST")',
     'if False:\n        raise Refused("FAKE_CLOCK_NO_TEST")'),
    ("a fake time in a real journal", 'return [("FAKE_CLOCK", "")] if entry.get("fake_clock") and not test else []', "return []"),
    ("new records no test flag", '"test": True if test_mode() else None', '"test": None'),
    ("time may go back", 'if night.last and entry_time(entry["t"]) < entry_time(night.last["t"]):', "if False:"),
    # Order of entries and phases (score: close in prepared; close twice; intent before go; report after close).
    ("no first-entry rule", 'found = [] if entry["kind"] == "new" else [("FIRST_NOT_NEW"', 'found = [] if True else [("FIRST_NOT_NEW"'),
    ("a second new", 'found = [("NEW_TWICE", f"{night.run}")] if entry["kind"] == "new" else []', "found = []"),
    ("ids may skip", 'if entry["id"] != night.last["id"] + 1:', "if False:"),
    ("a second go", 'if kind == "go" and phase == "running":', "if False:"),
    ("close in the prepared phase", '"prepared": {"go", "alive",', '"prepared": {"close", "go", "alive",'),
    ("intent before go", 'if phase == "prepared" and (kind not in', 'if phase == "prepared" and kind != "intent" and (kind not in'),
    ("close twice", '"closed": {"aware", "error", "answer", "repair"},', '"closed": {"aware", "error", "answer", "repair", "close"},'),
    ("report after close", '"closed": {"aware", "error", "answer", "repair"},', '"closed": {"aware", "error", "answer", "repair", "report"},'),
    ("no closed phase rule", 'if phase == "closed" and kind not in PHASE_KINDS["closed"]:', "if False:"),
    # Owner words.
    ("words not needed", 'return [("WORDS_MISSING", "")]', "return []"),
    ("words as an argument", 'if kind in ("amend", "answer") and args.text is not None:', "if False:"),
    # Card items (Q1 A).
    ("a name not on the card", "        if name not in night.items:\n            return [(\"ITEM_NOT_ON_CARD\"",
     "        if name_key(name) not in {name_key(n) for n in night.items}:\n            return [(\"ITEM_NOT_ON_CARD\""),
    ("notes take any item", 'ITEM_EVENTS = ("intent", "denied", "hold", "wait", "decision", "aware", "error", "reserve")',
     'ITEM_EVENTS = ("intent", "denied", "hold", "wait")'),
    ("no item name rule", 'if not name or name != name.strip() or "|" in name or any(ord(c) < 32 or ord(c) == 127 for c in name):',
     "if not name:"),
    ("no item option rule", "elif (kind == \"commit\") != bool(rest) or (rest and not OPTION.fullmatch(rest[0])):", "elif False:"),
    ("duplicate names pass", "        if key in seen:\n", "        if False:\n"),
    ("add-item of a card name", "        if name_key(row[0]) in known:\n", "        if False:\n"),
    ("an empty items block", 'if not entry["items"]:', "if False:"),
    ("two items blocks", "if len(blocks) > 1:", "if False:"),
    ("a fence closes another fence", "elif stripped and set(stripped) == {fence[0]} and len(stripped) >= len(fence):",
     "elif stripped.startswith(fence[0] * 3):"),
    ("an option is accepted for its kind", 'if extra:\n        raise Refused("ARG_NOT_FOR_KIND"', 'if False:\n        raise Refused("ARG_NOT_FOR_KIND"'),
    # Blocks.
    ("an owner item takes an action", 'if kind == "owner":\n        return [("OWNER_ITEM"', 'if False:\n        return [("OWNER_ITEM"'),
    ("denied does not block", "    if item in night.denied:\n", "    if False:\n"),
    ("hold does not block", "    if item in night.held:\n", "    if False:\n"),
    ("a reopen opens each denial", 'night.denied.pop(entry["reopen"], None)', "night.denied.clear()"),
    ("a reopen of an item with no block", 'if entry["reopen"] not in night.denied and entry["reopen"] not in night.held:', "if False:"),
    ("a denied row with an open intent", "        if latest is not None and latest not in night.results:\n", "        if False:\n"),
    ("a denied row needs no fields", 'if not entry.get("command", "").strip() or not entry.get("blocks", "").strip():', "if False:"),
    ("a denied result needs no blocks", 'if entry["outcome"] == "denied" and not entry.get("blocks", "").strip():', "if False:"),
    # Intent (Q2 A).
    ("an intent after the stop minute", 'if entry_time(entry["t"]) >= entry_time(night.go["stop"]):',
     'if entry_time(entry["t"]) > entry_time(night.go["stop"]):'),
    ("no rehearsal gate", 'if night.go["rehearsal"] not in REHEARSALS_FOR_ACTION:', 'if night.go["rehearsal"] == "nothing":'),
    ("faults do not stop intents", 'if night.faults:\n        return [("JOURNAL_FAULTS"', 'if False:\n        return [("JOURNAL_FAULTS"'),
    ("an open intent passes", "        if last_result is None:\n", "        if False:\n"),
    ("an unknown result passes", 'if last_result["outcome"] == "unknown":', "if False:"),
    ("a commit item with --no-head", 'if "head" not in entry or "no_head" in entry:', 'if "head" not in entry and "no_head" not in entry:'),
    ("a short head", 'if not FULL_SHA.fullmatch(entry["head"]):', 'if not re.fullmatch(r"[0-9a-fA-F]{7,40}", entry["head"]):'),
    ("the head anywhere in the command",
     "if not re.search(rf\"(?<![\\w-]){re.escape(option)}(?:=|\\s+){entry['head']}(?![0-9A-Fa-f])\", command):",
     "if entry['head'] not in command:"),
    ("a no-commit item with a head", 'if "head" in entry:\n        return [("NO_COMMIT_HAS_HEAD"', 'if False:\n        return [("NO_COMMIT_HAS_HEAD"'),
    ("a no-commit item with no reason", 'if not entry.get("no_head", "").strip():', "if False:"),
    ("an upper-case sha in a no-commit command", "if ANY_SHA.search(command):", "if FULL_SHA.search(command):"),
    # Results, rows and decisions (score: --resolves not checked).
    ("a result of no intent", 'if entry["of"] not in night.intents:\n        return [("RESULT_NOT_INTENT"',
     'if False:\n        return [("RESULT_NOT_INTENT"'),
    ("a final result changes", 'if before and before["outcome"] in FINAL_OUTCOMES:', "if False:"),
    ("no text needed", 'if kind in ("hold", "wait", "decision", "aware", "error") and not entry.get("text", "").strip():', "if False:"),
    ("a decision with no source", 'if not entry.get("source", "").strip() and not entry.get("check"):', "if False:"),
    ("--resolves not checked", 'if "resolves" in entry and entry["resolves"] not in night.waits:', "if False:"),
    # Go (score: heartbeat <= 0; gap < heartbeat; NIGHT_MAX_GAP_MIN not checked).
    ("a stop time in the past", 'if entry_time(entry["stop"]) <= entry_time(entry["t"]):', "if False:"),
    ("heartbeat 0", 'if entry["heartbeat_min"] <= 0:', 'if entry["heartbeat_min"] < 0:'),
    ("gap below the heartbeat", 'if entry["gap_min"] < entry["heartbeat_min"]:', "if False:"),
    ("gap above the maximum", 'if entry["gap_min"] > limit:', "if False:"),
    ("the recorded maximum is ignored", 'limit = min(entry["max_gap_min"], DEFAULT_MAX_GAP_MIN)', "limit = DEFAULT_MAX_GAP_MIN"),
    ("NIGHT_MAX_GAP_MIN not checked", "if not raw.isdigit() or not 1 <= int(raw) <= DEFAULT_MAX_GAP_MIN:", "if not raw.isdigit():"),
    # Report, page and close (Q4 A; score: any pagecheck name; report without amends; empty open_denials).
    ("any pagecheck name", "if args.name not in PAGE_CHECKS or", "if args.name is None or"),
    ("a page check of an older report", 'if report and entry["report"] != report["id"]:', "if False:"),
    ("a page check of an old report", "        return report_fresh(night, [])\n    if kind == \"close\":",
     "        return []\n    if kind == \"close\":"),
    ("an aware entry keeps the report fresh", 'KEEPS_REPORT_FRESH = ("pagecheck", "alive")',
     'KEEPS_REPORT_FRESH = ("pagecheck", "alive", "aware")'),
    ("an old report closes", "elif night.made_old_by:", "elif False:"),
    ("close with no page checks", 'if missing:\n                found.append(("PAGE_CHECKS"', 'if False:\n                found.append(("PAGE_CHECKS"'),
    ("close with an open intent", 'if pending:\n            return [("CLOSE_OPEN_INTENT"', 'if False:\n            return [("CLOSE_OPEN_INTENT"'),
    ("report counts not checked", 'if kind == "report" and entry["counts"] != counts_with(night, "report"):', "if False:"),
    ("report counts without the report", 'lambda night, now: {"counts": counts_with(night, "report")}', 'lambda night, now: {"counts": dict(night.counts)}'),
    ("status shows live counts for a report", '"counts": report["counts"], "test": night.test}', '"counts": night.counts, "test": night.test}'),
    ("report without amends", 'for e in night.entries if e["kind"] in ("amend", "answer")]', 'for e in night.entries if e["kind"] in ("answer",)]'),
    ("empty open_denials in status", '"open_denials": short(night.denied.values(), night.item_of),', '"open_denials": [],'),
    ("the open report shows later entries", 'cut = full.close["id"] if full.close else report["id"]', 'cut = full.last["id"]'),
    ("close writes no record", "        write_file(args.dir, REPORT, render(night.entries))\n        notes.extend",
     "        notes.extend"),
    ("no cell escape", 'return text.replace("<", "&lt;")', 'return text.replace("<", "<")'),
    ("a short fence for owner words", 'fence = "`" * max(3, longest + 1)', 'fence = "```"'),
    # Check.
    ("no gap rule", "        if length > limit:\n            found.append((before[\"id\"]", "        if False:\n            found.append((before[\"id\"]"),
    ("no gap to now", "if until is not None and night.close is None and timeline:", "if False:"),
    ("the alarm ignores the maximum", 'return min(go["gap_min"], go["max_gap_min"], DEFAULT_MAX_GAP_MIN)', 'return go["gap_min"]'),
    ("no stop rule", "return entry_time(night.last[\"t\"]) >= stop or (now is not None and now >= stop)", "return False"),
    ("report.md not compared", "if current != render(night.entries):", "if False:"),
    ("no go is not found", 'found = [(night.last["id"], "NO_GO", "") for _ in [1] if night.go is None and night.last is not None]',
     "found = []"),
]

# Advisor point 2 (2026-11-19): one rule each; several edits make one mutant.
ADVISOR = [('A1 check misses a second final result (code declared pre-event, no event printed)',
  [('"BAD_LINE", "SCHEMA", "REPAIR_NOTHING", "ID_NOT_REPORT", "WRITE_FAILED", "INTERNAL",',
    '"BAD_LINE", "SCHEMA", "REPAIR_NOTHING", "ID_NOT_REPORT", "WRITE_FAILED", "INTERNAL", "RESULT_FINAL",'),
   ('        if refusal.event is not None and test_mode():',
    '        if refusal.event is not None and test_mode() and refusal.code not in PRE_EVENT_CODES:'),
   ('        for code, detail in judge(night, entry):\n            night.faults.append((entry["id"], code, detail))',
    '        for code, detail in judge(night, entry):\n'
    '            if code != "RESULT_FINAL":\n'
    '                night.faults.append((entry["id"], code, detail))')]),
 ('A2 a refused entry is written all the same',
  [('        if found:\n            raise Refused(found[0][0], found[0][1], event=entry)',
    '        if found:\n'
    '            append(folder, entry, first=not entries)\n'
    '            raise Refused(found[0][0], found[0][1], event=entry)')]),
 ('A3 an aware entry after the close exits 0 but is not written',
  [('        append(folder, entry, first=not entries)\n        apply(night, entry)',
    '        if not (night.phase == "closed" and kind == "aware"):\n'
    '            append(folder, entry, first=not entries)\n'
    '        apply(night, entry)')]),
 ('B4 status: open_holds always empty', [('"open_holds": short(night.held.values()),', '"open_holds": [],')]),
 ('B5 status: open_intents always empty', [('"open_intents": short(night.open_intents()),', '"open_intents": [],')]),
 ('B5b status: unknown_results always empty',
  [('"unknown_results": short(night.unknown(), night.item_of),', '"unknown_results": [],')]),
 ('B5c status: open_waits always empty', [('"open_waits": short(night.waits.values()),', '"open_waits": [],')]),
 ('B5d status: faults always empty',
  [('"faults": [f"E{i} {code}" for i, code, _ in night.faults],', '"faults": [],')]),
 ('B6 a denied row drops the hold of the item (one slot)',
  [('    elif kind == "denied":\n        night.denied[entry["item"]] = entry',
    '    elif kind == "denied":\n'
    '        night.denied[entry["item"]] = entry\n'
    '        night.held.pop(entry["item"], None)')]),
 ('B7 close counts the page checks of each report',
  [('            checks = night.pagechecks.get(night.newest_report()["id"], {})',
    '            checks = {k: v for d in night.pagechecks.values() for k, v in d.items()}')]),
 ('B8 a page check that passed one time stays passed',
  [('        night.pagechecks.setdefault(entry["report"], {})[entry["name"]] = entry["outcome"]',
    '        done = night.pagechecks.setdefault(entry["report"], {})\n'
    '        done[entry["name"]] = "pass" if done.get(entry["name"]) == "pass" else entry["outcome"]')]),
 ('B9 an alive entry makes the report old',
  [('KEEPS_REPORT_FRESH = ("pagecheck", "alive")', 'KEEPS_REPORT_FRESH = ("pagecheck",)')]),
 ('B12 an open intent on any item blocks each intent',
  [('    latest = night.latest.get(item)\n    if latest is not None:\n        last_result',
    '    latest = max(night.latest.values(), default=None)\n    if latest is not None:\n        last_result')]),
 ('B13 a gap equal to the alarm is a gap',
  [('        if length > limit:\n            found.append((before["id"]',
    '        if length >= limit:\n            found.append((before["id"]')]),
 ('B15 a negative heartbeat passes', [('if entry["heartbeat_min"] <= 0:', 'if entry["heartbeat_min"] == 0:')]),
 ('B16 a stop time equal to now passes',
  [('if entry_time(entry["stop"]) <= entry_time(entry["t"]):',
    'if entry_time(entry["stop"]) < entry_time(entry["t"]):')]),
 ('B17 a hand-written max_gap_min above the default is the limit (go rule)',
  [('limit = min(entry["max_gap_min"], DEFAULT_MAX_GAP_MIN)', 'limit = entry["max_gap_min"]')]),
 ('B17b a hand-written max_gap_min above the default is the alarm (check)',
  [('return min(go["gap_min"], go["max_gap_min"], DEFAULT_MAX_GAP_MIN)',
    'return min(go["gap_min"], go["max_gap_min"])')]),
 ('B18 a denied row needs no --blocks',
  [('if not entry.get("command", "").strip() or not entry.get("blocks", "").strip():',
    'if not entry.get("command", "").strip():')]),
 ('B18b a denied row needs no --command',
  [('if not entry.get("command", "").strip() or not entry.get("blocks", "").strip():',
    'if not entry.get("blocks", "").strip():')]),
 ('B20 an entry time with no offset passes the schema',
  [('    return value if value.tzinfo else None\n\n\ndef parse_stop',
    '    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)\n\n\ndef parse_stop')]),
 ('B26 add-item skips the name rule',
  [('found.extend(p for p in row_problems(row, {}) if p[0] != "ITEM_DUPLICATE")',
    'found.extend(p for p in row_problems(row, {}) if p[0] not in ("ITEM_DUPLICATE", "ITEM_NAME"))')]),
 ('B27 an empty item name passes',
  [('if not name or name != name.strip() or "|" in name or', 'if name != name.strip() or "|" in name or')]),
 ('B27b an item name with | passes',
  [('if not name or name != name.strip() or "|" in name or', 'if not name or name != name.strip() or')]),
 ('B28 an option can be any text with no space',
  [('OPTION = re.compile(r"-{1,2}[A-Za-z0-9][A-Za-z0-9-]*")', 'OPTION = re.compile(r"\\S+")')]),
 ('B29 the option can be the end of another word', [('(?<![\\w-]){re.escape(option)}', '{re.escape(option)}')]),
 ('B30 the lock file holds no process id',
  [('os.write(handle, str(os.getpid()).encode())', 'os.write(handle, b"")')]),
 ('B31 no release of the lock on SIGTERM', [('    signal.signal(signal.SIGTERM, stop_on_term)\n', '')]),
 ('B33 an old lock of a live process is held, not stale', [('        if age > stale:\n', '        if False:\n')]),
 ('B34 process id 0 counts as a live process',
  [('if not text.isdigit() or int(text) <= 0:', 'if not text.isdigit():')]),
 ('B35 render takes no lock',
  [('    need_night(args.dir)\n'
    '    with Lock(args.dir):\n'
    '        entries = read_journal(args.dir) or []\n'
    '        night = fold(entries)\n'
    '        if not night.reports:\n'
    '            raise Refused("REPORT_NONE_YET")\n'
    '        write_file(args.dir, REPORT, render(entries))',
    '    need_night(args.dir)\n'
    '    if True:\n'
    '        entries = read_journal(args.dir) or []\n'
    '        night = fold(entries)\n'
    '        if not night.reports:\n'
    '            raise Refused("REPORT_NONE_YET")\n'
    '        write_file(args.dir, REPORT, render(entries))')]),
 ('B35b status and check take no lock',
  [('    with Lock(folder):\n'
    '        entries = read_journal(folder) or []\n'
    '        now, fake = clock()\n'
    '    night = fold(entries)',
    '    entries = read_journal(folder) or []\n    now, fake = clock()\n    night = fold(entries)')]),
 ('B36 repair cuts one full entry too',
  [('        keep = data.rfind(b"\\n") + 1\n        number',
    '        keep = data.rfind(b"\\n", 0, data.rfind(b"\\n")) + 1\n        number')]),
 ('B37 each repair writes the same side file',
  [('        cut_name = f"journal.cut-{number}.txt"', '        cut_name = "journal.cut-1.txt"')]),
 ('B39 report.md: only the first line is compared',
  [('        if current != render(night.entries):',
    '        if current is None or current.splitlines()[:1] != render(night.entries).splitlines()[:1]:')]),
 ('B40 old temp files stay',
  [('            if old.startswith(f".{name}.") and old.endswith(".tmp"):', '            if False:')]),
 ('B41 the fence of the owner words has 4 backticks each time',
  [('fence = "`" * max(3, longest + 1)', 'fence = "````"')]),
 ('B42 a newline stays in a table cell', [('.replace("\\r", " ").replace("\\n", " ")', '')]),
 ('B46 wait, aware and error need no text',
  [('if kind in ("hold", "wait", "decision", "aware", "error") and not', 'if kind in ("hold", "decision") and not')]),
 ('B48 error and reserve take any item',
  [('ITEM_EVENTS = ("intent", "denied", "hold", "wait", "decision", "aware", "error", "reserve")',
    'ITEM_EVENTS = ("intent", "denied", "hold", "wait", "decision", "aware")')]),
 ('B52 check on a folder with no journal says OK',
  [('def read_for_view(folder):\n    need_night(folder)\n', 'def read_for_view(folder):\n')]),
 ('B53 an empty lock file is stale with no wait',
  [('                if time.monotonic() >= end:\n                    raise self.refusal() from None',
    '                if time.monotonic() >= end or os.path.getsize(self.path) == 0:\n'
    '                    raise self.refusal() from None')]),
 ('B56 ITEM_DENIED has the class fix', [('"ITEM_DENIED": ("final",', '"ITEM_DENIED": ("fix",')]),
 ('B57 the class text is not printed',
  [('    text = f"{prefix} [{code}]{where} ({CLASS_TEXT[kind]}): {message}"',
    '    text = f"{prefix} [{code}]{where}: {message}"')]),
 ('B58 no last net: an unexpected error gives a traceback',
  [('    except Exception as error:  # the last net', '    except ZeroDivisionError as error:  # the last net')]),
 ('B59 a result after the stop time is refused',
  [('    if entry["of"] not in night.intents:\n        return [("RESULT_NOT_INTENT"',
    '    if night.go and entry_time(entry["t"]) >= entry_time(night.go["stop"]):\n'
    '        return [("AFTER_STOP", "")]\n'
    '    if entry["of"] not in night.intents:\n'
    '        return [("RESULT_NOT_INTENT"')]),
 ('B60 a close after the stop time is refused',
  [('    if kind == "close":\n        pending = night.open_intents()',
    '    if kind == "close":\n'
    '        if night.go and entry_time(entry["t"]) >= entry_time(night.go["stop"]):\n'
    '            return [("AFTER_STOP", "")]\n'
    '        pending = night.open_intents()')]),
 ('B61 a gap in the journal stops each intent',
  [('    if night.faults:\n        return [("JOURNAL_FAULTS"',
    '    if night.faults or gaps(night):\n        return [("JOURNAL_FAULTS"')]),
 ('B67 items prints the rows with no checks',
  [('    for row in rows:\n'
    '        for code, detail in row_problems(row, {}):\n'
    '            raise Refused(code, detail)\n'
    '        if name_key(row[0]) in seen:\n'
    '            raise Refused("ITEM_DUPLICATE", f"{row[0]!r} and {seen[name_key(row[0])]!r}")\n'
    '        seen[name_key(row[0])] = row[0]\n'
    '    if not rows:\n'
    '        raise Refused("ITEMS_EMPTY")\n',
    '')]),
 ('C1 the report shows no gaps of an open night',
  [('    stops = [gap_text(night, gap) for gap in gaps(night)]',
    '    stops = [gap_text(night, gap) for gap in gaps(night)] if closed else []')]),
 ('C2 the stop rule is off for check --now only',
  [('    return entry_time(night.last["t"]) >= stop or (now is not None and now >= stop)',
    '    return entry_time(night.last["t"]) >= stop')]),
 ('C3 a reopen opens the denial but not the hold',
  [('            night.denied.pop(entry["reopen"], None)\n            night.held.pop(entry["reopen"], None)',
    '            night.denied.pop(entry["reopen"], None)')]),
 ('C4 a reopen opens the hold but not the denial',
  [('            night.denied.pop(entry["reopen"], None)\n            night.held.pop(entry["reopen"], None)',
    '            night.held.pop(entry["reopen"], None)')]),
 ('C5 the unknown rule looks at each item',
  [('        if last_result["outcome"] == "unknown":',
    '        if any(r["outcome"] == "unknown" for r in night.results.values()):')]),
 ('C6 a no-commit --no-head of spaces passes',
  [('if not entry.get("no_head", "").strip():', 'if "no_head" not in entry:')]),
 ('C9 new overwrites an existing card.md',
  [('        if not os.path.exists(os.path.join(args.dir, CARD)):\n', '        if True:\n')]),
 ('C10 the journal write has no fsync',
  [('            os.write(handle, data)\n            os.fsync(handle)', '            os.write(handle, data)')]),
 ('C11 the close NOTE lists no open rows',
  [('        notes.extend(f"{row[0]}: {row[1]} ({row[4]})" for row in needs_you(night))\n', '')]),
 ('C12 the close NOTE lists no gaps',
  [('        notes.extend(gap_text(night, gap) for gap in gaps(night))', '        pass')]),
 ('C14 TORN_LINE only when the tail is not JSON',
  [('    if data and not data.endswith(b"\\n"):\n        tail = len(data)',
    '    if data and not data.endswith(b"\\n") and not data.rstrip().endswith(b"}"):\n        tail = len(data)')]),
 ('C15 status with a fake clock on a real journal passes',
  [('    if fake and not night.test:\n        raise Refused("FAKE_CLOCK", "a fake clock cannot read a real journal")',
    '    if False:\n        raise Refused("FAKE_CLOCK", "a fake clock cannot read a real journal")')]),
 ('C16 answer needs no words',
  [('    if entry["kind"] not in ("new", "amend", "answer"):', '    if entry["kind"] not in ("new", "amend"):')]),
 ('C18 PAGECHECK: outcome fail counts as pass at the close',
  [('missing = [name for name in PAGE_CHECKS if checks.get(name) != "pass"]',
    'missing = [name for name in PAGE_CHECKS if name not in checks]')]),
 ('C19 a resolved wait still shows as open',
  [('    elif kind == "decision" and "resolves" in entry:\n        night.waits.pop(entry["resolves"], None)',
    '    elif False:\n        pass')]),
 ('D1 an empty words file passes',
  [('    return [("WORDS_EMPTY", "")] if not entry["words"].strip() else []', '    return []')]),
 ('D2 an unknown item kind passes',
  [('    if kind not in ITEM_KINDS:\n        found.append(("ITEM_KIND", f"{name!r} has kind {kind!r}"))\n    elif',
    '    if False:\n        pass\n    elif')]),
 ('D3 an intent needs no command',
  [('    if "command" not in entry:\n        return [("INTENT_FIELDS", "")]\n    command = entry["command"]',
    '    command = entry.get("command", "")')]),
 ('D4 a page check and a close need no report', [('        found.append(("REPORT_NONE_YET", ""))', '        pass')]),
 ('D5 an open intent is no problem in check',
  [('    found += [(e["id"], "INTENT_NO_RESULT", f"{e[\'item\']}: `{e.get(\'command\', \'\')}`") for e in '
    'night.open_intents()]',
    '    found += []')]),
 ('D6 an open fence in the card passes',
  [('    if fence is not None:\n        raise Refused("CARD_OPEN_FENCE"',
    '    if False:\n        raise Refused("CARD_OPEN_FENCE"')]),
 ('D8 enum values are not checked',
  [('    return value in spec if isinstance(spec, tuple) else TYPES[spec](value)',
    '    return True if isinstance(spec, tuple) else TYPES[spec](value)')]),
 ('D10 repair writes an empty side file',
  [('                handle.write(data[keep:])', '                handle.write(b"")')]),
 ('D11 a fake time with no offset passes',
  [('    if value.tzinfo is None:\n        raise Refused("FAKE_CLOCK_FORM", repr(fake))',
    '    if False:\n        raise Refused("FAKE_CLOCK_FORM", repr(fake))')]),
 ('D16 an entry of a fake clock has no fake_clock flag',
  [('        if fake:\n            entry["fake_clock"] = True',
    '        if False:\n            entry["fake_clock"] = True')]),
 ('D17 the card block in the owner words is read (card has a 3-backtick fence)',
  [('                                       f"{fenced(words)}\\n\\nFill',
    '                                       f"```text\\n{words}\\n```\\n\\nFill')]),
 ('D18 no card block is fine (no items)',
  [('    if not blocks:\n        raise Refused("CARD_NO_BLOCK", path)', '    if not blocks:\n        return []')]),
 ('D19 status --report prints the newest report for each id',
  [('        report = next((e for e in night.reports if e["id"] == wanted), None)',
    '        report = night.newest_report()')]),
 ('D20 a missing required field passes',
  [('    return f"missing field {missing[0]!r}" if missing else None', '    return None')]),
 ('D21 the item of an entry is not stripped',
  [('"item": args.item.strip() if args.item is not None else None,', '"item": args.item,')]),
 ('D24 go does not store max_gap_min from the environment',
  [('"max_gap_min": limit,', '"max_gap_min": DEFAULT_MAX_GAP_MIN,')]),
 ('D29 the owner words in the report use a table cell (no fence)',
  [('        "## Owner\'s words (exact)\\n", fenced(night.words or ""), "",',
    '        "## Owner\'s words (exact)\\n", cell(night.words or ""), "",')]),
 ('D30 TEST JOURNAL is not on the first line of the report',
  [("{'closed' if closed else 'open'}{test} -->", "{'closed' if closed else 'open'} -->")]),
 ('E1 a denied result does not block its item (old r4)',
  [('        if entry["outcome"] == "denied":\n            night.denied[night.intents[entry["of"]]["item"]] = entry',
    '        if False:\n            pass')]),
 ('E2 the closed record shows no gaps (old r10)',
  [('    stops = [gap_text(night, gap) for gap in gaps(night)]',
    '    stops = [] if closed else [gap_text(night, gap) for gap in gaps(night)]')]),
 ('E3 the gap to now stops at the stop time (old r1)',
  [('        length = minutes(timeline[-1]["t"], iso(until))',
    '        length = minutes(timeline[-1]["t"], iso(min(until, entry_time(night.go["stop"]))))')]),
 ('the clock is read before the lock',
  [('    with Lock(folder):\n'
    '        extra = prepare() if prepare else {}\n'
    '        entries = read_journal(folder) or []\n'
    '        now, fake = clock()',
    '    now, fake = clock()\n'
    '    with Lock(folder):\n'
    '        extra = prepare() if prepare else {}\n'
    '        entries = read_journal(folder) or []')]),
 ('gaps are counted after the close',
  [('    end = night.close["id"] if night.close else night.last["id"]', '    end = night.last["id"]')]),
 ('the report shows no rule faults',
  [('              for i, code, detail in night.faults]', '              for i, code, detail in []]')]),
 ('a journal of another format passes', [('"format": (FORMAT,)}', '"format": "int"}')]),
 ('the lock times come from the environment outside test mode',
  [('    if not test_mode():\n        return default\n    try:', '    try:')])]
MUTANTS += [(name, edits) for name, edits in ADVISOR]
RACES = {"lock not exclusive", "decide before the lock"}


def first_failure(output):
    match = re.search(r"^(?:FAIL|ERROR): (\S+) \((\S+)\)", output, re.MULTILINE)
    return match.group(2) if match else "(no test name in the output)"


def run_mutant(name, edits, source):
    """`edits` is a list of (old, new) pairs; each old text must be in night.py exactly one time."""
    if not edits:
        return "BAD", "the mutant has no edit"
    changed = source
    for old, new in edits:
        count = changed.count(old)
        if count != 1:
            return "BAD", f"an old text is in night.py {count} times"
        changed = changed.replace(old, new)
    with tempfile.TemporaryDirectory() as tmp:
        copy = os.path.join(tmp, "night.py")
        with open(copy, "w", encoding="utf-8") as handle:
            handle.write(changed)
        env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": copy}
        for _ in range(RACE_ROUNDS if name in RACES else 1):
            done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "test_night.py"), "-f"],
                                  capture_output=True, text=True, env=env, check=False, timeout=1800)
            if done.returncode != 0:
                return "KILLED", first_failure(done.stdout + done.stderr)
    return "SURVIVED", "no test failed"


def main(names):
    with open(os.environ.get("NIGHT_PY", os.path.join(HERE, "night.py")), encoding="utf-8") as handle:
        source = handle.read()
    chosen = [m for m in MUTANTS if not names or m[0] in names]
    bad = 0
    for mutant in chosen:
        name, edits = mutant[0], (mutant[1] if len(mutant) == 2 else [mutant[1:]])
        verdict, detail = run_mutant(name, edits, source)
        bad += verdict != "KILLED"
        print(f"{verdict}: {name}: {detail}", flush=True)
    print(f"{len(chosen) - bad} of {len(chosen)} mutants killed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
