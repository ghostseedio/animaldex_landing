/**
 * PERF-WEB audit (area: network, identity verifier for NET-1): do the scenery GLBs read from an ARKP pack give the
 * same three.js geometry as the files read one by one? Untracked helper; writes nothing in the repo.
 *
 *  1. Packs the listed files (slug = path, version = sha12) with `streaming/pack.ts` writeArkPack, gzips the pack (level 9),
 *     inflates it again through DecompressionStream("gzip") (the client's proposed path) and checks the bytes.
 *  2. parseArkPack: every entry's bytes against its file (sha256).
 *  3. Parses every file two ways and hashes the whole result (every attribute's bytes, item size, normalisation, count
 *     and type, the index, morph attributes, groups, draw range, bounds, the node's transform, the material's settings):
 *     A: the file's own bytes, one shared loader, in list order, one at a time (as the per-file loaders' parse step);
 *     B: the pack's slices, one shared loader, all at once, in reverse order (shared-loader state, decode interleaving);
 *     C: the pack's slices, a fresh loader per file, path "/ark/assets/v1/" (the proposed parseAsync(buf, base + "/")).
 *
 *   npx tsx scripts/.audit-network-packparity.mts <assets dir> <paths.txt> [townCount]
 */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {performance} from "node:perf_hooks";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Mesh, MeshStandardMaterial, Object3D} from "three";
import {parseArkPack, writeArkPack} from "@/ark-scene/streaming/pack";

const dir = process.argv[2];
const paths = readFileSync(process.argv[3], "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
const townCount = Number(process.argv[4] ?? "0");
const sha = (b: Uint8Array | ArrayBuffer) => createHash("sha256").update(b instanceof ArrayBuffer ? new Uint8Array(b) : b).digest("hex");
const exact = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

const files = paths.map((path) => {
    const bytes = readFileSync(`${dir}/${path}`);
    return {path, bytes, sha: sha(bytes)};
});

function bytesOf(view: ArrayLike<number> & {buffer: ArrayBufferLike; byteOffset: number; byteLength: number}): Uint8Array {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}
function hashAttribute(h: ReturnType<typeof createHash>, name: string, a: BufferAttribute | InterleavedBufferAttribute) {
    h.update(`|attr:${name}:${a.itemSize}:${a.normalized}:${a.count}:`);
    if ((a as InterleavedBufferAttribute).isInterleavedBufferAttribute) {
        const ia = a as InterleavedBufferAttribute;
        h.update(`interleaved:${ia.data.stride}:${ia.offset}:${ia.data.array.constructor.name}:`);
        h.update(bytesOf(ia.data.array as unknown as Float32Array));
    } else {
        const ba = a as BufferAttribute;
        h.update(`${ba.array.constructor.name}:${(ba as {gpuType?: number}).gpuType ?? ""}:`);
        h.update(bytesOf(ba.array as unknown as Float32Array));
    }
}
function hashGltf(gltf: {scene: Object3D}): {hash: string; first: string} {
    const h = createHash("sha256");
    let first = "";
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
        h.update(`|node:${o.type}:${o.name}:${o.matrixWorld.elements.join(",")}`);
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        if (!first) first = o.name;
        const g = mesh.geometry as BufferGeometry;
        for (const name of Object.keys(g.attributes).sort()) hashAttribute(h, name, g.attributes[name] as BufferAttribute);
        if (g.index) {
            h.update(`|index:${g.index.count}:${g.index.array.constructor.name}:`);
            h.update(bytesOf(g.index.array as unknown as Uint16Array));
        }
        for (const name of Object.keys(g.morphAttributes).sort()) g.morphAttributes[name].forEach((a, i) => hashAttribute(h, `morph:${name}:${i}`, a as BufferAttribute));
        h.update(`|morphRel:${g.morphTargetsRelative}|groups:${JSON.stringify(g.groups)}|range:${g.drawRange.start},${g.drawRange.count}`);
        const bb = g.boundingBox;
        const bs = g.boundingSphere;
        h.update(`|bbox:${bb ? [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].join(",") : "none"}|bsphere:${bs ? [bs.center.x, bs.center.y, bs.center.z, bs.radius].join(",") : "none"}`);
        const m = mesh.material as MeshStandardMaterial;
        h.update(`|mat:${m.type}:${m.side}:${m.transparent}:${m.vertexColors}:${m.color?.getHexString?.()}:${m.roughness}:${m.metalness}:${m.alphaTest}:${m.flatShading}`);
    });
    return {hash: h.digest("hex"), first};
}
const newLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

async function main() {
    // 1. The pack, gzip-9, inflated through DecompressionStream.
    const packOf = (list: typeof files) => writeArkPack("scenery", 0, list.map((f) => ({slug: f.path, version: f.sha.slice(0, 12), glb: new Uint8Array(f.bytes)})));
    const pack = packOf(files);
    const gz = gzipSync(pack, {level: 9});
    const t0 = performance.now();
    const inflated = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    const inflateMs = performance.now() - t0;
    const packSame = sha(inflated) === sha(pack);
    const town = townCount ? packOf(files.slice(0, townCount)) : null;
    const wild = townCount ? packOf(files.slice(townCount)) : null;
    const perFileGz6 = files.reduce((s, f) => s + gzipSync(f.bytes, {level: 6}).byteLength, 0);
    console.log(`files ${files.length}, raw ${files.reduce((s, f) => s + f.bytes.byteLength, 0)} B; pack ${pack.byteLength} B, gzip-9 ${gz.byteLength} B; per-file gzip-6 sum ${perFileGz6} B`);
    if (town && wild) console.log(`town pack ${town.byteLength} B (gzip-9 ${gzipSync(town, {level: 9}).byteLength}); wild pack ${wild.byteLength} B (gzip-9 ${gzipSync(wild, {level: 9}).byteLength})`);
    console.log(`DecompressionStream round trip identical: ${packSame} (${inflateMs.toFixed(1)} ms, informational)`);

    // 2. Entries against files.
    const parsed = parseArkPack(inflated);
    let entryMismatch = 0;
    const slices = new Map<string, ArrayBuffer>();
    for (const f of files) {
        const slice = parsed.glb(f.path, f.sha.slice(0, 12));
        if (!slice || !(slice instanceof ArrayBuffer) || sha(slice) !== f.sha) entryMismatch++;
        else slices.set(f.path, slice);
    }
    console.log(`pack entries equal to their files (sha256): ${files.length - entryMismatch}/${files.length}`);

    // 3. Parse parity.
    const A = new Map<string, string>();
    const firstNames = new Map<string, string>();
    const shared = newLoader();
    const tA = performance.now();
    for (const f of files) {
        const gltf = await shared.parseAsync(exact(f.bytes), "");
        const {hash, first} = hashGltf(gltf);
        A.set(f.path, hash);
        firstNames.set(f.path, first);
    }
    const msA = performance.now() - tA;
    const B = new Map<string, string>();
    const sharedB = newLoader();
    const tB = performance.now();
    await Promise.all([...files].reverse().map(async (f) => {
        const gltf = await sharedB.parseAsync(slices.get(f.path)!.slice(0), "");
        B.set(f.path, hashGltf(gltf).hash);
    }));
    const msB = performance.now() - tB;
    const C = new Map<string, string>();
    for (const f of files) {
        const gltf = await newLoader().parseAsync(slices.get(f.path)!.slice(0), "/ark/assets/v1/");
        C.set(f.path, hashGltf(gltf).hash);
    }
    let diffB = 0;
    let diffC = 0;
    for (const f of files) {
        if (A.get(f.path) !== B.get(f.path)) diffB++;
        if (A.get(f.path) !== C.get(f.path)) diffC++;
    }
    const distinct = new Set(A.values()).size;
    console.log(`parse parity: A vs B (shared loader, concurrent, reversed) differ ${diffB}/${files.length}; A vs C (fresh loader, base path) differ ${diffC}/${files.length}; distinct hashes ${distinct}`);
    console.log(`parse time A ${msA.toFixed(0)} ms sequential, B ${msB.toFixed(0)} ms concurrent (informational)`);
    const all = createHash("sha256");
    for (const f of files) all.update(`${f.path}:${A.get(f.path)}\n`);
    console.log(`fingerprint over all geometry (A): ${all.digest("hex")}`);
}
void main();
