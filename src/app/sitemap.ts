import {MetadataRoute} from "next";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {useCases} from "@/data/use-cases";
import {speciesEntries} from "@/data/species";
import {collectorPages} from "@/data/collector-pages";
import {blogPosts} from "@/data/blog";
import {answerPages} from "@/data/answer-pages";
import {challengeEntries} from "@/data/challenges";
import {rankingPages, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {locationPages} from "@/data/locations";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, pokemonAnimalEntries, pokemonAnimalGenerations} from "@/data/pokemon-animal-counterparts";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getBehavioralPrinciplesIndex} from "@/data/species-behavioral-principles";
import {getBehaviorLessonIndex} from "@/data/species-behavior-lessons";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const behaviorLessons = await getBehaviorLessonIndex();
    const publicLegalEntries: MetadataRoute.Sitemap = [
        {
            url: new URL("/legal/privacy", getSiteUrl()).toString(),
            lastModified: now
        },
        {
            url: new URL("/legal/terms", getSiteUrl()).toString(),
            lastModified: now
        }
    ];

    const localizedEntries = localeConfig.locales.flatMap((locale) => {
        const staticEntries: MetadataRoute.Sitemap = [
            {
                url: getAbsoluteUrl(locale),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/legal/privacy"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/legal/terms"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/what-animal-am-i"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/animals"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/use-cases"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/blog"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/comparisons"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/animal-wisdom"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/locations"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/principles"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/animal-symbolism"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, "/animal-lessons"),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH),
                lastModified: now
            },
            {
                url: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH),
                lastModified: now
            }
        ];

        const useCaseEntries = useCases.map((entry) => ({
            url: getAbsoluteUrl(locale, `/use-cases/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const speciesPages = speciesEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const collectorLandingPages = collectorPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`),
            lastModified: now
        }));

        const blogEntries = blogPosts.map((post) => ({
            url: getAbsoluteUrl(locale, `/blog/${post.slug}`),
            lastModified: new Date(post.updatedAt || post.publishedAt)
        }));

        const answerPageEntries = answerPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const challengePageEntries = challengeEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/comparisons/${entry.slug}`),
            lastModified: new Date(entry.updatedAt || entry.publishedAt)
        }));

        const rankingPageEntries = rankingPages.map((page) => ({
            url: getAbsoluteUrl(locale, `${RANKING_CANONICAL_BASE_PATH}/${page.slug}`),
            lastModified: new Date(page.updatedAt || page.publishedAt)
        }));

        const locationPageEntries = locationPages.map((page) => ({
            url: getAbsoluteUrl(locale, `/locations/${page.slug}`),
            lastModified: new Date(page.updatedAt || page.publishedAt)
        }));
        const principlePageEntries = getBehavioralPrinciplesIndex(speciesSystemsIntelligence).map((item) => ({
            url: getAbsoluteUrl(locale, `/principles/${item.principleSlug}`),
            lastModified: now
        }));
        const behaviorLessonPageEntries = behaviorLessons.map((lesson) => ({
            url: getAbsoluteUrl(locale, `/animal-lessons/${lesson.slug}`),
            lastModified: now
        }));
        const pokemonAnimalGenerationEntries = pokemonAnimalGenerations.map((generation) => ({
            url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`),
            lastModified: now
        }));
        const pokemonAnimalPageEntries = pokemonAnimalEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`),
            lastModified: now
        }));
        const animalHybridPageEntries = animalHybridEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        return [
            ...staticEntries,
            ...useCaseEntries,
            ...speciesPages,
            ...collectorLandingPages,
            ...blogEntries,
            ...answerPageEntries,
            ...challengePageEntries,
            ...rankingPageEntries,
            ...locationPageEntries,
            ...principlePageEntries,
            ...behaviorLessonPageEntries,
            ...pokemonAnimalGenerationEntries,
            ...pokemonAnimalPageEntries,
            ...animalHybridPageEntries
        ];
    });

    return [
        ...publicLegalEntries,
        ...localizedEntries
    ];
}
