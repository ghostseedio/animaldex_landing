#!/usr/bin/env -S npx tsx
/**
 * The SEO lane's page check (S3): fetches rendered pages and checks what a
 * crawler reads, with no network beyond the site itself:
 * - JSON-LD: every block parses and passes the local schema check (`src/lib/seo/structured-data-check.ts`);
 * - one <h1>, no skipped heading level, a <title> and a description of sane length;
 * - a canonical, and hreflang with x-default on indexable pages;
 * - no @handle in the title or description of a /p/ page (owner decision 247).
 *
 *   npx tsx scripts/seo-check-pages.mts http://localhost:3331 / /ark /ark/how-it-works /animals/komodo-dragon …
 *
 * Exits 1 when any page has an issue.
 */
import {checkJsonLd, jsonLdBlocksOf} from "@/lib/seo/structured-data-check";

const [base, ...paths] = process.argv.slice(2);
if (!base || !paths.length) {
    console.error("usage: seo-check-pages.mts <base url> <path>...");
    process.exit(2);
}

function attr(tag: string, name: string): string | null {
    return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function decode(text: string): string {
    return text.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

let failed = 0;
for (const path of paths) {
    const response = await fetch(base.replace(/\/$/, "") + path, {headers: {"User-Agent": "seo-check"}});
    const html = await response.text();
    const issues: string[] = [];
    if (!response.ok) issues.push(`HTTP ${response.status}`);
    const head = html.slice(0, html.indexOf("</head>") + 7);
    const title = decode(head.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const metas = head.match(/<meta [^>]+>/g) ?? [];
    const links = head.match(/<link [^>]+>/g) ?? [];
    const description = decode(attr(metas.find((tag) => attr(tag, "name") === "description") ?? "", "content") ?? "");
    const robots = attr(metas.find((tag) => attr(tag, "name") === "robots") ?? "", "content") ?? "";
    const canonical = links.filter((tag) => attr(tag, "rel") === "canonical").map((tag) => attr(tag, "href"));
    const hreflang = links.filter((tag) => attr(tag, "rel") === "alternate" && (attr(tag, "hrefLang") ?? attr(tag, "hreflang")) !== null).map((tag) => attr(tag, "hrefLang") ?? attr(tag, "hreflang"));
    const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
    const headings = Array.from(body.matchAll(/<h([1-6])[\s>]/g)).map((match) => Number(match[1]));
    if (!title) issues.push("no <title>");
    if (title.length > 70) issues.push(`title ${title.length} chars`);
    if (!description) issues.push("no description");
    if (description.length > 165) issues.push(`description ${description.length} chars`);
    if (canonical.length !== 1) issues.push(`${canonical.length} canonicals`);
    const indexable = !/noindex/.test(robots);
    if (indexable && !hreflang.includes("x-default")) issues.push("no x-default hreflang");
    const h1 = headings.filter((level) => level === 1).length;
    if (h1 !== 1) issues.push(`${h1} h1`);
    for (let i = 1; i < headings.length; i++) if (headings[i] > headings[i - 1] + 1) issues.push(`h${headings[i - 1]} -> h${headings[i]}`);
    if (path.startsWith("/p/") && /@[a-z0-9_]{2,}/i.test(`${title} ${description}`)) issues.push("a handle in a /p/ title or description");
    const {blocks, issues: parse} = jsonLdBlocksOf(html);
    issues.push(...parse.map((issue) => `json-ld ${issue.path}: ${issue.message}`));
    for (const issue of checkJsonLd(blocks)) issues.push(`json-ld ${issue.path}: ${issue.message}`);
    const types = Array.from(new Set(JSON.stringify(blocks).match(/"@type":"[A-Za-z]+"/g) ?? [])).map((match) => match.slice(9, -1));
    console.log(`${issues.length ? "FAIL" : "ok  "} ${path}  title(${title.length}) desc(${description.length}) h1=${h1} ld=[${types.join(",")}]`);
    for (const issue of Array.from(new Set(issues)).slice(0, 12)) console.log(`       ${issue}`);
    if (issues.length) failed++;
}
process.exit(failed ? 1 : 0);
