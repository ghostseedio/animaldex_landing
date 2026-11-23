#!/usr/bin/env -S npx tsx
/**
 * The live v3 rig set's own clip paces, for `ark-behaviour-profiles.mts` (its optional rig-v2 inputs, which `paceRig`
 * prefers): every species the published v3 manifest lists, with each clip's ground_speed, bls, duty, seconds and pass
 * flag as its published rig file carries them (glTF `extras.ark_rig.rig.clips`).
 *
 * (SPECIES-ANIM-A, 2026-11-24: the profiles' walkPace/runPace were still read from the v2 rig manifest of 11-11, so a
 * species re-rigged or re-baked since walked at the pace of a rig it no longer plays: the alpine marmot at 0.056 body
 * lengths a second, its v3 walk's own being 0.473.)
 *
 *   npx tsx scripts/ark-rig-v3-clips.mts <out-rig-manifest.json> <out-set-manifest.json> [glb-cache-dir]
 *
 * Reads (public, read-only): <storage>/talking-models/ark-rig/v3/manifest.json and each `<slug>/<version>.rig.glb`
 * (a file already in glb-cache-dir as `<slug>-<version>.glb` is read from there). Then:
 *
 *   npx tsx scripts/ark-behaviour-profiles.mts export.json manifest.json b1.json food.json <out-rig-manifest.json> <out-set-manifest.json>
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/ark-rig/v3";
const [outRig, outSet, cache] = process.argv.slice(2);
if (!outRig || !outSet) {
    console.error("usage: ark-rig-v3-clips.mts out-rig-manifest.json out-set-manifest.json [glb-cache-dir]");
    process.exit(1);
}

type Clip = {pass?: boolean; ground_speed?: number; duty?: number; bls?: number; seconds?: number; loop?: boolean};

async function bytes(url: string): Promise<Buffer> {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, {headers: {"Cache-Control": "no-cache"}});
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        if (attempt >= 2) throw new Error(`${res.status} ${url}`);
    }
}

/** The glTF JSON chunk of a .glb. */
function gltfJson(glb: Buffer): {extras?: {ark_rig?: {rig?: {plan?: string; clips?: Record<string, Clip>}}}} {
    const length = glb.readUInt32LE(12);
    return JSON.parse(glb.subarray(20, 20 + length).toString("utf8"));
}

const setBytes = await bytes(`${BASE}/manifest.json?t=${Date.now()}`);
const set = JSON.parse(setBytes.toString("utf8")) as {species: Record<string, string>};
const species: Record<string, {plan: string | null; state: string; version: string; clips_pass: string[]; clips: Record<string, Clip>}> = {};
const slugs = Object.keys(set.species).sort();
let fetched = 0;
for (let i = 0; i < slugs.length; i += 16) {
    await Promise.all(slugs.slice(i, i + 16).map(async (slug) => {
        const version = set.species[slug];
        const local = cache ? path.join(cache, `${slug}-${version}.glb`) : "";
        const glb = local && fs.existsSync(local) ? fs.readFileSync(local) : (fetched++, await bytes(`${BASE}/${slug}/${version}.rig.glb`));
        const rig = gltfJson(glb).extras?.ark_rig?.rig ?? {};
        const clips: Record<string, Clip> = {};
        for (const [name, c] of Object.entries(rig.clips ?? {})) {
            clips[name] = {pass: c.pass !== false, ground_speed: c.ground_speed, duty: c.duty, bls: c.bls, seconds: c.seconds, loop: c.loop};
        }
        species[slug] = {plan: rig.plan ?? null, state: "passed", version, clips_pass: Object.keys(clips).filter((c) => clips[c].pass), clips};
    }));
}
const sorted = Object.fromEntries(Object.keys(species).sort().map((s) => [s, species[s]]));
fs.writeFileSync(outRig, `${JSON.stringify({about: `ark-rig/v3 clip paces, read from the published rig files (${slugs.length} species)`, species: sorted})}\n`);
fs.writeFileSync(outSet, setBytes);
console.log(`${slugs.length} species, ${fetched} files fetched, ${slugs.length - fetched} from the cache`);

// --apply: only the paces (the profiles' walkPace/runPace, behaviours.json fields 14 and 15), exactly as
// ark-behaviour-profiles.mts sets them from these inputs (`clipPace` on the v2 path: a clip's bls, else its
// ground_speed), without a new catalogue export; every other field stays as generated. A species the v3 set doesn't
// list keeps its pace.
if (process.argv.includes("--apply")) {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
    const clipPace = (rig: (typeof species)[string] | undefined, names: string[]): number | null => {
        const ok = new Set(rig?.clips_pass ?? []);
        for (const name of names) {
            const clip = rig?.clips?.[name];
            if (!ok.has(name) || !clip?.ground_speed || clip.ground_speed <= 0) continue;
            return Math.round((clip.bls && clip.bls > 0 ? clip.bls : clip.ground_speed) * 1000) / 1000;
        }
        return null;
    };
    const pace = (slug: string): [number | null, number | null] | null =>
        species[slug] ? [clipPace(species[slug], ["walk", "slither", "hop"]), clipPace(species[slug], ["run"])] : null;

    const fullPath = path.join(root, "data/ark/behaviour-profiles.json");
    const full = JSON.parse(fs.readFileSync(fullPath, "utf8")) as {profiles: Array<{slug: string; walkPace: number | null; runPace: number | null}>};
    const changes: Array<[string, number | null, number | null, number | null, number | null]> = [];
    for (const p of full.profiles) {
        const next = pace(p.slug);
        if (!next) continue;
        if (next[0] !== p.walkPace || next[1] !== p.runPace) changes.push([p.slug, p.walkPace, next[0], p.runPace, next[1]]);
        [p.walkPace, p.runPace] = next;
    }
    const {profiles, ...head} = full;
    fs.writeFileSync(fullPath, `${JSON.stringify(head).slice(0, -1)},"profiles":[\n${profiles.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`);

    const compactPath = path.join(root, "src/ark-scene/behaviours.json");
    const compact = JSON.parse(fs.readFileSync(compactPath, "utf8")) as {about: string; species: Record<string, string>};
    for (const [slug, row] of Object.entries(compact.species)) {
        const next = pace(slug);
        if (!next) continue;
        const f = row.split("|");
        [f[14], f[15]] = [next[0] ?? "", next[1] ?? ""].map(String);
        compact.species[slug] = f.join("|");
    }
    fs.writeFileSync(compactPath, `{"about":${JSON.stringify(compact.about)},\n"species":{\n${Object.entries(compact.species)
        .map(([slug, row]) => `${JSON.stringify(slug)}:${JSON.stringify(row)}`)
        .join(",\n")}\n}}\n`);
    fs.writeFileSync(path.join(path.dirname(outRig), "pace-changes.json"), JSON.stringify(changes));
    console.log(`${changes.length} species' paces changed`);
}
