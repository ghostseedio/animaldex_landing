import assert from "node:assert/strict";
import test from "node:test";
import type {Camera, Object3D, WebGLRenderer} from "three";
import {warmShaders} from "@/ark-scene/runtime/load";

/**
 * The shader warm-up (runtime/load.ts warmShaders; a release fix for the town joining the one world, decision 153): a
 * material that loses its program while it warms (disposed, replaced) or whose readiness check throws is skipped, never
 * an uncaught error; the rest still resolve "ready"; a program that never gets ready times out and the polling stops.
 */

type Program = {isReady?: () => boolean} | null | undefined;

function renderer(programs: Map<object, () => Program>): WebGLRenderer {
    return {
        compile: () => new Set(programs.keys()),
        properties: {get: (material: object) => ({currentProgram: programs.get(material)?.()})}
    } as unknown as WebGLRenderer;
}

const scene = {} as Object3D;
const camera = {} as Camera;

test("a material whose program goes away while it warms is skipped; the rest resolve ready", async () => {
    let polls = 0;
    const slow = {};
    const programs = new Map<object, () => Program>([
        [{}, () => ({isReady: () => true})],
        [{}, () => undefined],
        [{}, () => ({isReady: () => {
            throw new Error("Cannot read properties of undefined (reading 'isReady')");
        }})],
        [slow, () => ({isReady: () => ++polls > 3})]
    ]);
    const errors: unknown[] = [];
    const onError = (error: unknown) => errors.push(error);
    process.on("uncaughtException", onError);
    try {
        assert.equal(await warmShaders(renderer(programs), scene, camera, 2000), "ready");
        assert.ok(polls > 3, "it waited for the slow one");
    } finally {
        process.off("uncaughtException", onError);
    }
    assert.deepEqual(errors, []);
});

test("a program that never gets ready times out, and the polling stops then", async () => {
    let polls = 0;
    const programs = new Map<object, () => Program>([[{}, () => ({isReady: () => (polls++, false)})]]);
    assert.equal(await warmShaders(renderer(programs), scene, camera, 80), "timeout");
    const after = polls;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(polls, after, "no polling after it settled");
});

test("a renderer without compile, or one that throws, fails without throwing", async () => {
    assert.equal(await warmShaders({} as WebGLRenderer, scene, camera, 50), "failed");
    const throwing = {compile: () => {
        throw new Error("lost context");
    }, properties: {get: () => ({})}} as unknown as WebGLRenderer;
    assert.equal(await warmShaders(throwing, scene, camera, 50), "failed");
});
