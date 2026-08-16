import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Identity keys that name an animal the catalog already holds.
 *
 * The model names an animal in whatever register it happens to use — sometimes
 * the common name, sometimes the binomial — and each spelling becomes its own
 * identity key. "passer_montanus" and "eurasian_tree_sparrow" are one bird, but
 * only the second holds #206, so a capture keyed by the first shows as
 * unindexed, is missing from its owner's collection, and cannot auto-merge.
 *
 * The scientific name is what proves they are the same animal. This finds keys
 * whose profile carries a scientific name an *indexed* entry also carries, and
 * proposes the alias that would join them. Nothing is written by GET: the same
 * scientific name can legitimately cover a breed and its parent, so the list is
 * for reading before it is applied.
 */

type Row = Record<string, unknown>;

const PAGE = 1000;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase catalog access is not configured");
    return {url, key};
}

async function rows(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : []) as Row[];
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeScientific(value: unknown) {
    return text(value)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}

async function allProfiles() {
    const out: Row[] = [];
    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`species_profiles?${new URLSearchParams({
            select: "id,animaldex_number,display_name,normalized_identity_key,scientific_name,catalog_status,identity_kind",
            limit: String(PAGE),
            offset: String(offset)
        })}`);
        out.push(...batch);
        if (batch.length < PAGE) break;
    }
    return out;
}

async function findCandidates() {
    const profiles = await allProfiles();
    const indexedByScientific = new Map<string, Row>();

    for (const profile of profiles) {
        if (typeof profile.animaldex_number !== "number") continue;
        const scientific = normalizeScientific(profile.scientific_name);
        if (!scientific || scientific.split(" ").length < 2) continue;
        // Lowest number wins: the earliest entry is the one others were split
        // out of, and it is the stable target to point an alias at.
        const held = indexedByScientific.get(scientific);
        if (!held || (held.animaldex_number as number) > profile.animaldex_number) {
            indexedByScientific.set(scientific, profile);
        }
    }

    const existing = new Set<string>();
    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`species_identity_aliases?${new URLSearchParams({
            select: "alias_identity_key",
            limit: String(PAGE),
            offset: String(offset)
        })}`);
        for (const alias of batch) {
            const key = text(alias.alias_identity_key);
            if (key) existing.add(key.toLowerCase());
        }
        if (batch.length < PAGE) break;
    }

    // How many captures each unindexed key is holding back, so the list can be
    // read worst-first rather than alphabetically.
    const captureCounts = new Map<string, number>();
    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`analysis_results?${new URLSearchParams({
            select: "normalized_identity_key",
            species_profile_id: "is.null",
            limit: String(PAGE),
            offset: String(offset)
        })}`);
        for (const analysis of batch) {
            const key = text(analysis.normalized_identity_key)?.toLowerCase();
            if (key) captureCounts.set(key, (captureCounts.get(key) ?? 0) + 1);
        }
        if (batch.length < PAGE) break;
    }

    const candidates = [];

    for (const profile of profiles) {
        if (typeof profile.animaldex_number === "number") continue;

        const key = text(profile.normalized_identity_key)?.toLowerCase();
        if (!key || existing.has(key)) continue;

        const scientific = normalizeScientific(profile.scientific_name);
        const target = indexedByScientific.get(scientific);
        if (!target) continue;

        const targetKey = text(target.normalized_identity_key)?.toLowerCase();
        if (!targetKey || targetKey === key) continue;

        candidates.push({
            identityKey: key,
            displayName: text(profile.display_name),
            scientificName: text(profile.scientific_name),
            identityKind: text(profile.identity_kind),
            catalogStatus: text(profile.catalog_status),
            captures: captureCounts.get(key) ?? 0,
            target: {
                identityKey: targetKey,
                speciesProfileId: String(target.id),
                number: target.animaldex_number as number,
                displayName: text(target.display_name)
            }
        });
    }

    // Keys that never became a profile at all. The model named an animal with a
    // binomial, nothing was created for it, and the capture has been resolving
    // to nothing ever since — passer_montanus against Eurasian Tree Sparrow #206
    // is the shape. These are invisible to the loop above, which walks profiles.
    const profileKeys = new Set(
        profiles.map((profile) => text(profile.normalized_identity_key)?.toLowerCase()).filter(Boolean) as string[]
    );
    const orphans = new Map<string, {scientific: string; captures: number}>();

    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`analysis_results?${new URLSearchParams({
            select: "normalized_identity_key,scientific_name",
            species_profile_id: "is.null",
            limit: String(PAGE),
            offset: String(offset)
        })}`);

        for (const analysis of batch) {
            const key = text(analysis.normalized_identity_key)?.toLowerCase();
            if (!key || profileKeys.has(key) || existing.has(key)) continue;
            const scientific = normalizeScientific(analysis.scientific_name);
            if (!scientific || scientific.split(" ").length < 2) continue;
            const seen = orphans.get(key);
            if (seen) seen.captures += 1;
            else orphans.set(key, {scientific, captures: 1});
        }

        if (batch.length < PAGE) break;
    }

    for (const [key, orphan] of Array.from(orphans)) {
        const target = indexedByScientific.get(orphan.scientific);
        const targetKey = text(target?.normalized_identity_key)?.toLowerCase();
        if (!target || !targetKey || targetKey === key) continue;

        candidates.push({
            identityKey: key,
            displayName: null,
            scientificName: orphan.scientific,
            identityKind: null,
            catalogStatus: null,
            captures: orphan.captures,
            target: {
                identityKey: targetKey,
                speciesProfileId: String(target.id),
                number: target.animaldex_number as number,
                displayName: text(target.display_name)
            }
        });
    }

    return candidates.sort((left, right) => right.captures - left.captures);
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const candidates = await findCandidates();
        return NextResponse.json({
            ok: true,
            candidates,
            withCaptures: candidates.filter((candidate) => candidate.captures > 0).length,
            capturesHeldBack: candidates.reduce((total, candidate) => total + candidate.captures, 0)
        });
    } catch (error) {
        console.error("[admin-catalog-alias-sweep]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan for alias candidates"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {identityKeys?: string[]; confirm?: boolean};
    const wanted = new Set((body.identityKeys ?? []).map((key) => key.trim().toLowerCase()).filter(Boolean));

    if (!body.confirm || !wanted.size) {
        return NextResponse.json({
            ok: false,
            error: "Name the identity keys to alias and confirm; this does not apply everything it finds"
        }, {status: 400});
    }

    try {
        const candidates = (await findCandidates()).filter((candidate) => wanted.has(candidate.identityKey));
        const applied: Array<{identityKey: string; target: string; captures: number}> = [];

        for (const candidate of candidates) {
            await rows("species_identity_aliases", {
                method: "POST",
                headers: {"Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal"},
                body: JSON.stringify({
                    alias_identity_key: candidate.identityKey,
                    canonical_identity_key: candidate.target.identityKey,
                    source: "manual:admin_panel",
                    notes: `Same scientific name as ${candidate.target.displayName} (#${candidate.target.number})`
                })
            });
            applied.push({
                identityKey: candidate.identityKey,
                target: `#${candidate.target.number} ${candidate.target.displayName}`,
                captures: candidate.captures
            });
        }

        return NextResponse.json({
            ok: true,
            applied,
            missing: Array.from(wanted).filter((key) => !candidates.some((candidate) => candidate.identityKey === key))
        });
    } catch (error) {
        console.error("[admin-catalog-alias-sweep]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to write those aliases"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
