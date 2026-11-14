// Lane town birds: the real town's birds against the buildings' drawn volumes (development only, reads the local real
// snapshot in place: ARK_LOCAL=<dir with live.json and islands-routing.json>/). Placements inside a roof or walls, and
// through 55 minutes from 2026-11-12 H:00 UTC (H=0 night, H=12 day; STEP s) the schedule's poses inside a building,
// moving or at rest, before and after the scene's push out of colliders.
import {readFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
const {townPlan} = await import("@/ark-scene/islands/town/plan");
const {townHeight} = await import("@/ark-scene/islands/town/ground");
const {inBox, corners} = await import("@/ark-scene/islands/town/geom");
const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
const {scheduleWorld, tripAt, poseOnTrip, withLazyRoost} = await import("@/ark-scene/behaviour-schedule");
const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
const {modelBase} = await import("@/ark-scene/grounding/base");
const {arkBody} = await import("@/ark-scene/stats");
const {islandHours} = await import("@/lib/ark-clock");
const {onSchedule} = await import("@/ark-scene/map/place");
const {onBehaviourSchedule} = await import("@/ark-scene/schedule-water");
const {bodyShape} = await import("@/ark-scene/collide/bodies");
const {pushOut} = await import("@/ark-scene/collide/resolve");
const {attachedOn, tripPhase} = await import("@/ark-scene/collide/attach");
const {ARK_FLYERS} = await import("@/ark-scene/flyers");
const {heldOffWater} = await import("@/ark-scene/sea-depth");

const W = process.env.ARK_LOCAL!;
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
const town = arkIslandSnapshot(whole, "town");
const placed = placeTownAnimals(town.animals);
const plan = townPlan();
const frames = plan.buildings.map((b) => {
    let high = townHeight(b.at.x, b.at.z);
    for (const c of corners(b.at)) high = Math.max(high, townHeight(c.x, c.z));
    // (The drawn floor, `render/buildings.ts` buildingFrame: the highest ground under its corners and middle.)
    return {b, floor: high + 0.15};
});
const inside = (x: number, z: number, y: number, inset = 0.1): {id: string; kind: string; part: "walls" | "roof"} | null => {
    for (const f of frames) {
        if (!inBox(f.b.at, x, z, -inset)) continue;
        if (y >= f.floor - 0.05 && y < f.floor + f.b.eaves - 0.05) return {id: f.b.id, kind: f.b.kind, part: "walls"};
        if (y >= f.floor + f.b.eaves - 0.05 && y < f.floor + f.b.top - 0.05) return {id: f.b.id, kind: f.b.kind, part: "roof"};
    }
    return null;
};
// Roof and ledge spots (a ridge, a flat roof's middle) against their building's drawn roof top.
const {townAreas} = await import("@/ark-scene/islands/town/areas");
const drift = townAreas().spots.filter((s) => s.where === "roof" || s.where === "ledge").map((s) => {
    const f = frames.find((q) => q.b.id === s.place)!;
    return f.floor + f.b.top - s.y;
});
console.log("buildings", frames.length, "roof spots", drift.length, "sunk into the drawn roof >5cm:", drift.filter((d) => d > 0.05).length, ">25cm:", drift.filter((d) => d > 0.25).length, "max", Math.max(...drift).toFixed(2));

const birds = town.animals.filter((a) => modelBase(a.model_slug)?.plan === "bird");
console.log("town animals", town.animals.length, "birds", birds.length);
const tab = new Map<string, number>();
const STILL = new Set(["window", "indoor", "pool"]);
const isScheduled = (a: (typeof birds)[0]) => {
    const info = placed.town.get(a.id)!;
    return !info.still && !STILL.has(info.where);
};
const legacyFlyers: string[] = [];
const placeInside: string[] = [];
for (const a of birds) {
    const info = placed.town.get(a.id)!;
    const p = placed.places.get(a.id)!;
    const k = `${a.area ?? "wild"}|${info.keeping ?? "-"}|${info.display?.form ?? "-"}|${info.where}|${isScheduled(a) ? "sched" : "held"}`;
    tab.set(k, (tab.get(k) ?? 0) + 1);
    if (!isScheduled(a) && (ARK_FLYERS.has(a.model_slug) || heldOffWater(a.model_slug))) legacyFlyers.push(`${a.id} ${a.model_slug} ${a.area} ${info.where}`);
    const hit = inside(p.x, p.z, p.ground + 0.02);
    if (hit) placeInside.push(`${a.id} ${a.model_slug} ${a.area ?? "wild"} ${info.where} in ${hit.kind} ${hit.id} ${hit.part}`);
}
for (const [k, n] of [...tab].sort((a, b) => b[1] - a[1])) console.log(n, k);
console.log("held birds in legacy circling set:", legacyFlyers.length, legacyFlyers.slice(0, 10));
console.log("placements inside a building volume:", placeInside.length, placeInside.slice(0, 15));

// Schedule
const open = placed.open;
const colliders = townColliderSet(open, {x: 0, z: 0});
const world = scheduleWorld(townWorldSampler(open, {x: 0, z: 0}, colliders));
const hoursAt = (e: number) => islandHours(e * 1000, 0);
const STEP = Number(process.env.STEP ?? 6);
const start = Date.UTC(2026, 10, 12) / 1000 + Number(process.env.H ?? 0) * 3600;
const span = Number(process.env.SPAN ?? 3300);
let samples = 0, aloftS = 0;
const counts = {aloftIn: 0, aloftInAfter: 0, restIn: 0, restInAfter: 0, groundIn: 0};
const perBird = new Map<string, {slug: string; area: string; where: string; aloftIn: number; aloftAfter: number; restIn: number; restAfter: number; what: Set<string>}>();
const restPoints = new Map<string, number>();
for (const a of birds) {
    if (!isScheduled(a)) continue;
    const p = placed.places.get(a.id)!;
    const info = placed.town.get(a.id)!;
    if (!onSchedule(p, a.model_slug) || !onBehaviourSchedule(a.model_slug)) continue;
    const mb = modelBase(a.model_slug);
    const length = arkBody(a, mb?.plan ?? null).display;
    const profile = behaviourProfile(a.model_slug, mb?.plan ?? null);
    const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
    const body = bodyShape(a.model_slug, length);
    let trip = null as ReturnType<typeof tripAt> | null;
    const rec = {slug: a.model_slug, area: a.area ?? "wild", where: info.where, aloftIn: 0, aloftAfter: 0, restIn: 0, restAfter: 0, what: new Set<string>()};
    for (let e = start; e < start + span; e += STEP) {
        if (!trip || e < trip.start || e >= trip.end) trip = tripAt(world, profile, own, e, hoursAt, a.activity ?? null, trip);
        const at = poseOnTrip(world, trip, e);
        samples++;
        if (at.aloft) aloftS++;
        const hit = inside(at.x, at.z, at.y + body.height * 0.5);
        if (!hit) continue;
        const attached = attachedOn(trip, e);
        const phase = tripPhase(trip, e);
        const fixed = !at.aloft && at.y > townHeight(at.x, at.z) + 0.3 && (phase === "stay" || phase === "pause") && Boolean(attached);
        const out = pushOut(colliders, {id: a.id, radius: body.radius, half: body.half, height: body.height}, {x: at.x, y: at.y, z: at.z, yaw: at.yaw, aloft: at.aloft, asleep: false, still: !at.aloft && !at.moving, partner: null, attached, fixed} as never);
        const after = inside(out.x, out.z, at.y + body.height * 0.5, 0.0);
        const moving = at.aloft || at.moving;
        if (moving) {
            counts.aloftIn++;
            rec.aloftIn++;
            if (after) (counts.aloftInAfter++, rec.aloftAfter++);
        } else {
            counts.restIn++;
            rec.restIn++;
            if (after) (counts.restInAfter++, rec.restAfter++);
            const key = `${trip.doing}:${(trip.to.point ?? "-").split(":").slice(0,2).join(":")}@${hit.part}`;
            restPoints.set(key, (restPoints.get(key) ?? 0) + 1);
        }
        rec.what.add(`${trip.doing}:${trip.to.point ?? "home"}/${hit.kind}:${hit.part}${after ? "" : "(pushed out)"}`);
    }
    if (rec.aloftIn || rec.restIn) perBird.set(a.id, rec);
}
console.log("sched samples", samples, "aloft", aloftS, counts, "birds affected", perBird.size);
const list = [...perBird].sort((x, y) => y[1].aloftAfter + y[1].restAfter - (x[1].aloftAfter + x[1].restAfter));
for (const [id, r] of list.slice(0, 25)) console.log(id, r.slug, r.area, r.where, "movingIn", r.aloftIn, "after", r.aloftAfter, "restIn", r.restIn, "after", r.restAfter, [...r.what].slice(0, 4).join(" "));
const byArea = new Map<string, number>();
for (const [, r] of perBird) byArea.set(r.area, (byArea.get(r.area) ?? 0) + 1);
console.log("affected by area", Object.fromEntries(byArea));
console.log("rest points", [...restPoints].sort((a, b) => b[1] - a[1]).slice(0, 20));
const byRest = [...perBird].sort((x, y) => y[1].restIn - x[1].restIn).slice(0, 12);
console.log("most at rest in a building (before collisions):");
for (const [id, r] of byRest) console.log(id, r.slug, r.area, r.where, "restIn", r.restIn, "after", r.restAfter, [...r.what].slice(0, 3).join(" "));
