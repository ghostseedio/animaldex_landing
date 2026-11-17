import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {FeedbackPollResult} from "@/lib/feedback-polls";

/**
 * The owner's feedback poll results (AnimalDex 20261201100000,
 * admin_feedback_poll_results_v1): every poll with its status, reach, counts
 * per option and the free-text answers (text and date only). Admin only.
 */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return NextResponse.json({error: "Supabase service role is not configured"}, {status: 500});
    try {
        const response = await fetch(`${url}/rest/v1/rpc/admin_feedback_poll_results_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({}),
            cache: "no-store",
            signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) {
            const text = (await response.text()).slice(0, 200);
            const error = response.status === 404
                ? "Feedback polls are not live yet (AnimalDex migration 20261201100000)."
                : `admin_feedback_poll_results_v1 ${response.status}: ${text}`;
            return NextResponse.json({error}, {status: 502});
        }
        return NextResponse.json({ok: true, polls: await response.json() as FeedbackPollResult[]});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load feedback polls"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
