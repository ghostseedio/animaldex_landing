#!/usr/bin/env -S npx tsx
/**
 * Where the wild island's animals sleep (lane ark-sleep): each scheduled animal's roost (`roostOf`), what it is on
 * (its point's tag), how high, and the nearest cover (shade of a tree or shrub, a rock, a cave mouth, a burrow, a log,
 * reeds, a branch) to it; by sleep kind (`sleepSiteKind`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-sleep-sites.mts <snapshot.json> [--species a,b] [--json out.json]
 *
 * A snapshot holds real usernames: read it in place. Only slugs, ids' last characters and counts are printed.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld((value("--world") ?? "v2") as "v1" | "v2");

const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
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
const sleepSites = await import("../src/ark-scene/sleep-sites.ts").catch(() => null);

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
const source = args[0];
const raw = JSON.parse(readFileSync(source, "utf8"));
const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
if (!snapshot) throw new Error("not a snapshot");
const animals: ArkAnimal[] = snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
const only = value("--species")?.split(",");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Subject = {animal: ArkAnimal; place: ReturnType<typeof places.get> & object; length: number; sched: {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: import("../src/ark-scene/behaviour-schedule.ts").Trip | null} | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
        sched: on
            ? {
                  profile: behaviourProfile(animal.model_slug, plan),
                  animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                  trip: null
              }
            : null
    };
});
// The scene's wiring (as `grounding/audit.ts` wire): groups, spaced homes, threats, recipes.
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


const COVER = ["shade", "rock_top", "cave_mouth", "burrow_entrance", "log_top", "reeds", "branch", "tree_hollow"] as const;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
// 01:30 on the island: the first epoch from 2026-11-12 whose island hour is 1.5 (± a minute).
let night = Date.UTC(2026, 10, 12) / 1000;
for (let t = night; t < night + 2 * 86400; t += 30) if (Math.abs(hoursAt(t) - 1.5) < 0.02) { night = t; break; }
let noon = night;
for (let t = night; t < night + 2 * 86400; t += 30) if (Math.abs(hoursAt(t) - 13) < 0.02) { noon = t; break; }
type Row = {slug: string; id: string; kind: string; member: boolean; roost: string; on: string; up: number; cover: string; coverD: number; doing: string; at: string; dRoost: number; r: number[]; len: number};
const rows: Row[] = [];
for (const s of subjects) {
    if (!s.sched) continue;
    const {profile, animal} = s.sched;
    const r = sched.roostOf(world, profile, animal);
    const tag = r.point ? r.point.replace(/^map:/, "").split(":")[0] : "none";
    const ground = Math.max(sampler.heightAt(r.x, r.z), 0);
    let cover = "-";
    let coverD = Infinity;
    for (const t of COVER) for (const p of sampler.attachPoints(t, {x: r.x, z: r.z, r: 30})) {
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < coverD) (coverD = d), (cover = t);
    }
    const plan = modelBase(s.animal.model_slug)?.plan ?? null;
    const kind = sleepSites ? sleepSites.sleepSiteKind(profile, s.length) : plan ?? "?";
    const trip = sched.tripAt(world, profile, animal, night, hoursAt, s.animal.activity);
    const at = sched.poseOnTrip(world, trip, night);
    rows.push({slug: s.animal.model_slug, id: s.animal.id.slice(-4), kind, member: Boolean(animal.group), roost: profile.roost, on: tag, up: Math.round((r.y - ground) * 10) / 10, cover, coverD: Math.round(coverD * 10) / 10, doing: trip.doing, at: `${at.x.toFixed(0)},${at.z.toFixed(0)}`, dRoost: Math.round(Math.hypot(at.x - r.x, at.z - r.z) * 10) / 10, r: [r.x, r.y, r.z], len: s.length});
}
const byKind = new Map<string, Row[]>();
for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
console.log(`${rows.length} scheduled wild animals`);
for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const on = new Map<string, number>();
    for (const r of list) on.set(r.on, (on.get(r.on) ?? 0) + 1);
    const open = list.filter((r) => r.on === "none" && !r.member && r.up < 0.3 && r.coverD > 1.5).length;
    console.log(`${kind.padEnd(14)} ${String(list.length).padStart(4)}  open (no cover within 1.5 m, not a group member) ${open}  on: ${[...on.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
}
const show = only ?? ["long-tailed-macaque", "olive-baboon", "chimpanzee", "western-gorilla", "ring-tailed-lemur", "african-lion", "red-fox", "european-rabbit", "european-robin", "common-wall-lizard", "plains-zebra", "white-tailed-deer", "brown-bear", "eurasian-wolf"];
for (const r of rows) if (show.includes(r.slug)) console.log(JSON.stringify(r));
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify(rows));
