/**
 * The town's boats (graphics pass 1, lane WATER; owner 2026-11-16: "boat in the docking area is half in the water and has
 * glitching interior", "canal boat is half in the water"): the harbour's inshore fishing boats and the canal's
 * narrowboats, their hulls closed and wound outward, each seated on its own water with a little bob.
 *
 * What was wrong: both hulls' sides and decks were wound inward (their faces pointed into the boat), so the material's
 * back-face culling dropped the near side and the deck and drew the far side's inside: from the quay a boat showed only
 * its cabin over a hole, or the inside of its far side seen through where its deck should be; the open stern showed
 * the same. And the fishing boats were pinned at 0.15 m while the harbour's water rides the tide (±0.35 m).
 *
 * Here: a hull is built from stations (`hull`): each side in colour bands up from the keel, a deck facing up, a
 * transom, a bottom, a bulwark with its cap rail: closed and wound outward (the test checks every triangle). A boat's
 * waterline is its model's y = 0; the floating material (`floatingMaterial`) lifts the harbour's by the sea's level and
 * rocks every boat a few centimetres in the vertex shader (no CPU per frame, no new draw call).
 */

import {MeshStandardMaterial, type BufferGeometry, type WebGLProgramParametersWithUniforms} from "three";
import {ARK_ENV, ARK_TIME} from "@/ark-scene/glsl";
import {CANAL, CANAL_WIDTH} from "@/ark-scene/islands/town/plan";
import {polylineAt, polylineLength, polylineNearest, type Pt} from "@/ark-scene/islands/town/geom";
import {Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";

type Colour = [number, number, number];

/** A hull's station: at `z`, half its beam at the deck and at the keel, the deck's height and the keel's (m, waterline 0). */
export type Station = {z: number; deck: number; keel: number; top: number; bottom: number};

/** A colour band up a hull's side, from y0 to y1 (clipped to each station's keel and deck). */
export type Band = [number, number, Colour];

function widthAt(s: Station, y: number): number {
    const t = (y - s.bottom) / Math.max(s.top - s.bottom, 1e-6);
    return s.keel + (s.deck - s.keel) * Math.min(Math.max(t, 0), 1);
}

/**
 * A closed hull from its stations (stern first, along +z to the bow): both sides in `bands`, a transom across the stern,
 * the bottom, the deck at each station's top (facing up), and a bulwark `rail` m high above the deck round the sides
 * (its outside in the top band's colour, its inside and its cap in `railColour`). Every face wound outward.
 */
export function hull(g: Geo, stations: Station[], bands: Band[], deckColour: Colour, rail = 0, railColour: Colour = deckColour) {
    const top = bands[bands.length - 1][2];
    for (let i = 1; i < stations.length; i++) {
        const s0 = stations[i - 1];
        const s1 = stations[i];
        for (const side of [-1, 1]) {
            const p = (s: Station, y: number, inset = 0): V3 => [side * (widthAt(s, y) - inset), y, s.z];
            // (Wound so the face points out: +x on the right side, −x on the left.)
            const face = (a0: V3, a1: V3, b0: V3, b1: V3, colour: Colour) => (side > 0 ? g.quad(b0, a0, a1, b1, colour) : g.quad(a0, b0, b1, a1, colour));
            for (const [y0, y1, colour] of bands) {
                const lo0 = Math.max(y0, s0.bottom);
                const hi0 = Math.min(y1, s0.top);
                const lo1 = Math.max(y0, s1.bottom);
                const hi1 = Math.min(y1, s1.top);
                if (hi0 <= lo0 && hi1 <= lo1) continue;
                face(p(s0, lo0), p(s0, Math.max(hi0, lo0)), p(s1, lo1), p(s1, Math.max(hi1, lo1)), colour);
            }
            if (rail > 0) {
                // The bulwark: its outside straight up from the sheer, its cap, its inside back down to the deck.
                const o0: V3 = [side * s0.deck, s0.top, s0.z];
                const o1: V3 = [side * s1.deck, s1.top, s1.z];
                const r0: V3 = [side * s0.deck, s0.top + rail, s0.z];
                const r1: V3 = [side * s1.deck, s1.top + rail, s1.z];
                const t = Math.min(0.07, s0.deck * 0.4, s1.deck * 0.4);
                const i0: V3 = [side * (s0.deck - t), s0.top + rail, s0.z];
                const i1: V3 = [side * (s1.deck - t), s1.top + rail, s1.z];
                const d0: V3 = [side * (s0.deck - t), s0.top, s0.z];
                const d1: V3 = [side * (s1.deck - t), s1.top, s1.z];
                face(o0, r0, o1, r1, top);
                // (The cap faces up; the inside faces in.)
                if (side > 0) g.quad(r0, i0, i1, r1, railColour);
                else g.quad(i0, r0, r1, i1, railColour);
                if (side > 0) g.quad(d0, d1, i1, i0, railColour.map((c) => c * 0.85) as Colour);
                else g.quad(d1, d0, i0, i1, railColour.map((c) => c * 0.85) as Colour);
            }
        }
        // The deck (up) and the bottom (down).
        g.quad([-s0.deck, s0.top, s0.z], [-s1.deck, s1.top, s1.z], [s1.deck, s1.top, s1.z], [s0.deck, s0.top, s0.z], deckColour);
        g.quad([-s0.keel, s0.bottom, s0.z], [s0.keel, s0.bottom, s0.z], [s1.keel, s1.bottom, s1.z], [-s1.keel, s1.bottom, s1.z], bands[0][2]);
    }
    // The stern bulwark's inside (facing forward), over the deck.
    if (rail > 0) {
        const s = stations[0];
        const t = Math.min(0.07, s.deck * 0.4);
        g.quad([-(s.deck - t), s.top, s.z + t], [s.deck - t, s.top, s.z + t], [s.deck - t, s.top + rail, s.z + t], [-(s.deck - t), s.top + rail, s.z + t], railColour.map((c) => c * 0.85) as Colour);
        g.quad([-s.deck, s.top + rail, s.z], [-(s.deck - t), s.top + rail, s.z + t], [s.deck - t, s.top + rail, s.z + t], [s.deck, s.top + rail, s.z], railColour);
    }
    // The transom (facing aft, −z) and the stem's end (facing forward, +z), in bands.
    for (const [s, aft] of [[stations[0], true], [stations[stations.length - 1], false]] as const) {
        for (const [y0, y1, colour] of bands) {
            const lo = Math.max(y0, s.bottom);
            const hi = Math.min(y1, s.top + (aft ? rail : 0));
            if (hi <= lo) continue;
            const wl = widthAt(s, lo);
            const wh = widthAt(s, Math.min(hi, s.top));
            if (aft) g.quad([-wh, hi, s.z], [wh, hi, s.z], [wl, lo, s.z], [-wl, lo, s.z], colour);
            else g.quad([-wl, lo, s.z], [wl, lo, s.z], [wh, hi, s.z], [-wh, hi, s.z], colour);
        }
    }
}

/** The fishing boat's hull: a transom stern, its beam just forward of the middle, a rising sheer to a fine bow. */
export const FISHING_BOAT_STATIONS: Station[] = [
    {z: -3.5, deck: 1.0, keel: 0.62, top: 0.92, bottom: -0.3},
    {z: -2.2, deck: 1.16, keel: 0.55, top: 0.9, bottom: -0.55},
    {z: 0.3, deck: 1.2, keel: 0.42, top: 0.94, bottom: -0.62},
    {z: 1.9, deck: 1.02, keel: 0.22, top: 1.04, bottom: -0.52},
    {z: 2.9, deck: 0.62, keel: 0.07, top: 1.16, bottom: -0.3},
    {z: 3.55, deck: 0.05, keel: 0.02, top: 1.26, bottom: 0.15}
];

/**
 * A small inshore fishing boat for the harbour (7 m along +z, waterline at its origin): a flared white hull with a blue
 * sheer stripe over its black boot-top and red antifouling, a wooden deck inside a bulwark, the wheelhouse with its
 * windows all round, a mast with its light, a gantry, fish boxes and a buoy.
 */
export function fishingBoatGeometry(): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const white = tone("#f2efe8");
    const stations = FISHING_BOAT_STATIONS;
    const bands: Band[] = [
        [-2, 0.02, tone("#8a2a24")],
        [0.02, 0.12, tone("#1c1c1c")],
        [0.12, 0.6, white],
        [0.6, 0.74, tone("#2c4a7a")],
        [0.74, 2, white]
    ];
    hull(g, stations, bands, tone("#a8946c"), 0.24, tone("#e4e0d6"));
    // The wheelhouse, aft of the middle: white walls, dark windows round its upper half (proud of the walls, never in their
    // plane), a blue roof with a lip.
    const deck = 0.92;
    g.box(f, 0, deck, -0.9, 1.5, 1.38, 1.7, tone("#f4f1ea"));
    g.box(f, 0, deck + 0.78, -0.9, 1.54, 0.46, 1.42, tone("#1e2a30"));
    g.box(f, 0, deck + 0.78, -0.9, 1.3, 0.46, 1.74, tone("#1e2a30"));
    g.box(f, 0, deck + 1.4, -0.85, 1.68, 0.09, 1.95, tone("#2c4a7a"), 0, {bottom: true});
    // The mast and its light, the gantry at the stern, fish boxes, a buoy, the bow's fairlead.
    g.cylinder(f, 0, deck + 1.49, -1.3, 0.05, 0.04, 2.2, tone("#d8d4cc"), 6);
    g.box(f, 0, deck + 3.6, -1.3, 0.12, 0.14, 0.12, tone("#f0e6b0"));
    for (const lx of [-0.85, 0.85]) g.cylinder(f, lx, deck, -3.1, 0.05, 0.05, 1.7, tone("#c86a2a"), 6);
    g.box(f, 0, deck + 1.66, -3.1, 1.8, 0.08, 0.1, tone("#c86a2a"));
    for (const [lx, lz, colour] of [[-0.45, -2.6, "#e07a2a"], [0.2, -2.55, "#2a6ab0"], [-0.1, -2.15, "#e07a2a"]] as const) g.box(f, lx, deck, lz, 0.6, 0.3, 0.4, tone(colour), 0.1, {});
    g.blob(0.55, deck + 0.25, 0.9, 0.24, 0.24, 0.24, tone("#e8522a"), 11, 1);
    g.box(f, 0, deck + 0.1, 2.6, 0.3, 0.24, 0.3, tone("#3a3a3a"));
    return g.toGeometry();
}

/** The canal boats' liveries (lane GC): hull, cabin side, coach lines, the panels' second colour. */
export const NARROWBOAT_LIVERIES: Array<[string, string, string, string]> = [
    ["#1f3d2c", "#2f5a3a", "#e8dcb4", "#8a2a2a"],
    ["#3a1c1c", "#7a2a2a", "#e8dcb4", "#2f5a3a"],
    ["#1a2438", "#2c4a7a", "#e8d48a", "#c8a43c"],
    ["#161616", "#8a2a2a", "#e8dcb4", "#1f3d2c"]
];

/** The narrowboat's beam and its model's length (it is stretched along its length to the mooring's boat). */
export const NARROWBOAT_BEAM = 2.08;
export const NARROWBOAT_LENGTH = 15;

const NARROWBOAT_DRAUGHT = -0.55;
const NARROWBOAT_FREEBOARD = 0.52;

/** The narrowboat's hull: straight sides from the stern to 2.6 m short of the bow, then tapering to the stem. */
export function narrowboatStations(): Station[] {
    const st = (z: number, half: number): Station => ({z, deck: half, keel: half * 0.96, top: NARROWBOAT_FREEBOARD, bottom: NARROWBOAT_DRAUGHT});
    const L = NARROWBOAT_LENGTH;
    const beam = NARROWBOAT_BEAM;
    return [st(-L / 2, beam / 2 - 0.12), st(-L / 2 + 0.8, beam / 2), st(L / 2 - 2.6, beam / 2), st(L / 2 - 1.2, beam / 2 - 0.35), st(L / 2, 0.06)];
}

/**
 * A canal narrowboat (lane GC; its hull rebuilt in graphics pass 1): 15 m long along +z (bow), 2.08 m beam, waterline at
 * its origin: a black hull with a painted band and coach lines, the cabin with its windows and portholes, a grey roof
 * with a chimney, a water can and plant pots, the open well deck at the bow, the stern counter with its tiller.
 */
export function narrowboatGeometry(livery: [string, string, string, string]): BufferGeometry {
    const g = new Geo();
    const f: Frame = {x: 0, y: 0, z: 0, rot: 0};
    const [hullHex, cabinHex, lineHex, panelHex] = livery;
    const black = tone("#161616");
    const hullColour = tone(hullHex);
    const cabin = tone(cabinHex);
    const line = tone(lineHex);
    const panel = tone(panelHex);
    const roof = tone("#5a5c5a");
    const glass = tone("#1e2a30");
    const beam = NARROWBOAT_BEAM;
    const L = NARROWBOAT_LENGTH;
    // The hull: straight sides from the stern to 2.6 m short of the bow, then tapering to the stem; 0.55 m of draught,
    // 0.52 m of freeboard (a narrowboat sits low: its gunwale a hand's breadth over a foot above the water).
    const bottom = NARROWBOAT_DRAUGHT;
    const top = NARROWBOAT_FREEBOARD;
    hull(g, narrowboatStations(), [[-2, 0.05, black], [0.05, 0.12, tone("#2a2a2a")], [0.12, 0.4, hullColour], [0.4, 0.46, line], [0.46, 2, hullColour]], tone("#3a3a38"));
    // The stern counter and the rudder and tiller.
    g.box(f, 0, top, -L / 2 + 0.4, 0.1, 1.0, 0.1, tone("#b8963c"));
    g.box(f, 0, top + 1.0, -L / 2 + 0.75, 0.06, 0.06, 0.8, tone("#b8963c"));
    g.box(f, 0, bottom + 0.05, -L / 2 - 0.31, 0.06, 0.9, 0.6, black);
    // The cabin: from the stern deck to the well deck, a little narrower than the hull.
    const c0 = -L / 2 + 1.4;
    const c1 = L / 2 - 2.9;
    const cw = beam - 0.2;
    g.box(f, 0, top, (c0 + c1) / 2, cw, 1.12, c1 - c0, cabin);
    // Panels (a second colour), coach lines round them, and the windows and portholes along both sides: each layer's
    // face 2 cm proud of the one under it, its back sunk into that one (never a face in another's plane: at half a
    // centimetre apart they fought with the cabin side from the towpath's distance).
    for (const side of [-1, 1]) {
        for (let z = c0 + 1.0; z < c1 - 0.8; z += 2.6) {
            g.box(f, side * (cw / 2 + 0.015), top + 0.32, z + 0.9, 0.02, 0.6, 1.9, line);
            g.box(f, side * (cw / 2 + 0.0275), top + 0.36, z + 0.9, 0.035, 0.52, 1.8, panel);
            g.box(f, side * (cw / 2 + 0.0405), top + 0.5, z + 0.3, 0.049, 0.36, 0.5, glass);
            g.cylinder({x: side * (cw / 2 + 0.02), y: top + 0.62, z: z + 1.5, rot: Math.PI / 2}, 0, 0, 0, 0.11, 0.11, 0.04, tone("#c8a43c"), 8);
        }
    }
    // The roof: grey, a hand rail along each edge, a chimney with its collar, a water can, plant pots, a pole.
    g.box(f, 0, top + 1.12, (c0 + c1) / 2, cw + 0.06, 0.05, c1 - c0 + 0.06, roof);
    for (const side of [-1, 1]) g.box(f, side * (cw / 2 - 0.08), top + 1.17, (c0 + c1) / 2, 0.04, 0.05, c1 - c0 - 0.4, tone("#b8963c"));
    g.cylinder(f, 0.35, top + 1.17, c1 - 1.2, 0.08, 0.08, 0.55, black, 8);
    g.cylinder(f, 0.35, top + 1.6, c1 - 1.2, 0.11, 0.11, 0.06, tone("#b8963c"), 8);
    g.box(f, -0.35, top + 1.17, c0 + 3.0, 0.3, 0.32, 0.45, tone("#2f6a3a"));
    for (const [lx, lz, colour] of [[-0.4, c0 + 6.2, "#a84a2a"], [0.4, c0 + 6.9, "#a84a2a"]] as const) {
        g.cylinder(f, lx, top + 1.17, lz, 0.14, 0.11, 0.2, tone(colour), 7);
        g.blob(lx, top + 1.48, lz, 0.2, 0.16, 0.2, tone("#4a7a30"), Math.round(lz * 13), 0);
    }
    g.cylinder(f, 0, top + 1.17, c0 + 4.5, 0.03, 0.03, 1.8, tone("#8a6a48"), 5);
    // The well deck's front bulkhead and the bow's cratch board.
    g.box(f, 0, top, c1 + 1.3, 0.8, 0.9, 0.06, cabin);
    return g.toGeometry();
}

/** How each boat rocks (m and rad): the harbour's on the sea's swell, the canal's on still water. */
export const BOB = {harbour: {heave: 0.05, roll: 0.025, pitch: 0.01}, canal: {heave: 0.012, roll: 0.006, pitch: 0.002}} as const;

/**
 * The floating material: the town's prop material, its instances lifted by the sea's level (`harbour`: the harbour's
 * water rides the tide; the canal's is held by the lock) and rocked a few centimetres and a degree or so, each boat on
 * its own phase (from where it lies), on the shared clock. The model's waterline is its y = 0.
 */
export function floatingMaterial(base: MeshStandardMaterial, harbour: boolean): MeshStandardMaterial {
    const material = base;
    const bob = harbour ? BOB.harbour : BOB.canal;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.arkTime = ARK_TIME;
        shader.uniforms.boatSea = harbour ? ARK_ENV.seaLevel : {value: 0};
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float arkTime;\nuniform float boatSea;").replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
#ifdef USE_INSTANCING
{
    float boatScale = max(length(instanceMatrix[1].xyz), 1e-3);
    float phase = dot(instanceMatrix[3].xz, vec2(0.37, 0.61));
    float heave = ${bob.heave.toFixed(4)} * sin(arkTime * 1.1 + phase);
    float roll = ${bob.roll.toFixed(4)} * sin(arkTime * 0.83 + phase * 1.7);
    float pitch = ${bob.pitch.toFixed(4)} * sin(arkTime * 0.61 + phase * 2.3);
    transformed.y += (boatSea + heave) / boatScale + transformed.x * roll + transformed.z * pitch;
}
#endif`
        );
    };
    const previousKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${previousKey()}|town-boat:${harbour ? 1 : 0}`;
    material.needsUpdate = true;
    return material;
}

// MARK: - Where a narrowboat lies

/** A canal wall's face toward the water (m from the canal's middle: `render/scenery.ts` walls), less a fender's gap. */
export const CANAL_BERTH = CANAL_WIDTH / 2 - 0.15 - 0.12;

export type Berth = {x: number; z: number; turn: number; length: number};

/** The points round a narrowboat's hull at a berth (each side, every metre, stem to stern). */
export function hullOutline(b: Berth, beam = NARROWBOAT_BEAM): Pt[] {
    const out: Pt[] = [];
    const dx = Math.sin(b.turn);
    const dz = Math.cos(b.turn);
    const n = Math.max(2, Math.ceil(b.length));
    for (let k = 0; k <= n; k++) {
        const along = -b.length / 2 + (b.length * k) / n;
        for (const side of [-1, 1]) out.push({x: b.x + dx * along + dz * side * (beam / 2), z: b.z + dz * along - dx * side * (beam / 2)});
    }
    return out;
}

/**
 * A narrowboat's berth along the canal, fitted to it: laid along the canal's chord over its length (not its tangent at
 * the middle, which on a bend swung the bow into the wall), as near its own side's wall as the hull clears it (by the
 * fender's gap) all along, and shortened if even the middle of the canal will not take it.
 */
export function canalBerth(m: {x: number; z: number; length: number}): Berth {
    const total = polylineLength(CANAL);
    const near = polylineNearest(CANAL, m.x, m.z);
    // (Which side the plan moored it: left of the canal's direction is +.)
    const side = Math.sign(-near.dir.z * (m.x - near.point.x) + near.dir.x * (m.z - near.point.z)) || 1;
    let length = m.length;
    for (let tries = 0; tries < 8; tries++) {
        const a0 = Math.max(near.along - length / 2, 0);
        const a1 = Math.min(near.along + length / 2, total);
        const p0 = polylineAt(CANAL, a0).point;
        const p1 = polylineAt(CANAL, a1).point;
        const turn = Math.atan2(p1.x - p0.x, p1.z - p0.z);
        const mid = polylineAt(CANAL, (a0 + a1) / 2);
        // The chord's middle, then out toward its wall in steps, keeping the last that fits.
        const cx = (p0.x + p1.x) / 2;
        const cz = (p0.z + p1.z) / 2;
        const nx = -mid.dir.z * side;
        const nz = mid.dir.x * side;
        let best: Berth | null = null;
        for (let off = 0; off <= CANAL_BERTH; off += 0.05) {
            const b = {x: cx + nx * off, z: cz + nz * off, turn, length};
            if (!hullFits(b)) break;
            best = b;
        }
        if (best) return best;
        length -= 1.5;
    }
    return {x: m.x, z: m.z, turn: 0, length: 0};
}

/** Whether a hull at a berth is inside the canal's walls (by the fender's gap) all round. */
export function hullFits(b: Berth): boolean {
    return hullOutline(b).every((p) => polylineNearest(CANAL, p.x, p.z).distance <= CANAL_BERTH);
}
