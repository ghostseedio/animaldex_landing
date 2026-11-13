import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import fixtureEvents from "@/ark-scene/fixtures/events.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, groupSpread, rangeReach, slotPlanAt, spaceHomes, tripAt, wireThreats, SLOT_SECONDS, type ArkDoing, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {MOMENT_WINDOW_SECONDS, momentKind, pickMoment, planOf, scheduleStatus, slotStartIn, type MomentSubject} from "@/ark-scene/animal-status";
import {eats} from "@/ark-scene/food-links";
import {placeAnimals} from "@/ark-scene/placement";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {scheduleWorld} from "@/ark-scene/behaviour-schedule";
import type {ArkAnimal} from "@/ark-scene/types";
import {decodeArkEvents} from "./ark-life";
import {ArkLiveLog, ArkSeenMemory, arkLiveLineText, arkNowItems, type ArkLiveText} from "./ark-live-log";
import {ARK_LIVE_ENGLISH} from "./ark-live-words";
import {
    ARK_ACTIVITIES,
    ARK_ACTIVITY_ENGLISH,
    ARK_CARD_ENGLISH,
    ARK_ENERGY_FLOOR,
    ARK_HUNGER_DAYS,
    arkActivityKey,
    arkBarTone,
    arkEnergy,
    arkInDays,
    arkNextHuntIn,
    arkOriginEntry,
    arkRecordNotesFromEvents,
    arkRecordNoteFromLife,
    arkStatusBars,
    arkStatusForHost,
    arkStatusLog,
    arkStatusText,
    arkStatusWords,
    type ArkAnimalStatus,
    type ArkStatusLogEntry
} from "./ark-animal-status";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark;
const snapshot = decodeArkSnapshot(fixtureV2)!;

// MARK: Words

test("English: the activity and card words in en.json are the ones the embed falls back to", () => {
    assert.deepEqual(english.activity, ARK_ACTIVITY_ENGLISH);
    assert.deepEqual(english.card, ARK_CARD_ENGLISH);
    for (const key of ARK_ACTIVITIES) assert.ok(typeof english.activity[key] === "string" && english.activity[key].trim(), `ark.activity.${key}`);
});

// MARK: The mapping

const DOINGS: ArkDoing[] = ["sleep", "to_roost", "watch", "rest", "wander", "forage", "graze", "browse", "drink", "perch", "fly", "soar", "swim", "breathe", "dive", "bask", "burrow", "climb", "groom", "hide", "visit_flowers", "circle_light", "crawl", "stalk", "play", "idle"];

test("every doing and every recipe of the schedule has its own words (none falls to 'out and about')", () => {
    for (const doing of DOINGS) assert.notEqual(arkActivityKey({doing}), "about", doing);
    for (const id of Object.keys(TEMPLATES)) {
        const doing = (TEMPLATES as Record<string, {doing: string}>)[id].doing;
        const key = arkActivityKey({doing, recipe: id});
        assert.ok((ARK_ACTIVITIES as readonly string[]).includes(key), `${id} → ${key}`);
        assert.notEqual(key, "about", id);
    }
});

test("the mapping: hunting and sleep first, a recipe says more than its doing, on the way to water, off the schedule", () => {
    assert.equal(arkActivityKey({doing: "forage", hunting: true}), "hunting");
    assert.equal(arkActivityKey({doing: "sleep", recipe: "incubate_sit"}), "sleeping");
    assert.equal(arkActivityKey({doing: "rest", recipe: "incubate_sit"}), "eggs");
    assert.equal(arkActivityKey({doing: "forage", recipe: "nest_build"}), "nest");
    assert.equal(arkActivityKey({doing: "forage", recipe: "wade_spear"}), "fishing");
    assert.equal(arkActivityKey({doing: "drink", travelling: true}), "toWater");
    assert.equal(arkActivityKey({doing: "drink"}), "drinking");
    assert.equal(arkActivityKey({doing: "watch", wary: true}), "wary");
    assert.equal(arkActivityKey({doing: "forage", feeding: true}), "feeding");
    assert.equal(arkActivityKey({doing: "to_roost", feeding: true}), "home");
    // The schedule's stalk is never "hunting" (card truth, 2026-11-13): visual only, nothing is chosen or caught. Held still where
    // it goes (in the water) it waits for prey; creeping on the ground, or on its way, it is on the prowl. "Hunting" is
    // the server's encounter hunt alone.
    assert.equal(arkActivityKey({doing: "stalk"}), "prowling");
    assert.equal(arkActivityKey({doing: "stalk", still: true}), "waiting");
    assert.equal(arkActivityKey({doing: "stalk", still: true, travelling: true}), "prowling");
    assert.equal(arkActivityKey({doing: "stalk", still: true, hunting: true}), "hunting");
    assert.equal(arkActivityKey({doing: "rest", still: true}), "resting", "still says nothing of anything but a stalk");
    assert.equal(arkActivityKey({doing: "graze"}), "grazing");
    assert.equal(arkActivityKey({doing: "graze", flyer: true}), "food", "a seed-eating bird looks for food");
    assert.equal(arkActivityKey({doing: null, asleep: true}), "sleeping");
    assert.equal(arkActivityKey({doing: null, airborne: true}), "flying");
    assert.equal(arkActivityKey({doing: null}), "about");
});

// MARK: The schedule (the fixture's animals, wired as the scene wires them)

const world = scheduleWorld(sceneSampler());
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
type Item = {a: ArkAnimal; animal: ScheduleAnimal; subject: MomentSubject};

function wire(): Item[] {
    const items = snapshot.animals.map((a) => {
        const p = places.get(a.id)!;
        const profile = behaviourProfile(a.model_slug);
        const animal: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength(a), sea: SEA.has(a.zone), young: a.origin === "born"};
        return {a, animal, profile};
    });
    const byId = new Map(items.map((i) => [i.a.id, i]));
    const sizes = new Map<string, number>();
    for (const i of items) {
        const lead = places.get(i.a.id)!.leader;
        if (lead && lead !== i.a.id) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
    }
    for (const i of items) {
        const place = places.get(i.a.id)!;
        const leader = place.leader && place.leader !== i.a.id ? byId.get(place.leader) : null;
        if (leader && leader.a.model_slug === i.a.model_slug && GROUPED.has(i.profile.social)) i.animal.group = {leader: leader.animal, profile: leader.profile, activity: leader.a.activity, rank: Math.max(place.rank ?? 1, 1), size: sizes.get(leader.a.id) ?? 2};
    }
    const radius = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, i.animal) + (sizes.has(i.a.id) ? groupSpread(i.animal.length, sizes.get(i.a.id)!) : 0)]));
    const spaced = spaceHomes(
        items.filter((i) => !i.animal.group).map((i) => ({id: i.a.id, slug: i.a.model_slug, home: i.animal.home, length: i.animal.length, walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : world.nav.walkable(x, z))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const i of items) {
        const moved = spaced.get(i.a.id);
        if (!moved) continue;
        i.animal.home = {x: moved.home.x, y: Math.max(world.sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        i.animal.range = moved.range;
        i.animal.prey = moved.prey;
    }
    wireThreats(items.map((i) => ({slug: i.a.model_slug, animal: i.animal, profile: i.profile, activity: i.a.activity})), eats);
    return items.map((i) => ({a: i.a, animal: i.animal, subject: {id: i.a.id, world, profile: i.profile, animalAt: () => i.animal, activity: i.a.activity, hoursAt, young: Boolean(i.animal.young), leads: sizes.get(i.a.id) ?? 0, surfaces: i.profile.breathes && SEA.has(i.a.zone)}}));
}
const items = wire();
const DAY = Math.floor(Date.UTC(2026, 10, 12) / 1000);
const MOMENTS = [DAY + 6.5 * 3600, DAY + 12 * 3600 + 17, DAY + 19.25 * 3600, DAY + 23 * 3600 + 41];

test("the status is a pure function of the clock and the animal: the same on two runs, and it says what its trip is", () => {
    const run = () => items.flatMap((i) => MOMENTS.map((t) => scheduleStatus(i.subject, t, {trip: tripAt(world, i.subject.profile, i.animal, t, hoursAt, i.a.activity)})));
    forgetSchedules();
    const first = run();
    forgetSchedules();
    const second = run();
    assert.deepEqual(second, first);
    // Its activity is its trip's (the one the scene draws), and its log only its own earlier slots.
    for (const i of items) {
        for (const t of MOMENTS) {
            const trip = tripAt(world, i.subject.profile, i.animal, t, hoursAt, i.a.activity);
            const status = scheduleStatus(i.subject, t, {trip});
            const still = planOf(i.subject, t).still;
            const settled = arkActivityKey({doing: trip.doing, recipe: trip.recipe, flyer: i.subject.profile.move === "fly", still});
            assert.ok(status.activity === settled || status.activity === "wary" || (status.activity === "toWater" && trip.doing === "drink") || (status.activity === "prowling" && settled === "waiting"), `${i.a.model_slug} at ${t}: ${status.activity} vs its trip's ${trip.doing}/${trip.recipe}`);
            assert.ok(status.since <= t && status.since > t - 11 * SLOT_SECONDS);
            for (const entry of status.log) {
                assert.equal(entry.source, "schedule");
                assert.ok(entry.at / 1000 < status.since + 0.001, "older than what it is doing now");
                const plan = slotPlanAt(world, i.subject.profile, i.animal, entry.at / 1000 + 0.5, hoursAt, i.a.activity);
                assert.equal(arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, flyer: i.subject.profile.move === "fly", still: plan.still}), entry.activity, "each line is what its slot was for");
            }
            if (status.goal?.kind === "wakes") assert.equal(trip.doing, "sleep");
            if (status.goal) assert.ok(status.goal.at > t - SLOT_SECONDS);
        }
    }
});

test("a stalk says what the body does (card truth, 2026-11-13): held still in the water it waits for prey, moving it is on the prowl", () => {
    // Every stalk slot of the fixture's animals over a day and a night: a still one's stay never moves it from where it
    // arrives (the owner's electric eel: "hunting" and not moving), and once there the card says it is waiting; a moving
    // one creeps, and the card says it is on the prowl. Never "hunting".
    forgetSchedules();
    let still = 0;
    let moving = 0;
    const kinds = new Set<string>();
    for (const i of items) {
        if (!(i.subject.profile.weights.stalk ?? 0)) continue;
        for (let t = DAY; t < DAY + 86_400; t += SLOT_SECONDS) {
            const plan = planOf(i.subject, t);
            if (plan.doing !== "stalk") continue;
            const trip = tripAt(world, i.subject.profile, i.animal, t, hoursAt, i.a.activity);
            if (trip.doing !== "stalk") continue;
            const spread = Math.max(0, ...trip.stay.map((b) => Math.hypot(b.x - trip.to.x, b.z - trip.to.z)));
            const settled = scheduleStatus(i.subject, Math.min(Math.max(trip.arrive + 1, t), trip.end - 1), {trip});
            if (plan.still) {
                still++;
                kinds.add(i.a.model_slug);
                assert.ok(spread < 1e-6, `${i.a.model_slug}: a still stalk holds still (${spread.toFixed(2)} m)`);
                assert.equal(settled.activity, "waiting", i.a.model_slug);
            } else {
                moving++;
                assert.equal(settled.activity, "prowling", i.a.model_slug);
            }
            assert.notEqual(settled.activity, "hunting");
        }
    }
    assert.ok(still > 0 && moving > 0, `the fixture has both kinds of stalk (still ${still}, moving ${moving})`);
});

test("the live log's moments: the same on two runs, at most one a window, and each one is its animal's own new slot", () => {
    const windows = Array.from({length: 240}, (_, k) => Math.floor((DAY + 7 * 3600) / MOMENT_WINDOW_SECONDS) + k);
    const subjects = items.map((i) => i.subject);
    forgetSchedules();
    const first = windows.map((w) => pickMoment(w, subjects));
    forgetSchedules();
    const second = windows.map((w) => pickMoment(w, [...subjects].reverse()));
    assert.deepEqual(second, first, "the order the animals come in changes nothing");
    const said = first.filter((m) => m !== null);
    assert.ok(said.length > 0, "a morning of the fixture's 130 animals has moments");
    first.forEach((moment, k) => {
        if (!moment) return;
        const subject = subjects.find((s) => s.id === moment.animalId)!;
        const from = windows[k] * MOMENT_WINDOW_SECONDS;
        // Its slot starts in the window, and that slot's plan is the moment (not made up).
        assert.equal(slotStartIn(subject.id, from, from + MOMENT_WINDOW_SECONDS), moment.at);
        assert.equal(momentKind(subject, planOf(subject, moment.at + 0.5), planOf(subject, moment.at - 0.5)), moment.kind);
        const plan = planOf(subject, moment.at + 0.5);
        assert.equal(arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, flyer: subject.profile.move === "fly", still: plan.still}), moment.activity, "its activity is its slot's");
        assert.ok(moment.kind !== "hunting" || plan.doing !== "stalk", "a stalk is never said as a hunt");
    });
    // A steady flow: most windows of a busy morning say something.
    assert.ok(said.length >= windows.length * 0.2, `${said.length} of ${windows.length} windows`);
});

// MARK: The log: only the record's and the schedule's lines

test("the record's lines come only from the server's events, each about an animal the event names", () => {
    const events = decodeArkEvents(fixtureEvents, snapshot);
    const notes = arkRecordNotesFromEvents(events);
    const ids = new Set(events.map((e) => e.id));
    assert.ok(notes.length > 0);
    for (const note of notes) {
        const id = note.id.replace(/^(event|young|laid|mated):/, "").split(":")[0];
        assert.ok(ids.has(id), `${note.id} names an event`);
        const event = events.find((e) => e.id === id)!;
        const named = [event.animal?.id, ...event.parents].filter(Boolean);
        assert.ok(named.includes(note.animalId), `${note.id} is about an animal its event names`);
    }
    // A litter is one line per parent, its young counted.
    const births = events.filter((e) => e.kind === "birth" && e.parents.length);
    if (births.length) {
        const young = notes.filter((n) => n.kind === "young");
        assert.ok(young.every((n) => (n.count ?? 0) >= 1));
        assert.ok(young.length <= births.length * 2);
    }
    assert.equal(arkRecordNoteFromLife("a", {last_meal: null}, 0), null);
    assert.equal(arkRecordNoteFromLife("a", {last_meal: {at: null, prey: "Field Vole"}}, 0), null);
    const meal = arkRecordNoteFromLife("a", {last_meal: {at: "2026-11-10T00:00:00Z", prey: "Field Vole"}}, Date.parse("2026-11-08T21:45:21Z"))!;
    assert.equal(meal.kind, "meal");
    assert.equal(meal.day, Math.floor((Date.parse("2026-11-10T00:00:00Z") - Date.parse("2026-11-08T21:45:21Z")) / ((86_400_000 * 14) / 365)));
});

test("an animal's log: newest first, nothing but what it was given, and its arrival kept", () => {
    const origin = arkOriginEntry({id: "a", arrived_at: "2026-04-02T15:41:23Z", origin: "arrived", born_ark_day: 77.08, source: "capture"});
    assert.deepEqual({kind: origin.kind, day: origin.day, via: origin.via}, {kind: "arrived", day: 77, via: "capture"});
    const schedule: ArkStatusLogEntry[] = Array.from({length: 9}, (_, k) => ({id: `slot:a:${k}`, source: "schedule", at: Date.parse("2026-11-12T10:00:00Z") - k * 80_000, day: null, kind: "activity", activity: "grazing"}));
    const meal: ArkStatusLogEntry = {id: "meal:a", source: "record", at: Date.parse("2026-11-11T10:00:00Z"), day: 88, kind: "meal", other: "Field Vole"};
    const log = arkStatusLog(schedule, [origin, meal, meal]);
    assert.equal(log.length, 8);
    assert.ok(log.every((entry, k) => k === 0 || log[k - 1].at >= entry.at || entry.id === origin.id), "newest first");
    assert.equal(log[log.length - 1].id, origin.id, "its arrival stays");
    assert.equal(log.filter((e) => e.id === "meal:a").length, 1, "a line once");
    const given = new Set([...schedule, origin, meal].map((e) => e.id));
    assert.ok(log.every((entry) => given.has(entry.id)), "nothing made up");
});

test("the live log's now lines come only from the scene's moments, each said once", () => {
    const memory = new ArkSeenMemory();
    const moments = [
        {id: "now:x:1", kind: "hunting" as const, activity: "hunting" as const, animalId: "x", name: "African Lion", speciesId: "s1", zone: "grassland" as const, count: 1, at: 1},
        {id: "now:y:2", kind: "toWater" as const, activity: "drinking" as const, animalId: "y", name: "Plains Zebra", speciesId: "s2", zone: "grassland" as const, count: 12, at: 2}
    ];
    const items = arkNowItems(moments, memory);
    assert.deepEqual(items.map((i) => i.id), moments.map((m) => m.id));
    assert.ok(items.every((i) => i.source === "now"));
    assert.equal(arkNowItems(moments, memory).length, 0, "said once");
    const words: ArkLiveText = {live: ARK_LIVE_ENGLISH, replay: english.replay, activity: ARK_ACTIVITY_ENGLISH};
    assert.equal(arkLiveLineText(items[0], words, "en"), "An African Lion is hunting");
    assert.equal(arkLiveLineText(items[1], words, "en"), "12 Plains Zebras are heading to water");
    const everyday = arkNowItems([{id: "now:z:3", kind: "doing", activity: "drinking", animalId: "z", name: "Red Deer", speciesId: "s4", zone: "woodland", count: 1, at: 3}, {id: "now:q:4", kind: "group", activity: "grazing", animalId: "q", name: "Plains Zebra", speciesId: "s2", zone: "grassland", count: 8, at: 4}], memory);
    assert.equal(arkLiveLineText(everyday[0], words, "en"), "A Red Deer is drinking");
    assert.equal(arkLiveLineText(everyday[1], words, "en"), "8 Plains Zebras are grazing");
    // A now line waits for the record, and comes no sooner than the seen gap after the last non-record line.
    const log = new ArkLiveLog();
    log.push(items, 0);
    log.push([{id: "e1", kind: "arrival", source: "server", key: "arrival:s3", animal: "House Sparrow", other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: null}}], 0);
    log.step(0);
    assert.equal(log.lines[0].source, "server", "the record first");
    log.step(1_200);
    assert.equal(log.lines[1]?.source, "now");
    log.step(2_400);
    assert.equal(log.lines.length, 2, "the next now line waits its gap");
    log.step(1_200 + 3_600);
    assert.equal(log.lines.length, 3);
});

// MARK: The bars

test("the bars: hunger from the last recorded meal against the hunger days, health from the server's condition", () => {
    const fed = (lastMealDay: number | null, condition: "well_fed" | "hungry" | "old" = "well_fed") => arkStatusBars({condition, arkDay: 100, lastMealDay}).fed!;
    assert.deepEqual(fed(100), {value: 1, tone: "good", state: "fed"});
    assert.equal(fed(100 - ARK_HUNGER_DAYS / 2).value, 0.65);
    assert.equal(fed(100 - ARK_HUNGER_DAYS / 2).tone, "good");
    assert.equal(fed(100 - ARK_HUNGER_DAYS * 0.8).state, "low");
    assert.equal(fed(100 - ARK_HUNGER_DAYS * 0.8).tone, "warn");
    assert.equal(fed(100 - ARK_HUNGER_DAYS).value, 0.3, "past the hunger days and still fed: amber, never red");
    assert.equal(fed(80).tone, "warn");
    assert.equal(fed(101).value, 1, "a meal after now is now");
    assert.equal(arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null}).fed, null, "no meal clock (it eats what grows round it, and the server keeps it fed): no fed bar, which could only ever be full");
    assert.deepEqual(fed(99, "hungry"), {value: 0.12, tone: "bad", state: "hungry"});
    // Monotonic: the longer since its meal, the emptier.
    let last = 2;
    for (let d = 0; d <= 10; d += 0.5) {
        const value = fed(100 - d).value;
        assert.ok(value <= last);
        last = value;
    }
    const health = (condition: "well_fed" | "hungry" | "old") => arkStatusBars({condition, arkDay: 100, lastMealDay: null}).health!;
    assert.deepEqual(health("well_fed"), {value: 1, tone: "good", state: "good"});
    assert.deepEqual(health("hungry"), {value: 0.45, tone: "warn", state: "hungry"});
    assert.deepEqual(health("old"), {value: 0.2, tone: "bad", state: "old"});
    // Age only with a lifespan (the reads don't send one: no bar).
    assert.equal(arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null}).age, null);
    assert.deepEqual(arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null, bornDay: 25, lifespanDays: 300}).age, {value: 0.75, tone: "good", state: "life"});
    assert.equal(arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null, bornDay: 0, lifespanDays: 90}).age!.value, 0);
    // An older server (no condition): no fed or health bar.
    assert.deepEqual(arkStatusBars({condition: null, arkDay: 100, lastMealDay: 99}), {fed: null, health: null, energy: null, age: null});
    assert.deepEqual([0, 0.29, 0.3, 0.59, 0.6, 1].map(arkBarTone), ["bad", "bad", "warn", "warn", "good", "good"]);
});

test("the fed bar on the server's meal clock (card truth, 2026-11-13): the share of its meal still to run, true to the day", () => {
    // The live Ark's numbers (2026-11-13): fed at the clock start (Ark day 78.6), next hunts 216 to 7,255 Ark days on.
    const clock = (arkDay: number, last: number | null, next: number, condition: "well_fed" | "hungry" = "well_fed") => arkStatusBars({condition, arkDay, lastMealDay: last, nextHuntDay: next}).fed;
    assert.deepEqual(clock(110.3, 78.6, 78.6 + 1159), {value: 0.973, tone: "good", state: "fed"}, "the median predator: nearly full, not full");
    assert.equal(clock(110.3, 78.6, 78.6 + 216)!.value, 0.853, "the shortest meal clock");
    assert.equal(clock(78.6, 78.6, 300)!.value, 1, "just fed");
    assert.deepEqual(clock(299, 78.6, 300), {value: 0.3, tone: "warn", state: "low"}, "due: amber, never red while the server says fed");
    assert.equal(clock(400, 78.6, 300)!.value, 0.3, "past it (hunting): amber");
    assert.equal(clock(110, null, 300), null, "its meal's start not in the read: no bar (the card says when it next hunts)");
    assert.deepEqual(clock(110, 78.6, 300, "hungry"), {value: 0.12, tone: "bad", state: "hungry"}, "hungry (the server) first");
    // Going down with the days, never up.
    let last = 2;
    for (let d = 78.6; d <= 320; d += 7) {
        const value = clock(d, 78.6, 300)!.value;
        assert.ok(value <= last);
        last = value;
    }
    assert.equal(arkNextHuntIn(2763.01, 110.3)!.toFixed(2), "2652.71");
    assert.equal(arkNextHuntIn(null, 110), null);
    assert.equal(arkNextHuntIn(300, null), null);
    assert.equal(arkInDays(2652.7, "en"), "in 2,653 days");
    assert.equal(arkInDays(0.2, "en"), "in 1 day");
});

test("energy over its day, from its schedule's own sleep and wake (card truth, 2026-11-13)", () => {
    const day0 = Date.UTC(2026, 10, 13) / 1000;
    const hours = (t: number) => (((t - day0) / 3600) % 24 + 24) % 24;
    // Awake 06:00–18:00 (twelve hours), asleep the other twelve.
    const diurnal = (t: number) => hours(t) >= 6 && hours(t) < 18;
    const at = (h: number) => arkEnergy(diurnal, day0 + h * 3600)!;
    assert.ok(Math.abs(at(6).value - 1) < 0.01, `just woke: full (${at(6).value})`);
    assert.ok(Math.abs(at(12).value - 0.65) < 0.01, `midday: half-way down (${at(12).value})`);
    assert.ok(Math.abs(at(18).value - ARK_ENERGY_FLOOR) < 0.01, `bedtime: the floor (${at(18).value})`);
    assert.ok(Math.abs(at(24).value - 0.65) < 0.01, `midnight: half-way back (${at(24).value})`);
    assert.deepEqual([at(12).awake, at(24).awake], [true, false]);
    assert.equal(at(12).since, day0 + 6 * 3600, "awake since 06:00");
    assert.equal(at(23).since, day0 + 18 * 3600, "asleep since 18:00");
    // Down while awake, up while asleep, the same on two runs, and never below the floor.
    for (let h = 6.5; h < 18; h += 0.5) assert.ok(at(h).value < at(h - 0.5).value);
    for (let h = 18.5; h < 30; h += 0.5) assert.ok(at(h).value > at(h - 0.5).value);
    assert.deepEqual(at(13.3), at(13.3));
    // Two waking spells (crepuscular: dawn and dusk, five hours each, ten in all): each runs it down by half its day's
    // drain, and the sleep between fills it again.
    const twilight = (t: number) => (hours(t) >= 4 && hours(t) < 9) || (hours(t) >= 16 && hours(t) < 21);
    const e = (h: number) => arkEnergy(twilight, day0 + h * 3600)!.value;
    assert.ok(Math.abs(e(9) - 0.65) < 0.01 && Math.abs(e(21) - 0.65) < 0.01, `after each spell (${e(9)}, ${e(21)})`);
    assert.ok(e(16) > e(9) && Math.abs(e(16) - 1) < 0.01, `the midday sleep filled it (${e(16)})`);
    // One that never sleeps (or is never awake) in a day has no energy bar.
    assert.equal(arkEnergy(() => true, day0), null);
    assert.equal(arkEnergy(() => false, day0), null);
    // As a bar: amber at the lowest, never red; the bars without it as before.
    const bars = arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null, energy: at(17.9)});
    assert.equal(bars.energy!.tone, "warn");
    assert.equal(bars.energy!.state, "awake");
    assert.equal(arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: null}).energy, null);
});

test("a status in words: now, next or when it wakes, its log stamped, its bars said", () => {
    const status: ArkAnimalStatus = {
        id: "a",
        activity: "food",
        since: 0,
        goal: {kind: "next", activity: "nest", at: Date.parse("2026-11-12T10:05:00Z") / 1000},
        log: [
            {id: "slot:a:1", source: "schedule", at: Date.parse("2026-11-12T10:01:20Z"), day: null, kind: "activity", activity: "drinking"},
            {id: "meal:a", source: "record", at: 1, day: 88, kind: "meal", other: "Field Vole"},
            {id: "origin:a", source: "record", at: 0, day: 77, kind: "arrived", via: "capture"}
        ],
        bars: arkStatusBars({condition: "well_fed", arkDay: 100, lastMealDay: 95, energy: {value: 0.62, awake: true, since: Date.parse("2026-11-12T06:12:40Z") / 1000}}),
        nextHunt: null
    };
    const words = arkStatusWords(english);
    const text = arkStatusText(status, words, "en-GB");
    assert.equal(text.now, "Now: looking for food");
    assert.equal(text.next, "Next: building a nest");
    assert.deepEqual(text.log.map((l) => [l.stamp, l.text]), [["10:01", "Drinking"], ["Day 88", "Ate a Field Vole"], ["Day 77", "Came aboard with a capture"]]);
    assert.deepEqual(text.bars.map((b) => [b.key, b.text, b.tone]), [["fed", "Getting hungry", "warn"], ["health", "In good health", "good"], ["energy", "Awake since 06:12", "good"]]);
    assert.equal(text.nextHunt, null);
    // A predator's next hunt, in the reader's words; due now (it hunts when awake): getting hungry.
    assert.equal(arkStatusText({...status, nextHunt: 1128.4}, words, "en-GB").nextHunt, "Next hunt in 1,128 days");
    assert.equal(arkStatusText({...status, nextHunt: -0.5}, words, "en-GB").nextHunt, "Getting hungry");
    assert.equal(arkStatusText({...status, nextHunt: 1128.4}, arkStatusWords({}), "de").nextHunt, "Next hunt in 1.128 Tagen", "English words where the reader's lack one");
    const asleep = arkStatusText({...status, activity: "sleeping", goal: {kind: "wakes", at: Date.parse("2026-11-12T06:40:00Z") / 1000}}, words, "en-GB");
    assert.equal(asleep.now, "Now: sleeping");
    assert.equal(asleep.next, "Wakes about 06:40");
    // The apps' copy: the status as it is, and its words (English where the app's lack one).
    const host = arkStatusForHost(status, {activity: {food: "sucht Futter"}}, "de")!;
    assert.equal(host.text.now, "Now: sucht Futter");
    assert.equal(host.activity, "food");
    assert.equal(arkStatusForHost(null, null, "en"), null);
});
