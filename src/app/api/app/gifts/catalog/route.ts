import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({enabled: false, definitions: []}, {status: 503});

    const {data, error} = await supabase.rpc("get_gift_catalog");
    if (error) {
        return NextResponse.json({enabled: false, definitions: []});
    }
    return NextResponse.json(data ?? {enabled: false, definitions: []});
}
