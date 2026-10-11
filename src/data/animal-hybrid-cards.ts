import {formatFusionStat, getFusableSpecies, publishedAnimalFusions} from "@/data/animal-fusions";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getSpeciesBySlug} from "@/data/species";

/** One card in the Animal Hybrid Lab: a curated hybrid creature or an app fusion. */
export type AnimalHybridCard = {
    kind: "hybrid" | "fusion";
    slug: string;
    href: string;
    title: string;
    /** Hybrid creature name, or the fusion's learned power. */
    label: string;
    summary: string;
    abilityLabel: string;
    abilityName: string;
    abilityDescription: string;
    parents: Array<{slug: string; name: string}>;
};

let cached: AnimalHybridCard[] | null = null;

/**
 * Every card in the lab, in lab order: fusions made in the app first, then the
 * curated hybrid creatures. Built once per server process from the published
 * snapshots. The hub pages slice it (src/data/hub-pagination.ts) and the
 * search API filters it, so the browser never receives the whole set.
 */
export function getAnimalHybridCards(): AnimalHybridCard[] {
    if (cached) return cached;

    const fusionCards: AnimalHybridCard[] = publishedAnimalFusions.flatMap((fusion) => {
        const receiver = getFusableSpecies(fusion.receiverSlug);
        const donor = getFusableSpecies(fusion.donorSlug);
        if (!receiver || !donor) return [];
        const boosts = [
            fusion.primaryStat && fusion.boostPrimary > 0 ? `+${fusion.boostPrimary} ${formatFusionStat(fusion.primaryStat)}` : null,
            fusion.secondaryStat && fusion.boostSecondary > 0 ? `+${fusion.boostSecondary} ${formatFusionStat(fusion.secondaryStat)}` : null
        ].filter(Boolean);
        return [{
            kind: "fusion",
            slug: fusion.slug,
            href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${fusion.slug}`,
            title: `${receiver.name} + ${donor.name}`,
            label: fusion.name,
            summary: `The ${receiver.name} keeps its ${fusion.receiverPrinciple} and learns from the ${donor.name}'s ${fusion.donorPrinciple}.`,
            abilityLabel: boosts.length > 0 ? `Learned power · ${boosts.join(" · ")}` : "Learned power",
            abilityName: fusion.name,
            abilityDescription: fusion.expression,
            parents: [{slug: receiver.slug, name: receiver.name}, {slug: donor.slug, name: donor.name}]
        }];
    });
    const hybridCards: AnimalHybridCard[] = animalHybridEntries.map((entry) => ({
        kind: "hybrid",
        slug: entry.slug,
        href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`,
        title: entry.title,
        label: entry.hybridName,
        summary: entry.quickAnswer,
        abilityLabel: "Ultimate ability",
        abilityName: entry.ultimateAbility.name,
        abilityDescription: entry.ultimateAbility.description,
        parents: entry.parents.flatMap((parent) => {
            const species = getSpeciesBySlug(parent.slug);
            return species ? [{slug: species.slug, name: species.name}] : [];
        })
    }));

    cached = [...fusionCards, ...hybridCards];
    return cached;
}

/** Case-insensitive match on the card's names and its parents'. */
export function searchAnimalHybridCards(query: string, limit: number) {
    const needle = query.trim().toLowerCase();
    const cards = getAnimalHybridCards();
    const matching = needle
        ? cards.filter((card) => `${card.title} ${card.label} ${card.parents.map((parent) => parent.name).join(" ")}`.toLowerCase().includes(needle))
        : cards;
    return {total: matching.length, cards: matching.slice(0, limit)};
}
