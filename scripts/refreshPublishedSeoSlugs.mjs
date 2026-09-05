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

const local = collectLocalSlugs();
const remote = await collectSitemapSlugs();
const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "live sitemap.xml plus local static species/lesson slugs",
    animals: mergeSorted(local.animals, remote.animals),
    lessons: mergeSorted(local.lessons, remote.lessons)
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
console.log(`animals ${payload.animals.length}`);
console.log(`lessons ${payload.lessons.length}`);
console.log("New database-only species stay unpublished until this file is refreshed.");
