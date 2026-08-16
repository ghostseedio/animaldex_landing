import {NextResponse} from "next/server";
import {
    EMPTY_VOTE_TALLY,
    fetchViewerVote,
    fetchVoteTally,
    isVoteSide
} from "@/data/comparison-engagement";
import {createGuestIdentity, readGuestKey} from "@/lib/guest-identity";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {getViewerUserId} from "@/lib/viewer";

export const runtime = "nodejs";

const VOTE_LIMIT = 30;
const VOTE_WINDOW_MS = 60 * 60 * 1000;

function normalizeSlug(value: unknown) {
    return String(value ?? "").trim().toLowerCase();
}

export async function GET(request: Request) {
    const slug = normalizeSlug(new URL(request.url).searchParams.get("slug"));
    if (!slug) return NextResponse.json({error: "invalid_slug"}, {status: 400});

    const [userId, guestKey] = [await getViewerUserId(), readGuestKey()];
    const [tally, viewerVote] = await Promise.all([
        fetchVoteTally(slug),
        fetchViewerVote(slug, {userId, guestKey})
    ]);

    return NextResponse.json({tally, viewerVote}, {headers: {"Cache-Control": "no-store"}});
}

export async function POST(request: Request) {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();

    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({error: "unavailable"}, {status: 503});
    }

    let body: {slug?: string; side?: string};
    try {
        body = (await request.json()) as {slug?: string; side?: string};
    } catch {
        return NextResponse.json({error: "invalid_request"}, {status: 400});
    }

    const slug = normalizeSlug(body.slug);
    const side = body.side;

    if (!slug || !isVoteSide(side)) {
        return NextResponse.json({error: "invalid_vote"}, {status: 400});
    }

    const limit = checkRateLimit(
        `comparison-vote:${getRequestIdentifier(request)}`,
        VOTE_LIMIT,
        VOTE_WINDOW_MS
    );

    if (!limit.allowed) {
        return NextResponse.json(
            {error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds},
            {status: 429, headers: {"Retry-After": String(limit.retryAfterSeconds)}}
        );
    }

    const userId = await getViewerUserId();
    // Guests get a first-party cookie so a repeat visit updates their vote
    // instead of stacking a new one.
    let guestKey = userId ? null : readGuestKey();
    let guestCookie: ReturnType<typeof createGuestIdentity>["cookie"] | null = null;

    if (!userId && !guestKey) {
        const identity = createGuestIdentity();
        guestKey = identity.guestKey;
        guestCookie = identity.cookie;
    }

    // One vote per viewer per comparison is enforced by partial unique indexes
    // (user votes and guest votes are indexed separately). PostgREST cannot name
    // a partial index in on_conflict, so update-then-insert stands in for upsert.
    const identity = new URLSearchParams({comparison_slug: `eq.${slug}`});
    if (userId) {
        identity.set("user_id", `eq.${userId}`);
    } else {
        identity.set("guest_key", `eq.${guestKey}`);
        identity.set("user_id", "is.null");
    }

    const updateExisting = async () => {
        const response = await fetch(`${supabaseUrl}/rest/v1/comparison_votes?${identity}`, {
            method: "PATCH",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": "application/json",
                Prefer: "return=representation"
            }),
            body: JSON.stringify({side, updated_at: new Date().toISOString()}),
            cache: "no-store"
        });

        if (!response.ok) return null;
        const rows = (await response.json().catch(() => [])) as unknown[];
        return Array.isArray(rows) && rows.length > 0;
    };

    let stored = await updateExisting();

    if (stored === false) {
        const insert = await fetch(`${supabaseUrl}/rest/v1/comparison_votes`, {
            method: "POST",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": "application/json",
                Prefer: "return=minimal"
            }),
            body: JSON.stringify({
                comparison_slug: slug,
                side,
                user_id: userId,
                guest_key: userId ? null : guestKey
            }),
            cache: "no-store"
        });

        // A concurrent vote from the same viewer wins the insert race; update it.
        stored = insert.status === 409 ? await updateExisting() : insert.ok;
    }

    if (!stored) {
        return NextResponse.json({error: "vote_failed"}, {status: 502});
    }

    const tally = await fetchVoteTally(slug).catch(() => EMPTY_VOTE_TALLY);
    const response = NextResponse.json(
        {status: "ok", tally, viewerVote: side},
        {headers: {"Cache-Control": "no-store"}}
    );

    if (guestCookie) response.cookies.set(guestCookie);
    return response;
}
