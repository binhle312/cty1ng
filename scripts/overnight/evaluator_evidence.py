"""Require a completed report for the requested Tier 1 and Tier 2 checks."""
import json
from pathlib import Path
import sys


def completed(report):
    if (report.get("overall_passed") is not True or report.get("overall_status") != "passed"
            or report.get("incomplete_scans") != []):
        return False
    results = {row["validator"]: row for row in report.get("results", [])}
    return all(name in results and results[name].get("status") == "passed"
               and results[name].get("skipped") is False and not results[name].get("incomplete_scans")
               for name in ("Security Scan", "Tier 2 Deduplication"))


if __name__ == "__main__":
    passed = completed(json.loads(Path(sys.argv[1]).read_text()))
    print("Complete Tier 1 and 2 evidence" if passed else "Incomplete or failed Tier 1 and 2 evidence")
    sys.exit(0 if passed else 1)
