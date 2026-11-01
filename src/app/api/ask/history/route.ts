import {NextResponse} from "next/server";

/**
 * Chat history on every device, as the reader (docs/chat-sync/SPEC.md,
 * section 3; AnimalDex df8d2dc0 docs/chat-sync/SERVER.md):
 *
 *   GET ?list=1                 their threads (`animal_chat_threads_v1`), each
 *                               named for the sidebar and keyed as the browser
 *                               keys it (`species:<slug>`, `capture:<uuid>`);
 *   GET ?thread=<key>           one thread's messages, oldest first
 *                               (`animal_chat_thread_messages_v1`);
 *   POST {action: "delete", thread}  one thread (`delete_animal_chat_thread_v1`);
 *   POST {action: "deleteAll"}       every thread (`delete_animal_chat_history_v1`).
 *
 * Every call runs as the reader, through the owner-only RPCs. Before the
 * migration is applied the RPCs do not exist: the answer is then
 * `{available: false}` with nothing in it, and the browser behaves exactly
 * as it did before (its own threads only). Signed out: a 401.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {isMissingRpc} from "@/lib/ask-animaldex/chat-history";
import {talkAnimalsForSpeciesProfiles} from "@/data/talk-animals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = /^(capture|species):[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

function unavailable() {
    return json({ok: true, available: false, threads: [], messages: []});
}

function failed(message: string) {
    console.warn("[ask-animaldex] chat history request failed", message.slice(0, 200));
    return json({ok: false, error: "history_unavailable"}, 502);
}

type ThreadRow = {
    thread_key?: unknown;
    capture_id?: unknown;
    species_profile_id?: unknown;
    last_body_preview?: unknown;
    last_at?: unknown;
};

export async function GET(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return json({ok: false, error: "sign_in_required"}, 401);
    const url = new URL(request.url);
    const thread = url.searchParams.get("thread")?.trim() ?? "";

    if (thread) {
        if (!KEY.test(thread)) return json({ok: false, error: "invalid_thread_key"}, 400);
        const {data, error} = await viewer.client.rpc("animal_chat_thread_messages_v1", {p_thread_key: thread.toLowerCase(), p_limit: 120});
        if (isMissingRpc(error)) return unavailable();
        if (error) return failed(error.message);
        return json({ok: true, available: true, messages: Array.isArray(data) ? data : []});
    }

    if (url.searchParams.get("list") !== "1") return json({ok: false, error: "unknown_request"}, 400);
    const {data, error} = await viewer.client.rpc("animal_chat_threads_v1", {p_limit: 60});
    if (isMissingRpc(error)) return unavailable();
    if (error) return failed(error.message);
    const rows = (Array.isArray(data) ? data : []) as ThreadRow[];
    const species = await talkAnimalsForSpeciesProfiles(rows
        .map((row) => (typeof row.species_profile_id === "string" ? row.species_profile_id : ""))
        .filter(Boolean)).catch(() => new Map());
    const threads = rows.flatMap((row) => {
        const serverKey = typeof row.thread_key === "string" ? row.thread_key.toLowerCase() : "";
        const speciesId = typeof row.species_profile_id === "string" ? row.species_profile_id.toLowerCase() : "";
        const animal = speciesId ? species.get(speciesId) : undefined;
        // A thread the sidebar cannot name or open (no species it knows) stays on the devices that have it.
        if (!KEY.test(serverKey) || !animal) return [];
        const captureId = serverKey.startsWith("capture:") ? serverKey.slice("capture:".length) : null;
        return [{
            key: captureId ? serverKey : `species:${animal.slug}`,
            serverKey,
            slug: animal.slug,
            name: animal.name,
            captureId,
            preview: typeof row.last_body_preview === "string" ? row.last_body_preview.slice(0, 160) : "",
            lastAt: typeof row.last_at === "string" ? Date.parse(row.last_at) || 0 : 0
        }];
    });
    return json({ok: true, available: true, threads});
}

export async function POST(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return json({ok: false, error: "sign_in_required"}, 401);
    let body: Record<string, unknown> = {};
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        // An empty body is an unknown action.
    }
    if (body.action === "delete") {
        const thread = typeof body.thread === "string" ? body.thread.trim().toLowerCase() : "";
        if (!KEY.test(thread)) return json({ok: false, error: "invalid_thread_key"}, 400);
        const {data, error} = await viewer.client.rpc("delete_animal_chat_thread_v1", {p_thread_key: thread});
        if (isMissingRpc(error)) return unavailable();
        if (error) return failed(error.message);
        return json({ok: true, available: true, deleted: typeof data === "number" ? data : 0});
    }
    if (body.action === "deleteAll") {
        const {data, error} = await viewer.client.rpc("delete_animal_chat_history_v1");
        if (isMissingRpc(error)) return unavailable();
        if (error) return failed(error.message);
        return json({ok: true, available: true, deleted: typeof data === "number" ? data : 0});
    }
    return json({ok: false, error: "unknown_action"}, 400);
}
