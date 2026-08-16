import {NextRequest, NextResponse} from "next/server";
import {getCatalogLandingPageIndex} from "@/data/catalog-landing-pages";
import {describeSpeciesArtwork} from "@/data/species-artwork-index";
import {getBattlePower, getBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import {identityKindShortLabel} from "@/lib/identity-kind";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * The index, as a list.
 *
 * One row per catalog entry with the things that decide whether it is finished:
 * its number, the identity key captures resolve through, whether it has a
 * subtitle, a core lesson and artwork, whether it publishes a landing page of
 * its own, the tier its stats put it in, and how many public captures sit behind
 * it. Artwork presence is resolved from a single cached bucket listing rather
 * than a request per row.
 */

type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

/**
 * Kinds that describe a form of some other indexed animal. The catalog stores no
 * pointer to that animal — canonical_species_profile_id means "this profile IS
 * that one" and folding a breed into its species would take the breed off
 * people's collections — so the parent is derived from the scientific name.
 */
const CHILD_KINDS = new Set(["breed", "variant", "cross_breed", "subspecies", "hybrid"]);
const PARENT_KINDS = ["domestic_parent", "generic_parent", "species"];

const LIST_COLUMNS = [
    "species_profile_id",
    "animaldex_number",
    "display_name",
    "animal_name",
    "scientific_name",
    "normalized_identity_key",
    "landing_page_slug",
    "identity_kind",
    "identity_resolution_mode",
    "identity_explanation",
    "identity_evidence_guidance",
    "catalog_status",
    "canonical_game_stats",
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

    // Asking for a page past the end is how the last page of a filtered view
    // reads, and PostgREST answers 416 rather than an empty list.
    if (response.status === 416) return {rows: [] as Row[], total: null};
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

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStats(value: unknown): SpeciesStats | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    const stats = {
        dominance: Number(raw.dominance),
        speed: Number(raw.speed),
        size: Number(raw.size),
        intelligence: Number(raw.intelligence),
        rarity: Number(raw.rarity)
    };

    return Object.values(stats).every((entry) => Number.isFinite(entry)) ? stats : null;
}

/** "Ovis aries orientalis" → "Ovis aries", the name a breed's parent carries. */
function binomial(scientificName: string | null) {
    if (!scientificName) return null;
    const words = scientificName.split(/\s+/).filter(Boolean);
    return words.length >= 2 ? `${words[0]} ${words[1]}` : null;
}

/**
 * Indexed entry each breed-like row is a form of, matched on scientific name.
 * A domestic parent outranks a plain species, and both outrank another breed, so
 * "Pekin Duck" resolves to the duck rather than to "Cayuga Duck".
 */
async function resolveParents(rows: Row[]) {
    const wanted = new Map<string, Set<string>>();

    for (const row of rows) {
        if (!CHILD_KINDS.has(String(row.identity_kind ?? "").toLowerCase())) continue;
        const scientific = text(row.scientific_name);
        const names = [scientific, binomial(scientific)].filter(Boolean) as string[];
        if (names.length) wanted.set(String(row.species_profile_id), new Set(names));
    }

    if (!wanted.size) return new Map<string, {number: number | null; name: string; kind: string | null}>();

    const names = Array.from(new Set(Array.from(wanted.values()).flatMap((set) => Array.from(set))));
    const {rows: candidates} = await fetchRows(new URLSearchParams({
        select: "species_profile_id,animaldex_number,display_name,scientific_name,identity_kind",
        animaldex_number: "not.is.null",
        scientific_name: `in.(${names.map((name) => `"${name.replace(/"/g, '""')}"`).join(",")})`,
        limit: "200"
    }));

    const parents = new Map<string, {number: number | null; name: string; kind: string | null}>();

    for (const [profileId, acceptable] of Array.from(wanted)) {
        const best = candidates
            .filter((candidate) => String(candidate.species_profile_id) !== profileId
                && acceptable.has(String(candidate.scientific_name ?? "")))
            .sort((left, right) => {
                const rank = (row: Row) => {
                    const index = PARENT_KINDS.indexOf(String(row.identity_kind ?? "").toLowerCase());
                    return index < 0 ? PARENT_KINDS.length : index;
                };
                return rank(left) - rank(right);
            })
            .find((candidate) => PARENT_KINDS.includes(String(candidate.identity_kind ?? "").toLowerCase()));

        if (best) {
            parents.set(profileId, {
                number: typeof best.animaldex_number === "number" ? best.animaldex_number : null,
                name: String(best.display_name ?? "Unnamed entry"),
                kind: text(best.identity_kind)
            });
        }
    }

    return parents;
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
        // Neither artwork nor page coverage is a column, so those two filters are
        // applied after resolving the bucket and the page list for the page below.
        if (filter === "missing-artwork" || filter === "no-landing-page") params.set("animaldex_number", "gte.1");

        if (query) {
            if (/^\d+$/.test(query)) {
                params.set("animaldex_number", `eq.${query}`);
            } else {
                const term = `*${query}*`;
                params.set("or", `(display_name.ilike.${term},animal_name.ilike.${term},scientific_name.ilike.${term},normalized_identity_key.ilike.${term})`);
            }
        }

        const {rows, total} = await fetchRows(params, true);
        const [landingPages, parents] = await Promise.all([
            getCatalogLandingPageIndex(),
            resolveParents(rows)
        ]);

        const entries = await Promise.all(rows.map(async (row) => {
            const landingPage = landingPages.resolve(row);
            const slug = landingPage.slug ?? String(row.landing_page_slug ?? row.normalized_identity_key ?? "");
            const artwork = await describeSpeciesArtwork(slug);
            const stats = readStats(row.canonical_game_stats);
            const identityKind = text(row.identity_kind);

            return {
                speciesProfileId: row.species_profile_id,
                number: row.animaldex_number ?? null,
                displayName: row.display_name ?? null,
                animalName: row.animal_name ?? null,
                scientificName: row.scientific_name ?? null,
                identityKey: row.normalized_identity_key ?? null,
                slug: slug || null,
                identityKind,
                identityKindLabel: identityKindShortLabel(identityKind),
                identityResolutionMode: text(row.identity_resolution_mode),
                identityExplanation: text(row.identity_explanation),
                identityEvidenceGuidance: text(row.identity_evidence_guidance),
                parent: parents.get(String(row.species_profile_id)) ?? null,
                catalogStatus: row.catalog_status ?? null,
                hasSubtitle: Boolean(row.species_subtitle),
                hasLesson: Boolean(row.core_lesson),
                hasArtwork: Boolean(artwork.file),
                artwork,
                landingPage,
                stats,
                tier: stats ? getBattleTier(stats) : null,
                battlePower: stats ? getBattlePower(stats) : null,
                publicCaptures: Number(row.public_capture_count ?? 0),
                publicCapturesWithMedia: Number(row.public_capture_with_media_count ?? 0),
                lastPublicCaptureAt: row.last_public_capture_at ?? null
            };
        }));

        const filtered = filter === "missing-artwork"
            // An entry wearing a relative's illustration counts as missing its
            // own: it looks fine on every surface while being the wrong picture.
            ? entries.filter((entry) => entry.artwork.matchedVia !== "exact")
            : filter === "no-landing-page"
                // "Dedicated" is the question, so an entry folded into another
                // entry's page counts as not having one of its own.
                ? entries.filter((entry) => entry.landingPage.state !== "own")
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
