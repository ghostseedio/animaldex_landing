import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";

export async function GET() {
    if (!hasAuthCookie()) {
        return NextResponse.json({user: null, username: null, displayName: null, avatarUrl: null});
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({user: null, username: null, displayName: null, avatarUrl: null});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({user: null, username: null, displayName: null, avatarUrl: null});
    }

    const {data: profile} = await supabase
        .from("profiles")
        .select("username,display_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

    const avatarUrl = profile?.avatar_url?.trim() ?? "";

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email ?? null
        },
        username: profile?.username?.trim() ?? null,
        displayName: profile?.display_name?.trim() ?? null,
        // Only an http(s) URL is drawn; anything else falls back to the initial.
        avatarUrl: /^https?:\/\//.test(avatarUrl) ? avatarUrl : null
    });
}
