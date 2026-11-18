import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isMissingFunctionError} from "@/lib/capture-gifts";

/**
 * The Gift catalog for a card (GIFTS-M1). `get_gift_catalog_v2(p_capture_id)` (Ark care, M2) when the server has it,
 * else v1 `get_gift_catalog()`. Once v2 answers "no such function", this server instance stops asking for it.
 * The body says which one answered (`source`), so a send goes to the matching RPC.
 */
let v2Missing = false;

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({enabled: false, definitions: []}, {status: 503});

    const captureId = new URL(request.url).searchParams.get("captureId")?.trim() ?? "";
    if (captureId && !v2Missing) {
        const v2 = await supabase.rpc("get_gift_catalog_v2", {p_capture_id: captureId});
        if (!v2.error && v2.data && typeof v2.data === "object") {
            return NextResponse.json({...(v2.data as Record<string, unknown>), source: "v2"});
        }
        if (isMissingFunctionError(v2.error)) v2Missing = true;
    }

    const {data, error} = await supabase.rpc("get_gift_catalog");
    if (error) {
        return NextResponse.json({enabled: false, definitions: []});
    }
    return NextResponse.json({...((data as Record<string, unknown> | null) ?? {enabled: false, definitions: []}), source: "v1"});
}
