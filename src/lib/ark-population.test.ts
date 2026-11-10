import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkFocusAnimals, arkPairStatus, arkPickAnimal, arkPopulation, arkSpeciesAboard, pluralAnimalName} from "@/lib/ark-population";
import {decodeArkStory, fixtureArkStory, isMissingArkFunction} from "@/lib/ark-story";

function animal(id: string, species: string, slug: string, zone: ArkAnimal["zone"], arrived: string, mine = false): ArkAnimal {
    return {id, species_profile_id: species, name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), scientific_name: null, model_slug: slug, zone, arrived_at: arrived, brought_by: {label: "Voyager 1", named: false}, mine};
}

const SNAPSHOT: ArkSnapshot = {
    voyage: {slug: "first", name: "The first Ark", started_at: null},
    counts: {animals: 7, species: 3, founders: 3},
    zones: [],
    animals: [
        animal("a1", "s-komodo", "komodo-dragon", "grassland", "2026-11-01T00:00:00Z"),
        animal("a2", "s-komodo", "komodo-dragon", "grassland", "2026-11-03T00:00:00Z", true),
        animal("a3", "s-hawk", "red-tailed-hawk", "woodland", "2026-11-02T00:00:00Z"),
        animal("a4", "s-seal", "harbor-seal", "seashore", "2026-11-04T00:00:00Z"),
        animal("a5", "s-seal", "harbor-seal", "seashore", "2026-11-05T00:00:00Z"),
        animal("a6", "s-seal", "harbor-seal", "seashore", "2026-11-06T00:00:00Z"),
        animal("a7", "s-seal", "harbor-seal", "seashore", "2026-11-07T00:00:00Z")
    ],
    as_of: null
};

test("pair status against the ideal of two", () => {
    assert.equal(arkPairStatus(1), "single");
    assert.equal(arkPairStatus(2), "pair");
    assert.equal(arkPairStatus(3), "more");
    assert.equal(arkPairStatus(4), "more");
    assert.equal(arkPairStatus(5), "crowded");
});

test("the population groups species by region, in the world's order, with counts", () => {
    const population = arkPopulation(SNAPSHOT);
    assert.deepEqual(population.regions.map((group) => group.region), ["coast", "forest", "open_land"]);
    assert.deepEqual(population.regions.map((group) => group.animals), [4, 1, 2]);
    const komodo = population.regions[2].species[0];
    assert.equal(komodo.count, 2);
    assert.equal(komodo.mine, 1);
    assert.equal(komodo.status, "pair");
    assert.deepEqual(komodo.animals.map((a) => a.id), ["a2", "a1"], "newest first");
    assert.equal(population.species, 3);
    assert.equal(population.paired, 2);
    assert.equal(population.single, 1);
    assert.deepEqual(arkPopulation(null).regions, []);
});

test("a tap on a species goes to the reader's own, then walks through the rest", () => {
    const komodo = arkPopulation(SNAPSHOT).regions[2].species[0].animals;
    assert.equal(arkPickAnimal(komodo, null)?.id, "a2");
    assert.equal(arkPickAnimal(komodo, "a2")?.id, "a1");
    assert.equal(arkPickAnimal(komodo, "a1")?.id, "a2");
    assert.equal(arkPickAnimal(komodo, "a3")?.id, "a2");
    assert.equal(arkPickAnimal([], null), null);
});

test("?focus= takes a species_profile_id or a slug", () => {
    assert.deepEqual(arkFocusAnimals(SNAPSHOT, "s-komodo").map((a) => a.id), ["a2", "a1"]);
    assert.deepEqual(arkFocusAnimals(SNAPSHOT, "Harbor-Seal").length, 4);
    assert.deepEqual(arkFocusAnimals(SNAPSHOT, "nothing"), []);
    assert.deepEqual(arkFocusAnimals(SNAPSHOT, ""), []);
});

test("a capture's species on the Ark, by its id or its slug", () => {
    const summary = (found: ReturnType<typeof arkSpeciesAboard>) => ({count: found.count, mine: found.mine, status: found.status, ids: found.animals.map((a) => a.id)});
    assert.deepEqual(summary(arkSpeciesAboard(SNAPSHOT, {speciesProfileId: "s-komodo"})), {count: 2, mine: 1, status: "pair", ids: ["a2", "a1"]});
    assert.deepEqual(summary(arkSpeciesAboard(SNAPSHOT, {speciesProfileId: "a-fold", slug: "red-tailed-hawk"})), {count: 1, mine: 0, status: "single", ids: ["a3"]});
    assert.deepEqual(summary(arkSpeciesAboard(SNAPSHOT, {speciesProfileId: "s-lion", slug: "lion"})), {count: 0, mine: 0, status: null, ids: []});
    assert.deepEqual(summary(arkSpeciesAboard(null, {speciesProfileId: "s-komodo"})), {count: 0, mine: 0, status: null, ids: []});
});

test("English animal plurals", () => {
    assert.equal(pluralAnimalName("Komodo Dragon"), "Komodo Dragons");
    assert.equal(pluralAnimalName("Red Fox"), "Red Foxes");
    assert.equal(pluralAnimalName("Grizzly"), "Grizzlies");
    assert.equal(pluralAnimalName("Bighorn Sheep"), "Bighorn Sheep");
    assert.equal(pluralAnimalName("Clownfish"), "Clownfish");
    assert.equal(pluralAnimalName("Snow Goose"), "Snow Geese");
    assert.equal(pluralAnimalName("Mongoose"), "Mongooses");
    assert.equal(pluralAnimalName("House Mouse"), "House Mice");
    assert.equal(pluralAnimalName("Maned Wolf"), "Maned Wolves");
    assert.equal(pluralAnimalName("Monkey"), "Monkeys");
});

test("the story: exactly the public-debate shape, otherwise nothing", () => {
    const debate = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
    assert.deepEqual(decodeArkStory({kind: "public_debate", problem: "  I  can't sleep ", way: {animal: "Koala", power: "Rest Is Work"}, debate_id: debate}), {
        kind: "public_debate", problem: "I can't sleep", way: {animal: "Koala", power: "Rest Is Work"}, debate_id: debate
    });
    assert.equal(decodeArkStory({kind: "public_debate", problem: "x", way: {animal: "Koala", power: "Rest"}, debate_id: "not-a-uuid"})?.debate_id, null);
    assert.equal(decodeArkStory(null), null);
    assert.equal(decodeArkStory({kind: "private_step", problem: "x", way: {animal: "a", power: "b"}}), null);
    assert.equal(decodeArkStory({kind: "public_debate", problem: "", way: {animal: "a", power: "b"}}), null);
    assert.equal(decodeArkStory({kind: "public_debate", problem: "x", way: null}), null);
    assert.equal(decodeArkStory([]), null);
});

test("a missing function is recognised, other errors are not", () => {
    assert.equal(isMissingArkFunction({code: "PGRST202", message: "Could not find the function public.voyage_animal_story_v1(p_animal_id)"}), true);
    assert.equal(isMissingArkFunction({code: "42883", message: "function does not exist"}), true);
    assert.equal(isMissingArkFunction({code: "57014", message: "canceling statement"}), false);
    assert.equal(isMissingArkFunction(null), false);
});

test("the dev fixture gives a story to two animals only", () => {
    const told = SNAPSHOT.animals.filter((a) => fixtureArkStory(a, SNAPSHOT.animals));
    assert.deepEqual(told.map((a) => a.id), ["a2", "a4"]);
    assert.ok(fixtureArkStory(SNAPSHOT.animals[1], SNAPSHOT.animals)?.debate_id);
    assert.equal(fixtureArkStory(SNAPSHOT.animals[3], SNAPSHOT.animals)?.debate_id, null);
});
