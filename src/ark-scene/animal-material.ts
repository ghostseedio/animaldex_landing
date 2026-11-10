/**
 * The animals' material: the skin, lit like the rest of the world, drawn
 * instanced. Each instance carries `arkInstance` = (phase, dim).
 *
 * The near level moves on its own: the call's idle motion
 * (`talking-model-renderer.ts`: breathing, the slow sway and look round, and
 * the body's own motion from `behaviour` — swim, flap, pulse, sway, a tail
 * that wags now and then) ported to run per instance, each on its own phase
 * so a herd never moves in step. It fades out between 18 and 25 m from the
 * camera, and the far level has none, so only animals near the camera move.
 *
 * "Dim" greys an animal toward the haze ("My animals" shows the viewer's
 * own in full colour and the rest dimmed).
 */

import {Color, MeshStandardMaterial, type Texture} from "three";
import {motionUniforms, type TalkingBehaviour} from "@/lib/talking-models/behaviour";
import {SKY} from "@/ark-scene/palettes";

/** One clock for every animal, in seconds. */
export const ARK_CLOCK = {value: 0};

/** `motionBody` from talking-model-renderer.ts, with the clock, gain and tail angle per instance. */
const MOTION_BODY = `
{
    vec3 mp = transformed;
    float bodyRun = max(motionStill - motionRear, 0.001);
    float along = clamp((motionStill - mp.z) / bodyRun, 0.0, 1.0);
    float beat = motionClock * motionOmega;
    float height = clamp((mp.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    if (motionKind > 0.5 && motionKind < 1.5) {
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
uniform float arkClock;
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
`;

const IDLE = `
#ifdef ARK_MOTION
{
    vec3 arkOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float motionGain = 1.0 - smoothstep(18.0, 25.0, distance(arkOrigin, cameraPosition));
    if (motionGain > 0.0) {
        float motionClock = arkClock + arkInstance.x * 61.0;
        // A tail wags now and then, not all the time.
        float tailAngle = motionGain * 0.28 * sin(motionClock * 2.6) * smoothstep(0.4, 0.8, sin(motionClock * 0.23 + arkInstance.x * 9.0));
        ${MOTION_BODY}
        // Breathing, and the call's slow sway and look round (its root motion).
        float breathe = 1.0 + 0.012 * motionGain * sin(motionClock * 1.7);
        transformed.y = motionBottom + (transformed.y - motionBottom) * breathe;
        float yaw = 0.07 * motionGain * sin(motionClock * 0.29);
        float pitch = 0.02 * motionGain * sin(motionClock * 0.61);
        float cy = cos(yaw);
        float sy = sin(yaw);
        transformed.xz = vec2(cy * transformed.x + sy * transformed.z, -sy * transformed.x + cy * transformed.z);
        float cp = cos(pitch);
        float sp = sin(pitch);
        transformed.yz = vec2(cp * transformed.y - sp * transformed.z, sp * transformed.y + cp * transformed.z);
    }
}
#endif
`;

export type AnimalMaterialOptions = {
    map: Texture | null;
    behaviour: TalkingBehaviour | null;
    /** The model's lowest and highest y, for a model with no behaviour extent. */
    minY: number;
    maxY: number;
    animated: boolean;
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
        ...Object.fromEntries(Object.entries(motion).map(([key, value]) => [key, {value}]))
    };
    if (options.animated) material.defines = {ARK_MOTION: ""};
    material.customProgramCacheKey = () => (options.animated ? "ark-animal-near" : "ark-animal-far");
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec2 arkInstance;
varying float vArkDim;
${MOTION_DECLARATIONS}`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
vArkDim = arkInstance.y;
${IDLE}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying float vArkDim;
uniform vec3 arkDimTint;`)
            .replace("#include <opaque_fragment>", `// A warm rim where the surface turns away: the low sun catching fur and feathers at the edge.
outgoingLight += vec3(1.0, 0.82, 0.6) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0) * 0.22 * (1.0 - vArkDim);
#include <opaque_fragment>
{
    float grey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(grey), arkDimTint, 0.5) * 0.75, vArkDim * 0.82);
}`);
    };
    return material;
}
