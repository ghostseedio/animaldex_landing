import {NextRequest, NextResponse} from "next/server";
import {getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Proxy from the admin panel to the admin-creator-review edge function.
 *
 * The shared admin secret never reaches the browser: this route owns operator
 * auth and holds the token, the edge function owns the queue, the media sample
 * and every verification transition. Doing the transition here instead would
 * mean a second writer of creator_verification_state and a second place the
 * audit trail could be skipped.
 */

type Action = "list" | "review" | "verify" | "reject" | "suspend" | "history";

type Body = {
    action?: Action;
    connectionId?: string;
    state?: string;
    reason?: string;
    sampleCount?: number;
};

/** Transitions an operator can trigger. `reset` is deliberately not exposed. */
const MUTATIONS = new Set<Action>(["verify", "reject", "suspend"]);

export async function POST(request: NextRequest) {
    if (!await isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const url = getSupabaseUrl();
    const token = process.env.ADMIN_NOTIFICATION_TOKEN?.trim();
    // The function authorises the operator by shared secret, but the platform
    // gateway in front of it still wants a project key: without one the request
    // is rejected as UNAUTHORIZED_NO_AUTH_HEADER and the function never runs.
    const projectKey = getSupabaseServerReadKey();
    if (!url || !token || !projectKey) {
        return NextResponse.json({
            ok: false,
            error: "ADMIN_NOTIFICATION_TOKEN is not configured for this environment"
        }, {status: 500});
    }

    const payload = await request.json().catch(() => ({})) as Body;
    const action: Action = payload.action ?? "list";

    if (action !== "list" && !payload.connectionId) {
        return NextResponse.json({ok: false, error: "A creator connection is required"}, {status: 400});
    }
    // Rejecting or suspending someone's imports is a judgement that has to be
    // explainable later, so a reason is required rather than optional.
    if ((action === "reject" || action === "suspend") && !payload.reason?.trim()) {
        return NextResponse.json({
            ok: false,
            error: "A reason is required when rejecting or suspending a creator"
        }, {status: 400});
    }

    try {
        const response = await fetch(`${url}/functions/v1/admin-creator-review`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "apikey": projectKey,
                "Authorization": `Bearer ${projectKey}`,
                "x-admin-token": token
            },
            cache: "no-store",
            body: JSON.stringify({
                action,
                connection_id: payload.connectionId,
                state: payload.state,
                reason: payload.reason?.trim() || null,
                sample_count: payload.sampleCount
            })
        });

        const text = await response.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!response.ok) {
            return NextResponse.json({
                ok: false,
                error: parsed.error ?? `Creator review failed (${response.status})`
            }, {status: response.status});
        }

        return NextResponse.json({
            ok: true,
            ...parsed,
            mutated: MUTATIONS.has(action)
        });
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? caught.message : "Creator review failed"
        }, {status: 502});
    }
}
