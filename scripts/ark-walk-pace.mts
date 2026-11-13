/**
 * Natural walking paces for rigs whose legs the locomotion layer draws (decision 202, motion pass lane L1).
 *
 *   npx tsx scripts/ark-walk-pace.mts [--set ~/animaldex-talking-models/rig/publish-v2] [--apply]
 *
 * `behaviours.json` `walkPace` (and `runPace`) are the rig clips' own paces in body lengths a second, so the baked walk
 * plays at its own rate. Where the rigger's legs could not reach the stride the species asked for (the walk clip's
 * `bls` under its `target_bls`: a bullfrog's walk is 1.9 cm/s, an alligator's 0.05 lengths a second), the schedule
 * walked those animals in slow motion, or squeezed their trips past the clip's pace. The locomotion layer draws legged
 * rigs with planted feet at any pace (stride and cadence follow the speed), so for them the pace may be natural: here a
 * Froude-number floor on the rig's own hip height at the species' true length (a slow walk, Fr 0.05; a run, Fr 0.8),
 * never below the clip's own pace. Rigs the layer does not draw on legs keep their clip pace: sitting rest poses, true
 * seals (they galumph on the belly: `locomotion/legged.ts` flippered; sea lions and the walrus walk on their flippers
 * since movement audit MA4), and plans without legs.
 *
 * Reads the local rig set (the rig files' JSON only); writes `src/ark-scene/behaviours.json` with --apply, else prints.
 */

import {readFileSync, readdirSync, writeFileSync, existsSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {arkBody} from "../src/ark-scene/stats";
import {flippered} from "../src/ark-scene/locomotion/legged";

const home = os.homedir();
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const set = arg("set", path.join(home, "animaldex-talking-models/rig/publish-v2")).replace(/^~/, home);
const apply = process.argv.includes("--apply");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const file = path.join(root, "src/ark-scene/behaviours.json");

/** Walking and running floors (Froude numbers on the hip height): a slow amble, and a run between trot and gallop. */
export const WALK_FROUDE = 0.05;
export const RUN_FROUDE = 0.8;
const G = 9.81;
const LEGGED = new Set(["quadruped", "primate", "walking_bird", "flying_bird", "flightless_bird", "bat", "lizard", "turtle", "amphibian", "insect", "arachnid", "crustacean"]);

type Node = {name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[]; mesh?: number; skin?: number};
type Gltf = {nodes: Node[]; meshes: Array<{primitives: Array<{attributes: Record<string, number>}>}>; accessors: Array<{min?: number[]; max?: number[]}>; scenes?: Array<{nodes: number[]}>; extras?: {ark_rig?: {rig?: {plan?: string; pose?: string | null; clips?: Record<string, {bls?: number; target_bls?: number}>}}}};

/** A column-major 4×4 from a node's TRS. */
function local(n: Node): number[] {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
    const [sx, sy, sz] = n.scale ?? [1, 1, 1];
    const [tx, ty, tz] = n.translation ?? [0, 0, 0];
    return [
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1
    ];
}
function mul(a: number[], b: number[]): number[] {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
}

/** A rig file's leg hip height over its mesh floor, its mesh length and height (mesh units), plan, pose and walk/run clips. */
function rigShape(slug: string) {
    const dir = path.join(set, slug);
    if (!existsSync(dir)) return null;
    const name = readdirSync(dir).find((n) => n.endsWith(".rig.glb"));
    if (!name) return null;
    const buf = readFileSync(path.join(dir, name));
    const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as Gltf;
    const world = new Map<number, number[]>();
    const walk = (i: number, parent: number[]) => {
        const m = mul(parent, local(json.nodes[i]));
        world.set(i, m);
        for (const c of json.nodes[i].children ?? []) walk(c, m);
    };
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const roots = json.scenes?.[0]?.nodes ?? json.nodes.map((_, i) => i).filter((i) => !json.nodes.some((n) => n.children?.includes(i)));
    for (const r of roots) walk(r, identity);
    const meshNode = json.nodes.findIndex((n) => n.mesh !== undefined && n.skin !== undefined);
    if (meshNode < 0) return null;
    const pos = json.accessors[json.meshes[json.nodes[meshNode].mesh!].primitives[0].attributes.POSITION];
    if (!pos?.min || !pos.max) return null;
    // (The mesh node's own transform is the identity in the rig files; its bounds are in the same space as the bones.)
    const hips: number[] = [];
    json.nodes.forEach((n, i) => {
        if (/^leg\d+[LR]_upper$/.test(n.name ?? "")) hips.push(world.get(i)![13]);
    });
    const rig = json.extras?.ark_rig?.rig;
    return {
        legs: hips.length,
        hip: hips.length ? hips.reduce((a, b) => a + b, 0) / hips.length - pos.min[1] : 0,
        length: pos.max[2] - pos.min[2],
        height: pos.max[1] - pos.min[1],
        plan: rig?.plan ?? null,
        pose: rig?.pose ?? null,
        walk: rig?.clips?.walk ?? null,
        run: rig?.clips?.run ?? null
    };
}

const json = JSON.parse(readFileSync(file, "utf8")) as {about: string; species: Record<string, string>};
const table = json.species;
const changed: string[] = [];
let looked = 0;
for (const [slug, row] of Object.entries(table)) {
    const f = row.split("|");
    const walkPace = Number(f[14]);
    if (!(walkPace > 0)) continue;
    const shape = rigShape(slug);
    if (!shape) continue;
    looked++;
    if (shape.legs < 2 || shape.pose || flippered(slug) || !LEGGED.has(shape.plan ?? "")) continue;
    // Reach-limited: the walk clip's legs could not reach the pace the species asked for.
    const limited = shape.walk?.bls !== undefined && shape.walk?.target_bls !== undefined && shape.walk.bls < shape.walk.target_bls;
    if (!limited) continue;
    const L = arkBody({model_slug: slug} as Parameters<typeof arkBody>[0], shape.plan).display;
    const scale = L / Math.max(shape.length, shape.height, 1e-6);
    const hip = shape.hip * scale;
    if (!(hip > 0) || !(L > 0)) continue;
    const walkFloor = Math.sqrt(WALK_FROUDE * G * hip) / L;
    const walk = Math.round(Math.max(walkPace, walkFloor) * 1000) / 1000;
    let run = f[15] ? Number(f[15]) : null;
    if (run && run > 0) run = Math.round(Math.max(run, Math.sqrt(RUN_FROUDE * G * hip) / L, walk * 1.6) * 1000) / 1000;
    if (walk === walkPace && (run === null || run === Number(f[15]))) continue;
    changed.push(`${slug}: walk ${walkPace} -> ${walk} lengths/s (${(walkPace * L).toFixed(3)} -> ${(walk * L).toFixed(3)} m/s)${run !== null && f[15] ? `, run ${f[15]} -> ${run}` : ""} (hip ${hip.toFixed(3)} m, length ${L.toFixed(2)} m)`);
    f[14] = String(walk);
    if (run !== null && f[15]) f[15] = String(run);
    table[slug] = f.join("|");
}
console.log(`${looked} rigged species looked at, ${changed.length} walking paces raised to their natural floor`);
for (const line of changed.filter((l) => /^(american-bullfrog|american-alligator|domestic-goat|komodo-dragon|african-clawed-frog|red-deer|african-lion):/.test(l))) console.log("  " + line);
if (apply) {
    // The file's own layout: its "about", then one species a line.
    const text = `{"about":${JSON.stringify(json.about)},\n"species":{\n` + Object.entries(table).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",\n") + "\n}}\n";
    writeFileSync(file, text);
    console.log("wrote", path.relative(root, file));
}
