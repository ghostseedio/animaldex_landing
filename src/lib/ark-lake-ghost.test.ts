/**
 * The teal duplicate beside every bird on the v2 lake (lane ark-lake-ghost): the high tier's ambient occlusion
 * (`post.ts` GTAO) draws every mesh with one normal material, so (1) the v2 lake's water, built with no normals, read as
 * a surface facing nowhere and the whole lake shaded to ink, and (2) each rigged animal stood in it in its rest pose,
 * the one figure with normals on the lake, left bright. And the contact shadow's water (`animal-look.ts` groundUnder)
 * took today's lake's 0 for the v2 lake at 6 m.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {AdditiveBlending, BoxGeometry, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Scene, ShaderMaterial, Sprite, type WebGLRenderer} from "three";
import {gtaoLeavesOut} from "@/ark-scene/post";
import {AnimalLook} from "@/ark-scene/animal-look";
import {arkWorld, LAKE as V1_LAKE, sampleGround, setArkWorld, ZONE_SITES} from "@/ark-scene/world";
import {FRESH_LEVEL} from "@/ark-scene/water-level";

const look = () => new AnimalLook({scene: new Scene(), renderer: {} as WebGLRenderer, closeUpBase: null, basisBase: "", enabled: true});

test("lake ghost: the occlusion's depth and normal pass leaves out the rigged animals and the glows; the models and the water stay in", () => {
    const rigged = new BoxGeometry();
    rigged.setAttribute("arkRigA", new InstancedBufferAttribute(new Float32Array(16), 4));
    assert.equal(gtaoLeavesOut(new InstancedMesh(rigged, new MeshStandardMaterial(), 4)), true, "a rig: posed in its own vertex shader, the pass would draw its rest pose");
    assert.equal(gtaoLeavesOut(new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 4)), false, "the near and far models");
    assert.equal(gtaoLeavesOut(new Sprite()), true, "a glow sprite");
    assert.equal(gtaoLeavesOut(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({blending: AdditiveBlending, depthWrite: false}))), true, "a light shaft");
    const water = new ShaderMaterial({transparent: true, depthWrite: false});
    assert.equal(gtaoLeavesOut(new Mesh(new PlaneGeometry(), water)), false, "the water keeps its occlusion");
});

test("lake ghost: v1's lake and the sea under an animal are as they were (the lake at its fixed 0, the sea at its level now)", () => {
    assert.equal(arkWorld(), "v1");
    const a = look();
    const reef = ZONE_SITES.coral_reef;
    for (const exact of [true, false]) {
        assert.equal(a.groundUnder(V1_LAKE.x, V1_LAKE.z, 0.3, exact).water, FRESH_LEVEL, "the lake");
        assert.equal(a.groundUnder(reef.x, reef.z, 0.3, exact).water, 0.3, "the sea");
    }
});

test("lake ghost: the v2 lake at its own level under an animal, and its water mesh with normals facing up", async () => {
    setArkWorld("v2");
    const {LAKE} = await import("@/ark-scene/islands/wild/fields");
    const level = (sampleGround(LAKE.x, LAKE.z) as unknown as {freshLevel: number | null}).freshLevel;
    assert.ok(level !== null && Math.abs(level - LAKE.level) < 0.01, `the lake's own surface (${level})`);
    const a = look();
    for (const exact of [true, false]) {
        const under = a.groundUnder(LAKE.x, LAKE.z, 0, exact);
        assert.ok(under.height < level - 0.4, "its bed under the water");
        assert.equal(under.water, level, exact ? "near: exact" : "far: the 25 cm grid");
    }
    const {freshWaterGeometry, wildGroundArrays} = await import("@/ark-scene/islands/wild/render/ground");
    const geometry = freshWaterGeometry(wildGroundArrays());
    const normal = geometry.getAttribute("normal");
    assert.ok(normal, "the lake's and the river's water has normals (the occlusion pass reads them)");
    assert.equal(normal.count, geometry.getAttribute("position").count);
    const position = geometry.getAttribute("position");
    let lowest = 1;
    let lake = 0;
    for (let i = 0; i < normal.count; i++) {
        assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-4, `unit normal at ${i}`);
        lowest = Math.min(lowest, normal.getY(i));
    }
    // (Its triangles: three vertices each, in order. One at the lake's level all round is level water, facing straight up.)
    for (let t = 0; t < position.count; t += 3) {
        if (![t, t + 1, t + 2].every((i) => Math.abs(position.getY(i) - level) < 1e-3)) continue;
        assert.ok(normal.getY(t) > 0.9999, `the lake's open water faces straight up (${normal.getY(t)})`);
        lake++;
    }
    assert.ok(lowest > 0, `every face up, none facing down (steepest ${lowest.toFixed(3)}: the river's falls)`);
    assert.ok(lake > 1000, `the lake's open water measured (${lake} triangles)`);
});
