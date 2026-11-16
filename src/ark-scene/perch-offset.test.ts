/**
 * A perched animal's viewer-local reaction never walks it off its perch (the owner, 2026-11-16: a bird "walking on a
 * tree for a long time and didn't fall off the edge so it appeared floating in the air"): `offsetShare`'s "perch".
 */
import assert from "node:assert/strict";
import test from "node:test";
import {offsetShare} from "@/ark-scene/reactive";

const dry = () => false;
const flat = () => 0;

test("on a perch a reaction's offset is not taken: it turns and looks where it stands", () => {
    const onBranch = {x: 0, z: 0, base: 4.2};
    assert.equal(offsetShare(onBranch, 2.5, 0, "perch", dry, flat), 0);
    assert.equal(offsetShare(onBranch, 0, -0.4, "perch", dry, flat), 0);
});

test("on the ground and in the water the offsets are as before", () => {
    assert.equal(offsetShare({x: 0, z: 0, base: 0}, 1, 0, "land", dry, flat), 1);
    assert.equal(offsetShare({x: 0, z: 0, base: 0}, 1, 0, "free", dry, flat), 1);
});
