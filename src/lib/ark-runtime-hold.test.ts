import assert from "node:assert/strict";
import test from "node:test";
import {ShaderHold, type HoldRenderer} from "@/ark-scene/runtime/hold";

/** A renderer that records its draws; a material's program is ready when the test says. */
function fake() {
    const drawn: Array<[object, object]> = [];
    const programs = new Map<object, {ready: boolean; isReady: () => boolean}>();
    const renderer: HoldRenderer = {
        renderBufferDirect: (_camera, _scene, _geometry, material, object) => {
            drawn.push([material, object]);
            // (Drawn without a program: three compiles and links it here, and waits. It has one from now on.)
            if (!programs.has(material)) compile(material, true);
        },
        properties: {get: (material) => ({currentProgram: programs.get(material) ?? null})}
    };
    const compile = (material: object, ready = false) => {
        const program = {ready, isReady: () => program.ready};
        programs.set(material, program);
        return program;
    };
    return {renderer, drawn, compile, programs};
}

test("shader hold: a new material is left out of the frame until its program is ready, then drawn for good", () => {
    const {renderer, drawn, compile} = fake();
    const scene = {};
    let now = 0;
    const hold = new ShaderHold(renderer, scene, 3000, () => now);
    hold.install();
    const known = {name: "ground"};
    const fresh = {name: "reeds"};
    const mesh = {name: "mesh"};
    const reeds = {name: "reeds mesh"};
    // Before the first frame: everything is drawn as it comes (the mount's warm-up covers it).
    renderer.renderBufferDirect(null, scene, null, known, mesh, null);
    assert.equal(drawn.length, 1);
    hold.active = true;
    // A material drawn before is drawn; a new one is left out and asked for after the frame, once.
    renderer.renderBufferDirect(null, scene, null, known, mesh, null);
    renderer.renderBufferDirect(null, scene, null, fresh, reeds, null);
    assert.equal(drawn.length, 2);
    assert.deepEqual(hold.take(), [reeds]);
    assert.deepEqual(hold.take(), []);
    const program = compile(fresh);
    // Still compiling: left out, not asked for again; its shadow (another scene's pass) stays out with it.
    now = 100;
    renderer.renderBufferDirect(null, scene, null, fresh, reeds, null);
    renderer.renderBufferDirect(null, null, null, {name: "depth"}, reeds, null);
    assert.equal(drawn.length, 2);
    assert.deepEqual(hold.take(), []);
    assert.equal(hold.stats().holding, 1);
    // Ready: drawn from this frame, and its shadow with it.
    program.ready = true;
    now = 200;
    renderer.renderBufferDirect(null, null, null, {name: "depth"}, reeds, null);
    renderer.renderBufferDirect(null, scene, null, fresh, reeds, null);
    renderer.renderBufferDirect(null, null, null, {name: "depth"}, reeds, null);
    assert.equal(drawn.length, 4, "its shadow waits for the frame it is first drawn in");
    assert.deepEqual(hold.stats(), {holding: 0, released: 1, timedOut: 0, skippedDraws: 2});
    // Never looked at again, whatever its program says.
    program.ready = false;
    renderer.renderBufferDirect(null, scene, null, fresh, reeds, null);
    assert.equal(drawn.length, 5);
});

test("shader hold: a program that never reports is drawn after the limit; other passes are never held", () => {
    const {renderer, drawn, compile} = fake();
    const scene = {} as {overrideMaterial?: object | null};
    let now = 0;
    const hold = new ShaderHold(renderer, scene, 3000, () => now);
    hold.install();
    hold.active = true;
    const stuck = {name: "stuck"};
    const mesh = {name: "mesh"};
    renderer.renderBufferDirect(null, scene, null, stuck, mesh, null);
    assert.deepEqual(hold.take(), [mesh]);
    compile(stuck);
    now = 2999;
    renderer.renderBufferDirect(null, scene, null, stuck, mesh, null);
    assert.equal(drawn.length, 0);
    now = 3001;
    renderer.renderBufferDirect(null, scene, null, stuck, mesh, null);
    assert.equal(drawn.length, 1);
    assert.equal(hold.stats().timedOut, 1);
    // A post-processing quad (its own scene) with a new material is drawn at once: leaving it out is a broken frame.
    const quad = {name: "quad"};
    renderer.renderBufferDirect(null, quad, null, {name: "pass"}, quad, null);
    assert.equal(drawn.length, 2);
    // An override pass (the ambient occlusion's) draws what is drawn and nothing of what is held.
    const held = {name: "held"};
    const heldMesh = {name: "held mesh"};
    renderer.renderBufferDirect(null, scene, null, held, heldMesh, null);
    assert.equal(drawn.length, 2);
    scene.overrideMaterial = {name: "normals"};
    renderer.renderBufferDirect(null, scene, null, scene.overrideMaterial, heldMesh, null);
    assert.equal(drawn.length, 2);
    renderer.renderBufferDirect(null, scene, null, scene.overrideMaterial, mesh, null);
    assert.equal(drawn.length, 3);
    scene.overrideMaterial = null;
    // The same new material on a second object: both wait, both are asked for (an instanced mesh's is another program).
    const second = {name: "second mesh"};
    renderer.renderBufferDirect(null, scene, null, held, second, null);
    assert.deepEqual(hold.take(), [heldMesh, second]);
    hold.dispose();
    renderer.renderBufferDirect(null, scene, null, {name: "after"}, mesh, null);
    assert.equal(drawn.length, 4, "disposed: the renderer's own draw again");
});

test("shader hold: where programs cannot compile in parallel nothing is held", () => {
    const {renderer, drawn} = fake();
    const scene = {};
    const hold = new ShaderHold(renderer, scene, 3000, () => 0);
    hold.install();
    hold.active = true;
    // (three's program says ready from the start when the browser has no parallel compile; one made by a draw is ready.)
    const material = {name: "m"};
    const mesh = {name: "mesh"};
    renderer.renderBufferDirect(null, scene, null, material, mesh, null);
    assert.deepEqual(hold.take(), [mesh]);
    // The scene compiles it (ready at once without the extension): drawn the next frame.
    (renderer.properties.get as unknown as (m: object) => unknown) = () => ({currentProgram: {isReady: () => true}});
    renderer.renderBufferDirect(null, scene, null, material, mesh, null);
    assert.equal(drawn.length, 1);
});
