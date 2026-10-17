/**
 * Checks one location data file (or every group) before it joins the build:
 * species slugs exist as published pages, rosters are long enough, slugs are
 * unique and not already taken, and every field a page needs is present.
 *
 *   npx tsx scripts/validateLocationPages.mts src/data/locations/europe-west.ts
 *   npx tsx scripts/validateLocationPages.mts            (every group file)
 */
import {createRequire} from "node:module";
import {readdirSync} from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {id: "server-only", filename: "server-only", loaded: true, exports: {}} as never;

const {speciesEntries} = await import("../src/data/species");
const publishedSlugs = (await import("../src/data/published-seo-slugs.json", {with: {type: "json"}})).default as {animals: string[]};
const {getRankingPage} = await import("../src/data/rankings");
const {getChallenge} = await import("../src/data/challenges");
const {getBlogPost} = await import("../src/data/blog");

const staticSlugs = new Set((speciesEntries as Array<{slug: string}>).map((entry) => entry.slug));
const dbSlugs = new Set(publishedSlugs.animals);
const speciesExists = (slug: string) => staticSlugs.has(slug) || dbSlugs.has(slug);

const groupDir = path.resolve("src/data/locations");
const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((file) => path.resolve(file))
    : readdirSync(groupDir).filter((file) => file.endsWith(".ts")).map((file) => path.join(groupDir, file));

// Slugs the hand-written file already owns.
const legacySource = (await import("node:fs")).readFileSync(path.resolve("src/data/locations.ts"), "utf8");
const legacySlugs = new Set(Array.from(legacySource.matchAll(/^\s{8}slug: "([^"]+)",/gm)).map((match) => match[1]));

const allSlugs = new Map<string, string>();
const problems: string[] = [];
let pageCount = 0;

for (const file of files) {
    const mod = await import(file) as Record<string, unknown>;
    const pages = Object.values(mod).find((value) => Array.isArray(value)) as Array<Record<string, any>> | undefined;
    if (!pages) {
        problems.push(`${path.basename(file)}: exports no array`);
        continue;
    }
    for (const page of pages) {
        pageCount++;
        const where = `${path.basename(file)} › ${page.slug ?? "(no slug)"}`;
        const need = ["slug", "name", "regionType", "title", "description", "searchIntents", "quickAnswer", "introduction", "whyItMatters", "animalsToSpot", "bestFor", "spottingTips", "faq", "hubRegion", "countryCode", "coordinate", "captureArea"];
        for (const key of need) {
            if (page[key] == null || (Array.isArray(page[key]) && page[key].length === 0)) problems.push(`${where}: missing ${key}`);
        }
        if (page.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(page.slug)) problems.push(`${where}: slug must be lowercase-hyphenated`);
        if (page.slug && legacySlugs.has(page.slug)) problems.push(`${where}: slug already exists in src/data/locations.ts`);
        if (page.slug && allSlugs.has(page.slug)) problems.push(`${where}: duplicate slug (also in ${allSlugs.get(page.slug)})`);
        if (page.slug) allSlugs.set(page.slug, path.basename(file));
        const animals: Array<{speciesSlug: string; whyItFits?: string}> = page.animalsToSpot ?? [];
        if (animals.length < 10) problems.push(`${where}: only ${animals.length} animals (need 10+)`);
        const seen = new Set<string>();
        for (const animal of animals) {
            if (seen.has(animal.speciesSlug)) problems.push(`${where}: duplicate animal ${animal.speciesSlug}`);
            seen.add(animal.speciesSlug);
            if (!speciesExists(animal.speciesSlug)) problems.push(`${where}: unknown species slug ${animal.speciesSlug}`);
            if (!animal.whyItFits || animal.whyItFits.length < 40) problems.push(`${where}: ${animal.speciesSlug} whyItFits too short`);
        }
        if ((page.faq ?? []).length < 3) problems.push(`${where}: need 3+ FAQ entries`);
        if ((page.searchIntents ?? []).length < 5) problems.push(`${where}: need 5+ searchIntents`);
        if (!/[A-Z]{2}/.test(page.countryCode ?? "")) problems.push(`${where}: countryCode must be ISO alpha-2`);
        const c = page.coordinate;
        if (c && (Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180 || !(c.zoom >= 2 && c.zoom <= 14))) problems.push(`${where}: bad coordinate`);
        const area = page.captureArea ?? {};
        if (!area.countryCodes && !area.bbox) problems.push(`${where}: captureArea needs countryCodes or bbox`);
        if (area.bbox && !(area.bbox.north > area.bbox.south && area.bbox.east > area.bbox.west)) problems.push(`${where}: bbox north/east must exceed south/west`);
        for (const slug of page.rankingSlugs ?? []) if (!getRankingPage(slug)) problems.push(`${where}: unknown rankingSlug ${slug}`);
        for (const slug of page.challengeSlugs ?? []) if (!getChallenge(slug)) problems.push(`${where}: unknown challengeSlug ${slug}`);
        for (const slug of page.blogSlugs ?? []) if (!getBlogPost(slug)) problems.push(`${where}: unknown blogSlug ${slug}`);
        if (page.featuredImage) problems.push(`${where}: leave featuredImage out; hero images are attached from location-hero-images.json`);
    }
}

// Related/parent slugs may point at legacy pages or any group file.
for (const file of files) {
    const mod = await import(file) as Record<string, unknown>;
    const pages = (Object.values(mod).find((value) => Array.isArray(value)) ?? []) as Array<Record<string, any>>;
    for (const page of pages) {
        for (const slug of [...(page.relatedLocationSlugs ?? []), ...(page.parentSlug ? [page.parentSlug] : [])]) {
            if (!legacySlugs.has(slug) && !allSlugs.has(slug)) problems.push(`${path.basename(file)} › ${page.slug}: related/parent slug ${slug} is not a location page`);
        }
    }
}

console.log(`${pageCount} pages in ${files.length} file(s)`);
if (problems.length) {
    console.log(problems.join("\n"));
    process.exit(1);
}
console.log("ok");
