import "server-only";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";

export type {ArkFoodLink} from "@/lib/ark-seo";
import {arkFoodLinkOthers, arkFoodLinks, type ArkFoodLink, type ArkFoodLinkRow} from "@/lib/ark-seo";
import {isMissingArkFunction} from "@/lib/ark-story";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * The shared Ark as anyone sees it, for pages that are cached or crawled:
 * /ark's metadata and its server-rendered words, the share cards
 * (`/api/og/ark…`) and the species pages' "In the Ark". Anonymous, with the
 * public key, so nothing comes back `mine` and no cookie dynamizes the page;
 * cached by Next's fetch cache for `revalidate` seconds.
 *
 * Only counts and species reach the pages that use it: never a bringer's label.
 */

async function rpc(name: string, revalidate: number): Promise<{data: unknown; error: {code?: string; message?: string} | null}> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return {data: null, error: {message: "Supabase is not configured"}};
    try {
        const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({p_voyage: "first"}),
            next: {revalidate, tags: ["ark-public"]}
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return {data: null, error: (body as {code?: string; message?: string} | null) ?? {message: `HTTP ${response.status}`}};
        return {data: body, error: null};
    } catch (error) {
        return {data: null, error: {message: error instanceof Error ? error.message : "fetch failed"}};
    }
}

/**
 * `voyage_public_v2` (life v2), else `voyage_public_v1`; null before the Ark's migration or when the read fails.
 *
 * One read per process per window, whatever Next's data cache does: every
 * species page reads it, and in CI the fetch cache's writes can fail (as the
 * Power icon index's did, lib/animal-power-icons-server), which would make
 * each of thousands of static pages read the Ark again. A null is not kept.
 */
export function readPublicArk(revalidate = 300): Promise<ArkSnapshot | null> {
    const now = Date.now();
    const hit = publicArkMemo.get(revalidate);
    if (hit && now - hit.at < revalidate * 1000) return hit.promise;
    // A read made for a shorter window is fresh enough for a longer one: one parsed snapshot in memory, not one per
    // window (SEO lane S3: the Ark pages read it at 5 minutes and an hour, the species pages at a day).
    for (const [window, entry] of Array.from(publicArkMemo.entries())) {
        if (window < revalidate && now - entry.at < window * 1000) return entry.promise;
    }
    for (const [window, entry] of Array.from(publicArkMemo.entries())) {
        if (now - entry.at >= window * 1000) publicArkMemo.delete(window);
    }
    const promise = loadPublicArk(revalidate).then((snapshot) => {
        if (!snapshot) publicArkMemo.delete(revalidate);
        return snapshot;
    });
    publicArkMemo.set(revalidate, {at: now, promise});
    return promise;
}

const publicArkMemo = new Map<number, {at: number; promise: Promise<ArkSnapshot | null>}>();

async function loadPublicArk(revalidate: number): Promise<ArkSnapshot | null> {
    let read = await rpc("voyage_public_v2", revalidate);
    if (read.error && isMissingArkFunction(read.error)) read = await rpc("voyage_public_v1", revalidate);
    if (read.error) return null;
    return decodeArkSnapshot(read.data);
}

type SpeciesNameRow = {id?: unknown; display_name?: unknown; landing_page_slug?: unknown};

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What a species' field guide says it eats, as stored diet links
 * (`voyage_food_links`: each phrase is taken from the species' own field guide):
 * a named species, or the group the diet names ("birds"), each with its
 * phrase. Null while the view cannot be read. Links the realm check refused,
 * and group prey above the size rule (`size_ok = false`), are left out, so a
 * hawk never reads as eating a Komodo dragon. The view is closed to anon and
 * authenticated, so this reads with the service key on the server (decision
 * 244): species, link and phrase columns only, nobody's data.
 *
 * What eats a species is not listed from the whole catalogue (a fish's
 * predators by group run to hundreds); the species page says it for the Ark
 * instead, among the animals aboard (`src/data/ark-food-chain.ts`).
 */
export async function readArkFoodLinks(speciesProfileId: string, revalidate = 86400): Promise<ArkFoodLink[] | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    const id = speciesProfileId.trim();
    if (!url || !key || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const headers = getSupabaseHeaders(key);
    try {
        const response = await fetch(
            `${url}/rest/v1/voyage_food_links?select=predator,prey,basis,group_label,phrase,realm_ok,size_ok&predator=eq.${id}&limit=1000`,
            {headers, next: {revalidate, tags: ["ark-food-links"]}}
        );
        if (!response.ok) return null;
        const rows = (await response.json()) as ArkFoodLinkRow[];
        const others = arkFoodLinkOthers(rows, id);
        const names = new Map<string, {name: string; slug: string | null}>();
        if (others.length) {
            const list = others.slice(0, 150).join(",");
            const named = await fetch(`${url}/rest/v1/species_profiles?select=id,display_name,landing_page_slug&id=in.(${list})`, {headers, next: {revalidate, tags: ["ark-food-links"]}});
            if (named.ok) {
                for (const row of (await named.json()) as SpeciesNameRow[]) {
                    const rowId = text(row.id);
                    const name = text(row.display_name);
                    if (rowId && name) names.set(rowId.toLowerCase(), {name, slug: text(row.landing_page_slug)});
                }
            }
        }
        return arkFoodLinks(rows, id, names);
    } catch {
        return null;
    }
}

/**
 * Whether a species can come aboard at all (it has an Ark model:
 * `voyage_species`), so a page never promises one will. Null when that cannot
 * be told (no service key, or the read failed): the page then says less.
 */
export async function readArkCanBoard(species: {speciesProfileId?: string | null; slug?: string | null}, revalidate = 86400): Promise<boolean | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    const id = species.speciesProfileId?.trim() ?? "";
    const slug = species.slug?.trim().toLowerCase() ?? "";
    const filters = [
        /^[0-9a-f-]{36}$/i.test(id) ? `species_profile_id.eq.${id}` : null,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `model_slug.eq.${slug}` : null
    ].filter(Boolean);
    if (!url || !key || !filters.length) return null;
    try {
        const response = await fetch(`${url}/rest/v1/voyage_species?select=model_slug&or=(${filters.join(",")})&limit=1`, {
            headers: getSupabaseHeaders(key),
            next: {revalidate, tags: ["ark-species"]}
        });
        if (!response.ok) return null;
        return ((await response.json()) as unknown[]).length > 0;
    } catch {
        return null;
    }
}
