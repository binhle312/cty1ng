"""Inventory of PR #140 break names and the status of their proof."""

from brief8_breaks import BREAKS as BRIEF8
from cleanup_breaks import BREAKS as CLEANUP
from historical_r3_breaks import BREAKS as HISTORICAL_CURRENT, RETIREMENTS
from mutant_list import MUTANTS as HISTORICAL
from option_b_breaks import BREAKS as OPTION_B, RETIREMENTS as OPTION_B_RETIREMENTS
from plan_r3_breaks import BREAKS as R3

BREAKS = R3 + OPTION_B + BRIEF8 + CLEANUP + HISTORICAL_CURRENT
MAPPED = {row[0] for row in HISTORICAL_CURRENT}
MISSING = {row[0]: "historical source edit has no current exact assertion mapping"
           for row in HISTORICAL if row[0] not in MAPPED and row[0] not in RETIREMENTS}


def inventory_problems():
    names = [row[0] for row in BREAKS]
    historical_names = [row[0] for row in HISTORICAL]
    if len(set(names)) != len(names) or len(set(historical_names)) != len(historical_names):
        return ["duplicate break names"]
    if MAPPED & RETIREMENTS.keys() or (MAPPED | RETIREMENTS.keys()) - set(historical_names):
        return ["invalid historical disposition"]
    retired = RETIREMENTS | OPTION_B_RETIREMENTS
    if set(names) & retired.keys() or any(not reason.strip() for reason in retired.values()):
        return ["break retirement needs one reason and no runnable edit"]
    return []
