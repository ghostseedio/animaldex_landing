#!/usr/bin/env node
/**
 * Part B (docs/ark/streaming.md §6): the far-model pack per tier and the far files with their `ark.json` inside.
 *
 *   node scripts/ark-model-pack.mjs --out <dir> --kinds <kinds.json> [--src ~/animaldex-talking-models/ark]
 *        [--manifest <url|file>] [--bucket <url>] [--quality 85] [--serve-layout] [--verify]
 *
 * Reads the live model set's manifest (the public bucket's `talking-models/v1/ark/manifest.json` unless `--manifest`),
 * takes each kind's far model and `ark.json` from the local build (`--src`, the talking-models `ark/` folder, where its
 * own manifest lists the same version) or else from the bucket (read only), and writes into `<out>/packed/`:
 *
 *   <slug>/<version>.far-ark.glb   the far GLB with its ark.json as the glTF's `extras.ark` (one request a model);
 *                                  the mesh, skin and every other byte as published
 *   packs/far-<tier>-<hash>.arkpack the tier's starting-view kinds (`--kinds`: {"high": [...], "medium": [...],
 *                                  "low": [...]}, or `{tier: <a measure run's runtime.json>}` to take the run's
 *                                  first-asked far kinds), each a far-ark GLB with its skin fitted to the tier
 *                                  (256 px high and medium, 128 low; cwebp, `--quality`)
 *   manifest.json                  the live manifest plus `far_ark: true` and `packs: {tier: {file, kinds}}`
 *
 * Nothing is uploaded. `--serve-layout` also links every other file the scene reads (near GLBs; and a `<out>/base/`
 * copy of the live layout) so `scripts/ark-runtime-measure.mjs --models-dir <out>/packed|base` can measure both.
 * `--verify` re-reads every written GLB: the JSON parses, `extras.ark` is the ark.json, and the meshopt-compressed
 * geometry decodes to the same bytes as the published file's.
 *
 * The upload (owner-approved only), from `<out>/packed/`: the far-ark files and the packs first (immutable, a year's
 * cache), the manifest last (short cache) — the commands are printed at the end.
 */

import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, lstatSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const BUCKET = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const FAR_EDGE = {high: 256, medium: 256, low: 128};
const UPFRONT = {high: 160, medium: 120, low: 80};

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

const outRoot = path.resolve(arg("out", ".ark-golden/model-pack"));
const src = path.resolve(arg("src", path.join(os.homedir(), "animaldex-talking-models", "ark")).replace(/^~/, os.homedir()));
const bucket = arg("bucket", BUCKET).replace(/\/+$/, "");
const quality = Number(arg("quality", "85"));
const packed = path.join(outRoot, "packed");
const cache = path.join(outRoot, "cache");
mkdirSync(packed, {recursive: true});
mkdirSync(cache, {recursive: true});

// MARK: - Upload (owner-approved only)

if (process.argv[2] === "upload") {
    // `node scripts/ark-model-pack.mjs upload --out <dir>`: a dry run (lists what would go up) unless
    // ARK_PACK_UPLOAD_APPROVED=1 and SERVICE_KEY are set. The far-ark files and the packs first (versioned names,
    // immutable, a year's cache, never overwritten), the manifest last (10 minutes), as publish_ark.py does.
    const {readdirSync, statSync} = await import("node:fs");
    const approved = process.env.ARK_PACK_UPLOAD_APPROVED === "1";
    const key = process.env.SERVICE_KEY ?? "";
    const ref = arg("project-ref", "wwhsdzpczekgdlobwaej");
    if (approved && !key) throw new Error("SERVICE_KEY is not set");
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (lstatSync(full).isSymbolicLink()) continue;
            if (statSync(full).isDirectory()) walk(full);
            else if (name.endsWith(".far-ark.glb") || name.endsWith(".arkpack")) files.push(full);
        }
    };
    walk(packed);
    const put = async (rel, body, type, maxAge, upsert) => {
        if (!approved) return console.log(`PUT v1/ark/${rel}  ${body.length} B  ${type}  max-age=${maxAge}  x-upsert=${upsert}`);
        for (let attempt = 0; attempt < 4; attempt++) {
            const response = await fetch(`https://${ref}.supabase.co/storage/v1/object/talking-models/v1/ark/${rel}`, {method: "POST", body, headers: {Authorization: `Bearer ${key}`, apikey: key, "Content-Type": type, "Cache-Control": `max-age=${maxAge}`, "x-upsert": String(upsert)}});
            if (response.ok) return;
            const text = await response.text();
            // Versioned names: already there means already right.
            if (!upsert && (response.status === 400 || response.status === 409) && /Duplicate|exists|409/.test(text)) return;
            console.error(`  ${rel}: HTTP ${response.status} ${text.slice(0, 200)}`);
            await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        }
        throw new Error(`${rel}: upload failed`);
    };
    for (const file of files) await put(path.relative(packed, file).split(path.sep).join("/"), readFileSync(file), file.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream", 31536000, false);
    await put("manifest.json", readFileSync(path.join(packed, "manifest.json")), "application/json", 600, true);
    log(approved ? `uploaded ${files.length} files and the manifest` : `dry run: ${files.length} files and the manifest (ARK_PACK_UPLOAD_APPROVED=1 SERVICE_KEY=… to upload)`);
    process.exit(0);
}

// MARK: - GLB

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function readGlb(buffer) {
    if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) throw new Error("not a glTF 2 binary");
    let at = 12;
    let json = null;
    let bin = Buffer.alloc(0);
    while (at < buffer.length) {
        const length = buffer.readUInt32LE(at);
        const type = buffer.readUInt32LE(at + 4);
        const body = buffer.subarray(at + 8, at + 8 + length);
        if (type === JSON_CHUNK) json = JSON.parse(body.toString("utf8"));
        else if (type === BIN_CHUNK) bin = Buffer.from(body);
        at += 8 + length;
    }
    if (!json) throw new Error("no JSON chunk");
    return {json, bin};
}

export function writeGlb(json, bin) {
    let text = JSON.stringify(json);
    while (Buffer.byteLength(text) % 4) text += " ";
    const head = Buffer.from(text, "utf8");
    const pad = (4 - (bin.length % 4)) % 4;
    const body = Buffer.concat([bin, Buffer.alloc(pad)]);
    const out = Buffer.alloc(12 + 8 + head.length + (body.length ? 8 + body.length : 0));
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(head.length, 12);
    out.writeUInt32LE(JSON_CHUNK, 16);
    head.copy(out, 20);
    if (body.length) {
        out.writeUInt32LE(body.length, 20 + head.length);
        out.writeUInt32LE(BIN_CHUNK, 24 + head.length);
        body.copy(out, 28 + head.length);
    }
    return out;
}

/** Every region of the binary buffer (index 0) a bufferView or a meshopt extension points at. */
function binRegions(json) {
    const regions = [];
    (json.bufferViews ?? []).forEach((view, index) => {
        if (view.buffer === 0) regions.push({holder: view, view: index});
        const meshopt = view.extensions?.EXT_meshopt_compression;
        if (meshopt && meshopt.buffer === 0) regions.push({holder: meshopt, view: -1});
    });
    return regions.sort((a, b) => a.holder.byteOffset - b.holder.byteOffset);
}

/** The GLB with `ark` as its `extras.ark` and (edge > 0) its skin fitted to `edge` px. */
export function embedArk(glb, ark, edge = 0) {
    const {json, bin} = readGlb(glb);
    json.extras = {...(json.extras ?? {}), ark};
    if (!edge) return writeGlb(json, bin);
    const imageView = json.images?.[0]?.bufferView;
    if (imageView === undefined || json.images[0].mimeType !== "image/webp") return writeGlb(json, bin);
    const view = json.bufferViews[imageView];
    const skin = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const fitted = fitWebp(skin, edge);
    if (!fitted) return writeGlb(json, bin);
    // Rebuild the binary buffer region by region, the skin replaced, each region 4-byte aligned.
    const parts = [];
    let cursor = 0;
    let lastEnd = -1;
    for (const region of binRegions(json)) {
        const offset = region.holder.byteOffset ?? 0;
        if (offset < lastEnd) throw new Error("overlapping regions");
        lastEnd = offset + region.holder.byteLength;
        const bytes = region.view === imageView ? fitted : bin.subarray(offset, offset + region.holder.byteLength);
        const aligned = Math.ceil(cursor / 4) * 4;
        if (aligned > cursor) parts.push(Buffer.alloc(aligned - cursor));
        region.holder.byteOffset = aligned;
        region.holder.byteLength = bytes.length;
        parts.push(Buffer.from(bytes));
        cursor = aligned + bytes.length;
    }
    json.buffers[0].byteLength = cursor;
    return writeGlb(json, Buffer.concat(parts));
}

const fitted = new Map();
function fitWebp(skin, edge) {
    const key = `${createHash("sha1").update(skin).digest("hex")}-${edge}`;
    if (fitted.has(key)) return fitted.get(key);
    const dir = path.join(cache, "skins");
    mkdirSync(dir, {recursive: true});
    const from = path.join(dir, `${key}-in.webp`);
    const to = path.join(dir, `${key}.webp`);
    if (!existsSync(to)) {
        writeFileSync(from, skin);
        // Only ever smaller: a skin at or under the edge is kept as it is.
        const info = execFileSync("webpinfo", [from], {encoding: "utf8"});
        const width = Number(/Width:\s*(\d+)/.exec(info)?.[1] ?? 0);
        const height = Number(/Height:\s*(\d+)/.exec(info)?.[1] ?? 0);
        if (!width || Math.max(width, height) <= edge) {
            fitted.set(key, null);
            return null;
        }
        const scale = edge / Math.max(width, height);
        execFileSync("cwebp", ["-quiet", "-resize", String(Math.max(1, Math.round(width * scale))), String(Math.max(1, Math.round(height * scale))), "-q", String(quality), "-m", "6", from, "-o", to]);
        rmSync(from);
    }
    const out = readFileSync(to);
    fitted.set(key, out);
    return out;
}

// MARK: - Sources

async function getJson(where) {
    if (/^https?:/.test(where)) {
        const response = await fetch(where);
        if (!response.ok) throw new Error(`${where}: ${response.status}`);
        return response.json();
    }
    return JSON.parse(readFileSync(where, "utf8"));
}

const live = await getJson(arg("manifest", `${bucket}/manifest.json`));
const local = existsSync(path.join(src, "manifest.json")) ? JSON.parse(readFileSync(path.join(src, "manifest.json"), "utf8")) : {models: {}};
const slugs = Object.keys(live.models).sort();
let downloaded = 0;

/** A published file of a kind: the local build's when its manifest lists the same version, else the bucket's (cached). */
async function published(slug, version, file) {
    const localName = {"far.glb": "far.glb", "near.glb": "near.glb", "ark.json": "ark.json"}[file];
    if (local.models?.[slug] === version && existsSync(path.join(src, slug, localName))) return {path: path.join(src, slug, localName)};
    const cached = path.join(cache, "bucket", slug, `${version}.${file}`);
    if (!existsSync(cached)) {
        const response = await fetch(`${bucket}/${encodeURIComponent(slug)}/${version}.${file}`);
        if (!response.ok) throw new Error(`${slug} ${file}: ${response.status}`);
        mkdirSync(path.dirname(cached), {recursive: true});
        writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
        downloaded++;
    }
    return {path: cached};
}

// MARK: - Kinds per tier

async function kindsPerTier() {
    const where = arg("kinds", "");
    if (!where) return {};
    const raw = JSON.parse(readFileSync(where, "utf8"));
    const out = {};
    for (const [tier, value] of Object.entries(raw)) {
        if (Array.isArray(value)) out[tier] = value;
        else if (typeof value === "string") {
            // A measure run's runtime.json: the far kinds in the order its runs first asked for them, the tier's up-front count.
            const rows = JSON.parse(readFileSync(path.resolve(path.dirname(where), value), "utf8"));
            const order = [];
            for (const row of rows) for (const slug of row.library?.farOrder ?? []) if (!order.includes(slug)) order.push(slug);
            out[tier] = order.slice(0, UPFRONT[tier] ?? 120);
        }
    }
    return out;
}

// MARK: - Build

const kinds = await kindsPerTier();
let written = 0;
let bytesBefore = 0;
let bytesAfter = 0;
const verify = flag("verify");
const decoder = verify ? (await import("three/examples/jsm/libs/meshopt_decoder.module.js")).MeshoptDecoder : null;
if (decoder) await decoder.ready;

function decodedGeometry(glb) {
    const {json, bin} = readGlb(glb);
    const out = [];
    for (const view of json.bufferViews ?? []) {
        const meshopt = view.extensions?.EXT_meshopt_compression;
        if (!meshopt) continue;
        const target = new Uint8Array(meshopt.count * meshopt.byteStride);
        const source = new Uint8Array(bin.buffer, bin.byteOffset + (meshopt.byteOffset ?? 0), meshopt.byteLength);
        decoder.decodeGltfBuffer(target, meshopt.count, meshopt.byteStride, source, meshopt.mode, meshopt.filter);
        out.push(Buffer.from(target).toString("base64"));
    }
    return out;
}

function check(original, made, ark, slug) {
    const {json} = readGlb(made);
    if (JSON.stringify(json.extras?.ark) !== JSON.stringify(ark)) throw new Error(`${slug}: extras.ark differs`);
    const a = decodedGeometry(original);
    const b = decodedGeometry(made);
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) throw new Error(`${slug}: geometry differs`);
}

for (const slug of slugs) {
    const version = live.models[slug];
    const far = readFileSync((await published(slug, version, "far.glb")).path);
    const ark = JSON.parse(readFileSync((await published(slug, version, "ark.json")).path, "utf8"));
    const made = embedArk(far, ark, 0);
    if (verify) check(far, made, ark, slug);
    const to = path.join(packed, slug, `${version}.far-ark.glb`);
    mkdirSync(path.dirname(to), {recursive: true});
    writeFileSync(to, made);
    written++;
    bytesBefore += far.length;
    bytesAfter += made.length;
    if (flag("serve-layout")) {
        const near = (await published(slug, version, "near.glb")).path;
        const link = (target, at) => {
            mkdirSync(path.dirname(at), {recursive: true});
            try {
                if (lstatSync(at)) rmSync(at);
            } catch {
                // Not there yet.
            }
            symlinkSync(target, at);
        };
        link(near, path.join(packed, slug, `${version}.near.glb`));
        const base = path.join(outRoot, "base", slug);
        link((await published(slug, version, "far.glb")).path, path.join(base, `${version}.far.glb`));
        link(near, path.join(base, `${version}.near.glb`));
        link((await published(slug, version, "ark.json")).path, path.join(base, `${version}.ark.json`));
    }
}
log(`far-ark files: ${written} (${(bytesBefore / 2 ** 20).toFixed(1)} → ${(bytesAfter / 2 ** 20).toFixed(1)} MB with the ark.json inside); ${downloaded} files fetched from the bucket`);

const manifest = {...live, far_ark: true, packs: {}};
mkdirSync(path.join(packed, "packs"), {recursive: true});
for (const [tier, list] of Object.entries(kinds)) {
    const edge = FAR_EDGE[tier] ?? 256;
    const files = [];
    for (const slug of list) {
        const version = live.models[slug];
        if (!version) continue;
        const far = readFileSync((await published(slug, version, "far.glb")).path);
        const ark = JSON.parse(readFileSync((await published(slug, version, "ark.json")).path, "utf8"));
        const glb = embedArk(far, ark, edge);
        if (verify) check(far, glb, ark, slug);
        files.push({slug, version, glb});
    }
    // The same layout as src/ark-scene/streaming/pack.ts writeArkPack.
    const entries = [];
    let offset = 0;
    for (const file of files) {
        entries.push({slug: file.slug, version: file.version, offset, length: file.glb.length});
        offset += Math.ceil(file.glb.length / 4) * 4;
    }
    let header = JSON.stringify({tier, far: edge, entries});
    while (Buffer.byteLength(header) % 4) header += " ";
    const head = Buffer.from(header, "utf8");
    const pack = Buffer.alloc(12 + head.length + offset);
    pack.writeUInt32LE(0x504b5241, 0);
    pack.writeUInt32LE(1, 4);
    pack.writeUInt32LE(head.length, 8);
    head.copy(pack, 12);
    files.forEach((file, i) => file.glb.copy(pack, 12 + head.length + entries[i].offset));
    const name = `packs/far-${tier}-${createHash("sha256").update(pack).digest("hex").slice(0, 12)}.arkpack`;
    writeFileSync(path.join(packed, name), pack);
    manifest.packs[tier] = {file: name, kinds: files.map((file) => file.slug)};
    const singles = files.reduce((sum, file) => sum + readFileSync(path.join(packed, file.slug, `${file.version}.far-ark.glb`)).length, 0);
    log(`pack ${tier}: ${files.length} kinds, ${(pack.length / 2 ** 20).toFixed(2)} MB (the same kinds as single far files: ${(singles / 2 ** 20).toFixed(2)} MB, ${files.length * 2} requests before, 1 now) → ${name}`);
}
writeFileSync(path.join(packed, "manifest.json"), JSON.stringify(manifest));
if (flag("serve-layout")) writeFileSync(path.join(outRoot, "base", "manifest.json"), JSON.stringify(live));
log(`manifest → ${path.join(packed, "manifest.json")}`);

console.log(`
Upload (owner-approved only; this run uploaded nothing). A dry run first, then the upload:
  node scripts/ark-model-pack.mjs upload --out ${outRoot}
  ARK_PACK_UPLOAD_APPROVED=1 SERVICE_KEY=<service_role key> node scripts/ark-model-pack.mjs upload --out ${outRoot}
The far-ark files and packs go up first under new, versioned names (nothing published changes); the manifest last.
A client that read the old manifest keeps loading the old files, which stay.
`);
