"""Check the link between the repository merge bar and the overnight skill."""

import os
from pathlib import Path
import unittest


class MergeBarTests(unittest.TestCase):
    def test_merge_bar_links_night_rule(self):
        root = Path(__file__).resolve().parents[2]
        path = Path(os.environ.get("OVERNIGHT_MERGE_BAR", root / "docs/workflows/merge-bar.md"))
        self.assertIn("overnight/SKILL.md#night-review-and-merge", path.read_text())
