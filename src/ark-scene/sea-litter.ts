/**
 * The sea bed's small things (3.3 batch, lane E; the owner, 2026-11-16: "more details"): shells, pebbles and broken
 * coral lying on the bare sand and rubble round the camera, where the bed was an empty plain. The pure part: what lies
 * in each 4 m cell of the bed, from the cell alone (`litterInCell`), so every viewer finds the same shell in the same
 * place. `sea-litter-render.ts` draws the cells near the camera as one instanced mesh.
 *
 * By the bed (`reef.ts` seaBedAt): none in water shallower than 1.2 m (the swash keeps the beach's shallows bare); more
 * broken coral and fewer shells on the reef's rubble; more pebbles on rock; none on the reef's own framework (the
 * corals and their cover are there). Colours are the real ones, the red taken out by depth as everything else is.
 */

import {seaBedAt} from "@/ark-scene/reef";
import {hashString, sampleGround} from "@/ark-scene/world";

export type LitterKind = "shell" | "pebble" | "coral";
export type LitterItem = {kind: LitterKind; x: number; y: number; z: number; yaw: number; tilt: number; sx: number; sy: number; sz: number; r: number; g: number; b: number};

/** A cell's side (m) and the most items one holds. */
export const LITTER_CELL = 4;
export const LITTER_PER_CELL = 16;
export const LITTER_MIN_DEPTH = 1.2;

const SHELL = [[0.86, 0.8, 0.72], [0.82, 0.68, 0.62], [0.9, 0.86, 0.8], [0.74, 0.6, 0.5]];
const PEBBLE = [[0.42, 0.42, 0.4], [0.5, 0.47, 0.42], [0.34, 0.34, 0.35]];
const CORAL = [[0.85, 0.83, 0.76], [0.78, 0.76, 0.7]];

const unit = (key: string): number => (hashString(key) % 100000) / 100000;

const cells = new Map<string, LitterItem[]>();

/** What lies in cell (i, j) (the cell's corner at i·LITTER_CELL, j·LITTER_CELL). Pure, and remembered. */
export function litterInCell(i: number, j: number): LitterItem[] {
    const key = `${i},${j}`;
    const known = cells.get(key);
    if (known) return known;
    const items: LitterItem[] = [];
    // (The cheap test first: a cell whose middle is dry ground holds nothing.)
    const mx = (i + 0.5) * LITTER_CELL;
    const mz = (j + 0.5) * LITTER_CELL;
    if (sampleGround(mx, mz).height < -LITTER_MIN_DEPTH + 1) {
        const n = Math.floor(unit(`litter#${key}`) * (LITTER_PER_CELL + 1));
        for (let k = 0; k < n; k++) {
            const x = (i + unit(`litter#${key}#${k}x`)) * LITTER_CELL;
            const z = (j + unit(`litter#${key}#${k}z`)) * LITTER_CELL;
            const bed = seaBedAt(x, z);
            // (The sea's bed only: the lake's and the river's beds are inland, and fresh water is not this lane's.)
            if (bed.depth < LITTER_MIN_DEPTH || bed.substrate === "reef" || bed.inland > 0) continue;
            const roll = unit(`litter#${key}#${k}kind`);
            const kind: LitterKind = bed.substrate === "rubble" ? (roll < 0.55 ? "coral" : roll < 0.8 ? "pebble" : "shell") : bed.substrate === "rock" ? (roll < 0.7 ? "pebble" : "shell") : roll < 0.6 ? "shell" : roll < 0.9 ? "pebble" : "coral";
            const size = unit(`litter#${key}#${k}size`);
            const pick = (list: number[][]) => list[Math.floor(unit(`litter#${key}#${k}c`) * list.length) % list.length];
            const colour = pick(kind === "shell" ? SHELL : kind === "pebble" ? PEBBLE : CORAL);
            // The water takes the light out with depth, the red first: the sea bed's own absorption (terrain.ts,
            // exp(-depth · (0.45, 0.15, 0.1))), so a shell sits in the sand's light instead of glowing on it.
            const d = bed.depth;
            const s = kind === "shell" ? 0.05 + 0.06 * size : kind === "pebble" ? 0.05 + 0.1 * size : 0.04 + 0.03 * size;
            items.push({
                kind,
                x,
                y: bed.height,
                z,
                yaw: unit(`litter#${key}#${k}yaw`) * Math.PI * 2,
                tilt: (unit(`litter#${key}#${k}tilt`) - 0.5) * 0.5,
                sx: kind === "coral" ? s * 4.5 : s * (kind === "shell" ? 1.2 : 1.1),
                sy: kind === "shell" ? s * 0.45 : kind === "pebble" ? s * 0.6 : s,
                sz: s,
                r: colour[0] * Math.exp(-d * 0.45) * 0.85,
                g: colour[1] * Math.exp(-d * 0.15) * 0.85,
                b: colour[2] * Math.exp(-d * 0.1) * 0.85
            });
        }
    }
    if (cells.size > 4000) cells.clear();
    cells.set(key, items);
    return items;
}

/** How many items each tier draws at most, and how far round the camera (m). */
export const LITTER_COUNT = {high: 1600, medium: 700, low: 0} as const;
export const LITTER_REACH = 18;
