/**
 * Every species the Ark shows has a row in each of the scene's per-species tables (SPECIES-ANIM-B2, 2026-11-24: 36
 * species aboard had none, so the cat breeds were not "around the house" and the swallowtail caterpillar lived with the
 * snakes). "Shown" is the stored roster's own word: `data/ark/behaviour-profiles.json` profiles with no `excluded`.
 *
 * Not here: the map's body classes (unlisted means "by its movement", by design), and (generated elsewhere, a separate step when a species is added): the positions atlas and the town's reach
 * file (byte-for-byte contracts with the server, `positions/PIN.json`) and the grounding bases (measured from the
 * model files, `scripts/ark-grounding-bases.mjs`).
 */
import assert from "node:assert/strict";
import test from "node:test";
import profiles from "../../data/ark/behaviour-profiles.json";
import behaviours from "@/ark-scene/behaviours.json";
import recipes from "@/ark-scene/recipes.json";
import sleep from "@/ark-scene/sleep.json";
import intelligence from "@/ark-scene/intelligence.json";
import stats from "@/ark-scene/species-stats.json";
import look from "@/ark-scene/animal-look.json";
import shapes from "@/ark-scene/collide/body-shapes.json";
import mapSpecies from "@/ark-scene/map/species.json";
import mapBody from "@/ark-scene/map/body.json";
import microhabitats from "@/ark-scene/microhabitats.json";

const shown = (profiles as {profiles: Array<{slug: string; excluded: string | null}>}).profiles.filter((p) => !p.excluded).map((p) => p.slug);

/**
 * Shown species the map has no row for yet, from before the 36 (the polar zone's arrivals and the head louse,
 * `scripts/ark-map.mts` reads the B1 inventory, which they postdate): listed so a new gap still fails.
 */
const MAP_GAPS = new Set(["adelie-penguin", "antarctic-petrel", "blood-parrot-cichlid", "crocodile-icefish", "emperor-penguin", "flowerhorn-cichlid", "gentoo-penguin", "head-louse", "king-penguin", "leopard-seal", "macaroni-penguin", "snow-petrel", "snowy-sheathbill", "southern-rockhopper-penguin", "weddell-seal"]);

const TABLES: Array<[string, (slug: string) => boolean, Set<string>?]> = [
    ["behaviours.json", (s) => s in (behaviours as {species: Record<string, unknown>}).species],
    ["recipes.json", (s) => s in (recipes as {species: Record<string, unknown>}).species],
    ["sleep.json", (s) => s in (sleep as {species: Record<string, unknown>}).species],
    ["intelligence.json", (s) => s in (intelligence as {species: Record<string, unknown>}).species],
    ["species-stats.json", (s) => s in (stats as {species: Record<string, unknown>}).species],
    ["animal-look.json", (s) => s in (look as {species: Record<string, unknown>}).species],
    ["collide/body-shapes.json", (s) => s in (shapes as {shapes: Record<string, unknown>}).shapes],
    ["map/species.json", (s) => s in (mapSpecies as {species: Record<string, unknown>}).species, MAP_GAPS]
];

test("every shown species has a row in each per-species table", () => {
    assert.ok(shown.length > 2500, `${shown.length} shown species`);
    for (const [name, has, gaps] of TABLES) {
        const missing = shown.filter((slug) => !has(slug) && !gaps?.has(slug));
        assert.deepEqual(missing, [], `${name}: no row for ${missing.length}`);
    }
});

test("the gap lists hold only species still missing (fill one, take it off)", () => {
    for (const [name, has, gaps] of TABLES) for (const slug of Array.from(gaps ?? [])) assert.ok(!has(slug), `${name}: ${slug} has a row now`);
});

test("the 36 added 2026-11-24: breeds are their kind's, the caterpillar is a caterpillar", () => {
    const micro = (behaviours as {species: Record<string, string>}).species;
    // A cat breed is around the house like the domestic cat; the caterpillar eats leaves and is an invertebrate.
    assert.equal(micro["eastern-tiger-swallowtail-caterpillar"].split("|")[6], "browser");
    const body = mapBody as unknown as Record<string, string[]>;
    assert.ok(body.i.includes("eastern-tiger-swallowtail-caterpillar"));
    assert.ok(body.m.includes("abyssinian-cat") && body.b.includes("pied-cockatiel") && body.r.includes("albino-ball-python"));
    const map = (mapSpecies as {species: Record<string, unknown[]>}).species;
    assert.ok(String(map["abyssinian-cat"][7]).includes("b"), "a breed, as its kind");
    const spots = (microhabitats as unknown as {species: Record<string, unknown[]>}).species;
    for (const cat of ["abyssinian-cat", "siberian-cat", "domestic-cat-calico"]) assert.equal(spots[cat]?.[0], "house", cat);
});
