import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

const PROFILE_PRESETS = new Set(["spirit", "friend", "professional", "business"]);

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const chromePreset = String(body.chromePreset ?? "").trim().toLowerCase();
    if (!PROFILE_PRESETS.has(chromePreset)) {
        return NextResponse.json({error: "A valid profile style is required."}, {status: 400});
    }

    const {error} = await supabase
        .from("profiles")
        .update({chrome_preset: chromePreset})
        .eq("id", user.id);

    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({ok: true, chromePreset});
}

