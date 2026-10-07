// Audit: does every indexed catalog species (AnimalDex number set, not hidden) have a page?
// Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/audit-indexed-species-pages.mts  (details in tmp/indexed-species-audit.json)
import {readFileSync, writeFileSync} from "node:fs";
import {speciesEntries} from "../src/data/species.ts";
import {isNonCanonicalLifeStageCatalogIdentity} from "../src/lib/species-life-stage-policy.ts";

const ROOT = process.cwd();
const envText = readFileSync(`${ROOT}/.env.local`, "utf8") + "\n" + readFileSync(`${ROOT}/.env`, "utf8");
const env = (n: string) => envText.match(new RegExp(`^${n}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const H = {apikey: KEY, Authorization: `Bearer ${KEY}`};

async function all(table: string, select: string, filter: string) {
    const rows: any[] = [];
    for (let off = 0; ; off += 1000) {
        const r = await fetch(`${SB}/rest/v1/${table}?select=${select}&${filter}&order=animaldex_number.asc&offset=${off}&limit=1000`, {headers: H});
        const page = await r.json() as any[];
        rows.push(...page);
        if (page.length < 1000) break;
    }
    return rows;
}
const clean = (v: any) => (typeof v === "string" && v.trim()) || null;
function canonicalSlug(row: any, num: number) {
    const landing = clean(row.landing_page_slug);
    const ident = clean(row.normalized_identity_key)?.replace(/_/g, "-") ?? "";
    const stripped = landing ? (landing.endsWith(`-${num}`) ? landing.slice(0, -(`-${num}`).length) : landing) : "";
    return (stripped || ident).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const profiles = await all("species_profiles", "id,animaldex_number,catalog_status", "animaldex_number=not.is.null");
const catalog = await all("species_catalog_v1", "species_profile_id,landing_page_slug,normalized_identity_key,display_name,catalog_status", "animaldex_number=not.is.null");
const indexed = profiles.filter((p) => p.catalog_status !== "hidden");
const catByProfile = new Map<string, any[]>();
for (const c of catalog) (catByProfile.get(c.species_profile_id) ?? catByProfile.set(c.species_profile_id, []).get(c.species_profile_id)!).push(c);

const published = new Set(JSON.parse(readFileSync(`${ROOT}/src/data/published-seo-slugs.json`, "utf8")).animals as string[]);
const snapshot = new Set((JSON.parse(readFileSync(`${ROOT}/src/data/published-seo-animal-pages.json`, "utf8")).entries as any[]).map((e) => e.slug));
const staticSlugs = new Set(speciesEntries.map((e) => e.slug));

const slugOwner = new Map<string, any>();
const result: Record<string, any[]> = {ok: [], noCatalogRow: [], lifeStageExcluded: [], emptySlug: [], slugCollision: [], notPublished: [], publishedNoPage: []};
for (const p of indexed) {
    const rows = catByProfile.get(p.id) ?? [];
    if (!rows.length) { result.noCatalogRow.push({num: p.animaldex_number, id: p.id, status: p.catalog_status}); continue; }
    const row = rows[0];
    const info = {num: p.animaldex_number, name: row.display_name, landing: row.landing_page_slug, ident: row.normalized_identity_key, status: p.catalog_status};
    if (isNonCanonicalLifeStageCatalogIdentity(row.normalized_identity_key)) { result.lifeStageExcluded.push(info); continue; }
    const slug = canonicalSlug(row, p.animaldex_number);
    if (!slug) { result.emptySlug.push(info); continue; }
    if (slugOwner.has(slug)) { result.slugCollision.push({...info, slug, takenBy: slugOwner.get(slug)}); continue; }
    slugOwner.set(slug, {num: p.animaldex_number, name: row.display_name});
    const hasPage = staticSlugs.has(slug) || snapshot.has(slug);
    if (!published.has(slug)) result.notPublished.push({...info, slug, hasPageData: hasPage});
    else if (!hasPage) result.publishedNoPage.push({...info, slug});
    else result.ok.push(slug);
}
console.log(JSON.stringify({profilesWithNumber: profiles.length, hidden: profiles.length - indexed.length, indexed: indexed.length,
    ...Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length]))}));
for (const k of ["noCatalogRow", "lifeStageExcluded", "emptySlug", "slugCollision", "notPublished", "publishedNoPage"]) {
    if (result[k].length) console.log(`\n## ${k} (${result[k].length})`, JSON.stringify(result[k].slice(0, 12)));
}
writeFileSync(`${ROOT}/tmp/indexed-species-audit.json`, JSON.stringify(result, null, 1));
