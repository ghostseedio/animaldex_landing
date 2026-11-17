/**
 * The Ark's people (owner 2026-11-17: "we also have human captures, which i want to now add to the simulation";
 * AnimalDex decision 378). PRIVACY (the owner's fixed rule): every person is a generic figure whose body, height,
 * build, skin, hair and clothes are chosen from a seed (the Ark animal's id), never from the capture: no photo, no face,
 * no name. The same id always gives the same person, in the town and in the forest (`humanLook`).
 *
 * One procedural low-poly body (~380 triangles near, ~110 far), drawn instanced in two levels: near within
 * `HUMAN_NEAR` m, the coarse body to `HUMAN_FAR` m, nothing beyond. Each vertex carries its part (skin, top, bottom,
 * hair, shoes; sleeves, trouser legs and long hair switched by the look) and its limb; each instance carries its
 * colours, its style and its pose's joint angles (`posePerson`), which the vertex shader turns at the hips, knees,
 * waist, neck, shoulders and elbows. The whole-body turn (lying, on a side) is in the instance matrix. Flat shaded,
 * vertex colours, no textures, no downloads; written into preallocated arrays each frame (no allocation).
 */

import {BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshDepthMaterial, MeshStandardMaterial, Quaternion, RGBADepthPacking, Vector3, type WebGLProgramParametersWithUniforms} from "three";

export type HumanPoseKind = "stand" | "walk" | "sit" | "lie" | "drive" | "chop" | "plant" | "sleep" | "carry";

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
};

export type HumanInstance = {x: number; y: number; z: number; yaw: number; pose: HumanPoseKind; phase: number; look: HumanLook; scale?: number; /** Leaning back (negative) or forward from the pose's waist (rad): a driver under a car's roof. */ lean?: number; /** A room's lamp and screen on it (0–1): indoors at night, where the scene's sun and street lamps do not reach. */ light?: number; /** Lying on a slope: the head's end raised this much (rad). */ tilt?: number};

/** Near body within this distance (m), the coarse one to HUMAN_FAR, nothing beyond. */
export const HUMAN_NEAR = 60;
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

/** Human skin tones across the range (deep to light). */
const SKIN = ["#3b2219", "#4f2d1f", "#6b3e2a", "#87573a", "#a0694a", "#b47b57", "#c68e68", "#d9a582", "#e6b896", "#f0c9ab", "#f3d3bd"].map(hex);
const HAIR = ["#141110", "#1f1712", "#2e2018", "#4a3020", "#6b4a2c", "#8c6a3e", "#b48c55", "#d2b57c", "#8a3b1e", "#9a9a96", "#d8d6d0"].map(hex);
const TOPS = ["#c8352b", "#2f5aa8", "#2d7a4e", "#e2b33c", "#f2f0ea", "#1d1f24", "#7a4a8c", "#e07a3a", "#4ea0b8", "#a8a39a", "#d86c8e", "#3c4e66", "#8a6a44", "#5c8a3a"].map(hex);
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
        skin: pick(SKIN, "skin"),
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
const PART = {skin: 0, top: 1, bottom: 2, hair: 3, shoes: 4, longHair: 5, forearm: 6, shin: 7} as const;
/** Limbs (which joints turn the vertex). */
const LIMB = {core: 0, lThigh: 1, lShin: 2, rThigh: 3, rShin: 4, lUpper: 5, lFore: 6, rUpper: 7, rFore: 8, head: 9, hips: 10} as const;

/** The joints' pivots on the rest body (m; facing +z, feet at y = 0). */
export const JOINTS = {hipY: 0.92, hipX: 0.1, kneeY: 0.5, waistY: 0.98, neckY: 1.5, shoulderY: 1.42, shoulderX: 0.215, elbowY: 1.15} as const;

class Builder {
    positions: number[] = [];
    rig: number[] = [];
    indices: number[] = [];
    private vertex(x: number, y: number, z: number, part: number, limb: number): number {
        this.positions.push(x, y, z);
        this.rig.push(part, limb);
        return this.positions.length / 3 - 1;
    }
    /** A vertical tapered prism (an elliptic cross-section of `sides`) from y0 to y1, centred at (cx, cz). */
    prism(cx: number, cz: number, y0: number, y1: number, rx0: number, rz0: number, rx1: number, rz1: number, sides: number, part: number, limb: number, caps = true) {
        const base = this.positions.length / 3;
        for (let ring = 0; ring < 2; ring++) {
            const y = ring ? y1 : y0;
            const rx = ring ? rx1 : rx0;
            const rz = ring ? rz1 : rz0;
            for (let s = 0; s < sides; s++) {
                const a = (s / sides) * Math.PI * 2 + Math.PI / sides;
                this.vertex(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz, part, limb);
            }
        }
        for (let s = 0; s < sides; s++) {
            const a = base + s;
            const b = base + ((s + 1) % sides);
            this.indices.push(a, a + sides, b, b, a + sides, b + sides);
        }
        if (caps) {
            for (let s = 1; s < sides - 1; s++) {
                this.indices.push(base, base + s + 1, base + s);
                this.indices.push(base + sides, base + sides + s, base + sides + s + 1);
            }
        }
    }
    /** An ellipsoid (lat-long), optionally only its rows from `fromRow`. */
    ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, around: number, rows: number, part: number, limb: number, fromRow = 0, shift = 0) {
        const base = this.positions.length / 3;
        for (let r = fromRow; r <= rows; r++) {
            const v = (r / rows) * Math.PI;
            for (let s = 0; s < around; s++) {
                const a = (s / around) * Math.PI * 2;
                this.vertex(cx + Math.sin(v) * Math.cos(a) * rx, cy + Math.cos(v) * ry, cz + Math.sin(v) * Math.sin(a) * rz + shift, part, limb);
            }
        }
        const n = rows - fromRow;
        for (let r = 0; r < n; r++) {
            for (let s = 0; s < around; s++) {
                const a = base + r * around + s;
                const b = base + r * around + ((s + 1) % around);
                this.indices.push(a, b, a + around, b, b + around, a + around);
            }
        }
    }
    /** A box between two corners. */
    box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, part: number, limb: number) {
        const base = this.positions.length / 3;
        for (let k = 0; k < 8; k++) this.vertex(k & 1 ? x1 : x0, k & 2 ? y1 : y0, k & 4 ? z1 : z0, part, limb);
        const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
        for (const [a, b, c, d] of faces) this.indices.push(base + a, base + b, base + c, base + a, base + c, base + d);
    }
    geometry(): BufferGeometry {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
        g.setAttribute("aRig", new BufferAttribute(new Float32Array(this.rig), 2));
        g.setIndex(this.indices);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
    }
}

/** The body (near: rounded limbs; far: boxes and a coarse head), built once. */
export function humanGeometry(far: boolean): BufferGeometry {
    const b = new Builder();
    const J = JOINTS;
    const sides = far ? 4 : 6;
    for (const side of [-1, 1]) {
        const x = side * J.hipX;
        const thigh = side < 0 ? LIMB.lThigh : LIMB.rThigh;
        const shin = side < 0 ? LIMB.lShin : LIMB.rShin;
        // Shoes (heel to toe), shin (skin or trouser leg), thigh (the bottom's colour).
        b.box(x - 0.048, 0, -0.06, x + 0.048, 0.075, 0.17, PART.shoes, shin);
        b.prism(x, 0, 0.07, J.kneeY, 0.05, 0.055, 0.062, 0.066, sides, PART.shin, shin, !far);
        b.prism(x, 0, J.kneeY - 0.02, J.hipY + 0.02, 0.065, 0.07, 0.085, 0.088, sides, PART.bottom, thigh, !far);
        const upper = side < 0 ? LIMB.lUpper : LIMB.rUpper;
        const fore = side < 0 ? LIMB.lFore : LIMB.rFore;
        const ax = side * J.shoulderX;
        b.prism(ax, 0, J.elbowY - 0.01, J.shoulderY + 0.03, 0.042, 0.045, 0.05, 0.052, sides, PART.top, upper, !far);
        b.prism(ax, 0.005, 0.9, J.elbowY + 0.01, 0.034, 0.036, 0.042, 0.044, sides, PART.forearm, fore, !far);
        if (!far) b.ellipsoid(ax, 0.84, 0.01, 0.034, 0.06, 0.028, 5, 3, PART.skin, fore);
    }
    // Hips (the bottom's colour), torso (the top's), neck, head, hair.
    b.prism(0, 0, 0.84, 1.0, 0.165, 0.105, 0.17, 0.11, far ? 6 : 8, PART.bottom, LIMB.hips);
    b.prism(0, 0, 0.98, 1.3, 0.165, 0.105, 0.185, 0.115, far ? 6 : 8, PART.top, LIMB.core, false);
    b.prism(0, 0, 1.3, 1.46, 0.185, 0.115, 0.15, 0.1, far ? 6 : 8, PART.top, LIMB.core);
    b.prism(0, 0.005, 1.44, 1.53, 0.045, 0.045, 0.042, 0.042, sides, PART.skin, LIMB.head, false);
    b.ellipsoid(0, 1.635, 0.01, 0.092, 0.115, 0.1, far ? 6 : 9, far ? 4 : 7, PART.skin, LIMB.head);
    // The hair's cap over the crown and the back (no face is ever drawn: a plain head).
    b.ellipsoid(0, 1.645, -0.005, 0.099, 0.118, 0.104, far ? 6 : 9, far ? 2 : 4, PART.hair, LIMB.head);
    if (!far) b.box(-0.095, 1.4, -0.115, 0.095, 1.66, -0.06, PART.longHair, LIMB.head);
    return b.geometry();
}

// MARK: - Poses

/** Joint angles (radians): legs (left hip, left knee, right hip, right knee), arms (left shoulder, left elbow, right shoulder, right elbow), body (waist, neck, arms out, -). */
export type HumanJoints = {legs: [number, number, number, number]; arms: [number, number, number, number]; body: [number, number, number, number]};

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
            const s = Math.sin(phase * Math.PI * 1.9);
            l[0] = s * 0.42;
            l[2] = -s * 0.42;
            l[1] = Math.max(0, -s) * 0.7 + 0.08;
            l[3] = Math.max(0, s) * 0.7 + 0.08;
            if (pose === "walk") {
                a[0] = -s * 0.38;
                a[2] = s * 0.38;
                a[1] = a[3] = 0.25;
                b[2] = 0.06;
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
            // An axe's stroke a second and a half: wind up overhead, the strike down and across, a pause.
            const t = ((phase / 1.5) % 1 + 1) % 1;
            const up = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.15;
            const raise = Math.max(0, Math.min(1, up));
            a[0] = a[2] = 0.9 + raise * 1.9;
            a[1] = a[3] = 0.25 + raise * 0.4;
            b[0] = 0.4 - raise * 0.35;
            l[0] = 0.15;
            l[2] = -0.15;
            l[1] = l[3] = 0.2;
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
    return {pitch: 0, roll: 0, lift: 0};
}

/** Where a sitter's root (its feet's level when standing) goes for a seat at `seatY`: the hips' pelvis on the seat. */
export function sitRootY(seatY: number, scale: number): number {
    return seatY - 0.86 * scale;
}

// MARK: - The material

const RIG_GLSL = /* glsl */ `
attribute vec2 aRig;
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
vec3 humanSwing(vec3 p, vec3 pivot, float a) {
    vec3 d = p - pivot;
    float c = cos(a), s = sin(a);
    return pivot + vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
}
vec3 humanOut(vec3 p, vec3 pivot, float a) {
    vec3 d = p - pivot;
    float c = cos(a), s = sin(a);
    return pivot + vec3(d.x * c - d.y * s, d.x * s + d.y * c, d.z);
}
vec3 humanPose(vec3 p) {
    float part = aRig.x;
    float limb = aRig.y;
    // Long hair folds into the head when the look has none; a bald head's cap is the skin.
    if (part > 4.5 && part < 5.5 && iStyle.x < 0.5) p = vec3(0.0, 1.6, -0.02);
    float side = p.x < 0.0 ? -1.0 : 1.0;
    // Legs: knee, then hip.
    if (limb > 0.5 && limb < 4.5) {
        bool left = limb < 2.5;
        float hip = left ? iLegs.x : iLegs.z;
        float knee = left ? iLegs.y : iLegs.w;
        float hx = left ? -${JOINTS.hipX.toFixed(3)} : ${JOINTS.hipX.toFixed(3)};
        if (limb > 1.5 && limb < 2.5 || limb > 3.5) p = humanSwing(p, vec3(hx, ${JOINTS.kneeY.toFixed(3)}, 0.0), knee);
        p = humanSwing(p, vec3(hx, ${JOINTS.hipY.toFixed(3)}, 0.0), -hip);
        return p;
    }
    if (limb > 9.5) return p;
    // Arms: elbow, shoulder (forward and out), then the waist.
    if (limb > 4.5 && limb < 8.5) {
        bool left = limb < 6.5;
        float sh = left ? iArms.x : iArms.z;
        float el = left ? iArms.y : iArms.w;
        float ax = left ? -${JOINTS.shoulderX.toFixed(3)} : ${JOINTS.shoulderX.toFixed(3)};
        if (limb > 5.5 && limb < 6.5 || limb > 7.5) p = humanSwing(p, vec3(ax, ${JOINTS.elbowY.toFixed(3)}, 0.0), -el);
        p = humanSwing(p, vec3(ax, ${JOINTS.shoulderY.toFixed(3)}, 0.0), -sh);
        p = humanOut(p, vec3(ax, ${JOINTS.shoulderY.toFixed(3)}, 0.0), (left ? -1.0 : 1.0) * iBody.z * (sh < 1.2 ? 1.0 : 0.2));
    }
    if (limb > 8.5) p = humanSwing(p, vec3(0.0, ${JOINTS.neckY.toFixed(3)}, 0.0), iBody.y);
    return humanSwing(p, vec3(0.0, ${JOINTS.waistY.toFixed(3)}, 0.0), iBody.x);
}
vec3 humanPaint() {
    float part = aRig.x;
    vec3 shoes = iBottom * 0.35 + vec3(0.05);
    if (part < 0.5) return iSkin;
    if (part < 1.5) return iTop;
    if (part < 2.5) return iBottom;
    if (part < 3.5) return mix(iHair, iSkin, iStyle.w);
    if (part < 4.5) return shoes;
    if (part < 5.5) return iHair;
    if (part < 6.5) return mix(iSkin, iTop, iStyle.y);
    return mix(iSkin, iBottom, iStyle.z);
}
`;

function rigShader(shader: WebGLProgramParametersWithUniforms, colour: boolean) {
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${RIG_GLSL}`)
        .replace("#include <begin_vertex>", "vec3 transformed = humanPose(position);")
        .replace("#include <beginnormal_vertex>", "vec3 objectNormal = normal;");
    if (colour) {
        shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", "#include <color_vertex>\nvHumanColour = humanPaint();\nvHumanLight = iBody.w;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vHumanColour;\nvarying float vHumanLight;")
            .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vHumanColour, opacity );")
            // (Indoors at night: the room's lamp and the screen's glow on them, warm with a cool flicker.)
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vHumanColour * vHumanLight * vec3(0.5, 0.47, 0.44);");
    }
}

export function humanMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({color: 0xffffff, flatShading: true, roughness: 0.85, metalness: 0});
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
