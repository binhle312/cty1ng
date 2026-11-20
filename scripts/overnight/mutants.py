#!/usr/bin/env python3
"""Apply one source edit in an isolated source copy and check its named assertion."""
from concurrent.futures import ThreadPoolExecutor
import ast
import os
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from mutant_verdict import green, run_suite, verdict
from cases import BREAKS, MISSING, inventory_problems

REPO = HERE.parent.parent
SKILL_TESTS = Path(os.environ.get("NIGHT_TEST_DIR", REPO / ".agents" / "skills" / "overnight" / "scripts"))
MODULES = ("night.py", "night_files.py", "night_format.py", "night_report.py", "night_rules.py",
           "night_chief.py", "night_review.py", "night_review_io.py", "night_cleanup.py",
           "night_leader.py", "night_merge.py", "night_merge_policy.py")


def assertion_site(test_dir, test_name, selector):
    module, cls, method = test_name.split(".")
    file = test_dir / f"{module}.py"
    source = file.read_text()
    body = next(node for node in ast.parse(source).body if isinstance(node, ast.ClassDef) and node.name == cls)
    test = next(node for node in body.body if isinstance(node, ast.FunctionDef) and node.name == method)
    lines = source.splitlines()
    matches = [line for line in range(test.lineno, test.end_lineno + 1) if selector["anchor"] in lines[line - 1]]
    if len(matches) != 1:
        raise ValueError(f"assertion anchor matched {len(matches)} lines")
    return {"subtest": selector["subtest"], "site": [file.name, matches[0]]}


def prove(case):
    name, filename, old, new, test_name, assertion = case
    repo_source = Path(os.environ.get("NIGHT_PY", SKILL_TESTS / "night.py")).parent
    doc = filename.startswith("docs/")
    test_dir = HERE if doc else SKILL_TESTS
    if not isinstance(assertion, dict):
        return name, "BAD", "legacy assertion needs an exact site and subtest"
    try:
        expected = assertion_site(test_dir, test_name, assertion)
    except (OSError, ValueError, StopIteration) as error:
        return name, "BAD", str(error)
    source = ((REPO if doc else repo_source) / filename).read_text()
    if source.count(old) != 1:
        return name, "BAD", f"source edit matched {source.count(old)} times"
    empty_env = {"PATH": os.environ["PATH"]}
    baseline = run_suite(test_dir, {**empty_env, "NIGHT_PY": str(repo_source / "night.py")}, test_name)
    if not green(baseline):
        return name, "BAD", f"baseline failed: {baseline}"
    with tempfile.TemporaryDirectory() as folder:
        folder = Path(folder)
        for module in MODULES:
            text = source.replace(old, new, 1) if module == filename else (repo_source / module).read_text()
            try:
                compile(text, module, "exec")
            except SyntaxError as error:
                return name, "BAD", f"edit does not compile: {error}"
            (folder / module).write_text(text)
        broken_env = {**empty_env, "NIGHT_PY": str(folder / "night.py")}
        if doc:
            path = folder / "merge-bar.md"
            path.write_text(source.replace(old, new, 1))
            broken_env["OVERNIGHT_MERGE_BAR"] = str(path)
        result = run_suite(test_dir, broken_env, test_name)
    state, evidence = verdict(baseline, result, test_name, expected)
    return name, state, f"{evidence} | observed: {result.get('failures', [])}"


def main(names):
    known = {case[0] for case in BREAKS}
    if problems := inventory_problems():
        print("\n".join(problems), file=sys.stderr)
        return 2
    unknown = set(names) - known - MISSING.keys()
    if unknown:
        print(f"Unknown breaks: {', '.join(sorted(unknown))}", file=sys.stderr)
        return 2
    chosen = [case for case in BREAKS if not names or case[0] in names]
    missing = {name: reason for name, reason in MISSING.items() if not names or name in names}
    count, invalid = 0, len(missing)
    for name, reason in missing.items():
        print(f"BAD: {name}: {reason}")
    with ThreadPoolExecutor(max_workers=2) as workers:
        for name, state, evidence in workers.map(prove, chosen):
            count += state == "KILLED"
            invalid += state == "BAD"
            print(f"{state}: {name}: {evidence}", flush=True)
    total = len(chosen) + len(missing)
    print(f"{count} of {total} breaks caught, {invalid} invalid")
    return 0 if count == total else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
