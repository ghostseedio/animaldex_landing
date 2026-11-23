import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import robots from "@/app/robots";
import {templateSafeTitle} from "@/lib/brand-title";
import {checkJsonLd} from "@/lib/seo/structured-data-check";
import {animalDexAppJsonLd, articleAuthorship, ogCardImageUrl} from "@/lib/seo/structured-data";
import {nameLead} from "@/lib/species-name-lead";
import {parseSpeciesImageFile, speciesImagePath, speciesImageUrl} from "@/lib/species-image-path";

/**
 * SEO pass, 2026-11-21: a live audit of 1,053 sitemap URLs found the app's
 * applicationCategory off Google's list, Article images under the
 * robots-disallowed /api/, authors with no url, the scientific name twice in
 * some species descriptions, and over-long titles on the Power, Pokemon,
 * hybrid, video and Help pages.
 */

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const COMPOSITED = "src/app/[locale]/(composited)";

function robotsBlocks(url: string): boolean {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const pathname = new URL(url).pathname;
    const allow = ([] as string[]).concat(rule.allow ?? []);
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    const longest = (list: string[]) => Math.max(-1, ...list.filter((prefix) => pathname.startsWith(prefix)).map((prefix) => prefix.length));
    return longest(disallow) > longest(allow);
}

test("the app's applicationCategory is one Google accepts, and the check catches one it does not", () => {
    const app = animalDexAppJsonLd({description: "Catch real animals."});
    assert.equal(app.applicationCategory, "EducationalApplication");
    assert.deepEqual(checkJsonLd(app), []);
    const issues = checkJsonLd({...app, applicationCategory: "EducationApplication"});
    assert.ok(issues.some((issue) => issue.message.includes("application categories")));
});

test("Article authorship names the organisation with its url, and the publisher with its logo", () => {
    const {author, publisher} = articleAuthorship();
    assert.match(String(author.url), /^https:\/\//);
    assert.match(String(publisher.logo), /^https:\/\/.+\/images\/logo\.webp$/);
    const article = {"@context": "https://schema.org", "@type": "Article", headline: "Red Fox", image: ogCardImageUrl("species", "red-fox"), ...articleAuthorship()};
    assert.deepEqual(checkJsonLd(article), []);
});

test("JSON-LD share-card images are absolute and robots.txt lets Google fetch them", () => {
    for (const url of [ogCardImageUrl("species", "red-fox"), ogCardImageUrl("lesson", "red-fox"), ogCardImageUrl("support", "getting-started", "where-is-animaldex-available")]) {
        assert.match(url, /^https?:\/\/[^/]+\/api\/og\/.+\.png$/);
        assert.equal(robotsBlocks(url), false, url);
    }
    // What the species Article named before: the artwork redirect, under the disallowed /api/.
    assert.equal(robotsBlocks("https://animaldex.app/api/species-artwork/red-fox"), true);
});

test("the species page's Article and video fallback use the share card, not the artwork route", () => {
    const page = read(`${COMPOSITED}/animals/[slug]/page.tsx`);
    assert.match(page, /image: \[ogCardImageUrl\("species", entry\.slug\), \.\.\.\(ownArtworkUrl \? \[ownArtworkUrl\] : \[\]\)\]/);
    assert.match(page, /fallbackThumbnailUrl: ogCardImageUrl\("species", entry\.slug\)/);
    assert.doesNotMatch(page, /image: getAbsoluteUrl\(locale, getSpeciesImageRoute/);
});

test("a field-guide sentence that already names the binomial keeps it once", () => {
    assert.equal(
        nameLead("Burrowing Parrot", "Cyanoliseus patagonus", "The burrowing parrot (Cyanoliseus patagonus) is a loud colonial parrot."),
        "The burrowing parrot (Cyanoliseus patagonus) is a loud colonial parrot."
    );
    assert.equal(nameLead("Red Fox", "Vulpes vulpes", "The red fox is a versatile canid."), "The red fox (Vulpes vulpes) is a versatile canid.");
    assert.equal(nameLead("Snowy Owl", "Bubo scandiacus", "A large white owl."), "Snowy Owl (Bubo scandiacus): A large white owl.");
});

test("long Power, Pokemon, hybrid, video and Help titles drop the brand instead of running past a result", () => {
    assert.deepEqual(
        templateSafeTitle("What Can We Learn from the Tent-making Bat? The Power of Folded Leaf Home | AnimalDex"),
        {absolute: "What Can We Learn from the Tent-making Bat? The Power of Folded Leaf Home"}
    );
    assert.equal(templateSafeTitle("Capybara (Video)"), "Capybara (Video)");
    assert.match(read(`${COMPOSITED}/(answers)/animal-powers/[slug]/page.tsx`), /title: templateSafeTitle\(title\)/);
    assert.match(read(`${COMPOSITED}/pokemon-animals/[slug]/page.tsx`), /title: templateSafeTitle\(title\)/);
    assert.match(read(`${COMPOSITED}/animal-hybrids/[slug]/page.tsx`), /title: templateSafeTitle\(`\$\{entry\.title\}: How It Might Look and Behave`\)/);
    assert.match(read(`${COMPOSITED}/videos/[type]/[slug]/page.tsx`), /title: templateSafeTitle\(title\)/);
    const support = read(`${COMPOSITED}/support/[categorySlug]/[articleSlug]/page.tsx`);
    assert.doesNotMatch(support, /AnimalDex Help Center`/);
    assert.match(support, /templateSafeTitle\(`\$\{article\.title\} — AnimalDex Help`\)/);
});

test("a one-word Help summary is not the whole result snippet", () => {
    const support = read(`${COMPOSITED}/support/[categorySlug]/[articleSlug]/page.tsx`);
    assert.match(support, /article\.summary\.trim\(\)\.length >= 70/);
});

test("the same-origin species image path: kebab-case slugs only, robots-allowed, and the route is no open proxy", () => {
    assert.equal(speciesImagePath("Red-Fox"), "/img/species/red-fox.webp");
    assert.match(speciesImageUrl("red-fox"), /^https?:\/\/[^/]+\/img\/species\/red-fox\.webp$/);
    assert.equal(robotsBlocks(speciesImageUrl("red-fox")), false);
    assert.equal(parseSpeciesImageFile("red-fox.webp"), "red-fox");
    for (const bad of ["red-fox.png", "../red-fox.webp", "red fox.webp", "https:%2F%2Fevil.example%2Fx.webp", "Red-Fox.webp", "-fox.webp", ".webp", `${"a".repeat(121)}.webp`]) {
        assert.equal(parseSpeciesImageFile(bad), null, bad);
    }
    const route = read("src/app/img/species/[file]/route.ts");
    // One host and one bucket (getSpeciesArtworkUrl), only the slug's own file, raster types only, no robots header.
    assert.match(route, /getExactSpeciesArtworkFile\(slug\)/);
    assert.match(route, /getSpeciesArtworkUrl\(slug, file\)/);
    assert.doesNotMatch(route, /searchParams|request\.url/);
    assert.doesNotMatch(route, /image\/svg/);
    assert.doesNotMatch(route, /"X-Robots-Tag":/i);
    assert.match(route, /s-maxage=2592000/);
    // The middleware skips paths with a dot, so no locale redirect lands on it.
    assert.ok(read("src/middleware.ts").includes(String.raw`.*\\..*`));
});

test("/p and /guides structured data name crawlable images, not the capture renditions under /api/", () => {
    const post = read("src/app/[locale]/p/[postId]/page.tsx");
    assert.match(post, /discoverPostJsonLd\(seo, \{pageUrl, imageUrl: ldImages/);
    assert.match(post, /ogCardImageUrl\("species", animal\.slug\)/);
    const guide = read(`${COMPOSITED}/guides/[listing]/page.tsx`);
    assert.match(guide, /guideStructuredData\(guide, canonicalUrl, guideStructuredDataImages\(guide\)\)/);
});
