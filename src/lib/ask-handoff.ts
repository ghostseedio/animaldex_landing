/**
 * The web Ask hand-off (CC 2, Nov 2026): when a reader hits the daily Ask
 * limit on the website and takes "Keep talking in the app, free", the last
 * turns of that conversation are kept server-side (`web_ask_handoffs`,
 * landing migration 20261113180000) under an id the store link and the deep
 * link carry, so the app can pick the conversation up after install:
 *
 *   animaldex://talk?species=<slug>&handoff=<id>
 *   https://animaldex.app/talk/<slug>?handoff=<id>
 *
 * Nothing about the reader is stored: no account, address or user agent;
 * the row holds the species, up to three turns and when it was made.
 * `redeemed_at` stays null until an app claims it (not built here).
 *
 * Pure: the request rules and the links are tested.
 */

export const ASK_HANDOFF_ENDPOINT = "/api/ask/handoff";
export const ASK_HANDOFF_MAX_TURNS = 3;
export const ASK_HANDOFF_TURN_MAX_CHARS = 1500;
export const ASK_HANDOFF_PATH_MAX = 300;
export const ASK_HANDOFF_SCHEME_LINK = "animaldex://talk";

const SPECIES_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AskHandoffTurn = {role: "user" | "assistant"; text: string};

export type AskHandoffRow = {
    species_slug: string;
    species_profile_id: string | null;
    turns: AskHandoffTurn[];
    source_path: string | null;
};

function cleanText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    return text.length > ASK_HANDOFF_TURN_MAX_CHARS ? `${text.slice(0, ASK_HANDOFF_TURN_MAX_CHARS - 1)}…` : text;
}

export function isAskHandoffSpeciesSlug(value: unknown): value is string {
    return typeof value === "string" && value.length <= 120 && SPECIES_SLUG.test(value);
}

export function isAskHandoffId(value: unknown): value is string {
    return typeof value === "string" && UUID.test(value);
}

/**
 * The turns a hand-off keeps: the last three the reader and the animal
 * exchanged that were really said (complete, with words), oldest first,
 * each cut at 1,500 characters. A greeting the animal volunteered counts;
 * a failed reply and a message still streaming do not.
 */
export function lastAskTurns(messages: ReadonlyArray<{role: "user" | "assistant"; text: string; status?: string}>): AskHandoffTurn[] {
    const turns: AskHandoffTurn[] = [];
    for (let at = messages.length - 1; at >= 0 && turns.length < ASK_HANDOFF_MAX_TURNS; at -= 1) {
        const message = messages[at];
        if (message.status && message.status !== "complete") continue;
        const text = cleanText(message.text);
        if (!text) continue;
        turns.unshift({role: message.role, text});
    }
    return turns;
}

/** What the browser sends to /api/ask/handoff. */
export function askHandoffRequestBody(input: {
    slug: string;
    speciesProfileId: string | null | undefined;
    messages: ReadonlyArray<{role: "user" | "assistant"; text: string; status?: string}>;
    path: string | null | undefined;
}) {
    return {
        slug: input.slug,
        species_profile_id: input.speciesProfileId ?? null,
        turns: lastAskTurns(input.messages),
        path: input.path ?? null
    };
}

/** One hand-off as the browser sent it, as a row to insert, or null when anything about it is off. */
export function normalizeAskHandoff(raw: unknown): AskHandoffRow | null {
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!body || !isAskHandoffSpeciesSlug(body.slug)) return null;
    const speciesProfileId = isAskHandoffId(body.species_profile_id) ? body.species_profile_id.toLowerCase() : null;
    if (body.species_profile_id != null && !speciesProfileId) return null;
    if (!Array.isArray(body.turns) || body.turns.length > ASK_HANDOFF_MAX_TURNS) return null;
    const turns: AskHandoffTurn[] = [];
    for (const entry of body.turns) {
        const turn = entry && typeof entry === "object" ? entry as Record<string, unknown> : null;
        if (!turn || (turn.role !== "user" && turn.role !== "assistant")) return null;
        const text = cleanText(turn.text);
        if (!text) return null;
        turns.push({role: turn.role, text});
    }
    let sourcePath: string | null = null;
    if (typeof body.path === "string") {
        const path = body.path.split(/[?#]/)[0].replace(/[\u0000-\u001f]/g, "").trim();
        sourcePath = path.startsWith("/") && !path.startsWith("//") ? path.slice(0, ASK_HANDOFF_PATH_MAX) : null;
    }
    return {species_slug: body.slug, species_profile_id: speciesProfileId, turns, source_path: sourcePath};
}

/** The Pro plan the website can sell at the limit: yearly when its Paddle price is set, else monthly, else none. */
export type AskLimitProPlan = "pro_annual" | "pro_upgrade";

export function askLimitProPlan(priceIds: {annual: string | null | undefined; monthly: string | null | undefined}): AskLimitProPlan | null {
    if (priceIds.annual?.trim()) return "pro_annual";
    if (priceIds.monthly?.trim()) return "pro_upgrade";
    return null;
}

export type AskLimitProAction =
    /** Signed in with a plan on sale: open Paddle in place. */
    | {kind: "checkout"; plan: AskLimitProPlan}
    /** A plan on sale but no account yet: sign in, then the Pro page. */
    | {kind: "sign_in"; href: string}
    /** No Paddle price configured: the checkout page, which says web billing is not on. */
    | {kind: "checkout_page"; href: string};

/** "Pro for a week": what the second button does for this reader. */
export function askLimitProAction(input: {plan: AskLimitProPlan | null | undefined; signedIn: boolean}): AskLimitProAction {
    if (!input.plan) return {kind: "checkout_page", href: "/checkout"};
    if (input.signedIn) return {kind: "checkout", plan: input.plan};
    return {kind: "sign_in", href: `/account?next=${encodeURIComponent("/app/credits#pro")}`};
}

export type AskHandoffLinks = {
    /** The app's own scheme: opens the chat when the app is installed. */
    deepLink: string;
    /** The same place as an https link, on the site (the Talk page) until the app claims the path. */
    webLink: string;
};

/**
 * The two links that name a hand-off. Without an id yet (the beacon is
 * still in flight) they name the species alone, which the app can still open.
 */
export function askHandoffLinks(input: {slug: string; handoffId: string | null; siteUrl?: string}): AskHandoffLinks {
    const slug = encodeURIComponent(input.slug);
    const handoff = input.handoffId && isAskHandoffId(input.handoffId) ? input.handoffId : null;
    const query = handoff ? `&handoff=${handoff}` : "";
    const site = (input.siteUrl ?? "https://animaldex.app").replace(/\/$/, "");
    return {
        deepLink: `${ASK_HANDOFF_SCHEME_LINK}?species=${slug}${query}`,
        webLink: `${site}/talk/${slug}${handoff ? `?handoff=${handoff}` : ""}`
    };
}
