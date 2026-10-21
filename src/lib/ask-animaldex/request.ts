import "server-only";

/**
 * What the two Ask endpoints share: who is asking, how often they may ask, and
 * how much of the subject they sent is allowed to reach the prompt.
 */

import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient} from "@/lib/supabase/server";
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

/** Today's budget, as the database reports it. */
export type AskAllowance = {
    allowed: boolean;
    remaining: number;
    limit: number;
    isPro: boolean;
    retryAfterSeconds: number;
};

type AllowanceRow = {
    allowed?: boolean;
    remaining?: number;
    limit?: number;
    is_pro?: boolean;
    resets_at?: string | null;
};

function allowanceFromRow(row: AllowanceRow): AskAllowance {
    const resetsAt = row.resets_at ? Date.parse(row.resets_at) : Number.NaN;
    return {
        allowed: row.allowed === true,
        remaining: typeof row.remaining === "number" ? row.remaining : 0,
        limit: typeof row.limit === "number" ? row.limit : 0,
        isPro: row.is_pro === true,
        retryAfterSeconds: Number.isFinite(resetsAt) ? Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)) : 0
    };
}

/**
 * The in-memory limiter: every anonymous reader, and a signed-in reader when
 * the database budget cannot be reached (the migration not applied yet, or
 * the RPC refusing the session). One allowance per reader across the site.
 */
function localAllowance(request: Request, viewer: AskViewer, take: boolean): AskAllowance {
    const limit = askLimitForViewer(viewer);
    const key = `ask-animaldex:${viewer.userId ?? getRequestIdentifier(request)}`;
    if (!take) {
        return {allowed: true, remaining: limit, limit, isPro: viewer.isPro, retryAfterSeconds: 0};
    }
    const result = checkRateLimit(key, limit, SPECIES_ASK_WINDOW_MS);
    return {...result, limit, isPro: viewer.isPro};
}

/**
 * Takes one message from today's budget.
 *
 * Signed-in readers draw from the website pool of their account's budget
 * (`take_animal_chat_turn` with surface "web": free 10, Pro 100 a day, Pro
 * decided from verified billing; the apps have their own, larger free pool).
 * Anonymous readers have no account to key on, so they are metered per
 * address here, at the anonymous limit.
 */
export async function takeAskTurn(request: Request, viewer: AskViewer): Promise<AskAllowance> {
    if (!viewer.signedIn || !viewer.client) {
        return localAllowance(request, viewer, true);
    }
    const {data, error} = await viewer.client.rpc("take_animal_chat_turn", {p_surface: "web"});
    if (error || !data || typeof data !== "object") {
        console.warn("[ask-animaldex] allowance RPC unavailable, metering locally", error?.message ?? "no row");
        return localAllowance(request, viewer, true);
    }
    return allowanceFromRow(data as AllowanceRow);
}

/** Gives the message back when no answer was produced. Best effort. */
export async function refundAskTurn(viewer: AskViewer): Promise<void> {
    if (!viewer.signedIn || !viewer.client) return;
    try {
        await viewer.client.rpc("refund_animal_chat_turn", {p_surface: "web"});
    } catch {
        // The refund is a courtesy; the failure itself is what matters.
    }
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
    return allowanceFromRow(data as AllowanceRow);
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
