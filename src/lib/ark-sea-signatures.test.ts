import assert from "node:assert/strict";
import test from "node:test";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {atHaulOut, haulOutKinds, haulOutLineOf} from "@/ark-scene/haul-out";

// (Lane SEA-SIG, 2026-11-27: a green sea turtle's seagrass graze and a reef fish's pick were tried and cut; in the scene's own
// pictures neither read. Nothing of them is left in the tables.)
test("the sea's cut acts left nothing behind", () => {
    const rows = (table as {species: Record<string, string>}).species;
    for (const slug of ["green-sea-turtle", "cunner", "titan-triggerfish", "moon-wrasse"]) assert.doesNotMatch(rows[slug] ?? "", /seagrass_graze|reef_pick/, slug);
    const said = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
    for (const slug of ["green-sea-turtle", "cunner", "titan-triggerfish", "moon-wrasse"]) assert.equal(said[slug]?.seagrass_graze ?? said[slug]?.reef_pick, undefined, slug);
});

test("a seal's haul-out: only settled at its own roost, on dry ground, close to it; its line names no tide", () => {
    assert.deepEqual(haulOutKinds(), ["harbor-seal"]);
    const line = haulOutLineOf("harbor-seal")!;
    assert.match(line, /^\{aAnimal\} [^{}]+$/);
    assert.doesNotMatch(line, /\btide\b/i);
    assert.equal(haulOutLineOf("grey-heron"), null);
    const roost = {x: 10, z: 5};
    const dry = {x: 10.4, z: 5.2, moving: false, afloat: false, ground: 0.6, water: 0};
    assert.ok(atHaulOut(dry, roost, 1.6, "sleep"));
    assert.ok(atHaulOut(dry, roost, 1.6, "rest"));
    assert.ok(atHaulOut(dry, roost, 1.6, "bask"));
    assert.ok(atHaulOut({...dry, x: 12.3}, roost, 1.6, "bask"), "its usual spot, 2.3 m off its roost");
    assert.ok(!atHaulOut(dry, roost, 1.6, "forage"), "foraging is not hauled out");
    assert.ok(!atHaulOut({...dry, moving: true}, roost, 1.6, "rest"), "on its way");
    assert.ok(!atHaulOut({...dry, afloat: true}, roost, 1.6, "rest"), "afloat");
    assert.ok(!atHaulOut({...dry, ground: -0.2}, roost, 1.6, "rest"), "over the water");
    assert.ok(atHaulOut({...dry, ground: 0.0999, water: 0.08}, roost, 1.6, "rest"), "settled on the tide line, its ground just over the water");
    assert.ok(!atHaulOut({...dry, x: 14}, roost, 1.6, "rest"), "away from its own spot");
});
