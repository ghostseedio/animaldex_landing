import "server-only";

import {getAnimalHybrid} from "@/data/animal-hybrids";
import {getFusableSpecies, getPublishedAnimalFusion} from "@/data/animal-fusions";
import {getCollectorPage} from "@/data/collector-pages";
import {getSpeciesPageData} from "@/data/database-species-pages";
import {
    getPokemonAnimalEntriesByGeneration,
    getPokemonAnimalEntry,
    getPokemonAnimalGeneration,
    getPokemonArtSrc
} from "@/data/pokemon-animal-counterparts";
import {resolveSpeciesArtworkFiles} from "@/data/species-artwork-index";
import {
    getBehaviorLessonBySlug,
    getPublicPrincipleHubBySlug,
    resolveSpeciesBehaviorProfileForPage
} from "@/data/species-behavior-lessons";
import {getUseCase} from "@/data/use-cases";
import {getSupportArticleBySlugs} from "@/lib/support-articles";
import type {OgCardSpec, OgTile} from "@/lib/og/og-card";
import {STATIC_OG_CARDS} from "@/lib/og/static-og-cards";

/** Animals most people recognise at a glance, preferred when a card picks from a long list. */
const FAMOUS_ANIMALS = new Set([
    "african-bush-elephant", "african-lion", "lion", "bengal-tiger", "cheetah", "jaguar", "snow-leopard",
    "gray-wolf", "red-fox", "fennec-fox", "polar-bear", "grizzly-bear", "giant-panda", "red-panda", "koala",
    "giraffe", "plains-zebra", "hippopotamus", "white-rhinoceros", "western-gorilla", "gorilla",
    "bornean-orangutan", "sumatran-orangutan", "chimpanzee", "meerkat", "honey-badger", "wolverine",
    "capybara", "platypus", "three-toed-sloth", "american-bison", "humpback-whale", "blue-whale", "orca",
    "great-white-shark", "common-octopus", "octopus", "green-sea-turtle", "emperor-penguin", "atlantic-puffin",
    "bald-eagle", "golden-eagle", "peregrine-falcon", "snowy-owl", "barn-owl", "common-raven", "scarlet-macaw",
    "african-grey-parrot", "common-kingfisher", "arctic-tern", "monarch-butterfly", "honey-bee", "leafcutter-ant",
    "mantis-shrimp", "komodo-dragon", "chameleon", "green-iguana", "ball-python", "king-cobra", "nile-crocodile",
    "saltwater-crocodile", "red-eyed-tree-frog", "axolotl", "beaver", "north-american-beaver", "raccoon",
    "arctic-fox", "kangaroo", "red-kangaroo", "dolphin", "common-bottlenose-dolphin", "beluga-whale", "walrus"
]);

function art(slug: string, label?: string, caption?: string): OgTile {
    return {image: {artwork: slug}, label, caption};
}

/** First `limit` slugs that actually have artwork, so a card never shows an empty tile. */
async function withArtwork(slugs: string[], limit: number) {
    const candidates = Array.from(new Set(slugs)).slice(0, limit * 4);
    const files = await resolveSpeciesArtworkFiles(candidates);
    return candidates.filter((slug) => files.get(slug)).slice(0, limit);
}

function titleCase(slug: string) {
    return slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

async function speciesCard(slug: string): Promise<OgCardSpec | null> {
    const entry = await getSpeciesPageData(slug);
    if (!entry) return null;
    const profile = resolveSpeciesBehaviorProfileForPage(entry.slug);
    return {
        kicker: profile ? `Animal meaning · ${profile.principle}` : "Animal guide",
        title: entry.name,
        subtitle: profile?.motto || entry.analysis.scientificName || undefined,
        tiles: [art(entry.slug)]
    };
}

async function lessonCard(slug: string): Promise<OgCardSpec | null> {
    const lesson = await getBehaviorLessonBySlug(slug);
    if (!lesson) return null;
    return {
        kicker: `Animal lesson · ${lesson.principleName}`,
        title: `What the ${lesson.displayName} teaches`,
        subtitle: lesson.shortMotto || undefined,
        tiles: [art(lesson.slug)]
    };
}

async function powerCard(slug: string): Promise<OgCardSpec | null> {
    const hub = await getPublicPrincipleHubBySlug(slug);
    if (!hub) return null;
    const lessonsBySlug = new Map(hub.lessons.map((lesson) => [lesson.slug, lesson]));
    // Hub lessons are alphabetical, which would lead with obscure animals.
    const slugs = hub.lessons.map((lesson) => lesson.slug);
    const famous = slugs.filter((item) => FAMOUS_ANIMALS.has(item));
    const picked = await withArtwork([...famous, ...slugs.filter((item) => !FAMOUS_ANIMALS.has(item))], 3);
    return {
        kicker: "Animal power",
        title: `${hub.principle}: animals that master it`,
        tiles: picked.map((item) => art(item, lessonsBySlug.get(item)?.displayName ?? titleCase(item)))
    };
}

function supportCard(categorySlug: string, articleSlug: string): OgCardSpec | null {
    const article = getSupportArticleBySlugs(categorySlug, articleSlug);
    if (!article) return null;
    return {
        kicker: `Help Center · ${article.categoryTitle}`,
        title: article.title,
        subtitle: article.summary.length <= 140 ? article.summary : undefined
    };
}

function hybridCard(slug: string): OgCardSpec | null {
    const hybrid = getAnimalHybrid(slug);
    if (hybrid) {
        const [first, second] = hybrid.parents;
        return {
            kicker: "Animal hybrid",
            title: `${hybrid.title}: the ${hybrid.hybridName}`,
            joiner: "+",
            tiles: [art(first.slug, first.name), art(second.slug, second.name)]
        };
    }
    const fusion = getPublishedAnimalFusion(slug);
    const receiver = fusion ? getFusableSpecies(fusion.receiverSlug) : null;
    const donor = fusion ? getFusableSpecies(fusion.donorSlug) : null;
    if (!fusion || !receiver || !donor) return null;
    return {
        kicker: "Animal fusion",
        title: `${receiver.name} + ${donor.name}: ${fusion.name}`,
        joiner: "+",
        tiles: [art(receiver.slug, receiver.name), art(donor.slug, donor.name)]
    };
}

function pokemonCard(slug: string): OgCardSpec | null {
    const generation = getPokemonAnimalGeneration(slug);
    if (generation) {
        const entries = getPokemonAnimalEntriesByGeneration(generation.id).slice(0, 3);
        return {
            kicker: `Pokémon animals · ${generation.region}`,
            title: `${generation.label} Pokémon and their real animals`,
            tiles: entries.map((entry) => ({image: {publicPath: getPokemonArtSrc(entry.slug)}, label: entry.name, caption: entry.animal}))
        };
    }
    const entry = getPokemonAnimalEntry(slug);
    if (!entry) return null;
    return {
        kicker: "Pokémon animals",
        title: `What animal is ${entry.name} based on?`,
        joiner: "→",
        tiles: [
            {image: {publicPath: getPokemonArtSrc(entry.slug)}, label: entry.name},
            art(entry.speciesSlug, entry.animal)
        ]
    };
}

function landingUseCaseCard(slug: string): OgCardSpec | null {
    const useCase = getUseCase(slug);
    const config = STATIC_OG_CARDS[`use-cases/${slug}`];
    if (!useCase || !config) return null;
    return {...config, title: config.title || useCase.title};
}

function collectorCard(slug: string): OgCardSpec | null {
    const page = getCollectorPage(slug);
    const config = STATIC_OG_CARDS[slug];
    if (!page || !config) return null;
    return {...config, title: config.title || page.heroTitle.split(/\s[—-]\s/)[0]};
}

/**
 * Turns an `/api/og/...` path into the card it should draw. Every key is
 * resolved from site data, so the endpoint can't be made to render arbitrary text.
 */
export async function resolveOgCard(segments: string[]): Promise<OgCardSpec | null> {
    const [kind, ...rest] = segments;
    switch (kind) {
        case "species":
            return rest.length === 1 ? speciesCard(rest[0]) : null;
        case "lesson":
            return rest.length === 1 ? lessonCard(rest[0]) : null;
        case "power":
            return rest.length === 1 ? powerCard(rest[0]) : null;
        case "support":
            return rest.length === 2 ? supportCard(rest[0], rest[1]) : null;
        case "hybrid":
            return rest.length === 1 ? hybridCard(rest[0]) : null;
        case "pokemon":
            return rest.length === 1 ? pokemonCard(rest[0]) : null;
        case "use-case":
            return rest.length === 1 ? landingUseCaseCard(rest[0]) : null;
        case "collector":
            return rest.length === 1 ? collectorCard(rest[0]) : null;
        case "page":
            return STATIC_OG_CARDS[rest.join("/")] ?? null;
        default:
            return null;
    }
}
