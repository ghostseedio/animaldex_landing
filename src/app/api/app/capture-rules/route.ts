import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

/**
 * The capture rules every capture is held to (the same ones the apps show).
 * GET: the highest version this account agreed to (null if never).
 * POST {version}: record agreement; the server keeps the highest version.
 */
export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const {data, error} = await supabase.rpc("my_capture_rules_version");
    if (error) return NextResponse.json({error: error.message}, {status: 502});
    return NextResponse.json({version: typeof data === "number" ? data : null});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const body = await request.json().catch(() => ({}));
    const version = Number(body?.version);
    if (!Number.isInteger(version) || version < 1) return NextResponse.json({error: "invalid_rules_version"}, {status: 400});
    const {data, error} = await supabase.rpc("accept_capture_rules", {p_rules_version: version});
    if (error) return NextResponse.json({error: error.message}, {status: 502});
    return NextResponse.json(data ?? {rulesVersion: version});
}
