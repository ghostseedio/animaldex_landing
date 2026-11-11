import assert from "node:assert/strict";
import test from "node:test";
import {BoxGeometry, DataTexture, ShaderChunk, ShaderLib} from "three";
import {animalMaterial, type AnimalMaterialOptions} from "@/ark-scene/animal-material";
import {speciesLook} from "@/ark-scene/animal-look";

/**
 * The animals' shader as the lanes compose it (release integration, 2026-11-11): the material's own motion and
 * idle, the rig, the rig's head look on its bones (rig lane), the reactive head look (`arkLook`, intelligence), the
 * animal-look pass (`arkCoat`, eyes, fur shells) and the per-instance variation (`arkVary`, liveliness). Two lanes
 * once named different attributes `arkLook`, which no WebGL compiler accepts. This composes every variant the scene
 * builds from three's real templates and checks that every global the lanes declare is declared once. (The golden
 * shots compile it on a GPU; this catches a clash without one.)
 */

/** Three's `#include <chunk>` expanded, as `WebGLProgram` does before compiling. */
function resolveIncludes(source: string): string {
    return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_, name: string) => resolveIncludes((ShaderChunk as Record<string, string>)[name] ?? ""));
}

/** Every global attribute, uniform and varying declaration (name → how many times). */
function declarations(source: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const match of Array.from(source.matchAll(/^[ \t]*(?:attribute|uniform|varying)\s+(?:(?:highp|mediump|lowp)\s+)?\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/gm))) {
        counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
    return counts;
}

/** The ark-specific ones only (three's own chunks declare theirs under #ifdef branches). */
const ours = (name: string) => /^(ark|vArk|motion|look|shell)/i.test(name);

function compose(options: Partial<AnimalMaterialOptions>) {
    const material = animalMaterial({map: null, behaviour: null, minY: 0, maxY: 1, animated: true, ...options});
    const shader = {vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} as Record<string, {value: unknown}>, defines: material.defines};
    (material.onBeforeCompile as (s: typeof shader, r: unknown) => void)(shader, null);
    return {vertex: resolveIncludes(shader.vertexShader), fragment: resolveIncludes(shader.fragmentShader), uniforms: shader.uniforms};
}

const bones = new DataTexture(new Float32Array(16), 2, 2);
const chain = {neck: 3, head: 4, neckPivot: [0, 0.5, 0.4] as [number, number, number], headPivot: [0, 0.6, 0.6] as [number, number, number], yaw: 1, up: 0.5, down: 0.6, neckShare: 0.4};
const fox = speciesLook("red-fox", "quadruped", 0, new BoxGeometry(0.4, 0.4, 1)) ?? undefined;

const VARIANTS: Array<[string, Partial<AnimalMaterialOptions>]> = [
    ["far, plain", {animated: false, level: "far"}],
    ["near, plain", {}],
    ["near with the look pass", {look: fox, level: "near"}],
    ["near fur shells", {look: fox, level: "near", shell: true, shellLength: 0.02}],
    ["rigged, look chain, look pass", {rig: bones, lookChain: chain, look: fox, level: "near"}],
    ["rigged, no head bone", {rig: bones, lookChain: null, look: fox, level: "near"}]
];

test("every lane's animal-shader globals are declared once (no attribute clash), in every variant the scene builds", () => {
    assert.ok(fox, "the red fox has a look (animal-look.json)");
    for (const [label, options] of VARIANTS) {
        const {vertex, fragment} = compose(options);
        for (const [stage, source] of [["vertex", vertex], ["fragment", fragment]] as const) {
            const twice = Array.from(declarations(source).entries()).filter(([name, n]) => n > 1 && ours(name));
            assert.deepEqual(twice, [], `${label}, ${stage}: declared more than once: ${twice.map(([name, n]) => `${name}×${n}`).join(", ")}`);
        }
        assert.ok(!/#include\s*</.test(vertex) && !/#include\s*</.test(fragment), `${label}: an include left unexpanded`);
    }
});

test("the head look (arkLook, vec4: w is lane L2's body channel) and the coat (arkCoat, vec2) are separate attributes, and the variation's arkVary is there", () => {
    const {vertex} = compose({rig: bones, lookChain: chain, look: fox, level: "near"});
    const attributes = Array.from(vertex.matchAll(/^[ \t]*attribute\s+(\w+)\s+(\w+)\s*;/gm)).map((m) => `${m[1]} ${m[2]}`);
    assert.ok(attributes.includes("vec4 arkLook"), attributes.join(", "));
    assert.ok(attributes.includes("vec2 arkCoat"), attributes.join(", "));
    assert.ok(attributes.some((a) => a.endsWith(" arkVary")), attributes.join(", "));
    assert.equal(attributes.filter((a) => a.endsWith(" arkLook")).length, 1);
});

test("the attribute slots stay within WebGL's 16 with every pass on (rig, look chain, fur shell, L2's body wave)", () => {
    // Three's own: position, normal, uv (1 each) and instanceMatrix (4). Ours: one slot each (a vec4 is one slot, so
    // widening arkLook to vec4 for L2's body channel costs none).
    const swimmer = {motionHead: 0.1, motionPower: 2, motionTip: 0.1, motionLift: 0, motionStretch: 0, motionFin: 0, motionWavesL2: 0.9, motionAxisL2: 0};
    for (const [label, options] of [
        ["rigged fur shell with a body wave", {rig: bones, lookChain: chain, look: fox, level: "near" as const, shell: true, shellLength: 0.02, bodyMotion: swimmer}],
        ["near fur shell with a body wave", {look: fox, level: "near" as const, shell: true, shellLength: 0.02, bodyMotion: swimmer}]
    ] as const) {
        const {vertex} = compose(options);
        const ours = Array.from(new Set(Array.from(vertex.matchAll(/^[ \t]*attribute\s+(\w+)\s+(\w+)\s*;/gm)).map((m) => m[2])));
        const slots = 3 + 4 + ours.length;
        assert.ok(slots <= 16, `${label}: ${slots} slots (${ours.join(", ")})`);
        assert.ok(/arkLook\.w >= 1\.0/.test(vertex), `${label}: the body channel is read`);
    }
});
