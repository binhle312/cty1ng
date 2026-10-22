import time


async def _session(store, role="ba", channel="discord:1", thread="discord:10"):
    return await store.get_or_create_session(role, channel, thread)


async def test_redelivered_event_is_ignored(store):
    s = await _session(store)
    first = await store.record_event_and_enqueue("m1:ba", s.session_key, "discord:111", "hi")
    second = await store.record_event_and_enqueue("m1:ba", s.session_key, "discord:111", "hi")
    assert first is not None and second is None
    job = await store.claim_next_job()
    assert job.job_id == first
    assert await store.claim_next_job() is None


async def test_jobs_in_one_session_run_in_order(store):
    s = await _session(store)
    j1 = await store.record_event_and_enqueue("m1", s.session_key, "discord:111", "one")
    j2 = await store.record_event_and_enqueue("m2", s.session_key, "discord:111", "two")
    assert (await store.claim_next_job()).job_id == j1
    assert await store.claim_next_job() is None  # j2 waits for j1
    await store.complete_job(j1)
    assert (await store.claim_next_job()).job_id == j2


async def test_different_sessions_run_in_parallel(store):
    a = await _session(store, "ba", "discord:1", "discord:10")
    b = await _session(store, "ba", "discord:2", "discord:20")  # same bot, another project
    ja = await store.record_event_and_enqueue("ma", a.session_key, "discord:111", "a")
    jb = await store.record_event_and_enqueue("mb", b.session_key, "discord:111", "b")
    claimed = {(await store.claim_next_job()).job_id, (await store.claim_next_job()).job_id}
    assert claimed == {ja, jb}


async def test_expired_lease_is_reclaimed_then_failed_after_max_attempts(store):
    s = await _session(store)
    j = await store.record_event_and_enqueue("m1", s.session_key, "discord:111", "x")
    now = time.time()
    for attempt in range(1, 4):
        job = await store.claim_next_job(now=now)
        assert job.job_id == j and job.attempts == attempt
        now += store.lease_seconds + 1  # the worker "died"; the lease runs out
    assert await store.claim_next_job(now=now) is None
    assert await store.job_status(j) == "failed"


async def test_failed_job_retries_until_limit(store):
    s = await _session(store)
    j = await store.record_event_and_enqueue("m1", s.session_key, "discord:111", "x")
    for _ in range(2):
        await store.claim_next_job()
        assert await store.fail_job(j, "boom") is True
    await store.claim_next_job()
    assert await store.fail_job(j, "boom") is False
    assert await store.job_status(j) == "failed"


async def test_history_is_appended_with_job_completion(store):
    s = await _session(store)
    j = await store.record_event_and_enqueue("m1", s.session_key, "discord:111", "x")
    await store.claim_next_job()
    await store.complete_job_with_history(j, s.session_key, b"[1]")
    await store.complete_job_with_history(j, s.session_key, b"[1]")  # retry after a crash: no duplicate
    assert await store.load_history(s.session_key) == [b"[1]"]
    assert await store.job_status(j) == "done"


async def test_new_proposal_makes_older_pending_one_stale(store):
    kwargs = dict(channel_id="discord:1", thread_id="discord:10", from_role="ba", to_role="designer",
                  files=["docs/stories.md"], summary="s", commit_sha="abc", created_by_job=None)
    old = await store.create_handoff(**kwargs)
    new = await store.create_handoff(**kwargs)
    assert (await store.get_handoff(old)).status == "stale"
    assert (await store.get_handoff(new)).status == "pending"
