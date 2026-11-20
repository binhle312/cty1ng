"""A disposable Git repo and a fake GitHub CLI for review and merge tests."""

import json
import os
from pathlib import Path
import subprocess
import sys

import test_option_b as fixtures
from test_option_b import OTHER, PAIR, POLICY, ROWS, TARGET
from night_testlib import SHA, card, new

MERGE_SHA = "1" * 40

FAKE_GH = r"""
import json, os, sys, time
from pathlib import Path
folder = Path(os.environ["FAKE_GITHUB"])
config = json.loads((folder / "config").read_text())
argv = sys.argv[1:]
method = argv[argv.index("--method") + 1]
endpoint = argv[argv.index("--method") + 2]
data = json.load(sys.stdin) if method == "PUT" else None
with (folder / "calls").open("a") as log:
    print(json.dumps([argv, data]), file=log)
if method == "PUT":
    remote_head = config.get("write_head", config.get("head", "$HEAD"))
    if data.get("sha") != remote_head:
        print("HTTP/2.0 409 Conflict\n\n" + json.dumps({"message": "Head changed"}))
        sys.exit(1)
    if config.get("reject"):
        print("HTTP/2.0 405 Method Not Allowed\n\n" + json.dumps({"message": "Rejected"}))
        sys.exit(1)
    if config.get("bad_reply"):
        print("invalid")
    else:
        print("HTTP/2.0 200 OK\n\n" + json.dumps({"merged": True, "sha": "$MERGE"}))
    sys.exit(0)
if endpoint.startswith("search/issues?"):
    pages = config.get("audit")
    if pages is None:
        sys.exit(1)
    print(json.dumps(pages))
    sys.exit()
number = endpoint.rsplit("/", 1)[-1]
if "/pulls/" in endpoint and "/files?" in endpoint:
    output = [config.get("files_override", config.get("files", []))]
elif "/pulls/" in endpoint:
    if config.get("bad_read") and number == "12":
        sys.exit(1)
    entered = folder / "entered"
    if config.get("block_read") and number == "12":
        entered.touch()
        until = time.monotonic() + 8
        while not (folder / "release").exists() and time.monotonic() < until:
            time.sleep(.01)
    pr = {"number": int(number), "head": {"sha": config.get("head", "$HEAD")},
          "base": {"ref": "main", "repo": {"full_name": "example/app"}, "sha": config.get("base_sha", "$HEAD")},
          "changed_files": config.get("changed_files"), "body": config.get("body", ""),
          "state": "open", "draft": config.get("draft", False), "merged": False,
          "mergeable": True, "mergeable_state": "clean", "auto_merge": None}
    pr.update(config.get("pulls", {}).get(number, {}))
    output = pr
elif endpoint == "repos/example/app":
    output = {"allow_squash_merge": True, "delete_branch_on_merge": config.get("auto_delete", False)}
elif "/actions/workflows" in endpoint:
    output = [{"workflows": config.get("workflows", [])}]
elif "/hooks" in endpoint:
    output = [[]]
elif "/rules/branches" in endpoint:
    if config.get("unknown_policy"):
        sys.exit(1)
    output = [config.get("rules", [{"type": "required_status_checks", "parameters": {
        "required_status_checks": [{"context": "CI", "integration_id": 42}]}}] if config.get("red_main") else [])]
elif "/branches/main" in endpoint:
    output = {"name": "main", "protected": False, "commit": {"sha": config.get("base_sha", "$HEAD")}}
elif "/check-runs" in endpoint:
    checks = config.get("checks", [])
    requested = endpoint.split("/commits/")[1].split("/")[0]
    if config.get("red_main") and requested != config["base_sha"]:
        checks = [dict(name="CI", head_sha=requested, app={"id": 42}, status="completed", conclusion="success")]
    output = [{"check_runs": checks}]
elif "/statuses" in endpoint:
    output = [[]]
else:
    sys.exit(1)
print(json.dumps(output))
""".replace("$HEAD", SHA).replace("$MERGE", MERGE_SHA)


class ReviewFixture:
    for name in ("setUp", "expect", "ok", "journal", "entries", "input"):
        locals()[name] = getattr(fixtures.OptionBTests, name)

    def command(self, *args, time="22:10", env=None):
        return fixtures.OptionBTests.command(self, *args, time=time, env=env or self.env)

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.checkout), *args], text=True).strip()

    def commit(self, name, content):
        (self.checkout / name).write_text(content)
        self.git("add", name)
        self.git("commit", "-qm", content)
        return self.git("rev-parse", "HEAD")

    def begin(self, cap=None, task_class="night", consult=False, planned=True, second=True):
        self.ok(new(str(self.chief), "synthetic workflow"))
        self.reviews = self.chief / "reviews"
        self.reviews.mkdir()
        self.checkout = self.reviews / "checkout"
        self.checkout.mkdir()
        self.git("init", "-qb", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.main = self.commit("base.txt", "base")
        self.git("switch", "-qc", "pr")
        self.head = self.commit("owned.txt", "change")
        self.git("switch", "-q", "--detach", self.head)
        self.worktree.mkdir()
        self.other = self.root / "second-leader"
        self.other.mkdir()
        tool = self.root / "gh"
        tool.write_text(f"#!{sys.executable}\n" + FAKE_GH)
        tool.chmod(0o755)
        self.env = {"PATH": f"{self.root}:{os.environ['PATH']}", "FAKE_GITHUB": str(self.root)}
        self.config()
        rows = [*ROWS[:3], (*ROWS[3][:5], "second")] if second else ROWS[:3]
        card(str(self.chief), rows)
        tasks = {target: {"class": kind, "criteria": ["Change the owned file"], "owned": ["owned.txt"]}
                 for target, kind in ((TARGET, task_class), (OTHER, "night")) if target == TARGET or second}
        options = ["--consultants"] if consult else []
        if cap is not None:
            options += ["--review-cap", str(cap)]
        self.ok(self.command("go", "--stop", "23:00Z", "--goal", "set", "--rehearsal", "passed",
                             "--chief", "chief", "--review-policy", self.input("policy.json", POLICY),
                             "--tasks", self.input("tasks.json", tasks), "--allow-empty-checks", *options, time="22:01"))
        self.run_id = self.entries()[0]["run"]
        if task_class == "night":
            self.ok(self.assign())
            if planned:
                self.ok(self.plan())
        if second:
            self.ok(self.assign(OTHER))
            self.ok(self.plan(OTHER))

    def config(self, **updates):
        self.input("config", dict(head=self.head, base_sha=self.main, files=[{"filename": "owned.txt", "status": "modified"}],
                                  changed_files=1) | updates)

    def typed(self, command, **data):
        return self.command(command, "--data", self.input("data.json", data))

    def assign(self, target=TARGET, **changes):
        fields = dict(chief="chief", target=target, leader="leader" if target == TARGET else "second",
                      reviewers=PAIR, helpers=[], worktree=str(self.worktree if target == TARGET else self.other))
        return self.typed("assign", **(fields | changes))

    def plan(self, target=TARGET):
        return self.typed("plan", chief="chief", target=target, plan="plan.md", strategy="test-strategy.md")

    def start(self, target=TARGET, **changes):
        fields = dict(chief="chief", target=target, head=self.head, checkout=str(self.checkout))
        return self.typed("review-start", **(fields | changes))

    def reports(self, p3=(), *, p1=(), bad_count=False, bad_role=False):
        paths = []
        for who in PAIR:
            path = self.reviews / f"{len(self.entries())}-{who['provider']}.md"
            findings = {"p1": list(p1), "p2": [], "p3": list(p3)}
            verdict = dict(head=self.head, model=who["model"], effort=who["effort"], p1=len(p1),
                           p2=0, p3=len(p3) + int(bad_count))
            actor = {key: who[key] for key in ("provider", "role")}
            if bad_role:
                actor["role"] = "other"
            path.write_text("Review details\n\nReviewer: " + json.dumps(actor) + "\nFindings: " + json.dumps(findings) +
                            "\nVerdict: " + json.dumps(verdict) + "\n")
            paths.append(str(path))
        return paths

    def complete(self, target=TARGET, p3=(), p1=()):
        self.ok(self.start(target))
        paths = self.reports(p3, p1=p1)
        self.ok(self.typed("review", chief="chief", target=target, reports=paths, ledger=["ledger fixture"]))
        return paths

    def grant(self, reports):
        return self.typed("grant", reports=reports)

    def update_main(self, number):
        self.git("switch", "-q", "main")
        self.main = self.commit(f"main-{number}.txt", f"advance {number}")
        self.git("switch", "-q", "--detach", self.head)
        self.git("merge", "--no-ff", "--no-edit", "main")
        self.head = self.git("rev-parse", "HEAD")
        self.config()

