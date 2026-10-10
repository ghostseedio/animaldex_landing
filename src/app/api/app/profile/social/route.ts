import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * Profile header actions, writing exactly what iOS writes as the signed-in user
 * (RLS applies): `user_follows` upsert/delete, the per-follow notification
 * RPC, a `moderation_reports` row, and a `user_blocks` upsert.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPORT_REASON = "Objectionable profile content or abusive behavior";

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to do that."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const profileUserId = String(body.profileUserId ?? "").trim().toLowerCase();
    if (!UUID.test(profileUserId)) return NextResponse.json({error: "A valid profile is required."}, {status: 400});
    if (profileUserId === user.id) {
        return NextResponse.json({error: action === "block" ? "You cannot block yourself." : "That is your own profile."}, {status: 400});
    }

    switch (action) {
        case "follow": {
            const {error} = await supabase
                .from("user_follows")
                .upsert({follower_id: user.id, followed_id: profileUserId}, {onConflict: "follower_id,followed_id"});
            if (error) return NextResponse.json({error: error.message}, {status: 400});
            break;
        }
        case "unfollow": {
            const {error} = await supabase
                .from("user_follows")
                .delete()
                .eq("follower_id", user.id)
                .eq("followed_id", profileUserId);
            if (error) return NextResponse.json({error: error.message}, {status: 400});
            break;
        }
        case "notifications": {
            const preference = body.preference === "off" ? "off" : "all";
            const {error} = await supabase.rpc("set_follow_notification_preference", {p_followed_id: profileUserId, p_preference: preference});
            if (error) return NextResponse.json({error: error.message}, {status: 400});
            return NextResponse.json({ok: true, preference});
        }
        case "report": {
            const {data: reported} = await supabase
                .from("profiles")
                .select("display_name,username,bio")
                .eq("id", profileUserId)
                .maybeSingle();
            const snapshot = [reported?.display_name, reported?.username ? `@${reported.username}` : null, reported?.bio]
                .filter(Boolean)
                .join(" ")
                .trim()
                .slice(0, 1000);
            const {error} = await supabase.from("moderation_reports").insert({
                reporter_id: user.id,
                reported_user_id: profileUserId,
                content_type: "profile",
                content_id: profileUserId,
                reason: REPORT_REASON,
                snapshot
            });
            if (error) return NextResponse.json({error: "Moderation tools are unavailable right now."}, {status: 400});
            return NextResponse.json({ok: true, message: "Profile reported. AnimalDex will review the report within 24 hours."});
        }
        case "block": {
            const {error} = await supabase
                .from("user_blocks")
                .upsert({blocker_id: user.id, blocked_user_id: profileUserId, reason: "Blocked from profile"}, {onConflict: "blocker_id,blocked_user_id"});
            if (error) return NextResponse.json({error: "Moderation tools are unavailable right now."}, {status: 400});
            return NextResponse.json({ok: true, message: "User blocked. Their content has been removed from your feed."});
        }
        default:
            return NextResponse.json({error: "Unknown action."}, {status: 400});
    }

    // Follow changes: return the fresh friend state, as iOS refreshes friendships after a write.
    const {data: friend} = await supabase.from("user_friendships_v1").select("friend_id").eq("friend_id", profileUserId).maybeSingle();
    return NextResponse.json({ok: true, isFollowing: action === "follow", isFriend: Boolean(friend)});
}
