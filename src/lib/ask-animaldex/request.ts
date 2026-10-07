import "server-only";

/**
 * What the two Ask endpoints share: who is asking, how often they may ask, and
 * how much of the subject they sent is allowed to reach the prompt.
 */

import {checkRateLimit, getRequestIdentifier} from "@/lib/rate-limit";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {hasAuthCookie} from "@/lib/viewer";
import {askLimitForViewer, SPECIES_ASK_WINDOW_MS} from "@/lib/species-ask";
import {askPathWithoutLocale, askSubjectFromPath, type AskSubject} from "@/lib/ask-animaldex/subject";

export const ASK_RESPONSE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow"
} as const;

export type AskViewer = {
    signedIn: boolean;
    isPro: boolean;
    userId: string | null;
};

export async function resolveAskViewer(request: Request): Promise<AskViewer> {
    if (!hasAuthCookie() && !request.headers.get("authorization")) {
        return {signedIn: false, isPro: false, userId: null};
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) return {signedIn: false, isPro: false, userId: null};

    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
    const {data: {user}} = jwt
        ? await supabase.auth.getUser(jwt)
        : await supabase.auth.getUser();
    if (!user) return {signedIn: false, isPro: false, userId: null};

    const {data: profile} = await supabase
        .from("profiles")
        .select("is_pro")
        .eq("id", user.id)
        .maybeSingle();

    return {signedIn: true, isPro: profile?.is_pro === true, userId: user.id};
}

/**
 * The daily window, shared with the species page's own Ask entitlements so a
 * reader has one allowance across the site rather than one per surface.
 */
export function checkAskRateLimit(request: Request, viewer: AskViewer) {
    const limit = askLimitForViewer(viewer);
    const key = `ask-animaldex:${viewer.userId ?? getRequestIdentifier(request)}`;
    return {limit, ...checkRateLimit(key, limit, SPECIES_ASK_WINDOW_MS)};
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
