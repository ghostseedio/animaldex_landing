import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {resolveArtworkFileInIndex, type ArtworkIndex} from "@/data/species-artwork-resolution";

/**
 * The species in an Ark answer with no icon art of their own: no `<slug>.webp` in the `animals` bucket's listing
 * (`artwork`, by slug: `species-artwork-index.ts`). Species icons are hand-made files with no database column, so the
 * listing is the only record of which exist. `/api/ark/voyage` sends these beside the snapshot (`noIcon`) and the page
 * draws them as the generic figure without asking the bucket for a file it does not hold (a 400 and a console error
 * each). Placeholders never ask; each slug once, sorted.
 */
export function arkIconlessSlugs(animals: ReadonlyArray<{model_slug: string}>, artwork: {has: (slug: string) => boolean}): string[] {
    const missing = new Set<string>();
    for (const {model_slug: slug} of animals) {
        if (slug && !isArkPlaceholderSlug(slug) && !artwork.has(slug)) missing.add(slug);
    }
    return Array.from(missing).sort();
}

/** The names a species is known by in the database (`species_profiles`): the keys its icon may be filed under. */
export type ArkIconProfile = {
    landing_page_slug?: unknown;
    normalized_identity_key?: unknown;
    display_name?: unknown;
    animal_name?: unknown;
    refined_identity?: unknown;
    scientific_name?: unknown;
};

/** A name as a file name: lower case, accents and apostrophes gone, everything else one hyphen. */
function fileKey(name: string, apostrophe: "" | "-"): string {
    return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, apostrophe).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * The file names a species' icon may be filed under, best first, as the apps ask for them (iOS
 * `SpeciesCatalogThumbnailView`): its page's slug, its identity key (as written and with hyphens), its display name,
 * animal name and refined identity, then its scientific name. Icons are made by hand and named by whichever of these
 * the maker had (`manta-ray` for the Giant Oceanic Manta Ray, `ara-militaris` for the Military Macaw), so the Ark's
 * own slug (`giant-oceanic-manta-ray`) misses files that exist. Each key once.
 */
export function arkIconKeys(profile: ArkIconProfile): string[] {
    const keys = new Set<string>();
    const add = (key: string) => {
        if (key) keys.add(key);
    };
    add(text(profile.landing_page_slug).toLowerCase());
    const identity = text(profile.normalized_identity_key).toLowerCase();
    add(identity);
    add(identity.replace(/_/g, "-"));
    for (const name of [profile.display_name, profile.animal_name, profile.refined_identity, profile.scientific_name]) {
        const written = text(name);
        add(fileKey(written, ""));
        add(fileKey(written, "-"));
    }
    return Array.from(keys);
}

/**
 * The file (slug of `<slug>.webp`) a species' icon is under, for a species whose Ark slug has none: the catalog's own
 * picture of it, so the Ark never draws the generic figure for a species the catalog shows an icon for (owner
 * 2026-11-20: Domestic Pigeon, Ark slug `domestic-pigeon`, page `rock-pigeon`). First its page's slug resolved exactly as
 * the web catalog resolves it (`/animals/{slug}`, the catalog grids: `resolveArtworkFileInIndex`, the same function,
 * with its spellings, aliases and closest relative), then the app catalog's names (`arkIconKeys`, iOS
 * `SpeciesCatalogThumbnailView`) each exactly. Never a matchup composite (the index leaves those out). Null when
 * neither catalog has a picture either.
 */
export function arkIconAlias(profiles: ReadonlyArray<ArkIconProfile>, artwork: ArtworkIndex): string | null {
    for (const profile of profiles) {
        const page = text(profile.landing_page_slug).toLowerCase();
        const file = page ? resolveArtworkFileInIndex(artwork, page) : null;
        if (file) return file.slice(0, -".webp".length);
    }
    for (const profile of profiles) {
        for (const key of arkIconKeys(profile)) {
            if (artwork.bySlug.has(key)) return key;
        }
    }
    return null;
}

/**
 * `/api/ark/voyage`'s `noIcon`: each species with no icon at its Ark slug (`arkIconlessSlugs`), as the slug alone when
 * it has none anywhere, or `[slug, file]` when its art is filed under another of its own names (`aliases`). The page
 * draws the first as the generic figure and asks for the second's file instead.
 */
export function arkNoIcon(slugs: readonly string[], aliases: ReadonlyMap<string, string>): Array<string | [string, string]> {
    return slugs.map((slug) => {
        const file = aliases.get(slug);
        return file ? [slug, file] : slug;
    });
}
