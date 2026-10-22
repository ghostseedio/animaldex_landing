import {NextResponse} from "next/server";

/**
 * What the animals remember about the signed-in reader, in their hands.
 *
 * GET lists the facts; POST {action: "forget", id} drops one by its id (or
 * {action: "forget", fact} by its text, for facts saved before ids existed),
 * POST {action: "correct", id, text} rewrites one in the reader's own words,
 * and POST {action: "clear"} drops them all. Every call runs as the reader through the
 * owner-only RPCs, so there is nothing here the service role has to vouch for.
 * Signed-out readers have no memory and get a 401.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {parseAskMemoryFacts} from "@/lib/ask-animaldex/memory-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FACT_MAX = 400;
const ID_MAX = 64;

function factId(raw: unknown): string {
    return typeof raw === "string" ? raw.trim().slice(0, ID_MAX) : "";
}

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

    if (body.action === "correct") {
        const id = factId(body.id);
        const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, FACT_MAX) : "";
        if (!id) {
            return NextResponse.json({ok: false, error: "id_required"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
        }
        // An empty correction forgets the fact; the RPC decides that.
        const {data, error} = await viewer.client.rpc("correct_animal_chat_memory_fact", {p_id: id, p_text: text});
        if (error) return failed(error.message);
        return NextResponse.json({ok: true, facts: parseAskMemoryFacts(data)}, {headers: ASK_RESPONSE_HEADERS});
    }

    if (body.action === "forget") {
        const id = factId(body.id);
        if (id) {
            const {data, error} = await viewer.client.rpc("forget_animal_chat_memory_fact_by_id", {p_id: id});
            if (error) return failed(error.message);
            return NextResponse.json({ok: true, facts: parseAskMemoryFacts(data)}, {headers: ASK_RESPONSE_HEADERS});
        }
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
