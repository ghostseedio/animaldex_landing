import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    DISCOVER_SEEN_FLUSH_BATCH_SIZE,
    type DiscoverSeenPost,
    discoverSeenKey,
    isDiscoverSeenPost
} from "@/lib/discover-seen";

export const runtime = "nodejs";

/**
 * Records Discover posts the signed-in reader has scrolled past, through the
 * same `mark_discover_timeline_seen` RPC iOS calls, so a post seen here is not
 * served again on the phone and the other way round.
 *
 * The reader is whoever the session says they are: the RPC takes no user
 * parameter and reads `auth.uid()`, so there is no way to mark on somebody
 * else's behalf. It is idempotent, which is what lets the client retry a batch
 * it is not sure landed.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        // Not an error the reader should see, but not a success either: the
        // client keeps the batch queued and sends it once they are signed in.
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const unique = new Map<string, DiscoverSeenPost>();

    for (const post of Array.isArray(body.posts) ? body.posts : []) {
        // A malformed entry is dropped rather than failing the batch: the RPC
        // raises on an unknown type, which would strand every valid mark beside it.
        if (!isDiscoverSeenPost(post)) continue;
        const normalized = {type: post.type, id: post.id.toLowerCase()};
        unique.set(discoverSeenKey(normalized), normalized);
        if (unique.size >= DISCOVER_SEEN_FLUSH_BATCH_SIZE) break;
    }

    const posts = Array.from(unique.values());

    if (!posts.length) {
        return NextResponse.json({marked: 0});
    }

    const {error} = await supabase.rpc("mark_discover_timeline_seen", {
        p_post_types: posts.map((post) => post.type),
        p_post_ids: posts.map((post) => post.id)
    });

    if (error) {
        console.error("[discover-seen] mark failed", error.message);
        return NextResponse.json({error: "Could not record seen posts."}, {status: 502});
    }

    return NextResponse.json({marked: posts.length});
}
