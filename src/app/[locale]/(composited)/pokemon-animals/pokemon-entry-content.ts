import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {getPokemonAnimalNote} from "@/data/pokemon-animal-notes";
import {
    getPokemonSharingSpecies,
    type PokemonAnimalEntry
} from "@/data/pokemon-animal-counterparts";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";

const publishedAnimalSlugs = new Set<string>(publishedSeoSlugs.animals);
const publishedLessonSlugs = new Set<string>(publishedSeoSlugs.lessons);

const STAT_LABELS = [
    ["dominance", "Dominance"],
    ["speed", "Speed"],
    ["size", "Size"],
    ["intelligence", "Intelligence"]
] as const;

export type PokemonRealSpecies = {
    slug: string;
    name: string;
    scientificName: string | null;
    category: string | null;
    summary: string | null;
    identification: string[];
    diet: string | null;
    lifespan: string | null;
    predators: string | null;
    facts: string[];
    stats: Array<{label: string; value: number}>;
    animalHref: string;
    lessonHref: string | null;
};

export type PokemonFaq = {question: string; answer: string};

export type PokemonEntryContent = {
    answer: string;
    noteParagraphs: string[];
    species: PokemonRealSpecies[];
    comparison: string[];
    faqs: PokemonFaq[];
};

function cleanText(value: string | null | undefined) {
    const text = value?.trim();
    return text ? text : null;
}

function isRealScientificName(value: string | null | undefined) {
    const text = cleanText(value);
    return text && !/under review|unknown/i.test(text) ? text : null;
}

function joinNames(names: string[]) {
    if (names.length <= 1) {
        return names.join("");
    }

    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function resolveRealSpecies(slug: string): PokemonRealSpecies | null {
    if (!publishedAnimalSlugs.has(slug)) {
        return null;
    }

    const species = getPublishedSpeciesForContent(slug);

    if (!species) {
        return null;
    }

    const fieldGuide = species.databaseSource?.fieldGuide;
    const gameStats = species.databaseSource?.canonicalGameStats ?? null;
    const stats = gameStats
        ? STAT_LABELS.flatMap(([key, label]) => (typeof gameStats[key] === "number" ? [{label, value: gameStats[key]}] : []))
        : [];

    return {
        slug,
        name: species.name,
        scientificName: isRealScientificName(species.analysis.scientificName),
        category: cleanText(species.analysis.category),
        summary: cleanText(species.analysis.summary),
        identification: species.analysis.identification.map((item) => item.trim()).filter(Boolean).slice(0, 3),
        diet: cleanText(fieldGuide?.dietSummary),
        lifespan: cleanText(fieldGuide?.lifespanEstimate),
        predators: cleanText(fieldGuide?.predatorsSummary),
        facts: species.premiumDetails.whyInteresting.map((item) => item.trim()).filter(Boolean).slice(0, 2),
        stats,
        animalHref: `/animals/${slug}`,
        lessonHref: publishedLessonSlugs.has(slug) ? `/animal-lessons/${slug}` : null
    };
}

function confidencePhrase(confidence: PokemonAnimalEntry["confidence"]) {
    if (confidence === "strong") {
        return "a strong match, meaning the design reads directly as this animal";
    }

    if (confidence === "medium") {
        return "a reasonable match, meaning the animal is clear but the design mixes in other traits";
    }

    return "a broad match, meaning the animal is one influence in a largely fantasy design";
}

function statSentence(species: PokemonRealSpecies) {
    if (species.stats.length < 2) {
        return null;
    }

    const parts = species.stats.map((stat) => `${stat.value} for ${stat.label.toLowerCase()}`);
    const strongest = [...species.stats].sort((a, b) => b.value - a.value)[0];
    return `On AnimalDex the real ${species.name} scores ${joinNames(parts)}, out of 100, so its strongest trait is ${strongest.label.toLowerCase()}.`;
}

function buildComparison(entry: PokemonAnimalEntry, species: PokemonRealSpecies[]) {
    const [primary, ...others] = species;
    const genus = entry.genus.replace(/ Pokemon$/i, " Pokémon");
    const opening = `${entry.name}'s official category is the ${genus}. AnimalDex rates its resemblance to the ${entry.animal} as ${confidencePhrase(entry.confidence)}. ${entry.note}`;

    if (!primary) {
        return [opening];
    }

    const kind = primary.category ? `a real ${primary.category.toLowerCase()}` : "a real animal";
    const named = primary.scientificName ? `the ${primary.name} (${primary.scientificName})` : `the ${primary.name}`;
    const reality = [
        `The comparison covers looks and behavior cues, not biology: ${entry.name} is a fictional Pokémon, while ${named} is ${kind}.`,
        statSentence(primary),
        others.length > 0 ? `AnimalDex also links ${entry.name} to the ${joinNames(others.map((item) => item.name))}, covered below.` : null
    ].filter(Boolean).join(" ");

    return [opening, reality];
}

function buildFaqs(entry: PokemonAnimalEntry, answer: string, noteParagraphs: string[], species: PokemonRealSpecies[]): PokemonFaq[] {
    const [primary] = species;
    const faqs: PokemonFaq[] = [
        {
            question: `What animal is ${entry.name} based on?`,
            answer: noteParagraphs.length > 0 ? `${answer} ${noteParagraphs[0]}` : `${answer} ${entry.note}`
        }
    ];

    faqs.push({
        question: `Is ${entry.name} a real animal?`,
        answer: primary
            ? `No. ${entry.name} is a fictional Pokémon. Its closest real counterpart is the ${primary.name}${primary.scientificName ? ` (${primary.scientificName})` : ""}, which AnimalDex covers with real field-guide facts.`
            : `No. ${entry.name} is a fictional Pokémon. Its closest real counterpart is the ${entry.animal}.`
    });

    if (primary?.summary) {
        faqs.push({
            question: `What is the real ${primary.name} like?`,
            answer: primary.summary
        });
    }

    const others = getPokemonSharingSpecies(entry, entry.speciesSlug, 6);
    if (others.length > 0) {
        faqs.push({
            question: `Which other Pokémon are based on the ${entry.animal}?`,
            answer: `AnimalDex also pairs ${joinNames(others.map((item) => item.name))} with the ${entry.animal}.`
        });
    }

    return faqs;
}

export function buildPokemonEntryAnswer(entry: PokemonAnimalEntry) {
    return entry.confidence === "broad"
        ? `${entry.name} is mostly a fantasy design, but its closest real animal is the ${entry.animal}.`
        : `${entry.name} most closely resembles the ${entry.animal}.`;
}

export function buildPokemonEntryContent(entry: PokemonAnimalEntry): PokemonEntryContent {
    const answer = buildPokemonEntryAnswer(entry);
    const noteParagraphs = getPokemonAnimalNote(entry.slug)?.paragraphs ?? [];
    const species = entry.speciesSlugs.flatMap((slug) => {
        const resolved = resolveRealSpecies(slug);
        return resolved ? [resolved] : [];
    });

    return {
        answer,
        noteParagraphs,
        species,
        comparison: buildComparison(entry, species),
        faqs: buildFaqs(entry, answer, noteParagraphs, species)
    };
}

/** "What Animal Is X Based On? Real Animal Explained" when it fits 60 characters. */
export function buildPokemonEntryTitle(entry: PokemonAnimalEntry) {
    const long = `What Animal Is ${entry.name} Based On? Real Animal Explained`;
    return long.length <= 60 ? long : `What Animal Is ${entry.name} Based On?`;
}

export function buildPokemonEntryDescription(entry: PokemonAnimalEntry) {
    const lead = buildPokemonEntryAnswer(entry);
    const primary = getPublishedSpeciesForContent(entry.speciesSlug);
    const candidates = primary
        ? [
            `${lead} Meet the real ${primary.name}: diet, lifespan, traits and AnimalDex stats.`,
            `${lead} Meet the real ${primary.name} and its AnimalDex stats.`
        ]
        : [];
    candidates.push(`${lead} See the closest real-animal comparison, category and confidence level.`, lead);

    return candidates.find((candidate) => candidate.length <= 155) ?? lead.slice(0, 155);
}
