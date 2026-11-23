/**
 * The falling water's material, shared (ark-world round 2): the wild island's giant waterfall (`wild/render/falls.ts`)
 * and the town dome's cliff fall (`town/render/dome-falls.ts`) draw their sheets with it, so the dome's is moving water,
 * not the flat strips the owner saw. Moved here from `wild/render/falls.ts` unchanged (the same program, the same key).
 *
 * Geometry attributes: aFlow (x across, m from its middle; y its time of flight down the drop, s, 0 at the lip; z which
 * sheet: 0 the curtain, 1 the veil in front, 2 a spill along the ground) and aEdge (0 at a sheet's edge, 1 in its middle).
 * The sheet sways along its local z, so it is built facing +z.
 */

import {DoubleSide, MeshStandardMaterial} from "three";
import {NOISE_GLSL} from "@/ark-scene/glsl";

/** The shared clock's window (`shared-clock.ts` ARK_TIME_PERIOD): a pattern that scrolls by whole periods in it never jumps. */
const WINDOW = 600;

const WATER_VERTEX = /* glsl */ `
attribute vec3 aFlow;
varying vec3 vFlow;
uniform float uFallsTime;
`;

/**
 * The falling water's look. aFlow: x across (m from its middle), y its time of flight down the drop (s; 0 at the lip),
 * z which sheet (0 the curtain, 1 the veil in front, 2 the spill to the spring). Streaks stretch as the water speeds up;
 * it frays at its edges and breaks into white toward its foot.
 */
const WATER_FRAGMENT = /* glsl */ `
varying vec3 vFlow;
uniform float uFallsTime;
${NOISE_GLSL}
// Value noise that repeats every 64 along y (the scroll's axis), so a whole number of periods in the clock's window
// brings it back to where it started.
float fallsHashP(vec2 p) { p.y = mod(p.y, 64.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fallsNoiseP(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fallsHashP(i), fallsHashP(i + vec2(1.0, 0.0)), f.x), mix(fallsHashP(i + vec2(0.0, 1.0)), fallsHashP(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const FALL_DRAW = /* glsl */ `
{
    float sheet = vFlow.z;
    float across = vFlow.x;
    float flight = vFlow.y;
    // Scrolls by whole periods of 64 in the clock's 600 s window: 64 * 25 / 600 a second.
    float scroll = uFallsTime * ${((64 * 25) / WINDOW).toFixed(6)};
    float speedUp = sheet > 1.5 ? 1.6 : 1.0 + 0.55 * sheet;
    vec2 q = vec2(across * 2.6, flight * 9.0 - scroll * speedUp);
    float streak = fallsNoiseP(vec2(across * 7.5 + 3.0 * sheet, q.y * 0.55)) * 0.5 + fallsNoiseP(vec2(across * 2.2, q.y * 0.3 + 9.0)) * 0.35 + fallsNoiseP(vec2(across * 19.0, q.y * 1.4)) * 0.15;
    float clumps = fallsNoiseP(vec2(across * 1.1 + 5.0, q.y * 0.18));
    // Aerated: white more and more as it falls, in clumps and streaks; the spill is white water all the way.
    float aerate = sheet > 1.5 ? 0.75 : smoothstep(0.1, 2.4, flight) * 0.7 + 0.18;
    float white = smoothstep(0.35, 0.85, streak * 0.75 + clumps * 0.35 + aerate * 0.55);
    vec3 clear = vec3(0.5, 0.64, 0.62);
    vec3 foam = vec3(0.93, 0.95, 0.94);
    diffuseColor.rgb = mix(clear, foam, white);
    // The sheet's edges fray (narrower strands, gaps), more as it falls; the veil is all strands.
    float edge = sheet > 1.5 ? 1.0 : smoothstep(0.0, 0.16 + 0.12 * flight, vFallsEdge);
    float gaps = smoothstep(0.18 + 0.2 * sheet + 0.12 * flight, 0.6 + 0.15 * sheet, streak + 0.25 * clumps);
    float alpha = edge * mix(0.62, 0.97, white) * mix(1.0, gaps, 0.55 + 0.4 * sheet);
    // Where the curtain plunges into the pool: lost in the foam (the mist takes over).
    alpha *= sheet > 1.5 ? 1.0 : 1.0 - 0.35 * smoothstep(2.25, 2.55, flight);
    diffuseColor.a = clamp(alpha, 0.0, 1.0);
}
`;

export function fallsWaterMaterial(time: {value: number}): MeshStandardMaterial {
    const material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.32, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide});
    material.customProgramCacheKey = () => "ark-falls-water";
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uFallsTime = time;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\n${WATER_VERTEX}\nattribute float aEdge;\nvarying float vFallsEdge;`)
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
                vFlow = aFlow;
                vFallsEdge = aEdge;
                // The sheet wavers as it falls (the veil more), out of step across it.
                float sway = sin(uFallsTime * ${((Math.PI * 2 * 60) / WINDOW).toFixed(6)} * (1.0 + 0.3 * aFlow.z) + aFlow.x * 0.9 + aFlow.y * 2.1);
                transformed.z += sway * 0.08 * aFlow.y * (1.0 + aFlow.z) * step(aFlow.z, 1.5);`
            );
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${WATER_FRAGMENT}\nvarying float vFallsEdge;`)
            .replace("#include <color_fragment>", `#include <color_fragment>\n${FALL_DRAW}`);
    };
    return material;
}

