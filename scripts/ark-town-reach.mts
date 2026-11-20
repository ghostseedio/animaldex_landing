#!/usr/bin/env -S npx tsx
/**
 * The town's reach file (AnimalDex decision 416, "if animals can't reach each other, no mating"; AnimalDex docs/ark/town-reach.md):
 * the town's connectivity mask, the spots its wildlife stands on and each species' niche, from the town's own plan, in the format
 * the server's `reach.ts` / `town-reach.ts` read (shared byte for byte, like the positions atlas and the forest stands).
 *
 *   npx tsx scripts/ark-town-reach.mts [--out src/ark-scene/positions/town-reach.json] [--check] [--picture <png>] [--parts <png>]
 *
 * The file is made by `src/ark-scene/islands/town/reach-file.ts` (the mask: `reach-mask.ts`: ground, canal, ponds, harbour,
 * buildings, hedges, walls, fences, zoo fences, gates, bridges, breakwaters). The generator FAILS if the file's pick of a wildlife
 * cluster's spot (`positions/town-reach.ts townHome`, the server's) is not the scene's (`placeTownAnimals`) for any of the sampled
 * (species, zone, slot), and writes the sample for the contract. `--check` regenerates and compares with the file on disk (exit 1
 * if they differ): the generated file is never edited by hand. Copy the file, reach.ts and town-reach.ts to AnimalDex
 * `supabase/functions/_shared/ark-positions/` and re-pin them (`src/ark-scene/positions/PIN.json` townReach).
 *
 * `--picture` draws the mask (sea blues, land green, walls and fences by who gets through, decks white, wildlife spots red);
 * `--parts` colours each part of the land for a small body that climbs (`1000b`), a small one that does not (`1000s`) and a walker
 * (`1000n`) and of the fresh water.
 */
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const out = path.resolve(root, arg("out", "src/ark-scene/positions/town-reach.json"));
const atlas = JSON.parse(readFileSync(path.join(root, "src/ark-scene/positions/atlas.json"), "utf8"));

const {townReachFile} = await import("../src/ark-scene/islands/town/reach-file.ts");
const {BAR, SMALL, CLIMB, DECK} = await import("../src/ark-scene/islands/town/reach-mask.ts");
const made = townReachFile(atlas);
if (made.misses.length) {
    console.error(`${made.misses.length} picks differ from the scene's:\n${made.misses.slice(0, 25).join("\n")}`);
    process.exit(1);
}

if (argv.includes("--check")) {
    const disk = readFileSync(out, "utf8");
    if (disk !== made.text) {
        console.error(`${out} is not what the town generates: run npx tsx scripts/ark-town-reach.mts`);
        process.exit(1);
    }
    console.log(`${out}: matches the town (${made.text.length} bytes, ${(made.file.cases as unknown[]).length} cases)`);
} else {
    writeFileSync(out, made.text);
    const f = made.file as {wheres: string[]; places: string[]; niches: unknown[]; kinds: Record<string, unknown>; cases: unknown[]};
    console.log(JSON.stringify({out, bytes: made.text.length, mask: `${made.mask.nx}x${made.mask.nz}`, cell: made.mask.cell, spots: made.spots.length, wheres: f.wheres.length, places: f.places.length, niches: f.niches.length, kinds: Object.keys(f.kinds).length, picksVerified: made.verified, cases: f.cases.length}));
}

const mask = made.mask;
const pic = arg("picture", "");
if (pic) {
    const rgb = Buffer.alloc(mask.nx * mask.nz * 3);
    for (let k = 0; k < mask.data.length; k++) {
        const v = mask.data[k];
        const med = v & 3;
        let c = [150, 200, 120];
        if (med === 3) c = [10, 40, 110];
        else if (med === 2) c = [40, 90, 170];
        else if (med === 1) c = [80, 170, 230];
        if (med === 0 && v & BAR) c = v & SMALL && v & CLIMB ? [200, 160, 60] : v & SMALL ? [160, 90, 30] : v & CLIMB ? [200, 60, 160] : [20, 20, 20];
        if (v & DECK) c = [255, 255, 255];
        rgb.set(c, k * 3);
    }
    for (const s of made.spots) {
        const i = Math.floor((s[0] / 10 - mask.x0) / mask.cell);
        const j = Math.floor((s[1] / 10 - mask.z0) / mask.cell);
        if (i >= 0 && j >= 0 && i < mask.nx && j < mask.nz) rgb.set([255, 0, 0], (j * mask.nx + i) * 3);
    }
    await sharp(rgb, {raw: {width: mask.nx, height: mask.nz, channels: 3}}).png().toFile(path.resolve(pic));
}

const partsPic = arg("parts", "");
if (partsPic) {
    // One panel per way: its parts in their own colours, the biggest part grey, every other part a bright colour.
    const n = mask.nx * mask.nz;
    const ways: Array<{name: string; ok: (v: number) => boolean}> = [
        {name: "1000n", ok: (v) => ((v & 3) === 0 && !(v & BAR)) || !!(v & DECK)},
        {name: "1000s", ok: (v) => ((v & 3) === 0 && (!(v & BAR) || !!(v & SMALL))) || !!(v & DECK)},
        {name: "1000b", ok: (v) => ((v & 3) === 0 && (!(v & BAR) || !!(v & (SMALL | CLIMB)))) || !!(v & DECK)},
        {name: "0100", ok: (v) => (v & 3) === 1}
    ];
    const panels: Buffer[] = [];
    for (const way of ways) {
        const part = new Int32Array(n).fill(-1);
        for (let c = 0; c < n; c++) if (way.ok(mask.data[c])) part[c] = -2;
        const sizes: number[] = [];
        const stack: number[] = [];
        for (let c = 0; c < n; c++) {
            if (part[c] !== -2) continue;
            const id = sizes.length;
            part[c] = id;
            stack.push(c);
            let size = 0;
            while (stack.length) {
                const k = stack.pop()!;
                size++;
                const i = k % mask.nx;
                const j = (k - i) / mask.nx;
                if (i > 0 && part[k - 1] === -2) (part[k - 1] = id), stack.push(k - 1);
                if (i + 1 < mask.nx && part[k + 1] === -2) (part[k + 1] = id), stack.push(k + 1);
                if (j > 0 && part[k - mask.nx] === -2) (part[k - mask.nx] = id), stack.push(k - mask.nx);
                if (j + 1 < mask.nz && part[k + mask.nx] === -2) (part[k + mask.nx] = id), stack.push(k + mask.nx);
            }
            sizes.push(size);
        }
        const biggest = sizes.indexOf(Math.max(...sizes));
        const rgb = Buffer.alloc(n * 3, 255);
        for (let c = 0; c < n; c++) {
            const p = part[c];
            if (p < 0) rgb.set([(mask.data[c] & 3) >= 2 ? 20 : 235, (mask.data[c] & 3) >= 2 ? 40 : 235, (mask.data[c] & 3) >= 2 ? 90 : 235], c * 3);
            else if (p === biggest) rgb.set([170, 170, 170], c * 3);
            else rgb.set([(p * 97) % 200 + 55, (p * 57 + 90) % 200 + 55, (p * 31 + 140) % 200 + 55], c * 3);
        }
        for (const s of made.spots) {
            const i = Math.floor((s[0] / 10 - mask.x0) / mask.cell);
            const j = Math.floor((s[1] / 10 - mask.z0) / mask.cell);
            if (i >= 0 && j >= 0 && i < mask.nx && j < mask.nz) rgb.set([0, 0, 0], (j * mask.nx + i) * 3);
        }
        console.log(`${way.name}: ${sizes.length} parts, biggest ${Math.max(...sizes)} of ${sizes.reduce((a, b) => a + b, 0)} cells`);
        panels.push(rgb);
    }
    const w = mask.nx;
    const h = mask.nz;
    const sheet = Buffer.alloc(w * 2 * h * 2 * 3, 255);
    panels.forEach((panel, k) => {
        const ox = (k % 2) * w;
        const oz = Math.floor(k / 2) * h;
        for (let j = 0; j < h; j++) panel.copy(sheet, ((oz + j) * w * 2 + ox) * 3, j * w * 3, (j + 1) * w * 3);
    });
    await sharp(sheet, {raw: {width: w * 2, height: h * 2, channels: 3}}).png().toFile(path.resolve(partsPic));
}
