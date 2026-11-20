import assert from "node:assert/strict";
import test from "node:test";
import {ARK_PLACEHOLDER_ICON, arkIconUrl, noteArkIconless} from "@/ark-scene/placeholder-icon";
import {buildArtworkIndex, resolveArtworkFileInIndex, type ArtworkIndex} from "@/data/species-artwork-resolution";
import artworkSnapshot from "@/data/species-artwork-snapshot.json";
import {arkIconAlias, arkIconKeys, arkIconlessSlugs, arkNoIcon, type ArkIconProfile} from "@/lib/ark-icons";
import parity from "@/lib/__fixtures__/ark-icon-parity.json";

/**
 * Parity (owner 2026-11-20, "see how our catalog gets them"): a species the catalog shows an icon for is never the
 * generic figure on the Ark. The fixture is the real Ark (the live public read's aboard, gone and extinct species)
 * whose Ark slug has no `<slug>.webp` of its own, with their `species_profiles` names; the listing is the committed
 * bucket snapshot. Each goes through what /ark does (`/api/ark/voyage`'s `noIcon`, then `arkIconUrl`).
 */

type Species = ArkIconProfile & {model_slug: string};

/** The catalog's picture: the web catalog (`/animals/{page}`, the grids) or the app's (iOS `SpeciesCatalogThumbnailView`, exact names). */
function catalogIcon(profile: ArkIconProfile, index: ArtworkIndex): string | null {
    const page = typeof profile.landing_page_slug === "string" ? profile.landing_page_slug.trim().toLowerCase() : "";
    const web = page ? resolveArtworkFileInIndex(index, page) : null;
    if (web) return web.slice(0, -".webp".length);
    return arkIconKeys(profile).find((key) => index.bySlug.has(key)) ?? null;
}

/** The icon /ark draws for these species, through the voyage answer's `noIcon` as the page reads it. */
function arkIcons(species: readonly Species[], index: ArtworkIndex, alias = true): Map<string, string> {
    const missing = arkIconlessSlugs(species, index.bySlug);
    const aliases = new Map<string, string>();
    for (const slug of missing) {
        const file = alias && arkIconAlias(species.filter((one) => one.model_slug === slug), index);
        if (file) aliases.set(slug, file);
    }
    noteArkIconless(arkNoIcon(missing, aliases));
    const urls = new Map(species.map((one) => [one.model_slug, arkIconUrl(one.model_slug)]));
    noteArkIconless([]);
    return urls;
}

function gaps(species: readonly Species[], index: ArtworkIndex, alias = true): string[] {
    const urls = arkIcons(species, index, alias);
    return species.filter((one) => catalogIcon(one, index) && urls.get(one.model_slug) === ARK_PLACEHOLDER_ICON).map((one) => `${one.model_slug} (page ${one.landing_page_slug})`);
}

test("ark icon parity: no Ark species is the generic figure while the catalog shows its icon (live Ark, committed listing)", () => {
    const index = buildArtworkIndex(artworkSnapshot.files);
    const species = parity.species as Species[];
    assert.ok(species.length >= 50, "the fixture holds the real Ark's species with no art at their own slug");
    assert.deepEqual(gaps(species, index), []);
    // The owner's example: drawn with the catalog's picture, not the generic figure.
    const pigeon = species.find((one) => one.model_slug === "domestic-pigeon");
    assert.ok(pigeon);
    assert.match(arkIcons([pigeon], index).get("domestic-pigeon") ?? "", /\/animals\/rock-pigeon\.webp$/);
});

test("ark icon parity: the check fails for the Ark as production drew it (its own slug only)", () => {
    // What a1d46a6f does: `<model_slug>.webp` or the generic figure. The same species must show up as gaps.
    const index = buildArtworkIndex(artworkSnapshot.files);
    const missed = gaps(parity.species as Species[], index, false);
    assert.ok(missed.some((one) => one.startsWith("domestic-pigeon ")));
    assert.ok(missed.length >= 50, `${missed.length} gaps`);
});
