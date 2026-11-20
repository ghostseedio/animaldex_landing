#!/usr/bin/env -S npx tsx
/**
 * The contact audit (lane ARK-CONTACT, decision 447): every species' contact with what it is on, state by state, before
 * this lane's rules and with them (`src/ark-scene/grounding/contact-audit.ts`), plus, with `--rigs <set>`, the clips that
 * lift a body off the ground when played in place (a local rig set's `.rig.glb` files, read only).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-contact-audit.mts [--validator | <snapshot.json>] [--rigs <dir>] [--json out.json]
 *
 * Only counts and species slugs are printed or written.
 */
import {readdirSync, readFileSync, writeFileSync, existsSync} from "node:fs";
import path from "node:path";
import {auditContact} from "../src/ark-scene/grounding/contact-audit.ts";
import {decodeArkSnapshot} from "../src/ark-scene/snapshot.ts";
import {validatorAnimals} from "../src/ark-scene/map/validate.ts";
import {feetCarryClip, modelBase} from "../src/ark-scene/grounding/base.ts";
import {IN_PLACE_LIFT_FREE} from "../src/ark-scene/grounding/contact.ts";
import type {ArkAnimal} from "../src/ark-scene/types.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const source = args[0] && !args[0].startsWith("--") ? args[0] : "--validator";
let animals: ArkAnimal[];
if (source === "--validator") animals = validatorAnimals();
else {
    const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(source, "utf8")));
    if (!snapshot) throw new Error("not a snapshot");
    animals = snapshot.animals;
}
const started = Date.now();
const audit = auditContact(animals);
console.log(`${audit.animals} animals, ${audit.species} species (${((Date.now() - started) / 1000).toFixed(0)} s)`);
console.log("state    samples   before: samples/species   after: samples/species");
for (const state of Object.keys(audit.samples) as Array<keyof typeof audit.samples>) {
    const b = audit.offenders.before[state];
    const a = audit.offenders.after[state];
    console.log(`${state.padEnd(8)} ${String(audit.samples[state]).padStart(7)}   ${String(b.samples).padStart(7)} / ${String(b.species).padEnd(5)}            ${String(a.samples).padStart(7)} / ${a.species}`);
}
for (const rules of ["before", "after"] as const) {
    const byState = new Map<string, string[]>();
    for (const o of audit.worst[rules]) {
        const list = byState.get(o.state) ?? [];
        if (list.length < 6 && !list.some((l) => l.startsWith(o.slug + ":"))) list.push(`${o.slug}: ${o.detail}`);
        byState.set(o.state, list);
    }
    console.log(`\n${rules}: worst by state`);
    for (const [state, list] of byState) console.log(`  ${state}: ${list.join("; ")}`);
}

// Clip lift: a clip played in place (not a gait, a standing clip, a path's take-off or landing, a flight, a leap along a
// limb) whose root rises over its rest past a bob for most of it: the body hovers over its shadow.
type RigLift = {slug: string; clip: string; mean: number; peak: number};
const rigDir = value("--rigs");
const lifts: RigLift[] = [];
let clipsSeen = 0;
if (rigDir) {
    const {GLTFLoader} = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const {MeshoptDecoder} = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
    const {boneMajorToRows, halfToFloat, restGeometry} = await import("../src/ark-scene/rig-player.ts");
    const {PATH_CARRIED_CLIPS} = await import("../src/ark-scene/rig-player.ts");
    await MeshoptDecoder.ready;
    const FLIGHT = /^(flap|glide|soar|hover|takeoff|land|bank_l|bank_r|plunge|dive|leap|sleep|lie|side|roll|wallow|get_up|lie_down|hang|perch|cling|surface|breach|spyhop|lobtail|float|swim|paddle)/;
    // (On the ground only: a whale's surfacing is the water's.)
    const WATER_PLANS = new Set(["cetacean", "fish", "eel", "ray", "flatfish", "cephalopod", "jellyfish", "sessile"]);
    const only = value("--only")?.split(",");
    const slugs = readdirSync(rigDir).filter((d) => existsSync(path.join(rigDir, d)) && !d.includes(".") && (!only || only.includes(d)));
    for (const slug of slugs) {
        const file = readdirSync(path.join(rigDir, slug)).find((f) => f.endsWith(".rig.glb"));
        if (!file || WATER_PLANS.has(modelBase(slug)?.plan ?? "")) continue;
        try {
            const buf = readFileSync(path.join(rigDir, slug, file));
            const loader = new GLTFLoader();
            loader.setMeshoptDecoder(MeshoptDecoder);
            const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "");
            const ex = (gltf.parser.json as {extras: {ark_rig: {bufferView: number; bones: string[]; rows: number; layout?: string; rig: {clips: Record<string, {row: number; rows: number}>}}}}).extras.ark_rig;
            const view = (await gltf.parser.getDependency("bufferView", ex.bufferView)) as ArrayBuffer;
            const bones = ex.bones.length;
            const data = ex.layout === "bone_major" ? boneMajorToRows(new Uint16Array(view.slice(0)), bones, ex.rows) : new Uint16Array(view.slice(0));
            let mesh: import("three").SkinnedMesh | null = null;
            gltf.scene.updateMatrixWorld(true);
            gltf.scene.traverse((o) => {
                if (!mesh && (o as import("three").SkinnedMesh).isSkinnedMesh) mesh = o as import("three").SkinnedMesh;
            });
            if (!mesh) continue;
            const geometry = restGeometry(mesh, ex.bones);
            geometry.computeBoundingBox();
            const box = geometry.boundingBox!;
            const c = {x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2};
            const height = box.max.y - box.min.y;
            const rootY = (row: number) => {
                const at = row * bones * 12 + 4;
                return halfToFloat(data[at]) * c.x + halfToFloat(data[at + 1]) * c.y + halfToFloat(data[at + 2]) * c.z + halfToFloat(data[at + 3]);
            };
            for (const [name, clip] of Object.entries(ex.rig.clips)) {
                // (`--all-clips`: gaits and standing clips too, to read one species' clips.)
                if ((!process.argv.includes("--all-clips") && (feetCarryClip(name) || PATH_CARRIED_CLIPS.has(name) || FLIGHT.test(name))) || !(clip.rows > 1)) continue;
                clipsSeen++;
                let sum = 0;
                let peak = 0;
                for (let r = 0; r < clip.rows; r++) {
                    const rise = (rootY(clip.row + r) - c.y) / Math.max(height, 1e-6);
                    sum += Math.max(rise, 0);
                    peak = Math.max(peak, rise);
                }
                lifts.push({slug, clip: name, mean: sum / clip.rows, peak});
            }
            geometry.dispose();
        } catch (error) {
            console.warn(`${slug}: ${error instanceof Error ? error.message : error}`);
        }
    }
    void modelBase;
    const hover = (l: RigLift) => l.mean > IN_PLACE_LIFT_FREE;
    const before = lifts.filter(hover);
    // After: the rise past the bob comes off on the ground (`inPlaceLift`), so what is left is at most the bob.
    const after = lifts.filter((l) => Math.max(l.mean - Math.max(l.mean - IN_PLACE_LIFT_FREE, 0), 0) > IN_PLACE_LIFT_FREE + 1e-9);
    console.log(`\nclip lift (played in place on the ground; ${clipsSeen} clips over ${new Set(lifts.map((l) => l.slug)).size} rigs): before ${before.length} clips / ${new Set(before.map((l) => l.slug)).size} species hover over ${(IN_PLACE_LIFT_FREE * 100).toFixed(0)}% of their height on average; after ${after.length}`);
    console.log("  worst:", before.sort((a, b) => b.mean - a.mean).slice(0, 12).map((l) => `${l.slug}/${l.clip} ${(l.mean * 100).toFixed(0)}% (peak ${(l.peak * 100).toFixed(0)}%)`).join(", "));
    const cat = lifts.filter((l) => /domestic-cat|^cat$/.test(l.slug));
    if (cat.length) console.log("  domestic cat:", cat.map((l) => `${l.clip} ${(l.mean * 100).toFixed(0)}%/${(l.peak * 100).toFixed(0)}%`).join(", "));
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({animals: audit.animals, species: audit.species, samples: audit.samples, offenders: audit.offenders, worst: {before: audit.worst.before.slice(0, 200), after: audit.worst.after.slice(0, 200)}, clipLift: lifts}, null, 1));
