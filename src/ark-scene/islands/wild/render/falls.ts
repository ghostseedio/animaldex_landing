/**
 * The giant waterfall, drawn (p4 WATERFALL; its shape and the reasons for its place in `islands/wild/falls.ts`).
 *
 * - The cliff: one mesh of layered, rounded rock over the slope (vertex colours: the beds' greys and browns, their
 *   partings dark, wet and darkened round the water, moss and lichen on what faces up and stays damp), a fine grain from
 *   world-space noise in its shader, and fern clumps on the wet ledges (one instanced mesh).
 * - The water: one mesh for the falling sheet (a curtain and a thinner veil in front of it) and the spill to the spring,
 *   its streaks scrolling in its shader at the speed of falling water, breaking up into white toward its foot.
 * - The plunge pool: its water churning white where the sheet strikes it, its rim of wet boulders (instanced).
 * - Mist (soft billboards rising and drifting off the pool, with the rainbow where the sun stands behind the viewer)
 *   and spray (droplets thrown out of the foot), both moved wholly in their shaders.
 *
 * Every moving thing runs on the shared clock (`glsl.ts` ARK_TIME, held still under reduced motion), and every scrolling
 * pattern repeats within its 600 s window, so it never jumps. No textures; 8 draw calls; the mist and the spray are
 * fewer on the medium tier and the spray is off on the low.
 */

import {AdditiveBlending, type PerspectiveCamera, Vector2, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, NormalBlending, Points, Quaternion, ShaderMaterial, Sphere, UniformsLib, UniformsUtils, Vector3} from "three";
import {mergeVertices} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {wildHeight} from "@/ark-scene/islands/wild/ground";
import {rillPaths, steamVents} from "@/ark-scene/islands/wild/crater";
import {ARK_DAYLIGHT, ARK_GLINT, ARK_SUN, ARK_TIME, NOISE_GLSL} from "@/ark-scene/glsl";
import {cliffSkin, curtainFoot, curtainPoint, FALLS_LIP, FALLS_X, impact, outflowPath, POOL, rimStones, CURTAIN_BOTTOM} from "@/ark-scene/islands/wild/falls";

export type FallsTier = "high" | "medium" | "low";

const MIST: Record<FallsTier, number> = {high: 150, medium: 90, low: 36};
const SPRAY: Record<FallsTier, number> = {high: 900, medium: 420, low: 0};

/** The shared clock's window (`shared-clock.ts` ARK_TIME_PERIOD): a pattern that scrolls by whole periods in it never jumps. */
const WINDOW = 600;

function hash(n: number): number {
    const s = Math.sin(n * 91.345 + 47.853) * 43758.5453;
    return s - Math.floor(s);
}

// MARK: - The cliff

// (p5: the falls come over the old volcano's breached rim: dark basalt, a rusty bed here and there.)
const ROCK_DARK = new Color("#34323a");
const ROCK_MID = new Color("#55525a");
const ROCK_PALE = new Color("#77736f");
const ROCK_WARM = new Color("#6e4c40");
const MOSS = new Color("#4c6a2b");
const MOSS_BRIGHT = new Color("#6f8f36");
const LICHEN = new Color("#a3a083");

function cliffGeometry(): {geometry: BufferGeometry; ledges: Array<{x: number; y: number; z: number; nx: number; ny: number; nz: number; wet: number}>} {
    const skin = cliffSkin();
    const {cols, rows, positions} = skin;
    const index: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
            const a = r * cols + c;
            const b = a + 1;
            const d = a + cols;
            const e = d + 1;
            // Wound so the face looks out (south, toward the opening camera) and up over its top.
            index.push(a, b, d, b, e, d);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute("position").count ? (geometry.getAttribute("normal").array as Float32Array) : new Float32Array();
    const colours = new Float32Array(cols * rows * 3);
    const c = new Color();
    const ledges: Array<{x: number; y: number; z: number; nx: number; ny: number; nz: number; wet: number}> = [];
    const strike = impact();
    for (let i = 0; i < cols * rows; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        const ny = normals[i * 3 + 1];
        const u = skin.across[i];
        const bed = skin.beds[i];
        const open = skin.opens[i];
        // The bed's own stone, a little warmer or paler bed by bed, and its grain.
        c.copy(ROCK_MID).lerp(bed > 0.6 ? ROCK_PALE : ROCK_WARM, Math.abs(bed - 0.5) * 1.3);
        c.multiplyScalar(0.84 + 0.32 * hash(Math.floor(x * 1.7) * 13 + Math.floor(y * 1.3)));
        // Streaked down the fall line: paler where the face is dry and weathered, darker in its runnels.
        const streak = Math.sin(x * 1.3 + Math.sin(y * 0.11 + x * 0.2) * 1.5) * 0.5 + Math.sin(x * 3.7 + y * 0.05) * 0.25;
        c.multiplyScalar(0.92 + 0.14 * streak);
        // The partings and joints in shade (the beds' rounded middles catch the light).
        c.lerp(ROCK_DARK, (1 - open) * 0.55);
        // p5: columnar basalt either side of the water: a thick flow's columns, their joints dark, a metre across, in a
        // band from over the pool to under the lip (their tops broken off at different heights).
        const columnar = Math.min(Math.max((Math.abs(u) - CURTAIN_BOTTOM * 0.5 + 1) / 3, 0), 1) * Math.min(Math.max((y - POOL.level - 2.5) / 3, 0), 1) * Math.min(Math.max((FALLS_LIP - 5 - 4 * hash(Math.floor(x * 0.9) + 71) - y) / 2, 0), 1) * (ny < 0.55 ? 1 : 0);
        if (columnar > 0) {
            const joint = Math.abs(Math.sin(x * 2.9 + 1.3 * hash(Math.floor(y * 0.12) + 5)));
            c.multiplyScalar(1 - columnar * (0.5 * (1 - Math.min(joint * 3.2, 1)) + 0.12 * hash(Math.floor((x * 2.9) / Math.PI) + 19)));
        }
        // Wet: behind and beside the water, and everywhere the spray reaches near the pool.
        const sheet = Math.exp(-((u / (CURTAIN_BOTTOM * 0.5 + 2.2)) ** 2)) * (y < FALLS_LIP + 0.6 ? 1 : 0);
        const spray = Math.exp(-((Math.hypot(x - strike.x, (y - strike.y) * 0.55, z - strike.z) / 11) ** 2));
        const wet = Math.min(1, sheet * 0.95 + spray * 0.85);
        c.multiplyScalar(1 - 0.48 * wet);
        // Water stains: dark streaks down the face below the ledges, where seeps run.
        const stain = Math.max(0, Math.sin(x * 2.3 + Math.sin(x * 0.7) * 2) * 0.5 + 0.5 - 0.62) * 2.2 * (1 - wet) * (ny < 0.4 ? 1 : 0.3);
        c.multiplyScalar(1 - 0.18 * stain);
        // Moss on whatever faces up and stays damp; lichen on the dry, pale tops.
        const up = Math.min(Math.max((ny - 0.3) / 0.45, 0), 1);
        const damp = Math.min(1, 0.35 + wet + 0.5 * Math.max(0, 1 - (y - strike.y) / 14));
        // (In patches, not rows: a low noise over the face breaks every bed's moss.)
        const patch = Math.min(1, Math.max(0, (Math.sin(x * 0.37 + y * 0.21) + Math.sin(x * 0.13 - y * 0.47 + 2) + 0.4) * 0.6));
        const moss = up * damp * patch * (0.6 + 0.4 * hash(Math.floor(x * 0.9) * 7 + Math.floor(z * 0.9)));
        c.lerp(wet > 0.5 ? MOSS : MOSS_BRIGHT, Math.min(1, moss * 1.15));
        if (wet < 0.2 && up > 0.4 && hash(Math.floor(x * 2.1) + Math.floor(y * 2.3) * 31) > 0.7) c.lerp(LICHEN, 0.35);
        colours[i * 3] = c.r;
        colours[i * 3 + 1] = c.g;
        colours[i * 3 + 2] = c.b;
        // Fern ledges: up-facing, wet, below the lip, not under the sheet itself.
        const r = Math.floor(i / cols);
        const col = i % cols;
        if (r > 3 && r < rows - 4 && ny > 0.5 && wet > 0.25 && Math.abs(u) > CURTAIN_BOTTOM * 0.5 + 0.6 && y < FALLS_LIP - 1 && col % 2 === 0 && r % 2 === 0 && hash(i) > 0.55) {
            ledges.push({x, y, z, nx: normals[i * 3], ny, nz: normals[i * 3 + 2], wet});
        }
    }
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    return {geometry, ledges};
}

function rockMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.9, metalness: 0});
    material.customProgramCacheKey = () => "ark-falls-rock";
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vFallsWorld;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvFallsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec3 vFallsWorld;\n${NOISE_GLSL}`)
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
                // The stone's grain: fine mottling and the beds' faint banding, in world space (no texture).
                vec2 q = vec2(vFallsWorld.x + vFallsWorld.z * 0.7, vFallsWorld.y);
                float grain = arkFbm(q * 1.9) * 0.55 + arkNoise(q * 7.3) * 0.45;
                float band = arkNoise(vec2(q.x * 0.15, q.y * 3.1));
                diffuseColor.rgb *= 0.78 + 0.36 * grain + 0.1 * (band - 0.5);`
            )
            .replace(
                "#include <roughnessmap_fragment>",
                `#include <roughnessmap_fragment>
                // Wet stone (darkened in its colour) shines: the darker the vertex colour, the smoother.
                roughnessFactor = mix(0.45, 0.92, smoothstep(0.03, 0.16, dot(vColor.rgb, vec3(0.333))));`
            );
    };
    return material;
}

/** A fern clump: a dozen arching fronds (a strip of leaflets each), vertex-coloured, about 0.9 m across at scale 1. */
function fernGeometry(): BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    const dark = new Color("#22401a");
    const light = new Color("#4f7a2c");
    const fronds = 11;
    for (let f = 0; f < fronds; f++) {
        const a = (f / fronds) * Math.PI * 2 + hash(f) * 0.4;
        const lift = 0.55 + 0.35 * hash(f + 9);
        const length = 0.45 + 0.25 * hash(f + 3);
        const segments = 5;
        let prev: [number, number, number] = [0, 0.02, 0];
        for (let s = 1; s <= segments; s++) {
            const t = s / segments;
            const r = length * t;
            const y = Math.sin(lift * Math.PI * 0.5) * r * 0.9 - t * t * length * 0.55;
            const p: [number, number, number] = [Math.cos(a) * r, y + 0.02, Math.sin(a) * r];
            const w = 0.09 * Math.sin(Math.PI * Math.min(t + 0.15, 1)) + 0.01;
            const sx = -Math.sin(a) * w;
            const sz = Math.cos(a) * w;
            const pw = 0.09 * Math.sin(Math.PI * Math.min(t - 1 / segments + 0.15, 1)) + 0.01;
            const px = -Math.sin(a) * pw;
            const pz = Math.cos(a) * pw;
            const quad = [
                [prev[0] - px, prev[1], prev[2] - pz], [prev[0] + px, prev[1], prev[2] + pz], [p[0] + sx, p[1], p[2] + sz],
                [prev[0] - px, prev[1], prev[2] - pz], [p[0] + sx, p[1], p[2] + sz], [p[0] - sx, p[1], p[2] - sz]
            ];
            for (const v of quad) {
                positions.push(v[0], v[1], v[2]);
                const k = new Color().copy(dark).lerp(light, 0.3 + 0.6 * t);
                colours.push(k.r, k.g, k.b);
            }
            prev = p;
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    return geometry;
}

// MARK: - The water

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

function waterMaterial(time: {value: number}): MeshStandardMaterial {
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

/** The curtain, the veil and the spill as one geometry (aFlow, aEdge: see `FALL_DRAW`). */
function waterGeometry(): BufferGeometry {
    const positions: number[] = [];
    const flows: number[] = [];
    const edges: number[] = [];
    const index: number[] = [];
    const drop = FALLS_LIP - POOL.level;
    const fallTime = Math.sqrt((2 * drop) / 9.81);
    const sheet = (kind: number, nu: number, nv: number, inset: number, out: number) => {
        const base = positions.length / 3;
        // (Each column to its own foot: the pool in the middle, the lower ledges at the broad sheet's ends.)
        const feet: number[] = [];
        for (let i = 0; i <= nu; i++) feet.push(curtainFoot(inset + (i / nu) * (1 - 2 * inset)));
        for (let j = 0; j <= nv; j++) {
            for (let i = 0; i <= nu; i++) {
                const v = (j / nv) * feet[i];
                const u01 = inset + (i / nu) * (1 - 2 * inset);
                const p = curtainPoint(u01, v);
                positions.push(p.x, p.y, p.z + out * Math.min(v * 4, 1));
                const width = p.x - FALLS_X;
                const flight = v < 0.08 ? 0 : ((v - 0.08) / 0.92) * fallTime;
                flows.push(width, flight, kind);
                edges.push(Math.min(u01, 1 - u01) * 2);
            }
        }
        for (let j = 0; j < nv; j++) {
            for (let i = 0; i < nu; i++) {
                const a = base + j * (nu + 1) + i;
                index.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
            }
        }
    };
    sheet(0, 72, 46, 0, 0);
    sheet(1, 54, 40, 0.04, 0.45);
    // The spill: a strip down the ground from the pool's rim to the spring; and (p5) the snowmelt rills down the
    // caldera's inner walls to the crater lake.
    for (const path of [outflowPath(), ...rillPaths(wildHeight)]) {
    const base = positions.length / 3;
    let run = 0;
    for (let k = 0; k < path.length; k++) {
        const p = path[k];
        const q = path[Math.min(k + 1, path.length - 1)];
        const o = path[Math.max(k - 1, 0)];
        const dx = q.x - o.x;
        const dz = q.z - o.z;
        const l = Math.hypot(dx, dz) || 1;
        const sx = (-dz / l) * p.width * 0.5;
        const sz = (dx / l) * p.width * 0.5;
        if (k > 0) run += Math.hypot(p.x - path[k - 1].x, p.y - path[k - 1].y, p.z - path[k - 1].z);
        for (const side of [-1, 0, 1]) {
            positions.push(p.x + sx * side, p.y + (side === 0 ? 0.03 : 0), p.z + sz * side);
            flows.push(side * p.width * 0.5, run * 0.35, 2);
            edges.push(side === 0 ? 1 : 0.15);
        }
    }
    for (let k = 0; k < path.length - 1; k++) {
        for (let s = 0; s < 2; s++) {
            const a = base + k * 3 + s;
            index.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
        }
    }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("aFlow", new BufferAttribute(new Float32Array(flows), 3));
    geometry.setAttribute("aEdge", new BufferAttribute(new Float32Array(edges), 1));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
}

// MARK: - The pool

function poolGeometry(): BufferGeometry {
    const positions: number[] = [0, 0, 0];
    const index: number[] = [];
    const rings = 7;
    const around = 40;
    for (let r = 1; r <= rings; r++) {
        const t = r / rings;
        for (let k = 0; k < around; k++) {
            const a = (k / around) * Math.PI * 2;
            positions.push(Math.cos(a) * POOL.rx * t * 1.04, 0, Math.sin(a) * POOL.rz * t * 1.04);
        }
    }
    for (let k = 0; k < around; k++) index.push(0, 1 + ((k + 1) % around), 1 + k);
    for (let r = 1; r < rings; r++) {
        for (let k = 0; k < around; k++) {
            const a = 1 + (r - 1) * around + k;
            const b = 1 + (r - 1) * around + ((k + 1) % around);
            index.push(a, b, a + around, b, b + around, a + around);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
}

function poolMaterial(time: {value: number}, strike: {x: number; z: number}): MeshStandardMaterial {
    // (Its sky reflection kept low: seen across, a full one turned the little pool into a pale plate.)
    const material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.3, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 0.35});
    material.customProgramCacheKey = () => "ark-falls-pool";
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uFallsTime = time;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec2 vPool;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPool = (modelMatrix * vec4(transformed, 1.0)).xz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec2 vPool;\nuniform float uFallsTime;\n${NOISE_GLSL}`)
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
                {
                    // Foam churning out from where the sheet strikes: rings of it running outward, boils breaking through.
                    vec2 d = vPool - vec2(${strike.x.toFixed(3)}, ${strike.z.toFixed(3)});
                    // (From the line the broad sheet strikes along, not its middle.)
                    d.x = max(abs(d.x) - ${(CURTAIN_BOTTOM * 0.42).toFixed(3)}, 0.0) * 0.6;
                    float r = length(d);
                    float angle = atan(d.y, d.x);
                    // (Rings outward at a whole number of turns in the clock's window.)
                    float out1 = r * 2.2 - uFallsTime * ${((2 * Math.PI * 40) / WINDOW / 2.2).toFixed(6)};
                    float churn = arkNoise(vec2(angle * 3.0, out1 * 1.3)) * 0.6 + arkNoise(vPool * 3.1 + vec2(sin(uFallsTime * ${((2 * Math.PI * 25) / WINDOW).toFixed(6)}), cos(uFallsTime * ${((2 * Math.PI * 19) / WINDOW).toFixed(6)})) * 1.7) * 0.4;
                    float foamy = smoothstep(2.6, 0.2, r);
                    float foam = smoothstep(0.55, 0.8, churn * (0.35 + foamy) + foamy * 0.5) + 0.3 * smoothstep(0.58, 0.72, arkNoise(vPool * 1.3 + vec2(out1 * 0.4, 0.0))) * smoothstep(5.5, 1.0, r);
                    vec3 deep = vec3(0.03, 0.11, 0.10);
                    vec3 shallow = vec3(0.10, 0.25, 0.21);
                    vec2 e = (vPool - vec2(${POOL.x.toFixed(3)}, ${POOL.z.toFixed(3)})) / vec2(${POOL.rx.toFixed(3)}, ${POOL.rz.toFixed(3)});
                    float edgeR = length(e);
                    diffuseColor.rgb = mix(mix(deep, shallow, smoothstep(0.4, 1.0, edgeR)), vec3(0.92, 0.94, 0.93), foam);
                    foam = clamp(foam, 0.0, 1.0);
                    diffuseColor.a = mix(0.8, 0.97, foam) * smoothstep(1.05, 0.82, edgeR);
                }`
            );
    };
    return material;
}

function stoneGeometry(): BufferGeometry {
    // A rounded boulder: an icosphere pushed about by low noise (the same shape for each; the instances turn and squash it).
    // (Merged so its normals are smooth: a water-worn stone, not a cut gem. Moss on its top, dark and wet below.)
    const geometry = mergeVertices(new IcosahedronGeometry(1, 3).deleteAttribute("normal").deleteAttribute("uv"));
    const p = geometry.getAttribute("position") as BufferAttribute;
    const colours = new Float32Array(p.count * 3);
    const c = new Color();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + 0.16 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - x) + 0.08 * Math.sin(y * 5.3 + z * 4.1);
        p.setXYZ(i, x * k, y * k * (y < 0 ? 0.7 : 1), z * k);
        const moss = Math.max(0, Math.min(1, (y - 0.35) * 2.2 + 0.3 * Math.sin(x * 7.1 + z * 5.3)));
        c.setRGB(1, 1, 1).lerp(new Color("#7f9a52"), moss * 0.8).multiplyScalar(y < -0.1 ? 0.7 : 1);
        colours[i * 3] = c.r;
        colours[i * 3 + 1] = c.g;
        colours[i * 3 + 2] = c.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    return geometry;
}

// MARK: - Mist and spray

const MIST_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uFallsTime;
uniform vec3 uStrike;
uniform float uWidth;
uniform float uVent;
varying vec2 vCorner;
varying float vAlpha;
varying vec3 vWorld;
varying float aSeedOf;
#include <fog_pars_vertex>
void main() {
    aSeedOf = aSeed.y + aSeed.z;
    // Each puff loops: born low at the foot of the sheet, rising and drifting out, growing and thinning. Its loop is a
    // whole number of times in the clock's window.
    float rate = (3.0 + floor(aSeed.w * 4.0)) / ${WINDOW.toFixed(1)} * 6.0;
    float life = fract(uFallsTime * rate + aSeed.x);
    float across = (aSeed.y - 0.5) * uWidth * 1.15;
    float out1 = 0.4 + life * (2.5 + 4.5 * aSeed.z);
    // (A quarter of them rise high: the plume over the falls that marks them from across the island.)
    float high = step(0.75, aSeed.z) * (1.0 - uVent);
    // (The plume climbs past the lip and over the trees, leaning out from the face: the falls' mark from the island view.)
    vec3 centre = uStrike + vec3(across * (1.0 + 0.4 * life), 0.3 + life * (2.0 + 5.0 * aSeed.w + high * 36.0) + 0.6 * sin(life * 6.0 + aSeed.x * 20.0), out1 * (1.0 - 0.5 * high) + high * life * 6.0);
    float size = 1.8 + life * (3.0 + 4.0 * aSeed.z + high * 11.0);
    // (p5: a vent's wisp of steam: small, straight up, gone in a few metres.)
    centre = mix(centre, uStrike + vec3(across * 0.3 + 0.5 * life * sin(aSeed.x * 20.0), 0.2 + life * (3.5 + 5.0 * aSeed.w), 0.4 * life * cos(aSeed.z * 17.0)), uVent);
    size = mix(size, 0.5 + life * 2.2, uVent);
    vAlpha = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.55, 1.0, life)) * (0.5 + 0.5 * aSeed.w);
    // (From across the island the plume is a few pixels: it thickens with distance so the falls still read as a landmark.
    // Close by it thins as the camera comes into a puff, so the view is never a white-out.)
    float seen = distance(centre, cameraPosition);
    vAlpha *= (1.0 + 2.4 * smoothstep(90.0, 420.0, seen)) * smoothstep(size * 0.5, size * 2.2, seen);
    vCorner = position.xy;
    vec4 mvPosition = viewMatrix * vec4(centre, 1.0);
    mvPosition.xy += position.xy * size;
    vWorld = centre;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const MIST_FRAGMENT = /* glsl */ `
uniform float uFallsTime;
uniform float uDaylight;
uniform vec3 uSun;
uniform vec3 uGlint;
uniform float uDensity;
varying vec2 vCorner;
varying float vAlpha;
varying vec3 vWorld;
varying float aSeedOf;
#include <fog_pars_fragment>
${NOISE_GLSL}
// A rainbow's colour at its angle from the antisolar point (degrees): violet inside at 40.2°, red outside at 42.8°.
vec3 bow(float deg) {
    float t = (deg - 40.2) / 2.6;
    if (t < 0.0 || t > 1.0) return vec3(0.0);
    // Violet inside to red outside: the hue wheel from 0.75 down to 0, soft at both edges.
    float h = 0.75 * (1.0 - t);
    vec3 c = clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
    return c * smoothstep(0.0, 0.25, t) * smoothstep(1.0, 0.7, t);
}
void main() {
    float r = length(vCorner);
    if (r > 1.0) discard;
    float soft = exp(-r * r * 3.2);
    float wisps = smoothstep(0.25, 0.9, arkFbm(vCorner * 1.6 + vWorld.xy * 0.11 + aSeedOf * 7.0));
    float a = soft * wisps * vAlpha * uDensity;
    if (a < 0.003) discard;
    // Lit as the hour is: white in sun, cool and dim at night.
    vec3 lit = mix(vec3(0.16, 0.19, 0.24), vec3(0.94, 0.96, 0.97) * mix(vec3(1.0), uGlint, 0.25), uDaylight);
    // The rainbow, where the sun is up and behind the viewer: the mist's own droplets at 42° from the antisolar point.
    vec3 view = normalize(vWorld - cameraPosition);
    float deg = degrees(acos(clamp(dot(view, -uSun), -1.0, 1.0)));
    vec3 rainbow = bow(deg) * smoothstep(0.55, 0.85, uDaylight) * step(0.05, uSun.y);
    float bowed = dot(rainbow, vec3(0.5));
    vec3 colour = mix(lit, rainbow * 1.4, min(0.75 * bowed, 0.6));
    // (The bow is the sunlight the droplets send back: it shows more than the thin mist it is in.)
    a = min(a * (1.0 + 0.9 * bowed) + bowed * soft * vAlpha * 0.25, 1.0);
    gl_FragColor = vec4(colour, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

const SPRAY_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uFallsTime;
uniform vec3 uStrike;
uniform float uWidth;
uniform float uPixel;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
    // A droplet thrown out of the foot and falling back: a loop of 1.2–2 s, a whole number of them in the clock's window.
    float rate = floor(${WINDOW.toFixed(1)} / (1.2 + 0.8 * aSeed.w)) / ${WINDOW.toFixed(1)};
    float life = fract(uFallsTime * rate + aSeed.x);
    float t = life * (1.2 + 0.8 * aSeed.w);
    float across = (aSeed.y - 0.5) * uWidth;
    vec3 velocity = vec3((aSeed.y - 0.5) * 3.0, 4.0 + 6.0 * aSeed.z, 1.5 + 4.0 * fract(aSeed.z * 7.13));
    vec3 p = uStrike + vec3(across, 0.2, 0.2) + velocity * t + vec3(0.0, -4.9 * t * t, 0.0);
    vAlpha = (1.0 - life) * step(uStrike.y - 0.2, p.y);
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(0.05 * uPixel / max(-mvPosition.z, 0.1), 1.0, 6.0);
    #include <fog_vertex>
}
`;

const SPRAY_FRAGMENT = /* glsl */ `
uniform float uDaylight;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(mix(vec3(0.2, 0.23, 0.28), vec3(0.95, 0.97, 0.98), uDaylight), vAlpha * 0.75);
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

// MARK: - The falls

export type WildFalls = {
    group: Group;
    update: (eye: Vector3) => void;
    setTier: (tier: FallsTier) => void;
    setShadows: (on: boolean) => void;
    stats: () => {triangles: number; drawCalls: number; bytes: number};
    dispose: () => void;
};

export function buildWildFalls(tier: FallsTier): WildFalls {
    const group = new Group();
    group.name = "ark-wild-falls";
    const strike = impact();
    const time = ARK_TIME;

    // The cliff.
    const cliff = cliffGeometry();
    const rock = new Mesh(cliff.geometry, rockMaterial());
    rock.name = "falls-cliff";
    rock.receiveShadow = true;
    group.add(rock);

    // Ferns on the wet ledges.
    const fernGeom = fernGeometry();
    const fernMaterial = new MeshStandardMaterial({vertexColors: true, roughness: 0.8, side: DoubleSide});
    fernMaterial.customProgramCacheKey = () => "ark-falls-fern";
    const ferns = new InstancedMesh(fernGeom, fernMaterial, Math.max(cliff.ledges.length, 1));
    ferns.count = cliff.ledges.length;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const n = new Vector3();
    const tilt = new Quaternion();
    cliff.ledges.forEach((ledge, k) => {
        n.set(ledge.nx, ledge.ny, ledge.nz).normalize().lerp(up, 0.5).normalize();
        tilt.setFromUnitVectors(up, n);
        q.setFromAxisAngle(up, hash(k + 0.5) * 6.28).premultiply(tilt);
        const s = 0.55 + 0.75 * hash(k + 11) * (0.6 + 0.4 * ledge.wet);
        m.compose(new Vector3(ledge.x, ledge.y - 0.05, ledge.z), q, new Vector3(s, s, s));
        ferns.setMatrixAt(k, m);
    });
    ferns.name = "falls-ferns";
    group.add(ferns);

    // The water, the pool and its rim.
    const water = new Mesh(waterGeometry(), waterMaterial(time));
    water.name = "falls-water";
    water.renderOrder = 3;
    water.userData.gtaoSkip = true;
    group.add(water);
    const pool = new Mesh(poolGeometry(), poolMaterial(time, strike));
    pool.position.set(POOL.x, POOL.level, POOL.z);
    pool.name = "falls-pool";
    pool.renderOrder = 2;
    group.add(pool);
    const rim = rimStones();
    const stoneMaterial = new MeshStandardMaterial({roughness: 0.5, metalness: 0, vertexColors: true});
    stoneMaterial.customProgramCacheKey = () => "ark-falls-stone";
    const stones = new InstancedMesh(stoneGeometry(), stoneMaterial, rim.length);
    const colour = new Color();
    rim.forEach((stone, k) => {
        q.setFromAxisAngle(up, stone.yaw);
        m.compose(new Vector3(stone.x, stone.y, stone.z), q, new Vector3(stone.r * 1.15, stone.r * stone.squash, stone.r));
        stones.setMatrixAt(k, m);
        stones.setColorAt(k, colour.set(k % 3 === 0 ? "#78786a" : "#7c766c").multiplyScalar(0.8 + 0.35 * hash(k + 5)));
    });
    stones.name = "falls-rim";
    stones.receiveShadow = true;
    group.add(stones);

    // Mist: soft billboards (a quad each, moved in the shader).
    const mistGeometry = new InstancedBufferGeometry();
    mistGeometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    mistGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const mistCap = MIST.high;
    const mistSeeds = new Float32Array(mistCap * 4);
    for (let i = 0; i < mistCap; i++) for (let k = 0; k < 4; k++) mistSeeds[i * 4 + k] = hash(i * 4 + k + 100);
    mistGeometry.setAttribute("aSeed", new InstancedBufferAttribute(mistSeeds, 4));
    mistGeometry.instanceCount = MIST[tier];
    const shared = {uFallsTime: time, uDaylight: ARK_DAYLIGHT, uSun: ARK_SUN, uGlint: ARK_GLINT};
    const mistUniforms = {...UniformsUtils.clone(UniformsLib.fog), uStrike: {value: new Vector3(strike.x, strike.y, strike.z)}, uWidth: {value: CURTAIN_BOTTOM}, uDensity: {value: 0.24}, uVent: {value: 0}, ...shared};
    const mistMaterial = new ShaderMaterial({vertexShader: MIST_VERTEX, fragmentShader: MIST_FRAGMENT, uniforms: mistUniforms, transparent: true, depthWrite: false, blending: NormalBlending, fog: true});
    const mist = new Mesh(mistGeometry, mistMaterial);
    mist.name = "falls-mist";
    mist.frustumCulled = false;
    mist.renderOrder = 5;
    mist.userData.gtaoSkip = true;
    group.add(mist);

    // p5: the old volcano's steam vents (the same puffs, a few each, small and thin).
    const vents = steamVents(wildHeight).map((vent, k) => {
        const geometry = new InstancedBufferGeometry();
        geometry.setAttribute("position", mistGeometry.getAttribute("position"));
        geometry.setIndex(mistGeometry.getIndex());
        const seeds = new Float32Array(9 * 4);
        for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i + 3100 + k * 97);
        geometry.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
        geometry.instanceCount = tier === "low" ? 4 : 9;
        const material = new ShaderMaterial({vertexShader: MIST_VERTEX, fragmentShader: MIST_FRAGMENT, uniforms: {...UniformsUtils.clone(UniformsLib.fog), uStrike: {value: new Vector3(vent.x, vent.y, vent.z)}, uWidth: {value: 1.4}, uDensity: {value: 0.2}, uVent: {value: 1}, ...shared}, transparent: true, depthWrite: false, blending: NormalBlending, fog: true});
        const mesh = new Mesh(geometry, material);
        mesh.name = `crater-vent-${k}`;
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
        mesh.userData.gtaoSkip = true;
        group.add(mesh);
        return mesh;
    });

    // Spray: droplets (points, a few pixels each).
    const sprayCap = SPRAY.high;
    const sprayGeometry = new BufferGeometry();
    sprayGeometry.setAttribute("position", new BufferAttribute(new Float32Array(sprayCap * 3), 3));
    const spraySeeds = new Float32Array(sprayCap * 4);
    for (let i = 0; i < sprayCap * 4; i++) spraySeeds[i] = hash(i + 7000);
    sprayGeometry.setAttribute("aSeed", new BufferAttribute(spraySeeds, 4));
    sprayGeometry.setDrawRange(0, SPRAY[tier]);
    sprayGeometry.boundingSphere = new Sphere(new Vector3(strike.x, strike.y + 4, strike.z + 3), 20);
    const sprayUniforms = {...UniformsUtils.clone(UniformsLib.fog), uStrike: {value: new Vector3(strike.x, strike.y, strike.z)}, uWidth: {value: CURTAIN_BOTTOM}, uPixel: {value: 900}, ...shared};
    const sprayMaterial = new ShaderMaterial({vertexShader: SPRAY_VERTEX, fragmentShader: SPRAY_FRAGMENT, uniforms: sprayUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: true});
    const spray = new Points(sprayGeometry, sprayMaterial);
    spray.name = "falls-spray";
    spray.visible = SPRAY[tier] > 0;
    spray.renderOrder = 6;
    // (Its droplets are sized to the viewport's pixels: the drawing buffer's height over the view's height at 1 m.)
    const buffer = new Vector2();
    spray.onBeforeRender = (renderer, _scene, camera) => {
        const fov = (camera as PerspectiveCamera).fov ?? 50;
        sprayUniforms.uPixel.value = renderer.getDrawingBufferSize(buffer).y / (2 * Math.tan((fov * Math.PI) / 360));
    };
    group.add(spray);

    const meshes = [rock, ferns, water, pool, stones, mist, spray];
    const triangles = () => {
        let sum = 0;
        for (const mesh of [rock, water, pool]) sum += (mesh.geometry.index?.count ?? 0) / 3;
        sum += (fernGeom.getAttribute("position").count / 3) * ferns.count;
        sum += ((stones.geometry.index?.count ?? stones.geometry.getAttribute("position").count) / 3) * stones.count;
        sum += 2 * mistGeometry.instanceCount;
        return sum;
    };
    const bytes = () => {
        let sum = 0;
        for (const mesh of meshes) {
            const g = mesh.geometry;
            for (const name of Object.keys(g.attributes)) sum += (g.attributes[name].array as Float32Array).byteLength;
            if (g.index) sum += (g.index.array as Uint16Array).byteLength;
        }
        return sum + (ferns.instanceMatrix.array as Float32Array).byteLength + (stones.instanceMatrix.array as Float32Array).byteLength;
    };

    return {
        group,
        update: (eye) => {
            void eye;
        },
        setTier: (next) => {
            mistGeometry.instanceCount = MIST[next];
            sprayGeometry.setDrawRange(0, SPRAY[next]);
            spray.visible = SPRAY[next] > 0;
        },
        setShadows: (on) => {
            rock.castShadow = on;
            stones.castShadow = on;
        },
        stats: () => ({triangles: triangles(), drawCalls: meshes.filter((mesh) => mesh.visible).length, bytes: bytes()}),
        dispose: () => {
            for (const mesh of meshes) {
                mesh.geometry.dispose();
                (mesh.material as MeshStandardMaterial).dispose();
            }
        }
    };
}
