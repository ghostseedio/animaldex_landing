import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createWebCaptureSession} from "@/lib/supabase/web-capture-session";

export async function POST() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    try {
        return NextResponse.json({token: createWebCaptureSession(user.id), expiresIn: 90});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Capture session unavailable."}, {status: 503});
    }
}
