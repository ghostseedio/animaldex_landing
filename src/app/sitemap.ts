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
    const behaviorLessons = await getBehaviorLessonIndex();
    const publicLegalEntries: MetadataRoute.Sitemap = [
        {
            url: new URL("/legal/privacy", getSiteUrl()).toString(),
        },
        {
            url: new URL("/legal/terms", getSiteUrl()).toString(),
        }
    ];

    const localizedEntries = localeConfig.locales.flatMap((locale) => {
        // Only the homepage is fully localized today. Keep untranslated catalogue,
        // editorial, and SEO pages out of localized sitemap variants until their
        // underlying content (not only the interface) is translated.
        if (locale !== localeConfig.defaultLocale) {
            return [{url: getAbsoluteUrl(locale)}];
        }

        const staticEntries: MetadataRoute.Sitemap = [
            {
                url: getAbsoluteUrl(locale)
            },
            {
                url: getAbsoluteUrl(locale, "/what-animal-am-i")
            },
            {
                url: getAbsoluteUrl(locale, "/animals")
            },
            {
                url: getAbsoluteUrl(locale, "/use-cases")
            },
            {
                url: getAbsoluteUrl(locale, "/blog")
            },
            {
                url: getAbsoluteUrl(locale, "/support")
            },
            {
                url: getAbsoluteUrl(locale, "/contact")
            },
            {
                url: getAbsoluteUrl(locale, "/comparisons")
            },
            {
                url: getAbsoluteUrl(locale, "/animal-wisdom")
            },
            {
                url: getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH)
            },
            {
                url: getAbsoluteUrl(locale, "/locations")
            },
            {
                url: getAbsoluteUrl(locale, "/principles")
            },
            {
                url: getAbsoluteUrl(locale, "/animal-symbolism")
            },
            {
                url: getAbsoluteUrl(locale, "/animal-lessons")
            },
            {
                url: getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)
            },
            {
                url: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
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
            url: getAbsoluteUrl(locale, `/${entry.slug}`)
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
            url: getAbsoluteUrl(locale, `/principles/${item.principleSlug}`)
        }));
        const behaviorLessonPageEntries = behaviorLessons.map((lesson) => ({
            url: getAbsoluteUrl(locale, `/animal-lessons/${lesson.slug}`)
        }));
        const pokemonAnimalGenerationEntries = pokemonAnimalGenerations.map((generation) => ({
            url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`)
        }));
        const pokemonAnimalPageEntries = pokemonAnimalEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`)
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
