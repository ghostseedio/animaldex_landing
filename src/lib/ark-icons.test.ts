import assert from "node:assert/strict";
import test from "node:test";
import {ARK_PLACEHOLDER_ICON, arkIconUrl, arkPlaceholderSlug, noteArkIconless} from "@/ark-scene/placeholder-icon";
import {buildArtworkIndex} from "@/data/species-artwork-resolution";
import {arkIconlessSlugs} from "@/lib/ark-icons";

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
