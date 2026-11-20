#!/usr/bin/env python3
"""Apply one source edit in an isolated source copy and check its named assertion."""
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from mutant_verdict import green, run_suite, verdict
from option_b_breaks import BREAKS

SKILL_TESTS = HERE.parent.parent / ".agents" / "skills" / "overnight" / "scripts"
MODULES = ("night.py", "night_files.py", "night_format.py", "night_report.py", "night_rules.py")


def prove(case):
    name, filename, old, new, test_name, assertion = case
    repo_source = Path(os.environ.get("NIGHT_PY", SKILL_TESTS / "night.py")).parent
    source = (repo_source / filename).read_text()
    if source.count(old) != 1:
        return name, "BAD", f"source edit matched {source.count(old)} times"
    empty_env = {"PATH": os.environ["PATH"]}
    baseline = run_suite(SKILL_TESTS, {**empty_env, "NIGHT_PY": str(repo_source / "night.py")}, test_name)
    if not green(baseline):
        return name, "BAD", f"baseline failed: {baseline}"
    with tempfile.TemporaryDirectory() as folder:
        folder = Path(folder)
        for module in MODULES:
            text = source.replace(old, new, 1) if module == filename else (repo_source / module).read_text()
            (folder / module).write_text(text)
        result = run_suite(SKILL_TESTS, {**empty_env, "NIGHT_PY": str(folder / "night.py")}, test_name)
    state, evidence = verdict(baseline, result, test_name, assertion)
    return name, state, f"{evidence} | observed: {result.get('failures', [])}"


def main(names):
    known = {case[0] for case in BREAKS}
    if set(names) - known:
        print(f"Unknown breaks: {', '.join(sorted(set(names) - known))}", file=sys.stderr)
        return 2
    chosen = [case for case in BREAKS if not names or case[0] in names]
    count = 0
    with ThreadPoolExecutor(max_workers=2) as workers:
        for name, state, evidence in workers.map(prove, chosen):
            count += state == "KILLED"
            print(f"{state}: {name}: {evidence}", flush=True)
    print(f"{count} of {len(chosen)} breaks caught")
    return 0 if count == len(chosen) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
