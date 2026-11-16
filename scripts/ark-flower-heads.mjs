#!/usr/bin/env node
/**
 * The wild island's wildflowers' heads (graphics pass 1, lane PLACE; the owner, 2026-11-16: "grasshoppers seem to be
 * floating next to flowers"): each flower asset's top head, from the asset library's own attach points
 * (`public/ark/assets/v1/plants/attach.json`, tag `flower_head`, in asset space), for the map's flower points
 * (`islands/wild/map-sampler.ts`). The map stood a small animal at the plant's middle at its full height: in a clump
 * ("b": three to five stems) that is air between the heads, and over a foxglove's spike a quarter metre above them.
 *
 * Writes `src/ark-scene/flower-heads.json` (bundled with the sampler): {source, heads: {assetId: [x, y, z]}}.
 *
 *   node scripts/ark-flower-heads.mjs           (re)write it
 *   node scripts/ark-flower-heads.mjs --check   say whether it is current
 */
import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "src/ark-scene/flower-heads.json");
const manifest = JSON.parse(readFileSync(path.join(root, "src/ark-scene/assets-manifest.json"), "utf8"));
const file = path.join(root, "public", manifest.base, "plants", "attach.json");

export function flowerHeads(text) {
    const attach = JSON.parse(text);
    const heads = {};
    for (const id of Object.keys(attach).sort()) {
        if (!id.startsWith("flower-")) continue;
        // (The top head: where a small animal lands on the plant, and the one seen first.)
        const top = attach[id].filter((p) => p.tag === "flower_head").sort((a, b) => b.p[1] - a.p[1] || a.p[0] - b.p[0])[0];
        if (top) heads[id] = top.p.map((v) => Math.round(v * 1000) / 1000);
    }
    return {source: createHash("sha256").update(text).digest("hex").slice(0, 16), heads};
}

const text = readFileSync(file, "utf8");
const want = JSON.stringify(flowerHeads(text), null, 1) + "\n";
if (process.argv.includes("--check")) {
    const current = readFileSync(OUT, "utf8");
    console.log(current === want ? "flower-heads.json is up to date" : "flower-heads.json is stale: run node scripts/ark-flower-heads.mjs");
    process.exit(current === want ? 0 : 1);
}
writeFileSync(OUT, want);
console.log(`${OUT}: ${Object.keys(JSON.parse(want).heads).length} flowers`);
