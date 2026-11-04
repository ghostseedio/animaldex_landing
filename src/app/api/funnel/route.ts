import {NextResponse} from "next/server";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {isNonHumanAgent, normalizeWebFunnelReport} from "@/lib/web-funnel";
import {recordWebFunnelEvent} from "@/lib/web-funnel-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generous for a person (a step is sent at most once per tab session), tight for a script. */
const WINDOW_MS = 10 * 60 * 1000;
const PER_ADDRESS = 120;
const PER_VISITOR = 30;
const BODY_MAX = 2048;

const HEADERS = {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"} as const;

function answer(body: Record<string, unknown>) {
    return NextResponse.json(body, {status: 200, headers: HEADERS});
}

/**
 * One step of the front-door funnel (lib/web-funnel), from the browser's
 * beacon. The step must be one of the funnel's, from a visitor with a hero
 * variant; crawlers, other sites' pages and anything over the per-address or
 * per-visitor rate are dropped. A signup is never taken from here: the
 * sign-in callback records it.
 *
 * Always answers 200, as the content-view beacon does: a step that cannot be
 * recorded is not the reader's problem, and a failing beacon must never show
 * up as an error on a public page.
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
    const report = normalizeWebFunnelReport(raw);
    if (!report) return answer({ok: false});

    const byAddress = checkRateLimit(`web-funnel:ip:${getRequestIdentifier(request)}`, PER_ADDRESS, WINDOW_MS);
    const byVisitor = checkRateLimit(`web-funnel:vid:${report.visitorId}`, PER_VISITOR, WINDOW_MS);
    if (!byAddress.allowed || !byVisitor.allowed) return answer({ok: false, limited: true});

    const result = await recordWebFunnelEvent(report);
    return answer({ok: true, recorded: result.recorded});
}
