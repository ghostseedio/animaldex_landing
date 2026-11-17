import assert from "node:assert/strict";
import test from "node:test";
import {
    DISCOVER_SESSION_CLOCK_MARGIN_MS,
    RANKED_MISSING,
    appendRenewedRankedPage,
    callRankedFeedWithOneRetry,
    isRankedFeedFunctionMissing,
    planRankedPage,
    composeRankedTimeline,
    discoverRankedFeedArgs,
    newDiscoverSessionAsOf,
    parseDiscoverSessionAsOf,
    rankedFeedHasMore
} from "@/lib/discover-ranked-feed";

const NOW = Date.parse("2026-11-17T14:00:00.000Z");
const CURSOR = "33333333-3333-3333-3333-000000000007";

test("a new session starts a few seconds in the past and doubles as the seed", () => {
    const asOf = newDiscoverSessionAsOf(NOW);
    assert.equal(asOf, "2026-11-17T13:59:55.000Z");
    assert.equal(Date.parse(asOf), NOW - DISCOVER_SESSION_CLOCK_MARGIN_MS);
    const args = discoverRankedFeedArgs({asOf, limit: 24});
    assert.equal(args.p_seed, asOf);
    assert.equal(args.p_as_of, asOf);
    assert.equal(args.p_scope, "recommended");
    assert.equal("p_after_capture_id" in args, false, "the first page has no cursor");
});

test("every page of a session sends the same session and the cursor", () => {
    const asOf = newDiscoverSessionAsOf(NOW);
    const first = discoverRankedFeedArgs({asOf, limit: 8});
    const next = discoverRankedFeedArgs({asOf, limit: 8, afterCaptureId: CURSOR});
    assert.equal(next.p_as_of, first.p_as_of);
    assert.equal(next.p_seed, first.p_seed);
    assert.equal(next.p_after_capture_id, CURSOR);
});

test("the page size is clamped to what the server accepts", () => {
    assert.equal(discoverRankedFeedArgs({asOf: "x", limit: 500}).p_limit, 80);
    assert.equal(discoverRankedFeedArgs({asOf: "x", limit: 0}).p_limit, 1);
});

test("a session read back from a request is a past ISO date, or nothing", () => {
    assert.equal(parseDiscoverSessionAsOf("2026-11-17T13:59:55.000Z", NOW), "2026-11-17T13:59:55.000Z");
    assert.equal(parseDiscoverSessionAsOf("2026-11-17T13:59:55Z", NOW), "2026-11-17T13:59:55.000Z");
    assert.equal(parseDiscoverSessionAsOf("not a date", NOW), null);
    assert.equal(parseDiscoverSessionAsOf("", NOW), null);
    assert.equal(parseDiscoverSessionAsOf(null, NOW), null);
    assert.equal(parseDiscoverSessionAsOf("2027-01-01T00:00:00Z", NOW), null, "a session in the future is refused");
});

test("a page shorter than asked for is the end of the feed; an empty one always is", () => {
    assert.equal(rankedFeedHasMore(8, 8), true);
    assert.equal(rankedFeedHasMore(7, 8), false);
    assert.equal(rankedFeedHasMore(0, 8), false);
});

const item = (id: string, date: string) => ({id, date});

test("activity cards are slotted between captures, newest first, and keep the server order of captures", () => {
    const captures = Array.from({length: 13}, (_, i) => item(`c${i}`, `2026-11-0${(i % 9) + 1}T00:00:00Z`));
    const activity = [item("old", "2026-10-01T00:00:00Z"), item("new", "2026-11-16T00:00:00Z"), item("mid", "2026-11-01T00:00:00Z")];
    const merged = composeRankedTimeline(captures, activity, {every: 6, feedEnded: false});
    assert.deepEqual(merged.filter((entry) => entry.id.startsWith("c")).map((entry) => entry.id), captures.map((entry) => entry.id));
    assert.deepEqual(merged.slice(0, 8).map((entry) => entry.id), ["c0", "c1", "c2", "c3", "c4", "c5", "new", "c6"]);
    assert.equal(merged.filter((entry) => !entry.id.startsWith("c")).length, 2, "two slots for 13 captures; the third card waits");
});

test("leftover activity is shown only once the feed has ended", () => {
    const captures = [item("c0", "2026-11-01T00:00:00Z"), item("c1", "2026-11-01T00:00:00Z")];
    const activity = [item("a", "2026-11-16T00:00:00Z")];
    assert.deepEqual(composeRankedTimeline(captures, activity, {feedEnded: false}).map((entry) => entry.id), ["c0", "c1"]);
    assert.deepEqual(composeRankedTimeline(captures, activity, {feedEnded: true}).map((entry) => entry.id), ["c0", "c1", "a"]);
    assert.deepEqual(composeRankedTimeline([], activity, {feedEnded: false}).map((entry) => entry.id), ["a"], "no captures at all: the activity is the feed");
});

test("only a missing function is a reason to use the shipped feed", () => {
    assert.equal(isRankedFeedFunctionMissing({code: "PGRST202", message: "x"}), true);
    assert.equal(isRankedFeedFunctionMissing({status: 404}), true);
    assert.equal(isRankedFeedFunctionMissing({message: "Could not find the function public.discover_feed_ranked_v1(...)"}), true);
    assert.equal(isRankedFeedFunctionMissing({code: "57014", message: "canceling statement due to statement timeout"}), false);
    assert.equal(isRankedFeedFunctionMissing({status: 500}), false);
    assert.equal(isRankedFeedFunctionMissing(null), false);
});

test("a ranked call: a missing function is reported, other errors are retried once and then thrown", async () => {
    let calls = 0;
    assert.equal(await callRankedFeedWithOneRetry(async () => {
        calls += 1;
        return {data: null, error: {code: "PGRST202", message: "missing"}};
    }, {retryDelayMs: 0}), RANKED_MISSING);
    assert.equal(calls, 1, "a missing function is not retried");

    calls = 0;
    const healed = await callRankedFeedWithOneRetry(async () => {
        calls += 1;
        return calls === 1 ? {data: null, error: {code: "57014", message: "timeout"}} : {data: [1, 2, 3], error: null};
    }, {retryDelayMs: 0});
    assert.deepEqual(healed, [1, 2, 3]);
    assert.equal(calls, 2);

    calls = 0;
    await assert.rejects(callRankedFeedWithOneRetry(async () => {
        calls += 1;
        return {data: null, error: {code: "XX000", message: "boom"}};
    }, {retryDelayMs: 0}), /boom/);
    assert.equal(calls, 2, "tried once more, then the error: the shipped feed is not used");
});

test("a cursor continues its session only with both the last capture and the session; otherwise a new session starts", () => {
    const now = NOW;
    const continued = planRankedPage({afterCaptureId: CURSOR, asOf: "2026-11-17T13:59:00.000Z"}, now);
    assert.deepEqual(continued, {asOf: "2026-11-17T13:59:00.000Z", afterCaptureId: CURSOR, startsSession: false});
    for (const cursor of [null, {afterCaptureId: CURSOR}, {afterCaptureId: CURSOR, asOf: "garbage"}, {asOf: "2026-11-17T13:59:00.000Z"}, {afterCaptureId: null, asOf: null}]) {
        const plan = planRankedPage(cursor, now);
        assert.equal(plan.startsSession, true);
        assert.equal(plan.afterCaptureId, null, "no cursor call without a session");
        assert.equal(plan.asOf, newDiscoverSessionAsOf(now));
    }
});

test("an exhausted session starts one new session and appends its page; the feed ends when that is empty or short", () => {
    const id = (row: {id: string}) => row.id;
    const first = [{id: "a"}, {id: "b"}];
    const renewed = Array.from({length: 8}, (_, i) => ({id: i === 0 ? "b" : `n${i}`}));
    const merged = appendRenewedRankedPage(first, renewed, 8, id);
    assert.deepEqual(merged.rows.map(id), ["a", "b", "n1", "n2", "n3", "n4", "n5", "n6", "n7"], "rows already on the page are not repeated");
    assert.equal(merged.hasMore, true, "the new session has a full page: the feed goes on");
    assert.equal(appendRenewedRankedPage(first, [], 8, id).hasMore, false, "a new session with nothing ends the feed");
    assert.deepEqual(appendRenewedRankedPage(first, [], 8, id).rows.map(id), ["a", "b"]);
});
