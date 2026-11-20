import "server-only";
import cards from "@/data/ark-species-cards.json";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import type {ArkSpeciesCard} from "@/lib/ark-species-card";

/**
 * One species' AnimalDex index number and Animal Power for the Ark's tapped card (lane ARK-SIMPLE): the catalog's own
 * `animaldex_number`, `principle_name` and `core_lesson` (`species_catalog_v1`, the row the apps and Talk read), first
 * from the published build-time snapshot (`ark-species-cards.json`, `scripts/refreshArkSpeciesCards.mjs`), and for a
 * species that is not in it, the catalog view itself (cached a day by the fetch). Species facts only: the same for
 * everyone, nothing about any animal or person.
 */

type Row = [number | null, string | null, string | null];
const table = cards as unknown as {bySlug: Record<string, Row>; byId: Record<string, string>};

function fromRow(row: Row | undefined): ArkSpeciesCard | null {
    if (!row) return null;
    const [number, power, lesson] = row;
    return {number: number ?? null, power: power ? {name: power, lesson: lesson ?? null} : null};
}

async function fromCatalog(id: string): Promise<ArkSpeciesCard | null> {
    const base = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!base || !key || isSeoSsgRemoteForbidden()) return null;
    try {
        const url = `${base}/rest/v1/species_catalog_v1?select=animaldex_number,principle_name,core_lesson,principle_expression&species_profile_id=eq.${encodeURIComponent(id)}&limit=1`;
        const response = await fetch(url, {headers: getSupabaseHeaders(key, {Accept: "application/json"}), next: {revalidate: 86400, tags: [`ark-species-card:${id}`]}});
        if (!response.ok) return null;
        const rows = (await response.json()) as Array<Record<string, unknown>>;
        const row = rows[0];
        if (!row) return null;
        const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
        const number = typeof row.animaldex_number === "number" && row.animaldex_number >= 1 ? row.animaldex_number : null;
        const name = text(row.principle_name);
        return {number, power: name ? {name, lesson: text(row.core_lesson) ?? text(row.principle_expression)} : null};
    } catch {
        return null;
    }
}

/** The card's facts for a species by its profile id (the snapshot's row for it, else its model slug's), or null. */
export async function readArkSpeciesCard(id: string | null, slug: string | null): Promise<ArkSpeciesCard | null> {
    const known = (id ? table.byId[id.toLowerCase()] : undefined) ?? slug ?? undefined;
    const local = fromRow(known ? table.bySlug[known] : undefined) ?? (slug && slug !== known ? fromRow(table.bySlug[slug]) : null);
    if (local && local.number !== null && local.power) return local;
    const remote = id ? await fromCatalog(id) : null;
    if (!remote) return local;
    return {number: remote.number ?? local?.number ?? null, power: remote.power ?? local?.power ?? null};
}
