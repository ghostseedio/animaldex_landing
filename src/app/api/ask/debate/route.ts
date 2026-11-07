import {NextResponse} from "next/server";

/**
 * A debate, streamed (docs/debates/SPEC.md, section 1.3; docs/debates/
 * SERVER.md "Running the debate"): the asker's debate runs in the apps' own
 * `generate-applied-insight` (`mode: "animal_group_query"`, `flow:
 * "debate"`), and this route passes its stream through, as the reader.
 *
 * Unlike the one-to-one chat, which the web runs itself so an anonymous
 * reader on a species page can talk, a debate is only ever the signed-in
 * asker's. Running the server's flow keeps one debate everywhere: its plan
 * (everyone opens, answers once, closes, the host last), the kinds' verdicts
 * before the openings, the model safety re-check of a public debate's text
 * before its first turn, invited animals as species and Power only, no
 * memory in a public debate, each turn saved before the next, the report
 * written at the end, and no chat allowance taken.
 *
 * Frames (SERVER.md): {flow:"debate", debate_id, speakers} · each saved turn
 * replayed ({turn:{…, replay:true}}, its whole text, participant_done) · new
 * turns ({turn}, {delta}…, {participant_done} or {error}) · {report_pending}
 * · {report} or {report_error} · {done, debate, turns}. Animals are keyed by
 * their debate participant id. Errors before the stream are JSON with the
 * function's status: `debate_not_found`, `debates_off`, `debate_not_ready`,
 * `debate_cancelled`, `debate_not_public`, `debate_check_unavailable`,
 * `model_unavailable`.
 *
 * When the page goes away the upstream call is cut too: the function stops
 * the turns there, and the next call carries the debate on from the next one
 * (the report still comes once the last turn is in).
 */

import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ASK_RESPONSE_HEADERS, askLanguageName} from "@/lib/ask-animaldex/request";
import {askDebateVisuals} from "@/lib/ask-animaldex/rich";
import {debateUuid} from "@/lib/debates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to twelve turns and the report.
export const maxDuration = 300;

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return askJson({error: "invalid_request"}, 400);
    }
    const debateId = debateUuid(body.debateId);
    if (!debateId) return askJson({error: "missing_debate_id"}, 400);

    const supabase = createSupabaseServerClient();
    const url = getSupabaseUrl();
    const apiKey = getSupabasePublicKey();
    if (!supabase || !url || !apiKey) return askJson({error: "unavailable"}, 503);
    const {data: {session}} = await supabase.auth.getSession();
    // The cookie's claims are not proof on their own: the token must still be the reader's.
    const {data: {user}} = await supabase.auth.getUser();
    if (!session?.access_token || !user) return askJson({error: "not_authenticated"}, 401);

    let upstream: Response;
    try {
        upstream = await fetch(`${url}/functions/v1/generate-applied-insight`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
                Authorization: `Bearer ${session.access_token}`,
                apikey: apiKey
            },
            body: JSON.stringify({
                mode: "animal_group_query",
                // The turns may draw a little: a symbol, one small diagram or table.
                animal_group_query: {flow: "debate", debate_id: debateId, language_name: askLanguageName(body.locale), ...askDebateVisuals(body.textColumns)}
            }),
            cache: "no-store",
            signal: request.signal
        });
    } catch {
        return askJson({error: "unavailable"}, 503);
    }

    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !upstream.body || !type.includes("text/event-stream")) {
        const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
        return askJson({
            error: typeof payload?.error === "string" ? payload.error : "unavailable",
            ...(typeof payload?.status === "string" ? {status: payload.status} : {}),
            ...(typeof payload?.cancel_reason === "string" ? {cancel_reason: payload.cancel_reason} : {}),
            ...(typeof payload?.reason === "string" ? {reason: payload.reason} : {})
        }, upstream.ok ? 502 : upstream.status);
    }

    return new Response(upstream.body, {
        status: 200,
        headers: {
            ...ASK_RESPONSE_HEADERS,
            "Content-Type": "text/event-stream; charset=utf-8",
            Connection: "keep-alive",
            // Without this, nginx buffers the whole debate before the first word.
            "X-Accel-Buffering": "no"
        }
    });
}
