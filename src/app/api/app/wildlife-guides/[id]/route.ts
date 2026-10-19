import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET(request: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const owner = new URL(request.url).searchParams.get("owner") === "1";
    let data: unknown = null;
    if (owner) {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
        const {data: mine, error} = await supabase.rpc("get_my_wildlife_guide", {p_listing_id: params.id});
        if (error) return NextResponse.json({error: error.message}, {status: 400});
        data = mine;
    } else {
        const {data: guide, error} = await supabase.rpc("get_public_wildlife_guide", {p_listing_id: params.id});
        if (error) return NextResponse.json({error: error.message}, {status: 400});
        data = guide;
    }
    if (!data) return NextResponse.json({error: "Guide not found."}, {status: 404});
    return NextResponse.json({guide: data}, {headers: {"Cache-Control": "private, no-store"}});
}

export async function PATCH(request: Request, {params}: {params: {id: string}}) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of ["title", "summary", "overview", "seasonLine", "areaLabel", "visibility"]) {
        if (typeof input[key] === "string") patch[key] = input[key];
    }
    if (typeof input.priceAuto === "boolean") patch.priceAuto = input.priceAuto;
    if (Number.isInteger(input.amountMinor)) patch.amountMinor = input.amountMinor;
    if (!Object.keys(patch).length) return NextResponse.json({error: "There are no guide changes to save."}, {status: 400});
    const {data, error} = await supabase.rpc("update_my_wildlife_guide", {p_listing_id: params.id, p_patch: patch});
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    if (!data) return NextResponse.json({error: "Guide not found."}, {status: 404});
    return NextResponse.json({guide: data}, {headers: {"Cache-Control": "private, no-store"}});
}
