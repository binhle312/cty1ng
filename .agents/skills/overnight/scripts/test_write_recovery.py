"""Check errors before and after a whole append reaches the journal."""

from contextlib import redirect_stderr
import io
import os
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
from night_review_testlib import ReviewFixture, TARGET
from night_testlib import at, night_module


class WriteRecoveryTests(ReviewFixture, unittest.TestCase):
    def failed_write(self, command, event, stage, *args):
        module = night_module()
        files = sys.modules["night_files"]
        append, write = files.append, os.write

        def write_then_error(fd, content):
            if stage == "after":
                write(fd, content)
            raise OSError(5, f"{stage} append")

        def inject(folder, entry, **options):
            if entry["kind"] == event:
                with patch("os.write", write_then_error):
                    return append(folder, entry, **options)
            return append(folder, entry, **options)

        buffer = io.BytesIO()
        error = io.TextIOWrapper(buffer, encoding="utf-8")
        with (patch.dict(os.environ, {**self.env, "NIGHT_TEST_MODE": "1", "NIGHT_FAKE_NOW": at("22:10")}),
              patch.object(files, "append", inject), redirect_stderr(error)):
            result = module.main([command, "--dir", str(self.chief), *args])
        error.flush()
        detail = buffer.getvalue().decode()
        self.assertEqual(result, 3, detail)
        self.assertIn("[WRITE_FAILED]", detail)
        self.assertIn("entry status uncertain" if stage == "before" else "is visible, durability uncertain",
                      detail)

    def merge_args(self, grant):
        return ("--run", self.run_id, "--head", self.head, "--target", TARGET, "--leader", "leader",
                "--grant", str(grant["id"]))

    def test_write_recovery_at_append_boundaries(self):
        for stage in ("before", "after"):
            with self.subTest(stage=stage):
                self.setUp()
                self.begin(second=False)
                reports = self.complete()
                data = self.input("grant.json", {"reports": reports})
                self.failed_write("grant", "merge-permission", stage, "--data", data)
                grants = [e for e in self.entries() if e["kind"] == "merge-permission"]
                self.assertEqual(len(grants), int(stage == "after"))
                if grants:
                    self.expect(self.grant(reports), "MERGE_PENDING")
                else:
                    self.ok(self.grant(reports))
                grant = self.entries()[-1]
                args = self.merge_args(grant)
                self.failed_write("merge", "merge-attempt", stage, *args)
                self.assertNotIn('"PUT"', (self.root / "calls").read_text())
                if stage == "after":
                    self.expect(self.command("merge", *args), "MERGE_PERMISSION_USED")
                    self.assertNotIn('"PUT"', (self.root / "calls").read_text())
                    self.setUp()
                    self.begin(second=False)
                    self.ok(self.grant(self.complete()))
                    args = self.merge_args(self.entries()[-1])

                self.failed_write("merge", "merge-result", stage, *args)
                self.expect(self.command("merge", *args), "MERGE_PERMISSION_USED")
                self.assertEqual((self.root / "calls").read_text().count('"PUT"'), 1)
                path, = self.worktree.glob(".overnight/*/*/leader-events.jsonl")
                self.assertEqual(path.read_text().count('"merge-result"'), int(stage == "after"))

                self.failed_write("report", "report", stage)
                self.ok(self.command("report"))
                self.assertEqual(sum(e["kind"] == "report" for e in self.entries()), 1)
