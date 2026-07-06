import {
    getLegendaryCatalogSeedByBeastSlug,
    mergeLegendaryEarthBeastSpeciesEntry
} from "@/data/legendary-earth-beasts-catalog-seed";
import {
    legendaryEarthBeastEntries,
    type LegendaryEarthBeast
} from "@/data/legendary-earth-beasts";
import type { SpeciesEntry } from "@/data/species";

const LEGENDARY_RARITY_SCORE = 94;

function categoryForBeast(beast: LegendaryEarthBeast) {
    const text = `${beast.displayName} ${beast.scientificName}`.toLowerCase();

    if (/\b(frog|toad|salamander|newt|caecilian)\b/.test(text)) {
        return "Amphibian";
    }

    if (/\b(shark|ray)\b/.test(text)) {
        return "Fish";
    }

    if (/\b(cobra|snake|lizard|dragon|monitor|tortoise|uromastyx)\b/.test(text)) {
        return "Reptile";
    }

    if (/\b(whale|seal|sea lion|dolphin|otter)\b/.test(text)) {
        return "Marine mammal";
    }

    if (/\b(macaque|monkey|ape|gorilla|orangutan)\b/.test(text)) {
        return "Primate";
    }

    if (/\b(bird|owl|eagle|falcon|penguin)\b/.test(text)) {
        return "Bird";
    }

    return "Mammal";
}

export function buildLegendaryEarthBeastSpeciesInput(beast: LegendaryEarthBeast): SpeciesEntry {
    const seed = getLegendaryCatalogSeedByBeastSlug(beast.slug);
    const captureSite = seed?.captureSite ?? beast.captureSite;

    const baseInput: SpeciesEntry = {
        slug: beast.slug,
        name: beast.legendaryFormName,
        heroTitle: beast.legendaryFormName,
        publishedAt: beast.publishedAt,
        updatedAt: beast.updatedAt ?? beast.publishedAt,
        featuredImage: beast.featuredImage,
        normalizedIdentityKey: seed?.normalizedIdentityKey ?? beast.slug.replace(/-/g, "_"),

        analysis: {
            summary: seed?.speciesSpotlight ?? beast.quickAnswer,
            scientificName: beast.scientificName,
            category: categoryForBeast(beast),
            identification: seed?.signatureTraits ?? [
                "S-tier Legendary Earth Beast",
                beast.power,
                captureSite,
                beast.legendaryType
            ],
            habitat: captureSite,
            nativeRange: captureSite,
            rarityScore: seed?.canonicalGameStats.rarity ?? LEGENDARY_RARITY_SCORE,
            rarityReason: `${beast.legendaryFormName} is an S-tier Legendary Earth Beast that can only be captured at ${captureSite}.`
        },

        premiumDetails: {
            behaviorTraits: seed?.signatureTraits ?? beast.biologyAnchor,
            whyInteresting: seed?.interestingFacts ?? beast.placeStory,
            respectfulSpotting: beast.respectfulCaptureNote
                ? [beast.respectfulCaptureNote, `Capture is only valid at ${captureSite}.`]
                : [`Capture is only valid at ${captureSite}.`, "Observe respectfully from safe public viewpoints."],
            lookalikes: beast.speciesSlug ? [`Biology inspired by ${beast.displayName}`] : []
        },

        relatedSpecies: [],
        searchIntents: [...beast.searchIntents, beast.legendaryFormName, captureSite]
    };

    if (!seed) {
        return baseInput;
    }

    return mergeLegendaryEarthBeastSpeciesEntry(baseInput, seed);
}

export const additionalSpeciesEntriesInputSeventeen = legendaryEarthBeastEntries.map(
    buildLegendaryEarthBeastSpeciesInput
);

export const additionalSpeciesDescriptorsSeventeen = Object.fromEntries(
    legendaryEarthBeastEntries.map((beast) => {
        const seed = getLegendaryCatalogSeedByBeastSlug(beast.slug);
        return [beast.slug, seed?.subtitleDescriptor ?? `The ${beast.power.toLowerCase()} legendary animal`];
    })
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesSeventeen = Object.fromEntries(
    legendaryEarthBeastEntries.map((beast) => {
        const seed = getLegendaryCatalogSeedByBeastSlug(beast.slug);

        return [
            beast.slug,
            beast.placeStory[0] ??
            seed?.speciesSpotlight ??
            `${beast.legendaryFormName} is tied to ${beast.captureSite.split(",")[0]}.`
        ];
    })
) as Record<string, string>;

export const legendaryEarthBeastSpeciesSlugs = new Set(
    legendaryEarthBeastEntries.map((beast) => beast.slug)
);

export function getLegendaryEarthBeastSubtitle(slug: string) {
    const beast = legendaryEarthBeastEntries.find((entry) => entry.slug === slug);
    const seed = getLegendaryCatalogSeedByBeastSlug(slug);

    if (!beast || !seed) {
        return null;
    }

    return {
        descriptor: seed.subtitleDescriptor,
        subtitleStory: beast.placeStory[0] ?? seed.speciesSpotlight
    };
}

export function enrichLegendaryEarthBeastSpeciesEntry(
    staticEntry: SpeciesEntry,
    catalogEntry?: SpeciesEntry | null
) {
    const seed = getLegendaryCatalogSeedByBeastSlug(staticEntry.slug);

    if (!seed) {
        return staticEntry;
    }

    return mergeLegendaryEarthBeastSpeciesEntry(staticEntry, seed, catalogEntry);
}