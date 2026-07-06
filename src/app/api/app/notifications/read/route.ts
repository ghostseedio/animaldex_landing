import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function POST() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Not configured"}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const {error} = await supabase.from("user_notifications").update({read_at: new Date().toISOString()}).is("read_at", null);
    return error ? NextResponse.json({error: error.message}, {status: 400}) : NextResponse.json({ok: true});
}
