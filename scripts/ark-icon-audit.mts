/**
 * How many animals on the live Ark are drawn as the generic figure although the `animals` bucket holds a file for one
 * of their own names (page slug, identity key, names, scientific name: `lib/ark-icons.ts`). Read only: the public Ark
 * read, the bucket's listing and the species' names; nothing is written anywhere.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/ark-icon-audit.mts [--read <url|file>] [--listing <file>] [--profiles <file>] [--verify] [--json]
 *
 * --read      the Ark answer (default https://animaldex.app/api/ark/voyage); a saved copy works too.
 * --listing   the bucket's file names, a JSON array or `supabase db query -o json` rows of {name}:
 *               select name from storage.objects where bucket_id = 'animals' and name not like '%/%'
 *             (the Storage list API pages and the CLI's `storage ls` returns a partial page, so count from the table).
 *             Without it the bucket is listed through the API with SUPABASE_URL and a key from .env.local.
 * --profiles  the species' names, a JSON array or db-query rows of species_profiles
 *             (id, display_name, animal_name, refined_identity, scientific_name, landing_page_slug, normalized_identity_key).
 *             Without it they are read through REST with the same key.
 * --verify    ask the public bucket for each file the alias would use (a HEAD each) and say how many answer 200.
 *
 * Counts: "placeholder" = no `<model_slug>.webp` (what /ark drew before the alias), "fixed" = a file exists under another
 * of the species' own names (what /ark draws with it), "remaining" = no file under any name (an icon still to be made).
 */
import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {buildArtworkIndex} from "../src/data/species-artwork-resolution";
import {arkIconAudit} from "../src/lib/ark-icon-audit";
import type {ArkIconProfile} from "../src/lib/ark-icons";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
}

const args = process.argv.slice(2);
const option = (name: string) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
};
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wwhsdzpczekgdlobwaej.supabase.co").trim().replace(/\/$/, "");
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

function rowsOf(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const rows = (value as {rows?: unknown} | null)?.rows;
    return Array.isArray(rows) ? rows : [];
}

async function json(source: string): Promise<unknown> {
    if (/^https?:/.test(source)) {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`${source}: ${response.status}`);
        return response.json();
    }
    const text = readFileSync(source, "utf8");
    return JSON.parse(text.slice(Math.min(...["{", "["].map((c) => (text.indexOf(c) < 0 ? Infinity : text.indexOf(c))))));
}

async function listing(): Promise<string[]> {
    const file = option("--listing");
    if (file) return rowsOf(await json(file)).map((row) => (typeof row === "string" ? row : String((row as {name?: unknown}).name ?? "")));
    if (!key) throw new Error("--listing <file>, or SUPABASE_URL and a key in .env.local, is needed to list the bucket");
    const names: string[] = [];
    for (let page = 0; page < 20; page += 1) {
        const response = await fetch(`${url}/storage/v1/object/list/animals`, {method: "POST", headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json"}, body: JSON.stringify({prefix: "", limit: 1000, offset: page * 1000, sortBy: {column: "name", order: "asc"}})});
        if (!response.ok) throw new Error(`bucket listing ${response.status}`);
        const rows = (await response.json()) as Array<{name?: string}>;
        for (const row of rows) if (row.name) names.push(row.name);
        if (rows.length < 1000) break;
    }
    return names;
}

async function profilesOf(ids: string[]): Promise<Map<string, ArkIconProfile>> {
    const profiles = new Map<string, ArkIconProfile>();
    const file = option("--profiles");
    if (file) {
        for (const row of rowsOf(await json(file)) as Array<ArkIconProfile & {id: string}>) profiles.set(row.id, row);
        return profiles;
    }
    if (!key) throw new Error("--profiles <file>, or SUPABASE_URL and a key in .env.local, is needed to read the species' names");
    for (let at = 0; at < ids.length; at += 100) {
        const response = await fetch(`${url}/rest/v1/species_profiles?select=id,display_name,animal_name,refined_identity,scientific_name,landing_page_slug,normalized_identity_key&id=in.(${ids.slice(at, at + 100).join(",")})`, {headers: {apikey: key, Authorization: `Bearer ${key}`}});
        if (!response.ok) throw new Error(`species_profiles ${response.status}`);
        for (const row of (await response.json()) as Array<ArkIconProfile & {id: string}>) profiles.set(row.id, row);
    }
    return profiles;
}

const read = (await json(option("--read") ?? "https://animaldex.app/api/ark/voyage")) as {snapshot?: {animals?: Array<{model_slug: string; species_profile_id: string}>}};
const animals = read.snapshot?.animals ?? [];
if (!animals.length) throw new Error("the Ark read has no animals");
const artwork = buildArtworkIndex(await listing()).bySlug;
const profiles = await profilesOf(Array.from(new Set(animals.map((animal) => animal.species_profile_id))));
const audit = arkIconAudit(animals, artwork, profiles);

let live = "";
if (args.includes("--verify")) {
    const files = Array.from(new Set(audit.fixed.map((one) => one.file)));
    let ok = 0;
    const bad: string[] = [];
    for (let at = 0; at < files.length; at += 8) {
        await Promise.all(files.slice(at, at + 8).map(async (file) => {
            const response = await fetch(`${url}/storage/v1/object/public/animals/${encodeURIComponent(file)}.webp`, {method: "HEAD"});
            if (response.ok) ok += 1;
            else bad.push(`${file} ${response.status}`);
        }));
    }
    live = `verify: ${ok}/${files.length} alias files answer 200${bad.length ? ` (not: ${bad.join(", ")})` : ""}\n`;
}

if (args.includes("--json")) {
    console.log(JSON.stringify(audit, null, 2));
} else {
    console.log(`animals ${audit.animals}, species ${audit.species}`);
    console.log(`generic figure before (no <slug>.webp): ${audit.placeholderAnimals} animals, ${audit.placeholderSpecies} species`);
    console.log(`generic figure after (the alias): ${audit.remainingAnimals} animals, ${audit.remainingSpecies} species`);
    console.log(`fixed: ${audit.fixableAnimals} animals, ${audit.fixableSpecies} species`);
    console.log(live + "fixed (slug -> file):");
    for (const one of audit.fixed) console.log(`  ${one.slug} -> ${one.file}.webp (${one.animals})`);
    console.log("still no file under any name (an icon to make):");
    for (const one of audit.remaining) console.log(`  ${one.slug} (${one.animals}): tried ${one.tried.join(", ")}`);
}
