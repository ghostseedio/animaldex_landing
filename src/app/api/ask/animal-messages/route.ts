import {NextResponse} from "next/server";

/**
 * What an animal wrote to the owner by itself (`animal_messages`, AnimalDex
 * 51293f02): the owner's chat with it brings those messages into the thread
 * and marks them read, as the apps do.
 *
 * GET ?speciesProfileId= lists its newest messages (`animal_messages_for`) and
 * whether it is muted. GET alone lists every animal you talk with or that
 * wrote to you (`animal_conversations`: the Companions tab's unread lines,
 * dots and mutes); GET ?view=unread counts what is unread across them all
 * (`unread_animal_message_count`, the tab's badge). POST {action: "read",
 * speciesProfileId} marks them read
 * (`mark_animal_messages_read`, which answers what is left unread across every
 * animal); POST {action: "mute", speciesProfileId, muted} mutes or unmutes it
 * (`set_animal_messages_muted`). All as the reader. A database without the
 * migration answers an empty list.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function speciesFrom(raw: unknown): string | null {
    return typeof raw === "string" && UUID_PATTERN.test(raw.trim()) ? raw.trim().toLowerCase() : null;
}

function signedOut() {
    return NextResponse.json({ok: false, error: "sign_in_required"}, {status: 401, headers: ASK_RESPONSE_HEADERS});
}

export async function GET(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "unread") {
        const {data, error} = await viewer.client.rpc("unread_animal_message_count");
        return NextResponse.json({ok: true, unread: !error && typeof data === "number" ? data : null}, {headers: ASK_RESPONSE_HEADERS});
    }
    if (!params.has("speciesProfileId")) {
        const {data, error} = await viewer.client.rpc("animal_conversations", {p_limit: 60});
        if (error) {
            console.warn("[ask-animaldex] animal conversations unavailable", error.message.slice(0, 200));
            return NextResponse.json({ok: true, conversations: [], available: false}, {headers: ASK_RESPONSE_HEADERS});
        }
        return NextResponse.json({ok: true, conversations: Array.isArray(data) ? data : [], available: true}, {headers: ASK_RESPONSE_HEADERS});
    }
    const speciesProfileId = speciesFrom(params.get("speciesProfileId"));
    if (!speciesProfileId) {
        return NextResponse.json({ok: false, error: "species_required"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
    }
    const [messages, conversations] = await Promise.all([
        viewer.client.rpc("animal_messages_for", {p_species_profile_id: speciesProfileId, p_limit: 20}),
        viewer.client.rpc("animal_conversations", {p_limit: 60})
    ]);
    if (messages.error) {
        console.warn("[ask-animaldex] animal messages unavailable", messages.error.message.slice(0, 200));
        return NextResponse.json({ok: true, messages: [], muted: false}, {headers: ASK_RESPONSE_HEADERS});
    }
    const row = Array.isArray(conversations.data)
        ? (conversations.data as Array<Record<string, unknown>>).find((item) => String(item.species_profile_id ?? "").toLowerCase() === speciesProfileId)
        : null;
    return NextResponse.json({
        ok: true,
        messages: Array.isArray(messages.data) ? messages.data : [],
        muted: row?.muted === true
    }, {headers: ASK_RESPONSE_HEADERS});
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
    const speciesProfileId = speciesFrom(body.speciesProfileId);
    if (!speciesProfileId) {
        return NextResponse.json({ok: false, error: "species_required"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
    }
    if (body.action === "read") {
        const {data, error} = await viewer.client.rpc("mark_animal_messages_read", {p_species_profile_id: speciesProfileId});
        if (error) return NextResponse.json({ok: false, error: "unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
        return NextResponse.json({ok: true, unread: typeof data === "number" ? data : null}, {headers: ASK_RESPONSE_HEADERS});
    }
    if (body.action === "mute") {
        const {data, error} = await viewer.client.rpc("set_animal_messages_muted", {
            p_species_profile_id: speciesProfileId,
            p_muted: body.muted === true
        });
        if (error) return NextResponse.json({ok: false, error: "unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
        return NextResponse.json({ok: true, muted: data === true}, {headers: ASK_RESPONSE_HEADERS});
    }
    return NextResponse.json({ok: false, error: "unknown_action"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
}
