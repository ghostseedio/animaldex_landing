import {NextRequest, NextResponse} from "next/server";
import {databaseSpeciesCanonicalSlug} from "@/data/database-species-pages";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Indexed entries that look like the same animal twice.
 *
 * Two numbers for one animal split its captures, so neither entry looks as
 * collected as it is, and only one of them can hold the landing page. The
 * signals here are ranked by how close they come to proving it: an identical
 * identity key or slug is a collision, an identical name is nearly always a
 * duplicate, and a shared scientific name is usually a family — a breed beside
 * its parent species — which is worth seeing but not worth releasing.
 *
 * Nothing is merged or released here. This says where to look.
 */

type Row = Record<string, unknown>;

const SIGNALS = [
    {id: "identity-key", label: "Same identity key", verdict: "duplicate"},
    {id: "slug", label: "Same landing slug", verdict: "duplicate"},
    {id: "name", label: "Same name", verdict: "duplicate"},
    {id: "scientific-name", label: "Same scientific name", verdict: "related"}
] as const;

type SignalId = typeof SIGNALS[number]["id"];

const SELECT = [
    "species_profile_id",
    "animaldex_number",
    "display_name",
    "animal_name",
    "scientific_name",
    "normalized_identity_key",
    "landing_page_slug",
    "identity_kind",
    "catalog_status",
    "public_capture_count",
    "last_public_capture_at"
].join(",");

/** Scientific names that name a group rather than an animal, so sharing one proves nothing. */
const UNSPECIFIC_SCIENTIFIC_NAMES = new Set([
    "scientific classification under review",
    "unknown",
    "n/a"
]);

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalize(value: unknown) {
    return text(value)?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
}

async function loadIndexed() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");

    const rows: Row[] = [];

    for (let offset = 0; offset < 20_000; offset += 1000) {
        const params = new URLSearchParams({
            select: SELECT,
            animaldex_number: "not.is.null",
            order: "animaldex_number.asc",
            limit: "1000",
            offset: String(offset)
        });
        const response = await fetch(`${url}/rest/v1/species_catalog_v1?${params}`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`Catalog query failed (${response.status})`);

        const page = await response.json() as Row[];
        rows.push(...page);
        if (page.length < 1000) break;
    }

    return rows;
}

function member(row: Row) {
    return {
        speciesProfileId: String(row.species_profile_id),
        number: typeof row.animaldex_number === "number" ? row.animaldex_number : null,
        displayName: text(row.display_name) ?? text(row.animal_name),
        scientificName: text(row.scientific_name),
        identityKey: text(row.normalized_identity_key),
        identityKind: text(row.identity_kind),
        catalogStatus: text(row.catalog_status),
        slug: databaseSpeciesCanonicalSlug({
            landing_page_slug: text(row.landing_page_slug),
            normalized_identity_key: text(row.normalized_identity_key),
            animaldex_number: typeof row.animaldex_number === "number" ? row.animaldex_number : null
        }) || null,
        publicCaptures: Number(row.public_capture_count ?? 0),
        lastPublicCaptureAt: text(row.last_public_capture_at)
    };
}

function keyFor(signal: SignalId, row: Row) {
    if (signal === "identity-key") return normalize(row.normalized_identity_key);
    if (signal === "name") return normalize(text(row.display_name) ?? text(row.animal_name));
    if (signal === "slug") {
        return databaseSpeciesCanonicalSlug({
            landing_page_slug: text(row.landing_page_slug),
            normalized_identity_key: text(row.normalized_identity_key),
            animaldex_number: typeof row.animaldex_number === "number" ? row.animaldex_number : null
        });
    }

    const scientific = normalize(row.scientific_name);
    // A single-word name is a genus or a family, which many animals share.
    return UNSPECIFIC_SCIENTIFIC_NAMES.has(scientific) || scientific.split(" ").length < 2 ? "" : scientific;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const rows = await loadIndexed();
        const groups: Array<{
            signal: SignalId;
            label: string;
            verdict: string;
            key: string;
            members: ReturnType<typeof member>[];
        }> = [];
        // A pair caught by a stronger signal is not restated by a weaker one, so
        // one duplicate does not appear as four findings.
        const seenPairs = new Set<string>();

        for (const signal of SIGNALS) {
            const buckets = new Map<string, Row[]>();

            for (const row of rows) {
                const key = keyFor(signal.id, row);
                if (!key) continue;
                buckets.set(key, [...(buckets.get(key) ?? []), row]);
            }

            for (const [key, bucket] of Array.from(buckets)) {
                if (bucket.length < 2) continue;

                const ids = bucket.map((row) => String(row.species_profile_id)).sort();
                const pairs: string[] = [];
                let novel = false;

                for (let left = 0; left < ids.length; left += 1) {
                    for (let right = left + 1; right < ids.length; right += 1) {
                        const pair = `${ids[left]}:${ids[right]}`;
                        pairs.push(pair);
                        if (!seenPairs.has(pair)) novel = true;
                    }
                }

                if (!novel) continue;
                for (const pair of pairs) seenPairs.add(pair);

                groups.push({
                    signal: signal.id,
                    label: signal.label,
                    verdict: signal.verdict,
                    key,
                    members: bucket
                        .map(member)
                        .sort((left, right) => (right.publicCaptures - left.publicCaptures)
                            || ((left.number ?? 0) - (right.number ?? 0)))
                });
            }
        }

        return NextResponse.json({
            ok: true,
            scanned: rows.length,
            duplicates: groups.filter((group) => group.verdict === "duplicate"),
            related: groups.filter((group) => group.verdict === "related")
        });
    } catch (error) {
        console.error("[admin-catalog-duplicates]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan the catalog"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
