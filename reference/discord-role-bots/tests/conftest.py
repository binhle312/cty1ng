from __future__ import annotations

from pathlib import Path

import pytest

from rolebots.botdef import load_all_bots
from rolebots.db import Store

ROOT = Path(__file__).resolve().parents[1]
OWNER = "discord:111"
CH_A, CH_B = "discord:100", "discord:200"


@pytest.fixture
def bots():
    return load_all_bots(ROOT / "bots")


@pytest.fixture
async def store(tmp_path):
    s = await Store.open(tmp_path / "test.sqlite3", lease_seconds=60, max_attempts=3)
    yield s
    await s.close()
