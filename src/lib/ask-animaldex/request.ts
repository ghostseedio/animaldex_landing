import "server-only";

/**
 * What the two Ask endpoints share: who is asking, how often they may ask, and
 * how much of the subject they sent is allowed to reach the prompt.
 */

import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {getSupabaseAuthKey, getSupabaseUrl} from "@/lib/supabase-http";
import {hasAuthCookie} from "@/lib/viewer";
import {askLimitForViewer, SPECIES_ASK_DAILY_LIMITS, SPECIES_ASK_WINDOW_MS} from "@/lib/species-ask";
import {askPathWithoutLocale, askSubjectFromPath, type AskSubject} from "@/lib/ask-animaldex/subject";

export const ASK_RESPONSE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow"
} as const;

export type AskViewer = {
    signedIn: boolean;
    /**
     * What the database decided from verified billing, once an allowance call
     * has run; until then the profile's own flag, which is only a hint.
     */
    isPro: boolean;
    userId: string | null;
    /** A client acting as this reader, for the allowance RPCs. Null when signed out. */
    client: SupabaseClient | null;
};

const SIGNED_OUT: AskViewer = {signedIn: false, isPro: false, userId: null, client: null};

export async function resolveAskViewer(request: Request): Promise<AskViewer> {
    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
    if (!hasAuthCookie() && !jwt) {
        return SIGNED_OUT;
    }

    // A bearer token (the apps' web views) needs a client that sends it on
    // every call, so the allowance RPCs run as that user; the cookie session
    // already does.
    const supabase = jwt ? bearerClient(jwt) : createSupabaseServerClient();
    if (!supabase) return SIGNED_OUT;

    const {data: {user}} = jwt
        ? await supabase.auth.getUser(jwt)
        : await supabase.auth.getUser();
    if (!user) return SIGNED_OUT;

    const {data: profile} = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("id", user.id)
        .maybeSingle();

    return {signedIn: true, isPro: profile?.is_pro === true, userId: user.id, client: supabase};
}

function bearerClient(jwt: string): SupabaseClient | null {
    const url = getSupabaseUrl();
    const key = getSupabaseAuthKey();
    if (!url || !key) return null;
    return createClient(url, key, {
        global: {headers: {Authorization: `Bearer ${jwt}`}},
        auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
    });
}

/** Whether credits can carry the reader past today's allowance, and at what price. */
export type AskCreditOverflow = {available: boolean; cost: number; balance: number};

/** Today's budget, as the database reports it, and how this message was paid. */
export type AskAllowance = {
    allowed: boolean;
    remaining: number;
    limit: number;
    isPro: boolean;
    retryAfterSeconds: number;
    resetsAt: string | null;
    /** Who metered the turn, so the refund goes back the same way. */
    meter: "v2" | "v1" | "local";
    /** The request id the database filed the turn under (v2 only). */
    requestId: string | null;
    paidWith: "allowance" | "credits" | null;
    /** `daily_limit_reached` or `insufficient_credits` when not allowed (v2 only). */
    reason: "daily_limit_reached" | "insufficient_credits" | null;
    creditCost: number | null;
    creditBalance: number | null;
    creditOverflow: AskCreditOverflow | null;
};

type AllowanceRow = {
    allowed?: boolean;
    remaining?: number;
    limit?: number;
    is_pro?: boolean;
    resets_at?: string | null;
    request_id?: string;
    paid_with?: string;
    reason?: string;
    credit_cost?: number;
    credit_balance?: number | null;
    credit_overflow?: {available?: boolean; cost?: number; balance?: number} | null;
};

function allowanceFromRow(row: AllowanceRow, meter: AskAllowance["meter"]): AskAllowance {
    const resetsAt = row.resets_at ? Date.parse(row.resets_at) : Number.NaN;
    const overflow = row.credit_overflow && typeof row.credit_overflow === "object" ? row.credit_overflow : null;
    return {
        allowed: row.allowed === true,
        remaining: typeof row.remaining === "number" ? row.remaining : 0,
        limit: typeof row.limit === "number" ? row.limit : 0,
        isPro: row.is_pro === true,
        retryAfterSeconds: Number.isFinite(resetsAt) ? Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)) : 0,
        resetsAt: typeof row.resets_at === "string" ? row.resets_at : null,
        meter,
        requestId: typeof row.request_id === "string" ? row.request_id : null,
        paidWith: row.paid_with === "allowance" || row.paid_with === "credits" ? row.paid_with : null,
        reason: row.reason === "insufficient_credits"
            ? "insufficient_credits"
            : row.reason === "daily_limit_reached" || (meter === "v2" && row.allowed !== true)
                ? "daily_limit_reached"
                : null,
        creditCost: typeof row.credit_cost === "number" ? row.credit_cost : null,
        creditBalance: typeof row.credit_balance === "number" ? row.credit_balance : null,
        creditOverflow: overflow
            ? {
                available: overflow.available === true,
                cost: typeof overflow.cost === "number" ? overflow.cost : 0,
                balance: typeof overflow.balance === "number" ? overflow.balance : 0
            }
            : null
    };
}

const NO_PAYMENT = {
    resetsAt: null,
    requestId: null,
    paidWith: null,
    reason: null,
    creditCost: null,
    creditBalance: null,
    creditOverflow: null
} as const;

/**
 * The in-memory limiter: every anonymous reader, and a signed-in reader when
 * the database budget cannot be reached (the migration not applied yet, or
 * the RPC refusing the session). One allowance per reader across the site.
 */
function localAllowance(request: Request, viewer: AskViewer, take: boolean): AskAllowance {
    const limit = askLimitForViewer(viewer);
    const key = `ask-animaldex:${viewer.userId ?? getRequestIdentifier(request)}`;
    if (!take) {
        return {allowed: true, remaining: limit, limit, isPro: viewer.isPro, retryAfterSeconds: 0, meter: "local", ...NO_PAYMENT};
    }
    const result = checkRateLimit(key, limit, SPECIES_ASK_WINDOW_MS);
    return {...result, limit, isPro: viewer.isPro, meter: "local", ...NO_PAYMENT};
}

/** PostgREST / Postgres saying the function is not there (migration not applied). */
function isMissingFunction(error: {code?: string; message?: string} | null): boolean {
    if (!error) return false;
    if (error.code === "PGRST202" || error.code === "42883") return true;
    return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

/**
 * Takes one message from today's budget, or one credit past it.
 *
 * Signed-in readers draw from the website pool of their account's budget
 * through `take_animal_chat_turn_v2` with the service role (free 10, Pro 100 a
 * day, Pro decided from verified billing; the apps have their own, larger free
 * pool). The request id makes a retry of the same message free, and
 * `payWithCredits` — sent only after the reader chose "Continue with credits" —
 * lets a Pro reader keep talking at one credit a message. A database without
 * v2 falls back to the v1 take as the reader's own session. Anonymous readers
 * have no account to key on, so they are metered per address here, at the
 * anonymous limit.
 */
export async function takeAskTurn(
    request: Request,
    viewer: AskViewer,
    options: {requestId?: string | null; payWithCredits?: boolean} = {}
): Promise<AskAllowance> {
    if (!viewer.signedIn || !viewer.client || !viewer.userId) {
        return localAllowance(request, viewer, true);
    }

    const service = createSupabaseServiceClient();
    if (service) {
        const requestId = options.requestId ?? newRequestId();
        const {data, error} = await service.rpc("take_animal_chat_turn_v2", {
            p_user_id: viewer.userId,
            p_surface: "web",
            p_request_id: requestId,
            p_allow_credits: options.payWithCredits === true
        });
        if (!error && data && typeof data === "object") {
            const allowance = allowanceFromRow(data as AllowanceRow, "v2");
            return {...allowance, requestId: allowance.requestId ?? requestId};
        }
        if (!isMissingFunction(error)) {
            console.warn("[ask-animaldex] allowance v2 unavailable, metering locally", error?.message ?? "no row");
            return localAllowance(request, viewer, true);
        }
    }

    const {data, error} = await viewer.client.rpc("take_animal_chat_turn", {p_surface: "web"});
    if (error || !data || typeof data !== "object") {
        console.warn("[ask-animaldex] allowance RPC unavailable, metering locally", error?.message ?? "no row");
        return localAllowance(request, viewer, true);
    }
    return allowanceFromRow(data as AllowanceRow, "v1");
}

function newRequestId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Gives the message (or the credit) back when no answer was produced. Best
 * effort. A v2 turn is refunded by its request id with the service role; the
 * v1 refund is only tried when the turn was taken through v1.
 */
export async function refundAskTurn(viewer: AskViewer, allowance: AskAllowance): Promise<void> {
    if (!viewer.signedIn || !viewer.client || !viewer.userId) return;
    try {
        if (allowance.meter === "v2" && allowance.requestId) {
            const service = createSupabaseServiceClient();
            if (!service) return;
            await service.rpc("refund_animal_chat_turn_v2", {p_user_id: viewer.userId, p_request_id: allowance.requestId});
            return;
        }
        if (allowance.meter === "v1") {
            await viewer.client.rpc("refund_animal_chat_turn", {p_surface: "web"});
        }
    } catch {
        // The refund is a courtesy; the failure itself is what matters.
    }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/;

/**
 * The client's id for one message, reused when that message is retried, so a
 * retry is never charged twice. Uuid-ish, 8-120 characters (the ledger's
 * bounds); anything else is ignored and the server mints its own.
 */
export function resolveAskRequestId(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    return REQUEST_ID_PATTERN.test(value) ? value : null;
}

/** What is left today, without taking anything. */
export async function peekAskAllowance(request: Request, viewer: AskViewer): Promise<AskAllowance> {
    if (!viewer.signedIn || !viewer.client) {
        return localAllowance(request, viewer, false);
    }
    const {data, error} = await viewer.client.rpc("animal_chat_allowance", {p_surface: "web"});
    if (error || !data || typeof data !== "object") {
        return localAllowance(request, viewer, false);
    }
    return allowanceFromRow(data as AllowanceRow, "v1");
}

/** Kept for callers that only need the number: the anonymous, signed-in or Pro ceiling. */
export function askLimitFor(viewer: AskViewer): number {
    return viewer.isPro ? SPECIES_ASK_DAILY_LIMITS.pro : askLimitForViewer(viewer);
}

function cappedText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rebuilds the subject from the route, then lets the page refine it.
 *
 * The route is the trustworthy part: `/animals/<slug>` really is that species,
 * whatever the body claims. Everything a page adds on top — its title, a
 * one-line summary — reaches the prompt as `page_context`, so it is capped hard
 * and never allowed to nominate a different species than the path did.
 */
export function resolveAskSubject(raw: unknown): AskSubject {
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const path = askPathWithoutLocale(cappedText(body.path, 300) ?? "/");
    const fromPath = askSubjectFromPath(path);

    const slug = cappedText(body.slug, 80)?.toLowerCase() ?? null;
    const declaredSlug = slug && SLUG_PATTERN.test(slug) ? slug : null;
    const captureId = cappedText(body.captureId, 64);
    const declaredCapture = captureId && UUID_PATTERN.test(captureId) ? captureId : null;

    // A page may name the species it is about (a comparison, an article, a
    // capture), which is how a non-`/animals` surface reaches species scope.
    const resolvedSlug = fromPath.slug ?? declaredSlug;
    const scope = resolvedSlug && (fromPath.scope === "species" || body.scope === "species")
        ? "species" as const
        : "general" as const;

    return {
        scope,
        kind: fromPath.kind,
        slug: resolvedSlug,
        name: cappedText(body.name, 120),
        captureId: fromPath.captureId ?? declaredCapture,
        hasReaderPhoto: body.hasReaderPhoto === true,
        title: cappedText(body.title, 140),
        summary: cappedText(body.summary, 400),
        path,
        // Mirrors `normalizedText(query.trial_context, 2000)` in the edge function.
        trialContext: cappedText(body.trialContext, 2000),
        trialKey: cappedText(body.trialKey, 120)
    };
}

export type AskHistoryTurn = {role: "user" | "assistant"; content: string};

/** The last eight complete turns, which is the window the prompt expects. */
export function resolveAskHistory(raw: unknown): AskHistoryTurn[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .flatMap((entry): AskHistoryTurn[] => {
            if (!entry || typeof entry !== "object") return [];
            const row = entry as Record<string, unknown>;
            const role = row.role === "user" || row.role === "assistant" ? row.role : null;
            const content = cappedText(row.content, 4000);
            return role && content ? [{role, content}] : [];
        })
        .slice(-8);
}

export const ASK_QUESTION_MIN = 3;
export const ASK_QUESTION_MAX = 900;

export function resolveAskQuestion(raw: unknown): string | null {
    const question = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
    if (question.length < ASK_QUESTION_MIN || question.length > ASK_QUESTION_MAX) return null;
    return question;
}

const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    id: "Indonesian"
};

/** The language the reader is reading the site in, for the prompt's locale rule. */
export function askLanguageName(locale: unknown): string | null {
    const code = typeof locale === "string" ? locale.slice(0, 5).toLowerCase() : "";
    const base = code.split("-")[0];
    return LANGUAGE_NAMES[base] ?? null;
}
