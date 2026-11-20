"""The runner must distinguish a named assertion from a loader or runner failure."""
import os
from pathlib import Path
import tempfile
import unittest

from mutant_verdict import run_suite, verdict


TEST = "test_control.Control.test_check"
EXPECTED = {"subtest": "", "site": ["test_control.py", 4]}
CONTROL = """import unittest
class Control(unittest.TestCase):
    def test_check(self):
        self.assertTrue(True, "expected failure")
"""


class VerdictTests(unittest.TestCase):
    def test_equal_failure_text_at_wrong_site_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, "test_control.py")
            env = {"PATH": os.environ["PATH"]}
            source = CONTROL + '        self.assertTrue(True, "expected failure")\n'
            path.write_text(source)
            baseline = run_suite(tmp, env, TEST)
            last_true = source.rindex("True")
            path.write_text(source[:last_true] + source[last_true:].replace("True", "False", 1))
            wrong_site = run_suite(tmp, env, TEST)
            self.assertEqual(verdict(baseline, wrong_site, TEST, EXPECTED)[0], "BAD")

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
                "wrong_assertion": CONTROL.replace("        self.assertTrue", "        pass\n        self.assertTrue")
                .replace("True,", "False,"),
                "wrong_subtest": CONTROL.replace("        self.assertTrue(True", "        with self.subTest(branch=1): self.assertTrue(False"),
                "skip": CONTROL.replace('self.assertTrue(True, "expected failure")', 'self.skipTest("fixture")'),
                "multiple": CONTROL.replace('        self.assertTrue(True, "expected failure")',
                    '        for index in range(2):\n            with self.subTest(index=index): self.fail("fixture")'),
                "runner_error": "import os\nos._exit(1)\n",
                "no_tests": "",
            }
            for name, source in faults.items():
                with self.subTest(name=name):
                    path.write_text(source)
                    self.assertEqual(verdict(baseline, run_suite(tmp, env, TEST), TEST, EXPECTED)[0], "BAD")
            path.write_text(CONTROL.replace("True,", "False,"))
            broken = run_suite(tmp, env, TEST)
            self.assertEqual(verdict(baseline, broken, TEST, EXPECTED), ("KILLED", TEST))
            path.write_text(CONTROL)
            self.assertEqual(verdict(baseline, run_suite(tmp, env, TEST), TEST, EXPECTED)[0], "SURVIVED")
            self.assertEqual(verdict({"ran": 0}, broken, TEST, EXPECTED)[0], "BAD")
