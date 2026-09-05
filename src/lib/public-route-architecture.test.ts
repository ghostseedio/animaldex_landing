import assert from "node:assert/strict";
import {readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join, relative} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const appRoot = join(root, "app");

const DYNAMIC_ALLOWLIST = [
    "app/admin/",
    "app/api/",
    "app/auth/",
    "app/[locale]/(authenticated)/",
    "app/[locale]/(composited)/checkout/page.tsx",
    "app/[locale]/(composited)/u/[handle]/page.tsx",
    "app/[locale]/(composited)/animals/search/page.tsx",
    "app/[locale]/(composited)/blog/feed.xml/route.ts",
    "app/blog/feed.xml/route.ts"
];

const CATALOG_WALK_ALLOWLIST = [
    "app/[locale]/(composited)/rankings/[slug]/page.tsx"
];

const PROHIBITED = [
    {name: "force-dynamic", pattern: /export const dynamic\s*=\s*["']force-dynamic["']/},
    {name: "revalidate=0", pattern: /export const revalidate\s*=\s*0\b/},
    {name: "next-intl server locale", pattern: /from ["']next-intl\/server["']/},
    {name: "cookies()", pattern: /\bcookies\s*\(/},
    {name: "headers()", pattern: /\bheaders\s*\(/},
    {name: "draftMode()", pattern: /\bdraftMode\s*\(/},
    {name: "noStore()", pattern: /\b(?:unstable_)?noStore\s*\(/},
    {name: "cache no-store", pattern: /cache:\s*["']no-store["']/},
    {name: "getAppCaptures", pattern: /\bgetAppCaptures\s*\(/},
    {name: "getSupportChatHref", pattern: /\bgetSupportChatHref\s*\(/},
    {name: "resolveSpeciesArtworkFiles", pattern: /\bresolveSpeciesArtworkFiles\s*\(/}
];

function walk(dir: string, files: string[] = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full, files);
            continue;
        }
        if (entry === "page.tsx" || entry === "layout.tsx" || entry === "route.ts") {
            files.push(full);
        }
    }
    return files;
}

function isAllowlisted(rel: string, list: string[]) {
    return list.some((prefix) => rel.startsWith(prefix) || rel === prefix);
}

test("indexable public routes do not introduce request-dynamic contaminants", () => {
    const files = walk(appRoot);
    const violations: string[] = [];

    for (const file of files) {
        const rel = relative(root, file).replaceAll("\\", "/");
        if (isAllowlisted(rel, DYNAMIC_ALLOWLIST)) {
            continue;
        }

        const source = readFileSync(file, "utf8");
        for (const rule of PROHIBITED) {
            if (rule.pattern.test(source)) {
                violations.push(`${rel}: ${rule.name}`);
            }
        }
    }

    assert.deepEqual(violations, []);
});

test("public single-content pages cannot full-catalog walk", () => {
    const files = walk(appRoot);
    const violations: string[] = [];

    for (const file of files) {
        const rel = relative(root, file).replaceAll("\\", "/");
        if (!rel.endsWith("page.tsx")) continue;
        if (isAllowlisted(rel, DYNAMIC_ALLOWLIST) || isAllowlisted(rel, CATALOG_WALK_ALLOWLIST)) {
            continue;
        }
        if (rel.includes("/(authenticated)/") || rel.startsWith("app/admin/")) {
            continue;
        }

        const source = readFileSync(file, "utf8");
        if (/getUnifiedSpeciesEntries|buildAnimalDexNumberIndex/.test(source)) {
            violations.push(rel);
        }
    }

    assert.deepEqual(violations, []);
});

test("known disaster paths stay bounded and cacheable", () => {
    const animals = readFileSync(join(root, "app/[locale]/(composited)/animals/[slug]/page.tsx"), "utf8");
    const animalsIndex = readFileSync(join(root, "app/[locale]/(composited)/animals/page.tsx"), "utf8");
    const post = readFileSync(join(root, "app/[locale]/p/[postId]/page.tsx"), "utf8");
    const comparison = readFileSync(join(root, "app/[locale]/(composited)/comparisons/[slug]/page.tsx"), "utf8");
    const pokemon = readFileSync(join(root, "app/[locale]/(composited)/pokemon-animals/[slug]/page.tsx"), "utf8");
    const hybrid = readFileSync(join(root, "app/[locale]/(composited)/animal-hybrids/[slug]/page.tsx"), "utf8");
    const location = readFileSync(join(root, "app/[locale]/(composited)/locations/[slug]/page.tsx"), "utf8");
    const support = readFileSync(join(root, "app/[locale]/(composited)/support/[categorySlug]/[articleSlug]/page.tsx"), "utf8");
    const sitemap = readFileSync(join(root, "app/sitemap.xml/route.ts"), "utf8");
    const layout = readFileSync(join(root, "app/[locale]/(composited)/layout.tsx"), "utf8");
    const localeLayout = readFileSync(join(root, "app/[locale]/layout.tsx"), "utf8");

    assert.doesNotMatch(animals, /getUnifiedSpeciesEntries/);
    assert.match(animals, /export const revalidate = 3600/);
    assert.doesNotMatch(animalsIndex, /getAppCaptures/);
    assert.doesNotMatch(animalsIndex, /getUnifiedSpeciesEntries/);
    assert.doesNotMatch(animalsIndex, /searchParams/);
    assert.match(animalsIndex, /export const revalidate = 3600/);
    assert.match(animalsIndex, /generateStaticParams/);
    assert.match(animalsIndex, /return \[\];/);
    assert.doesNotMatch(localeLayout, /generateStaticParams/);
    assert.doesNotMatch(layout, /generateStaticParams/);
    assert.match(readFileSync(join(root, "app/[locale]/(composited)/pokemon-animals/page.tsx"), "utf8"), /generateStaticParams/);
    assert.doesNotMatch(readFileSync(join(root, "app/[locale]/(composited)/pokemon-animals/page.tsx"), "utf8"), /searchParams/);
    assert.doesNotMatch(readFileSync(join(root, "app/[locale]/(composited)/blog/page.tsx"), "utf8"), /searchParams/);
    assert.doesNotMatch(readFileSync(join(root, "app/[locale]/(composited)/comparisons/page.tsx"), "utf8"), /searchParams/);
    assert.doesNotMatch(readFileSync(join(root, "app/[locale]/(composited)/(answers)/best-animal-identification-app/page.tsx"), "utf8"), /searchParams/);
    assert.doesNotMatch(post, /getAuthenticatedAppShellData|getDiscoverTimelineBundle/);
    assert.match(comparison, /publishedStaticComparisonRedirectSlug/);
    assert.match(pokemon, /generateStaticParams/);
    assert.match(hybrid, /generateStaticParams/);
    assert.doesNotMatch(location, /resolveSpeciesArtworkFiles|getResolvedSpeciesArtworkUrl/);
    assert.doesNotMatch(support, /getSupportChatHref|cookies\(/);
    assert.match(support, /PUBLIC_SUPPORT_CHAT_HREF/);
    assert.doesNotMatch(sitemap, /force-dynamic/);
    assert.match(sitemap, /export const revalidate = 3600/);
    assert.match(layout, /export const revalidate = 3600/);
    assert.doesNotMatch(layout, /next-intl\/server/);
    assert.match(readFileSync(join(root, "app/[locale]/(composited)/tier-list/page.tsx"), "utf8"), /export const revalidate = 3600/);
    assert.match(readFileSync(join(root, "app/[locale]/(composited)/tier-list/page.tsx"), "utf8"), /return \[\];/);
});
