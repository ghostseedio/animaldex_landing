/**
 * Append-only scenery across terrain fixes (decision 303, `islands/wild/ledger.ts`): what a fix adds goes at the end
 * of its list, what it takes away stays a tombstone in its place, so the lists the homes are hashed onto keep every
 * other item's index, and a fix moves only the homes on what it changed (`ark-positions.test.ts` holds the homes to
 * the server's pinned atlas). Here: every ledger row still describes today's island (none outlives its fix), and the
 * homes a fix moves go only a short way.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {setArkWorld} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
import {mapPoints} from "@/ark-scene/map/place";
import {attachPointTags} from "@/ark-scene/map/sampler";
import {wildMapSampler} from "@/ark-scene/islands/wild/map-sampler";
import {wildScenery} from "@/ark-scene/islands/wild/scenery";
import {CELLS_WAS, DECOR_APPENDED, POINTS_ADDED, POINTS_GONE, POINTS_WAS, SCENERY_APPENDED, ledgerKey} from "@/ark-scene/islands/wild/ledger";

setArkWorld("v2");

test("what the fixes added is at the end of the scenery and of the decor, in the ledger's order", () => {
    const scenery = wildScenery().map((item) => ledgerKey(item.kind, item.x, item.z));
    assert.deepEqual(scenery.slice(-SCENERY_APPENDED.length), [...SCENERY_APPENDED]);
    const decor = worldDecor().map((item) => ledgerKey(item.kind, item.x, item.z));
    assert.deepEqual(decor.slice(-DECOR_APPENDED.length), [...DECOR_APPENDED]);
});

test("every row of the map's ledger still holds: added points are there, gone ones are not, changed ones differ", () => {
    const sampler = wildMapSampler();
    const points = new Map(sampler.attachPoints().map((point) => [point.id, point]));
    for (const id of POINTS_ADDED) assert.ok(points.has(id), `${id} (added) is not on the island`);
    for (const [, point] of POINTS_GONE) assert.ok(!points.has(point.id), `${point.id} (gone) is still on the island`);
    for (const [id, was] of POINTS_WAS) {
        const point = points.get(id);
        assert.ok(point, `${id} (changed) is not on the island`);
        const tags = attachPointTags(point, sampler.ground(point.x, point.z).tags);
        const differs = (was.tags && was.tags.join() !== tags.join()) || (was.x !== undefined && was.x !== point.x) || (was.z !== undefined && was.z !== point.z) || ("clearBelow" in was && was.clearBelow !== point.clearBelow);
        assert.ok(differs, `${id}: its row is what it is today`);
    }
    for (const [x, z, was] of CELLS_WAS) {
        const ground = sampler.ground(x, z);
        const wet = ground.water !== null;
        const cell = ground.tags.length && !(wet ? ground.depth < 0.5 : sampler.blocked(x, z, 0.5)) ? {zone: ground.zone, tags: ground.tags, wet} : null;
        assert.notDeepEqual(cell, was, `the cell at ${x},${z}: its row is what it is today`);
    }
});

test("a home on a cell a fix took away moves to the nearest cell of its zone where its tag holds today", () => {
    const all = mapPoints();
    const moved = Array.from(all.movedCells().entries());
    assert.ok(moved.length > 0 && moved.length <= CELLS_WAS.length * 4, `${moved.length} cells moved`);
    for (const [from, to] of moved) {
        const d = Math.hypot(from.x - to.x, from.z - to.z);
        assert.ok(d < 30, `${from.tag} at ${from.x},${from.z} moved ${d.toFixed(1)} m`);
        assert.equal(from.tag, to.tag);
        assert.ok(wildMapSampler().ground(to.x, to.z).tags.includes(to.tag), `${to.tag} does not hold at ${to.x},${to.z}`);
        const nearer = all.cellsWith(to.tag, to.water !== null).filter((cell) => cell.zone === from.zone && Math.hypot(cell.x - from.x, cell.z - from.z) < d - 1e-9);
        assert.deepEqual(nearer, [], `${from.tag} at ${from.x},${from.z}: a nearer cell holds it`);
    }
});
