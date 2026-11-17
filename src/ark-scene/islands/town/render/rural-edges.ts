/**
 * The countryside's field boundaries (p5 (rural), `rural.ts`), made as they are built: a dry-stone wall (two faces of
 * flat stones in courses, battered in, a row of upright coping stones along its top), poultry netting (green posts
 * every 3 m, the mesh between them, a top wire) and a pig's low wire (stakes with two strands on yellow insulators).
 * Each stretch goes into the chunk it lies in, merged with the chunk's own geometry; open where a gate stands (the
 * gate is drawn by `fiveBarGate`).
 */

import {hashText, rng} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {FarmGate} from "@/ark-scene/islands/town/farm";
import type {Hedge} from "@/ark-scene/islands/town/plan";
import {at, tone, type Frame, type Geo} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];
const STONES: RGB[] = [tone("#8d877c"), tone("#9b958a"), tone("#7c766c"), tone("#a39b8c"), tone("#857e70")];
const NET_POST = tone("#3d5a3a");
const NET = tone("#5d7a58");
const STAKE = tone("#6a5238");
const WIRE = tone("#b8bcbe");
const INSULATOR = tone("#e0c020");

function shade(c: RGB, k: number): RGB {
    return [c[0] * k, c[1] * k, c[2] * k];
}

/** Whether a point lies in a gate's opening (with `margin` m either side). */
function inGate(gates: readonly FarmGate[], x: number, z: number, margin = 0): boolean {
    return gates.some((g) => Math.hypot(x - g.x, z - g.z) < g.width / 2 + margin);
}

export function ruralEdge(h: Hedge, gates: readonly FarmGate[], chunkAt: (x: number, z: number) => {solid: Geo; net: Geo}) {
    const r = rng(hashText(h.id));
    for (let i = 1; i < h.line.length; i++) {
        const a = h.line[i - 1];
        const b = h.line[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.2) continue;
        // (The frame's local z runs along the line, as the other boundaries' do.)
        const rot = Math.atan2(-(b.x - a.x), b.z - a.z);
        const step = h.kind === "drystone" ? 0.55 : 3;
        const n = Math.max(1, Math.round(length / step));
        const seg = length / n;
        for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n;
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            if (inGate(gates, x, z, h.kind === "drystone" ? 0.1 : -0.2)) continue;
            const c = chunkAt(x, z);
            const g = townHeight(x, z);
            const f: Frame = {x, y: g, z, rot};
            if (h.kind === "drystone") {
                // Courses of flat stones, each a little wider at the foot (the batter), staggered along the wall.
                const courses = 4;
                for (let q = 0; q < courses; q++) {
                    const y = -0.25 + (q * (h.height - 0.05)) / courses;
                    const thick = 0.7 - q * 0.08;
                    const hh = (h.height + 0.2) / courses;
                    const off = (q % 2) * seg * 0.5 - seg * 0.25;
                    c.solid.box(f, (r() - 0.5) * 0.04, y, off, thick, hh + 0.02, seg * (0.92 + r() * 0.12), shade(STONES[Math.floor(r() * STONES.length)], 0.9 + r() * 0.2), (r() - 0.5) * 0.05);
                }
                // The cope: stones set on edge along the top.
                for (let s = -seg / 2 + 0.09; s < seg / 2; s += 0.18) c.solid.box(f, 0, h.height - 0.05, s, 0.42, 0.18 + r() * 0.08, 0.13, shade(STONES[Math.floor(r() * STONES.length)], 0.85 + r() * 0.2), (r() - 0.5) * 0.25);
            } else if (h.kind === "poultry_net") {
                c.solid.box(f, 0, -0.3, -seg / 2, 0.07, h.height + 0.35, 0.07, NET_POST);
                c.net.quad(at(f, 0, 0, -seg / 2), at(f, 0, 0, seg / 2), at(f, 0, h.height, seg / 2), at(f, 0, h.height, -seg / 2), NET);
                c.solid.box(f, 0, h.height - 0.02, 0, 0.02, 0.02, seg, NET_POST);
            } else {
                c.solid.box(f, 0, -0.3, -seg / 2, 0.06, h.height + 0.3, 0.06, STAKE);
                for (const y of [0.3, h.height - 0.1]) {
                    c.solid.box(f, 0.04, y, 0, 0.012, 0.012, seg, WIRE);
                    c.solid.box(f, 0.03, y - 0.02, -seg / 2, 0.05, 0.05, 0.04, INSULATOR);
                }
            }
        }
    }
}

// MARK: - The poultry farm's and the arena's small things

const EARTH = tone("#8a7458");
const GALV = tone("#a7adb0");
const RED_PLASTIC = tone("#b8352c");
const POLE_WHITE = tone("#eeeae2");
const POLE_RED = tone("#c0392b");
const WING = tone("#e7e2d6");

/** A low, ragged disc of bare earth where hens dust-bathe (a hand over the ground, its edge tucked in). */
function dustBath(geo: Geo, x: number, z: number, radius: number, seed: number) {
    const r = rng(seed);
    const n = 12;
    const g = (px: number, pz: number) => townHeight(px, pz) + 0.025;
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = radius * (0.75 + r() * 0.4);
        const px = x + Math.cos(a) * rr;
        const pz = z + Math.sin(a) * rr;
        pts.push([px, g(px, pz) - 0.012, pz]);
    }
    const c: [number, number, number] = [x, g(x, z), z];
    for (let i = 0; i < n; i++) geo.tri(c, pts[(i + 1) % n], pts[i], shade(EARTH, 0.9 + r() * 0.15));
}

/** A galvanised feed hopper on its legs over a pan, and a red bell drinker beside it. */
function feederAndDrinker(geo: Geo, x: number, z: number, rot: number) {
    const f: Frame = {x, y: townHeight(x, z), z, rot};
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]]) geo.box(f, lx, 0, lz, 0.03, 0.32, 0.03, shade(GALV, 0.8));
    geo.cylinder(f, 0, 0.12, 0, 0.32, 0.32, 0.06, shade(GALV, 0.9), 12);
    geo.cylinder(f, 0, 0.3, 0, 0.17, 0.2, 0.45, GALV, 10);
    geo.cylinder(f, 0, 0.75, 0, 0.21, 0.05, 0.08, shade(GALV, 1.05), 10);
    const d: Frame = {...f, x: x + Math.cos(rot) * 0.9, z: z + Math.sin(rot) * 0.9, y: townHeight(x + Math.cos(rot) * 0.9, z + Math.sin(rot) * 0.9)};
    geo.cylinder(d, 0, 0, 0, 0.26, 0.26, 0.07, RED_PLASTIC, 12);
    geo.cylinder(d, 0, 0.07, 0, 0.17, 0.05, 0.36, RED_PLASTIC, 10);
}

/** A show jump: two wings and three poles in red and white. */
function showJump(geo: Geo, x: number, z: number, rot: number, height: number) {
    const f: Frame = {x, y: townHeight(x, z), z, rot};
    for (const lx of [-1.9, 1.9]) {
        geo.box(f, lx, 0, 0, 0.12, 1.5, 0.5, WING);
        geo.box(f, lx, 0, 0, 0.5, 0.06, 0.6, shade(WING, 0.9));
    }
    for (let i = 0; i < 3; i++) {
        const y = height * ((i + 1) / 3);
        for (let s = 0; s < 6; s++) geo.box(f, -1.6 + (s + 0.5) * (3.2 / 6), y, 0, 3.2 / 6, 0.09, 0.09, s % 2 ? POLE_RED : POLE_WHITE);
    }
}

/**
 * The countryside's small things (p5 (rural), the owner's "add chicken farms too": dust-bathing patches, feeders and
 * drinkers on the free range, in the orchard and the run; two show jumps in the riding arena). Drawn into the chunks'
 * solid geometry; none stands where an animal is placed (the run's and the range's hen houses are the colliders).
 */
export function ruralProps(pens: ReadonlyArray<{id: string; at: {x: number; z: number; w: number; d: number; rot: number}}>, chunkAt: (x: number, z: number) => {solid: Geo}) {
    for (const p of pens) {
        const r = rng(hashText(`${p.id}:props`));
        const c = Math.cos(p.at.rot);
        const sn = Math.sin(p.at.rot);
        const local = (lx: number, lz: number) => ({x: p.at.x + lx * c - lz * sn, z: p.at.z + lx * sn + lz * c});
        if (p.id === "rural-free-range" || p.id === "rural-orchard" || p.id === "rural-farmyard-run") {
            const baths = p.id === "rural-free-range" ? 6 : p.id === "rural-orchard" ? 3 : 1;
            for (let i = 0; i < baths; i++) {
                const q = local((r() - 0.5) * (p.at.w - 3), (r() - 0.5) * (p.at.d - 3));
                dustBath(chunkAt(q.x, q.z).solid, q.x, q.z, 0.6 + r() * 0.5, hashText(`${p.id}:bath:${i}`));
            }
            const feeders = p.id === "rural-free-range" ? 3 : 1;
            for (let i = 0; i < feeders; i++) {
                const q = local(-p.at.w / 2 + 1.6 + i * ((p.at.w - 3.2) / Math.max(feeders - 1, 1)), p.at.d / 2 - 1.4);
                feederAndDrinker(chunkAt(q.x, q.z).solid, q.x, q.z, p.at.rot);
            }
        }
        if (p.id === "rural-arena") {
            for (const [lx, lz, turn, h] of [[-6, 0, Math.PI / 2, 0.9], [6, 1.5, Math.PI / 2 + 0.3, 1.1]] as const) {
                const q = local(lx, lz);
                showJump(chunkAt(q.x, q.z).solid, q.x, q.z, p.at.rot + turn, h);
            }
        }
    }
}
