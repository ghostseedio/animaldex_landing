import assert from "node:assert/strict";
import test from "node:test";
import {
    DISCOVER_SESSION_CLOCK_MARGIN_MS,
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
