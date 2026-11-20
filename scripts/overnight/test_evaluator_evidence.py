import copy
import unittest

from evaluator_evidence import completed


class EvaluatorEvidenceTests(unittest.TestCase):
    def test_only_a_completed_pass_counts(self):
        report = {"overall_passed": True, "overall_status": "passed", "incomplete_scans": [],
                  "results": [{"validator": name, "status": "passed", "skipped": False, "incomplete_scans": []}
                              for name in ("Security Scan", "Tier 2 Deduplication")]}
        self.assertTrue(completed(report))
        for index in (0, 1):
            for status in ("incomplete", "failed", "skipped"):
                with self.subTest(index=index, status=status):
                    bad = copy.deepcopy(report)
                    bad["results"][index]["status"] = status
                    self.assertFalse(completed(bad))
        self.assertFalse(completed(dict(report, incomplete_scans=["skillspector"])))
        self.assertFalse(completed(dict(report, results=report["results"][:1])))
