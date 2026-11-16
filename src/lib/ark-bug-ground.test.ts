import assert from "node:assert/strict";
import test from "node:test";
import {BUG_CELL, BUG_DENSITY, BUG_TIERS, bugCellItems, bugClearPoints, wildBugCover, type BugCover, type BugCoverAt} from "@/ark-scene/bug-ground";
import {setArkWorld, sampleGround} from "@/ark-scene/world";
import {townBugCover} from "@/ark-scene/islands/town/bug-cover";
import {sampleTownGround, streetEdgeDistance} from "@/ark-scene/islands/town/ground";

const flat = (surface: BugCover["surface"], dry = 0.2): BugCoverAt => () => ({surface, height: 1, dry});

test("ark-bug-ground: a cell is the same for every viewer, and fills by its surface", () => {
    const a = bugCellItems(12, -7, flat("lawn"), 1);
    const b = bugCellItems(12, -7, flat("lawn"), 1);
    assert.deepEqual(a, b);
    const blades = a.filter((item) => item.kind === "blade").length;
    const expected = BUG_DENSITY.lawn.per.blade! * BUG_CELL * BUG_CELL;
    assert.ok(Math.abs(blades - expected) <= 1, `lawn blades ${blades} vs ${expected}`);
    // A lawn's blades are short, a meadow's taller and more varied.
    const meadow = bugCellItems(12, -7, flat("meadow"), 1).filter((item) => item.kind === "blade");
    assert.ok(Math.max(...a.filter((item) => item.kind === "blade").map((item) => item.sy)) <= BUG_DENSITY.lawn.blade[1] + 1e-9);
    assert.ok(Math.max(...meadow.map((item) => item.sy)) > 0.15);
    // Sand grows grains and shells, hardly any blades; the woods moss, twigs and leaves.
    const sand = bugCellItems(3, 3, flat("sand"), 1);
    assert.ok(sand.filter((item) => item.kind === "grit").length > 20);
    assert.ok(sand.filter((item) => item.kind === "blade").length <= 3);
    const woods = Array.from({length: 8}, (_, i) => bugCellItems(i, 0, flat("woods"), 1)).flat();
    for (const kind of ["moss", "twig", "leaf", "grit"] as const) assert.ok(woods.some((item) => item.kind === kind), kind);
    // Nothing where nothing covers the ground (water, paving), and a lower tier's share thins evenly.
    assert.deepEqual(bugCellItems(0, 0, () => null, 1), []);
    const thin = bugCellItems(12, -7, flat("lawn"), BUG_TIERS.low.share).filter((item) => item.kind === "blade").length;
    assert.ok(thin < blades * 0.6 && thin > blades * 0.2, `${thin} of ${blades}`);
});

test("ark-bug-ground: everything stands on the ground it was given, inside its cell", () => {
    const cover: BugCoverAt = (x, z) => ({surface: x + z > 0.5 ? "meadow" : "soil", height: 2 + x * 0.1 - z * 0.05, dry: 0.3});
    for (const item of bugCellItems(1, 0, cover, 1)) {
        assert.ok(item.x >= 0.5 && item.x <= 1 && item.z >= 0 && item.z <= 0.5);
        const ground = 2 + item.x * 0.1 - item.z * 0.05;
        // Rooted: a blade's foot just under, a grain sunk a third, nothing floating.
        assert.ok(item.y <= ground + 0.003 && item.y > ground - 0.02, `${item.kind} at ${item.y} on ${ground}`);
    }
    // The edge between two covers is ragged (both covers' items reach into the cell's middle), not a step.
    const mixed = Array.from({length: 20}, (_, i) => bugCellItems(i, -i, (x, z) => ({surface: (x * 7 + z * 3) % 1 > 0.5 ? "lawn" : "sand", height: 0, dry: 0}), 1)).flat();
    assert.ok(mixed.some((item) => item.kind === "blade") && mixed.some((item) => item.kind === "shell"));
});

test("ark-bug-ground: the clear points are the animals within reach, nearest first, never allocated per call", () => {
    const animals = [
        {x: 5, z: 0, length: 0.02, drawn: true},
        {x: 0.4, z: 0.1, length: 0.03, drawn: true},
        {x: 1, z: 1, length: 0.4, drawn: true},
        {x: 0.2, z: 0.2, length: 0.05, drawn: false}
    ];
    const read = (a: (typeof animals)[number], out: {x: number; y: number; z: number; length: number}) => ((out.x = a.x), (out.y = 0), (out.z = a.z), (out.length = a.length), a.drawn);
    const first = bugClearPoints(animals, read, {x: 0, z: 0}, 2);
    assert.deepEqual(first.map((p) => [p.x, p.z]), [[0.4, 0.1], [1, 1]]);
    assert.ok(first[0].radius >= 0.05 - 1e-9);
    const again = bugClearPoints(animals, read, {x: 0, z: 0}, 2);
    assert.equal(again, first);
});

test("ark-bug-ground: the wild island's and the town's covers follow their ground", () => {
    setArkWorld("v2");
    try {
        // Out at sea: nothing; a grassland spot: a meadow.
        assert.equal(wildBugCover(400, 400), null);
        const meadow = wildBugCover(80.4, 35.9);
        assert.equal(meadow?.surface, "meadow");
        assert.ok(Math.abs(meadow!.height - sampleGround(80.4, 35.9).height) < 0.3);
    } finally {
        setArkWorld("v1");
    }
    // The town: a lawn grows a lawn; a street grows nothing.
    assert.equal(sampleTownGround(18.6, 46.4).surface, "lawn");
    assert.equal(townBugCover(18.6, 46.4)?.surface, "lawn");
    let street: [number, number] | null = null;
    for (let x = -60; x < 60 && !street; x += 1.5) for (let z = -60; z < 60 && !street; z += 1.5) if (streetEdgeDistance(x, z) < -1) street = [x, z];
    assert.ok(street);
    assert.equal(townBugCover(street[0], street[1]), null);
});
