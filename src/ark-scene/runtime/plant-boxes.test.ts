import assert from "node:assert/strict";
import test from "node:test";

import {BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Scene, Vector3} from "three";

import {PlantBoxes, segmentCrossesBox, segmentDistanceSq} from "./plant-boxes";
import {Box3} from "three";

test("the segment helpers", () => {
    assert.equal(segmentDistanceSq(new Vector3(0, 1, 0), new Vector3(-1, 0, 0), new Vector3(1, 0, 0)), 1);
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    assert.equal(segmentCrossesBox(new Vector3(-5, 0, 0), new Vector3(5, 0, 0), box), true);
    assert.equal(segmentCrossesBox(new Vector3(-5, 3, 0), new Vector3(5, 3, 0), box), false);
    assert.equal(segmentCrossesBox(new Vector3(-5, 0, 0), new Vector3(-2, 0, 0), box), false);
});

test("an eye among a crown's leaves, behind one, and clear of both", () => {
    const scene = new Scene();
    // Two 4 m "crowns" (instances of one set), at x 0 and x 20.
    const crowns = new InstancedMesh(new BoxGeometry(4, 4, 4), new MeshStandardMaterial(), 2);
    crowns.setMatrixAt(0, new Matrix4().makeTranslation(0, 3, 0));
    crowns.setMatrixAt(1, new Matrix4().makeTranslation(20, 3, 0));
    scene.add(crowns);
    scene.updateMatrixWorld(true);
    const plants = new PlantBoxes(scene);
    // Inside the first crown.
    assert.equal(plants.check(new Vector3(0.5, 3, 0.5), new Vector3(10, 0.3, 0), 0.2, 0), "inside");
    // Looking at an animal at x 10 through the second crown, from beyond it.
    assert.equal(plants.check(new Vector3(26, 3, 0), new Vector3(10, 3, 0), 0.2, 0), "through");
    // From above, clear.
    assert.equal(plants.check(new Vector3(10, 12, 6), new Vector3(10, 0.3, 0), 0.2, 0), "clear");
    // An animal in the crown itself: the line ends inside it, short of its slack: still "through" (hidden in the leaves).
    assert.equal(plants.check(new Vector3(0, 3, 10), new Vector3(0, 3, 0), 0.2, 0), "through");
});
