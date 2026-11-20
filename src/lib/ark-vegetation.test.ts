// Vegetation on the web (AnimalDex decision 417 (1), lane ARK-FOOD-B): the read decoded, the words' thresholds, the
// uniform laid out, and every Ark language with the three words.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {ARK_GRAZED, decodeVegetation, GRAZED_ZONES, grassWord, setGrazedLevels} from "@/ark-scene/grass-grazed";
import {ARK_BUNDLE_LANGUAGES} from "@/lib/ark-languages";

test("vegetation: off (null, junk, no zones) decodes to null and leaves the grass lush", () => {
    for (const raw of [null, undefined, 3, "x", {}, {zones: []}, {zones: {}}, {zones: {"wild|grassland": {level: "a"}}}]) assert.equal(decodeVegetation(raw), null);
    setGrazedLevels(null);
    assert.ok(Array.from(ARK_GRAZED.value).every((v) => v === 1));
});

test("vegetation: levels by island|zone, clamped; the wild island's laid into the uniform by zone", () => {
    const v = decodeVegetation({day: 400, zones: {"wild|grassland": {level: 0.12, grass: 0.1}, "wild|woodland": {level: 1.4}, "town|farm_garden": {level: 0.3}, "bad key": {level: 0.5}}})!;
    assert.equal(v.day, 400);
    assert.deepEqual(Array.from(v.levels.keys()).sort(), ["town|farm_garden", "wild|grassland", "wild|woodland"]);
    assert.equal(v.levels.get("wild|woodland"), 1);
    setGrazedLevels(v);
    assert.equal(ARK_GRAZED.value[GRAZED_ZONES.indexOf("grassland")], Math.fround(0.12));
    assert.equal(ARK_GRAZED.value[GRAZED_ZONES.indexOf("farm_garden")], 1, "the town's levels are not the wild island's grass");
    setGrazedLevels(null);
});

test("vegetation: the engine's thresholds (plenty from half, bare under 0.15)", () => {
    assert.equal(grassWord(0.95), "plenty");
    assert.equal(grassWord(0.5), "plenty");
    assert.equal(grassWord(0.49), "thinning");
    assert.equal(grassWord(0.15), "thinning");
    assert.equal(grassWord(0.14), "bare");
});

test("vegetation: every Ark language says the three words", () => {
    const root = path.join(process.cwd(), "src/data/locales");
    const files = ["en.json", "id.json", ...ARK_BUNDLE_LANGUAGES.map((code) => `ark/${code}.json`)];
    assert.equal(files.length, 45);
    for (const file of files) {
        const life = (JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as {ark: {life: Record<string, string>}}).ark.life;
        for (const key of ["grassPlenty", "grassThinning", "grassBare"]) assert.ok(life[key] && life[key].length > 4, `${file} ${key}`);
    }
});
