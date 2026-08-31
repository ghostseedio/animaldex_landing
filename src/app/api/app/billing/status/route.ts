import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const purchaseId = new URL(request.url).searchParams.get("purchase_id");
    const {data, error} = await supabase.rpc("get_my_web_billing_status", {
        p_purchase_id: purchaseId
    });
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json(data ?? {balance: 0, is_pro: false});
}
