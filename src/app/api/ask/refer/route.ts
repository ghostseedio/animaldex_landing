import {NextResponse} from "next/server";

/**
 * "Ask another animal" (2026-11-07): the reader sends their problem from one
 * of their animals to another. Passed to the apps' function as the reader
 * (`refer-animal.ts`), so the web and the apps refuse alike; no model is asked.
 */

import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {ASK_RESPONSE_HEADERS} from "@/lib/ask-animaldex/request";
import {referAnimalReply, referAnimalUpstreamBody} from "@/lib/ask-animaldex/refer-animal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (!body || typeof body !== "object") return askJson({error: "invalid_request"}, 400);

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
                Authorization: `Bearer ${session.access_token}`,
                apikey: apiKey
            },
            body: JSON.stringify(referAnimalUpstreamBody(body)),
            cache: "no-store",
            signal: request.signal
        });
    } catch {
        return askJson({error: "unavailable"}, 503);
    }
    const reply = referAnimalReply(upstream.status, await upstream.json().catch(() => null));
    return askJson(reply.body, reply.status);
}
