import {NextRequest, NextResponse} from "next/server";
import {resolveSpeciesArtworkFiles} from "@/data/species-artwork-index";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * The index, as a list.
 *
 * One row per catalog entry with the things that decide whether it is finished:
 * its number, the identity key captures resolve through, whether it has a
 * subtitle, a core lesson and artwork, and how many public captures sit behind
 * it. Artwork presence is resolved from a single cached bucket listing rather
 * than a request per row.
 */

type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

const LIST_COLUMNS = [
    "species_profile_id",
    "animaldex_number",
    "display_name",
    "animal_name",
    "scientific_name",
    "normalized_identity_key",
    "landing_page_slug",
    "identity_kind",
    "catalog_status",
    "species_subtitle",
    "core_lesson",
    "public_capture_count",
    "public_capture_with_media_count",
    "last_public_capture_at"
].join(",");

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");
    return {url, key};
}

async function fetchRows(params: URLSearchParams, wantCount = false) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/species_catalog_v1?${params}`, {
        headers: getSupabaseHeaders(key, {
            Accept: "application/json",
            ...(wantCount ? {Prefer: "count=exact"} : {})
        }),
        cache: "no-store"
    });

    if (!response.ok) throw new Error(`Catalog query failed (${response.status})`);

    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    return {rows: await response.json() as Row[], total: Number.isFinite(total) ? total : null};
}

async function count(extra: Record<string, string>) {
    const {url, key} = config();
    const params = new URLSearchParams({select: "species_profile_id", ...extra});
    const response = await fetch(`${url}/rest/v1/species_catalog_v1?${params}`, {
        method: "HEAD",
        headers: getSupabaseHeaders(key, {Prefer: "count=exact", Range: "0-0"}),
        cache: "no-store"
    });
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const search = request.nextUrl.searchParams;
    const query = search.get("q")?.trim() ?? "";
    const filter = search.get("filter") ?? "indexed";
    const sort = search.get("sort") ?? "number";
    const page = Math.max(0, Number(search.get("page")) || 0);

    try {
        const params = new URLSearchParams({
            select: LIST_COLUMNS,
            limit: String(PAGE_SIZE),
            offset: String(page * PAGE_SIZE)
        });

        params.set("order", sort === "captures"
            ? "public_capture_count.desc.nullslast,animaldex_number.asc"
            : sort === "name"
                ? "display_name.asc"
                : sort === "recent"
                    ? "last_public_capture_at.desc.nullslast"
                    : "animaldex_number.asc.nullslast");

        if (filter === "indexed") params.set("animaldex_number", "gte.1");
        if (filter === "unindexed") params.set("animaldex_number", "is.null");
        if (filter === "missing-subtitle") {
            params.set("animaldex_number", "gte.1");
            params.set("species_subtitle", "is.null");
        }
        if (filter === "missing-lesson") {
            params.set("animaldex_number", "gte.1");
            params.set("core_lesson", "is.null");
        }
        // Artwork is not a column, so that filter is applied after resolving the
        // bucket for the page below.
        if (filter === "missing-artwork") params.set("animaldex_number", "gte.1");

        if (query) {
            if (/^\d+$/.test(query)) {
                params.set("animaldex_number", `eq.${query}`);
            } else {
                const term = `*${query}*`;
                params.set("or", `(display_name.ilike.${term},animal_name.ilike.${term},scientific_name.ilike.${term},normalized_identity_key.ilike.${term})`);
            }
        }

        const {rows, total} = await fetchRows(params, true);
        const artwork = await resolveSpeciesArtworkFiles(rows
            .map((row) => String(row.landing_page_slug ?? row.normalized_identity_key ?? ""))
            .filter(Boolean));

        const entries = rows.map((row) => {
            const slug = String(row.landing_page_slug ?? row.normalized_identity_key ?? "");
            return {
                speciesProfileId: row.species_profile_id,
                number: row.animaldex_number ?? null,
                displayName: row.display_name ?? null,
                animalName: row.animal_name ?? null,
                scientificName: row.scientific_name ?? null,
                identityKey: row.normalized_identity_key ?? null,
                slug: slug || null,
                identityKind: row.identity_kind ?? null,
                catalogStatus: row.catalog_status ?? null,
                hasSubtitle: Boolean(row.species_subtitle),
                hasLesson: Boolean(row.core_lesson),
                hasArtwork: Boolean(artwork.get(slug)),
                publicCaptures: Number(row.public_capture_count ?? 0),
                publicCapturesWithMedia: Number(row.public_capture_with_media_count ?? 0),
                lastPublicCaptureAt: row.last_public_capture_at ?? null
            };
        });

        const filtered = filter === "missing-artwork"
            ? entries.filter((entry) => !entry.hasArtwork)
            : entries;

        const summary = search.get("summary") === "1" ? {
            indexed: await count({animaldex_number: "gte.1"}),
            unindexed: await count({animaldex_number: "is.null"}),
            missingSubtitle: await count({animaldex_number: "gte.1", species_subtitle: "is.null"}),
            missingLesson: await count({animaldex_number: "gte.1", core_lesson: "is.null"})
        } : null;

        return NextResponse.json({
            ok: true,
            entries: filtered,
            page,
            pageSize: PAGE_SIZE,
            total,
            summary
        });
    } catch (error) {
        console.error("[admin-catalog-list]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to load the catalog"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
