import {NextResponse} from "next/server";

/**
 * What the animals remember about the signed-in reader, in their hands.
 *
 * GET lists the facts; POST {action: "forget", fact} drops one and POST
 * {action: "clear"} drops them all. Every call runs as the reader through the
 * owner-only RPCs, so there is nothing here the service role has to vouch for.
 * Signed-out readers have no memory and get a 401.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {parseAskMemoryFacts} from "@/lib/ask-animaldex/memory-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FACT_MAX = 400;

export async function GET(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();
    const {data, error} = await viewer.client.rpc("get_animal_chat_memory");
    if (error) return failed(error.message);
    return NextResponse.json({ok: true, facts: parseAskMemoryFacts(data)}, {headers: ASK_RESPONSE_HEADERS});
}

export async function POST(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }

    if (body.action === "clear") {
        const {error} = await viewer.client.rpc("clear_animal_chat_memory");
        if (error) return failed(error.message);
        return NextResponse.json({ok: true, facts: []}, {headers: ASK_RESPONSE_HEADERS});
    }

    if (body.action === "forget") {
        const fact = typeof body.fact === "string" ? body.fact.trim().slice(0, FACT_MAX) : "";
        if (!fact) {
            return NextResponse.json({ok: false, error: "fact_required"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
        }
        const {data, error} = await viewer.client.rpc("forget_animal_chat_memory_fact", {p_fact: fact});
        if (error) return failed(error.message);
        return NextResponse.json({ok: true, facts: parseAskMemoryFacts(data)}, {headers: ASK_RESPONSE_HEADERS});
    }

    return NextResponse.json({ok: false, error: "unknown_action"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
}

function signedOut() {
    return NextResponse.json({ok: false, error: "sign_in_required"}, {status: 401, headers: ASK_RESPONSE_HEADERS});
}

function failed(message: string) {
    console.warn("[ask-animaldex] memory request failed", message.slice(0, 200));
    return NextResponse.json({ok: false, error: "memory_unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
}
