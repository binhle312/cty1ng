"""Run the ordered, journaled cleanup of one merged PR."""
from os import path
import hashlib
import os
import stat
import subprocess
from urllib.parse import quote, urlencode

from night_files import SharedLock, bound_night, clock, leader_append, leader_events
from night_format import FULL_SHA, Refused, canonical_target, entry_time, is_text, parsed_target


GIT_TIMEOUT_S = 30


def inside(parent, child):
    return path.commonpath((parent, child)) == parent


def git(repo, *args, code="CLEAN_GIT", missing=None):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        done = subprocess.run(["git", "-C", repo, "-c", "core.hooksPath=/dev/null", *args],
                              env=env, capture_output=True, timeout=GIT_TIMEOUT_S, shell=False)
    except (OSError, subprocess.TimeoutExpired):
        raise Refused(code, args[0]) from None
    if missing is not None and done.returncode == missing:
        return None
    if done.returncode:
        raise Refused(code, args[0])
    return done.stdout


def repository_identity(repo):
    output = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir", code="CLEAN_REPO")
    directory = path.realpath(os.fsdecode(output.removesuffix(b"\n")))
    try:
        info = os.stat(directory)
    except OSError:
        raise Refused("CLEAN_REPO", repo) from None
    return [directory, info.st_dev, info.st_ino]


def dispatch(chief, fields):
    scope = fields["cleanup"]
    if not isinstance(scope, dict) or set(scope) != {"folder", "repo", "branch"}:
        raise Refused("CLEAN_ASSIGNMENT")
    root, repo, branch = (scope[k] for k in ("folder", "repo", "branch"))
    worktree = fields.get("worktree")
    roots = (root, repo, worktree, chief)
    if any(not is_text(p) or "\0" in p or not path.isabs(p) or path.realpath(p) != p for p in roots):
        raise Refused("CLEAN_ASSIGNMENT")
    if (any(inside(a, b) or inside(b, a) for a, b in ((root, worktree), (root, chief), (worktree, chief)))
            or any(inside(p, repo) for p in (root, worktree, chief))
            or not path.isdir(root) or not path.isdir(repo)):
        raise Refused("CLEAN_ASSIGNMENT")
    if not is_text(branch) or "\0" in branch or branch.startswith("-") or branch in ("main", "master"):
        raise Refused("CLEAN_ASSIGNMENT")
    ref = "refs/heads/" + branch
    git(repo, "check-ref-format", ref, code="CLEAN_ASSIGNMENT")
    identity = repository_identity(repo)
    if any(inside(p, identity[0]) for p in (root, worktree, chief)):
        raise Refused("CLEAN_ASSIGNMENT")
    fields["cleanup"] = {**scope, "identity": identity}


def directory_fd(directory):
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open("/", flags)
    try:
        for name in directory.split("/")[1:]:
            if name:
                child = os.open(name, flags, dir_fd=fd)
                os.close(fd)
                fd = child
        return fd
    except OSError:
        os.close(fd)
        raise


def fingerprint(fd, name):
    def identity(info):
        return [info.st_dev, info.st_ino, info.st_mtime_ns, info.st_ctime_ns]

    handle = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    with os.fdopen(handle, "rb") as file:
        info = os.fstat(file.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise Refused("CLEAN_TEMP_IDENTITY", name)
        sha = hashlib.file_digest(file, "sha256").hexdigest()
        observed = os.stat(name, dir_fd=fd, follow_symlinks=False)
        if identity(info) != identity(observed) or info.st_size != observed.st_size:
            raise Refused("CLEAN_TEMP_IDENTITY", name)
        return dict(size=info.st_size, sha=sha, identity=identity(info))


def worktrees(repo):
    records = []
    for row in git(repo, "worktree", "list", "--porcelain", "-z").split(b"\0\0"):
        if row:
            records.append(dict(os.fsdecode(field).partition(" ")[::2] for field in row.split(b"\0") if field))
    return records


def tracked_files(worktree):
    flags = git(worktree, "ls-files", "-v", "-z").split(b"\0")[:-1]
    if any(row[:1].islower() or row.startswith(b"S ") for row in flags):
        raise Refused("CLEAN_WORKTREE_DIRTY", "index has hidden paths")
    return {os.fsdecode(row[2:]) for row in flags}


def worktree_state(repo, worktree, ref, sha, allowed):
    rows = [row for row in worktrees(repo) if row.get("worktree") == worktree]
    if (len(rows) != 1 or rows[0].get("branch") != ref or rows[0].get("HEAD") != sha
            or "locked" in rows[0] or path.realpath(worktree) != worktree
            or repository_identity(worktree) != repository_identity(repo)):
        raise Refused("CLEAN_WORKTREE", worktree)
    files = tracked_files(worktree)
    output = git(worktree, "status", "--porcelain=v1", "-z", "--untracked-files=all",
                 "--ignored=traditional", "--ignore-submodules=none", "--no-renames")
    for row in output.split(b"\0")[:-1]:
        if row[:3] not in (b"?? ", b"!! ") or path.join(worktree, os.fsdecode(row[3:])) not in allowed:
            raise Refused("CLEAN_WORKTREE_DIRTY", os.fsdecode(row[3:]))
    try:
        return sum(os.lstat(path.join(worktree, name)).st_size for name in files)
    except OSError:
        raise Refused("CLEAN_WORKTREE", worktree) from None


def remote_guard(github, page_rows, host, repo, branch):
    settings = github(host, f"repos/{repo}", "CLEAN_GITHUB")
    default = settings.get("default_branch") if isinstance(settings, dict) else None
    if repo_name(settings) != repo or not isinstance(default, str) or not default:
        raise Refused("CLEAN_GITHUB", "default branch")
    if branch == default or branch in ("main", "master"):
        raise Refused("CLEAN_DEFAULT_BRANCH", branch)
    query = urlencode({"state": "open", "head": repo.split("/")[0] + ":" + branch, "per_page": 100})
    if page_rows(host, f"repos/{repo}/pulls?{query}", "CLEAN_GITHUB"):
        raise Refused("CLEAN_OPEN_HEAD", branch)


def repo_name(value):
    full_name = value.get("full_name") if isinstance(value, dict) else None
    return full_name.lower() if isinstance(full_name, str) else None


def live_merge(github, host, repo, number, branch, attempt, result):
    pr = github(host, f"repos/{repo}/pulls/{number}", "CLEAN_GITHUB")
    if not isinstance(pr, dict) or pr.get("number") != number or pr.get("state") != "closed" or pr.get("merged") is not True:
        raise Refused("CLEAN_PR_NOT_MERGED", str(number))
    base, head = pr.get("base"), pr.get("head")
    if (not isinstance(base, dict) or not isinstance(head, dict)
            or repo_name(base.get("repo")) != repo or repo_name(head.get("repo")) != repo or head.get("ref") != branch):
        raise Refused("CLEAN_PR_SCOPE", branch)
    if head.get("sha") != attempt["head"] or pr.get("merge_commit_sha") != result["sha"]:
        raise Refused("CLEAN_PR_HEAD", branch)


def remote_delete(repo_path, host, repo, branch, ref, sha, github, page_rows):
    remote_guard(github, page_rows, host, repo, branch)
    endpoint = f"repos/{repo}/branches/{quote(branch, safe='')}"
    info = github(host, endpoint, "CLEAN_GITHUB")
    if not isinstance(info, dict) or info.get("name") != branch or type(info.get("protected")) is not bool:
        raise Refused("CLEAN_GITHUB", endpoint)
    if info["protected"]:
        raise Refused("CLEAN_REMOTE_PROTECTED", ref)
    rules = page_rows(host, f"repos/{repo}/rules/branches/{quote(branch, safe='')}?per_page=100", "CLEAN_GITHUB")
    if any(not isinstance(rule.get("type"), str) for rule in rules):
        raise Refused("CLEAN_GITHUB", "branch rules")
    if any(rule["type"] == "deletion" for rule in rules):
        raise Refused("CLEAN_REMOTE_PROTECTED", ref)
    commit = info.get("commit")
    if not isinstance(commit, dict) or commit.get("sha") != sha:
        raise Refused("CLEAN_REMOTE_HEAD", ref)
    url = f"https://{host}/{repo}.git"
    rewrites = git(repo_path, "config", "--null", "--get-regexp", r"^url\..*\.(insteadof|pushinsteadof)$",
                   missing=1) or b""
    if any(url.startswith(os.fsdecode(row.partition(b"\n")[2])) for row in rewrites.split(b"\0")[:-1]):
        raise Refused("CLEAN_REMOTE_URL", url)
    return url


class Cleanup:
    def __init__(self, args, night, target, records, assignment):
        self.args, self.night, self.target, self.records, self.assignment = args, night, target, records, assignment
        self.scope = assignment.get("cleanup")
        self.worktree = assignment["worktree"]
        self.item, self.subject = "cleanup", target

    def write(self, kind, **fields):
        return leader_append(self.args.dir, self.night, self.target, self.records, kind, clock()[0], fields)

    def refusal(self, error):
        self.write("clean-refusal", item=self.item, subject=self.subject, code=error.code, detail=error.detail)

    def active(self):
        if self.night.close:
            raise Refused("CLOSED")
        if clock()[0] >= entry_time(self.night.go["stop"]):
            raise Refused("AFTER_STOP")

    def check_scope(self):
        self.repo = self.scope["repo"]
        self.branch = self.scope["branch"]
        self.ref = "refs/heads/" + self.branch
        self.temp = path.join(self.scope["folder"], "temp")
        self.check_repo()
        if inside(self.worktree, path.realpath(os.getcwd())) or inside(self.worktree, path.realpath(__file__)):
            raise Refused("CLEAN_CWD", self.worktree)

    def check_repo(self):
        if path.realpath(self.repo) != self.repo or repository_identity(self.repo) != self.scope["identity"]:
            raise Refused("CLEAN_REPO", self.repo)

    def temp_location(self, file):
        if not path.isabs(file) or path.realpath(file) != file or file in (self.worktree, self.temp):
            raise Refused("CLEAN_TEMP_SCOPE", file)
        if inside(self.temp, file):
            return
        if not inside(self.worktree, file):
            raise Refused("CLEAN_TEMP_SCOPE", file)
        relative = path.relpath(file, self.worktree)
        if ".git" in relative.split("/"):
            raise Refused("CLEAN_TEMP_SCOPE", file)
        if any(relative == name or relative.startswith(name + "/") for name in tracked_files(self.worktree)):
            raise Refused("CLEAN_TEMP_SCOPE", file)

    def add_temp(self):
        self.item, self.subject = "temp", self.args.path
        actor = self.args.actor
        if actor not in (self.assignment["leader"], *self.assignment["helpers"]):
            raise Refused("CLEAN_TEMP_ACTOR", actor)
        if any(row["kind"] in ("clean-intent", "clean-result") or
               (row["kind"] == "temp-record" and row["subject"] == self.subject) for row in self.records):
            raise Refused("CLEAN_TEMP_RECORD", self.subject)
        self.temp_location(self.subject)
        parent, name = path.split(self.subject)
        fd = directory_fd(parent)
        try:
            self.write("temp-record", actor=actor, subject=self.subject, **fingerprint(fd, name))
        finally:
            os.close(fd)

    def intent(self, size, sha):
        fields = dict(item=self.item, subject=self.subject, size=size, sha=sha)
        finished = self.finished_ids()
        pending = next((row for row in self.records if row["kind"] == "clean-intent" and row["id"] not in finished), None)
        if pending:
            if any(pending[k] != v for k, v in fields.items()):
                raise Refused("CLEAN_INTERRUPTED", pending["subject"])
            return pending
        return self.write("clean-intent", **fields)

    def finished_ids(self):
        return {row["of"] for row in self.records if row["kind"] == "clean-result"}

    def remove(self, size, sha, action):
        entry = self.intent(size, sha)
        self.active()
        action()
        self.write("clean-result", of=entry["id"], item=self.item, subject=self.subject, size=size, sha=sha)

    def remove_temp(self, row):
        self.item, self.subject = "temp", row["subject"]
        self.temp_location(self.subject)
        parent, name = path.split(self.subject)
        fd = directory_fd(parent)
        try:
            expected = {k: row[k] for k in ("size", "sha", "identity")}

            def unlink():
                if fingerprint(fd, name) != expected:
                    raise Refused("CLEAN_TEMP_IDENTITY", self.subject)
                os.unlink(name, dir_fd=fd)
                os.fsync(fd)

            if fingerprint(fd, name) != expected:
                raise Refused("CLEAN_TEMP_IDENTITY", self.subject)
            self.remove(row["size"], row["sha"], unlink)
        finally:
            os.close(fd)

    def clean(self, github, page_rows):
        finished = self.finished_ids()
        removed = {(row["item"], row["subject"]) for row in self.records
                   if row["kind"] == "clean-intent" and row["id"] in finished}
        if any(item == "remote" for item, _ in removed):
            return
        results = [row for row in self.records if row["kind"] == "merge-result" and row["outcome"] == "merged"]
        if len(results) != 1:
            raise Refused("CLEAN_NO_MERGE")
        result = results[0]
        attempt = self.records[result["of"] - 1]
        if attempt["leader"] != self.assignment["leader"]:
            raise Refused("CLEAN_PR_SCOPE", self.target)
        host, repo, number = parsed_target(self.target)
        live_merge(github, host, repo, number, self.branch, attempt, result)
        remote_guard(github, page_rows, host, repo, self.branch)
        sha = attempt["head"]
        temps = [row for row in self.records if row["kind"] == "temp-record" and ("temp", row["subject"]) not in removed]
        if ("worktree", self.worktree) not in removed:
            self.item, self.subject = "worktree", self.worktree
            worktree_state(self.repo, self.worktree, self.ref, sha, {row["subject"] for row in temps})
            for row in temps:
                self.remove_temp(row)
            self.item, self.subject = "worktree", self.worktree
            size = worktree_state(self.repo, self.worktree, self.ref, sha, set())
            self.remove(size, sha, lambda: git(self.repo, "worktree", "remove", "--", self.worktree, code="CLEAN_WORKTREE"))
        self.item, self.subject = "local", self.ref
        self.check_repo()
        trees = worktrees(self.repo)
        if path.lexists(self.worktree) or any(row.get("worktree") == self.worktree for row in trees):
            raise Refused("CLEAN_WORKTREE", self.worktree)
        if any(row.get("branch") == self.ref for row in trees):
            raise Refused("CLEAN_LOCAL_IN_USE", self.ref)
        local = git(self.repo, "show-ref", "--verify", "--hash", self.ref, missing=128)
        if ("local", self.ref) not in removed:
            if local != (sha + "\n").encode():
                raise Refused("CLEAN_LOCAL_HEAD", self.ref)
            remote_guard(github, page_rows, host, repo, self.branch)
            self.remove(None, sha, lambda: git(self.repo, "update-ref", "--no-deref", "-d", self.ref, sha,
                                               code="CLEAN_LOCAL_HEAD"))
        elif local is not None:
            raise Refused("CLEAN_LOCAL_HEAD", self.ref)
        self.item, self.subject = "remote", f"https://{host}/{repo}.git {self.ref}"
        url = remote_delete(self.repo, host, repo, self.branch, self.ref, sha, github, page_rows)
        self.remove(None, sha, lambda: git(self.repo, "-c", "http.followRedirects=false",
                                           "-c", "push.followTags=false", "push", "--no-verify",
                                           "--recurse-submodules=no", f"--force-with-lease={self.ref}:{sha}",
                                           "--", url, ":" + self.ref, code="CLEAN_REMOTE_PUSH"))


def command(args, github, page_rows):
    target = canonical_target(args.target)
    with SharedLock(args.dir):
        night = bound_night(args.dir)
        if args.run != night.run:
            raise Refused("MERGE_PERMISSION_NIGHT")
        assignment = night.assignments.get(target)
        if not assignment or not assignment.get("cleanup"):
            raise Refused("CLEAN_ASSIGNMENT", target)
        if args.leader != assignment["leader"]:
            raise Refused("MERGE_LEADER_ONLY")
        cleanup = Cleanup(args, night, target, leader_events(args.dir, night, target), assignment)
        try:
            cleanup.active()
            cleanup.check_scope()
            if args.command_name == "record-temp":
                cleanup.add_temp()
            else:
                cleanup.clean(github, page_rows)
        except OSError as error:
            refusal = Refused("CLEAN_FILE", f"{cleanup.subject}: {error.strerror}")
            cleanup.refusal(refusal)
            raise refusal from None
        except Refused as refusal:
            if refusal.code not in ("WRITE_FAILED", "CLOSED"):
                cleanup.refusal(refusal)
            raise
    print(f"{args.command_name}: {target}")
