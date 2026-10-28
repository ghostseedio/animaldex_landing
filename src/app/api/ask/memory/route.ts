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
 *
 * The same sheet holds how the animals talk with them (AnimalDex 5e952ce1):
 * GET also returns `settings` — personalisation, step suggestions, check-ins,
 * whether visitors may hear the journey note (`animal_chat_settings`) and
 * whether animals may message them (`animal_messages_settings`) — and POST
 * {action: "preferences", ...} changes any of them.
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

type AskMemorySettings = {
    personalisationEnabled: boolean | null;
    suggestSteps: boolean | null;
    followUpsEnabled: boolean | null;
    shareJourney: boolean | null;
    animalMessagesEnabled: boolean | null;
};

/** Each switch the database answered; null for one it could not (it is then not shown). */
async function readSettings(client: NonNullable<Awaited<ReturnType<typeof resolveAskViewer>>["client"]>): Promise<AskMemorySettings> {
    const [chat, messages] = await Promise.all([
        client.rpc("animal_chat_settings"),
        client.rpc("animal_messages_settings")
    ]);
    const row = !chat.error && chat.data && typeof chat.data === "object" ? chat.data as Record<string, unknown> : null;
    const messagesRow = !messages.error && messages.data && typeof messages.data === "object" ? messages.data as Record<string, unknown> : null;
    const flag = (value: unknown) => typeof value === "boolean" ? value : null;
    return {
        personalisationEnabled: flag(row?.personalisation_enabled),
        suggestSteps: flag(row?.suggest_steps),
        followUpsEnabled: flag(row?.follow_ups_enabled),
        shareJourney: flag(row?.share_journey),
        animalMessagesEnabled: flag(messagesRow?.enabled)
    };
}

export async function GET(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();
    const [{data, error}, settings] = await Promise.all([
        viewer.client.rpc("get_animal_chat_memory"),
        readSettings(viewer.client)
    ]);
    if (error) return failed(error.message);
    return NextResponse.json({ok: true, facts: parseAskMemoryFacts(data), settings}, {headers: ASK_RESPONSE_HEADERS});
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

    if (body.action === "preferences") {
        const flag = (value: unknown) => typeof value === "boolean" ? value : null;
        const personalisation = flag(body.personalisationEnabled);
        const suggestSteps = flag(body.suggestSteps);
        const followUps = flag(body.followUpsEnabled);
        const shareJourney = flag(body.shareJourney);
        const animalMessages = flag(body.animalMessagesEnabled);
        const writes: Array<PromiseLike<{error: {message: string} | null}>> = [];
        if (personalisation !== null || suggestSteps !== null || followUps !== null) {
            writes.push(viewer.client.rpc("set_animal_chat_preferences", {
                p_personalisation: personalisation,
                p_suggest_steps: suggestSteps,
                p_follow_ups: followUps
            }));
        }
        if (shareJourney !== null) writes.push(viewer.client.rpc("set_animal_chat_share_journey", {p_enabled: shareJourney}));
        if (animalMessages !== null) writes.push(viewer.client.rpc("set_animal_messages_enabled", {p_enabled: animalMessages}));
        const results = await Promise.all(writes);
        const failure = results.find((result) => result.error);
        if (failure?.error) return failed(failure.error.message);
        return NextResponse.json({ok: true, settings: await readSettings(viewer.client)}, {headers: ASK_RESPONSE_HEADERS});
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
