import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const body = await request.json() as {captureId?: string; preferProvider?: string};
        const captureId = body.captureId?.trim().toLowerCase() ?? "";
        if (!UUID_PATTERN.test(captureId)) {
            return NextResponse.json({ok: false, error: "A valid capture ID is required"}, {status: 400});
        }

        const url = getSupabaseUrl();
        const key = getSupabaseServiceKey();
        if (!url || !key) throw new Error("Supabase maintenance access is not configured");

        const lookup = await fetch(`${url}/rest/v1/captures?select=id,capture_mode,status&id=eq.${encodeURIComponent(captureId)}&limit=1`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });
        if (!lookup.ok) throw new Error(`Capture lookup failed (${lookup.status})`);
        const captures = await lookup.json() as Array<{id: string; capture_mode?: string; status?: string}>;
        const capture = captures[0];
        if (!capture) return NextResponse.json({ok: false, error: "Capture not found"}, {status: 404});
        if (capture.capture_mode === "video") {
            return NextResponse.json({
                ok: false,
                error: "Video refresh needs frame extraction. Use the existing admin-reanalyze-capture script from the iOS repo for this post."
            }, {status: 409});
        }

        const response = await fetch(`${url}/functions/v1/analyze-capture`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({
                capture_id: captureId,
                capture_mode: "photo",
                credit_cost: 1,
                admin_reanalyze: true,
                ...(body.preferProvider === "gemini" ? {prefer_provider: "gemini"} : {})
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(115_000)
        });
        const text = await response.text();
        let result: unknown = null;
        try { result = text ? JSON.parse(text) : null; } catch { result = {message: text}; }
        if (!response.ok) {
            const detail = result && typeof result === "object" && "error" in result ? String(result.error) : `Refresh failed (${response.status})`;
            return NextResponse.json({ok: false, error: detail, captureId, result}, {status: response.status});
        }

        return NextResponse.json({
            ok: true,
            captureId,
            queued: response.status === 202,
            message: response.status === 202 ? "Refresh queued" : "Refresh completed",
            result
        });
    } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        console.error("[admin-maintenance-refresh]", error);
        return NextResponse.json({
            ok: false,
            error: timedOut ? "The refresh is still taking longer than the web request window. Check the post status shortly." : error instanceof Error ? error.message : "Unable to refresh post"
        }, {status: timedOut ? 504 : 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
