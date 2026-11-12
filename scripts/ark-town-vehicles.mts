#!/usr/bin/env -S npx tsx
/**
 * The town's vehicles (lane GB, docs/ark/town-island.md §4): Quaternius's CC0 "Cars" and "Public Transport" packs
 * (OBJ + MTL, material colours only, no textures, no logos) made into one small binary the town reads at run time,
 * `public/ark/assets/town-v1/vehicles.bin` (`src/ark-scene/islands/town/render/vehicles.ts` `parseVehicles`).
 *
 *   npx tsx scripts/ark-town-vehicles.mts --from <dir with Cars/*.obj and Transport/*.obj>
 *
 * Each model is turned to face +z, stood on y = 0, scaled to its true length (a saloon 4.6 m, a hatchback 4.1 m, an SUV
 * 4.5 m, a city car 3.6 m, a coupe 4.4 m, a bicycle 1.75 m), its materials sorted into a few classes (the paint, which
 * each car's own colour tints; dark trim and tyres; grey wheels and grilles; glass; head and tail lights), its parts
 * welded per class, and simplified to a second level with meshoptimizer (for the middle distance). The taxi's roof
 * sign is cut off, so it is a plain saloon (no branding). Downloads stay outside the repo; credits: docs/ark-credits.md.
 */

import {readFileSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {MeshoptSimplifier} from "meshoptimizer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const from = path.resolve(arg("from", path.join(root, "..", "gb-dl")));
const out = path.join(root, "public", "ark", "assets", "town-v1", "vehicles.bin");

/** Classes (the runtime's `VEHICLE_CLASSES`): 0 paint, 1 dark trim / tyres, 2 grey wheels and grilles, 3 glass, 4 headlight, 5 tail light, 6 saddle. */
type Model = {name: string; file: string; length: number; widthScale?: number; classes: Record<string, number>; cut?: (y: number, x: number, z: number) => boolean};
const MODELS: Model[] = [
    {name: "saloon", file: "quaternius-cars/Taxi.obj", length: 4.6, classes: {Yellow: 0, Black: 1, Grey: 2, Windows: 3, Headlights: 4, TailLights: 5}, cut: (y, x) => y >= 1.171 && Math.abs(x) < 0.6},
    {name: "hatchback", file: "quaternius-cars/NormalCar1.obj", length: 4.15, classes: {Blue: 0, Black: 1, Grey: 2, Windows: 3, Headlights: 4, TailLights: 5}},
    {name: "citycar", file: "quaternius-cars/NormalCar2.obj", length: 3.6, classes: {LightBlue: 0, Black: 1, Grey: 2, "Material.007": 1, Windows: 3, Headlights: 4, TailLights: 5}},
    {name: "suv", file: "quaternius-cars/SUV.obj", length: 4.5, widthScale: 0.86, classes: {White: 0, Black: 1, Grey: 2, Windows: 3, Headlights: 4, TailLights: 5}},
    {name: "coupe", file: "quaternius-cars/SportsCar.obj", length: 4.35, widthScale: 0.95, classes: {Orange: 0, DarkOrange: 1, Black: 1, Grey: 2, Windows: 3, Headlights: 4, TailLights: 5}},
    {name: "estate", file: "quaternius-cars/SportsCar2.obj", length: 4.4, widthScale: 0.96, classes: {White: 0, Black: 1, Grey: 2, Windows: 3, Headlights: 4, TailLights: 5}},
    {name: "bicycle", file: "quaternius-transport/Bicycle.obj", length: 1.75, classes: {Bike: 0, Handle: 1, Wheel: 1, "Material.003": 6}}
];

type Tri = {a: number[]; b: number[]; c: number[]; cls: number};

function readObj(model: Model): Tri[] {
    const text = readFileSync(path.join(from, model.file), "utf8");
    const vs: number[][] = [];
    const tris: Tri[] = [];
    let cls = -1;
    for (const line of text.split("\n")) {
        if (line.startsWith("v ")) vs.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
        else if (line.startsWith("usemtl")) {
            const name = line.trim().split(/\s+/)[1];
            if (!(name in model.classes)) throw new Error(`${model.name}: material ${name} has no class`);
            cls = model.classes[name];
        } else if (line.startsWith("f ")) {
            const idx = line.trim().split(/\s+/).slice(1).map((p) => Number(p.split("/")[0]) - 1);
            for (let k = 1; k + 1 < idx.length; k++) tris.push({a: vs[idx[0]], b: vs[idx[k]], c: vs[idx[k + 1]], cls});
        }
    }
    return tris;
}

/** Faces +z, stands on y = 0, centred in x and z, at its true length. */
function normalise(model: Model, tris: Tri[]): Tri[] {
    let kept = tris;
    if (model.cut) kept = kept.filter((t) => ![t.a, t.b, t.c].every((p) => model.cut!(p[1], p[0], p[2])));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
    for (const t of kept) for (const p of [t.a, t.b, t.c]) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    }
    const s = model.length / (z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = model.widthScale ?? 1;
    const map = (p: number[]) => [(p[0] - cx) * s * w, (p[1] - y0) * s, (p[2] - cz) * s];
    return kept.map((t) => ({a: map(t.a), b: map(t.b), c: map(t.c), cls: t.cls}));
}

type Level = {positions: Int16Array; classes: Uint8Array; indices: Uint16Array};

/** Welded per class (1 mm), so the simplifier sees each part as one surface. */
function weld(tris: Tri[]): {positions: number[]; classes: number[]; indices: number[]} {
    const key = new Map<string, number>();
    const positions: number[] = [];
    const classes: number[] = [];
    const indices: number[] = [];
    for (const t of tris) {
        for (const p of [t.a, t.b, t.c]) {
            const q = p.map((v) => Math.round(v * 1000));
            const k = `${t.cls}|${q.join(",")}`;
            let i = key.get(k);
            if (i === undefined) {
                i = classes.length;
                key.set(k, i);
                positions.push(...q);
                classes.push(t.cls);
            }
            indices.push(i);
        }
    }
    return {positions, classes, indices};
}

function level(welded: ReturnType<typeof weld>, share: number, lock = true): Level {
    let indices = welded.indices;
    if (share < 1) {
        // Each class on its own (its borders locked, so glass and paint still meet), to `share` of its triangles.
        const floats = new Float32Array(welded.positions.map((v) => v / 1000));
        const kept: number[] = [];
        const byClass = new Map<number, number[]>();
        for (let i = 0; i < welded.indices.length; i += 3) {
            const c = welded.classes[welded.indices[i]];
            const list = byClass.get(c) ?? [];
            list.push(welded.indices[i], welded.indices[i + 1], welded.indices[i + 2]);
            byClass.set(c, list);
        }
        for (const list of byClass.values()) {
            const target = Math.max(3, Math.floor((list.length * share) / 3) * 3);
            const [simple] = MeshoptSimplifier.simplify(new Uint32Array(list), floats, 3, target, lock ? 0.02 : 0.05, lock ? ["LockBorder"] : []);
            for (let i = 0; i < simple.length; i++) kept.push(simple[i]);
        }
        indices = kept;
    }
    // Compact: only the vertices the level uses.
    const remap = new Map<number, number>();
    const positions: number[] = [];
    const classes: number[] = [];
    const out: number[] = [];
    for (const i of indices) {
        let j = remap.get(i);
        if (j === undefined) {
            j = classes.length;
            remap.set(i, j);
            positions.push(welded.positions[i * 3], welded.positions[i * 3 + 1], welded.positions[i * 3 + 2]);
            classes.push(welded.classes[i]);
        }
        out.push(j);
    }
    if (classes.length > 65535) throw new Error("too many vertices for 16-bit indices");
    return {positions: Int16Array.from(positions), classes: Uint8Array.from(classes), indices: Uint16Array.from(out)};
}

await MeshoptSimplifier.ready;
const chunks: Buffer[] = [];
const header = {version: 1, models: [] as Array<{name: string; size: [number, number, number]; glass: [number, number, number, number]; levels: Array<{vertices: number; indices: number}>}>};
const report: string[] = [];
for (const model of MODELS) {
    const tris = normalise(model, readObj(model));
    const welded = weld(tris);
    // (The bicycle is small: both its levels are simplified, its parts free to move.)
    const bike = model.name === "bicycle";
    const levels = bike ? [level(welded, 0.3, false), level(welded, 0.1, false)] : [level(welded, 1), level(welded, 0.22)];
    // The glass's box (for the far proxy's cabin, made at run time): y from, y to, z from, z to (m).
    const glass = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < welded.classes.length; i++) {
        if (welded.classes[i] !== 3) continue;
        glass[0] = Math.min(glass[0], welded.positions[i * 3 + 1] / 1000);
        glass[1] = Math.max(glass[1], welded.positions[i * 3 + 1] / 1000);
        glass[2] = Math.min(glass[2], welded.positions[i * 3 + 2] / 1000);
        glass[3] = Math.max(glass[3], welded.positions[i * 3 + 2] / 1000);
    }
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < welded.positions.length; i += 3) {
        sx = Math.max(sx, Math.abs(welded.positions[i]) * 2);
        sy = Math.max(sy, welded.positions[i + 1]);
        sz = Math.max(sz, Math.abs(welded.positions[i + 2]) * 2);
    }
    header.models.push({name: model.name, size: [sx / 1000, sy / 1000, sz / 1000], glass: glass.map((v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0)) as [number, number, number, number], levels: levels.map((l) => ({vertices: l.classes.length, indices: l.indices.length}))});
    for (const l of levels) {
        const pad = (b: Buffer) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
        chunks.push(pad(Buffer.from(l.positions.buffer)), pad(Buffer.from(l.classes.buffer)), pad(Buffer.from(l.indices.buffer)));
    }
    report.push(`${model.name}: ${(sx / 1000).toFixed(2)} × ${(sy / 1000).toFixed(2)} × ${(sz / 1000).toFixed(2)} m, ${levels.map((l) => `${l.indices.length / 3} tris / ${l.classes.length} verts`).join(" → ")}`);
}
const json = Buffer.from(JSON.stringify(header));
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.write("ARKV", 0, "ascii");
head.writeUInt32LE(1, 4);
head.writeUInt32LE(jsonPadded.length, 8);
mkdirSync(path.dirname(out), {recursive: true});
const file = Buffer.concat([head, jsonPadded, ...chunks]);
writeFileSync(out, file);
console.log(report.join("\n"));
console.log(`${path.relative(root, out)}: ${(file.length / 1024).toFixed(1)} KB`);
