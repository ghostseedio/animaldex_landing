import assert from "node:assert/strict";
import test from "node:test";
import {ARK_PLACEHOLDER_ICON, arkIconUrl, arkPlaceholderSlug, noteArkIconless} from "@/ark-scene/placeholder-icon";
import {buildArtworkIndex} from "@/data/species-artwork-resolution";
import {arkIconAlias, arkIconKeys, arkIconlessSlugs, arkNoIcon, type ArkIconProfile} from "@/lib/ark-icons";
import {arkIconAudit} from "@/lib/ark-icon-audit";

test("ark icons: the species with no <slug>.webp of their own in the bucket's listing, each once, sorted", () => {
    const artwork = buildArtworkIndex(["red-fox.webp", "bengal-tiger.webp", "lion-vs-tiger.webp", "pig.webp"]).bySlug;
    const animals = [
        {model_slug: "red-fox"},
        {model_slug: "tiger"},
        {model_slug: "domestic-pig"},
        {model_slug: "tiger"},
        {model_slug: "axolotl"},
        {model_slug: arkPlaceholderSlug("sp-1", "Mystery")}
    ];
    // A relative's file (bengal-tiger) or an alias's (pig) is not the species' own: the Ark asks for `<slug>.webp` only.
    // A placeholder asks for nothing, so it is never listed.
    assert.deepEqual(arkIconlessSlugs(animals, artwork), ["axolotl", "domestic-pig", "tiger"]);
    assert.deepEqual(arkIconlessSlugs([], artwork), []);
});

test("ark icons: a species the server said has no art is the generic figure; the rest are asked for", () => {
    const fox = arkIconUrl("red-fox");
    assert.match(fox, /\/storage\/v1\/object\/public\/animals\/red-fox\.webp$/);
    // Nothing said yet (an older server, the listing unavailable): every icon is asked for, as before.
    assert.notEqual(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    noteArkIconless(["axolotl", 7, null]);
    assert.equal(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    assert.equal(arkIconUrl("red-fox"), fox);
    // An answer without the field keeps what the last one said; the next answer replaces it (an icon uploaded since).
    noteArkIconless(undefined);
    assert.equal(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    noteArkIconless([]);
    assert.notEqual(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    assert.equal(arkIconUrl(arkPlaceholderSlug("sp-1", "Mystery")), ARK_PLACEHOLDER_ICON);
});

const manta = {landing_page_slug: "manta-ray", normalized_identity_key: "manta_ray", display_name: "Giant Oceanic Manta Ray", animal_name: "Giant Oceanic Manta Ray", refined_identity: "Giant Oceanic Manta Ray", scientific_name: "Mobula birostris"};

test("ark icons: the names a species' icon may be filed under, best first, each once", () => {
    assert.deepEqual(arkIconKeys(manta), ["manta-ray", "manta_ray", "giant-oceanic-manta-ray", "mobula-birostris"]);
    // The apostrophe is dropped or a hyphen (`pallass-cat`, `harris-s-hawk` are both in the bucket); nothing else is guessed.
    assert.deepEqual(arkIconKeys({display_name: "Harris's Hawk", scientific_name: null}), ["harriss-hawk", "harris-s-hawk"]);
    assert.deepEqual(arkIconKeys({landing_page_slug: null, display_name: 7}), []);
});

test("ark icons: a species whose art is under another of its own names is found; a relative's or a composite is not", () => {
    const artwork = buildArtworkIndex(["manta-ray.webp", "bengal-tiger.webp", "lion-vs-tiger.webp", "felis-catus.webp", "tiger-vs-mantas.webp"]).bySlug;
    assert.equal(arkIconAlias([manta], artwork), "manta-ray");
    // The page slug comes first; the identity key and the names follow.
    assert.equal(arkIconAlias([{normalized_identity_key: "felis_catus"}, {scientific_name: "Felis catus"}], artwork), "felis-catus");
    assert.equal(arkIconAlias([{display_name: "Tiger"}], artwork), null, "bengal-tiger is a relative");
    assert.equal(arkIconAlias([{display_name: "Lion vs Tiger"}], artwork), null, "a matchup is not a species' art");
    assert.equal(arkIconAlias([], artwork), null);
});

test("ark icons: noIcon carries [slug, file] for an aliased species and the bare slug for one with no art anywhere", () => {
    assert.deepEqual(arkNoIcon(["axolotl", "giant-oceanic-manta-ray"], new Map([["giant-oceanic-manta-ray", "manta-ray"]])), ["axolotl", ["giant-oceanic-manta-ray", "manta-ray"]]);
    assert.deepEqual(arkNoIcon([], new Map()), []);
});

test("ark icons: the page asks for an aliased species' file, never the generic figure, and a bare slug stays the figure", () => {
    noteArkIconless(["axolotl", ["giant-oceanic-manta-ray", "manta-ray"]]);
    assert.match(arkIconUrl("giant-oceanic-manta-ray"), /\/storage\/v1\/object\/public\/animals\/manta-ray\.webp$/);
    assert.equal(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    assert.match(arkIconUrl("red-fox"), /\/animals\/red-fox\.webp$/);
    assert.equal(arkIconUrl(arkPlaceholderSlug("sp-1", "Mystery")), ARK_PLACEHOLDER_ICON);
    // An empty file is no alias; the next answer replaces the last.
    noteArkIconless([["axolotl", ""]]);
    assert.equal(arkIconUrl("axolotl"), ARK_PLACEHOLDER_ICON);
    assert.match(arkIconUrl("giant-oceanic-manta-ray"), /\/animals\/giant-oceanic-manta-ray\.webp$/);
    noteArkIconless([]);
    assert.match(arkIconUrl("axolotl"), /\/animals\/axolotl\.webp$/);
});

test("ark icons: the audit counts the animals drawn as the generic figure although a file exists under one of their names", () => {
    const artwork = buildArtworkIndex(["red-fox.webp", "manta-ray.webp"]).bySlug;
    const animals = [
        {model_slug: "red-fox", species_profile_id: "a"},
        {model_slug: "giant-oceanic-manta-ray", species_profile_id: "b"},
        {model_slug: "giant-oceanic-manta-ray", species_profile_id: "b"},
        {model_slug: "axolotl", species_profile_id: "c"},
        {model_slug: arkPlaceholderSlug("d", "Mystery"), species_profile_id: "d"}
    ];
    const profiles = new Map<string, ArkIconProfile>([["b", manta], ["c", {display_name: "Axolotl"}]]);
    const audit = arkIconAudit(animals, artwork, profiles);
    assert.equal(audit.animals, 5);
    assert.deepEqual([audit.placeholderAnimals, audit.placeholderSpecies], [3, 2]);
    assert.deepEqual([audit.fixableAnimals, audit.fixableSpecies], [2, 1]);
    assert.deepEqual([audit.remainingAnimals, audit.remainingSpecies], [1, 1]);
    assert.deepEqual(audit.fixed, [{slug: "giant-oceanic-manta-ray", file: "manta-ray", animals: 2}]);
    assert.deepEqual(audit.remaining, [{slug: "axolotl", animals: 1, tried: ["axolotl"]}]);
});
