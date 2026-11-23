import assert from "node:assert/strict";
import test from "node:test";
import en from "@/data/locales/en.json";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ArkFoodChainEntry} from "@/lib/ark-food-chain";
import {ARK_LANGUAGES} from "@/lib/ark-languages";
import {ARK_RELATIONS_ENGLISH, ARK_RELATION_STYLE, arkBreedingPlace, arkFoodChainRows, arkHostRows, arkRelations, arkRelationShown} from "@/lib/ark-relations";

const ZEBRA = "00000000-0000-4000-8000-00000000000a";
const LION = "00000000-0000-4000-8000-00000000000b";
const GRASS_EATER_OF_LIONS = "00000000-0000-4000-8000-00000000000c";
const DOG = "00000000-0000-4000-8000-00000000000d";

function animal(id: string, kind: string, more: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id, species_profile_id: kind, name: kind === LION ? "Lion" : kind === ZEBRA ? "Plains Zebra" : kind === DOG ? "Domestic Dog" : "Other", scientific_name: null, model_slug: kind === LION ? "lion" : kind === ZEBRA ? "plains-zebra" : kind === DOG ? "domestic-dog" : "other", zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "x", named: false}, mine: false, island: "wild", ...more};
}

const species = (id: string, slug: string) => ({id, slug, name: slug, aboard: 1, page: null});
/** The zebra's entry: lions may eat it; it eats nothing aboard. */
const zebraEntry: ArkFoodChainEntry = {species: species(ZEBRA, "plains-zebra"), eats: [], eatenBy: [{predator: species(LION, "lion"), phrase: null, group: null}], kept: false, neverPrey: false};
/** The lion's entry: it eats zebras. */
const lionEntry: ArkFoodChainEntry = {species: species(LION, "lion"), eats: [{phrase: "zebras", group: null, prey: [species(ZEBRA, "plains-zebra")]}], eatenBy: [], kept: false, neverPrey: false};

const at = (map: Record<string, [number, number]>) => (id: string) => (map[id] ? {x: map[id][0], z: map[id][1]} : null);

test("relations: predators in its hunting region only, nearest first; never one on the other island or kept", () => {
    const zebra = animal("z1", ZEBRA);
    const animals = [
        zebra,
        animal("l-far", LION),
        animal("l-near", LION),
        animal("l-forest", LION, {zone: "woodland"}),
        animal("l-zoo", LION, {island: "town", area: "zoo", enclosure: "big_cats-1"}),
        animal("l-town", LION, {island: "town"}),
        animal("other", GRASS_EATER_OF_LIONS)
    ];
    const r = arkRelations({selected: zebra, animals, entry: zebraEntry, bodyOf: at({z1: [0, 0], "l-far": [300, 0], "l-near": [40, 30], "l-forest": [10, 0], "l-zoo": [5, 0], "l-town": [1, 1], other: [2, 2]}), lifeOf: () => null});
    assert.deepEqual(r.predator.all.map((t) => t.id), ["l-near", "l-far"]);
    assert.equal(r.predator.all[0].distance, 50);
    assert.deepEqual(r.prey.all, []);
    assert.equal(r.kept, false);
});

test("relations: a predator's prey in its region; a kept predator has none (fed by its keepers)", () => {
    const lion = animal("l1", LION);
    const animals = [lion, animal("z1", ZEBRA), animal("z2", ZEBRA, {zone: "desert"}), animal("z3", ZEBRA, {zone: "polar"}), animal("z4", ZEBRA, {island: "town", area: "farm"})];
    const bodies = at({l1: [0, 0], z1: [10, 0], z2: [5, 0], z3: [1, 0], z4: [1, 1]});
    const r = arkRelations({selected: lion, animals, entry: lionEntry, bodyOf: bodies, lifeOf: () => null});
    // (Desert and grassland are one region, D12's open land; the polar zebra is in another; the farm's is kept.)
    assert.deepEqual(r.prey.all.map((t) => t.id), ["z2", "z1"]);
    const kept = animal("l2", LION, {island: "town", area: "zoo", enclosure: "big_cats-1"});
    const k = arkRelations({selected: kept, animals: [...animals, kept], entry: lionEntry, bodyOf: at({l2: [0, 0], z1: [1, 0]}), lifeOf: () => null});
    assert.equal(k.kept, true);
    assert.deepEqual([k.prey.all.length, k.predator.all.length], [0, 0]);
});

test("relations: partners are grown animals of its kind, of the other sex where the kind keeps sexes, in its breeding place", () => {
    const she = animal("z-she", ZEBRA);
    const animals = [she, animal("z-he", ZEBRA), animal("z-she2", ZEBRA), animal("z-foal", ZEBRA), animal("z-zoo", ZEBRA, {island: "town", area: "zoo", enclosure: "savanna-1"}), animal("z-unsexed", ZEBRA)];
    const life: Record<string, {adult: boolean; sex: "male" | "female" | null}> = {"z-she": {adult: true, sex: "female"}, "z-he": {adult: true, sex: "male"}, "z-she2": {adult: true, sex: "female"}, "z-foal": {adult: false, sex: "male"}, "z-zoo": {adult: true, sex: "male"}, "z-unsexed": {adult: true, sex: null}};
    const bodies = at({"z-she": [0, 0], "z-he": [20, 0], "z-she2": [1, 0], "z-foal": [2, 0], "z-zoo": [3, 0], "z-unsexed": [9, 0]});
    const r = arkRelations({selected: she, animals, entry: zebraEntry, bodyOf: bodies, lifeOf: (id) => life[id] ?? null});
    assert.deepEqual(r.partner.all.map((t) => t.id), ["z-unsexed", "z-he"]);
    // A young one has none listed.
    const y = arkRelations({selected: animals[3], animals, entry: zebraEntry, bodyOf: bodies, lifeOf: (id) => life[id] ?? null});
    assert.equal(y.young, true);
    assert.deepEqual(y.partner.all, []);
});

test("relations: a pet has no predators or prey, and its mates are in the town's houses", () => {
    const dog = animal("d1", DOG, {island: "town", area: "house", zone: "farm_garden"});
    const animals = [dog, animal("d2", DOG, {island: "town", area: "house", zone: "farm_garden"}), animal("d3", DOG, {island: "town", area: "farm", zone: "farm_garden"}), animal("l1", LION)];
    const r = arkRelations({selected: dog, animals, entry: {...zebraEntry, species: species(DOG, "domestic-dog")}, bodyOf: at({d1: [0, 0], d2: [50, 0], d3: [1, 0], l1: [2, 0]}), lifeOf: () => null});
    assert.equal(r.kept, true);
    assert.deepEqual([r.predator.all.length, r.prey.all.length], [0, 0]);
    assert.deepEqual(r.partner.all.map((t) => t.id), ["d2"]);
});

test("breeding place: the engine's islands.ts placeOf (zoo enclosure, town area, the wild island; islands off: one place)", () => {
    assert.equal(arkBreedingPlace({area: "zoo", island: "town", enclosure: "aviaries-2"}, true), "zoo|aviaries-2");
    assert.equal(arkBreedingPlace({area: "house", island: "town"}, true), "town|house");
    assert.equal(arkBreedingPlace({area: null, island: "town"}, true), "town|wild");
    assert.equal(arkBreedingPlace({area: null, island: "wild"}, true), "wild");
    assert.equal(arkBreedingPlace({area: "zoo", island: "town", enclosure: "x"}, false), "*");
    // (Container breeding, once the read sends a container: its own tank or pen.)
    assert.equal(arkBreedingPlace({area: "house", island: "town", container: "house-3#0|tank"}, true), "town|house|house-3#0|tank");
});

test("relations: the nearest few are drawn, the rest counted", () => {
    const list = {all: Array.from({length: 7}, (_, i) => ({id: `a${i}`, kind: "k", name: "A", slug: "a", distance: i}))};
    const {shown, more} = arkRelationShown(list);
    assert.deepEqual([shown.length, more], [4, 3]);
});

test("relations: three looks that differ by more than colour (dash and icon), and words in every Ark language", async () => {
    // Every pair of kinds differs by its dash or its icon, never by colour alone.
    const looks = Object.values(ARK_RELATION_STYLE).map((s) => `${JSON.stringify(s.dash)}|${s.icon}`);
    assert.equal(new Set(looks).size, looks.length);
    assert.deepEqual(Object.keys((en as {ark: {relations: object}}).ark.relations).sort(), Object.keys(ARK_RELATIONS_ENGLISH).sort());
    for (const language of ARK_LANGUAGES) {
        if (language === "en") continue;
        const file = language === "id" ? await import("@/data/locales/id.json") : await import(`@/data/locales/ark/${language}.json`);
        const words = (file.default ?? file).ark?.relations as Record<string, string> | undefined;
        assert.ok(words, `${language}: ark.relations`);
        for (const key of Object.keys(ARK_RELATIONS_ENGLISH)) assert.ok(typeof words[key] === "string" && words[key].trim(), `${language}: relations.${key}`);
        assert.ok(words.more.includes("{n}"), `${language}: relations.more keeps {n}`);
    }
});

test("egg lines: only with the server's egg_predation on and its egg-eater list; nests by their sitting parent's region", () => {
    const BIRD = "00000000-0000-4000-8000-0000000000e1";
    const SNAKE = "00000000-0000-4000-8000-0000000000e2";
    const snake = animal("s1", SNAKE);
    const animals = [snake, animal("b1", BIRD), animal("b2", BIRD, {zone: "woodland"}), animal("b3", BIRD, {island: "town", area: "zoo", enclosure: "aviaries-1"})];
    const entry: ArkFoodChainEntry = {...lionEntry, species: species(SNAKE, "snake"), eats: [], eggs: {eats: [species(BIRD, "bird")], eatenBy: []}};
    const eggSites = [
        {key: "n1", speciesId: BIRD, x: 30, y: 0, z: 40, sitter: "b1"},
        {key: "n2", speciesId: BIRD, x: 1, y: 0, z: 0, sitter: "b2"},
        {key: "n3", speciesId: BIRD, x: 2, y: 0, z: 0, sitter: "b3"},
        {key: "n4", speciesId: BIRD, x: 3, y: 0, z: 0, sitter: null}
    ];
    const bodies = at({s1: [0, 0], b1: [30, 40], b2: [1, 0], b3: [2, 0]});
    const off = arkRelations({selected: snake, animals, entry, bodyOf: bodies, lifeOf: () => null, eggSites});
    assert.deepEqual(off.eggs.all, []);
    const on = arkRelations({selected: snake, animals, entry, bodyOf: bodies, lifeOf: () => null, eggSites, eggPredation: true});
    assert.deepEqual(on.eggs.all.map((t) => [t.id, t.distance, t.at?.x]), [["b1", 50, 30]]);
    // No egg-eater list from the server: nothing, even with the switch on.
    const none = arkRelations({selected: snake, animals, entry: {...entry, eggs: undefined}, bodyOf: bodies, lifeOf: () => null, eggSites, eggPredation: true});
    assert.deepEqual(none.eggs.all, []);
    // The parent on its clutch: the egg-eaters in its region.
    const bird = animals[1];
    const birdEntry: ArkFoodChainEntry = {...zebraEntry, species: species(BIRD, "bird"), eatenBy: [], eggs: {eats: [], eatenBy: [species(SNAKE, "snake")]}};
    const sits = arkRelations({selected: bird, animals, entry: birdEntry, bodyOf: bodies, lifeOf: () => null, eggSites, eggPredation: true});
    assert.deepEqual(sits.eggThreat.all.map((t) => t.id), ["s1"]);
    const notSitting = arkRelations({selected: bird, animals, entry: birdEntry, bodyOf: bodies, lifeOf: () => null, eggSites: [], eggPredation: true});
    assert.deepEqual(notSitting.eggThreat.all, []);
});

test("food chain: kinds it eats and that eat it, with how many are in its region; background food only when sent; none for a kept one", () => {
    const zebra = animal("z1", ZEBRA);
    const animals = [zebra, animal("l1", LION), animal("l2", LION), animal("l3", LION, {zone: "polar"})];
    const bodies = at({z1: [0, 0], l1: [1, 0], l2: [2, 0], l3: [3, 0]});
    const r = arkRelations({selected: zebra, animals, entry: zebraEntry, bodyOf: bodies, lifeOf: () => null});
    const chain = arkFoodChainRows(zebraEntry, r);
    assert.deepEqual(chain.eatenBy.map((k) => [k.name, k.here]), [["lion", 2]]);
    assert.deepEqual([chain.eats, chain.ambient], [[], []]);
    assert.deepEqual(arkFoodChainRows({...zebraEntry, ambient: ["grasses", " "]}, r).ambient, ["grasses"]);
    const lion = animals[1];
    const lr = arkRelations({selected: lion, animals: [...animals, animal("z2", ZEBRA, {zone: "polar"})], entry: lionEntry, bodyOf: at({l1: [0, 0], z1: [1, 0], z2: [1, 1]}), lifeOf: () => null});
    assert.deepEqual(arkFoodChainRows(lionEntry, lr).eats.map((k) => [k.name, k.here]), [["plains-zebra", 1]]);
    const kept = animal("l9", LION, {island: "town", area: "zoo", enclosure: "big_cats-1"});
    const kr = arkRelations({selected: kept, animals: [kept, zebra], entry: lionEntry, bodyOf: at({l9: [0, 0], z1: [1, 0]}), lifeOf: () => null});
    assert.deepEqual(arkFoodChainRows(lionEntry, kr), {eats: [], ambient: [], eatenBy: []});
});

test("relations words: the English fallback is en.json's", () => {
    assert.deepEqual((en as unknown as {ark: {relations: unknown}}).ark.relations, ARK_RELATIONS_ENGLISH);
});

test("hosts (decision 482): a host-fed kind's host kinds aboard, counted in its region; none for a kept one or a kind without hosts", () => {
    // The dog stands in for a parasite whose hosts are zebras and lions.
    const tick = animal("t1", DOG);
    const entry: ArkFoodChainEntry = {...zebraEntry, species: species(DOG, "domestic-dog"), eatenBy: [], hosts: {phrase: "Feeds only on blood.", aboard: [species(LION, "lion"), species(ZEBRA, "plains-zebra")], more: 7}};
    const animals = [tick, animal("z1", ZEBRA), animal("z2", ZEBRA), animal("z3", ZEBRA, {zone: "polar"}), animal("l1", LION, {island: "town", area: "zoo", enclosure: "big_cats-1"})];
    const rows = arkHostRows(entry, tick, animals)!;
    assert.deepEqual(rows.kinds.map((k) => [k.slug, k.here]), [["plains-zebra", 2], ["lion", 0]]);
    assert.equal(rows.more, 7);
    assert.equal(arkHostRows(zebraEntry, tick, animals), null);
    assert.equal(arkHostRows(entry, animal("t2", DOG, {island: "town", area: "house"}), animals), null);
    assert.deepEqual(arkHostRows({...entry, hosts: {phrase: null, aboard: [], more: 0}}, tick, animals)?.kinds, []);
});
