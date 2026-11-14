/**
 * A local schema check for the JSON-LD the site writes (SEO lane S3): no
 * network, no Google. For each type it knows, every property must be one
 * schema.org defines for that type (inherited ones included), the required
 * ones must be there, URLs must be absolute, BreadcrumbList positions must
 * run 1, 2, 3…, and nothing may be null, undefined or empty.
 *
 * The property lists are the schema.org definitions (v28) cut to what the site
 * uses; a type it does not know is reported, so a new type gets checked
 * before it ships.
 */

type Spec = {props: string[]; required?: string[]; urls?: string[]};

const THING = ["@context", "@type", "@id", "name", "alternateName", "description", "url", "image", "sameAs", "identifier", "mainEntityOfPage", "subjectOf", "additionalType", "disambiguatingDescription", "potentialAction"];
const CREATIVE_WORK = [...THING, "about", "author", "publisher", "inLanguage", "isPartOf", "hasPart", "dateModified", "datePublished", "headline", "keywords", "mainEntity", "isAccessibleForFree", "offers", "genre", "audience", "license", "text", "thumbnailUrl", "mentions", "isFamilyFriendly", "creator", "copyrightHolder", "dateCreated"];
const SOFTWARE_APP = [...CREATIVE_WORK, "applicationCategory", "applicationSubCategory", "operatingSystem", "installUrl", "downloadUrl", "featureList", "screenshot", "softwareVersion", "aggregateRating", "review"];

export const STRUCTURED_DATA_SPECS: Record<string, Spec> = {
    // `url` is recommended, not required: a publisher named inline ({name: "AnimalDex"}) is valid.
    Organization: {props: [...THING, "logo", "email", "contactPoint", "founder", "foundingDate", "legalName", "address"], required: ["name"], urls: ["url", "logo", "sameAs"]},
    Person: {props: [...THING, "givenName", "familyName", "jobTitle", "affiliation"], required: ["name"], urls: ["url", "image"]},
    Article: {props: [...CREATIVE_WORK, "articleSection", "articleBody", "wordCount", "speakable"], required: ["headline"], urls: ["url", "image", "mainEntityOfPage"]},
    SocialMediaPosting: {props: [...CREATIVE_WORK, "articleSection", "articleBody", "sharedContent"], required: ["headline"], urls: ["url", "image"]},
    FAQPage: {props: [...CREATIVE_WORK, "breadcrumb"], required: ["mainEntity"]},
    Question: {props: [...CREATIVE_WORK, "acceptedAnswer", "suggestedAnswer", "answerCount"], required: ["name", "acceptedAnswer"]},
    Answer: {props: [...CREATIVE_WORK], required: ["text"]},
    ImageObject: {props: [...CREATIVE_WORK, "contentUrl", "width", "height", "caption", "encodingFormat", "uploadDate", "representativeOfPage"], urls: ["url", "contentUrl"]},
    VideoObject: {props: [...CREATIVE_WORK, "contentUrl", "embedUrl", "duration", "uploadDate", "thumbnailUrl", "width", "height", "caption", "transcript", "encodingFormat"], required: ["name", "thumbnailUrl", "uploadDate"], urls: ["url", "contentUrl", "embedUrl", "thumbnailUrl"]},
    ProfilePage: {props: [...CREATIVE_WORK, "breadcrumb"], required: ["mainEntity"]},
    PropertyValue: {props: [...THING, "value", "propertyID", "unitText"], required: ["name"]},
    WebSite: {props: [...CREATIVE_WORK], required: ["name", "url"], urls: ["url"]},
    WebPage: {props: [...CREATIVE_WORK, "breadcrumb", "primaryImageOfPage", "lastReviewed", "significantLink", "relatedLink"], required: ["name", "url"], urls: ["url", "image"]},
    AboutPage: {props: [...CREATIVE_WORK, "breadcrumb", "primaryImageOfPage", "lastReviewed", "significantLink", "relatedLink"], required: ["name", "url"], urls: ["url", "image"]},
    CollectionPage: {props: [...CREATIVE_WORK, "breadcrumb", "primaryImageOfPage", "lastReviewed", "significantLink", "relatedLink"], required: ["name", "url"], urls: ["url", "image"]},
    MobileApplication: {props: [...SOFTWARE_APP, "carrierRequirements"], required: ["name", "operatingSystem", "applicationCategory", "offers"], urls: ["url", "installUrl", "downloadUrl", "image"]},
    SoftwareApplication: {props: SOFTWARE_APP, required: ["name", "operatingSystem", "applicationCategory", "offers"], urls: ["url", "installUrl", "downloadUrl", "image"]},
    VideoGame: {props: [...SOFTWARE_APP, "gamePlatform", "playMode", "numberOfPlayers", "gameItem"], required: ["name", "url"], urls: ["url", "image"]},
    WebApplication: {props: [...SOFTWARE_APP, "browserRequirements"], required: ["name", "url", "applicationCategory", "offers"], urls: ["url", "image"]},
    Offer: {props: [...THING, "price", "priceCurrency", "availability", "category"], required: ["price", "priceCurrency"]},
    BreadcrumbList: {props: [...THING, "itemListElement", "numberOfItems", "itemListOrder"], required: ["itemListElement"]},
    ItemList: {props: [...THING, "itemListElement", "numberOfItems", "itemListOrder"], required: ["itemListElement"]},
    // A page's own links as navigation (WebPageElement: a CreativeWork; `position` is CreativeWork's).
    SiteNavigationElement: {props: [...CREATIVE_WORK, "position", "cssSelector", "xpath"], required: ["name", "url"], urls: ["url"]},
    ListItem: {props: [...THING, "position", "item", "nextItem", "previousItem"], required: ["position"], urls: ["item"]},
    Taxon: {props: [...THING, "taxonRank", "parentTaxon", "childTaxon", "hasDefinedTerm"], required: ["name"]},
    Thing: {props: THING, required: ["name"]},
    Place: {props: [...THING, "address", "geo", "containedInPlace"], required: ["name"]}
};

export type JsonLdIssue = {path: string; message: string};

function isAbsoluteUrl(value: unknown): boolean {
    return typeof value === "string" && /^https?:\/\/[^\s/]+[^\s]*$/.test(value);
}

function typesOf(node: Record<string, unknown>): string[] {
    const type = node["@type"];
    return Array.isArray(type) ? type.map(String) : typeof type === "string" ? [type] : [];
}

function checkNode(node: unknown, path: string, issues: JsonLdIssue[], top: boolean) {
    if (node === null || node === undefined) {
        issues.push({path, message: "null or undefined value"});
        return;
    }
    if (Array.isArray(node)) {
        if (!node.length) issues.push({path, message: "empty array"});
        node.forEach((item, index) => checkNode(item, `${path}[${index}]`, issues, top));
        return;
    }
    if (typeof node === "string") {
        if (!node.trim()) issues.push({path, message: "empty string"});
        return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (top && record["@context"] !== "https://schema.org") issues.push({path, message: "@context must be https://schema.org"});
    const types = typesOf(record);
    if (!types.length) {
        issues.push({path, message: "no @type"});
        return;
    }
    for (const type of types) {
        const spec = STRUCTURED_DATA_SPECS[type];
        if (!spec) {
            issues.push({path, message: `type ${type} is not in the local schema check`});
            continue;
        }
        for (const key of Object.keys(record)) {
            if (!spec.props.includes(key)) issues.push({path: `${path}.${key}`, message: `${type} has no property ${key}`});
        }
        // A nested node with an @id is a reference to the full node elsewhere: no required properties.
        const reference = !top && typeof record["@id"] === "string";
        for (const key of reference ? [] : spec.required ?? []) {
            if (!(key in record)) issues.push({path, message: `${type} is missing ${key}`});
        }
        for (const key of spec.urls ?? []) {
            if (!(key in record)) continue;
            const value = record[key];
            const values = Array.isArray(value) ? value : [value];
            for (const item of values) {
                if (typeof item === "string" && !isAbsoluteUrl(item)) issues.push({path: `${path}.${key}`, message: `not an absolute URL: ${item}`});
            }
        }
        if (type === "BreadcrumbList" || type === "ItemList") {
            const items = Array.isArray(record.itemListElement) ? record.itemListElement as Array<Record<string, unknown>> : [];
            items.forEach((item, index) => {
                if (item && typeof item === "object" && item.position !== index + 1) {
                    issues.push({path: `${path}.itemListElement[${index}]`, message: `position ${String(item.position)}, expected ${index + 1}`});
                }
            });
            if (type === "BreadcrumbList" && items.length < 2) issues.push({path, message: "a breadcrumb needs at least two levels"});
        }
        if (type === "Offer" && typeof record.price !== "string" && typeof record.price !== "number") issues.push({path, message: "Offer price must be a number or string"});
    }
    for (const [key, value] of Object.entries(record)) {
        if (key === "@context" || key === "@type") continue;
        checkNode(value, `${path}.${key}`, issues, false);
    }
}

/** Every problem the local check finds in one JSON-LD block (an object or an array of them). */
export function checkJsonLd(data: unknown): JsonLdIssue[] {
    const issues: JsonLdIssue[] = [];
    const blocks = Array.isArray(data) ? data : [data];
    blocks.forEach((block, index) => checkNode(block, `$[${index}]`, issues, true));
    return issues;
}

/** The JSON-LD blocks of an HTML page, parsed (a block that does not parse is reported as an issue). */
export function jsonLdBlocksOf(html: string): {blocks: unknown[]; issues: JsonLdIssue[]} {
    const blocks: unknown[] = [];
    const issues: JsonLdIssue[] = [];
    const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = pattern.exec(html))) {
        try {
            blocks.push(JSON.parse(match[1]));
        } catch (error) {
            issues.push({path: `script[${index}]`, message: `does not parse: ${(error as Error).message}`});
        }
        index++;
    }
    return {blocks, issues};
}
