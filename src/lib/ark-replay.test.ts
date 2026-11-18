import assert from "node:assert/strict";
import test from "node:test";
import {ArkCast, standInAnimal, type ArkCastRecord} from "@/ark-scene/replay/cast";
import {ArkReplayUnavailable, arkReplayableEvents, arkReplayModels, planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {readArkEventLog} from "@/ark-scene/replay/event-log";
import {ARK_NEAR_CONE} from "@/ark-scene/near-fade";
import {createArkReplayShot, REPLAY_SETTLE_SECONDS} from "@/ark-scene/replay/shot";
import {arkReplayText} from "@/ark-scene/replay/text";
import {arkEpochSeconds, arkPinnedMs, pinArkClock} from "@/ark-scene/shared-clock";
import type {ArkAnimal, ArkCastLayer, ArkLiveActs, ArkLocated, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {planArkReplayShot} from "@/lib/ark-clips/replay-shots";

/**
 * V2 replay (`src/ark-scene/replay/`): a recorded event at its own time. The record decides (never the plan), nothing
 * ahead of now is replayed, everyone an event names is in the scene (a stand-in for whoever is gone) and pinned, and
 * the words name species only.
 */

const SPECIES = {zebra: "5bec1e50-0000-4000-8000-000000000001", lion: "5bec1e50-0000-4000-8000-000000000002", flea: "5bec1e50-0000-4000-8000-000000000003"};
const id = (n: number) => `0000feed-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

function aboard(n: number, name: string, slug: string, species: string, over: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id: id(n), species_profile_id: species, name, scientific_name: null, model_slug: slug, zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@someone", named: true}, mine: false, origin: "arrived", generation: 0, slot: n, slot_rank: 0, island: "wild", area: null, ...over};
}
function rowAnimal(n: number, name: string, slug: string, species: string, over: Record<string, unknown> = {}) {
    return {id: id(n), species_profile_id: species, name, model_slug: slug, zone: "grassland", island: "wild", area: null, enclosure: null, slot: n, slot_rank: 0, origin: "arrived", generation: 0, activity: "diurnal", sociality: null, arrived_at: "2026-11-01T00:00:00Z", status: "present", thrive: "ordinary", placeholder: false, ...over};
}
const zebra = (n: number, over: Record<string, unknown> = {}) => rowAnimal(n, "Plains Zebra", "plains-zebra", SPECIES.zebra, over);
const lion = (n: number, over: Record<string, unknown> = {}) => rowAnimal(n, "African Lion", "african-lion", SPECIES.lion, over);
const row = (serial: number, kind: string, at: string, more: Record<string, unknown> = {}) => ({id: serial, kind, at, ark_day: 100, animal: null, other: null, parents: [], bringers: [{label: "@someone", named: true}], from_egg: false, clutch: null, phrase: null, source: null, thrive: null, species: "Plains Zebra", species_profile_id: SPECIES.zebra, ...more});

/** Zebras 1 and 2 are aboard; zebra 3 (a parent) and lion 9 are gone; flea 20 was the last of its kind. */
const snapshot: ArkSnapshot = {
    voyage: {slug: "first", name: "Ark", started_at: null},
    counts: {animals: 3, species: 2, founders: 1},
    zones: [],
    animals: [aboard(1, "Plains Zebra", "plains-zebra", SPECIES.zebra), aboard(2, "Plains Zebra", "plains-zebra", SPECIES.zebra), aboard(8, "African Lion", "african-lion", SPECIES.lion), aboard(30, "Plains Zebra", "plains-zebra", SPECIES.zebra, {arrived_at: "2026-11-16T00:00:00Z", origin: "born"})],
    as_of: "2026-11-18T00:00:00Z",
    ark_day: 240
};
const NOW = Date.parse("2026-11-18T00:00:00Z");
const encounter = {t: Date.parse("2026-11-14T10:00:00Z") / 1000 - 30, step: 4, island: "wild", predator: {x: 10, z: 20}, prey: {x: 14, z: 26, r: 3}, d: 7.2};
const log = {
    events: [
        row(1, "arrival", "2026-11-01T00:00:00Z", {animal: zebra(3)}),
        row(10, "mated", "2026-11-10T10:00:00Z", {animal: zebra(1), other: zebra(3), parents: [id(1), id(3)]}),
        row(11, "birth", "2026-11-12T10:00:00Z", {animal: zebra(4, {origin: "born", arrived_at: "2026-11-12T10:00:00Z"}), parents: [id(1), id(3)]}),
        row(12, "birth", "2026-11-12T10:00:00Z", {animal: zebra(5, {origin: "born", arrived_at: "2026-11-12T10:00:00Z"}), parents: [id(1), id(3)]}),
        row(13, "death_old", "2026-11-13T10:00:00Z", {animal: zebra(3, {status: "died_old", zone: "desert"})}),
        row(14, "meal", "2026-11-14T10:00:00Z", {animal: lion(9), other: zebra(4, {status: "eaten"}), phrase: "zebras", species: "African Lion", species_profile_id: SPECIES.lion, encounter}),
        row(15, "escaped", "2026-11-14T11:00:00Z", {animal: zebra(2), other: lion(9), payload: {encounter, rate: [0.2, 0.3]}}),
        row(16, "birth", "2026-11-15T10:00:00Z", {animal: zebra(6, {origin: "born"}), parents: [id(2)], from_egg: true}),
        row(20, "death_old", "2026-11-15T12:00:00Z", {animal: rowAnimal(20, "Common Water Flea", "common-water-flea", SPECIES.flea, {status: "died_old", zone: "river_lake"}), species: "Common Water Flea", species_profile_id: SPECIES.flea}),
        row(21, "extinction", "2026-11-15T12:00:00Z", {species: "Common Water Flea", species_profile_id: SPECIES.flea}),
        row(22, "extinction", "2026-11-16T12:00:00Z", {species: "Dodo", species_profile_id: "5bec1e50-0000-4000-8000-0000000000dd"}),
        row(30, "last_stand", "2026-11-17T12:00:00Z", {animal: zebra(1), other: lion(8)}),
        row(31, "released", "2026-11-17T13:00:00Z", {animal: lion(8), species: "African Lion", species_profile_id: SPECIES.lion, payload: {from: lion(8, {area: "zoo", island: "town", enclosure: "savanna", slot: 3})}}),
        row(40, "mated", "2026-11-18T06:00:00Z", {animal: zebra(1), other: zebra(2), parents: [id(1), id(2)]})
    ]
};
const plan = (eventId: number) => planArkEventReplay(eventId, log, snapshot, {now: NOW});
const unavailable = (eventId: number | string, code: string) => assert.throws(() => planArkEventReplay(eventId, log, snapshot, {now: NOW}), (error: unknown) => error instanceof ArkReplayUnavailable && error.code === code);

// MARK: The plan

test("a mating: its two animals from the row, the live log's key, the one that has died since as a stand-in", () => {
    const replay = plan(10);
    assert.equal(replay.kind, "mated");
    assert.equal(replay.t0, Date.parse("2026-11-10T10:00:00Z") / 1000);
    assert.deepEqual(replay.cast.map((member) => [member.role, member.record.id, member.aboard]), [["pair", id(1), true], ["pair", id(3), false]]);
    assert.deepEqual(replay.feed, {matings: [{key: "mated:10", a: id(1), b: id(3), t0: replay.t0}]});
    assert.equal(replay.provisional, false);
    assert.deepEqual(arkReplayModels(replay), ["plains-zebra"]);
});

test("no look-ahead: an event after now, an unknown event and a kind that is not acted are refused", () => {
    unavailable(40, "not_released");
    unavailable(999, "unknown_event");
    unavailable("", "unknown_event");
    unavailable(1, "not_replayable");
    assert.deepEqual(arkReplayableEvents(log, NOW).map((event) => event.id), ["31", "30", "22", "21", "20", "16", "15", "14", "13", "12", "11", "10"], "newest first, nothing after now, only the kinds replayed");
});

test("a live birth: the whole litter as one act, its parents from their newest record at or before it", () => {
    const replay = plan(12);
    assert.equal(replay.kind, "birth");
    assert.deepEqual(replay.cast.map((member) => [member.role, member.record.id, member.aboard]), [["parent", id(1), true], ["parent", id(3), false], ["young", id(4), false], ["young", id(5), false]]);
    assert.deepEqual(replay.feed.births, [{key: `birth:2026-11-12T10:00:00Z:${[id(1), id(3)].sort().join(",")}`, parents: [id(1), id(3)], young: [id(4), id(5)], t0: replay.t0}]);
    // Zebra 3 died later, in the desert by its death row: the birth's replay reads only what was written by then.
    const parent = replay.cast.find((member) => member.record.id === id(3))!.record;
    assert.equal(parent.zone, "grassland");
    assert.equal(parent.status, "present");
});

test("a hatching: the scene's own replay act, and a parent with no record is said, never invented", () => {
    const replay = plan(16);
    assert.equal(replay.feed.play?.length, 1);
    const act = replay.feed.play![0];
    assert.ok(act.kind === "birth" && act.fromEgg && act.young[0].id === id(6));
    assert.deepEqual(replay.cast.map((member) => member.role), ["parent", "young"]);
    const orphan = planArkEventReplay(16, {events: log.events.map((event) => (event.id === 16 ? {...event, parents: ["0000feed-0000-4000-8000-00000000dead"]} : event))}, snapshot, {now: NOW});
    assert.equal(orphan.cast.length, 1);
    assert.match(orphan.notes[0], /no record/);
});

test("a death, a meal and an escape: the row's animals, a meal's and an escape's time the encounter's step", () => {
    const death = plan(13);
    assert.deepEqual([death.kind, death.eventKind, death.cast[0].role, death.cast[0].aboard], ["death", "death_old", "subject", false]);
    assert.equal(death.feed.deaths![0].key, "death:13");
    const meal = plan(14);
    assert.equal(meal.t0, encounter.t);
    assert.deepEqual(meal.cast.map((member) => [member.role, member.record.name]), [["predator", "African Lion"], ["prey", "Plains Zebra"]]);
    assert.deepEqual(meal.feed.meals![0].encounter?.prey, encounter.prey);
    const escaped = plan(15);
    assert.deepEqual(escaped.cast.map((member) => [member.role, member.record.id]), [["prey", id(2)], ["predator", id(9)]]);
    assert.deepEqual(escaped.feed.escapes, [{key: "escaped:15", prey: id(2), predator: id(9), t0: encounter.t, encounter: {t: encounter.t, step: 4, island: "wild", predator: encounter.predator, prey: encounter.prey, d: 7.2}}]);
});

test("an extinction: the death that ended the kind is the act, its animal marked the last; none in the log: refused", () => {
    const replay = plan(21);
    assert.equal(replay.kind, "extinct");
    assert.equal(replay.causeEventId, "20");
    assert.deepEqual(replay.cast.map((member) => [member.role, member.record.name, member.aboard]), [["last", "Common Water Flea", false]]);
    assert.deepEqual(replay.marks, [id(20)]);
    assert.equal(replay.feed.deaths![0].key, "death:20", "the same key the live log gave that death");
    unavailable(22, "no_animals");
});

test("the kinds the server does not write yet are marked provisional", () => {
    const last = plan(30);
    assert.deepEqual([last.provisional, last.marks, last.cast.map((member) => member.role)], [true, [id(1)], ["last", "predator"]]);
    assert.deepEqual(last.feed, {});
    const released = plan(31);
    assert.equal(released.provisional, true);
    assert.equal(released.feed.release?.id, id(8));
    assert.deepEqual([released.feed.release?.from?.area, released.feed.release?.from?.island, released.feed.release?.from?.enclosure], ["zoo", "town", "savanna"]);
});

// MARK: The words (Ark Lite's fallback)

test("the replay in words: the live log's own sentence and its time, species only", () => {
    const say = (eventId: number) => arkReplayText(plan(eventId), null, "en-GB");
    assert.equal(say(10).headline, "Two Plains Zebras mated");
    assert.equal(say(10).when, "10 November 2026 at 10:00 UTC · Ark day 100");
    assert.deepEqual(say(10).lines, ["The Plains Zebra is no longer aboard"]);
    assert.equal(say(12).headline, "2 Plains Zebra young were born");
    assert.equal(say(16).headline, "A Plains Zebra hatched");
    assert.equal(say(13).headline, "The Plains Zebra died of old age");
    assert.deepEqual(say(13).lines, [], "a death needs no second line");
    assert.equal(say(14).headline, "The African Lion ate a Plains Zebra");
    assert.equal(say(15).headline, "A Plains Zebra got away from an African Lion");
    assert.deepEqual([say(21).headline, say(21).lines], ["The last Common Water Flea is gone", ["The Common Water Flea died of old age", "It was the last of its kind on the Ark"]]);
    assert.equal(say(30).headline, "The last Plains Zebra in the wild, an African Lion close by");
    assert.equal(say(31).headline, "An African Lion was released into the wild");
    for (const eventId of [10, 12, 13, 14, 15, 16, 21, 30, 31]) assert.ok(!JSON.stringify(say(eventId)).includes("someone"), "never a bringer");
    assert.equal(arkReplayText(plan(30), {replayEvent: {lastStandWith: "Le dernier {animal}, {aPredator} tout près"}}, "fr").headline, "Le dernier Plains Zebra, an African Lion tout près");
});

test("the replay clip's plan: the event's kind as its shot, the record's words, a sample when it is not the record's", () => {
    const shot = planArkReplayShot(10, {snapshot, rawEvents: log, fixture: false, now: new Date(NOW)});
    assert.equal(shot.kind, "mated");
    assert.equal(shot.direction.replay?.eventId, "10");
    assert.equal(shot.slug, "replay-mated-plains-zebra-10");
    assert.equal(shot.hookText, "TWO PLAINS ZEBRAS MATED");
    assert.equal(shot.dataSource, "live");
    assert.deepEqual(shot.direction.preload, ["plains-zebra"]);
    assert.ok(!JSON.stringify(shot.cues).includes("@"), "no user is named");
    assert.ok(planArkReplayShot(30, {snapshot, rawEvents: log, fixture: false, now: new Date(NOW)}).slug.startsWith("sample-replay-last-stand-"));
    assert.throws(() => planArkReplayShot(40, {snapshot, rawEvents: log, fixture: false, now: new Date(NOW)}), ArkReplayUnavailable);
});

// MARK: The cast

const record = (n: number, over: Partial<ArkCastRecord> = {}): ArkCastRecord => ({id: id(n), species_profile_id: SPECIES.zebra, name: "Plains Zebra", model_slug: "plains-zebra", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", origin: "arrived", generation: 0, slot: n, slot_rank: 0, activity: "diurnal", sociality: null, status: "died_old", ...over});

test("the cast: a stand-in for whoever is not in the read, everyone pinned, the read itself when there is no cast", () => {
    const cast = new ArkCast();
    assert.equal(cast.roster(snapshot), snapshot);
    cast.bring("mated:10", [record(1), record(3)], {marks: [id(3), id(77)]});
    const roster = cast.roster(snapshot);
    assert.notEqual(roster, snapshot);
    assert.equal(cast.roster(snapshot), roster, "the same roster for the same read and cast");
    assert.equal(cast.roster(roster), roster, "a roster handed back is its own read's");
    assert.deepEqual(roster.animals.map((animal) => animal.id), [id(1), id(2), id(8), id(30), id(3)]);
    assert.deepEqual(roster.counts, snapshot.counts, "a stand-in is never counted");
    assert.deepEqual(Array.from(cast.pins), [id(1), id(3)]);
    assert.deepEqual(Array.from(cast.marks), [id(3)], "a mark only on someone in the group");
    assert.deepEqual(cast.report(), {pins: [id(1), id(3)], standIns: [id(3)], dropped: 0});
    const standIn = roster.animals[4];
    assert.deepEqual([standIn.mine, standIn.brought_by, standIn.slot], [false, {label: "", named: false}, 3]);
});

test("the cast: released groups take their stand-ins and pins with them; an id two groups name stays", () => {
    const cast = new ArkCast().bring("a", [record(1), record(3)]).bring("b", [record(3), record(9)]);
    assert.deepEqual(cast.roster(snapshot).animals.slice(4).map((animal) => animal.id), [id(3), id(9)]);
    cast.release("a");
    assert.deepEqual(Array.from(cast.pins), [id(3), id(9)]);
    cast.release("b");
    assert.equal(cast.roster(snapshot), snapshot);
    assert.equal(cast.pins.size, 0);
});

test("the cast as of a moment: whoever came aboard later is left out unless the cast names them, and the day is the event's", () => {
    const cast = new ArkCast().setAsOf(Date.parse("2026-11-12T10:00:00Z") / 1000, 100);
    assert.deepEqual(cast.roster(snapshot).animals.map((animal) => animal.id), [id(1), id(2), id(8)]);
    assert.equal(cast.roster(snapshot).ark_day, 100);
    assert.equal(cast.report().dropped, 1);
    cast.bring("birth", [record(30)]);
    assert.deepEqual(cast.roster(snapshot).animals.map((animal) => animal.id), [id(1), id(2), id(8), id(30)]);
    cast.clear();
    assert.equal(cast.roster(snapshot), snapshot);
});

test("a stand-in is the server's record of it: its place, its island from its area, never anyone's", () => {
    assert.equal(standInAnimal(record(3, {area: "zoo"})).island, "town");
    assert.equal(standInAnimal(record(3, {area: null, island: "town"})).island, "town");
    assert.equal(standInAnimal(record(3)).island, null);
    assert.equal(standInAnimal(record(3, {enclosure: "savanna", area: "zoo"})).enclosure, "savanna");
});

test("the cast hands itself to the scene on apply, and takes itself away", () => {
    const given: Array<ArkCastLayer | null> = [];
    const cast = new ArkCast({setCast: (layer) => given.push(layer)});
    cast.bring("a", [record(3)]).setAsOf(1, null);
    assert.equal(given.length, 0, "nothing is laid out until apply");
    cast.apply();
    cast.detach();
    assert.deepEqual(given, [cast, null]);
    assert.equal(cast.pins.size, 0);
});

// MARK: The clock, and the shot

test("the pinned clock gives the world's time (ms), and none unpinned", () => {
    assert.equal(arkPinnedMs(), null);
    pinArkClock(1_000_000);
    const at = arkPinnedMs()!;
    assert.ok(at >= 1_000_000_000 && at < 1_000_000_000 + 2_000);
    pinArkClock(null);
    assert.equal(arkPinnedMs(), null);
});

/** A scene that only remembers what it was given, with a mating whose times are known. */
function fakeScene(acts: Partial<ArkLiveActs> = {}) {
    const calls: Array<[string, unknown]> = [];
    const places: Record<string, ArkLocated> = {};
    const note = (name: string) => (value: unknown) => void calls.push([name, value]);
    const handle = {
        setCast: note("setCast"),
        addMatings: note("addMatings"),
        addDeaths: note("addDeaths"),
        addBirths: note("addBirths"),
        addEscapes: note("addEscapes"),
        setMeals: note("setMeals"),
        hold: note("hold"),
        setHours: note("setHours"),
        arrive: note("arrive"),
        locate: (animalId: string) => places[animalId] ?? null,
        liveActs: () => ({meals: [], matings: [], births: [], escapes: [], deaths: [], ...acts}),
        view: () => ({target: {x: 0, y: 0, z: 0}, distance: 10, polar: 1, azimuth: 0}),
        islandView: () => ({target: {x: 500, y: 0, z: 0}, distance: 300, polar: 1, azimuth: 0})
    } as unknown as ArkSceneHandle;
    const put = (animalId: string, x: number, z: number, shown = true) => (places[animalId] = {x, y: 1, z, ground: 0, length: 2, height: 1.4, awake: true, yaw: 0, act: null, shown});
    return {handle, calls, put};
}

test("a replay shot: the clock pinned before the event, the cast brought in and pinned, the layer fed the record", () => {
    const replay = plan(10);
    const scene = fakeScene();
    scene.put(id(1), 0, 0);
    scene.put(id(3), 6, 0);
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 2.5});
    try {
        shot.begin();
        assert.ok(Math.abs(arkEpochSeconds() - (replay.t0 - 2.5 - REPLAY_SETTLE_SECONDS)) < 0.5, "the world's clock is the event's, less the lead and the frames nobody sees");
        shot.settle();
        assert.ok(Math.abs(arkEpochSeconds() - (replay.t0 - 2.5)) < 0.5, "the shot starts the lead before the event");
        const cast = scene.calls.find(([name]) => name === "setCast")![1] as ArkCastLayer;
        assert.deepEqual(Array.from(cast.pins), [id(1), id(3)]);
        assert.deepEqual(cast.roster(snapshot).animals.map((animal) => animal.id), [id(1), id(2), id(8), id(3)], "the one that died stands in; who was born later is left out");
        assert.deepEqual(scene.calls.find(([name]) => name === "addMatings")![1], replay.feed.matings);
        const view = shot.step(0, 0)!;
        assert.ok(Math.abs(view.target.x - 3) < 0.01 && Math.abs(view.target.z) < 0.01, "the two framed together: the point between them");
        assert.ok(view.distance > 12, "far enough back for both");
        // Still far from each other (a long walk to come): the first of them alone, near.
        scene.put(id(3), 60, 0);
        shot.settle();
        const alone = shot.step(0, 0)!;
        assert.ok(Math.abs(alone.target.x) < 0.01 && alone.distance < view.distance);
        scene.put(id(3), 6, 0);
        assert.deepEqual(shot.report().standIns, [id(3)]);
        assert.equal(shot.doneAt(), null);
    } finally {
        shot.end();
    }
    assert.equal(arkPinnedMs(), null, "the real clock again");
    assert.equal(scene.calls[scene.calls.length - 1][0], "setCast");
    assert.equal(scene.calls[scene.calls.length - 1][1], null);
});

test("a mating's shot cuts to the end of a long walk, pulls away at the mount, and says when the layer skipped it", () => {
    const replay = plan(10);
    const key = replay.feed.matings![0].key;
    const acted = fakeScene({matings: [{key, t0: replay.t0, phase: "acting", meet: 28, courted: 39, mounted: 60, end: 180}]});
    acted.put(id(1), 0, 0);
    acted.put(id(3), 3, 0);
    const shot = createArkReplayShot({handle: acted.handle, replay, aspect: () => 9 / 16, lead: 1});
    try {
        shot.begin();
        // (The harness's clock: the pin moves on with each frame, as the recorder's clock moves `performance.now`.)
        let world = replay.t0 - 1;
        const frame = (t: number) => {
            pinArkClock(world);
            const before = arkEpochSeconds();
            const view = shot.step(t, 0.5);
            world = arkEpochSeconds() + 0.5 + (arkEpochSeconds() - before > 1 ? 0 : 0);
            return view;
        };
        let t = 0;
        while (shot.doneAt() === null && t < 120) frame((t += 0.5));
        const report = shot.report();
        assert.equal(report.acted, true);
        assert.deepEqual(report.cuts.map((cut) => cut.why), ["to the end of the walk to each other", "past the mount"]);
        assert.ok(report.cuts[0].skipped > 15 && report.cuts[1].skipped > 15);
        assert.ok(shot.doneAt()! < 45, "a clip's length");
        assert.ok(report.keyAt !== null && report.keyAt > report.cuts[0].at && report.keyAt < report.cuts[1].at, "the still's moment: the courtship, between the two cuts");
    } finally {
        shot.end();
    }
    const skipped = fakeScene({matings: [{key, t0: replay.t0, phase: "skipped"}]});
    skipped.put(id(1), 0, 0);
    const still = createArkReplayShot({handle: skipped.handle, replay, aspect: () => 9 / 16, lead: 1});
    try {
        still.begin();
        let world = replay.t0 - 1;
        for (let t = 0; still.doneAt() === null && t < 60; t += 0.5) {
            pinArkClock((world += 0.5));
            still.step(t, 0.5);
        }
        assert.equal(still.report().acted, false);
        assert.match(still.report().reason ?? "", /skipped/);
    } finally {
        still.end();
    }
});

test("a chase's shot: the hunter first, then its quarry, and the two together when the hunter is on it; a long stalk is cut to its end", () => {
    const replay = plan(15);
    const key = replay.feed.escapes![0].key;
    const scene = fakeScene({escapes: [{key, t0: replay.t0, phase: "acting", missAt: 30, seconds: 38}]});
    scene.put(id(9), 0, 0);
    scene.put(id(2), 30, 0);
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 1});
    try {
        shot.begin();
        shot.settle();
        const before = shot.step(0, 0)!;
        assert.ok(Math.abs(before.target.x) < 0.01, "before its time, the hunter alone");
        pinArkClock(replay.t0 + 1);
        const after = shot.step(2, 1 / 30)!;
        assert.ok(Math.abs(after.target.x - 30) < 0.01, "then its quarry, where the chase comes (an edit: the two are far apart)");
        assert.deepEqual(shot.report().cuts.map((cut) => cut.why), ["to the end of the stalk"]);
        // The hunter on it: both in the picture.
        scene.put(id(9), 27, 0);
        let both = shot.step(2.1, 1 / 30)!;
        for (let i = 0; i < 30; i++) both = shot.step(2.1 + (i + 1) / 30, 1 / 30)!;
        assert.ok(both.target.x < 29.5 && both.target.x > 28, "the point between the two");
        let world = arkEpochSeconds();
        for (let t = 2.2; shot.doneAt() === null && t < 60; t += 0.5) {
            pinArkClock((world += 0.5));
            shot.step(t, 0.5);
        }
        assert.equal(shot.report().acted, true);
    } finally {
        shot.end();
    }
});

test("the camera keeps a bearing clear of the trees: the scene's own rule, held until something stands between", () => {
    const replay = plan(13);
    const scene = fakeScene();
    scene.put(id(3), 0, 0);
    // The scene's answer: a tree to the south-east (bearings 0.3 to 1.0); round it, the nearest clear bearing.
    let tree = false;
    (scene.handle as unknown as {clearView: ArkSceneHandle["clearView"]}).clearView = (_focus, _distance, polar, azimuth) => {
        const a = Math.atan2(Math.sin(azimuth), Math.cos(azimuth));
        return {polar, azimuth: tree && a > 0.3 && a < 1.0 ? azimuth + Math.PI : azimuth};
    };
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 4});
    try {
        shot.begin();
        shot.settle();
        const first = shot.step(0, 0)!.azimuth;
        scene.put(id(3), 0.5, 0);
        assert.equal(shot.step(0.1, 1 / 30)!.azimuth, first, "clear: the bearing is kept");
        tree = true;
        // (The death's lone animal is framed from the island's outer side: bearing 0 here; put the tree across it.)
        (scene.handle as unknown as {clearView: ArkSceneHandle["clearView"]}).clearView = (_focus, _distance, polar, azimuth) => ({polar, azimuth: Math.abs(Math.atan2(Math.sin(azimuth - first), Math.cos(azimuth - first))) < 0.3 ? azimuth + Math.PI : azimuth});
        let view = shot.step(0.2, 1 / 30)!;
        for (let i = 0; i < 90; i++) view = shot.step(0.2 + (i + 1) / 30, 1 / 30)!;
        const turned = Math.abs(Math.atan2(Math.sin(view.azimuth - first), Math.cos(view.azimuth - first)));
        assert.ok(turned > 0.3 && turned < 0.6, `eased round to the nearest clear bearing (${turned.toFixed(2)} rad), not across to the far side`);
    } finally {
        shot.end();
    }
});

test("an upright picture holds two along its tall side, and from a bearing the trees force, from farther back", () => {
    const replay = plan(10);
    const framing = (clearView?: ArkSceneHandle["clearView"]) => {
        const scene = fakeScene();
        scene.put(id(1), 0, 0);
        scene.put(id(3), 10, 0);
        if (clearView) (scene.handle as unknown as {clearView: ArkSceneHandle["clearView"]}).clearView = clearView;
        const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 1});
        shot.begin();
        shot.settle();
        const view = shot.step(0, 0)!;
        shot.end();
        return view;
    };
    const free = framing();
    // The two lie along x: the camera looks along x (a bearing of a quarter turn, either way), both up the picture.
    assert.ok(Math.abs(Math.abs(Math.sin(free.azimuth)) - 1) < 1e-6, "along the line between them");
    const forced = framing((_focus, _distance, polar, azimuth) => ({polar, azimuth: azimuth + 0.9}));
    assert.ok(forced.distance > free.distance * 1.5, `across the picture they need more room (${free.distance.toFixed(1)} m, then ${forced.distance.toFixed(1)} m)`);
    // Across the narrow side from that bearing: half the 10 m between them times sin(0.9), with room, inside the half width.
    const halfWidth = forced.distance * Math.tan((38 * Math.PI) / 360) * (9 / 16);
    assert.ok(5 * Math.sin(0.9) < halfWidth, "both still in the picture");
});

/** A fake scene with the lines of sight: `clear(view)` says whether a view sees the cast. */
function sightScene(clear: (view: {distance: number; polar: number; azimuth: number}) => boolean, acts: Partial<ArkLiveActs> = {}) {
    const scene = fakeScene(acts);
    const asked: Array<{distance: number; polar: number; azimuth: number; cut: number; points: number}> = [];
    const cuts: Array<number | null> = [];
    Object.assign(scene.handle, {
        sightOf: (_target: unknown, view: {distance: number; polar: number; azimuth: number}, points: unknown[], _fresh?: boolean, cut = 0) => {
            asked.push({...view, cut, points: points.length});
            return clear(view) ? 0 : points.length;
        },
        setNearCut: (metres: number | null) => void cuts.push(metres)
    });
    return {...scene, asked, cuts};
}
const turned = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test("a clear view by the scene's lines of sight: the views round the asked one tried, the first that sees the cast taken, the way to it cut away and its leaves dissolved", () => {
    let first: number | null = null;
    const scene = sightScene((view) => {
        first ??= view.azimuth;
        return turned(view.azimuth, first) > 0.9;
    });
    scene.put(id(3), 0, 0);
    const shot = createArkReplayShot({handle: scene.handle, replay: plan(13), aspect: () => 9 / 16, lead: 1});
    try {
        shot.begin();
        shot.settle();
        const view = shot.step(0, 0)!;
        assert.ok(Math.abs(turned(view.azimuth, first!) - 1) < 0.01, "the nearest bearing that sees it");
        assert.equal(scene.asked[0].points, 3, "its middle, its head and its tail");
        // One alone fills the picture: a body of 2 m across three quarters of an upright picture's width (and a little room while it still walks).
        const wide = 2 / (2 * 0.74 * Math.tan((38 * Math.PI) / 360) * (9 / 16));
        assert.ok(view.distance > wide && view.distance < wide * 1.3, `as large as the picture holds it (${view.distance.toFixed(2)} m)`);
        assert.ok(scene.asked[0].cut > view.distance * 0.3 && scene.asked[0].cut < view.distance - 1, "the lines begin at the near cut, short of its body");
        const cut = scene.cuts[scene.cuts.length - 1]!;
        assert.ok(cut > view.distance * 0.3 && cut < view.distance - 1, "the cutaway: the near plane out toward it");
        assert.ok(ARK_NEAR_CONE.value.x > 0 && ARK_NEAR_CONE.value.z > view.distance && ARK_NEAR_CONE.value.z < view.distance + 3, "the leaves between dissolve, and those its body stands in");
        assert.equal(shot.report().sight!.searches, 1);
        // Kept while it sees it; blocked twice running, the search again.
        const asked = scene.asked.length;
        shot.step(0.3, 0.3);
        assert.ok(scene.asked.length - asked <= 4, "a look along the view kept (and along the way round it), no search");
    } finally {
        shot.end();
    }
    assert.equal(ARK_NEAR_CONE.value.x, 0, "the Ark's own fade again");
    assert.equal(scene.cuts[scene.cuts.length - 1], null, "and its own near plane");
});

test("a small animal is filmed from as near as its size asks; a swimmer from under the water with it", () => {
    const tiny = sightScene(() => true);
    Object.assign(tiny.put(id(3), 0, 0), {length: 0.002, height: 0.001});
    const close = createArkReplayShot({handle: tiny.handle, replay: plan(13), aspect: () => 9 / 16, lead: 1});
    try {
        close.begin();
        close.settle();
        const view = close.step(0, 0)!;
        assert.ok(view.distance >= 0.01 && view.distance < 0.02, `an aphid from a centimetre (${view.distance})`);
        assert.ok(view.polar < 0.6, "from well above: the plants round it are taller than it is");
    } finally {
        close.end();
    }
    const wet = sightScene(() => true);
    Object.assign(wet.put(id(3), 0, 0), {under: 2.5});
    const dive = createArkReplayShot({handle: wet.handle, replay: plan(13), aspect: () => 9 / 16, lead: 1});
    try {
        dive.begin();
        dive.settle();
        const view = dive.step(0, 0)!;
        assert.ok(view.polar > 1.3, "level with it");
        assert.ok(Math.cos(view.polar) * view.distance < 2.5 - 0.7, "the camera under the surface too");
        assert.ok(wet.asked.every((look) => Math.cos(look.polar) * look.distance <= 2.5 - 0.7 + 0.01), "no view from over the water is tried");
    } finally {
        dive.end();
    }
});

test("an escape with the lines of sight: the hunter and its quarry in one picture all the way, drawn in as it closes", () => {
    const replay = plan(15);
    const key = replay.feed.escapes![0].key;
    const scene = sightScene(() => true, {escapes: [{key, t0: replay.t0, phase: "acting", missAt: 8, seconds: 16}]});
    scene.put(id(9), 0, 0);
    scene.put(id(2), 30, 0);
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 1});
    try {
        shot.begin();
        shot.settle();
        shot.step(0, 0);
        pinArkClock(replay.t0 + 1);
        const far = shot.step(2, 1 / 30)!;
        assert.ok(Math.abs(far.target.x - 15) < 0.01, "the point between the two, 30 m apart");
        assert.ok(far.distance > 30, "from far enough back for both");
        scene.put(id(9), 27, 0);
        let near = shot.step(2.1, 1 / 30)!;
        for (let i = 0; i < 90; i++) near = shot.step(2.1 + (i + 1) / 30, 1 / 30)!;
        assert.ok(near.target.x > 28 && near.distance < far.distance * 0.5, "drawn in as the hunter closes");
        // The lunge: the picture is on the quarry before the hunter is, with room for it; the still is the two at their nearest.
        scene.put(id(9), 0, 0);
        pinArkClock(replay.t0 + 7);
        let lunge = shot.step(6, 1 / 30)!;
        for (let i = 0; i < 60; i++) lunge = shot.step(6 + (i + 1) / 30, 1 / 30)!;
        assert.ok(Math.abs(lunge.target.x - 30) < 0.5 && lunge.distance >= 6.5, "on the quarry, from far enough back for the hunter that is coming");
        scene.put(id(9), 28, 0);
        pinArkClock(replay.t0 + 7.9);
        for (let i = 0; i < 30; i++) lunge = shot.step(8 + (i + 1) / 30, 1 / 30)!;
        assert.ok(lunge.target.x > 28.5 && lunge.target.x < 29.5 && lunge.distance >= 6.5, "then the two of them");
        assert.ok(shot.report().keyAt !== null && shot.report().keyAt! > 8, "the still: the two at their nearest");
    } finally {
        shot.end();
    }
});

test("a night's lift is the camera's only: an exposure gain and a fill eased in with the dark, none by day, with the hour pinned or when turned off", () => {
    const night = planArkEventReplay(13, {events: log.events.map((event) => (event.id === 13 ? {...event, at: "2026-11-13T00:30:00Z"} : event))}, snapshot, {now: NOW});
    const gains = (replay: typeof night, options: {nightGain?: number; hour?: number}) => {
        const scene = fakeScene();
        scene.put(id(3), 0, 0);
        const set: number[] = [];
        const fills: number[] = [];
        (scene.handle as unknown as {setExposure: (gain: number, fill?: number) => void}).setExposure = (gain, fill) => {
            set.push(gain);
            fills.push(fill ?? 1);
        };
        const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 1, ...options});
        shot.begin();
        shot.settle();
        shot.step(0, 0);
        const report = shot.report();
        shot.end();
        return {set, fills, report};
    };
    const lifted = gains(night, {});
    assert.ok(lifted.report.night > 0.9 && lifted.set[0] > 2 && lifted.set[0] <= 3 && lifted.fills[0] > 2.5, `full night, lifted (${lifted.set[0]}, fill ${lifted.fills[0]})`);
    assert.equal(lifted.set[lifted.set.length - 1], 1, "the Ark's own exposure again when the shot ends");
    assert.equal(lifted.fills[lifted.fills.length - 1], 1, "and its own light");
    assert.ok(gains(night, {nightGain: 2}).set[0] > lifted.set[0] * 1.6, "`nightGain` scales the lift");
    assert.deepEqual(gains(night, {nightGain: 0}).set, [1], "turned off: only the reset");
    assert.deepEqual(gains(night, {hour: 11}).set, [1]);
    const day = gains(plan(13), {});
    assert.ok(day.report.night < 0.05 && Math.abs(day.set[0] - 1) < 0.1 && Math.abs(day.fills[0] - 1) < 0.2, "by day nothing changes");
});

test("the event log is read through to its end: `more` followed from the last row, a stuck minute stepped over", async () => {
    const asked: string[] = [];
    const pages: Record<string, {events: Array<{id: number; at: string}>; more: boolean}> = {
        "2026-11-01T00:00:00.000Z": {events: [{id: 1, at: "2026-11-02T00:00:10Z"}, {id: 2, at: "2026-11-02T00:00:20Z"}], more: true},
        "2026-11-02T00:00:20Z": {events: [{id: 1, at: "2026-11-02T00:00:10Z"}, {id: 2, at: "2026-11-02T00:00:20Z"}], more: true},
        "2026-11-02T00:01:00.000Z": {events: [{id: 3, at: "2026-11-03T00:00:00Z"}], more: false}
    };
    const fetcher = (async (url: string) => {
        const since = decodeURIComponent(url.split("since=")[1]);
        asked.push(since);
        return {ok: true, json: async () => pages[since] ?? {events: [], more: false}};
    }) as unknown as typeof fetch;
    const read = await readArkEventLog("", {sinceMs: Date.parse("2026-11-01T00:00:00Z"), fetcher});
    assert.deepEqual(asked, ["2026-11-01T00:00:00.000Z", "2026-11-02T00:00:20Z", "2026-11-02T00:01:00.000Z"]);
    assert.deepEqual((read.events as Array<{id: number}>).map((event) => event.id), [1, 2, 3]);
    assert.deepEqual([read.whole, read.skipped], [true, ["2026-11-02T00:00:20Z"]]);
});
