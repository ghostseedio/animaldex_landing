/**
 * ARK-CANOPY: a swinger's hand only on drawn wood (`canopy-scene.ts` woodHold, `canopy-wood.json` from
 * `scripts/ark-canopy-wood.mjs`): each hold moved onto the wood every near level draws, a hold with none within 10 cm,
 * a palm's frond or a limb steeper than 35° left out.
 */

import assert from "node:assert/strict";
import test from "node:test";
import wood from "@/ark-scene/canopy-wood.json";
import attach from "@/ark-scene/tree-attach.json";
import {woodHold} from "@/ark-scene/canopy-scene";

const WOOD = (wood as unknown as {assets: Record<string, Record<string, number[][]>>}).assets;
const ROWS = (attach as unknown as {assets: Record<string, Array<[string, ...number[]]>>}).assets;
const placed = {root: {x: 10, y: 2, z: -5}, rotation: 0.7, scale: 1.5};
const level = {x: 1, y: 0, z: 0};

test("every asset tree's limb, hang and branch points have a wood row, in tree-attach.json's order", () => {
    for (const [asset, rows] of Object.entries(ROWS)) {
        for (const tag of ["limb", "canopy_hang", "branch"]) assert.equal(WOOD[asset]?.[tag]?.length, rows.filter((r) => r[0] === tag).length, `${asset} ${tag}`);
    }
});

test("a hold on wood is moved onto it (placed as the tree is); one off the wood, a frond or a steep limb is none", () => {
    const n = WOOD["oak-a"].limb.findIndex((r) => r[0] * placed.scale <= 0.1);
    assert.ok(n >= 0);
    const row = WOOD["oak-a"].limb[n];
    const at = woodHold({id: `limb:decor1:${n}`, tag: "limb", asset: "oak-a", forward: level, wind: placed});
    assert.ok(at);
    const c = Math.cos(placed.rotation);
    const s = Math.sin(placed.rotation);
    assert.ok(Math.abs(at.x - (10 + row[1] * 1.5 * c + row[3] * 1.5 * s)) < 1e-9);
    assert.ok(Math.abs(at.y - (2 + row[2] * 1.5)) < 1e-9);
    // (A twig only lod0 draws: off the wood at the further levels.)
    const far = WOOD["emergent-b"].branch.findIndex((r) => r[0] > 0.1);
    assert.ok(far >= 0);
    assert.equal(woodHold({id: `branch:decor2:${far}`, tag: "branch", asset: "emergent-b", forward: level, wind: {...placed, scale: 1}}), null);
    assert.equal(woodHold({id: "canopy_hang:decor3:0", tag: "canopy_hang", asset: "palm-a", forward: level, wind: placed}), null);
    assert.equal(woodHold({id: `limb:decor1:${n}`, tag: "limb", asset: "oak-a", forward: {x: 0.5, y: 0.8, z: 0}, wind: placed}), null);
});
