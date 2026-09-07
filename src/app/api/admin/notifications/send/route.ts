import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Proxy from the admin panel to the send-admin-notification edge function.
 *
 * The push itself is not sent from here. APNs credentials live in Supabase
 * secrets and are used by dispatch-follower-push already; copying them into the
 * web app would mean two implementations of the same signing and two places to
 * rotate a key. This route owns operator auth and composition, the edge
 * function owns delivery.
 */

type SendBody = {
    mode?: "user" | "broadcast" | "segment";
    userId?: string;
    userIds?: string[];
    title?: string;
    body?: string;
    captureId?: string;
    dryRun?: boolean;
    expectedRecipients?: number;
};

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEGMENT_USER_CAP = 500;

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

    const payload = await request.json().catch(() => ({})) as SendBody;
    const title = payload.title?.trim() ?? "";
    const body = payload.body?.trim() ?? "";
    const mode = payload.mode ?? "user";

    if (!title || !body) {
        return NextResponse.json({ok: false, error: "Title and message are both required"}, {status: 400});
    }
    if (mode === "user" && !payload.userId) {
        return NextResponse.json({ok: false, error: "Choose a recipient first"}, {status: 400});
    }
    if (mode === "segment") {
        if (!Array.isArray(payload.userIds) || payload.userIds.length === 0) {
            return NextResponse.json({ok: false, error: "Choose a segment with at least one recipient"}, {status: 400});
        }
        if (payload.userIds.length > SEGMENT_USER_CAP) {
            return NextResponse.json({
                ok: false,
                error: `Segment sends are capped at ${SEGMENT_USER_CAP} people per send`
            }, {status: 400});
        }
        if (!payload.userIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
            return NextResponse.json({ok: false, error: "Segment recipient list contains an invalid user id"}, {status: 400});
        }
    }

    try {
        const response = await fetch(`${url}/functions/v1/send-admin-notification`, {
            method: "POST",
            headers: getSupabaseHeaders(projectKey, {
                "Content-Type": "application/json",
                "x-admin-token": token
            }),
            cache: "no-store",
            body: JSON.stringify({
                mode,
                user_id: payload.userId,
                user_ids: mode === "segment" ? payload.userIds : undefined,
                title,
                body,
                capture_id: payload.captureId,
                dry_run: payload.dryRun === true,
                expected_recipients: payload.expectedRecipients
            })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            // Surface the guard verbatim: the operator needs to know the audience
            // changed under them rather than see a generic failure.
            return NextResponse.json({ok: false, error: result?.error ?? "Send failed", detail: result},
                {status: response.status});
        }

        return NextResponse.json({ok: true, result});
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? caught.message : "Send failed"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
