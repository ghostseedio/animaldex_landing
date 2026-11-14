#!/usr/bin/env -S npx tsx
/**
 * The activity budget (behaviours pass, lane B3 needs, 2026-11-14; docs/ark/behaviour-pass-2026-11/needs.md): how each
 * species spends its 24 hours on the behaviour schedule, as its tap card would say it slot by slot: asleep, resting,
 * feeding (by kind), drinking, travelling, grooming, social, watching; how many bouts of each a day and how long they
 * run; the hours it is up; and its fed and energy bars through the day (the bar before a feeding bout and after it,
 * the energy it goes to sleep and wakes with).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-activity-budget.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--per-species 1] [--species a,b] [--json out.json] [--tsv out.tsv] [--days 1]
 *       [--record <lane>]
 *
 * `--validator`: one animal of every catalogue species the map lists (`map/validate.ts`), in its own zone on the wild
 * island. A snapshot with `--islands`: the wild island's animals of the development page's merge; the town's animals
 * run the same schedule from the same profiles (their homes and the zoo's feeding stations are the town's own), so the
 * town's species are read from the validator's run. A snapshot holds real usernames: read it in place, never copy it.
 * Only species slugs, ids and counts are printed. Pure schedule (`slotPlanAt`, the goal each trip is built from): the
 * same for every viewer; no browser, no paths.
 *
 * The last `metrics` line holds the lane's guarded numbers (`tests/ark-motion/metrics.json`, check `b3-activity-budget`
 * runs this on the validator's animals).
 */
import {readFileSync, writeFileSync} from "node:fs";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld("v2");

const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
const {validatorAnimals} = await import("../src/ark-scene/map/validate.ts");
const {arkBody} = await import("../src/ark-scene/stats.ts");
const {behaviourProfile} = await import("../src/ark-scene/behaviour-profile.ts");
const sched = await import("../src/ark-scene/behaviour-schedule.ts");
const {wireRecipes} = await import("../src/ark-scene/behaviour-recipes.ts");
const {eats} = await import("../src/ark-scene/food-links.ts");
const {mapHabitatAt, onSchedule, scheduleRoost} = await import("../src/ark-scene/map/place.ts");
const {placeAnimals} = await import("../src/ark-scene/placement.ts");
const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
const {scheduleFed, planOf} = await import("../src/ark-scene/animal-status.ts");
const {arkActivityKey, arkEnergy} = await import("../src/lib/ark-animal-status.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type ScheduleAnimal = import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal;
type Profile = ReturnType<typeof behaviourProfile>;

const source = args[0];
if (!source) throw new Error("usage: ark-activity-budget.mts <snapshot.json | --validator> [--islands routing.json] [--per-species 1] [--json out.json]");
let animals: ArkAnimal[];
if (source === "--validator") animals = validatorAnimals();
else {
    const routingPath = value("--islands");
    let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    animals = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
}
const only = value("--species")?.split(",");
const perSpecies = Number(value("--per-species") ?? "1");
const days = Number(value("--days") ?? "1");
const traceSlots = Number(value("--trace") ?? "0");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Subject = {animal: ArkAnimal; place: NonNullable<ReturnType<typeof places.get>>; length: number; sched: {profile: Profile; animal: ScheduleAnimal} | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
        sched: on ? {profile: behaviourProfile(animal.model_slug, plan), animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone))} : null
    };
});
// The scene's wiring (as `scripts/ark-time-budget.mts`): groups, spaced homes, threats, recipes.
{
    const byId = new Map(subjects.map((s) => [s.animal.id, s]));
    const onIt = subjects.filter((s) => s.sched);
    const leaderOf = (s: Subject) => (s.place.leader && s.place.leader !== s.animal.id ? byId.get(s.place.leader) ?? null : null);
    const sizes = new Map<Subject, number>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        if (leader?.sched) sizes.set(leader, (sizes.get(leader) ?? 1) + 1);
    }
    const groups = new Map<Subject, import("../src/ark-scene/behaviour-schedule.ts").ScheduleGroup | null>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        const ok = leader && leader.sched && leader.animal.model_slug === s.animal.model_slug && GROUPED.has(s.sched!.profile.social) ? leader : null;
        groups.set(s, ok ? {leader: ok.sched!.animal, profile: ok.sched!.profile, activity: ok.animal.activity, rank: Math.max(s.place.rank ?? 1, 1), size: sizes.get(ok) ?? 2} : null);
    }
    const nav = world.nav;
    const radius = new Map(onIt.map((s) => [s.animal.id, sched.rangeReach(s.sched!.profile, s.sched!.animal) + (sizes.has(s) ? sched.groupSpread(s.length, sizes.get(s)!) : 0)]));
    const spaced = sched.spaceHomes(
        onIt.filter((s) => !groups.get(s)).map((s) => ({id: s.animal.id, slug: s.animal.model_slug, home: {x: s.sched!.animal.home.x, z: s.sched!.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.sched!.profile.move === "swim" || s.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : s.sched!.profile.move === "fly" ? heightAt(x, z) > 0.05 && mapHabitatAt(s.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.animal, x, z, 5))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const s of onIt) {
        const own = s.sched!;
        own.animal.group = groups.get(s) ?? null;
        own.animal.young = false;
        const moved = spaced.get(s.animal.id);
        if (moved) {
            own.animal.home = {x: moved.home.x, y: Math.max(heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            own.animal.range = moved.range === null ? null : sizes.has(s) ? moved.range / 2 : moved.range;
            own.animal.prey = moved.prey;
        }
    }
    for (const s of onIt) {
        const lead = s.sched!.animal.group?.leader;
        const leader = leaderOf(s);
        if (!lead || !leader || !spaced.has(leader.animal.id)) continue;
        s.sched!.animal.home = {...lead.home};
        s.sched!.animal.range = lead.range;
    }
    const list = onIt.map((s) => ({slug: s.animal.model_slug, animal: s.sched!.animal, profile: s.sched!.profile, activity: s.animal.activity}));
    sched.wireThreats(list, eats);
    sched.forgetSchedules();
    wireRecipes(list.map((w) => ({animal: w.animal, profile: w.profile, slug: w.slug, activity: w.activity})));
}

/** What the card's activity is, as the day's budget counts it. */
const CATEGORY: Record<string, string> = {
    sleeping: "sleep",
    resting: "rest", basking: "rest", hiding: "rest", waiting: "rest",
    grazing: "feed", browsing: "feed", food: "feed", flowers: "feed", fishing: "feed", hunting: "feed", feeding: "feed", prowling: "feed",
    drinking: "drink", toWater: "drink",
    wandering: "travel", flying: "travel", swimming: "travel", climbing: "travel", home: "travel", light: "travel", breathing: "travel",
    grooming: "groom", bathing: "groom",
    courting: "social", sparring: "social", playing: "social", calling: "social", nest: "social", eggs: "social",
    watching: "watch", wary: "watch",
    digging: "dig", about: "rest"
};
const CATEGORIES = ["sleep", "rest", "feed", "drink", "travel", "groom", "social", "watch", "dig"] as const;
/** The hour's letter in the day's strip: what most of the hour went on. */
const LETTER: Record<string, string> = {sleep: "z", rest: "r", feed: "F", drink: "D", travel: "t", groom: "g", social: "s", watch: "w", dig: "d"};

const SLOT = sched.SLOT_SECONDS;
const start = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const slotsADay = Math.round(86_400 / SLOT);

type Row = {
    slug: string; animals: number; diet: string; activity: string; move: string; social: string; size: number | null; length: number; plan: string | null; zone: string;
    /** Share of the 24 hours per category, and per card activity. */
    share: Record<string, number>; keys: Record<string, number>;
    /** Bouts a day and their median and longest length (minutes), per category. */
    bouts: Record<string, {perDay: number; median: number; longest: number}>;
    /** How often what it is doing changes while awake, per awake hour: between feeding, settled and moving; and between the categories. */
    changesPerAwakeHour: number;
    categoryChangesPerAwakeHour: number;
    /** The day hour by hour: the letter of what most of the hour went on. */
    strip: string;
    /** Its fed bar: lowest, mean, highest; the mean at a feeding bout's start and at its end; and the same for 20 min before sleep and after waking for energy. */
    fed: {min: number; mean: number; max: number; atFeedStart: number | null; atFeedEnd: number | null} | null;
    energy: {min: number; max: number; atSleep: number | null; atWake: number | null} | null;
    /** Its fed bar's drain: hours from full to its floor awake and not eating. */
    fedHoursToFloor: number | null;
};

const {arkFedRates, ARK_FED_FLOOR} = await import("../src/lib/ark-animal-status.ts");
const bySpecies = new Map<string, {rows: Row[]}>();
const taken = new Map<string, number>();
const started = Date.now();
let done = 0;
for (const s of subjects) {
    if (!s.sched) continue;
    const slug = s.animal.model_slug;
    if (only && !only.includes(slug)) continue;
    if ((taken.get(slug) ?? 0) >= perSpecies) continue;
    taken.set(slug, (taken.get(slug) ?? 0) + 1);
    const own = s.sched;
    const subject = {id: s.animal.id, world, profile: own.profile, animalAt: () => own.animal, feedingAt: null, activity: s.animal.activity, hoursAt};
    const offset = sched.slotOffset(s.animal.id);
    const first = Math.ceil((start + offset) / SLOT);
    const count = slotsADay * days;
    const cats: string[] = [];
    const trace: string[] = [];
    const keys: Record<string, number> = {};
    const fedValues: number[] = [];
    const energyValues: number[] = [];
    for (let k = 0; k < count; k++) {
        const slotStart = (first + k) * SLOT - offset;
        const plan = planOf(subject, slotStart + 0.5);
        const key = arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, feeding: false, flyer: own.profile.move === "fly", still: plan.still});
        keys[key] = (keys[key] ?? 0) + 1;
        cats.push(CATEGORY[key] ?? "rest");
        // (`--trace n`: its first n waking slots from 08:00 or 20:00, the need each answers and what it then does.)
        if (traceSlots && trace.length < traceSlots && plan.doing !== "sleep" && (trace.length > 0 || Math.floor(hoursAt(slotStart)) % 12 === 8)) trace.push(`${hoursAt(slotStart).toFixed(2)} ${sched.needAt ? sched.needAt(own.profile, own.animal, s.animal.activity, slotStart, hoursAt) : "-"}>${plan.doing}${plan.recipe ? `(${plan.recipe})` : ""}=${key}`);
        // (The bars at each slot's end, every sixth slot: eight minutes apart.)
        {
            const fed = scheduleFed(subject, slotStart + SLOT - 1);
            fedValues.push(fed ? fed.value : NaN);
        }
    }
    // Energy: every ninth slot (twelve minutes), from the schedule's own sleep and wake.
    const slotStartOf = (t: number) => Math.floor((t + offset) / SLOT) * SLOT - offset;
    const awakeAt = (t: number) => sched.awakeAt(own.profile, s.animal.activity, hoursAt(slotStartOf(t)));
    for (let k = 0; k < count; k += 9) {
        const energy = arkEnergy(awakeAt, (first + k) * SLOT - offset + SLOT - 1, SLOT, slotStartOf);
        energyValues.push(energy ? energy.value : NaN);
    }
    const share: Record<string, number> = {};
    for (const c of CATEGORIES) share[c] = cats.filter((x) => x === c).length / count;
    for (const k of Object.keys(keys)) keys[k] = keys[k] / count;
    // Bouts: runs of one category.
    const runs: Array<{cat: string; from: number; n: number}> = [];
    for (let k = 0; k < count; k++) {
        const last = runs[runs.length - 1];
        if (last && last.cat === cats[k]) last.n++;
        else runs.push({cat: cats[k], from: k, n: 1});
    }
    const bouts: Row["bouts"] = {};
    for (const c of CATEGORIES) {
        const lengths = runs.filter((r) => r.cat === c).map((r) => (r.n * SLOT) / 60).sort((a, b) => a - b);
        bouts[c] = {perDay: lengths.length / days, median: lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0, longest: lengths.length ? lengths[lengths.length - 1] : 0};
    }
    const awakeSlots = cats.filter((c) => c !== "sleep").length;
    // (Changes between the three things a viewer tells apart at a glance: feeding, settled in place (resting, grooming,
    // watching, courting), on the move. A rest that turns into a preen and back is not counted.)
    const modes = cats.map((c) => (c === "sleep" ? "sleep" : c === "feed" ? "feed" : c === "travel" || c === "drink" || c === "dig" ? "move" : "settle"));
    let changes = 0;
    for (let k = 1; k < modes.length; k++) if (modes[k] !== modes[k - 1] && modes[k] !== "sleep" && modes[k - 1] !== "sleep") changes++;
    let keyChanges = 0;
    for (let k = 1; k < cats.length; k++) if (cats[k] !== cats[k - 1] && cats[k] !== "sleep" && cats[k - 1] !== "sleep") keyChanges++;
    // The day's strip: by island hour.
    const byHour: Array<Record<string, number>> = Array.from({length: 24}, () => ({}));
    for (let k = 0; k < count; k++) {
        const h = Math.floor(hoursAt((first + k) * SLOT - offset + SLOT / 2)) % 24;
        byHour[h][cats[k]] = (byHour[h][cats[k]] ?? 0) + 1;
    }
    const strip = byHour.map((h) => LETTER[Object.entries(h).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "rest"] ?? "?").join("");
    const fedKnown = fedValues.filter((v) => Number.isFinite(v));
    const feedStart: number[] = [];
    const feedEnd: number[] = [];
    for (const r of runs) {
        if (r.cat !== "feed") continue;
        const before = fedValues[r.from - 1];
        const after = fedValues[r.from + r.n - 1];
        if (Number.isFinite(before)) feedStart.push(before);
        if (Number.isFinite(after)) feedEnd.push(after);
    }
    const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
    const energyKnown = energyValues.filter((v) => Number.isFinite(v));
    const atSleep: number[] = [];
    const atWake: number[] = [];
    for (let i = 1; i < runs.length; i++) {
        const k = Math.floor(runs[i].from / 9);
        if (runs[i].cat === "sleep" && runs[i].n >= 9 && Number.isFinite(energyValues[k])) atSleep.push(energyValues[k]);
        if (runs[i - 1].cat === "sleep" && runs[i - 1].n >= 9 && Number.isFinite(energyValues[k])) atWake.push(energyValues[k]);
    }
    const rates = arkFedRates(own.profile.diet, s.length);
    const row: Row = {
        slug, animals: 1, diet: own.profile.diet, activity: s.animal.activity ?? own.profile.activity, move: own.profile.move, social: own.profile.social, size: own.profile.size, length: s.length, plan: modelBase(slug)?.plan ?? null, zone: s.animal.zone,
        share, keys, bouts,
        changesPerAwakeHour: awakeSlots ? changes / ((awakeSlots * SLOT) / 3600) : 0,
        categoryChangesPerAwakeHour: awakeSlots ? keyChanges / ((awakeSlots * SLOT) / 3600) : 0,
        strip,
        fed: fedKnown.length ? {min: Math.min(...fedKnown), mean: mean(fedKnown)!, max: Math.max(...fedKnown), atFeedStart: mean(feedStart), atFeedEnd: mean(feedEnd)} : null,
        energy: energyKnown.length ? {min: Math.min(...energyKnown), max: Math.max(...energyKnown), atSleep: mean(atSleep), atWake: mean(atWake)} : null,
        fedHoursToFloor: rates.drain > 0 ? (1 - ARK_FED_FLOOR) / rates.drain / 3600 : null
    };
    if (traceSlots) console.log(`${slug} ${s.animal.id}: ${trace.join(" | ")}`);
    const entry = bySpecies.get(slug) ?? {rows: []};
    entry.rows.push(row);
    bySpecies.set(slug, entry);
    done++;
    if (done % 200 === 0) console.error(`  ${done} animals (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}

// One row per species: the mean of its animals.
const rows: Row[] = Array.from(bySpecies.values()).map(({rows: list}) => {
    if (list.length === 1) return list[0];
    const avg = (get: (r: Row) => number) => list.reduce((sum, r) => sum + get(r), 0) / list.length;
    const out: Row = {...list[0], animals: list.length, share: {}, keys: {}, bouts: {}, changesPerAwakeHour: avg((r) => r.changesPerAwakeHour), categoryChangesPerAwakeHour: avg((r) => r.categoryChangesPerAwakeHour)};
    for (const c of CATEGORIES) {
        out.share[c] = avg((r) => r.share[c] ?? 0);
        out.bouts[c] = {perDay: avg((r) => r.bouts[c].perDay), median: avg((r) => r.bouts[c].median), longest: Math.max(...list.map((r) => r.bouts[c].longest))};
    }
    for (const k of new Set(list.flatMap((r) => Object.keys(r.keys)))) out.keys[k] = avg((r) => r.keys[k] ?? 0);
    return out;
});
rows.sort((a, b) => a.slug.localeCompare(b.slug));
const pct = (x: number) => `${Math.round(100 * x)}`.padStart(3);
console.log(`${done} animals, ${rows.length} species, ${days} day(s), every ${SLOT} s slot (${((Date.now() - started) / 1000).toFixed(0)} s)`);
console.log(`${"species".padEnd(30)} diet     act  zzz rest feed drnk trav groo soc  wat | feed bouts/d med min | rest med | drinks/d | changes/awake h | fed min-max start>end | energy sleep>wake | 00..23`);
for (const r of rows) {
    const f = r.fed;
    const e = r.energy;
    console.log(
        `${r.slug.padEnd(30).slice(0, 30)} ${r.diet.padEnd(8).slice(0, 8)} ${r.activity.slice(0, 4)} ${pct(r.share.sleep)} ${pct(r.share.rest)}  ${pct(r.share.feed)}  ${pct(r.share.drink)}  ${pct(r.share.travel)}  ${pct(r.share.groom)} ${pct(r.share.social)}  ${pct(r.share.watch)} | ${r.bouts.feed.perDay.toFixed(0).padStart(4)} ${r.bouts.feed.median.toFixed(1).padStart(5)} | ${r.bouts.rest.median.toFixed(1).padStart(5)} | ${r.bouts.drink.perDay.toFixed(0).padStart(3)} | ${r.changesPerAwakeHour.toFixed(1).padStart(5)} | ${f ? `${f.min.toFixed(2)}-${f.max.toFixed(2)} ${f.atFeedStart?.toFixed(2) ?? "-"}>${f.atFeedEnd?.toFixed(2) ?? "-"}` : "-"} | ${e ? `${e.atSleep?.toFixed(2) ?? "-"}>${e.atWake?.toFixed(2) ?? "-"}` : "-"} | ${r.strip}`
    );
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
const tsv = value("--tsv");
if (tsv) writeFileSync(tsv, [["slug", "diet", "activity", "move", "social", "size", "length", "plan", "zone", ...CATEGORIES, "feedBouts", "feedMedianMin", "restMedianMin", "sleepBouts", "sleepLongestMin", "drinksPerDay", "changesPerAwakeHour", "categoryChangesPerAwakeHour", "fedAtFeedStart", "fedAtFeedEnd", "fedHoursToFloor", "energyAtSleep", "energyAtWake", "strip"].join("\t"), ...rows.map((r) => [r.slug, r.diet, r.activity, r.move, r.social, r.size ?? "", r.length.toFixed(3), r.plan ?? "", r.zone, ...CATEGORIES.map((c) => r.share[c].toFixed(4)), r.bouts.feed.perDay.toFixed(1), r.bouts.feed.median.toFixed(1), r.bouts.rest.median.toFixed(1), r.bouts.sleep.perDay.toFixed(1), r.bouts.sleep.longest.toFixed(0), r.bouts.drink.perDay.toFixed(1), r.changesPerAwakeHour.toFixed(2), r.categoryChangesPerAwakeHour.toFixed(2), r.fed?.atFeedStart?.toFixed(3) ?? "", r.fed?.atFeedEnd?.toFixed(3) ?? "", r.fedHoursToFloor?.toFixed(2) ?? "", r.energy?.atSleep?.toFixed(3) ?? "", r.energy?.atWake?.toFixed(3) ?? "", r.strip].join("\t"))].join("\n"));
