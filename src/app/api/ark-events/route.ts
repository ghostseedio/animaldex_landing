import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {normalizeArkMeasureReport} from "@/lib/ark-measure";
import {recordArkMeasureEvent} from "@/lib/ark-measure-server";
import {isNonHumanAgent} from "@/lib/web-funnel";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A person makes a handful per Ark visit (an open, a session, a few taps); a script makes hundreds. */
const WINDOW_MS = 10 * 60 * 1000;
const PER_ADDRESS = 240;
const BODY_MAX = 1024;

const HEADERS = {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"} as const;

function answer(body: Record<string, unknown>) {
    return NextResponse.json(body, {status: 200, headers: HEADERS});
}

/**
 * One Ark event (lib/ark-measure) from the browser's beacon: its name and
 * properties, each checked against its own vocabulary; anything else is
 * dropped. Whether the reader is signed in is read from the request, never
 * taken from the body. Crawlers, other sites' pages and anything over the
 * per-address rate are dropped.
 *
 * Always answers 200, as the funnel beacon does: an event that cannot be
 * recorded is never the reader's problem.
 */
export async function POST(request: Request) {
    if (request.headers.get("sec-fetch-site") === "cross-site") return answer({ok: false});
    if (isNonHumanAgent(request.headers.get("user-agent"))) return answer({ok: true, recorded: false});

    const text = await request.text().catch(() => "");
    if (!text || text.length > BODY_MAX) return answer({ok: false});
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return answer({ok: false});
    }
    const parsed = normalizeArkMeasureReport(raw);
    if (!parsed) return answer({ok: false});

    const byAddress = checkRateLimit(`ark-measure:ip:${getRequestIdentifier(request)}`, PER_ADDRESS, WINDOW_MS);
    if (!byAddress.allowed) return answer({ok: false, limited: true});

    const result = await recordArkMeasureEvent({...parsed, signedIn: requestHasSupabaseAuthCookie(cookies().getAll())});
    return answer({ok: true, recorded: result.recorded});
}
