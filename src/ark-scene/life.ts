/**
 * Small life in the air: motes of pollen drifting over the meadows and the
 * forest glades, catching the low sun. One draw call of soft points,
 * moved in the vertex shader from a shared clock, seeded so every viewer
 * sees the same drift.
 */

import {AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial} from "three";
import {ARK_TIME} from "@/ark-scene/glsl";
import {sampleGround, seeded, zoneAt} from "@/ark-scene/world";

const VERTEX = `
attribute float seed;
uniform float arkTime;
uniform float pixelRatio;
varying float vGlow;
void main() {
    vec3 p = position;
    float t = arkTime * (0.25 + seed * 0.25) + seed * 40.0;
    p.x += sin(t) * 1.6 + sin(t * 2.3) * 0.4;
    p.z += cos(t * 0.8) * 1.6;
    p.y += sin(t * 1.7) * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vGlow = 0.55 + 0.45 * sin(arkTime * 2.0 + seed * 30.0);
    gl_PointSize = pixelRatio * clamp(26.0 / -mv.z, 1.2, 5.0);
}`;

const FRAGMENT = `
uniform vec3 tint;
varying float vGlow;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * vGlow;
    gl_FragColor = vec4(tint * a, a);
}`;

export function buildMotes(count: number): {points: Points; setPixelRatio: (ratio: number) => void; dispose: () => void} {
    const random = seeded(4242);
    const positions: number[] = [];
    const seeds: number[] = [];
    let guard = 0;
    while (seeds.length < count && guard++ < count * 30) {
        const x = (random() * 2 - 1) * 90;
        const z = (random() * 2 - 1) * 90;
        const s = sampleGround(x, z);
        if (s.height < 0.4 || s.land < 0.9) continue;
        const zone = zoneAt(s);
        if (!["grassland", "woodland", "rainforest", "farm_garden", "wetland", "river_lake"].includes(zone)) continue;
        positions.push(x, s.height + 0.6 + random() * 2.4, z);
        seeds.push(random());
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("seed", new BufferAttribute(new Float32Array(seeds), 1));
    const material = new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {arkTime: ARK_TIME, pixelRatio: {value: 1}, tint: {value: new Color("#fff1c9")}},
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 6;
    return {
        points,
        setPixelRatio: (ratio) => {
            material.uniforms.pixelRatio.value = ratio;
        },
        dispose: () => {
            geometry.dispose();
            material.dispose();
        }
    };
}
