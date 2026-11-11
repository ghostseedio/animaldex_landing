#!/usr/bin/env -S npx tsx
/**
 * The Ark map's contact sheets (B4), drawn from the map's own data, no GPU:
 * `npx tsx scripts/ark-map-contact.mts <out dir>`. One sheet of the whole
 * island (the ground by its tags, the ~480 launch points by area) and one
 * per area (its launch points and the animals the validator placed there,
 * each labelled, by how it holds on).
 */
import {mkdirSync} from "node:fs";
import {join} from "node:path";
import sharp from "sharp";
import {mapPoints} from "../src/ark-scene/map/place.ts";
import {MAP_AREAS, TAG_AREA, type MapArea} from "../src/ark-scene/map/tags.ts";
import {validateMap, validatorAnimals} from "../src/ark-scene/map/validate.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: ark-map-contact.mts <out dir>");
mkdirSync(out, {recursive: true});
const COLOURS: Record<MapArea, string> = {
    open_water: "#1f5a8a", reef: "#ff8a6e", shallows: "#57b3c9", rocky_shore: "#6e6a64", beach: "#e8d08a", estuary: "#7a8a4e", cold_cove: "#e6f4fb",
    river: "#3e9be0", lake_marsh: "#4f8fb8", grassland: "#b8d060", scrub: "#8a9a50", canopy: "#2f7a3a", forest_floor: "#5a4a30", underground: "#7b5b3c",
    desert: "#e0b060", mountain: "#9a948a", homestead: "#d86a4a"
};
const sampler = mapPoints().sampler;
const points = mapPoints().all();
const {placed} = validateMap();
const animals = validatorAnimals();

function ground(x: number, z: number): string {
    const g = sampler.ground(x, z);
    if (g.water === "sea") return g.depth > 7 ? "#0f3a60" : g.depth > 3 ? "#1d5f90" : "#3f8fbf";
    if (g.water === "fresh") return "#4a9ad0";
    const area = g.tags.map((tag) => TAG_AREA[tag]).find((a) => a !== "canopy" && a !== "underground") ?? "grassland";
    return COLOURS[area];
}

async function sheet(name: string, x0: number, z0: number, x1: number, z1: number, labels: boolean, only: MapArea | null) {
    const W = 1400;
    const scale = W / (x1 - x0);
    const H = Math.round((z1 - z0) * scale);
    const step = Math.max((x1 - x0) / 140, 0.5);
    const px = (x: number) => ((x - x0) * scale).toFixed(1);
    const pz = (z: number) => ((z - z0) * scale).toFixed(1);
    const parts: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial" font-size="${labels ? 11 : 9}">`];
    for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) parts.push(`<rect x="${px(x)}" y="${pz(z)}" width="${(step * scale + 0.6).toFixed(1)}" height="${(step * scale + 0.6).toFixed(1)}" fill="${ground(x + step / 2, z + step / 2)}"/>`);
    for (const p of points) {
        const area = TAG_AREA[p.tag];
        if (only && area !== only) continue;
        parts.push(`<circle cx="${px(p.x)}" cy="${pz(p.z)}" r="${labels ? 7 : 4}" fill="none" stroke="#fff" stroke-width="2"/><circle cx="${px(p.x)}" cy="${pz(p.z)}" r="${labels ? 5 : 2.6}" fill="${COLOURS[area]}" stroke="#000" stroke-width="0.6"/>`);
        if (labels) parts.push(`<text x="${(Number(px(p.x)) + 8).toFixed(1)}" y="${pz(p.z)}" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${p.tag}</text>`);
    }
    if (labels) {
        let shown = 0;
        for (const a of animals) {
            const place = placed.get(a.id);
            if (!place?.map || place.map.held || !place.map.tag || (a.slot_rank ?? 0) !== 0) continue;
            if (only && TAG_AREA[place.map.tag] !== only) continue;
            if (place.x < x0 || place.x > x1 || place.z < z0 || place.z > z1) continue;
            const colour = place.host ? "#ff3cf0" : place.micro ? "#ffe14a" : place.canopy ? "#7dff6a" : place.burrow ? "#c08040" : place.water ? "#9fe8ff" : "#ffffff";
            parts.push(`<rect x="${(Number(px(place.x)) - 2.5).toFixed(1)}" y="${(Number(pz(place.z)) - 2.5).toFixed(1)}" width="5" height="5" fill="${colour}" stroke="#000" stroke-width="0.6"/>`);
            if (shown++ < 140) parts.push(`<text x="${(Number(px(place.x)) + 4).toFixed(1)}" y="${(Number(pz(place.z)) + 12).toFixed(1)}" font-size="9" fill="${colour}" stroke="#000" stroke-width="2" paint-order="stroke">${a.model_slug}</text>`);
        }
    }
    parts.push(`<rect x="0" y="0" width="${W}" height="26" fill="#000" opacity="0.6"/><text x="8" y="18" font-size="15" fill="#fff">${name} — launch points (circles, by area); ${labels ? "animals placed (squares: white ground, blue water, yellow attach point, green canopy limb, brown burrow, pink on a host)" : `${points.length} launch points`}</text></svg>`);
    await sharp(Buffer.from(parts.join(""))).png().toFile(join(out, `${name}.png`));
}

const half = sampler.half;
await sheet("island", -half, -half, half, half, false, null);
for (const area of MAP_AREAS) {
    const mine = points.filter((p) => TAG_AREA[p.tag] === area);
    if (!mine.length) continue;
    const xs = mine.map((p) => p.x);
    const zs = mine.map((p) => p.z);
    const pad = 6;
    let [x0, x1, z0, z1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad];
    const size = Math.max(x1 - x0, z1 - z0, 30);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    [x0, x1, z0, z1] = [cx - size / 2, cx + size / 2, cz - size / 2 * 0.7, cz + size / 2 * 0.7];
    await sheet(`area-${area}`, x0, z0, x1, z1, true, area);
}
console.log(`sheets in ${out}`);
