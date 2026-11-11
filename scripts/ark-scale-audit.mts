#!/usr/bin/env -S npx tsx
/**
 * The scenery in real metres (true-scale lane, brief §3): every decor and
 * forest-fill tree as drawn (`tree-assets.ts` assetTreePlacement), every rock
 * as drawn (`map/rocks.ts`), the fences, the cottage, the barn and the
 * hamlet's houses, against real-world reference sizes. Prints a table; no
 * scene is drawn.
 *
 *   npx tsx scripts/ark-scale-audit.mts [--json out.json]
 */
import {writeFileSync} from "node:fs";
import {forestFill, worldDecor} from "../src/ark-scene/decor.ts";
import {assetTreePlacement, ASSETS} from "../src/ark-scene/tree-assets.ts";
import {drawnRocks} from "../src/ark-scene/map/rocks.ts";
import {COTTAGE} from "../src/ark-scene/micro-decor.ts";
import {PADDOCK_POST_TOP, PICKET_POST_TOP} from "../src/ark-scene/props/home-layout.ts";

type Stat = {n: number; p10: number; p50: number; p90: number; max: number};
const stat = (values: number[]): Stat => {
    const s = [...values].sort((a, b) => a - b);
    const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
    return {n: s.length, p10: at(0.1), p50: at(0.5), p90: at(0.9), max: s[s.length - 1] ?? 0};
};

/** Real mature heights (m), typical range: what a viewer reads the tree as. */
const REAL_TREE: Record<string, [number, number]> = {
    oak: [15, 25], beech: [20, 35], birch: [12, 22], willow: [10, 20], snag: [6, 20], apple: [3, 8], mangrove: [5, 15],
    emergent: [40, 60], pine: [15, 35], spruce: [20, 40], acacia: [5, 12], palm: [10, 20]
};

const trees = new Map<string, number[]>();
const crowns = new Map<string, number[]>();
for (const item of [...worldDecor(), ...forestFill()]) {
    const placed = assetTreePlacement(item);
    if (!placed) continue;
    const kind = ASSETS[placed.id]?.kind ?? placed.id.replace(/-[abc]$/, "");
    (trees.get(kind) ?? trees.set(kind, []).get(kind)!).push(placed.height);
    (crowns.get(kind) ?? crowns.set(kind, []).get(kind)!).push(placed.radius * 2);
}
const out: Record<string, unknown> = {};
console.log("Trees as drawn (height m; crown diameter m) against real mature heights");
console.log("kind        n     p10   p50   p90   max   crown p50  real      verdict");
for (const [kind, heights] of [...trees].sort()) {
    const h = stat(heights);
    const c = stat(crowns.get(kind) ?? []);
    const real = REAL_TREE[kind];
    const ratio = real ? h.p50 / ((real[0] + real[1]) / 2) : NaN;
    const verdict = !real ? "?" : h.p50 >= real[0] * 0.8 && h.p50 <= real[1] * 1.2 ? "real" : `${ratio.toFixed(2)}x of real`;
    console.log(`${kind.padEnd(10)} ${String(h.n).padStart(5)} ${h.p10.toFixed(1).padStart(5)} ${h.p50.toFixed(1).padStart(5)} ${h.p90.toFixed(1).padStart(5)} ${h.max.toFixed(1).padStart(5)}   ${c.p50.toFixed(1).padStart(6)}    ${real ? `${real[0]}-${real[1]}` : "-"}  ${verdict}`);
    out[`tree:${kind}`] = {height: h, crown: c, real, verdict};
}

const rocks = drawnRocks();
const rockHeight = stat(rocks.map((r) => r.y1 - r.y0));
const rockWidth = stat(rocks.map((r) => Math.max(r.hx1 - r.hx0, r.hz1 - r.hz0)));
console.log(`\nRocks as drawn: ${rocks.length}; height p10/p50/p90/max ${rockHeight.p10.toFixed(2)}/${rockHeight.p50.toFixed(2)}/${rockHeight.p90.toFixed(2)}/${rockHeight.max.toFixed(2)} m; width ${rockWidth.p10.toFixed(2)}/${rockWidth.p50.toFixed(2)}/${rockWidth.p90.toFixed(2)}/${rockWidth.max.toFixed(2)} m`);
out.rocks = {height: rockHeight, width: rockWidth};

const built = {
    cottage: {width: COTTAGE.width, depth: COTTAGE.depth, eaves: COTTAGE.wall, ridge: COTTAGE.wall + COTTAGE.ridge, real: "small cottage 6-10 x 5-7 m, eaves 2.4-3 m, ridge 5-7 m"},
    picket: {post: PICKET_POST_TOP, real: "0.9-1.2 m"},
    paddock: {post: PADDOCK_POST_TOP, real: "1.2-1.4 m (horse paddock)"}
};
console.log("\nBuilt:");
console.log(JSON.stringify(built, null, 1));
out.built = built;

const json = process.argv.indexOf("--json");
if (json > 0) writeFileSync(process.argv[json + 1], JSON.stringify(out, null, 1));
