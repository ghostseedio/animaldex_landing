/**
 * EATSOON: the chance of a catch in the next Ark day, from the engine's next hunt, awake time and its two numbers; the
 * words for everyone else; the read's tuple (old and new); the status text; the words in every Ark locale.
 */
import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {ARK_EAT_SOON_ENGLISH, ARK_STALK_CUE, arkCatchChance, arkEatSoon, arkEatSoonOn, arkStalkCouldCue, arkStalkCue, arkStalkCueOn, arkEatSoonPercent, arkEatSoonText, type ArkEatSoonInput} from "@/lib/ark-eat-soon";
import {decodeArkHunting} from "@/lib/ark-hunting";
import {arkStatusSignature, arkStatusText, arkStatusWords, type ArkAnimalStatus} from "@/lib/ark-animal-status";
import {HuntingLayer} from "@/ark-scene/hunting";
import {ARK_DAY_MS, STEPS_PER_ARK_DAY, awakeAt, decodeAtlas, sheetOf} from "@/ark-scene/positions/positions";
import type {ArkAnimal} from "@/ark-scene/types";

const FOX = "00000000-0000-4000-8000-000000000100";
const base: ArkEatSoonInput["animal"] = {species_profile_id: "00000000-0000-4000-8000-0000000000bb", model_slug: "red-fox", scientific_name: "Vulpes vulpes", area: null, condition: "well_fed"};

test("the formula: (1 - (1 - find)^n) x catch; no step, no chance; held to 0..1 and to one Ark day of steps", () => {
    assert.equal(arkCatchChance(0.5, 0.3, 0), 0);
    assert.equal(arkCatchChance(0.5, 0.3, 1), 0.15);
    assert.ok(Math.abs(arkCatchChance(0.1, 0.5, 10) - (1 - 0.9 ** 10) * 0.5) < 1e-12);
    assert.equal(arkCatchChance(0, 1, 96), 0, "never finds prey: never eats");
    assert.equal(arkCatchChance(1, 0.26, 3), 0.26, "finds prey every step: the catch chance, one try (the miss cooldown is a day)");
    assert.equal(arkCatchChance(2, 2, 500), 1);
    assert.equal(arkCatchChance(0.01, 1, 500), arkCatchChance(0.01, 1, 96));
    assert.equal(arkCatchChance(NaN, 1, 5), 0);
});

test("who reads what: a hunter's chance, due without numbers, later, dormant; kept; everyone else daily or short; a human nothing", () => {
    const odds = {find: 0.2, catch: 0.5, dormant: false};
    const chance = arkEatSoon({animal: base, window: {steps: 10, firstAt: 1}, odds});
    assert.equal(chance?.kind, "chance");
    assert.equal(chance?.kind === "chance" && chance.value, Math.round((1 - 0.8 ** 10) * 0.5 * 1000) / 1000);
    assert.deepEqual(arkEatSoon({animal: base, window: {steps: 10, firstAt: 1}, odds: null}), {kind: "hunting"});
    assert.deepEqual(arkEatSoon({animal: base, window: {steps: 0, firstAt: 1234}, odds}), {kind: "later", at: 1234});
    assert.equal(arkEatSoon({animal: base, window: {steps: 0, firstAt: null}, odds}), null, "nothing within a few days: nothing said");
    assert.deepEqual(arkEatSoon({animal: base, window: {steps: 10, firstAt: 1}, odds: {...odds, dormant: true}}), {kind: "dormant"});
    assert.deepEqual(arkEatSoon({animal: {...base, area: "house"}, window: {steps: 10, firstAt: 1}, odds}), {kind: "kept", carer: "owner"});
    assert.deepEqual(arkEatSoon({animal: {...base, area: "farm"}, window: null, odds: null}), {kind: "kept", carer: "farmer"});
    assert.deepEqual(arkEatSoon({animal: {...base, area: "zoo"}, window: null, odds: null}), {kind: "kept", carer: "keeper"});
    assert.deepEqual(arkEatSoon({animal: base, window: null, odds: null}), {kind: "daily"});
    assert.deepEqual(arkEatSoon({animal: {...base, condition: "hungry"}, window: null, odds: null}), {kind: "short"});
    assert.equal(arkEatSoon({animal: {...base, species_profile_id: "2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", model_slug: "human"}, window: null, odds: null}), null);
});

test("the read's tuple: [id, from] as before; [id, from, find, catch, dormant?] adds the engine's numbers; nonsense dropped", () => {
    const other = FOX.replace("100", "101");
    const third = FOX.replace("100", "102");
    const fourth = FOX.replace("100", "103");
    const fifth = FOX.replace("100", "104");
    const h = decodeArkHunting({hunting: "encounter", predators: [[FOX, 81.25], [other, 82, 0.25, 0.3], [third, 83, 0.5, 0.2, 1], [fourth, 84, 2, 0.2], [fifth, 85, null, null, 1]]})!;
    assert.deepEqual(Array.from(h.predators), [[FOX, 81.25], [other, 82], [third, 83], [fourth, 84], [fifth, 85]], "every next hunt as before");
    assert.deepEqual(Array.from(h.odds!), [[other, {find: 0.25, catch: 0.3, dormant: false}], [third, {find: 0.5, catch: 0.2, dormant: true}], [fifth, {find: null, catch: null, dormant: true}]]);
    assert.deepEqual(arkEatSoon({animal: base, window: {steps: 5, firstAt: 1}, odds: {find: null, catch: null, dormant: false}}), {kind: "hunting"});
});

test("words: the % never reads 0 for a real chance; each kind's line; English fallback; the status text and signature", () => {
    assert.equal(arkEatSoonPercent(0.123, "en"), "12%");
    assert.equal(arkEatSoonPercent(0.001, "en"), "<1%");
    assert.equal(arkEatSoonPercent(0, "en"), "0%");
    assert.equal(arkEatSoonText({kind: "chance", value: 0.42}, null, "en", 0).text, "42% chance of a catch in the next Ark day");
    assert.equal(arkEatSoonText({kind: "chance", value: 0.42}, null, "en", 0).percent, "42%");
    assert.equal(arkEatSoonText({kind: "later", at: 7200}, null, "en", 0).text, "Hunts again in about 2 hours");
    assert.equal(arkEatSoonText({kind: "daily"}, {eatSoonDaily: "Mange tous les jours"}, "fr", 0).text, "Mange tous les jours");
    assert.equal(arkEatSoonText({kind: "kept", carer: "owner"}, {eatSoonKept: " "}, "en", 0).text, ARK_EAT_SOON_ENGLISH.eatSoonKept);
    const status: ArkAnimalStatus = {id: FOX, activity: "resting", since: null, goal: null, log: [], bars: {fed: null, health: null, energy: null, age: null}};
    const words = arkStatusWords(null);
    assert.equal(arkStatusText(status, words, "en", 0).soon, undefined, "off: nothing");
    const on = arkStatusText({...status, eatSoon: {kind: "chance", value: 0.3}}, words, "en", 0).soon!;
    assert.deepEqual(on, {label: "Chance of a catch in the next Ark day", text: "30% chance of a catch in the next Ark day", percent: "30%"});
    assert.notEqual(arkStatusSignature({...status, eatSoon: {kind: "chance", value: 0.3}}), arkStatusSignature({...status, eatSoon: {kind: "chance", value: 0.5}}));
    assert.equal(arkStatusSignature(status), arkStatusSignature({...status, eatSoon: null}));
});

test("the stalking cue: only a hunter out now, with the engine's two numbers, at a high chance", () => {
    // The live read's one hunter with a find share (2026-11-26): a Great Blue Heron, find 0.255, catch 0.635.
    const heron = {find: 0.255, catch: 0.635, dormant: false};
    const day = {steps: 40, firstAt: 0};
    assert.ok(Math.abs(arkStalkCue(heron, day, true)! - arkCatchChance(0.255, 0.635, 40)) < 1e-12);
    assert.ok(arkStalkCue(heron, day, true)! >= ARK_STALK_CUE);
    assert.equal(arkStalkCue(heron, day, false), null, "not out on its forays now");
    assert.equal(arkStalkCue({...heron, dormant: true}, day, true), null);
    assert.equal(arkStalkCue({find: null, catch: null, dormant: false}, day, true), null, "an older read");
    assert.equal(arkStalkCue({find: 0, catch: 1, dormant: false}, day, true), null, "never found prey it could take");
    assert.equal(arkStalkCue(heron, {steps: 1, firstAt: 0}, true), null, "a low chance: one step left");
    assert.equal(arkStalkCouldCue(heron), true);
    assert.equal(arkStalkCouldCue({find: 0, catch: 1, dormant: false}), false);
    assert.equal(arkStalkCouldCue({find: 0.5, catch: 0.2, dormant: false}), false, "its catch chance caps it below the cue");
});

test("the switch: on by default (public since 2026-11-26); off with ?eatsoon=0 or the global", () => {
    const g = globalThis as {__arkEatSoon?: boolean; location?: {search?: string}};
    assert.equal(arkEatSoonOn(), true);
    g.__arkEatSoon = false;
    assert.equal(arkEatSoonOn(), false);
    delete g.__arkEatSoon;
    const had = Object.getOwnPropertyDescriptor(globalThis, "location");
    Object.defineProperty(globalThis, "location", {value: {search: "?eatsoon=0"}, configurable: true});
    assert.equal(arkEatSoonOn(), false);
    Object.defineProperty(globalThis, "location", {value: {search: "?eatsoon=1"}, configurable: true});
    assert.equal(arkEatSoonOn(), true);
    if (had) Object.defineProperty(globalThis, "location", had);
    else delete g.location;
});

const atlas = decodeAtlas(JSON.parse(readFileSync(join(process.cwd(), "src/ark-scene/positions/atlas.json"), "utf8")));
const START = Date.parse("2026-11-08T21:45:21.431Z");

function hunter(activity: ArkAnimal["activity"]): ArkAnimal {
    const isl = atlas.islands.wild;
    const slug = Object.keys(isl.species).sort().find((s) => {
        const sh = sheetOf(atlas, s)!;
        return sh.move === "walk" && sh.len > 0.4 && sh.len < 2 && isl.species[s][1] !== 11;
    })!;
    const zone = atlas.zones[isl.species[slug][1]] as ArkAnimal["zone"];
    return {id: "00000000-0000-4000-8000-0000000000aa", species_profile_id: "00000000-0000-4000-8000-0000000000bb", name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot: 3, slot_rank: 0, activity};
}

test("the due window: its awake steps from its next hunt to a day ahead, by the engine's own awake rule; the first step when later", () => {
    const layer = new HuntingLayer();
    const animal = hunter("diurnal");
    const epochAt = (day: number) => (START + day * ARK_DAY_MS) / 1000;
    assert.equal(layer.window(animal, epochAt(80)), null, "no read: nothing");
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 80]]), odds: new Map([[animal.id, {find: 0.1, catch: 0.3, dormant: false}]]), meals: []}, atlas, START);
    assert.deepEqual(layer.odds(animal.id), {find: 0.1, catch: 0.3, dormant: false});
    assert.equal(layer.window({...animal, id: FOX}, epochAt(80)), null, "one the read does not name: not a hunter");
    // (An Ark day is 55 real minutes and the island's sun follows the real clock: a diurnal hunter is awake through the
    // window by day, asleep through it by night, and partly at dawn and dusk.) Due now: its awake steps over the next
    // 96, counted the slow way, at moments through a real day.
    const awakeSteps = (day: number) => {
        const k = Math.floor(day * STEPS_PER_ARK_DAY);
        let n = 0;
        for (let j = k + 1; j <= k + STEPS_PER_ARK_DAY; j++) if (awakeAt("diurnal", START, j / STEPS_PER_ARK_DAY, 0, null)) n++;
        return n;
    };
    const seen = new Set<string>();
    for (let day = 80.1; day < 80.1 + 26.1; day += 0.5) {
        const w = layer.window(animal, epochAt(day))!;
        assert.equal(w.steps, awakeSteps(day), `day ${day}`);
        seen.add(w.steps === 0 ? "none" : w.steps === STEPS_PER_ARK_DAY ? "all" : "part");
        if (w.steps > 0) assert.ok(w.firstAt !== null && w.firstAt > epochAt(day));
        else assert.ok(w.firstAt === null || w.firstAt > epochAt(day + 1), "asleep through the window: its first step after it");
    }
    assert.deepEqual(Array.from(seen).sort(), ["all", "none", "part"]);
    const now = epochAt(80.2);
    // Not due for two days: no step in the window; its first awake step after its next hunt.
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 82.5]]), meals: []}, atlas, START);
    const later = layer.window(animal, now)!;
    assert.equal(later.steps, 0);
    assert.ok(later.firstAt !== null && later.firstAt >= epochAt(82.5) - 1);
    assert.ok(awakeAt("diurnal", START, ((later.firstAt! * 1000 - START) / ARK_DAY_MS), 0, null));
    assert.equal(layer.odds(animal.id), null, "an older read: no numbers");
    // Not due for a long while: nothing within the look-ahead.
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 120]]), meals: []}, atlas, START);
    assert.deepEqual(layer.window(animal, now), {steps: 0, firstAt: null});
});

test("words in every Ark locale: all eight keys, each with the English placeholders", () => {
    const dir = join(process.cwd(), "src/data/locales");
    const files = ["en.json", "id.json", ...readdirSync(join(dir, "ark")).map((f) => join("ark", f))];
    assert.ok(files.length >= 45);
    const holes = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");
    for (const file of files) {
        const card = JSON.parse(readFileSync(join(dir, file), "utf8")).ark.card as Record<string, string>;
        for (const [key, english] of Object.entries(ARK_EAT_SOON_ENGLISH)) {
            assert.ok(typeof card[key] === "string" && card[key].trim(), `${file}: ${key}`);
            assert.equal(holes(card[key]), holes(english), `${file}: ${key} placeholders`);
        }
    }
    const en = JSON.parse(readFileSync(join(dir, "en.json"), "utf8")).ark.card;
    for (const [key, english] of Object.entries(ARK_EAT_SOON_ENGLISH)) assert.equal(en[key], english, `en.json ${key} matches the fallback`);
});

test("the stalking ring is off unless asked for", () => {
    const g = globalThis as {__arkStalkCue?: boolean};
    assert.equal(arkStalkCueOn(), false);
    g.__arkStalkCue = true;
    assert.equal(arkStalkCueOn(), true);
    delete g.__arkStalkCue;
});
