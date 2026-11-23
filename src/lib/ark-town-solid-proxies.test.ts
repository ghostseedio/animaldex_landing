/**
 * SIG4: the town's solid scenery as invisible prisms for the seat pass (`islands/town/render/solid-proxies.ts`). The
 * town's drawn meshes let their vertex arrays go once on the GPU, so the seat pass (`seat/solids.ts` DrawnSolids) read
 * nothing there; these prisms are made from the town's colliders and must stand for every solid the colliders know (the
 * colliders' ids are matched by prefix, so a new kind of solid id is caught here), be read as built solids, closed and
 * wound outward, and never be drawn.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Camera, Scene} from "three";
import {townColliderList} from "@/ark-scene/islands/town/colliders";
import {townSolids} from "@/ark-scene/islands/town/solids";
import {launchEnclosures} from "@/ark-scene/islands/town/areas";
import {buildSolidProxies, proxied, SOLID_PROXY_LAYER} from "@/ark-scene/islands/town/render/solid-proxies";
import {DrawnSolids, ALL, HARD, solidClass, solidLabel, type SolidHit} from "@/ark-scene/seat/solids";

const open = launchEnclosures();
const origin = {x: 480, z: -320};
const colliders = townColliderList(open, origin);
const chosen = colliders.filter(proxied);

test("every town solid that is not a rock, a pond or soft has its proxy", () => {
    const expected = townSolids(open).filter((s) => s.gap === 0 && s.kind !== "rock" && s.kind !== "pond" && s.top > s.base + 0.02);
    assert.ok(expected.length > 100, `${expected.length} solids`);
    assert.equal(chosen.length, expected.length);
    assert.deepEqual(new Set(chosen.map((c) => c.id)), new Set(expected.map((s) => `town:${s.id}`)));
    // (Never a fence, a house or a habitat item: those are other things' colliders; never one a small body goes into.)
    assert.ok(chosen.every((c) => c.gap === 0 && c.kind !== "fence" && !c.id.startsWith("town:habitat:")));
});

test("the proxies are never drawn and are read as built solids", () => {
    const proxies = buildSolidProxies(colliders, origin);
    assert.equal(proxies.solids, chosen.length);
    assert.ok(proxies.group.children.length > 1, "chunked");
    const camera = new Camera();
    for (const mesh of proxies.group.children as Array<import("three").Mesh>) {
        assert.equal(mesh.layers.test(camera.layers), false, "not on the camera's layers");
        assert.equal(mesh.layers.isEnabled(SOLID_PROXY_LAYER), true);
        assert.equal((mesh.material as import("three").Material).visible, false);
        assert.equal(mesh.castShadow, false);
        assert.equal(mesh.userData.solidProxy, true);
        assert.equal(solidClass(solidLabel(mesh)), HARD);
    }
    // Under 10k triangles for the launch zoo and the town: about 100 KB.
    assert.ok(proxies.triangles < 10000, `${proxies.triangles} triangles`);
    proxies.dispose();
});

test("each proxy is closed and wound outward: a drop meets its top facing up and its bottom facing down", () => {
    const proxies = buildSolidProxies(colliders, origin);
    const scene = new Scene();
    proxies.group.position.set(origin.x, 0, origin.z);
    scene.add(proxies.group);
    scene.updateMatrixWorld(true);
    const solids = new DrawnSolids(scene);
    solids.force = true;
    solids.begin(0);
    let checked = 0;
    for (const c of chosen) {
        const x = c.shape === "segment" ? (c.ax + c.bx) / 2 : c.cx;
        const z = c.shape === "segment" ? (c.az + c.bz) / 2 : c.cz;
        const hits: SolidHit[] = [];
        assert.ok(solids.cast(x, c.y1 + 5, z, 0, -(c.y1 - c.y0 + 10), 0, ALL, hits));
        const own = hits.filter((h) => h.y >= c.y0 - 1e-3 && h.y <= c.y1 + 1e-3).sort((a, b) => b.y - a.y);
        assert.ok(own.length >= 2, `${c.id}: ${own.length} faces`);
        assert.ok(own[0].ny > 0.5, `${c.id}: its top faces up`);
        assert.ok(own[own.length - 1].ny < -0.5, `${c.id}: its bottom faces down`);
        assert.equal(own[0].double, false);
        // (A box's and a post's top is the collider's top; a log's is its own round top, at most the collider's.)
        if (c.shape !== "segment") assert.ok(Math.abs(own[0].y - c.y1) < 1e-3, `${c.id}: top ${own[0].y} vs ${c.y1}`);
        // From inside, straight up: the top seen from inside (its normal along the cast), what the seat's rockExit reads.
        const up: SolidHit[] = [];
        const mid = c.shape === "segment" ? own[own.length - 1].y + (own[0].y - own[own.length - 1].y) / 2 : (c.y0 + c.y1) / 2;
        solids.cast(x, mid, z, 0, c.y1 - mid + 1, 0, ALL, up);
        assert.ok(up.some((h) => h.ny > 0.5), `${c.id}: the top seen from inside`);
        checked++;
    }
    assert.equal(checked, chosen.length);
    proxies.dispose();
});
