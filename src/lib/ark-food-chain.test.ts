import assert from "node:assert/strict";
import test from "node:test";
import type {ArkSnapshot} from "@/ark-scene/types";
import {
    arkFoodChainAboard,
    arkFoodChainCandidates,
    arkFoodChainEntry,
    arkFoodChainIndex,
    arkFoodChainKind,
    arkFoodChainLinkCount,
    arkHuntingRegion,
    isArkFoodChainSlug,
    type ArkFoodChainRow
} from "@/lib/ark-food-chain";

const ID = {
    fox: "00000000-0000-4000-8000-000000000001",
    rabbit: "00000000-0000-4000-8000-000000000002",
    vole: "00000000-0000-4000-8000-000000000003",
    hawk: "00000000-0000-4000-8000-000000000004",
    cat: "00000000-0000-4000-8000-000000000005",
    chicken: "00000000-0000-4000-8000-000000000006",
    fennec: "00000000-0000-4000-8000-000000000007",
    trout: "00000000-0000-4000-8000-000000000008",
    zooLion: "00000000-0000-4000-8000-000000000009"
};

type Spec = [key: keyof typeof ID, name: string, scientific: string, zone: string, extra?: Record<string, unknown>];
let serial = 0;
function animal([key, name, scientific, zone, extra]: Spec) {
    serial++;
    return {
        id: `10000000-0000-4000-8000-${String(serial).padStart(12, "0")}`,
        species_profile_id: ID[key],
        name,
        scientific_name: scientific,
        model_slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
        zone,
        island: "wild",
        area: null,
        arrived_at: "2026-11-01T00:00:00Z",
        brought_by: {label: "Voyager 1", named: false},
        mine: false,
        ...extra
    };
}

const specs: Spec[] = [
    ["fox", "Red Fox", "Vulpes vulpes", "woodland"],
    ["fox", "Red Fox", "Vulpes vulpes", "woodland"],
    ["fennec", "Fennec Fox", "Vulpes zerda", "woodland"],
    ["rabbit", "European Rabbit", "Oryctolagus cuniculus", "woodland"],
    ["rabbit", "European Rabbit", "Oryctolagus cuniculus", "woodland"],
    ["rabbit", "European Rabbit", "Oryctolagus cuniculus", "woodland"],
    ["vole", "Field Vole", "Microtus agrestis", "grassland"],
    ["hawk", "Red-tailed Hawk", "Buteo jamaicensis", "woodland"],
    ["cat", "Domestic Cat", "Felis catus", "farm_garden", {island: "town", area: "house"}],
    ["chicken", "Domestic Chicken", "Gallus gallus domesticus", "farm_garden", {island: "town", area: "farm"}],
    ["trout", "Brown Trout", "Salmo trutta", "river_lake"],
    ["zooLion", "Lion", "Panthera leo", "grassland", {island: "town", area: "zoo"}]
];
const snapshot = {counts: {animals: specs.length, species: 9, founders: 1}, animals: specs.map(animal), zones: [], as_of: "2026-11-12T00:00:00Z"} as unknown as ArkSnapshot;
const aboard = arkFoodChainAboard(snapshot);
const page = (slug: string) => (slug === "red-fox" || slug === "european-rabbit" ? `/animals/${slug}` : null);

function row(predator: keyof typeof ID, prey: keyof typeof ID, phrase: string, extra: Partial<ArkFoodChainRow> = {}, rule = 1): ArkFoodChainRow {
    return {id: `${rule}:${ID[prey]}`, predator: ID[predator], prey: ID[prey], basis: extra.basis ?? "species", group_label: extra.group_label ?? null, phrase, realm_ok: extra.realm_ok ?? true, size_ok: extra.size_ok ?? true};
}

test("a fox eats the rabbits in its region, by the field guide's words, biggest first", () => {
    const rows = [
        row("fox", "rabbit", "rabbits", {}, 3),
        row("fox", "vole", "small mammals", {basis: "group", group_label: "small mammals"}, 10001), // the vole is in another region
        row("fox", "chicken", "poultry", {}, 4), // kept on a farm: never prey
        row("fox", "cat", "cats", {}, 5), // a pet: never prey
        row("fox", "fennec", "foxes", {}, 6), // its own genus
        row("fox", "trout", "fish", {basis: "group", group_label: "fish", realm_ok: false}, 10002),
        row("hawk", "fox", "small mammals", {basis: "group", group_label: "small mammals", size_ok: false}, 10003), // above the size rule
        row("hawk", "rabbit", "rabbits", {}, 7)
    ];
    const fox = arkFoodChainEntry(rows, aboard, ID.fox, page)!;
    assert.equal(fox.species.name, "Red Fox");
    assert.equal(fox.species.aboard, 2);
    assert.equal(fox.species.page, "/animals/red-fox");
    assert.deepEqual(fox.eats.map((rule) => [rule.phrase, rule.prey.map((prey) => `${prey.name} ${prey.aboard}`)]), [["rabbits", ["European Rabbit 3"]]]);
    assert.deepEqual(fox.eatenBy, []);
    assert.equal(fox.kept, false);

    const rabbit = arkFoodChainEntry(rows, aboard, ID.rabbit, page)!;
    assert.deepEqual(rabbit.eatenBy.map((item) => [item.predator.name, item.phrase]), [["Red Fox", "rabbits"], ["Red-tailed Hawk", "rabbits"]]);
    assert.equal(arkFoodChainLinkCount(rabbit), 2);
});

test("kept animals are outside the wild food chain, and pets are never prey", () => {
    const cat = arkFoodChainEntry([row("cat", "rabbit", "rabbits")], aboard, ID.cat, page)!;
    assert.equal(cat.kept, true);
    assert.equal(cat.neverPrey, true);
    assert.deepEqual(cat.eats, []);
    const lion = arkFoodChainEntry([row("zooLion", "rabbit", "hares")], aboard, ID.zooLion, page)!;
    assert.equal(lion.kept, true);
    assert.deepEqual(lion.eats, []);
    assert.equal(arkHuntingRegion({area: "zoo", island: "town", zone: "grassland"} as never), null);
    assert.equal(arkHuntingRegion({area: null, island: "town", zone: "woodland"} as never), "town:forest");
    assert.equal(arkHuntingRegion({area: null, island: "wild", zone: "rainforest"} as never), "forest");
});

test("kinds by slug or id; strict slugs only", () => {
    assert.equal(arkFoodChainKind(aboard, "red-fox"), ID.fox);
    assert.equal(arkFoodChainKind(aboard, ID.rabbit.toUpperCase()), ID.rabbit);
    assert.equal(arkFoodChainKind(aboard, "dodo"), null);
    assert.equal(arkFoodChainEntry([], aboard, "00000000-0000-4000-8000-0000000000ff", page), null);
    for (const ok of ["red-fox", "a", "x1-y2"]) assert.equal(isArkFoodChainSlug(ok), true, ok);
    for (const bad of ["", "Red-Fox", "red--fox", "-fox", "fox-", "red fox", "../x", "a".repeat(81), "fox;drop", 42, null]) assert.equal(isArkFoodChainSlug(bad), false, String(bad));
});

test("the list puts wild animals first, kept ones last; candidates are hunters with prey in reach", () => {
    const index = arkFoodChainIndex(aboard, page).map((species) => species.name);
    assert.equal(index[0], "European Rabbit");
    assert.deepEqual(index.slice(-3).sort(), ["Domestic Cat", "Domestic Chicken", "Lion"]);
    const prey: Record<string, string[]> = {"red-fox": ["european-rabbit", "domestic-chicken"], "red-tailed-hawk": ["european-rabbit"], "domestic-cat": ["european-rabbit"], lion: ["european-rabbit"]};
    const picked = arkFoodChainCandidates(aboard, (slug) => prey[slug] ?? [], 4);
    assert.deepEqual(picked.sort(), [ID.fox, ID.hawk].sort());
});
