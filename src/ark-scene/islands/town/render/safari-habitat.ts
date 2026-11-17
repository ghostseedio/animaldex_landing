/**
 * The safari's habitats dressed (p4 (safari), `islands/town/safari.ts`): what stands on each area's ground, drawn with
 * the zoo habitats' own builders (`zoo-habitat.ts`: rockwork, termite mounds, logs, grass tufts, ferns) so it matches
 * the zoo, and recorded on the same `Plot` (footprints for the colliders, `colliders.ts`; solids, `solids.ts`), so the
 * residents walk round every kopje, mound and log, as in the zoo. Ground items keep clear of the residents' spots
 * (`areas.ts` zooSpotsOf), and the spots keep clear of the kopjes, the mounds and the waters.
 *
 * - plains: two granite kopjes, termite mounds, golden grass tufts in drifts, bare game trails, a fallen acacia log;
 * - desert: low sandstone ledges, sparse dry tussocks, succulents, a stone trough at the small waterhole;
 * - forest edge: fallen logs, ferns and tall grass under the trees (`trees.ts` townZooTrees plants them);
 * - wetland and river: reeds round the hippo pool and the river, mud wallows, a log half in the water;
 * - lions and hyenas: a kopje each, grass, a log; tigers: logs and ferns under the trees, a bathing pool.
 */

import {hashText, inBox, rng, toLocal, type Box, type Pt} from "@/ark-scene/islands/town/geom";
import {at, Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {cactus, fern, ledge, log, outcrop, patch, Plot, termiteMound, tuft} from "@/ark-scene/islands/town/render/zoo-habitat";
import {SAFARI_KOPJES, SAFARI_TERMITES, safariArea, safariWaterNorm, type SafariHabitat} from "@/ark-scene/islands/town/safari";

type RGB = [number, number, number];

const GRANITE = tone("#a39686");
const SANDSTONE = tone("#c4a274");
const DRY_GRASS = tone("#c9b26a");
const GREEN_GRASS = tone("#7c9a46");
const REED = tone("#6f8a3e");
const EARTH = tone("#a8946c");
const MUD = tone("#6e5c44");

/** A safari area's dressing; null where `e` is not a safari area. */
export function dressSafari(e: {id: string; type: string; slot: {at: Box; seed: number; safari?: SafariHabitat}}, spots: readonly Pt[], solid: Geo, heightAt: (x: number, z: number) => number, cover: Geo | null = null): Plot | null {
    const habitat = e.slot.safari;
    const area = safariArea(e.id);
    if (!habitat || !area) return null;
    const s = e.slot.at;
    const fr: Frame = {x: s.x, y: 0, z: s.z, rot: s.rot};
    const floorAt = (lx: number, lz: number) => {
        const q = at(fr, lx, 0, lz);
        return heightAt(q[0], q[2]);
    };
    const plot = new Plot(s, floorAt, spots, e.slot.seed);
    // (Merged into p5 (zoospace) with main's p4 (townfix) logs: the deadwood bleached in the dry types, as `dressPaddock`.)
    plot.dry = e.type === "savanna_paddocks" || e.type === "big_cats" || e.type === "small_mammals";
    // (Grass, reeds and ferns are drawn in `solid`; a patch of bare earth is ground: drawn, and in `cover`, the walk
    // surfaces the residents stand on, as the zoo's patches, `zoo-habitat.ts`.)
    const ground = solid;
    const W = s.w / 2;
    const D = s.d / 2;
    // The waters: taken whole (nothing put in them), soft (a body may wade).
    // (An ellipse as a row of circles along its long axis, each as wide as its short one: one circle round it all
    // would take the land beside a long river too, and leave a body no clear ground to stand on.)
    for (const w of area.waters) {
        const long = Math.max(w.rx, w.rz);
        const short = Math.min(w.rx, w.rz);
        const ax = w.rx >= w.rz ? Math.cos(w.rot) : -Math.sin(w.rot);
        const az = w.rx >= w.rz ? Math.sin(w.rot) : Math.cos(w.rot);
        const n = Math.max(1, Math.ceil((long - short) / short) + 1);
        for (let k = 0; k < n; k++) {
            const t = n === 1 ? 0 : -1 + (2 * k) / (n - 1);
            const off = t * (long - short);
            const q = toLocal(s, w.x + ax * off, w.z + az * off);
            plot.footprints.push({x: q.x, z: q.z, r: short * 1.1, what: "pool"});
        }
    }
    // The kopjes and termite mounds inside it: fixed places (the spots keep clear of them).
    for (const k of SAFARI_KOPJES) {
        if (!inBox(s, k.x, k.z, -1)) continue;
        const q = toLocal(s, k.x, k.z);
        plot.footprints.push({x: q.x, z: q.z, r: k.r, what: "rockwork"});
        outcrop(solid, plot, q.x, q.z, k.h * 0.75, GRANITE, k.seed);
        // A boulder or two leaning on it, and the grass grown up round its foot.
        const r = rng(k.seed + 7);
        for (let i = 0; i < 2; i++) {
            const a = r() * 6.28;
            outcrop(solid, plot, q.x + Math.cos(a) * k.r * 0.55, q.z + Math.sin(a) * k.r * 0.55, k.h * (0.35 + r() * 0.15), GRANITE, k.seed + 100 + i);
        }
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * 6.28 + r() * 0.4;
            tuft(ground, plot, q.x + Math.cos(a) * (k.r + 0.4), q.z + Math.sin(a) * (k.r + 0.4), 0.7, DRY_GRASS, k.seed * 31 + i, 9);
        }
    }
    for (const t of SAFARI_TERMITES) {
        if (!inBox(s, t.x, t.z, -1)) continue;
        const q = toLocal(s, t.x, t.z);
        plot.footprints.push({x: q.x, z: q.z, r: 1.0, what: "mound"});
        termiteMound(solid, plot, q.x, q.z, 2.2 + (hashText(`${t.x}:${t.z}`) % 10) / 10, hashText(`${e.id}:${t.x}`));
    }
    // (A water's ring for its reeds: from just inside its edge to its mud.)
    const nearWater = (lx: number, lz: number) => {
        const q = at(fr, lx, 0, lz);
        let best = Infinity;
        for (const w of area.waters) best = Math.min(best, safariWaterNorm(w, q[0], q[2]));
        return best;
    };
    const r = rng(e.slot.seed + 101);
    const scatter = (n: number, draw: (lx: number, lz: number, i: number) => void, radius = 0.3, what = "plant", keep: (lx: number, lz: number) => boolean = () => true) => {
        for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
            const lx = (r() - 0.5) * (2 * W - 4.2);
            const lz = (r() - 0.5) * (2 * D - 4.2);
            if (!keep(lx, lz) || nearWater(lx, lz) < 1.3) continue;
            if (!plot.free(lx, lz, radius, 3.4)) continue;
            if (what !== "grass") plot.footprints.push({x: lx, z: lz, r: radius, what});
            draw(lx, lz, i);
            i++;
        }
    };
    const reeds = (count: number) => {
        for (const w of area.waters) {
            const q = toLocal(s, w.x, w.z);
            for (let i = 0; i < count; i++) {
                const a = (i / count) * 6.28 + r() * 0.3;
                const k = 0.95 + r() * 0.3;
                const lx = q.x + Math.cos(a) * w.rx * k;
                const lz = q.z + Math.sin(a) * w.rz * k;
                if (Math.abs(lx) > W - 0.6 || Math.abs(lz) > D - 0.6) continue;
                tuft(ground, plot, lx, lz, 1.3 + r() * 0.6, REED, hashText(`${e.id}:reed:${i}:${w.x}`), 11);
            }
        }
    };
    // Bare earth and game trails under it all (worn where the herd walks to water).
    const patches = habitat === "desert" ? 4 : habitat === "forest" || habitat === "tigers" ? 3 : 5;
    for (let i = 0; i < patches; i++) {
        const lx = (r() - 0.5) * (2 * W - 6);
        const lz = (r() - 0.5) * (2 * D - 6);
        if (nearWater(lx, lz) < 1.5) continue;
        const radius = 1.4 + r() * 2.2;
        const colour = habitat === "desert" ? SANDSTONE : habitat === "wetland" || habitat === "river" ? MUD : EARTH;
        patch(solid, plot, lx, lz, radius, colour, hashText(`${e.id}:patch:${i}`), 0.03);
        if (cover) patch(cover, plot, lx, lz, radius, colour, hashText(`${e.id}:patch:${i}`), 0.03);
    }
    const area2 = (2 * W) * (2 * D);
    switch (habitat) {
        case "plains":
        case "lions":
        case "hyenas": {
            scatter(Math.round(area2 / 9), (lx, lz, i) => tuft(ground, plot, lx, lz, 0.55 + r() * 0.5, i % 4 ? DRY_GRASS : GREEN_GRASS, hashText(`${e.id}:t${i}`), 8), 0.3, "grass");
            scatter(habitat === "plains" ? 2 : 1, (lx, lz, i) => {
                const a = r() * 3.14;
                log(solid, plot, lx - Math.cos(a) * 1.6, lz - Math.sin(a) * 1.6, lx + Math.cos(a) * 1.6, lz + Math.sin(a) * 1.6, 0.26 + i * 0.04);
            }, 1.8, "log");
            reeds(10);
            break;
        }
        case "desert": {
            scatter(Math.round(area2 / 26), (lx, lz, i) => tuft(ground, plot, lx, lz, 0.4 + r() * 0.3, DRY_GRASS, hashText(`${e.id}:t${i}`), 6), 0.25, "grass");
            scatter(4, (lx, lz, i) => ledge(solid, plot, lx, lz, 0.7 + r() * 0.6, SANDSTONE, hashText(`${e.id}:ledge${i}`)), 1.2, "rockwork");
            scatter(5, (lx, lz, i) => cactus(solid, plot, lx, lz, 1.1 + r() * 0.8, hashText(`${e.id}:cactus${i}`)), 0.3, "plant");
            break;
        }
        case "forest":
        case "tigers": {
            scatter(Math.round(area2 / 14), (lx, lz, i) => tuft(ground, plot, lx, lz, 0.8 + r() * 0.6, GREEN_GRASS, hashText(`${e.id}:t${i}`), 9), 0.3, "grass");
            scatter(Math.round(area2 / 60), (lx, lz, i) => fern(ground, plot, lx, lz, 1.1 + r() * 0.5, tone("#4f7a34"), hashText(`${e.id}:f${i}`), 9), 0.8, "plant");
            scatter(3, (lx, lz, i) => {
                const a = r() * 3.14;
                log(solid, plot, lx - Math.cos(a) * 2, lz - Math.sin(a) * 2, lx + Math.cos(a) * 2, lz + Math.sin(a) * 2, 0.32 + (i % 2) * 0.08);
            }, 2.2, "log");
            reeds(12);
            break;
        }
        case "wetland":
        case "river": {
            scatter(Math.round(area2 / 12), (lx, lz, i) => tuft(ground, plot, lx, lz, 0.9 + r() * 0.7, i % 3 ? GREEN_GRASS : REED, hashText(`${e.id}:t${i}`), 9), 0.3, "grass");
            reeds(habitat === "wetland" ? 34 : 26);
            scatter(2, (lx, lz, i) => {
                const a = r() * 3.14;
                log(solid, plot, lx - Math.cos(a) * 1.8, lz - Math.sin(a) * 1.8, lx + Math.cos(a) * 1.8, lz + Math.sin(a) * 1.8, 0.3 + i * 0.05);
            }, 2, "log");
            break;
        }
    }
    return plot;
}

export type {RGB};
