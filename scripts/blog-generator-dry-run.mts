/**
 * Runs the blog generator end to end without saving, and writes the result
 * (including the assembled post) to JSON. Photos are still uploaded to the
 * public admin-assets bucket.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env --env-file=.env.local \
 *     scripts/blog-generator-dry-run.mts <news|catalog|custom> "focus or topic" [out.json] [reference files…]
 *
 * The brief and research are cached next to the output (<out>.research.json),
 * so a rerun with the same output path only repeats writing, photos and checks.
 */
import {existsSync} from "node:fs";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import type {CatalogItem} from "@/lib/blog-generator/catalog";
import {generateArticle} from "@/lib/blog-generator/jobs";
import type {Brief, Research} from "@/lib/blog-generator/pipeline";

const [mode = "news", focus = "", out = "tmp/blog-generator-dry-run.json", ...materialPaths] = process.argv.slice(2);
const materialFiles = await Promise.all(materialPaths.map(async (file) => ({name: path.basename(file), data: await readFile(file)})));
const cachePath = out.replace(/\.json$/, "") + ".research.json";
const started = Date.now();

type Cached = {brief: Brief; dossier: string; urls: string[]; siteHits: CatalogItem[]};

let prepared: {brief: Brief; research: Research} | undefined;
if (existsSync(cachePath)) {
    const cached = JSON.parse(await readFile(cachePath, "utf8")) as Cached;
    prepared = {brief: cached.brief, research: {dossier: cached.dossier, urls: new Set(cached.urls), siteHits: new Map(cached.siteHits.map((hit) => [hit.href, hit]))}};
    console.log(`Reusing research from ${cachePath}: ${cached.brief.title}`);
}

const result = await generateArticle(
    {
        mode: mode as "news" | "catalog" | "custom",
        focus,
        publish: true,
        dryRun: true,
        materialFiles,
        prepared,
        onResearched: async (brief, research) => {
            const cached: Cached = {brief, dossier: research.dossier, urls: Array.from(research.urls), siteHits: Array.from(research.siteHits.values())};
            await writeFile(cachePath, JSON.stringify(cached, null, 2));
        }
    },
    (line) => console.log(`${((Date.now() - started) / 1000).toFixed(0).padStart(4)}s ${line}`)
);
await writeFile(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({...result, post: undefined}, null, 2));
