import {MetadataRoute} from "next";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {useCases} from "@/data/use-cases";
import {collectorPages} from "@/data/collector-pages";
import {getManagedBlogPosts, getManagedPages} from "@/lib/admin-content";
import {answerPages} from "@/data/answer-pages";
import {challengeEntries} from "@/data/challenges";
import {listMergedChallengeSitemapEntries} from "@/data/species-comparisons";
import {rankingPages, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {locationPages} from "@/data/locations";
import {isPlaceCollectionIndexable} from "@/data/location-places";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, pokemonAnimalEntries, pokemonAnimalGenerations} from "@/data/pokemon-animal-counterparts";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getBehaviorLessonIndex, getPrincipleHubIndex} from "@/data/species-behavior-lessons";
import {getSitemapSpeciesEntries} from "@/data/database-species-pages";
import {getDiscoverCapturePostsForSitemap} from "@/data/discover-timeline";
import {discoverPostPath} from "@/lib/discover-post";
import {speciesEntries} from "@/data/species";
import {legendaryEarthBeastEntries, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH} from "@/data/legendary-earth-beasts";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {buildGuideSitemapPaths, guidePath} from "@/lib/guide-marketplace-core";
import {listSupportArticles, getSupportArticlePath} from "@/lib/support-articles";

async function getSitemapChallengeEntries() {
    try {
        return await listMergedChallengeSitemapEntries();
    } catch (error) {
        console.error("Unable to load generated species comparisons for sitemap. Falling back to static entries.", error);
        return challengeEntries.map((entry) => ({
            slug: entry.slug,
            updatedAt: entry.updatedAt || entry.publishedAt
        }));
    }
}

export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
    const [
        managedBlogPosts,
        managedPages,
        behaviorLessons,
        principleHubs,
        sitemapSpeciesEntries,
        discoverPosts,
        mergedChallengeEntries,
        guideListings
    ] = await Promise.all([
        getManagedBlogPosts(),
        getManagedPages(),
        getBehaviorLessonIndex(),
        getPrincipleHubIndex(),
        getSitemapSpeciesEntries().catch((error) => {
            console.error("Unable to load unified species catalog for sitemap. Falling back to static species entries.", error);
            return speciesEntries.map((entry) => ({slug: entry.slug, updatedAt: entry.updatedAt}));
        }),
        getDiscoverCapturePostsForSitemap(400).catch((error) => {
            console.error("Unable to load discover posts for sitemap.", error);
            return [];
        }),
        getSitemapChallengeEntries(),
        getPublicGuideListings().catch((error) => {
            console.error("Unable to load public Guide listings for sitemap.", error);
            return [];
        })
    ]);

    const guideEntries: MetadataRoute.Sitemap = [
        {url: new URL("/wildlife-guides", getSiteUrl()).toString()},
        {url: new URL("/wildlife-experiences", getSiteUrl()).toString()},
        ...buildGuideSitemapPaths(guideListings).map((path) => {
            const listing = guideListings.find((item) => guidePath(item) === path);
            return {url: new URL(path, getSiteUrl()).toString(), ...(listing ? {lastModified: new Date(listing.updated_at)} : {})};
        })
    ];
    const publicLegalEntries: MetadataRoute.Sitemap = [
        {
            url: new URL("/legal/privacy", getSiteUrl()).toString()
        },
        {
            url: new URL("/legal/terms", getSiteUrl()).toString()
        }
    ];

    const localizedEntries = localeConfig.locales.flatMap((locale) => {
        if (locale !== localeConfig.defaultLocale) {
            return [{url: getAbsoluteUrl(locale)}];
        }

        const staticEntries: MetadataRoute.Sitemap = [
            {url: getAbsoluteUrl(locale)},
            {url: getAbsoluteUrl(locale, "/what-animal-am-i")},
            {url: getAbsoluteUrl(locale, "/animals")},
            {url: getAbsoluteUrl(locale, "/use-cases")},
            {url: getAbsoluteUrl(locale, "/blog")},
            {url: getAbsoluteUrl(locale, "/support")},
            {url: getAbsoluteUrl(locale, "/contact")},
            {url: getAbsoluteUrl(locale, "/earn-on-animaldex")},
            {url: getAbsoluteUrl(locale, "/become-a-wildlife-guide")},
            {url: getAbsoluteUrl(locale, "/creator-rewards")},
            {url: getAbsoluteUrl(locale, "/sponsor-a-challenge")},
            {url: getAbsoluteUrl(locale, "/wildlife-experiences")},
            {url: getAbsoluteUrl(locale, "/branding")},
            {url: getAbsoluteUrl(locale, "/comparisons")},
            {url: getAbsoluteUrl(locale, "/animal-wisdom")},
            {url: getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH)},
            {url: getAbsoluteUrl(locale, "/locations")},
            {url: getAbsoluteUrl(locale, "/powers")},
            {url: getAbsoluteUrl(locale, "/animal-symbolism")},
            {url: getAbsoluteUrl(locale, "/animal-lessons")},
            {url: getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)},
            {url: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)}
        ];

        const useCaseEntries = useCases.map((entry) => ({
            url: getAbsoluteUrl(locale, `/use-cases/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const speciesPages = sitemapSpeciesEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const collectorLandingPages = collectorPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`)
        }));

        const blogEntries = managedBlogPosts.map((post) => ({
            url: getAbsoluteUrl(locale, `/blog/${post.slug}`),
            lastModified: new Date(post.updatedAt || post.publishedAt)
        }));
        const managedPageEntries = managedPages.map((page) => ({
            url: getAbsoluteUrl(locale, `/${page.slug}`),
            lastModified: new Date(page.updatedAt || page.publishedAt)
        }));

        const answerPageEntries = answerPages.map((entry) => ({
            url: getAbsoluteUrl(locale, `/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
        }));

        const challengePageEntries = mergedChallengeEntries.map((entry) => ({
            url: getAbsoluteUrl(locale, `/comparisons/${entry.slug}`),
            lastModified: new Date(entry.updatedAt)
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
        const discoverPostEntries = discoverPosts.map((post) => ({
            url: getAbsoluteUrl(locale, discoverPostPath(post.postId)),
            lastModified: new Date(post.date),
            changeFrequency: "daily" as const,
            priority: post.hasVideoMedia ? 0.7 : 0.55
        }));
        const supportArticleEntries = listSupportArticles(locale).map((article) => ({
            url: getAbsoluteUrl(locale, getSupportArticlePath(article)),
            lastModified: new Date(article.updatedAt)
        }));

        return [
            ...staticEntries,
            ...useCaseEntries,
            ...speciesPages,
            ...collectorLandingPages,
            ...blogEntries,
            ...managedPageEntries,
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
            ...legendaryEarthBeastPageEntries,
            ...discoverPostEntries,
            ...supportArticleEntries
        ];
    });

    return [
        ...publicLegalEntries,
        ...guideEntries,
        ...localizedEntries
    ];
}

function escapeXml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export function serializeSitemapXml(entries: MetadataRoute.Sitemap) {
    const urls = entries.map((entry) => {
        const extended = entry as MetadataRoute.Sitemap[number] & {
            changeFrequency?: string;
            priority?: number;
        };
        const lastModified = extended.lastModified
            ? `<lastmod>${new Date(extended.lastModified).toISOString()}</lastmod>`
            : "";
        const changeFrequency = extended.changeFrequency
            ? `<changefreq>${extended.changeFrequency}</changefreq>`
            : "";
        const priority = extended.priority !== undefined
            ? `<priority>${extended.priority}</priority>`
            : "";

        return `<url><loc>${escapeXml(extended.url)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    }).join("");

    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
