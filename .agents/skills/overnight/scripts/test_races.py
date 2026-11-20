"""Tests of night.py: two processes, the lock, a kill or a short write in the middle of a command.

Run all test files with `python3 -I run_tests.py`.
"""

import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # `-I` drops this folder
from night_testlib import Hooked, argv, at, code_of, env_for, intent_args, journal_bytes, run, started, words_file  # noqa: E402


class RaceTests(Hooked):
    def test_eight_writers_at_one_gate_lose_no_entry(self):
        started(self.dir)
        for _ in range(3):
            outcomes = self.gated(8, ["log", "alive", "writer"], at("22:10"))
            self.assertEqual([code for code, _ in outcomes], [0] * 8, outcomes)
        self.assertEqual([e["id"] for e in self.events()], list(range(1, 27)))

    def test_eight_intents_on_one_item_at_one_gate_give_one_intent(self):
        started(self.dir)
        for _ in range(3):
            outcomes = self.gated(8, intent_args("PR 1"), at("22:10"))
            self.assertEqual(sorted(code for code, _ in outcomes), [0] + [3] * 7, outcomes)
            self.assertEqual(sum(code_of(out) == ["OPEN_INTENT"] for _, out in outcomes), 7, outcomes)
            last = [e for e in self.events() if e["kind"] == "intent"][-1]["id"]
            self.ok(run(self.dir, "log", "result", "--of", str(last), "--outcome", "failed", at=at("22:10")))
        self.assertEqual(sum(1 for e in self.events() if e["kind"] == "intent"), 3)

    def plant_lock(self, text, age_s=0):
        lock = os.path.join(self.dir, "journal.lock")
        with open(lock, "w", encoding="utf-8") as handle:
            handle.write(text)
        if age_s:
            old = time.time() - age_s
            os.utime(lock, (old, old))
        return lock

    def test_a_held_or_stale_lock_is_named_and_never_removed(self):
        started(self.dir)
        fast = {"NIGHT_LOCK_WAIT_S": "0.3"}
        lock = self.plant_lock(str(os.getpid()))
        self.assertIn(f"process {os.getpid()}", self.refused("log", "alive", "x", at=at("22:10"), env=fast, code="LOCK_HELD"))
        with open(lock, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), str(os.getpid()), "a held lock must stay as it is")
        for text, age, shown in (("999999999", 0, "process 999999999 is not running"), ("0", 0, "no process id ('0')"),
                                 ("", 0, "no process id ('')"), (str(os.getpid()), 120, f"process {os.getpid()} has held it")):
            with self.subTest(lock=text, age=age):
                self.plant_lock(text, age)
                out = self.refused("log", "alive", "x", at=at("22:10"), env=fast, code="LOCK_STALE")
                self.assertIn(shown, out)
                self.assertIn(f"remove {lock} by hand", out)
                self.assertTrue(os.path.exists(lock))
        self.refused("check", at=at("22:10"), env=fast, code="LOCK_STALE")
        os.remove(lock)

    def test_a_waiter_that_is_stopped_leaves_the_lock_of_another_process(self):
        started(self.dir)
        lock = self.plant_lock(str(os.getpid()))
        proc = subprocess.Popen(argv(self.dir, "log", "alive", "x"), env=env_for(at("22:10"), extra={"NIGHT_LOCK_WAIT_S": "20"}),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(0.5)
        proc.send_signal(signal.SIGTERM)
        proc.communicate(timeout=30)
        self.assertTrue(os.path.exists(lock))
        os.remove(lock)
        self.assertEqual(len(self.events()), 2)

    def test_lock_holder_is_named_and_term_releases_and_kill_leaves_a_stale_lock(self):
        started(self.dir)
        lock = os.path.join(self.dir, "journal.lock")
        fast = {"NIGHT_LOCK_WAIT_S": "0.3"}
        marker, (holder,) = self.hooked("hold-fsync", ["log", "alive", "x"], at("22:10"))
        self.wait_markers(marker, "held")
        with open(lock, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), str(holder.pid))
        self.assertIn(f"process {holder.pid}", self.refused("log", "alive", "y", at=at("22:10"), env=fast, code="LOCK_HELD"))
        holder.send_signal(signal.SIGTERM)
        holder.communicate(timeout=30)
        self.assertFalse(os.path.exists(lock), "SIGTERM must release the lock of the holder")
        self.assertEqual(run(self.dir, "check", at=at("22:11"))[0], 0)
        marker, (holder,) = self.hooked("hold-fsync", ["log", "alive", "x"], at("22:12"))
        self.wait_markers(marker, "held")
        holder.kill()
        holder.communicate(timeout=30)
        out = self.refused("log", "alive", "y", at=at("22:12"), env=fast, code="LOCK_STALE")
        self.assertIn(f"process {holder.pid} is not running", out)
        self.assertTrue(os.path.exists(lock))
        os.remove(lock)

    def test_a_kill_between_report_and_its_file_preserves_uncertain_temp(self):
        started(self.dir)
        marker, (proc,) = self.hooked("hold-replace", ["report"], at("22:10"))
        self.wait_markers(marker, "held")
        proc.kill()
        proc.communicate(timeout=30)
        self.assertEqual(self.events()[-1]["kind"], "report")
        os.remove(os.path.join(self.dir, "journal.lock"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["REPORT_FILE"]), out)
        self.ok(run(self.dir, "render", at=at("22:11")))
        self.assertEqual(len([n for n in os.listdir(self.dir) if n.startswith(".report.md.")]), 1)
        self.assertTrue(os.path.isfile(os.path.join(self.dir, "night.flock")))
        self.assertEqual(run(self.dir, "check", at=at("22:11"))[0], 0)

    def test_an_empty_lock_that_goes_away_during_the_wait_is_not_stale(self):
        started(self.dir)
        lock = self.plant_lock("")
        proc = subprocess.Popen(argv(self.dir, "log", "alive", "x"), env=env_for(at("22:10")), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True)
        time.sleep(0.6)
        os.remove(lock)
        out, err = proc.communicate(timeout=30)
        self.assertEqual(proc.returncode, 0, out + err)

    def test_the_time_of_an_entry_is_read_after_the_wait_for_the_lock(self):
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), fake=False))
        lock = self.plant_lock(str(os.getpid()))
        proc = subprocess.Popen(argv(self.dir, "log", "aware", "x"), env=env_for(fake=False, extra={"NIGHT_LOCK_WAIT_S": "20"}),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        time.sleep(2.5)
        released = time.time()
        os.remove(lock)
        out, err = proc.communicate(timeout=30)
        self.assertEqual(proc.returncode, 0, out + err)
        written = datetime.fromisoformat(self.events()[-1]["t"]).timestamp()
        self.assertGreaterEqual(written, released - 1, "the entry has a time from before the wait for the lock")

    def test_outside_test_mode_the_lock_wait_is_the_default(self):
        """A project cannot make the lock wait shorter or a lock stale sooner: the times come from night.py."""
        self.ok(run(self.dir, "new", "--words-file", words_file(self.dir, "w"), test_mode=False, fake=False))
        lock = self.plant_lock(str(os.getpid()))
        start = time.monotonic()
        code, out = run(self.dir, "log", "aware", "x", env={"NIGHT_LOCK_WAIT_S": "0.1", "NIGHT_LOCK_STALE_S": "0"},
                        test_mode=False, fake=False)
        self.assertEqual((code, code_of(out)), (3, ["LOCK_HELD"]), out)
        self.assertGreaterEqual(time.monotonic() - start, 5)
        os.remove(lock)

    def test_each_reader_takes_the_lock(self):
        started(self.dir)
        self.ok(run(self.dir, "report", at=at("22:05")))
        lock = self.plant_lock("999999999")
        for command in (["status"], ["check"], ["render"], ["report"], ["repair"]):
            with self.subTest(command=command):
                self.refused(*command, at=at("22:10"), env={"NIGHT_LOCK_WAIT_S": "0.2"}, code="LOCK_STALE")
        os.remove(lock)


class CrashTests(Hooked):
    """Findings of the consultant review of b315b63 (P2-3, P2-4)."""

    def test_a_short_write_of_the_journal_is_finished_or_refused(self):
        started(self.dir)
        marker, (proc,) = self.hooked("short-write", ["log", "alive", "x"], at("22:10"))
        out, err = proc.communicate(timeout=60)
        self.wait_markers(marker, "short")
        self.assertEqual(proc.returncode, 0, out + err)
        self.assertEqual([e["kind"] for e in self.events()][-1], "alive")

    def test_a_refused_repair_leaves_the_journal_as_it_was(self):
        self.hand_edit = True
        started(self.dir)
        self.ok(run(self.dir, "log", "alive", "x", at=at("22:10")))
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 4, "t"')
        before = journal_bytes(self.dir)
        code, out = run(self.dir, "repair", at=at("22:05"))  # no parity copy: the event is judged on the cut journal
        self.assertEqual((code, code_of(out)), (3, ["TIME_BACK"]), out)
        self.assertEqual(journal_bytes(self.dir), before, "a refused repair changed the journal")
        self.assertEqual([f for f in os.listdir(self.dir) if f.startswith("journal.cut-")], [])
        self.ok(run(self.dir, "repair", at=at("22:11")))
        self.assertEqual(self.events()[-1]["kind"], "repair")
        self.assertEqual(run(self.dir, "check", at=at("22:12"))[0], 0)

    def test_a_crash_after_the_repair_cut_is_found_and_recorded(self):
        started(self.dir)
        with open(os.path.join(self.dir, "journal.jsonl"), "a", encoding="utf-8") as handle:
            handle.write('{"id": 3, "t"')
        marker, (proc,) = self.hooked("die-after-truncate", ["repair"], at("22:10"))
        proc.communicate(timeout=60)
        self.wait_markers(marker, "cut")
        os.remove(os.path.join(self.dir, "journal.lock"))
        code, out = run(self.dir, "check", at=at("22:11"))
        self.assertEqual((code, code_of(out)), (1, ["CUT_UNRECORDED"]), out)
        self.ok(run(self.dir, "repair", at=at("22:11")))
        self.assertEqual(self.events()[-1]["cut_file"], "journal.cut-1.txt")
        self.assertEqual(run(self.dir, "check", at=at("22:12"))[0], 0)
