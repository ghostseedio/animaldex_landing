/**
 * Home's fields (graphics pass, batch 4): which crop grows in each field and
 * which way its rows run. One definition for the ground shader (`terrain.ts`
 * paints the rows: `FIELDS_GLSL`) and the close-up plants (`near-detail.ts`
 * stands a cabbage or a maize plant on each row: `fieldAt`), so the plants
 * always sit on the painted rows.
 *
 * The fields are the ground shader's grid: about 9 m × 6.5 m, turned off the
 * world's axes, each row of fields shifted along. A field's crop comes from an
 * integer hash of its cell (exact on the CPU and the GPU alike), so every
 * viewer sees the same farm. The farm's own clearing (where the animals
 * stand), the cottage's yard, the barn and the orchard stay grass.
 *
 * Pure: no three.js.
 */

import {HAMLET_LANES, LANE_WIDTH, laneDistance, sampleGround, smoothstep, ZONE_SITES} from "@/ark-scene/world";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {hamletLotAt, hamletLotsGlsl} from "@/ark-scene/props/hamlet-land";

export const CROPS = ["pasture", "tilled", "sprouts", "cabbage", "cereal", "maize"] as const;
export type Crop = typeof CROPS[number];

/** Each crop's rows: spacing across them (m), and how much of the ground the plants cover (0 = bare soil). */
export const CROP_ROWS: Record<Crop, {spacing: number; cover: number}> = {
    pasture: {spacing: 0, cover: 1},
    tilled: {spacing: 0.45, cover: 0},
    sprouts: {spacing: 0.7, cover: 0.3},
    cabbage: {spacing: 0.6, cover: 0.55},
    cereal: {spacing: 0.26, cover: 0.85},
    maize: {spacing: 0.8, cover: 0.6}
};

/** Cumulative shares, in CROPS order (a field's hash picks one): about a fifth pasture, a quarter cereal. */
const SHARES = [0.2, 0.32, 0.5, 0.65, 0.9, 1.0];

/** The grid (as the ground shader has drawn it since batch 1). */
const ALONG = {x: 0.94, z: 0.34};
const ACROSS = {x: -0.34, z: 0.94};
export const FIELD_SIZE = {along: 9, across: 6.5};
const STAGGER = 0.37;
/** No rows this close to a field's edge (the hedge and a headland). */
export const HEADLAND = 0.7;

/**
 * The orchard's first tree from the farm's site (`decor.ts` plants its rows from here, turned by `turn`). Home growth
 * (2026-11-11): it moved from east of the farm's clearing (where the hamlet's streets run now) to behind the barn,
 * between it and the wetland.
 */
export const ORCHARD = {x: -22, z: -18, turn: 0.05};
/** The orchard's middle (its 6 × 4 trees' grid). */
export function orchardMiddle(): {x: number; z: number} {
    const farm = ZONE_SITES.farm_garden;
    const u = 8.8;
    const v = 5.1;
    return {x: farm.x + ORCHARD.x + u * Math.cos(ORCHARD.turn) - v * Math.sin(ORCHARD.turn), z: farm.z + ORCHARD.z + u * Math.sin(ORCHARD.turn) + v * Math.cos(ORCHARD.turn)};
}

/** No crops this near a lane's middle (the lane and a verge each side). */
export const LANE_CLEAR = LANE_WIDTH / 2 + 0.8;

/**
 * The hamlet's lanes for the shaders (home growth): `arkLaneDistance(p)`, metres from p (world x, z) to the nearest
 * lane's middle line, the twin of world.ts `laneDistance`. The ground paints the lanes with it (`terrain.ts`), and
 * the fields keep their crops off them.
 */
export function lanesGlsl(): string {
    const segments: string[] = [];
    for (const {points} of HAMLET_LANES) for (let i = 1; i < points.length; i++) segments.push(`    d = min(d, arkSegment(p, vec2(${points[i - 1][0].toFixed(2)}, ${points[i - 1][1].toFixed(2)}), vec2(${points[i][0].toFixed(2)}, ${points[i][1].toFixed(2)})));`);
    const xs = HAMLET_LANES.flatMap((lane) => lane.points.map((q) => q[0]));
    const zs = HAMLET_LANES.flatMap((lane) => lane.points.map((q) => q[1]));
    const box = xs.length ? [Math.min(...xs) - 6, Math.max(...xs) + 6, Math.min(...zs) - 6, Math.max(...zs) + 6] : [0, 0, 0, 0];
    return `
float arkSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - a - ab * t);
}
float arkLaneDistance(vec2 p) {
    if (p.x < ${box[0].toFixed(1)} || p.x > ${box[1].toFixed(1)} || p.y < ${box[2].toFixed(1)} || p.y > ${box[3].toFixed(1)}) return 1e4;
    float d = 1e4;
${segments.join("\n")}
    return d;
}
`;
}

/** Where crops never grow: the farm's clearing, the cottage's yard, the barn, the orchard. */
export function fieldKeepOuts(): Array<{x: number; z: number; r: number}> {
    const farm = ZONE_SITES.farm_garden;
    return [
        {x: farm.x, z: farm.z, r: farm.clearing + 2},
        {x: COTTAGE.x + 2, z: COTTAGE.z + 0.5, r: 10},
        {x: farm.x - 15, z: farm.z + 9, r: 7},
        {...orchardMiddle(), r: 11}
    ];
}

/** An integer hash of a field's cell (the GLSL twin is in FIELDS_GLSL). */
export function fieldHash(cx: number, cz: number): number {
    let h = (Math.imul((cx + 1000) >>> 0, 0x8da6b343) ^ Math.imul((cz + 1000) >>> 0, 0xd8163841)) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h = (h ^ (h >>> 12)) >>> 0;
    return h;
}

/** Whether a field's cereal is ripe (gold) or still green: the same bit the shader reads. */
export function fieldRipe(cell: [number, number]): boolean {
    return ((fieldHash(cell[0], cell[1]) >>> 17) & 1) === 1;
}

export type FieldPoint = {
    /** The field's cell. */
    cell: [number, number];
    crop: Crop;
    /** True when the rows run along the field's long side. */
    rowsAlong: boolean;
    /** Across the rows, in rows (a whole number is a row's middle). */
    row: number;
    /** Along the rows, in metres. */
    along: number;
    /** Distance to the field's nearest edge (m). */
    edge: number;
    /** The unit direction the rows run, in the world. */
    direction: {x: number; z: number};
};

/** The field at a point, its crop and the point's place among its rows (no keep-outs: see `cropAt`). */
export function fieldAt(x: number, z: number): FieldPoint {
    const fy = (x * ACROSS.x + z * ACROSS.z) / FIELD_SIZE.across;
    const fx = (x * ALONG.x + z * ALONG.z) / FIELD_SIZE.along + Math.floor(fy) * STAGGER;
    const cx = Math.floor(fx);
    const cz = Math.floor(fy);
    const h = fieldHash(cx, cz);
    const pick = (h & 0xffff) / 65536;
    let index = 0;
    while (index < SHARES.length - 1 && pick >= SHARES[index]) index++;
    const crop = CROPS[index];
    const rowsAlong = ((h >>> 16) & 1) === 1;
    const u = (fx - cx) * FIELD_SIZE.along;
    const v = (fy - cz) * FIELD_SIZE.across;
    const edge = Math.min(u, FIELD_SIZE.along - u, v, FIELD_SIZE.across - v);
    const spacing = CROP_ROWS[crop].spacing || 1;
    return {
        cell: [cx, cz],
        crop,
        rowsAlong,
        row: (rowsAlong ? v : u) / spacing,
        along: rowsAlong ? u : v,
        edge,
        direction: rowsAlong ? ALONG : ACROSS
    };
}

/** A field's middle in the world (batch 5: a field is grass or crop whole, decided at its middle). */
export function fieldCentre(cell: [number, number]): {x: number; z: number} {
    const u = (cell[0] + 0.5 - cell[1] * STAGGER) * FIELD_SIZE.along;
    const v = (cell[1] + 0.5) * FIELD_SIZE.across;
    // The grid's axes are a hair off unit length: solve the 2 × 2 system exactly.
    const det = ALONG.x * ACROSS.z - ALONG.z * ACROSS.x;
    return {x: (u * ACROSS.z - v * ALONG.z) / det, z: (v * ALONG.x - u * ACROSS.x) / det};
}

/** The crop growing at a point, or null (grass: a field whose middle is in a keep-out, the headland, or the hamlet's reserved plots, `props/hamlet-land.ts`). */
export function cropAt(x: number, z: number): (FieldPoint & {crop: Exclude<Crop, "pasture">}) | null {
    if (hamletLotAt(x, z)) return null;
    return fieldCropAt(x, z);
}

/** The field's own crop at a point, whatever the hamlet reserves there (the props' paddock placement asks this). */
export function fieldCropAt(x: number, z: number): (FieldPoint & {crop: Exclude<Crop, "pasture">}) | null {
    // (Home growth: no crop on the hamlet's lanes or their verges.)
    if (laneDistance(x, z) < LANE_CLEAR) return null;
    const field = fieldAt(x, z);
    const middle = fieldCentre(field.cell);
    for (const out of fieldKeepOuts()) if (Math.hypot(middle.x - out.x, middle.z - out.z) < out.r) return null;
    if (field.crop === "pasture" || field.edge < HEADLAND) return null;
    return field as FieldPoint & {crop: Exclude<Crop, "pasture">};
}

/**
 * Whether a crop stands at a point (batch 5): well inside Home's farm (where the ground paints the rows fully), in a
 * field that grows one, off its headland. The meadow grass keeps out of these, so it grows on the margins only.
 */
export function cropsGrowAt(x: number, z: number): boolean {
    const s = sampleGround(x, z);
    if ((s.weights.farm_garden ?? 0) * smoothstep(0.6, 1, s.land) < 0.62) return false;
    return cropAt(x, z) !== null;
}

/**
 * A point moved across its field's rows onto the nearest row's middle (where the shader paints the plants), or
 * null when no crop grows there. For the close-up plants: deterministic, so everyone's cabbage is on the same row.
 */
export function snapToRow(x: number, z: number): {x: number; z: number; crop: Exclude<Crop, "pasture">; cell: [number, number]; edge: number; direction: {x: number; z: number}} | null {
    const field = cropAt(x, z);
    if (!field) return null;
    const spacing = CROP_ROWS[field.crop].spacing;
    // Rows running along the field are counted across it, and the other way round (the grid's axes are a hair off
    // unit length, so the step is divided by it).
    const across = field.rowsAlong ? ACROSS : ALONG;
    const shift = ((Math.round(field.row) - field.row) * spacing) / (across.x * across.x + across.z * across.z);
    const sx = x + across.x * shift;
    const sz = z + across.z * shift;
    const snapped = cropAt(sx, sz);
    if (!snapped || snapped.cell[0] !== field.cell[0] || snapped.cell[1] !== field.cell[1]) return null;
    return {x: sx, z: sz, crop: field.crop, cell: field.cell, edge: snapped.edge, direction: field.direction};
}

/**
 * The shader's twin of `fieldAt`/`cropAt` (GLSL ES 3.00). `arkField(p)` returns the crop index (0 pasture … 5
 * maize; pasture inside a keep-out) and, through `out`, the across-row coordinate in rows, the along coordinate (m),
 * the distance to the field's edge (m), the field's cell, the world direction the row count runs in, and the row
 * spacing (m).
 */
export function fieldsGlsl(): string {
    const outs = fieldKeepOuts();
    const keep = outs.map((o) => `    if (distance(middle, vec2(${o.x.toFixed(3)}, ${o.z.toFixed(3)})) < ${o.r.toFixed(3)}) inside = true;`).join("\n");
    const det = ALONG.x * ACROSS.z - ALONG.z * ACROSS.x;
    const shares = SHARES.map((s) => s.toFixed(4));
    const spacings = CROPS.map((c) => (CROP_ROWS[c].spacing || 1).toFixed(3));
    return `
${hamletLotsGlsl()}
${lanesGlsl()}
uint arkFieldHash(ivec2 c) {
    uint h = (uint(c.x + 1000) * 0x8da6b343u) ^ (uint(c.y + 1000) * 0xd8163841u);
    h ^= h >> 15u;
    h *= 0x2c1b3c6du;
    h ^= h >> 12u;
    return h;
}
int arkField(vec2 p, out float row, out float along, out float edge, out vec2 cellOut, out vec2 axis, out float spacing) {
    float fy = dot(p, vec2(${ACROSS.x}, ${ACROSS.z})) / ${FIELD_SIZE.across.toFixed(1)};
    float fx = dot(p, vec2(${ALONG.x}, ${ALONG.z})) / ${FIELD_SIZE.along.toFixed(1)} + floor(fy) * ${STAGGER};
    vec2 cell = floor(vec2(fx, fy));
    cellOut = cell;
    uint h = arkFieldHash(ivec2(cell));
    float pick = float(h & 0xffffu) / 65536.0;
    int crop = pick < ${shares[0]} ? 0 : pick < ${shares[1]} ? 1 : pick < ${shares[2]} ? 2 : pick < ${shares[3]} ? 3 : pick < ${shares[4]} ? 4 : 5;
    bool rowsAlong = ((h >> 16u) & 1u) == 1u;
    float u = (fx - cell.x) * ${FIELD_SIZE.along.toFixed(1)};
    float v = (fy - cell.y) * ${FIELD_SIZE.across.toFixed(1)};
    edge = min(min(u, ${FIELD_SIZE.along.toFixed(1)} - u), min(v, ${FIELD_SIZE.across.toFixed(1)} - v));
    float spacings[6] = float[6](${spacings.join(", ")});
    spacing = spacings[crop];
    row = (rowsAlong ? v : u) / spacing;
    along = rowsAlong ? u : v;
    axis = rowsAlong ? vec2(${ACROSS.x}, ${ACROSS.z}) : vec2(${ALONG.x}, ${ALONG.z});
    // A field is grass or crop whole, decided at its middle.
    float mu = (cell.x + 0.5 - cell.y * ${STAGGER}) * ${FIELD_SIZE.along.toFixed(1)};
    float mv = (cell.y + 0.5) * ${FIELD_SIZE.across.toFixed(1)};
    vec2 middle = vec2(mu * ${ACROSS.z} - mv * ${ALONG.z}, mv * ${ALONG.x} - mu * ${ACROSS.x}) / ${det.toFixed(6)};
    bool inside = arkHamletLot(p) || arkLaneDistance(p) < ${LANE_CLEAR.toFixed(2)};
${keep}
    return inside ? 0 : crop;
}
`;
}
