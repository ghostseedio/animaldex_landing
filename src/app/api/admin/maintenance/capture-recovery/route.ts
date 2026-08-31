import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Dry-run recovery classification. GET never mutates.
 * POST {confirm:true, capture_id} requeues one AUTO row only.
 */

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function rpc(name: string, args: Record<string, unknown>) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        cache: "no-store",
        body: JSON.stringify(args)
    });
    if (!response.ok) {
        throw new Error(`${name} failed (${response.status}): ${await response.text()}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    try {
        return NextResponse.json({ok: true, ...(await rpc("report_capture_recovery_candidates", {p_sample: 8}))});
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to classify recovery candidates"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    const body = await request.json().catch(() => ({})) as {confirm?: boolean; capture_id?: string};
    if (!body.confirm) {
        return NextResponse.json({ok: false, error: "Confirm a single-capture recovery before it runs"}, {status: 400});
    }
    const captureId = String(body.capture_id ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(captureId)) {
        return NextResponse.json({ok: false, error: "capture_id is required"}, {status: 400});
    }
    try {
        const result = await rpc("recover_capture_analysis", {
            p_capture_id: captureId,
            p_reason: "admin_capture_recovery"
        });
        const row = Array.isArray(result) ? result[0] : result;
        return NextResponse.json({ok: true, result: row});
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to recover capture"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
