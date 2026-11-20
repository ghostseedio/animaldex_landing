import assert from "node:assert/strict";
import test from "node:test";
import {arkCompactHistory, arkGraphDate, arkGraphWhen, arkKindSeries, arkLocalDayStart, arkPopulationRead, arkRebucketDays, arkLinePath, arkPeriodStart, arkRankByChange, arkSeriesSlice, arkSeriesStats, arkStatsChangeText, arkDayAt, ARK_DAY_MS, decodeArkHistory, readArkHistory} from "@/lib/ark-population-history";

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

// MARK: The viewer's days

const D = 86_400_000;
const at = (text: string) => Date.parse(text);

/** The server's hourly answer for a list of events (+1 arrivals, −1 deaths) of one kind on the wild island, as it would count them. */
function hourly(events: Array<{at: number; delta: 1 | -1}>, window: {t0: number; asOf: number; firstAt: number; base?: number}, zone = "UTC") {
    const steps = new Map<number, {arrived: number; died: number}>();
    let base = window.base ?? 0;
    for (const event of events) {
        if (event.at > window.asOf) continue;
        if (event.at < window.t0) {
            base += event.delta;
            continue;
        }
        const step = Math.floor((event.at - window.t0) / H);
        const row = steps.get(step) ?? {arrived: 0, died: 0};
        if (event.delta > 0) row.arrived++;
        else row.died++;
        steps.set(step, row);
    }
    return decodeArkHistory(arkCompactHistory({
        available: true, bucket: "hour", bucket_seconds: 3600, t0: iso(window.t0), since: iso(window.t0), as_of: iso(window.asOf), first_at: iso(window.firstAt), started_at: iso(window.firstAt),
        base: base ? [["zebra", 0, base]] : [],
        steps: Array.from(steps, ([step, row]) => ["zebra", 0, step, row.arrived, 0, 0, row.died, 0]),
        gone: {}
    }), zone)!;
}

test("a local midnight is where the zone says: whole hours, half hours, a clock change, a skipped midnight", () => {
    assert.equal(arkLocalDayStart(at("2026-11-19T20:00:00Z"), "Asia/Jakarta"), at("2026-11-19T17:00:00Z"), "Jakarta is UTC+7: 03:00 on the 20th is the 20th's day, begun at 17:00Z on the 19th");
    assert.equal(arkLocalDayStart(at("2026-11-19T16:59:59Z"), "Asia/Jakarta"), at("2026-11-18T17:00:00Z"));
    assert.equal(arkLocalDayStart(at("2026-11-20T05:00:00Z"), "America/Los_Angeles"), at("2026-11-19T08:00:00Z"), "Los Angeles is UTC−8 in November");
    assert.equal(arkLocalDayStart(at("2026-11-19T20:00:00Z"), "Asia/Kolkata"), at("2026-11-19T18:30:00Z"), "UTC+5:30");
    assert.equal(arkLocalDayStart(at("2026-11-19T20:00:00Z"), "Asia/Kathmandu"), at("2026-11-19T18:15:00Z"), "UTC+5:45");
    assert.equal(arkLocalDayStart(at("2026-11-19T20:00:00Z"), "UTC"), at("2026-11-19T00:00:00Z"));
    // A clock change inside the day: Los Angeles went back an hour at 09:00Z on 1 November, so that day is 25 hours long.
    assert.equal(arkLocalDayStart(at("2026-11-01T12:00:00Z"), "America/Los_Angeles"), at("2026-11-01T07:00:00Z"));
    assert.equal(arkLocalDayStart(at("2026-11-02T12:00:00Z"), "America/Los_Angeles"), at("2026-11-02T08:00:00Z"));
    // Havana's clock jumps from 00:00 to 01:00 on 8 March: the day begins at the first moment it has.
    assert.equal(arkLocalDayStart(at("2026-03-08T12:00:00Z"), "America/Havana"), at("2026-03-08T05:00:00Z"));
    // A made-up zone reads as UTC rather than throwing.
    assert.equal(arkLocalDayStart(at("2026-11-19T20:00:00Z"), "Mars/Olympus"), at("2026-11-19T00:00:00Z"));
});

test("hours into the viewer's days: a row goes to the day in which its hour ended", () => {
    const events = [{at: at("2026-11-10T16:30:00Z"), delta: 1 as const}, {at: at("2026-11-10T17:10:00Z"), delta: 1 as const}, {at: at("2026-11-12T01:00:00Z"), delta: -1 as const}];
    const source = hourly(events, {t0: at("2026-11-10T00:00:00Z"), asOf: at("2026-11-13T09:30:00Z"), firstAt: at("2026-11-10T03:00:00Z")}, "Asia/Jakarta");
    const jakarta = arkRebucketDays(source, "Asia/Jakarta");
    assert.equal(jakarta.bucket, "day");
    assert.equal(jakarta.zone, "Asia/Jakarta");
    assert.deepEqual(jakarta.edges, ["2026-11-09T17:00:00Z", "2026-11-10T17:00:00Z", "2026-11-11T17:00:00Z", "2026-11-12T17:00:00Z", "2026-11-13T17:00:00Z"].map(at), "local midnights, the first at or before the record's start");
    // 23:30 on the 10th is the 10th (counted by the evening's close), 00:10 on the 11th is the next day.
    const series = arkKindSeries(jakarta, "zebra", "both");
    assert.deepEqual(series.counts, [0, 1, 2, 1, 1]);
    assert.deepEqual(series.times, [...jakarta.edges!.slice(0, 4), at("2026-11-13T09:30:00Z")], "the last point is now");
    // The same events in UTC days: both arrivals are the 10th's.
    assert.deepEqual(arkKindSeries(arkRebucketDays(source, "UTC"), "zebra", "both").counts, [0, 2, 2, 1, 1]);
});

test("Los Angeles days run 08:00Z to 08:00Z in November, and the axis names its own dates", () => {
    const events = [{at: at("2026-11-11T07:30:00Z"), delta: 1 as const}, {at: at("2026-11-11T08:10:00Z"), delta: 1 as const}];
    const source = hourly(events, {t0: at("2026-11-10T00:00:00Z"), asOf: at("2026-11-12T20:00:00Z"), firstAt: at("2026-11-11T07:30:00Z")}, "America/Los_Angeles");
    const la = arkRebucketDays(source, "America/Los_Angeles");
    assert.deepEqual(la.edges, ["2026-11-09T08:00:00Z", "2026-11-10T08:00:00Z", "2026-11-11T08:00:00Z", "2026-11-12T08:00:00Z", "2026-11-13T08:00:00Z"].map(at));
    // 23:30 on the 10th is the 10th: the day that ended at 08:00Z on the 11th; 00:10 on the 11th is the 11th.
    assert.deepEqual(arkKindSeries(la, "zebra", "both").counts, [0, 0, 1, 2, 2]);
    // The label of the edge that begins the 11th: the 11th, where Jakarta (UTC+7) calls the same instant the 11th at 15:00.
    assert.equal(arkGraphWhen(at("2026-11-11T08:00:00Z"), "en", la), "Nov 11");
    assert.equal(arkGraphWhen(at("2026-11-11T08:00:00Z"), "en", {bucket: "day", zone: "UTC"}), "Nov 11");
    assert.equal(arkGraphWhen(at("2026-11-11T05:00:00Z"), "en", la), "Nov 10", "UTC's 05:00 on the 11th is still the 10th in Los Angeles: UTC's date there would be wrong");
    assert.equal(arkGraphWhen(at("2026-11-11T20:00:00Z"), "en", {bucket: "day", zone: "Asia/Jakarta"}), "Nov 12", "03:00 on the 12th in Jakarta");
    assert.equal(arkGraphDate(at("2026-11-11T05:00:00Z"), "en", la), "Nov 10");
    assert.match(arkGraphWhen(at("2026-11-11T20:00:00Z"), "en", {bucket: "hour", zone: "Asia/Jakarta"}), /3:00\s?AM/, "an hour step reads the zone's clock");
    assert.match(arkGraphWhen(at("2026-11-11T20:00:00Z"), "en", {bucket: "hour", zone: "America/Los_Angeles"}), /12:00\s?PM/);
});

test("no look-ahead: a day's closing count never holds a row from after the day ended", () => {
    // A tiny deterministic generator: 400 arrivals and, for a quarter of them, a later death, over eight days.
    let seed = 7;
    const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
    const t0 = at("2026-11-10T00:00:00Z");
    const asOf = at("2026-11-18T13:47:00Z");
    const arrivals: Array<{at: number; delta: 1 | -1}> = [];
    for (let i = 0; i < 400; i++) arrivals.push({at: Math.min(t0 + 3_600_000 + Math.floor(next() * (asOf - t0 - 3_660_000)), asOf), delta: 1});
    arrivals.sort((a, b) => a.at - b.at);
    const withDeaths = arrivals.flatMap((event) => (next() < 0.25 ? [event, {at: Math.min(event.at + Math.floor(next() * 5 * D), asOf), delta: -1 as const}] : [event]));
    const truth = (events: Array<{at: number; delta: 1 | -1}>, instant: number) => events.filter((event) => event.at <= instant).reduce((sum, event) => sum + event.delta, 0);
    const window = {t0, asOf, firstAt: arrivals[0].at};
    const onTheHour = new Set(["UTC", "Asia/Jakarta", "America/Los_Angeles", "Europe/Berlin", "Pacific/Kiritimati"]);
    for (const zone of [...Array.from(onTheHour), "Asia/Kolkata", "Asia/Kathmandu", "Pacific/Chatham", "Australia/Lord_Howe"]) {
        const edges = arkRebucketDays(hourly(withDeaths, window), zone).edges!;
        for (let i = 0; i < edges.length - 1; i++) assert.ok(edges[i + 1] > edges[i], `${zone}: edges ascend`);
        const counts = arkKindSeries(arkRebucketDays(hourly(withDeaths, window), zone), "zebra", "both").counts;
        const arrivalCounts = arkKindSeries(arkRebucketDays(hourly(arrivals, window), zone), "zebra", "both").counts;
        assert.equal(counts.length, edges.length, zone);
        edges.forEach((edge, i) => {
            if (i === edges.length - 1) {
                assert.equal(counts[i], truth(withDeaths, asOf), `${zone}: the last point is now, with every row`);
                return;
            }
            // The count at a midnight is the count at the last hour edge at or before it (the exact one, where it falls on the hour).
            const lastHour = t0 + Math.floor((edge - t0) / H) * H;
            if (edge >= t0) {
                assert.equal(counts[i], truth(withDeaths, lastHour), `${zone} edge ${i}`);
                // Arrivals only never go down: so what is drawn is no more than had happened by the midnight (not early), and no less than an hour before it.
                assert.ok(arrivalCounts[i] <= truth(arrivals, edge), `${zone} edge ${i}: nothing from after the midnight`);
                assert.ok(arrivalCounts[i] >= truth(arrivals, edge - H), `${zone} edge ${i}: at most an hour late`);
                if (onTheHour.has(zone)) assert.equal(counts[i], truth(withDeaths, edge), `${zone} edge ${i}: exact on the hour`);
            }
        });
    }
});

test("half-hour zones count the straddling hour in the next day, never the day before", () => {
    // Kolkata's midnight is 18:30Z. The hour 18:00–19:00Z holds an arrival at 18:10Z (23:40) and one at 18:40Z (00:10).
    const events = [{at: at("2026-11-10T18:10:00Z"), delta: 1 as const}, {at: at("2026-11-10T18:40:00Z"), delta: 1 as const}];
    const source = hourly(events, {t0: at("2026-11-10T00:00:00Z"), asOf: at("2026-11-12T00:00:00Z"), firstAt: at("2026-11-10T18:10:00Z")}, "Asia/Kolkata");
    const days = arkRebucketDays(source, "Asia/Kolkata");
    assert.deepEqual(days.edges!.slice(0, 3), ["2026-11-09T18:30:00Z", "2026-11-10T18:30:00Z", "2026-11-11T18:30:00Z"].map(at));
    const counts = arkKindSeries(days, "zebra", "both").counts;
    assert.deepEqual(counts.slice(0, 3), [0, 0, 2], "the 10th closes at 18:30Z before either row is counted (the 18:40 one is after it; the 18:10 one is late)");
});

test("a window cut at its start keeps the count at the first midnight: the base plus what ended before it", () => {
    // The 31-day answer starts mid-day (t0 = 05:00Z on the 10th, 5 aboard); Jakarta's first midnight in it is 17:00Z that day.
    const events = [{at: at("2026-11-10T09:00:00Z"), delta: 1 as const}, {at: at("2026-11-10T17:20:00Z"), delta: -1 as const}, {at: at("2026-11-11T01:00:00Z"), delta: 1 as const}];
    const source = hourly(events, {t0: at("2026-11-10T05:00:00Z"), asOf: at("2026-11-11T12:00:00Z"), firstAt: at("2026-11-01T00:00:00Z"), base: 5}, "Asia/Jakarta");
    const days = arkRebucketDays(source, "Asia/Jakarta");
    assert.equal(days.edges![0], at("2026-11-10T17:00:00Z"));
    assert.deepEqual(arkKindSeries(days, "zebra", "both").counts, [6, 6], "6 at the first midnight (5 + the 09:00 arrival); the 17:20 death and 01:00 arrival come after it");
    // The last day is today's, still going: its closing point is now, with every row in it.
    assert.equal(days.steps, 1);
    assert.equal(arkKindSeries(days, "zebra", "both").counts.at(-1), 6);
});

test("a clock change makes a 25-hour day, and the series carries on", () => {
    const events = [{at: at("2026-11-01T08:30:00Z"), delta: 1 as const}, {at: at("2026-11-02T07:30:00Z"), delta: 1 as const}, {at: at("2026-11-02T08:30:00Z"), delta: 1 as const}];
    const source = hourly(events, {t0: at("2026-10-31T00:00:00Z"), asOf: at("2026-11-03T12:00:00Z"), firstAt: at("2026-10-31T00:00:00Z")}, "America/Los_Angeles");
    const days = arkRebucketDays(source, "America/Los_Angeles");
    assert.deepEqual(days.edges, ["2026-10-30T07:00:00Z", "2026-10-31T07:00:00Z", "2026-11-01T07:00:00Z", "2026-11-02T08:00:00Z", "2026-11-03T08:00:00Z", "2026-11-04T08:00:00Z"].map(at), "the 1st is 25 hours: 07:00Z to 08:00Z the next day");
    assert.deepEqual(arkKindSeries(days, "zebra", "both").counts, [0, 0, 0, 2, 3, 3], "07:30Z on the 2nd is still the 1st");
});

test("periods over local days start at the local midnight at or before the period", () => {
    const source = hourly([{at: at("2026-11-12T10:00:00Z"), delta: 1}], {t0: at("2026-11-01T00:00:00Z"), asOf: at("2026-11-20T10:00:00Z"), firstAt: at("2026-11-01T00:00:00Z")}, "Asia/Jakarta");
    const days = arkRebucketDays(source, "Asia/Jakarta");
    const start = arkPeriodStart(days, "30d");
    assert.equal(start, 0, "the record is younger than 30 days: from its first day");
    const long = arkRebucketDays(hourly([], {t0: at("2026-10-01T00:00:00Z"), asOf: at("2026-11-20T10:00:00Z"), firstAt: at("2026-10-01T00:00:00Z")}), "Asia/Jakarta");
    // 30 days before 10:00Z on 20 November is 10:00Z on the 21st of October: the day that began at 17:00Z on the 20th.
    assert.equal(long.edges![arkPeriodStart(long, "30d")], at("2026-10-20T17:00:00Z"));
    assert.equal(arkSeriesSlice(arkKindSeries(long, "zebra", "both"), arkPeriodStart(long, "30d")).times[0], at("2026-10-20T17:00:00Z"));
});

test("the read: 7 days by the hour; All is the 31 hourly days in the viewer's days while they reach the record, else the UTC days in them", async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
        week: arkCompactHistory({...server(), t0: iso(T0 - 6 * D), as_of: iso(T0 + 5.5 * H), first_at: iso(T0 - 48 * H)}),
        // The record starts inside the month's window: the hours cover it all.
        month: arkCompactHistory({...server(), as_of: iso(T0 + 5.5 * H)}),
        all: arkCompactHistory({...server(), bucket: "day", bucket_seconds: 86_400, as_of: iso(T0 + 5.5 * H)})
    };
    const fetcher = (url: string) => {
        asked.push(url.split("span=")[1]);
        return Promise.resolve({ok: true, json: async () => answers[url.split("span=")[1]]});
    };
    const week = await readArkHistory("/w", "week", fetcher, 1, "Asia/Jakarta");
    assert.deepEqual(asked, ["week"]);
    assert.equal(week?.bucket, "hour");
    assert.equal(week?.zone, "Asia/Jakarta");
    // Not covering: the month's first row (T0 − 48 h) is before its start (T0): fall back to the UTC days.
    const fell = await readArkHistory("/x", "all", fetcher, 1, "Asia/Jakarta");
    assert.deepEqual(asked.slice(1), ["month", "all"]);
    assert.equal(fell?.bucket, "day");
    assert.ok(fell?.edges, "put into local days");
    assert.equal(fell?.edges?.[0] !== undefined && (fell.edges[0] - at("2026-11-15T17:00:00Z")) % D, 0, "on Jakarta's midnights");
    // Covering: one read.
    answers.month = arkCompactHistory({...server({first_at: iso(T0 + H)}), as_of: iso(T0 + 5.5 * H)});
    const covered = await readArkHistory("/y", "all", fetcher, 1, "America/Los_Angeles");
    assert.deepEqual(asked.slice(3), ["month"]);
    assert.equal(covered?.zone, "America/Los_Angeles");
    assert.ok(covered?.edges);
    // Both answers decoded in one zone are kept apart from another's.
    const other = await readArkHistory("/y", "all", fetcher, 2, "Asia/Jakarta");
    assert.equal(other?.zone, "Asia/Jakarta");
    assert.equal(asked.length, 5, "a second zone asks again; the first is kept");
});

test("the route's spans: 7 days and 31 days by the hour, the whole record by the UTC day; nothing from the reader but the span", () => {
    const now = at("2026-11-20T10:25:00Z");
    assert.deepEqual(arkPopulationRead("week", now), {span: "week", bucket: "hour", since: "2026-11-13T10:00:00.000Z"});
    assert.deepEqual(arkPopulationRead(null, now), {span: "week", bucket: "hour", since: "2026-11-13T10:00:00.000Z"}, "no span: the week");
    assert.deepEqual(arkPopulationRead("month", now), {span: "month", bucket: "hour", since: "2026-10-20T10:00:00.000Z"});
    assert.deepEqual(arkPopulationRead("all", now), {span: "all", bucket: "day", since: null});
    assert.deepEqual(arkPopulationRead("tz=Asia/Jakarta", now), {span: "week", bucket: "hour", since: "2026-11-13T10:00:00.000Z"}, "anything else is the week: no zone reaches the server");
});
