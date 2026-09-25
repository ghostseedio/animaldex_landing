import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Capture-provenance anomalies, for /admin/integrity.
 *
 * Answers the question the 2026-09-25 account raised: is anyone else doing
 * this, and did it happen before we noticed? /admin/reliability reports what
 * broke and /api/admin/health reports whether the pipeline runs; neither
 * notices a capture that succeeded perfectly while lying about where and when
 * it came from.
 *
 * Read-only. Acting on an account — removing captures, blocking a user — is
 * deliberately not offered here: the signals are heuristics, not proof, and a
 * one-click destructive action on a heuristic is how real users lose real work.
 */

type Row = {
    user_id: string;
    username: string | null;
    display_name: string | null;
    joined_at: string;
    captures_total: number;
    backdated_captures: number;
    repeat_media_max: number;
    coarse_coordinate_captures: number;
    distinct_coordinates: number;
    captures_in_first_two_minutes: number;
    first_capture_after_signup_seconds: number;
    last_capture_at: string | null;
    signals: number;
};

export type IntegrityRow = Row;

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) {
        return NextResponse.json({ok: false, error: "Supabase access is not configured"}, {status: 500});
    }

    const days = Number(request.nextUrl.searchParams.get("days") ?? 365);

    let response: Response;
    try {
        response = await fetch(`${url}/rest/v1/rpc/admin_capture_integrity_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
            body: JSON.stringify({min_captures: 3, lookback_days: Number.isFinite(days) ? days : 365}),
            cache: "no-store"
        });
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Request failed"}, {status: 502});
    }

    if (!response.ok) {
        const detail = await response.text();
        const missing = response.status === 404 || detail.includes("admin_capture_integrity_v1");
        return NextResponse.json(
            {
                ok: false,
                error: missing
                    ? "admin_capture_integrity_v1 is not installed. Apply supabase/migrations/20260926110000_admin_capture_integrity.sql."
                    : `Integrity query failed (${response.status}): ${detail.slice(0, 300)}`
            },
            {status: missing ? 503 : 502}
        );
    }

    const rows = (await response.json()) as Row[];
    return NextResponse.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        lookbackDays: Number.isFinite(days) ? days : 365,
        summary: {
            accounts: rows.length,
            strong: rows.filter((row) => row.signals >= 2).length,
            backdating: rows.filter((row) => row.backdated_captures > 0).length,
            repeatMedia: rows.filter((row) => row.repeat_media_max >= 3).length,
            capturesImplicated: rows.reduce((total, row) => total + row.captures_total, 0)
        },
        accounts: rows
    });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
