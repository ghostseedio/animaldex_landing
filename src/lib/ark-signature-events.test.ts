import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import test from "node:test";
import {cacheEventItems, cacheEventText, signatureCues, signatureEventItems, signatureEventText, SIGNATURE_CUE_SECONDS} from "@/ark-scene/live/signature-events";
import {ARK_ACTIVITY_ENGLISH, type ArkActivityWords} from "@/lib/ark-animal-status";
import {type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {forgetRecipes, setSignatureCues} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, scheduleWorld, SLOT_SECONDS, tripAt} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";

/** AnimalDex SIG-EVENTS (owner 2026-11-23): saved signature moves in the live log, for everyone, in every language. */

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const en = JSON.parse(readFileSync("src/data/locales/en.json", "utf8"));
const words = {live: {...ARK_LIVE_ENGLISH, ...en.ark.live}, replay: en.ark.replay, activity: {...ARK_ACTIVITY_ENGLISH, ...(en.ark.activity ?? {}), log: {...ARK_ACTIVITY_ENGLISH.log, ...(en.ark.activity?.log ?? {})}}} as unknown as ArkLiveText;
const at = "2026-11-23T10:00:00.000Z";
const kestrel = {id: "k1", name: "American Kestrel", species_profile_id: "sp-kestrel", model_slug: "american-kestrel", zone: "grassland"};
const fox = {id: "f1", name: "Red Fox", species_profile_id: "sp-fox", model_slug: "no-such-slug", zone: "forest"};
const rows = [
    {id: 1, kind: "signature", at, animal: kestrel, sig: {move: "food_cache", recipe: "cache_food"}},
    {id: 2, kind: "signature", at, animal: fox, sig: {move: "display", recipe: "call_bout"}},
    {id: 3, kind: "signature", at, animal: fox, sig: {move: "dance", recipe: "call_bout"}},
    {id: 4, kind: "signature", at, animal: fox, sig: {}},
    {id: 5, kind: "fed", at, animal: fox, source: "cache"},
    {id: 6, kind: "signature", at: "2026-11-23T08:00:00.000Z", animal: fox, sig: {move: "courtship", recipe: "swarm"}}
];

test("a saved move is one line, said once; unknown moves, missing recipes and other kinds are not", () => {
    const from = Date.parse("2026-11-23T09:00:00.000Z");
    const items = signatureEventItems({events: rows}, from, () => false);
    assert.deepEqual(items.map((i) => i.id), ["event:1", "event:2"]);
    assert.equal(items[0].say, "signature");
    assert.equal(items[0].focus.animalId, "k1");
    assert.equal(signatureEventItems({events: rows}, from, (id) => id === "event:1").length, 1);
});

test("English: the species' own sentence where it has one, else the generic line of the recipe's activity", () => {
    const [kes, fx] = signatureEventItems(rows, 0, () => false);
    assert.equal(signatureEventText(kes, words, "en"), "An American Kestrel is hiding spare prey in a grass clump to eat later");
    assert.equal(signatureEventText(fx, words, "en"), "A Red Fox is calling");
    // A recipe with no activity of its own says its move's (swarm, a courtship).
    const swarm = signatureEventItems(rows, 0, () => false).find((i) => i.id === "event:6")!;
    assert.equal(signatureEventText(swarm, words, "en"), "A Red Fox is courting");
    assert.equal(signatureEventText({animal: "x"}, words, "en"), null);
    // A pair's own sentence ("{animals} ...") is said of the kind in the plural.
    assert.equal(signatureEventText({animal: "Red-crowned Crane", say: "signature", line: "{animals} are dancing as a pair"}, words, "en"), "Red-crowned Cranes are dancing as a pair");
});

test("every one of the 45 languages says a saved move in its own words (the generic line), never English", () => {
    const files = readdirSync("src/data/locales/ark").filter((f) => f.endsWith(".json"));
    assert.equal(files.length + 2, 45);
    const [kes] = signatureEventItems(rows, 0, () => false);
    for (const f of files) {
        const ark = JSON.parse(readFileSync(`src/data/locales/ark/${f}`, "utf8")).ark;
        const activity = {...ARK_ACTIVITY_ENGLISH, ...ark.activity, log: {...ARK_ACTIVITY_ENGLISH.log, ...ark.activity.log}} as ArkActivityWords;
        const text = signatureEventText(kes, {...words, activity}, f.replace(".json", ""))!;
        assert.ok(text && !text.includes("{"), f);
        assert.ok(!text.includes("hiding spare prey"), `${f}: the English sentence`);
        assert.ok(text.includes(String(ark.activity.food)), `${f}: ${text}`);
    }
});

test("the cue: the animal and its recipe, from the move's moment for the cue's window", () => {
    const cues = signatureCues(rows, 0);
    assert.deepEqual(cues[0], {animalId: "k1", recipe: "cache_food", from: Date.parse(at) / 1000, to: Date.parse(at) / 1000 + SIGNATURE_CUE_SECONDS});
    assert.equal(cues.length, 3);
});

test("the scene: a cued animal plays the saved move's recipe far more often in the cue's window; no cue, its own choice", () => {
    const k = {animal: {id: "kestrel-cue", zone: "grassland" as const, home: {x: 10, y: Math.max(world.sampler.heightAt(10, -20), 0), z: -20}, length: 0.3, sea: false}, profile: behaviourProfile("american-kestrel")};
    const day = Date.parse("2026-06-10T06:00:00Z") / 1000;
    const count = () => {
        forgetRecipes();
        forgetSchedules();
        let n = 0;
        for (let t = day; t < day + 10 * 3600; t += SLOT_SECONDS) if (tripAt(world, k.profile, k.animal, t, hoursAt, "diurnal").recipe === "cache_food") n++;
        return n;
    };
    const plain = count();
    setSignatureCues((id, start) => (id === "kestrel-cue" && start >= day && start < day + 10 * 3600 ? "cache_food" : null));
    const cued = count();
    setSignatureCues((id) => (id === "someone-else" ? "cache_food" : null));
    const other = count();
    setSignatureCues(null);
    assert.ok(cued > plain * 2 && cued > 10, `cued ${cued}, plain ${plain}`);
    assert.equal(other, plain);
    assert.equal(count(), plain);
});

test("caches: a re-hiding and a theft are said in their own words, in all 45 languages; the re-hider plays its recipe again", () => {
    const jay = {id: "j1", name: "Eurasian Jay", species_profile_id: "sp-jay", model_slug: "eurasian-jay", zone: "forest"};
    const badger = {id: "b1", name: "European Badger", species_profile_id: "sp-badger", zone: "forest"};
    const cacheRows = [
        {id: 40, kind: "cache_rehidden", at, animal: jay, cache: {food: "seeds", recipe: "cache_food"}},
        {id: 41, kind: "cache_stolen", at, animal: badger, other: fox, cache: {food: "meat", recipe: "cache_food"}},
        {id: 42, kind: "cache_stolen", at, animal: badger, other: null, cache: {food: "meat"}}
    ];
    const items = cacheEventItems(cacheRows, 0, () => false);
    assert.deepEqual(items.map((i) => i.id), ["event:40", "event:41"]);
    assert.equal(cacheEventText(items[0], words), "A Eurasian Jay is re-hiding its food after being watched");
    assert.equal(cacheEventText(items[1], words), "A European Badger dug up food that a Red Fox had hidden");
    assert.equal(cacheEventText({animal: "x", other: null}, words), null);
    for (const f of readdirSync("src/data/locales/ark").filter((x) => x.endsWith(".json")).map((x) => `ark/${x}`).concat(["en.json", "id.json"])) {
        const live = JSON.parse(readFileSync(`src/data/locales/${f}`, "utf8")).ark.live;
        for (const k of ["cacheRehidden", "cacheStolen"]) assert.ok(typeof live[k] === "string" && live[k].length > 10, `${f} ${k}`);
        assert.ok(live.cacheRehidden.includes("{aAnimal}"), f);
        assert.ok(live.cacheStolen.includes("{aThief}") && live.cacheStolen.includes("{aOwner}"), f);
        if (f !== "en.json") assert.notEqual(live.cacheStolen, ARK_LIVE_ENGLISH.cacheStolen, f);
    }
    assert.deepEqual(signatureCues(cacheRows, 0).map((c) => [c.animalId, c.recipe]), [["j1", "cache_food"]]);
});
