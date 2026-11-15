#!/usr/bin/env -S npx tsx
/**
 * Every animal's bars, and why one is missing (lane ark-bars-real, 2026-11-15; owner: "why do some animals have 3 bars
 * and others have 2"). For each animal of a public snapshot (`/api/ark/voyage`'s answer, or `voyage_public_v2`'s), the
 * bars its tap card can show (`lib/ark-animal-status.ts` arkStatusBars: fed, health, energy, age) and, for each one it
 * cannot, the cause: off the behaviour schedule (a micro animal, a hamlet resident, an underground one, one held off
 * the water, a town animal kept still), never asleep (active at any hour with no sleep of its own), no condition from
 * the server, no lifespan in the read. "Before" is the rule as it was (the card's bars only on the schedule, "any" never
 * sleeping); "after" is this lane's (the card's own schedule off the schedule too, `sleep-hours.ts`). Reduced motion and
 * a replay's act took the fed and energy bars from every animal before; after, they take none.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-bars-census.mts <snapshot.json> [--fed-sample 40] [--json out.json]
 *
 * `--fed-sample n`: also works out the fed and energy bars for real (`scheduleFed`, `arkEnergy`) for up to n wild
 * animals that are off the schedule, through a schedule made for the card alone, as the scene's `statusSchedOf` does.
 * A snapshot holds real usernames: read in place, never copied; only counts and slugs are printed. Pure; no browser.
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
const {arkIslandSnapshot} = await import("../src/lib/ark-islands.ts");
const {placeAnimals} = await import("../src/ark-scene/placement.ts");
const {placeTownAnimals} = await import("../src/ark-scene/islands/town/placement.ts");
const {onSchedule} = await import("../src/ark-scene/map/place.ts");
const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {heldOffWater} = await import("../src/ark-scene/sea-depth.ts");
const {behaviourProfile} = await import("../src/ark-scene/behaviour-profile.ts");
const {arkSleepOf} = await import("../src/ark-scene/sleep-hours.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;

const source = args[0];
if (!source) throw new Error("usage: ark-bars-census.mts <snapshot.json> [--fed-sample n] [--json out.json]");
const raw = JSON.parse(readFileSync(source, "utf8")) as Record<string, unknown>;
const snapshot = decodeArkSnapshot((raw.snapshot as unknown) ?? raw);
if (!snapshot) throw new Error("not a snapshot");
const wild = arkIslandSnapshot(snapshot, "wild").animals;
const town = arkIslandSnapshot(snapshot, "town").animals;
const wildPlaces = placeAnimals(wild);
const townPlaced = town.length ? placeTownAnimals(town) : null;
const STILL_WHERE = new Set(["window", "indoor", "pool"]);

/** Why it is off the behaviour schedule (`index.ts` makeSched), or null when it is on it. */
function offCause(animal: ArkAnimal, inTown: boolean): string | null {
    const place = inTown ? townPlaced!.places.get(animal.id) : wildPlaces.get(animal.id);
    if (!place) return "unplaced";
    const p = place as {micro?: unknown; hamlet?: unknown; burrow?: unknown};
    if (p.micro) return "micro animal";
    if (p.hamlet) return "hamlet resident";
    if (!onSchedule(place, animal.model_slug)) return "underground";
    if (!onBehaviourSchedule(animal.model_slug)) return heldOffWater(animal.model_slug) ? "held off the water" : "off the water schedule";
    if (inTown) {
        const info = townPlaced!.town.get(animal.id);
        if (!info) return "town: no place";
        if (info.still || STILL_WHERE.has(info.where)) return `town: kept still (${info.still ? "still" : info.where})`;
    }
    return null;
}

const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const missing = {before: {fed: new Map<string, number>(), health: new Map<string, number>(), energy: new Map<string, number>(), age: new Map<string, number>()}, after: {fed: new Map<string, number>(), health: new Map<string, number>(), energy: new Map<string, number>(), age: new Map<string, number>()}};
const barsHist = {before: new Map<string, number>(), after: new Map<string, number>()};
const species = {before: {fed: new Set<string>(), health: new Set<string>(), energy: new Set<string>(), age: new Set<string>()}, after: {fed: new Set<string>(), health: new Set<string>(), energy: new Set<string>(), age: new Set<string>()}};
const offSample: ArkAnimal[] = [];
const neverSleeps = new Map<string, number>();
for (const [inTown, list] of [[false, wild], [true, town]] as const) {
    for (const animal of list) {
        const off = offCause(animal, inTown);
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const activity = animal.activity ?? behaviourProfile(animal.model_slug, plan).activity;
        const sleep = arkSleepOf(animal);
        const anyHour = activity === "any";
        const hasLife = typeof animal.lifespan_days === "number" && typeof animal.born_ark_day === "number";
        // Before: fed and energy only on the schedule; energy never for one active at any hour; age never (no lifespan read).
        const before = {fed: !off, health: Boolean(animal.condition), energy: !off && !anyHour, age: false};
        // After: fed and energy from its own schedule either way (`statusSchedOf`); energy for one active at any hour when it sleeps.
        const after = {fed: true, health: Boolean(animal.condition), energy: !anyHour || Boolean(sleep && sleep.hours > 0), age: hasLife};
        const why = {
            fed: off ?? "",
            health: "no condition from the server",
            energy: off ? off : "active at any hour, never sleeps",
            age: typeof animal.born_ark_day !== "number" ? "no born day" : "no lifespan in the read"
        };
        for (const key of ["fed", "health", "energy", "age"] as const) {
            if (!before[key]) {
                count(missing.before[key], why[key]);
                species.before[key].add(animal.model_slug);
            }
            if (!after[key]) {
                count(missing.after[key], key === "energy" ? (sleep && sleep.hours === 0 ? "does not sleep (no nervous system / not an animal)" : "active at any hour, no sleep row") : why[key]);
                species.after[key].add(animal.model_slug);
            }
        }
        if (anyHour && !(sleep && sleep.hours > 0)) count(neverSleeps, animal.model_slug);
        count(barsHist.before, String(Object.values(before).filter(Boolean).length));
        count(barsHist.after, String(Object.values(after).filter(Boolean).length));
        if (off && !inTown) offSample.push(animal);
    }
}
const show = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("; ") || "none";
const total = wild.length + town.length;
console.log(`BARS ${total} animals (wild ${wild.length}, town ${town.length}), Ark day ${(raw.snapshot as {ark_day?: number} | undefined)?.ark_day ?? raw.ark_day ?? "?"}`);
for (const when of ["before", "after"] as const) {
    console.log(`${when.toUpperCase()}: bars per animal ${show(barsHist[when])}`);
    for (const key of ["fed", "health", "energy", "age"] as const) {
        const n = Array.from(missing[when][key].values()).reduce((a, b) => a + b, 0);
        console.log(`  ${key}: missing for ${n} animals (${species[when][key].size} looks): ${show(missing[when][key])}`);
    }
}
console.log(`  plus, before: reduced motion or a replay's act took fed and energy from every animal; after: from none`);
console.log(`  active at any hour and still never asleep: ${show(neverSleeps)}`);

// The fed and energy bars worked out for real for animals off the schedule, through a schedule made for the card alone.
const sampleN = Number(value("--fed-sample") ?? "0");
let worked = 0, failed = 0;
const failures: string[] = [];
if (sampleN > 0 && offSample.length) {
    const sched = await import("../src/ark-scene/behaviour-schedule.ts");
    const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
    const {scheduleFed} = await import("../src/ark-scene/animal-status.ts");
    const {arkEnergy} = await import("../src/lib/ark-animal-status.ts");
    const {islandHours} = await import("../src/lib/ark-clock.ts");
    const {arkBody} = await import("../src/ark-scene/stats.ts");
    const world = sched.scheduleWorld(worldSampler());
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const bySlug = new Map<string, ArkAnimal>();
    for (const a of offSample) if (!bySlug.has(a.model_slug)) bySlug.set(a.model_slug, a);
    const picks = Array.from(bySlug.values()).slice(0, sampleN);
    const epoch = Date.parse("2026-11-15T10:00:00Z") / 1000;
    for (const animal of picks) {
        const place = wildPlaces.get(animal.id)!;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const own = {id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: arkBody(animal, plan).display, sea: false, sleep: arkSleepOf(animal)};
        const profile = behaviourProfile(animal.model_slug, plan);
        const subject = {id: animal.id, world, profile, animalAt: () => own, feedingAt: null, activity: animal.activity, hoursAt};
        try {
            const fed = scheduleFed(subject as never, epoch, []);
            const energy = arkEnergy((t) => sched.awakeAt(profile, animal.activity, hoursAt(t), own.sleep), epoch, sched.SLOT_SECONDS);
            if (fed && Number.isFinite(fed.value) && (energy || animal.activity === "any")) worked++;
            else {
                failed++;
                failures.push(`${animal.model_slug} fed=${fed?.value ?? "null"} energy=${energy?.value ?? "null"}`);
            }
        } catch (error) {
            failed++;
            failures.push(`${animal.model_slug} threw ${(error as Error).message}`);
        }
    }
    console.log(`FED SAMPLE (off the schedule, one per look, a schedule made for the card): ${worked} worked, ${failed} did not${failures.length ? `: ${failures.join("; ")}` : ""}`);
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({total, missing: {before: Object.fromEntries(Object.entries(missing.before).map(([k, m]) => [k, Object.fromEntries(m)])), after: Object.fromEntries(Object.entries(missing.after).map(([k, m]) => [k, Object.fromEntries(m)]))}, bars: {before: Object.fromEntries(barsHist.before), after: Object.fromEntries(barsHist.after)}, sample: {worked, failed, failures}}, null, 1));
process.exit(0);
