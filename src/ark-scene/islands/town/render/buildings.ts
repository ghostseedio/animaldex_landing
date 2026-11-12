/**
 * The town's buildings as geometry (docs/ark/town-island.md): every building of the plan, in true metres, built into
 * its chunk's solid mesh and window-glass mesh. Each window is recorded with whose it is (a household, a shop, the
 * church), so `people.ts` can light it on the island clock: the town's people are implied by its lit windows, never
 * shown.
 *
 * Style: the Ark's low-poly look (flat shading, vertex colours, soft PBR light), a British-ish market town: brick and
 * painted render, slate and clay tiles, sash windows, shopfronts with awnings on the high street.
 */

import {corners, rng, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {Building} from "@/ark-scene/islands/town/plan";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";

export type WindowOwner = "home" | "shop" | "pub" | "civic" | "church" | "farm" | "zoo" | "mill" | "harbour";

export type WindowRecord = {
    building: string;
    owner: WindowOwner;
    /** The household within the building (homes), else 0. */
    household: number;
    /** First vertex of its glass in the chunk's glass mesh, and how many. */
    start: number;
    count: number;
    floor: number;
    seed: number;
};

export type BuildingChunk = {solid: Geo; glass: Geo; windows: WindowRecord[]};

const BRICKS = ["#a65840", "#9a4e3a", "#b46a4c", "#8f4a36", "#b9785a"];
const RENDERS = ["#ece2cc", "#e6dac0", "#f0e9d8", "#d8cdb2", "#cfd9d2", "#e8cfb0", "#dfe3e6", "#efe0c6"];
const SLATE = ["#4e535a", "#585d64", "#4a4d52"];
const TILES = ["#985638", "#8a4a32", "#a5654a", "#7c4a38"];
const DOORS = ["#2f4f6f", "#7a2e2e", "#2e5a3a", "#232323", "#d0a640", "#5a3e6a", "#f2ece0"];
const AWNINGS = ["#2f6a4a", "#8a2f2f", "#2f4a7a", "#c9a23c", "#6a3a6a", "#3a3a3a", "#b85a2a"];
const TRIM = tone("#f1ebdf");
const STONE = tone("#bdb19a");
const PLINTH = tone("#8e877a");
const GLASS = tone("#2a3640");

function pick<T>(list: readonly T[], r: () => number): T {
    return list[Math.floor(r() * list.length) % list.length];
}

/** The frame of a building: its footprint's middle on the floor (the highest ground under it), turned as it is. */
export function buildingFrame(b: Box): Frame {
    let high = -Infinity;
    for (const c of corners(b)) high = Math.max(high, townHeight(c.x, c.z));
    high = Math.max(high, townHeight(b.x, b.z));
    return {x: b.x, y: high + 0.15, z: b.z, rot: b.rot};
}

/** The plinth: from the floor down into the ground, so a slope never shows a gap. */
function plinth(geo: Geo, f: Frame, w: number, d: number, colour = PLINTH) {
    geo.box(f, 0, -1.6, 0, w + 0.1, 1.75, d + 0.1, colour);
}

type Side = {frame: Frame; length: number};

/** The four walls' frames (local +z outward, x along the wall): front, right, back, left. */
function sides(f: Frame, w: number, d: number): Side[] {
    const p = (lx: number, lz: number) => at(f, lx, 0, lz);
    const front = p(0, d / 2);
    const right = p(w / 2, 0);
    const back = p(0, -d / 2);
    const left = p(-w / 2, 0);
    return [
        {frame: {x: front[0], y: f.y, z: front[2], rot: f.rot}, length: w},
        {frame: {x: right[0], y: f.y, z: right[2], rot: f.rot - Math.PI / 2}, length: d},
        {frame: {x: back[0], y: f.y, z: back[2], rot: f.rot + Math.PI}, length: w},
        {frame: {x: left[0], y: f.y, z: left[2], rot: f.rot + Math.PI / 2}, length: d}
    ];
}

type Ctx = {chunk: BuildingChunk; building: Building; seed: number};

/** One window on a wall: its trim on the solid mesh, its glass recorded for the lit schedule. */
function windowAt(ctx: Ctx, side: Frame, u: number, y: number, w: number, h: number, owner: WindowOwner, household: number, floor: number, trim = TRIM) {
    const {chunk} = ctx;
    const t = 0.12;
    chunk.solid.quad(at(side, u - w / 2 - t, y - h / 2 - t, 0.03), at(side, u + w / 2 + t, y - h / 2 - t, 0.03), at(side, u + w / 2 + t, y + h / 2 + t, 0.03), at(side, u - w / 2 - t, y + h / 2 + t, 0.03), trim);
    // A sill under it.
    chunk.solid.box(side, u, y - h / 2 - t - 0.06, 0.08, w + 0.4, 0.08, 0.16, trim);
    const start = chunk.glass.pos.length / 3;
    chunk.glass.quad(at(side, u - w / 2, y - h / 2, 0.05), at(side, u + w / 2, y - h / 2, 0.05), at(side, u + w / 2, y + h / 2, 0.05), at(side, u - w / 2, y + h / 2, 0.05), GLASS);
    // The glazing bar across the middle (a sash).
    chunk.solid.quad(at(side, u - w / 2, y + 0.03, 0.06), at(side, u + w / 2, y + 0.03, 0.06), at(side, u + w / 2, y + 0.09, 0.06), at(side, u - w / 2, y + 0.09, 0.06), trim);
    chunk.windows.push({building: ctx.building.id, owner, household, start, count: 6, floor, seed: (ctx.seed + Math.round(u * 13) * 7 + floor * 131) >>> 0});
}

/** Windows along a wall: `per` columns per floor, skipping a gap for the door on the ground floor. */
function windowRow(ctx: Ctx, side: Side, floors: number, floorH: number, columns: number, owner: WindowOwner, householdOf: (u: number, floor: number) => number, skip: (u: number, floor: number) => boolean = () => false, size: [number, number] = [1.05, 1.35]) {
    if (columns <= 0) return;
    for (let floor = 0; floor < floors; floor++) {
        const y = floor * floorH + floorH * 0.55;
        for (let k = 0; k < columns; k++) {
            const u = -side.length / 2 + (side.length * (k + 0.5)) / columns;
            if (skip(u, floor)) continue;
            windowAt(ctx, side.frame, u, y, size[0], size[1], owner, householdOf(u, floor), floor);
        }
    }
}

function door(geo: Geo, side: Frame, u: number, colour: [number, number, number], w = 1.0, h = 2.1) {
    geo.box(side, u, 0, 0.02, w + 0.24, h + 0.12, 0.08, TRIM);
    geo.box(side, u, 0, 0.06, w, h, 0.08, colour);
    // The step.
    geo.box(side, u, -0.15, 0.35, w + 0.5, 0.15, 0.6, STONE);
}

function chimney(geo: Geo, f: Frame, lx: number, lz: number, y: number, h: number, colour: [number, number, number]) {
    geo.box(f, lx, y, lz, 0.7, h, 0.55, colour);
    geo.box(f, lx, y + h, lz, 0.84, 0.14, 0.68, tone("#7a7066"));
    geo.cylinder(f, lx - 0.15, y + h + 0.14, lz, 0.1, 0.1, 0.35, tone("#9a5a40"), 6);
    geo.cylinder(f, lx + 0.17, y + h + 0.14, lz, 0.1, 0.1, 0.3, tone("#9a5a40"), 6);
}

// MARK: - Homes

function house(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = r() < 0.55;
    const wall = tone(brick ? pick(BRICKS, r) : pick(RENDERS, r));
    const roof = tone(r() < 0.5 ? pick(SLATE, r) : pick(TILES, r));
    const w = b.at.w;
    const d = b.at.d;
    plinth(solid, f, w, d);
    solid.box(f, 0, 0, 0, w, b.eaves, d, wall);
    // A string course between the floors, and white quoins on rendered houses.
    if (b.floors > 1) solid.box(f, 0, b.eaves / 2 - 0.08, 0, w + 0.06, 0.12, d + 0.06, brick ? tone("#c9b9a0") : wall.map((c) => c * 0.92) as [number, number, number]);
    const rise = Math.min(w, d) * (b.roof === "hip" ? 0.36 : 0.42);
    // The ridge runs along the street (local x), unless the house is deeper than wide.
    const along = w >= d * 0.9;
    if (b.roof === "hip") solid.hip(f, 0, b.eaves, 0, along ? w : d, along ? d : w, rise, 0.35, roof, along ? 0 : Math.PI / 2);
    else solid.gable(f, 0, b.eaves, 0, along ? w : d, along ? d : w, rise, 0.35, roof, wall, along ? 0 : Math.PI / 2);
    chimney(solid, f, (r() < 0.5 ? -1 : 1) * (w / 2 - 0.9), -0.4, b.eaves + rise * 0.5, rise * 0.75 + 0.6, wall.map((c) => c * 0.9) as [number, number, number]);
    const [front, right, back, left] = sides(f, w, d);
    const doorU = (r() < 0.5 ? -1 : 1) * (w / 2 - 1.4);
    door(solid, front.frame, doorU, tone(pick(DOORS, r)));
    // A porch hood over the door, sometimes.
    if (r() < 0.6) solid.box(front.frame, doorU, 2.35, 0.45, 1.6, 0.12, 0.9, roof);
    const floorH = b.eaves / b.floors;
    windowRow(ctx, front, b.floors, floorH, 2, "home", () => 0, (u, floor) => floor === 0 && Math.abs(u - doorU) < 1.4);
    if (b.floors === 1) windowAt(ctx, front.frame, -doorU, floorH * 0.55, 1.05, 1.35, "home", 0, 0);
    windowRow(ctx, back, b.floors, floorH, 2, "home", () => 0);
    windowRow(ctx, right, b.floors, floorH, d > 8 ? 1 : 0, "home", () => 0, (_, floor) => floor === 0);
    windowRow(ctx, left, b.floors, floorH, d > 8 ? 1 : 0, "home", () => 0, (_, floor) => floor === 1);
    // A bay window on some.
    if (r() < 0.3 && b.floors > 1) {
        const u = -doorU;
        solid.box(front.frame, u, 0, 0.45, 2.3, floorH * 0.85, 0.9, wall);
        solid.box(front.frame, u, floorH * 0.85, 0.45, 2.5, 0.16, 1.1, roof);
        windowAt(ctx, {...front.frame, ...pos(front.frame, u, 0.91)}, 0, floorH * 0.45, 1.7, 1.25, "home", 0, 0);
    }
}

function pos(side: Frame, u: number, out: number): {x: number; z: number} {
    const p = at(side, u, 0, out);
    return {x: p[0], z: p[2]};
}

function terrace(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = r() < 0.7;
    const wall = tone(brick ? pick(BRICKS, r) : pick(RENDERS, r));
    const roof = tone(pick(SLATE, r));
    const w = b.at.w;
    const d = b.at.d;
    plinth(solid, f, w, d);
    solid.box(f, 0, 0, 0, w, b.eaves, d, wall);
    const rise = d * 0.36;
    solid.gable(f, 0, b.eaves, 0, w, d, rise, 0.3, roof, wall);
    const homeW = w / b.households;
    const [front, , back] = sides(f, w, d);
    const floorH = b.eaves / b.floors;
    for (let k = 0; k < b.households; k++) {
        const u0 = -w / 2 + homeW * k;
        const mid = u0 + homeW / 2;
        // Some homes painted, so the row reads as four.
        if (!brick || r() < 0.3) solid.box(front.frame, mid, 0, 0.01, homeW - 0.04, b.eaves, 0.04, tone(pick(RENDERS, r)));
        if (k > 0) chimney(solid, f, u0, -0.2, b.eaves + rise * 0.55, rise * 0.6 + 0.5, wall.map((c) => c * 0.9) as [number, number, number]);
        const doorU = mid + (k % 2 ? 1 : -1) * (homeW / 2 - 0.9);
        if (b.shopfront) {
            // A shop on the ground floor: a glazed front, a fascia with the shop's colour, an awning.
            const colour = tone(pick(AWNINGS, r));
            solid.box(front.frame, mid, 0, 0.06, homeW - 0.3, 3.2, 0.12, colour.map((c) => c * 0.8) as [number, number, number]);
            windowAt(ctx, front.frame, mid - 0.5, 1.45, homeW - 2.2, 2.0, "shop", k, 0, colour);
            solid.box(front.frame, mid, 3.05, 0.2, homeW - 0.2, 0.55, 0.1, colour);
            door(solid, front.frame, doorU, tone("#2a2a2a"), 0.95);
            awning(solid, front.frame, mid, 2.75, homeW - 0.6, colour);
        } else {
            door(solid, front.frame, doorU, tone(pick(DOORS, r)));
            windowAt(ctx, front.frame, mid - (doorU - mid) * 0.7, floorH * 0.55, 1.15, 1.4, "home", k, 0);
        }
        for (let floor = 1; floor < b.floors; floor++) {
            windowAt(ctx, front.frame, mid - 0.95, floor * floorH + floorH * 0.55, 1.0, 1.35, "home", k, floor);
            windowAt(ctx, front.frame, mid + 0.95, floor * floorH + floorH * 0.55, 1.0, 1.35, "home", k, floor);
        }
        // The back: a door to the yard, a window per floor; homes run the other way round from the back.
        const backU = -mid;
        door(solid, back.frame, backU + 1.2, tone("#5a4a3a"), 0.9);
        for (let floor = 0; floor < b.floors; floor++) windowAt(ctx, back.frame, backU - 0.9, floor * floorH + floorH * 0.55, 1.0, 1.25, "home", k, floor);
    }
}

function awning(geo: Geo, side: Frame, u: number, y: number, w: number, colour: [number, number, number]) {
    const out = 1.3;
    const drop = 0.55;
    const a = at(side, u - w / 2, y, 0.1);
    const b = at(side, u + w / 2, y, 0.1);
    const c = at(side, u + w / 2, y - drop, out);
    const d = at(side, u - w / 2, y - drop, out);
    geo.quad(d, c, b, a, colour);
    geo.quad(a, b, c, d, colour.map((x) => x * 0.6) as [number, number, number]);
    // The valance.
    geo.quad(at(side, u - w / 2, y - drop - 0.25, out), at(side, u + w / 2, y - drop - 0.25, out), c, d, colour.map((x) => x * 0.85) as [number, number, number]);
}

function flats(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const wall = tone(r() < 0.5 ? pick(["#c8c0b2", "#b9b1a3", "#d6cfc2", "#c4b49c"], r) : pick(BRICKS, r));
    const w = b.at.w;
    const d = b.at.d;
    plinth(solid, f, w, d);
    solid.box(f, 0, 0, 0, w, b.eaves, d, wall);
    if (b.roof === "flat") {
        // A parapet round a flat roof, a lift housing.
        solid.box(f, 0, b.eaves, 0, w + 0.2, 0.7, d + 0.2, wall.map((c) => c * 0.94) as [number, number, number], 0, {top: tone("#6a6a66")});
        solid.box(f, w / 4, b.eaves + 0.7, -d / 6, 3, 2.2, 3, wall.map((c) => c * 0.9) as [number, number, number]);
    } else {
        solid.hip(f, 0, b.eaves, 0, w, d, d * 0.3, 0.4, tone(pick(SLATE, r)));
    }
    const [front, right, back, left] = sides(f, w, d);
    const floorH = b.eaves / b.floors;
    // Two flats a floor: the left half and the right half (from the front).
    const perFloor = Math.max(1, Math.round(b.households / b.floors));
    const household = (u: number, floor: number, mirrored = false) => Math.min(b.households - 1, floor * perFloor + ((mirrored ? -u : u) > 0 ? 1 : 0) % perFloor);
    door(solid, front.frame, 0, tone(pick(DOORS, r)), 1.6, 2.3);
    solid.box(front.frame, 0, 2.5, 0.6, 2.6, 0.15, 1.2, tone("#7a7a76"));
    windowRow(ctx, front, b.floors, floorH, 6, "home", (u, floor) => household(u, floor), (u, floor) => floor === 0 && Math.abs(u) < 1.5);
    windowRow(ctx, back, b.floors, floorH, 6, "home", (u, floor) => household(u, floor, true));
    windowRow(ctx, right, b.floors, floorH, 2, "home", (_, floor) => household(1, floor));
    windowRow(ctx, left, b.floors, floorH, 2, "home", (_, floor) => household(-1, floor));
    // Balconies on the back, one per flat above the ground floor.
    for (let floor = 1; floor < b.floors; floor++) {
        for (const u of [-w / 4, w / 4]) {
            solid.box(back.frame, u, floor * floorH - 0.1, 0.7, 3.2, 0.18, 1.4, tone("#9a968e"));
            solid.box(back.frame, u, floor * floorH + 0.08, 1.38, 3.2, 1.0, 0.05, tone("#3a3d40"));
        }
    }
}

// MARK: - The old town and the harbour

function shop(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const wall = tone(r() < 0.5 ? pick(RENDERS, r) : pick(BRICKS, r));
    const w = b.at.w;
    const d = b.at.d;
    plinth(solid, f, w, d);
    solid.box(f, 0, 0, 0, w, b.eaves, d, wall);
    solid.gable(f, 0, b.eaves, 0, w, d, d * 0.32, 0.25, tone(r() < 0.6 ? pick(SLATE, r) : pick(TILES, r)), wall);
    const [front, , back] = sides(f, w, d);
    const pub = b.kind === "pub";
    const colour = tone(pub ? "#22382a" : pick(AWNINGS, r));
    solid.box(front.frame, 0, 0, 0.06, w - 0.2, 3.3, 0.14, colour.map((c) => c * 0.75) as [number, number, number]);
    windowAt(ctx, front.frame, -0.7, 1.45, w - 2.6, 2.0, pub ? "pub" : "shop", 0, 0, colour);
    door(solid, front.frame, w / 2 - 1.0, tone("#262626"), 0.95);
    solid.box(front.frame, 0, 3.1, 0.22, w - 0.1, 0.6, 0.12, colour);
    if (!pub) awning(solid, front.frame, -0.4, 2.8, w - 1.6, colour);
    else {
        // The pub's hanging sign on its bracket.
        solid.box(front.frame, -w / 2 + 0.6, 3.6, 0.6, 0.08, 0.08, 1.1, tone("#1e1e1e"));
        solid.box(front.frame, -w / 2 + 0.6, 2.7, 1.05, 0.06, 0.85, 0.7, tone("#b8862e"));
    }
    void back;
}

/** Upper-floor windows for shops: drawn after the shopfront at each floor's height. */
function shopUpper(ctx: Ctx, b: Building) {
    const f = buildingFrame(b.at);
    const [front, , back] = sides(f, b.at.w, b.at.d);
    const floorH = 3.1;
    const columns = b.at.w > 7.5 ? 3 : 2;
    for (let floor = 1; floor < b.floors; floor++) {
        for (let k = 0; k < columns; k++) {
            const u = -b.at.w / 2 + (b.at.w * (k + 0.5)) / columns;
            windowAt(ctx, front.frame, u, floor * floorH + 0.5 + floorH * 0.5, 1.0, 1.5, b.kind === "pub" ? "pub" : "shop", 0, floor);
            windowAt(ctx, back.frame, u, floor * floorH + 0.5 + floorH * 0.5, 1.0, 1.3, b.kind === "pub" ? "pub" : "shop", 0, floor);
        }
    }
}

function church(ctx: Ctx, b: Building) {
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const stone = tone("#b7ab94");
    const slate = tone("#4b5056");
    const w = b.at.w;
    const d = b.at.d;
    plinth(solid, f, w, d, tone("#8a8070"));
    // The nave along local z (the footprint is 11 wide, 24 long), its roof steep.
    solid.box(f, 0, 0, 0, w, b.eaves, d, stone);
    solid.gable(f, 0, b.eaves, 0, d, w, 6.5, 0.4, slate, stone, Math.PI / 2);
    // Buttresses and tall windows down both sides.
    const [, right, , left] = sides(f, w, d);
    for (const side of [right, left]) {
        for (let k = 0; k < 5; k++) {
            const u = -d / 2 + (d * (k + 0.5)) / 5;
            windowAt(ctx, side.frame, u, 4.6, 1.3, 4.6, "church", 0, 0, tone("#d8ccb4"));
            if (k < 4) solid.box(side.frame, u + d / 10, 0, 0.35, 0.7, b.eaves - 1.5, 0.7, stone.map((c) => c * 0.94) as [number, number, number]);
        }
    }
    // The east window, the porch.
    const [front, , back] = sides(f, w, d);
    windowAt(ctx, front.frame, 0, 5.2, 3.0, 5.2, "church", 0, 0, tone("#d8ccb4"));
    solid.box(right.frame, 3, 0, 1.8, 3.2, 3.2, 3.2, stone);
    solid.gable(right.frame, 3, 3.2, 1.8, 3.2, 3.2, 1.6, 0.2, slate, stone, Math.PI / 2);
    // The tower at the west end (the back of the footprint), and its spire.
    const tower = {...f, ...pos(back.frame, 0, 3.6)};
    const th = 22;
    solid.box(tower, 0, -1.6, 0, 7.4, th + 1.6, 7.4, stone.map((c) => c * 0.97) as [number, number, number]);
    solid.box(tower, 0, th, 0, 8, 1.0, 8, stone.map((c) => c * 0.9) as [number, number, number]);
    for (const [cx, cz] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) solid.pyramid(tower, cx, th + 1, cz, 0.8, 1.6, stone);
    solid.pyramid(tower, 0, th + 1, 0, 6.2, 14, slate);
    solid.cylinder(tower, 0, th + 15, 0, 0.06, 0.06, 1.6, tone("#c9a23c"), 4);
    // Belfry louvres and clock faces on all four sides.
    for (const side of sides(tower, 7.4, 7.4)) {
        windowAt(ctx, side.frame, 0, 18.5, 1.6, 2.8, "church", 0, 1, tone("#a89c86"));
        clockFace(solid, side.frame, 0, 14.2);
        windowAt(ctx, side.frame, 0, 8, 1.0, 2.6, "church", 0, 0, tone("#a89c86"));
    }
    door(solid, sides(tower, 7.4, 7.4)[2].frame, 0, tone("#4a3222"), 1.6, 3.0);
}

/** A tower clock's face; its hands are drawn by `render/index.ts` (they turn with the island clock). */
function clockFace(geo: Geo, side: Frame, u: number, y: number) {
    const r = 1.25;
    const n = 16;
    const centre = at(side, u, y, 0.06);
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        geo.tri(centre, at(side, u + Math.cos(a0) * r, y + Math.sin(a0) * r, 0.06), at(side, u + Math.cos(a1) * r, y + Math.sin(a1) * r, 0.06), tone("#f2efe6"));
        geo.tri(at(side, u + Math.cos(a0) * r, y + Math.sin(a0) * r, 0.05), at(side, u + Math.cos(a0) * (r + 0.18), y + Math.sin(a0) * (r + 0.18), 0.05), at(side, u + Math.cos(a1) * (r + 0.18), y + Math.sin(a1) * (r + 0.18), 0.05), tone("#c9a23c"));
        geo.tri(at(side, u + Math.cos(a0) * r, y + Math.sin(a0) * r, 0.05), at(side, u + Math.cos(a1) * (r + 0.18), y + Math.sin(a1) * (r + 0.18), 0.05), at(side, u + Math.cos(a1) * r, y + Math.sin(a1) * r, 0.05), tone("#c9a23c"));
    }
}

function hall(ctx: Ctx, b: Building) {
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const stone = tone("#d2c4a6");
    plinth(solid, f, b.at.w, b.at.d);
    solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, stone);
    solid.hip(f, 0, b.eaves, 0, b.at.w, b.at.d, 3.2, 0.5, tone("#4e535a"));
    const [front, right, back, left] = sides(f, b.at.w, b.at.d);
    // A columned portico and a clock cupola.
    for (let k = -2; k <= 2; k++) solid.cylinder(front.frame, k * 1.6, 0, 1.6, 0.3, 0.26, 5.6, tone("#ece4d2"), 8);
    solid.box(front.frame, 0, 5.6, 1.4, 8.4, 0.6, 3.2, tone("#e6dcc6"));
    solid.gable(front.frame, 0, 6.2, 1.4, 8.4, 3.2, 1.3, 0.1, tone("#e0d6c0"), tone("#e6dcc6"), 0);
    door(solid, front.frame, 0, tone("#3a2a1a"), 1.8, 3.0);
    windowRow(ctx, front, 2, 4, 6, "civic", () => 0, (u, floor) => floor === 0 && Math.abs(u) < 2.5, [1.2, 2.1]);
    windowRow(ctx, back, 2, 4, 6, "civic", () => 0, undefined, [1.2, 2.1]);
    windowRow(ctx, right, 2, 4, 3, "civic", () => 0, undefined, [1.2, 2.1]);
    windowRow(ctx, left, 2, 4, 3, "civic", () => 0, undefined, [1.2, 2.1]);
    const cupola = {...f, y: f.y + b.eaves + 2.6};
    solid.box(cupola, 0, 0, 0, 2.4, 2.6, 2.4, tone("#ece4d2"));
    for (const side of sides(cupola, 2.4, 2.4)) clockFace(solid, side.frame, 0, 1.3);
    solid.pyramid(cupola, 0, 2.6, 0, 2.6, 2.0, tone("#5a7a6a"));
}

function mill(ctx: Ctx, b: Building) {
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = tone("#9a5440");
    plinth(solid, f, b.at.w, b.at.d);
    solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, brick);
    solid.gable(f, 0, b.eaves, 0, b.at.w, b.at.d, 3.6, 0.3, tone("#4e535a"), brick);
    const all = sides(f, b.at.w, b.at.d);
    all.forEach((side, i) => windowRow(ctx, side, b.floors, b.eaves / b.floors, i % 2 ? 3 : 6, "mill", () => 0, (u, floor) => i === 0 && floor === 0 && Math.abs(u) < 1.6, [1.1, 1.5]));
    door(solid, all[0].frame, 0, tone("#3a3a40"), 2.4, 2.8);
    // A hoist loft and the chimney (the peregrines' ledge at its top).
    solid.box(all[0].frame, 0, b.eaves - 1.2, 0.6, 2.2, 3.4, 1.2, brick);
    const chimneyAt = b.tall ? {x: b.tall.x, y: f.y, z: b.tall.z, rot: 0} : f;
    solid.cylinder(chimneyAt, 0, -1.5, 0, 1.25, 0.85, (b.tall?.y ?? 30) + 1.5, brick, 10);
    solid.cylinder(chimneyAt, 0, b.tall?.y ?? 30, 0, 1.05, 1.05, 0.7, tone("#6e3e30"), 10);
}

function harbourBuilding(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    if (b.kind === "lighthouse") {
        const white = tone("#f2efe8");
        const red = tone("#b8352e");
        solid.cylinder(f, 0, -2, 0, 2.6, 2.6, 2.2, tone("#9a948a"), 12);
        for (let k = 0; k < 4; k++) solid.cylinder(f, 0, k * 4, 0, 2.1 - k * 0.12, 2.1 - (k + 1) * 0.12, 4, k % 2 ? red : white, 12, false);
        solid.cylinder(f, 0, 16, 0, 2.2, 2.2, 0.3, tone("#2a2a2a"), 12);
        const start = ctx.chunk.glass.pos.length / 3;
        ctx.chunk.glass.cylinder(f, 0, 16.3, 0, 1.3, 1.3, 1.9, tone("#e8d79a"), 12, false);
        ctx.chunk.windows.push({building: b.id, owner: "harbour", household: 0, start, count: ctx.chunk.glass.pos.length / 3 - start, floor: 4, seed: b.seed});
        solid.cylinder(f, 0, 18.2, 0, 1.6, 0.2, 1.4, red, 12);
        return;
    }
    const shed = b.kind === "fish_shed";
    const wall = tone(shed ? "#6f8796" : b.kind === "lock_house" ? "#a65840" : "#e9e2d2");
    plinth(solid, f, b.at.w, b.at.d);
    solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, wall);
    if (b.roof === "hip") solid.hip(f, 0, b.eaves, 0, b.at.w, b.at.d, 2.2, 0.3, tone("#4e535a"));
    else solid.gable(f, 0, b.eaves, 0, b.at.w, b.at.d, shed ? 1.8 : 2.4, 0.3, tone(shed ? "#5a6670" : "#4e535a"), wall);
    const [front, right, back, left] = sides(f, b.at.w, b.at.d);
    door(solid, front.frame, shed ? 0 : -b.at.w / 4, tone(shed ? "#3e4e58" : "#2f4f6f"), shed ? 3.2 : 1, shed ? 3.4 : 2.1);
    if (!shed) {
        windowRow(ctx, front, b.floors, b.eaves / b.floors, 2, "harbour", () => 0, (u, floor) => floor === 0 && u < 0);
        windowRow(ctx, back, b.floors, b.eaves / b.floors, 2, "harbour", () => 0);
        windowRow(ctx, right, b.floors, b.eaves / b.floors, 1, "harbour", () => 0);
        windowRow(ctx, left, b.floors, b.eaves / b.floors, 1, "harbour", () => 0);
    } else {
        windowRow(ctx, right, 1, 3, 4, "harbour", () => 0);
    }
    void r;
}

// MARK: - Farms

function farmBuilding(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const w = b.at.w;
    const d = b.at.d;
    if (b.kind === "coop") {
        solid.box(f, 0, 0.35, 0, w, b.eaves - 0.35, d, tone("#8a6a4a"));
        for (const [lx, lz] of [[-1, -0.8], [1, -0.8], [1, 0.8], [-1, 0.8]]) solid.box(f, lx, 0, lz, 0.12, 0.4, 0.12, tone("#5a4632"));
        solid.gable(f, 0, b.eaves, 0, w, d, 0.7, 0.15, tone("#5a3a2a"), tone("#8a6a4a"));
        solid.box(sides(f, w, d)[0].frame, 0.6, 0.35, 0.3, 0.3, 0.06, 0.9, tone("#6a5038"));
        return;
    }
    if (b.kind === "farmhouse") {
        const wall = tone(pick(["#e4dac4", "#d8cdb5", "#c9b99a", "#b46a4c"], r));
        plinth(solid, f, w, d);
        solid.box(f, 0, 0, 0, w, b.eaves, d, wall);
        solid.gable(f, 0, b.eaves, 0, w, d, d * 0.42, 0.35, tone(pick(SLATE, r)), wall);
        chimney(solid, f, w / 2 - 0.6, 0, b.eaves + d * 0.15, d * 0.4 + 0.6, wall.map((c) => c * 0.9) as [number, number, number]);
        chimney(solid, f, -w / 2 + 0.6, 0, b.eaves + d * 0.15, d * 0.4 + 0.6, wall.map((c) => c * 0.9) as [number, number, number]);
        const [front, right, back, left] = sides(f, w, d);
        door(solid, front.frame, 0, tone(pick(DOORS, r)));
        windowRow(ctx, front, 2, b.eaves / 2, 3, "farm", () => 0, (u, floor) => floor === 0 && Math.abs(u) < 1.2);
        windowRow(ctx, back, 2, b.eaves / 2, 2, "farm", () => 0);
        windowRow(ctx, right, 2, b.eaves / 2, 1, "farm", () => 0);
        windowRow(ctx, left, 2, b.eaves / 2, 1, "farm", () => 0);
        return;
    }
    // Barns and stables: timber walls, a big door, a dark roof.
    const wall = tone(b.kind === "barn" ? pick(["#9b4b36", "#7a5a3e", "#5e4a3a", "#8a3e2e"], r) : "#7a5a3e");
    solid.box(f, 0, -0.4, 0, w, b.eaves + 0.4, d, wall);
    // Boarding: darker lines up the walls.
    for (const side of sides(f, w, d)) {
        for (let u = -side.length / 2 + 0.6; u < side.length / 2; u += 0.9) solid.quad(at(side.frame, u - 0.04, 0, 0.02), at(side.frame, u + 0.04, 0, 0.02), at(side.frame, u + 0.04, b.eaves, 0.02), at(side.frame, u - 0.04, b.eaves, 0.02), wall.map((c) => c * 0.78) as [number, number, number]);
    }
    if (b.roof === "lean") {
        const a = at(f, -w / 2 - 0.3, b.eaves + 1.2, -d / 2 - 0.3);
        const bb = at(f, w / 2 + 0.3, b.eaves + 1.2, -d / 2 - 0.3);
        const c = at(f, w / 2 + 0.3, b.eaves, d / 2 + 0.4);
        const e = at(f, -w / 2 - 0.3, b.eaves, d / 2 + 0.4);
        solid.quad(e, c, bb, a, tone("#4a4440"));
        solid.quad(a, bb, c, e, tone("#3a3430"));
        const front = sides(f, w, d)[0];
        for (let k = 0; k < 3; k++) {
            solid.box(front.frame, -w / 3 + (k * w) / 3, 0, 0.04, 1.6, 2.2, 0.08, tone("#5a4030"));
            solid.box(front.frame, -w / 3 + (k * w) / 3, 1.1, 0.06, 1.6, 0.08, 0.08, tone("#2a2016"));
        }
        return;
    }
    solid.gable(f, 0, b.eaves, 0, w, d, d * 0.45, 0.4, tone(pick(["#4d4440", "#5a5550", "#6a3a2e"], r)), wall);
    const front = sides(f, w, d)[0];
    solid.box(front.frame, 0, 0, 0.05, w * 0.42, b.eaves * 0.8, 0.1, wall.map((c) => c * 0.7) as [number, number, number]);
    solid.box(front.frame, 0, 0, 0.1, 0.12, b.eaves * 0.8, 0.06, tone("#efe6d6"));
    solid.box(front.frame, 0, b.eaves * 0.8, 0.1, w * 0.42 + 0.2, 0.14, 0.06, tone("#efe6d6"));
    // A hay loft door.
    solid.box(front.frame, 0, b.eaves * 0.9, 0.06, 1.4, 1.2, 0.1, wall.map((c) => c * 0.7) as [number, number, number]);
}

// MARK: - Building one

export function buildBuilding(chunk: BuildingChunk, b: Building) {
    const ctx: Ctx = {chunk, building: b, seed: b.seed};
    switch (b.kind) {
        case "house":
            return house(ctx, b);
        case "terrace":
            return terrace(ctx, b);
        case "flats":
            return flats(ctx, b);
        case "shop":
        case "pub":
            shop(ctx, b);
            return shopUpper(ctx, b);
        case "church":
            return church(ctx, b);
        case "hall":
            return hall(ctx, b);
        case "mill":
            return mill(ctx, b);
        case "harbour_office":
        case "fish_shed":
        case "lighthouse":
        case "lock_house":
            return harbourBuilding(ctx, b);
        case "farmhouse":
        case "barn":
        case "stable":
        case "coop":
        case "shed":
            return farmBuilding(ctx, b);
        default:
            return;
    }
}

/** Where the church's and the town hall's clock faces are (for the hands): centre, outward normal, radius. */
export function clockFaces(b: Building): Array<{x: number; y: number; z: number; nx: number; nz: number; r: number}> {
    const f = buildingFrame(b.at);
    if (b.kind === "church") {
        const back = sides(f, b.at.w, b.at.d)[2];
        const tower = {...f, ...pos(back.frame, 0, 3.6)};
        return sides(tower, 7.4, 7.4).map((side) => {
            const p = at(side.frame, 0, 14.2, 0.1);
            return {x: p[0], y: p[1], z: p[2], nx: -Math.sin(side.frame.rot), nz: Math.cos(side.frame.rot), r: 1.25};
        });
    }
    if (b.kind === "hall") {
        const cupola = {...f, y: f.y + b.eaves + 2.6};
        return sides(cupola, 2.4, 2.4).map((side) => {
            const p = at(side.frame, 0, 1.3, 0.1);
            return {x: p[0], y: p[1], z: p[2], nx: -Math.sin(side.frame.rot), nz: Math.cos(side.frame.rot), r: 0.8};
        });
    }
    return [];
}
