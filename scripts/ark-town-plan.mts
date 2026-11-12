#!/usr/bin/env -S npx tsx
/**
 * The town island's plan as a picture (docs/ark/town-island.md): the coast, the streets, the canal, every building,
 * parcel, green, water, farm and zoo slot, drawn from `islands/town/plan.ts` at 1 px = `--scale` m.
 *
 *   npx tsx scripts/ark-town-plan.mts [--out .ark-golden/town/plan.png] [--scale 2]
 *   npx tsx scripts/ark-town-plan.mts --validate [--real <snapshot.json>]   the validator (exit 1 on errors); the
 *                                     snapshot is read in place for its house and farm counts only
 *   npx tsx scripts/ark-town-plan.mts --obstacles [--json <file>]           L5's obstacle footprints
 */

import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {coastNorm, landArea, townPlan, townPlanMisses, TOWN_HALF, CANAL_WIDTH} from "../src/ark-scene/islands/town/plan";
import {corners, type Poly} from "../src/ark-scene/islands/town/geom";
import {townAreaSummary} from "../src/ark-scene/islands/town/summary";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const scale = Number(arg("scale", "2"));
if (argv.includes("--validate")) {
    const {validateTown} = await import("../src/ark-scene/islands/town/validate");
    let real: {house?: number; farm?: number} | undefined;
    const file = arg("real", "");
    if (file) {
        const snapshot = JSON.parse((await import("node:fs")).readFileSync(file, "utf8")) as {animals: Array<{area?: string | null}>};
        real = {house: snapshot.animals.filter((a) => a.area === "house").length, farm: snapshot.animals.filter((a) => a.area === "farm").length};
    }
    const result = validateTown(undefined, real);
    console.log(JSON.stringify(result.metrics, null, 1));
    for (const w of result.warnings) console.log("warning:", w);
    for (const e of result.errors) console.log("ERROR:", e);
    console.log(`${result.errors.length} errors, ${result.warnings.length} warnings`);
    process.exit(result.errors.length ? 1 : 0);
}
if (argv.includes("--obstacles")) {
    const {townObstaclesJSON} = await import("../src/ark-scene/islands/town/obstacles");
    const file = path.resolve(arg("json", path.join(root, ".ark-golden", "town", "town-obstacles.json")));
    mkdirSync(path.dirname(file), {recursive: true});
    const json = townObstaclesJSON();
    writeFileSync(file, json);
    console.log(`${file}: ${(json.length / 1024).toFixed(0)} KB`);
    process.exit(0);
}
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "town", "plan.png")));
mkdirSync(path.dirname(out), {recursive: true});

const size = Math.round(TOWN_HALF * 2 * scale);
const X = (x: number) => ((x + TOWN_HALF) * scale).toFixed(1);
const Z = (z: number) => ((z + TOWN_HALF) * scale).toFixed(1);
const pts = (poly: Poly) => poly.map((p) => `${X(p.x)},${Z(p.z)}`).join(" ");
const plan = townPlan();
const parts: string[] = [];

// Land, sampled.
const step = 2;
for (let x = -TOWN_HALF; x < TOWN_HALF; x += step) {
    for (let z = -TOWN_HALF; z < TOWN_HALF; z += step) {
        if (coastNorm(x + 1, z + 1) < 1) parts.push(`<rect x="${X(x)}" y="${Z(z)}" width="${step * scale}" height="${step * scale}" fill="#cfe0b0"/>`);
    }
}
const greenFill: Record<string, string> = {park: "#9fcf86", churchyard: "#8fbf7a", allotments: "#b9c98a", wood: "#6fa063", wild_corner: "#a7c47e", green: "#b2d99a", orchard: "#a4c47a", field: "#e3d59a", paddock: "#bfd88f", farmyard: "#d9c7a0", zoo_lawn: "#a8d39a", beach: "#efe0b4", verge: "#c2dca6"};
for (const g of plan.greens) parts.push(`<polygon points="${pts(g.poly)}" fill="${greenFill[g.kind] ?? "#bde0a0"}" stroke="#7a9a60" stroke-width="0.5"/>`);
for (const w of plan.waters) parts.push(`<polygon points="${pts(w.poly)}" fill="#6fa8c8"/>`);
parts.push(`<polyline points="${pts(plan.canal)}" fill="none" stroke="#6fa8c8" stroke-width="${CANAL_WIDTH * scale}"/>`);
for (const s of plan.streets) {
    const colour = s.kind === "high" ? "#8a8580" : s.kind === "road" ? "#9a9590" : s.kind === "lane" ? "#b8a888" : s.kind === "track" ? "#c8b38a" : s.kind === "zoo_path" ? "#d8c49a" : s.kind === "quay" ? "#a8a090" : "#c9bba0";
    if (s.pavement) parts.push(`<polyline points="${pts(s.line)}" fill="none" stroke="#d0ccc4" stroke-width="${(s.width + s.pavement * 2) * scale}" stroke-linejoin="round"/>`);
    parts.push(`<polyline points="${pts(s.line)}" fill="none" stroke="${colour}" stroke-width="${s.width * scale}" stroke-linejoin="round"/>`);
}
for (const p of plan.parcels) {
    if (p.front) parts.push(`<polygon points="${pts(corners(p.front))}" fill="#b6dba0" stroke="none"/>`);
    if (p.back) parts.push(`<polygon points="${pts(corners(p.back))}" fill="#a6d390" stroke="none"/>`);
    if (p.drive) parts.push(`<polygon points="${pts(corners(p.drive))}" fill="#bbb4a8"/>`);
}
for (const f of plan.farms) parts.push(`<polygon points="${pts(corners(f.at))}" fill="none" stroke="#8a6a40" stroke-width="1" stroke-dasharray="3 2"/>`);
const zooColour: Record<string, string> = {aviaries: "#b0d0f0", aquarium: "#5090d0", reptile_house: "#90b060", savanna_paddocks: "#e0c070", childrens_farm: "#e0b0a0", small_mammals: "#c0a080", primate_house: "#80a040", hoofstock_paddocks: "#d0b080", nocturnal_house: "#606090", bears_wolves: "#907060", insect_house: "#c0d040", penguin_seal_pools: "#70c0e0", big_cats: "#e09040"};
for (const s of plan.zoo.slots) parts.push(`<polygon points="${pts(corners(s.at))}" fill="${zooColour[s.type]}" fill-opacity="0.75" stroke="#333" stroke-width="0.6"/><text x="${X(s.at.x)}" y="${Z(s.at.z)}" font-size="${4 * scale}" text-anchor="middle" fill="#111">${s.type.slice(0, 4)}${s.rank + 1}</text>`);
for (const sp of plan.zoo.spares) parts.push(`<polygon points="${pts(corners(sp.at))}" fill="#d8e8c8" stroke="#333" stroke-width="0.6" stroke-dasharray="3 2"/><text x="${X(sp.at.x)}" y="${Z(sp.at.z)}" font-size="${4 * scale}" text-anchor="middle" fill="#111">${sp.id}</text>`);
for (const h of plan.hedges) parts.push(`<polyline points="${pts(h.line)}" fill="none" stroke="${h.kind === "hedge" ? "#3f7a3a" : h.kind === "zoo_fence" ? "#553" : "#8a7a66"}" stroke-width="${0.5 * scale}"/>`);
for (const b of plan.buildings) {
    const fill = b.kind === "house" ? "#c8705a" : b.kind === "terrace" ? "#a85a48" : b.kind === "flats" ? "#9a8a80" : b.kind === "shop" ? "#c09060" : b.kind === "church" ? "#807870" : b.kind.startsWith("zoo") ? "#6a8a9a" : "#a07850";
    parts.push(`<polygon points="${pts(corners(b.at))}" fill="${fill}" stroke="#222" stroke-width="0.5"/>`);
}
for (const t of plan.trees) parts.push(`<circle cx="${X(t.x)}" cy="${Z(t.z)}" r="${2.2 * t.scale * scale}" fill="#3f8a3a" fill-opacity="0.8"/>`);
for (const m of plan.moorings) parts.push(`<circle cx="${X(m.x)}" cy="${Z(m.z)}" r="${1.5 * scale}" fill="#fff"/>`);
// A 50 m grid and the chunks.
for (let v = -TOWN_HALF; v <= TOWN_HALF + 0.1; v += 52.8) parts.push(`<line x1="${X(v)}" y1="0" x2="${X(v)}" y2="${size}" stroke="#000" stroke-opacity="0.12"/><line x1="0" y1="${Z(v)}" x2="${size}" y2="${Z(v)}" stroke="#000" stroke-opacity="0.12"/>`);
const summary = townAreaSummary(plan, landArea(2));
parts.push(`<text x="8" y="${18}" font-size="14" font-family="monospace">${summary.replace(/&/g, "&amp;")}</text>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#7fb2d0"/>${parts.join("")}</svg>`;
writeFileSync(out.replace(/\.png$/, ".svg"), svg);
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(summary);
const misses = townPlanMisses();
if (misses.length) console.log(`misses (${misses.length}): ${misses.join(", ")}`);
console.log(out);
