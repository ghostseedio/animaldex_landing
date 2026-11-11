/**
 * The animals' material: the skin, lit like the rest of the world, drawn
 * instanced. Each instance carries `arkInstance` = (phase, dim, rest): rest
 * is 1 asleep (still, the head lowered, breathing slow).
 *
 * Asleep (`sleep.ts`, docs/ark/sleep.md), `arkInstance.w` carries its sleep,
 * packed (`packSleep`: no new attribute, a rig's fur shells already use every
 * slot a GPU has): eyes shut 0–1, the spine's curl in radians each half (+
 * toward its left), a tail flick 0–1, its breaths a second (`arkSleep` once
 * unpacked). The eyes shut (`animal-look-shader`),
 * and near the camera the body curls round, the chest rises and falls at its
 * species' pace and the tail flicks when it stirs. A rig gets the same breath
 * and curl on its skinned pose.
 *
 * The near level moves on its own: the call's idle motion
 * (`talking-model-renderer.ts`: breathing, the slow sway and look round, and
 * the body's own motion from `behaviour` — swim, flap, pulse, sway, a tail
 * that wags now and then) ported to run per instance, each on its own phase
 * so a herd never moves in step. It fades out between 18 and 25 m from the
 * camera, and the far level has none, so only animals near the camera move.
 *
 * Heads turn to look (`reactive.ts`, `head-look.ts`): each near instance
 * carries `arkLook` = (yaw, pitch, weight), and the head and neck turn about
 * the neck by it. A rigged animal with a look chain (`rig-player.ts`
 * `RigLookChain`, the rig contract's section 5) turns its neck and head
 * bones: a rotation in the rest pose about each bone's joint, under the
 * clip (`M_neck · R_neck`, `M_head · R_neck · R_head`), so a grazing head
 * turns sideways at the ground; within the chain's own limits, split by its
 * neck share. The others turn the front of the body about the neck, as the
 * sleeping droop does. The limits per body plan are applied before
 * (`head-look.ts`).
 *
 * "Dim" greys an animal toward the haze ("My animals" shows the viewer's
 * own in full colour and the rest dimmed).
 */

import {Color, MeshStandardMaterial, Vector2, Vector3, Vector4, type Texture} from "three";
import type {RigLookChain} from "@/ark-scene/rig-player";
import {LIVE_DECLARATIONS, LIVE_FETCH} from "@/ark-scene/locomotion/pose-texture";
import {motionUniforms, type TalkingBehaviour} from "@/lib/talking-models/behaviour";
import {SKY} from "@/ark-scene/palettes";
import {ARK_RIM} from "@/ark-scene/glsl";
import {lookCacheKey, lookDefines, lookUniforms, registerLookMaterial, type SpeciesLook} from "@/ark-scene/animal-look";
import {LOOK_ALBEDO, LOOK_FINISH, LOOK_FRAGMENT_DECLARATIONS, LOOK_LIGHT, LOOK_NORMAL, LOOK_ROUGHNESS, LOOK_VERTEX, LOOK_VERTEX_DECLARATIONS, SHELL_VERTEX} from "@/ark-scene/animal-look-shader";
import {varyShader} from "@/ark-scene/ark-variation";
import {L2_BODY_NONE, type L2BodyUniforms} from "@/ark-scene/locomotion/l2-scene";

/** One clock for every animal, in seconds. */
export const ARK_CLOCK = {value: 0};

/**
 * `motionBody` from talking-model-renderer.ts, with the clock, gain and tail angle per instance.
 *
 * Motion pass lane L2 (`locomotion/swim.ts`, `locomotion/legless.ts`, `locomotion/l2-scene.ts`): a species with a swim
 * style or a legless mode (`motionPower` > 0) bends by its own envelope h + (1 - h) s^p (an eel's whole body, a tuna's
 * tail only, a whale's flukes up and down), with a sidewinder's lifting wave and a worm's stretch; a ray's fin waves
 * front to back (stingrays) or flaps (mantas). Its beat comes from the per-instance body channel (`arkLook.w` ≥ 1:
 * the phase by the distance it moved, so the tail beat follows its speed and a snake never slips), else the clock.
 */
const MOTION_BODY = `
{
    vec3 mp = transformed;
    float bodyRun = max(motionStill - motionRear, 0.001);
    float along = clamp((motionStill - mp.z) / bodyRun, 0.0, 1.0);
    float beat = motionClock * motionOmega;
    float bodyGain = 1.0;
    if (arkLook.w >= 1.0) {
        float whole = floor(arkLook.w);
        beat = (arkLook.w - whole) * 6.28318;
        bodyGain = (whole - 1.0) / 254.0;
    }
    float height = clamp((mp.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    if (motionPower > 0.0 && motionKind > 0.5 && motionKind < 1.5) {
        float env = motionHead + (1.0 - motionHead) * pow(along, motionPower);
        float wave = beat - along * motionWavesL2 * 6.28318;
        float size = motionGain * bodyGain;
        float bend = motionTip * size * env * sin(wave);
        if (motionAxisL2 < 0.5) { mp.x += bend; } else { mp.y += bend; }
        // Sidewinding: the lifting wave a quarter beat ahead of the sideways one (only the sections on the sand stay down).
        if (motionLift > 0.0) mp.y += motionLift * size * max(sin(wave + 1.5708), 0.0);
        // Peristalsis: each part stretches and squeezes as the wave passes (thinner where it is longer).
        if (motionStretch > 0.0) {
            float strain = motionStretch * size * sin(wave);
            mp.z -= motionStretch * size * cos(wave) * bodyRun / (6.28318 * max(motionWavesL2, 0.1));
            mp.xy *= 1.0 - 0.5 * strain;
        }
    } else if (motionPower > 0.0 && motionKind > 1.5 && motionKind < 2.5) {
        float reach = clamp((abs(mp.x) - motionSpan * 0.2) / max(motionSpan * 0.8, 0.001), 0.0, 1.0);
        float flaps = motionFin > 1.5 ? 1.0 : 0.0;
        float lag = flaps * reach * 0.6;
        mp.y += motionTip * motionGain * bodyGain * motionSpan * pow(reach, mix(2.0, 1.5, flaps)) * sin(beat - along * motionWavesL2 * 6.28318 - lag);
    } else if (motionKind > 0.5 && motionKind < 1.5) {
        float bend = motionAmp * motionGain * along * along * sin(beat - along * motionWaves * 6.28318);
        if (motionAxis < 0.5) { mp.x += bend; } else { mp.y += bend; }
    } else if (motionKind > 1.5 && motionKind < 2.5) {
        float reach = clamp((abs(mp.x) - motionSpan * 0.2) / max(motionSpan * 0.8, 0.001), 0.0, 1.0);
        mp.y += motionAmp * motionGain * motionSpan * reach * reach * sin(beat - reach * motionWaves * 6.28318);
    } else if (motionKind > 2.5 && motionKind < 3.5) {
        float squeeze = 1.0 + motionAmp * motionGain * sin(beat) * (0.3 + 0.7 * height);
        mp.x *= squeeze;
        mp.z = motionMidZ + (mp.z - motionMidZ) * squeeze;
        mp.y += motionAmp * motionGain * 0.25 * (1.0 - height) * sin(beat - 1.2) * (motionTop - motionBottom);
    } else if (motionKind > 3.5) {
        mp.x += motionAmp * motionGain * height * height * sin(beat + mp.z * 4.0);
        mp.z += motionAmp * motionGain * 0.5 * height * height * cos(beat * 0.7 + mp.x * 3.0);
    }
    if (tailLength > 0.0 && mp.z < tailBaseZ) {
        float into = clamp((tailBaseZ - mp.z) / tailLength, 0.0, 1.0);
        float swing = tailAngle * into;
        float dx = mp.x - tailBaseX;
        float dz = mp.z - tailBaseZ;
        float c = cos(swing);
        float s = sin(swing);
        mp.x = tailBaseX + dx * c - dz * s;
        mp.z = tailBaseZ + dx * s + dz * c;
    }
    transformed = mp;
}
`;

const MOTION_DECLARATIONS = `
// (x, y, z): the head look's yaw, pitch and weight; w: lane L2's body channel (0 none, >= 1 a wave's phase and gain).
attribute vec4 arkLook;
// The sleep packed in arkInstance.w (sleep.ts packSleep): four 6-bit fields; every divisor a power of two, so exact.
vec4 arkSleepOf(float packed) {
    // (0: an instance never written, or a mesh drawn without its sleep: awake.)
    if (packed < 0.5) return vec4(0.0);
    float p = floor(packed + 0.5);
    float eyes = floor(p / 262144.0);
    p -= eyes * 262144.0;
    float curl = floor(p / 4096.0);
    p -= curl * 4096.0;
    float flick = floor(p / 64.0);
    float breath = p - flick * 64.0;
    return vec4(eyes / 63.0, (curl - 31.0) / 25.0, flick / 63.0, breath / 50.0);
}
uniform float arkClock;
uniform float arkDroop;
uniform float motionKind;
uniform float motionAxis;
uniform float motionAmp;
uniform float motionOmega;
uniform float motionWaves;
uniform float motionStill;
uniform float motionRear;
uniform float motionSpan;
uniform float motionBottom;
uniform float motionTop;
uniform float motionMidZ;
uniform float tailBaseX;
uniform float tailBaseZ;
uniform float tailLength;
uniform float motionHead;
uniform float motionPower;
uniform float motionTip;
uniform float motionLift;
uniform float motionStretch;
uniform float motionFin;
uniform float motionWavesL2;
uniform float motionAxisL2;
`;

/**
 * A rigged animal (`rig-player.ts`): per vertex four bones of the rig's
 * bone texture (a row per frame, three texels per bone: the 3×4 rows), per
 * instance the clip now (A: its frame's row, the next row, how far between,
 * and the rig's weight against the rest pose) and the clip it is leaving
 * (B: the same three, and how much of it is left). At weight 0 the mesh is
 * in its rest pose, which is the near model's: the swap never pops.
 */
const RIG_DECLARATIONS = `
uniform highp sampler2D arkBones;
${LIVE_DECLARATIONS}
attribute vec4 arkJoints;
attribute vec4 arkWeights;
attribute vec4 arkRigA;
attribute vec4 arkRigB;
// The look chain: the neck's and the head's texture index (-1: none), their joints in the rest pose, and the
// limits (yaw, pitch up, pitch down; radians) with the neck's share of the turn.
uniform vec2 arkLookBones;
uniform vec3 arkLookNeckPivot;
uniform vec3 arkLookHeadPivot;
uniform vec4 arkLookLimits;
mat4 arkLookNeck = mat4(1.0);
mat4 arkLookHead = mat4(1.0);
bool arkLooking = false;
/** T(pivot) · Ry(yaw) · Rx(pitch) · T(-pivot): yaw toward the animal's left (+x), pitch down (+). */
mat4 arkTurn(vec3 pivot, float yaw, float pitch) {
    float cy = cos(yaw);
    float sy = sin(yaw);
    float cp = cos(pitch);
    float sp = sin(pitch);
    mat3 r = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
    return mat4(vec4(r[0], 0.0), vec4(r[1], 0.0), vec4(r[2], 0.0), vec4(pivot - r * pivot, 1.0));
}
mat4 arkBone(float row, float bone) {
    int x = int(bone + 0.5) * 3;
    int y = max(int(row + 0.5), 0);
    vec4 r0 = texelFetch(arkBones, ivec2(x, y), 0);
    vec4 r1 = texelFetch(arkBones, ivec2(x + 1, y), 0);
    vec4 r2 = texelFetch(arkBones, ivec2(x + 2, y), 0);
    // The locomotion layer's live pose (a negative row: locomotion/pose-texture.ts).
${LIVE_FETCH}    return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 arkBoneAt(vec3 at, float bone) {
    mat4 m = arkBone(at.x, bone) * (1.0 - at.z) + arkBone(at.y, bone) * at.z;
    if (arkLooking) {
        if (abs(bone - arkLookBones.x) < 0.5) return m * arkLookNeck;
        if (abs(bone - arkLookBones.y) < 0.5) return m * arkLookHead;
    }
    return m;
}
mat4 arkSkinAt(vec3 at) {
    return arkBoneAt(at, arkJoints.x) * arkWeights.x + arkBoneAt(at, arkJoints.y) * arkWeights.y
        + arkBoneAt(at, arkJoints.z) * arkWeights.z + arkBoneAt(at, arkJoints.w) * arkWeights.w;
}
`;

/** The skin matrix this frame (before the normals), then applied to the position. */
const RIG_SKIN = `
// The head look on the chain's bones (the reactive layer's arkLook: + yaw to its left, + pitch up), clamped to the
// chain's limits; the neck takes its share, the head the rest and rides on the neck's turn.
if (arkLook.z > 0.001 && arkLookBones.y >= 0.0) {
    float lookYaw = clamp(arkLook.x, -arkLookLimits.x, arkLookLimits.x) * arkLook.z;
    float lookPitch = clamp(-arkLook.y, -arkLookLimits.y, arkLookLimits.z) * arkLook.z;
    float neckShare = arkLookBones.x >= 0.0 ? arkLookLimits.w : 0.0;
    arkLookNeck = arkTurn(arkLookNeckPivot, lookYaw * neckShare, lookPitch * neckShare);
    arkLookHead = arkLookNeck * arkTurn(arkLookHeadPivot, lookYaw * (1.0 - neckShare), lookPitch * (1.0 - neckShare));
    arkLooking = true;
}
mat4 arkSkin = arkSkinAt(arkRigA.xyz);
if (arkRigB.w > 0.001) arkSkin = arkSkin * (1.0 - arkRigB.w) + arkSkinAt(arkRigB.xyz) * arkRigB.w;
arkSkin = mat4(1.0) * (1.0 - arkRigA.w) + arkSkin * arkRigA.w;
objectNormal = normalize(mat3(arkSkin) * objectNormal);
`;

const IDLE = `
#ifdef ARK_RIG
transformed = (arkSkin * vec4(transformed, 1.0)).xyz;
#endif
#ifdef ARK_MOTION
{
    vec3 arkOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float motionGain = 1.0 - smoothstep(18.0, 25.0, distance(arkOrigin, cameraPosition));
#ifdef ARK_RIG
    // The rig's own idle takes over from the procedural one as it fades in.
    motionGain *= 1.0 - arkRigA.w;
#endif
    // Asleep (the hour and the species' activity): still, the head down, breathing slow.
    float arkRest = arkInstance.z;
    if (arkRest > 0.001 && arkDroop > 0.0) {
        float headFrom = motionStill - (motionStill - motionRear) * 0.14;
        float into = smoothstep(headFrom, motionStill + 0.04, transformed.z);
        float droop = arkDroop * arkRest * into;
        float py = mix(motionBottom, motionTop, 0.7);
        float dy = transformed.y - py;
        float dz = transformed.z - headFrom;
        float cd = cos(droop);
        float sd = sin(droop);
        transformed.y = py + dy * cd - dz * sd;
        transformed.z = headFrom + dy * sd + dz * cd;
    }
    // Looking (the reactive layer): the head and neck turn about the neck, within the plan's limits.
    if (arkLook.z > 0.001) {
        float run = max(motionStill - motionRear, 0.001);
        float neckFrom = motionStill - run * 0.3;
        float mask = smoothstep(neckFrom, motionStill - run * 0.12, transformed.z);
        vec3 pivot = vec3(0.0, mix(motionBottom, motionTop, 0.62), neckFrom);
#ifdef ARK_RIG
        // A rig with a look chain turns its bones (RIG_SKIN), as far as the rig is in: this takes the rest.
        // (-2: a rig with no look at all, a low-chained sitting one: no turn of the front of the body either.)
        if (arkLookBones.y >= 0.0 || arkLookBones.y < -1.5) mask *= 1.0 - arkRigA.w;
#endif
        float lookYaw = arkLook.x * arkLook.z * mask;
        float lookPitch = arkLook.y * arkLook.z * mask;
        vec3 q = transformed - pivot;
        float cp = cos(lookPitch);
        float sp = sin(lookPitch);
        q.yz = vec2(q.y * cp + q.z * sp, -q.y * sp + q.z * cp);
        float cy = cos(lookYaw);
        float sy = sin(lookYaw);
        q.xz = vec2(q.x * cy + q.z * sy, -q.x * sy + q.z * cy);
        transformed = pivot + q;
    }
    if (motionGain > 0.0) {
        float awake = motionGain * (1.0 - 0.9 * arkRest);
        float motionClock = arkClock + arkInstance.x * 61.0;
        // A tail wags now and then, not all the time; asleep it flicks once as the animal stirs (sleep.ts sleepStir).
        float tailAngle = awake * 0.28 * sin(motionClock * 2.6) * smoothstep(0.4, 0.8, sin(motionClock * 0.23 + arkInstance.x * 9.0));
        tailAngle += motionGain * arkSleep.z * 0.5 * sin(motionClock * 8.0);
        {
            float motionGain = awake;
            ${MOTION_BODY}
        }
        // Breathing (slower and deeper asleep: the sleep breath below when it has one), and the call's slow sway and look round (its root motion).
        float breathe = 1.0 + motionGain * mix(0.012 * sin(motionClock * 1.7), arkSleep.w > 0.0 ? 0.0 : 0.018 * sin(motionClock * 0.9), arkRest);
        transformed.y = motionBottom + (transformed.y - motionBottom) * breathe;
        float yaw = 0.07 * awake * sin(motionClock * 0.29);
        float pitch = 0.02 * awake * sin(motionClock * 0.61);
        float cy = cos(yaw);
        float sy = sin(yaw);
        transformed.xz = vec2(cy * transformed.x + sy * transformed.z, -sy * transformed.x + cy * transformed.z);
        float cp = cos(pitch);
        float sp = sin(pitch);
        transformed.yz = vec2(cp * transformed.y - sp * transformed.z, sp * transformed.y + cp * transformed.z);
    }
    // Asleep (sleep.ts): near the camera only, on a rig too. The chest rises and falls at its species' pace (on the
    // shared clock), and a curled sleeper's spine bends round toward its side, the head and tail coming together.
    float arkSleepNear = 1.0 - smoothstep(18.0, 25.0, distance(arkOrigin, cameraPosition));
    if (arkSleepNear > 0.0 && (arkSleep.w > 0.0 || abs(arkSleep.y) > 0.001)) {
        float run = max(motionStill - motionRear, 0.001);
        float mid = (motionStill + motionRear) * 0.5;
        if (arkSleep.w > 0.0) {
            float inhale = 0.5 + 0.5 * sin(arkClock * 6.28318 * arkSleep.w + arkInstance.x * 37.0);
            float along = (transformed.z - mid) / (run * 0.5);
            float chest = exp(-along * along * 2.2) * arkRest * arkSleepNear;
            float centre = mix(motionBottom, motionTop, 0.45);
            transformed.y = centre + (transformed.y - centre) * (1.0 + 0.045 * inhale * chest);
            transformed.x *= 1.0 + 0.03 * inhale * chest;
        }
        float phi = arkSleep.y * arkSleepNear;
        if (abs(phi) > 0.001) {
            float bendR = run * 0.5 / phi;
            float th = (transformed.z - mid) / bendR;
            float r = bendR - transformed.x;
            transformed.x = bendR - r * cos(th);
            transformed.z = mid + r * sin(th);
        }
    }
}
#endif
`;

const DROOPING_PLANS = new Set(["mammal", "bird", "reptile", "frog", "turtle"]);
/** How far the material lowers the head asleep (radians at rest 1), by the model's plan: a sleep posture's head allows for it. */
export const ARK_DROOP = 0.32;
export function droopOf(plan: string | null | undefined): number {
    return DROOPING_PLANS.has(plan ?? "") ? ARK_DROOP : 0;
}

export type AnimalMaterialOptions = {
    map: Texture | null;
    behaviour: TalkingBehaviour | null;
    /** The model's lowest and highest y, for a model with no behaviour extent. */
    minY: number;
    maxY: number;
    animated: boolean;
    /** A rigged mesh: its bone texture (`rig-player.ts`). */
    rig?: Texture | null;
    /** A rigged mesh's live pose texture (the locomotion layer, `locomotion/pose-texture.ts`): rows the CPU poses. */
    pose?: Texture | null;
    /**
     * A rigged mesh's look chain (`rig-player.ts`): its neck and head bones, their rest joints and limits; null without
     * a head bone. (Named apart from `look`, the animal-look pass's surface.)
     */
    lookChain?: RigLookChain | null;
    /** A rigged mesh with no look at all (`RigModel.lookOff`): the shader's turn stays off for it too. */
    lookOff?: boolean;
    /** The animal-look pass (`animal-look.ts`): the species' surface and eyes; null draws it as before. */
    look?: SpeciesLook | null;
    /** Which level this draws: the far level keeps the pass's cheapest form. */
    level?: "near" | "far";
    /** A fur-shell pass of the near (or rigged) mesh (`fur-shells.ts`), and how far its outer layer stands off (model units). */
    shell?: boolean;
    shellLength?: number;
    /** Lane L2's wave for this species (`locomotion/l2-scene.ts` l2BodyUniforms); absent: the talking model's own motion. */
    bodyMotion?: L2BodyUniforms | null;
};

export function animalMaterial(options: AnimalMaterialOptions): MeshStandardMaterial {
    const material = new MeshStandardMaterial({map: options.map, roughness: 0.78, metalness: 0, envMapIntensity: 0.9});
    const motion = motionUniforms(options.behaviour) ?? {
        motionKind: 0,
        motionAxis: 0,
        motionAmp: 0,
        motionOmega: 1,
        motionWaves: 0,
        motionStill: options.maxY,
        motionRear: options.minY,
        motionSpan: 0.3,
        motionBottom: options.minY,
        motionTop: options.maxY,
        motionMidZ: 0,
        tailBaseX: 0,
        tailBaseZ: 0,
        tailLength: 0
    };
    const uniforms: Record<string, {value: unknown}> = {
        arkClock: ARK_CLOCK,
        arkDimTint: {value: new Color(SKY.horizon)},
        arkRim: ARK_RIM,
        // How far the head goes down asleep: animals with a head and neck to lower.
        arkDroop: {value: droopOf(options.behaviour?.plan)},
        ...Object.fromEntries(Object.entries(motion).map(([key, value]) => [key, {value}])),
        ...Object.fromEntries(Object.entries(options.bodyMotion ?? L2_BODY_NONE).map(([key, value]) => [key, {value}]))
    };
    if (options.rig) {
        uniforms.arkBones = {value: options.rig};
        if (options.pose) uniforms.arkPoseBones = {value: options.pose};
        const chain = options.lookChain ?? null;
        uniforms.arkLookBones = {value: new Vector2(chain ? chain.neck : -1, chain ? chain.head : options.lookOff ? -2 : -1)};
        uniforms.arkLookNeckPivot = {value: new Vector3(...(chain?.neckPivot ?? [0, 0, 0]))};
        uniforms.arkLookHeadPivot = {value: new Vector3(...(chain?.headPivot ?? [0, 0, 0]))};
        uniforms.arkLookLimits = {value: new Vector4(chain?.yaw ?? 0, chain?.up ?? 0, chain?.down ?? 0, chain?.neckShare ?? 0)};
    }
    const level = options.level ?? (options.animated ? "near" : "far");
    Object.assign(uniforms, lookUniforms(options.look ?? null, level, options.shellLength ?? 0.01));
    material.userData.arkLook = {look: options.look ?? null, level, shell: Boolean(options.shell)};
    material.userData.arkOptions = options;
    material.defines = {...(options.animated ? {ARK_MOTION: ""} : {}), ...(options.rig ? {ARK_RIG: ""} : {}), ...(options.rig && options.pose ? {ARK_RIG_LIVE: ""} : {}), ...lookDefines(material)};
    const key = `${options.animated ? "ark-animal-near" : "ark-animal-far"}${options.rig ? (options.pose ? "-rig-live" : "-rig") : ""}`;
    material.customProgramCacheKey = () => key + lookCacheKey(material);
    if (options.look) registerLookMaterial(material);
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec4 arkInstance;
varying float vArkDim;
${MOTION_DECLARATIONS}
${options.rig ? RIG_DECLARATIONS : ""}
${LOOK_VERTEX_DECLARATIONS}`)
            .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
${options.rig ? RIG_SKIN : ""}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
vArkDim = arkInstance.y;
vec4 arkSleep = arkSleepOf(arkInstance.w);
${LOOK_VERTEX}
${IDLE}
${SHELL_VERTEX}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying float vArkDim;
uniform vec3 arkDimTint;
uniform vec3 arkRim;
${LOOK_FRAGMENT_DECLARATIONS}`)
            .replace("#include <map_fragment>", `#include <map_fragment>
${LOOK_ALBEDO}`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
${LOOK_ROUGHNESS}`)
            .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
${LOOK_NORMAL}`)
            .replace("#include <lights_fragment_begin>", `#include <lights_fragment_begin>
${LOOK_LIGHT}`)
            .replace("#include <opaque_fragment>", `${LOOK_FINISH}
#include <opaque_fragment>
{
    float grey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(grey), arkDimTint, 0.5) * 0.75, vArkDim * 0.82);
}`);
        // Each animal its own tint and mottling (`ark-variation.ts`, liveliness).
        varyShader(shader, options.maxY - options.minY);
    };
    return material;
}
