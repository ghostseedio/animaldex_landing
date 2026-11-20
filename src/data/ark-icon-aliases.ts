import "server-only";
import {arkIconAlias, type ArkIconProfile} from "@/lib/ark-icons";
import type {ArtworkIndex} from "@/data/species-artwork-resolution";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

/** As long as the bucket listing is kept (`species-artwork-index.ts`): an icon uploaded since is found within this. */
const TTL_MS = 30 * 60 * 1000;
/** A failed read is not asked again for this long (the answer goes out meanwhile with the generic figure). */
const RETRY_MS = 60 * 1000;
/** Ids per request: a uuid is 37 characters of the address. */
const IDS_PER_READ = 100;
const COLUMNS = "id,landing_page_slug,normalized_identity_key,display_name,animal_name,refined_identity,scientific_name";

type Memo = {artwork: object; at: number; found: Map<string, string | null>; retryAt: number; pending: Promise<void> | null};
let memo: Memo | null = null;

/**
 * The icon files of species whose Ark slug has none (`/api/ark/voyage`): for each model slug in `missing`, the file
 * the bucket holds under another of the species' own names (`arkIconAlias`: page slug, identity key, names, scientific
 * name), read from `species_profiles` (those columns only, the service key as the other Ark reads) for the species
 * aboard under that slug. Kept in memory as long as the listing is (a species is read once per window, found or not;
 * the listing's identity ends it with the listing); a species that cannot be read is simply left out, and the answer
 * keeps the generic figure for it, as before.
 */
export async function readArkIconAliases(animals: ReadonlyArray<{model_slug: string; species_profile_id: string}>, missing: readonly string[], artwork: ArtworkIndex): Promise<Map<string, string>> {
    const now = Date.now();
    if (!memo || memo.artwork !== artwork || now - memo.at >= TTL_MS) memo = {artwork, at: now, found: new Map(), retryAt: 0, pending: null};
    const state = memo;
    const todo = () => missing.filter((slug) => !state.found.has(slug));
    if (state.pending) await state.pending;
    if (todo().length && Date.now() >= state.retryAt) {
        state.pending = load(state, animals, todo(), artwork).finally(() => {
            state.pending = null;
        });
        await state.pending;
    }
    const aliases = new Map<string, string>();
    for (const slug of missing) {
        const file = state.found.get(slug);
        if (file) aliases.set(slug, file);
    }
    return aliases;
}

async function load(state: Memo, animals: ReadonlyArray<{model_slug: string; species_profile_id: string}>, slugs: readonly string[], artwork: ArtworkIndex): Promise<void> {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) {
        state.retryAt = Date.now() + RETRY_MS;
        return;
    }
    const wanted = new Set(slugs);
    const idsBySlug = new Map<string, Set<string>>();
    for (const {model_slug: slug, species_profile_id: id} of animals) {
        if (!wanted.has(slug) || !/^[0-9a-f-]{36}$/i.test(id)) continue;
        const ids = idsBySlug.get(slug);
        if (ids) ids.add(id);
        else idsBySlug.set(slug, new Set([id]));
    }
    const all = Array.from(new Set(Array.from(idsBySlug.values()).flatMap((ids) => Array.from(ids))));
    const profiles = new Map<string, ArkIconProfile>();
    try {
        const headers = getSupabaseHeaders(key);
        const reads: Array<Promise<void>> = [];
        for (let at = 0; at < all.length; at += IDS_PER_READ) {
            const list = all.slice(at, at + IDS_PER_READ).join(",");
            reads.push(
                fetch(`${url}/rest/v1/species_profiles?select=${COLUMNS}&id=in.(${list})`, {headers, cache: "no-store"}).then(async (response) => {
                    if (!response.ok) throw new Error(`species_profiles ${response.status}`);
                    for (const row of (await response.json()) as Array<ArkIconProfile & {id: string}>) profiles.set(row.id, row);
                })
            );
        }
        await Promise.all(reads);
    } catch (error) {
        console.warn("[ark] icon names could not be read", error instanceof Error ? error.message.slice(0, 120) : "failed");
        state.retryAt = Date.now() + RETRY_MS;
        return;
    }
    for (const slug of slugs) {
        const named = Array.from(idsBySlug.get(slug) ?? []).flatMap((id) => profiles.get(id) ?? []);
        state.found.set(slug, arkIconAlias(named, artwork));
    }
}
