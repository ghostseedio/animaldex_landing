import "server-only";
import foodTable from "@/ark-scene/food-links.json";
import {readPublicArk} from "@/data/ark-public";
import {
    arkFoodChainAboard,
    arkFoodChainCandidates,
    arkFoodChainEntry,
    arkFoodChainIndex,
    arkFoodChainKind,
    arkFoodChainLinkCount,
    arkFoodChainLooks,
    type ArkFoodChainAboard,
    type ArkFoodChainEntry,
    type ArkFoodChainRow,
    type ArkFoodChainSpecies
} from "@/lib/ark-food-chain";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The Ark's food chain, read on the server (decision 244): the stored food
 * links of the species aboard (`voyage_food_links`, field-guide facts,
 * species to species) with their phrases, and the public snapshot for who is
 * aboard. The view is closed to anon and authenticated, so it is read with the
 * service key here, as the species pages' diet line already was
 * (`readArkFoodLinks`): only the species, link and phrase columns, nothing
 * user-linked.
 *
 * Cheap: each species' links are two reads, cached for a day by Next's fetch
 * cache and memoised per process; the snapshot is the shared `readPublicArk`.
 */

/** The view's species, link and phrase columns: nothing else is ever selected. */
export const ARK_FOOD_CHAIN_COLUMNS = "id,predator,prey,basis,group_label,phrase,realm_ok,size_ok";
/** A predator's diet or a prey's predators: far below this in the catalogue (the widest group diets reach a few hundred). */
const ROW_LIMIT = 1000;
const DAY = 86_400;

/** An indexed species page for a model slug, or null. */
export function arkFoodChainPage(slug: string): string | null {
    return isPublishedAnimalSlug(slug) ? `/animals/${slug.trim().toLowerCase()}` : null;
}

async function readRows(filter: string, revalidate: number): Promise<ArkFoodChainRow[] | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/voyage_food_links?select=${ARK_FOOD_CHAIN_COLUMNS}&${filter}&limit=${ROW_LIMIT}`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate, tags: ["ark-food-links"]}
        });
        if (!response.ok) return null;
        const body = await response.json();
        return Array.isArray(body) ? (body as ArkFoodChainRow[]) : null;
    } catch {
        return null;
    }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Both sides of a kind's links: what its looks eat, and what eats any of its looks. Null when the view cannot be read. */
async function readKindRows(aboard: ArkFoodChainAboard, kind: string, revalidate: number): Promise<ArkFoodChainRow[] | null> {
    const looks = arkFoodChainLooks(aboard, kind).filter((id) => UUID.test(id)).slice(0, 40);
    if (!looks.length) return null;
    const list = looks.join(",");
    const [eats, eatenBy] = await Promise.all([readRows(`predator=in.(${list})`, revalidate), readRows(`prey=in.(${list})`, revalidate)]);
    if (!eats || !eatenBy) return null;
    // Kept per kind for a day, so only the rows between species aboard now (most of a diet's catalogue is not aboard):
    // a species that comes aboard later shows in its links with the next read.
    const aboardSide = (value: unknown) => typeof value === "string" && aboard.kindOf.has(value.toLowerCase());
    return [...eats, ...eatenBy].filter((row) => aboardSide(row.predator) && aboardSide(row.prey) && row.realm_ok !== false && row.size_ok !== false);
}

type Memo<T> = {at: number; promise: Promise<T>};
const MEMO_MAX = 1500;

function remember<T>(memo: Map<string, Memo<T>>, key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = memo.get(key);
    if (hit && now - hit.at < ttlMs) return hit.promise;
    if (memo.size >= MEMO_MAX) memo.clear();
    const promise = load().then((value) => {
        if (value === null) memo.delete(key);
        return value;
    });
    memo.set(key, {at: now, promise});
    return promise;
}

export type ArkFoodChainRead = {aboard: ArkFoodChainAboard; asOf: string | null};

const aboardMemo = new WeakMap<object, ArkFoodChainRead>();

/**
 * Who is aboard, for the food chain (the shared public read, `revalidate`
 * seconds). Null before the Ark can be read. Built once per snapshot, so the
 * thousands of species pages built from one read share it.
 */
export async function readArkFoodChainAboard(revalidate = 300): Promise<ArkFoodChainRead | null> {
    const snapshot = await readPublicArk(revalidate);
    if (!snapshot) return null;
    let read = aboardMemo.get(snapshot);
    if (!read) {
        read = {aboard: arkFoodChainAboard(snapshot), asOf: snapshot.as_of ?? null};
        aboardMemo.set(snapshot, read);
    }
    return read;
}

/**
 * One species' place in the food chain, by its model slug or species id, or
 * null when none of it is aboard or the links cannot be read. The links are
 * read for a day; who is aboard is the caller's read (so counts stay fresh).
 */
export async function readArkFoodChainEntry(read: ArkFoodChainRead, value: string, revalidate = DAY): Promise<ArkFoodChainEntry | null> {
    const kind = arkFoodChainKind(read.aboard, value);
    if (!kind) return null;
    const rows = await remember(entryRowsMemo, kind, revalidate * 1000, () => readKindRows(read.aboard, kind, revalidate));
    if (!rows) return null;
    return arkFoodChainEntry(rows, read.aboard, kind, arkFoodChainPage);
}

const entryRowsMemo = new Map<string, Memo<ArkFoodChainRow[] | null>>();

const sceneTable = foodTable as {slugs: string[]; links: Record<string, string>};

/** The scene's visual food table: the prey slugs it knows for a predator (only to short-list what to feature). */
function scenePreyOf(slug: string): string[] {
    const row = sceneTable.links[slug];
    return row ? row.split(",").map((index) => sceneTable.slugs[Number.parseInt(index, 36)]).filter(Boolean) : [];
}

/**
 * Up to `limit` species to feature, each with links aboard both ways where it
 * can: predators whose prey is aboard (short-listed from the scene's table,
 * then read and checked against the real links). Fewer when fewer qualify.
 */
export async function readArkFoodChainFeatured(read: ArkFoodChainRead, limit: number, revalidate = DAY): Promise<ArkFoodChainEntry[]> {
    const wanted = Math.max(1, Math.min(limit, 12));
    const candidates = arkFoodChainCandidates(read.aboard, scenePreyOf, wanted * 2);
    // Each entry from its memoised rows and this read's counts: no extra reads once its rows are cached.
    const entries = (await Promise.all(candidates.map((kind) => readArkFoodChainEntry(read, kind, revalidate))))
        .filter((entry): entry is ArkFoodChainEntry => entry !== null && entry.eats.length > 0);
    // In the short-list's order (one per region first), the ones with the most links aboard kept when there are spare.
    const qualifying = entries.filter((entry) => arkFoodChainLinkCount(entry) > 1);
    return (qualifying.length >= wanted ? qualifying : entries).slice(0, wanted);
}


/** Every species aboard for the explorer's list. */
export function arkFoodChainSpeciesList(read: ArkFoodChainRead): ArkFoodChainSpecies[] {
    return arkFoodChainIndex(read.aboard, arkFoodChainPage);
}

/** Clears the per-process memos (tests). */
export function clearArkFoodChainMemo() {
    entryRowsMemo.clear();
}
