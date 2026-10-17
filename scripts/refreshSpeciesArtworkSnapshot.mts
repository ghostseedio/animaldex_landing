/**
 * Snapshot the `animals` storage bucket listing (species artwork file names)
 * into src/data/species-artwork-snapshot.json.
 *
 * Static SEO pages (/locations/<slug>, revalidate = false) render species
 * icons as direct storage URLs instead of redirects through
 * /api/species-artwork. Resolving a slug to its file needs the bucket listing,
 * and the production build forbids remote reads (ADEX_SEO_SSG_NO_REMOTE), so
 * the build resolves against this file. A slug the snapshot cannot resolve
 * keeps the redirect route, so a stale snapshot costs latency, never a broken
 * image; refresh it after uploading new artwork and before an image build.
 *
 *   npx tsx scripts/refreshSpeciesArtworkSnapshot.mts [--report]
 *
 * Needs SUPABASE_URL plus a key that may list the public bucket
 * (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY), read from .env / .env.local.
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {buildArtworkIndex, isSpeciesArtwork, resolveArtworkFileInIndex} from "../src/data/species-artwork-resolution";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const OUTPUT = join(root, "src/data/species-artwork-snapshot.json");
const BUCKET = "animals";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

for (const file of [".env.local", ".env"]) {
    const filePath = join(root, file);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        let value = match[2] ?? "";
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (!process.env[match[1]]) process.env[match[1]] = value;
    }
}

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ""
).trim();
if (!url || !key) throw new Error("SUPABASE_URL and a Supabase key are required");

const names: string[] = [];

for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify({prefix: "", limit: PAGE_SIZE, offset: page * PAGE_SIZE, sortBy: {column: "name", order: "asc"}})
    });
    if (!response.ok) throw new Error(`bucket listing ${response.status}: ${await response.text()}`);

    const rows = (await response.json()) as Array<{name?: unknown}>;
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
        if (typeof row.name === "string" && row.name) names.push(row.name);
    }
    if (rows.length < PAGE_SIZE) break;
}

if (names.length === 0) throw new Error("bucket listing returned no files; refusing to write an empty snapshot");

const files = Array.from(new Set(names.filter(isSpeciesArtwork))).sort((a, b) => a.localeCompare(b));

writeFileSync(OUTPUT, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: `storage bucket \`${BUCKET}\` listing`,
    note: "Refresh with `npx tsx scripts/refreshSpeciesArtworkSnapshot.mts`. Read only during SEO static generation (see species-artwork-index.ts).",
    files
}, null, 2)}\n`);

console.log(`species artwork snapshot: ${files.length} files (of ${names.length} objects) -> ${OUTPUT}`);

if (process.argv.includes("--report")) {
    const {locationPages} = await import("../src/data/locations");
    const index = buildArtworkIndex(files);
    const slugs = new Set(locationPages.flatMap((location) => location.animalsToSpot.map((animal) => animal.speciesSlug)));
    const unresolved = Array.from(slugs).filter((slug) => !resolveArtworkFileInIndex(index, slug)).sort();
    console.log(`location roster slugs: ${slugs.size}, unresolved by snapshot: ${unresolved.length}`);
    if (unresolved.length) console.log(unresolved.join("\n"));
}
