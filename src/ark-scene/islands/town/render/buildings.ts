/**
 * The town's buildings as geometry (docs/ark/town-island.md): every building of the plan, in true metres. Each chunk's
 * buildings go into three parts (lane GB, the graphics pass):
 *
 * - **solid** (the chunk's merged solid mesh, always drawn): walls, roofs and their ridges, chimneys and pots, gutters
 *   and downpipes, doors and steps, bays, porches, dormers, shopfronts (pilasters, fascias with a generic sign: a
 *   pictogram of the trade, never words or a brand), balconies. Each face carries its surface's kind in its colour
 *   (`SURFACE`, kit `encodeColourTag`), so the building shader (`patchBuildingSurfaces`) draws brick bond, render,
 *   slates and clay tiles, stone, and their weathering (damp at the foot of the walls, streaks under the sills, moss on
 *   the roofs, soot round the chimneys) with no texture and no extra attribute.
 * - **panes** (one quad a window, with its frame, glazing bars, curtains, blinds and the room behind drawn by the pane
 *   shader, `paneMaterial`): each window is recorded with whose it is (a household, a shop, the church), so
 *   `windowState` lights it on the island clock and draws its curtains at night. The town's people are implied by its
 *   lit windows, never shown.
 * - **detail** (built near the camera only, per chunk, `BuildingDetail`): sills, lintels and surrounds, door panels and
 *   knobs, quoins, bargeboards, aerials, balcony railings with a chair and a pot plant, hanging signs, the awnings'
 *   stripes. Far off the panes' own frames and bars carry the look.
 *
 * Style: the Ark's low-poly look (flat shading, vertex colours, soft PBR light), a British-ish market town: brick and
 * painted render, slate and clay tiles, sash windows, shopfronts with awnings on the high street.
 */

import {BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, type Material, type Vector3} from "three";
import {corners, rng, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {Building, TownPlan} from "@/ark-scene/islands/town/plan";
import {chance, darkness, windowLit, type TownClock} from "@/ark-scene/islands/town/people";
import {TOWN_CHUNK_COUNT, townChunkDistance, townChunkOf, type TownChunkSpan} from "@/ark-scene/islands/town/chunks";
import {at, COLOUR_TAG_TOLERANCE, Geo, NullGeo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {TOWN_LIGHT, townWeather} from "@/ark-scene/islands/town/render/materials";
import {ARK_TIME} from "@/ark-scene/glsl";

export type WindowOwner = "home" | "shop" | "pub" | "civic" | "church" | "farm" | "zoo" | "mill" | "harbour";

export type WindowRecord = {
    building: string;
    owner: WindowOwner;
    /** The household within the building (homes), else 0. */
    household: number;
    /** First vertex of its pane in the chunk's panes mesh, and how many. */
    start: number;
    count: number;
    floor: number;
    seed: number;
};

/** A chunk's buildings: the solid (shared with the chunk's scenery), the scenery's glass, the panes and their records, the near detail. */
export type BuildingChunk = {solid: Geo; glass: Geo; windows: WindowRecord[]; panes: Geo; detail: Geo};

const NULL_GEO = new NullGeo();

/** A chunk's building parts (on the scenery's solid and glass when it has them); `detail` keeps nothing unless asked. */
export function newBuildingChunk(scenery?: {solid: Geo; glass: Geo} | null, detail: Geo = NULL_GEO): BuildingChunk {
    return {solid: scenery?.solid ?? new Geo(), glass: scenery?.glass ?? new Geo(), windows: [], panes: new Geo(), detail};
}

/** The building surfaces' kinds (in the colour: kit `encodeColourTag`); the building shader's patterns. */
export const SURFACE = {brick: 1, render: 2, slate: 3, tile: 4, stone: 5, timber: 6, paint: 7, metal: 8, felt: 9, concrete: 10} as const;

/** The panes' kinds (the pane shader's frames and bars). */
export const PANE = {sash: 0, casement: 1, modern: 2, shop: 3, church: 4, civic: 5, works: 6, plain: 7} as const;

const BRICKS = ["#a65840", "#9a4e3a", "#b46a4c", "#8f4a36", "#b9785a", "#a0624a", "#874434"];
const RENDERS = ["#ece2cc", "#e6dac0", "#f0e9d8", "#d8cdb2", "#cfd9d2", "#e8cfb0", "#dfe3e6", "#efe0c6", "#c9d3dc", "#e9d6c8"];
const SLATE = ["#4e535a", "#585d64", "#4a4d52", "#55575a"];
const TILES = ["#985638", "#8a4a32", "#a5654a", "#7c4a38", "#93583e"];
const DOORS = ["#2f4f6f", "#7a2e2e", "#2e5a3a", "#232323", "#d0a640", "#5a3e6a", "#f2ece0", "#3a6a70", "#6a4a2e", "#8a8f94"];
/** The shops' colours (fascias, awnings, frames); the pane shader's swatches 0-6 are these. */
const AWNINGS = ["#2f6a4a", "#8a2f2f", "#2f4a7a", "#c9a23c", "#6a3a6a", "#3a3a3a", "#b85a2a"];
const TRIM = tone("#f1ebdf");
const STONE = tone("#bdb19a");
const PLINTH = tone("#8e877a");
const GUTTER = tone("#26292c");
const LEAD = tone("#5e6266");

function pick<T>(list: readonly T[], r: () => number): T {
    return list[Math.floor(r() * list.length) % list.length];
}

function shade(c: [number, number, number], k: number): [number, number, number] {
    return [c[0] * k, c[1] * k, c[2] * k];
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
    geo.as(SURFACE.stone, () => geo.box(f, 0, -1.6, 0, w + 0.1, 1.75, d + 0.1, colour));
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

/** How a building's windows look: their kind, the surround (brick: stone sill and lintel; render: a painted surround). */
type Look = {pane: number; surround: "brick" | "render" | "stone" | "none"; swatch?: number};

type Ctx = {chunk: BuildingChunk; building: Building; seed: number; look: Look};

// MARK: - Panes

/** The size of a pane (m) in one float: its width and height at 5 cm, constant over its quad. */
export function paneSizeCode(w: number, h: number): number {
    return Math.round(w * 20) * 1000 + Math.min(Math.round(h * 20), 999);
}

/** The pane's style in one float: its seed × 256 + kind × 32 + swatch (curtains, or a shop's frame colour) × 2 + blinds. */
export function paneStyle(kind: number, swatch: number, blinds: boolean, seed = 0): number {
    return (seed % 4096) * 256 + kind * 32 + (swatch % 16) * 2 + (blinds ? 1 : 0);
}

/**
 * One pane on a wall: a quad of `w` × `h` (m, its frame included) centred at (u, y), its own metres and style in its
 * vertices (`col`: u, v, style; `extra`: its size), facing out of the wall.
 */
function pane(geo: Geo, side: Frame, u: number, y: number, w: number, h: number, style: number, out = 0.035) {
    if (geo instanceof NullGeo) return;
    const nx = -Math.sin(side.rot);
    const nz = Math.cos(side.rot);
    const size = paneSizeCode(w, h);
    const corner = (cu: number, cv: number) => {
        const p = at(side, u - w / 2 + cu * w, y - h / 2 + cv * h, out);
        geo.pos.push(p[0], p[1], p[2]);
        geo.nor.push(nx, 0, nz);
        geo.col.push(cu * w, cv * h, style);
        geo.extra.push(size);
    };
    for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) corner(cu, cv);
}

/** The frame round the glass in a pane (m), by kind (the shader's own numbers). */
const FRAME: Record<number, number> = {0: 0.075, 1: 0.07, 2: 0.055, 3: 0.09, 4: 0.09, 5: 0.08, 6: 0.06, 7: 0.05};

/**
 * One window on a wall: its pane (frame and bars in the shader), recorded for the lit schedule; near, its sill and
 * lintel (brick) or painted surround (render) in the detail. `w` × `h` is the glass; `trim`, a surround's colour.
 */
function windowAt(ctx: Ctx, side: Frame, u: number, y: number, w: number, h: number, owner: WindowOwner, household: number, floor: number, trim = TRIM, kind = ctx.look.pane) {
    const {chunk} = ctx;
    const f = FRAME[kind] ?? 0.07;
    const pw = w + f * 2;
    const ph = h + f * 2;
    const seed = (ctx.seed + Math.round(u * 13) * 7 + floor * 131) >>> 0;
    // Curtains by household (its rooms share them; bedrooms upstairs another), blinds in about one window in five.
    const swatch = ctx.look.swatch ?? (owner === "home" ? Math.floor(chance(ctx.building.id, household, floor > 0 ? "up" : "down") * 16) : Math.floor(chance(ctx.building.id, seed) * 16));
    const blinds = chance(ctx.building.id, seed, "blinds") < (owner === "home" ? 0.2 : owner === "civic" || owner === "harbour" ? 0.6 : 0);
    const start = chunk.panes.pos.length / 3;
    pane(chunk.panes, side, u, y, pw, ph, paneStyle(kind, swatch, blinds, seed));
    chunk.windows.push({building: ctx.building.id, owner, household, start, count: 6, floor, seed});
    // Near: the sill under it; a stone lintel over a brick window, a painted surround round a rendered one.
    const d = chunk.detail;
    const surround = ctx.look.surround;
    if (surround === "none") return;
    const sill = surround === "brick" || surround === "stone" ? STONE : trim;
    d.as(surround === "render" ? SURFACE.paint : SURFACE.stone, () => d.box(side, u, y - ph / 2 - 0.09, 0.07, pw + 0.22, 0.09, 0.15, sill));
    if (surround === "brick") d.as(SURFACE.stone, () => d.box(side, u, y + ph / 2, 0.025, pw + 0.24, 0.2, 0.05, shade(STONE, 0.96)));
    else if (surround === "stone") d.as(SURFACE.stone, () => d.box(side, u, y + ph / 2, 0.03, pw + 0.3, 0.26, 0.06, shade(STONE, 0.94)));
    else {
        d.as(SURFACE.paint, () => {
            d.box(side, u, y + ph / 2, 0.02, pw + 0.2, 0.1, 0.04, trim);
            d.box(side, u - pw / 2 - 0.05, y - ph / 2, 0.02, 0.1, ph, 0.04, trim);
            d.box(side, u + pw / 2 + 0.05, y - ph / 2, 0.02, 0.1, ph, 0.04, trim);
        });
    }
}

/** Windows along a wall: `columns` per floor, skipping a gap for the door on the ground floor. */
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

// MARK: - Doors, chimneys, gutters, roofs

/** The door's detail, near: four panels, a knob and a letterbox (the door itself is in the solid, `door`). */
let doorDetail: Geo | null = null;

/**
 * A front door: its case and slab, a fanlight over it on the taller ones, the step; near, its panels, knob and letterbox.
 * (The signature is the town lane's: `geo` is the solid; the detail goes to the building being drawn.)
 */
function door(geo: Geo, side: Frame, u: number, colour: [number, number, number], w = 1.0, h = 2.1, fanlight?: {panes: Geo; style: number}) {
    geo.as(SURFACE.paint, () => {
        geo.box(side, u, 0, 0.02, w + 0.24, h + 0.12 + (fanlight ? 0.5 : 0), 0.08, TRIM);
        geo.box(side, u, 0, 0.06, w, h, 0.08, colour);
    });
    if (fanlight) pane(fanlight.panes, side, u, h + 0.3, w, 0.42, fanlight.style, 0.07);
    geo.as(SURFACE.stone, () => geo.box(side, u, -0.15, 0.35, w + 0.5, 0.15, 0.6, STONE));
    const d = doorDetail;
    if (!d) return;
    d.as(SURFACE.paint, () => {
        const pw = w * 0.32;
        for (const [du, dy, ph] of [[-0.22, 0.25, 0.75], [0.22, 0.25, 0.75], [-0.22, 1.2, 0.7], [0.22, 1.2, 0.7]] as const) d.box(side, u + du * w, dy, 0.1, pw, ph * (h / 2.1), 0.03, shade(colour, 0.82));
    });
    d.as(SURFACE.metal, () => {
        d.box(side, u + w * 0.36, h * 0.48, 0.12, 0.06, 0.06, 0.05, tone("#c9a85a"));
        d.box(side, u, h * 0.55, 0.11, 0.26, 0.05, 0.03, tone("#c9a85a"));
    });
}

function chimney(geo: Geo, f: Frame, lx: number, lz: number, y: number, h: number, colour: [number, number, number], aerial = false) {
    geo.as(SURFACE.brick, () => geo.box(f, lx, y, lz, 0.7, h, 0.55, colour));
    geo.as(SURFACE.stone, () => geo.box(f, lx, y + h, lz, 0.84, 0.14, 0.68, tone("#7a7066")));
    geo.as(SURFACE.tile, () => {
        geo.cylinder(f, lx - 0.15, y + h + 0.14, lz, 0.1, 0.09, 0.35, tone("#9a5a40"), 6);
        geo.cylinder(f, lx + 0.17, y + h + 0.14, lz, 0.1, 0.09, 0.3, tone("#9a5a40"), 6);
    });
    const d = doorDetail;
    if (aerial && d) {
        // A television aerial on its mast (people implied).
        d.as(SURFACE.metal, () => {
            d.box(f, lx + 0.3, y + h + 0.1, lz, 0.04, 1.6, 0.04, tone("#7c8084"));
            d.box(f, lx + 0.3, y + h + 1.45, lz, 0.04, 0.04, 1.1, tone("#7c8084"));
            for (const dz of [-0.4, -0.15, 0.1, 0.35]) d.box(f, lx + 0.3, y + h + 1.45, lz + dz, 0.5, 0.025, 0.025, tone("#7c8084"));
        });
    }
}

/** Gutters along the eaves of the front and back, a downpipe at each end of the front. */
function gutters(geo: Geo, f: Frame, w: number, d: number, eaves: number, pipes = 2) {
    const [front, , back] = sides(f, w, d);
    geo.as(SURFACE.metal, () => {
        for (const side of [front, back]) geo.box(side.frame, 0, eaves - 0.16, 0.3, w + 0.6, 0.12, 0.13, GUTTER);
        const ends = pipes >= 2 ? [-w / 2 + 0.18, w / 2 - 0.18] : [w / 2 - 0.18];
        for (const u of ends) geo.box(front.frame, u, 0.15, 0.09, 0.09, eaves - 0.3, 0.09, GUTTER);
        for (const u of ends) geo.box(back.frame, u, 0.15, 0.09, 0.09, eaves - 0.3, 0.09, GUTTER);
    });
}

/** A ridge of capping tiles along a gable roof's ridge (local x), at `y + rise`. */
function ridge(geo: Geo, f: Frame, length: number, y: number, colour: [number, number, number], turn = 0) {
    geo.as(SURFACE.tile, () => geo.box({...f, rot: f.rot + turn}, 0, y - 0.08, 0, length + 0.5, 0.2, 0.26, shade(colour, 0.85)));
}

/** Bargeboards on a gable's verges (near): painted boards under the roof's edge at both ends. */
function bargeboards(f: Frame, w: number, d: number, eaves: number, rise: number, overhang: number, colour: [number, number, number], turn = 0) {
    const g = doorDetail;
    if (!g) return;
    const fr = {...f, rot: f.rot + turn};
    g.as(SURFACE.paint, () => {
        for (const sx of [-1, 1]) {
            const x = sx * (w / 2 + overhang - 0.04);
            const a = at(fr, x, eaves - overhang * (rise / (d / 2)) - 0.05, d / 2 + overhang);
            const b = at(fr, x, eaves + rise - 0.05, 0);
            const c = at(fr, x, eaves - overhang * (rise / (d / 2)) - 0.05, -d / 2 - overhang);
            const down = (p: [number, number, number]): [number, number, number] => [p[0], p[1] - 0.22, p[2]];
            const o = (p: [number, number, number]): [number, number, number] => [p[0] + Math.cos(fr.rot) * sx * 0.05, p[1], p[2] + Math.sin(fr.rot) * sx * 0.05];
            g.quad(o(down(a)), o(down(b)), o(b), o(a), colour);
            g.quad(o(down(b)), o(down(c)), o(c), o(b), colour);
        }
    });
}

/** Quoins up a rendered house's corners (near): stone blocks, long and short in turn. */
function quoins(f: Frame, w: number, d: number, eaves: number) {
    const g = doorDetail;
    if (!g) return;
    const [front] = sides(f, w, d);
    g.as(SURFACE.stone, () => {
        for (let y = 0.2, k = 0; y < eaves - 0.3; y += 0.34, k++) {
            const long = k % 2 === 0 ? 0.42 : 0.26;
            for (const sx of [-1, 1]) g.box(front.frame, sx * (w / 2 - long / 2 + 0.02), y, 0.02, long, 0.28, 0.04, tone("#d9d2c2"));
        }
    });
}

/** A dormer on a roof's slope: its cheeks and front, a little gable roof, one window. */
function dormer(ctx: Ctx, f: Frame, u: number, eaves: number, d: number, rise: number, roof: [number, number, number], wall: [number, number, number], household: number, floor: number) {
    const {solid} = ctx.chunk;
    // Sat on the front slope, set back from the eaves.
    const run = d / 2;
    const back = 0.9;
    const y = eaves + (back / run) * rise * 0.9;
    const df: Frame = {...f, ...xz(at(f, u, 0, d / 2 - back - 0.6))};
    solid.as(SURFACE.render, () => solid.box(df, 0, y - 0.3, 0, 1.6, 1.5, 1.4, wall));
    solid.as(SURFACE.slate, () => solid.gable(df, 0, y + 1.2, 0, 1.4, 1.6, 0.55, 0.12, roof, wall, Math.PI / 2, 0.1, SURFACE.render));
    windowAt(ctx, {...df, ...xz(at(df, 0, 0, 0.7))}, 0, y + 0.42, 0.9, 0.95, "home", household, floor, TRIM, PANE.casement);
}

function xz(p: [number, number, number]): {x: number; z: number} {
    return {x: p[0], z: p[2]};
}

function pos(side: Frame, u: number, out: number): {x: number; z: number} {
    const p = at(side, u, 0, out);
    return {x: p[0], z: p[2]};
}

// MARK: - Homes

function house(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = r() < 0.55;
    const wall = tone(brick ? pick(BRICKS, r) : pick(RENDERS, r));
    const slate = r() < 0.5;
    const roof = tone(slate ? pick(SLATE, r) : pick(TILES, r));
    const roofSurface = slate ? SURFACE.slate : SURFACE.tile;
    const wallSurface = brick ? SURFACE.brick : SURFACE.render;
    const w = b.at.w;
    const d = b.at.d;
    ctx.look = {pane: r() < 0.7 ? PANE.sash : PANE.casement, surround: brick ? "brick" : "render"};
    plinth(solid, f, w, d);
    solid.as(wallSurface, () => solid.box(f, 0, 0, 0, w, b.eaves, d, wall));
    // A string course between the floors (stone on brick, a painted band on render); quoins on rendered houses, near.
    if (b.floors > 1) solid.as(brick ? SURFACE.stone : SURFACE.paint, () => solid.box(f, 0, b.eaves / 2 - 0.08, 0, w + 0.06, 0.12, d + 0.06, brick ? tone("#c9b9a0") : shade(wall, 0.92)));
    if (!brick && r() < 0.6) quoins(f, w, d, b.eaves);
    const rise = Math.min(w, d) * (b.roof === "hip" ? 0.36 : 0.42);
    // The ridge runs along the street (local x), unless the house is deeper than wide.
    const along = w >= d * 0.9;
    solid.as(roofSurface, () => {
        if (b.roof === "hip") solid.hip(f, 0, b.eaves, 0, along ? w : d, along ? d : w, rise, 0.35, roof, along ? 0 : Math.PI / 2);
        else solid.gable(f, 0, b.eaves, 0, along ? w : d, along ? d : w, rise, 0.35, roof, wall, along ? 0 : Math.PI / 2, 0.14, wallSurface);
    });
    if (b.roof !== "hip") {
        ridge(solid, {...f, y: f.y + b.eaves + rise}, along ? w : d, 0, roof, along ? 0 : Math.PI / 2);
        bargeboards(f, along ? w : d, along ? d : w, b.eaves, rise, 0.35, TRIM, along ? 0 : Math.PI / 2);
    }
    gutters(solid, f, w, d, b.eaves);
    chimney(solid, f, (r() < 0.5 ? -1 : 1) * (w / 2 - 0.9), -0.4, b.eaves + rise * 0.5, rise * 0.75 + 0.6, shade(wall, 0.9), r() < 0.45);
    const [front, right, back, left] = sides(f, w, d);
    const doorU = (r() < 0.5 ? -1 : 1) * (w / 2 - 1.4);
    const tall = b.floors > 1;
    door(solid, front.frame, doorU, tone(pick(DOORS, r)), 1.0, 2.1, tall ? {panes: ctx.chunk.panes, style: paneStyle(PANE.plain, 0, false)} : undefined);
    // A porch: a hood over the door, a little gabled porch, or none.
    const porch = r();
    if (porch < 0.45) solid.as(roofSurface, () => solid.box(front.frame, doorU, 2.75, 0.45, 1.6, 0.12, 0.9, roof));
    else if (porch < 0.7) {
        solid.as(wallSurface, () => solid.box(front.frame, doorU, 0, 0.75, 1.9, 2.5, 1.4, wall));
        solid.as(roofSurface, () => solid.gable(front.frame, doorU, 2.5, 0.75, 1.9, 1.4, 0.7, 0.15, roof, wall, Math.PI / 2, 0.1, wallSurface));
    }
    const floorH = b.eaves / b.floors;
    windowRow(ctx, front, b.floors, floorH, 2, "home", () => 0, (u, floor) => floor === 0 && Math.abs(u - doorU) < 1.4);
    if (b.floors === 1) windowAt(ctx, front.frame, -doorU, floorH * 0.55, 1.05, 1.35, "home", 0, 0);
    windowRow(ctx, back, b.floors, floorH, 2, "home", () => 0);
    windowRow(ctx, right, b.floors, floorH, d > 8 ? 1 : 0, "home", () => 0, (_, floor) => floor === 0);
    windowRow(ctx, left, b.floors, floorH, d > 8 ? 1 : 0, "home", () => 0, (_, floor) => floor === 1);
    // A bay window on some: three panes, its own little roof.
    if (r() < 0.35 && b.floors > 1) {
        const u = -doorU;
        solid.as(wallSurface, () => solid.box(front.frame, u, 0, 0.45, 2.3, floorH * 0.85, 0.9, wall));
        solid.as(roofSurface, () => solid.box(front.frame, u, floorH * 0.85, 0.45, 2.5, 0.16, 1.1, roof));
        const bay = {...front.frame, ...pos(front.frame, u, 0.91)};
        windowAt(ctx, bay, 0, floorH * 0.45, 1.6, 1.25, "home", 0, 0);
        const [, bayRight, , bayLeft] = sides({...front.frame, ...pos(front.frame, u, 0.45)}, 2.3, 0.9);
        windowAt(ctx, bayRight.frame, 0, floorH * 0.45, 0.42, 1.25, "home", 0, 0);
        windowAt(ctx, bayLeft.frame, 0, floorH * 0.45, 0.42, 1.25, "home", 0, 0);
    }
    // A dormer in the loft of some (a room up there: one more lit window).
    if (b.roof !== "hip" && along && tall && r() < 0.22) dormer(ctx, f, -doorU * 0.4, b.eaves, d, rise, roof, wall, 0, 2);
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
    ctx.look = {pane: PANE.sash, surround: brick ? "brick" : "render"};
    plinth(solid, f, w, d);
    solid.as(brick ? SURFACE.brick : SURFACE.render, () => solid.box(f, 0, 0, 0, w, b.eaves, d, wall));
    const rise = d * 0.36;
    solid.as(SURFACE.slate, () => solid.gable(f, 0, b.eaves, 0, w, d, rise, 0.3, roof, wall, 0, 0.14, brick ? SURFACE.brick : SURFACE.render));
    ridge(solid, {...f, y: f.y + b.eaves + rise}, w, 0, roof);
    bargeboards(f, w, d, b.eaves, rise, 0.3, shade(wall, 0.7));
    gutters(solid, f, w, d, b.eaves, 1);
    const homeW = w / b.households;
    const [front, , back] = sides(f, w, d);
    const floorH = b.eaves / b.floors;
    for (let k = 0; k < b.households; k++) {
        const u0 = -w / 2 + homeW * k;
        const mid = u0 + homeW / 2;
        // Some homes painted, so the row reads as four.
        const painted = !brick || r() < 0.3;
        const own = painted ? tone(pick(RENDERS, r)) : wall;
        if (painted) solid.as(SURFACE.render, () => solid.box(front.frame, mid, 0, 0.01, homeW - 0.04, b.eaves, 0.04, own));
        if (k > 0) {
            chimney(solid, f, u0, -0.2, b.eaves + rise * 0.55, rise * 0.6 + 0.5, shade(wall, 0.9), r() < 0.4);
            // The downpipe between two homes.
            solid.as(SURFACE.metal, () => solid.box(front.frame, u0, 0.15, 0.09, 0.09, b.eaves - 0.3, 0.09, GUTTER));
        }
        const doorU = mid + (k % 2 ? 1 : -1) * (homeW / 2 - 0.9);
        if (b.shopfront) {
            const swatch = Math.floor(r() * AWNINGS.length);
            shopfront(ctx, front.frame, mid, homeW - 0.2, swatch, doorU, "shop", k);
        } else {
            door(solid, front.frame, doorU, tone(pick(DOORS, r)), 1.0, 2.1, {panes: ctx.chunk.panes, style: paneStyle(PANE.plain, 0, false)});
            const winU = mid - (doorU - mid) * 0.7;
            // A bay on some homes' ground floor.
            if (r() < 0.35) {
                solid.as(painted || !brick ? SURFACE.render : SURFACE.brick, () => solid.box(front.frame, winU, 0, 0.4, 2.0, floorH * 0.82, 0.8, own));
                solid.as(SURFACE.slate, () => solid.box(front.frame, winU, floorH * 0.82, 0.4, 2.2, 0.14, 1.0, roof));
                windowAt(ctx, {...front.frame, ...pos(front.frame, winU, 0.81)}, 0, floorH * 0.5, 1.4, 1.3, "home", k, 0);
            } else windowAt(ctx, front.frame, winU, floorH * 0.55, 1.15, 1.4, "home", k, 0);
        }
        for (let floor = 1; floor < b.floors; floor++) {
            windowAt(ctx, front.frame, mid - 0.95, floor * floorH + floorH * 0.55, 1.0, 1.35, "home", k, floor);
            windowAt(ctx, front.frame, mid + 0.95, floor * floorH + floorH * 0.55, 1.0, 1.35, "home", k, floor);
        }
        // The back: a door to the yard, a window per floor; homes run the other way round from the back.
        const backU = -mid;
        door(solid, back.frame, backU + 1.2, tone("#5a4a3a"), 0.9);
        for (let floor = 0; floor < b.floors; floor++) windowAt(ctx, back.frame, backU - 0.9, floor * floorH + floorH * 0.55, 1.0, 1.25, "home", k, floor);
        // A dormer on some homes' front slope.
        if (!b.shopfront && b.floors === 2 && r() < 0.25) dormer(ctx, f, mid, b.eaves, d, rise, roof, own, k, 2);
    }
}

function awning(geo: Geo, side: Frame, u: number, y: number, w: number, colour: [number, number, number]) {
    const out = 1.3;
    const drop = 0.55;
    const a = at(side, u - w / 2, y, 0.1);
    const b = at(side, u + w / 2, y, 0.1);
    const c = at(side, u + w / 2, y - drop, out);
    const d = at(side, u - w / 2, y - drop, out);
    geo.as(SURFACE.timber, () => {
        geo.quad(d, c, b, a, colour);
        geo.quad(a, b, c, d, shade(colour, 0.6));
        // The valance.
        geo.quad(at(side, u - w / 2, y - drop - 0.25, out), at(side, u + w / 2, y - drop - 0.25, out), c, d, shade(colour, 0.85));
    });
    // Near: its stripes (pale bands over the colour) and a scalloped valance.
    const g = doorDetail;
    if (!g) return;
    const stripes = Math.max(3, Math.round(w / 0.5));
    g.as(SURFACE.timber, () => {
        for (let k = 1; k < stripes; k += 2) {
            const u0 = u - w / 2 + (w * k) / stripes;
            const u1 = u - w / 2 + (w * (k + 1)) / stripes;
            const lift = 0.015;
            g.quad(at(side, u0, y - drop + lift, out + 0.01), at(side, u1, y - drop + lift, out + 0.01), at(side, u1, y + lift, 0.11), at(side, u0, y + lift, 0.11), tone("#f1ece0"));
            g.quad(at(side, u0, y - drop - 0.25, out + 0.012), at(side, u1, y - drop - 0.25, out + 0.012), at(side, u1, y - drop, out + 0.012), at(side, u0, y - drop, out + 0.012), tone("#ece6d8"));
        }
    });
}

/**
 * A shopfront (lane GB): a stall riser, pilasters with console brackets, a fascia in the shop's colour with a raised
 * sign panel and its trade's pictogram (no words, no brand), a cornice, a display window (the pane shader's shelves of
 * goods, lit in opening hours), a glazed door with a fanlight, and an awning on most.
 */
function shopfront(ctx: Ctx, side: Frame, mid: number, width: number, swatch: number, doorU: number, owner: WindowOwner, household: number, options: {awning?: boolean; trade?: number} = {}) {
    const {solid} = ctx.chunk;
    const colour = tone(AWNINGS[swatch % AWNINGS.length]);
    const dark = shade(colour, 0.72);
    const doorW = 0.95;
    const left = mid - width / 2 + 0.25;
    const right = mid + width / 2 - 0.25;
    solid.as(SURFACE.paint, () => {
        // The pilasters and their consoles, the stall riser, the fascia and its cornice.
        for (const u of [left, right]) {
            solid.box(side, u, 0, 0.1, 0.32, 2.95, 0.2, dark);
            solid.box(side, u, 2.95, 0.16, 0.38, 0.6, 0.32, shade(colour, 0.65));
        }
        solid.box(side, mid, 2.95, 0.12, width - 0.1, 0.62, 0.16, colour);
        solid.box(side, mid, 3.57, 0.2, width + 0.05, 0.12, 0.34, shade(colour, 0.6));
    });
    // The display window either side of the door, over its riser.
    const glassL = Math.min(doorU - doorW / 2, right) - (left + 0.16);
    const glassR = right - 0.16 - (doorU + doorW / 2);
    const sw = (owner === "pub" ? 3 : 0) + swatch;
    for (const [from, length] of [[left + 0.16, glassL], [doorU + doorW / 2, glassR]] as const) {
        if (length < 0.6) continue;
        const u = from + length / 2;
        solid.as(SURFACE.paint, () => solid.box(side, u, 0, 0.08, length, 0.55, 0.12, dark));
        const f = FRAME[PANE.shop];
        const start = ctx.chunk.panes.pos.length / 3;
        pane(ctx.chunk.panes, side, u, 0.55 + 2.25 / 2, length, 2.25, paneStyle(PANE.shop, sw, false, (ctx.seed + Math.round(u * 13)) >>> 0), 0.05);
        ctx.chunk.windows.push({building: ctx.building.id, owner, household, start, count: 6, floor: 0, seed: (ctx.seed + Math.round(u * 13) * 7) >>> 0});
        void f;
    }
    // The door: a glazed one, a fanlight over it.
    solid.as(SURFACE.paint, () => solid.box(side, doorU, 0, 0.04, doorW + 0.16, 2.85, 0.08, dark));
    pane(ctx.chunk.panes, side, doorU, 1.25, doorW - 0.1, 2.0, paneStyle(PANE.modern, swatch, false), 0.09);
    pane(ctx.chunk.panes, side, doorU, 2.55, doorW - 0.1, 0.42, paneStyle(PANE.plain, 0, false), 0.09);
    solid.as(SURFACE.stone, () => solid.box(side, doorU, -0.15, 0.3, doorW + 0.4, 0.15, 0.5, STONE));
    // The sign: a raised panel on the fascia, the trade's pictogram on it.
    const signW = Math.min(width * 0.62, 3.6);
    solid.as(SURFACE.paint, () => solid.box(side, mid, 3.03, 0.2, signW, 0.46, 0.04, tone("#efe6d2")));
    pictogram(solid, side, mid, 3.26, options.trade ?? Math.floor(chance(ctx.building.id, household, "trade") * TRADES), colour);
    if (options.awning !== false) awning(solid, side, mid, 2.8, width - 0.5, colour);
    // Near: a hanging sign on its bracket over the pavement on some.
    const g = doorDetail;
    if (g && chance(ctx.building.id, household, "hanging") < 0.4) {
        const u = right + 0.1;
        g.as(SURFACE.metal, () => g.box(side, u, 3.85, 0.55, 0.05, 0.05, 1.0, tone("#1e1e1e")));
        g.as(SURFACE.paint, () => g.box(side, u, 3.0, 0.85, 0.06, 0.8, 0.62, colour));
        pictogram(g, {...side, ...pos(side, u + 0.04, 0.85), rot: side.rot + Math.PI / 2}, 0, 3.4, Math.floor(chance(ctx.building.id, household, "trade") * TRADES), tone("#efe6d2"), 0.7);
    }
}

const TRADES = 7;

/**
 * A trade's pictogram for a sign, from a few boxes (no words, no logo): a loaf (bakery), a cup (café), a key
 * (hardware), a stack of books, a flower (florist), a pair of scissors (barber), a fish (fishmonger).
 */
function pictogram(geo: Geo, side: Frame, u: number, y: number, trade: number, colour: [number, number, number], scale = 1) {
    const ink = shade(colour, 0.75);
    const s = scale;
    const z = 0.235;
    const b = (du: number, dy: number, w: number, h: number, c = ink) => geo.box(side, u + du * s, y + dy * s - (h * s) / 2, z, w * s, h * s, 0.03, c);
    geo.as(SURFACE.paint, () => {
        switch (trade % TRADES) {
            case 0: // A loaf: a long dome, three slashes.
                b(0, 0, 0.5, 0.18);
                b(0, 0.1, 0.36, 0.06);
                for (const du of [-0.12, 0, 0.12]) b(du, 0.02, 0.03, 0.12, tone("#efe6d2"));
                break;
            case 1: // A cup and saucer.
                b(0, 0.02, 0.24, 0.22);
                b(0.16, 0.04, 0.06, 0.1);
                b(0, -0.12, 0.38, 0.04);
                break;
            case 2: // A key.
                b(-0.14, 0, 0.14, 0.14);
                b(0.08, 0, 0.32, 0.05);
                b(0.2, -0.05, 0.04, 0.08);
                break;
            case 3: // Books on a shelf.
                for (const [du, h] of [[-0.15, 0.26], [-0.07, 0.3], [0.01, 0.22], [0.09, 0.28], [0.17, 0.24]] as const) b(du, (h - 0.3) / 2, 0.065, h);
                break;
            case 4: // A flower: petals round a heart, a stem.
                for (const [du, dy] of [[0, 0.08], [0.08, 0], [0, -0.08], [-0.08, 0]] as const) b(du, dy + 0.04, 0.09, 0.09);
                b(0, 0.04, 0.06, 0.06, tone("#e0b040"));
                b(0, -0.12, 0.03, 0.16);
                break;
            case 5: // Scissors.
                b(-0.1, -0.06, 0.1, 0.1);
                b(0.1, -0.06, 0.1, 0.1);
                b(-0.04, 0.06, 0.04, 0.22);
                b(0.04, 0.06, 0.04, 0.22);
                break;
            default: // A fish.
                b(0, 0, 0.34, 0.14);
                b(0.2, 0, 0.06, 0.2);
                b(-0.1, 0.02, 0.03, 0.03, tone("#efe6d2"));
                break;
        }
    });
}

function flats(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const concrete = r() < 0.5;
    const wall = tone(concrete ? pick(["#c8c0b2", "#b9b1a3", "#d6cfc2", "#c4b49c"], r) : pick(BRICKS, r));
    const wallSurface = concrete ? SURFACE.concrete : SURFACE.brick;
    const w = b.at.w;
    const d = b.at.d;
    ctx.look = {pane: PANE.modern, surround: concrete ? "none" : "brick"};
    plinth(solid, f, w, d);
    solid.as(wallSurface, () => solid.box(f, 0, 0, 0, w, b.eaves, d, wall));
    const floorH = b.eaves / b.floors;
    // Floor bands (the slabs' edges) on the concrete blocks.
    if (concrete) for (let floor = 1; floor < b.floors; floor++) solid.as(SURFACE.concrete, () => solid.box(f, 0, floor * floorH - 0.12, 0, w + 0.08, 0.2, d + 0.08, shade(wall, 0.86)));
    if (b.roof === "flat") {
        // A parapet round a flat roof (felted), its coping, a lift housing and plant on the roof.
        solid.as(wallSurface, () => solid.box(f, 0, b.eaves, 0, w + 0.2, 0.7, d + 0.2, shade(wall, 0.94), 0, {top: tone("#6a6a66")}));
        solid.as(SURFACE.felt, () => solid.box(f, 0, b.eaves + 0.05, 0, w - 0.3, 0.66, d - 0.3, tone("#4a4b4c")));
        solid.as(SURFACE.metal, () => solid.box(f, 0, b.eaves + 0.7, 0, w + 0.32, 0.06, d + 0.32, tone("#8a8c8e")));
        solid.as(wallSurface, () => solid.box(f, w / 4, b.eaves + 0.7, -d / 6, 3, 2.2, 3, shade(wall, 0.9)));
        solid.as(SURFACE.metal, () => solid.box(f, -w / 4, b.eaves + 0.7, d / 6, 1.6, 0.9, 1.0, tone("#9a9c9e")));
    } else {
        solid.as(SURFACE.slate, () => solid.hip(f, 0, b.eaves, 0, w, d, d * 0.3, 0.4, tone(pick(SLATE, r))));
        gutters(solid, f, w, d, b.eaves);
    }
    const [front, right, back, left] = sides(f, w, d);
    // Two flats a floor: the left half and the right half (from the front).
    const perFloor = Math.max(1, Math.round(b.households / b.floors));
    const household = (u: number, floor: number, mirrored = false) => Math.min(b.households - 1, floor * perFloor + ((mirrored ? -u : u) > 0 ? 1 : 0) % perFloor);
    door(solid, front.frame, 0, tone(pick(DOORS, r)), 1.6, 2.3);
    solid.as(SURFACE.concrete, () => solid.box(front.frame, 0, 2.5, 0.6, 2.6, 0.15, 1.2, tone("#7a7a76")));
    // The stair's tall window over the door, floor by floor (lit on the common landing at night).
    for (let floor = 1; floor < b.floors; floor++) windowAt(ctx, front.frame, 0, floor * floorH + floorH * 0.5, 0.8, floorH * 0.62, "home", household(0.5, floor), floor, TRIM, PANE.modern);
    windowRow(ctx, front, b.floors, floorH, 6, "home", (u, floor) => household(u, floor), (u, floor) => Math.abs(u) < 1.5);
    windowRow(ctx, back, b.floors, floorH, 6, "home", (u, floor) => household(u, floor, true));
    windowRow(ctx, right, b.floors, floorH, 2, "home", (_, floor) => household(1, floor));
    windowRow(ctx, left, b.floors, floorH, 2, "home", (_, floor) => household(-1, floor));
    // Balconies on the back, one per flat above the ground floor (and on the front of some blocks).
    const fronted = r() < 0.5;
    for (let floor = 1; floor < b.floors; floor++) {
        for (const u of [-w / 4, w / 4]) {
            balcony(ctx, back.frame, u, floor * floorH, `${b.id}:b:${floor}:${u > 0 ? 1 : 0}`);
            if (fronted) balcony(ctx, front.frame, u + (u > 0 ? 1.2 : -1.2), floor * floorH, `${b.id}:f:${floor}:${u > 0 ? 1 : 0}`);
        }
    }
}

/** A balcony: its slab and a railing; near, the railing's bars and what people leave there (a chair, a pot plant). */
function balcony(ctx: Ctx, side: Frame, u: number, y: number, id: string) {
    const {solid} = ctx.chunk;
    solid.as(SURFACE.concrete, () => solid.box(side, u, y - 0.1, 0.7, 3.2, 0.18, 1.4, tone("#9a968e")));
    solid.as(SURFACE.metal, () => {
        solid.box(side, u, y + 1.0, 1.38, 3.2, 0.06, 0.06, tone("#3a3d40"));
        for (const du of [-1.57, 1.57]) solid.box(side, u + du, y + 0.08, 0.72, 0.06, 0.95, 1.36, tone("#3a3d40"));
    });
    const g = doorDetail;
    if (!g) return;
    g.as(SURFACE.metal, () => {
        for (let k = -7; k <= 7; k++) g.box(side, u + k * 0.2, y + 0.08, 1.38, 0.03, 0.92, 0.03, tone("#3a3d40"));
    });
    const roll = chance(id, "kept");
    if (roll < 0.45) {
        // A pot plant in the corner.
        g.as(SURFACE.tile, () => g.box(side, u - 1.2, y + 0.08, 1.05, 0.32, 0.3, 0.32, tone("#a25a3c")));
        g.blob(...xyz(at(side, u - 1.2, y + 0.62, 1.05)), 0.28, 0.3, 0.28, tone("#4e7a3a"), Math.floor(roll * 1e6), 0);
    }
    if (chance(id, "chair") < 0.35) {
        // A folding chair (someone sits out here).
        const c = tone(["#2f5a7a", "#c8c2b4", "#6a8a4a", "#3a3a3a"][Math.floor(chance(id, "colour") * 4)]);
        g.as(SURFACE.metal, () => {
            g.box(side, u + 0.6, y + 0.08, 0.9, 0.45, 0.42, 0.45, c);
            g.box(side, u + 0.6, y + 0.5, 0.7, 0.45, 0.45, 0.05, c);
        });
    }
}

function xyz(p: [number, number, number]): [number, number, number] {
    return p;
}

// MARK: - The old town and the harbour

function shop(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = r() >= 0.5;
    const wall = tone(brick ? pick(BRICKS, r) : pick(RENDERS, r));
    const w = b.at.w;
    const d = b.at.d;
    ctx.look = {pane: PANE.sash, surround: brick ? "brick" : "render"};
    plinth(solid, f, w, d);
    solid.as(brick ? SURFACE.brick : SURFACE.render, () => solid.box(f, 0, 0, 0, w, b.eaves, d, wall));
    const slate = r() < 0.6;
    const roof = tone(slate ? pick(SLATE, r) : pick(TILES, r));
    solid.as(slate ? SURFACE.slate : SURFACE.tile, () => solid.gable(f, 0, b.eaves, 0, w, d, d * 0.32, 0.25, roof, wall, 0, 0.14, brick ? SURFACE.brick : SURFACE.render));
    ridge(solid, {...f, y: f.y + b.eaves + d * 0.32}, w, 0, roof);
    gutters(solid, f, w, d, b.eaves, 1);
    chimney(solid, f, w / 2 - 0.7, -d * 0.15, b.eaves + d * 0.12, d * 0.25 + 0.6, shade(wall, 0.9), r() < 0.3);
    const [front] = sides(f, w, d);
    const pub = b.kind === "pub";
    const swatch = pub ? 0 : Math.floor(r() * AWNINGS.length);
    shopfront(ctx, front.frame, 0, w - 0.2, swatch, w / 2 - 1.0, pub ? "pub" : "shop", 0, {awning: !pub, trade: pub ? 1 : undefined});
    if (pub) {
        // The pub's hanging sign on its bracket, lanterns by its door, flower baskets.
        solid.as(SURFACE.metal, () => solid.box(front.frame, -w / 2 + 0.6, 3.6, 0.6, 0.08, 0.08, 1.1, tone("#1e1e1e")));
        solid.as(SURFACE.paint, () => solid.box(front.frame, -w / 2 + 0.6, 2.7, 1.05, 0.06, 0.85, 0.7, tone("#b8862e")));
        for (const du of [-0.75, 0.75]) {
            const u = w / 2 - 1.0 + du;
            const start = ctx.chunk.panes.pos.length / 3;
            pane(ctx.chunk.panes, front.frame, u, 2.45, 0.22, 0.32, paneStyle(PANE.plain, 0, false), 0.18);
            ctx.chunk.windows.push({building: b.id, owner: "pub", household: 0, start, count: 6, floor: 0, seed: b.seed + 7});
        }
        const g = doorDetail;
        if (g) for (const u of [-w / 2 + 1.6, w / 2 - 2.4]) g.blob(...xyz(at(front.frame, u, 3.95, 0.45)), 0.32, 0.26, 0.32, tone("#5a8a3a"), b.seed + Math.round(u * 10), 0);
    }
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
    ctx.look = {pane: PANE.church, surround: "stone"};
    plinth(solid, f, w, d, tone("#8a8070"));
    // The nave along local z (the footprint is 11 wide, 24 long), its roof steep.
    solid.as(SURFACE.stone, () => solid.box(f, 0, 0, 0, w, b.eaves, d, stone));
    solid.as(SURFACE.slate, () => solid.gable(f, 0, b.eaves, 0, d, w, 6.5, 0.4, slate, stone, Math.PI / 2, 0.14, SURFACE.stone));
    ridge(solid, {...f, y: f.y + b.eaves + 6.5}, d, 0, slate, Math.PI / 2);
    // Buttresses and tall windows down both sides.
    const [, right, , left] = sides(f, w, d);
    for (const side of [right, left]) {
        for (let k = 0; k < 5; k++) {
            const u = -d / 2 + (d * (k + 0.5)) / 5;
            windowAt(ctx, side.frame, u, 4.6, 1.3, 4.6, "church", 0, 0, tone("#d8ccb4"));
            if (k < 4) solid.as(SURFACE.stone, () => solid.box(side.frame, u + d / 10, 0, 0.35, 0.7, b.eaves - 1.5, 0.7, shade(stone, 0.94)));
        }
    }
    // The east window, the porch.
    const [front, , back] = sides(f, w, d);
    windowAt(ctx, front.frame, 0, 5.2, 3.0, 5.2, "church", 0, 0, tone("#d8ccb4"));
    solid.as(SURFACE.stone, () => solid.box(right.frame, 3, 0, 1.8, 3.2, 3.2, 3.2, stone));
    solid.as(SURFACE.slate, () => solid.gable(right.frame, 3, 3.2, 1.8, 3.2, 3.2, 1.6, 0.2, slate, stone, Math.PI / 2, 0.14, SURFACE.stone));
    // The tower at the west end (the back of the footprint), and its spire.
    const tower = {...f, ...pos(back.frame, 0, 3.6)};
    const th = 22;
    solid.as(SURFACE.stone, () => {
        solid.box(tower, 0, -1.6, 0, 7.4, th + 1.6, 7.4, shade(stone, 0.97));
        solid.box(tower, 0, th, 0, 8, 1.0, 8, shade(stone, 0.9));
        for (const [cx, cz] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) solid.pyramid(tower, cx, th + 1, cz, 0.8, 1.6, stone);
        // String courses up the tower.
        for (const y of [7, 12, 17]) solid.box(tower, 0, y, 0, 7.6, 0.25, 7.6, shade(stone, 0.9));
    });
    solid.as(SURFACE.slate, () => solid.pyramid(tower, 0, th + 1, 0, 6.2, 14, slate));
    solid.as(SURFACE.metal, () => solid.cylinder(tower, 0, th + 15, 0, 0.06, 0.06, 1.6, tone("#c9a23c"), 4));
    // Belfry louvres and clock faces on all four sides.
    for (const side of sides(tower, 7.4, 7.4)) {
        windowAt(ctx, side.frame, 0, 18.5, 1.6, 2.8, "church", 0, 1, tone("#a89c86"), PANE.works);
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
    ctx.look = {pane: PANE.civic, surround: "stone"};
    plinth(solid, f, b.at.w, b.at.d);
    solid.as(SURFACE.stone, () => solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, stone));
    solid.as(SURFACE.stone, () => solid.box(f, 0, b.eaves - 0.5, 0, b.at.w + 0.4, 0.5, b.at.d + 0.4, shade(stone, 0.92)));
    solid.as(SURFACE.slate, () => solid.hip(f, 0, b.eaves, 0, b.at.w, b.at.d, 3.2, 0.5, tone("#4e535a")));
    const [front, right, back, left] = sides(f, b.at.w, b.at.d);
    // A columned portico and a clock cupola.
    solid.as(SURFACE.stone, () => {
        for (let k = -2; k <= 2; k++) solid.cylinder(front.frame, k * 1.6, 0, 1.6, 0.3, 0.26, 5.6, tone("#ece4d2"), 8);
        solid.box(front.frame, 0, 5.6, 1.4, 8.4, 0.6, 3.2, tone("#e6dcc6"));
        solid.gable(front.frame, 0, 6.2, 1.4, 8.4, 3.2, 1.3, 0.1, tone("#e0d6c0"), tone("#e6dcc6"), 0);
        solid.box(front.frame, 0, -0.15, 1.9, 9.4, 0.3, 3.6, tone("#cfc6b2"));
    });
    door(solid, front.frame, 0, tone("#3a2a1a"), 1.8, 3.0, {panes: ctx.chunk.panes, style: paneStyle(PANE.civic, 0, false)});
    windowRow(ctx, front, 2, 4, 6, "civic", () => 0, (u, floor) => floor === 0 && Math.abs(u) < 2.5, [1.2, 2.1]);
    windowRow(ctx, back, 2, 4, 6, "civic", () => 0, undefined, [1.2, 2.1]);
    windowRow(ctx, right, 2, 4, 3, "civic", () => 0, undefined, [1.2, 2.1]);
    windowRow(ctx, left, 2, 4, 3, "civic", () => 0, undefined, [1.2, 2.1]);
    const cupola = {...f, y: f.y + b.eaves + 2.6};
    solid.as(SURFACE.paint, () => solid.box(cupola, 0, 0, 0, 2.4, 2.6, 2.4, tone("#ece4d2")));
    for (const side of sides(cupola, 2.4, 2.4)) clockFace(solid, side.frame, 0, 1.3);
    solid.as(SURFACE.metal, () => solid.pyramid(cupola, 0, 2.6, 0, 2.6, 2.0, tone("#5a7a6a")));
}

function mill(ctx: Ctx, b: Building) {
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    const brick = tone("#9a5440");
    ctx.look = {pane: PANE.works, surround: "brick"};
    plinth(solid, f, b.at.w, b.at.d);
    solid.as(SURFACE.brick, () => solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, brick));
    solid.as(SURFACE.slate, () => solid.gable(f, 0, b.eaves, 0, b.at.w, b.at.d, 3.6, 0.3, tone("#4e535a"), brick, 0, 0.14, SURFACE.brick));
    ridge(solid, {...f, y: f.y + b.eaves + 3.6}, b.at.w, 0, tone("#4e535a"));
    gutters(solid, f, b.at.w, b.at.d, b.eaves);
    const all = sides(f, b.at.w, b.at.d);
    all.forEach((side, i) => windowRow(ctx, side, b.floors, b.eaves / b.floors, i % 2 ? 3 : 6, "mill", () => 0, (u, floor) => i === 0 && floor === 0 && Math.abs(u) < 1.6, [1.1, 1.5]));
    door(solid, all[0].frame, 0, tone("#3a3a40"), 2.4, 2.8);
    // A hoist loft and the chimney (the peregrines' ledge at its top).
    solid.as(SURFACE.brick, () => solid.box(all[0].frame, 0, b.eaves - 1.2, 0.6, 2.2, 3.4, 1.2, brick));
    const chimneyAt = b.tall ? {x: b.tall.x, y: f.y, z: b.tall.z, rot: 0} : f;
    solid.as(SURFACE.brick, () => {
        solid.cylinder(chimneyAt, 0, -1.5, 0, 1.25, 0.85, (b.tall?.y ?? 30) + 1.5, brick, 10);
        solid.cylinder(chimneyAt, 0, b.tall?.y ?? 30, 0, 1.05, 1.05, 0.7, tone("#6e3e30"), 10);
    });
}

function harbourBuilding(ctx: Ctx, b: Building) {
    const r = rng(b.seed);
    const f = buildingFrame(b.at);
    const {solid} = ctx.chunk;
    if (b.kind === "lighthouse") {
        const white = tone("#f2efe8");
        const red = tone("#b8352e");
        solid.as(SURFACE.stone, () => solid.cylinder(f, 0, -2, 0, 2.6, 2.6, 2.2, tone("#9a948a"), 12));
        solid.as(SURFACE.render, () => {
            for (let k = 0; k < 4; k++) solid.cylinder(f, 0, k * 4, 0, 2.1 - k * 0.12, 2.1 - (k + 1) * 0.12, 4, k % 2 ? red : white, 12, false);
        });
        solid.as(SURFACE.metal, () => solid.cylinder(f, 0, 16, 0, 2.2, 2.2, 0.3, tone("#2a2a2a"), 12));
        // The lantern: a ring of panes (plain glass, its light all night).
        const panes = ctx.chunk.panes;
        const start = panes.pos.length / 3;
        const sidesN = 12;
        const width = 2 * 1.3 * Math.sin(Math.PI / sidesN);
        for (let i = 0; i < sidesN; i++) {
            const a = ((i + 0.5) / sidesN) * Math.PI * 2;
            const apothem = 1.3 * Math.cos(Math.PI / sidesN);
            // (A face's frame: its middle on the ring, local +z out of the lantern.)
            const face: Frame = {x: f.x + Math.sin(a) * apothem, y: f.y, z: f.z + Math.cos(a) * apothem, rot: -a};
            pane(panes, face, 0, 17.25, width, 1.9, paneStyle(PANE.plain, 0, false), 0);
        }
        ctx.chunk.windows.push({building: b.id, owner: "harbour", household: 0, start, count: panes.pos.length / 3 - start, floor: 4, seed: b.seed});
        solid.as(SURFACE.metal, () => solid.cylinder(f, 0, 18.2, 0, 1.6, 0.2, 1.4, red, 12));
        return;
    }
    const shed = b.kind === "fish_shed";
    const wall = tone(shed ? "#6f8796" : b.kind === "lock_house" ? "#a65840" : "#e9e2d2");
    const wallSurface = shed ? SURFACE.timber : b.kind === "lock_house" ? SURFACE.brick : SURFACE.render;
    ctx.look = {pane: shed ? PANE.works : PANE.sash, surround: shed ? "none" : b.kind === "lock_house" ? "brick" : "render"};
    plinth(solid, f, b.at.w, b.at.d);
    solid.as(wallSurface, () => solid.box(f, 0, 0, 0, b.at.w, b.eaves, b.at.d, wall));
    solid.as(SURFACE.slate, () => {
        if (b.roof === "hip") solid.hip(f, 0, b.eaves, 0, b.at.w, b.at.d, 2.2, 0.3, tone("#4e535a"));
        else solid.gable(f, 0, b.eaves, 0, b.at.w, b.at.d, shed ? 1.8 : 2.4, 0.3, tone(shed ? "#5a6670" : "#4e535a"), wall, 0, 0.14, wallSurface);
    });
    gutters(solid, f, b.at.w, b.at.d, b.eaves);
    const [front, right, back, left] = sides(f, b.at.w, b.at.d);
    door(solid, front.frame, shed ? 0 : -b.at.w / 4, tone(shed ? "#3e4e58" : "#2f4f6f"), shed ? 3.2 : 1, shed ? 3.4 : 2.1);
    if (!shed) {
        windowRow(ctx, front, b.floors, b.eaves / b.floors, 2, "harbour", () => 0, (u, floor) => floor === 0 && u < 0);
        windowRow(ctx, back, b.floors, b.eaves / b.floors, 2, "harbour", () => 0);
        windowRow(ctx, right, b.floors, b.eaves / b.floors, 1, "harbour", () => 0);
        windowRow(ctx, left, b.floors, b.eaves / b.floors, 1, "harbour", () => 0);
    } else {
        windowRow(ctx, right, 1, 3, 4, "harbour", () => 0);
        // Boarding up the shed's walls.
        solid.as(SURFACE.timber, () => {
            for (const side of sides(f, b.at.w, b.at.d)) for (let u = -side.length / 2 + 0.5; u < side.length / 2; u += 0.8) solid.quad(at(side.frame, u - 0.03, 0, 0.02), at(side.frame, u + 0.03, 0, 0.02), at(side.frame, u + 0.03, b.eaves, 0.02), at(side.frame, u - 0.03, b.eaves, 0.02), shade(wall, 0.8));
        });
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
    const ctx: Ctx = {chunk, building: b, seed: b.seed, look: {pane: PANE.casement, surround: "brick"}};
    // (The near detail goes to the chunk's own detail, or nowhere when the chunk keeps none: `BuildingDetail`.)
    doorDetail = chunk.detail instanceof NullGeo ? null : chunk.detail;
    try {
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
    } finally {
        doorDetail = null;
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

// MARK: - The lit windows and their curtains (people implied)

/**
 * Whether a home's curtains are drawn now: after dark, from the household's own hour in the evening (19:24-22:36) until
 * it opens them in the morning (6:48-8:24); a quarter of households never draw theirs.
 */
export function curtainsDrawn(w: Pick<WindowRecord, "building" | "household" | "owner">, clock: TownClock): boolean {
    if (w.owner !== "home" && w.owner !== "farm") return false;
    const h = clock.hours;
    if (darkness(h) < 0.5) return false;
    const r = chance(w.building, w.household, "curtain");
    if (r < 0.25) return false;
    const evening = 19.4 + r * 3.2;
    const morning = 6.8 + chance(w.building, w.household, "open") * 1.6;
    return h >= evening || h < morning;
}

/** A pane's state for its shader: how lit (0-1, `people.ts` windowLit), plus 2 with its curtains drawn. */
export function windowState(w: WindowRecord, clock: TownClock): number {
    return windowLit(w, clock) + (curtainsDrawn(w, clock) ? 2 : 0);
}

// MARK: - The panes' material

const linear = (hex: string) => {
    const c = tone(hex);
    return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;
};
/** The pane shader's swatches: the shops' 7 colours, then 9 curtain cloths. */
const SWATCHES = [...AWNINGS, "#e9dfc4", "#8a2a2a", "#2c3e5e", "#7d8f6a", "#c9a24a", "#9a8f86", "#c47a7a", "#3f6f6a", "#6a4a3a"];

/** A pane's own random from its style's seed (the JS twin of the shader's, for the tests). */
export const PANE_GLSL = `
varying vec3 vWin;
varying float vWinSize;
varying float vWinLit;
uniform float paneNight;
uniform float paneTime;
const vec3 PANE_SWATCH[16] = vec3[16](${SWATCHES.map(linear).join(", ")});
float paneHash(vec2 p) { return fract(sin(dot(p, vec2(41.7, 289.3))) * 15731.743); }
`;

const PANE_MAIN = `
float paneW = floor(vWinSize / 1000.0 + 0.0005) / 20.0;
float paneH = (vWinSize - floor(vWinSize / 1000.0 + 0.0005) * 1000.0) / 20.0;
vec2 paneP = vWin.xy;
float paneStyleV = floor(vWin.z + 0.5);
float paneSeed = floor(paneStyleV / 256.0 + 0.001);
float paneRest = paneStyleV - paneSeed * 256.0;
float paneKind = floor(paneRest / 32.0 + 0.001);
float paneSw = floor((paneRest - paneKind * 32.0) / 2.0 + 0.001);
float paneBlinds = paneRest - paneKind * 32.0 - paneSw * 2.0;
float paneClosed = step(1.5, vWinLit);
float paneLit = vWinLit - 2.0 * paneClosed;
float paneFw = paneKind < 0.5 ? 0.075 : paneKind < 1.5 ? 0.07 : paneKind < 2.5 ? 0.055 : paneKind < 4.5 ? 0.09 : paneKind < 5.5 ? 0.08 : paneKind < 6.5 ? 0.06 : 0.05;
vec2 paneIn = max(vec2(paneW, paneH) - 2.0 * paneFw, vec2(0.05));
vec2 paneQ = paneP - paneFw;
vec2 paneT = paneQ / paneIn;
float paneInGlass = step(0.0, paneQ.x) * step(0.0, paneQ.y) * step(paneQ.x, paneIn.x) * step(paneQ.y, paneIn.y);
float paneBar = 0.0;
if (paneKind < 0.5) {
    paneBar = max(step(abs(paneQ.y - paneIn.y * 0.5), 0.035), step(abs(paneQ.x - paneIn.x * 0.5), 0.016));
} else if (paneKind < 1.5) {
    paneBar = max(step(abs(paneQ.y - paneIn.y * 0.7), 0.024), step(abs(paneQ.x - paneIn.x * 0.5), 0.024) * step(0.7, paneW));
} else if (paneKind < 2.5) {
    paneBar = step(abs(paneQ.x - paneIn.x * 0.62), 0.022) * step(1.1, paneW);
} else if (paneKind < 3.5) {
    paneBar = step(abs(paneQ.y - paneIn.y * 0.84), 0.03);
} else if (paneKind < 4.5) {
    vec2 dd = paneQ / 0.17;
    float da = abs(fract((dd.x + dd.y) * 0.5) - 0.5);
    float db = abs(fract((dd.x - dd.y) * 0.5) - 0.5);
    paneBar = step(min(da, db), 0.05);
} else if (paneKind < 6.5) {
    vec2 cells = paneKind < 5.5 ? vec2(3.0, 4.0) : vec2(4.0, 5.0);
    vec2 cc = fract(paneT * cells);
    vec2 ce = min(cc, 1.0 - cc) * paneIn / cells;
    paneBar = step(min(ce.x, ce.y), paneKind < 5.5 ? 0.016 : 0.02);
}
float paneGlass = paneInGlass * (1.0 - paneBar);
float paneR1 = fract(paneSeed * 0.618034 + 0.13);
float paneR2 = fract(paneSeed * 0.414214 + 0.37);
vec3 paneFrame = paneKind < 1.5 ? vec3(0.78) : paneKind < 2.5 ? vec3(0.05) : paneKind < 3.5 ? PANE_SWATCH[int(mod(paneSw, 7.0))] * 0.75 : paneKind < 4.5 ? (paneInGlass > 0.5 ? vec3(0.03) : vec3(0.4, 0.36, 0.29)) : paneKind < 5.5 ? vec3(0.78) : vec3(0.045);
bool paneHome = paneKind < 2.5;
// The room behind: dark by day with the sky in the glass; curtains at the sides, nets, blinds, a shop's goods.
vec3 paneRoom = vec3(0.016, 0.015, 0.014) * (0.7 + 0.6 * paneR1) + mix(vec3(0.03, 0.036, 0.045), vec3(0.11, 0.13, 0.16), clamp(paneT.y, 0.0, 1.0)) * 0.5;
float paneCw = 0.12 + 0.16 * paneR2;
float paneCurtain = paneHome ? max(step(paneT.x, paneCw), step(1.0 - paneCw, paneT.x)) : 0.0;
paneCurtain = max(paneCurtain, paneHome ? paneClosed * (1.0 - step(abs(paneT.x - 0.5), 0.012 + 0.035 * paneR1)) : 0.0);
float paneFolds = 0.82 + 0.18 * sin(paneT.x * paneIn.x * 38.0 + paneR1 * 6.0);
vec3 paneCloth = PANE_SWATCH[7 + int(mod(paneSw, 9.0))] * paneFolds;
float paneNets = (paneHome && paneKind < 1.5 && paneR1 > 0.58) ? step(paneT.y, 0.58) : 0.0;
float paneBlind = paneBlinds > 0.5 ? step(1.0 - (0.25 + 0.6 * paneR2), paneT.y) : 0.0;
float paneSlat = 0.72 + 0.28 * step(0.5, fract(paneQ.y / 0.045));
float paneGoods = (paneKind > 2.5 && paneKind < 3.5) ? step(paneT.y, 0.8) : 0.0;
float paneShelf = floor(paneT.y * 4.0);
float paneItem = paneHash(vec2(floor(paneQ.x / 0.22), paneShelf + paneSeed));
float paneOnShelf = step(fract(paneT.y * 4.0), 0.5 + 0.35 * paneItem) * step(0.2, paneItem) * step(0.06, fract(paneT.y * 4.0));
vec3 paneGoodsCol = PANE_SWATCH[7 + int(paneItem * 8.99)] * (0.5 + 0.5 * paneItem);
vec3 paneInside = paneRoom;
paneInside = mix(paneInside, paneCloth * 0.5, paneCurtain);
paneInside = mix(paneInside, vec3(0.5), paneNets * 0.32 * (1.0 - paneCurtain));
paneInside = mix(paneInside, vec3(0.58, 0.56, 0.52) * paneSlat, paneBlind * (1.0 - paneCurtain));
paneInside = mix(paneInside, paneGoodsCol * 0.3 + paneRoom, paneGoods * paneOnShelf);
diffuseColor.rgb = mix(paneFrame, paneInside, paneGlass);
// Lit: the room's light (warm; a television's blue in a few; a shop's brighter white), through curtains and blinds.
vec3 paneWarm = paneKind > 2.5 && paneKind < 3.5 ? vec3(1.0, 0.86, 0.66) : mix(vec3(1.0, 0.6, 0.28), vec3(1.0, 0.78, 0.5), paneR1);
float paneTv = (paneHome && paneR2 < 0.12) ? 0.55 : 0.0;
vec3 paneLight = mix(paneWarm, vec3(0.42, 0.6, 1.0) * (0.8 + 0.2 * sin(paneTime * 6.0 + paneSeed)), paneTv);
float paneLamp = 0.5 + 0.65 * exp(-((paneT.x - 0.5) * (paneT.x - 0.5) * 5.0 + (paneT.y - 0.8) * (paneT.y - 0.8) * 6.0));
vec3 paneEmit = paneLight * paneLamp;
// (Through drawn curtains: the room's warm light, tinted by the cloth, a little dimmer: a warm window from the street.)
vec3 paneTint = paneCloth / max(max(paneCloth.r, paneCloth.g), max(paneCloth.b, 0.05));
paneEmit = mix(paneEmit, mix(paneLight, paneLight * paneTint, 0.4) * 0.82, paneCurtain);
paneEmit = mix(paneEmit, paneEmit * paneSlat * 0.7, paneBlind * (1.0 - paneCurtain));
paneEmit *= mix(vec3(1.0), paneGoodsCol * 1.5 + 0.3, paneGoods * paneOnShelf);
paneEmit *= paneLit * mix(0.45, 1.0, paneNight) * 3.1 * paneGlass;
`;

/**
 * The panes' material (lane GB): each window's frame and glazing bars, the glass with the sky in it, the curtains,
 * nets, blinds or a shop's goods behind, lit from inside on the island clock (`windowState`), brighter at night
 * (`TOWN_LIGHT.lampOn`, lane GA's). A pane's data is in its geometry (`paneGeometry`).
 */
export function paneMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({roughness: 0.3, metalness: 0});
    material.onBeforeCompile = (shader) => {
        shader.uniforms.paneNight = TOWN_LIGHT.lampOn;
        shader.uniforms.paneTime = ARK_TIME;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute vec3 aWin;\nattribute float aWinSize;\nattribute float aLit;\nvarying vec3 vWin;\nvarying float vWinSize;\nvarying float vWinLit;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWin = aWin;\nvWinSize = aWinSize;\nvWinLit = aLit;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${PANE_GLSL}`)
            .replace("#include <color_fragment>", `#include <color_fragment>\n${PANE_MAIN}`)
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.62, 0.07, paneGlass * (1.0 - paneCurtain * 0.8));")
            .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.0, 0.5, paneGlass * (1.0 - paneCurtain));")
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += paneEmit;");
    };
    material.customProgramCacheKey = () => "town-panes:1";
    return townWeather(material, {soak: 0, wetRoughness: 0.06, lamps: false, cloud: false});
}

/** A chunk's panes as geometry: positions and normals, each pane's metres and style (`aWin`), its size (`aWinSize`), its light (`aLit`). */
export function paneGeometry(geo: Geo): {geometry: BufferGeometry; lit: BufferAttribute} {
    const g = new BufferGeometry();
    const n = geo.pos.length / 3;
    g.setAttribute("position", new BufferAttribute(Float32Array.from(geo.pos), 3));
    g.setAttribute("normal", new BufferAttribute(Float32Array.from(geo.nor), 3));
    g.setAttribute("aWin", new BufferAttribute(Float32Array.from(geo.col), 3));
    g.setAttribute("aWinSize", new BufferAttribute(Float32Array.from(geo.extra), 1));
    const lit = new BufferAttribute(new Float32Array(n), 1);
    g.setAttribute("aLit", lit);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return {geometry: g, lit};
}

// MARK: - The building surfaces (the solid material's patch)

const BUILDING_GLSL = `
varying vec3 vBldWorld;
varying vec3 vBldNormal;
float bldHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bldNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bldHash(i), bldHash(i + vec2(1.0, 0.0)), f.x), mix(bldHash(i + vec2(0.0, 1.0)), bldHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/** After `color_fragment`: a tagged face's surface (brick bond, render, slates, tiles, stone, boards, concrete) and its weathering. */
const BUILDING_MAIN = `
#ifdef USE_COLOR
{
    vec3 bldC = vColor * 255.0;
    vec3 bldF = fract(bldC);
    // (Tagged only when all three agree, as the kit's decodeColourTag: green at 0.5, blue at 0.25, red on a kind's
    // centre; the kit keeps every plain colour off them, so no other lane's colour reads as a building surface.)
    float bldSlot = bldF.r * 16.0 - 0.5;
    if (abs(bldF.g - 0.5) < ${COLOUR_TAG_TOLERANCE} && abs(bldF.b - 0.25) < ${COLOUR_TAG_TOLERANCE} && abs(bldSlot - floor(bldSlot + 0.5)) / 16.0 < ${COLOUR_TAG_TOLERANCE}) {
        float bldKind = floor(bldSlot + 0.5);
        vec3 bldN = normalize(vBldNormal);
        vec3 bldW = vBldWorld;
        vec2 bldT = normalize(vec2(-bldN.z, bldN.x) + vec2(1e-5, 0.0));
        float bldH = dot(bldW.xz, bldT);
        float bldPx = fwidth(bldW.y) + fwidth(bldH);
        float bldFade = 1.0 - smoothstep(0.014, 0.05, bldPx);
        bool bldWall = abs(bldN.y) < 0.5;
        vec3 bldBase = diffuseColor.rgb;
        vec3 bldOut = bldBase;
        if (bldKind < 1.5) {
            // Brick: stretcher bond, 65 mm courses with 10 mm joints, each brick its own shade, a few dark ones.
            float row = floor(bldW.y / 0.075);
            float bx = bldH / 0.225 + mod(row, 2.0) * 0.5;
            vec2 f = vec2(fract(bx), fract(bldW.y / 0.075));
            float mortar = max(1.0 - step(0.045, f.x), 1.0 - step(0.14, f.y));
            float tint = bldHash(vec2(floor(bx), row));
            vec3 brick = bldBase * (0.84 + 0.3 * tint);
            brick = mix(brick, brick * vec3(0.62, 0.58, 0.58), step(0.94, tint));
            bldOut = mix(bldBase, mix(brick, vec3(0.32, 0.3, 0.27), mortar), bldFade);
        } else if (bldKind < 2.5) {
            bldOut = bldBase * (0.94 + 0.09 * bldNoise(bldW.xz * 0.6 + bldW.y * 1.1));
        } else if (bldKind < 4.5) {
            // Slates and clay tiles: courses, staggered, the shadow under each course, moss towards the eaves.
            float course = bldKind < 3.5 ? 0.11 : 0.085;
            float row = floor(bldW.y / course);
            float jx = bldH / (bldKind < 3.5 ? 0.3 : 0.24) + mod(row, 2.0) * 0.5;
            vec2 f = vec2(fract(jx), fract(bldW.y / course));
            float edge = (1.0 - step(0.05, f.x)) * 0.55 + (1.0 - smoothstep(0.0, 0.3, f.y)) * 0.45;
            float tint = bldHash(vec2(floor(jx), row));
            vec3 tile = bldBase * (0.86 + 0.24 * tint) * (1.0 - 0.32 * edge);
            bldOut = mix(bldBase, tile, 1.0 - smoothstep(0.025, 0.09, bldPx));
            float moss = smoothstep(0.6, 0.82, bldNoise(bldW.xz * 0.32 + 3.1)) * (1.0 - smoothstep(4.5, 9.5, bldW.y));
            bldOut = mix(bldOut, vec3(0.09, 0.12, 0.04), moss * 0.45);
        } else if (bldKind < 5.5) {
            // Stone: ashlar blocks, pale joints.
            float row = floor(bldW.y / 0.3);
            float bx = bldH / 0.62 + mod(row, 2.0) * 0.5;
            vec2 f = vec2(fract(bx), fract(bldW.y / 0.3));
            float joint = max(1.0 - step(0.02, f.x), 1.0 - step(0.04, f.y));
            float tint = bldHash(vec2(floor(bx), row));
            bldOut = mix(bldBase, mix(bldBase * (0.9 + 0.16 * tint), bldBase * 1.12, joint), bldWall ? bldFade : 0.0);
        } else if (bldKind < 6.5) {
            float board = fract(bldH / 0.16);
            bldOut = bldBase * mix(1.0, 0.86 + 0.14 * step(0.08, board), bldFade) * (0.92 + 0.12 * bldNoise(vec2(bldH * 6.0, bldW.y * 0.4)));
        } else if (bldKind > 8.5 && bldKind < 9.5) {
            bldOut = bldBase * (0.88 + 0.2 * bldNoise(bldW.xz * 1.3));
        } else if (bldKind > 9.5) {
            float joint = 1.0 - step(0.012, fract(bldH / 1.5)) ;
            bldOut = bldBase * (0.93 + 0.1 * bldNoise(bldW.xz * 0.5 + bldW.y)) * mix(1.0, 0.82, joint * bldFade);
        }
        // Weathering on walls: damp at the foot, rain streaks down from sills and copings.
        if (bldWall && (bldKind < 2.5 || (bldKind > 4.5 && bldKind < 6.5) || bldKind > 9.5)) {
            float foot = 1.0 - smoothstep(0.0, 0.9, bldW.y - 2.75);
            float streak = smoothstep(0.58, 0.92, bldNoise(vec2(bldH * 2.4, bldW.y * 0.11))) * 0.13;
            bldOut *= (1.0 - 0.15 * foot) * (1.0 - streak);
        }
        diffuseColor.rgb = bldOut;
    }
}
#endif
`;

/**
 * Patches the town's solid material (lane GB) so its building faces draw their surfaces: chained onto the material's
 * own `onBeforeCompile` (lane GA's weather), its program cache key too. Untagged faces are untouched.
 */
export function patchBuildingSurfaces<T extends MeshStandardMaterial>(material: T): T {
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vBldWorld;\nvarying vec3 vBldNormal;")
            .replace(
                "#include <worldpos_vertex>",
                `#include <worldpos_vertex>
{
    vec4 bldW = vec4(transformed, 1.0);
    vec3 bldN = objectNormal;
    #ifdef USE_INSTANCING
    bldW = instanceMatrix * bldW;
    bldN = mat3(instanceMatrix) * bldN;
    #endif
    vBldWorld = (modelMatrix * bldW).xyz;
    vBldNormal = normalize(mat3(modelMatrix) * bldN);
}`
            );
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${BUILDING_GLSL}`).replace("#include <color_fragment>", `#include <color_fragment>\n${BUILDING_MAIN}`);
    };
    material.customProgramCacheKey = () => `${previousKey.call(material)}|town-buildings:1`;
    material.needsUpdate = true;
    return material;
}

// MARK: - The near detail, per chunk

/** Per tier: how near (m, to a chunk's box) its buildings' detail is drawn. */
export const DETAIL_DISTANCE = {high: 150, medium: 105, low: 62} as const;
const DETAIL_HYSTERESIS = 25;
const DETAIL_KEEP_MS = 20_000;

/** One chunk's near detail, built on demand (pure in the plan: the same for every viewer, whenever it is built). */
export function chunkDetail(plan: TownPlan, buildings: readonly Building[]): Geo {
    const detail = new Geo();
    const sink = new NullGeo();
    for (const b of buildings) {
        const chunk: BuildingChunk = {solid: sink, glass: sink, windows: [], panes: sink, detail};
        buildBuilding(chunk, b);
    }
    void plan;
    return detail;
}

/**
 * The buildings' near detail streamed by chunk (lane GB): built when the camera comes within the tier's distance of a
 * chunk (the nearest first, one a frame), hidden past it, its geometry freed after 20 s unseen. So the facades' small
 * parts cost memory only round the camera.
 */
export class BuildingDetail {
    private readonly byChunk = new Map<number, Building[]>();
    private readonly made = new Map<number, {mesh: Mesh; hiddenAt: number}>();
    private distance: number;
    /** The chunk being built, a few buildings a frame. */
    private job: {key: number; list: readonly Building[]; next: number; geo: Geo} | null = null;
    triangles = 0;
    built = 0;

    constructor(
        private readonly plan: TownPlan,
        private readonly material: Material,
        private readonly groupOf: (chunk: number) => Group | null,
        private readonly spans: readonly TownChunkSpan[],
        tier: keyof typeof DETAIL_DISTANCE
    ) {
        for (const b of plan.buildings) {
            const key = townChunkOf(b.at.x, b.at.z);
            const list = this.byChunk.get(key) ?? [];
            list.push(b);
            this.byChunk.set(key, list);
        }
        this.distance = DETAIL_DISTANCE[tier];
    }

    setTier(tier: keyof typeof DETAIL_DISTANCE) {
        this.distance = DETAIL_DISTANCE[tier];
    }

    /** Every frame: the camera's place (the town's frame), now (ms), which chunks are drawn. */
    update(eye: Vector3, now: number, drawn: ((chunk: number) => boolean) | null) {
        if (Number.isNaN(eye.x)) return;
        let nearest = -1;
        let nearestD = Infinity;
        this.byChunk.forEach((_, key) => {
            if (key < 0 || key >= TOWN_CHUNK_COUNT) return;
            const d = townChunkDistance(key, eye.x, eye.y, eye.z, this.spans[key] ?? {minY: 0, maxY: 30});
            const made = this.made.get(key);
            const show = d < this.distance + (made?.mesh.visible ? DETAIL_HYSTERESIS : 0) && (!drawn || drawn(key));
            if (made) {
                if (show !== made.mesh.visible) {
                    made.mesh.visible = show;
                    made.hiddenAt = now;
                }
                if (!show && now - made.hiddenAt > DETAIL_KEEP_MS) {
                    made.mesh.parent?.remove(made.mesh);
                    made.mesh.geometry.dispose();
                    this.triangles -= made.mesh.geometry.getAttribute("position").count / 3;
                    this.made.delete(key);
                }
            } else if (show && d < nearestD) {
                nearest = key;
                nearestD = d;
            }
        });
        // One chunk at a time, a few buildings a frame (at most ~2 ms), so walking down a street never stutters.
        if (!this.job) {
            if (nearest < 0) return;
            const list = this.byChunk.get(nearest);
            if (!list) return;
            this.job = {key: nearest, list, next: 0, geo: new Geo()};
        }
        const job = this.job;
        const started = typeof performance !== "undefined" ? performance.now() : 0;
        const sink = new NullGeo();
        while (job.next < job.list.length) {
            buildBuilding({solid: sink, glass: sink, windows: [], panes: sink, detail: job.geo}, job.list[job.next++]);
            if (started && performance.now() - started > 2) return;
        }
        this.job = null;
        const group = this.groupOf(job.key);
        if (!group) return;
        const mesh = new Mesh(job.geo.toGeometry(), this.material);
        mesh.name = "buildings:detail";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.made.set(job.key, {mesh, hiddenAt: now});
        this.triangles += job.geo.triangles;
        this.built++;
    }

    /** Chunks with their detail drawn now. */
    shown(): number {
        let n = 0;
        this.made.forEach((m) => {
            if (m.mesh.visible) n++;
        });
        return n;
    }

    dispose() {
        this.job = null;
        this.made.forEach((m) => {
            m.mesh.parent?.remove(m.mesh);
            m.mesh.geometry.dispose();
        });
        this.made.clear();
    }
}
