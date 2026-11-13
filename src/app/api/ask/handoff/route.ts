import {NextResponse} from "next/server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {normalizeAskHandoff} from "@/lib/ask-handoff";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isNonHumanAgent} from "@/lib/web-funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A person hits the limit once a day; a script does not get to fill the table. */
const WINDOW_MS = 10 * 60 * 1000;
const PER_ADDRESS = 20;
const BODY_MAX = 8192;

const HEADERS = {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"} as const;

function answer(body: Record<string, unknown>, status = 200) {
    return NextResponse.json(body, {status, headers: HEADERS});
}

/**
 * Keeps one web Ask hand-off (lib/ask-handoff) with the service role and
 * returns its id, which the limit panel puts on the store link and the deep
 * link. Same-site browsers only; crawlers and anything over the per-address
 * rate get nothing. A hand-off that cannot be kept is not the reader's
 * problem: the panel still opens the store, just without an id.
 */
export async function POST(request: Request) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return answer({ok: false}, 403);
    if (isNonHumanAgent(request.headers.get("user-agent"))) return answer({ok: false}, 403);

    const text = await request.text().catch(() => "");
    if (!text || text.length > BODY_MAX) return answer({ok: false, error: "bad_request"}, 400);
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return answer({ok: false, error: "bad_request"}, 400);
    }
    const row = normalizeAskHandoff(raw);
    if (!row) return answer({ok: false, error: "bad_request"}, 400);

    const byAddress = checkRateLimit(`ask-handoff:ip:${getRequestIdentifier(request)}`, PER_ADDRESS, WINDOW_MS);
    if (!byAddress.allowed) return answer({ok: false, error: "rate_limited"}, 429);

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return answer({ok: false, error: "unconfigured"}, 503);

    try {
        const response = await fetch(`${url}/rest/v1/web_ask_handoffs?select=id`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Prefer: "return=representation"}),
            body: JSON.stringify(row),
            cache: "no-store"
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            if (/PGRST205|42P01/.test(detail)) {
                console.warn("[ask-handoff] web_ask_handoffs is missing: apply landing migration 20261113180000");
                return answer({ok: false, error: "missing_table"}, 503);
            }
            console.warn("[ask-handoff] insert failed", response.status, detail.slice(0, 200));
            return answer({ok: false, error: "failed"}, 502);
        }
        const inserted = await response.json().catch(() => null) as Array<{id?: string}> | null;
        const id = inserted?.[0]?.id;
        if (!id) return answer({ok: false, error: "failed"}, 502);
        return answer({ok: true, id});
    } catch (error) {
        console.warn("[ask-handoff] insert failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return answer({ok: false, error: "failed"}, 502);
    }
}
