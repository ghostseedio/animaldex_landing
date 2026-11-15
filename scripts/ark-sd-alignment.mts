#!/usr/bin/env -S npx tsx
/**
 * The System Dynamics alignment audit (lane `ark-sd-align`, 2026-11-15; AnimalDex `docs/ark/sd-alignment-audit-2026-11.md`):
 * for every species with both SD (`src/ark-scene/sd-rhythm.json`) and a behaviour profile, its day on the real schedule
 * (`planOf`, the card's activity slot by slot over 24 h, as `scripts/ark-activity-budget.mts` reads it) scored against
 * its SD modes by `lib/ark-sd-rhythm.ts` sdAgreement: waking time on its modes' kinds, their mix, its tempo.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-sd-alignment.mts --validator [--thrive prime|good|ordinary]
 *       [--condition hungry|old] [--species a,b] [--json out.json] [--csv out.csv] [--days-out days.json]
 *
 * One animal of every catalogue species the map lists (`map/validate.ts`), in its own zone on the wild island; its
 * thrive band and condition set as asked (default: as the validator gives it). Pure schedule: the same for every viewer.
 */
import {writeFileSync} from "node:fs";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld("v2");

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
const {planOf} = await import("../src/ark-scene/animal-status.ts");
const {arkActivityKey} = await import("../src/lib/ark-animal-status.ts");
const {followsSd, speciesSdRhythm} = await import("../src/ark-scene/sd-rhythm.ts");
const {arkDayOf, sdAgreement, intensityLine} = await import("../src/lib/ark-sd-rhythm.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Profile = ReturnType<typeof behaviourProfile>;

const thriveAsked = value("--thrive") as ArkAnimal["thrive"] | undefined;
const conditionAsked = value("--condition") as ArkAnimal["condition"] | undefined;
const animals: ArkAnimal[] = validatorAnimals();
const only = value("--species")?.split(",");
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
        sched: on ? {profile: behaviourProfile(animal.model_slug, plan), animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea", thrive: thriveAsked ?? animal.thrive ?? "ordinary", condition: conditionAsked ?? animal.condition ?? null}, () => scheduleRoost(place, animal.zone))} : null
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


const SLOT = sched.SLOT_SECONDS;
const start = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const slotsADay = Math.round(86_400 / SLOT);
type Row = {slug: string; follows: boolean; speciesProfileId: string; shares: Array<[string, number, number]>; tempo: string; target: Record<string, number>; awake: Record<string, number>; asleep: number; boutMinutes: number; switchesPerHour: number; score: number; state: string; cover: number; mix: number; tempoScore: number; worst: string | null; hourly: number[]; keys: Record<string, number>};
const rows: Row[] = [];
const seen = new Set<string>();
const started = Date.now();
for (const s of subjects) {
    if (!s.sched) continue;
    const slug = s.animal.model_slug;
    if (seen.has(slug) || (only && !only.includes(slug))) continue;
    const sd = speciesSdRhythm(slug);
    if (!sd) continue;
    seen.add(slug);
    const own = s.sched;
    const subject = {id: s.animal.id, world, profile: own.profile, animalAt: () => own.animal, feedingAt: null, activity: s.animal.activity, hoursAt};
    const offset = sched.slotOffset(s.animal.id);
    const first = Math.ceil((start + offset) / SLOT);
    const keys: string[] = [];
    for (let k = 0; k < slotsADay; k++) {
        const slotStart = (first + k) * SLOT - offset;
        const plan = planOf(subject, slotStart + 0.5);
        keys.push(arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, feeding: false, flyer: own.profile.move === "fly", still: plan.still}));
    }
    const day = arkDayOf(keys, SLOT);
    const agree = sdAgreement({target: sd.target, tempo: sd.tempo, level: sd.level, modes: []}, day);
    const counts: Record<string, number> = {};
    for (const k of keys) counts[k] = (counts[k] ?? 0) + 1 / keys.length;
    rows.push({slug, follows: followsSd(own.profile), speciesProfileId: s.animal.species_profile_id, shares: agree.shares.map((x) => [x.category, Math.round(x.sd * 1000) / 1000, Math.round(x.ark * 1000) / 1000]), tempo: sd.tempo, target: sd.target as Record<string, number>, awake: day.awake as Record<string, number>, asleep: day.asleep, boutMinutes: day.boutMinutes, switchesPerHour: day.switchesPerHour, score: agree.score, state: agree.state, cover: agree.cover, mix: agree.mix, tempoScore: agree.tempo, worst: agree.worst, hourly: intensityLine(day.intensity, 24).map((v) => Math.round(v * 100) / 100), keys: counts});
    if (rows.length % 200 === 0) console.error(`  ${rows.length} species (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
rows.sort((a, b) => a.slug.localeCompare(b.slug));
const n = rows.length;
const by = (f: (r: Row) => boolean) => rows.filter(f).length;
const mean = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(n, 1);
const worst: Record<string, number> = {};
for (const r of rows) if (r.worst) worst[r.worst] = (worst[r.worst] ?? 0) + 1;
const tempos: Record<string, {n: number; bout: number; inBand: number}> = {};
for (const r of rows) {
    const t = (tempos[r.tempo] ??= {n: 0, bout: 0, inBand: 0});
    t.n++;
    t.bout += r.boutMinutes;
    if (r.tempoScore >= 0.999) t.inBand++;
}
for (const t of Object.values(tempos)) t.bout = Math.round((t.bout / t.n) * 100) / 100;
const summary = {species: n, thrive: thriveAsked ?? "validator", condition: conditionAsked ?? null, meanScore: mean((r) => r.score), inRhythm: by((r) => r.state === "in"), slightly: by((r) => r.state === "slightly"), out: by((r) => r.state === "out"), meanCover: mean((r) => r.cover), meanMix: mean((r) => r.mix), meanTempo: mean((r) => r.tempoScore), worst, tempos};
console.log(JSON.stringify(summary));
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({summary, rows}, null, 1));
// (`--days-out`: the species page's "In the Ark" sample days, by model slug; `scripts/ark-sd-rhythm.mts --days` keys them by
// species profile id for `src/app/api/ark/sd-day/days.json`: the validator's animals carry made-up ids.)
const daysOut = value("--days-out");
if (daysOut) writeFileSync(daysOut, JSON.stringify({asOf: new Date(start * 1000).toISOString().slice(0, 10), about: `scripts/ark-sd-alignment.mts --thrive ${thriveAsked ?? "validator"}: one of each kind on the shared schedule over a sample day (not flyers: their day is not yet SD's)`, species: Object.fromEntries(rows.filter((r) => r.follows).map((r) => [r.slug, {slug: r.slug, tempo: r.tempo, score: Math.round(r.score * 1000) / 1000, state: r.state, bout: Math.round(r.boutMinutes * 10) / 10, line: r.hourly, shares: r.shares}]))}));
const csv = value("--csv");
if (csv) writeFileSync(csv, ["slug,tempo,score,state,cover,mix,tempo_score,bout_minutes,switches_per_hour,worst,sd_target,ark_awake", ...rows.map((r) => [r.slug, r.tempo, r.score.toFixed(3), r.state, r.cover.toFixed(3), r.mix.toFixed(3), r.tempoScore.toFixed(3), r.boutMinutes.toFixed(2), r.switchesPerHour.toFixed(1), r.worst ?? "", Object.entries(r.target).map(([k, v]) => `${k}:${Math.round(v * 100)}`).join(" "), Object.entries(r.awake).map(([k, v]) => `${k}:${Math.round(v * 100)}`).join(" ")].join(","))].join("\n"));
