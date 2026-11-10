import assert from "node:assert/strict";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkFocusSlug, arkFoodLinkOthers, arkFoodLinks, arkOgImagePath, arkShareUrl, arkSpeciesCounts, arkSpeciesShare, isArkSlug} from "@/lib/ark-seo";

function animal(id: string, species: string, slug: string, zone: ArkAnimal["zone"]): ArkAnimal {
    return {id, species_profile_id: species, name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false};
}

const SNAPSHOT: ArkSnapshot = {
    voyage: {slug: "first", name: "The first Ark", started_at: null},
    counts: {animals: 5, species: 3, founders: 3},
    zones: [],
    animals: [
        animal("a1", "3aa1fb77-3f0b-4a0f-9c86-790111a40c08", "komodo-dragon", "grassland"),
        animal("a2", "3aa1fb77-3f0b-4a0f-9c86-790111a40c08", "komodo-dragon", "grassland"),
        animal("a3", "s-hawk", "red-tailed-hawk", "woodland"),
        animal("a4", "s-seal", "harbor-seal", "seashore"),
        animal("a5", "s-seal", "harbor-seal", "seashore")
    ],
    as_of: null
};

test("species counts: most numerous first, then by name", () => {
    assert.deepEqual(arkSpeciesCounts(SNAPSHOT).map((row) => [row.slug, row.count, row.status]), [
        ["harbor-seal", 2, "pair"],
        ["komodo-dragon", 2, "pair"],
        ["red-tailed-hawk", 1, "single"]
    ]);
    assert.deepEqual(arkSpeciesCounts(null), []);
});

test("focus resolves a profile id or a slug to the model slug, and refuses anything else", () => {
    assert.equal(arkFocusSlug(SNAPSHOT, "3AA1FB77-3f0b-4a0f-9c86-790111a40c08"), "komodo-dragon");
    assert.equal(arkFocusSlug(SNAPSHOT, "Red-Tailed-Hawk"), "red-tailed-hawk");
    // Not aboard but well formed: the card says it is not aboard yet.
    assert.equal(arkFocusSlug(SNAPSHOT, "gray-wolf"), "gray-wolf");
    assert.equal(arkFocusSlug(null, "gray-wolf"), "gray-wolf");
    assert.equal(arkFocusSlug(SNAPSHOT, "<script>"), null);
    assert.equal(arkFocusSlug(SNAPSHOT, "a b"), null);
    assert.equal(arkFocusSlug(SNAPSHOT, ""), null);
    assert.equal(arkFocusSlug(SNAPSHOT, null), null);
    assert.equal(isArkSlug("x".repeat(121)), false);
});

test("a species' share: its count and pair status, or none aboard", () => {
    assert.deepEqual(arkSpeciesShare(SNAPSHOT, "komodo-dragon"), {name: "Komodo Dragon", count: 2, status: "pair"});
    assert.deepEqual(arkSpeciesShare(SNAPSHOT, "gray-wolf"), {name: null, count: 0, status: null});
});

test("share card paths carry the count so scrapers refetch when it changes", () => {
    assert.equal(arkOgImagePath(null, 5), "/api/og/ark.png?v=5");
    assert.equal(arkOgImagePath("komodo-dragon", 2), "/api/og/ark/komodo-dragon.png?v=2");
    assert.equal(arkOgImagePath(null, -3.7), "/api/og/ark.png?v=0");
});

test("share links say they were shared, and only ever carry a clean slug", () => {
    assert.equal(arkShareUrl("https://animaldex.app", "/ark", null), "https://animaldex.app/ark?from=share");
    assert.equal(arkShareUrl("https://animaldex.app", "/id/ark", "komodo-dragon"), "https://animaldex.app/id/ark?focus=komodo-dragon&from=share");
    assert.equal(arkShareUrl("https://animaldex.app", "/ark", "../evil"), "https://animaldex.app/ark?from=share");
});

const KOMODO = "3aa1fb77-3f0b-4a0f-9c86-790111a40c08";
const HAWK = "7e2ffcc3-79dc-4677-87be-b2481eec26c2";
const DEER = "11111111-1111-4111-8111-111111111111";
const CROC = "22222222-2222-4222-8222-222222222222";
const ROWS = [
    // The contract's own example: the Komodo's diet names "birds", which takes in the hawk.
    {predator: KOMODO, prey: HAWK, basis: "group", group_label: "birds", realm_ok: true},
    {predator: KOMODO, prey: DEER, basis: "species", group_label: null, realm_ok: true},
    {predator: CROC, prey: KOMODO, basis: "species", group_label: null, realm_ok: true},
    // Refused by the realm check: never said.
    {predator: KOMODO, prey: CROC, basis: "species", group_label: null, realm_ok: false}
];
const NAMES = new Map([
    [HAWK, {name: "Red-tailed Hawk", slug: "red-tailed-hawk"}],
    [DEER, {name: "Rusa Deer", slug: "rusa-deer"}],
    [CROC, {name: "Saltwater Crocodile", slug: "saltwater-crocodile"}],
    [KOMODO, {name: "Komodo Dragon", slug: "komodo-dragon"}]
]);

test("diet links: what it eats by group is said as the group, by species as the species, and who eats it by name", () => {
    assert.deepEqual(arkFoodLinkOthers(ROWS, KOMODO).sort(), [DEER, CROC].sort());
    assert.deepEqual(arkFoodLinks(ROWS, KOMODO, NAMES), [
        {direction: "eats", name: "birds", slug: null},
        {direction: "eats", name: "Rusa Deer", slug: "rusa-deer"},
        {direction: "eatenBy", name: "Saltwater Crocodile", slug: "saltwater-crocodile"}
    ]);
    // The hawk's side of the group link: eaten by the Komodo, named.
    assert.deepEqual(arkFoodLinkOthers(ROWS, HAWK), [KOMODO]);
    assert.deepEqual(arkFoodLinks(ROWS, HAWK, NAMES), [{direction: "eatenBy", name: "Komodo Dragon", slug: "komodo-dragon"}]);
    // No stored links (or the table not live): nothing, never a made-up diet.
    assert.deepEqual(arkFoodLinks([], KOMODO, NAMES), []);
    // A name the catalog cannot give is left out rather than guessed.
    assert.deepEqual(arkFoodLinks(ROWS, KOMODO, new Map()), [{direction: "eats", name: "birds", slug: null}]);
});
