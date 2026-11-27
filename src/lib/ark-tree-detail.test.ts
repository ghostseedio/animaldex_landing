/**
 * Lane SEAT: the trees an animal drawn near is held up in keep their full level (`ark-scene/tree-detail.ts`): the
 * level a perch's limb is on. A woodpecker drawn 50 m off was held a metre over its beech's lod2 crown, an apostlebird
 * 15 m over the forest floor beside its oak's lod2.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {holdTreeDetail, releaseTreeDetail, resetTreeDetail, treeDetailPoints, treeDetailVersion, treeHoldsPoint} from "@/ark-scene/tree-detail";

const beech = {x: -9.13, y: 5.46, z: -31.96, radius: 9.6, height: 22.3};

test("a tree holds a point up in its crown, not one at its foot, past its crown or over its top", () => {
    // (The woodpecker of PR #160's CI: 3.9 m from the trunk, 12 m up.)
    assert.ok(treeHoldsPoint(beech, [{x: -5.93, y: 17.46, z: -34.23}]));
    assert.ok(!treeHoldsPoint(beech, [{x: -8.5, y: 5.6, z: -31.5}]), "one on the ground at its foot");
    assert.ok(!treeHoldsPoint(beech, [{x: 5, y: 17, z: -31.96}]), "one past its crown");
    assert.ok(!treeHoldsPoint(beech, [{x: -9, y: 30, z: -32}]), "one over its top");
});

test("a hold is kept while it is renewed and let go after it stops; each change is told by the version", () => {
    resetTreeDetail();
    const bird = {};
    const v0 = treeDetailVersion();
    holdTreeDetail(bird, 1, 10, 2, 100);
    assert.notEqual(treeDetailVersion(), v0);
    assert.deepEqual(treeDetailPoints(), [{x: 1, y: 10, z: 2}]);
    // (Along its limb a little: the same tree, nothing sorted again.)
    const v1 = treeDetailVersion();
    holdTreeDetail(bird, 1.2, 10, 2, 130);
    assert.equal(treeDetailVersion(), v1);
    // (On to another tree: sorted again.)
    holdTreeDetail(bird, 6, 10, 2, 160);
    assert.notEqual(treeDetailVersion(), v1);
    assert.deepEqual(treeDetailPoints(), [{x: 6, y: 10, z: 2}]);
    releaseTreeDetail(300);
    assert.equal(treeDetailPoints().length, 1, "renewed within its keep");
    releaseTreeDetail(160 + 241);
    assert.equal(treeDetailPoints().length, 0, "let go once not renewed");
    // (A new scene's count starting again lets every hold go.)
    holdTreeDetail(bird, 6, 10, 2, 500);
    releaseTreeDetail(3);
    assert.equal(treeDetailPoints().length, 0);
});
