import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized, resolveAdminActor} from "@/lib/support-admin-auth";
import {
    GUIDE_ADMIN_QUEUE_LIMIT,
    isBookingStatus,
    isGuideAdminAction,
    isListingReviewStatus,
    isSellerStatus,
    isUuid,
    listingReviewRpc,
    mapBookingRow,
    mapEligibility,
    mapListingReview,
    mapSellerApplication,
    parseGuideAdminRpcError,
    sellerApproveGate,
    sellerReviewRpc,
    type GuideAdminAction
} from "@/lib/guide-marketplace-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = Record<string, unknown>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    return {url, key};
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {
            Accept: "application/json",
            ...(init?.body ? {"Content-Type": "application/json"} : {}),
            ...(init?.headers as Record<string, string> | undefined)
        }),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string"
            ? payload.message
            : typeof payload?.error === "string"
                ? payload.error
                : `${path} failed (${response.status})`;
        throw new Error(parseGuideAdminRpcError(message));
    }
    return payload as T;
}

async function exactCount(path: string) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        headers: getSupabaseHeaders(key, {
            Accept: "application/json",
            Prefer: "count=exact",
            Range: "0-0"
        }),
        cache: "no-store"
    });
    if (!response.ok) return 0;
    const range = response.headers.get("content-range");
    const total = range?.split("/")[1];
    const count = Number(total);
    return Number.isFinite(count) ? count : 0;
}

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    return rest<T>(`rpc/${name}`, {method: "POST", body: JSON.stringify(body)});
}

function inFilter(ids: string[]) {
    return ids.filter(isUuid).join(",");
}

function asId(value: unknown) {
    return typeof value === "string" ? value : "";
}

function eqFilter(column: string, value: string, fallback: string, allowed: (candidate: string) => boolean) {
    if (value === "all") return "";
    const status = allowed(value) ? value : fallback;
    return `&${column}=eq.${encodeURIComponent(status)}`;
}

async function profilesById(ids: string[]) {
    const unique = Array.from(new Set(ids.filter(isUuid)));
    const map = new Map<string, Row>();
    if (unique.length === 0) return map;
    const rows = await rest<Row[]>(`profiles?id=in.(${inFilter(unique)})&select=id,display_name,username`);
    for (const row of rows) {
        if (typeof row.id === "string") map.set(row.id, row);
    }
    return map;
}

async function eligibilityByUser(ids: string[]) {
    const unique = Array.from(new Set(ids.filter(isUuid)));
    const entries = await Promise.all(unique.map(async (userId) => {
        try {
            const snapshot = await rpc<Row>("guide_seller_eligibility_snapshot", {p_user_id: userId});
            return [userId, mapEligibility(snapshot)] as const;
        } catch {
            return [userId, mapEligibility(null)] as const;
        }
    }));
    return new Map(entries);
}

function person(profile: Row | undefined) {
    return {
        displayName: typeof profile?.display_name === "string" ? profile.display_name : null,
        username: typeof profile?.username === "string" ? profile.username : null
    };
}

export async function GET(request: NextRequest) {
    if (!await isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const params = request.nextUrl.searchParams;
        const applicationStatus = params.get("applications") ?? "pending";
        const listingStatus = params.get("listings") ?? "pending_review";
        const bookingStatus = params.get("bookings") ?? "pending";

        const applicationFilter = eqFilter("seller_status", applicationStatus, "pending", isSellerStatus);
        const listingFilter = eqFilter("status", listingStatus, "pending_review", isListingReviewStatus);
        const bookingFilter = eqFilter("status", bookingStatus, "pending", isBookingStatus);

        const [sellerRows, listingRows, bookingRows, pendingApplications, pendingListings, pendingBookings] = await Promise.all([
            rest<Row[]>(`guide_seller_profiles?select=user_id,seller_status,marketplace_standing,age_attested_18_plus,terms_version,terms_accepted_at,created_at,updated_at,reviewed_at${applicationFilter}&order=updated_at.asc&limit=${GUIDE_ADMIN_QUEUE_LIMIT}`),
            rest<Row[]>(`guide_listings?select=id,seller_user_id,title,slug,description,public_summary,service_category,public_area_label,region_code,country_code,duration_minutes,max_guests,currency_code,amount_minor,pricing_unit,status,submitted_at,updated_at,resume_requires_review${listingFilter}&order=submitted_at.asc.nullslast&limit=${GUIDE_ADMIN_QUEUE_LIMIT}`),
            rest<Row[]>(`guide_booking_requests?select=id,guide_listing_id,requester_user_id,seller_user_id,requested_date,guest_count,message,status,created_at${bookingFilter}&order=created_at.desc&limit=${GUIDE_ADMIN_QUEUE_LIMIT}`),
            exactCount("guide_seller_profiles?seller_status=eq.pending&select=user_id"),
            exactCount("guide_listings?status=eq.pending_review&select=id"),
            exactCount("guide_booking_requests?status=eq.pending&select=id")
        ]);

        const profileIds = [
            ...sellerRows.map((row) => asId(row.user_id)),
            ...listingRows.map((row) => asId(row.seller_user_id)),
            ...bookingRows.map((row) => asId(row.requester_user_id)),
            ...bookingRows.map((row) => asId(row.seller_user_id))
        ];
        const listingIds = bookingRows.map((row) => asId(row.guide_listing_id)).filter(isUuid);
        const eligibilityIds = [
            ...sellerRows.map((row) => asId(row.user_id)),
            ...listingRows.map((row) => asId(row.seller_user_id))
        ];

        const [profiles, eligibility, bookingListings] = await Promise.all([
            profilesById(profileIds),
            eligibilityByUser(eligibilityIds),
            listingIds.length
                ? rest<Row[]>(`guide_listings?id=in.(${inFilter(listingIds)})&select=id,title`)
                : Promise.resolve([] as Row[])
        ]);
        const listingTitleById = new Map(
            bookingListings.map((row) => [asId(row.id), typeof row.title === "string" ? row.title : null])
        );

        return NextResponse.json({
            ok: true,
            applications: sellerRows.map((seller) => {
                const userId = asId(seller.user_id);
                return mapSellerApplication(
                    profiles.get(userId) ?? {id: userId},
                    seller,
                    eligibility.get(userId) ?? mapEligibility(null)
                );
            }),
            listings: listingRows.map((listing) => {
                const sellerId = asId(listing.seller_user_id);
                return mapListingReview(listing, {
                    ...person(profiles.get(sellerId)),
                    eligibility: eligibility.get(sellerId) ?? mapEligibility(null)
                });
            }),
            bookings: bookingRows.map((booking) => mapBookingRow(
                booking,
                listingTitleById.get(asId(booking.guide_listing_id)) ?? null,
                person(profiles.get(asId(booking.requester_user_id))),
                person(profiles.get(asId(booking.seller_user_id)))
            )),
            counts: {
                pendingApplications,
                pendingListings,
                pendingBookings
            },
            filters: {
                applications: applicationStatus,
                listings: listingStatus,
                bookings: bookingStatus
            },
            limit: GUIDE_ADMIN_QUEUE_LIMIT
        });
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? caught.message : "Unable to load Wildlife Guides"
        }, {status: 502});
    }
}

export async function POST(request: NextRequest) {
    if (!await isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const actor = await resolveAdminActor(request.cookies);
        const payload = await request.json().catch(() => ({})) as {
            action?: GuideAdminAction;
            userId?: string;
            listingId?: string;
        };
        const action = payload.action;
        if (!isGuideAdminAction(action)) {
            return NextResponse.json({ok: false, error: "Unknown Guide review action"}, {status: 400});
        }

        const reviewerId = actor.userId && isUuid(actor.userId) ? actor.userId : null;

        if (action === "approve_seller" || action === "reject_seller" || action === "suspend_seller") {
            if (!isUuid(payload.userId)) {
                return NextResponse.json({ok: false, error: "A seller user id is required"}, {status: 400});
            }
            if (action === "approve_seller") {
                const snapshot = mapEligibility(
                    await rpc<Row>("guide_seller_eligibility_snapshot", {p_user_id: payload.userId})
                );
                const gate = sellerApproveGate(snapshot);
                if (!gate.ok) {
                    return NextResponse.json({ok: false, error: gate.reason}, {status: 409});
                }
            }
            const call = sellerReviewRpc(action, payload.userId, reviewerId);
            const eligibility = await rpc<Row>(call.name, call.body);
            return NextResponse.json({ok: true, action, eligibility: mapEligibility(eligibility)});
        }

        if (!isUuid(payload.listingId)) {
            return NextResponse.json({ok: false, error: "A listing id is required"}, {status: 400});
        }
        const call = listingReviewRpc(action, payload.listingId);
        const listing = await rpc<Row>(call.name, call.body);
        return NextResponse.json({ok: true, action, listing});
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? parseGuideAdminRpcError(caught.message) : "Guide review failed"
        }, {status: 502});
    }
}
