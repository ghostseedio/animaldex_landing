import assert from "node:assert/strict";
import {test} from "node:test";
import {Lineage, motherAmong, NURSE_SLOT_MS, nurseBlend, nursePlace, nurses, nurseTurn, nursingBout} from "@/ark-scene/young-care";

test("the mother is the parent drawn female, else one not drawn male, else the record's first; only those aboard", () => {
    const sex: Record<string, boolean | null> = {sire: true, dam: false, unknown: null};
    const male = (id: string) => sex[id];
    assert.equal(motherAmong(["sire", "dam"], male), "dam");
    assert.equal(motherAmong(["sire", "unknown"], male), "unknown");
    assert.equal(motherAmong(["sire"], male), "sire");
    assert.equal(motherAmong(["sire", "dam"], male, (id) => id !== "dam"), "sire");
    assert.equal(motherAmong(["sire", "dam"], male, () => false), null);
});

test("lineage: the record's births, kept on the device and read back on the next visit", () => {
    let kept: string | null = null;
    const store = {get: () => kept, set: (text: string) => void (kept = text)};
    const first = new Lineage(store);
    assert.equal(first.note(["calf"], ["sire", "dam"]), true);
    assert.equal(first.note(["calf"], ["sire", "dam"]), false, "the same birth told twice is nothing new");
    assert.equal(first.note(["orphan"], []), false, "a birth with no parents says nothing");
    assert.deepEqual(first.parentsOf("calf"), ["sire", "dam"]);
    const next = new Lineage(store);
    assert.deepEqual(next.parentsOf("calf"), ["sire", "dam"]);
    assert.equal(next.motherOf("calf", (id) => id === "sire", () => true), "dam");
    assert.equal(next.motherOf("stranger", () => null, () => true), null, "no record: today's pick stands");
    next.setRecorded([{id: "kid", parents: ["a", "b"]}, {id: "arrival", parents: null}]);
    assert.deepEqual(next.parentsOf("kid"), ["a", "b"]);
    assert.equal(next.parentsOf("arrival"), null);
    assert.equal(new Lineage({get: () => "{not json", set: () => {}}).size, 0);
    assert.equal(new Lineage({get: () => { throw new Error("blocked"); }, set: () => {}}).size, 0);
});

test("nursing: the model's plan (mammal), never a rig name or another plan", () => {
    assert.equal(nurses("mammal"), true);
    for (const plan of ["quadruped", "bird", "reptile", "fish", "cetacean", "arthropod", null, undefined]) assert.equal(nurses(plan), false);
});

test("nursing bouts are pure in the id and the clock: at most one a window, eased in and out, the same on every call", () => {
    const id = "0000feed-0000-4000-8000-000000000003";
    let bouts = 0;
    let suckled = 0;
    for (let slot = 1000; slot < 1200; slot++) {
        let inBout = false;
        let peak = 0;
        const keys = new Set<string>();
        for (let ms = slot * NURSE_SLOT_MS; ms < (slot + 1) * NURSE_SLOT_MS; ms += 500) {
            const b = nursingBout(id, ms);
            assert.deepEqual(nursingBout(id, ms), b);
            if (!b) continue;
            inBout = true;
            keys.add(b.key);
            peak = Math.max(peak, b.level);
            assert.ok(b.level >= 0 && b.level <= 1);
            if (b.suckling) {
                assert.equal(b.level, 1);
                suckled += 0.5;
            }
        }
        if (inBout) {
            bouts++;
            assert.equal(keys.size, 1);
            assert.equal(peak, 1);
        }
    }
    assert.ok(bouts > 120 && bouts < 180, `about three windows in four have a bout (${bouts}/200)`);
    assert.ok(suckled / bouts >= 26 && suckled / bouts <= 48, `a bout's suckling lasts 26-48 s (${(suckled / bouts).toFixed(1)})`);
    // The walk in starts from the heel (level 0), never a jump.
    const slot = 1000 + Array.from({length: 200}, (_, k) => k).find((k) => { for (let ms = (1000 + k) * NURSE_SLOT_MS; ms < (1001 + k) * NURSE_SLOT_MS; ms += 500) if (nursingBout(id, ms)) return true; return false; })!;
    let first = Infinity;
    for (let ms = slot * NURSE_SLOT_MS; ms < (slot + 1) * NURSE_SLOT_MS && first === Infinity; ms += 10) if (nursingBout(id, ms)) first = ms;
    assert.ok(nursingBout(id, first)!.level < 0.01);
    assert.notEqual(nursingBout("another-young", first)?.key, nursingBout(id, first)!.key);
});

test("it suckles with its nose at her flank, facing back along her and turned in; the walk there is a blend from its heel", () => {
    const mother = {x: 10, z: 20, yaw: 0, length: 2};
    for (const youngLength of [0.7, 1.2, 1.9]) {
        const at = nursePlace("calf", mother, youngLength);
        // Its nose (half its length ahead of its middle, along its heading): 0.12 of her length out, a fifth of it behind her middle.
        const nose = {x: at.x + Math.sin(at.yaw) * youngLength * 0.5, z: at.z + Math.cos(at.yaw) * youngLength * 0.5};
        assert.ok(Math.abs(Math.abs(nose.x - mother.x) - 0.24) < 1e-9, `nose at her flank (${youngLength})`);
        assert.ok(Math.abs(nose.z - (mother.z - 0.4)) < 1e-9);
        // Its body is out beside her, not inside her: its middle further out than its nose, and it faces back (and in).
        assert.ok(Math.abs(at.x - mother.x) > Math.abs(nose.x - mother.x) + youngLength * 0.3);
        assert.ok(Math.cos(at.yaw - mother.yaw) < -0.5, "facing back along her");
        assert.ok(Math.sign(Math.sin(at.yaw)) === -Math.sign(at.x - mother.x), "turned in toward her");
        // Turned with her: the same place in her own frame.
        const turned = nursePlace("calf", {...mother, yaw: 1.1}, youngLength);
        assert.ok(Math.abs(Math.hypot(turned.x - mother.x, turned.z - mother.z) - Math.hypot(at.x - mother.x, at.z - mother.z)) < 1e-9);
    }
    const at = nursePlace("calf", mother, 0.7);
    const heel = {x: 9, z: 18, yaw: 0.1};
    assert.deepEqual(nurseBlend(heel, at, 0), heel);
    const there = nurseBlend(heel, at, 1);
    assert.ok(Math.abs(there.x - at.x) < 1e-9 && Math.abs(there.z - at.z) < 1e-9);
    assert.ok(Math.abs(nurseBlend({x: 0, z: 0, yaw: 3}, {x: 0, z: 0, yaw: -3}, 0.5).yaw - Math.PI) < 0.2, "the short way round");
});

test("when she turns where she stands, its place beside her turns with her", () => {
    assert.deepEqual(nurseTurn(1, 2, 0), [0, 0]);
    // Ahead of her (0, 1) and she turns a quarter to her right (yaw +90 degrees: heading (1, 0)): it is ahead of her still.
    const [dx, dz] = nurseTurn(0, 1, Math.PI / 2);
    assert.ok(Math.abs(0 + dx - 1) < 1e-9 && Math.abs(1 + dz - 0) < 1e-9);
    const mother = {x: 3, z: 4, yaw: 0.3, length: 2};
    const before = nursePlace("calf", mother, 0.8);
    const after = nursePlace("calf", {...mother, yaw: 0.3 + 0.7}, 0.8);
    const [tx, tz] = nurseTurn(before.x - mother.x, before.z - mother.z, 0.7);
    assert.ok(Math.abs(before.x + tx - after.x) < 1e-9 && Math.abs(before.z + tz - after.z) < 1e-9);
});
