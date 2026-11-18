import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import {LiveEscapes, type LimpOffsets} from "@/ark-scene/live-escapes";
import {APPROACH_SECONDS, LiveMeals, approachPose, type MealAct} from "@/ark-scene/live-meals";
import {escapeActs} from "@/ark-scene/live/escape-lines";
import {ArkCast} from "@/ark-scene/replay/cast";
import {planArkEventReplay} from "@/ark-scene/replay/event-replay";
import {createArkReplayShot} from "@/ark-scene/replay/shot";
import {ARK_SEEN_ENGLISH, arkSeenStateText, arkSeenStates} from "@/ark-scene/seen/hooks";
import {ARK_SEEN_KINDS, ArkSeenCast, arkSeenGroup} from "@/ark-scene/seen/live-cast";
import {mixArkViews, startArkWatch} from "@/ark-scene/seen/watch";
import {arkEpochSeconds, arkPinnedMs, pinArkClock} from "@/ark-scene/shared-clock";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal, ArkCameraView, ArkCastLayer, ArkLiveActs, ArkLocated, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import {ARK_ACT_HOLD_SECONDS, arkActStart, arkActStartOf} from "@/lib/ark-act-hold";

/**
 * V1 "hunting and mating you can see" (`src/ark-scene/seen/`; AnimalDex docs/ark/audits/ecosystem-audit-2026-11-18.md
 * §2.4, decision 389): an act is held until its record is out, everyone it names is in the scene while it needs them,
 * a watched act holds its animals in the picture on the Ark's own clock, and nothing is said or drawn that the public
 * read has not released.
 */

const SPECIES = {zebra: "5bec1e50-0000-4000-8000-000000000001", lion: "5bec1e50-0000-4000-8000-000000000002", flea: "5bec1e50-0000-4000-8000-000000000003"};
const id = (n: number) => `0000feed-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
function aboard(n: number, name: string, slug: string, species: string, over: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id: id(n), species_profile_id: species, name, scientific_name: null, model_slug: slug, zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@someone", named: true}, mine: false, origin: "arrived", generation: 0, slot: n, slot_rank: 0, island: "wild", ...over};
}
function rowAnimal(n: number, name: string, slug: string, species: string, over: Record<string, unknown> = {}) {
    return {id: id(n), species_profile_id: species, name, model_slug: slug, zone: "grassland", island: "wild", area: null, enclosure: null, slot: n, slot_rank: 0, origin: "arrived", generation: 0, activity: "diurnal", sociality: null, arrived_at: "2026-11-01T00:00:00Z", status: "present", thrive: "ordinary", placeholder: false, ...over};
}
const zebra = (n: number, over: Record<string, unknown> = {}) => rowAnimal(n, "Plains Zebra", "plains-zebra", SPECIES.zebra, over);
const lion = (n: number, over: Record<string, unknown> = {}) => rowAnimal(n, "African Lion", "african-lion", SPECIES.lion, over);
const row = (serial: number, kind: string, at: string, more: Record<string, unknown> = {}) => ({id: serial, kind, at, ark_day: 100, animal: null, other: null, parents: [], bringers: [], from_egg: false, clutch: null, phrase: null, source: null, thrive: null, species: "Plains Zebra", species_profile_id: SPECIES.zebra, ...more});

/** Zebras 1 and 2 and lion 8 are aboard; zebra 3 and lion 9 are gone; flea 20 was the last of its kind. */
const snapshot: ArkSnapshot = {
    voyage: {slug: "first", name: "Ark", started_at: null},
    counts: {animals: 3, species: 2, founders: 1},
    zones: [],
    animals: [aboard(1, "Plains Zebra", "plains-zebra", SPECIES.zebra), aboard(2, "Plains Zebra", "plains-zebra", SPECIES.zebra), aboard(8, "African Lion", "african-lion", SPECIES.lion)],
    as_of: "2026-11-18T00:00:00Z",
    ark_day: 240
};
const AT = "2026-11-17T10:00:00Z";
const at = Date.parse(AT) / 1000;
const encounter = {t: at - 400, step: 4, island: "wild", predator: {x: 10, z: 20}, prey: {x: 14, z: 26, r: 3}, d: 7.2};
const log = {
    events: [
        row(10, "mated", AT, {animal: zebra(1), other: zebra(3), parents: [id(1), id(3)]}),
        row(11, "mated", AT, {animal: zebra(1), other: zebra(2), parents: [id(1), id(2)]}),
        row(13, "death_old", AT, {animal: zebra(3, {status: "died_old"})}),
        row(14, "meal", AT, {animal: lion(8), other: zebra(4, {status: "eaten"}), phrase: "zebras", species: "African Lion", species_profile_id: SPECIES.lion, encounter}),
        row(15, "escaped", AT, {animal: zebra(2), other: lion(9), payload: {encounter}}),
        row(16, "meal", AT, {animal: lion(9), other: zebra(5, {status: "eaten"}), species: "African Lion", species_profile_id: SPECIES.lion, encounter}),
        row(20, "death_old", AT, {animal: rowAnimal(20, "Common Water Flea", "common-water-flea", SPECIES.flea, {status: "died_old", zone: "river_lake"}), species: "Common Water Flea", species_profile_id: SPECIES.flea}),
        row(21, "extinction", AT, {species: "Common Water Flea", species_profile_id: SPECIES.flea}),
        row(30, "last_stand", AT, {animal: zebra(1), other: lion(8)}),
        row(40, "arrival", AT, {animal: zebra(2)})
    ]
};
const NOW = (at + 20) * 1000;

// MARK: The hold

test("an act is held until its record is out: never before the row's own time and the hold, never before the encounter's step", () => {
    assert.equal(arkActStart(1000), 1000 + ARK_ACT_HOLD_SECONDS);
    assert.equal(arkActStart(1000, 400), 1000 + ARK_ACT_HOLD_SECONDS, "the encounter's step was minutes before the record: the chase waits for the record");
    assert.equal(arkActStart(1000, 5000), 5000, "never before the step itself");
    assert.equal(arkActStart(null, 400), 400, "an answer with no time: the step, as before");
    assert.ok(Number.isNaN(arkActStart(null, null)));
    assert.equal(arkActStartOf("2026-11-17T10:00:00Z", at - 400), at + ARK_ACT_HOLD_SECONDS);
    assert.ok(ARK_ACT_HOLD_SECONDS >= 45 + 30, "longer than a page's refresh and the public read's cache: a viewer watching has the line first");
});

test("the plans of a death, a meal and an escape start held, and so do the live log's own feeds: one clock for every viewer", () => {
    const plan = (n: number) => planArkEventReplay(n, log, snapshot, {now: NOW + 3_600_000});
    for (const n of [13, 14, 15]) assert.equal(plan(n).t0, at + ARK_ACT_HOLD_SECONDS);
    assert.equal(plan(10).t0, at, "a mating is walked from its own time: its walk is minutes long");
    assert.deepEqual(escapeActs(log, -Infinity).map((act) => [act.key, act.t0]), [["escaped:15", at + ARK_ACT_HOLD_SECONDS]]);
});

test("no look-ahead: a row dated after now is never a group, a watch or a plan", () => {
    assert.equal(arkSeenGroup("14", log, snapshot, (at - 5) * 1000), null);
    assert.throws(() => planArkEventReplay(14, log, snapshot, {now: (at - 5) * 1000}));
});

// MARK: The live cast

test("the live cast: every acted kind brings its animals in (a stand-in for whoever has left the read), until its act no longer needs the group", () => {
    assert.deepEqual(Array.from(ARK_SEEN_KINDS).sort(), ["birth", "death_old", "escaped", "extinction", "mated", "meal", "starved"]);
    const mated = arkSeenGroup("10", log, snapshot, NOW)!;
    assert.deepEqual([mated.key, mated.records.map((record) => record.id)], ["mated:10", [id(1), id(3)]]);
    assert.equal(mated.until, at + 21 * 60, "one of the two has died since: its stand-in is kept for the whole of the mating");
    assert.equal(arkSeenGroup("11", log, snapshot, NOW)!.until, at + 90, "both alive: only until the layer has taken them up (its own pins hold them then)");
    const death = arkSeenGroup("13", log, snapshot, NOW)!;
    assert.deepEqual([death.key, death.t0, death.until], ["death:13", at + ARK_ACT_HOLD_SECONDS, at + ARK_ACT_HOLD_SECONDS + 4], "it lives on as a stand-in until its dying act begins; then its body is the act's own");
    const meal = arkSeenGroup("14", log, snapshot, NOW)!;
    assert.deepEqual(meal.records.map((record) => record.id), [id(8), id(4)], "hunter and prey");
    assert.equal(meal.until, meal.t0 + 20, "the hunter is aboard and the eaten one's stand-in is the meal's own from the chase's start");
    assert.equal(arkSeenGroup("16", log, snapshot, NOW)!.until, at + ARK_ACT_HOLD_SECONDS + 15 * 60, "a hunter that has left the read stands in for the whole meal");
    assert.equal(arkSeenGroup("15", log, snapshot, NOW)!.key, "escaped:15");
    // (Not acted, or not the server's yet: no group.)
    assert.equal(arkSeenGroup("40", log, snapshot, NOW), null);
    assert.equal(arkSeenGroup("30", log, snapshot, NOW), null, "a provisional kind is never brought in by the live log");
});

test("the live cast on a scene: pinned and stood in while needed, let go on time, never more than the budget, the watched one kept", () => {
    const applied: ArkCastLayer[] = [];
    const cast = new ArkCast({setCast: (layer) => void (layer && applied.push(layer))});
    const seen = new ArkSeenCast(cast, {most: 4});
    assert.equal(seen.note("14", log, snapshot, NOW)!.key, "meal:14");
    seen.note("14", log, snapshot, NOW);
    assert.equal(seen.report().groups.length, 1, "a row read twice is one group");
    assert.ok(seen.dirty());
    seen.apply();
    assert.equal(applied.length, 1, "one layout for the change");
    seen.apply();
    assert.equal(applied.length, 1, "none when nothing changed");
    assert.deepEqual(cast.roster(snapshot).animals.map((animal) => animal.id).slice(-1), [id(4)], "the eaten one stands in until the chase");
    assert.ok(cast.pins.has(id(8)) && cast.pins.has(id(4)));
    // Over the budget: the group nearest its end goes first; the watched one never.
    seen.note("11", log, snapshot, NOW);
    seen.hold("meal:14", true);
    seen.note("15", log, snapshot, NOW);
    assert.ok(seen.has("meal:14"), "the watched group is kept");
    assert.ok(seen.report().pins <= 5);
    seen.hold("meal:14", false);
    seen.step((at + ARK_ACT_HOLD_SECONDS + 30) * 1000);
    assert.equal(seen.has("meal:14"), false, "let go once the meal's own layer has its animals");
    seen.step((at + 3600) * 1000);
    assert.equal(seen.report().groups.length, 0);
    seen.apply();
    assert.equal(cast.roster(snapshot), snapshot, "the read itself again");
});

test("an extinction shares the group of the death that ended the kind, and rings its last one", () => {
    const cast = new ArkCast();
    const seen = new ArkSeenCast(cast, {most: 20});
    assert.equal(seen.note("20", log, snapshot, NOW)!.key, "death:20");
    assert.equal(cast.marks.size, 0);
    assert.equal(seen.note("21", log, snapshot, NOW)!.key, "death:20");
    assert.deepEqual(Array.from(cast.marks), [id(20)]);
    assert.equal(seen.report().groups.length, 1);
});

test("the crises read: an open crisis's living animals are pinned, the last one ringed; never an animal the read does not have; a lone founder is no crisis", () => {
    const cast = new ArkCast();
    const seen = new ArkSeenCast(cast, {most: 20});
    seen.setCrises([{id: "c1", band: "last", animals: [id(8)]}, {id: "c2", band: "critical", animals: [id(1), id(2)]}, {id: "c3", band: "last", animals: [id(99)]}], snapshot);
    assert.deepEqual(Array.from(cast.pins).sort(), [id(1), id(2), id(8)].sort());
    assert.deepEqual(Array.from(cast.marks), [id(8)], "the ring is the last one's only");
    assert.deepEqual([seen.band(id(8)), seen.band(id(1)), seen.band(id(99))], ["last", "critical", null]);
    assert.deepEqual(cast.roster(snapshot).animals.map((animal) => animal.id), snapshot.animals.map((animal) => animal.id), "nobody stands in for a crisis: it is about the living");
    seen.apply();
    seen.setCrises([{id: "c1", band: "last", animals: [id(8)]}, {id: "c2", band: "critical", animals: [id(1), id(2)]}, {id: "c3", band: "last", animals: [id(99)]}], snapshot);
    assert.equal(seen.dirty(), false, "the same answer again changes nothing");
    seen.setCrises([], snapshot);
    assert.equal(cast.pins.size, 0);
    // (`lone` is the read's own field: decoded only when true.)
    const read = decodeArkSnapshot({voyage: {slug: "first", name: "Ark"}, counts: {animals: 2, species: 1, founders: 1}, zones: [], animals: [{...aboard(1, "Plains Zebra", "plains-zebra", SPECIES.zebra), lone: true}, {...aboard(2, "Plains Zebra", "plains-zebra", SPECIES.zebra), lone: false}], as_of: AT});
    assert.deepEqual(read?.animals.map((animal) => animal.lone ?? null), [true, null]);
});

// MARK: The hooks (E5, E6)

test("the public states are a hook: none today, an unknown kind dropped, and words for the selection and Ark Lite", () => {
    assert.deepEqual(arkSeenStates(snapshot), [], "neither E5 nor E6 sends the field yet: nothing is said, pinned or drawn");
    const withStates = {...snapshot, animals: [{...snapshot.animals[2], state: {kind: "stalking", target: id(1), since: AT}}, {...snapshot.animals[0], state: {kind: "wary", target: id(8)}}, {...snapshot.animals[1], state: {kind: "plotting"}}]} as unknown as ArkSnapshot;
    assert.deepEqual(arkSeenStates(withStates), [{id: id(8), kind: "stalking", target: id(1), since: at}, {id: id(1), kind: "wary", target: id(8), since: null}]);
    assert.equal(arkSeenStateText({kind: "stalking"}, "Plains Zebra"), "Stalking a Plains Zebra");
    assert.equal(arkSeenStateText({kind: "chasing"}, "Impala"), "Chasing an Impala");
    assert.equal(arkSeenStateText({kind: "stalking"}, null), "Stalking");
    assert.equal(arkSeenStateText({kind: "wounded"}, null, {wounded: "Blessé"}), "Blessé");
    assert.equal(arkSeenStateText({kind: "mate_seeking"}, null), ARK_SEEN_ENGLISH.mate_seeking);
    // (A language's own article words, `ark.replay.a`: most say the name alone.)
    assert.equal(arkSeenStateText({kind: "chasing"}, "Impala", {chasing: "Poursuit {aPrey}", a: "{animal}", an: "{animal}"}), "Poursuit Impala");
});

test("words: every one of the 45 languages has the lone mark and the states' lines, none left in English", () => {
    const dir = path.join(__dirname, "..", "data", "locales");
    const files = ["en.json", "id.json", ...readdirSync(path.join(dir, "ark")).filter((file) => file.endsWith(".json")).map((file) => path.join("ark", file))];
    assert.equal(files.length, 45);
    const read = (file: string) => (JSON.parse(readFileSync(path.join(dir, file), "utf8")) as {ark: {life: Record<string, string>; seen: Record<string, string>}}).ark;
    const en = read("en.json");
    const keys = ["searching", "stalking", "stalkingNoTarget", "chasing", "chasingNoTarget", "wary", "mateSeeking", "wounded"] as const;
    assert.equal(en.life.lone, ARK_SEEN_ENGLISH.lone);
    for (const key of keys) assert.equal(en.seen[key], ARK_SEEN_ENGLISH[key === "mateSeeking" ? "mate_seeking" : key], `en: ${key} is the fallback's`);
    for (const file of files) {
        const words = read(file);
        assert.deepEqual(Object.keys(words.seen), [...keys], `${file}: ark.seen's keys`);
        for (const [key, text] of [["lone", words.life.lone] as const, ...keys.map((key) => [key, words.seen[key]] as const)]) {
            assert.ok(typeof text === "string" && text.trim() === text && text.length > 0 && text.length <= 48, `${file}: ${key} is one short line`);
            assert.equal((text.match(/\{[A-Za-z]+\}/g) ?? []).join(","), key === "stalking" || key === "chasing" ? "{aPrey}" : "", `${file}: ${key} placeholders`);
            if (file !== "en.json") assert.notEqual(text, key === "lone" ? en.life.lone : en.seen[key], `${file}: ${key} untranslated`);
        }
        assert.equal(new Set(keys.map((key) => words.seen[key])).size, keys.length, `${file}: eight different lines`);
    }
});

test("the wounded hook: an animal the read says is wounded limps as one that got away does, until it is off the list", () => {
    const escapes = new LiveEscapes<string>({find: () => null, chase: () => null, scheduleAt: () => null, ground: () => 0, walk: () => 1, flies: () => false, setAct: () => undefined, busy: () => false});
    const out: LimpOffsets = {drop: 0, roll: 0, pitch: 0};
    assert.equal(escapes.limp("a", 1000, true, 1.2, out), false);
    escapes.setWounded([{id: "a", since: 900}]);
    assert.ok(escapes.size > 0, "the scene asks the layer while anyone is wounded");
    let dipped = 0;
    for (let i = 0; i < 40; i++) if (escapes.limp("a", 1000 + i * 0.05, true, 1.2, out) && out.drop > 0) dipped++;
    assert.ok(dipped > 3, "an uneven dip as it goes");
    assert.equal(escapes.limp("a", 7000, true, 1.2, out), true, "a wound does not ease off with time");
    assert.equal(escapes.limp("a", 800, true, 1.2, out), false, "not before it");
    escapes.setWounded([]);
    assert.equal(escapes.limp("a", 1000, true, 1.2, out), false);
});

// MARK: The held chase

test("the walk to where the chase starts: from where its day had it, over the ground, turned to the start; too far is not walked", () => {
    const start: ActPose = {x: 10, z: 0, base: 0, yaw: 1.2, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false};
    const flat = () => 0;
    const first = approachPose({x: 0, z: 0, y: 0, yaw: 0}, start, 0, 1.5, flat)!;
    const middle = approachPose({x: 0, z: 0, y: 0, yaw: 0}, start, 0.5, 1.5, flat)!;
    const last = approachPose({x: 0, z: 0, y: 0, yaw: 0}, start, 1, 1.5, flat)!;
    assert.deepEqual([first.x, first.z], [0, 0], "it begins where it was: no jump");
    assert.ok(Math.abs(middle.x - 5) < 1e-9 && middle.state === "walk" && (middle.speed ?? 0) > 0);
    assert.ok(Math.abs(middle.yaw - Math.PI / 2) < 1e-9, "along its way");
    assert.deepEqual([last.x, last.z, last.yaw], [10, 0, 1.2], "and ends as the chase starts it");
    assert.equal(approachPose({x: 0, z: 0, y: 0, yaw: 0}, {...start, x: 400}, 0.5, 1.5, flat), null, "too far to walk in the time: it is simply there, as before");
    assert.equal(approachPose({x: 0, z: 0, y: 6, yaw: 0}, {...start, base: 8}, 0.5, 1.5, flat)!.state, "fly");
    assert.ok(APPROACH_SECONDS < ARK_ACT_HOLD_SECONDS);
});

test("meals from the log are added as read, held, and not doubled by the hunting read's own set", () => {
    const acts: Array<[string, ActPose | null]> = [];
    const meals = new LiveMeals<string>({
        find: () => null,
        ghost: () => null,
        drop: () => undefined,
        stage: () => null,
        scheduleAt: () => null,
        candidates: () => [],
        eats: () => false,
        ground: () => 0,
        walk: () => 1,
        setAct: (entry, pose) => void acts.push([entry, pose]),
        busy: () => false,
        hold: () => undefined
    });
    const act = (predator: number, prey: number): MealAct => ({kind: "meal", at: AT, predator: lion(predator) as unknown as MealAct["predator"], prey: zebra(prey) as unknown as MealAct["prey"], phrase: null, extinct: false, encounter: encounter as unknown as MealAct["encounter"]});
    meals.add([act(8, 4)], at + 10);
    assert.equal(meals.size, 1);
    assert.equal(meals.debug()[0].t0, at + ARK_ACT_HOLD_SECONDS, "held until the record is out, not the encounter's step");
    meals.add([act(8, 4)], at + 12);
    assert.equal(meals.size, 1, "a row read twice is one meal");
    meals.set([act(8, 4), act(9, 5)]);
    assert.equal(meals.size, 2, "the hunting read's row of the same meal does not double it");
    meals.set([]);
    assert.deepEqual(meals.debug().map((m) => m.key.split("@")[0]), [`${id(8)}>${id(4)}`], "what the log added stays whatever the hunting read lists");
    meals.add([], at + 3 * 3600);
    assert.equal(meals.size, 0, "until it is long over");
    assert.equal(arkPinnedMs(), null);
});

// MARK: Watching

function fakeScene(acts: Partial<ArkLiveActs> = {}) {
    const calls: Array<[string, unknown]> = [];
    const places: Record<string, ArkLocated> = {};
    const note = (name: string) => (value: unknown) => void calls.push([name, value]);
    let view: ArkCameraView = {target: {x: 200, y: 0, z: 0}, distance: 80, polar: 1, azimuth: 0};
    const handle = {
        setCast: note("setCast"),
        addMatings: note("addMatings"),
        addDeaths: note("addDeaths"),
        addEscapes: note("addEscapes"),
        setMeals: note("setMeals"),
        clearLiveActs: note("clearLiveActs"),
        setHours: note("setHours"),
        select: note("select"),
        follow: note("follow"),
        setView: (next: ArkCameraView) => {
            view = next;
            calls.push(["setView", next]);
        },
        stats: () => ({tier: "high", lite: false}),
        locate: (animalId: string) => places[animalId] ?? null,
        liveActs: () => ({meals: [], matings: [], births: [], escapes: [], deaths: [], ...acts}),
        view: () => view
    } as unknown as ArkSceneHandle;
    const put = (animalId: string, x: number, z: number, y = 1) => (places[animalId] = {x, y, z, ground: 0, length: 2, height: 1.4, awake: true, yaw: 0, act: null, shown: true});
    return {handle, calls, put};
}

test("watching live: the Ark's own clock (nothing pinned, cut or fed again), the shared cast's group brought and released, never detached", () => {
    const replay = planArkEventReplay(15, log, snapshot, {now: NOW});
    const scene = fakeScene({escapes: [{key: "escaped:15", t0: replay.t0, prey: id(2), predator: id(9), phase: "acting", kind: "sprint", missAt: 8, seconds: 16, closest: 1, gap: 1}] as unknown as ArkLiveActs["escapes"]});
    scene.put(id(9), 0, 0);
    scene.put(id(2), 12, 0);
    const cast = new ArkCast(scene.handle);
    cast.bring("crises", []).apply();
    const before = scene.calls.length;
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 0.5, live: true, cast});
    shot.begin();
    shot.settle();
    assert.equal(arkPinnedMs(), null, "the clock is everyone's");
    assert.ok(Math.abs(arkEpochSeconds() - Date.now() / 1000) < 2);
    const fed = scene.calls.slice(before).map(([name]) => name);
    assert.deepEqual(fed, ["setCast"], "only the cast: the layers are the live log's, and nothing of them is let go");
    assert.ok(cast.pins.has(id(2)) && cast.pins.has(id(9)));
    assert.ok(cast.roster(snapshot).animals.some((animal) => animal.id === id(9)), "the hunter that has left the read stands in");
    assert.ok(shot.step(0, 0));
    assert.deepEqual(shot.report().cuts, [], "no cut: nothing is moved on");
    shot.end();
    assert.equal(arkPinnedMs(), null);
    assert.equal(cast.pins.size, 0, "its group released");
    assert.deepEqual(scene.calls.slice(-1)[0][0], "setCast");
    assert.notEqual(scene.calls.slice(-1)[0][1], null, "the shared cast stays in the scene");
    assert.ok(!scene.calls.slice(before).some(([name]) => name === "clearLiveActs" || name === "setHours"));
});

test("two that share the picture are held in it: at once as far back as holds both, however fast one comes", () => {
    const replay = planArkEventReplay(11, log, snapshot, {now: NOW});
    const scene = fakeScene({matings: [{key: "mated:11", phase: "acting", meet: 1, courted: 4000, mounted: 4100}] as unknown as ArkLiveActs["matings"]});
    scene.put(id(1), 0, 0);
    scene.put(id(2), 4, 0);
    const cast = new ArkCast(scene.handle);
    const shot = createArkReplayShot({handle: scene.handle, replay, aspect: () => 9 / 16, lead: 0.5, live: true, cast});
    shot.begin();
    const inside = (view: ArkCameraView, p: {x: number; y: number; z: number}) => {
        const sp = Math.sin(view.polar);
        const cp = Math.cos(view.polar);
        const sa = Math.sin(view.azimuth);
        const ca = Math.cos(view.azimuth);
        const rel = {x: p.x - view.target.x, y: p.y - view.target.y, z: p.z - view.target.z};
        const depth = view.distance - (rel.x * sp * sa + rel.y * cp + rel.z * sp * ca);
        const half = Math.tan((38 * Math.PI) / 360);
        return depth > 0 && Math.abs(rel.x * ca - rel.z * sa) / (depth * half * (9 / 16)) < 1 && Math.abs(-rel.x * sa * cp + rel.y * sp - rel.z * ca * cp) / (depth * half) < 1;
    };
    let view = shot.step(0, 0)!;
    for (let i = 1; i <= 30; i++) view = shot.step(i / 30, 1 / 30)!;
    assert.ok(inside(view, {x: 0, y: 1, z: 0}) && inside(view, {x: 4, y: 1, z: 0}));
    const close = view.distance;
    // One of the two is suddenly 12 m off and 6 m up (a stoop, a sprint): the very next frame holds both.
    scene.put(id(2), 12, 3, 7);
    view = shot.step(31 / 30, 1 / 30)!;
    assert.ok(inside(view, {x: 0, y: 1, z: 0}) && inside(view, {x: 12, y: 7, z: 3}), "both in the picture on the next frame");
    assert.ok(view.distance > close * 1.5, "from farther back at once");
    shot.end();
});

test("a watch: nothing selected while it runs, the camera eased in from where the viewer was, ended by its act or by the viewer", () => {
    const replay = planArkEventReplay(13, log, snapshot, {now: NOW});
    const scene = fakeScene({deaths: [{key: "death:13", id: id(3), t0: replay.t0, spot: {x: 5, z: 5, base: 0, yaw: 0}, drawn: true}] as unknown as ArkLiveActs["deaths"]});
    scene.put(id(3), 5, 5);
    let clock = 100;
    const queue: Array<() => void> = [];
    const ends: string[] = [];
    const watch = startArkWatch({handle: scene.handle, cast: new ArkCast(scene.handle), replay, aspect: () => 9 / 16, now: () => clock, frame: (step) => void queue.push(step), onEnd: (why) => void ends.push(why)});
    assert.deepEqual(scene.calls.filter(([name]) => name === "select" || name === "follow").map(([name, value]) => [name, value]), [["select", null], ["follow", null]]);
    const tick = (seconds: number) => {
        clock += seconds;
        queue.splice(0).forEach((step) => step());
    };
    tick(0.1);
    const first = scene.handle.view();
    assert.ok(first.target.x > 150, "the way in begins where the viewer was");
    for (let i = 0; i < 40; i++) tick(0.05);
    assert.ok(Math.abs(scene.handle.view().target.x - 5) < 1, "then on the act");
    assert.ok(watch.running());
    watch.stop("touched");
    assert.deepEqual(ends, ["touched"]);
    assert.equal(watch.running(), false);
    tick(0.1);
    assert.equal(queue.length, 0, "no frame asked for once it has ended");
    const mixed = mixArkViews({target: {x: 0, y: 0, z: 0}, distance: 10, polar: 1, azimuth: 3}, {target: {x: 10, y: 0, z: 0}, distance: 1000, polar: 0.5, azimuth: -3}, 0.5);
    assert.ok(Math.abs(mixed.distance - 100) < 1e-6 && Math.abs(mixed.target.x - 5) < 1e-9);
    assert.ok(Math.abs(mixed.azimuth - (3 + (2 * Math.PI - 6) / 2)) < 1e-9, "the short way round");
});
