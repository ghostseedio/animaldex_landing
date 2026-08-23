import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const captureId = new URL(request.url).searchParams.get("captureId")?.trim() ?? "";
    if (!captureId) return NextResponse.json({error: "A capture is required."}, {status: 400});

    const {data, error} = await supabase.rpc("list_capture_gifts", {p_capture_id: captureId});
    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json(data ?? {capture_id: captureId, gifts: []});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const captureId = String(body.captureId ?? "").trim();
    const definitionId = String(body.definitionId ?? "").trim();
    const clientKey = String(body.clientIdempotencyKey ?? crypto.randomUUID()).trim();

    if (!captureId || !definitionId) {
        return NextResponse.json({error: "A capture and Gift are required."}, {status: 400});
    }

    const {data, error} = await supabase.rpc("send_capture_gift", {
        p_capture_id: captureId,
        p_definition_id: definitionId,
        p_client_idempotency_key: clientKey
    });

    if (error) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json(data);
}
