export type SpeciesFieldGuideKnowledge = {
    name: string;
    summary: string;
    habitat: string;
    nativeRange: string;
    identification: string[];
    behaviorTraits: string[];
    interestingFacts?: string[];
    diet?: string | null;
    predators?: string | null;
    sleepPattern?: string | null;
    lifespan?: string | null;
};

export type SpeciesAtAGlance = {
    facts: string[];
    knownFor: string[];
    principleName: string | null;
};

const PLACEHOLDER_COPY = [
    "indexed animaldex species",
    "habitat data is maintained",
    "live animaldex field guide",
    "scientific classification under review",
    "recognized in animaldex as",
    "indexed profile #"
];

function compactClause(value: string, max = 42) {
    const cleaned = value
        .replace(/^(restricted to|found (?:in|across)|native to|occurs in)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
    const clause = cleaned.split(/[.,;]/)[0]?.trim() || cleaned;
    if (clause.length <= max) return clause.replace(/\.$/, "");
    return `${clause.slice(0, max).replace(/\s+\S*$/, "").trim()}`;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const value of values) {
        const next = value?.replace(/\s+/g, " ").trim();
        if (!next) continue;
        const key = next.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(next);
    }
    return unique;
}

function isPlaceholderCopy(value: string) {
    const lower = value.toLowerCase();
    return PLACEHOLDER_COPY.some((marker) => lower.includes(marker));
}

function substantiveText(value: string | null | undefined, min = 24) {
    const text = value?.replace(/\s+/g, " ").trim() ?? "";
    return text.length >= min && !isPlaceholderCopy(text);
}

export function speciesHasSubstantiveFieldGuide(entry: SpeciesFieldGuideKnowledge) {
    const identification = entry.identification.filter((item) => substantiveText(item, 18));
    const behavior = entry.behaviorTraits.filter((item) => substantiveText(item, 18));
    const uniqueBiology = [
        entry.diet,
        entry.predators,
        entry.sleepPattern,
        entry.lifespan,
        ...(entry.interestingFacts ?? [])
    ].filter((item) => substantiveText(item, 24));

    const hasOverview = substantiveText(entry.summary, 72);
    const hasHabitat = substantiveText(entry.habitat, 24);
    const hasRange = substantiveText(entry.nativeRange, 12);
    const hasIdentity = identification.length >= 2 || behavior.length >= 2;
    const hasUniqueBiology = uniqueBiology.length >= 1 || (entry.interestingFacts ?? []).filter((item) => substantiveText(item, 24)).length >= 1;

    return hasOverview && hasHabitat && hasRange && hasIdentity && hasUniqueBiology;
}

export function buildSpeciesAtAGlance(input: {
    category: string;
    habitat: string;
    nativeRange: string;
    rarityLabel: string;
    identification: string[];
    behaviorTraits: string[];
    principleName: string | null;
}): SpeciesAtAGlance {
    const socialCue = input.behaviorTraits.find((item) =>
        /(solitary|social|pack|herd|troop|colony|pod|flock|pair|group)/i.test(item)
    );

    return {
        facts: uniqueNonEmpty([
            compactClause(input.category, 28),
            compactClause(input.nativeRange, 36),
            compactClause(input.habitat, 36),
            socialCue ? compactClause(socialCue, 36) : null,
            compactClause(input.rarityLabel, 24)
        ]).slice(0, 5),
        knownFor: uniqueNonEmpty(input.identification.map((item) => compactClause(item, 52))).slice(0, 4),
        principleName: input.principleName?.trim() || null
    };
}
