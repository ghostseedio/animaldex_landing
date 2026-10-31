import "server-only";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import {talkDisagreePairs, talkNameFromSlug, type TalkAnimal, type TalkCatalogRow} from "@/lib/ask-animaldex/talk";

/**
 * The animals of the Talk page (docs/rich-chat/SPEC.md, section 4.3), read
 * from the catalog view the apps read: every animal by its common name and
 * its Power, the ones people talk to most (`species_most_talked_to_v1`, then
 * the most caught while too few have talked to any), and pairs whose Powers
 * pull opposite ways (`contrasting_species`, the catalog's own authored
 * contrasts). Never read during the static build; once a day otherwise, kept
 * in this server's memory between requests.
 */

export type TalkCatalog = {
    animals: TalkAnimal[];
    popular: string[];
    /** What "popular" is: most talked to, or (while too few people have talked to enough animals) most caught. */
    popularBy: "talked" | "caught";
    disagree: Array<[string, string]>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const POPULAR = 12;
const PAIRS = 6;

let cached: {at: number; value: TalkCatalog} | null = null;
let loading: Promise<TalkCatalog> | null = null;

function rest(path: string): {url: string; headers: Record<string, string>} | null {
    const base = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!base || !key) return null;
    return {url: `${base}/rest/v1/${path}`, headers: getSupabaseHeaders(key, {Accept: "application/json"})};
}

async function readCatalogRows(): Promise<TalkCatalogRow[]> {
    const rows: TalkCatalogRow[] = [];
    const select = "landing_page_slug,display_name,principle_name,public_capture_count,contrasting_species";
    // The view pages at 1,000 rows; the catalog is under 3,000.
    for (let offset = 0; offset < 6000; offset += 1000) {
        const request = rest(`species_catalog_v1?select=${select}&catalog_status=in.(active,seeded)&animaldex_number=gte.1&landing_page_slug=not.is.null&order=animaldex_number.asc&offset=${offset}&limit=1000`);
        if (!request) return rows;
        const response = await fetch(request.url, {headers: request.headers, cache: "no-store"});
        if (!response.ok) throw new Error(`species_catalog_v1 ${response.status}`);
        const page = await response.json() as TalkCatalogRow[];
        rows.push(...page);
        if (page.length < 1000) break;
    }
    return rows;
}

async function readMostTalkedTo(): Promise<string[]> {
    const request = rest("rpc/species_most_talked_to_v1");
    if (!request) return [];
    try {
        const response = await fetch(request.url, {
            method: "POST",
            headers: {...request.headers, "Content-Type": "application/json"},
            body: JSON.stringify({p_limit: POPULAR, p_window: "all"}),
            cache: "no-store"
        });
        if (!response.ok) return [];
        const rows = await response.json() as Array<{landing_page_slug?: unknown}>;
        return rows.map((row) => (typeof row.landing_page_slug === "string" ? row.landing_page_slug : "")).filter(Boolean);
    } catch {
        return [];
    }
}

async function load(): Promise<TalkCatalog> {
    const [rows, talkedTo] = await Promise.all([readCatalogRows(), readMostTalkedTo()]);
    const animals = new Map<string, TalkAnimal>();
    for (const row of rows) {
        const slug = typeof row.landing_page_slug === "string" ? row.landing_page_slug.trim() : "";
        const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
        if (!slug || !name || animals.has(slug)) continue;
        animals.set(slug, {slug, name, power: typeof row.principle_name === "string" && row.principle_name.trim() ? row.principle_name.trim() : null});
    }
    // Most talked to first; while too few people have talked to enough of them, the most caught.
    // People are not one of the animals to bring a problem to, whatever the catalog counts.
    const caught = [...rows]
        .filter((row) => typeof row.landing_page_slug === "string" && animals.has(row.landing_page_slug) && row.landing_page_slug !== "human")
        .sort((left, right) => (Number(right.public_capture_count) || 0) - (Number(left.public_capture_count) || 0))
        .map((row) => row.landing_page_slug as string);
    const talked = talkedTo.filter((slug) => animals.has(slug));
    const popular = Array.from(new Set([...talked, ...caught])).slice(0, POPULAR);
    return {
        animals: Array.from(animals.values()).sort((left, right) => left.name.localeCompare(right.name)),
        popular,
        popularBy: talked.length * 2 >= POPULAR ? "talked" : "caught",
        disagree: talkDisagreePairs(rows, PAIRS)
    };
}

export async function getTalkCatalog(): Promise<TalkCatalog> {
    if (isSeoSsgRemoteForbidden()) return {animals: [], popular: [], popularBy: "caught", disagree: []};
    if (cached && Date.now() - cached.at < DAY_MS) return cached.value;
    if (!loading) {
        loading = load()
            .then((value) => {
                if (value.animals.length > 0) cached = {at: Date.now(), value};
                return value;
            })
            .finally(() => {
                loading = null;
            });
    }
    try {
        return await loading;
    } catch (error) {
        console.warn("[talk] catalog unavailable", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return cached?.value ?? {animals: [], popular: [], popularBy: "caught", disagree: []};
    }
}

/**
 * One animal for its chat page: its name and its Power, cached by the
 * request's fetch for a day. Null only when the catalog has no such animal;
 * when the catalog cannot be read, its name from the slug, and the chat
 * itself finds out the rest.
 */
export async function getTalkAnimal(slug: string): Promise<TalkAnimal | null> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    const fallback: TalkAnimal = {slug, name: talkNameFromSlug(slug), power: null};
    if (isSeoSsgRemoteForbidden()) return fallback;
    const request = rest(`species_catalog_v1?select=landing_page_slug,display_name,principle_name&landing_page_slug=eq.${encodeURIComponent(slug)}&catalog_status=in.(active,seeded)&limit=1`);
    if (!request) return fallback;
    try {
        const response = await fetch(request.url, {headers: request.headers, next: {revalidate: 86400, tags: [`talk-animal:${slug}`]}});
        if (!response.ok) return fallback;
        const rows = await response.json() as TalkCatalogRow[];
        const row = rows[0];
        if (!row) return null;
        const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
        if (!name) return fallback;
        return {slug, name, power: typeof row.principle_name === "string" && row.principle_name.trim() ? row.principle_name.trim() : null};
    } catch {
        return fallback;
    }
}
