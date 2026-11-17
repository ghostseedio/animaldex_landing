#!/usr/bin/env -S npx tsx
/**
 * The wild island's logging stands (owner 2026-11-17: humans "cutting down trees in the wild island … spawn in random
 * areas of lots of trees"; AnimalDex decision 378): discs of the v2 forest (rainforest, woodland) dense with the
 * scene's own trees, apart from each other, the water and the zones' sites. The shared forestry module
 * (`src/ark-scene/positions/forestry.ts`, a pinned copy of AnimalDex `_shared/ark-positions/forestry.ts`) schedules the
 * logging over these; the server kills by the same discs. Pure of the terrain: run again only when the island changes.
 *
 *   ARK_WORLD=v2 npx tsx scripts/ark-forest-stands.mts --out src/ark-scene/positions/forest-stands.json
 */
import {writeFileSync} from "node:fs";
const {sampleGround, zoneAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {worldDecor, forestFill} = await import("../src/ark-scene/decor.ts");
const {sampleWildGround, underWater} = await import("../src/ark-scene/islands/wild/ground.ts");
const {WILD_HALF} = await import("../src/ark-scene/islands/wild/frame.ts");

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);

/** The stand's radius (m): ~707 m², about eight of the island's true-size trees, a crew's day of felling. */
const R = Number(args.get("radius") ?? 15);
/** The v2 decor's tree kinds (`decor-v2.ts` treeItem); the forest fill is all trees. */
const TREE_KINDS = new Set(["rainforest", "palm", "broadleaf", "conifer", "acacia", "canopy"]);
const isTree = (kind: string) => TREE_KINDS.has(kind);
const trees: Array<{x: number; z: number}> = [];
for (const d of worldDecor()) if (isTree(String(d.kind))) trees.push({x: d.x, z: d.z});
for (const f of forestFill()) trees.push({x: f.x, z: f.z});

// The forest's land area (4 m cells whose zone is rainforest or woodland, on land).
let forestCells = 0;
const forestZone = (x: number, z: number) => {
    const s = sampleWildGround(x, z);
    if (underWater(s)) return null;
    const zone = zoneAt(sampleGround(x, z));
    return zone === "rainforest" || zone === "woodland" ? zone : null;
};
for (let z = -WILD_HALF + 2; z < WILD_HALF; z += 4) for (let x = -WILD_HALF + 2; x < WILD_HALF; x += 4) if (forestZone(x, z)) forestCells++;
const forestM2 = forestCells * 16;

// Candidates on a 3 m grid: the whole disc forest land (sampled on a ring and its middle), clear of water by 4 m, at
// least 24 m from every zone's site (the camera's fly-to and label), ranked by trees inside.
const cands: Array<{x: number; z: number; n: number; zone: string}> = [];
for (let z = -WILD_HALF + R; z < WILD_HALF - R; z += 3) {
    for (let x = -WILD_HALF + R; x < WILD_HALF - R; x += 3) {
        const zone = forestZone(x, z);
        if (!zone) continue;
        let ok = true;
        for (let a = 0; a < 12 && ok; a++) {
            const px = x + Math.cos((a / 12) * Math.PI * 2) * (R + 4), pz = z + Math.sin((a / 12) * Math.PI * 2) * (R + 4);
            if (!forestZone(px, pz)) ok = false;
        }
        if (!ok) continue;
        for (const s of Object.values(ZONE_SITES) as Array<{x: number; z: number}>) if (Math.hypot(s.x - x, s.z - z) < 24) ok = false;
        if (!ok) continue;
        let n = 0;
        for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < R * R) n++;
        cands.push({x, z, n, zone});
    }
}
cands.sort((a, b) => b.n - a.n || a.x - b.x || a.z - b.z);
const MIN_TREES = Number(args.get("min") ?? 6);
const stands: Array<{id: number; x: number; z: number; r: number; zone: string; trees: number}> = [];
for (const c of cands) {
    if (c.n < MIN_TREES) break;
    if (stands.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < 2 * R + 6)) continue;
    stands.push({id: stands.length, x: c.x, z: c.z, r: R, zone: c.zone, trees: c.n});
    if (stands.length >= 40) break;
}
const out = {v: 1, world: "v2", radius: R, forestM2, trees: trees.length, stands};
console.log(JSON.stringify({forestM2, trees: trees.length, candidates: cands.length, stands: stands.length, top: stands.slice(0, 5), last: stands.slice(-3)}));
if (args.get("out")) writeFileSync(args.get("out")!, JSON.stringify(out) + "\n");
