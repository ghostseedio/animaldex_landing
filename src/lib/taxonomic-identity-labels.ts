/**
 * Mirrors the taxon-prose handling in the AnimalDex shared edge policy
 * (supabase/functions/_shared/capture-identity-labels.ts) so the website never
 * renders identities like "member of the Diptera order" as an animal name.
 */

const TAXONOMIC_RANK_WORDS = new Set([
    "class",
    "family",
    "genus",
    "infraorder",
    "order",
    "phylum",
    "subfamily",
    "suborder",
    "superfamily"
]);

/** Known higher-rank Latin taxa mapped to clean common card titles. */
const HIGHER_TAXON_COMMON_NAME_BY_TOKEN: Record<string, string> = {
    anisoptera: "Dragonfly",
    arachnida: "Spider",
    aves: "Bird",
    blattodea: "Cockroach",
    coleoptera: "Beetle",
    culicidae: "Mosquito",
    diptera: "Fly",
    formicidae: "Ant",
    hemiptera: "Insect",
    hymenoptera: "Insect",
    lepidoptera: "Moth",
    mammalia: "Mammal",
    mantodea: "Mantis",
    odonata: "Dragonfly",
    orthoptera: "Grasshopper",
    reptilia: "Reptile",
    rodentia: "Rodent"
};

const SPECIES_COMMON_NAME_HEAD_TOKENS = new Set([
    "fantail", "finch", "sparrow", "swallow", "martin", "thrush", "warbler", "robin",
    "pigeon", "dove", "crow", "raven", "magpie", "starling", "owl", "hawk", "eagle",
    "heron", "parrot", "duck", "goose", "swan", "bird"
]);

// Linnaean suffixes for family / subfamily / order-ish ranks. Bare -ptera keeps
// Diptera covered while Coleoptera and Lepidoptera match -optera.
const HIGHER_TAXON_SUFFIXES = /(idae|aceae|oidea|inae|iformes|optera|ptera|omorpha|ales|odea)$/i;

const RANK_WORD_GROUP = "order|family|class|phylum|genus|subfamily|suborder|infraorder|superfamily";

function normalizedProseLabel(raw: string | null | undefined) {
    const text = raw?.trim();
    if (!text) return null;

    return text
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^a-z0-9\s]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null;
}

export function isHigherTaxonScientificLabel(raw: string | null | undefined) {
    const token = normalizedProseLabel(raw);
    if (!token || token.includes(" ")) return false;
    if (SPECIES_COMMON_NAME_HEAD_TOKENS.has(token)) return false;
    if (HIGHER_TAXON_COMMON_NAME_BY_TOKEN[token]) return true;
    return HIGHER_TAXON_SUFFIXES.test(token);
}

function commonNameForHigherTaxonToken(taxonToken: string, rankWord: string | null = null) {
    const mapped = HIGHER_TAXON_COMMON_NAME_BY_TOKEN[taxonToken];
    if (mapped) return mapped;

    const isGroupRank = rankWord === "order"
        || rankWord === "family"
        || rankWord === "subfamily"
        || rankWord === "superfamily"
        || rankWord === "suborder"
        || rankWord === "infraorder";

    if (isGroupRank && HIGHER_TAXON_SUFFIXES.test(taxonToken)) {
        return "Insect";
    }

    return "Unknown animal";
}

/**
 * Detects taxonomic-rank prose identities such as "member of the Diptera order",
 * "belonging to the Formicidae family", "Diptera order", or "order Diptera",
 * and returns the clean common name to display instead.
 */
export function taxonomicRankProseFallback(raw: string | null | undefined): string | null {
    const loose = normalizedProseLabel(raw);
    if (!loose) return null;

    const memberMatch = loose.match(
        new RegExp(`^(?:a |an )?(?:member|members|part) of (?:the )?([a-z]+) (${RANK_WORD_GROUP})$`)
    );
    if (memberMatch?.[1] && memberMatch[2]) {
        return commonNameForHigherTaxonToken(memberMatch[1], memberMatch[2]);
    }

    const belongingMatch = loose.match(
        new RegExp(`^(?:a |an )?belonging to (?:the )?([a-z]+) (${RANK_WORD_GROUP})$`)
    );
    if (belongingMatch?.[1] && belongingMatch[2]) {
        return commonNameForHigherTaxonToken(belongingMatch[1], belongingMatch[2]);
    }

    const taxonFirstMatch = loose.match(new RegExp(`^([a-z]+) (${RANK_WORD_GROUP})$`));
    if (
        taxonFirstMatch?.[1]
        && taxonFirstMatch[2]
        && TAXONOMIC_RANK_WORDS.has(taxonFirstMatch[2])
        && isHigherTaxonScientificLabel(taxonFirstMatch[1])
    ) {
        return commonNameForHigherTaxonToken(taxonFirstMatch[1], taxonFirstMatch[2]);
    }

    const rankFirstMatch = loose.match(new RegExp(`^(${RANK_WORD_GROUP}) ([a-z]+)$`));
    if (
        rankFirstMatch?.[1]
        && rankFirstMatch[2]
        && TAXONOMIC_RANK_WORDS.has(rankFirstMatch[1])
        && isHigherTaxonScientificLabel(rankFirstMatch[2])
    ) {
        return commonNameForHigherTaxonToken(rankFirstMatch[2], rankFirstMatch[1]);
    }

    return null;
}

export function labelLooksLikeTaxonomicRankProse(raw: string | null | undefined) {
    return taxonomicRankProseFallback(raw) !== null;
}

/** Returns a display-safe identity label, swapping taxon prose for a common name. */
export function sanitizedIdentityDisplayLabel(raw: string | null | undefined) {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    return taxonomicRankProseFallback(trimmed) ?? trimmed;
}
