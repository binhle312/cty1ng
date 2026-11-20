"""Observe recovery after durable writes and snapshots of reports under the lock."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))
from night_testlib import at, night_module, run, started


class RecoveryTests(unittest.TestCase):
    def fixture(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        folder = os.path.join(temp.name, "night")
        started(folder)
        return Path(folder)

    def events(self, journal, kind):
        return [entry for line in journal.read_text().splitlines() if (entry := json.loads(line))["kind"] == kind]

    def test_repair_resumes_partial_repair_append(self):
        folder = self.fixture()
        journal = folder / "journal.jsonl"
        with journal.open("ab") as handle:
            handle.write(b"lost tail")
        module = night_module()
        files = sys.modules["night_files"]
        append = files.append

        def cut_append(path, entry, **fields):
            if entry["kind"] == "repair":
                with journal.open("ab") as handle:
                    handle.write(module.entry_bytes(entry)[:35])
                raise module.Refused("WRITE_FAILED", "partial repair append")
            return append(path, entry, **fields)

        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch.object(
                files, "append", cut_append):
            self.assertEqual(module.main(["repair", "--dir", str(folder)]), 3)
        self.assertEqual(len(list(folder.glob("journal.cut-*.txt"))), 1)
        status, out = run(str(folder), "repair", at=at("22:11"))
        self.assertEqual(status, 0, out)
        self.assertEqual(len(self.events(journal, "repair")), 1)
        self.assertEqual(len(list(folder.glob("journal.cut-*.txt"))), 1)
        status, out = run(str(folder), "check", at=at("22:11"))
        self.assertEqual((status, out.strip()), (0, "check: OK"))

    def test_repair_preserves_a_side_record_with_wrong_identity(self):
        folder = self.fixture()
        journal = folder / "journal.jsonl"
        with journal.open("ab") as handle:
            handle.write(b"lost tail")
        module = night_module()
        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch(
                "os.truncate", side_effect=OSError(5, "before truncate")):
            self.assertEqual(module.main(["repair", "--dir", str(folder)]), 3)
        side, = folder.glob("journal.cut-*.txt")
        data = json.loads(side.read_text())
        data["prefix_sha256"] = "0" * 64
        side.write_text(json.dumps(data))
        originals = [path.read_bytes() for path in (journal, side)]
        status, out = run(str(folder), "repair", at=at("22:11"))
        self.assertEqual(status, 3, out)
        self.assertIn("[REPAIR_PENDING]", out)
        self.assertEqual([path.read_bytes() for path in (journal, side)], originals)

    def test_repair_keeps_a_later_cut_separate(self):
        folder = self.fixture()
        journal = folder / "journal.jsonl"
        for index, cut in enumerate((b"one cut", b"another cut"), 1):
            with journal.open("ab") as handle:
                handle.write(cut)
            status, out = run(str(folder), "repair", at=at("22:10"))
            self.assertEqual(status, 0, out)
            self.assertEqual(len(list(folder.glob("journal.cut-*.txt"))), index)
        self.assertEqual([e["cut_file"] for e in self.events(journal, "repair")],
                         ["journal.cut-1.txt", "journal.cut-2.txt"])

    def test_check_snapshot_orders_with_repair(self):
        for check_first in (True, False):
            with self.subTest(check_first=check_first):
                folder = self.fixture()
                journal = folder / "journal.jsonl"
                with journal.open("ab") as f:
                    f.write(b"lost tail")
                module = night_module()
                files = sys.modules["night_files"]
                paused, release, waiting = threading.Event(), threading.Event(), threading.Event()
                real_view, real_truncate = files.view_locked, os.truncate
                args = SimpleNamespace(dir=str(folder), now=False)

                def barrier():
                    paused.set()
                    self.assertTrue(release.wait(10))

                def read_before_repair(path):
                    if check_first:
                        barrier()
                    return real_view(path)

                def truncate_before_check(path, size):
                    if not check_first:
                        barrier()
                    return real_truncate(path, size)

                def check():
                    try:
                        return module.cmd_check(args)
                    except module.Refused as error:
                        return error.code

                def repair():
                    return files.repair(str(folder))["kind"]

                def second(action):
                    waiting.set()
                    return action()

                with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), patch.dict(
                        module.cmd_check.__globals__, {"view_locked": read_before_repair}), patch("os.truncate", truncate_before_check), (
                        ThreadPoolExecutor(max_workers=2)) as pool:
                    first = pool.submit(check if check_first else repair)
                    self.assertTrue(paused.wait(10))
                    other = pool.submit(second, repair if check_first else check)
                    try:
                        self.assertTrue(waiting.wait(10))
                        with self.assertRaises(TimeoutError):
                            other.result(timeout=0.15)
                    finally:
                        release.set()
                    self.assertEqual((first.result(timeout=10), other.result(timeout=10)),
                                     ("TORN_LINE", "repair") if check_first else ("repair", 0))
                self.assertEqual(self.events(journal, "repair")[0]["bytes"], len(b"lost tail"))

    def test_check_snapshot_orders_with_report_and_render(self):
        for first in ("check", "report", "render"):
            with self.subTest(first=first):
                self.snapshot_order(first)

    def snapshot_order(self, first):
        folder = self.fixture()
        self.assertEqual(run(str(folder), "report", at=at("22:04"))[0], 0)
        self.assertEqual(run(str(folder), "log", "aware", "new evidence", at=at("22:06"))[0], 0)
        night_module()
        files = sys.modules["night_files"]
        args = SimpleNamespace(dir=str(folder), now=False)
        target = folder / "report.md"
        entered, release, second_started = threading.Event(), threading.Event(), threading.Event()
        real_open, real_replace = open, os.replace
        stdout = io.StringIO()
        module = night_module()

        def checking_open(path, *args, **kwargs):
            if Path(path) == target and first == "check":
                entered.set()
                if not release.wait(5):
                    raise AssertionError("check did not release")
            return real_open(path, *args, **kwargs)

        def reporting_replace(source, destination):
            if Path(destination) == target and not entered.is_set():
                entered.set()
                if not release.wait(5):
                    raise AssertionError("writer did not release")
            return real_replace(source, destination)

        check = module.cmd_check
        writer = module.cmd_render if first == "render" else module.cmd_report

        def second(action):
            second_started.set()
            return action(args)

        with patch.dict(os.environ, {"NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}), redirect_stdout(stdout), patch.object(
                files, "open", checking_open, create=True), patch("os.replace", reporting_replace), ThreadPoolExecutor(
                    max_workers=2) as pool:
            paused = pool.submit(check if first == "check" else writer, args)
            self.assertTrue(entered.wait(3), "first operation did not reach the barrier")
            waiter = pool.submit(second, writer if first == "check" else check)
            try:
                self.assertTrue(second_started.wait(3))
                with self.assertRaises(TimeoutError):
                    waiter.result(timeout=0.15)
            finally:
                release.set()
            outputs = (paused.result(timeout=4), waiter.result(timeout=4))
        self.assertEqual(outputs, (0, None) if first == "check" else (None, 0), stdout.getvalue())
        self.assertIn("check: OK", stdout.getvalue())
        self.assertNotIn("REPORT_FILE", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
