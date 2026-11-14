import {appStoreUrl, googlePlayUrl} from "@/lib/store-links";
import {socialProfileUrlList} from "@/lib/social-links";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getSiteUrl} from "@/lib/site";

/**
 * schema.org builders shared by the pages (SEO lane S3, 2026-11-12). Each
 * returns one plain JSON-LD object; `jsonLdHtml` serialises one or more for a
 * `<script type="application/ld+json">`. Every claim is one the site can back:
 * no ratings, no review counts, no population figures for the wild.
 *
 * `checkJsonLd` (structured-data-check.ts) validates them in the tests.
 */

export type JsonLd = Record<string, unknown> & {"@type": string | string[]};

const CONTEXT = "https://schema.org";

/** The brand's logo and the store pages: one identity everywhere. */
export function brandLogoUrl(): string {
    return getAbsoluteAssetUrl("/images/logo.webp");
}

/** The organisation behind AnimalDex: its public name, and the operator the privacy policy names. */
/** The brand's slogan (owner, 2026-11-14): in the footer, the home hero, the default description and here. */
export const BRAND_SLOGAN = "Every animal has a lesson.";

export function organizationJsonLd(): JsonLd {
    const site = getSiteUrl();
    return {
        "@context": CONTEXT,
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: "AnimalDex",
        legalName: "GHOSTSEED LTD",
        url: `${site}/`,
        logo: brandLogoUrl(),
        slogan: BRAND_SLOGAN,
        sameAs: [appStoreUrl, googlePlayUrl, ...socialProfileUrlList]
    };
}

/** A reference to the organisation, for `publisher` and `author`. */
export function organizationRef(): JsonLd {
    const site = getSiteUrl();
    return {"@type": "Organization", "@id": `${site}/#organization`, name: "AnimalDex", url: `${site}/`};
}

/**
 * The app as one entity: MobileApplication is a SoftwareApplication, so one
 * node says both. Free to download (in-app purchases exist; no price is claimed
 * beyond the free download).
 */
export function animalDexAppJsonLd(input: {description: string; image?: string; featureList?: string[]; inLanguage?: string}): JsonLd {
    const site = getSiteUrl();
    return {
        "@context": CONTEXT,
        "@type": "MobileApplication",
        "@id": `${site}/#app`,
        name: "AnimalDex",
        description: input.description,
        url: `${site}/`,
        operatingSystem: "iOS, Android",
        applicationCategory: "EducationApplication",
        installUrl: [appStoreUrl, googlePlayUrl],
        downloadUrl: [appStoreUrl, googlePlayUrl],
        ...(input.image ? {image: getAbsoluteAssetUrl(input.image)} : {}),
        ...(input.inLanguage ? {inLanguage: input.inLanguage} : {}),
        ...(input.featureList?.length ? {featureList: input.featureList} : {}),
        offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
        publisher: organizationRef()
    };
}

export type BreadcrumbItem = {name: string; path: string};

/** Where a page sits: Home first, then each level, the page itself last. Paths are locale-free. */
export function breadcrumbJsonLd(locale: string, items: BreadcrumbItem[]): JsonLd {
    return {
        "@context": CONTEXT,
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: getAbsoluteUrl(locale, item.path)
        }))
    };
}

export type WebPageInput = {
    locale: string;
    path: string;
    name: string;
    description: string;
    image?: string;
    dateModified?: string;
    /** "WebPage" (default), "AboutPage" or "CollectionPage". */
    type?: "WebPage" | "AboutPage" | "CollectionPage";
    about?: JsonLd | JsonLd[];
    mainEntity?: JsonLd;
};

export function webPageJsonLd(input: WebPageInput): JsonLd {
    const url = getAbsoluteUrl(input.locale, input.path);
    return {
        "@context": CONTEXT,
        "@type": input.type ?? "WebPage",
        "@id": `${url}#webpage`,
        name: input.name,
        description: input.description,
        url,
        inLanguage: input.locale,
        isPartOf: {"@type": "WebSite", "@id": `${getSiteUrl()}/#website`, name: "AnimalDex", url: `${getSiteUrl()}/`},
        publisher: organizationRef(),
        ...(input.image ? {image: getAbsoluteAssetUrl(input.image)} : {}),
        ...(input.dateModified ? {dateModified: input.dateModified} : {}),
        ...(input.about ? {about: input.about} : {}),
        ...(input.mainEntity ? {mainEntity: input.mainEntity} : {})
    };
}

/**
 * A species as a schema.org Taxon: its scientific name, its common name as an
 * alternate, the rank "species" only for a binomial, and its genus (the
 * binomial's first word) as the parent. Null when there is no usable
 * scientific name: the page then claims no taxon at all.
 */
export function speciesTaxonJsonLd(input: {scientificName: string | null | undefined; commonName: string; url?: string}): JsonLd | null {
    const scientific = (input.scientificName ?? "").replace(/\s+/g, " ").trim();
    // "Genus species" or "Genus species subspecies", Latin letters only: anything else is not claimed as a binomial.
    const match = scientific.match(/^([A-Z][a-z]+) ([a-z][a-z-]+)( [a-z][a-z-]+)?$/);
    if (!match) return null;
    const rank = match[3] ? "subspecies" : "species";
    return {
        "@context": CONTEXT,
        "@type": "Taxon",
        name: scientific,
        alternateName: input.commonName,
        taxonRank: rank,
        parentTaxon: {"@type": "Taxon", name: match[1], taxonRank: "genus"},
        ...(input.url ? {url: input.url} : {})
    };
}

/**
 * The Ark as schema.org says it (S1's D5): a free interactive simulation in the
 * browser (WebApplication), part of the app, about ecology topics. Never a
 * video game, and no population figures.
 */
export function arkJsonLd(input: {locale: string; name: string; description: string; image: string}): JsonLd {
    const url = getAbsoluteUrl(input.locale, "/ark");
    const site = getSiteUrl();
    return {
        "@context": CONTEXT,
        "@type": "WebApplication",
        "@id": `${getAbsoluteUrl("en", "/ark")}#ark`,
        name: input.name,
        url,
        description: input.description,
        inLanguage: input.locale,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires a browser with WebGL",
        isAccessibleForFree: true,
        image: getAbsoluteAssetUrl(input.image),
        offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
        about: ARK_TOPICS.map((name) => ({"@type": "Thing", name})),
        publisher: organizationRef(),
        isPartOf: {"@type": "MobileApplication", "@id": `${site}/#app`, name: "AnimalDex", url: `${site}/`}
    };
}

/** /talk as schema.org says it: a free chat in the browser with animals, each from its own field guide; part of the app. */
export function talkJsonLd(input: {locale: string; name: string; description: string; image: string}): JsonLd {
    const site = getSiteUrl();
    return {
        "@context": CONTEXT,
        "@type": "WebApplication",
        "@id": `${getAbsoluteUrl("en", "/talk")}#talk`,
        name: input.name,
        url: getAbsoluteUrl(input.locale, "/talk"),
        description: input.description,
        inLanguage: input.locale,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (web browser)",
        isAccessibleForFree: true,
        image: getAbsoluteAssetUrl(input.image),
        offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
        publisher: organizationRef(),
        isPartOf: {"@type": "MobileApplication", "@id": `${site}/#app`, name: "AnimalDex", url: `${site}/`}
    };
}

/** What the Ark is about, for search: said as topics, never as claims. */
export const ARK_TOPICS = ["Ecosystem simulation", "Food chain", "Animal behaviour", "Wildlife", "Population dynamics"];

/**
 * The home page's structured data (S1's audit: one app entity, no invalid
 * SearchAction, the world positioning): the organisation, the website and the
 * app. `words` are the page's own (`meta.*`), in its locale.
 */
export function homeJsonLd(input: {locale: string; name: string; description: string; image: string; featureList: string[]; /** The app's own description when it differs from the site's (`home.intro`). */ appDescription?: string}): JsonLd[] {
    const site = getSiteUrl();
    return [
        organizationJsonLd(),
        {
            "@context": CONTEXT,
            "@type": "WebSite",
            "@id": `${site}/#website`,
            name: "AnimalDex",
            url: `${site}/`,
            description: input.description,
            inLanguage: input.locale,
            image: getAbsoluteAssetUrl(input.image),
            publisher: organizationRef()
        },
        animalDexAppJsonLd({description: input.appDescription || input.description, image: input.image, featureList: input.featureList, inLanguage: input.locale})
    ];
}

/** One or more JSON-LD objects as the text of a script tag (`<` escaped, so no string can close the tag). */
export function jsonLdHtml(data: JsonLd | JsonLd[]): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
