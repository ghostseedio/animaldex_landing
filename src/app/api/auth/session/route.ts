import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({user: null, username: null});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({user: null, username: null});
    }

    const {data: profile} = await supabase
        .from("profiles")
        .select("username,display_name")
        .eq("id", user.id)
        .maybeSingle();

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email ?? null
        },
        username: profile?.username?.trim() ?? null,
        displayName: profile?.display_name?.trim() ?? null
    });
}
