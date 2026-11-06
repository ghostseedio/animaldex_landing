import assert from "node:assert/strict";
import test from "node:test";
import {conservationKey, gradeChipTint, isFreeRangingDomestic, rarityKey, statsClassificationChips} from "@/lib/capture-card-chips";
import {CAPTURE_WORDS_EN} from "@/lib/capture-words";

const words = CAPTURE_WORDS_EN.stats;

test("one row of facts: GRADE, the setting, conservation and rarity, and no tier letter", () => {
    const {chips, settingIntro} = statsClassificationChips({captureGrade: 7, settingTag: "Wild", humanContext: "free_ranging", conservationTier: "VU", rarity: 50, words});
    assert.deepEqual(chips.map((chip) => chip.kind), ["grade", "setting", "conservation", "rarity"]);
    assert.deepEqual(chips.map((chip) => chip.value), ["7", "Wild", "Vulnerable", "Epic"]);
    assert.equal(chips[0].label, "GRADE");
    assert.equal(chips[0].showsInfo, true);
    assert.ok(chips.every((chip) => !/tier/i.test(chip.label ?? "")));
    assert.equal(settingIntro, words.wildIntro);
});

test("wild is the only coloured setting; a pet tagged Wild reads Free-ranging, uncoloured", () => {
    const wild = statsClassificationChips({captureGrade: null, settingTag: "wild", humanContext: null, conservationTier: null, rarity: null, words}).chips[0];
    assert.equal(wild.tint, "#A7F432");
    const zoo = statsClassificationChips({captureGrade: null, settingTag: "Zoo", humanContext: null, conservationTier: null, rarity: null, words}).chips[0];
    assert.equal(zoo.tint, null);
    const pet = statsClassificationChips({captureGrade: null, settingTag: "Wild", humanContext: "Pet", conservationTier: null, rarity: null, words}).chips[0];
    assert.equal(pet.value, "Free-ranging");
    assert.equal(pet.tint, null);
    assert.equal(isFreeRangingDomestic("Wild", "free_ranging"), false);
    assert.equal(statsClassificationChips({captureGrade: null, settingTag: "Unknown", humanContext: null, conservationTier: "Unknown", rarity: null, words}).chips.length, 0);
});

test("grade tints, conservation and rarity bands as iOS draws them", () => {
    assert.equal(gradeChipTint(10), "rgb(255 168 64)");
    assert.equal(gradeChipTint(6), "#A7F432");
    assert.equal(gradeChipTint(3), null);
    assert.equal(gradeChipTint(1), "rgb(255 133 122)");
    assert.equal(conservationKey("Critically Endangered"), "criticallyEndangered");
    assert.equal(conservationKey("Not Applicable"), null);
    assert.equal(rarityKey(9), "common");
    assert.equal(rarityKey(89), "legendary");
    assert.equal(rarityKey(90), "mythic");
});
