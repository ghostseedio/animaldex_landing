/**
 * The aquarium hall drawn (graphics pass 2, lane AQUA; the layout and the owner's words: `islands/town/aquarium-hall.ts`).
 *
 * One building over both aquarium plots: pale walls with teal pilasters, a glass front onto the visitors' porch, and a
 * glazed barrel vault on steel ribs over the whole hall, so the camera sees into the tanks from above and from the
 * path; its walls and ribs are cut away as the camera comes close (`displays.ts` cutawayMaterial), like every zoo house.
 * Inside, each tank's glass, its water's volume (tinted by its kind, lit from within), its sand, and its rockwork:
 * the fractured boulders of the island's own rocks stacked into reefs and banks along its back, with caves (a hollow
 * between two cheeks under a roof slab, dark inside) and arches, corals and sea fans on the reef, kelp in the ocean's
 * corner, roots and river plants on the tunnel's banks. What lies under water is drawn with the sun's caustics playing
 * on what faces up (`underwaterMaterial`).
 *
 * All of it goes into the zoo houses' few merged meshes (`render/zoo-houses.ts`): the cut shell, the inside, the lit
 * panels, the water, the glass, plus one for what lies under water. Pure in the plan.
 */

import {Color, MeshStandardMaterial} from "three";
import {hashText, rng, type Box} from "@/ark-scene/islands/town/geom";
import type {AquariumHall, HallTank} from "@/ark-scene/islands/town/aquarium-hall";
import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";
import {interiorMaterial} from "@/ark-scene/islands/town/render/displays";
import {ARK_TIME} from "@/ark-scene/glsl";

type RGB = [number, number, number];
export type HallParts = {inside: Geo; under: Geo; glow: Geo; glass: Geo; water: Geo};
type Range = {from: number; to: number; x: number; y: number; z: number; h: number};

const WALL = tone("#e9eef0");
const PILASTER = tone("#2f7f8f");
const BAND = tone("#25606c");
const STEEL = tone("#3a4448");
const SALT = tone("#1f68b8");
const FRESH = tone("#3a9480");
const JELLY = tone("#4a3a9a");
const SAND = tone("#d6c08a");
const GRAVEL = tone("#8a8276");
const STAND = tone("#1e2428");
const ROCK_SALT = ["#b9a48c", "#a8907a", "#c4b29a", "#8f7c6a"].map((h) => tone(h));
const ROCK_FRESH = ["#6e6a5e", "#7c766a", "#5e5a50"].map((h) => tone(h));
const CORAL = ["#e8604a", "#f0a040", "#c058a8", "#e8d060", "#ff7f8a", "#7fd0c0", "#9a70d8"].map((h) => tone(h));
const PORCH = 1.2;
const WALL_T = 0.3;

function frameOf(b: Box, y: number): Frame {
    return {x: b.x, y, z: b.z, rot: b.rot};
}

/** The hall's shell into the cut geometry: walls, pilasters, the front's mullions and canopy, the vault's ribs. */
export function hallShell(geo: Geo, hall: AquariumHall, ranges: Range[]) {
    const f = hall.frame;
    const fr = frameOf(f.box, f.floor);
    const w = f.box.w;
    const d = f.box.d;
    const h = f.height;
    const from = geo.pos.length / 3;
    const t = WALL_T;
    const front = d / 2 - PORCH;
    const inside = front + d / 2;
    // The back and the two ends, a teal band at their foot and a cornice at their top.
    geo.box(fr, 0, 0, -d / 2 + t / 2, w, h, t, WALL);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - t / 2), 0, -d / 2 + inside / 2, t, h, inside, WALL);
    geo.box(fr, 0, 0, -d / 2 + t / 2 - 0.03, w + 0.06, 1.1, t, BAND);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - t / 2 + 0.03), 0, -d / 2 + inside / 2, t, 1.1, inside + 0.06, BAND);
    // (The cornice: 20 cm deep, 8 cm proud of the wall and 2 cm over its top, so it shares no plane with it.)
    geo.box(fr, 0, h - 0.6, -d / 2 + 0.02, w + 0.1, 0.62, 0.2, PILASTER);
    for (const side of [-1, 1]) geo.box(fr, side * (w / 2 - 0.02), h - 0.6, -d / 2 + inside / 2, 0.2, 0.62, inside + 0.1, PILASTER);
    // Pilasters outside the back and the ends, every ~4 m (they give the long walls a rhythm from the path and the air).
    const n = Math.max(2, Math.round(w / 4.2));
    for (let k = 0; k <= n; k++) geo.box(fr, -w / 2 + (k * w) / n, 1.12, -d / 2 - 0.08, 0.5, h - 1.74, 0.18, PILASTER);
    for (const side of [-1, 1]) {
        const m = Math.max(2, Math.round(inside / 4.2));
        for (let k = 0; k <= m; k++) geo.box(fr, side * (w / 2 + 0.08), 1.12, -d / 2 + (k * inside) / m, 0.18, h - 1.74, 0.5, PILASTER);
    }
    // The front: a base under the glass, tall mullions, a transom at 4.5 m, the lintel, the canopy and the sign.
    geo.box(fr, 0, 0, front - t / 2 + 0.01, w - 0.02, 0.35, t + 0.02, BAND);
    const bays = Math.max(1, Math.round((w - 2 * t) / 2.8));
    for (let k = 0; k <= bays; k++) geo.box(fr, -w / 2 + t + (k * (w - 2 * t)) / bays, 0.35, front - t / 2, 0.16, h - 1.0, 0.18, STEEL);
    geo.box(fr, 0, 4.5, front - t / 2, w - 2 * t - 0.02, 0.16, 0.2, STEEL);
    geo.box(fr, 0, h - 0.65, front - t / 2, w, 0.65, t, WALL);
    geo.box(fr, 0, h - 0.64, front + PORCH / 2, w + 0.06, 0.15, PORCH + 0.4, PILASTER);
    geo.box(fr, 0, 4.0, front + PORCH / 2, Math.min(w * 0.6, 16), 0.12, PORCH + 0.2, PILASTER);
    geo.box(fr, 0, h - 0.5, front + 0.03, Math.min(9, w * 0.35), 0.9, 0.08, tone("#e2c86a"));
    // A wave frieze on the sign band (three blue swells).
    for (let k = -1; k <= 1; k++) geo.box(fr, k * 1.6, h - 0.35, front + 0.08, 1.1, 0.35, 0.04, tone("#2f7fbf"));
    // The vault's ribs: steel arches across the hall's depth every ~3 m, and a ridge beam.
    const rr = inside / 2;
    const zc = -PORCH / 2;
    const ribs = Math.max(3, Math.round(w / 3));
    const segs = 10;
    for (let k = 0; k <= ribs; k++) {
        const x = -w / 2 + 0.1 + (k * (w - 0.2)) / ribs;
        for (let i = 0; i < segs; i++) {
            const a0 = (i / segs) * Math.PI;
            const a1 = ((i + 1) / segs) * Math.PI;
            const p0 = {y: h + Math.sin(a0) * rr * 0.5, z: zc + Math.cos(a0) * rr};
            const p1 = {y: h + Math.sin(a1) * rr * 0.5, z: zc + Math.cos(a1) * rr};
            // (Two faces, inner and outer, 18 cm wide, 12 cm deep: double-sided in the cut material.)
            for (const dy of [0, 0.12]) geo.quad(at(fr, x - 0.09, p0.y + dy, p0.z), at(fr, x + 0.09, p0.y + dy, p0.z), at(fr, x + 0.09, p1.y + dy, p1.z), at(fr, x - 0.09, p1.y + dy, p1.z), STEEL);
        }
    }
    geo.box(fr, 0, h + rr * 0.5 + 0.02, zc, w, 0.16, 0.22, STEEL);
    ranges.push({from, to: geo.pos.length / 3, x: f.box.x, y: f.floor, z: f.box.z, h: h + rr * 0.5 + 1});
}

/** The vault's glass and the front's glazing. */
function hallGlass(glass: Geo, hall: AquariumHall) {
    const f = hall.frame;
    const fr = frameOf(f.box, f.floor);
    const w = f.box.w;
    const d = f.box.d;
    const h = f.height;
    const inside = d - PORCH;
    const rr = inside / 2;
    const zc = -PORCH / 2;
    const c = tone("#a8c8cc");
    const segs = 10;
    for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI;
        const a1 = ((i + 1) / segs) * Math.PI;
        const y0 = h + 0.06 + Math.sin(a0) * rr * 0.5;
        const y1 = h + 0.06 + Math.sin(a1) * rr * 0.5;
        const z0 = zc + Math.cos(a0) * rr;
        const z1 = zc + Math.cos(a1) * rr;
        glass.quad(at(fr, -w / 2, y0, z0), at(fr, w / 2, y0, z0), at(fr, w / 2, y1, z1), at(fr, -w / 2, y1, z1), c);
    }
    // The vault's two ends (half-discs over the end walls).
    for (const side of [-1, 1]) {
        for (let i = 0; i < segs; i++) {
            const a0 = (i / segs) * Math.PI;
            const a1 = ((i + 1) / segs) * Math.PI;
            glass.tri(at(fr, side * w / 2, h, zc), at(fr, side * w / 2, h + Math.sin(a0) * rr * 0.5, zc + Math.cos(a0) * rr), at(fr, side * w / 2, h + Math.sin(a1) * rr * 0.5, zc + Math.cos(a1) * rr), c);
        }
    }
    const front = d / 2 - PORCH - WALL_T / 2;
    const hw = w / 2 - WALL_T;
    glass.quad(at(fr, -hw, 0.35, front), at(fr, hw, 0.35, front), at(fr, hw, h - 0.65, front), at(fr, -hw, h - 0.65, front), tone("#dcebe6"));
}

/** The hall's plinth, floor, porch and the planting by its doors. */
function hallFloor(geo: Geo, hall: AquariumHall) {
    const f = hall.frame;
    const fr = frameOf(f.box, f.floor);
    geo.box(fr, 0, -1.6, 0, f.box.w + 0.1, 1.6, f.box.d + 0.1, tone("#8e877a"), 0, {top: tone("#2e3a42")});
    geo.box(fr, 0, 0, f.box.d / 2 - PORCH / 2, f.box.w, 0.02, PORCH, tone("#b9b2a4"));
    // A blue-lit strip along the visitors' aisles (the hall's floor between the tanks).
    const inner = frameOf(f.inner, f.floor);
    geo.box(inner, 0, 0, f.inner.d / 2 - 0.25, f.inner.w - 0.4, 0.015, 0.12, tone("#3f8fb8"));
    const q = rng(hashText("aquarium-hall-plants"));
    for (const side of [-1, 1]) {
        for (const off of [0.6, 3.2]) {
            const p = at(fr, side * (f.box.w / 2 - off), 0, f.box.d / 2 - PORCH + 0.3);
            geo.bush(p[0], f.floor + 0.6 + q() * 0.4, p[2], 0.55, 1.0, 0.4, tone("#4f7a3a"), hashText(`aqhall-b${side}${off}`));
        }
    }
}

// MARK: - Tanks

const P = (fr: Frame, lx: number, y: number, lz: number): V3 => at(fr, lx, y, lz);

/** A box tank's glass (four sides) and water (its top and sides), from `y0` to its glass's and water's tops. */
function boxGlassAndWater(t: HallTank, parts: HallParts, y0: number, tint: RGB) {
    const g = t.glass;
    const fr = frameOf(g, 0);
    const hw = g.w / 2;
    const hd = g.d / 2;
    const gt = t.glassTop;
    const glass = tone("#dcebe6");
    parts.glass.quad(P(fr, -hw, y0, hd), P(fr, hw, y0, hd), P(fr, hw, gt, hd), P(fr, -hw, gt, hd), glass);
    parts.glass.quad(P(fr, hw, y0, -hd), P(fr, -hw, y0, -hd), P(fr, -hw, gt, -hd), P(fr, hw, gt, -hd), glass);
    parts.glass.quad(P(fr, hw, y0, hd), P(fr, hw, y0, -hd), P(fr, hw, gt, -hd), P(fr, hw, gt, hd), glass);
    parts.glass.quad(P(fr, -hw, y0, -hd), P(fr, -hw, y0, hd), P(fr, -hw, gt, hd), P(fr, -hw, gt, -hd), glass);
    const ww = hw - 0.03;
    const wd = hd - 0.03;
    const y1 = t.tank.top;
    parts.water.quad(P(fr, -ww, y1, wd), P(fr, ww, y1, wd), P(fr, ww, y1, -wd), P(fr, -ww, y1, -wd), tint);
    parts.water.quad(P(fr, -ww, y0, wd), P(fr, ww, y0, wd), P(fr, ww, y1, wd), P(fr, -ww, y1, wd), tint);
    parts.water.quad(P(fr, ww, y0, -wd), P(fr, -ww, y0, -wd), P(fr, -ww, y1, -wd), P(fr, ww, y1, -wd), tint);
    parts.water.quad(P(fr, ww, y0, wd), P(fr, ww, y0, -wd), P(fr, ww, y1, -wd), P(fr, ww, y1, wd), tint);
    parts.water.quad(P(fr, -ww, y0, -wd), P(fr, -ww, y0, wd), P(fr, -ww, y1, wd), P(fr, -ww, y1, -wd), tint);
    // The rim: a dark steel frame round the glass's top, and a light strip over the water (the light from above).
    for (const side of [-1, 1]) {
        parts.inside.box(fr, 0, gt, side * (hd + 0.04), g.w + 0.16, 0.1, 0.08, STAND);
        parts.inside.box(fr, side * (hw + 0.04), gt, 0, 0.08, 0.1, g.d + 0.16, STAND);
    }
    // (The small tanks' strip lights; the big ones are lit from above, through the vault.)
    const strips = t.look === "fresh" || t.look === "reef" ? Math.max(1, Math.round(g.d / 3)) : 0;
    for (let k = 0; k < strips; k++) parts.glow.box(fr, 0, gt + 0.12, -hd + ((k + 0.5) * g.d) / strips, g.w * 0.85, 0.04, 0.12, tone("#f4f8ff"));
}

/** A rock in the tank's frame (lx, lz), its base at `y`. */
function rockAt(geo: Geo, fr: Frame, lx: number, y: number, lz: number, sx: number, sy: number, sz: number, colour: RGB, seed: number) {
    const p = at(fr, lx, 0, lz);
    geo.rock(p[0], y - 0.05, p[2], sx, sy, sz, (seed % 628) / 100, colour, seed);
}

/** A coral head: a cluster of rounded lobes and a few branches, in one colour, on a point (base `y`). */
function coralAt(geo: Geo, fr: Frame, lx: number, y: number, lz: number, size: number, colour: RGB, seed: number) {
    const r = rng(seed);
    const p = at(fr, lx, 0, lz);
    if (seed % 3 === 0) {
        // Branching: a few short tapered sticks.
        for (let k = 0; k < 5; k++) {
            const a = r() * Math.PI * 2;
            const lean = 0.15 + r() * 0.25;
            const h = size * (0.7 + r() * 0.6);
            geo.cylinder({x: p[0] + Math.cos(a) * size * lean, y, z: p[2] + Math.sin(a) * size * lean, rot: 0}, 0, 0, 0, size * 0.09, size * 0.04, h, colour, 5, true);
        }
    } else if (seed % 3 === 1) {
        // A sea fan: a flat, broad, upright lobe.
        const turn = r() * Math.PI;
        geo.blob(p[0], y + size * 0.55, p[2], size * 0.6 * Math.abs(Math.cos(turn)) + size * 0.06, size * 0.55, size * 0.6 * Math.abs(Math.sin(turn)) + size * 0.06, colour, seed, 0);
    } else {
        // A brain or boulder coral: a squat lobed dome.
        geo.blob(p[0], y + size * 0.2, p[2], size * 0.5, size * 0.32, size * 0.5, colour, seed, 1);
    }
}

/** A river plant: a clump of long leaves (tall narrow lobes leaning out from its foot), in three greens. */
function plant(geo: Geo, fr: Frame, lx: number, y: number, lz: number, tall: number, seed: number) {
    const r = rng(seed);
    const p = at(fr, lx, 0, lz);
    const n = 5 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + r() * 0.5;
        const h = tall * (0.6 + r() * 0.4);
        const lean = h * 0.18;
        geo.blob(p[0] + Math.cos(a) * lean, y + h * 0.5, p[2] + Math.sin(a) * lean, 0.05 + r() * 0.04, h * 0.5, 0.05 + r() * 0.04, tone(["#3f8a3a", "#5aa040", "#2f6a30", "#6aaa48"][j % 4]), seed + j * 31, 0);
    }
}

/** A cave: the hollow between two cheeks under a roof slab, a back rock behind, a dark inside. `mx`,`mz`: its mouth's way. */
function caveAt(geo: Geo, fr: Frame, lx: number, lz: number, y: number, r: number, mx: number, mz: number, behind: number, colours: RGB[], seed: number) {
    // (Across the mouth: the cheeks' way.)
    const ax = -mz;
    const az = mx;
    const c = (k: number) => colours[(seed + k) % colours.length];
    // The back: a big rock behind the hollow, taller than it, short of the glass behind (`behind`: the room there).
    rockAt(geo, fr, lx - mx * behind * 0.55, y, lz - mz * behind * 0.55, r * 1.7, r * 2.3, behind * 0.42, c(0), seed);
    // The cheeks, either side of the mouth.
    for (const side of [-1, 1]) rockAt(geo, fr, lx + ax * side * r * 1.35 + mx * r * 0.2, y, lz + az * side * r * 1.35 + mz * r * 0.2, r * 0.75, r * 1.65, r * 1.0, c(side + 2), seed + side * 7);
    // The roof: a slab over the hollow, from cheek to cheek.
    rockAt(geo, fr, lx + mx * r * 0.15, y + r * 1.45, lz + mz * r * 0.15, r * 2.1, r * 0.75, r * 1.25, c(1), seed + 13);
    // The dark inside: a deep blue-black wall at the hollow's back, under the roof.
    const b0 = at(fr, lx - mx * r * 0.55 - ax * r, 0, lz - mz * r * 0.55 - az * r);
    const b1 = at(fr, lx - mx * r * 0.55 + ax * r, 0, lz - mz * r * 0.55 + az * r);
    const dark = tone("#0e1a24");
    geo.quad([b0[0], y, b0[2]], [b1[0], y, b1[2]], [b1[0], y + r * 1.5, b1[2]], [b0[0], y + r * 1.5, b0[2]], dark);
    geo.quad([b1[0], y, b1[2]], [b0[0], y, b0[2]], [b0[0], y + r * 1.5, b0[2]], [b1[0], y + r * 1.5, b1[2]], dark);
}

/** A tank's rockwork band: boulders stacked along it (taller toward the back, some reaching up as pillars), its caves, corals or plants. */
function rockwork(t: HallTank, geo: Geo) {
    const tank = t.tank;
    const fr = frameOf(t.glass, 0);
    const salt = tank.kind === "salt";
    const colours = salt ? ROCK_SALT : ROCK_FRESH;
    const water = tank.top - t.sand;
    const r = rng(hashText(`${tank.id}|rockwork`));
    const hw = t.glass.w / 2;
    const hd = t.glass.d / 2;
    for (const band of t.bands) {
        const alongX = band.side === "back" || band.side === "front";
        const along = alongX ? t.glass.w : t.glass.d;
        const inward = band.side === "back" ? {x: 0, z: 1} : band.side === "front" ? {x: 0, z: -1} : band.side === "left" ? {x: 1, z: 0} : {x: -1, z: 0};
        const edge = (u: number, depth: number) => (alongX ? {x: u, z: (band.side === "back" ? -hd : hd) + inward.z * depth} : {x: (band.side === "left" ? -hw : hw) + inward.x * depth, z: u});
        // The reef's mass: boulders along the band, two rows, the back row tall.
        const size = Math.min(band.depth * 0.6, 1.2);
        const count = Math.max(3, Math.round(along / (size * 1.1)));
        for (let k = 0; k < count; k++) {
            const u = -along / 2 + ((k + 0.5) * along) / count + (r() - 0.5) * size * 0.4;
            const back = edge(u, size * 0.55);
            const tall = Math.min(water * (0.25 + r() * 0.35), size * (1.6 + r() * 1.6));
            rockAt(geo, fr, back.x, t.sand, back.z, size * (0.7 + r() * 0.3), tall, size * 0.5, colours[k % colours.length], hashText(`${tank.id}b${k}`));
            if (r() < 0.6) {
                const front = edge(u + (r() - 0.5) * size, band.depth * 0.75);
                rockAt(geo, fr, front.x, t.sand, front.z, size * 0.5, size * (0.5 + r() * 0.5), size * 0.4, colours[(k + 1) % colours.length], hashText(`${tank.id}f${k}`));
            }
            // Corals on the reef (salt) or plants (fresh) on and among the rocks.
            if (salt && r() < 0.85) {
                const on = edge(u + (r() - 0.5) * size, size * (0.3 + r() * 0.6));
                coralAt(geo, fr, on.x, t.sand + Math.min(tall * (0.4 + r() * 0.6), water * 0.5), on.z, Math.min(0.25 + r() * 0.5, water * 0.15), CORAL[k % CORAL.length], hashText(`${tank.id}c${k}`));
            } else if (!salt && r() < 0.8) {
                const on = edge(u + (r() - 0.5) * size, band.depth * (0.4 + r() * 0.5));
                plant(geo, fr, on.x, t.sand, on.z, Math.min(water * (0.3 + r() * 0.4), 1.6), hashText(`${tank.id}pl${k}`));
            }
        }
        // An arch: two pillars and a lintel, standing out into the band's front edge (fish pass under it).
        if (along > 6) {
            const u = (r() - 0.5) * along * 0.4;
            const s = Math.min(band.depth * 0.5, 0.8);
            const a = edge(u - s * 1.8, band.depth * 0.6);
            const b = edge(u + s * 1.8, band.depth * 0.6);
            const pillar = Math.min(water * 0.45, s * 4);
            rockAt(geo, fr, a.x, t.sand, a.z, s * 0.6, pillar, s * 0.6, colours[1], hashText(`${tank.id}arch-a`));
            rockAt(geo, fr, b.x, t.sand, b.z, s * 0.6, pillar, s * 0.6, colours[2], hashText(`${tank.id}arch-b`));
            const mid = edge(u, band.depth * 0.6);
            rockAt(geo, fr, mid.x, t.sand + pillar * 0.85, mid.z, s * 2.6, s * 0.7, s * 0.7, colours[0], hashText(`${tank.id}arch-l`));
        }
    }
    // The caves (the layout's, where the residents hide): each with its rocks round it.
    for (const cave of tank.caves ?? []) {
        // (Its mouth's way, tank-local: from the tank's turn.)
        const dx = Math.sin(cave.mouth);
        const dz = Math.cos(cave.mouth);
        const c = Math.cos(tank.rot);
        const s = Math.sin(tank.rot);
        const mx = dx * c + dz * s;
        const mz = -dx * s + dz * c;
        // (The cave's inside is tank-local about the swim box's own middle: the glass's middle is the tank's.)
        const behind = Math.min(t.glass.w / 2 - Math.abs(cave.lx) + (Math.abs(mx) < 0.5 ? 9 : 0), t.glass.d / 2 - Math.abs(cave.lz) + (Math.abs(mz) < 0.5 ? 9 : 0)) - 0.04;
        caveAt(geo, fr, cave.lx, cave.lz, cave.y, cave.r, mx, mz, behind, colours, hashText(`${tank.id}|${cave.lx.toFixed(2)}|${cave.lz.toFixed(2)}`) % 997);
    }
    // The sand's scatter: pebbles, shells and small corals over the open floor, low (the swimmers pass over them).
    const scatter = Math.round((t.glass.w * t.glass.d) / (salt ? 7 : 8));
    for (let k = 0; k < scatter; k++) {
        const lx = (r() - 0.5) * (t.glass.w - 0.4);
        const lz = (r() - 0.5) * (t.glass.d - 0.4);
        const size = Math.min(0.06 + r() * 0.14, water * 0.05);
        const p = at(fr, lx, 0, lz);
        if (salt && r() < 0.25) coralAt(geo, fr, lx, t.sand, lz, size * 2.2, CORAL[k % CORAL.length], hashText(`${tank.id}s${k}`) * 3 + 2);
        else rockAt(geo, fr, lx, t.sand, lz, size * 1.4, size * 0.9, size * 1.1, colours[k % colours.length], hashText(`${tank.id}p${k}`));
    }
}

/** The ocean's kelp: tall olive ribbons in its far corner, swaying in place (drawn still; the water moves round them). */
function kelp(t: HallTank, geo: Geo) {
    const fr = frameOf(t.glass, 0);
    const r = rng(hashText(`${t.tank.id}|kelp`));
    const water = t.tank.top - t.sand;
    const hw = t.glass.w / 2;
    const hd = t.glass.d / 2;
    for (let k = 0; k < 14; k++) {
        const lx = -hw + 0.4 + r() * 2.4;
        const lz = -hd + 1.6 + r() * (t.glass.d * 0.55);
        const tall = water * (0.55 + r() * 0.35);
        const segs = 6;
        let prev = at(fr, lx, t.sand, lz);
        let prevTurn = r() * Math.PI;
        for (let i = 1; i <= segs; i++) {
            const y = t.sand + (tall * i) / segs;
            const bend = Math.sin(i * 0.9 + k) * 0.6 * (i / segs);
            const p = at(fr, lx + bend, y, lz + bend * 0.5);
            // (Each blade twists a little up the frond, widest in its middle, so it never reads as a flat bar.)
            const turn = prevTurn + 0.6 + r() * 0.5;
            const wide = 0.12 + 0.22 * Math.sin((Math.PI * i) / (segs + 1));
            const colour = tone(i % 2 ? "#9a8a2a" : "#b0a03a");
            const a0 = [Math.cos(prevTurn) * wide, Math.sin(prevTurn) * wide];
            const a1 = [Math.cos(turn) * wide, Math.sin(turn) * wide];
            geo.quad([prev[0] - a0[0], prev[1], prev[2] - a0[1]], [prev[0] + a0[0], prev[1], prev[2] + a0[1]], [p[0] + a1[0], p[1], p[2] + a1[1]], [p[0] - a1[0], p[1], p[2] - a1[1]], colour);
            geo.quad([prev[0] + a0[0], prev[1], prev[2] + a0[1]], [prev[0] - a0[0], prev[1], prev[2] - a0[1]], [p[0] - a1[0], p[1], p[2] - a1[1]], [p[0] + a1[0], p[1], p[2] + a1[1]], colour);
            prev = p;
            prevTurn = turn;
        }
    }
}

/** The river tunnel: rock banks along its sides from the hall's floor to its swim floor, the walkway between under glass. */
function tunnel(t: HallTank, parts: HallParts) {
    const g = t.glass;
    const fr = frameOf(g, 0);
    const floor = t.tank.floor;
    const hw = g.w / 2;
    const hd = g.d / 2;
    const walk = 2.3;
    const bank = (g.w - walk) / 2;
    const r = rng(hashText(`${t.tank.id}|banks`));
    // The banks: a dark core under boulders on their faces; their tops are the river's bed (gravel), with roots and plants.
    for (const side of [-1, 1]) {
        const cx = side * (hw - bank / 2);
        parts.under.box(fr, cx, t.sand, 0, bank, floor - t.sand - 0.05, g.d, tone("#4a463e"));
        parts.under.box(fr, cx, floor - 0.08, 0, bank, 0.1, g.d, GRAVEL);
        const n = Math.round(g.d / 0.9);
        for (let k = 0; k < n; k++) {
            const lz = -hd + ((k + 0.5) * g.d) / n;
            rockAt(parts.under, fr, side * (walk / 2 + 0.15), t.sand, lz, 0.35, (floor - t.sand) * (0.75 + r() * 0.3), 0.5, ROCK_FRESH[k % 3], hashText(`${t.tank.id}bank${side}${k}`));
        }
        // On the bed: rocks, a sunken root or log, river plants.
        for (let k = 0; k < Math.round(g.d / 1.6); k++) {
            const lz = -hd + 0.6 + r() * (g.d - 1.2);
            const lx = side * (hw - 0.3 - r() * (bank - 0.5));
            if (r() < 0.35) {
                const p = at(fr, lx, 0, lz);
                parts.under.box({x: p[0], y: floor, z: p[2], rot: g.rot + (r() - 0.5) * 1.2}, 0, 0, 0, 0.18, 0.18, 1.4 + r(), tone("#4a3a2a"));
            } else if (r() < 0.6) rockAt(parts.under, fr, lx, floor, lz, 0.2 + r() * 0.2, 0.2 + r() * 0.3, 0.2 + r() * 0.2, ROCK_FRESH[k % 3], hashText(`${t.tank.id}bed${side}${k}`));
            else plant(parts.under, fr, lx, floor, lz, Math.min(0.5 + r() * 0.9, t.tank.top - floor - 0.3), hashText(`${t.tank.id}pl${side}${k}`));
        }
    }
    // The walkway: a dark floor with a blue light strip down it, its glass roof at the river's bed, steel hoops every 2 m.
    parts.inside.box(fr, 0, t.sand - 0.15, 0, walk, 0.02, g.d, tone("#1e2a34"));
    parts.glow.box(fr, 0, t.sand - 0.12, 0, 0.12, 0.01, g.d * 0.96, tone("#5fb4e8"));
    parts.glass.quad(P(fr, -walk / 2, floor, hd), P(fr, walk / 2, floor, hd), P(fr, walk / 2, floor, -hd), P(fr, -walk / 2, floor, -hd), tone("#dcebe6"));
    for (let lz = -hd + 1; lz < hd; lz += 2) {
        for (const side of [-1, 1]) parts.inside.box(fr, side * (walk / 2 - 0.04), t.sand - 0.15, lz, 0.08, floor - t.sand + 0.15, 0.08, STEEL);
        parts.inside.box(fr, 0, floor - 0.06, lz, walk, 0.06, 0.08, STEEL);
    }
    boxGlassAndWater(t, parts, floor, FRESH);
    // (The glass's lower panes, beside the banks, from the hall's floor.)
    const glass = tone("#dcebe6");
    for (const side of [-1, 1]) parts.glass.quad(P(fr, side * hw, t.sand - 0.15, -side * hd), P(fr, side * hw, t.sand - 0.15, side * hd), P(fr, side * hw, floor, side * hd), P(fr, side * hw, floor, -side * hd), glass);
}

/** The jellyfish cylinder: a round glass column, its water, a dark plinth with a violet light under it, a ring light over it. */
function cylinder(t: HallTank, parts: HallParts) {
    const g = t.glass;
    const radius = t.radius ?? g.w / 2;
    const fr = frameOf(g, 0);
    const sides = 28;
    const y0 = t.sand;
    const y1 = t.tank.top;
    const gt = t.glassTop;
    parts.inside.cylinder(fr, 0, t.sand - 0.5 - fr.y, 0, radius + 0.25, radius + 0.25, 0.5, STAND, sides);
    parts.glow.cylinder(fr, 0, y0 - 0.02, 0, radius * 0.92, radius * 0.92, 0.02, tone("#b48ce8"), sides);
    parts.inside.cylinder(fr, 0, gt, 0, radius + 0.12, radius + 0.12, 0.25, STAND, sides, false);
    parts.glow.cylinder(fr, 0, gt - 0.05, 0, radius * 0.95, radius * 0.95, 0.05, tone("#f4f8ff"), sides, false);
    for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        const g0 = P(fr, Math.cos(a0) * radius, y0, Math.sin(a0) * radius);
        const g1 = P(fr, Math.cos(a1) * radius, y0, Math.sin(a1) * radius);
        parts.glass.quad(g1, g0, [g0[0], gt, g0[2]], [g1[0], gt, g1[2]], tone("#dcebe6"));
        const wr = radius - 0.03;
        const w0 = P(fr, Math.cos(a0) * wr, y0, Math.sin(a0) * wr);
        const w1 = P(fr, Math.cos(a1) * wr, y0, Math.sin(a1) * wr);
        parts.water.quad(w1, w0, [w0[0], y1, w0[2]], [w1[0], y1, w1[2]], JELLY);
        parts.water.tri([w0[0], y1, w0[2]], P(fr, 0, y1, 0), [w1[0], y1, w1[2]], JELLY);
    }
}

/** One hall tank: its stand and sand, its rockwork and planting, its glass and water. */
function hallTank(t: HallTank, parts: HallParts, floor: number) {
    const fr = frameOf(t.glass, 0);
    const tint = t.look === "jelly" ? JELLY : t.tank.kind === "salt" ? SALT : FRESH;
    if (t.look === "tunnel") {
        tunnel(t, parts);
        return;
    }
    if (t.look === "jelly") {
        cylinder(t, parts);
        return;
    }
    // The stand (a dark cabinet to the tank's bottom), the sand on it.
    if (t.sand - 0.12 - floor > 0.02) parts.inside.box(fr, 0, floor, 0, t.glass.w + 0.24, t.sand - 0.12 - floor, t.glass.d + 0.24, STAND);
    parts.under.box(fr, 0, t.sand - 0.12, 0, t.glass.w, 0.12, t.glass.d, t.look === "fresh" ? GRAVEL : SAND);
    rockwork(t, parts.under);
    if (t.look === "ocean") kelp(t, parts.under);
    // The back light (the far side from the visitors) of the small tanks; the big ones are lit from above.
    if (t.look === "fresh" || t.look === "reef") parts.glow.box(fr, 0, t.sand, -t.glass.d / 2 + 0.02, t.glass.w * 0.98, t.tank.top - t.sand, 0.03, t.tank.kind === "salt" ? tone("#5fb4e8") : tone("#8fd4a8"));
    boxGlassAndWater(t, parts, t.sand - 0.12, tint);
}

/** The whole hall into the zoo houses' geometries (shell: cut; the rest: `parts`). */
export function buildAquariumHall(hall: AquariumHall, shell: Geo, ranges: Range[], parts: HallParts) {
    hallShell(shell, hall, ranges);
    hallFloor(parts.inside, hall);
    hallGlass(parts.glass, hall);
    for (const t of hall.tanks) hallTank(t, parts, hall.frame.floor);
}

/**
 * What lies under the hall's water: the interior's material with the sun's caustics playing on what faces up (the
 * reef's own pattern, `reef-render.ts`), cooler and dimmer with depth under its tank's surface (about 5 m to the
 * hall's deepest floor: one surface height for all, the ocean's).
 */
export function underwaterMaterial(surface: number): MeshStandardMaterial {
    const material = interiorMaterial();
    const previous = material.onBeforeCompile;
    const uniforms = {arkTime: ARK_TIME, aquaSurface: {value: surface}, aquaTint: {value: new Color("#4a8ab8")}};
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vAquaWorld;\nvarying float vAquaUp;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvAquaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAquaUp = normalize(mat3(modelMatrix) * objectNormal).y;");
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
varying vec3 vAquaWorld;
varying float vAquaUp;
uniform float arkTime;
uniform float aquaSurface;
uniform vec3 aquaTint;
float aquaCaustic(vec2 p, float t) {
    float c = 0.0;
    vec2 q = p * 1.1;
    for (int i = 0; i < 3; i++) {
        q += vec2(sin(q.y * 1.7 + t * 0.55 + float(i)), cos(q.x * 1.3 - t * 0.47 - float(i))) * 0.42;
        c += abs(sin(q.x + q.y));
    }
    return pow(1.0 - c / 3.0, 5.0) * 6.0;
}`
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
{
    float deep = clamp((aquaSurface - vAquaWorld.y) / 9.0, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * aquaTint * 1.5, 0.3 + 0.35 * deep);
    float up = clamp(vAquaUp, 0.0, 1.0);
    totalEmissiveRadiance += vec3(0.55, 0.85, 0.9) * min(aquaCaustic(vAquaWorld.xz, arkTime), 1.6) * up * 0.3 * (1.0 - 0.6 * deep);
}`
            );
    };
    const key = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${key()}|aqua-under`;
    return material;
}

/** The hall's water: deeper than a small tank's (`displays.ts` waterMaterial), so its volume reads blue from the air and the path. */
export function hallWaterMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({vertexColors: true, transparent: true, opacity: 0.46, roughness: 0.08, metalness: 0.1, depthWrite: false, emissive: new Color("#12466a"), emissiveIntensity: 0.4});
}
