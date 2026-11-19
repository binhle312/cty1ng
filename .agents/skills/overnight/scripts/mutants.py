#!/usr/bin/env python3
"""Mutant runner for night.py. Run: `python3 -I mutants.py [name ...]` in this folder.

Each mutant changes one rule of night.py or its modules (one text replace). The runner writes the
changed copy of all modules to a temp folder, runs the tests on it (run_tests.py with NIGHT_PY, stop
at the first failure), and prints the first test that fails. A mutant that no test kills SURVIVED. A run that fails with no failing test
is BAD, not a kill. The suite must pass on night.py first (the baseline), or no mutant runs (exit 2).
Exit 1 if a mutant is not killed, or if its old text is not in the modules exactly one time (then
the list needs an update after a code change).
NIGHT_PY names another night.py to mutate (its modules come from the same folder).
A race mutant runs RACE_ROUNDS times. The test hook slows each journal append, so one round is enough.
An entry can be a list of (old, new) pairs: several edits make one mutant.
"""

import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MODULES = ("night.py", "night_format.py", "night_rules.py", "night_report.py", "night_files.py")
RACE_ROUNDS = 1  # the hook slows each append, so one round shows a race (advisor point 2)

sys.dont_write_bytecode = True  # no __pycache__ in the skill folder
sys.path.insert(0, HERE)  # `-I` drops this folder
from mutant_list import MUTANTS  # noqa: E402

RACES = {"lock not exclusive", "decide before the lock"}


def first_failure(output):
    """The first failing test, or None when the run failed before a test failed (a crash of the runner)."""
    match = re.search(r"^(?:FAIL|ERROR): (test_\S+) \((\S+)\)", output, re.MULTILINE)
    return match.group(2) if match else None


def run_suite(sources):
    """Run the tests on a copy of the modules (`sources`: file name to text); stop at the first failure."""
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in sources.items():
            with open(os.path.join(tmp, name), "w", encoding="utf-8") as handle:
                handle.write(text)
        env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": os.path.join(tmp, "night.py")}
        done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "run_tests.py"), "-f"],
                              capture_output=True, text=True, env=env, check=False, timeout=1800)
    return done.returncode, done.stdout + done.stderr


def run_mutant(name, edits, sources):
    """`edits` is a list of (old, new) pairs; each old text must be in the modules exactly one time.
    A kill is a named test that fails; a run that fails with no failing test is BAD, not a kill."""
    if not edits:
        return "BAD", "the mutant has no edit"
    changed = dict(sources)
    for old, new in edits:
        homes = [name for name, text in changed.items() for _ in range(text.count(old))]
        if len(homes) != 1:
            return "BAD", f"an old text is in the modules {len(homes)} times"
        changed[homes[0]] = changed[homes[0]].replace(old, new)
    for _ in range(RACE_ROUNDS if name in RACES else 1):
        code, output = run_suite(changed)
        if code != 0:
            test = first_failure(output)
            return ("KILLED", test) if test else ("BAD", "the run failed, but no test failed")
    return "SURVIVED", "no test failed"


def main(names):
    folder = os.path.dirname(os.environ.get("NIGHT_PY", os.path.join(HERE, "night.py")))
    sources = {}
    for name in MODULES:
        with open(os.path.join(folder, name), encoding="utf-8") as handle:
            sources[name] = handle.read()
    code, output = run_suite(sources)  # a kill means something only if the suite passes on night.py itself
    if code != 0:
        print(f"BASELINE FAILED: the suite fails on night.py with no mutant ({first_failure(output) or 'no test name'}); "
              "no mutant ran", flush=True)
        return 2
    print("BASELINE OK: the suite passes on night.py", flush=True)
    chosen = [m for m in MUTANTS if not names or m[0] in names]
    bad = 0
    for mutant in chosen:
        name, edits = mutant[0], (mutant[1] if len(mutant) == 2 else [mutant[1:]])
        verdict, detail = run_mutant(name, edits, sources)
        bad += verdict != "KILLED"
        print(f"{verdict}: {name}: {detail}", flush=True)
    print(f"{len(chosen) - bad} of {len(chosen)} mutants killed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
