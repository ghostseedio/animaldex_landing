import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Merge one capture into another.
 *
 * The work is done by complete_duplicate_capture_merge, the same routine the app
 * uses when it spots a duplicate: it moves the child's photos onto the parent,
 * points the child at it and reconciles progression. Reimplementing that here
 * would mean a second definition of what a merge is.
 *
 * Service role passes the function's auth.uid() check by having none, but its
 * same-owner check still applies, so an operator cannot merge two people's
 * captures into each other.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FRIENDLY_ERRORS: Record<string, string> = {
    invalid_request: "Pick two different captures.",
    capture_not_found: "One of those captures no longer exists.",
    capture_user_mismatch: "Those captures belong to different people, so they cannot be merged.",
    forbidden: "The database refused this merge.",
    child_analysis_not_found: "The capture being merged has no completed analysis.",
    parent_analysis_not_found: "The capture being merged into has no completed analysis.",
    // The routine only folds captures that already resolve to the same AnimalDex
    // number, so an unidentified capture cannot be merged into an identified one
    // until it has been moved there.
    duplicate_identity_mismatch: "Those captures do not resolve to the same AnimalDex number, so the merge routine will not fold them. Use Set index to put both on the same entry first, then merge.",
    species_profile_mismatch: "Those captures are on different catalog entries (or one has none). Use Set index to put both on the same entry first, then merge."
};

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) {
        return NextResponse.json({ok: false, error: "Supabase maintenance access is not configured"}, {status: 500});
    }

    const payload = await request.json().catch(() => ({})) as {childCaptureId?: string; parentCaptureId?: string};
    const child = payload.childCaptureId?.trim() ?? "";
    const parent = payload.parentCaptureId?.trim() ?? "";

    if (!UUID.test(child) || !UUID.test(parent)) {
        return NextResponse.json({ok: false, error: "Two capture ids are required"}, {status: 400});
    }
    if (child === parent) {
        return NextResponse.json({ok: false, error: "Pick two different captures"}, {status: 400});
    }

    try {
        // Checked here as well as in the database, so a cross-owner merge is
        // refused by name before anything is attempted. Folding one person's
        // capture into another's would take a card off someone's collection.
        const ownerResponse = await fetch(`${url}/rest/v1/captures?${new URLSearchParams({
            select: "id,user_id",
            id: `in.(${child},${parent})`
        })}`, {headers: getSupabaseHeaders(key, {Accept: "application/json"}), cache: "no-store"});

        if (!ownerResponse.ok) {
            throw new Error(`Could not read those captures (${ownerResponse.status})`);
        }

        const captures = await ownerResponse.json() as Array<{id: string; user_id: string}>;

        if (captures.length < 2) {
            return NextResponse.json({ok: false, error: "One of those captures no longer exists."}, {status: 404});
        }

        const owners = Array.from(new Set(captures.map((row) => row.user_id)));

        if (owners.length > 1) {
            const profiles = await fetch(`${url}/rest/v1/profiles?${new URLSearchParams({
                select: "id,username,display_name",
                id: `in.(${owners.join(",")})`
            })}`, {headers: getSupabaseHeaders(key, {Accept: "application/json"}), cache: "no-store"});
            const named = profiles.ok
                ? (await profiles.json() as Array<{username: string | null; display_name: string | null}>)
                    .map((row) => row.username ? `@${row.username}` : row.display_name ?? "someone")
                : [];

            return NextResponse.json({
                ok: false,
                error: named.length
                    ? `Those captures belong to different people (${named.join(" and ")}), so they cannot be merged.`
                    : "Those captures belong to different people, so they cannot be merged.",
                owners: owners.length
            }, {status: 409});
        }

        const response = await fetch(`${url}/rest/v1/rpc/complete_duplicate_capture_merge`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            cache: "no-store",
            body: JSON.stringify({p_child_capture_id: child, p_parent_capture_id: parent})
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            const raw = typeof result?.message === "string" ? result.message : "";
            const friendly = Object.entries(FRIENDLY_ERRORS)
                .find(([code]) => raw.includes(code))?.[1];
            return NextResponse.json({
                ok: false,
                error: friendly ?? raw ?? "Merge failed",
                detail: result
            }, {status: response.status});
        }

        return NextResponse.json({ok: true, result});
    } catch (error) {
        console.error("[admin-maintenance-merge]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Merge failed"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
