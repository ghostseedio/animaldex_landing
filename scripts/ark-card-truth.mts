#!/usr/bin/env -S npx tsx
/**
 * The card's truth over a day (lane ark-activities, 2026-11-14): what the tap card says an animal is doing, sampled
 * through each of its slots the way the scene asks it (`scheduleStatus` with the trip it is on), against what the
 * scene draws then (`poseOnTrip`: in the air or not, the recipe act laid over its pose); and the live log's moments
 * over the same day, with whether a flying line's animal is in the air when it is said and a few seconds on.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-card-truth.mts <snapshot.json> --islands <routing.json>
 *       [--day 2026-11-14] [--samples 2] [--species a,b] [--json out.json]
 *
 * The props' nests are wired as the scene wires them (`setNestSource`, from `propsPresence` on the Ark day, each
 * sitter's nest at its home with the props' default build schedule), and the Ark day from the snapshot. A snapshot
 * holds real usernames: read in place, never copied; only slugs and counts are printed. Pure, no browser.
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
let snapshotRef: {ark_day?: number | null; as_of?: string | null; voyage?: {started_at?: string | null}} | null = null;
let wildSnap: Parameters<typeof import("../src/ark-scene/props/presence.ts").propsPresence>[0] | null = null;
if (source === "--validator") animals = validatorAnimals();
else {
    const routingPath = value("--islands");
    let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    // (The development page's local decode leaves the Ark day out: the raw snapshot's.)
    const arkDay = (snapshot as {ark_day?: number}).ark_day ?? (raw as {ark_day?: number}).ark_day ?? null;
    snapshotRef = {...(snapshot as object), ark_day: arkDay} as never;
    const wild = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild") : null;
    wildSnap = {...((wild ?? snapshot) as object), ark_day: arkDay} as never;
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


// MARK: The Ark day and the props' nests, as the scene wires them
const recipesMod = await import("../src/ark-scene/behaviour-recipes.ts");
const {ARK_DAY_MS} = await import("../src/lib/ark-clock.ts");
const arkDayAt = (epoch: number): number => {
    const asOf = Date.parse(snapshotRef?.as_of ?? "");
    if (typeof snapshotRef?.ark_day === "number" && Number.isFinite(asOf)) return snapshotRef.ark_day + (epoch * 1000 - asOf) / ARK_DAY_MS;
    return 0;
};
// (After this lane: the recipes' seasons run on the Ark year, from the scene's Ark day.)
const setDay = (recipesMod as {setRecipeArkDay?: (f: ((epoch: number) => number | null) | null) => void}).setRecipeArkDay;
if (setDay && snapshotRef && !args.includes("--no-arkday")) setDay(arkDayAt);
if (wildSnap) {
    const {propsPresence} = await import("../src/ark-scene/props/presence.ts");
    const {scheduledStage} = await import("../src/ark-scene/props/nest-growth.ts");
    const homeOf = new Map(subjects.filter((s) => s.sched).map((s) => [s.animal.id, s.sched!.animal]));
    const byDay = new Map<number, ReturnType<typeof propsPresence>>();
    recipesMod.setNestSource((animalId, epoch) => {
        const day = arkDayAt(epoch);
        const key = Math.floor(day);
        let presence = byDay.get(key);
        if (!presence) byDay.set(key, (presence = propsPresence({...wildSnap!, ark_day: key}, (slug) => modelBase(slug)?.plan ?? null)));
        const nest = presence.nests.find((n) => n.sitter === animalId);
        const home = homeOf.get(animalId);
        if (!nest || !home) return null;
        const stage = scheduledStage({speciesId: nest.speciesId, siteId: `ground:${animalId}`, zone: nest.zone, eggs: nest.eggs, chicks: nest.chicks, buildDays: nest.profile.buildDays, carriedOver: nest.profile.carriedOver, form: nest.profile.form}, day);
        return {x: home.home.x + 0.8, y: home.home.y, z: home.home.z + 0.6, stage, eggs: nest.eggs, chicks: nest.chicks};
    });
}

// MARK: The card through the day
const SLOT = sched.SLOT_SECONDS;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const slotsADay = Math.round(86_400 / SLOT);
const {scheduleStatus, pickMoment, MOMENT_WINDOW_SECONDS} = await import("../src/ark-scene/animal-status.ts");
const dayArg = value("--day") ?? "2026-11-14";
const t0 = Date.parse(`${dayArg}T00:00:00Z`) / 1000;
let traceSaid = Number(value("--trace-said") ?? "0");
let traceFly = Number(value("--trace-fly") ?? "0");
const SAMPLES = Number(value("--samples") ?? "2");
const SOCIAL = ["courting", "sparring", "grooming", "calling", "nest", "eggs", "playing", "digging", "bathing"];
const keyOfRecipe = (recipe: string) => arkActivityKey({doing: "rest", recipe});
const counts: Record<string, number> = {};
let awake = 0;
let flyingSaid = 0, flyingNotAloft = 0, flyingNotAloftArrived = 0, aloftNotFlying = 0;
const drawnUnnamed: Record<string, number> = {};
const saidUndrawn: Record<string, number> = {};
const started = Date.now();
type Subj = Parameters<typeof scheduleStatus>[0];
const subjectOf = new Map<string, Subj & {young: boolean; leads: number; surfaces: boolean}>();
const leads = new Map<string, number>();
for (const s of subjects) if (s.sched && s.place.leader && s.place.leader !== s.animal.id) {
    const l = subjects.find((x) => x.animal.id === s.place.leader);
    if (l && l.animal.model_slug === s.animal.model_slug) leads.set(l.animal.id, (leads.get(l.animal.id) ?? 1) + 1);
}
for (const s of subjects) {
    if (!s.sched) continue;
    const own = s.sched;
    subjectOf.set(s.animal.id, {id: s.animal.id, world, profile: own.profile, animalAt: () => own.animal, feedingAt: null, activity: s.animal.activity, hoursAt, young: false, leads: leads.get(s.animal.id) ?? 0, surfaces: Boolean(own.profile.breathes && own.profile.move === "swim" && s.length >= 1.2)});
}
const tripOf = (subject: Subj, t: number) => sched.tripAt(world, subject.profile, subject.animalAt(t), t, subject.hoursAt, subject.activity);
let n = 0;
for (const s of subjects) {
    if (!s.sched || (only && !only.includes(s.animal.model_slug))) continue;
    const subject = subjectOf.get(s.animal.id)!;
    const offset = sched.slotOffset(s.animal.id);
    const first = Math.ceil((t0 + offset) / SLOT);
    for (let k = 0; k < slotsADay; k++) {
        const slotStart = (first + k) * SLOT - offset;
        for (let j = 0; j < SAMPLES; j++) {
            const t = slotStart + ((j + 0.5) / SAMPLES) * SLOT + ((sched.slotOffset(`${s.animal.id}#${k}#${j}`) % 7) - 3);
            const trip = tripOf(subject, t);
            const status = scheduleStatus(subject, t, {trip});
            const key = status.activity;
            if (key === "sleeping") continue;
            awake++;
            counts[key] = (counts[key] ?? 0) + 1;
            const pose = sched.poseOnTrip(world, trip, t);
            // (Drawn flying: in the air, or flapping off or down at its take-off and landing.)
            const flyingDrawn = pose.aloft || (pose.moving && (pose.beat === "fly" || pose.beat === "glide"));
            if (key === "flying") {
                flyingSaid++;
                if (!flyingDrawn) {
                    flyingNotAloft++;
                    if (traceFly > 0) {
                        traceFly--;
                        console.log(`TRACE ${s.animal.model_slug} t-start ${(t - trip.start).toFixed(1)} arrive ${(trip.arrive - trip.start).toFixed(1)} end ${(trip.end - trip.start).toFixed(1)} doing ${trip.doing} mode ${trip.mode} beat ${pose.beat} moving ${pose.moving} act ${pose.act?.recipe ?? "-"} legs ${trip.legs.map((l) => `${l.mode}/${l.beat}/${l.seconds.toFixed(1)}`).join(",")} len ${trip.length.toFixed(1)}`);
                    }
                    if (t >= trip.arrive) flyingNotAloftArrived++;
                }
            } else if (flyingDrawn && own(s).profile.move === "fly" && !["toWater", "home", "food", "fishing", "hunting", "nest", "flowers", "light"].includes(key)) aloftNotFlying++;
            const drawn = pose.act?.recipe ? keyOfRecipe(pose.act.recipe) : null;
            if (drawn && SOCIAL.includes(drawn) && drawn !== key) drawnUnnamed[drawn] = (drawnUnnamed[drawn] ?? 0) + 1;
            if (SOCIAL.includes(key) && drawn !== key && !(key === "nest" && t < trip.arrive) && !(key === "eggs")) {
                saidUndrawn[key] = (saidUndrawn[key] ?? 0) + 1;
                if (traceSaid > 0 && key === "nest") {
                    traceSaid--;
                    console.log(JSON.stringify({start: trip.start, arrive: trip.arrive, end: trip.end, to: trip.to, legs: trip.legs.map((l) => [l.mode, l.seconds])}));
                    console.log(`SAID ${s.animal.model_slug} ${key} t-start ${(t - trip.start).toFixed(1)} arrive ${(trip.arrive - trip.start).toFixed(1)} doing ${trip.doing} recipe ${trip.recipe ?? "-"} act ${pose.act?.recipe ?? "-"} ${pose.act?.block ?? ""}`);
                }
            }
        }
    }
    if (++n % 50 === 0) console.error(`  ${n} animals (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
function own(s: Subject) {
    return s.sched!;
}
const pctOf = (x: number) => `${((100 * x) / Math.max(awake, 1)).toFixed(2)}%`;
console.log(`CARD ${n} animals, ${SAMPLES} samples a slot, day ${dayArg} (Ark day ${arkDayAt(t0).toFixed(1)}), awake samples ${awake} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
console.log(`  social/activity shares: ${SOCIAL.map((k) => `${k} ${pctOf(counts[k] ?? 0)}`).join(", ")}`);
console.log(`  all: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pctOf(v)}`).join(", ")}`);
console.log(`  flying said ${flyingSaid}, not drawn flying ${flyingNotAloft} (${((100 * flyingNotAloft) / Math.max(flyingSaid, 1)).toFixed(1)}%), of them after arriving ${flyingNotAloftArrived}; flyer drawn flying, said settled ${aloftNotFlying}`);
console.log(`  drawn but card says other: ${JSON.stringify(drawnUnnamed)}; card says but not drawn: ${JSON.stringify(saidUndrawn)}`);

// MARK: The live log's moments over the day
{
    const list = Array.from(subjectOf.values()).filter((m) => !(subjects.find((s) => s.animal.id === m.id)!.place as {micro?: boolean}).micro);
    const W = Math.round(86_400 / MOMENT_WINDOW_SECONDS);
    const kinds: Record<string, number> = {};
    const acts: Record<string, number> = {};
    let flyLines = 0;
    const flyAloft = [0, 0, 0, 0];
    const LATER = [0, 5, 10, 20];
    const began = Date.now();
    for (let w = 0; w < W; w++) {
        const m = pickMoment(Math.floor(t0 / MOMENT_WINDOW_SECONDS) + w, list as never);
        if (!m) continue;
        kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
        acts[m.activity] = (acts[m.activity] ?? 0) + 1;
        if (m.activity === "flying") {
            flyLines++;
            const subject = subjectOf.get(m.animalId)!;
            // (Said at the end of its window: the log reads the window once it is done.)
            const said = (Math.floor(m.at / MOMENT_WINDOW_SECONDS) + 1) * MOMENT_WINDOW_SECONDS;
            LATER.forEach((d, i) => {
                const t = said + d;
                const p = sched.poseOnTrip(world, tripOf(subject, t), t);
                if (p.aloft || (p.moving && (p.beat === "fly" || p.beat === "glide"))) flyAloft[i]++;
            });
        }
    }
    console.log(`MOMENTS windows ${W} (${((Date.now() - began) / 1000).toFixed(0)} s)`);
    console.log(`  kinds ${JSON.stringify(Object.entries(kinds).sort((a, b) => b[1] - a[1]))}`);
    console.log(`  activities ${JSON.stringify(Object.entries(acts).sort((a, b) => b[1] - a[1]))}`);
    console.log(`  flying lines ${flyLines}: drawn flying when said ${flyAloft[0]}, +5 s ${flyAloft[1]}, +10 s ${flyAloft[2]}, +20 s ${flyAloft[3]}`);
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({counts, awake, flyingSaid, flyingNotAloft, drawnUnnamed, saidUndrawn}, null, 1));
process.exit(0);
