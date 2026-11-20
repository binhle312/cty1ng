"""Check that the delivery table covers all approved lines and explains each gap."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
plan = (ROOT.parent / "plan-b" / "plan-delta-r2.md").read_text().splitlines()
table = (ROOT / "plan-lines.md").read_text()
covered = 0
for row in table.splitlines():
    match = re.fullmatch(r"\| (\d+)[–-](\d+) \| (.*?) \| (.*?) \|", row)
    if not match:
        continue
    first, last = (int(value) for value in match.groups()[:2])
    code, reason = match.groups()[2:]
    if first != covered + 1 or last < first:
        raise SystemExit(f"Noncontiguous plan rows at {first}–{last}")
    if not code.strip() or (code.strip() == "Gap" and not reason.strip()):
        raise SystemExit(f"Missing evidence or gap reason at {first}–{last}")
    covered = last

if covered != len(plan):
    raise SystemExit(f"Coverage ends at {covered}; plan has {len(plan)} lines")
print(f"All {covered} plan lines have an evidence row or a stated gap")
