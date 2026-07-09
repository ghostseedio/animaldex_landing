/**
 * Maps alternate capture / display tokens to canonical catalog identity keys.
 * Tokens must already be normalized via catalogLookupToken.
 */
export const COLLECTION_IDENTITY_ALIASES: Record<string, string> = {
    // Lion (Panthera leo)
    african_lion: "lion",
    asiatic_lion: "lion",
    indian_lion: "lion",
    lioness: "lion",
    panthera_leo: "lion",

    // Brown bear (Ursus arctos)
    grizzly_bear: "brown_bear",
    grizzly: "brown_bear",

    // African elephant
    african_elephant: "african_bush_elephant",

    // Rhinoceros unicornis
    greater_one_horned_rhinoceros: "indian_rhinoceros",
    one_horned_rhinoceros: "indian_rhinoceros",
    indian_rhino: "indian_rhinoceros",

    // Spiny-tailed lizard (Uromastyx aegyptia)
    egyptian_spiny_tailed_lizard: "spiny_tailed_lizard",
    uromastyx: "spiny_tailed_lizard",

    // Sperm whale
    cachalot: "sperm_whale",

    // Great white shark
    great_white: "great_white_shark",
    white_shark: "great_white_shark",

    // Japanese macaque
    snow_monkey: "japanese_macaque",

    // Russian tortoise
    horsfields_tortoise: "russian_tortoise",
    horsfield_s_tortoise: "russian_tortoise",

    // Lace monitor
    tree_goanna: "lace_monitor",

    // Australian green tree frog
    green_tree_frog: "australian_green_tree_frog",

    // New Zealand fur seal
    fur_seal: "new_zealand_fur_seal",

    // Bactrian camel
    two_humped_camel: "bactrian_camel",

    // Kookaburra (Laughing Kookaburra is the catalog anchor)
    kookaburra: "laughing_kookaburra",

    // Asian elephant
    asiatic_elephant: "asian_elephant",

    // Rhinoceros shorthand
    white_rhino: "white_rhinoceros",
    black_rhino: "black_rhinoceros",

    // Bengal tiger regional names
    indian_tiger: "bengal_tiger",

    // Life-stage / form aliases → canonical indexed species
    monarch_caterpillar: "monarch_butterfly",
    kea_juvenile: "kea",
    leatherback_hatchling: "leatherback_sea_turtle",
    eastern_tiger_swallowtail_caterpillar: "eastern_tiger_swallowtail",
    ratel_cub: "honey_badger"
};

let runtimeIdentityAliases: Record<string, string> | null = null;

export function setRuntimeSpeciesIdentityAliases(aliases: Record<string, string> | null) {
    runtimeIdentityAliases = aliases;
    refreshCollectionIdentityAliasLookup();
}

export function getMergedIdentityAliases() {
    return {
        ...COLLECTION_IDENTITY_ALIASES,
        ...(runtimeIdentityAliases ?? {})
    };
}

const CANONICAL_ALIAS_LOOKUP = new Map<string, Set<string>>();

function rebuildCanonicalAliasLookup() {
    CANONICAL_ALIAS_LOOKUP.clear();

    for (const [alias, canonical] of Object.entries(getMergedIdentityAliases())) {
        if (!CANONICAL_ALIAS_LOOKUP.has(canonical)) {
            CANONICAL_ALIAS_LOOKUP.set(canonical, new Set());
        }

        CANONICAL_ALIAS_LOOKUP.get(canonical)!.add(alias);
    }
}

rebuildCanonicalAliasLookup();

export function refreshCollectionIdentityAliasLookup() {
    rebuildCanonicalAliasLookup();
}

export function resolveCollectionIdentityToken(token: string) {
    const normalized = token.trim().toLowerCase().replace(/-/g, "_");
    return getMergedIdentityAliases()[normalized] ?? normalized;
}

/** All normalized tokens that should match the same catalog / collection identity. */
export function collectionIdentityMatchKeys(token: string) {
    const normalized = token.trim().toLowerCase().replace(/-/g, "_");
    const canonical = resolveCollectionIdentityToken(normalized);
    const keys = new Set([normalized, canonical]);

    for (const alias of Array.from(CANONICAL_ALIAS_LOOKUP.get(canonical) ?? [])) {
        keys.add(alias);
    }

    return Array.from(keys);
}
