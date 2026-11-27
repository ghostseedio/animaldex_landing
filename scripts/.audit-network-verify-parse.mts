/**
 * PERF-WEB audit, verifier for NET-1 (pack the scenery GLBs): what the client would pay on the main thread when a pack
 * hands every entry over at once, against today's one-file-per-task arrival, and whether a pack slice parses to the same
 * geometry as the file. No browser, no network: GLTFLoader.parseAsync (three r170, meshopt, no workers) in Node.
 *
 *   npx tsx scripts/.audit-network-verify-parse.mts <glb-sets.json> [rounds]
 *
 * glb-sets.json: {cold: [{path, asked}], ...} from the live capture (asked < 60 s: the town's batch, else the wild's).
 */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {gzipSync} from "node:zlib";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {InstancedMesh, MeshStandardMaterial, type BufferGeometry, type Mesh} from "three";
import {parseArkPack, writeArkPack} from "@/ark-scene/streaming/pack";

const setsFile = process.argv[2];
const rounds = Number(process.argv[3] ?? "6");
const root = path.resolve("public/ark/assets/v1");
const sets = JSON.parse(readFileSync(setsFile, "utf8")) as {cold: Array<{path: string; asked: number}>};
const all = sets.cold.map((f) => f.path);
const wild = sets.cold.filter((f) => f.asked >= 60).map((f) => f.path);
const bytes = new Map<string, Uint8Array>();
for (const p of all) bytes.set(p, new Uint8Array(readFileSync(path.join(root, p))));
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

// 1. A pack round trip: each entry's bytes are the file's.
const files = all.map((p) => ({slug: p, version: sha(bytes.get(p)!).slice(0, 12), glb: bytes.get(p)!}));
const packed = writeArkPack("scenery", 0, files);
const pack = parseArkPack(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength) as ArrayBuffer);
let same = 0;
for (const f of files) {
    const slice = pack.glb(f.slug, f.version);
    if (slice && sha(new Uint8Array(slice)) === sha(f.glb)) same++;
}
console.log(`pack ${files.length} entries, ${(packed.byteLength / 1e6).toFixed(3)} MB raw, gzip-6 ${(gzipSync(packed, {level: 6}).byteLength / 1e6).toFixed(3)} MB; entries byte-identical to their files: ${same}/${files.length}`);

const material = new MeshStandardMaterial({vertexColors: true});
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
await MeshoptDecoder.ready;

const firstGeometry = (gltf: {scene: {traverse: (f: (o: unknown) => void) => void}}): BufferGeometry | null => {
    let geometry: BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
        if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry as BufferGeometry;
    });
    return geometry;
};
const geometryHash = (g: BufferGeometry) => {
    const h = createHash("sha256");
    for (const name of Object.keys(g.attributes).sort()) {
        const a = g.attributes[name] as unknown as {array: ArrayLike<number> & {buffer: ArrayBuffer; byteOffset: number; byteLength: number}; itemSize: number; normalized: boolean};
        h.update(`${name}:${a.itemSize}:${a.normalized}:`);
        h.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    }
    if (g.index) {
        const a = g.index.array as unknown as {buffer: ArrayBuffer; byteOffset: number; byteLength: number};
        h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    }
    return h.digest("hex");
};
const copyOf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

// 2. Parity: the file's bytes and the pack's slice parse to the same geometry.
let parity = 0;
for (const f of files) {
    const a = firstGeometry(await loader.parseAsync(copyOf(f.glb), "/ark/assets/v1/"));
    const b = firstGeometry(await loader.parseAsync(pack.glb(f.slug, f.version)!, "/ark/assets/v1/"));
    if (a && b && geometryHash(a) === geometryHash(b)) parity++;
}
console.log(`geometry parity (file vs pack slice): ${parity}/${files.length}`);

// 3. The cost: every wild entry handed over in the same tick (a pack), parse + the loaders' InstancedMesh, until all are in.
const use = (gltf: {scene: {traverse: (f: (o: unknown) => void) => void}}, count: number) => {
    const geometry = firstGeometry(gltf);
    if (!geometry) return;
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.count = 0;
};
const burst: number[] = [];
const each: number[] = [];
for (let r = 0; r < rounds; r++) {
    const buffers = wild.map((p) => copyOf(bytes.get(p)!));
    const t0 = performance.now();
    await Promise.all(buffers.map((buffer) => loader.parseAsync(buffer, "/ark/assets/v1/").then((gltf) => use(gltf, 200))));
    burst.push(performance.now() - t0);
    // One at a time (today's arrival: one file per task), each timed alone.
    for (const p of wild) {
        const buffer = copyOf(bytes.get(p)!);
        const s = performance.now();
        use(await loader.parseAsync(buffer, "/ark/assets/v1/"), 200);
        if (r === rounds - 1) each.push(performance.now() - s);
    }
}
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
const q = (list: number[], k: number) => sorted(list)[Math.min(list.length - 1, Math.round(k * (list.length - 1)))];
console.log(`wild set ${wild.length} files, ${(wild.reduce((s, p) => s + bytes.get(p)!.byteLength, 0) / 1e6).toFixed(2)} MB raw`);
console.log(`burst (all handed over in one tick, one task): ${burst.map((v) => v.toFixed(0)).join(" / ")} ms (first is cold)`);
console.log(`one at a time: per file p50 ${q(each, 0.5).toFixed(2)} ms p95 ${q(each, 0.95).toFixed(2)} max ${Math.max(...each).toFixed(2)} ms, sum ${each.reduce((s, v) => s + v, 0).toFixed(0)} ms`);
