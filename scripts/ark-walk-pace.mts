/**
 * Natural walking and running paces for the rigs the scene draws (decision 202, motion pass lane L1; the behaviours
 * pass 2026-11, lane B4: docs/ark/behaviour-pass-2026-11/land.md).
 *
 *   npx tsx scripts/ark-walk-pace.mts [--set ~/animaldex-talking-models/rig/publish-v3] [--apply] [--list]
 *
 * `behaviours.json` `walkPace` and `runPace` come from the profile generator as the rig clips' own paces in body
 * lengths a second, so a baked walk plays at its own rate. At the animals' true sizes that is no animal's pace: an
 * elephant walked at 3.4 m/s, a giraffe at 5.1, a giant tortoise at 0.85, a bear at 0.6. The locomotion layer draws
 * legged rigs with planted feet at any pace (stride and cadence follow the speed) and picks the gait from the speed,
 * and the legless driver poses a snake by the distance it moves, so for those the paces here are the animal's own
 * (`locomotion/paces.ts` naturalPaces): a walk and a covering-ground gait by Froude number on the rig's leg length
 * at the species' true length, by body plan and gait family, within its top speed; a burst mover's walk is its
 * bursts' speed times its share moving (`gaitRhythm`); a snake's by its style (a heavy python creeps). Rigs whose
 * moving is a baked clip keep the clip's pace: a sitting rig (a rabbit, a kangaroo, a squirrel) goes at its bound's
 * own pace in its bursts; a true seal, drawn by the galumph driver at any pace, humps along at a quarter of its length
 * a second; insects, spiders, crabs, hopping frogs and bats keep their clips' paces (a scuttling spider or crab walks,
 * on the whole, at its clip's pace times its share moving).
 *
 * Run it after `ark-behaviour-profiles.mts` (it rewrites only the walk and run columns). Reads the local rig set (the
 * rig files' JSON only); writes `src/ark-scene/behaviours.json` with --apply, else prints.
 */

import {readFileSync, readdirSync, writeFileSync, existsSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {arkBody} from "../src/ark-scene/stats";
import {flippered} from "../src/ark-scene/locomotion/legged";
import {modelBase} from "../src/ark-scene/grounding/base";
import {BURST_MEAN, GALUMPH_RUN, GALUMPH_WALK, gaitRhythm, naturalPaces, SLOW_PACE, slowMover} from "../src/ark-scene/locomotion/paces";
import {locoStyle} from "../src/ark-scene/locomotion/styles";

const home = os.homedir();
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const set = arg("set", path.join(home, "animaldex-talking-models/rig/publish-v3")).replace(/^~/, home);
const apply = process.argv.includes("--apply");
const list = process.argv.includes("--list");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const file = path.join(root, "src/ark-scene/behaviours.json");

/** Walking and running floors for a reach-limited rig that keeps its clip (Froude numbers on the hip height). */
export const WALK_FROUDE = 0.05;
export const RUN_FROUDE = 0.8;
const G = 9.81;
const LEGGED = new Set(["quadruped", "primate", "walking_bird", "flying_bird", "flightless_bird", "bat", "lizard", "turtle", "amphibian", "insect", "arachnid", "crustacean"]);

type Node = {name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[]; mesh?: number; skin?: number};
type Clip = {bls?: number; target_bls?: number; ground_speed?: number; pass?: boolean};
type Gltf = {nodes: Node[]; meshes: Array<{primitives: Array<{attributes: Record<string, number>}>}>; accessors: Array<{min?: number[]; max?: number[]}>; scenes?: Array<{nodes: number[]}>; extras?: {ark_rig?: {rig?: {plan?: string; pose?: string | null; clips?: Record<string, Clip>}}}};

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

/**
 * A rig file's leg hip height over its mesh floor, a leg's reach from its hip to the floor under its foot (the legged
 * driver's gait length for a sprawler), its mesh length and height (mesh units), plan, pose and moving clips.
 */
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
    const reaches: number[] = [];
    const named = new Map(json.nodes.map((n, i) => [n.name ?? "", i] as const));
    json.nodes.forEach((n, i) => {
        const m = /^(leg\d+[LR])_upper$/.exec(n.name ?? "");
        if (!m) return;
        const hip = world.get(i)!;
        hips.push(hip[13]);
        const foot = named.get(`${m[1]}_foot`);
        const at = foot !== undefined ? world.get(foot) : undefined;
        if (at) reaches.push(Math.hypot(hip[12] - at[12], hip[13] - pos.min![1], hip[14] - at[14]));
    });
    const rig = json.extras?.ark_rig?.rig;
    return {
        legs: hips.length,
        hip: hips.length ? hips.reduce((a, b) => a + b, 0) / hips.length - pos.min[1] : 0,
        reach: reaches.length ? reaches.reduce((a, b) => a + b, 0) / reaches.length : 0,
        bound: rig?.clips?.bound ?? null,
        clips: rig?.clips ?? {},
        length: pos.max[2] - pos.min[2],
        height: pos.max[1] - pos.min[1],
        plan: rig?.plan ?? null,
        pose: rig?.pose ?? null,
        walk: rig?.clips?.walk ?? null,
        run: rig?.clips?.run ?? null
    };
}

/** A rig's first passing clip's own pace of these (body lengths a second), as `ark-behaviour-profiles.mts` clipPace reads a v2 rig. */
function clipPace(clips: Record<string, Clip>, names: string[]): number | null {
    for (const name of names) {
        const clip = clips[name];
        if (!clip || clip.pass === false || !clip.ground_speed || clip.ground_speed <= 0) continue;
        return Math.round((clip.bls && clip.bls > 0 ? clip.bls : clip.ground_speed) * 1000) / 1000;
    }
    return null;
}

const json = JSON.parse(readFileSync(file, "utf8")) as {about: string; species: Record<string, string>};
const table = json.species;
const changed: string[] = [];
const tally: Record<string, number> = {};
let looked = 0;
const round = (v: number) => Math.round(v * 1000) / 1000;
for (const [slug, row] of Object.entries(table)) {
    const f = row.split("|");
    const shape = rigShape(slug);
    if (!shape) continue;
    looked++;
    const plan = shape.plan ?? "";
    const L = arkBody({model_slug: slug} as Parameters<typeof arkBody>[0], plan).display;
    const scale = L / Math.max(shape.length, shape.height, 1e-6);
    if (!(L > 0)) continue;
    const speedStat = f[11] ? Number(f[11]) : null;
    const rhythm = gaitRhythm(slug, modelBase(slug)?.plan, L);
    const before = {walk: f[14], run: f[15]};
    let walk: number | null = null;
    let run: number | null = null;
    let kind = "";
    if (shape.pose) {
        // A sitting rig moves by its baked bound, at the clip's own pace: all the time on a long way (its run), in
        // bursts with sits between at its everyday pace. One with no bound (the sitting primates) keeps the stat's pace.
        const bound = shape.bound?.pass !== false && shape.bound?.ground_speed ? shape.bound.ground_speed / Math.max(shape.length, shape.height, 1e-6) : 0;
        if (!(bound > 0)) continue;
        const share = rhythm.share < 1 ? rhythm.share : 0.5;
        // (A sloth is slow whatever its clip: its bound plays as a slow haul along the ground.)
        walk = slowMover(slug) ? SLOW_PACE : bound * share * BURST_MEAN;
        run = slowMover(slug) ? null : bound;
        kind = "sitting: its bound's pace";
    } else if (plan === "legless") {
        // A snake by its style, in body lengths a second: a heavy python creeps straight, most snakes cruise slowly. A
        // worm (the model library's plan) barely moves; a millipede glides slowly; a centipede, on the same kind of rig,
        // keeps its clip's pace (it is quick).
        const style = locoStyle(slug, plan).legless;
        const model = modelBase(slug)?.plan ?? null;
        if (!style || clipPace(shape.clips, ["walk", "slither", "hop"]) === null) continue;
        if (model === "arthropod" && style !== "glide") continue;
        const [bls, most] = model === "worm" || model === "slow_invertebrate" ? [0.06, 0.02] : style === "rectilinear" ? [0.09, 0.35] : style === "lateral" ? [0.3, 0.5] : style === "sidewind" ? [0.4, 0.6] : style === "peristaltic" ? [0.08, 0.02] : [0.15, 0.08];
        walk = Math.min(bls, most / L);
        run = model !== "worm" && model !== "slow_invertebrate" && (style === "lateral" || style === "sidewind") ? Math.min(walk * 2.5, 1.5 / L) : null;
        kind = `legless: ${style}`;
    } else if (flippered(slug)) {
        // A true seal: the galumph driver draws it at any pace, so its own (its flipper-legs clip's is a crawl).
        walk = GALUMPH_WALK;
        run = GALUMPH_RUN;
        kind = "galumph";
    } else if (LEGGED.has(plan) && shape.legs >= 2) {
        const natural = naturalPaces({plan, slug, length: L, hip: shape.hip * scale, reach: shape.reach * scale, speedStat}, rhythm);
        if (natural) {
            walk = natural.walk / L;
            run = natural.run === null ? null : natural.run / L;
            kind = rhythm.share < 1 ? "natural: bursts" : "natural";
        } else {
            // A rig that keeps its clip's pace (an insect, a spider, a crab, a hopping frog, a bat): the clip's own, read
            // from the rig file as the profile generator reads it (so running this twice changes nothing). Where the
            // rigger's legs could not reach the stride the species asked for (the walk clip's `bls` under its
            // `target_bls`), a Froude floor on its hip height as before (decision 202: a slow walk, Fr 0.05; a run,
            // Fr 0.8). A scuttler (a spider, a crab) goes at that in its bursts.
            const clip = clipPace(shape.clips, ["walk", "slither", "hop"]);
            if (clip === null) continue;
            const hip = shape.hip * scale;
            const limited = shape.walk?.bls !== undefined && shape.walk?.target_bls !== undefined && shape.walk.bls < shape.walk.target_bls && hip > 0;
            const own = limited ? Math.max(clip, Math.sqrt(WALK_FROUDE * G * hip) / L) : clip;
            walk = rhythm.share < 1 ? own * rhythm.share * BURST_MEAN : own;
            run = clipPace(shape.clips, ["run"]);
            if (run !== null && limited) run = Math.max(run, Math.sqrt(RUN_FROUDE * G * hip) / L, own * 1.6);
            kind = rhythm.share < 1 ? "clip: bursts" : limited ? "clip: floor" : "clip";
        }
    } else continue;
    f[14] = String(round(Math.max(walk, 0.01)));
    f[15] = run === null ? "" : String(round(Math.max(run, 0.01)));
    tally[kind.replace(/:.*/, "")] = (tally[kind.replace(/:.*/, "")] ?? 0) + 1;
    if (f[14] === before.walk && f[15] === before.run) continue;
    changed.push(`${slug} (${plan}, ${kind}): walk ${before.walk || "-"} -> ${f[14]} lengths/s (${before.walk ? (Number(before.walk) * L).toFixed(3) : "-"} -> ${(Number(f[14]) * L).toFixed(3)} m/s), run ${before.run || "-"} -> ${f[15] || "-"} (${before.run ? (Number(before.run) * L).toFixed(2) : "-"} -> ${f[15] ? (Number(f[15]) * L).toFixed(2) : "-"} m/s), length ${L.toFixed(2)} m, hip ${(shape.hip * scale).toFixed(3)} m`);
    table[slug] = f.join("|");
}
console.log(`${looked} rigged species looked at, ${changed.length} paces changed`, JSON.stringify(tally));
const SHOWN = /^(african-bush-elephant|giraffe|plains-zebra|domestic-horse|african-lion|cheetah|gray-wolf|brown-bear|house-mouse|european-rabbit|red-kangaroo|chimpanzee|ostrich|domestic-chicken|house-sparrow|emperor-penguin|komodo-dragon|american-alligator|common-wall-lizard|aldabra-giant-tortoise|burmese-python|american-bullfrog|carolina-wolf-spider|coconut-crab|california-sea-lion|walrus|fire-salamander|ringed-plover|mallard) /;
for (const line of changed.filter((l) => list || SHOWN.test(l))) console.log("  " + line);
if (apply) {
    // The file's own layout: its "about", then one species a line.
    const text = `{"about":${JSON.stringify(json.about)},\n"species":{\n` + Object.entries(table).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",\n") + "\n}}\n";
    writeFileSync(file, text);
    console.log("wrote", path.relative(root, file));
}
