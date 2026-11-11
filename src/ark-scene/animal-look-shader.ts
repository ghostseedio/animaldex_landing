/**
 * The animal-look pass's shader pieces (`animal-material.ts` splices them
 * into the animals' MeshStandardMaterial; docs/ark/animal-look.md):
 *
 * - a surface per class (`animal-look-rules.ts`): fine normal detail made in
 *   the model's own rest-pose space (so it sticks to the body as it moves
 *   and walks: fur strands combed head to tail, feather scallops and barbs,
 *   raised scales, skin creases, shell plates, a slime's slow undulation),
 *   faded out where it would be smaller than a pixel; the class's roughness;
 *   a soft albedo-tinted rim for fur and feathers; a sharp second highlight
 *   (a coat) for shell, scales and anything wet or slimy; light through the
 *   edges of skin and slime;
 * - wet (`arkCoat.x`): darker, glossier, sleeker; dusty (`arkCoat.y`): a
 *   pale, dry film on the legs and belly;
 * - the eyes (the talking model's two glossy eyes, from its build): a dome
 *   for the light and the sky to catch, and a small catchlight up and to the
 *   left, softer at night;
 * - fur shells (`ARK_SHELL`, `fur-shells.ts`): the same body pushed out along
 *   its normal in layers, cut to strands.
 *
 * Defines: `ARK_LOOK` (the pass on: off is the material as it was),
 * `ARK_LOOK_TIER` 0 (low, and every far model: tint, gloss, rim and eyes),
 * 1 (medium: plus the detail and the coat), 2 (high: the same; the shells and
 * the close-up skins are added by the scene). `ARK_SHELL` for a shell pass.
 */

import {Vector4} from "three";
import type {LookClass} from "@/ark-scene/animal-look-rules";

/**
 * Per class: detail amplitude (model units), frequency (per model unit), roughness, rim, coat, coat gloss, wrap,
 * wet darkening, and how much of the wet look it takes (feathers shed water: a duck on the pond is not soaked).
 */
export const LOOK_PARAMS: Record<LookClass, {amp: number; freq: number; rough: number; rim: number; coat: number; gloss: number; wrap: number; wetDark: number; wetTake: number}> = {
    fur: {amp: 0.0011, freq: 240, rough: 0.88, rim: 1.55, coat: 0, gloss: 0.3, wrap: 0.18, wetDark: 0.58, wetTake: 1},
    feathers: {amp: 0.0007, freq: 130, rough: 0.74, rim: 1.2, coat: 0.1, gloss: 0.45, wrap: 0.06, wetDark: 0.8, wetTake: 0.3},
    scales: {amp: 0.0016, freq: 120, rough: 0.5, rim: 0.65, coat: 0.42, gloss: 0.62, wrap: 0, wetDark: 0.85, wetTake: 0.85},
    skin: {amp: 0.0014, freq: 80, rough: 0.66, rim: 0.6, coat: 0.1, gloss: 0.35, wrap: 0.32, wetDark: 0.8, wetTake: 1},
    shell: {amp: 0.0024, freq: 42, rough: 0.4, rim: 0.5, coat: 0.55, gloss: 0.78, wrap: 0, wetDark: 0.85, wetTake: 0.85},
    slimy: {amp: 0.0018, freq: 30, rough: 0.2, rim: 0.45, coat: 0.95, gloss: 0.9, wrap: 0.4, wetDark: 0.9, wetTake: 1}
};

export const LOOK_CLASS_INDEX: Record<LookClass, number> = {fur: 0, feathers: 1, scales: 2, skin: 3, shell: 4, slimy: 5};

/** The species' surface for the shader: `arkLookA` = (class, amp, freq, roughness), `arkLookB` = (rim, coat, gloss, wrap). */
export function lookVectors(look: LookClass): {a: Vector4; b: Vector4; wetDark: number; wetTake: number} {
    const p = LOOK_PARAMS[look];
    return {a: new Vector4(LOOK_CLASS_INDEX[look], p.amp, p.freq, p.rough), b: new Vector4(p.rim, p.coat, p.gloss, p.wrap), wetDark: p.wetDark, wetTake: p.wetTake};
}

export const LOOK_VERTEX_DECLARATIONS = `
#ifdef ARK_LOOK
attribute vec2 arkCoat;
uniform vec4 arkEye;
uniform vec3 arkEye2;
varying vec3 vArkRest;
varying vec3 vArkRestNormal;
varying vec2 vArkLookV;
varying float vArkHeight;
varying vec3 vArkEyeL;
varying vec3 vArkEyeR;
varying float vArkScale;
#endif
#ifdef ARK_SHELL
attribute vec2 arkShellLayer;
uniform float arkShellLength;
varying float vArkShell;
varying float vArkShellHere;
#endif
`;

/** In begin_vertex, before any motion: the rest pose's point, and the eyes' offsets in view space. */
export const LOOK_VERTEX = `
#ifdef ARK_LOOK
{
    vArkRest = position;
    vArkRestNormal = normal;
    vArkLookV = arkCoat;
    vArkHeight = clamp((position.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    mat4 arkModelView = modelViewMatrix;
#ifdef USE_INSTANCING
    arkModelView = modelViewMatrix * instanceMatrix;
#endif
    vArkScale = length(arkModelView[0].xyz);
    vec3 arkToEyeL = position - arkEye.xyz;
    vec3 arkToEyeR = position - arkEye2;
#ifdef ARK_RIG
    // A rigged head turns (look-at, a clip): the offsets turn with the bones round the eye, so the dome and its
    // catchlight stay on the eye. The mask is a length, the same either way.
    arkToEyeL = mat3(arkSkin) * arkToEyeL;
    arkToEyeR = mat3(arkSkin) * arkToEyeR;
#endif
    vArkEyeL = (arkModelView * vec4(arkToEyeL, 0.0)).xyz;
    vArkEyeR = (arkModelView * vec4(arkToEyeR, 0.0)).xyz;
}
#endif
`;

/** After every motion: a shell is the body pushed out along its normal (shorter and sleeker wet; shorter at the range's edge). */
export const SHELL_VERTEX = `
#ifdef ARK_SHELL
vArkShell = arkShellLayer.x;
{
    // The coat's own length here: none on the front of the head (a muzzle and nose are short-haired or bare: a shell
    // there stood off it as a grey halo) or on the hooves and feet, full from behind the eyes and up the legs.
    float fromFront = clamp((motionStill - position.z) / max(motionStill - motionRear, 0.001), 0.0, 1.0);
    float up = clamp((position.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    vArkShellHere = smoothstep(0.05, 0.16, fromFront) * smoothstep(0.03, 0.1, up);
}
transformed += normalize(objectNormal) * arkShellLength * arkShellLayer.x * arkShellLayer.y * vArkShellHere * (1.0 - 0.7 * arkCoat.x);
#endif
`;

export const LOOK_FRAGMENT_DECLARATIONS = `
#ifdef ARK_LOOK
uniform vec4 arkLookA;
uniform vec4 arkLookB;
uniform vec4 arkEye;
uniform float arkWetDark;
uniform float arkWetTake;
uniform vec3 arkDustColour;
uniform float arkDaylight;
varying vec3 vArkRest;
varying vec3 vArkRestNormal;
varying vec2 vArkLookV;
varying float vArkHeight;
varying vec3 vArkEyeL;
varying vec3 vArkEyeR;
varying float vArkScale;
#ifdef ARK_SHELL
varying float vArkShell;
varying float vArkShellHere;
#endif
float arkLookHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float arkLookNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(arkLookHash(i), arkLookHash(i + vec3(1.0, 0.0, 0.0)), f.x),
                   mix(arkLookHash(i + vec3(0.0, 1.0, 0.0)), arkLookHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(arkLookHash(i + vec3(0.0, 0.0, 1.0)), arkLookHash(i + vec3(1.0, 0.0, 1.0)), f.x),
                   mix(arkLookHash(i + vec3(0.0, 1.0, 1.0)), arkLookHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// Cells on the plane the surface faces most (scales, plates): 0 at a cell's middle, 1 at its edge.
float arkLookCells(vec3 p, vec3 n) {
    vec3 a = abs(n);
    vec2 q = a.x > a.y && a.x > a.z ? p.yz : (a.y > a.z ? p.xz : p.xy);
    // Rows offset by half a cell, like scales laid in courses.
    q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 cell = floor(q);
    vec2 f = fract(q);
    float nearest = 8.0;
    float second = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(arkLookHash(vec3(cell + g, 3.1)), arkLookHash(vec3(cell + g, 7.7))) * 0.6 + 0.2;
            float d = length(g + o - f);
            if (d < nearest) { second = nearest; nearest = d; } else if (d < second) { second = d; }
        }
    }
    return clamp(1.0 - (second - nearest) * 1.8, 0.0, 1.0);
}
// The surface's own small relief (model units), by class.
float arkLookHeight(vec3 p, vec3 n) {
    float cls = arkLookA.x;
    vec3 q = p * arkLookA.z;
    if (cls < 0.5) {
        // Fur: strands combed from the head (+z) back and down, so the noise is long along that way. Where the hair
        // points at the viewer (a face, a chest: the surface faces along the comb) it lies short and reads flatter.
        vec3 along = normalize(vec3(0.0, -0.45, -1.0));
        vec3 s = q - along * dot(q, along) * 0.82;
        float lying = 1.0 - abs(dot(normalize(n), along));
        return (arkLookNoise(s) * 0.7 + arkLookNoise(s * 2.3 + 11.0) * 0.3) * mix(0.35, 1.0, lying);
    }
    if (cls < 1.5) {
        // Feathers: rounded tips overlapping in rows down the body (longer along it than across, so they read as
        // laid feathers, not cells), soft at the edges, and a fine barb grain inside each.
        float rows = arkLookCells(vec3(q.x, q.y, q.z * 0.55) * 0.5, n);
        float barbs = arkLookNoise(vec3(q.x * 2.5, q.y * 2.5, q.z * 0.4));
        float tips = 1.0 - rows;
        return tips * tips * 0.6 + barbs * 0.4;
    }
    if (cls < 2.5) return 1.0 - arkLookCells(q, n);
    if (cls < 3.5) return arkLookNoise(q) * 0.6 + arkLookNoise(q * 3.1 + 5.0) * 0.4;
    if (cls < 4.5) return (1.0 - arkLookCells(q, n)) * 0.6 + arkLookNoise(q * 4.0) * 0.4;
    return arkLookNoise(q);
}
vec3 arkLookBump(vec3 surfPos, vec3 surfNorm, float h, float faceDirection) {
    vec3 sigmaX = dFdx(surfPos);
    vec3 sigmaY = dFdy(surfPos);
    vec3 r1 = cross(sigmaY, surfNorm);
    vec3 r2 = cross(surfNorm, sigmaX);
    float det = dot(sigmaX, r1) * faceDirection;
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    return normalize(abs(det) * surfNorm - grad);
}
// How much of an eye this point is (1 in it, 0 beyond its rim), from its view-space offset to the eye's centre.
float arkEyeMask(vec3 offset) {
    if (arkEye.w <= 0.0) return 0.0;
    float r = length(offset) / (arkEye.w * vArkScale);
    return 1.0 - smoothstep(0.8, 1.05, r);
}
#endif
`;

/** After map_fragment: wet darkens, dust lightens the low body, the eyes deepen; a shell cut to its strands. */
export const LOOK_ALBEDO = `
#ifdef ARK_LOOK
float arkWet = clamp(vArkLookV.x, 0.0, 1.0) * arkWetTake;
float arkDust = clamp(vArkLookV.y, 0.0, 1.0);
float arkEyeAmount = max(arkEyeMask(vArkEyeL), arkEyeMask(vArkEyeR));
#ifdef ARK_SHELL
{
    // Strands: a jittered point in each small cell of the rest pose; a layer keeps the round patch round it, thinner outward.
    vec3 q = vArkRest * 300.0;
    vec3 cell = floor(q);
    vec3 jitter = vec3(arkLookHash(cell), arkLookHash(cell + 19.1), arkLookHash(cell + 37.7)) - 0.5;
    float d = length(fract(q) - 0.5 - jitter * 0.55);
    float keep = arkLookHash(cell + 3.3) < 0.82 ? 1.0 : 0.0;
    // Where the coat faces the camera the shells would only speckle it (the relief draws that fur): they thin away
    // there and stand full toward the outline, where a coat's softness shows.
    float arkEdge = smoothstep(0.2, 0.7, 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))));
    // Where the coat has no length (the muzzle, the hooves) the layer would lie on the skin: no strands there at all.
    if (d > 0.62 * (1.0 - vArkShell) * keep * arkEdge * step(0.02, vArkShellHere) || arkEyeAmount > 0.01) discard;
    // Deeper in, less light reaches: the roots a little darker than the tips.
    diffuseColor.rgb *= mix(0.8, 1.05, vArkShell);
}
#endif
diffuseColor.rgb *= mix(1.0, arkWetDark, arkWet);
float arkDustAmount = arkDust * (1.0 - smoothstep(0.08, 0.5, vArkHeight));
#if ARK_LOOK_TIER > 0
arkDustAmount *= 0.65 + 0.7 * arkLookNoise(vArkRest * 38.0);
#endif
diffuseColor.rgb = mix(diffuseColor.rgb, arkDustColour * (0.75 + 0.35 * dot(diffuseColor.rgb, vec3(0.333))), clamp(arkDustAmount * 0.42, 0.0, 0.42));
diffuseColor.rgb *= 1.0 - 0.35 * arkEyeAmount;
#endif
`;

/** After roughnessmap_fragment: the class's roughness, glossier wet, rougher dusty, a glassy eye. */
export const LOOK_ROUGHNESS = `
#ifdef ARK_LOOK
roughnessFactor = arkLookA.w;
roughnessFactor = mix(roughnessFactor, min(roughnessFactor, 0.24), arkWet * 0.85);
roughnessFactor = mix(roughnessFactor, 0.95, clamp(arkDustAmount, 0.0, 0.6));
roughnessFactor = mix(roughnessFactor, 0.07, arkEyeAmount);
#endif
`;

/** After normal_fragment_maps: the class's relief (faded where it would alias), and the eye's dome. */
export const LOOK_NORMAL = `
#ifdef ARK_LOOK
#if ARK_LOOK_TIER > 0
{
    float footprint = length(fwidth(vArkRest)) * arkLookA.z;
    float detail = (1.0 - smoothstep(0.25, 0.7, footprint)) * (1.0 - 0.6 * arkWet) * (1.0 - arkEyeAmount);
    if (detail > 0.001) {
        float h = arkLookHeight(vArkRest, vArkRestNormal) * arkLookA.y * vArkScale * detail;
        normal = arkLookBump(-vViewPosition, normal, h, faceDirection);
    }
}
#endif
if (arkEyeAmount > 0.001) {
    vec3 offset = arkEyeMask(vArkEyeL) > arkEyeMask(vArkEyeR) ? vArkEyeL : vArkEyeR;
    float radius = arkEye.w * vArkScale;
    vec3 across = offset - normal * dot(offset, normal);
    vec3 dome = normalize(across + normal * sqrt(max(radius * radius - dot(across, across), radius * radius * 0.04)));
    normal = normalize(mix(normal, dome, arkEyeAmount));
}
#endif
`;

/** After lights_fragment_begin: the key light again for the class's coat and its light through thin edges. */
export const LOOK_LIGHT = `
#if defined(ARK_LOOK) && ARK_LOOK_TIER > 0 && NUM_DIR_LIGHTS > 0
{
    vec3 l = directLight.direction;
    vec3 v = geometryViewDir;
    float nl = dot(normal, l);
    float coat = arkLookB.y + arkWet * 0.55;
    if (coat > 0.001 && nl > 0.0) {
        vec3 hv = normalize(l + v);
        float shine = mix(30.0, 420.0, max(arkLookB.z, arkWet * 0.8));
        float fresnel = 0.04 + 0.96 * pow(1.0 - saturate(dot(hv, v)), 5.0);
        reflectedLight.directSpecular += directLight.color * pow(saturate(dot(normal, hv)), shine) * (shine + 8.0) / 25.0 * fresnel * coat * nl;
    }
    if (arkLookB.w > 0.001) {
        // Light coming through the thin edges (ears, a frog's flank): warm, just past where the light turns away.
        float through = saturate((nl + 0.45) / 1.45) - saturate(nl);
        reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * vec3(1.0, 0.62, 0.5) * through * arkLookB.w;
    }
}
#endif
`;

/** Before opaque_fragment: the class's rim (soft and albedo-coloured on fur and feathers) and the eye's catchlight. */
export const LOOK_FINISH = `
#ifdef ARK_LOOK
{
    float facing = saturate(dot(normal, normalize(vViewPosition)));
    vec3 tint = mix(vec3(1.0), diffuseColor.rgb * 2.4, arkLookA.x < 1.5 ? 0.6 : 0.2);
    float rimShape = pow(1.0 - facing, 3.0);
#if ARK_LOOK_TIER > 0
    if (arkLookA.x < 0.5) {
        // Fur's cheap version (every animal without shells, and every phone): the rim broken into strands, so the
        // coat's edge glints hair by hair instead of as one smooth line. No extra draw.
        float strands = arkLookNoise(vArkRest * arkLookA.z * vec3(0.9, 0.9, 0.35));
        rimShape *= 0.45 + 1.1 * strands;
    }
#endif
    outgoingLight += arkRim * tint * rimShape * arkLookB.x * (1.0 - vArkDim) * (1.0 - 0.5 * arkWet);
    if (arkEyeAmount > 0.001) {
        // A catchlight: the sky's light up and to the left of the camera, mirrored in the eye's dome.
        vec3 r = reflect(-normalize(vViewPosition), normal);
        float spot = smoothstep(0.965, 0.99, dot(r, normalize(vec3(-0.38, 0.55, 0.74))));
        vec3 sky = mix(vec3(0.42, 0.5, 0.66), vec3(1.0, 0.97, 0.92), arkDaylight);
        outgoingLight += sky * spot * arkEyeAmount * mix(0.55, 1.5, arkDaylight) * (1.0 - vArkDim);
    }
}
#else
// A warm rim where the surface turns away: the low sun catching fur and feathers at the edge.
outgoingLight += arkRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0) * (1.0 - vArkDim);
#endif
`;
