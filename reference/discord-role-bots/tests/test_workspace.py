import os

import pytest

from rolebots.workspace import PathError, Workspace


@pytest.fixture
def two_projects(tmp_path):
    a = Workspace(tmp_path / "ws" / "100")
    b = Workspace(tmp_path / "ws" / "200")
    a.ensure("project-a")
    b.ensure("project-b")
    (b.root / "docs" / "secret.md").write_text("project b only")
    return a, b


@pytest.mark.parametrize("path", [
    "../200/docs/secret.md",
    "docs/../../200/docs/secret.md",
    "/etc/passwd",
    "C:/Windows/win.ini",
    ".git/config",
])
def test_cannot_reach_outside_own_workspace(two_projects, path):
    a, _ = two_projects
    with pytest.raises(PathError):
        a.read_text(path)


def test_symlink_out_of_workspace_is_refused(two_projects):
    a, b = two_projects
    os.symlink(b.root / "docs", a.root / "docs" / "sneaky")
    with pytest.raises(PathError):
        a.read_text("docs/sneaky/secret.md")


def test_list_files_shows_only_own_project(two_projects):
    a, _ = two_projects
    assert a.list_files() == ["README.md"]


def test_write_scope_is_enforced(two_projects):
    a, _ = two_projects
    assert a.write_text("docs/stories.md", "x", ["docs/"]) == "docs/stories.md"
    with pytest.raises(PathError):
        a.write_text("design/home.html", "x", ["docs/"])
    with pytest.raises(PathError):
        a.write_text("docs.md", "x", ["docs/"])  # prefix match must respect the folder boundary
    assert a.write_text("memory/ba.md", "notes", ["docs/", "memory/ba.md"]) == "memory/ba.md"
    with pytest.raises(PathError):
        a.write_text("memory/designer.md", "x", ["docs/", "memory/ba.md"])


def test_commit_pins_a_version_and_detects_later_edits(two_projects):
    a, _ = two_projects
    a.write_text("docs/stories.md", "v1", ["docs/"])
    sha = a.commit("BA: stories", ["docs/stories.md"])
    assert not a.changed_since(sha, ["docs/stories.md"])

    a.write_text("docs/stories.md", "v2", ["docs/"])  # uncommitted edit
    assert a.changed_since(sha, ["docs/stories.md"])

    a.commit("BA: more", ["docs/stories.md"])  # committed edit
    assert a.changed_since(sha, ["docs/stories.md"])


def test_commit_without_changes_returns_head(two_projects):
    a, _ = two_projects
    head = a.head()
    assert a.commit("nothing", ["README.md"]) == head


def test_discord_chunking_respects_the_limit():
    from rolebots.chat import chunk

    text = "\n".join(f"line {i} " + "x" * 80 for i in range(200))
    parts = chunk(text, 1980)
    assert all(len(p) <= 2000 for p in parts)
    assert "".join(parts).replace("\n", "") == text.replace("\n", "")
