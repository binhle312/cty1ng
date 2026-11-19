#!/usr/bin/env python3
"""Run all tests of night.py: `python3 -I run_tests.py` in this folder (`-v` for each name, `-f` to stop at the
first failure). `python3 -I run_tests.py --show-red` runs `night.py check` on each broken journal, prints the
output, and exits 1 if a broken journal does not fail with its code.
NIGHT_PY replaces the script under test (night.py and its modules in that folder).
"""

import os
import sys
import unittest

sys.dont_write_bytecode = True  # no __pycache__ in the skill folder
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # `-I` drops this folder

if __name__ == "__main__":
    if "--show-red" in sys.argv:
        from test_check import show_red
        sys.exit(show_red())
    suite = unittest.defaultTestLoader.discover(HERE, pattern="test_*.py", top_level_dir=HERE)
    verbosity = 2 if "-v" in sys.argv else 1
    result = unittest.TextTestRunner(verbosity=verbosity, failfast="-f" in sys.argv).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
