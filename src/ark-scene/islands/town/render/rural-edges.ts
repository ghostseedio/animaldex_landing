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
