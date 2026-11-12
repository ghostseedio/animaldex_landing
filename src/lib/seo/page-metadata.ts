import type {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {templateSafeTitle, withBrandSuffix} from "@/lib/brand-title";
import {isCollapsedEnglishDetailPath} from "@/lib/english-detail-routes";
import {getAbsoluteAssetUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

/**
 * One page's metadata, built the same way everywhere (SEO lane S3, 2026-11-12):
 * a title the layout template brands once, a description cut to what a result
 * shows, the canonical, hreflang for every site locale plus x-default, and the
 * Open Graph and Twitter cards with one image.
 *
 * Paths are site paths without the locale ("/ark/how-it-works"); Next resolves
 * them against the root layout's `metadataBase`.
 */

/** What a search result shows of a description, about; longer ones are cut there. */
export const META_DESCRIPTION_MAX = 160;

/**
 * A description no longer than `max`: whole sentences when they fit, else cut
 * at the last word boundary with an ellipsis. Whitespace is collapsed.
 */
export function clampMetaDescription(text: string, max = META_DESCRIPTION_MAX): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const sentences = clean.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
    let kept = "";
    for (const sentence of sentences) {
        const next = (kept + sentence).trim();
        if (next.length > max) break;
        kept = next + " ";
    }
    kept = kept.trim();
    // A first sentence that is too short to stand alone reads worse than a cut one.
    if (kept.length >= Math.min(90, max * 0.6)) return kept;
    const cut = clean.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/**
 * hreflang for a path: every site locale and x-default (the default locale's
 * URL). Collapsed English detail families (`/animals/<slug>` and the like) and
 * pages written in English only get `en` and x-default alone, so no hreflang
 * ever points at a URL that redirects.
 */
export function languageAlternates(path: string, options: {englishOnly?: boolean} = {}): Record<string, string> {
    const englishOnly = options.englishOnly || isCollapsedEnglishDetailPath(path || "/");
    const locales = englishOnly ? [localeConfig.defaultLocale] : localeConfig.locales;
    const languages: Record<string, string> = {};
    for (const locale of locales) languages[locale] = getLocalePath(locale, path);
    languages["x-default"] = getLocalePath(localeConfig.defaultLocale, path);
    return languages;
}

export type PageMetadataInput = {
    locale: string;
    /** The page's path without the locale prefix, e.g. "/ark/food-chain". */
    path: string;
    /** Without the brand: the layout template adds " | AnimalDex". */
    title: string;
    description: string;
    /** A site path ("/api/og/…") or an absolute URL, 1200×630. */
    image: string;
    imageAlt: string;
    imageWidth?: number;
    imageHeight?: number;
    /** Open Graph type: "website" (default) or "article". */
    type?: "website" | "article";
    /** Only the default locale exists for this page. */
    englishOnly?: boolean;
    keywords?: string[];
    modifiedTime?: string;
    /** noindex, follow (the page stays out of search; its links are still followed). */
    noindex?: boolean;
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
    const description = clampMetaDescription(input.description);
    const canonical = getLocalePath(input.englishOnly ? localeConfig.defaultLocale : input.locale, input.path);
    const fullTitle = withBrandSuffix(input.title);
    const image = getAbsoluteAssetUrl(input.image);
    const width = input.imageWidth ?? 1200;
    const height = input.imageHeight ?? 630;
    return {
        title: templateSafeTitle(input.title),
        description,
        ...(input.keywords?.length ? {keywords: input.keywords} : {}),
        alternates: {canonical, languages: languageAlternates(input.path, {englishOnly: input.englishOnly})},
        openGraph: {
            type: input.type ?? "website",
            locale: getMetadataLocale(input.locale),
            title: fullTitle,
            description,
            url: canonical,
            siteName: "AnimalDex",
            images: [{url: image, width, height, alt: input.imageAlt}],
            ...(input.type === "article" && input.modifiedTime ? {modifiedTime: input.modifiedTime} : {})
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            images: [{url: image, alt: input.imageAlt}]
        },
        ...(input.noindex ? {robots: {index: false, follow: true}} : {})
    };
}
