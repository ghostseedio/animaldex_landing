/**
 * The town's animals checked where they are drawn (lane TB: "zero sinking, zero floating, and no animal inside a wall
 * or a tank wall"). Pure (node and browser): the town's own placement, tanks and displays, its drawn ground and walk
 * surfaces, the grounding stand (`grounding/stand.ts`, the scene's), the true bases (`grounding/base.ts`), and, through
 * an Ark day, the behaviour schedule on the town's own world (`sampler.ts`), as the scene draws them.
 *
 * Each animal is one of:
 * - **in a tank** (the aquarium's, a home's, a garden pond): its body (its drawn length along its heading, its width
 *   across) inside the tank's water and between the sand and the surface, at every sample (a breath may break it);
 * - **in a display** (a cage, a vivarium): its body inside the display, standing on its tray, perch or substrate;
 * - **in a zoo house**: its body inside the walls, on the floor;
 * - **on the ground** (gardens, yards, paddocks, runs, enclosures, the town's wildlife): standing on the drawn ground
 *   (tile, pavements, paths, floors): its lowest contact within the tolerance (2 cm or 3% of its height: L3's), not in
 *   a building, a trunk, a zoo fence's line, a garden room or a pond; on the schedule, never under the ground where no
 *   water is, never at rest in a building.
 *
 * `legacy` counts the same animals the way the scene stood them before lane TB: on the wild island's drawn ground at
 * the town's world position (the sea floor under the town: ~110 m down on world v2).
 */

import {arkBody, bodyAxisExtent} from "@/ark-scene/stats";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {onSchedule} from "@/ark-scene/map/place";
import {inDepthBand, onBehaviourSchedule} from "@/ark-scene/schedule-water";
import {speciesDepth} from "@/ark-scene/sea-depth";
import {setIslandWater} from "@/ark-scene/water-level";
import {islandHours} from "@/lib/ark-clock";
import {levelBase, modelBase} from "@/ark-scene/grounding/base";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {standOnGround} from "@/ark-scene/grounding/stand";
import type {ArkAnimal} from "@/ark-scene/types";
import {inBox, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townHouseholds, zooLayout} from "@/ark-scene/islands/town/areas";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {placeTownAnimals, type TownPlace} from "@/ark-scene/islands/town/placement";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {setTownWalkSurfaces, townDrawnHeight, townWalkSurfaces, townWaterLevel, townWaterSurface, type TownWalkSurfaces} from "@/ark-scene/islands/town/drawn-ground";
import {homeDisplayFloors, homeSiteFootprints, homeSites, perchHeight, tankBox, tankPose, zooHouseFloors, zooHouseFrame, type HomeSite} from "@/ark-scene/islands/town/tanks";
import {buildScenery, buildZooScenery} from "@/ark-scene/islands/town/render/scenery";

export type TownAnimalKind = "tank" | "display" | "zoo_house" | "ground" | "raised" | "water" | "air";
export type TownAnimalProblem = "floats" | "sinks" | "in_wall" | "out_of_tank" | "out_of_display" | "out_of_house";

export type TownAnimalSample = {id: string; slug: string; area: string | null; where: string; kind: TownAnimalKind; epoch: number; gap: number; problems: TownAnimalProblem[]; detail: string};

export type TownAnimalCheck = {
    animals: number;
    samples: number;
    kinds: Record<TownAnimalKind, number>;
    /** Animals with at least one sample with the problem (after lane TB), and the same by the scene's old rule (`legacy`). */
    counts: Record<TownAnimalProblem, number>;
    legacy: {floats: number; sinks: number; worstSink: number};
    /** Schedule samples the scene's guard stands back on the ground (under it on dry land: a drink at a walled edge). */
    lifted: number;
    problems: TownAnimalSample[];
};

export type TownAnimalOptions = {
    /** Epochs (s) for the tanks' and the schedule's samples (default 12 through one Ark day). */
    epochs?: number[];
    /** Sample the behaviour schedule too (default true): the town's own world, as the scene's. */
    schedule?: boolean;
    /** The world position of the town's origin, for the legacy rule (the wild drawn ground under it). */
    origin?: {x: number; z: number};
};

/** L3's tolerance: 2 cm or 3% of the drawn height. */
export function townGroundTolerance(height: number): number {
    return Math.max(0.02, 0.03 * height);
}

let built: {key: string; surfaces: TownWalkSurfaces} | null = null;

/** The town's walk surfaces as the scene builds them: every decal, the zoo houses' floors, the drawn displays' floors. */
export function townSurfacesFor(open: readonly string[], used: ReadonlyArray<{site: HomeSite; displays: ReadonlySet<string>}>): TownWalkSurfaces {
    const key = `${open.join(",")}|${used.map((u) => `${u.site.household}:${Array.from(u.displays).sort().join("+")}`).sort().join(",")}`;
    if (built?.key === key) return built.surfaces;
    const plan = townPlan();
    const scenery = buildScenery(plan);
    const layout = zooLayout(open, plan);
    const zoo = buildZooScenery(layout);
    const sources: ArrayLike<number>[] = [];
    scenery.chunks.forEach((c) => sources.push(c.decal.pos));
    zoo.chunks.forEach((c) => sources.push(c.decal.pos));
    sources.push(zooHouseFloors(layout.enclosures));
    const ids = new Set<string>();
    for (const u of used) u.displays.forEach((id) => ids.add(id));
    sources.push(homeDisplayFloors(used.map((u) => u.site), ids));
    built = {key, surfaces: townWalkSurfaces(sources)};
    return built.surfaces;
}

/** The four corners of a body's footprint (its length along its heading, its width across), local frame. */
function bodyCorners(x: number, z: number, yaw: number, length: number, width: number): Array<{x: number; z: number}> {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const out: Array<{x: number; z: number}> = [];
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push({x: x + fx * (a * length) / 2 + fz * (b * width) / 2, z: z + fz * (a * length) / 2 - fx * (b * width) / 2});
    return out;
}

function within(box: Box, points: ReadonlyArray<{x: number; z: number}>, slack = 0.005): boolean {
    return points.every((p) => {
        const l = toLocal(box, p.x, p.z);
        return Math.abs(l.x) <= box.w / 2 + slack && Math.abs(l.z) <= box.d / 2 + slack;
    });
}

/** The lowest and highest contact of a stand over a ground (m). */
function contactGap(x: number, z: number, yaw: number, pitch: number, roll: number, rootY: number, scale: number, base: number, footprint: {x0: number; x1: number; z0: number; z1: number}, ground: (x: number, z: number) => number): number {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const zc = (footprint.z0 + footprint.z1) / 2;
    const xc = (footprint.x0 + footprint.x1) / 2;
    let lowest = Infinity;
    for (const [lx, lz] of [[xc, footprint.z1], [xc, footprint.z0], [footprint.x1, zc], [footprint.x0, zc], [footprint.x1, footprint.z1], [footprint.x0, footprint.z1], [footprint.x1, footprint.z0], [footprint.x0, footprint.z0]] as const) {
        const x1 = (lx * cr - base * sr) * scale;
        const y1 = (lx * sr + base * cr) * scale;
        const z1 = lz * scale;
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        lowest = Math.min(lowest, rootY + y2 - ground(x + x1 * cy + z2 * sy, z - x1 * sy + z2 * cy));
    }
    return lowest;
}

const HIGH = new Set(["roof", "eave", "ledge", "tall", "belfry", "balcony", "lamp_wall"]);

/** One Ark day of epochs (55 real minutes), from 2026-11-12 00:00 UTC, as L3's audit. */
export function townDayEpochs(count = 12, start = Date.UTC(2026, 10, 12) / 1000): number[] {
    return Array.from({length: count}, (_, i) => start + (i * 3300) / count + 7.3 * i);
}

export function validateTownAnimals(animals: readonly ArkAnimal[], options: TownAnimalOptions = {}): TownAnimalCheck {
    const epochs = options.epochs ?? townDayEpochs();
    const origin = options.origin ?? {x: 0, z: 0};
    const placed = placeTownAnimals(animals);
    const plan = townPlan();
    const households = townHouseholds(plan);
    const sites = homeSites(households, plan);
    // The displays in use, as the scene draws them.
    const byHousehold = new Map<string, Set<string>>();
    placed.town.forEach((info) => {
        if (!info.display) return;
        const set = byHousehold.get(info.display.household) ?? new Set<string>();
        set.add(info.display.id);
        byHousehold.set(info.display.household, set);
    });
    const used = Array.from(byHousehold.entries()).flatMap(([h, displays]) => (sites.get(h) ? [{site: sites.get(h)!, displays}] : []));
    const surfaces = townSurfacesFor(placed.open, used);
    setTownWalkSurfaces(surfaces);
    setIslandWater({level: townWaterLevel, surface: townWaterSurface});
    const drawn = (x: number, z: number) => townDrawnHeight(x, z, surfaces);
    /** The drawn ground under a body at a height (stacked floors: the one it is on). */
    const drawnAt = (near: number) => (x: number, z: number) => townDrawnHeight(x, z, surfaces, near);
    const sampler = townWorldSampler(placed.open);
    const world = options.schedule === false ? null : scheduleWorld(sampler);
    const roomsAndPonds = homeSiteFootprints(households, plan);
    const buildings = plan.buildings.map((b) => b.at);
    const buildingName = new Map(plan.buildings.map((b) => [b.at, `${b.kind} ${b.id}`] as [Box, string]));
    const houses = zooLayout(placed.open, plan).enclosures.filter((e) => !e.shared && e.indoor);
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);

    const samples: TownAnimalSample[] = [];
    const kinds = {tank: 0, display: 0, zoo_house: 0, ground: 0, raised: 0, water: 0, air: 0} as Record<TownAnimalKind, number>;
    const legacy = {floats: 0, sinks: 0, worstSink: 0};
    /** Schedule samples under the drawn ground on dry land, stood on it by the scene's guard. */
    let lifted = 0;
    const sample = (a: ArkAnimal, info: TownPlace, kind: TownAnimalKind, epoch: number, gap: number, problems: TownAnimalProblem[], detail = "") => {
        kinds[kind]++;
        samples.push({id: a.id, slug: a.model_slug, area: a.area ?? null, where: info.where, kind, epoch, gap, problems, detail});
    };
    const inBuilding = (points: ReadonlyArray<{x: number; z: number}>, ownHouse: Box | null) => {
        for (const p of points) {
            for (const b of buildings) if (inBox(b, p.x, p.z, -0.02)) return `a building (${buildingName.get(b)})`;
            for (const b of roomsAndPonds) if (inBox(b, p.x, p.z, -0.02)) return "a garden room or pond";
            for (const e of houses) {
                const f = zooHouseFrame(e);
                if (ownHouse === f.box) continue;
                if (inBox(f.box, p.x, p.z, -0.02)) return `the ${e.type.replace(/_/g, " ")}`;
            }
        }
        return null;
    };

    for (const a of animals) {
        const info = placed.town.get(a.id);
        const place = placed.places.get(a.id);
        if (!info || !place) continue;
        const found = modelBase(a.model_slug);
        const plan0 = found?.plan ?? null;
        const body = arkBody(a, plan0);
        const size = found?.size ?? {x: 0.3, y: 0.5, z: 1};
        const scale = body.display / Math.max(bodyAxisExtent(a.model_slug, plan0, size), 0.05);
        const length = size.z * scale;
        const width = size.x * scale;
        const height = size.y * scale;
        const tol = townGroundTolerance(height);
        const footprint = found?.footprint ?? {x0: -0.1, x1: 0.1, z0: -0.3, z1: 0.3};
        const base = levelBase(a.model_slug, "near", found?.near.minY ?? -0.25);
        if (info.tank) {
            const t = info.tank;
            for (const epoch of epochs) {
                const pose = tankPose(t, a, body.display, height, plan0, epoch);
                const problems: TownAnimalProblem[] = [];
                const corners = bodyCorners(pose.x, pose.z, pose.yaw, length, width);
                let detail = "";
                if (!within(tankBox(t), corners)) {
                    problems.push("out_of_tank");
                    detail = `through the glass (${body.display.toFixed(2)} m in a ${t.w.toFixed(2)} × ${t.d.toFixed(2)} m tank)`;
                }
                const sinkInto = pose.motion === "hole" ? 0.3 * height + 0.01 : 0.01;
                if (pose.base < t.floor - sinkInto || (pose.spec.breath === 0 && pose.base + height > t.top + 0.02 && pose.motion !== "float")) {
                    problems.push("out_of_tank");
                    detail ||= `out of the water's column (base ${pose.base.toFixed(2)}, ${t.floor.toFixed(2)}–${t.top.toFixed(2)})`;
                }
                sample(a, info, "tank", epoch, 0, problems, detail);
            }
            continue;
        }
        if (info.display) {
            const d = info.display;
            const corners = bodyCorners(place.x, place.z, place.yaw, length, width);
            const problems: TownAnimalProblem[] = [];
            if (!within({x: d.x, z: d.z, w: d.w, d: d.d, rot: d.rot}, corners, 0.02)) problems.push("out_of_display");
            const on = drawnAt(place.ground);
            const stand = standOnGround(place.x, place.z, place.yaw, scale, base, footprint, 0, 0, on, 0.5 * tol);
            const gap = contactGap(place.x, place.z, place.yaw, stand.pitch, stand.roll, stand.rootY, scale, base, footprint, on);
            // (On its tray, perch or substrate: the drawn ground there is the display's floor.)
            // (A perched bird is held at its perch over the tray: its base is the perch's height.)
            const perched = d.form === "cage" && place.ground > d.floor + 0.02;
            const off = perched ? Math.abs(place.ground - perchHeight(d)) > 0.005 : Math.abs(stand.ground - place.ground) > 0.02;
            if ((!perched && gap > tol) || off) problems.push("floats");
            if (!perched && gap < -tol) problems.push("sinks");
            sample(a, info, "display", 0, gap, problems, problems.length ? `in its ${d.form} (${d.w.toFixed(2)} m), ${off ? `the floor ${stand.ground.toFixed(2)} vs ${place.ground.toFixed(2)}` : `gap ${gap.toFixed(3)}`}` : "");
            continue;
        }
        if (info.where === "pool") {
            sample(a, info, "water", 0, 0, []);
            continue;
        }
        const zooHouse = info.where === "indoor" && info.enclosure ? zooHouseFrame(info.enclosure) : null;
        if (zooHouse) {
            const corners = bodyCorners(place.x, place.z, place.yaw, length, width);
            const problems: TownAnimalProblem[] = [];
            if (!within(zooHouse.inner, corners, 0.01)) problems.push("out_of_house");
            const on = drawnAt(place.ground);
            const stand = standOnGround(place.x, place.z, place.yaw, scale, base, footprint, 0, 0, on, 0.5 * tol);
            const gap = contactGap(place.x, place.z, place.yaw, stand.pitch, stand.roll, stand.rootY, scale, base, footprint, on);
            if (gap > tol || Math.abs(stand.ground - zooHouse.floor) > 0.02) problems.push("floats");
            if (gap < -tol) problems.push("sinks");
            sample(a, info, "zoo_house", 0, gap, problems, problems.length ? `${(gap * 100).toFixed(1)} cm, floor ${stand.ground.toFixed(2)} vs ${zooHouse.floor.toFixed(2)}` : "");
            continue;
        }
        if (HIGH.has(info.where)) {
            sample(a, info, "raised", 0, 0, []);
            continue;
        }
        // On the ground at its place (as the scene stands it when it rests there, or before its schedule is in).
        const on = drawnAt(place.ground);
        const stand = standOnGround(place.x, place.z, place.yaw, scale, base, footprint, 0, 0, on, 0.5 * tol);
        const gap = contactGap(place.x, place.z, place.yaw, stand.pitch, stand.roll, stand.rootY, scale, base, footprint, on);
        const problems: TownAnimalProblem[] = [];
        if (gap > tol) problems.push("floats");
        if (gap < -tol) problems.push("sinks");
        const wall = inBuilding(bodyCorners(place.x, place.z, place.yaw, length * 0.6, width * 0.6), null);
        if (wall) problems.push("in_wall");
        sample(a, info, "ground", 0, gap, problems, wall ? `in ${wall}` : problems.length ? `${(gap * 100).toFixed(1)} cm` : "");
        // The scene's old rule: the wild island's drawn ground at the town's world position.
        const wild = (x: number, z: number) => drawnGroundHeight(x + origin.x, z + origin.z);
        const before = standOnGround(place.x, place.z, place.yaw, scale, base, footprint, 0, 0, wild, 0.5 * tol);
        const beforeGap = contactGap(place.x, place.z, place.yaw, before.pitch, before.roll, before.rootY, scale, base, footprint, on);
        if (beforeGap < -tol) legacy.sinks++;
        else if (beforeGap > tol) legacy.floats++;
        legacy.worstSink = Math.min(legacy.worstSink, beforeGap);

        // Through the day on the schedule (the town's own world, as the scene's; a scheduled town animal only).
        const scheduled = world && !info.still && !["window", "indoor", "pool"].includes(info.where) && onSchedule(place, a.model_slug) && onBehaviourSchedule(a.model_slug);
        if (!scheduled) continue;
        const profile = behaviourProfile(a.model_slug, plan0);
        const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
        let trip: Trip | null = null;
        const depth = speciesDepth(a.model_slug, a.zone);
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, profile, own, epoch, hoursAt, a.activity ?? null, trip);
            const at = poseOnTrip(world, trip, epoch);
            if (at.aloft) {
                sample(a, info, "air", epoch, 0, []);
                continue;
            }
            const ground = townHeight(at.x, at.z);
            const surface = townWaterSurface(at.x, at.z);
            const wet = surface !== null && ground < surface;
            if (wet || inDepthBand(depth, at, ground, surface ?? 0)) {
                // In the canal or a pond: within its water, never under its bed.
                const problems: TownAnimalProblem[] = at.y < ground - 0.05 ? ["sinks"] : [];
                sample(a, info, "water", epoch, at.y - ground, problems, problems.length ? `under the bed by ${(ground - at.y).toFixed(2)} m` : "");
                continue;
            }
            const top = drawnAt(at.y)(at.x, at.z);
            const problems: TownAnimalProblem[] = [];
            // (Under the drawn ground where no water is, the scene stands it on the ground: `islands/scene.ts` bound.)
            const under = at.y < ground - 0.02;
            if (under) lifted++;
            const y = under ? drawnAt(ground)(at.x, at.z) : at.y;
            // (Sunk: under what is drawn there, the tile, a pavement, a floor; the analytic ground is not drawn.)
            if (y < Math.min(ground - 0.01, top - 0.02)) problems.push("sinks");
            const clearance = Math.min(Math.max(body.display * 0.2, 0.1), 0.6);
            // (In a wall: its middle in a building, a garden room, a pond, a zoo house; the walk grid's fat fence lines are not walls.)
            void clearance;
            const blocked = false;
            const wall = !at.moving && y <= top + 0.05 ? inBuilding([{x: at.x, z: at.z}], null) : null;
            if (wall) problems.push("in_wall");
            sample(a, info, y > top + 0.05 ? "raised" : "ground", epoch, y - top, problems, problems.length ? `${trip.doing} ${trip.to.point ?? "-"} ${problems.includes("sinks") ? `${(ground - at.y).toFixed(2)} m under the ground` : ""}${wall ? ` in ${wall}` : blocked ? " in a building, trunk or fence line" : ""}` : "");
        }
    }
    setIslandWater(null);
    const counts = {floats: 0, sinks: 0, in_wall: 0, out_of_tank: 0, out_of_display: 0, out_of_house: 0} as Record<TownAnimalProblem, number>;
    const per = new Map<string, Set<TownAnimalProblem>>();
    for (const s of samples) for (const p of s.problems) (per.get(s.id) ?? per.set(s.id, new Set()).get(s.id)!).add(p);
    per.forEach((set) => set.forEach((p) => counts[p]++));
    return {animals: animals.length, samples: samples.length, kinds, counts, legacy, lifted, problems: samples.filter((s) => s.problems.length)};
}
