import {NextResponse} from "next/server";
import {isUuid} from "@/lib/guide-marketplace-admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ok: false, error: message}, {status});
}

function bookingErrorMessage(error: {message: string}) {
    const message = error.message.toLowerCase();
    if (message.includes("invalid_token")) return "Sign in to request this experience.";
    if (message.includes("guide_listing_unavailable")) return "This experience is no longer available.";
    if (message.includes("self_booking_blocked")) return "You cannot request your own experience.";
    if (message.includes("booking_date_in_past")) return "Choose a date today or later.";
    if (message.includes("invalid_guest_count")) return "Check the group size for this experience.";
    if (message.includes("booking_users_blocked")) return "You cannot send a request to this Guide.";
    if (message.includes("requester_not_eligible")) return "Complete more wild captures in AnimalDex before requesting experiences.";
    if (message.includes("invalid_booking_message")) return "Keep your note under 1,000 characters.";
    return error.message;
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return jsonError("Supabase is not configured.", 503);

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return jsonError("Authentication required.", 401);

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return jsonError("Invalid request.");
    }

    const listingId = typeof body.listingId === "string" ? body.listingId : "";
    const requestedDate = typeof body.requestedDate === "string" ? body.requestedDate.trim() : "";
    const guestCount = Number(body.guestCount ?? 0);
    const message = typeof body.message === "string" ? body.message : null;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

    if (!isUuid(listingId)) return jsonError("Listing id is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return jsonError("Choose a valid date.");
    if (!Number.isInteger(guestCount) || guestCount < 1) return jsonError("Enter a valid group size.");
    if (!idempotencyKey || idempotencyKey.length > 200) return jsonError("Request could not be sent. Try again.");

    const {data, error} = await supabase.rpc("create_guide_booking_request", {
        p_guide_listing_id: listingId,
        p_requested_date: requestedDate,
        p_guest_count: guestCount,
        p_message: message,
        p_idempotency_key: idempotencyKey,
        p_payment_method: "cash_in_person"
    });

    if (error) return jsonError(bookingErrorMessage(error), 400);

    return NextResponse.json({ok: true, booking: data});
}
