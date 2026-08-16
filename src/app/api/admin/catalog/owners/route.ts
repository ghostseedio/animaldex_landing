import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Who already photographed this animal.
 *
 * Indexing an entry turns captures that showed as unindexed into a collected
 * card, and the people holding them are the ones the news is actually for. One
 * row per person with their own capture, because a notification deep-links to a
 * capture and the send is refused if it belongs to somebody else.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

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

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const speciesProfileId = request.nextUrl.searchParams.get("speciesProfileId")?.trim() ?? "";
    if (!UUID.test(speciesProfileId)) {
        return NextResponse.json({ok: false, error: "A catalog entry is required"}, {status: 400});
    }

    try {
        const analyses = await rows("analysis_results", new URLSearchParams({
            select: "capture_id,created_at",
            species_profile_id: `eq.${speciesProfileId}`,
            order: "created_at.desc",
            limit: "500"
        }));

        if (!analyses.length) return NextResponse.json({ok: true, owners: []});

        const captureIds = analyses.map((row) => String(row.capture_id));
        const captures = await rows("captures", new URLSearchParams({
            select: "id,user_id,created_at,merged_into_capture_id",
            id: `in.(${captureIds.join(",")})`,
            order: "created_at.desc"
        }));

        // One capture per person: their newest that still stands on its own, so
        // the link does not open a card whose photos moved elsewhere.
        const byUser = new Map<string, {captureId: string; captures: number}>();
        for (const capture of captures) {
            const userId = String(capture.user_id);
            const existing = byUser.get(userId);
            if (existing) {
                existing.captures += 1;
                continue;
            }
            byUser.set(userId, {
                captureId: capture.merged_into_capture_id
                    ? String(capture.merged_into_capture_id)
                    : String(capture.id),
                captures: 1
            });
        }

        const userIds = Array.from(byUser.keys());
        const profiles = userIds.length
            ? await rows("profiles", new URLSearchParams({
                select: "id,username,display_name",
                id: `in.(${userIds.join(",")})`
            }))
            : [];
        const named = new Map(profiles.map((row) => [String(row.id), row]));

        const owners = userIds.map((userId) => {
            const profile = named.get(userId);
            const username = typeof profile?.username === "string" ? profile.username : null;
            const displayName = typeof profile?.display_name === "string" ? profile.display_name : null;

            return {
                userId,
                username,
                displayName,
                label: username ? `@${username}` : displayName || userId.slice(0, 8),
                captureId: byUser.get(userId)!.captureId,
                captures: byUser.get(userId)!.captures
            };
        }).sort((left, right) => right.captures - left.captures);

        return NextResponse.json({ok: true, owners});
    } catch (error) {
        console.error("[admin-catalog-owners]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to read capture owners"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
