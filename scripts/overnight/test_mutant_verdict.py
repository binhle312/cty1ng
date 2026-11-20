"""The runner must distinguish a named assertion from a loader or runner failure."""
import os
from pathlib import Path
import tempfile
import unittest

from mutant_verdict import run_suite, verdict


TEST = "test_control.Control.test_check"
CONTROL = """import unittest
class Control(unittest.TestCase):
    def test_check(self):
        self.assertTrue(True, "expected failure")
"""


class VerdictTests(unittest.TestCase):
    def test_mutation_verdict(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "test_control.py")
            env = {"PATH": os.environ["PATH"]}
            path.write_text(CONTROL)
            baseline = run_suite(tmp, env, TEST)
            path.write_text('print("fixture progress")\n' + CONTROL)
            self.assertEqual(run_suite(tmp, env, TEST), baseline)
            faults = {
                "bad_import": "import no_such_fixture\n" + CONTROL,
                "missing": CONTROL.replace("test_check", "test_other"),
                "wrong_assertion": CONTROL.replace("True,", "False,").replace("expected failure", "wrong failure"),
                "runner_error": "import os\nos._exit(1)\n",
                "no_tests": "",
            }
            for name, source in faults.items():
                with self.subTest(name=name):
                    path.write_text(source)
                    self.assertEqual(verdict(baseline, run_suite(tmp, env, TEST), TEST, "expected failure")[0], "BAD")
            path.write_text(CONTROL.replace("True,", "False,"))
            broken = run_suite(tmp, env, TEST)
            self.assertEqual(verdict(baseline, broken, TEST, "expected failure"), ("KILLED", TEST))
            self.assertEqual(verdict({"ran": 0}, broken, TEST, "expected failure")[0], "BAD")
