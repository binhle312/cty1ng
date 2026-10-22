import pytest

from rolebots.botdef import load_all_bots


def test_shipped_bots_load(bots):
    assert set(bots) == {"ba", "designer"}
    ba, designer = bots["ba"], bots["designer"]
    assert set(ba.skills) == {"interview-stakeholder", "write-user-stories"}
    assert set(designer.skills) == {"design-ui-prototype", "review-against-stories"}
    assert ba.handoff_to == ["designer", "human"]
    assert designer.all_write_paths == ["design/", "memory/designer.md"]
    assert ":" in ba.model  # "<provider>:<model name>"
    assert "propose_handoff" in ba.skills["write-user-stories"].body()


def test_unknown_handoff_target_is_rejected(tmp_path):
    bot = tmp_path / "bots" / "qa"
    (bot / "skills").mkdir(parents=True)
    (bot / "persona.md").write_text("QA")
    (bot / "bot.yaml").write_text(
        "role: qa\nmodel: test\nwrite_paths: [tests/]\nhandoff_to: [frontend]\n"
    )
    with pytest.raises(ValueError, match="unknown roles"):
        load_all_bots(tmp_path / "bots")
