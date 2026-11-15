/**
 * Lane ark-its-day (2026-11-15): zoo feeding inside the residents' waking hours, and "Its day", an animal's whole day
 * worked out from the same schedule and status function the card reads.
 */

import assert from "node:assert/strict";
import {existsSync, readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {awakeAt, flightSpan, forgetSchedules, scheduleWorld, tripAt, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {DAY_CELL_READ, DAY_STEP_SECONDS, dayCursor, dayKeyAt, planOf, scheduleStatus, type ScheduleSubject} from "@/ark-scene/animal-status";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {FAST_DAY, FEED_HOURS, residentFeeding, WEEKLY_FEED_DAY, zooFeedingAt} from "@/ark-scene/islands/town/zoo-life";
import {ZOO_ENCLOSURE_TYPES, ZOO_TYPES, zooFeedingTimes, zooRhythm, type ZooRhythm} from "@/ark-scene/islands/town/zoo-types";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {mergeArkIslandsRouting} from "@/lib/ark-islands-local";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {ARK_CARD_ENGLISH, arkDayText, arkDayWindow, arkStatusWords, ARK_DAY_BACK_MS, ARK_DAY_MAX_MS, type ArkAnimalDay} from "./ark-animal-status";

// MARK: Zoo feeding by waking hours

const RHYTHM_ACTIVITY: Record<ZooRhythm, Array<ArkBehaviourProfile["activity"]>> = {day: ["diurnal", "any"], night: ["nocturnal"], twilight: ["crepuscular"]};
const someProfile = behaviourProfile("lion");
const clock = (hours: number, weekday: number) => ({hours, day: 7 * 100 + weekday});

/** Awake through the whole of a feeding (each minute of it), by the schedule's own rule. */
function awakeThrough(profile: ArkBehaviourProfile, activity: ArkBehaviourProfile["activity"] | null | undefined, start: number): boolean {
    for (let m = 0; m < FEED_HOURS * 60; m++) if (!awakeAt(profile, activity, start + m / 60)) return false;
    return true;
}

test("every enclosure type feeds each rhythm inside its waking hours (the schedule's awakeAt), and keeps real-zoo practice", () => {
    for (const type of ZOO_ENCLOSURE_TYPES) {
        for (const rhythm of ["day", "night", "twilight"] as const) {
            const times = zooFeedingTimes(type, rhythm);
            assert.ok(times.length >= 1, `${type} feeds its ${rhythm} residents`);
            for (const activity of RHYTHM_ACTIVITY[rhythm]) for (const start of times) assert.ok(awakeThrough(someProfile, activity, start), `${type} ${rhythm} (${activity}) at ${start}`);
        }
    }
    // The defect: the nocturnal house fed at 11:00 while its residents slept. Now at dusk, as its lights go down.
    assert.deepEqual([...zooFeedingTimes("nocturnal_house", "night")], [18.5]);
    assert.ok(!zooFeedingAt("nocturnal_house", clock(11.1, 2), ["night"]));
    assert.ok(zooFeedingAt("nocturnal_house", clock(18.6, 2), ["night"]));
    // Dawn and dusk animals at dawn and dusk (at dusk only where the type is fed once a day).
    assert.deepEqual([...zooFeedingTimes("hoofstock_paddocks", "twilight")], [6, 17.5]);
    assert.deepEqual([...zooFeedingTimes("big_cats", "twilight")], [17.5]);
    // The day round as before; big cats' fast day and the reptile house's weekly feed whatever the rhythm.
    assert.deepEqual([...zooFeedingTimes("savanna_paddocks", "day")], [9, 15]);
    for (const rhythm of ["day", "night", "twilight"] as const) {
        const [start] = zooFeedingTimes("big_cats", rhythm);
        assert.equal(zooFeedingAt("big_cats", clock(start + 0.1, FAST_DAY), [rhythm]), null, `big cats fast (${rhythm})`);
        assert.ok(zooFeedingAt("big_cats", clock(start + 0.1, (FAST_DAY + 2) % 7), [rhythm]));
        const [snake] = zooFeedingTimes("reptile_house", rhythm);
        assert.equal(zooFeedingAt("reptile_house", clock(snake + 0.1, (WEEKLY_FEED_DAY + 1) % 7), [rhythm]), null, `reptiles weekly (${rhythm})`);
        assert.ok(zooFeedingAt("reptile_house", clock(snake + 0.1, WEEKLY_FEED_DAY), [rhythm]));
    }
    // An enclosure's food goes down at any of its residents' rhythms' times; a resident only at its own, and only awake.
    assert.ok(zooFeedingAt("aquarium", clock(18.6, 1), ["day", "night"]));
    assert.equal(zooFeedingAt("aquarium", clock(18.6, 1)), null, "the day round alone by default");
    assert.equal(residentFeeding("aquarium", "day", clock(18.6, 1), true), null);
    assert.ok(residentFeeding("aquarium", "night", clock(18.6, 1), true));
    assert.equal(residentFeeding("aquarium", "night", clock(18.6, 1), false), null, "asleep at its feed, it sleeps on");
    assert.equal(zooRhythm("nocturnal"), "night");
    assert.equal(zooRhythm("crepuscular"), "twilight");
    assert.equal(zooRhythm("any"), "day");
    assert.equal(zooRhythm(null), "day");
    // (Each type's day round inside a diurnal day, each feed whole before the next.)
    for (const type of ZOO_ENCLOSURE_TYPES) for (const start of ZOO_TYPES[type].feeding) assert.ok(start >= 6 && start + FEED_HOURS <= 18, `${type} ${start}`);
});

/** The real Ark and T1's routing, read in place only (never copied); skipped where they are not. */
const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/wt-view/public/ark-local/live.json";
const ROUTING = process.env.ARK_ISLANDS_ROUTING ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/real-ark/islands-routing.json";

test("the real Ark's zoo: every enclosure's feeding times fall in its residents' waking hours, and every resident is fed", {skip: !existsSync(LIVE) || !existsSync(ROUTING)}, () => {
    const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(LIVE, "utf8")), JSON.parse(readFileSync(ROUTING, "utf8")));
    const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
    const town = arkIslandSnapshot(whole, "town");
    const placed = placeTownAnimals(town.animals);
    const byEnclosure = new Map<string, {type: (typeof ZOO_ENCLOSURE_TYPES)[number]; rhythms: Set<ZooRhythm>; residents: number}>();
    let residents = 0;
    let unfed = 0;
    for (const animal of town.animals) {
        const enclosure = placed.town.get(animal.id)?.enclosure;
        if (!enclosure) continue;
        residents++;
        const profile = behaviourProfile(animal.model_slug);
        // (Its rhythm as the scene reads it: its own activity, else its kind's.)
        const rhythm = zooRhythm(animal.activity ?? profile.activity);
        const times = zooFeedingTimes(enclosure.type, rhythm);
        if (!times.length) unfed++;
        for (const start of times) assert.ok(awakeThrough(profile, animal.activity, start), `${animal.model_slug} (${animal.activity ?? profile.activity}) in ${enclosure.id} fed at ${start} asleep`);
        const known = byEnclosure.get(enclosure.id) ?? {type: enclosure.type, rhythms: new Set<ZooRhythm>(), residents: 0};
        known.rhythms.add(rhythm);
        known.residents++;
        byEnclosure.set(enclosure.id, known);
    }
    assert.ok(residents > 100, `${residents} zoo residents`);
    assert.equal(unfed, 0);
    // Each enclosure's food goes down only when one of its residents is up to eat it.
    for (const [id, e] of Array.from(byEnclosure.entries())) {
        for (let minute = 0; minute < 24 * 60; minute += 5) {
            const hours = minute / 60;
            if (!zooFeedingAt(e.type, clock(hours, 2), Array.from(e.rhythms))) continue;
            const up = Array.from(e.rhythms).some((rhythm: ZooRhythm) => RHYTHM_ACTIVITY[rhythm].some((activity) => awakeAt(someProfile, activity, hours)));
            assert.ok(up, `${id} fed at ${hours} with nobody awake`);
        }
    }
    const house = Array.from(byEnclosure.entries()).filter(([, e]) => e.type === "nocturnal_house");
    assert.ok(house.length && house.every(([, e]) => e.rhythms.has("night")), "the nocturnal house's residents are night animals, fed at dusk");
    console.log(`real zoo: ${residents} residents in ${byEnclosure.size} enclosures, all fed awake`);
});

// MARK: Its day

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark;

test("its day's words: en.json's card words are the embed's fallback, in every Ark locale", () => {
    assert.deepEqual(english.card, ARK_CARD_ENGLISH);
    const keys = ["itsDay", "dayLast", "dayEarlier", "dayLater", "dayNow", "dayWorking", "dayRecord", "dayNone", "dayClose", "dayHint"] as const;
    const dir = path.join(__dirname, "..", "data", "locales");
    const files = ["en.json", "id.json"];
    const ark = readdirSync(path.join(dir, "ark")).filter((f) => f.endsWith(".json")).map((f) => path.join("ark", f));
    for (const file of [...files, ...ark]) {
        const card = JSON.parse(readFileSync(path.join(dir, file), "utf8")).ark.card;
        for (const key of keys) assert.ok(typeof card[key] === "string" && card[key].trim(), `${file} ark.card.${key}`);
        if (file !== "en.json") assert.notEqual(card.itsDay, ARK_CARD_ENGLISH.itsDay, `${file} translated`);
    }
    assert.ok(ark.length >= 40, `${ark.length} Ark locales`);
});

test("a day's window: at most a day long, never past now, at most a week back", () => {
    const now = Date.UTC(2026, 10, 15, 12);
    assert.deepEqual(arkDayWindow(now - ARK_DAY_MAX_MS, now, now), {from: now - ARK_DAY_MAX_MS, to: now});
    assert.deepEqual(arkDayWindow(now - 3 * ARK_DAY_MAX_MS, now + 5000, now), {from: now - ARK_DAY_MAX_MS, to: now});
    const far = arkDayWindow(now - 30 * ARK_DAY_MAX_MS, now - 29 * ARK_DAY_MAX_MS, now);
    assert.equal(far, null, "past the week back");
    assert.ok(arkDayWindow(now - ARK_DAY_BACK_MS - ARK_DAY_MAX_MS, now - ARK_DAY_BACK_MS, now));
    assert.equal(arkDayWindow(NaN, now, now), null);
});

const snapshot = decodeArkSnapshot(fixtureV2)!;
const world = scheduleWorld(sceneSampler());
const places = placeAnimals(snapshot.animals);
const SEA = new Set(["coral_reef", "open_ocean"]);
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

/** The fixture's animals on the schedule, grouped as the scene groups them. */
function subjects(): Array<{subject: ScheduleSubject; animal: ScheduleAnimal}> {
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
    return items.map((i) => ({animal: i.animal, subject: {id: i.a.id, world, profile: i.profile, animalAt: () => i.animal, activity: i.a.activity, hoursAt}}));
}

const DAY = Math.floor(Date.UTC(2026, 10, 14) / 1000);

/** What the card says at a time: its status with the trip the scene would have it on then. */
function cardSays(s: {subject: ScheduleSubject; animal: ScheduleAnimal}, t: number) {
    return scheduleStatus(s.subject, t, {trip: tripAt(world, s.subject.profile, s.animal, t, hoursAt, s.subject.activity)}).activity;
}

test("its day says what the card says at every sampled moment (the same schedule and status function), dawn, midday, dusk, night", () => {
    forgetSchedules();
    const all = subjects();
    // A spread of them: flyers, swimmers, walkers, sleepers, every kind of day (and the fixture's first few of each move).
    const picked: typeof all = [];
    const seen = new Map<string, number>();
    for (const s of all) {
        const key = `${s.subject.profile.move}:${s.subject.activity ?? s.subject.profile.activity}`;
        if ((seen.get(key) ?? 0) >= 3) continue;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        picked.push(s);
    }
    let checked = 0;
    let flying = 0;
    const kinds = new Set<string>();
    for (let n = 0; n < picked.length; n++) {
        const s = picked[n];
        for (const at of [5.5, 12, 18, 23]) {
            const from = DAY + at * 3600 + (n % 7) * 13.7;
            const to = from + 40 * 60;
            const cursor = dayCursor(s.subject, from, to);
            while (!cursor.done) cursor.step();
            // Whole and in order, no gaps.
            assert.equal(cursor.runs[0].from, from);
            assert.equal(cursor.runs[cursor.runs.length - 1].to, to);
            for (let k = 1; k < cursor.runs.length; k++) {
                assert.ok(Math.abs(cursor.runs[k].from - cursor.runs[k - 1].to) < 1e-6, "no gaps");
                assert.notEqual(cursor.runs[k].key, cursor.runs[k - 1].key, "runs merged");
            }
            // Sampled moments (each at a cell's reading point): its day says what the card says.
            for (let j = 0; j < 14; j++) {
                const plan = planOf(s.subject, from + ((j * 997 + n * 131) % (to - from - SLOT_SECONDS)) + SLOT_SECONDS / 2);
                const cell = Math.floor(((j * 37 + n) % (SLOT_SECONDS / DAY_STEP_SECONDS)));
                const t = plan.start + cell * DAY_STEP_SECONDS + DAY_CELL_READ;
                if (t < from || t >= to) continue;
                const says = cardSays(s, t);
                assert.equal(dayKeyAt(cursor.runs, t), says, `${s.subject.profile.slug} at ${hoursAt(t).toFixed(3)} h`);
                checked++;
                kinds.add(says ?? "");
                if (says === "flying") flying++;
            }
        }
    }
    assert.ok(checked > 400, `${checked} moments checked`);
    assert.ok(kinds.has("sleeping") && kinds.size >= 6, `kinds: ${Array.from(kinds).join(", ")}`);
    console.log(`its day = the card at ${checked} moments of ${picked.length} animals (${flying} flying): ${Array.from(kinds).join(", ")}`);
});

test("its day: a flight only while it is in the air, a whole day worked out slot by slot, pure (the same twice)", () => {
    forgetSchedules();
    const all = subjects();
    const flyer = all.find((s) => s.subject.profile.move === "fly" && (s.subject.activity ?? s.subject.profile.activity) === "diurnal");
    assert.ok(flyer, "a diurnal flyer in the fixture");
    const from = DAY + 9 * 3600;
    const cursor = dayCursor(flyer!.subject, from, from + 3 * 3600);
    while (!cursor.done) cursor.step();
    for (const run of cursor.runs.filter((r) => r.key === "flying")) {
        const t = run.from + DAY_CELL_READ;
        const span = flightSpan(tripAt(world, flyer!.subject.profile, flyer!.animal, t, hoursAt, flyer!.subject.activity));
        assert.ok(span === null || (t >= span.from - DAY_STEP_SECONDS && t < span.to + DAY_STEP_SECONDS) || cardSays(flyer!, t) === "flying", "flying only in the air");
    }
    // A whole day for a handful, timed (the scene does it a few milliseconds a frame), and the same from nothing.
    const some = all.slice(0, 6);
    const began = performance.now();
    const days = some.map((s) => {
        const c = dayCursor(s.subject, DAY, DAY + 86_400);
        while (!c.done) c.step();
        return c.runs;
    });
    const ms = (performance.now() - began) / some.length;
    forgetSchedules();
    const again = some.map((s) => {
        const c = dayCursor(s.subject, DAY, DAY + 86_400);
        while (!c.done) c.step();
        return c.runs;
    });
    assert.deepEqual(again, days, "a pure function of the clock and the ids");
    const words = arkStatusWords(english);
    const day: ArkAnimalDay = {id: some[0].subject.id, from: DAY * 1000, to: (DAY + 86_400) * 1000, since: DAY * 1000, done: true, segments: days[0].map((r) => ({from: r.from * 1000, to: r.to * 1000, activity: r.key})), events: [{id: "meal:1", source: "record", at: (DAY + 3600) * 1000, day: 12, kind: "meal", other: "Zebra"}]};
    const text = arkDayText(day, words, "en");
    assert.equal(text.segments.length, day.segments.length);
    assert.match(text.events[0].text, /Ate a Zebra/);
    assert.match(text.events[0].stamp, /01:00/);
    console.log(`a whole day: ${ms.toFixed(0)} ms an animal here (${(ms / (86_400 / SLOT_SECONDS)).toFixed(2)} ms a slot)`);
});
