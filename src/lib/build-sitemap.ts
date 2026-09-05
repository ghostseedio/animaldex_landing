import {MetadataRoute} from "next";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl} from "@/lib/site";
import {serializeSitemapXml, uniqueSitemapEntries} from "@/lib/sitemap-xml";
import {useCases} from "@/data/use-cases";
import {collectorPages} from "@/data/collector-pages";
import {getManagedBlogPosts, getManagedPages} from "@/lib/admin-content";
import {answerPages} from "@/data/answer-pages";
import {challengeEntries} from "@/data/challenges";
import comparisonSnapshot from "@/data/published-seo-comparison-pages.json";
import closedSeoNamespaceSlugs from "@/data/closed-seo-namespace-slugs.json";
import {rankingPages, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {locationPages} from "@/data/locations";
import {isPlaceCollectionIndexable} from "@/data/location-places";
import {POKEMON_ANIMAL_CANONICAL_BASE_PATH, pokemonAnimalEntries, pokemonAnimalGenerations} from "@/data/pokemon-animal-counterparts";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getBehaviorLessonIndex, getLocalPrincipleSlugs, getPrincipleHubIndex} from "@/data/species-behavior-lessons";
import {getSitemapSpeciesEntries} from "@/data/database-species-pages";
import {getDiscoverCapturePostsForSitemap} from "@/data/discover-timeline";
import {discoverPostPath} from "@/lib/discover-post";
import {speciesEntries} from "@/data/species";
import {legendaryEarthBeastEntries, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH} from "@/data/legendary-earth-beasts";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {buildGuideSitemapPaths, guidePath} from "@/lib/guide-marketplace-core";
import {listSupportArticles, getSupportArticlePath} from "@/lib/support-articles";

function getSitemapChallengeEntries() {
    const allow = new Set(closedSeoNamespaceSlugs.comparisons ?? []);
    const bySlug = new Map<string, {slug: string; updatedAt: string}>();

    for (const entry of challengeEntries) {
        if (allow.size > 0 && !allow.has(entry.slug)) {
            continue;
        }
        bySlug.set(entry.slug, {
            slug: entry.slug,
            updatedAt: entry.updatedAt || entry.publishedAt
        });
    }

    for (const entry of comparisonSnapshot.entries as Array<{slug: string; updatedAt?: string; publishedAt?: string}>) {
        if (allow.size > 0 && !allow.has(entry.slug)) {
            continue;
        }
        if (!bySlug.has(entry.slug)) {
            bySlug.set(entry.slug, {
                slug: entry.slug,
                updatedAt: entry.updatedAt || entry.publishedAt || "2026-09-06"
            });
        }
    }

    return Array.from(bySlug.values());
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

    const guideListingsByPath = new Map(guideListings.map((item) => [guidePath(item), item]));
    const localizedEntries = localeConfig.locales.flatMap((locale) => {
        // Keep /id in the sitemap as a real Indonesian homepage. Do not request
        // indexing of /id copies of English article bodies; those detail URLs
        // 308 to English and must not appear in hreflang.
        if (locale !== localeConfig.defaultLocale) {
            return [
                {url: getAbsoluteUrl(locale)},
                {url: getAbsoluteUrl(locale, "/powers")},
                ...getLocalPrincipleSlugs().map((slug) => ({
                    url: getAbsoluteUrl(locale, `/powers/${slug}`)
                }))
            ];
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
            {url: getAbsoluteUrl(locale, "/wildlife-guides")},
            {url: getAbsoluteUrl(locale, "/branding")},
            {url: getAbsoluteUrl(locale, "/comparisons")},
            {url: getAbsoluteUrl(locale, "/animal-wisdom")},
            {url: getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH)},
            {url: getAbsoluteUrl(locale, "/locations")},
            {url: getAbsoluteUrl(locale, "/powers")},
            {url: getAbsoluteUrl(locale, "/animal-symbolism")},
            {url: getAbsoluteUrl(locale, "/animal-lessons")},
            {url: getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)},
            {url: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)},
            {url: getAbsoluteUrl(locale, "/legal/privacy")},
            {url: getAbsoluteUrl(locale, "/legal/terms")},
            {url: getAbsoluteUrl(locale, "/legal/refunds")}
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
        const guideListingEntries = buildGuideSitemapPaths(guideListings).map((path) => {
            const listing = guideListingsByPath.get(path);
            return {
                url: getAbsoluteUrl(locale, path),
                ...(listing ? {lastModified: new Date(listing.updated_at)} : {})
            };
        });

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
            ...supportArticleEntries,
            ...guideListingEntries
        ];
    });

    return uniqueSitemapEntries(localizedEntries);
}

export {serializeSitemapXml, uniqueSitemapEntries} from "@/lib/sitemap-xml";
