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
 *   left, softer at night; asleep (`arkSleep.x`, `sleep.ts`) the lids close over
 *   them: the eye takes the colour of the skin round it (the skin texture read
 *   blurred, from a coarse mip), with a darker line where the lids meet, and
 *   loses its gloss, dome and catchlight;
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
varying float vArkEyesShut;
// 3.3 batch (C): where on the body (0 at the body's rear to 1 at its front; a tail runs on below 0), and across it in
// half-widths, for a young one's coat.
varying vec2 vArkBody;
// 3.3 batch (C): where its model's antlers start (y, zMin, zBase; antler-cycle.ts), folded to the skull as they grow or are shed.
uniform vec4 arkAntler;
// Lane SIG-OTHER: a display's swell (look-state.ts): the centre and push (A), the radii and whether mirrored (B) of the region of the rest pose pushed out along its normals.
uniform vec4 arkSwellA;
uniform vec4 arkSwellB;
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
    vArkEyesShut = arkSleep.x;
    vArkLookV = arkCoat;
    vArkHeight = clamp((position.y - motionBottom) / max(motionTop - motionBottom, 0.001), 0.0, 1.0);
    vArkBody = vec2((position.z - motionRear) / max(motionStill - motionRear, 0.001), position.x / max(motionSpan, 0.001));
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
    // 3.3 batch (C): the antler cycle (antler-cycle.ts foldAntler): its code rides above the young coat in arkCoat.y's
    // 32s (0 as drawn, 1-14 growing, 15 none); the antlers' points fold toward the skull, to nothing when shed.
    float arkAntlerCode = mod(floor(arkCoat.y / 32.0 + 0.00001), 16.0);
    if (arkAntlerCode > 0.5 && position.y > arkAntler.x && position.z > arkAntler.y) {
        float arkAntlerK = arkAntlerCode > 14.5 ? 0.0 : 0.35 + 0.65 * (arkAntlerCode - 1.0) / 13.0;
        transformed = vec3(position.x * arkAntlerK, arkAntler.x + (position.y - arkAntler.x) * arkAntlerK, arkAntler.z + (position.z - arkAntler.z) * arkAntlerK);
    }
    // Lane SIG-OTHER: a display's swell (look-state.ts): its strength rides above the antlers in arkCoat.y's 512s (0-15).
    float arkSwellCode = mod(floor(arkCoat.y / 512.0 + 0.00001), 16.0);
    if (arkSwellCode > 0.5 && arkSwellA.w > 0.0) {
        vec3 arkSwellP = vec3(arkSwellB.w > 0.5 ? abs(position.x) : position.x, position.y, position.z);
        float arkSwellD = length((arkSwellP - arkSwellA.xyz) / max(arkSwellB.xyz, vec3(0.0001)));
        transformed += normalize(normal) * arkSwellA.w * (arkSwellCode / 15.0) * (1.0 - smoothstep(0.55, 1.0, arkSwellD));
    }
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
uniform vec3 arkEye2;
uniform float arkWetDark;
uniform float arkWetTake;
uniform vec3 arkDustColour;
uniform float arkDaylight;
// 3.3 batch (C): the species' young coat (young-coat.ts): A = its colour (rgb) and how much of the adult's it replaces;
// B = the marks' colour and strength; C = (marks' kind, how many along or up the body, 1 for the tail only, duller);
// D = (the marks' share of a period, how broken they are).
uniform vec4 arkYoungA;
uniform vec4 arkYoungB;
uniform vec4 arkYoungC;
uniform vec2 arkYoungD;
varying vec2 vArkBody;
uniform vec4 arkAntler;
// Lane SIG-OTHER: the species' look states (look-state.ts). Night (by the island's daylight) and State (by the animal's strength in arkCoat.y's 512s):
// A = colour rgb and how much of the skin it replaces, B = (grey: + duller, - richer; gain; on; glow: > 0 adds its colour as light and takes the eyes too), C = (region centre xyz, mirrored), D = (region radii xyz, region on).
uniform vec4 arkNightA;
uniform vec4 arkNightB;
uniform vec4 arkNightC;
uniform vec4 arkNightD;
uniform vec4 arkStateA;
uniform vec4 arkStateB;
uniform vec4 arkStateC;
uniform vec4 arkStateD;
// And an animal's own pattern (A = kind: 1 patches, 2 spots; scale; share dark; share light), by its seed in arkVary.w (ark-variation.ts).
uniform vec4 arkIndA;
varying vec3 vArkRest;
varying vec3 vArkRestNormal;
varying vec2 vArkLookV;
varying float vArkHeight;
varying vec3 vArkEyeL;
varying vec3 vArkEyeR;
varying float vArkScale;
varying float vArkEyesShut;
#ifdef ARK_SHELL
varying float vArkShell;
varying float vArkShellHere;
#endif
// How much of a state's region (an ellipsoid of the rest pose, folded on x when mirrored; none: the whole body) a point is in.
float arkStateRegion(vec3 p, vec4 C, vec4 D) {
    if (D.w < 0.5) return 1.0;
    vec3 q = vec3(C.w > 0.5 ? abs(p.x) : p.x, p.y, p.z);
    return 1.0 - smoothstep(0.55, 1.0, length((q - C.xyz) / max(D.xyz, vec3(0.0001))));
}
// A state's tone over a colour at a strength: greyer or richer, lighter or darker, its colour mixed in (the painted light and shade kept).
vec3 arkStateTone(vec3 c, vec4 A, vec4 B, float k) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 t = mix(c, vec3(l), B.x) * B.y;
    t = mix(t, A.rgb * (0.9 + 0.35 * l), A.w);
    return mix(c, max(t, vec3(0.0)), clamp(k, 0.0, 1.0));
}
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
// 3.3 batch (C): a young one's coat strength rides in arkCoat.y's twos (0-15, young-coat.ts packYoung); dust is the rest.
// (Above them, in its 32s, the antler cycle's code: antler-cycle.ts.)
float arkYoungAll = floor(vArkLookV.y * 0.5 + 0.001);
float arkYoung = mod(arkYoungAll, 16.0);
float arkDust = clamp(vArkLookV.y - 2.0 * arkYoungAll, 0.0, 1.0);
float arkEyeAmount = max(arkEyeMask(vArkEyeL), arkEyeMask(vArkEyeR));
// Asleep: the lids shut over the eye (the skin round it, read blurred from a coarse mip of its texture), a darker line
// where they meet; the eye's gloss, dome and catchlight go with it. The lids cover the painted eye, which is wider than
// the eyeball's dome: an almond round the nearer eye in the rest pose, long along the head, shorter up and down.
float arkEyesShut = clamp(vArkEyesShut, 0.0, 1.0);
float arkLidAmount = 0.0;
float arkLidSeam = 0.0;
if (arkEyesShut > 0.001 && arkEye.w > 0.0) {
    vec3 arkEyeAt = length(vArkRest - arkEye.xyz) < length(vArkRest - arkEye2) ? arkEye.xyz : arkEye2;
    vec3 arkLidD = (vArkRest - arkEyeAt) / arkEye.w;
    arkLidAmount = (1.0 - smoothstep(0.7, 1.0, length(vec3(arkLidD.x / 3.0, arkLidD.y / 2.7, arkLidD.z / 4.2)))) * arkEyesShut;
    arkLidSeam = 1.0 - smoothstep(0.25, 0.55, abs(arkLidD.y));
}
arkEyeAmount *= 1.0 - arkEyesShut;
// 3.3 batch (C): the young of some species wear another coat (a striped piglet, a banded hatchling, a white young
// heron): the species' own young colour over the adult's skin, and its marks drawn on the body's own coordinates
// (bars across it, stripes along it, spots, a line down the back), by its age's strength. Never on the eyes.
if (arkYoung > 0.5) {
    float arkYk = clamp(arkYoung / 15.0, 0.0, 1.0) * (1.0 - arkEyeAmount);
    if (arkYoungC.z > 0.5) arkYk *= 1.0 - smoothstep(0.36, 0.5, vArkBody.x);
    vec3 arkYc = diffuseColor.rgb;
    float arkYl = dot(arkYc, vec3(0.2126, 0.7152, 0.0722));
    arkYc = mix(arkYc, vec3(arkYl), arkYoungC.w);
    // (A little of the skin's own light and shade stays in the young colour, so the body's painted form still reads.)
    arkYc = mix(arkYc, arkYoungA.rgb * (0.9 + 0.35 * arkYl), arkYoungA.w);
    float arkYkind = arkYoungC.x;
    if (arkYkind > 0.5) {
        vec3 arkYp = vec3(vArkBody.y * 0.6, vArkHeight, vArkBody.x * 2.6);
        float arkYn = arkLookNoise(arkYp * 7.0);
        float arkYedge = 1.0 - 2.0 * arkYoungD.x;
        float arkYm = 0.0;
        if (arkYkind < 1.5) {
            // Bars across the body, a little bowed and uneven.
            float arkYbow = vArkHeight - 0.5;
            arkYm = smoothstep(arkYedge - 0.12, arkYedge + 0.12, sin((vArkBody.x + arkYbow * arkYbow * 0.1 + (arkYn - 0.5) * 0.05) * arkYoungC.y * 6.28318));
        } else if (arkYkind < 2.5) {
            // Stripes along the body, one above another.
            arkYm = smoothstep(arkYedge - 0.12, arkYedge + 0.12, sin((vArkHeight + (arkYn - 0.5) * 0.04) * arkYoungC.y * 6.28318 + 1.2));
        } else if (arkYkind < 3.5) {
            // Spots and blotches.
            arkYm = smoothstep(0.6, 0.7, arkLookNoise(arkYp * arkYoungC.y * 2.2 + 3.7));
        } else {
            // One line down the back.
            arkYm = smoothstep(0.78, 0.9, vArkHeight) * (1.0 - smoothstep(0.14, 0.3, abs(vArkBody.y))) * smoothstep(0.08, 0.2, vArkBody.x) * (1.0 - smoothstep(0.8, 0.92, vArkBody.x));
        }
        // Broken marks: gaps along them (a tapir calf's rows of dashes and spots).
        arkYm *= 1.0 - arkYoungD.y * smoothstep(0.45, 0.6, arkLookNoise(arkYp * vec3(9.0, 9.0, 13.0) + 8.1));
        arkYc = mix(arkYc, arkYoungB.rgb * (0.9 + 0.35 * arkYl), arkYm * arkYoungB.w);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, arkYc, arkYk);
}
// 3.3 batch (C): growing antlers are in velvet (antler-cycle.ts): a soft grey-brown skin over them.
{
    float arkAntlerNow = mod(floor(vArkLookV.y / 32.0 + 0.00001), 16.0);
    if (arkAntlerNow > 0.5 && arkAntlerNow < 14.5 && vArkRest.y > arkAntler.x && vArkRest.z > arkAntler.y) {
        float arkVl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.135, 0.095) * (0.8 + 0.6 * arkVl), 0.8);
    }
}
// Lane SIG-OTHER: look states (look-state.ts): the night's tone by the island's daylight (a gecko pales, a goldfish fades), and the
// animal's own state (a season's colour, a display's flush) by its strength in arkCoat.y's 512s. Not on the eyes, unless the tone glows (eyeshine).
float arkGlowAmount = 0.0;
vec3 arkGlowColour = vec3(0.0);
{
    float arkLsEye = 1.0 - arkEyeAmount;
    if (arkNightB.z > 0.5) {
        float arkNightT = clamp((1.0 - arkDaylight) / 0.66, 0.0, 1.0);
        float arkNightM = arkNightT * arkNightT * (3.0 - 2.0 * arkNightT) * arkStateRegion(vArkRest, arkNightC, arkNightD);
        if (arkNightM > 0.001) {
            diffuseColor.rgb = arkStateTone(diffuseColor.rgb, arkNightA, arkNightB, arkNightM * (arkNightB.w > 0.0 ? 1.0 : arkLsEye));
            arkGlowAmount = arkNightB.w * arkNightM;
            arkGlowColour = arkNightA.rgb;
        }
    }
    float arkStateK = mod(floor(vArkLookV.y / 512.0 + 0.00001), 16.0) / 15.0;
    if (arkStateK > 0.001 && arkStateB.z > 0.5) {
        float arkStateM = arkStateK * arkStateRegion(vArkRest, arkStateC, arkStateD);
        diffuseColor.rgb = arkStateTone(diffuseColor.rgb, arkStateA, arkStateB, arkStateM * (arkStateB.w > 0.0 ? 1.0 : arkLsEye));
        if (arkStateB.w > 0.0) {
            arkGlowAmount = max(arkGlowAmount, arkStateB.w * arkStateM);
            arkGlowColour = arkStateA.rgb;
        }
    }
    if (arkStateK > 0.001 && arkIndA.x > 0.5) {
        // Its own patches or spots: dark and light areas of noise seeded by the animal (the skin's own colours, darker or paler).
        vec2 arkIndPat = vec2(floor(vArkVary.w) / 997.0, fract(vArkVary.w));
        vec3 arkIndQ = vArkRest * arkIndA.y + vec3(arkIndPat * 61.0, arkIndPat.x * 23.0);
        float arkIndDark = arkIndA.x < 1.5 ? smoothstep(0.95 - arkIndA.z, 1.05 - arkIndA.z, arkLookNoise(arkIndQ)) : smoothstep(0.97 - arkIndA.z, 1.03 - arkIndA.z, arkLookNoise(arkIndQ * 2.7 + 7.1));
        float arkIndLight = arkIndA.x < 1.5 ? smoothstep(arkIndA.w + 0.05, arkIndA.w - 0.05, arkLookNoise(arkIndQ + 13.7)) : 0.0;
        vec3 arkIndC = diffuseColor.rgb;
        float arkIndL = dot(arkIndC, vec3(0.2126, 0.7152, 0.0722));
        arkIndC = mix(arkIndC, vec3(0.04) * (0.6 + arkIndL), arkIndDark * 0.85);
        arkIndC = mix(arkIndC, vec3(0.9 + 0.1 * arkIndL), arkIndLight * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, arkIndC, clamp(arkStateK, 0.0, 1.0) * arkLsEye);
    }
}
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
if (arkLidAmount > 0.001) {
    vec3 arkLid = diffuseColor.rgb;
#ifdef USE_MAP
    arkLid = texture2D(map, vMapUv, 5.0).rgb * 0.92;
#endif
    // Where the lids meet: a darker line across the eye, level in the model's rest pose.
    arkLid *= 1.0 - 0.55 * arkLidSeam;
    diffuseColor.rgb = mix(diffuseColor.rgb, arkLid, arkLidAmount);
}
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
#ifdef ARK_PET_COAT
    // Lane COATS: a pet's rim all its own coat's colour (a white rim broken into strands read as white flecks on a
    // dark coat, along the retriever's feathering).
    tint = diffuseColor.rgb * 2.4;
#endif
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
    // Lane SIG-OTHER: a state that glows (eyeshine, a firefly's light): its colour added to the lit surface (look-state.ts).
    outgoingLight += arkGlowColour * arkGlowAmount;
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
