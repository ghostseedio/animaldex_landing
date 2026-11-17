/**
 * The Ark's people (owner 2026-11-17: "we also have human captures, which i want to now add to the simulation";
 * AnimalDex decision 378). PRIVACY (the owner's fixed rule): every person is a generic figure whose body, height,
 * build, skin, hair and clothes are chosen from a seed (the Ark animal's id), never from the capture: no photo, no face,
 * no name. The same id always gives the same person, in the town and in the forest (`humanLook`).
 *
 * One procedural body of smooth lofted parts (~2,000 triangles near, ~500 far), drawn instanced in two levels: near within
 * `HUMAN_NEAR` m, the coarse body to `HUMAN_FAR` m, nothing beyond. Each vertex carries its part (skin, top, bottom,
 * hair, shoes; sleeves, trouser legs and long hair switched by the look) and its limb; each instance carries its
 * colours, its style and its pose's joint angles (`posePerson`), which the vertex shader turns at the hips, knees,
 * waist, neck, shoulders and elbows (the normals with them). The whole-body turn (lying, on a side) is in the instance
 * matrix. Smooth shaded with creases darkened, vertex colours, no textures, no downloads; written into preallocated arrays each frame (no allocation).
 */

import {BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshDepthMaterial, MeshStandardMaterial, Quaternion, RGBADepthPacking, Vector3, type WebGLProgramParametersWithUniforms} from "three";

export type HumanPoseKind = "stand" | "walk" | "sit" | "lie" | "drive" | "chop" | "plant" | "sleep" | "carry" | "saw"
    /** On a towel: on the back, hands behind the head; on a side, knees drawn up; sitting up, reading; standing in the shallows. */
    | "sunback" | "sunside" | "sunsit" | "paddle";

/** A person's look (all from the seed). Colours are linear-ish sRGB triples 0–1. */
export type HumanLook = {
    /** Standing height (m). */
    height: number;
    /** Build: width across the shoulders and hips (1 = average). */
    build: number;
    skin: [number, number, number];
    hair: [number, number, number];
    top: [number, number, number];
    bottom: [number, number, number];
    /** 1: hair to the shoulders. */
    longHair: number;
    /** 1: long sleeves. */
    sleeves: number;
    /** 1: trousers (0: shorts or a skirt's length). */
    trousers: number;
    /** 1: no hair (the cap takes the skin's colour). */
    bald: number;
    child: boolean;
    /** p6 (people): 1 on the beach (the town's beach look): the rigged bodies wear swimwear. Never from the capture. */
    swim?: number;
};

export type HumanInstance = {x: number; y: number; z: number; yaw: number; pose: HumanPoseKind; phase: number; look: HumanLook; scale?: number; /** Leaning back (negative) or forward from the pose's waist (rad): a driver under a car's roof. */ lean?: number; /** A room's lamp and screen on it (0–1): indoors at night, where the scene's sun and street lamps do not reach. */ light?: number; /** Lying on a slope: the head's end raised this much (rad). */ tilt?: number};

/** Near body within this distance (m), the coarse one to HUMAN_FAR, nothing beyond. */
export const HUMAN_NEAR = 40;
export const HUMAN_FAR = 250;
/** At most this many drawn at once (the nearest first). */
export const HUMAN_MAX = 400;
/** The body's own height (m) before the look's scale. */
export const BASE_HEIGHT = 1.75;

// MARK: - Looks

/** FNV-1a over a key: a unit in [0, 1). */
export function humanUnit(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

const hex = (value: string): [number, number, number] => {
    const n = parseInt(value.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The looks' colours are sRGB, as picked by eye (the hex values below), but the renderer lights linear colours. Used as
 * they were, a light tone such as #f3d3bd lit as (0.95, 0.83, 0.74) instead of (0.90, 0.65, 0.51): a third too bright in
 * the blue and green, so in the noon sun, through the tone mapping, light-skinned people read as near-white plaster
 * (2026-11-17, the rigged people's beach). Both renderers turn the look's colour into linear light in the shader
 * (the exact sRGB curve), as three.js does for every `Color` it is given; the seeded looks themselves stay as they are.
 */
export const HUMAN_LINEAR_GLSL = /* glsl */ `
vec3 humanLinear(vec3 c) {
    return mix(c * 0.0773993808, pow(c * 0.9478672986 + 0.0521327014, vec3(2.4)), step(vec3(0.04045), c));
}
// Skin a little short of the full curve: with no subsurface light on these bodies the two deepest tones went to
// silhouettes at dusk (#3b2219 at 0.044 in the red); a third of the way back keeps them brown, and the light tones warm.
vec3 humanSkinLinear(vec3 c) {
    return mix(humanLinear(c), c, 0.35);
}
`;

/** Human skin tones across the range (deep to light). */
export const HUMAN_SKIN_TONES = ["#3b2219", "#4f2d1f", "#6b3e2a", "#87573a", "#a0694a", "#b47b57", "#c68e68", "#d9a582", "#e6b896", "#f0c9ab", "#f3d3bd"].map(hex);
const HAIR = ["#141110", "#1f1712", "#2e2018", "#4a3020", "#6b4a2c", "#8c6a3e", "#b48c55", "#d2b57c", "#8a3b1e", "#9a9a96", "#d8d6d0"].map(hex);
const TOPS = ["#c8352b", "#2f5aa8", "#2d7a4e", "#e2b33c", "#f2f0ea", "#1d1f24", "#7a4a8c", "#e07a3a", "#4ea0b8", "#a8a39a", "#d86c8e", "#3c4e66", "#3b6e8f", "#5c8a3a"].map(hex);
const BOTTOMS = ["#24324a", "#2b2b2e", "#4a4f57", "#6b5a44", "#c9b998", "#3a4a2c", "#5a6a86", "#1d2533", "#7a2f2f", "#d9d4c8"].map(hex);

/**
 * A person's look from a seed (the Ark animal's id; a child also from its id). Adults 1.52–1.94 m, children 0.95–1.4 m;
 * build 0.86–1.2; one of 11 skin tones, 11 hair colours (grey and white mostly on the taller seeds' elders: by hash),
 * long or short hair or none, long or short sleeves, trousers or shorts, 14 tops and 10 bottoms.
 */
export function humanLook(seed: string, child = false): HumanLook {
    const u = (k: string) => humanUnit(`${seed}#${k}`);
    const height = child ? 0.95 + u("h") * 0.45 : 1.52 + (u("h") + u("h2")) * 0.21;
    const pick = <T>(list: T[], k: string) => list[Math.min(Math.floor(u(k) * list.length), list.length - 1)];
    const elder = !child && u("age") < 0.18;
    const hair = elder ? HAIR[9 + Math.floor(u("grey") * 2)] : pick(HAIR.slice(0, 9), "hair");
    return {
        height,
        build: 0.86 + u("b") * 0.34,
        skin: pick(HUMAN_SKIN_TONES, "skin"),
        hair,
        top: pick(TOPS, "top"),
        bottom: pick(BOTTOMS, "bottom"),
        longHair: u("long") < 0.42 ? 1 : 0,
        sleeves: u("sleeve") < 0.5 ? 1 : 0,
        trousers: u("legs") < 0.7 ? 1 : 0,
        bald: !child && u("bald") < (elder ? 0.3 : 0.06) ? 1 : 0,
        child
    };
}

// MARK: - The body

/** Parts (the vertex's paint): which colour it takes. */
const PART = {skin: 0, top: 1, bottom: 2, hair: 3, shoes: 4, longHair: 5, forearm: 6, shin: 7, sole: 8, eye: 9, brow: 10} as const;
/** Limbs (which joints turn the vertex). */
const LIMB = {core: 0, lThigh: 1, lShin: 2, rThigh: 3, rShin: 4, lUpper: 5, lFore: 6, rUpper: 7, rFore: 8, head: 9, hips: 10} as const;

/** The joints' pivots on the rest body (m; facing +z, feet at y = 0). */
export const JOINTS = {hipY: 0.92, hipX: 0.1, kneeY: 0.5, waistY: 0.98, neckY: 1.5, shoulderY: 1.42, shoulderX: 0.215, elbowY: 1.15} as const;

/** A loft's ring: its centre (x, y, z) and its two radii (across x, and across the other axis), and its shade (0–1, a crease's darkening). */
type Ring = readonly [x: number, y: number, z: number, a: number, b: number, shade?: number];

class Builder {
    positions: number[] = [];
    rig: number[] = [];
    indices: number[] = [];
    constructor(readonly far: boolean) {}
    private vertex(x: number, y: number, z: number, part: number, limb: number, shade = 1): number {
        this.positions.push(x, y, z);
        this.rig.push(part, limb, shade);
        return this.positions.length / 3 - 1;
    }
    private tri(a: number, b: number, c: number, out: [number, number, number]) {
        // Wound so its face looks along `out` (the outward way there).
        const P = this.positions;
        const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
        const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) this.indices.push(a, b, c);
        else this.indices.push(a, c, b);
    }
    /**
     * A smooth tube through rings along y (`axis` "y": the ring in the x–z plane) or along z (the ring in the x–y plane),
     * closed at both ends. The far body takes fewer sides and every other inner ring. `partAt` paints a vertex by its
     * angle (a shoe's sole).
     */
    loft(rings: readonly Ring[], sides: number, part: number, limb: number, axis: "y" | "z" = "y", partAt?: (sin: number) => number) {
        const use = this.far ? rings.filter((_, i) => i === 0 || i === rings.length - 1 || (rings.length > 4 && i === Math.floor(rings.length / 2))) : rings;
        const n = this.far ? Math.max(4, Math.round(sides * 0.45)) : sides;
        const base = this.positions.length / 3;
        for (const [x, y, z, a, b, shade] of use) {
            for (let s = 0; s < n; s++) {
                const t = (s / n) * Math.PI * 2 + Math.PI / 2;
                const c = Math.cos(t), si = Math.sin(t);
                const p = partAt ? partAt(si) : part;
                if (axis === "y") this.vertex(x + c * a, y, z + si * b, p, limb, shade ?? 1);
                else this.vertex(x + c * a, y + si * b, z, p, limb, shade ?? 1);
            }
        }
        for (let r = 0; r + 1 < use.length; r++) {
            const [x0, y0, z0] = use[r];
            for (let s = 0; s < n; s++) {
                const a = base + r * n + s, b = base + r * n + ((s + 1) % n);
                const P = this.positions;
                const out: [number, number, number] = axis === "y" ? [P[a * 3] - x0, 0, P[a * 3 + 2] - z0] : [P[a * 3] - x0, P[a * 3 + 1] - y0, 0];
                this.tri(a, a + n, b, out);
                this.tri(b, a + n, b + n, out);
            }
        }
        // The ends: a fan to a centre a little beyond (rounded), outward along the axis.
        for (const end of [0, use.length - 1]) {
            const [x, y, z, , , shade] = use[end];
            const other = use[end === 0 ? 1 : end - 1];
            const dir: [number, number, number] = [x - other[0], y - other[1], z - other[2]];
            const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
            const cap = this.vertex(x + (dir[0] / len) * 0.002, y + (dir[1] / len) * 0.002, z + (dir[2] / len) * 0.002, partAt ? partAt(0) : part, limb, shade ?? 1);
            const ring = base + end * n;
            for (let s = 0; s < n; s++) this.tri(cap, ring + s, ring + ((s + 1) % n), dir);
        }
    }
    /** An ellipsoid (a loft of rings round its axis). */
    ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, around: number, rows: number, part: number, limb: number) {
        const rings: Ring[] = [];
        for (let r = 1; r < rows; r++) {
            const v = (r / rows) * Math.PI;
            rings.push([cx, cy + Math.cos(v) * ry, cz, Math.sin(v) * rx, Math.sin(v) * rz]);
        }
        this.loft(rings, around, part, limb);
    }
    geometry(): BufferGeometry {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
        g.setAttribute("aRig", new BufferAttribute(new Float32Array(this.rig), 3));
        g.setIndex(this.indices);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
    }
}

/**
 * The body, built once: smooth lofted parts (a shaped torso with chest, waist and hips; tapered thighs and calves;
 * shoes with soles; shoulders, arms, hands with a thumb; a neck; a rounded head with ears and a nose's bump only (no
 * face); a hair shell and long hair's fall). The far body is the same with fewer sides and rings, no ears, nose or thumb.
 */
export function humanGeometry(far: boolean): BufferGeometry {
    const b = new Builder(far);
    for (const side of [-1, 1]) {
        const thigh = side < 0 ? LIMB.lThigh : LIMB.rThigh;
        const shin = side < 0 ? LIMB.lShin : LIMB.rShin;
        const x = (v: number) => side * v;
        b.loft([[x(0.092), 0.94, -0.004, 0.084, 0.088, 0.7], [x(0.092), 0.82, 0.004, 0.08, 0.086], [x(0.09), 0.68, 0.006, 0.068, 0.074], [x(0.088), 0.55, 0, 0.057, 0.061], [x(0.088), 0.5, 0.004, 0.056, 0.06], [x(0.088), 0.46, 0.002, 0.048, 0.052], [x(0.088), 0.44, 0, 0.03, 0.034]], 10, PART.bottom, thigh);
        b.loft([[x(0.088), 0.56, -0.004, 0.035, 0.038], [x(0.088), 0.53, 0, 0.055, 0.058], [x(0.088), 0.45, -0.004, 0.054, 0.06], [x(0.088), 0.34, -0.012, 0.05, 0.056], [x(0.088), 0.22, -0.006, 0.038, 0.042], [x(0.088), 0.11, -0.004, 0.03, 0.034], [x(0.088), 0.075, -0.01, 0.03, 0.034]], 10, PART.shin, shin);
        // The shoe, heel to toe (along z), its sole a pale band under it.
        b.loft([[x(0.088), 0.045, -0.072, 0.024, 0.024], [x(0.088), 0.045, -0.062, 0.038, 0.042], [x(0.088), 0.045, -0.02, 0.044, 0.045], [x(0.088), 0.04, 0.06, 0.046, 0.038], [x(0.088), 0.032, 0.13, 0.041, 0.028], [x(0.088), 0.028, 0.163, 0.028, 0.02], [x(0.088), 0.027, 0.174, 0.01, 0.008]], 10, PART.shoes, shin, "z", (sin) => (sin < -0.72 ? PART.sole : PART.shoes));
        const upper = side < 0 ? LIMB.lUpper : LIMB.rUpper;
        const fore = side < 0 ? LIMB.lFore : LIMB.rFore;
        // The shoulder and upper arm in the top's cloth to a short sleeve's hem, then the sleeve or skin.
        b.loft([[x(0.19), 1.462, -0.006, 0.024, 0.026], [x(0.198), 1.448, -0.006, 0.048, 0.052], [x(0.208), 1.4, -0.004, 0.054, 0.056, 0.85], [x(0.214), 1.33, -0.002, 0.05, 0.052], [x(0.216), 1.3, 0, 0.049, 0.051]], 10, PART.top, upper);
        b.loft([[x(0.216), 1.305, 0, 0.046, 0.048], [x(0.218), 1.2, 0, 0.043, 0.046], [x(0.22), 1.13, 0, 0.041, 0.044]], 10, PART.forearm, upper);
        b.loft([[x(0.22), 1.165, 0, 0.041, 0.044], [x(0.221), 1.08, 0.002, 0.039, 0.042], [x(0.222), 0.98, 0.004, 0.032, 0.034], [x(0.222), 0.89, 0.005, 0.026, 0.028], [x(0.222), 0.875, 0.005, 0.025, 0.027]], 10, PART.forearm, fore);
        // The hand (flat across x: the palm to the thigh), and its thumb forward.
        b.loft([[x(0.222), 0.89, 0.005, 0.02, 0.027], [x(0.222), 0.85, 0.008, 0.018, 0.04], [x(0.222), 0.79, 0.01, 0.016, 0.036], [x(0.222), 0.74, 0.008, 0.013, 0.028], [x(0.222), 0.716, 0.006, 0.008, 0.016]], 8, PART.skin, fore);
        if (!far) {
            b.loft([[x(0.214), 0.865, 0.032, 0.009, 0.01], [x(0.211), 0.825, 0.044, 0.008, 0.009], [x(0.211), 0.802, 0.046, 0.004, 0.004]], 6, PART.skin, fore);
            b.ellipsoid(x(0.084), 1.625, -0.006, 0.013, 0.024, 0.016, 6, 4, PART.skin, LIMB.head);
        }
    }
    // Hips and seat (the bottom's colour), the torso (the top's): waist, chest, shoulders, a collar round the neck.
    b.loft([[0, 0.79, 0, 0.07, 0.05, 0.55], [0, 0.83, 0, 0.14, 0.095, 0.8], [0, 0.9, -0.008, 0.168, 0.108], [0, 0.97, -0.005, 0.162, 0.102], [0, 1.03, 0, 0.151, 0.098, 0.85]], 14, PART.bottom, LIMB.hips);
    b.loft([[0, 1.0, 0, 0.152, 0.099, 0.8], [0, 1.08, 0, 0.143, 0.094], [0, 1.17, 0.004, 0.155, 0.102], [0, 1.26, 0.008, 0.172, 0.112], [0, 1.34, 0.004, 0.185, 0.112], [0, 1.4, -0.004, 0.19, 0.105], [0, 1.445, -0.01, 0.165, 0.088], [0, 1.47, -0.012, 0.1, 0.068], [0, 1.482, -0.014, 0.056, 0.053, 0.8]], 14, PART.top, LIMB.core);
    b.loft([[0, 1.45, -0.015, 0.05, 0.048, 0.75], [0, 1.5, -0.016, 0.046, 0.047], [0, 1.545, -0.012, 0.044, 0.046, 0.8]], 10, PART.skin, LIMB.head);
    // The head: jaw and chin forward, the cranium round; a nose's bump (no face).
    b.loft([[0, 1.5, 0.03, 0.025, 0.02, 0.8], [0, 1.52, 0.025, 0.055, 0.06, 0.85], [0, 1.56, 0.012, 0.072, 0.088], [0, 1.6, 0.004, 0.081, 0.099], [0, 1.645, 0, 0.086, 0.104], [0, 1.69, -0.004, 0.084, 0.102], [0, 1.725, -0.008, 0.066, 0.083], [0, 1.745, -0.01, 0.035, 0.045]], 14, PART.skin, LIMB.head);
    if (!far) {
        b.ellipsoid(0, 1.612, 0.1, 0.011, 0.02, 0.014, 6, 4, PART.skin, LIMB.head);
        // Generic eyes and brows only (dark dots and the hair's colour): the same for everyone of a look, no one's face.
        for (const side of [-1, 1]) {
            b.ellipsoid(side * 0.031, 1.636, 0.094, 0.009, 0.0065, 0.006, 6, 4, PART.eye, LIMB.head);
            b.ellipsoid(side * 0.033, 1.655, 0.096, 0.017, 0.004, 0.007, 6, 3, PART.brow, LIMB.head);
        }
    }
    // The hair: a shell over the crown and the back of the head to the nape, its line above the forehead.
    b.loft([[0, 1.578, -0.048, 0.076, 0.066], [0, 1.625, -0.02, 0.089, 0.092], [0, 1.67, -0.005, 0.092, 0.11], [0, 1.715, -0.008, 0.088, 0.106], [0, 1.745, -0.01, 0.07, 0.086], [0, 1.765, -0.01, 0.035, 0.045]], 14, PART.hair, LIMB.head);
    // Long hair: its fall down the back to the shoulders (folded away when the look has none).
    b.loft([[0, 1.66, -0.058, 0.09, 0.06], [0, 1.56, -0.075, 0.096, 0.05], [0, 1.46, -0.085, 0.1, 0.04], [0, 1.4, -0.085, 0.085, 0.025]], 10, PART.longHair, LIMB.head);
    return b.geometry();
}

// MARK: - Poses

/** Joint angles (radians): legs (left hip, left knee, right hip, right knee), arms (left shoulder, left elbow, right shoulder, right elbow), body (waist, neck, arms out, -). */
export type HumanJoints = {legs: [number, number, number, number]; arms: [number, number, number, number]; body: [number, number, number, number]};

/** The walk: strides a second, the thigh's swing (rad), and the pace it covers (m/s at the base height). */
export const WALK_CADENCE = 1;
export const WALK_SWING = 0.33;
export const WALK_PACE = 2 * WALK_CADENCE * 2 * 0.92 * Math.sin(WALK_SWING);

/**
 * A pose's joint angles at a phase (seconds into it, for the moving ones). Hips and shoulders forward positive, knees
 * and elbows bent positive, the waist leaning forward positive.
 */
export function posePerson(pose: HumanPoseKind, phase: number, out: HumanJoints): HumanJoints {
    const l = out.legs, a = out.arms, b = out.body;
    l[0] = l[1] = l[2] = l[3] = 0;
    a[0] = a[1] = a[2] = a[3] = 0;
    b[0] = b[1] = b[2] = b[3] = 0;
    switch (pose) {
        case "stand": {
            const sway = Math.sin(phase * 0.7) * 0.03;
            a[0] = 0.05 + sway;
            a[2] = 0.05 - sway;
            a[1] = a[3] = 0.12;
            b[2] = 0.08;
            b[1] = Math.sin(phase * 0.23) * 0.08;
            break;
        }
        case "walk":
        case "carry": {
            // A stroll: the thighs swing ±19°, a stride (two steps) a second: 2 × 0.92 m × sin 19° = 0.6 m a step,
            // `WALK_PACE` m/s over the ground (the walkers' paces are about it, so the feet do not slide).
            const s = Math.sin(phase * Math.PI * 2 * WALK_CADENCE);
            l[0] = s * WALK_SWING;
            l[2] = -s * WALK_SWING;
            l[1] = Math.max(0, -s) * 0.5 + 0.06;
            l[3] = Math.max(0, s) * 0.5 + 0.06;
            if (pose === "walk") {
                // The arms swing against the legs from the shoulder, the forearm trailing a little behind it.
                const c = Math.cos(phase * Math.PI * 2 * WALK_CADENCE);
                a[0] = -s * 0.36;
                a[2] = s * 0.36;
                a[1] = 0.22 + Math.max(0, -s) * 0.28 + c * 0.04;
                a[3] = 0.22 + Math.max(0, s) * 0.28 - c * 0.04;
                b[0] = 0.04;
                b[1] = -0.04;
                b[2] = 0.07;
            } else {
                a[0] = a[2] = 1.0;
                a[1] = a[3] = 0.9;
                b[0] = 0.08;
            }
            break;
        }
        case "sit":
        case "drive": {
            l[0] = l[2] = Math.PI / 2;
            l[1] = l[3] = Math.PI / 2;
            if (pose === "drive") {
                a[0] = a[2] = 0.95;
                a[1] = a[3] = 0.55;
                b[0] = -0.08;
            } else {
                // Hands on the lap; a look round now and then.
                a[0] = a[2] = 0.35;
                a[1] = a[3] = 1.0;
                b[0] = -0.05;
                b[1] = Math.sin(phase * 0.17) * 0.12 - 0.05;
            }
            break;
        }
        case "lie":
        case "sleep":
            // On the back (the matrix lays the body down): arms at the sides, a little out; one knee up now and then.
            b[2] = pose === "lie" ? 0.35 : 0.1;
            l[2] = Math.max(0, Math.sin(phase * 0.05)) * 0.6;
            l[3] = l[2] * 1.6;
            a[1] = a[3] = pose === "lie" ? 0.2 : 1.2;
            a[0] = a[2] = pose === "lie" ? 0 : 0.6;
            break;
        case "chop": {
            // An axe's stroke every 1.6 s: the swing back up over the shoulder (slow), the strike down and in to the
            // trunk at hip height (fast), a beat at the cut, feet planted wide, knees soft.
            const t = ((phase / 1.6) % 1 + 1) % 1;
            const raise = t < 0.55 ? Math.sin((t / 0.55) * Math.PI * 0.5) : t < 0.7 ? 1 - ((t - 0.55) / 0.15) ** 2 : 0;
            a[0] = a[2] = 0.75 + raise * 2.05;
            a[1] = a[3] = 0.2 + raise * 0.55;
            b[0] = 0.5 - raise * 0.45;
            b[1] = 0.1 - raise * 0.15;
            l[0] = 0.2;
            l[2] = -0.18;
            l[1] = 0.12;
            l[3] = 0.22;
            break;
        }
        case "saw": {
            // A chainsaw at the trunk, held in both hands at waist height: bent to it, braced, the arms pushing the
            // bar in with the saw's small buck.
            const buck = Math.sin(phase * 2.1) * 0.05 + Math.sin(phase * 31) * 0.012;
            a[0] = a[2] = 0.95 + buck;
            a[1] = a[3] = 0.45 - buck;
            b[0] = 0.55;
            b[1] = -0.25;
            b[2] = 0.12;
            l[0] = 0.24;
            l[2] = -0.16;
            l[1] = 0.1;
            l[3] = 0.2;
            break;
        }
        case "sunback":
            // On the back, hands behind the head (elbows out), a knee up for some of the day.
            a[0] = a[2] = 2.75;
            a[1] = a[3] = 2.25;
            b[2] = 1.6;
            l[2] = Math.max(0, Math.sin(phase * 0.021)) > 0.3 ? 0.85 : 0.05;
            l[3] = l[2] * 1.75;
            b[1] = -0.25;
            break;
        case "sunside":
            // On a side: the lower arm under the head, the other along the hip, the knees drawn up.
            a[0] = 2.5;
            a[1] = 2.1;
            a[2] = 0.35;
            a[3] = 0.5;
            l[0] = 0.75;
            l[1] = 1.05;
            l[2] = 0.55;
            l[3] = 0.9;
            b[0] = 0.12;
            b[1] = 0.15;
            break;
        case "sunsit": {
            // Sitting up on the towel, legs out, a book in both hands; a page turned now and then.
            l[0] = l[2] = Math.PI / 2 - 0.12;
            l[1] = 0.25;
            l[3] = 0.55;
            a[0] = a[2] = 0.45;
            a[1] = a[3] = 1.25 + Math.max(0, Math.sin(phase * 0.4)) * 0.08;
            b[0] = 0.16;
            b[1] = 0.32 + Math.sin(phase * 0.09) * 0.05;
            break;
        }
        case "paddle": {
            // Standing in the shallows: a slow shift of weight, the arms a little out over the water.
            const sway = Math.sin(phase * 0.6);
            l[0] = sway * 0.08;
            l[2] = -sway * 0.08;
            l[1] = l[3] = 0.08;
            a[0] = 0.1 + sway * 0.1;
            a[2] = 0.1 - sway * 0.1;
            a[1] = a[3] = 0.35;
            b[2] = 0.32;
            b[1] = 0.25 + Math.sin(phase * 0.13) * 0.2;
            break;
        }
        case "plant": {
            // Bent to the ground, a hand working at the soil.
            const dig = Math.sin(phase * 2.4);
            b[0] = 1.15;
            l[0] = l[2] = 0.35;
            l[1] = l[3] = 0.7;
            a[0] = 0.4 + dig * 0.25;
            a[2] = 0.5;
            a[1] = 0.3;
            a[3] = 0.5;
            break;
        }
    }
    return out;
}

/** How a pose's body is laid and lifted: the instance matrix's pitch and roll and the root's lift (m, before scale). */
function bodyLay(pose: HumanPoseKind, phase: number): {pitch: number; roll: number; lift: number} {
    if (pose === "lie") return {pitch: -Math.PI / 2, roll: 0, lift: 0.12};
    if (pose === "sleep") return {pitch: -Math.PI / 2, roll: Math.sin(phase * 0.01) > 0 ? 1.3 : -1.3, lift: 0.17};
    if (pose === "sunback") return {pitch: -Math.PI / 2, roll: 0, lift: 0.115};
    if (pose === "sunside") return {pitch: -Math.PI / 2, roll: 1.45, lift: 0.17};
    // Sitting on the towel: the hips' seat on the ground.
    if (pose === "sunsit") return {pitch: 0, roll: 0, lift: -0.8};
    // The walk's bob: the hips ride lowest with the legs apart, so a planted foot stays on the ground.
    if (pose === "walk") return {pitch: 0, roll: 0, lift: -JOINTS.hipY * (1 - Math.cos(Math.sin(phase * Math.PI * 2 * WALK_CADENCE) * WALK_SWING))};
    return {pitch: 0, roll: 0, lift: 0};
}

/** Where a sitter's root (its feet's level when standing) goes for a seat at `seatY`: the hips' pelvis on the seat. */
export function sitRootY(seatY: number, scale: number): number {
    return seatY - 0.86 * scale;
}

// MARK: - The material

const RIG_GLSL = /* glsl */ `
attribute vec3 aRig;
attribute vec3 iSkin;
attribute vec3 iTop;
attribute vec3 iBottom;
attribute vec3 iHair;
attribute vec4 iStyle;
attribute vec4 iLegs;
attribute vec4 iArms;
attribute vec4 iBody;
varying vec3 vHumanColour;
varying float vHumanLight;
void humanSwing(inout vec3 p, inout vec3 n, vec3 pivot, float a) {
    vec3 d = p - pivot;
    float c = cos(a), s = sin(a);
    p = pivot + vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
    n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
}
void humanOut(inout vec3 p, inout vec3 n, vec3 pivot, float a) {
    vec3 d = p - pivot;
    float c = cos(a), s = sin(a);
    p = pivot + vec3(d.x * c - d.y * s, d.x * s + d.y * c, d.z);
    n = vec3(n.x * c - n.y * s, n.x * s + n.y * c, n.z);
}
// The pose: the vertex and its normal turned at the joints (the same turns, so the light follows the limbs).
void humanPose(inout vec3 p, inout vec3 n) {
    float part = aRig.x;
    float limb = aRig.y;
    // Long hair folds into the head when the look has none.
    if (part > 4.5 && part < 5.5 && iStyle.x < 0.5) p = vec3(0.0, 1.6, -0.02);
    // Legs: knee, then hip.
    if (limb > 0.5 && limb < 4.5) {
        bool left = limb < 2.5;
        float hip = left ? iLegs.x : iLegs.z;
        float knee = left ? iLegs.y : iLegs.w;
        float hx = left ? -${JOINTS.hipX.toFixed(3)} : ${JOINTS.hipX.toFixed(3)};
        if (limb > 1.5 && limb < 2.5 || limb > 3.5) humanSwing(p, n, vec3(hx, ${JOINTS.kneeY.toFixed(3)}, 0.0), knee);
        humanSwing(p, n, vec3(hx, ${JOINTS.hipY.toFixed(3)}, 0.0), -hip);
        return;
    }
    if (limb > 9.5) return;
    // Arms: elbow, shoulder (forward and out), then the waist.
    if (limb > 4.5 && limb < 8.5) {
        bool left = limb < 6.5;
        float sh = left ? iArms.x : iArms.z;
        float el = left ? iArms.y : iArms.w;
        float ax = left ? -${JOINTS.shoulderX.toFixed(3)} : ${JOINTS.shoulderX.toFixed(3)};
        if (limb > 5.5 && limb < 6.5 || limb > 7.5) humanSwing(p, n, vec3(ax, ${JOINTS.elbowY.toFixed(3)}, 0.0), -el);
        humanSwing(p, n, vec3(ax, ${JOINTS.shoulderY.toFixed(3)}, 0.0), -sh);
        humanOut(p, n, vec3(ax, ${JOINTS.shoulderY.toFixed(3)}, 0.0), (left ? -1.0 : 1.0) * iBody.z * (sh < 1.2 ? 1.0 : 0.2));
    }
    if (limb > 8.5) humanSwing(p, n, vec3(0.0, ${JOINTS.neckY.toFixed(3)}, 0.0), iBody.y);
    humanSwing(p, n, vec3(0.0, ${JOINTS.waistY.toFixed(3)}, 0.0), iBody.x);
}
${HUMAN_LINEAR_GLSL}
vec3 humanPaint() {
    float part = aRig.x;
    vec3 shoes = iBottom * 0.3 + vec3(0.045, 0.04, 0.038);
    vec3 c;
    if (part < 0.5) c = iSkin;
    else if (part < 1.5) c = iTop;
    else if (part < 2.5) c = iBottom;
    else if (part < 3.5) c = mix(iHair, iSkin, iStyle.w);
    else if (part < 4.5) c = shoes;
    else if (part < 5.5) c = iHair;
    else if (part < 6.5) c = mix(iSkin, iTop, iStyle.y);
    else if (part < 7.5) c = mix(iSkin, iBottom, iStyle.z);
    else if (part < 8.5) c = vec3(0.78, 0.76, 0.72);
    else if (part < 9.5) c = vec3(0.05, 0.045, 0.04);
    else c = mix(iHair * 0.8, iSkin * 0.6, iStyle.w * 0.6);
    return (part < 0.5 ? humanSkinLinear(c) : humanLinear(c)) * aRig.z;
}
`;

function rigShader(shader: WebGLProgramParametersWithUniforms, colour: boolean) {
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${RIG_GLSL}`)
        .replace("#include <begin_vertex>", "vec3 transformed = position;\nvec3 humanNormalSink = vec3(0.0, 1.0, 0.0);\nhumanPose(transformed, humanNormalSink);");
    if (colour) {
        shader.vertexShader = shader.vertexShader
            .replace("#include <beginnormal_vertex>", "vec3 objectNormal = normal;\n{ vec3 humanAt = position; humanPose(humanAt, objectNormal); }")
            .replace("#include <color_vertex>", "#include <color_vertex>\nvHumanColour = humanPaint();\nvHumanLight = iBody.w;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vHumanColour;\nvarying float vHumanLight;")
            .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vHumanColour, opacity );")
            // (Indoors at night: the room's lamp and the screen's glow on them, warm with a cool flicker.)
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vHumanColour * vHumanLight * vec3(0.5, 0.47, 0.44);");
    }
}

export function humanMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.78, metalness: 0});
    material.customProgramCacheKey = () => "ark-human";
    material.onBeforeCompile = (shader) => rigShader(shader, true);
    return material;
}

function humanDepthMaterial(): MeshDepthMaterial {
    const material = new MeshDepthMaterial({depthPacking: RGBADepthPacking});
    material.customProgramCacheKey = () => "ark-human-depth";
    material.onBeforeCompile = (shader) => rigShader(shader, false);
    return material;
}

// MARK: - The figures

type Level = {mesh: InstancedMesh; skin: InstancedBufferAttribute; top: InstancedBufferAttribute; bottom: InstancedBufferAttribute; hair: InstancedBufferAttribute; style: InstancedBufferAttribute; legs: InstancedBufferAttribute; arms: InstancedBufferAttribute; body: InstancedBufferAttribute; count: number};

function level(geometry: BufferGeometry, material: MeshStandardMaterial, depth: MeshDepthMaterial | null, name: string): Level {
    const attr = (size: number) => {
        const a = new InstancedBufferAttribute(new Float32Array(HUMAN_MAX * size), size);
        a.setUsage(35048); // DynamicDrawUsage
        return a;
    };
    const l: Level = {mesh: new InstancedMesh(geometry, material, HUMAN_MAX), skin: attr(3), top: attr(3), bottom: attr(3), hair: attr(3), style: attr(4), legs: attr(4), arms: attr(4), body: attr(4), count: 0};
    geometry.setAttribute("iSkin", l.skin);
    geometry.setAttribute("iTop", l.top);
    geometry.setAttribute("iBottom", l.bottom);
    geometry.setAttribute("iHair", l.hair);
    geometry.setAttribute("iStyle", l.style);
    geometry.setAttribute("iLegs", l.legs);
    geometry.setAttribute("iArms", l.arms);
    geometry.setAttribute("iBody", l.body);
    l.mesh.name = name;
    l.mesh.count = 0;
    l.mesh.frustumCulled = false;
    l.mesh.castShadow = depth !== null;
    l.mesh.receiveShadow = true;
    if (depth) l.mesh.customDepthMaterial = depth;
    l.mesh.userData.kind = "human";
    // (The high tier's ambient occlusion draws every object with one plain material, so it would see each person in
    // the rest pose (a standing ghost under a sitter, `post.ts` gtaoLeavesOut): people stay out of it.)
    l.mesh.userData.gtaoSkip = true;
    return l;
}

/**
 * The people drawn now. `setFrame` takes this frame's list (any order; the nearest HUMAN_MAX within HUMAN_FAR are
 * drawn, near ones with the full body and a shadow) and the shared clock's seconds (for the moving poses' phase).
 */
export class HumanFigures {
    readonly group = new Group();
    private readonly material = humanMaterial();
    private readonly depth = humanDepthMaterial();
    private readonly near: Level;
    private readonly far: Level;
    private readonly joints: HumanJoints = {legs: [0, 0, 0, 0], arms: [0, 0, 0, 0], body: [0, 0, 0, 0]};
    private readonly matrix = new Matrix4();
    private readonly q = new Quaternion();
    private readonly q2 = new Quaternion();
    private readonly p = new Vector3();
    private readonly s = new Vector3();
    private readonly axisX = new Vector3(1, 0, 0);
    private readonly axisY = new Vector3(0, 1, 0);
    private readonly axisZ = new Vector3(0, 0, 1);
    private order: number[] = [];
    private distances = new Float32Array(HUMAN_MAX * 4);
    /** How many were drawn at the last frame (near, far). */
    drawn = {near: 0, far: 0};

    constructor() {
        this.group.name = "humans";
        this.near = level(humanGeometry(false), this.material, this.depth, "humans:near");
        this.far = level(humanGeometry(true), this.material, null, "humans:far");
        this.group.add(this.near.mesh, this.far.mesh);
    }

    setFrame(list: readonly HumanInstance[], camera: Vector3, seconds: number): void {
        if (this.distances.length < list.length) this.distances = new Float32Array(list.length * 2);
        const order = this.order;
        order.length = 0;
        for (let i = 0; i < list.length; i++) {
            const h = list[i];
            const d = Math.sqrt((h.x - camera.x) ** 2 + (h.y - camera.y) ** 2 + (h.z - camera.z) ** 2);
            this.distances[i] = d;
            if (d < HUMAN_FAR) order.push(i);
        }
        if (order.length > HUMAN_MAX) {
            order.sort((a, b) => this.distances[a] - this.distances[b]);
            order.length = HUMAN_MAX;
        }
        this.near.count = 0;
        this.far.count = 0;
        for (const i of order) {
            const h = list[i];
            this.write(this.distances[i] < HUMAN_NEAR ? this.near : this.far, h, seconds);
        }
        for (const l of [this.near, this.far]) {
            l.mesh.count = l.count;
            l.mesh.visible = l.count > 0;
            l.mesh.instanceMatrix.needsUpdate = true;
            for (const a of [l.skin, l.top, l.bottom, l.hair, l.style, l.legs, l.arms, l.body]) {
                a.needsUpdate = true;
                a.clearUpdateRanges();
                a.addUpdateRange(0, l.count * a.itemSize);
            }
        }
        this.drawn.near = this.near.count;
        this.drawn.far = this.far.count;
    }

    private write(l: Level, h: HumanInstance, seconds: number) {
        const k = l.count++;
        const look = h.look;
        const scale = (h.scale ?? 1) * (look.height / BASE_HEIGHT);
        const lay = bodyLay(h.pose, h.phase + seconds);
        this.q.setFromAxisAngle(this.axisY, h.yaw);
        if (lay.pitch) this.q.multiply(this.q2.setFromAxisAngle(this.axisX, lay.pitch + (h.tilt ?? 0)));
        if (lay.roll) this.q.multiply(this.q2.setFromAxisAngle(this.axisY, lay.roll));
        this.p.set(h.x, h.y + lay.lift * scale, h.z);
        // Children: a larger head for the body (the look's height scales the whole; the build widens it).
        this.s.set(scale * look.build, scale, scale * (0.9 + 0.1 * look.build));
        this.matrix.compose(this.p, this.q, this.s);
        l.mesh.setMatrixAt(k, this.matrix);
        l.skin.setXYZ(k, look.skin[0], look.skin[1], look.skin[2]);
        l.top.setXYZ(k, look.top[0], look.top[1], look.top[2]);
        l.bottom.setXYZ(k, look.bottom[0], look.bottom[1], look.bottom[2]);
        l.hair.setXYZ(k, look.hair[0], look.hair[1], look.hair[2]);
        l.style.setXYZW(k, look.longHair, look.sleeves, look.trousers, look.bald);
        const j = posePerson(h.pose, h.phase + seconds, this.joints);
        l.legs.setXYZW(k, j.legs[0], j.legs[1], j.legs[2], j.legs[3]);
        l.arms.setXYZW(k, j.arms[0], j.arms[1], j.arms[2], j.arms[3]);
        l.body.setXYZW(k, j.body[0] + (h.lean ?? 0), j.body[1], j.body[2], h.light ?? 0);
        void this.axisZ;
    }

    /** Triangles of each level (for the budget's test and the report). */
    static triangles(): {near: number; far: number} {
        const count = (g: BufferGeometry) => (g.index ? g.index.count / 3 : 0);
        return {near: count(humanGeometry(false)), far: count(humanGeometry(true))};
    }

    dispose(): void {
        for (const l of [this.near, this.far]) l.mesh.geometry.dispose();
        this.material.dispose();
        this.depth.dispose();
        this.group.removeFromParent();
    }
}
