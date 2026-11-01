import "server-only";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import {
    TALK_DISAGREE_PAIRS,
    talkDisagreePairs,
    talkFeaturedAnimals,
    talkNameFromSlug,
    type TalkAnimal,
    type TalkCatalogRow,
    type TalkDisagreePair
} from "@/lib/ask-animaldex/talk";
import {resolveTalkSlug, type TalkCatalogIndex, type TalkResolution} from "@/lib/ask-animaldex/talk-resolve";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {resolveSpeciesArtworkFiles} from "@/data/species-artwork-index";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";

/**
 * The animals of the Talk page (docs/rich-chat/SPEC.md, section 4.3), read
 * from the catalog view the apps read: every animal by its common name and
 * its Power; the first ones offered (the featured animals, then the ones
 * people talk to most, `species_most_talked_to_v1`, each with its own art,
 * UX pass DECISIONS section 7); pairs whose Powers pull apart on one
 * question (curated, else the catalog's own `contrasting_species`); and how a
 * species page finds its catalog animal (WEB-1). Never read during the
 * static build; once a day otherwise, kept in this server's memory.
 */

export type TalkCatalog = {
    /** Every animal, the most captured first (the search's tie-break). */
    animals: TalkAnimal[];
    /** The picker's first animals: the featured ones, then the most talked to (`talkFeaturedAnimals`). */
    popular: string[];
    /** Kept for older pickers: the first rows are "Popular to talk to" either way now. */
    popularBy: "talked" | "caught";
    disagree: Array<[string, string]>;
    /** Each pair's question, by its words key ("disagreeWaitOrGo"); null for a pair the catalog made. */
    disagreeTopics?: Array<string | null>;
};

/** The catalog with what only the server needs: how a species page finds its catalog animal. */
type TalkCatalogState = TalkCatalog & {index: TalkCatalogIndex};

const EMPTY_INDEX: TalkCatalogIndex = {slugs: new Set(), bySpeciesProfileId: new Map(), byIdentity: new Map()};
const EMPTY_CATALOG: TalkCatalogState = {animals: [], popular: [], popularBy: "caught", disagree: [], disagreeTopics: [], index: EMPTY_INDEX};

const DAY_MS = 24 * 60 * 60 * 1000;
const POPULAR = 12;
const PAIRS = 6;

let cached: {at: number; value: TalkCatalogState} | null = null;
let loading: Promise<TalkCatalogState> | null = null;

function rest(path: string): {url: string; headers: Record<string, string>} | null {
    const base = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!base || !key) return null;
    return {url: `${base}/rest/v1/${path}`, headers: getSupabaseHeaders(key, {Accept: "application/json"})};
}

async function readCatalogRows(): Promise<TalkCatalogRow[]> {
    const rows: TalkCatalogRow[] = [];
    const select = "landing_page_slug,display_name,principle_name,public_capture_count,contrasting_species,species_profile_id,normalized_identity_key";
    // The view pages at 1,000 rows; the catalog is under 3,000.
    for (let offset = 0; offset < 6000; offset += 1000) {
        const request = rest(`species_catalog_v1?select=${select}&catalog_status=in.(active,seeded)&animaldex_number=gte.1&landing_page_slug=not.is.null&order=animaldex_number.asc&offset=${offset}&limit=1000`);
        if (!request) return rows;
        // Kept by the fetch cache for a day: the Talk pages render this in their ISR HTML, and a
        // no-store read there would turn a cached page dynamic (a 500 on revalidation).
        const response = await fetch(request.url, {headers: request.headers, next: {revalidate: 86400, tags: ["talk-catalog"]}});
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
            next: {revalidate: 86400, tags: ["talk-catalog"]}
        });
        if (!response.ok) return [];
        const rows = await response.json() as Array<{landing_page_slug?: unknown}>;
        return rows.map((row) => (typeof row.landing_page_slug === "string" ? row.landing_page_slug : "")).filter(Boolean);
    } catch {
        return [];
    }
}

/** The slugs whose icon art is their own file (never a relative's, never missing): only these go in curated lists. */
async function slugsWithOwnArt(slugs: string[]): Promise<Map<string, string>> {
    const files = await resolveSpeciesArtworkFiles(slugs).catch(() => new Map<string, string | null>());
    const own = new Map<string, string>();
    for (const slug of slugs) {
        const file = files.get(slug);
        if (file && file === `${slug}.webp`) own.set(slug, file);
    }
    return own;
}

async function load(): Promise<TalkCatalogState> {
    const [rows, talkedTo] = await Promise.all([readCatalogRows(), readMostTalkedTo()]);
    const animals = new Map<string, TalkAnimal>();
    const caughtBySlug = new Map<string, number>();
    const bySpeciesProfileId = new Map<string, string>();
    const byIdentity = new Map<string, string>();
    for (const row of rows) {
        const slug = typeof row.landing_page_slug === "string" ? row.landing_page_slug.trim() : "";
        const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
        if (!slug || !name || animals.has(slug)) continue;
        animals.set(slug, {slug, name, power: typeof row.principle_name === "string" && row.principle_name.trim() ? row.principle_name.trim() : null});
        caughtBySlug.set(slug, Number(row.public_capture_count) || 0);
        const profile = typeof row.species_profile_id === "string" ? row.species_profile_id.toLowerCase() : "";
        if (profile && !bySpeciesProfileId.has(profile)) bySpeciesProfileId.set(profile, slug);
        const identity = typeof row.normalized_identity_key === "string" ? row.normalized_identity_key.trim().toLowerCase() : "";
        if (identity && !byIdentity.has(identity)) byIdentity.set(identity, slug);
    }
    // Most captured first, so the search ranks the better-known of two equal matches first (WEB-4).
    const sorted = Array.from(animals.values()).sort((left, right) => (caughtBySlug.get(right.slug) ?? 0) - (caughtBySlug.get(left.slug) ?? 0)
        || left.name.localeCompare(right.name));
    // Each animal's icon file, so a search result's face loads from its own address, with no redirect to follow first.
    const iconFiles = await resolveSpeciesArtworkFiles(sorted.map((animal) => animal.slug)).catch(() => new Map<string, string | null>());
    const ordered = sorted.map((animal) => {
        const file = iconFiles.get(animal.slug);
        return file ? {...animal, iconFile: file} : animal;
    });
    const talked = talkedTo.filter((slug) => animals.has(slug));
    // The curated lists show only animals with their own art (DECISIONS section 7).
    const candidates = Array.from(new Set([
        ...talked,
        "gray-wolf", "common-octopus", "little-owl", "orca", "african-bush-elephant", "western-honey-bee",
        "cheetah", "honey-badger", "gal-pagos-tortoise", "emperor-penguin", "sea-otter", "common-raven", "snow-leopard",
        ...TALK_DISAGREE_PAIRS.flatMap((pair) => [pair.left, pair.right])
    ])).filter((slug) => animals.has(slug));
    const art = await slugsWithOwnArt(candidates);
    const popular = talkFeaturedAnimals({bySlug: animals, talkedTo: talked, hasArt: (slug) => art.has(slug), max: POPULAR}).map((animal) => animal.slug);
    const curatedPairs = TALK_DISAGREE_PAIRS.filter((pair) => art.has(pair.left) && art.has(pair.right));
    const disagree: Array<[string, string]> = curatedPairs.length > 0
        ? curatedPairs.map((pair) => [pair.left, pair.right])
        : talkDisagreePairs(rows, PAIRS);
    return {
        animals: ordered,
        popular,
        popularBy: talked.length * 2 >= POPULAR ? "talked" : "caught",
        disagree,
        disagreeTopics: curatedPairs.length > 0 ? curatedPairs.map((pair) => pair.topic) : disagree.map(() => null),
        index: {slugs: new Set(animals.keys()), bySpeciesProfileId, byIdentity}
    };
}

async function getTalkCatalogState(): Promise<TalkCatalogState> {
    if (isSeoSsgRemoteForbidden()) return EMPTY_CATALOG;
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
        return cached?.value ?? EMPTY_CATALOG;
    }
}

/** What the picker's search needs, for the catalog route: never the server's index. */
export async function getTalkCatalog(): Promise<TalkCatalog> {
    const {index: _index, ...catalog} = await getTalkCatalogState();
    return catalog;
}

export type TalkPickerRows = {popular: TalkAnimal[]; disagree: TalkDisagreePair[]};

/**
 * The curated animals as the catalog had them on 2026-11-01, each checked for
 * its own icon art: what the picker's first rows are drawn from when the
 * catalog cannot be read (the static build forbids remote reads, and /talk
 * is prerendered there), so they are never empty in the first HTML.
 */
const CURATED_FALLBACK: TalkAnimal[] = [
    {slug: "gray-wolf", name: "Gray Wolf", power: "Cooperation"},
    {slug: "common-octopus", name: "Common Octopus", power: "Flexible Intelligence"},
    {slug: "little-owl", name: "Little Owl", power: "Night Focus Strategy"},
    {slug: "orca", name: "Orca", power: "Pod Intelligence"},
    {slug: "african-bush-elephant", name: "African Bush Elephant", power: "Memory Path"},
    {slug: "western-honey-bee", name: "Western Honey Bee", power: "Colony Teamwork Strategy"},
    {slug: "cheetah", name: "Cheetah", power: "Spring-Loaded Spine"},
    {slug: "honey-badger", name: "Honey Badger", power: "Fearlessness"},
    {slug: "gal-pagos-tortoise", name: "Galápagos Tortoise", power: "Longevity"},
    {slug: "emperor-penguin", name: "Emperor Penguin", power: "Huddled Warmth"},
    {slug: "sea-otter", name: "Sea Otter", power: "Tool Use"},
    {slug: "common-raven", name: "Common Raven", power: "Foresight"},
    {slug: "snow-leopard", name: "Snow Leopard", power: "Mountain Ghosting"}
];

function curatedFallbackRows(): TalkPickerRows {
    const bySlug = new Map(CURATED_FALLBACK.map((animal) => [animal.slug, {...animal, icon: getSpeciesArtworkUrl(animal.slug, `${animal.slug}.webp`)}]));
    const popular = talkFeaturedAnimals({bySlug, talkedTo: [], hasArt: () => true, max: POPULAR});
    const disagree = TALK_DISAGREE_PAIRS.flatMap((pair) => {
        const left = bySlug.get(pair.left);
        const right = bySlug.get(pair.right);
        return left && right ? [{left, right, topic: pair.topic}] : [];
    });
    return {popular, disagree};
}

/**
 * The picker's first rows, drawn by the server into the page (WEB-18,
 * WEB-24): a few KB instead of the 200 KB search index, each face at its own
 * address so no redirect stands between the page and its art.
 */
export async function getTalkPickerRows(): Promise<TalkPickerRows> {
    const catalog = await getTalkCatalogState();
    if (catalog.animals.length === 0) return curatedFallbackRows();
    const bySlug = new Map(catalog.animals.map((animal) => [animal.slug, animal]));
    const slugs = [...catalog.popular, ...catalog.disagree.flat()];
    const files = await resolveSpeciesArtworkFiles(slugs).catch(() => new Map<string, string | null>());
    const withIcon = (slug: string): TalkAnimal | null => {
        const animal = bySlug.get(slug);
        if (!animal) return null;
        const file = files.get(slug);
        return {...animal, icon: file ? getSpeciesArtworkUrl(slug, file) : null};
    };
    return {
        popular: catalog.popular.map(withIcon).filter((animal): animal is TalkAnimal => animal !== null),
        disagree: catalog.disagree.flatMap(([left, right], index) => {
            const a = withIcon(left);
            const b = withIcon(right);
            return a && b ? [{left: a, right: b, topic: catalog.disagreeTopics?.[index] ?? null}] : [];
        })
    };
}

/**
 * Which chat /talk/<slug> is (WEB-1, `resolveTalkSlug`): the catalog's
 * animal; the catalog animal a species page is, as a redirect; the species
 * page's own animal; or nothing. With the catalog unreadable, the slug is
 * taken as it comes, as before.
 */
export async function resolveTalkPage(slug: string): Promise<TalkResolution & {animal?: TalkAnimal}> {
    const direct = await getTalkAnimal(slug);
    if (direct) return {kind: "catalog", slug, animal: direct};
    const [catalog, entry] = await Promise.all([
        getTalkCatalogState(),
        getResolvedSpeciesBySlug(slug).catch(() => null)
    ]);
    const resolution = resolveTalkSlug({
        slug,
        index: catalog.index,
        entry: entry ? {slug: entry.slug, name: entry.name, speciesProfileId: entry.speciesProfileId ?? null, normalizedIdentityKey: entry.normalizedIdentityKey ?? null} : null,
        identityKeys: collectionIdentityMatchKeys
    });
    if (resolution.kind === "species") return {...resolution, animal: {slug: resolution.slug, name: resolution.name, power: null}};
    return resolution;
}

/** The chat's slug for an animal a page names by its species-page slug: the catalog's, when that differs. */
export async function talkSlugForSpeciesPage(slug: string): Promise<string> {
    const resolution = await resolveTalkPage(slug);
    return resolution.kind === "redirect" || resolution.kind === "catalog" || resolution.kind === "species" ? resolution.slug : slug;
}

/** The catalog animal a species profile id is (the account's thread keys name species by id). */
export async function talkAnimalsForSpeciesProfiles(ids: string[]): Promise<Map<string, TalkAnimal>> {
    const catalog = await getTalkCatalogState();
    const bySlug = new Map(catalog.animals.map((animal) => [animal.slug, animal]));
    const found = new Map<string, TalkAnimal>();
    for (const id of ids) {
        const slug = catalog.index.bySpeciesProfileId.get(id.toLowerCase());
        const animal = slug ? bySlug.get(slug) : undefined;
        if (animal) found.set(id.toLowerCase(), animal);
    }
    return found;
}

/** Where a chat's canonical goes: its species page when there is one, else the chat itself. */
export async function talkCanonicalPath(slug: string): Promise<string> {
    const entry = await getResolvedSpeciesBySlug(slug).catch(() => null);
    return entry ? `/animals/${entry.slug}` : `/talk/${slug}`;
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
    // People are not one of the animals to bring a problem to.
    if (slug === "human") return null;
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
