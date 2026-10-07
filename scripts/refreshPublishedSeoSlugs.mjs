#!/usr/bin/env node

/**
 * Rebuild src/data/published-seo-slugs.json from the live sitemap plus local
 * static species/lesson slugs.
 *
 * Operator-run or CI-run before publishing newly catalogued species.
 * Do NOT add this to Next prebuild: it must not crawl remotely at deploy time.
 *
 * Tradeoff: unknown slugs 404 with zero Supabase. A species added only in the
 * database is not publicly indexable until this file is refreshed.
 *
 * Usage:
 *   yarn refresh:published-seo-slugs
 *   node scripts/refreshPublishedSeoSlugs.mjs --base https://animaldex.app
 */

import {readdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outputPath = join(root, "src/data/published-seo-slugs.json");
const dataRoot = join(root, "src/data");

const baseIndex = process.argv.indexOf("--base");
const BASE = (baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.ANIMALDEX_SITEMAP_BASE) || "https://animaldex.app";

const SLUG_RE = /\bslug:\s*"([a-z0-9-]+)"/g;

function walkTsFiles(dir, files = []) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walkTsFiles(full, files);
            continue;
        }
        if (entry.name.endsWith(".ts")) {
            files.push(full);
        }
    }
    return files;
}

function collectLocalSlugs() {
    const animals = new Set();
    const lessons = new Set();

    for (const file of walkTsFiles(dataRoot)) {
        const name = file.slice(dataRoot.length + 1);
        const text = readFileSync(file, "utf8");
        const slugs = [...text.matchAll(SLUG_RE)].map((match) => match[1]);
        if (name.startsWith("species") || name.startsWith("legendary")) {
            for (const slug of slugs) animals.add(slug);
        }
        if (name.includes("lesson") || name.includes("behavior") || name.startsWith("species")) {
            for (const slug of slugs) lessons.add(slug);
        }
    }

    animals.add("tiger");
    lessons.add("hippopotamus");
    lessons.add("osprey");
    lessons.delete("what-if-every-animal-is-a-lesson");
    return {animals, lessons};
}

function pathFamily(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "id") {
        parts.shift();
    }
    return parts;
}

async function collectSitemapSlugs() {
    const animals = new Set();
    const lessons = new Set();
    const response = await fetch(new URL("/sitemap.xml", BASE).toString(), {
        headers: {"user-agent": "AnimalDexPublishedSeoSlugRefresh/1.0"}
    });
    if (!response.ok) {
        throw new Error(`sitemap fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    for (const loc of locs) {
        const parts = pathFamily(new URL(loc).pathname);
        if (parts[0] === "animals" && parts[1] && !parts[2]) {
            animals.add(parts[1]);
        }
        if (parts[0] === "animal-lessons" && parts[1] && !parts[2] && parts[1] !== "what-if-every-animal-is-a-lesson") {
            lessons.add(parts[1]);
        }
    }
    return {animals, lessons};
}

function mergeSorted(left, right) {
    return [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
}

function readEnv(name) {
    for (const file of [".env.local", ".env"]) {
        try {
            const match = readFileSync(join(root, file), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
            const value = match?.[1]?.trim().replace(/^["']|["']$/g, "");
            if (value) return value;
        } catch {}
    }
    return process.env[name]?.trim() || "";
}

/**
 * Every indexed catalog species (AnimalDex number set, not hidden), slugged the
 * way the site does. Reading the catalog directly means a species can't miss
 * its page just because the deployed sitemap predates it — copying the live
 * sitemap alone could never publish a species the last build left out.
 */
async function collectIndexedCatalogSlugs() {
    const url = readEnv("SUPABASE_URL") || readEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = readEnv("SUPABASE_SERVICE_ROLE_KEY") || readEnv("SUPABASE_ANON_KEY") || readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!url || !key) {
        console.warn("No Supabase credentials: publishing from the live sitemap only.");
        return new Set();
    }
    const {isNonCanonicalLifeStageCatalogIdentity} = await import("../src/lib/species-life-stage-policy.ts");
    const headers = {apikey: key, Authorization: `Bearer ${key}`};
    async function all(table, select) {
        const rows = [];
        for (let offset = 0; ; offset += 1000) {
            const response = await fetch(`${url}/rest/v1/${table}?select=${select}&animaldex_number=not.is.null&order=animaldex_number.asc&offset=${offset}&limit=1000`, {headers});
            if (!response.ok) throw new Error(`${table} ${response.status}`);
            const page = await response.json();
            rows.push(...page);
            if (page.length < 1000) break;
        }
        return rows;
    }
    const [profiles, catalog] = await Promise.all([
        all("species_profiles", "id,animaldex_number,catalog_status"),
        all("species_catalog_v1", "species_profile_id,landing_page_slug,normalized_identity_key")
    ]);
    const numbers = new Map(profiles.filter((row) => row.catalog_status !== "hidden").map((row) => [row.id, row.animaldex_number]));
    const slugs = new Set();
    for (const row of catalog) {
        const number = numbers.get(row.species_profile_id);
        if (number === undefined || isNonCanonicalLifeStageCatalogIdentity(row.normalized_identity_key)) continue;
        const landing = row.landing_page_slug?.trim() || "";
        const stripped = landing.endsWith(`-${number}`) ? landing.slice(0, -`-${number}`.length) : landing;
        const slug = (stripped || (row.normalized_identity_key ?? "").trim().replace(/_/g, "-"))
            .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (slug) slugs.add(slug);
    }
    return slugs;
}

const local = collectLocalSlugs();
const remote = await collectSitemapSlugs();
const catalogSlugs = await collectIndexedCatalogSlugs();
const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "indexed catalog species plus live sitemap.xml plus local static species/lesson slugs",
    animals: mergeSorted(mergeSorted(local.animals, remote.animals), catalogSlugs),
    lessons: mergeSorted(local.lessons, remote.lessons)
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
console.log(`animals ${payload.animals.length}`);
console.log(`lessons ${payload.lessons.length}`);
console.log("New database-only species stay unpublished until this file is refreshed.");
