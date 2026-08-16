import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Give an analysis the catalog entry it already counts as.
 *
 * A capture reaches its AnimalDex number two ways: a species_profile_id on the
 * analysis, or — failing that — the identity key resolving through aliases and
 * the domestic-parent map. The second gets the number right, so nothing looks
 * broken, but analysis_results.species_profile_id stays null and several things
 * quietly refuse to work on the capture. Chief among them is duplicate merging:
 * capture_duplicate_analysis_merge_eligible requires a real link for anything
 * that is not terminal, so two photos of one cat sit side by side forever.
 *
 * The target is not guessed. It is the entry that holds the number the capture
 * already resolves to, so relinking cannot move a capture between entries — it
 * only writes down what was already true.
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

async function rpc(name: string, args: Record<string, unknown>) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        cache: "no-store",
        body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`${name} failed (${response.status}): ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Unlinked analyses, with the entry each one already counts as. */
async function findRelinkable() {
    const analyses: Row[] = [];

    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`analysis_results?${new URLSearchParams({
            select: "capture_id,normalized_identity_key,scientific_name,identity_kind,identity_resolution_mode,confidence",
            species_profile_id: "is.null",
            limit: String(PAGE),
            offset: String(offset)
        })}`);
        analyses.push(...batch);
        if (batch.length < PAGE) break;
    }

    // One resolve per distinct (key, scientific name); the same pair repeats
    // across hundreds of rows and the resolver is not free.
    const resolved = new Map<string, number | null>();
    const profileByNumber = new Map<number, Row>();
    const groups = new Map<string, {identityKey: string; number: number; captureIds: string[]}>();

    for (const analysis of analyses) {
        const identityKey = text(analysis.normalized_identity_key);
        if (!identityKey) continue;

        const scientificName = text(analysis.scientific_name);
        const cacheKey = `${identityKey}|${scientificName ?? ""}`;

        if (!resolved.has(cacheKey)) {
            const number = await rpc("capture_effective_animaldex_number", {
                p_species_profile_id: null,
                p_normalized_identity_key: identityKey,
                p_scientific_name: scientificName
            }) as number | null;
            resolved.set(cacheKey, typeof number === "number" && number >= 1 ? number : null);
        }

        const number = resolved.get(cacheKey);
        if (number == null) continue;

        if (!profileByNumber.has(number)) {
            const [profile] = await rows(`species_profiles?${new URLSearchParams({
                select: "id,animaldex_number,display_name,normalized_identity_key",
                animaldex_number: `eq.${number}`,
                limit: "1"
            })}`);
            if (!profile) continue;
            profileByNumber.set(number, profile);
        }

        const group = groups.get(identityKey) ?? {identityKey, number, captureIds: []};
        group.captureIds.push(String(analysis.capture_id));
        groups.set(identityKey, group);
    }

    return {
        scanned: analyses.length,
        groups: Array.from(groups.values())
            .map((group) => ({
                ...group,
                target: {
                    speciesProfileId: String(profileByNumber.get(group.number)?.id ?? ""),
                    displayName: text(profileByNumber.get(group.number)?.display_name),
                    identityKey: text(profileByNumber.get(group.number)?.normalized_identity_key)
                },
                captures: group.captureIds.length
            }))
            .filter((group) => group.target.speciesProfileId)
            .sort((left, right) => right.captures - left.captures)
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const {scanned, groups} = await findRelinkable();
        return NextResponse.json({
            ok: true,
            scanned,
            groups: groups.map(({captureIds, ...rest}) => ({...rest, sample: captureIds.slice(0, 3)})),
            relinkable: groups.reduce((total, group) => total + group.captures, 0)
        });
    } catch (error) {
        console.error("[admin-catalog-relink]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan for unlinked analyses"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {identityKeys?: string[]; confirm?: boolean};
    const wanted = new Set((body.identityKeys ?? []).map((key) => key.trim().toLowerCase()).filter(Boolean));

    if (!body.confirm) {
        return NextResponse.json({ok: false, error: "Confirm the relink before it runs"}, {status: 400});
    }

    try {
        const {groups} = await findRelinkable();
        const targets = wanted.size ? groups.filter((group) => wanted.has(group.identityKey)) : groups;
        const applied: Array<{identityKey: string; captures: number; target: string | null}> = [];

        // One capture at a time. Writing a link fires the profile projection
        // rebuild for its owner, and that rebuild can fail on data unrelated to
        // this capture — one account with a pre-existing collision would
        // otherwise abort the whole run and leave everyone else unlinked.
        const failures: Array<{captureId: string; error: string}> = [];

        for (const group of targets) {
            let linked = 0;

            for (const captureId of group.captureIds) {
                try {
                    await rows(`analysis_results?capture_id=eq.${captureId}&species_profile_id=is.null`, {
                        method: "PATCH",
                        headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
                        body: JSON.stringify({species_profile_id: group.target.speciesProfileId})
                    });
                    linked += 1;
                } catch (error) {
                    failures.push({
                        captureId,
                        error: error instanceof Error ? error.message.slice(0, 200) : "failed"
                    });
                }
            }

            if (linked) {
                applied.push({
                    identityKey: group.identityKey,
                    captures: linked,
                    target: group.target.displayName
                });
            }
        }

        return NextResponse.json({
            ok: true,
            applied,
            captures: applied.reduce((total, group) => total + group.captures, 0),
            failed: failures.length,
            failures: failures.slice(0, 20)
        });
    } catch (error) {
        console.error("[admin-catalog-relink]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to relink those analyses"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
