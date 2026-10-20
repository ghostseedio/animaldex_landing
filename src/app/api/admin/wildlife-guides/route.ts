import {NextRequest, NextResponse} from "next/server";
import {resolveAdminActor} from "@/lib/support-admin-auth";
import {createSupabaseServiceClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Wildlife Guides operator tools (migration 20261020140000), service role only:
 *   queue     admin_wildlife_guide_review_queue: second refund requests in 90
 *             days, and card payments reversed after the author was paid
 *   resolve   admin_resolve_wildlife_guide_review: approve or decline (a note
 *             is required to decline); approving a reversed-after-payout row
 *             means the author's share was recovered
 *   search    admin_search_wildlife_guides
 *   moderate  admin_set_wildlife_guide_moderation: hide (reason required; the
 *             author is notified and can't republish) or restore
 * Every decision records the operator: their admin email, or "shared-password"
 * for the shared session. Refund decisions move money, so they need a named
 * operator, as finance approvals do.
 */

type Body = {
    action?: "queue" | "resolve" | "search" | "moderate";
    purchaseId?: string;
    approve?: boolean;
    note?: string;
    query?: string;
    listingId?: string;
    hidden?: boolean;
    reason?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Record<string, string> = {
    reason_required: "A reason is required.",
    actor_required: "The operator could not be identified.",
    not_in_review: "This purchase is no longer waiting for review.",
    guide_not_found: "Guide not found."
};

function fail(message: string, status = 400) {
    return NextResponse.json({ok: false, error: message}, {status});
}

function readable(message: string) {
    const code = Object.keys(ERRORS).find((key) => message.includes(key));
    return code ? ERRORS[code] : message;
}

export async function POST(request: NextRequest) {
    const actor = await resolveAdminActor(request.cookies);
    if (!actor.authorized) return fail("Unauthorized", 401);
    const service = createSupabaseServiceClient();
    if (!service) return fail("Supabase service role is not configured.", 500);
    const actorName = actor.email ?? "shared-password";

    const body = await request.json().catch(() => ({})) as Body;
    switch (body.action ?? "queue") {
        case "queue": {
            const {data, error} = await service.rpc("admin_wildlife_guide_review_queue", {p_limit: 200});
            if (error) return fail(readable(error.message), 500);
            return NextResponse.json({ok: true, items: Array.isArray(data) ? data : []});
        }
        case "resolve": {
            if (actor.kind !== "named_email" || !actor.email) {
                return fail("Refund decisions need a named operator. Sign in with your admin account.", 403);
            }
            if (!body.purchaseId || !UUID.test(body.purchaseId) || typeof body.approve !== "boolean") return fail("Choose a purchase and a decision.");
            const note = body.note?.trim().slice(0, 500) || "";
            if (!body.approve && !note) return fail("A note is required to decline.");
            const {data, error} = await service.rpc("admin_resolve_wildlife_guide_review", {
                p_purchase_id: body.purchaseId,
                p_approve: body.approve,
                p_actor: actorName,
                p_note: note || null
            });
            if (error) return fail(readable(error.message));
            return NextResponse.json({ok: true, result: data});
        }
        case "search": {
            const query = body.query?.trim().slice(0, 200) || null;
            const {data, error} = await service.rpc("admin_search_wildlife_guides", {p_query: query, p_limit: 100});
            if (error) return fail(readable(error.message), 500);
            return NextResponse.json({ok: true, guides: Array.isArray(data) ? data : []});
        }
        case "moderate": {
            if (!body.listingId || !UUID.test(body.listingId) || typeof body.hidden !== "boolean") return fail("Choose a guide.");
            const reason = body.reason?.trim().slice(0, 500) || "";
            if (body.hidden && !reason) return fail("A reason is required to hide a guide.");
            const {data, error} = await service.rpc("admin_set_wildlife_guide_moderation", {
                p_listing_id: body.listingId,
                p_hidden: body.hidden,
                p_actor: actorName,
                p_reason: reason || null
            });
            if (error) return fail(readable(error.message));
            return NextResponse.json({ok: true, guide: data});
        }
        default:
            return fail("Unknown action.");
    }
}
