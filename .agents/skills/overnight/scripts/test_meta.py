"""Tests of the tests: each code has a test, the mutant runner, show-red, and the rules of the files.

Run all test files with `python3 -I run_tests.py`.
"""

import ast
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import NIGHT_MODULES, FINAL_CODES, HERE, NIGHT, PRE_EVENT_CODES, STATE_CODES, STUB, night_module  # noqa: E402

MAX_LINES = 600  # one read of a file (owner, 2026-11-19, designs-139-140 Q5 A)
PURE_MODULES = ("night_format", "night_rules", "night_report")
PURE_IMPORTS = {"re", "datetime"}
PURE_NO_CALLS = {"open", "print", "input", "exec", "eval", "__import__", "globals"}


class MetaTests(unittest.TestCase):
    def test_each_journal_read_is_under_the_lock(self):
        """A read outside the lock can act on a journal that another process changes (DQ-917, advisor point 3 F13)."""
        with open(NIGHT, encoding="utf-8") as handle:
            tree = ast.parse(handle.read())
        # read_journal is the read itself; the read() of cmd_repair runs inside the lock of write_entry.
        free = {"read_journal", "read"}
        found = []

        def walk(node, function, locked):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                function, locked = node.name, False
                for default in node.args.defaults:
                    walk(default, "<default>", True)  # a default names the function; it is not a call
                for child in node.body:
                    walk(child, function, locked)
                return
            if isinstance(node, ast.With) and any(isinstance(i.context_expr, ast.Call) and
                                                  getattr(i.context_expr.func, "id", "") == "Lock" for i in node.items):
                locked = True
            if (isinstance(node, ast.Call) and getattr(node.func, "id", "") in ("read_journal", "journal_bytes")
                    and not locked and function not in free):
                found.append(f"{function} line {node.lineno}")
            for child in ast.iter_child_nodes(node):
                walk(child, function, locked)

        walk(tree, "<module>", False)
        self.assertEqual(found, [])

    def test_the_pre_event_codes_of_the_script_are_the_pinned_ones(self):
        self.assertEqual(set(night_module().PRE_EVENT_CODES), PRE_EVENT_CODES)

    def test_the_final_codes_are_the_pinned_ones(self):
        """The agent acts on the class (final: do not retry), so a class change must be a test change."""
        final = {code for code, (kind, _) in night_module().CODES.items() if kind == "final"}
        self.assertEqual(final, FINAL_CODES)

    def test_each_code_has_its_own_message_and_a_test_that_asserts_it(self):
        module = night_module()
        codes = module.CODES
        messages = [message for _, message in codes.values()]
        self.assertEqual(len(messages), len(set(messages)), "two codes share one message")
        self.assertTrue(all(kind in ("final", "fix") for kind, _ in codes.values()))
        self.assertTrue(set(module.PRE_EVENT_CODES) <= set(codes))
        self.assertEqual(set(module.STATE_CODES), STATE_CODES)
        source = ""
        for name in sorted(os.listdir(HERE)):
            if name.startswith(("test_", "night_testlib")) and name.endswith(".py"):
                with open(os.path.join(HERE, name), encoding="utf-8") as handle:
                    source += handle.read()
        missing = [code for code in codes
                   if not re.search(rf'code="{code}"|"{code}"\)|\["{code}"[\],]|"{code}": ', source)]
        self.assertEqual(missing, [], "codes with no test that asserts them")

    def test_the_mutant_runner_counts_no_kill_when_the_suite_cannot_run(self):
        """A script that fails at import makes each test fail: that is no proof of a kill (P2-6)."""
        with tempfile.TemporaryDirectory() as tmp:
            broken = os.path.join(tmp, "night.py")
            for part in NIGHT_MODULES:
                shutil.copy(os.path.join(os.path.dirname(NIGHT), part + ".py"), tmp)
            with open(NIGHT, encoding="utf-8") as handle:
                source = handle.read()
            with open(broken, "w", encoding="utf-8") as handle:
                handle.write("import no_such_module_for_this_test\n" + source)
            env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": broken}
            done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "mutants.py"), "a bad line is skipped"],
                                  capture_output=True, text=True, env=env, check=False, timeout=600)
        out = done.stdout + done.stderr
        self.assertNotIn("KILLED", out)
        self.assertIn("BASELINE FAILED", out)
        self.assertEqual(done.returncode, 2, out)

    def test_show_red_fails_when_a_broken_journal_passes(self):
        with tempfile.TemporaryDirectory() as tmp:
            stub = os.path.join(tmp, "night.py")
            with open(stub, "w", encoding="utf-8") as handle:
                handle.write(STUB)
            env = {"PATH": os.environ.get("PATH", ""), "NIGHT_PY": stub}
            done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "run_tests.py"), "--show-red"],
                                  capture_output=True, text=True, env=env, check=False)
            self.assertEqual(done.returncode, 1, done.stdout + done.stderr)
            self.assertIn("NOT RED: time goes back", done.stdout)

    def test_each_script_file_fits_one_read(self):
        """Each file in this folder has at most MAX_LINES lines (owner, 2026-11-19, designs-139-140 Q5 A)."""
        too_long = {}
        for name in sorted(os.listdir(HERE)):
            if name.endswith(".py"):
                with open(os.path.join(HERE, name), encoding="utf-8") as handle:
                    count = handle.read().count("\n")
                if count > MAX_LINES:
                    too_long[name] = count
        self.assertEqual(too_long, {}, f"split a file of more than {MAX_LINES} lines")

    def test_the_pure_modules_use_no_file_clock_or_environment(self):
        """The fold, the rules and the views read no file, clock or environment: a check, not a review item."""
        folder = os.path.dirname(NIGHT)
        for part in PURE_MODULES:
            with self.subTest(module=part):
                with open(os.path.join(folder, part + ".py"), encoding="utf-8") as handle:
                    tree = ast.parse(handle.read())
                imported = {alias.name.split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.Import)
                            for alias in node.names}
                imported |= {node.module.split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)}
                self.assertEqual(imported - PURE_IMPORTS - set(PURE_MODULES), set())
                calls = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)} & PURE_NO_CALLS
                self.assertEqual(calls, set())

    def test_a_copy_of_night_py_without_its_modules_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copy(NIGHT, tmp)
            done = subprocess.run([sys.executable, "-I", os.path.join(tmp, "night.py"), "status", "--dir", tmp],
                                  capture_output=True, text=True, check=False)
            self.assertEqual(done.returncode, 3, done.stdout + done.stderr)
            self.assertIn("REFUSED [INTERNAL]", done.stderr)
            self.assertIn("Copy the whole scripts folder", done.stderr)
            self.assertNotIn("Traceback", done.stderr)
            self.assertEqual(sorted(os.listdir(tmp)), ["night.py"])  # no __pycache__
