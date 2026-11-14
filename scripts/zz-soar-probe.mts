#!/usr/bin/env -S npx tsx
/**
 * The flight budget (behaviours pass, lane B5 air, 2026-11-14; docs/ark/behaviour-pass-2026-11/air.md): what every
 * animal that flies does in the air and between flights on the behaviour schedule, second by second, so a family can be
 * judged against the real birds, bats and insects. It is the time budget's wiring (`scripts/ark-time-budget.mts`) with a
 * one-second step and a record per flight.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-flight-budget.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--world v1|v2] [--windows 12] [--window 900] [--species a,b] [--json out.json]
 *       [--flights out.jsonl] [--record <lane>] [--quiet]
 *
 * Per flying species: flights per awake hour; a flight's length in seconds and metres (median, the longest); its height
 * over what is under it; the shares of its flights that are hops, perch to perch, up to a perch, long ways, rounds,
 * soars, hawking and a flock member's flight with its leader; the hours of the day flown; how far a flock's members are
 * from their leader in the air and how many are up with it; and the beat that follows a landing. By way of life
 * (`flightWay`) the medians are printed first. A snapshot holds real usernames: read it in place, never copy it. Only
 * species slugs, ids and counts are printed. Pure schedule (the same for every viewer); no browser.
 *
 * The windows are `--windows` of `--window` seconds, spread evenly over a day from 2026-11-12 00:00 UTC (the island's
 * hours follow the real clock).
 *
 * The lane's CI numbers are printed as a last `metrics` line and, under the motion summary (`scripts/ark-motion-ci.mts`
 * sets `ARK_MOTION_METRICS_DIR`), recorded with `recordMotionMetric` under `--record <lane>`.
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
const {topOf} = await import("../src/ark-scene/behaviour-water.ts");
const flightModule = await import("../src/ark-scene/locomotion/flight.ts");
const {flightSpec} = flightModule;
/** Its way of life in the air (`locomotion/flight.ts` flightWay), where this tree has it; else "-". */
const wayOf: (slug: string) => string = (flightModule as unknown as {flightWay?: (slug: string) => string | null}).flightWay ? (slug) => (flightModule as unknown as {flightWay: (slug: string) => string | null}).flightWay(slug) ?? "-" : () => "-";

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Trip = import("../src/ark-scene/behaviour-schedule.ts").Trip;
const source = args[0];
if (!source) throw new Error("usage: ark-flight-budget.mts <snapshot.json | --validator> [--islands routing.json] [--world v2] [--json out.json]");
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
const windows = Number(value("--windows") ?? "12");
const windowSeconds = Number(value("--window") ?? "900");
const quiet = args.includes("--quiet");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const families = (() => {
    try {
        const table = JSON.parse(readFileSync(new URL("../data/ark/locomotion-styles.json", import.meta.url), "utf8")) as {species: Record<string, {flight?: {why: string}}>};
        return (slug: string) => table.species[slug]?.flight?.why.split(":")[0].trim() ?? "?";
    } catch {
        return () => "?";
    }
})();

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Own = {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: Trip | null};
type Subject = {animal: ArkAnimal; place: ReturnType<typeof places.get> & object; length: number; sched: Own | null; leader: Subject | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
        leader: null,
        sched: on
            ? {
                  profile: behaviourProfile(animal.model_slug, plan),
                  animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                  trip: null
              }
            : null
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
        s.leader = ok;
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

// MARK: probe: every soar leg that takes off or lands, its ends' acceleration over its cap
const {FLIGHT_WAYS, flightAccelOf} = flightModule as any;
const start = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const flyers = subjects.filter((s) => s.sched && FLIGHT_WAYS[wayOf(s.animal.model_slug)]?.aloft && (!only || only.includes(s.animal.model_slug)));
console.log(`${flyers.length} animals of ${new Set(flyers.map((s) => s.animal.model_slug)).size} species with time on the wing`);
type Rec = {slug: string; id: string; way: string; kind: string; slot: number; hour: number; len: number; secs: number; planned: number; ratio: number; acc: number; at: number; mass: number; shadow: boolean; cap: number; accG: number; peak: number};
const recs: Rec[] = [];
const SLOT = sched.SLOT_SECONDS;
const h0 = Number(value("--from") ?? "0"), h1 = Number(value("--to") ?? "24");
for (const s of flyers) {
    const own = s.sched!;
    const slug = s.animal.model_slug;
    const mass = flightSpec(slug, own.animal.length)?.massKg ?? 0;
    const cap = Math.max(...(Object.values(flightAccelOf(mass)) as number[]));
    const paces = sched.airPaces(own.profile, own.animal.length);
    for (let t = start + h0 * 3600; t < start + h1 * 3600; t += SLOT) {
        const trip = sched.tripAt(world, own.profile, own.animal, t + 1, hoursAt, s.animal.activity);
        let at = trip.start;
        for (const leg of trip.legs) {
            const soar = leg.mode === "air" ? leg.plan?.soar : null;
            if (soar && !(soar.from && soar.to) && leg.seconds > 0) {
                const span = Math.min(2.5, leg.seconds / 2);
                for (const [a, b, end] of [[0, span, 0], [leg.seconds - span, leg.seconds, 1]] as const) {
                    if (end === 0 ? soar.from : soar.to) continue;
                    const pts: Array<{x: number; z: number; t: number}> = [];
                    for (let u = a; u <= b + 1e-9; u += 1 / 60) {
                        const p = sched.poseOnTrip(world, trip, at + Math.min(Math.max(u, 0), leg.seconds - 1e-6));
                        pts.push({x: p.x, z: p.z, t: u});
                    }
                    const v = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.z - pts[k].z) * 60);
                    let worst = 0, wAt = 0;
                    for (let k = 3; k < v.length - 3; k++) {
                        const acc = Math.abs(v[k + 3] - v[k - 3]) * 10 / cap;
                        if (acc > worst) { worst = acc; wAt = pts[k].t; }
                    }
                    // the plan's own duration at its paces
                    const planned = (flightModule as any).planSoarLeg(paces, leg.length, end === 0 ? {pace: leg.plan!.peak, from: false, to: true} : {pace: paces.cruise, from: true, to: false}).seconds;
                    recs.push({slug, id: s.animal.id.slice(0, 8), way: wayOf(slug), kind: end === 0 ? "up" : "down", slot: trip.slot, hour: hoursAt(t), len: leg.length, secs: leg.seconds, planned, ratio: planned / leg.seconds, acc: worst, at: wAt, mass, shadow: Boolean(trip.shadow), cap, accG: worst * cap / 9.81, peak: leg.plan!.peak});
                }
            }
            at += leg.seconds;
        }
    }
}
const by = (k: string) => recs.filter((r) => r.kind === k);
// Hand-offs: where one slot's soar leg ends up in the air and the next begins there: the speed across the join.
{
    type H = {slug: string; id: string; way: string; kind: string; hour: number; acc: number; accG: number; v0: number; v1: number; dyaw: number; mass: number};
    const hs: H[] = [];
    const outs: number[] = [];
    const dumped = new Set<number>();
    const events = new Map<string, number>();
    const vsteps: number[] = [];
    const whole = {n: 0, over: 0, worst: 0, at: "", fast: 0, fastAt: ""};
    for (const s of flyers) {
        const own = s.sched!;
        const slug = s.animal.model_slug;
        const mass = flightSpec(slug, own.animal.length)?.massKg ?? 0;
        const cap = Math.max(...(Object.values(flightAccelOf(mass)) as number[]));
        let prev: Trip | null = null;
        for (let t = start + h0 * 3600; t < start + h1 * 3600; t += SLOT) {
            const trip: Trip = sched.tripAt(world, own.profile, own.animal, t + 1, hoursAt, s.animal.activity, prev);
            if (prev && prev.end === trip.start) {
                const a = prev.legs[prev.legs.length - 1];
                const b = trip.legs.find((l) => l.mode === "air" && l.plan?.soar);
                if (a?.mode === "air" && a.plan?.soar?.to && b?.plan?.soar?.from) {
                    const kind = `${a.plan.soar.from ? "track" : "up"}>${b.plan.soar.to ? "track" : "down"}`;
                    const pts: Array<{x: number; z: number; yaw: number}> = [];
                    for (let k = -90; k <= 90; k++) {
                        const at = trip.start + k / 60;
                        const p = sched.poseOnTrip(world, k < 0 ? prev : trip, k < 0 ? Math.min(at, prev.end - 1e-6) : at);
                        pts.push({x: p.x, z: p.z, yaw: p.yaw});
                    }
                    const v = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.z - pts[k].z) * 60);
                    let worst = 0;
                    for (let k = 3; k < v.length - 3; k++) worst = Math.max(worst, Math.abs(v[k + 3] - v[k - 3]) * 10 / cap);
                    let dyaw = 0;
                    for (let k = 84; k < 96; k++) dyaw = Math.max(dyaw, Math.abs(Math.atan2(Math.sin(pts[k + 1].yaw - pts[k].yaw), Math.cos(pts[k + 1].yaw - pts[k].yaw))));
                    hs.push({slug, id: s.animal.id.slice(0, 8), way: wayOf(slug), kind, hour: hoursAt(t), acc: worst, accG: worst * cap / 9.81, v0: v[60], v1: v[120], dyaw, mass});
                }
            }
            // The join inside a slot: its way out's end and its track's start.
            {
                let at = trip.start;
                for (let i = 0; i < trip.legs.length - 1; i++) {
                    const a = trip.legs[i], b = trip.legs[i + 1];
                    at += a.seconds;
                    if (a.mode === "air" && a.plan?.soar?.to && b.mode === "air" && b.plan?.soar?.from) {
                        const pts: Array<{x: number; z: number; yaw: number; y: number}> = [];
                        for (let k = -90; k <= 90; k++) {
                            const p = sched.poseOnTrip(world, trip, Math.max(at + k / 60, trip.start));
                            pts.push({x: p.x, z: p.z, yaw: p.yaw, y: p.y});
                        }
                        const v = pts.slice(1).map((p, k) => Math.hypot(p.x - pts[k].x, p.z - pts[k].z) * 60);
                        let worst = 0;
                        for (let k = 3; k < v.length - 3; k++) worst = Math.max(worst, Math.abs(v[k + 3] - v[k - 3]) * 10 / cap);
                        let dyaw = 0;
                        for (let k = 84; k < 96; k++) dyaw = Math.max(dyaw, Math.abs(Math.atan2(Math.sin(pts[k + 1].yaw - pts[k].yaw), Math.cos(pts[k + 1].yaw - pts[k].yaw))));
                        hs.push({slug, id: s.animal.id.slice(0, 8), way: wayOf(slug), kind: "up>track", hour: hoursAt(t), acc: worst, accG: worst * cap / 9.81, v0: v[60], v1: v[120], dyaw, mass});
                        outs.push(a.length);
                        vsteps.push(Math.abs((pts[92].y - pts[90].y) - (pts[90].y - pts[88].y)) * 30 * 30);
                    }
                }
                // Every soar leg, all of it: its speed's change over a tenth of a second, as a share of its cap.
                at = trip.start;
                for (const leg of trip.legs) {
                    if (leg.mode === "air" && leg.plan?.soar && leg.seconds > 1) {
                        let last: {x: number; z: number} | null = null;
                        const v: number[] = [];
                        for (let u = 0; u <= leg.seconds - 1e-6; u += 1 / 30) {
                            const p = sched.poseOnTrip(world, trip, at + u);
                            if (last) v.push(Math.hypot(p.x - last.x, p.z - last.z) * 30);
                            last = {x: p.x, z: p.z};
                        }
                        for (let k = 0; k + 3 < v.length; k++) {
                            const acc = Math.abs(v[k + 3] - v[k]) * 10 / cap;
                            whole.n++;
                            if (acc > 1.08) whole.over++;
                            if (args.includes("--dump") && acc > Number(value("--dump")) && !dumped.has(trip.slot)) { dumped.add(trip.slot); const t0 = at + k / 30; console.log(`   speeds each 30th from 1 s before: ${v.slice(Math.max(k - 30, 0), k + 30).map((x) => x.toFixed(2)).join(" ")}`); for (let q = -3; q <= 3; q += 0.25) { const p = sched.poseOnTrip(world, trip, Math.min(Math.max(t0 + q, trip.start), trip.end - 1e-3)); console.log(`    ${q.toFixed(1)} s: ${(p.x - leg.from.x).toFixed(1)}, ${(p.z - leg.from.z).toFixed(1)} y ${p.y.toFixed(1)} yaw ${p.yaw.toFixed(2)}`); } }
                            if (acc > Number(value("--events") ?? "99") && args.includes("--events") && (events.get(slug) ?? 0) < 3) { events.set(slug, (events.get(slug) ?? 0) + 1); console.log(`  event ${slug} ${s.animal.id.slice(0, 8)} slot ${trip.slot} ${hoursAt(t).toFixed(2)} h ${leg.plan.soar.track ? "track" : "route"} at ${(k / 30).toFixed(2)} of ${leg.seconds.toFixed(1)} s acc ${acc.toFixed(2)}: paces ${v.slice(Math.max(k - 45, 0), k + 45).filter((_, i) => i % 5 === 0).map((x) => x.toFixed(1)).join(" ")}`); }
                            if (acc > whole.worst) { whole.worst = acc; whole.at = `${slug} ${s.animal.id.slice(0, 8)} ${hoursAt(t).toFixed(2)} h ${leg.plan.soar.from ? "air" : "perch"}>${leg.plan.soar.to ? "air" : "land"} at ${(k / 30).toFixed(1)} of ${leg.seconds.toFixed(1)} s`; }
                        }
                        const top = Math.max(...v);
                        const cruise = sched.airPaces(own.profile, own.animal.length).cruise;
                        if (top / cruise > whole.fast) { whole.fast = top / cruise; whole.fastAt = `${slug} ${hoursAt(t).toFixed(2)} h`; }
                    }
                    at += leg.seconds;
                }
            }
            prev = trip;
        }
    }
    outs.sort((a, b) => a - b);
    if (outs.length) console.log(`\nway out to its track: ${outs.length}; ${outs[0].toFixed(1)} m least, ${outs[Math.floor(outs.length / 2)].toFixed(1)} median, ${outs[outs.length - 1].toFixed(1)} most; vertical acceleration across the join worst ${Math.max(...vsteps).toFixed(2)} m/s2`);
    console.log(`every soar leg, all of it: ${whole.n} thirtieths; over 1.08 of cap ${whole.over}; worst ${whole.worst.toFixed(2)} (${whole.at}); fastest ${whole.fast.toFixed(2)} of its cruise (${whole.fastAt})`);
    for (const kind of ["up>track", "track>track", "track>down", "up>down"]) {
        const list = hs.filter((h) => h.kind === kind).sort((a, b) => b.acc - a.acc);
        if (!list.length) { console.log(`\nhand-off ${kind}: none`); continue; }
        const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
        console.log(`\nhand-off ${kind}: ${list.length}; acc over 1.08 of cap: ${list.filter((h) => h.acc > 1.08).length}; worst ${list[0].acc.toFixed(2)} of cap (${list[0].accG.toFixed(2)} g, ${list[0].slug}); median ${med(list.map((h) => h.acc)).toFixed(2)}; a frame's heading step worst ${Math.max(...list.map((h) => h.dyaw)).toFixed(3)} rad, median ${med(list.map((h) => h.dyaw)).toFixed(3)}`);
        for (const h of list.slice(0, 4)) console.log(`  ${h.slug.padEnd(26)} ${h.id} ${h.hour.toFixed(2)} h acc ${h.acc.toFixed(2)} of cap = ${h.accG.toFixed(2)} g; pace half a second before ${h.v0.toFixed(2)}, after ${h.v1.toFixed(2)} m/s; heading step ${h.dyaw.toFixed(3)} rad`);
    }
}

for (const k of ["up", "down"]) {
    const list = by(k).sort((a, b) => b.acc - a.acc);
    const over = list.filter((r) => r.acc > 1.08);
    const big = list.filter((r) => r.mass >= 1);
    console.log(`\n${k}: ${list.length} legs, ${new Set(list.map((r) => r.slug)).size} species; over 1.08 of cap: ${over.length} legs of ${new Set(over.map((r) => r.slug)).size} species; over 1.0: ${list.filter((r) => r.acc > 1.0).length}; worst ${list[0]?.acc.toFixed(3)}; a kilo up worst ${(Math.max(0, ...big.map((r) => r.accG))).toFixed(3)} g`);
    for (const r of list.slice(0, Number(value("--top") ?? "12"))) console.log(`  ${r.slug.padEnd(28)} ${r.id} ${r.way.padEnd(7)} ${r.mass.toFixed(2)} kg slot ${r.slot} ${r.hour.toFixed(2)} h ${r.len.toFixed(1)} m in ${r.secs.toFixed(2)} s (plan peak ${r.peak.toFixed(2)}; at its paces ${r.planned.toFixed(2)} s, x${r.ratio.toFixed(3)}) acc ${r.acc.toFixed(3)} of cap = ${r.accG.toFixed(3)} g at ${r.at.toFixed(2)} s${r.shadow ? " follower" : ""}`);
    const byWay = new Map<string, Rec[]>();
    for (const r of list) byWay.set(r.way, [...(byWay.get(r.way) ?? []), r]);
    for (const [way, l] of byWay) console.log(`  way ${way}: ${l.length} legs, worst ${l[0].acc.toFixed(3)} (${l[0].slug}), over 1.08: ${l.filter((r) => r.acc > 1.08).length}, time ratio max ${Math.max(...l.map((r) => r.ratio)).toFixed(3)} min ${Math.min(...l.map((r) => r.ratio)).toFixed(3)}`);
}
