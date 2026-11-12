/**
 * The grounding audit (motion 100x pass, lane L3): for every animal of an Ark (the real snapshot, a fixture, the
 * validator's every-species list) through an Ark day, where the scene draws it and whether it floats, sinks or
 * stands inside scenery. Pure (node and browser): the scene's own modules (placement, the behaviour schedule and
 * its wiring, the attach sampler), plus the few lines of `index.ts` that decide the pose (`fromSchedule`,
 * `microPose`, the hamlet's spots), mirrored here.
 *
 * Two rule sets are measured on the same poses:
 * - `legacy`: the scene before this lane: every model stood on its bounding box's floor (`minY`), on the
 *   schedule's analytic ground height, upright everywhere off the ground (a woodpecker "on" bark stood upright
 *   with half its body in the trunk), the branch swaying away under a scheduled percher, a gripping rig's bone
 *   pivots (not its soles) on the point;
 * - `grounded`: this lane's (`stand.ts`): the true base on the drawn ground, leaning to the slope; on a raised
 *   point its back along the surface's normal, its soles on the point, moving with the branch.
 *
 * Each sample is one of: `air` (flying, gliding: may leave a surface), `water` (swimming, floating, wading), `ground`,
 * `surface` (a branch, a limb, bark, a wall, a rock face, a leaf, a post), `indoors` / `underground` (not drawn
 * outside). A ground or surface sample `floats` when no contact touches (all more than the tolerance above), `sinks`
 * when one is more than the tolerance below, and is `inside` scenery when its body stands in a trunk, a rock or a
 * building, or upright through a wall or trunk it should cling to, or deep in a tree's crown where nothing outside
 * sees it.
 */

import {arkBody, bodyAxisExtent} from "@/ark-scene/stats";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, groupSpread, poseOnTrip, rangeReach, scheduleWorld, spaceHomes, tripAt, wireThreats, withLazyRoost, type ScheduleAnimal, type ScheduleGroup, type ScheduleWorld, type Trip} from "@/ark-scene/behaviour-schedule";
import {wireRecipes} from "@/ark-scene/behaviour-recipes";
import {eats} from "@/ark-scene/food-links";
import {mapHabitatAt, onSchedule, scheduleRoost} from "@/ark-scene/map/place";
import {plotSpots} from "@/ark-scene/map/hamlet";
import {surfacePoint} from "@/ark-scene/micro";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {allAttachPoints, attachSway, type AttachPoint} from "@/ark-scene/sampler";
import {inDepthBand, onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {swimDepth} from "@/ark-scene/sea-depth";
import type {ArkAnimal} from "@/ark-scene/types";
import {worldSampler, type ArkWorldSampler} from "@/ark-scene/world-sampler";
import {heightAt as analyticHeight, ZONE_SITES} from "@/ark-scene/world";
import {islandHours} from "@/lib/ark-clock";
import {hangBelow, levelBase, modelBase, rigFeet, meanDrop} from "@/ark-scene/grounding/base";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {RAISED_POINT_TAGS} from "@/ark-scene/grounding/hook";
import {HIDDEN_HANG_MAX_BODY, HIDDEN_MAX_BODY, perchHidden} from "@/ark-scene/grounding/perch";
import {scheduleSurface, standOnGround} from "@/ark-scene/grounding/stand";
import {inRock} from "@/ark-scene/map/rocks";
import {goesIntoRoost} from "@/ark-scene/sleep";
import treeAttach from "@/ark-scene/tree-attach.json";

/** Branch, limb and hang points carry their openness from tree-attach generator 7 (lane L3); before, 0 meant unmeasured. */
const OPEN_MEASURED = ((treeAttach as unknown as {generator?: number}).generator ?? 0) >= 7;

export type GroundingRules = "legacy" | "grounded";
export type GroundingKind = "air" | "water" | "ground" | "surface" | "indoors" | "underground" | "unknown";
export type GroundingProblem = "floats" | "sinks" | "inside";

export type GroundingSample = {
    id: string;
    slug: string;
    epoch: number;
    kind: GroundingKind;
    /** Ground and surface: the lowest contact's height over what it stands on (m; negative: sunk). */
    gap: number;
    problems: GroundingProblem[];
    /** What it stands on (a tag, "ground"), and a word on the problem. */
    on: string;
    detail: string;
};

/** How far off a contact may be before it reads as floating or sunk: 2 cm, or 3% of its drawn height. */
export function groundingTolerance(drawnHeight: number): number {
    return Math.max(0.02, 0.03 * drawnHeight);
}

/** Points it clings to (its back along the surface's normal), not stands on: anything steeper than 45 degrees. */
const CLING = 0.7071;

type Subject = {
    animal: ArkAnimal;
    place: Placement;
    plan: string | null;
    /** The drawn scale (m per model unit), as the scene's `modelScale` (true sizing, lane L4, changes it; the numbers here scale with it). */
    scale: number;
    length: number;
    height: number;
    sched: {profile: ReturnType<typeof behaviourProfile>; animal: ScheduleAnimal; trip: Trip | null} | null;
};

export type AuditOptions = {
    /** Epochs (s) to sample; the default is 24 through one Ark day from a fixed start (every viewer's clock). */
    epochs?: number[];
    /** The near level's lean to the slope (the scene's `slopePitch`, close by) in legacy; the far level has none. */
    level?: "near" | "far";
};

export type GroundingAudit = {
    animals: number;
    samples: GroundingSample[];
    /** Per rule set: animals with at least one sample that floats, sinks, is inside scenery; and any of the three. */
    counts: Record<GroundingRules, {floats: number; sinks: number; inside: number; any: number; samples: Record<GroundingProblem, number>}>;
    /** Samples by kind. */
    kinds: Record<GroundingKind, number>;
};

/** 24 samples through one Ark day (55 real minutes) from 2026-11-12 00:00 UTC. */
export function arkDayEpochs(count = 24, start = Date.UTC(2026, 10, 12) / 1000): number[] {
    const day = 3300;
    return Array.from({length: count}, (_, i) => start + (i * day) / count + 7.3 * i);
}

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

/** The scene's wiring after a snapshot (`index.ts` wireSchedules, all at once): groups, spaced homes, threats, recipes. */
function wire(subjects: Subject[], world: ScheduleWorld) {
    const byId = new Map(subjects.map((s) => [s.animal.id, s]));
    const onIt = subjects.filter((s) => s.sched);
    const leaderOf = (s: Subject) => (s.place.leader && s.place.leader !== s.animal.id ? byId.get(s.place.leader) ?? null : null);
    const sizes = new Map<Subject, number>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        if (leader?.sched) sizes.set(leader, (sizes.get(leader) ?? 1) + 1);
    }
    const groups = new Map<Subject, ScheduleGroup | null>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        const ok = leader && leader.sched && leader.animal.model_slug === s.animal.model_slug && GROUPED.has(s.sched!.profile.social) ? leader : null;
        groups.set(s, ok ? {leader: ok.sched!.animal, profile: ok.sched!.profile, activity: ok.animal.activity, rank: Math.max(s.place.rank ?? 1, 1), size: sizes.get(ok) ?? 2} : null);
    }
    const nav = world.nav;
    const radius = new Map(onIt.map((s) => [s.animal.id, rangeReach(s.sched!.profile, s.sched!.animal) + (sizes.has(s) ? groupSpread(s.length, sizes.get(s)!) : 0)]));
    const spaced = spaceHomes(
        onIt.filter((s) => !groups.get(s)).map((s) => ({id: s.animal.id, slug: s.animal.model_slug, home: {x: s.sched!.animal.home.x, z: s.sched!.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.sched!.profile.move === "swim" || s.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : s.sched!.profile.move === "fly" ? analyticHeight(x, z) > 0.05 && mapHabitatAt(s.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.animal, x, z, 5))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const s of onIt) {
        const own = s.sched!;
        own.animal.group = groups.get(s) ?? null;
        own.animal.young = false;
        const moved = spaced.get(s.animal.id);
        if (moved) {
            own.animal.home = {x: moved.home.x, y: Math.max(analyticHeight(moved.home.x, moved.home.z), 0), z: moved.home.z};
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
    wireThreats(list, eats);
    forgetSchedules();
    wireRecipes(list.map((w) => ({animal: w.animal, profile: w.profile, slug: w.slug, activity: w.activity})));
}

export function auditGrounding(animals: ArkAnimal[], options: AuditOptions = {}): GroundingAudit {
    const epochs = options.epochs ?? arkDayEpochs();
    const level = options.level ?? "near";
    const sampler = worldSampler();
    const world = scheduleWorld(sampler);
    const places = placeAnimals(animals);
    const subjects: Subject[] = animals.map((animal) => {
        const place = places.get(animal.id)!;
        const base = modelBase(animal.model_slug);
        const plan = base?.plan ?? null;
        const body = arkBody(animal, plan);
        const size = base?.size ?? {x: 0.3, y: 0.5, z: 1};
        const scale = body.display / Math.max(bodyAxisExtent(animal.model_slug, plan, size), 0.05);
        const sched = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug)
            ? {
                  profile: behaviourProfile(animal.model_slug, plan),
                  animal: withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                  trip: null
              }
            : null;
        return {animal, place, plan, scale, length: body.display, height: size.y * scale, sched};
    });
    wire(subjects, world);
    // The attach points the schedule's spots name, by id (the scenery's own: tree points sway with their tree).
    const byId = new Map<string, AttachPoint>(allAttachPoints().map((point) => [point.id, point]));
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const samples: GroundingSample[] = [];
    for (const s of subjects) {
        for (const epoch of epochs) samples.push(...sampleOne(s, epoch, world, byId, hoursAt, level, sampler));
    }
    const counts = {} as GroundingAudit["counts"];
    for (const rules of ["legacy", "grounded"] as const) {
        const per = new Map<string, Set<GroundingProblem>>();
        const bySample: Record<GroundingProblem, number> = {floats: 0, sinks: 0, inside: 0};
        for (const sample of samples) {
            if (!sample.id.endsWith(`#${rules}`)) continue;
            const id = sample.id.slice(0, -rules.length - 1);
            for (const problem of sample.problems) {
                bySample[problem]++;
                const set = per.get(id) ?? new Set();
                set.add(problem);
                per.set(id, set);
            }
        }
        const count = (problem: GroundingProblem) => Array.from(per.values()).filter((set) => set.has(problem)).length;
        counts[rules] = {floats: count("floats"), sinks: count("sinks"), inside: count("inside"), any: per.size, samples: bySample};
    }
    const kinds = {air: 0, water: 0, ground: 0, surface: 0, indoors: 0, underground: 0, unknown: 0} as Record<GroundingKind, number>;
    for (const sample of samples) if (sample.id.endsWith("#grounded")) kinds[sample.kind]++;
    return {animals: animals.length, samples, counts, kinds};
}

/** The scene's lean to the slope before this lane (`index.ts` slopePitch, near only), on the analytic ground. */
function legacySlopePitch(x: number, z: number, yaw: number, length: number): number {
    const half = Math.max(length * 0.4, 0.05);
    const front = Math.max(analyticHeight(x + Math.sin(yaw) * half, z + Math.cos(yaw) * half), 0);
    const back = Math.max(analyticHeight(x - Math.sin(yaw) * half, z - Math.cos(yaw) * half), 0);
    return Math.max(Math.min(Math.atan2(back - front, half * 2), 0.45), -0.45);
}

/** The lowest of a model's footprint contacts against the drawn ground, for a root height, yaw and lean (m). */
function contactGap(x: number, z: number, yaw: number, pitch: number, roll: number, rootY: number, scale: number, base: number, footprint: {x0: number; x1: number; z0: number; z1: number}): {lowest: number; highest: number} {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const zc = (footprint.z0 + footprint.z1) / 2;
    const xc = (footprint.x0 + footprint.x1) / 2;
    let lowest = Infinity;
    let highest = -Infinity;
    for (const [lx, lz] of [[xc, footprint.z1], [xc, footprint.z0], [footprint.x1, zc], [footprint.x0, zc], [footprint.x1, footprint.z1], [footprint.x0, footprint.z1], [footprint.x1, footprint.z0], [footprint.x0, footprint.z0]] as const) {
        const x1 = (lx * cr - base * sr) * scale;
        const y1 = (lx * sr + base * cr) * scale;
        const z1 = lz * scale;
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        const wx = x + x1 * cy + z2 * sy;
        const wz = z - x1 * sy + z2 * cy;
        const gap = rootY + y2 - drawnGroundHeight(wx, wz);
        lowest = Math.min(lowest, gap);
        highest = Math.max(highest, gap);
    }
    return {lowest, highest};
}

function sampleOne(s: Subject, epoch: number, world: ScheduleWorld, byId: Map<string, AttachPoint>, hoursAt: (epoch: number) => number, level: "near" | "far", sampler: ArkWorldSampler): GroundingSample[] {
    const slug = s.animal.model_slug;
    const out = (rules: GroundingRules, kind: GroundingKind, gap: number, problems: GroundingProblem[], on: string, detail: string): GroundingSample => ({id: `${s.animal.id}#${rules}`, slug, epoch, kind, gap, problems, on, detail});
    const both = (kind: GroundingKind, on: string) => [out("legacy", kind, 0, [], on, ""), out("grounded", kind, 0, [], on, "")];
    const place = s.place;
    const tol = groundingTolerance(s.height);
    const found = modelBase(slug);
    const footprint = found?.footprint ?? {x0: -0.1, x1: 0.1, z0: -0.3, z1: 0.3};
    const minY = level === "far" ? found?.far.minY ?? -0.25 : found?.near.minY ?? -0.25;
    const base = levelBase(slug, level, minY);
    const lift = (base - minY) * s.scale;
    if (place.hamlet) {
        // Out on its plot by day (the hamlet's rotation): on a lawn spot, upright, at the analytic ground.
        const spots = plotSpots(place.hamlet.plot) as unknown as {lawn?: Array<{x: number; z: number}>; door: {x: number; z: number}};
        const list = spots.lawn?.length ? spots.lawn : [spots.door];
        const spot = list[Math.abs(Math.floor(epoch)) % list.length];
        const yaw = place.hamlet.plot.rotation;
        const g = Math.max(analyticHeight(spot.x, spot.z), 0);
        const legacy = contactGap(spot.x, spot.z, yaw, 0, 0, g - minY * s.scale, s.scale, base, footprint);
        const stand = standOnGround(spot.x, spot.z, yaw, s.scale, base, footprint, 0, 0, undefined, 0.5 * tol);
        const after = contactGap(spot.x, spot.z, yaw, stand.pitch, stand.roll, stand.rootY, s.scale, base, footprint);
        const judge = (gap: {lowest: number}): GroundingProblem[] => (gap.lowest > tol ? ["floats"] : gap.lowest < -tol ? ["sinks"] : []);
        return [out("legacy", "ground", legacy.lowest, judge(legacy), "lawn", ""), out("grounded", "ground", after.lowest, judge(after), "lawn", "")];
    }
    if (place.micro) {
        // At its microhabitat: on its surface, its back to the normal; legacy stood its bounding box's floor on the point.
        const point = surfacePoint(place.micro, s.animal.zone);
        const lifted = lift > tol ? ["floats" as const] : [];
        return [out("legacy", "surface", lift, lifted, place.micro.attach?.tag ?? place.micro.surface, lifted.length ? `${(lift * 100).toFixed(1)} cm under its bounding box` : ""), out("grounded", "surface", 0, [], place.micro.attach?.tag ?? place.micro.surface, `${point.y.toFixed(2)}`)];
    }
    if (place.burrow && !s.sched) return both("underground", "burrow");
    if (!s.sched) return both("unknown", "unscheduled");
    const own = s.sched;
    if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
    const trip = own.trip;
    const at = poseOnTrip(world, trip, epoch);
    if (at.aloft) return both("air", "air");
    const ground = analyticHeight(at.x, at.z);
    // (Lane MA3: any swimmer has a band in the water, `swimDepth`, as the scene draws it.)
    const depth = swimDepth(slug, s.animal.zone);
    if (inDepthBand(depth, at, ground) || ground < 0) return both("water", "water");
    const drawn = drawnGroundHeight(at.x, at.z);
    const lattice = sampler.heightAt(at.x, at.z);
    // At its destination's attach point (a branch, bark, a wall...), or climbing between points (the schedule's normal).
    const arrived = !at.moving && epoch >= trip.arrive;
    const point = arrived && trip.to.point ? byId.get(trip.to.point) ?? null : null;
    const raised = (point && RAISED_POINT_TAGS.has(point.tag)) || at.ny < 0.95 || at.y > Math.max(ground, drawn, lattice) + 0.05;
    if (raised) {
        const on = point?.tag ?? (at.ny < 0.95 ? "climbing" : "raised");
        const ny = point ? point.normal.y : at.ny;
        const problems: GroundingProblem[] = [];
        let gap = lift;
        let detail = "";
        // Upright against a wall or a trunk it should cling to: half its body through it.
        if (ny < CLING) {
            problems.push("inside");
            detail = `upright on a ${on} (normal y ${ny.toFixed(2)})`;
        }
        // Its branch sways in the wind under it; legacy held it still (a gust's reach at the point, worst case).
        const sway = point?.wind ? Math.hypot(...Object.values(attachSway(point, 1.7, {x: 1.2, y: 0.6}))) : 0;
        gap += sway;
        if (gap > tol && ny >= CLING) {
            problems.push("floats");
            detail = `${(lift * 100).toFixed(1)} cm under its bounding box + ${(sway * 100).toFixed(1)} cm of sway`;
        }
        const open = point?.open;
        const hidden = Boolean(point && perchHidden(point.tag, open, OPEN_MEASURED) && s.length > (point.tag === "canopy_hang" ? HIDDEN_HANG_MAX_BODY : HIDDEN_MAX_BODY) * 1.05);
        const legacy = out("legacy", "surface", gap, [...problems, ...(hidden ? ["inside" as const] : [])], on, detail || (hidden ? `in the crown (open ${open!.toFixed(2)})` : ""));
        const grounded = out("grounded", "surface", 0, hidden ? ["inside"] : [], on, hidden ? `in the crown (open ${open!.toFixed(2)})` : "");
        // The frame it is drawn on (checked for a usable heading).
        void scheduleSurface;
        return [legacy, grounded];
    }
    // On the ground.
    const yaw = at.yaw;
    const pitch = level === "near" && ground > 0.02 && Math.abs(at.y - ground) < 0.05 ? legacySlopePitch(at.x, at.z, yaw, s.length) : 0;
    const legacyGap = contactGap(at.x, at.z, yaw, pitch, 0, at.y - minY * s.scale, s.scale, base, footprint);
    const stand = standOnGround(at.x, at.z, yaw, s.scale, base, footprint, 0, 0, undefined, 0.5 * tol);
    const afterGap = contactGap(at.x, at.z, yaw, stand.pitch, stand.roll, stand.rootY, s.scale, base, footprint);
    // Inside scenery at rest: its middle in a trunk, a rock or a building.
    const clearance = Math.min(Math.max(s.length * 0.2, 0.1), 0.6);
    // (A den, burrow or crevice sleeper goes into it, out of sight: `index.ts` stepDen.)
    const inDen = (trip.doing === "sleep" || trip.doing === "rest" || trip.doing === "to_roost") && goesIntoRoost(trip.to.point, own.profile.roost);
    const blocked = !at.moving && !inDen && sampler.blocked(at.x, at.z, clearance);
    const rock = !at.moving && !inDen && inRock(at.x, at.z, clearance, drawn, Math.max(s.length * 0.5, 0.05));
    const inside = blocked || rock;
    const where = inside ? `${trip.doing} ${rock ? "in a drawn rock" : "in a trunk, rock or building"} ${Math.hypot(at.x - own.animal.home.x, at.z - own.animal.home.z).toFixed(1)} m from home${trip.to.point ? ` (${trip.to.point.split(":")[0]})` : ""}` : "";
    const judge = (gap: {lowest: number}): GroundingProblem[] => [...(gap.lowest > tol ? ["floats" as const] : gap.lowest < -tol ? ["sinks" as const] : []), ...(inside ? ["inside" as const] : [])];
    return [
        out("legacy", "ground", legacyGap.lowest, judge(legacyGap), "ground", legacyGap.lowest < -tol ? `${(-legacyGap.lowest * 100).toFixed(0)} cm into the drawn ground` : legacyGap.lowest > tol ? `${(legacyGap.lowest * 100).toFixed(0)} cm over it` : ""),
        out("grounded", "ground", afterGap.lowest, judge(afterGap), "ground", where)
    ];
}

/** Grip rigs (legacy): bone pivots on the point sank the soles this far into the wood (model units → m with scale). */
export function legacyGripSink(slug: string, scale: number): number {
    return rigFeet(slug) ? meanDrop(slug) * scale : 0;
}

/** For the report: how far each listed model's lowest point hangs below its true base (model units). */
export function hangs(slugs: string[]): Array<{slug: string; near: number; far: number}> {
    return slugs.map((slug) => ({slug, near: hangBelow(slug, "near"), far: hangBelow(slug, "far")}));
}
