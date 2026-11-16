/**
 * The downtown's lights and signs (p2 (land), 2026-11-16, the owner: "could do with a couple very tall buildings in the
 * town too and billboards with night lights and an area for a giant christmas tree with fairy lights"). The towers
 * themselves are `buildings.ts` tower; here:
 *
 * - **Billboards** on two posts at the plaza's corners and on the third tower's roof: a steel frame and backing in the
 *   chunks' solid; the face a grid of coloured cells in the town's lights (`furniture.ts` lightsMaterial, kind SIGN:
 *   shaded by day, lit from within at night as the street lamps come on), with its uplighters' lamps. The art is
 *   AnimalDex's own (its name, a paw, "Talk to animals", the Ark): no brand but the app's, nothing real advertised.
 * - **The aviation lights** on the towers' tops: steady red at night.
 * - **The Christmas tree** in the plaza (`christmasTree`): a stone ring always; in its season (15 November to 6 January,
 *   by the island clock, the same for everyone) a 16 m fir in tiers, a star, and fairy lights wound round it that
 *   twinkle after dark (kind FAIRY, each bulb its own phase), in their own small mesh the town shows only in season.
 *
 * Pure in the plan: the same for every viewer.
 */

import {townBuildingFloor} from "@/ark-scene/islands/town/ground";
import {hashText, rng, type Pt} from "@/ark-scene/islands/town/geom";
import type {Billboard, TownPlan} from "@/ark-scene/islands/town/plan";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {alongZ, SURF, tagged} from "@/ark-scene/islands/town/render/surface-tags";
import type {TownClock} from "@/ark-scene/islands/town/people";

/** The lights' kinds this module adds to `furniture.ts` LIGHT (tag = phase × 8 + kind). */
export const DOWNTOWN_LIGHT = {lamp: 0, sign: 6, fairy: 7} as const;

type V3 = [number, number, number];
type Chunks = (x: number, z: number) => {solid: Geo; decal: Geo};

// MARK: - The art (cells: one character a cell; the palette per design)

/** A 3 × 5 (or wider) pixel font for the few letters the boards use. */
const GLYPHS: Record<string, string[]> = {
    A: [".#.", "#.#", "###", "#.#", "#.#"],
    N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
    I: ["###", ".#.", ".#.", ".#.", "###"],
    M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
    L: ["#..", "#..", "#..", "#..", "###"],
    D: ["##.", "#.#", "#.#", "#.#", "##."],
    E: ["###", "#..", "##.", "#..", "###"],
    X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    R: ["##.", "#.#", "##.", "#.#", "#.#"],
    K: ["#.#", "#.#", "##.", "#.#", "#.#"],
    T: ["###", ".#.", ".#.", ".#.", ".#."],
    O: ["###", "#.#", "#.#", "#.#", "###"],
    S: ["###", "#..", "###", "..#", "###"],
    " ": ["..", "..", "..", "..", ".."]
};

/** A paw print (11 × 9): four toes over the pad. */
const PAW = ["..##...##..", "..##...##..", "...........", "##.......##", "##..###..##", "...#####...", "..#######..", "..#######..", "...##.##..."];

type Art = {cols: number; rows: number; cell: (c: number, r: number) => V3};

function textMask(text: string, scale: number): {w: number; h: number; on: (x: number, y: number) => boolean} {
    const glyphs = text.split("").map((ch) => GLYPHS[ch] ?? GLYPHS[" "]);
    const widths = glyphs.map((g) => g[0].length);
    const w = (widths.reduce((s, x) => s + x, 0) + glyphs.length - 1) * scale;
    const offsets: number[] = [];
    let x = 0;
    for (const width of widths) {
        offsets.push(x);
        x += width + 1;
    }
    return {
        w,
        h: 5 * scale,
        on: (px, py) => {
            const gx = Math.floor(px / scale);
            const gy = Math.floor(py / scale);
            if (gy < 0 || gy >= 5) return false;
            for (let i = 0; i < glyphs.length; i++) {
                const lx = gx - offsets[i];
                if (lx >= 0 && lx < widths[i]) return glyphs[i][gy][lx] === "#";
            }
            return false;
        }
    };
}

const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The boards' designs: 0 the AnimalDex paw and name, 1 the Ark at sunset, 2 "Talk to animals" (the app's own line). */
function art(design: number): Art {
    const white = tone("#f6f3ea");
    if (design === 0) {
        const cols = 45;
        const rows = 20;
        const name = textMask("ANIMALDEX", 1);
        const top = tone("#1f8a86");
        const bottom = tone("#0f4f5c");
        const paw = tone("#ffd36b");
        return {
            cols,
            rows,
            cell: (c, r) => {
                // (r counts from the top.)
                const pc = c - Math.floor((cols - 11) / 2);
                const pr = r - 1;
                if (pc >= 0 && pc < 11 && pr >= 0 && pr < 9 && PAW[pr][pc] === "#") return paw;
                const tc = c - Math.floor((cols - name.w) / 2);
                if (name.on(tc, r - 12)) return white;
                return mix(top, bottom, r / (rows - 1));
            }
        };
    }
    if (design === 1) {
        const cols = 45;
        const rows = 20;
        const word = textMask("ARK", 2);
        const sky = [tone("#f2a65a"), tone("#e0607e"), tone("#5b3a7a")];
        const sun = tone("#ffe39a");
        const sea = tone("#1d3b63");
        return {
            cols,
            rows,
            cell: (c, r) => {
                const tc = c - 4;
                if (word.on(tc, r - 4)) return white;
                // A setting sun on the right over the sea, the hull of a boat on it.
                if (r >= 15) return Math.abs(c - 31) < 7 - (r - 15) && r < 17 ? tone("#2a2a2e") : mix(sea, tone("#0f2340"), (r - 15) / 4);
                if (Math.hypot(c - 31, (r - 14) * 1.1) < 6.5) return sun;
                const t = r / 14;
                return t < 0.5 ? mix(sky[2], sky[1], t * 2) : mix(sky[1], sky[0], (t - 0.5) * 2);
            }
        };
    }
    const cols = 60;
    const rows = 22;
    const line = textMask("TALK TO ANIMALS", 1);
    const deep = tone("#173a5e");
    const teal = tone("#2a9d8f");
    const paw = tone("#ffd36b");
    return {
        cols,
        rows,
        cell: (c, r) => {
            if (line.on(c - Math.floor((cols - line.w) / 2), r - 9)) return white;
            // Two speech bubbles' tails of colour and paws along the bottom: AnimalDex's chat with the animals.
            const pc = (c + 3) % 15;
            if (r >= 15 && r < 21 && pc < 6 && PAW[Math.min(r - 15 + 3, 8)][Math.min(pc * 2, 10)] === "#") return paw;
            const wave = 0.5 + 0.5 * Math.sin(c * 0.35 + r * 0.2);
            return mix(deep, teal, (r / rows) * 0.6 + wave * 0.15);
        }
    };
}

// MARK: - Billboards

/** A billboard's foot (the ground, or its building's roof inside the parapet) and its face's normal. */
function billboardBase(plan: TownPlan, b: Billboard, H: (x: number, z: number) => number): number {
    const on = b.on ? plan.buildings.find((x) => x.id === b.on) : null;
    return on ? townBuildingFloor(on.at) - 0.15 + on.eaves + 0.75 : H(b.x, b.z);
}

function billboard(plan: TownPlan, b: Billboard, chunks: Chunks, lights: Geo, H: (x: number, z: number) => number) {
    const solid = chunks(b.x, b.z).solid;
    const base = billboardBase(plan, b, H);
    const nx = Math.sin(b.turn);
    const nz = Math.cos(b.turn);
    // (The kit's frames have local +z at (−sin rot, cos rot): the face's normal is local +z at rot = −turn.)
    const f: Frame = {x: b.x, y: base, z: b.z, rot: -b.turn};
    const steel = tone("#3a3d42");
    const bottom = b.y - b.h / 2;
    // Two legs (on a roof, a raking strut behind each), the backing, a walkway along the bottom.
    for (const s of [-1, 1]) {
        solid.box(f, s * b.w * 0.3, 0, -0.25, 0.32, b.y + b.h / 2 - 0.2, 0.32, steel);
        if (b.on) solid.box(f, s * b.w * 0.3, 0, -1.4, 0.18, bottom + 0.4, 0.18, steel);
    }
    solid.box(f, 0, bottom - 0.25, 0, b.w + 0.5, b.h + 0.5, 0.3, tone("#2b2d31"));
    solid.box(f, 0, bottom - 0.4, 0.55, b.w + 0.3, 0.1, 0.8, steel);
    // The uplighters on arms over the walkway, their lamps lit at night.
    const lampCount = Math.max(2, Math.round(b.w / 3));
    for (let k = 0; k < lampCount; k++) {
        const u = -b.w / 2 + (b.w * (k + 0.5)) / lampCount;
        solid.box(f, u, bottom - 0.32, 0.6, 0.08, 0.08, 1.0, steel);
        lights.tag = DOWNTOWN_LIGHT.lamp;
        lights.box(f, u, bottom - 0.3, 1.1, 0.34, 0.14, 0.2, tone("#fff4dc"));
    }
    // The face: its art's cells just proud of the backing, lit from within after dark.
    const a = art(b.design);
    const cw = b.w / a.cols;
    const ch = b.h / a.rows;
    const rx = Math.cos(b.turn);
    const rz = -Math.sin(b.turn);
    const out = 0.17;
    const cx = b.x + nx * out;
    const cz = b.z + nz * out;
    lights.tag = DOWNTOWN_LIGHT.sign;
    const p = (u: number, y: number): V3 => [cx + rx * u, y, cz + rz * u];
    for (let r = 0; r < a.rows; r++) {
        const y0 = base + b.y + b.h / 2 - (r + 1) * ch;
        // (A run of cells of one colour along the row is one quad.)
        for (let c = 0; c < a.cols; ) {
            const colour = a.cell(c, r);
            let end = c + 1;
            while (end < a.cols && a.cell(end, r).every((v, i) => Math.abs(v - colour[i]) < 1e-6)) end++;
            const u0 = -b.w / 2 + c * cw;
            const u1 = -b.w / 2 + end * cw;
            lights.quad(p(u0, y0), p(u1, y0), p(u1, y0 + ch), p(u0, y0 + ch), colour);
            c = end;
        }
    }
}

/** The downtown's billboards, the towers' aviation lights and the Christmas tree's ring, into the chunks and the lights. */
export function downtownScenery(plan: TownPlan, chunks: Chunks, lights: Geo, H: (x: number, z: number) => number) {
    if (!plan.downtown) return;
    // The plaza and the towers' forecourts laid with setts, as the market square is (`scenery.ts` square).
    for (const g of plan.greens) {
        if (g.id !== "downtown" && g.id !== "tower_3_forecourt") continue;
        const x0 = Math.min(...g.poly.map((q) => q.x));
        const x1 = Math.max(...g.poly.map((q) => q.x));
        const z0 = Math.min(...g.poly.map((q) => q.z));
        const z1 = Math.max(...g.poly.map((q) => q.z));
        const f: Frame = {x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2, rot: 0};
        const c = chunks(f.x, f.z);
        tagged(c.decal, SURF.setts, alongZ(0), () => c.decal.drape(f, x1 - x0, z1 - z0, H, 0.12, () => tone("#aaa194"), 1.6));
    }
    for (const b of plan.downtown.billboards) billboard(plan, b, chunks, lights, H);
    for (const t of plan.buildings) {
        if (t.kind !== "tower") continue;
        const top = townBuildingFloor(t.at) - 0.15 + t.eaves + 0.76;
        const f: Frame = {x: t.at.x, y: top, z: t.at.z, rot: t.at.rot};
        const mast = t.floors >= 20;
        const c = chunks(t.at.x, t.at.z).solid;
        // The tallest a mast on its plant room; each tower a red light at two corners of its parapet.
        if (mast) c.cylinder(f, 0, 3.6, -t.at.d * 0.3, 0.16, 0.06, 9, tone("#9a9ea4"), 6);
        lights.tag = DOWNTOWN_LIGHT.sign;
        if (mast) lights.box(f, 0, 12.6, -t.at.d * 0.3, 0.32, 0.3, 0.32, tone("#ff2a1a"));
        for (const [sx, sz] of [[-1, -1], [1, 1]]) lights.box(f, sx * (t.at.w / 2 - 0.3), 0.05, sz * (t.at.d / 2 - 0.3), 0.26, 0.24, 0.26, tone("#ff2a1a"));
    }
    // The Christmas tree's place: a low stone ring round a bed, all year.
    const p = plan.downtown.tree;
    const ring: Frame = {x: p.x, y: H(p.x, p.z), z: p.z, rot: 0};
    const c = chunks(p.x, p.z).solid;
    c.cylinder(ring, 0, 0, 0, 5.2, 5.2, 0.55, tone("#a9a294"), 24);
    c.cylinder(ring, 0, 0.55, 0, 5.3, 5.3, 0.08, tone("#c4bdae"), 24);
    c.cylinder(ring, 0, 0.6, 0, 4.7, 4.7, 0.02, tone("#4a3a2c"), 24);
}

// MARK: - The Christmas tree (its season only)

/** Whether the Christmas tree is up: 15 November to 6 January by the island clock (`clock.day` is the epoch day + 4). */
export function christmasSeason(clock: TownClock): boolean {
    const date = new Date((clock.day - 4) * 86_400_000);
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return (month === 10 && day >= 15) || month === 11 || (month === 0 && day <= 6);
}

/** The tree's height (m) and the number of its fairy lights. */
export const CHRISTMAS_TREE = {height: 16, bulbs: 460} as const;
const TIERS = 7;

/** The tree (`solid`: fir tiers, trunk, star) and its fairy lights (`lights`: each bulb tagged with its own phase). */
export function christmasTree(at: Pt, ground: number): {solid: Geo; lights: Geo} {
    const solid = new Geo();
    const lights = new Geo();
    const f: Frame = {x: at.x, y: ground + 0.6, z: at.z, rot: 0};
    const H = CHRISTMAS_TREE.height;
    solid.cylinder(f, 0, 0, 0, 0.55, 0.45, 2.2, tone("#5a3e2a"), 10);
    // Tiers of boughs: each a cone, overlapping, narrowing to the top; a little darker inside.
    for (let i = 0; i < TIERS; i++) {
        const t = i / TIERS;
        const y = 1.6 + t * (H - 3.4);
        const r = 5.0 * (1 - t) + 0.6;
        const h = (H - 1.6) / TIERS + 1.8;
        solid.cylinder(f, 0, y, 0, r, 0.15, h, tone(i % 2 ? "#1f5a34" : "#24663b"), 16, false);
        solid.cylinder(f, 0, y - 0.05, 0, r * 0.94, r * 0.94, 0.06, tone("#163f26"), 16, false);
    }
    // The star.
    solid.blob(at.x, ground + 0.6 + H + 0.25, at.z, 0.7, 0.7, 0.25, tone("#f2c84b"), 7, 1);
    lights.tag = DOWNTOWN_LIGHT.sign;
    lights.blob(at.x, ground + 0.6 + H + 0.25, at.z, 0.55, 0.55, 0.3, tone("#ffd75a"), 11, 1);
    // Fairy lights: five garlands wound up round the boughs' outside, warm white with coloured runs.
    const colours = ["#fff1c4", "#fff1c4", "#ff4a3a", "#ffd34a", "#4ab0ff", "#fff1c4", "#5aff8a"].map((hex) => tone(hex));
    const r = rng(hashText("christmas-tree"));
    const n = CHRISTMAS_TREE.bulbs;
    for (let k = 0; k < n; k++) {
        const garland = k % 5;
        const t = Math.floor(k / 5) / (n / 5);
        const y = 1.9 + t * (H - 3.0);
        // (On the boughs' outside: the widest tier at this height, each tier a cone from its skirt to its tip.)
        let radius = 0.3;
        for (let i = 0; i < TIERS; i++) {
            const ti = i / TIERS;
            const y0 = 1.6 + ti * (H - 3.4);
            const r0 = 5.0 * (1 - ti) + 0.6;
            const h = (H - 1.6) / TIERS + 1.8;
            if (y >= y0 && y <= y0 + h) radius = Math.max(radius, r0 + (0.15 - r0) * ((y - y0) / h));
        }
        radius += 0.06;
        const a = t * Math.PI * 2 * 5.5 + (garland * Math.PI * 2) / 5 + (r() - 0.5) * 0.08;
        // (A bulb hangs in each bough's lower edge: a little down from the cone's line.)
        const x = at.x + Math.cos(a) * radius;
        const z = at.z + Math.sin(a) * radius;
        const phase = Math.floor(r() * 4000);
        lights.tag = phase * 8 + DOWNTOWN_LIGHT.fairy;
        lights.box({x, y: ground + 0.6 + y - 0.18, z, rot: a}, 0, 0, 0, 0.16, 0.18, 0.16, colours[(garland * 3 + Math.floor(k / 35)) % colours.length]);
    }
    return {solid, lights};
}
