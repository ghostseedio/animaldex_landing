/**
 * Fetch a Wikimedia Commons hero photo for each new location page and record
 * it in src/data/location-hero-images.json, which `createLocationPage` reads.
 *
 * Input: one or more spec JSON files in the fetch-blog-images.mjs shape
 *   [{slug: "locations-<page slug>", file: "hero", query | title, must?, alt}]
 * A page may appear several times with different queries (give each its own
 * `file`, e.g. hero, hero2, hero3): they run in order and the first query that
 * finds a licensed photo wins; losing downloads are deleted. Pages that already
 * have an image are skipped unless --force is passed. Fetches run in parallel
 * shards (default 6, --shards=N), one page's queries always in the same shard.
 *
 *   node scripts/fetchLocationHeroImages.mjs spec.json [spec2.json ...] [--force] [--shards=6]
 */
import {execFile} from "node:child_process";
import {existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/data/location-hero-images.json");
const args = process.argv.slice(2);
const force = args.includes("--force");
const shardCount = Number(args.find((arg) => arg.startsWith("--shards="))?.split("=")[1] ?? 6);
const specFiles = args.filter((arg) => !arg.startsWith("--"));
if (!specFiles.length) {
    console.error("usage: node scripts/fetchLocationHeroImages.mjs spec.json [...] [--force] [--shards=6]");
    process.exit(2);
}

const store = JSON.parse(readFileSync(OUT, "utf8"));
store.images ??= {};
const pageSlug = (item) => item.slug.replace(/^locations-/, "");

const items = specFiles.flatMap((file) => JSON.parse(readFileSync(file, "utf8")))
    .filter((item) => force || !store.images[pageSlug(item)] || !existsSync(path.join(ROOT, "public", store.images[pageSlug(item)].src)));
const bySlug = new Map();
for (const item of items) (bySlug.get(item.slug) ?? bySlug.set(item.slug, []).get(item.slug)).push(item);
console.error(`${bySlug.size} page(s), ${items.length} query line(s) to fetch`);
if (!items.length) process.exit(0);

const shards = Array.from({length: Math.max(1, Math.min(shardCount, bySlug.size))}, () => []);
let next = 0;
for (const group of bySlug.values()) shards[next++ % shards.length].push(...group);
const tmp = mkdtempSync(path.join(tmpdir(), "loc-hero-"));
const outputs = await Promise.all(shards.map((shard, index) => new Promise((resolve) => {
    const specPath = path.join(tmp, `shard-${index}.json`);
    writeFileSync(specPath, JSON.stringify(shard));
    execFile("node", [path.join(ROOT, "scripts/fetch-blog-images.mjs"), specPath], {maxBuffer: 64 * 1024 * 1024}, (error, stdout) => resolve(stdout || ""));
})));

// Results come back per shard in spec order, so the first success for a page is
// its broadest query that found something.
const won = new Set();
const failures = [];
for (const line of outputs.join("\n").split("\n").filter(Boolean)) {
    const result = JSON.parse(line);
    const slug = result.slug.replace(/^locations-/, "");
    if (result.error) {
        failures.push({slug, error: result.error, tried: result.tried});
        continue;
    }
    if (won.has(slug)) {
        try { unlinkSync(path.join(ROOT, "public", result.src)); } catch {}
        continue;
    }
    won.add(slug);
    const previous = store.images[slug];
    if (previous && previous.src !== result.src) {
        try { unlinkSync(path.join(ROOT, "public", previous.src)); } catch {}
    }
    store.images[slug] = {
        src: result.src,
        alt: result.alt,
        width: result.width,
        height: result.height,
        caption: `${result.alt}. ${result.caption}`,
        commons: result.commons
    };
}
store.generatedAt = new Date().toISOString().slice(0, 10);
store.images = Object.fromEntries(Object.entries(store.images).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, `${JSON.stringify(store, null, 2)}\n`);
console.error(`fetched ${won.size}, pages without a photo: ${[...bySlug.keys()].map((slug) => slug.replace(/^locations-/, "")).filter((slug) => !won.has(slug)).length}`);
for (const failure of failures) if (!won.has(failure.slug)) console.log(JSON.stringify(failure));
