import {NextResponse} from "next/server";
import {titleStructuredLocationLooksInconsistent, locationMismatchMessage} from "@/lib/guide-listing-quality";
import {isUuid} from "@/lib/guide-marketplace-admin";
import {
    mapGuideEligibility,
    mapOwnedGuideListing,
    mapSellerGuideBooking,
    parseGuideAmountMinor,
    type GuideListingDraftInput,
    validateGuideListingDraft
} from "@/lib/guide-marketplace-seller";
import {isGuideCategory} from "@/lib/guide-marketplace-core";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GuideAction =
    | "accept-terms"
    | "apply"
    | "save-draft"
    | "submit-listing"
    | "pause-listing"
    | "resume-listing"
    | "resolve-booking";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ok: false, error: message}, {status});
}

async function requireUser() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {error: jsonError("Supabase is not configured.", 503)} as const;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {error: jsonError("Authentication required.", 401)} as const;
    return {supabase, user} as const;
}

function draftFromBody(body: Record<string, unknown>): GuideListingDraftInput | null {
    const serviceCategory = typeof body.serviceCategory === "string" ? body.serviceCategory : "";
    if (!isGuideCategory(serviceCategory)) return null;

    return {
        listingId: typeof body.listingId === "string" ? body.listingId : null,
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        publicSummary: String(body.publicSummary ?? ""),
        serviceCategory,
        publicAreaLabel: String(body.publicAreaLabel ?? ""),
        regionCode: String(body.regionCode ?? ""),
        countryCode: String(body.countryCode ?? "US"),
        durationMinutes: Number(body.durationMinutes ?? 120),
        maxGuests: Number(body.maxGuests ?? 6),
        currencyCode: String(body.currencyCode ?? "USD"),
        amountText: String(body.amountText ?? "")
    };
}

export async function GET() {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const [eligibilityRes, listingsRes, bookingsRes] = await Promise.all([
        auth.supabase.rpc("get_guide_seller_eligibility"),
        auth.supabase.from("guide_listings").select("*").eq("seller_user_id", auth.user.id).order("updated_at", {ascending: false}),
        auth.supabase.from("guide_booking_requests").select("*").eq("seller_user_id", auth.user.id).order("created_at", {ascending: false}).limit(50)
    ]);

    if (eligibilityRes.error) return jsonError(eligibilityRes.error.message, 500);
    if (listingsRes.error) return jsonError(listingsRes.error.message, 500);
    if (bookingsRes.error) return jsonError(bookingsRes.error.message, 500);

    const listings = (listingsRes.data ?? []).map((row) => mapOwnedGuideListing(row as Record<string, unknown>));
    const listingTitles = new Map(listings.map((listing) => [listing.id, listing.title]));
    const bookings = (bookingsRes.data ?? []).map((row) =>
        mapSellerGuideBooking(row as Record<string, unknown>, listingTitles.get(String((row as Record<string, unknown>).guide_listing_id)) ?? null)
    );

    return NextResponse.json({
        ok: true,
        eligibility: mapGuideEligibility(eligibilityRes.data),
        listings,
        bookings
    });
}

export async function POST(request: Request) {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return jsonError("Invalid request.");
    }

    const action = String(body.action ?? "") as GuideAction;

    switch (action) {
        case "accept-terms": {
            const {data, error} = await auth.supabase.rpc("accept_current_guide_seller_terms");
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, eligibility: mapGuideEligibility(data)});
        }
        case "apply": {
            if (body.ageAttested !== true) return jsonError("You must confirm you are 18 or older.");
            const terms = await auth.supabase.rpc("accept_current_guide_seller_terms");
            if (terms.error) return jsonError(terms.error.message, 400);
            const {data, error} = await auth.supabase.rpc("submit_guide_seller_application", {
                p_age_attested_18_plus: true
            });
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, eligibility: mapGuideEligibility(data)});
        }
        case "save-draft": {
            const draft = draftFromBody(body);
            if (!draft) return jsonError("Invalid listing draft.");
            const validationError = validateGuideListingDraft(draft);
            if (validationError) return jsonError(validationError);

            const amountMinor = parseGuideAmountMinor(draft.amountText, draft.currencyCode);
            if (amountMinor == null) return jsonError("Enter a valid cash price per person.");

            const listingId = draft.listingId && isUuid(draft.listingId) ? draft.listingId : null;
            const {data, error} = await auth.supabase.rpc("save_guide_listing_draft", {
                p_listing_id: listingId,
                p_title: draft.title.trim(),
                p_description: draft.description.trim(),
                p_public_summary: draft.publicSummary.trim(),
                p_service_category: draft.serviceCategory,
                p_public_area_label: draft.publicAreaLabel.trim(),
                p_region_code: draft.regionCode.trim(),
                p_country_code: draft.countryCode.trim().toUpperCase(),
                p_duration_minutes: draft.durationMinutes,
                p_max_guests: draft.maxGuests,
                p_currency_code: draft.currencyCode.trim().toUpperCase(),
                p_amount_minor: amountMinor
            });
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, listing: mapOwnedGuideListing(data as Record<string, unknown>)});
        }
        case "submit-listing": {
            const listingId = typeof body.listingId === "string" ? body.listingId : "";
            if (!isUuid(listingId)) return jsonError("Listing id is required.");
            const existing = await auth.supabase.from("guide_listings").select("title,public_area_label,public_locality,public_admin_area,public_place_name").eq("id", listingId).eq("seller_user_id", auth.user.id).maybeSingle();
            if (existing.error) return jsonError(existing.error.message, 500);
            const row = existing.data as Record<string, unknown> | null;
            if (row && titleStructuredLocationLooksInconsistent(String(row.title ?? ""), {
                publicAreaLabel: String(row.public_area_label ?? ""),
                publicLocality: typeof row.public_locality === "string" ? row.public_locality : null,
                publicAdminArea: typeof row.public_admin_area === "string" ? row.public_admin_area : null,
                publicPlaceName: typeof row.public_place_name === "string" ? row.public_place_name : null
            })) {
                return jsonError(locationMismatchMessage(String(row.title ?? ""), String(row.public_area_label ?? "")));
            }
            const {data, error} = await auth.supabase.rpc("submit_guide_listing", {p_listing_id: listingId});
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, listing: mapOwnedGuideListing(data as Record<string, unknown>)});
        }
        case "pause-listing": {
            const listingId = typeof body.listingId === "string" ? body.listingId : "";
            if (!isUuid(listingId)) return jsonError("Listing id is required.");
            const {data, error} = await auth.supabase.rpc("pause_guide_listing", {p_listing_id: listingId});
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, listing: mapOwnedGuideListing(data as Record<string, unknown>)});
        }
        case "resume-listing": {
            const listingId = typeof body.listingId === "string" ? body.listingId : "";
            if (!isUuid(listingId)) return jsonError("Listing id is required.");
            const {data, error} = await auth.supabase.rpc("resume_guide_listing", {p_listing_id: listingId});
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, listing: mapOwnedGuideListing(data as Record<string, unknown>)});
        }
        case "resolve-booking": {
            const requestId = typeof body.requestId === "string" ? body.requestId : "";
            const resolveAction = typeof body.resolveAction === "string" ? body.resolveAction : "";
            if (!isUuid(requestId)) return jsonError("Request id is required.");
            if (!["accepted", "declined", "cancelled", "completed"].includes(resolveAction)) {
                return jsonError("Invalid booking action.");
            }
            const {data, error} = await auth.supabase.rpc("resolve_guide_booking_request", {
                p_request_id: requestId,
                p_action: resolveAction
            });
            if (error) return jsonError(error.message, 400);
            return NextResponse.json({ok: true, booking: data});
        }
        default:
            return jsonError("Unknown action.");
    }
}
