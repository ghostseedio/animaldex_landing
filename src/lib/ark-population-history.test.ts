import assert from "node:assert/strict";
import test from "node:test";
import {arkCompactHistory, arkKindSeries, arkLinePath, arkPeriodStart, arkRankByChange, arkSeriesSlice, arkSeriesStats, arkStatsChangeText, arkDayAt, ARK_DAY_MS, decodeArkHistory, readArkHistory} from "@/lib/ark-population-history";

// A small record in the server's shape (test data only): t0 = 00:00, hour steps, read at 05:30.
const H = 3_600_000;
const T0 = Date.parse("2026-11-16T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
function server(extra: Record<string, unknown> = {}) {
    return {
        available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(T0), since: iso(T0), as_of: iso(T0 + 5.5 * H), first_at: iso(T0 - 48 * H), started_at: iso(T0 - 48 * H),
        // zebra: 4 wild + 1 town at t0; lynx 1 wild; dog none
        base: [["zebra", 0, 4], ["zebra", 1, 1], ["lynx", 0, 1]],
        steps: [
            ["zebra", 0, 1, 0, 2, 0, 0, 0], // two born in step 1
            ["zebra", 0, 3, 0, 0, 0, 1, 1], // one died, one eaten in step 3
            ["lynx", 0, 4, 0, 0, 0, 1, 0], // the last lynx died in step 4
            ["dog", 1, 2, 3, 0, 0, 0, 0], // three dogs arrived on town in step 2
            ["zebra", 1, 5, 0, 0, 1, 0, 0] // a town zebra back from recovery in the partial step 5
        ],
        gone: {lynx: {name: "Eurasian Lynx", model_slug: "eurasian_lynx"}},
        ...extra
    };
}
const decoded = () => decodeArkHistory(arkCompactHistory(server()))!;

test("the route's compaction names kinds once and decodes back", () => {
    const compact = arkCompactHistory(server());
    assert.deepEqual(compact.kinds, ["zebra", "lynx", "dog"]);
    assert.deepEqual((compact.steps as unknown[][])[0], [0, 0, 1, 0, 2, 0, 0, 0]);
    const history = decoded();
    assert.equal(history.steps, 6, "05:30 is in the sixth hour");
    assert.equal(history.kinds.size, 3);
    assert.equal(history.gone.get("lynx")?.slug, "eurasian_lynx");
});

test("nothing drawn without the server's answer", () => {
    assert.equal(decodeArkHistory({available: false}), null);
    assert.equal(decodeArkHistory(null), null);
    assert.equal(decodeArkHistory({...arkCompactHistory(server()), bucket: "minute"}), null);
    assert.equal(decodeArkHistory({...arkCompactHistory(server()), as_of: iso(T0 - H)}), null);
});

test("a series is the count at t0 plus every step, per island", () => {
    const history = decoded();
    const both = arkKindSeries(history, "zebra", "both");
    assert.deepEqual(both.counts, [5, 5, 7, 7, 5, 5, 6]);
    assert.deepEqual(arkKindSeries(history, "zebra", "wild").counts, [4, 4, 6, 6, 4, 4, 4]);
    assert.deepEqual(arkKindSeries(history, "zebra", "town").counts, [1, 1, 1, 1, 1, 1, 2]);
    assert.equal(both.times.at(-1), T0 + 5.5 * H, "the last point is now, not the step's end");
    assert.deepEqual(arkKindSeries(history, "lynx", "both").counts, [1, 1, 1, 1, 1, 0, 0], "extinct: the line ends at 0");
    assert.deepEqual(arkKindSeries(history, "nobody", "both").counts, [0, 0, 0, 0, 0, 0, 0]);
});

test("a gap is the same count, never a guess", () => {
    const history = decoded();
    const dog = arkKindSeries(history, "dog", "both");
    assert.deepEqual(dog.counts, [0, 0, 0, 3, 3, 3, 3]);
});

test("periods start where the record starts, at most", () => {
    const history = decoded();
    assert.equal(arkPeriodStart(history, "all"), 0);
    assert.equal(arkPeriodStart(history, "24h"), 0, "the answer starts later than 24 hours back");
    const late = decodeArkHistory(arkCompactHistory(server({as_of: iso(T0 + 30 * H)})))!;
    assert.equal(arkPeriodStart(late, "24h"), 6, "24 h back from 30:00 is 06:00");
    const young = decodeArkHistory(arkCompactHistory(server({first_at: iso(T0 + 2 * H)})))!;
    assert.equal(arkPeriodStart(young, "7d"), 2, "no line before the first row");
});

test("change, percent, peak, low and what happened in the period", () => {
    const history = decoded();
    const stats = arkSeriesStats(arkSeriesSlice(arkKindSeries(history, "zebra", "both"), 0));
    assert.equal(stats.start, 5);
    assert.equal(stats.now, 6);
    assert.equal(stats.delta, 1);
    assert.equal(stats.ratio, 0.2);
    assert.equal(stats.peak, 7);
    assert.equal(stats.low, 5);
    assert.deepEqual([stats.arrived, stats.born, stats.revived, stats.died, stats.eaten], [0, 2, 1, 1, 1]);
    assert.deepEqual(arkStatsChangeText(stats, "en"), {count: "+1", percent: "+20%", up: true});
    const later = arkSeriesStats(arkSeriesSlice(arkKindSeries(history, "zebra", "both"), 3));
    assert.equal(later.start, 7);
    assert.equal(later.born, 0, "a step before the period's first point is not in it");
    const dog = arkSeriesStats(arkKindSeries(history, "dog", "both"));
    assert.equal(dog.ratio, null);
    assert.deepEqual(arkStatsChangeText(dog, "en"), {count: "+3", percent: null, up: true});
    const lynx = arkSeriesStats(arkKindSeries(history, "lynx", "both"));
    assert.equal(lynx.goneNow, true);
    assert.deepEqual(arkStatsChangeText(lynx, "en"), {count: "−1", percent: "−100%", up: false});
    assert.deepEqual(arkStatsChangeText({delta: 0, ratio: 0}, "en"), {count: "0", percent: "0%", up: null});
});

test("thriving and declining", () => {
    const history = decoded();
    assert.deepEqual(arkRankByChange(history, "both", "all", "up").map((row) => row.key), ["dog", "zebra"]);
    assert.deepEqual(arkRankByChange(history, "both", "all", "down").map((row) => row.key), ["lynx"]);
    assert.deepEqual(arkRankByChange(history, "wild", "all", "up").map((row) => row.key), []);
    assert.deepEqual(arkRankByChange(history, "both", "all", "up", ["zebra"]).map((row) => row.key), ["zebra"], "only the panel's rows");
    assert.deepEqual(arkRankByChange(history, "both", "all", "down", ["zebra"]).map((row) => row.key), ["lynx"], "and the kinds that died out");
});

test("a line: steps, one point, flat, from zero", () => {
    const line = arkLinePath([1, 1, 3, 2], 100, 20, {pad: 0});
    assert.equal(line.d, "M0 20H66.7V0H100V10");
    assert.ok(line.area.endsWith("V20H0Z"));
    assert.equal(arkLinePath([4], 10, 10, {pad: 0}).d, "M0 5H10", "one point draws flat across");
    assert.equal(arkLinePath([2, 2], 10, 10, {pad: 0}).d, "M0 5H10", "flat sits in the middle");
    assert.equal(arkLinePath([2, 4], 10, 10, {pad: 0, fromZero: true}).points[0][1], 5);
    assert.equal(arkLinePath([], 10, 10).points.length, 2);
});

test("Ark days", () => {
    const start = Date.parse("2026-11-08T21:45:21Z");
    assert.equal(arkDayAt(start + 10 * ARK_DAY_MS + 1, start), 10);
    assert.equal(arkDayAt(start, null), null);
    assert.ok(Math.abs(ARK_DAY_MS / 60_000 - 55.23) < 0.01, "an Ark day is about 55 real minutes");
});

test("the read: feature-detected and kept", async () => {
    let calls = 0;
    const ok = (body: unknown) => async () => {
        calls++;
        return {ok: true, json: async () => body};
    };
    assert.equal(await readArkHistory("/a", "week", ok({available: false}), 1), null);
    assert.equal(await readArkHistory("/a", "week", ok({available: false}), 2), null);
    assert.equal(calls, 1, "kept for five minutes");
    assert.ok(await readArkHistory("/b", "all", ok(arkCompactHistory(server())), 1));
    assert.equal(await readArkHistory("/c", "all", async () => { throw new Error("offline"); }, 1), null);
    assert.equal(await readArkHistory("/d", "all", async () => ({ok: false, json: async () => ({})}), 1), null);
});
