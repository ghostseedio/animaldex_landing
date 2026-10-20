import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/virtual-wildlife-guides";

export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/** The author turns sales back on after a buyer had no reply (resume_my_wildlife_guide_sales). */
export async function POST(_request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503, headers: NO_STORE});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to manage your guides."}, {status: 401, headers: NO_STORE});

    const {data, error} = await supabase.rpc("resume_my_wildlife_guide_sales", {p_listing_id: params.id});
    if (error) {
        if (/guide_not_found/.test(error.message)) return NextResponse.json({error: "Guide not found."}, {status: 404, headers: NO_STORE});
        return NextResponse.json({error: "Could not resume sales. Try again."}, {status: 400, headers: NO_STORE});
    }
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}
