#!/usr/bin/env python3
"""Tools for the overnight journal and the chief-approved GitHub merge."""

import argparse
import json
import os
import re
import signal
import sys
import subprocess
import uuid
from urllib.parse import quote

sys.dont_write_bytecode = True  # no __pycache__ in the skill folder
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops the script folder
try:
    from night_format import (
        CARD, CLOSE_REASONS, DEFAULT_HEARTBEAT_MIN, DEFAULT_REVIEW_CAP, DEFAULT_MERGE_MAIN_BONUS, FULL_SHA, FIELDS, FORMAT, GOALS, LOG_KINDS, OUTCOMES, PAGE_CHECKS,
        PAGE_OUTCOMES, REHEARSALS, REPORT, Refused, event_id, iso, line_for, parse_row, parse_stop, parsed_target, entry_time, canonical_target, input_record)
    from night_rules import counts_with, rows_problems, check_grant, pending_attempt
    from night_review import required_checks, check_statuses, check_main_statuses
    from night_chief import command as chief_command, cmd_typed
    from night_cleanup import command as cleanup_command
    from night_report import audit_pr, search_candidates, fenced, gap_text, gaps, needs_you, render, status_data
    from night_files import (
        Lock, SharedLock, append, clock, cut_files, journal_bytes, max_gap_env, need_night, parse_card, parse_lines,
        read_journal, read_words, state_problems, sync_folder, test_mode, write_file,
        leader_events, leader_append, merge_snapshot, add_entry, checked_night, write_entry, require_merge_snapshot,
        repair, view_locked, bound_night, recorded_report)
except ImportError as error:  # a copy of night.py without its modules
    print(f"REFUSED [INTERNAL] (final: do not retry): night.py cannot import its modules ({error}). Copy the whole scripts folder.", file=sys.stderr)
    sys.exit(3)


def cmd_new(args):
    words = read_words(args.words_file) if args.words_file else None
    if args.root and not (words or "").strip():
        raise Refused("WORDS_EMPTY" if words is not None else "WORDS_MISSING")
    while True:
        run = str(uuid.uuid4())
        folder = os.path.join(args.root, run) if args.root else args.dir
        if not args.root:  # Preserve the explicit-folder entry point for daytime fixtures.
            os.makedirs(folder, exist_ok=True)
            break
        try:
            os.mkdir(folder)
            sync_folder(args.root)
            break
        except FileExistsError:
            continue
    folder = os.path.realpath(folder)
    with Lock(folder):
        night = checked_night(folder)
        now, fake = clock()
        entry = add_entry(folder, night, "new", {"run": run, "chief_path": folder, "words": words, "format": FORMAT,
                                                "test": True if test_mode() else None}, now, fake)
        fd = os.open(os.path.join(folder, SharedLock.name), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        os.close(fd)
        sync_folder(folder)
        if not os.path.exists(os.path.join(folder, CARD)):
            write_file(folder, CARD, f"# Night card {run}\n\nMade: {entry['t']}.\n\n## Owner's words (exact)\n\n"
                                     f"{fenced(words)}\n\nFill one night-items block from the night card reference.\n")
    print(f"E{entry['id']} new {run}" + (" TEST JOURNAL" if test_mode() else ""))
    if args.root:
        print(folder)


def cmd_items(args):
    with Lock(args.dir):
        checked_night(args.dir)
        rows = parse_card(args.dir)
    for code, detail in rows_problems(rows) if rows else [("ITEMS_EMPTY", "")]:
        raise Refused(code, detail)
    for row in rows:
        print(" | ".join(row))


def cmd_go(args):
    limit = max_gap_env()
    gap = args.gap_min if args.gap_min is not None else 2 * args.heartbeat_min

    def fields(night, now):
        rows = parse_card(args.dir)
        return {"stop": iso(parse_stop(args.stop, now)), "heartbeat_min": args.heartbeat_min, "gap_min": gap,
                "max_gap_min": limit, "goal": args.goal, "rehearsal": args.rehearsal, "items": rows, "run": night.run,
                "review_cap": args.review_cap, "merge_main_bonus": args.merge_main_bonus, "consultants": args.consultants,
                "tasks": input_record(read_words(args.tasks)) if args.tasks else {},
                "chief": args.chief, "allow_empty_checks": args.allow_empty_checks,
                "review_policy": input_record(read_words(args.review_policy)) if args.review_policy else None}
    entry = write_entry(args.dir, "go", fields)
    print(f"E{entry['id']} GO stop {entry['stop']} heartbeat {args.heartbeat_min} min gap alarm {gap} min "
          f"goal {args.goal} rehearsal {args.rehearsal}")
    print(f"Items from the card (read them back to the owner). Review cap: {entry['review_cap']}. Merge of main bonus: {entry['merge_main_bonus']}")
    for row in entry["items"]:
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
    fields = {name: getattr(args, name) for name in given if name not in ("words_file",)}
    if args.item is not None:
        fields["item"] = args.item.strip()
    if kind == "result" and (args.of is None or args.outcome not in OUTCOMES):
        raise Refused("RESULT_FIELDS")
    if kind == "pagecheck" and (args.name not in PAGE_CHECKS or args.outcome not in PAGE_OUTCOMES or args.report is None):
        raise Refused("PAGECHECK_FIELDS")
    for name in ("of", "report", "resolves"):
        if name in fields:
            fields[name] = event_id(fields[name])
    if args.words_file is not None:
        fields["words"] = read_words(args.words_file)
    if args.reopen is not None:
        fields["reopen"] = args.reopen.strip()
    if args.add_item is not None:
        fields["add_item"] = parse_row(args.add_item)
    if args.tasks is not None:
        fields["tasks"] = input_record(read_words(args.tasks))
    return fields


def cmd_log(args):
    fields = log_fields(args)
    def check(night, now):
        if args.kind == "pagecheck":
            require_merge_snapshot(args.dir, night)
        return fields
    entry = write_entry(args.dir, args.kind, check)
    print(f"E{entry['id']} {args.kind}" + (f" {entry['item']}" if entry.get("item") else ""))
    if "add_item" in entry:
        print(f"ADDED ITEM: {' | '.join(entry['add_item'])} (E{entry['id']}): read it back to the owner "
              "before you act on it.")


def cmd_report(args):
    with Lock(args.dir):
        night = checked_night(args.dir)
        now, fake = clock()
        merges = merge_snapshot(args.dir, night)
        entry = night.newest_report()
        if night.close or not entry or night.made_old_by or entry.get("merges", []) != merges:
            entry = add_entry(args.dir, night, "report", {"counts": counts_with(night, "report"),
                              "merges": merges}, now, fake)
        recorded_report(args.dir, night, entry)
    print(f"E{entry['id']} report written: {os.path.join(args.dir, REPORT)}")


def cmd_render(args):
    with Lock(args.dir):
        night = checked_night(args.dir)
        if not night.reports:
            raise Refused("REPORT_NONE_YET")
        write_file(args.dir, REPORT, render(night.entries))
    print(f"report.md written again from the journal (report E{night.newest_report()['id']})")


def cmd_close(args):
    with Lock(args.dir):
        night = checked_night(args.dir)
        require_merge_snapshot(args.dir, night)
        now, fake = clock()
        entry = add_entry(args.dir, night, "close", {"reason": args.reason, "without_page": args.without_page}, now, fake)
        recorded_report(args.dir, night, entry)
    for row in needs_you(night):
        print(f"NOTE: {row[0]}: {row[1]} ({row[4]}) (it is on the report)")
    for gap in gaps(night):
        print(f"NOTE: {gap_text(night, gap)} (it is on the report)")
    print(f"E{entry['id']} NIGHT CLOSED {night.run} reason {args.reason}" + (" TEST JOURNAL" if night.test else ""))


def cmd_repair(args):
    entry = repair(args.dir)
    print(f"E{entry['id']} repair: {entry['bytes']} bytes in {entry['cut_file']}")


def cmd_check(args):
    with Lock(args.dir):
        night, now = view_locked(args.dir)
        found = list(night.faults) + state_problems(night, args.dir, now, args.now)
        merges = merge_snapshot(args.dir, night)
        if night.reports and not night.close and night.newest_report().get("merges", []) != merges:
            found.append((night.newest_report()["id"], "REPORT_FILE", "leader journal changed"))
    for entry_id, code, detail in found:
        print(line_for(code, detail, prefix="PROBLEM", event_id=entry_id))
    if not found:
        print("check: OK")
    return 1 if found else 0


def cmd_status(args):
    with Lock(args.dir):
        night, now = view_locked(args.dir)
        merges = merge_snapshot(args.dir, night)
    if args.report is not None:
        wanted = event_id(args.report)
        report = next((e for e in night.reports if e["id"] == wanted), None)
        if report is None:
            raise Refused("ID_NOT_REPORT", f"E{wanted}")
        data = {"report": f"E{wanted}", "counts": report["counts"], "test": night.test}
    else:
        data = status_data(night, now)
        data["merges"] = merges
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return 0
    if night.test:
        print("TEST JOURNAL")
    for key, value in data.items():
        print(f"{key}: {value}")
    return 0


def cmd_cleanup(args):
    return cleanup_command(args, github, page_rows)


def cmd_chief(args):
    return chief_command(args, github, page_rows, check_policy)


GH_TIMEOUT_S = 20


def github(host, endpoint, code, payload=None, pages=False):
    argv = ["gh", "api", "--hostname", host]
    if payload is not None:
        argv += ["--method", "PUT", endpoint, "--input", "-", "--include"]
    else:
        argv += ["--method", "GET", endpoint]
        if pages:
            argv += ["--paginate", "--slurp"]
    try:
        done = subprocess.run(argv, input=json.dumps(payload) if payload is not None else None, capture_output=True,
                              check=False, text=True, timeout=GH_TIMEOUT_S, shell=False)
        raw = done.stdout.strip()
        if payload is not None:
            header, sep, body = raw.partition("\n\n")
            status = re.match(r"HTTP/\S+ (\d{3})\b", header)
            if not sep or not status:
                raise ValueError("missing HTTP status")
            return int(status[1]), json.loads(body)
        if done.returncode:
            raise ValueError("gh failed")
        return json.loads(raw)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        raise Refused(code, endpoint) from None


def page_rows(host, endpoint, code, key=None):
    pages = github(host, endpoint, code, pages=True)
    if not isinstance(pages, list) or not pages:
        raise Refused(code, endpoint)
    result = []
    for page in pages:
        rows = page.get(key) if key and isinstance(page, dict) else page
        if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
            raise Refused(code, endpoint)
        result.extend(rows)
    return result


def check_policy(host, repo, base, head, empty, check_main=False):
    unknown = "MERGE_CI_UNKNOWN"
    branch = f"repos/{repo}/branches/{quote(base, safe='')}"
    info = github(host, branch, unknown)
    if not isinstance(info, dict) or info.get("name") != base or type(info.get("protected")) is not bool:
        raise Refused(unknown, branch)
    rules = page_rows(host, f"repos/{repo}/rules/branches/{quote(base, safe='')}?per_page=100", unknown)
    classic = github(host, f"{branch}/protection", unknown) if info["protected"] else None
    required = required_checks(rules, classic, info["protected"])
    if not required and not empty:
        raise Refused(unknown, "empty required set needs card permission")
    if not required and not check_main:
        return
    scope = "latest" if check_main and not required else "all"
    checks = page_rows(host, f"repos/{repo}/commits/{head}/check-runs?per_page=100&filter={scope}", unknown, "check_runs")
    statuses = page_rows(host, f"repos/{repo}/commits/{head}/statuses?per_page=100", unknown)
    check_statuses(required, checks, statuses, head)
    if check_main:
        check_main_statuses(checks, statuses, head)


def before_merge(night, grant):
    host, repo, number = parsed_target(grant["target"])
    endpoint = f"repos/{repo}/pulls/{number}"
    pr = github(host, endpoint, "MERGE_READ_FAILED")
    if not isinstance(pr, dict) or not isinstance(pr.get("head"), dict) or not isinstance(pr.get("base"), dict):
        raise Refused("MERGE_READ_FAILED", endpoint)
    observed = pr["head"].get("sha")
    if not isinstance(observed, str) or not FULL_SHA.fullmatch(observed):
        raise Refused("MERGE_READ_FAILED", "PR head")
    if observed != grant["head"] or ("review_base" in grant and pr["base"].get("sha") != grant["review_base"]):
        raise Refused("MERGE_HEAD_CHANGED")
    if (pr["base"].get("ref") != grant["base"] or pr.get("number") != number or pr.get("state") != "open"
            or pr.get("draft") is not False or pr.get("merged") is not False or pr.get("mergeable") is not True
            or pr.get("mergeable_state") != "clean" or pr.get("auto_merge") is not None
            or (pr["base"].get("repo") or {}).get("full_name", "").lower() != repo):
        raise Refused("MERGE_PR_INELIGIBLE")
    settings = github(host, f"repos/{repo}", "MERGE_READ_FAILED")
    if not isinstance(settings, dict) or settings.get("delete_branch_on_merge") is not False:
        raise Refused("MERGE_EFFECT_UNCLEAR", "branch deletion")
    method = {"squash": "allow_squash_merge", "merge": "allow_merge_commit", "rebase": "allow_rebase_merge"}[grant["method"]]
    if settings.get(method) is not True:
        raise Refused("MERGE_PR_INELIGIBLE", "merge method")
    workflows = page_rows(host, f"repos/{repo}/actions/workflows?per_page=100", "MERGE_EFFECT_UNCLEAR", "workflows")
    hooks = page_rows(host, f"repos/{repo}/hooks?per_page=100", "MERGE_EFFECT_UNCLEAR")
    inactive = ("disabled_manually", "disabled_inactivity", "disabled_fork")
    if any(w.get("state") not in inactive for w in workflows) or any(h.get("active") is not False for h in hooks):
        raise Refused("MERGE_EFFECT_UNCLEAR", "active workflow or webhook")
    check_policy(host, repo, grant["base"], grant["head"], night.go["allow_empty_checks"])
    return host, endpoint + "/merge"


def get_grant(folder, args, target, entry_id):
    night = bound_night(folder)
    now, fake = clock()
    records = leader_events(folder, night, target) if target in night.assignments else []
    grant = check_grant(night, args, target, entry_id, now, fake)
    if any(e["kind"] == "merge-attempt" and e["grant"] == entry_id for e in records):
        raise Refused("MERGE_PERMISSION_USED")
    if night.active_grants.get(target) != entry_id or any(
            e["kind"] == "merge-invalidate" and e["grant"] == entry_id for e in records):
        raise Refused("MERGE_PERMISSION_INACTIVE")
    if pending_attempt(records):
        raise Refused("MERGE_PENDING")
    return night, grant, records


def send_merge(host, endpoint, grant):
    try:
        status, data = github(host, endpoint, "MERGE_OUTCOME_UNKNOWN",
                              payload={"sha": grant["head"], "merge_method": grant["method"]})
    except Refused:
        return "unknown", None, "MERGE_OUTCOME_UNKNOWN"
    if isinstance(data, dict) and status == 200 and data.get("merged") is True:
        sha = data.get("sha")
        if isinstance(sha, str) and FULL_SHA.fullmatch(sha):
            return "merged", sha, None
    if status == 409:
        return "failed", None, "MERGE_HEAD_CHANGED"
    if status in (401, 403, 404, 405, 422) or status == 200 and isinstance(data, dict) and data.get("merged") is False:
        return "failed", None, "MERGE_REJECTED"
    return "unknown", None, "MERGE_OUTCOME_UNKNOWN"


def cmd_merge(args):
    target = canonical_target(args.target)
    if not FULL_SHA.fullmatch(args.head):
        raise Refused("HEAD_FORM")
    grant_id = event_id(args.grant)
    with SharedLock(args.dir):
        night, grant, _ = get_grant(args.dir, args, target, grant_id)
    try:
        host, endpoint = before_merge(night, grant)
    except Refused as refusal:
        if refusal.code == "MERGE_HEAD_CHANGED":
            with SharedLock(args.dir):
                current, _, records = get_grant(args.dir, args, target, grant_id)
                now, _ = clock()
                leader_append(args.dir, current, target, records, "merge-invalidate", now, {"grant": grant_id})
        raise
    with SharedLock(args.dir):
        night, grant, records = get_grant(args.dir, args, target, grant_id)
        now, _ = clock()
        if now >= entry_time(night.go["stop"]):
            raise Refused("AFTER_STOP")
        attempt = leader_append(args.dir, night, target, records, "merge-attempt", now,
                                {**{key: grant[key] for key in ("head", "leader", "base", "method")}, "grant": grant_id})
        send_time, _ = clock()
        if send_time >= entry_time(night.go["stop"]):
            outcome, sha, code = "unsent", None, "AFTER_STOP"
        else:
            outcome, sha, code = send_merge(host, endpoint, grant)
        done, _ = clock()
        leader_append(args.dir, night, target, records, "merge-result", done,
                      {"of": attempt["id"], "outcome": outcome, "sha": sha, "code": code,
                       "sent_at": iso(send_time) if outcome != "unsent" else None})
    if code:
        raise Refused(code)
    print(f"Merged {target} at {sha} (attempt {attempt['id']})")


SEARCH_LIMIT = 1000
INDEX_LAG_S = 60


def search_merges(host, repo, start, end):
    """Bounds are checked again on exact PR reads. Search's inclusive range may include the cutoff."""
    from datetime import timedelta

    found, gaps = set(), []

    def search(left, right):
        term = f"repo:{repo} is:pr is:merged merged:{iso(left)}..{iso(right)}"
        query = f"search/issues?per_page=100&q={quote(term, safe='')}"
        try:
            pages = github(host, query, "MERGE_READ_FAILED", pages=True)
            count, numbers, returned = search_candidates(pages, repo)
            if count >= SEARCH_LIMIT and (right - left).total_seconds() > 1:
                middle = left + timedelta(seconds=int((right - left).total_seconds()) // 2)
                search(left, middle)
                search(middle, right)
                return
            found.update(numbers)
            if count >= SEARCH_LIMIT or len(numbers) != count or returned != count:
                raise ValueError("result cap or incomplete pages")
        except (Refused, ValueError, TypeError, KeyError, AttributeError) as error:
            gaps.append([f"{host}/{repo}", "coverage gap", f"{iso(left)} to {iso(right)}", str(error)])

    search(start, end)
    return found, gaps


def audit_facts(night, records, end, now):
    start = entry_time(night.go["t"])
    repos = {parsed_target(target)[:2] for target in night.merge_rows}
    matches = {}
    for result in records:
        if result.get("kind") == "merge-result" and result.get("outcome") == "merged":
            matches[(result["target"], result["sha"])] = result
    attempts = {e["target"] for e in records if e["kind"] == "merge-attempt" and entry_time(e["t"]) < end}
    rows = []
    for host, repo in sorted(repos):
        numbers, gaps = search_merges(host, repo, start, end)
        rows.extend(gaps)
        if (now - end).total_seconds() < INDEX_LAG_S:
            rows.append([f"{host}/{repo}", "coverage gap", f"{iso(start)} to {iso(end)}",
                         "search data can arrive late; repeat the read in the morning"])
        numbers |= {parsed_target(target)[2] for target in attempts if parsed_target(target)[:2] == (host, repo)}
        for number in sorted(numbers):
            target = f"{host}/{repo}#{number}"
            endpoint = f"repos/{repo}/pulls/{number}"
            try:
                pr = github(host, endpoint, "MERGE_READ_FAILED")
                if row := audit_pr(pr, target, number, endpoint, matches, attempts, start, end):
                    rows.append(row)
            except (Refused, TypeError, AttributeError):
                rows.append([target, "coverage gap", f"{iso(start)} to {iso(end)}", endpoint])
    return rows


def cmd_audit(args):
    with Lock(args.dir):
        night = checked_night(args.dir)
        if not night.go:
            raise Refused("NOT_STARTED")
        if night.faults:
            raise Refused("JOURNAL_FAULTS")
        records = merge_snapshot(args.dir, night)
        now, _ = clock()
        cutoff = min(entry_time(night.go["stop"]), entry_time(night.close["t"]) if night.close else now)
    rows = audit_facts(night, records, cutoff, now)
    if night.close:
        print(json.dumps(rows))
        return
    with Lock(args.dir):
        current = checked_night(args.dir)
        now, fake = clock()
        if current.close or current.last != night.last or merge_snapshot(args.dir, current) != records:
            raise Refused("REPORT_OLD", "the journal changed during audit; read again")
        add_entry(args.dir, current, "audit", {"rows": rows}, now, fake)
    print(json.dumps(rows))


def parser():
    top = argparse.ArgumentParser(prog="night.py", description=__doc__.splitlines()[0], allow_abbrev=False)
    sub = top.add_subparsers(dest="command_name", required=True)

    def add(name, helptext):
        cmd = sub.add_parser(name, help=helptext, allow_abbrev=False)
        if name != "new":
            cmd.add_argument("--dir", required=True, help="the night folder")
        return cmd

    new = add("new", "start the journal and the card with the owner's exact words")
    location = new.add_mutually_exclusive_group(required=True)
    location.add_argument("--root", help="parent of the exclusively created UUID run folder")
    location.add_argument("--dir", help="explicit night folder for a daytime fixture")
    new.add_argument("--words-file", help="a file with the owner's exact /overnight arguments")
    add("items", "print the rows of the night-items block of card.md (for the read-back)")
    go = add("go", "record the owner's go; the items come from the night-items block of card.md")
    go.add_argument("--stop", required=True, help="HH:MM (the next such local time), a local date and time, or ISO with a zone")
    go.add_argument("--goal", required=True, choices=GOALS)
    go.add_argument("--rehearsal", required=True, choices=REHEARSALS)
    go.add_argument("--heartbeat-min", type=int, default=DEFAULT_HEARTBEAT_MIN)
    go.add_argument("--gap-min", type=int, help="the gap alarm (default 2 times the heartbeat)")
    go.add_argument("--review-cap", type=int, default=DEFAULT_REVIEW_CAP)
    go.add_argument("--merge-main-bonus", type=int, default=DEFAULT_MERGE_MAIN_BONUS)
    go.add_argument("--tasks", help="JSON task classes, acceptance criteria and owned files")
    go.add_argument("--consultants", action="store_true", help="the overnight prompt allows consultants")
    go.add_argument("--chief", default="")
    go.add_argument("--review-policy", help="JSON file with the approved reviewer pair and resolved roles")
    go.add_argument("--allow-empty-checks", action="store_true")
    for name in ("assign", "plan", "review-start", "review", "ruling", "advice", "grant", "confirm", "withdraw", "timer"):
        add(name, f"record a {name} entry").add_argument("--data", required=True, help="UTF-8 JSON fields")
    merge = add("merge", "use one chief permission for a direct pinned merge")
    for name in ("run", "target", "head", "leader", "grant"):
        merge.add_argument(f"--{name}", required=True)
    for name, helptext in (("record-temp", "record one exact temporary file for this leader"),
                           ("clean", "remove only the recorded leftovers of a merged PR")):
        cleanup = add(name, helptext)
        for field in ("run", "target", "leader"):
            cleanup.add_argument(f"--{field}", required=True)
        if name == "record-temp":
            cleanup.add_argument("--actor", required=True)
            cleanup.add_argument("--path", required=True)
    add("audit", "read GitHub merges for the recorded night window")
    log = add("log", "add one entry")
    log.add_argument("kind", choices=LOG_KINDS)
    log.add_argument("text", nargs="?", default=None)
    log.add_argument("--words-file", help="amend, answer: a file with the owner's exact words")
    log.add_argument("--item", help="an exact name from the card")
    log.add_argument("--command", help="record ordinary tool text as evidence")
    log.add_argument("--of", help="result: the intent id (12 or E12)")
    log.add_argument("--outcome", help="result: done, failed, unknown or denied; pagecheck: pass or fail")
    log.add_argument("--blocks")
    log.add_argument("--source")
    log.add_argument("--check", action="store_true", help="decision: the owner should check it")
    log.add_argument("--resolves", help="decision: the id of the wait row that it ends")
    log.add_argument("--reopen", help="amend: the denied or held item that the owner opens again")
    log.add_argument("--tasks", help="amend: JSON spec for a new merge target")
    log.add_argument("--add-item", help='amend: "<name> | owner" or "<name> | night"')
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
            "check": cmd_check, "report": cmd_report, "render": cmd_render, "close": cmd_close, "repair": cmd_repair, "assign": cmd_typed,
            "timer": cmd_typed, "merge": cmd_merge, "audit": cmd_audit, "clean": cmd_cleanup, "record-temp": cmd_cleanup,
            **dict.fromkeys(("plan", "review-start", "review", "ruling", "advice", "grant", "confirm", "withdraw"), cmd_chief)}


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(errors="backslashreplace")
    signal.signal(signal.SIGTERM, lambda signal_id, _: sys.exit(128 + signal_id))
    raw = sys.argv[1:] if argv is None else argv
    args = parser().parse_args(argv)
    if args.dir:
        args.dir = os.path.abspath(args.dir)
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
