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

    // voter_key is generated from user_id/guest_key and carries the only unique
    // index PostgREST can target here.
    const conflictTarget = "comparison_slug,voter_key";
    const row = {
        comparison_slug: slug,
        side,
        user_id: userId,
        guest_key: userId ? null : guestKey,
        updated_at: new Date().toISOString()
    };

    const upsert = await fetch(
        `${supabaseUrl}/rest/v1/comparison_votes?on_conflict=${encodeURIComponent(conflictTarget)}`,
        {
            method: "POST",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=representation"
            }),
            body: JSON.stringify(row),
            cache: "no-store"
        }
    );

    if (!upsert.ok) {
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
