import {MetadataRoute} from "next";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {useCases} from "@/data/use-cases";
import {collectorPages} from "@/data/collector-pages";
import {getIndexedBlogPosts} from "@/data/blog";
import {answerPages} from "@/data/answer-pages";
import {challengeEntries} from "@/data/challenges";
import {rankingPages, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {locationPages} from "@/data/locations";
import {isPlaceCollectionIndexable} from "@/data/location-places";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, pokemonAnimalEntries, pokemonAnimalGenerations} from "@/data/pokemon-animal-counterparts";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getBehaviorLessonIndex, getPrincipleHubIndex} from "@/data/species-behavior-lessons";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {legendaryEarthBeastEntries, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH} from "@/data/legendary-earth-beasts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const behaviorLessons = await getBehaviorLessonIndex();
    const principleHubs = await getPrincipleHubIndex();
    const unifiedSpeciesEntries = await getUnifiedSpeciesEntries();
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
                url: getAbsoluteUrl(locale, "/powers")
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

        const speciesPages = unifiedSpeciesEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const collectorLandingPages = collectorPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`)
        }));

        const blogEntries = getIndexedBlogPosts().map((post) => ({
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
        const locationPlacePageEntries = locationPages.flatMap((page) => {
            const entries: MetadataRoute.Sitemap = [];
            const lastModified = new Date(page.updatedAt || page.publishedAt);
            if (isPlaceCollectionIndexable(page.zoosAndParks)) {
                entries.push({url: getAbsoluteUrl(locale, `/locations/${page.slug}/zoos`), lastModified});
            }
            if (isPlaceCollectionIndexable(page.wildlifeReserves)) {
                entries.push({url: getAbsoluteUrl(locale, `/locations/${page.slug}/wildlife-reserves`), lastModified});
            }
            return entries;
        });
        const principlePageEntries = principleHubs.map((item) => ({
            url: getAbsoluteUrl(locale, `/powers/${item.principleSlug}`)
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
        const captureAnimalsAppEntry = {
            url: getAbsoluteUrl(locale, "/capture-animals-app"),
            lastModified: new Date("2026-07-06")
        };
        const legendaryEarthBeastHubEntry = {
            url: getAbsoluteUrl(locale, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH),
            lastModified: new Date("2026-07-06")
        };
        const legendaryEarthBeastPageEntries = legendaryEarthBeastEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${entry.slug}`),
            lastModified: new Date(entry.updatedAt || entry.publishedAt)
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
            ...locationPlacePageEntries,
            ...principlePageEntries,
            ...behaviorLessonPageEntries,
            ...pokemonAnimalGenerationEntries,
            ...pokemonAnimalPageEntries,
            ...animalHybridPageEntries,
            captureAnimalsAppEntry,
            legendaryEarthBeastHubEntry,
            ...legendaryEarthBeastPageEntries
        ];
    });

    return [
        ...publicLegalEntries,
        ...localizedEntries
    ];
}
