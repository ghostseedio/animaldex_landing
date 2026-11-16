import assert from "node:assert/strict";
import test from "node:test";
import {homeFoodChainCandidates, homeFoodChains} from "./home-food-chains";
import type {ArkFoodChainEntry, ArkFoodChainSpecies} from "./ark-food-chain";

const sp = (id: string, aboard = 1): ArkFoodChainSpecies => ({id, slug: id, name: id, aboard, page: null});
const entry = (species: ArkFoodChainSpecies, prey: ArkFoodChainSpecies[], predators: ArkFoodChainSpecies[]): ArkFoodChainEntry => ({species, eats: [{phrase: "x", group: null, prey}], eatenBy: predators.map((predator) => ({predator, phrase: null, group: null})), kept: false, neverPrey: false});

test("chains read eater first, from real links, no animal twice, three-long before two-long", () => {
    const hawk = sp("hawk", 4), squirrel = sp("squirrel", 9), mouse = sp("mouse", 2), python = sp("python", 4), fox = sp("fox", 3);
    const heron = sp("heron"), frog = sp("frog", 5), tiger = sp("tiger", 2), deer = sp("deer", 6);
    const chains = homeFoodChains([entry(heron, [frog], []), entry(hawk, [mouse, squirrel], [fox, python]), entry(tiger, [deer, squirrel], [])], 3);
    assert.deepEqual(chains.map((c) => c.map((s) => s.id)), [["python", "hawk", "squirrel"], ["heron", "frog"], ["tiger", "deer"]]);
    assert.equal(homeFoodChains([entry(hawk, [], [fox])]).length, 0, "nothing to eat aboard: no chain");
    assert.equal(homeFoodChains([entry(hawk, [squirrel], []), entry(squirrel, [mouse], [hawk])], 3).length, 1, "an animal already shown starts no chain of its own");
});

test("only animals the picture can draw: one without icon art is passed over, and never starts a chain", () => {
    const hawk = sp("hawk", 4), squirrel = sp("squirrel", 9), mouse = sp("mouse", 2), python = sp("python", 4);
    const drawn = new Set(["hawk", "mouse", "python"]);
    const chains = homeFoodChains([entry(squirrel, [mouse], [hawk]), entry(hawk, [squirrel, mouse], [python])], 3, (s) => drawn.has(s.slug));
    assert.deepEqual(chains.map((c) => c.map((s) => s.id)), [["python", "hawk", "mouse"]]);
});

test("candidates: each entry's species and its most numerous few either side, once each", () => {
    const hawk = sp("hawk"), a = sp("a", 5), b = sp("b", 3), c = sp("c", 1), fox = sp("fox");
    assert.deepEqual(homeFoodChainCandidates([entry(hawk, [c, a, b], [fox])], 2).sort(), ["a", "b", "fox", "hawk"]);
});
