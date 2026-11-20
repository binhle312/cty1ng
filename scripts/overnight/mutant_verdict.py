"""Run a discovered test and retain its exact assertion for evidence."""
import json
from pathlib import Path
import subprocess
import sys
import unittest


def flatten(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from flatten(item)
        else:
            yield item


def worker(test_dir, requested):
    sys.path.insert(0, test_dir)
    loader = unittest.TestLoader()
    suite = loader.discover(test_dir, pattern="test_*.py")
    discovered = {test.id(): test for test in flatten(suite)}
    if loader.errors or not discovered or any(name.startswith("unittest.loader._FailedTest.") for name in discovered):
        return {"invalid": "test discovery"}
    if requested and requested not in discovered:
        return {"invalid": "missing test"}
    selected = unittest.TestSuite([discovered[requested]]) if requested else suite
    outcome = unittest.TextTestRunner(stream=sys.stderr, failfast=True).run(selected)
    return {
        "ran": outcome.testsRun,
        "errors": [test.id() for test, _ in outcome.errors],
        "failures": [[test.test_case.id() if hasattr(test, "test_case") else test.id(),
                      next((line for line in reversed(error.splitlines()) if line.startswith("AssertionError")),
                           "")]
                     for test, error in outcome.failures],
        "skipped": [test.id() for test, _ in outcome.skipped],
    }


def run_suite(test_dir, env, expected=""):
    try:
        result = subprocess.run([sys.executable, "-I", __file__, str(test_dir), expected],
                                env=env, capture_output=True, text=True, timeout=1800, check=False)
        if result.returncode:
            return {"invalid": "runner exit", "detail": result.stderr}
        return json.loads(result.stdout)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {"invalid": "runner error"}


def green(result):
    return (isinstance(result, dict) and not result.get("invalid") and result.get("ran", 0) > 0
            and result.get("failures") == [] and result.get("errors") == [] and result.get("skipped") == [])


def verdict(baseline, broken, test_name, assertion):
    if not test_name or not assertion or not green(baseline):
        return "BAD", "missing expected evidence or invalid baseline"
    if (not isinstance(broken, dict) or broken.get("invalid") or broken.get("ran") != 1
            or broken.get("errors") != [] or broken.get("skipped") != []):
        return "BAD", "invalid mutant run"
    if broken.get("failures") == []:
        return "SURVIVED", "test passed"
    failures = broken.get("failures")
    if (isinstance(failures, list) and len(failures) == 1 and failures[0][0] == test_name
            and assertion in failures[0][1]):
        return "KILLED", test_name
    return "BAD", "the expected assertion did not fail"


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    print(json.dumps(worker(str(Path(sys.argv[1]).resolve()), sys.argv[2])))
