import {NextResponse} from "next/server";
import {arkStoryShareBody, arkStoryShareResult, decodeArkStoryDraft} from "@/lib/ark-founders";
import {isArkUuid, isMissingArkFunction} from "@/lib/ark-story";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The share line under an arrival in the chat (founders contract, section 4),
 * always as the signed-in reader:
 *
 * - GET ?animal=<id>: `voyage_founder_story_draft_v1` — the step to prefill
 *   (never the problem), the story when shared, and whether it may be shared.
 *   `{draft: null}` signed out, before the migration, or when it fails: no line.
 * - POST {animal_id, step, problem?}: to the edge function
 *   `voyage-founder-story` with the reader's own token (it screens the words
 *   and saves them). `{ok: true, story}`, or `{ok: false, problem}` with
 *   `not_public` (other words, the editor stays open), `could_not_check`
 *   (try again) or `unavailable`.
 * - DELETE ?animal=<id>: `voyage_founder_story_delete_v1` (the author only).
 *
 * Nothing is shared without the reader's tap; this route never fills in a
 * problem line.
 */
const HEADERS = {"Cache-Control": "private, no-store"} as const;

function animalOf(request: Request): string | null {
    const id = new URL(request.url).searchParams.get("animal")?.trim() ?? "";
    return isArkUuid(id) ? id.toLowerCase() : null;
}

export async function GET(request: Request) {
    const animal = animalOf(request);
    if (!animal) return NextResponse.json({draft: null}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({draft: null}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_founder_story_draft_v1", {p_animal_id: animal});
    if (error) {
        if (!isMissingArkFunction(error) && !/not_authenticated/.test(error.message ?? "")) console.warn("[ark] voyage_founder_story_draft_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({draft: null}, {headers: HEADERS});
    }
    return NextResponse.json({draft: decodeArkStoryDraft(data)}, {headers: HEADERS});
}

export async function POST(request: Request) {
    let raw: Record<string, unknown>;
    try {
        raw = await request.json() as Record<string, unknown>;
    } catch {
        return NextResponse.json({ok: false, problem: "unavailable"}, {status: 400, headers: HEADERS});
    }
    const checked = arkStoryShareBody(
        typeof raw?.animal_id === "string" ? raw.animal_id : "",
        typeof raw?.step === "string" ? raw.step : "",
        typeof raw?.problem === "string" ? raw.problem : null
    );
    if (!checked.ok) return NextResponse.json({ok: false, problem: "unavailable", error: checked.error}, {status: 400, headers: HEADERS});

    const supabase = createSupabaseServerClient();
    const url = getSupabaseUrl();
    const apiKey = getSupabasePublicKey();
    if (!supabase || !url || !apiKey) return NextResponse.json({ok: false, problem: "unavailable"}, {status: 503, headers: HEADERS});
    const {data: {session}} = await supabase.auth.getSession();
    // The cookie's claims are not proof on their own: the token must still be the reader's.
    const {data: {user}} = await supabase.auth.getUser();
    if (!session?.access_token || !user) return NextResponse.json({ok: false, problem: "unavailable", error: "not_authenticated"}, {status: 401, headers: HEADERS});

    let upstream: Response;
    try {
        upstream = await fetch(`${url}/functions/v1/voyage-founder-story`, {
            method: "POST",
            headers: {"Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: apiKey},
            body: JSON.stringify(checked.body),
            cache: "no-store",
            signal: request.signal
        });
    } catch {
        return NextResponse.json({ok: false, problem: "could_not_check"}, {status: 503, headers: HEADERS});
    }
    const body = await upstream.json().catch(() => null);
    const result = arkStoryShareResult(upstream.status, body);
    if (result.ok) return NextResponse.json({ok: true, story: result.story}, {headers: HEADERS});
    const status = result.problem === "not_public" ? 422 : result.problem === "could_not_check" ? 503 : upstream.status >= 400 ? upstream.status : 502;
    return NextResponse.json({ok: false, problem: result.problem}, {status, headers: HEADERS});
}

export async function DELETE(request: Request) {
    const animal = animalOf(request);
    if (!animal) return NextResponse.json({ok: false}, {status: 400, headers: HEADERS});
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ok: false}, {status: 503, headers: HEADERS});
    const {data, error} = await supabase.rpc("voyage_founder_story_delete_v1", {p_animal_id: animal});
    if (error) {
        const signedOut = /not_authenticated/.test(error.message ?? "");
        if (!signedOut && !isMissingArkFunction(error)) console.warn("[ark] voyage_founder_story_delete_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({ok: false}, {status: signedOut ? 401 : 503, headers: HEADERS});
    }
    return NextResponse.json({ok: data === true}, {headers: HEADERS});
}
