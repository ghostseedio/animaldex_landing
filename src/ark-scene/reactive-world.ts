/**
 * What the reactive layer asks of the world (`reactive.ts`): a line of
 * sight through terrain and dense vegetation, and the nearest refuge of a
 * kind (cover, water, a tree, shade). Built on the graphics lane's scenery
 * interface (`world-sampler.ts`): heights for the terrain, trunks and rocks
 * (`blocked`) and a coarse grid of vegetation density from its attach points
 * (leaves, branches, reeds, shade). The graphics lane can hand over a finer
 * occlusion grid later: only `sightLine` changes.
 */

import type {ArkWorldSampler, AttachTag} from "@/ark-scene/world-sampler";
import type {RefugeKind, Vec3} from "@/ark-scene/reactive";

const CELL = 4;
const DENSE: AttachTag[] = ["leaf", "branch", "reeds", "shade"];
const REFUGE_TAGS: Record<RefugeKind, AttachTag[]> = {
    cover: ["shade", "burrow_entrance", "reeds", "cave_mouth", "rock_face"],
    water: ["water_edge", "pond_surface"],
    tree: ["bark", "branch"],
    shade: ["shade", "cave_mouth"]
};

export type ReactiveWorldQueries = {
    sight: (from: Vec3, to: Vec3) => number;
    refuge: (x: number, z: number, kind: RefugeKind, r: number) => {x: number; z: number} | null;
    /** How many samples a sight line takes (the tier's budget). */
    samples: number;
};

export function reactiveWorldQueries(sampler: ArkWorldSampler, samples = 6): ReactiveWorldQueries {
    // Vegetation density per 4 m cell, filled lazily from the attach points (counted once per cell).
    const density = new Map<string, number>();
    const densityAt = (x: number, z: number) => {
        const cx = Math.floor(x / CELL);
        const cz = Math.floor(z / CELL);
        const key = `${cx},${cz}`;
        let d = density.get(key);
        if (d === undefined) {
            let n = 0;
            for (const tag of DENSE) n += sampler.attachPoints(tag, {x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL, r: CELL * 0.75}).length;
            d = Math.min(n / 14, 1);
            density.set(key, d);
        }
        return d;
    };
    const queries: ReactiveWorldQueries = {
        samples,
        sight: (from, to) => {
            const n = Math.max(queries.samples, 0);
            if (!n) return 1;
            let clear = 1;
            for (let k = 1; k <= n; k++) {
                const u = k / (n + 1);
                const x = from.x + (to.x - from.x) * u;
                const z = from.z + (to.z - from.z) * u;
                const y = from.y + (to.y - from.y) * u;
                // A ridge or a bank between them: no sight.
                if (Math.max(sampler.heightAt(x, z), 0) > y) return 0;
                // A trunk or a rock: most of the view; dense leaves, reeds, a thicket: some of it per sample.
                if (sampler.blocked(x, z, 0.25)) clear *= 0.45;
                clear *= 1 - 0.32 * densityAt(x, z);
                if (clear < 0.2) return clear;
            }
            return clear;
        },
        refuge: (x, z, kind, r) => {
            let best: {x: number; z: number} | null = null;
            let bestD = Infinity;
            for (const tag of REFUGE_TAGS[kind]) {
                for (const p of sampler.attachPoints(tag, {x, z, r})) {
                    const d = Math.hypot(p.x - x, p.z - z);
                    if (d < bestD) {
                        bestD = d;
                        best = {x: p.x, z: p.z};
                    }
                }
                if (best) break;
            }
            return best;
        }
    };
    return queries;
}
