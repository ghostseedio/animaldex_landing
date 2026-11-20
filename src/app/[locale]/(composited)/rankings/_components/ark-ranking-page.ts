import type {Metadata} from "next";
import {getRankingHeadline, getRankingPage} from "@/data/rankings";
import {ARK_RANKING_IMAGE, ARK_RANKING_PUBLISHED, ARK_RANKING_RELATED, ARK_RANKING_SLUGS, arkRankingPath, type ArkRankingSlug} from "@/data/ark-ranking-pages";
import {buildSpeciesArtworkSrc} from "@/data/species-artwork-index";
import {localeConfig} from "@/i18n";
import {arkDirection} from "@/lib/ark-languages";
import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import type {ArkRankingsWords} from "@/lib/ark-rankings-words";
import {arkTimeLeftWordsFrom} from "@/lib/ark-time-left";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteAssetUrl, getAbsoluteUrl} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";
import {getScopedTranslator} from "@/loaders/translation";

/**
 * What the two Ark ranking pages share: the locale and the Ark language (any of the 45, on /tier-list/<slug>/lang/<language>;
 * `?lang=<language>` on the plain URL redirects there, so every page is static and cached like the tier lists), the words, the metadata and structured data the animal tier lists carry, and the related
 * lists that name one another and the tier lists beside them.
 */

/** The page's locale (the site's: en or id) and, on /tier-list/<slug>/lang/<language>, the Ark language it is read in (null on the plain URL). */
export type ArkRankingProps = {locale: string; lang?: string | null};

export function pageLocale(locale: string): string {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function arkRankingContext(props: ArkRankingProps) {
    const locale = pageLocale(props.locale);
    const lang = props.lang ?? null;
    const {words, language} = await getArkWords(locale, lang);
    // The words are merged with English key by key, so every key is there; the optional type is for an older bundle.
    const rankings = words.rankings as ArkRankingsWords;
    return {
        locale,
        lang,
        words,
        rankings,
        language,
        /** The language numbers, dates and lists are written in. */
        readerLocale: lang ? language : locale,
        dir: arkDirection(language),
        time: arkTimeLeftWordsFrom(words.timeLeft, words.life)
    };
}

/** The page's metadata, the way the tier lists build it; a page read in another language than the site's is not indexed (its canonical is the one URL). */
export function arkRankingMetadata({locale, lang, slug, title, description, keywords, updatedAt}: {locale: string; lang: string | null; slug: ArkRankingSlug; title: string; description: string; keywords: string[]; updatedAt: string}): Metadata {
    const metadata = buildContentMetadata({
        locale,
        pathname: arkRankingPath(slug),
        title,
        description,
        keywords,
        featuredImage: ARK_RANKING_IMAGE,
        publishedAt: ARK_RANKING_PUBLISHED,
        updatedAt,
        tags: ["ark", slug]
    });
    return lang ? {...metadata, robots: {index: false, follow: true}} : metadata;
}

/** A species icon: the catalogue's artwork route, or the generic figure for a species with no model (`placeholder--…`). */
export function arkIconOf(slug: string): string {
    return isArkPlaceholderSlug(slug) ? ARK_PLACEHOLDER_ICON : buildSpeciesArtworkSrc(slug, null);
}

export function arkArticleSchema({locale, slug, title, description, modifiedAt}: {locale: string; slug: ArkRankingSlug; title: string; description: string; modifiedAt: string}) {
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        datePublished: ARK_RANKING_PUBLISHED,
        dateModified: modifiedAt,
        inLanguage: locale,
        url: getAbsoluteUrl(locale, arkRankingPath(slug)),
        image: getAbsoluteAssetUrl(ARK_RANKING_IMAGE.src),
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"}
    };
}

export function arkItemListSchema(locale: string, items: Array<{name: string; path: string}>) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items.map((item, index) => ({"@type": "ListItem", position: index + 1, name: item.name, url: getAbsoluteUrl(locale, item.path)}))
    };
}

export function arkFaqSchema(items: Array<{question: string; answer: string}>) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({"@type": "Question", name: item.question, acceptedAnswer: {"@type": "Answer", text: item.answer}}))
    };
}

export function arkBreadcrumbSchema(locale: string, slug: ArkRankingSlug, names: {home: string; lists: string; page: string}) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {"@type": "ListItem", position: 1, name: names.home, item: getAbsoluteUrl(locale)},
            {"@type": "ListItem", position: 2, name: names.lists, item: getAbsoluteUrl(locale, "/tier-list")},
            {"@type": "ListItem", position: 3, name: names.page, item: getAbsoluteUrl(locale, arkRankingPath(slug))}
        ]
    };
}

/**
 * The related rankings of an Ark page: the other Ark page, then the animal tier lists nearest it (resilience and
 * endurance for survival, mating drive and adaptability for breeding), as many as the grid holds.
 */
export async function arkRelatedItems(slug: ArkRankingSlug, locale: string, rankings: ArkRankingsWords, limit = 3) {
    const t = await getScopedTranslator(locale, "rankings");
    const other = ARK_RANKING_SLUGS.find((candidate) => candidate !== slug)!;
    const titles: Record<ArkRankingSlug, {title: string; description: string}> = {
        "ark-survival": {title: rankings.survival.title, description: rankings.survival.description},
        "ark-fastest-breeders": {title: rankings.breeders.title, description: rankings.breeders.description}
    };
    const alongside = slug === "ark-survival" ? ["most-resilient-animals", "most-adaptable-animals"] : ["animals-with-highest-mating-drive", "most-adaptable-animals"];
    const items: Array<{slug: string; title: string; description: string; categoryLabel: string}> = [{slug: other, title: titles[other].title, description: titles[other].description, categoryLabel: rankings.category}];
    for (const related of alongside) {
        const page = getRankingPage(related);
        if (page && items.length < limit) items.push({slug: page.slug, title: getRankingHeadline(page), description: page.description, categoryLabel: t(`categories.${page.category}`)});
    }
    return items;
}

/** The Ark page an existing tier list of this category names among its related lists, if any. */
export function arkRankingRelatedTo(category: string): ArkRankingSlug | null {
    return ARK_RANKING_RELATED[category] ?? null;
}

/** One Ark page as a related-rankings card. */
export function arkRelatedCard(slug: ArkRankingSlug, rankings: ArkRankingsWords) {
    const page = slug === "ark-survival" ? rankings.survival : rankings.breeders;
    return {slug, title: page.title, description: page.description, categoryLabel: rankings.category};
}
