import {NextResponse} from "next/server";

/**
 * The answer to a check-in the animal raised (something the owner asked it to
 * check back on): POST {id, action: "done" | "not_now" | "stopped"}. Done
 * completes it; Not now and Stop asking dismiss it, Stop asking for every
 * animal (`dismiss_animal_follow_up` with p_stop_all), as the apps do. Runs as
 * the reader through the owner-only RPCs.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) {
        return NextResponse.json({ok: false, error: "sign_in_required"}, {status: 401, headers: ASK_RESPONSE_HEADERS});
    }
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }
    const id = typeof body.id === "string" && UUID_PATTERN.test(body.id.trim()) ? body.id.trim() : null;
    const action = body.action;
    if (!id || (action !== "done" && action !== "not_now" && action !== "stopped")) {
        return NextResponse.json({ok: false, error: "invalid_request"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
    }
    const {error} = action === "done"
        ? await viewer.client.rpc("complete_animal_follow_up", {p_id: id})
        : await viewer.client.rpc("dismiss_animal_follow_up", {p_id: id, p_stop_all: action === "stopped"});
    if (error) {
        console.warn("[ask-animaldex] follow-up answer failed", error.message.slice(0, 200));
        return NextResponse.json({ok: false, error: "follow_up_unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
    }
    return NextResponse.json({ok: true}, {headers: ASK_RESPONSE_HEADERS});
}
