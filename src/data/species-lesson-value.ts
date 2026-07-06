import "server-only";

import type {SpeciesEntry} from "@/data/species";
import type {SpeciesStats} from "@/data/species-stats";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

type AnimalValueCategory = "breed" | "domestic" | "wild" | "zoo" | "exotic" | "conservation" | "generic";
type LessonValueDisplayMode = "hidden" | "range_only" | "typical_and_range";
type LessonValuePricingIdentityType = "breed" | "crossBreed" | "domesticParent" | "wild" | "zoo" | "exotic" | "generic" | "unknown";

type AnimalValueProfileRow = {
    species_profile_id: string;
    value_currency: string;
    value_low: number;
    value_typical: number;
    value_high: number;
    value_basis: string;
    value_category: AnimalValueCategory;
    source_confidence: number | null;
    source_notes: string | null;
};

export type SpeciesLessonValueResolution = {
    pricingIdentityType: LessonValuePricingIdentityType;
    pricingIdentityLabel: string | null;
    currency: string;
    lowPrice: number;
    typicalPrice: number;
    highPrice: number;
    estimateConfidence: number;
    displayMode: LessonValueDisplayMode;
    basisLabel: string;
    disclaimer: string;
    source: "animal_value_profile" | "generated_from_species_stats";
};

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function continuousAnimalDexValue(stats: SpeciesStats) {
    const complexity = (
        stats.size * 0.42
        + stats.dominance * 0.18
        + stats.intelligence * 0.14
        + stats.speed * 0.10
        + stats.rarity * 0.16
    );
    const typical = Math.max(1, Math.round(complexity * (1 + stats.rarity / 100) * 4));

    return {
        low: Math.max(1, Math.round(typical * 0.65)),
        typical,
        high: Math.max(1, Math.round(typical * 1.35))
    };
}

function syntheticAnimalValueCategory(entry: SpeciesEntry): AnimalValueCategory {
    const search = [
        entry.normalizedIdentityKey,
        entry.name,
        entry.analysis.scientificName,
        entry.analysis.category
    ].filter(Boolean).join(" ").toLowerCase();

    if (/\b(dog|cat|horse|cattle|cow|goat|sheep|pig|chicken|duck|goose|rabbit)\b/.test(search)) {
        return "domestic";
    }

    if (/\b(emu|ostrich|cassowary|parrot|macaw|cockatoo|python|boa|iguana|lizard|tortoise|turtle)\b/.test(search)) {
        return "exotic";
    }

    if (/\b(endangered|rhino|tiger|orangutan|gorilla|elephant|panda|pangolin|snow leopard|cassowary)\b/.test(search)) {
        return "conservation";
    }

    return "wild";
}

function syntheticAnimalValueProfile(entry: SpeciesEntry, stats: SpeciesStats): AnimalValueProfileRow {
    const category = syntheticAnimalValueCategory(entry);
    const complexityScore = (
        stats.size * 0.42
        + stats.dominance * 0.18
        + stats.intelligence * 0.14
        + stats.speed * 0.10
        + stats.rarity * 0.16
    );
    const rarityScore = stats.rarity;
    const categoryMultiplier = category === "domestic"
        ? 0.62
        : category === "exotic"
            ? 1.05
            : category === "conservation"
                ? 1.45
                : category === "zoo"
                    ? 1.30
                    : 0.95;
    const generatedValue = category === "domestic" || category === "breed"
        ? (() => {
            const typical = Math.max(
                350,
                Math.round((450 + complexityScore * 58 + rarityScore * 42) * categoryMultiplier / 50) * 50
            );

            return {
                low: Math.max(150, Math.round(typical * 0.34 / 50) * 50),
                typical,
                high: Math.max(typical, Math.round(typical * (2.15 + rarityScore / 85) / 50) * 50)
            };
        })()
        : continuousAnimalDexValue(stats);

    return {
        species_profile_id: entry.speciesProfileId ?? entry.slug,
        value_currency: "USD",
        value_low: generatedValue.low,
        value_typical: generatedValue.typical,
        value_high: generatedValue.high,
        value_basis: "care_complexity",
        value_category: category,
        source_confidence: 0.58,
        source_notes: "Generated from canonical AnimalDex species stats because no curated value profile exists."
    };
}

function animalValueBasisLabel(valueProfile: Pick<AnimalValueProfileRow, "value_category">) {
    return valueProfile.value_category === "domestic" || valueProfile.value_category === "breed"
        ? "Estimated market value"
        : "Estimated AnimalDex value";
}

function animalValueDisplayMode(overallTrust: number): LessonValueDisplayMode {
    if (overallTrust < 0.55) {
        return "hidden";
    }

    if (overallTrust < 0.75) {
        return "range_only";
    }

    return "typical_and_range";
}

function pricingIdentityTypeFromCategory(category: AnimalValueCategory): LessonValuePricingIdentityType {
    switch (category) {
        case "breed":
            return "breed";
        case "domestic":
            return "domesticParent";
        case "zoo":
            return "zoo";
        case "exotic":
            return "exotic";
        case "conservation":
        case "wild":
        case "generic":
            return "wild";
        default:
            return "generic";
    }
}

function resolvedSpeciesLessonValueTrust(entry: SpeciesEntry, valueProfile: AnimalValueProfileRow) {
    const profileTrust = entry.speciesProfileId ? 0.78 : 0.62;
    const sourceTrust = valueProfile.source_confidence ?? 0.62;

    return clamp01(profileTrust * 0.55 + sourceTrust * 0.45);
}

async function fetchAnimalValueProfile(speciesProfileId: string) {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();

    if (!supabaseUrl || !key) {
        return null;
    }

    const searchParams = new URLSearchParams({
        select: "species_profile_id,value_currency,value_low,value_typical,value_high,value_basis,value_category,source_confidence,source_notes",
        species_profile_id: `eq.${speciesProfileId}`,
        limit: "1"
    });

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/animal_value_profiles?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(key),
            cache: "no-store"
        });

        if (!response.ok) {
            return null;
        }

        const rows = await response.json() as AnimalValueProfileRow[];

        return rows[0] ?? null;
    } catch {
        return null;
    }
}

function buildLessonValueResolution(
    entry: SpeciesEntry,
    valueProfile: AnimalValueProfileRow,
    source: SpeciesLessonValueResolution["source"]
): SpeciesLessonValueResolution | null {
    const estimateConfidence = resolvedSpeciesLessonValueTrust(entry, valueProfile);
    const displayMode = animalValueDisplayMode(estimateConfidence);
    const lowPrice = Math.min(valueProfile.value_low, valueProfile.value_typical);
    const highPrice = Math.max(valueProfile.value_high, valueProfile.value_typical);

    if (
        displayMode === "hidden"
        || !valueProfile.value_currency
        || !Number.isFinite(lowPrice)
        || !Number.isFinite(highPrice)
    ) {
        return null;
    }

    return {
        pricingIdentityType: pricingIdentityTypeFromCategory(valueProfile.value_category),
        pricingIdentityLabel: entry.name,
        currency: valueProfile.value_currency,
        lowPrice,
        typicalPrice: valueProfile.value_typical,
        highPrice,
        estimateConfidence,
        displayMode,
        basisLabel: animalValueBasisLabel(valueProfile),
        disclaimer: "Not a marketplace listing.",
        source
    };
}

export async function resolveSpeciesLessonValue(
    entry: SpeciesEntry,
    stats: SpeciesStats | null
): Promise<SpeciesLessonValueResolution | null> {
    if (!stats) {
        return null;
    }

    if (entry.speciesProfileId) {
        const storedProfile = await fetchAnimalValueProfile(entry.speciesProfileId);

        if (storedProfile) {
            return buildLessonValueResolution(entry, storedProfile, "animal_value_profile");
        }
    }

    return buildLessonValueResolution(
        entry,
        syntheticAnimalValueProfile(entry, stats),
        "generated_from_species_stats"
    );
}

export function formatLessonValueAmount(amount: number, currency: string, locale = "en-US") {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    }).format(amount);
}

export function formatLessonValueRange(
    low: number,
    high: number,
    currency: string,
    locale = "en-US"
) {
    const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0
    });

    return `${formatter.format(low)} – ${formatter.format(high)}`;
}
