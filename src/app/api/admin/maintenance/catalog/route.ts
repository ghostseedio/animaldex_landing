import {NextRequest, NextResponse} from "next/server";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Read and edit one catalog entry: the content an AnimalDex number implies.
 *
 * Indexing an animal has always meant more than allocating a number — a subtitle,
 * a behaviour principle with a core lesson, calibrated stats, aliases so other
 * names for the animal resolve to it, and artwork. That set was previously
 * assembled by hand in a migration per animal; this exposes the same fields so a
 * gap can be filled without one.
 *
 * Stats are deliberately edited as whole numbers with no recalibration: they are
 * chosen against the neighbours already indexed, which is a judgement the panel
 * shows but does not make.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function query(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    }

    return response;
}

async function rows<T>(path: string) {
    return (await (await query(path)).json()) as T[];
}

/** A slug with no object in the artwork bucket shows as a blank card in the app. */
async function hasArtwork(slug: string | null) {
    if (!slug) return false;

    try {
        const response = await fetch(getSpeciesArtworkUrl(slug), {method: "HEAD", cache: "no-store"});
        return response.ok;
    } catch {
        return false;
    }
}

type CatalogEntry = Record<string, unknown> & {
    aliases: Array<{alias_identity_key: string; notes: string | null; source: string | null}>;
    artwork: {slug: string | null; present: boolean};
};

async function loadEntry(speciesProfileId: string): Promise<CatalogEntry | null> {
    const [profile] = await rows<Record<string, unknown>>(`species_catalog_v1?${new URLSearchParams({
        select: "species_profile_id,animaldex_number,display_name,animal_name,scientific_name,normalized_identity_key,landing_page_slug,identity_kind,catalog_status,canonical_game_stats,size_scale_score,species_subtitle,species_subtitle_story,principle_name,principle_expression,core_lesson,biological_basis,short_motto,application_example,public_capture_count",
        species_profile_id: `eq.${speciesProfileId}`,
        limit: "1"
    })}`);

    if (!profile) return null;

    const identityKey = String(profile.normalized_identity_key ?? "");
    const aliases = identityKey
        ? await rows<{alias_identity_key: string; notes: string | null; source: string | null}>(
            `species_identity_aliases?${new URLSearchParams({
                select: "alias_identity_key,notes,source",
                canonical_identity_key: `eq.${identityKey}`,
                order: "alias_identity_key.asc"
            })}`)
        : [];

    return {
        ...profile,
        aliases,
        artwork: {
            slug: (profile.landing_page_slug as string | null) ?? null,
            present: await hasArtwork((profile.landing_page_slug as string | null) ?? null)
        }
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const speciesProfileId = request.nextUrl.searchParams.get("speciesProfileId")?.trim() ?? "";
    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    try {
        if (UUID.test(speciesProfileId)) {
            const entry = await loadEntry(speciesProfileId);
            if (!entry) return NextResponse.json({ok: false, error: "No catalog entry with that id"}, {status: 404});
            return NextResponse.json({ok: true, entry});
        }

        if (search.length < 2) return NextResponse.json({ok: true, matches: []});

        const params = new URLSearchParams({
            select: "species_profile_id,animaldex_number,display_name,scientific_name,normalized_identity_key,landing_page_slug,species_subtitle,core_lesson",
            order: "animaldex_number.asc",
            limit: "25"
        });

        if (/^\d+$/.test(search)) {
            params.set("animaldex_number", `eq.${search}`);
        } else {
            const term = `*${search}*`;
            params.set("or", `(display_name.ilike.${term},animal_name.ilike.${term},scientific_name.ilike.${term},normalized_identity_key.ilike.${term})`);
        }

        return NextResponse.json({ok: true, matches: await rows(`species_catalog_v1?${params}`)});
    } catch (error) {
        console.error("[admin-catalog]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Catalog lookup failed"
        }, {status: 500});
    }
}

type PatchBody = {
    speciesProfileId?: string;
    subtitle?: string | null;
    subtitleStory?: string | null;
    principleName?: string | null;
    coreLesson?: string | null;
    principleExpression?: string | null;
    shortMotto?: string | null;
    stats?: Partial<Record<typeof STAT_KEYS[number], number>>;
    addAlias?: string | null;
    removeAlias?: string | null;
};

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as PatchBody;
    const speciesProfileId = body.speciesProfileId?.trim() ?? "";

    if (!UUID.test(speciesProfileId)) {
        return NextResponse.json({ok: false, error: "A catalog entry is required"}, {status: 400});
    }

    try {
        const entry = await loadEntry(speciesProfileId);
        if (!entry) return NextResponse.json({ok: false, error: "No catalog entry with that id"}, {status: 404});

        const identityKey = String(entry.normalized_identity_key ?? "");
        const applied: string[] = [];

        if (body.subtitle !== undefined || body.subtitleStory !== undefined) {
            await query("species_subtitles", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify({
                    species_profile_id: speciesProfileId,
                    locale: "en",
                    slug: entry.landing_page_slug ?? identityKey,
                    subtitle: body.subtitle ?? entry.species_subtitle ?? null,
                    subtitle_story: body.subtitleStory ?? entry.species_subtitle_story ?? null,
                    source: "admin_panel",
                    updated_at: new Date().toISOString()
                })
            });
            applied.push("subtitle");
        }

        if (body.principleName !== undefined || body.coreLesson !== undefined
            || body.principleExpression !== undefined || body.shortMotto !== undefined) {
            await query("species_behavior_principles", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify({
                    species_profile_id: speciesProfileId,
                    principle_name: body.principleName ?? entry.principle_name ?? null,
                    principle_expression: body.principleExpression ?? entry.principle_expression ?? null,
                    core_lesson: body.coreLesson ?? entry.core_lesson ?? null,
                    short_motto: body.shortMotto ?? entry.short_motto ?? null,
                    source: "admin_panel",
                    updated_at: new Date().toISOString()
                })
            });
            applied.push("lesson");
        }

        if (body.stats) {
            const current = (entry.canonical_game_stats ?? {}) as Record<string, number>;
            const next = {...current};

            for (const key of STAT_KEYS) {
                const value = body.stats[key];
                if (value == null) continue;
                next[key] = Math.max(0, Math.min(100, Math.round(value)));
            }

            await query(`species_profiles?id=eq.${speciesProfileId}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
                // size_scale_score tracks size on every recalibrated entry, so it
                // is kept in step rather than left describing the old figure.
                body: JSON.stringify({
                    canonical_game_stats: next,
                    ...(body.stats.size != null ? {size_scale_score: next.size} : {})
                })
            });
            applied.push("stats");
        }

        const alias = body.addAlias?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
        if (alias && identityKey) {
            if (alias === identityKey) {
                return NextResponse.json({ok: false, error: "An entry cannot alias itself"}, {status: 400});
            }
            await query("species_identity_aliases", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify({
                    alias_identity_key: alias,
                    canonical_identity_key: identityKey,
                    source: "admin_panel",
                    notes: "Added from the maintenance panel"
                })
            });
            applied.push(`alias ${alias}`);
        }

        const removal = body.removeAlias?.trim().toLowerCase();
        if (removal) {
            await query(`species_identity_aliases?alias_identity_key=eq.${encodeURIComponent(removal)}`, {
                method: "DELETE",
                headers: {Prefer: "return=minimal"}
            });
            applied.push(`removed alias ${removal}`);
        }

        return NextResponse.json({ok: true, applied, entry: await loadEntry(speciesProfileId)});
    } catch (error) {
        console.error("[admin-catalog]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to save this catalog entry"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
