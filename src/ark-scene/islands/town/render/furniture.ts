/**
 * The town's street furniture and street lamps (lane GA, docs/ark/town-island.md §11): heritage lanterns in the old
 * town and on the quays, steel columns on the roads, litter bins, benches, planters, bollards, Sheffield bike stands
 * with bikes, bus shelters with their flags, traffic signals at the high street's junction, Belisha beacons at the
 * zebra crossings, give-way and no-vehicles signs, blank street-name plates (no real names or brands).
 *
 * Built in the town's prebuild worker with the scenery (pure, seeded, the same for every viewer):
 * - the bodies go into each chunk's solid mesh (no draw calls added; they stream and cast shadows with their chunk);
 * - the bus shelters' panes into the chunk's glass;
 * - everything that gives light (lanterns, signal lenses, beacons, shelter lights) into one `lights` mesh of its own,
 *   drawn by `lightsMaterial`: lamps lit from dusk, the signals cycling and the beacons flashing on the shared clock;
 * - each lamp's head into `heads`, from which the main thread builds the lamp map (`lampMapTexture`) that lights
 *   the ground and every town material at night (`materials.ts`), and the glow round each lit lamp (`lampGlow`).
 */

import {AdditiveBlending, BufferAttribute, Color, DataTexture, InstancedBufferAttribute, InstancedMesh, Matrix4, NearestFilter, MeshStandardMaterial, PlaneGeometry, RGBAFormat, ShaderMaterial, UnsignedByteType, type WebGLProgramParametersWithUniforms} from "three";
import {hashText, inBox, polylineAt, polylineLength, polylineNearest, rng, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {TOWN_HALF, type TownPlan} from "@/ark-scene/islands/town/plan";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {CROSSINGS, PAVEMENT_LIFT} from "@/ark-scene/islands/town/render/streets";
import {TOWN_LAMP_HEIGHT, TOWN_LAMP_REACH, TOWN_LAMP_TEXELS, TOWN_LIGHT, TOWN_UNIFORMS} from "@/ark-scene/islands/town/render/materials";
import {ARK_TIME} from "@/ark-scene/glsl";

type Colour = [number, number, number];
type Chunk = {solid: Geo; glass: Geo};

/** What a light is (the lights mesh's `aTag`: kind + 8 × phase). */
export const LIGHT = {lamp: 0, red: 1, amber: 2, green: 3, beacon: 4, shelter: 5} as const;

export type FurnitureItem = {kind: "lamp_heritage" | "lamp_column" | "bin" | "bench" | "planter" | "bollard" | "bike_stand" | "bike" | "bus_stop" | "signal" | "beacon" | "give_way" | "no_vehicles" | "name_plate"; x: number; y: number; z: number; turn: number};

export type FurnitureOut = {
    /** Every lit thing, one mesh for the town. */
    lights: Geo;
    /** Each lamp head: x, y, z (the town's frame), its kind (0 heritage, 1 column). */
    heads: Float32Array;
    /** What was placed (for the tests and the stats). */
    counts: Record<string, number>;
    /** The lamp map's texels (`lampMapData`), worked out here in the worker. */
    lampMap: Uint8Array;
};

const IRON = tone("#1f2326");
const STEEL = tone("#6d7377");
const BLACK = tone("#16181a");
const WHITE = tone("#e4e2db");
const GOLD = tone("#a88a3c");
const TIMBER = tone("#7a5b3c");
const CONCRETE = tone("#a8a49b");
const BIN = tone("#1f3a2b");
const SHRUB = tone("#3f6a33");
const FLOWER = [tone("#c44a5a"), tone("#e0b040"), tone("#8a5ac0"), tone("#e8e4dc")];
const RED = tone("#b3261e");
const BUS = tone("#c8352b");
const LENS_OFF = tone("#202020");

/** Bus stops (street id, metres along, side): the high street both ways, the harbour road, the park road. */
export const BUS_STOPS: Array<{street: string; at: number; side: number}> = [
    {street: "high_street", at: 120, side: 1},
    {street: "high_street", at: 135, side: -1},
    {street: "harbour_road", at: 95, side: 1},
    {street: "park_road", at: 120, side: -1},
    {street: "high_street_east", at: 90, side: 1}
];

/** The old town (heritage lanterns there; steel columns elsewhere). */
const OLD_TOWN: Box = {x: -60, z: 25, w: 240, d: 150, rot: 0};

function frame(x: number, y: number, z: number, rot: number): Frame {
    return {x, y, z, rot};
}

// MARK: - The pieces (each in a frame on the ground; local +z is the front: toward the road)

function heritageLamp(c: Chunk, lights: Geo, f: Frame) {
    c.solid.cylinder(f, 0, 0, 0, 0.26, 0.22, 0.5, IRON, 8);
    c.solid.cylinder(f, 0, 0.5, 0, 0.16, 0.13, 0.12, GOLD, 8);
    c.solid.cylinder(f, 0, 0.62, 0, 0.11, 0.075, 3.1, IRON, 8);
    c.solid.cylinder(f, 0, 2.7, 0, 0.1, 0.1, 0.08, IRON, 8);
    // The ladder rest, the lantern's seat, its frame and its cap with a finial.
    c.solid.box(f, 0, 3.0, 0, 0.9, 0.05, 0.05, IRON);
    c.solid.cylinder(f, 0, 3.72, 0, 0.08, 0.2, 0.18, IRON, 8);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]] as const) c.solid.box(f, lx, 3.9, lz, 0.03, 0.58, 0.03, IRON);
    c.solid.pyramid(f, 0, 4.48, 0, 0.52, 0.3, IRON);
    c.solid.cylinder(f, 0, 4.76, 0, 0.03, 0.0, 0.16, GOLD, 6);
    lights.tag = LIGHT.lamp;
    lights.box(f, 0, 3.92, 0, 0.32, 0.54, 0.32, tone("#fff1cc"));
}

function columnLamp(c: Chunk, lights: Geo, f: Frame) {
    c.solid.cylinder(f, 0, 0, 0, 0.13, 0.1, 0.6, STEEL, 8);
    c.solid.cylinder(f, 0, 0.6, 0, 0.085, 0.06, 5.4, STEEL, 8);
    // A swept arm out over the road and the luminaire at its end.
    c.solid.box(f, 0, 5.75, 0.3, 0.07, 0.07, 0.62, STEEL, 0);
    c.solid.box(f, 0, 5.82, 0.85, 0.07, 0.06, 0.55, STEEL, 0);
    c.solid.box(f, 0, 5.86, 1.22, 0.3, 0.1, 0.62, tone("#4c5256"));
    lights.tag = LIGHT.lamp;
    lights.box(f, 0, 5.83, 1.22, 0.24, 0.03, 0.5, tone("#fff4dc"));
}

function litterBin(c: Chunk, f: Frame) {
    c.solid.cylinder(f, 0, 0, 0, 0.27, 0.25, 0.92, BIN, 10);
    c.solid.cylinder(f, 0, 0.18, 0, 0.275, 0.275, 0.06, GOLD, 10, false);
    c.solid.cylinder(f, 0, 0.92, 0, 0.3, 0.22, 0.12, BIN, 10);
    c.solid.box(f, 0, 0.62, 0.24, 0.24, 0.16, 0.04, BLACK);
}

function bench(c: Chunk, f: Frame) {
    for (const lx of [-0.8, 0.8]) {
        c.solid.box(f, lx, 0, 0.05, 0.06, 0.44, 0.5, IRON);
        c.solid.box(f, lx, 0.42, -0.2, 0.06, 0.48, 0.06, IRON);
        c.solid.box(f, lx, 0.62, 0.05, 0.05, 0.05, 0.42, IRON);
    }
    for (let k = 0; k < 4; k++) c.solid.box(f, 0, 0.44, -0.12 + k * 0.12, 1.86, 0.035, 0.09, TIMBER.map((v) => v * (0.92 + 0.04 * k)) as Colour);
    for (let k = 0; k < 3; k++) c.solid.box(f, 0, 0.55 + k * 0.13, -0.22, 1.86, 0.09, 0.03, TIMBER);
}

function planter(c: Chunk, f: Frame, seed: number) {
    c.solid.box(f, 0, 0, 0, 1.5, 0.55, 0.7, CONCRETE);
    c.solid.box(f, 0, 0.55, 0, 1.56, 0.05, 0.76, tone("#bcb7ad"));
    const r = rng(seed);
    for (let k = 0; k < 3; k++) c.solid.blob(f.x + Math.cos(f.rot) * (-0.45 + k * 0.45), f.y + 0.78, f.z + Math.sin(f.rot) * (-0.45 + k * 0.45), 0.36, 0.3, 0.3, SHRUB.map((v) => v * (0.85 + r() * 0.3)) as Colour, seed + k, 0);
    for (let k = 0; k < 5; k++) {
        const lx = -0.6 + r() * 1.2;
        const lz = -0.25 + r() * 0.5;
        c.solid.box(f, lx, 0.6, lz, 0.1, 0.32 + r() * 0.15, 0.1, FLOWER[Math.floor(r() * FLOWER.length)]);
    }
}

function bollard(c: Chunk, f: Frame) {
    c.solid.cylinder(f, 0, 0, 0, 0.11, 0.1, 0.85, IRON, 8);
    c.solid.cylinder(f, 0, 0.7, 0, 0.115, 0.115, 0.05, GOLD, 8, false);
    c.solid.cylinder(f, 0, 0.85, 0, 0.1, 0.04, 0.12, IRON, 8);
}

function bikeStand(c: Chunk, f: Frame) {
    for (const lz of [-0.35, 0.35]) c.solid.box(f, 0, 0, lz, 0.05, 0.8, 0.05, STEEL);
    c.solid.box(f, 0, 0.78, 0, 0.05, 0.05, 0.76, STEEL);
}

/** A disc in the frame's x–y plane at `lz`, facing +z (its back in `back`, if given). */
function disc(g: Geo, f: Frame, lx: number, ly: number, lz: number, r: number, colour: Colour, segments = 12, back: Colour | null = null) {
    const c = atF(f, lx, ly, lz);
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const p0 = atF(f, lx + Math.cos(a0) * r, ly + Math.sin(a0) * r, lz);
        const p1 = atF(f, lx + Math.cos(a1) * r, ly + Math.sin(a1) * r, lz);
        g.tri(c, p0, p1, colour);
        if (back) g.tri(c, p1, p0, back);
    }
}

/** A wheel: a tyre ring in the frame's y–z plane (seen from both sides), and its hub. */
function wheel(g: Geo, f: Frame, lz: number, colour: Colour) {
    const centre = 0.34;
    for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2;
        const a1 = ((i + 1) / 16) * Math.PI * 2;
        const p = (a: number, rad: number, lx: number) => atF(f, lx, centre + Math.sin(a) * rad, lz + Math.cos(a) * rad);
        for (const lx of [-0.018, 0.018]) {
            g.quad(p(a0, 0.29, lx), p(a0, 0.34, lx), p(a1, 0.34, lx), p(a1, 0.29, lx), colour);
            g.quad(p(a1, 0.29, lx), p(a1, 0.34, lx), p(a0, 0.34, lx), p(a0, 0.29, lx), colour);
        }
    }
    g.box(f, 0, centre - 0.03, lz, 0.05, 0.06, 0.06, STEEL);
}

function bike(c: Chunk, f: Frame, seed: number) {
    const paint = [tone("#2f5a8a"), tone("#a33a2e"), tone("#2f2f2f"), tone("#3f7a4a"), tone("#c8c0b0")][seed % 5];
    wheel(c.solid, f, -0.52, BLACK);
    wheel(c.solid, f, 0.52, BLACK);
    // The frame: down tube, top tube, seat tube, the stays; the saddle and the bars.
    c.solid.box(f, 0, 0.36, -0.05, 0.04, 0.04, 0.9, paint);
    c.solid.box(f, 0, 0.78, 0.0, 0.04, 0.04, 0.7, paint);
    c.solid.box(f, 0, 0.36, -0.28, 0.04, 0.5, 0.04, paint);
    c.solid.box(f, 0, 0.9, -0.3, 0.12, 0.04, 0.22, BLACK);
    c.solid.box(f, 0, 0.72, 0.42, 0.04, 0.34, 0.04, paint);
    c.solid.box(f, 0, 1.02, 0.42, 0.52, 0.03, 0.03, BLACK);
}

function busStop(c: Chunk, f: Frame, lights: Geo) {
    // The shelter: posts, a roof, glass at the back and the ends, a perch seat, a light under the roof.
    for (const lx of [-1.7, 1.7]) for (const lz of [-0.65, 0.65]) c.solid.box(f, lx, 0, lz, 0.07, 2.4, 0.07, STEEL);
    c.solid.box(f, 0, 2.4, 0, 3.6, 0.1, 1.5, tone("#555c60"));
    c.glass.box(f, 0, 0.12, -0.66, 3.3, 2.2, 0.02, tone("#3e4c52"));
    for (const lx of [-1.71, 1.71]) c.glass.box(f, lx, 0.12, -0.1, 0.02, 2.2, 1.0, tone("#3e4c52"));
    c.solid.box(f, 0, 0.6, -0.45, 2.2, 0.05, 0.28, STEEL);
    lights.tag = LIGHT.shelter;
    lights.box(f, 0, 2.36, 0, 2.4, 0.03, 0.18, tone("#f4f8ff"));
    // The flag: a pole at the kerb with a plain red and white plate (no operator's name), and a timetable case.
    c.solid.cylinder(f, 2.3, 0, 0.6, 0.04, 0.04, 2.9, STEEL, 6);
    c.solid.box(f, 2.3, 2.45, 0.6, 0.05, 0.42, 0.46, BUS);
    c.solid.box(f, 2.3, 2.5, 0.6, 0.06, 0.2, 0.3, WHITE);
    c.solid.box(f, 2.3, 1.2, 0.6, 0.06, 0.5, 0.32, tone("#f0ece0"));
}

function signal(c: Chunk, f: Frame, lights: Geo, phase: number) {
    c.solid.cylinder(f, 0, 0, 0, 0.07, 0.06, 3.2, tone("#2a2d30"), 8);
    c.solid.box(f, 0, 2.2, 0.08, 0.36, 1.05, 0.22, BLACK);
    c.solid.box(f, 0, 2.13, 0.03, 0.5, 1.19, 0.02, WHITE);
    for (const [k, tag] of [[0, LIGHT.red], [1, LIGHT.amber], [2, LIGHT.green]] as const) {
        c.solid.box(f, 0, 2.9 - k * 0.33 + 0.12, 0.2, 0.26, 0.04, 0.12, BLACK);
        lights.tag = tag + phase * 8;
        disc(lights, f, 0, 2.9 - k * 0.33, 0.2, 0.11, LENS_OFF, 12);
    }
}

function beacon(c: Chunk, f: Frame, lights: Geo) {
    for (let k = 0; k < 10; k++) c.solid.cylinder(f, 0, k * 0.26, 0, 0.055, 0.055, 0.26, k % 2 ? WHITE : BLACK, 8, k === 9);
    lights.tag = LIGHT.beacon;
    lights.blob(...atF(f, 0, 2.78, 0), 0.17, 0.17, 0.17, tone("#ffb020"), 7, 1);
}

function sign(c: Chunk, f: Frame, kind: "give_way" | "no_vehicles") {
    c.solid.cylinder(f, 0, 0, 0, 0.035, 0.035, 2.3, STEEL, 6);
    if (kind === "give_way") {
        // A downward triangle: red border, white inside.
        const s: Frame = {...f, y: f.y + 2.05};
        c.solid.tri(atF(s, -0.38, 0.22, 0.05), atF(s, 0, -0.44, 0.05), atF(s, 0.38, 0.22, 0.05), RED);
        c.solid.tri(atF(s, -0.38, 0.22, 0.045), atF(s, 0.38, 0.22, 0.045), atF(s, 0, -0.44, 0.045), STEEL);
        c.solid.tri(atF(s, -0.27, 0.16, 0.056), atF(s, 0, -0.3, 0.056), atF(s, 0.27, 0.16, 0.056), WHITE);
    } else {
        disc(c.solid, f, 0, 2.05, 0.05, 0.3, RED, 16, STEEL);
        disc(c.solid, f, 0, 2.05, 0.056, 0.23, WHITE, 16);
    }
}

function namePlate(c: Chunk, f: Frame) {
    for (const lx of [-0.55, 0.55]) c.solid.box(f, lx, 0, 0, 0.05, 1.0, 0.05, BLACK);
    c.solid.box(f, 0, 0.62, 0, 1.3, 0.3, 0.04, WHITE);
    c.solid.box(f, 0, 0.66, 0.012, 1.18, 0.22, 0.04, BLACK);
}

function atF(f: Frame, lx: number, ly: number, lz: number): [number, number, number] {
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    return [f.x + lx * c - lz * s, f.y + ly, f.z + lx * s + lz * c];
}

// MARK: - Placing it

/** The turn that faces a point (local +z toward it). */
function facing(from: Pt, to: Pt): number {
    return Math.atan2(-(to.x - from.x), to.z - from.z);
}

/**
 * Everything, into the scenery's chunks (solids and glass) and its own lights; `lamps` are the scenery's lamp spots
 * (`scenery.ts` lamps), which this module draws. Pure and seeded.
 */
export function streetFurniture(plan: TownPlan, lamps: ReadonlyArray<{x: number; y: number; z: number}>, at: {chunkAt: (x: number, z: number) => Chunk; heightAt: (x: number, z: number) => number}): FurnitureOut {
    const lights = new Geo();
    const heads: number[] = [];
    const counts: Record<string, number> = {};
    const placed: Pt[] = [];
    const count = (kind: string) => (counts[kind] = (counts[kind] ?? 0) + 1);
    const clear = (x: number, z: number, room: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= room);
    const driveAt = (x: number, z: number) => plan.parcels.some((p) => p.drive && inBox(p.drive, x, z, 0.6));
    const roads = plan.streets.filter((s) => s.kind === "high" || s.kind === "road");

    // The lamps: heritage lanterns in the old town, by the canal, the quays and the park; columns facing the road elsewhere.
    for (const l of lamps) {
        const near = roads.map((s) => ({s, n: polylineNearest(s.line, l.x, l.z)})).sort((a, b) => a.n.distance - b.n.distance)[0];
        const toRoad = near && near.n.distance < near.s.width / 2 + near.s.pavement + 1.5 ? facing(l, near.n.point) : (hashText(`${l.x}|${l.z}`) % 628) / 100;
        const heritage = inBox(OLD_TOWN, l.x, l.z) || !near || near.n.distance > near.s.width / 2 + near.s.pavement + 1.5;
        const f = frame(l.x, l.y, l.z, toRoad);
        const c = at.chunkAt(l.x, l.z);
        if (heritage) {
            heritageLamp(c, lights, f);
            heads.push(l.x, l.y + 4.19, l.z, 0);
        } else {
            columnLamp(c, lights, f);
            const head = atF(f, 0, 5.83, 1.22);
            heads.push(head[0], head[1], head[2], 1);
        }
        placed.push({x: l.x, z: l.z});
        count(heritage ? "lamp_heritage" : "lamp_column");
    }

    // Bus stops (the shelter at the back of the pavement, facing the road).
    for (const b of BUS_STOPS) {
        const s = plan.streets.find((q) => q.id === b.street);
        if (!s || b.at > polylineLength(s.line) - 3) continue;
        const {point, dir} = polylineAt(s.line, b.at);
        const off = b.side * (s.width / 2 + s.pavement - 0.85);
        const x = point.x - dir.z * off;
        const z = point.z + dir.x * off;
        const f = frame(x, at.heightAt(x, z) + PAVEMENT_LIFT, z, facing({x, z}, point));
        busStop(at.chunkAt(x, z), f, lights);
        placed.push({x, z});
        count("bus_stop");
    }

    // Belisha beacons at each end of each zebra crossing, at the kerb.
    for (const cr of CROSSINGS) {
        const s = plan.streets.find((q) => q.id === cr.street);
        if (!s || cr.at > polylineLength(s.line) - 4) continue;
        const {point, dir} = polylineAt(s.line, cr.at);
        for (const side of [-1, 1]) {
            const off = side * (s.width / 2 + 0.45);
            const x = point.x - dir.z * off;
            const z = point.z + dir.x * off;
            beacon(at.chunkAt(x, z), frame(x, at.heightAt(x, z) + PAVEMENT_LIFT, z, 0), lights);
            placed.push({x, z});
            count("beacon");
        }
    }

    // Traffic signals where the high street meets the park road: one pole per approach, the two roads on opposite phases.
    const highStreet = plan.streets.find((s) => s.id === "high_street");
    const park = plan.streets.find((s) => s.id === "park_road");
    if (highStreet && park) {
        const end = highStreet.line[highStreet.line.length - 1];
        const corners: Array<[number, number, number]> = [[-1, -1, 0], [1, -1, 1], [1, 1, 0], [-1, 1, 1]];
        for (const [sx, sz, phase] of corners) {
            const x = end.x + sx * (park.width / 2 + 0.5);
            const z = end.z + sz * (highStreet.width / 2 + 0.5);
            const f = frame(x, at.heightAt(x, z) + PAVEMENT_LIFT, z, phase ? facing({x, z}, {x, z: z - sz * 10}) : facing({x, z}, {x: x - sx * 10, z}));
            signal(at.chunkAt(x, z), f, lights, phase);
            placed.push({x, z});
            count("signal");
        }
    }

    // Along every street with a pavement: bins, benches and planters on the high streets, bike stands by the square,
    // give-way signs where a road ends at another, name plates at the corners.
    for (const s of plan.streets) {
        if (s.pavement <= 0) continue;
        const length = polylineLength(s.line);
        const r = rng(hashText(`furniture:${s.id}`));
        const high = s.kind === "high";
        const kerbSide = (side: number) => side * (s.width / 2 + 0.6);
        const backSide = (side: number) => side * (s.width / 2 + s.pavement - 0.45);
        const put = (a: number, off: number, room: number, place: (c: Chunk, f: Frame) => void, kind: string, faceRoad = true) => {
            const {point, dir} = polylineAt(s.line, a);
            const x = point.x - dir.z * off;
            const z = point.z + dir.x * off;
            if (!clear(x, z, room) || driveAt(x, z)) return false;
            const turn = faceRoad ? facing({x, z}, {x: point.x, z: point.z}) : Math.atan2(-dir.x, dir.z);
            place(at.chunkAt(x, z), frame(x, at.heightAt(x, z) + PAVEMENT_LIFT, z, turn));
            placed.push({x, z});
            count(kind);
            return true;
        };
        for (let a = 14 + r() * 8; a < length - 6; a += high ? 34 : 52) put(a, kerbSide(Math.floor(a / 7) % 2 ? 1 : -1), 3, litterBin, "bin");
        if (high) {
            for (let a = 24; a < length - 8; a += 46) put(a, backSide(Math.floor(a / 5) % 2 ? 1 : -1), 3, bench, "bench");
            for (let a = 31; a < length - 8; a += 46) put(a, kerbSide(Math.floor(a / 3) % 2 ? 1 : -1), 3.2, (c, f) => planter(c, f, hashText(`${s.id}${a}`)), "planter", false);
        }
        // Junction ends: a give-way sign, bollards and a name plate where this street meets another.
        for (const endAt of [0.5, length - 0.5]) {
            const {point} = polylineAt(s.line, endAt);
            const meets = plan.streets.some((o) => o.id !== s.id && o.pavement > 0 && polylineNearest(o.line, point.x, point.z).distance < o.width / 2 + o.pavement + 1);
            if (!meets) continue;
            const inward = endAt < 1 ? 4 : length - 4;
            put(inward, kerbSide(1), 2, (c, f) => sign(c, f, "give_way"), "give_way");
            put(inward + (endAt < 1 ? 2 : -2), backSide(-1), 2, namePlate, "name_plate", false);
        }
    }

    // By the market square: bollards along its edge on the high street, bike stands with bikes, a no-vehicles sign at its walk.
    const sq = plan.square;
    for (let k = 0; k < 9; k++) {
        const lx = -sq.w / 2 + 3 + k * ((sq.w - 6) / 8);
        const c = Math.cos(sq.rot);
        const sn = Math.sin(sq.rot);
        const x = sq.x + lx * c - (sq.d / 2 + 0.4) * sn;
        const z = sq.z + lx * sn + (sq.d / 2 + 0.4) * c;
        if (!clear(x, z, 1.2)) continue;
        bollard(at.chunkAt(x, z), frame(x, at.heightAt(x, z) + 0.12, z, 0));
        placed.push({x, z});
        count("bollard");
    }
    for (let k = 0; k < 4; k++) {
        const lx = sq.w / 2 - 3 - k * 1.1;
        const x = sq.x + lx * Math.cos(sq.rot) - (-sq.d / 2 + 1.6) * Math.sin(sq.rot);
        const z = sq.z + lx * Math.sin(sq.rot) + (-sq.d / 2 + 1.6) * Math.cos(sq.rot);
        const f = frame(x, at.heightAt(x, z) + 0.12, z, sq.rot);
        const c = at.chunkAt(x, z);
        bikeStand(c, f);
        count("bike_stand");
        // Some have a bike leaning on them (day by day the same: they are the square's regulars).
        if (k !== 2) {
            bike(c, {...f, x: f.x + Math.cos(sq.rot) * 0.12, z: f.z + Math.sin(sq.rot) * 0.12}, hashText(`bike${k}`));
            count("bike");
        }
        placed.push({x, z});
    }
    {
        const x = sq.x - sq.w / 2 - 2.2;
        const z = sq.z - 6;
        sign(at.chunkAt(x, z), frame(x, at.heightAt(x, z), z, Math.PI / 2), "no_vehicles");
        count("no_vehicles");
    }
    const headArray = Float32Array.from(heads);
    return {lights, heads: headArray, counts, lampMap: lampMapData(plan, headArray)};
}

// MARK: - The lamp map (main thread)

/**
 * The lamp map (`materials.ts` TOWN_LIGHT.lampMap), RGBA8 a 1 m cell: each cell's nearest lamp head within 16 m, as
 * its offset from the cell's middle, its height, and how much of it the cell sees (4 sample points a cell; a building
 * between them blocks it, so a lamp on the street never lights the garden behind the house). The shader reads the
 * four cells round a point and blends their light (so a shadow's edge is soft), never their offsets: an offset blended
 * across two lamps' cells, or into a cell with none, is a lamp that isn't there.
 */
export function lampMapData(plan: TownPlan, heads: Float32Array): Uint8Array {
    const n = TOWN_LAMP_TEXELS;
    const size = TOWN_HALF * 2;
    const cell = size / n;
    const data = new Uint8Array(n * n * 4);
    const best = new Float32Array(n * n).fill(Infinity);
    const nearest = new Int32Array(n * n).fill(-1);
    const reach = TOWN_LAMP_REACH - 0.5;
    // Buildings on a coarse grid, for the shadow tests.
    const grid = new Map<number, Box[]>();
    const key = (gx: number, gz: number) => (gx + 64) * 128 + gz + 64;
    for (const b of plan.buildings) {
        const r = Math.hypot(b.at.w, b.at.d) / 2;
        for (let gx = Math.floor((b.at.x - r) / 8); gx <= Math.floor((b.at.x + r) / 8); gx++) {
            for (let gz = Math.floor((b.at.z - r) / 8); gz <= Math.floor((b.at.z + r) / 8); gz++) {
                const list = grid.get(key(gx, gz)) ?? [];
                list.push(b.at);
                grid.set(key(gx, gz), list);
            }
        }
    }
    // (No allocation per test: some 240,000 of them run.)
    const homes: Box[] = [];
    const blocked = (x0: number, z0: number, x1: number, z1: number) => {
        // The buildings the point itself stands in (its wall, a terrace's party wall) do not shade it.
        homes.length = 0;
        for (const b of grid.get(key(Math.floor(x0 / 8), Math.floor(z0 / 8))) ?? []) if (inBox(b, x0, z0, 0.3)) homes.push(b);
        const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.7);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = x0 + (x1 - x0) * t;
            const z = z0 + (z1 - z0) * t;
            const list = grid.get(key(Math.floor(x / 8), Math.floor(z / 8)));
            if (!list) continue;
            for (let k = 0; k < list.length; k++) if (inBox(list[k], x, z, -0.05) && !homes.includes(list[k])) return true;
        }
        return false;
    };
    for (let h = 0; h < heads.length; h += 4) {
        const hx = heads[h];
        const hz = heads[h + 2];
        const c0 = Math.max(0, Math.floor((hx - reach + TOWN_HALF) / cell));
        const c1 = Math.min(n - 1, Math.floor((hx + reach + TOWN_HALF) / cell));
        const r0 = Math.max(0, Math.floor((hz - reach + TOWN_HALF) / cell));
        const r1 = Math.min(n - 1, Math.floor((hz + reach + TOWN_HALF) / cell));
        for (let row = r0; row <= r1; row++) {
            for (let column = c0; column <= c1; column++) {
                const cx = -TOWN_HALF + (column + 0.5) * cell;
                const cz = -TOWN_HALF + (row + 0.5) * cell;
                const d = Math.hypot(hx - cx, hz - cz);
                const i = row * n + column;
                if (d > reach || d >= best[i]) continue;
                best[i] = d;
                nearest[i] = h / 4;
            }
        }
    }
    for (let i = 0; i < n * n; i++) {
        if (nearest[i] < 0) continue;
        const h = nearest[i] * 4;
        const hx = heads[h];
        const hz = heads[h + 2];
        const cx = -TOWN_HALF + ((i % n) + 0.5) * cell;
        const cz = -TOWN_HALF + (Math.floor(i / n) + 0.5) * cell;
        let seen = 0;
        for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) if (!blocked(cx + ox * cell, cz + oz * cell, hx, hz)) seen++;
        data[i * 4] = Math.round(Math.min(Math.max(((hx - cx) / TOWN_LAMP_REACH) * 127.5 + 127.5, 0), 255));
        data[i * 4 + 1] = Math.round(Math.min(Math.max(((hz - cz) / TOWN_LAMP_REACH) * 127.5 + 127.5, 0), 255));
        data[i * 4 + 2] = Math.round(Math.min(Math.max(heads[h + 1] / TOWN_LAMP_HEIGHT, 0), 1) * 255);
        data[i * 4 + 3] = Math.round((seen / 4) * 255);
    }
    return data;
}

export function lampMapTexture(data: Uint8Array): DataTexture {
    const texture = new DataTexture(data, TOWN_LAMP_TEXELS, TOWN_LAMP_TEXELS, RGBAFormat, UnsignedByteType);
    // Read cell by cell (`materials.ts` blends the four cells' light, not their lamps' places).
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
}

// MARK: - The lights' material and the glow

/**
 * The lights (`aTag` = kind + 8 × phase): lamps and shelter lights lit from dusk (`TOWN_LIGHT.lampOn`); signals on a
 * 60 s cycle on the shared clock (green 26 s, amber 3, red 31; phase 1 the other road, red-amber before green);
 * beacons flashing once a second. Dark lenses when off.
 */
export function lightsMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.25, metalness: 0, emissive: new Color(1, 1, 1), emissiveIntensity: 1});
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, TOWN_UNIFORMS, {townClock: ARK_TIME});
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aTag;\nvarying float vLightTag;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLightTag = aTag;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vLightTag;\nuniform float townClock;\nuniform float townLampOn;")
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
{
    float tag = floor(vLightTag + 0.5);
    float phase = floor(tag / 8.0 + 0.01);
    float kind = tag - phase * 8.0;
    float t = mod(townClock + phase * 30.0, 60.0);
    float on = 0.0;
    vec3 glow = vec3(1.0, 0.84, 0.6);
    if (kind < 0.5) { on = townLampOn; glow = vec3(1.0, 0.8, 0.52) * 5.0; }
    else if (kind < 1.5) { on = step(29.0, t); glow = vec3(1.0, 0.08, 0.04) * 4.0; }
    else if (kind < 2.5) { on = step(26.0, t) * step(t, 29.0) + step(57.0, t); glow = vec3(1.0, 0.55, 0.05) * 4.0; }
    else if (kind < 3.5) { on = step(t, 26.0); glow = vec3(0.15, 1.0, 0.45) * 4.0; }
    else if (kind < 4.5) { on = step(0.5, fract(townClock)); glow = vec3(1.0, 0.62, 0.12) * 4.0; }
    else { on = townLampOn; glow = vec3(0.9, 0.95, 1.0) * 3.0; }
    totalEmissiveRadiance = glow * on;
    diffuseColor.rgb *= mix(0.25, 1.0, on);
}`
            );
    };
    material.customProgramCacheKey = () => "town-lights-1";
    return material;
}

/** A soft glow round each lamp head at night (one instanced quad a lamp, turned to the camera, additive). */
export function lampGlow(heads: Float32Array): InstancedMesh {
    const count = Math.max(heads.length / 4, 1);
    const geometry = new PlaneGeometry(1, 1);
    const offsets = new Float32Array(count * 4);
    offsets.set(heads.subarray(0, count * 4));
    geometry.setAttribute("aHead", new InstancedBufferAttribute(offsets, 4));
    const material = new ShaderMaterial({
        uniforms: {townLampOn: TOWN_LIGHT.lampOn},
        vertexShader: `
attribute vec4 aHead;
varying vec2 vUv;
varying float vFade;
uniform float townLampOn;
void main() {
    vUv = uv;
    vec4 centre = modelViewMatrix * vec4(aHead.xyz, 1.0);
    float size = mix(1.5, 2.4, aHead.w) * townLampOn;
    // Fades far away (a lamp is a point of light there, and the haze has it).
    vFade = 1.0 - smoothstep(120.0, 420.0, -centre.z);
    centre.xy += position.xy * size;
    gl_Position = projectionMatrix * centre;
}`,
        fragmentShader: `
varying vec2 vUv;
varying float vFade;
void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - r, 0.0), 2.2) * 0.5 * vFade;
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, 1.0);
}`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
    });
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.count = heads.length / 4;
    const identity = new Matrix4();
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, identity);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.name = "town:lamp-glow";
    return mesh;
}

/** The lights Geo as geometry, with its tags (for `lightsMaterial`). */
export function lightsGeometry(lights: Geo) {
    const geometry = lights.toGeometry(true);
    if (!geometry.getAttribute("aTag")) geometry.setAttribute("aTag", new BufferAttribute(new Float32Array(lights.pos.length / 3), 1));
    return geometry;
}
