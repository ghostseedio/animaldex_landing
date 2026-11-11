/**
 * A rig's skeleton for the locomotion layer: its bones (texture order), parents and rest transforms, its legs (upper,
 * lower, foot) with where each sole touches the ground, and its proportions. Built once when a rig loads
 * (`rig-player.ts`), and by the fixture script for the CI metrics (`scripts/ark-loco-fixtures.mjs`).
 *
 * Also the forward kinematics the drivers share: locals (a bone relative to its parent) to world (mesh space), and
 * world to the bone texture's rows (rest pose to now, 3×4).
 */

import {Matrix4, Quaternion, Vector3} from "three";
import type {BodyPlan, LocoBone, LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";

/** The raw skeleton a rig file gives (or a fixture holds). Matrices are three.js column-major elements. */
export type RawSkeleton = {
    slug: string;
    plan: string | null;
    /** The rig entry's `pose` (a sitting rest pose), if any. */
    pose?: string | null;
    /** Texture bone names, in texture order. */
    bones: string[];
    /** Each texture bone's parent name (a texture bone, or null when its parent carries no weight). */
    parents: Array<string | null>;
    /** Each texture bone's rest world matrix (mesh space). */
    rest: number[][];
    /** The rest mesh: positions (xyz), and per vertex four texture bones and their weights. */
    positions: ArrayLike<number>;
    joints: ArrayLike<number>;
    weights: ArrayLike<number>;
};

const LEG = /^leg(\d+)([LR])_(upper|lower|foot)$/;
const PLANS: ReadonlySet<string> = new Set(["quadruped", "primate", "walking_bird", "flying_bird", "flightless_bird", "bat", "flying_insect", "insect", "arachnid", "crustacean", "amphibian", "lizard", "turtle", "legless", "fish", "cephalopod_jelly", "other"]);

const v3 = (m: Matrix4): [number, number, number] => {
    const e = m.elements;
    return [e[12], e[13], e[14]];
};
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The secondary-motion bones a full rig would carry and this one lacks (a report, never an error). */
function missingBones(slug: string, plan: BodyPlan, names: readonly string[]): string[] {
    const has = (re: RegExp) => names.some((n) => re.test(n));
    const out: string[] = [];
    const mammal = plan === "quadruped" || plan === "primate" || plan === "bat";
    if (mammal && !has(/ear/i)) out.push("ears");
    if (/elephant/.test(slug) && !has(/trunk/i)) out.push("trunk");
    if (/(lion|horse|zebra|donkey|pony|mustang|przewalski|bison|gelada|baboon|wildebeest|maned)/.test(slug) && !has(/mane/i)) out.push("mane");
    if (plan !== "legless" && plan !== "fish" && !has(/^neck$/)) out.push("neck");
    if (mammal && !has(/^tail/) && !/(gorilla|chimp|bonobo|orangutan|gibbon|siamang|koala|wombat|guinea|hyrax|capybara|bear|frog|toad|human|macaque-barbary)/.test(slug)) out.push("tail");
    return out;
}

/** Build the locomotion skeleton from a rig's raw skeleton. */
export function buildLocoRig(raw: RawSkeleton): LocoRig {
    const plan = (PLANS.has(raw.plan ?? "") ? raw.plan : "other") as BodyPlan;
    const index = new Map(raw.bones.map((name, i) => [name, i]));
    const bones: LocoBone[] = raw.bones.map((name, i) => {
        const restWorld = new Matrix4().fromArray(raw.rest[i]);
        const parentName = raw.parents[i];
        const parent = parentName !== null && index.has(parentName) ? index.get(parentName)! : -1;
        return {name, parent, restWorld, restLocal: new Matrix4()};
    });
    for (const bone of bones) {
        if (bone.parent < 0) bone.restLocal.copy(bone.restWorld);
        else bone.restLocal.copy(bones[bone.parent].restWorld).invert().multiply(bone.restWorld);
    }
    // Mesh extents.
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const count = Math.floor(raw.positions.length / 3);
    for (let i = 0; i < count; i++) {
        const x = raw.positions[i * 3], y = raw.positions[i * 3 + 1], z = raw.positions[i * 3 + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    if (!count) minX = minY = minZ = maxX = maxY = maxZ = 0;
    const height = maxY - minY;
    // Legs: leg{n}{L|R}_{upper,lower,foot}.
    const chains = new Map<string, {n: number; side: "L" | "R"; upper?: number; lower?: number; foot?: number}>();
    raw.bones.forEach((name, i) => {
        const m = LEG.exec(name);
        if (!m) return;
        const key = `${m[1]}${m[2]}`;
        const chain = chains.get(key) ?? {n: Number(m[1]), side: m[2] as "L" | "R"};
        chain[m[3] as "upper" | "lower" | "foot"] = i;
        chains.set(key, chain);
    });
    const complete = Array.from(chains.values()).filter((c) => c.upper !== undefined && c.lower !== undefined && c.foot !== undefined);
    // Pairs front to back by their hips' z (the animal faces +z).
    const pairZ = new Map<number, number>();
    for (const c of complete) pairZ.set(c.n, Math.max(pairZ.get(c.n) ?? -Infinity, v3(bones[c.upper!].restWorld)[2]));
    const order = Array.from(pairZ.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const legs: LocoLeg[] = complete.map((c) => {
        const pair = order.indexOf(c.n);
        const hip = v3(bones[c.upper!].restWorld);
        const knee = v3(bones[c.lower!].restWorld);
        const ankle = v3(bones[c.foot!].restWorld);
        const contact = soleOf(raw, c.foot!, ankle, minY, height);
        const pairs = order.length;
        const end: LocoLeg["end"] = pairs === 1 ? "hind" : pair === 0 ? "fore" : pair === pairs - 1 ? "hind" : "mid";
        return {
            key: `${c.side}${pair + 1}`,
            upper: c.upper!,
            lower: c.lower!,
            foot: c.foot!,
            pair,
            side: c.side === "L" ? 1 : -1,
            end,
            hip,
            knee,
            ankle,
            contact,
            upperLength: dist(hip, knee),
            lowerLength: dist(knee, ankle),
            height: Math.max(hip[1] - contact[1], 1e-4)
        };
    });
    legs.sort((a, b) => a.pair - b.pair || b.side - a.side);
    const at = (name: string) => index.get(name) ?? -1;
    const tail = raw.bones.map((n, i) => [n, i] as const).filter(([n]) => /^tail\d+$/.test(n)).sort((a, b) => Number(a[0].slice(4)) - Number(b[0].slice(4))).map(([, i]) => i);
    const chain = raw.bones.map((n, i) => [n, i] as const).filter(([n]) => /^chain\d+$/.test(n)).sort((a, b) => Number(a[0].slice(5)) - Number(b[0].slice(5))).map(([, i]) => i);
    const wing = (side: "L" | "R") => ["shoulder", "forearm", "hand"].map((p) => at(`wing${side}_${p}`)).filter((i) => i >= 0);
    return {
        slug: raw.slug,
        plan,
        bones,
        legs,
        hips: at("hips"),
        chest: at("chest"),
        neck: at("neck"),
        head: at("head"),
        tail,
        wings: {left: wing("L"), right: wing("R")},
        chain,
        length: maxZ - minZ,
        height,
        width: maxX - minX,
        minY,
        legHeight: legs.length ? legs.reduce((s, l) => s + l.height, 0) / legs.length : 0,
        missing: missingBones(raw.slug, plan, raw.bones),
        sitting: Boolean(raw.pose),
        below: bones.map((_, i) => descendants(bones, i))
    };
}

/** A bone's descendants (texture indices). */
function descendants(bones: readonly LocoBone[], root: number): number[] {
    const out: number[] = [];
    let frontier = [root];
    while (frontier.length) {
        const next: number[] = [];
        bones.forEach((b, i) => {
            if (frontier.includes(b.parent) && !out.includes(i)) {
                out.push(i);
                next.push(i);
            }
        });
        frontier = next;
    }
    return out;
}

/**
 * Where a foot touches the ground at rest: the lowest points of the mesh the foot bone carries (half its weight or
 * more), their middle. Falls back to the ankle at the mesh's floor.
 */
function soleOf(raw: RawSkeleton, foot: number, ankle: [number, number, number], minY: number, height: number): [number, number, number] {
    const count = Math.floor(raw.positions.length / 3);
    for (const share of [0.5, 0.25]) {
        let low = Infinity;
        const picked: number[] = [];
        for (let i = 0; i < count; i++) {
            let w = 0;
            for (let k = 0; k < 4; k++) if (raw.joints[i * 4 + k] === foot) w += raw.weights[i * 4 + k];
            if (w < share) continue;
            picked.push(i);
            low = Math.min(low, raw.positions[i * 3 + 1]);
        }
        if (!picked.length) continue;
        const band = Math.max(height * 0.015, 1e-4);
        let x = 0, z = 0, n = 0;
        for (const i of picked) {
            if (raw.positions[i * 3 + 1] > low + band) continue;
            x += raw.positions[i * 3];
            z += raw.positions[i * 3 + 2];
            n++;
        }
        return [x / n, low, z / n];
    }
    return [ankle[0], minY, ankle[2]];
}

// MARK: Kinematics

/** Bone order with every parent before its children. */
export function boneOrder(rig: LocoRig): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    const visit = (i: number) => {
        if (seen.has(i)) return;
        const p = rig.bones[i].parent;
        if (p >= 0) visit(p);
        seen.add(i);
        out.push(i);
    };
    rig.bones.forEach((_, i) => visit(i));
    return out;
}

/** Locals to world (mesh space), parents first. */
export function forward(rig: LocoRig, order: readonly number[], locals: readonly Matrix4[], world: Matrix4[]): void {
    for (const i of order) {
        const p = rig.bones[i].parent;
        if (p < 0) world[i].copy(locals[i]);
        else world[i].multiplyMatrices(world[p], locals[i]);
    }
}

/** World (mesh space) to locals. */
export function backward(rig: LocoRig, world: readonly Matrix4[], locals: Matrix4[]): void {
    const inv = new Matrix4();
    rig.bones.forEach((bone, i) => {
        if (bone.parent < 0) locals[i].copy(world[i]);
        else locals[i].copy(inv.copy(world[bone.parent]).invert()).multiply(world[i]);
    });
}

/** The rest pose's locals (copies). */
export function restLocals(rig: LocoRig): Matrix4[] {
    return rig.bones.map((b) => b.restLocal.clone());
}

const skinTmp = new Matrix4();
/** Rest inverses, cached per rig. */
const restInverse = new WeakMap<LocoRig, Matrix4[]>();
export function restInverses(rig: LocoRig): Matrix4[] {
    let list = restInverse.get(rig);
    if (!list) {
        list = rig.bones.map((b) => b.restWorld.clone().invert());
        restInverse.set(rig, list);
    }
    return list;
}

/** World (mesh space) poses to the bone texture's row: per bone, the 3×4 rows of (world · rest⁻¹). */
export function skinRow(rig: LocoRig, world: readonly Matrix4[], out: Float32Array, offset: number): void {
    const inverses = restInverses(rig);
    for (let b = 0; b < rig.bones.length; b++) {
        const e = skinTmp.multiplyMatrices(world[b], inverses[b]).elements;
        const o = offset + b * 12;
        // Row-major 3×4 from three's column-major 4×4.
        out[o] = e[0];
        out[o + 1] = e[4];
        out[o + 2] = e[8];
        out[o + 3] = e[12];
        out[o + 4] = e[1];
        out[o + 5] = e[5];
        out[o + 6] = e[9];
        out[o + 7] = e[13];
        out[o + 8] = e[2];
        out[o + 9] = e[6];
        out[o + 10] = e[10];
        out[o + 11] = e[14];
    }
}

/** A texture row (rest pose to the frame, 3×4 per bone) to world poses: world = skin · rest. */
export function rowToWorld(rig: LocoRig, row: ArrayLike<number>, offset: number, world: Matrix4[]): void {
    for (let b = 0; b < rig.bones.length; b++) {
        const o = offset + b * 12;
        skinTmp.set(row[o], row[o + 1], row[o + 2], row[o + 3], row[o + 4], row[o + 5], row[o + 6], row[o + 7], row[o + 8], row[o + 9], row[o + 10], row[o + 11], 0, 0, 0, 1);
        world[b].multiplyMatrices(skinTmp, rig.bones[b].restWorld);
    }
}

/** Where a point fixed to a bone (given at rest, mesh space) is now. */
export function bonePointNow(rig: LocoRig, world: readonly Matrix4[], bone: number, rest: readonly number[], out: Vector3): Vector3 {
    return out.set(rest[0], rest[1], rest[2]).applyMatrix4(restInverses(rig)[bone]).applyMatrix4(world[bone]);
}

const rotTmp = new Matrix4();
const pivotTmp = new Vector3();
/** A rotation about a pivot, premultiplied onto a world (mesh space) matrix. */
export function rotateAbout(m: Matrix4, q: Quaternion, pivot: Vector3): Matrix4 {
    pivotTmp.copy(pivot);
    rotTmp.makeRotationFromQuaternion(q);
    const e = m.elements;
    // Translate by -pivot, rotate, translate back (on the matrix's translation column only).
    e[12] -= pivotTmp.x;
    e[13] -= pivotTmp.y;
    e[14] -= pivotTmp.z;
    m.premultiply(rotTmp);
    e[12] += pivotTmp.x;
    e[13] += pivotTmp.y;
    e[14] += pivotTmp.z;
    return m;
}

/** Turn a bone and everything it carries about a pivot (mesh space). */
export function rotateSubtree(rig: LocoRig, world: Matrix4[], bone: number, q: Quaternion, pivot: Vector3): void {
    if (bone < 0) return;
    const at = pivotTmp2.copy(pivot);
    rotateAbout(world[bone], q, at);
    for (const i of rig.below[bone]) rotateAbout(world[i], q, at);
}
const pivotTmp2 = new Vector3();

/** Move a bone and everything it carries (mesh space). */
export function translateSubtree(rig: LocoRig, world: Matrix4[], bone: number, dx: number, dy: number, dz: number): void {
    if (bone < 0) return;
    for (const i of [bone, ...rig.below[bone]]) {
        const e = world[i].elements;
        e[12] += dx;
        e[13] += dy;
        e[14] += dz;
    }
}
