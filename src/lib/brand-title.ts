const BRAND = "AnimalDex";
const BRAND_SUFFIX = /\s*\|\s*AnimalDex\s*$/i;

/**
 * Removes a trailing " | AnimalDex" from a title.
 *
 * The root layout's title template (src/app/[locale]/layout.tsx) already
 * appends " | AnimalDex", so a plain metadata title that carries the brand
 * itself renders as "… | AnimalDex | AnimalDex". Copy from locale keys, data
 * files and the CMS often includes the suffix, so strip it at the metadata site.
 */
export function stripBrandSuffix(title: string): string {
    return title.replace(BRAND_SUFFIX, "");
}

/**
 * The `title` to hand Next.js metadata so the rendered <title> names the brand
 * exactly once: brand-free copy goes through the layout template, and copy whose
 * wording already mentions AnimalDex ("… into AnimalDex") is used as-is.
 */
export function templateSafeTitle(title: string): string | {absolute: string} {
    const stripped = stripBrandSuffix(title);
    if (stripped.includes(BRAND)) return {absolute: stripped};
    // A long title would push the brand past what a result shows (about 60 characters): it goes without the suffix (SEO lane S3).
    return stripped.length + BRAND_TEMPLATE_LENGTH > TITLE_MAX ? {absolute: stripped} : stripped;
}

/** " | AnimalDex", the layout template's tail. */
const BRAND_TEMPLATE_LENGTH = ` | ${BRAND}`.length;
/** About what a search result shows of a title. */
export const TITLE_MAX = 62;

/** A full title for openGraph/twitter (no layout template there) with the brand once. */
export function withBrandSuffix(title: string): string {
    const stripped = stripBrandSuffix(title);
    return stripped.includes(BRAND) ? stripped : `${stripped} | ${BRAND}`;
}
