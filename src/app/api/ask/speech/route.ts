import {NextResponse} from "next/server";

/**
 * Speak to [Animal], out loud: one reply in the animal's voice.
 *
 * The apps' `animal-chat-speech` edge function does the work for every
 * surface: the archetype voice chosen for the species, shaped by its pace and
 * stats, cached by voice, settings and text (so a replay is free), one of
 * today's spoken replies for a new clip, and when each word is said
 * (`words`, for the lit word). This route hands it the reader's own session,
 * as the apps call it, so the allowance is theirs and nothing is spoken on
 * the website's behalf. Signed-out readers have no allowance, and no voice.
 *
 * POST {captureId?, speciesProfileId?, text} → {ok: true, url | audio, words,
 * allowance} | {ok: false, reason: "speech_limit_reached", allowance} | an
 * error. GET → today's allowance, a peek (`my_animal_chat_speech_allowance`).
 */

import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ASK_RESPONSE_HEADERS} from "@/lib/ask-animaldex/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_MAX = 12_000;
const SPEECH_TIMEOUT_MS = 45_000;

function json(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

function uuid(raw: unknown): string | null {
    return typeof raw === "string" && UUID_PATTERN.test(raw.trim()) ? raw.trim().toLowerCase() : null;
}

/** The reader's session, or null when they are signed out. */
async function readerSession() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {session}} = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    // The cookie's claims are not proof on their own: the token must still be the user's.
    const {data: {user}} = await supabase.auth.getUser();
    return user ? {supabase, token: session.access_token} : null;
}

export async function GET() {
    const reader = await readerSession();
    if (!reader) return json({ok: false, error: "sign_in_required"}, 401);
    const {data, error} = await reader.supabase.rpc("my_animal_chat_speech_allowance");
    if (error || !data || typeof data !== "object") return json({ok: false, error: "allowance_unavailable"}, 502);
    return json({ok: true, allowance: data});
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return json({ok: false, error: "invalid_request"}, 400);
    }
    const text = typeof body.text === "string" ? body.text.slice(0, TEXT_MAX) : "";
    const captureId = uuid(body.captureId);
    const speciesProfileId = uuid(body.speciesProfileId);
    if (text.trim().length < 2) return json({ok: false, error: "missing_text"}, 400);
    if (!captureId && !speciesProfileId) return json({ok: false, error: "missing_animal"}, 400);

    const reader = await readerSession();
    if (!reader) return json({ok: false, error: "sign_in_required"}, 401);
    const url = getSupabaseUrl();
    const apiKey = getSupabasePublicKey();
    if (!url || !apiKey) return json({ok: false, error: "speech_unavailable"}, 503);

    // The reader leaving, or the voice service taking too long, ends the wait.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SPEECH_TIMEOUT_MS);
    request.signal.addEventListener("abort", () => controller.abort(), {once: true});
    let response: Response;
    try {
        response = await fetch(`${url}/functions/v1/animal-chat-speech`, {
            method: "POST",
            headers: {"Content-Type": "application/json", Authorization: `Bearer ${reader.token}`, apikey: apiKey},
            body: JSON.stringify({
                text,
                ...(captureId ? {capture_id: captureId} : {}),
                ...(speciesProfileId ? {species_profile_id: speciesProfileId} : {})
            }),
            cache: "no-store",
            signal: controller.signal
        });
    } catch {
        return json({ok: false, error: "speech_failed"}, 502);
    } finally {
        clearTimeout(timer);
    }

    // The clip could not be stored: the function hands the audio back inline.
    if ((response.headers.get("content-type") ?? "").startsWith("audio/")) {
        const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
        return json({ok: true, audio, words: null, allowance: null});
    }

    let payload: Record<string, unknown> = {};
    try {
        payload = await response.json() as Record<string, unknown>;
    } catch {
        // A body that is not JSON is a failure, said as one below.
    }
    if (!response.ok) {
        const error = typeof payload.error === "string" ? payload.error : "speech_failed";
        return json({ok: false, error}, response.status >= 500 ? 502 : response.status);
    }
    if (payload.reason === "speech_limit_reached") {
        return json({ok: false, reason: "speech_limit_reached", allowance: payload.allowance ?? null});
    }
    if (typeof payload.url !== "string") return json({ok: false, error: "speech_failed"}, 502);
    return json({
        ok: true,
        url: payload.url,
        words: Array.isArray(payload.words) ? payload.words : null,
        allowance: payload.allowance ?? null
    });
}
