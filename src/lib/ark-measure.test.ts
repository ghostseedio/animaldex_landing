import {test} from "node:test";
import assert from "node:assert/strict";
import {
    ARK_MEASURE_EVENTS,
    arkMeasureProps,
    arkMeasureRow,
    arkPageSource,
    arkStepOutcome,
    normalizeArkMeasureReport,
    summarizeArkMeasure,
    type ArkMeasureInput
} from "@/lib/ark-measure";

const SPECIES = "0f1e2d3c-4b5a-4968-8776-655443322110";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("events: the owner's names, in the owner's order", () => {
    assert.deepEqual([...ARK_MEASURE_EVENTS], [
        "ark_open", "ark_session_seconds", "ark_animal_tap", "ark_follow_animal", "ark_replay_viewed",
        "step_offered", "step_completed", "ark_arrival_seen", "ark_share"
    ]);
    for (const name of ARK_MEASURE_EVENTS) assert.ok(name.length <= 40 && /^[a-z][a-z0-9_]*$/.test(name), name);
});

test("props: only what each event may carry, and never anything a person wrote", () => {
    assert.deepEqual(arkMeasureProps("ark_open", {source: "chat_panel", step: "call my sister", name: "Lenny"}), {source: "chat_panel"});
    assert.equal(arkMeasureProps("ark_open", {}), null);
    assert.equal(arkMeasureProps("ark_open", {source: "somewhere"}), null);
    assert.deepEqual(arkMeasureProps("ark_session_seconds", {source: "ark_page", seconds: 12.6}), {source: "ark_page", seconds: 13});
    assert.deepEqual(arkMeasureProps("ark_session_seconds", {source: "ark_page", seconds: 10 ** 9}), {source: "ark_page", seconds: 21600});
    assert.equal(arkMeasureProps("ark_session_seconds", {source: "ark_page", seconds: -1}), null);
    assert.deepEqual(arkMeasureProps("ark_animal_tap", {species_profile_id: SPECIES.toUpperCase(), is_mine: true, source: "ark_page"}), {source: "ark_page", species_profile_id: SPECIES, is_mine: true});
    // A visitor at the landing has no species id: the tap is still a tap.
    assert.deepEqual(arkMeasureProps("ark_animal_tap", {species_profile_id: "", is_mine: false}), {is_mine: false});
    assert.deepEqual(arkMeasureProps("ark_replay_viewed", {events_count: 7, skipped: true}), {events_count: 7, skipped: true});
    assert.equal(arkMeasureProps("ark_replay_viewed", {events_count: 7}), null);
    assert.deepEqual(arkMeasureProps("step_completed", {outcome: "didnt_work"}), {outcome: "didnt_work"});
    assert.equal(arkMeasureProps("step_completed", {outcome: "great"}), null);
    assert.deepEqual(arkMeasureProps("ark_share", {target: "population"}), {target: "population"});
    assert.deepEqual(arkMeasureProps("step_offered", {species_profile_id: "not-a-uuid"}), {});
});

test("reports: the body the beacon sends, and the row it becomes", () => {
    assert.equal(normalizeArkMeasureReport(null), null);
    assert.equal(normalizeArkMeasureReport({event: "ark_dance"}), null);
    assert.equal(normalizeArkMeasureReport({event: "ark_open", props: {source: "nope"}}), null);
    const report = normalizeArkMeasureReport({event: "ark_open", props: {source: "capture_band"}, signed_in: true});
    assert.deepEqual(report, {event: "ark_open", props: {source: "capture_band"}, signedIn: true});
    assert.deepEqual(arkMeasureRow(report!), {
        event: "ark_open", source: "capture_band", seconds: null, species_profile_id: null, is_mine: null,
        events_count: null, skipped: null, outcome: null, target: null, signed_in: true
    });
});

test("sources and outcomes", () => {
    assert.equal(arkPageSource("capture"), "capture_band");
    assert.equal(arkPageSource("share"), "share_link");
    assert.equal(arkPageSource(null), "ark_page");
    assert.equal(arkPageSource("anything"), "ark_page");
    assert.equal(arkStepOutcome("worked"), "worked");
    assert.equal(arkStepOutcome(undefined), null);
});

function input(overrides: Partial<ArkMeasureInput> = {}): ArkMeasureInput {
    return {
        from: "2026-10-26",
        to: "2026-11-12",
        trials: [],
        arrivals: [],
        seen: [],
        events: [],
        testers: new Set(),
        includeTesters: false,
        ...overrides
    };
}

test("weekly: each stage in the week it happened, dropped and replaced steps never completed", () => {
    const summary = summarizeArkMeasure(input({
        trials: [
            // Offered in the first week, done (worked) in the second.
            {user_id: id(1), set_at: "2026-10-30T03:00:00Z", done_at: "2026-11-03T03:00:00Z", status: "done", outcome: "worked"},
            {user_id: id(1), set_at: "2026-11-03T03:00:00Z", done_at: "2026-11-04T03:00:00Z", status: "done", outcome: "didnt_work"},
            // A debate's "solved" record: done, no outcome.
            {user_id: id(2), set_at: "2026-11-04T03:00:00Z", done_at: "2026-11-04T03:00:00Z", status: "done", outcome: null},
            {user_id: id(2), set_at: "2026-11-05T03:00:00Z", done_at: "2026-11-06T03:00:00Z", status: "dropped", outcome: null},
            {user_id: id(3), set_at: "2026-11-10T03:00:00Z", done_at: null, status: "open", outcome: null}
        ]
    }));
    assert.deepEqual(summary.weeks.map((week) => week.key), ["2026-10-26", "2026-11-02", "2026-11-09"]);
    assert.deepEqual(summary.weeks.map((week) => week.baseline), [true, true, false]);
    assert.deepEqual(summary.weeks.map((week) => week.offered), [1, 3, 1]);
    assert.deepEqual(summary.weeks.map((week) => week.completed), [0, 3, 0]);
    assert.deepEqual(summary.weeks.map((week) => week.worked), [0, 1, 0]);
    assert.equal(summary.weeks[1].didntWork, 1);
    assert.equal(summary.weeks.at(-1)!.partial, true);
    // Baseline: Oct 26 to Nov 9 (15 days): 4 offered, 3 done, 1 worked.
    assert.equal(summary.baseline.days, 15);
    assert.equal(summary.baseline.offered, 4);
    assert.equal(summary.baseline.completed, 3);
    assert.equal(summary.baseline.completionRate, 75);
    assert.equal(summary.baseline.completedPerWeek, 1.4);
    assert.equal(summary.sinceLaunch.days, 3);
    assert.equal(summary.sinceLaunch.offered, 1);
    // Three days is too short for a weekly rate: none, rather than a count times 7/3.
    assert.equal(summary.sinceLaunch.completedPerWeek, null);
    assert.equal(summary.sinceLaunch.workedPerWeek, null);
    assert.equal(summary.sinceLaunch.completionRate, 0);
});

test("Jakarta weeks: late Sunday UTC is already Monday in Jakarta", () => {
    const summary = summarizeArkMeasure(input({trials: [{user_id: id(1), set_at: "2026-11-08T18:00:00Z", done_at: null, status: "open", outcome: null}]}));
    assert.deepEqual(summary.weeks.map((week) => week.offered), [0, 0, 1]);
});

test("testers: left out of steps and arrivals unless asked", () => {
    const testers = new Set([id(9)]);
    const trials = [
        {user_id: id(9), set_at: "2026-11-03T03:00:00Z", done_at: "2026-11-03T04:00:00Z", status: "done", outcome: "worked"},
        {user_id: id(1), set_at: "2026-11-03T03:00:00Z", done_at: null, status: "open", outcome: null}
    ];
    const arrivals = [{animal_id: id(100), owner_user_id: id(9), arrived_at: "2026-11-03T05:00:00Z"}];
    const without = summarizeArkMeasure(input({trials, arrivals, testers}));
    assert.equal(without.weeks[1].offered, 1);
    assert.equal(without.weeks[1].completed, 0);
    assert.equal(without.weeks[1].arrivals, 0);
    assert.equal(without.testersExcluded, true);
    const withThem = summarizeArkMeasure(input({trials, arrivals, testers, includeTesters: true}));
    assert.equal(withThem.weeks[1].offered, 2);
    assert.equal(withThem.weeks[1].arrivals, 1);
});

test("arrivals seen: only the owner's own sighting counts, in the week it was seen", () => {
    const arrivals = [
        {animal_id: id(100), owner_user_id: id(1), arrived_at: "2026-11-08T21:45:00Z"},
        {animal_id: id(101), owner_user_id: id(2), arrived_at: "2026-11-09T23:48:00Z"},
        {animal_id: id(102), owner_user_id: null, arrived_at: "2026-11-10T01:00:00Z"}
    ];
    const seen = [
        {user_id: id(1), animal_id: id(100), seen_at: "2026-11-10T02:00:00Z", surface: "ark_page"},
        // Not the owner: never counted.
        {user_id: id(3), animal_id: id(101), seen_at: "2026-11-10T02:00:00Z", surface: "ark_page"}
    ];
    const summary = summarizeArkMeasure(input({arrivals, seen}));
    assert.deepEqual(summary.weeks.map((week) => week.arrivals), [0, 0, 3]);
    assert.deepEqual(summary.weeks.map((week) => week.arrivalsSeen), [0, 0, 1]);
    assert.equal(summary.arrivalsWithOwner, 2);
    assert.equal(summary.arrivalsSeenByOwner, 1);
    // Before the migration: nothing seen, nothing broken.
    assert.equal(summarizeArkMeasure(input({arrivals, seen: null})).arrivalsSeenByOwner, 0);
});

test("opens and time: by source, and the mean of the sessions that ended in the week", () => {
    const events = [
        {event: "ark_open", source: "chat_panel", seconds: null, created_at: "2026-11-10T02:00:00Z"},
        {event: "ark_open", source: "capture_band", seconds: null, created_at: "2026-11-10T03:00:00Z"},
        {event: "ark_open", source: "chat_panel", seconds: null, created_at: "2026-11-11T03:00:00Z"},
        {event: "ark_session_seconds", source: "chat_panel", seconds: 30, created_at: "2026-11-10T02:01:00Z"},
        {event: "ark_session_seconds", source: "capture_band", seconds: 91, created_at: "2026-11-10T03:02:00Z"},
        {event: "ark_animal_tap", source: "ark_page", seconds: null, created_at: "2026-11-10T03:01:00Z"},
        {event: "ark_replay_viewed", source: null, seconds: null, created_at: "2026-11-10T03:01:00Z"},
        // Outside the range: not counted.
        {event: "ark_open", source: "ark_page", seconds: null, created_at: "2026-12-01T03:00:00Z"}
    ];
    const week = summarizeArkMeasure(input({events})).weeks[2];
    assert.equal(week.opensTotal, 3);
    assert.deepEqual(week.opens, {chat_panel: 2, ark_page: 0, capture_band: 1, share_link: 0});
    assert.equal(week.sessions, 2);
    assert.equal(week.avgSeconds, 61);
    assert.equal(week.taps, 1);
    assert.equal(week.replays, 1);
    assert.equal(summarizeArkMeasure(input({events: null})).weeks[2].avgSeconds, null);
});
