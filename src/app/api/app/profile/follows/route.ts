import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;

/**
 * One page of a profile's followers or following — iOS `ProfileFollowListView`
 * (`get_profile_followers` / `get_profile_following`, 50 a page, offset paging).
 * Signed-in only, as on the phone ("Sign in to see this list.").
 */
export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to see this list."}, {status: 401});

    const params = new URL(request.url).searchParams;
    const userId = params.get("userId")?.trim() ?? "";
    const kind = params.get("kind") === "following" ? "following" : "followers";
    const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));
    if (!UUID_PATTERN.test(userId)) return NextResponse.json({error: "A user id is required."}, {status: 400});

    const {data, error} = await supabase.rpc(kind === "following" ? "get_profile_following" : "get_profile_followers", {
        p_user_id: userId,
        p_limit: PAGE_SIZE,
        p_offset: offset
    });
    if (error) return NextResponse.json({error: "Couldn't load this list."}, {status: 400});

    const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    const entries = rows
        .filter((row) => typeof row.user_id === "string")
        .map((row) => ({
            userId: row.user_id as string,
            displayName: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null,
            username: typeof row.username === "string" && row.username.trim() ? row.username.trim() : null,
            avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url.trim() : null,
            isPro: row.is_pro === true,
            viewerFollows: row.viewer_follows === true
        }));

    return NextResponse.json({entries, viewerId: user.id, hasMore: rows.length >= PAGE_SIZE});
}
