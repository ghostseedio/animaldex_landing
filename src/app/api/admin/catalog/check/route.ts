import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Is this animal already in the catalog, under any name?
 *
 * Asked before minting a new entry, because the ways an animal is already here
 * are not obvious from its name. It may hold a number under a scientific name
 * nobody uses in conversation; it may be an alias of something else; it may sit
 * beneath a group entry that already covers it, which is the case the database
 * cares about most — indexing "Black Garden Ant" beside "Black Ant" splits a
 * collection that was working.
 *
 * Every match is returned with the reason it matched, rather than a yes/no: the
 * decision of whether a group entry really covers a species is a judgement, and
 * this is the evidence for it.
 */

type Row = Record<string, unknown>;

type Match = {
    speciesProfileId: string;
    number: number | null;
    displayName: string | null;
    scientificName: string | null;
    identityKey: string | null;
    identityKind: string | null;
    catalogStatus: string | null;
    reason: string;
    /** True when this match would block a new entry rather than merely inform it. */
    blocking: boolean;
};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");
    return {url, key};
}

async function rows(table: string, params: URLSearchParams) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} lookup failed (${response.status})`);
    return await response.json() as Row[];
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function identityKeyFor(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const PROFILE_COLUMNS = "id,animaldex_number,display_name,scientific_name,normalized_identity_key,identity_kind,catalog_status";

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {displayName?: string; scientificName?: string};
    const displayName = body.displayName?.trim() ?? "";
    const scientificName = body.scientificName?.trim() ?? "";

    if (!displayName) {
        return NextResponse.json({ok: false, error: "An animal name is required"}, {status: 400});
    }

    const identityKey = identityKeyFor(displayName);

    try {
        const found = new Map<string, Match>();
        const add = (row: Row, reason: string, blocking: boolean) => {
            const id = String(row.id);
            // First reason wins: the checks run strongest-first, so an exact key
            // match is not overwritten by a looser name match on the same row.
            if (found.has(id)) return;
            found.set(id, {
                speciesProfileId: id,
                number: typeof row.animaldex_number === "number" ? row.animaldex_number : null,
                displayName: text(row.display_name),
                scientificName: text(row.scientific_name),
                identityKey: text(row.normalized_identity_key),
                identityKind: text(row.identity_kind),
                catalogStatus: text(row.catalog_status),
                reason,
                blocking
            });
        };

        // 1. The identity key this entry would claim. A collision is absolute:
        //    two profiles cannot hold the same key.
        if (identityKey) {
            for (const row of await rows("species_profiles", new URLSearchParams({
                select: PROFILE_COLUMNS,
                normalized_identity_key: `eq.${identityKey}`
            }))) add(row, "Already holds the identity key this entry would use", true);
        }

        // 2. An alias already pointing somewhere. Indexing the alias separately
        //    would strand every capture that resolves through it.
        if (identityKey) {
            const aliases = await rows("species_identity_aliases", new URLSearchParams({
                select: "alias_identity_key,canonical_identity_key",
                alias_identity_key: `eq.${identityKey}`
            }));

            for (const alias of aliases) {
                const canonical = text(alias.canonical_identity_key);
                if (!canonical) continue;
                for (const row of await rows("species_profiles", new URLSearchParams({
                    select: PROFILE_COLUMNS,
                    normalized_identity_key: `eq.${canonical}`
                }))) add(row, `"${identityKey}" is already an alias of this entry`, true);
            }
        }

        // 3. The exact scientific name — the same animal under a different
        //    common name is the duplicate that is easiest to miss.
        if (scientificName) {
            for (const row of await rows("species_profiles", new URLSearchParams({
                select: PROFILE_COLUMNS,
                scientific_name: `ilike.${scientificName}`
            }))) add(row, "Same scientific name", true);
        }

        // 4. The genus, and any group entry whose name is contained in this one.
        //    Neither blocks — "Black Ant" covering "Black Garden Ant" is a real
        //    judgement, not a rule — but both are the thing worth looking at.
        const genus = scientificName.split(/\s+/)[0] ?? "";
        if (genus && genus.length > 2) {
            for (const row of await rows("species_profiles", new URLSearchParams({
                select: PROFILE_COLUMNS,
                scientific_name: `ilike.${genus}*`,
                animaldex_number: "not.is.null",
                limit: "20"
            }))) add(row, `Same genus (${genus})`, false);
        }

        const words = displayName.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
        for (const word of words.slice(-2)) {
            for (const row of await rows("species_profiles", new URLSearchParams({
                select: PROFILE_COLUMNS,
                display_name: `ilike.*${word}*`,
                animaldex_number: "not.is.null",
                limit: "20"
            }))) {
                const kind = text(row.identity_kind);
                add(row, kind === "group" || kind === "generic_parent"
                    ? `A group entry that may already cover this animal`
                    : `Shares the word "${word}"`, false);
            }
        }

        const matches = Array.from(found.values())
            .sort((left, right) => Number(right.blocking) - Number(left.blocking));

        return NextResponse.json({
            ok: true,
            identityKey,
            matches,
            blocking: matches.filter((match) => match.blocking),
            groupCover: matches.filter((match) => match.identityKind === "group" || match.identityKind === "generic_parent")
        });
    } catch (error) {
        console.error("[admin-catalog-check]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to check the catalog"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
