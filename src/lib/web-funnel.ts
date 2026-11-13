/**
 * The front-door funnel (Nov 2026): what a visitor who saw the home hero did
 * next, by hero variant (lib/hero-variant). The browser reports each step to
 * /api/funnel, which keeps it in `web_funnel_events` (landing migration
 * 20261104180000) under a hash of the visitor's random id; /admin/metrics
 * reads it back as one funnel per variant.
 *
 * - hero_view: the home hero was shown.
 * - demo_start: the visitor's first message to an animal (a hero chip, or
 *   their own words in a chat), with what started it.
 * - demo_reply: the first reply they got.
 * - second_message: their second message.
 * - share_take: they shared an animal's take.
 * - signup: they made an account on the web (recorded by the server).
 * - store_click: they tapped through to the App Store or Google Play.
 * - store_click_ask_limit: that tap was the Ask limit panel's "Keep talking
 *   in the app, free" (CC 2, Nov 2026; landing migration 20261113180000
 *   widens the table's check). It is sent alongside store_click, so the
 *   store_click step is unchanged.
 *
 * Pure, so the request rules and the counting are tested.
 */

import type {HeroVariant} from "@/lib/hero-variant";

export const WEB_FUNNEL_EVENTS = ["hero_view", "demo_start", "demo_reply", "second_message", "share_take", "signup", "store_click", "store_click_ask_limit"] as const;
export type WebFunnelEvent = (typeof WEB_FUNNEL_EVENTS)[number];

/**
 * What started a conversation: one of the hero's idea chips, its problem
 * chip, the visitor's own words, or a suggestion the chat offered.
 */
export const WEB_FUNNEL_CHIP_KINDS = ["idea", "problem", "typed", "suggested"] as const;
export type WebFunnelChipKind = (typeof WEB_FUNNEL_CHIP_KINDS)[number];

export const WEB_FUNNEL_PATH_MAX = 300;

export function isWebFunnelEvent(value: unknown): value is WebFunnelEvent {
    return typeof value === "string" && (WEB_FUNNEL_EVENTS as readonly string[]).includes(value);
}

export function isWebFunnelChipKind(value: unknown): value is WebFunnelChipKind {
    return typeof value === "string" && (WEB_FUNNEL_CHIP_KINDS as readonly string[]).includes(value);
}

const VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** The page an event happened on: its path alone, never a query or a fragment. */
export function funnelPath(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const path = raw.split(/[?#]/)[0].replace(/[\u0000-\u001f]/g, "").trim();
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    return path.slice(0, WEB_FUNNEL_PATH_MAX);
}

export type WebFunnelReport = {
    event: WebFunnelEvent;
    variant: HeroVariant;
    visitorId: string;
    chipKind: WebFunnelChipKind | null;
    path: string | null;
};

/** One reported step as the browser sent it, or null when anything about it is off. */
export function normalizeWebFunnelReport(raw: unknown): WebFunnelReport | null {
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!body) return null;
    if (!isWebFunnelEvent(body.event) || body.event === "signup") return null;
    if (body.variant !== "a" && body.variant !== "b") return null;
    if (typeof body.vid !== "string" || !VISITOR_ID.test(body.vid)) return null;
    const chipKind = body.event === "demo_start" && isWebFunnelChipKind(body.chip_kind) ? body.chip_kind : null;
    return {event: body.event, variant: body.variant, visitorId: body.vid, chipKind, path: funnelPath(body.path)};
}

/** Crawlers, link previews and headless browsers: never part of the test. */
const NON_HUMAN_AGENT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|phantom|python|curl|wget|httpclient|okhttp|go-http|axios|node-fetch/i;

export function isNonHumanAgent(userAgent: string | null | undefined): boolean {
    const agent = (userAgent ?? "").trim();
    return !agent || NON_HUMAN_AGENT.test(agent);
}

// MARK: - The admin's funnel

/** A stored row, as /admin/metrics reads it. */
export type WebFunnelRow = {
    visitor_hash: string;
    event: string;
    variant: string;
    chip_kind: string | null;
    created_at: string;
};

export type WebFunnelStep = {
    event: Exclude<WebFunnelEvent, "hero_view">;
    /** Visitors who did it after seeing that variant's hero. */
    visitors: number;
    /** Of the visitors who saw the hero, in percent; null with none. */
    rate: number | null;
};

export type WebFunnelVariant = {
    variant: HeroVariant;
    /** Visitors shown this hero in the range. */
    viewers: number;
    steps: WebFunnelStep[];
    /** What started the first messages: idea chips, the problem chip, their own words, a suggestion. */
    starts: Record<WebFunnelChipKind, number>;
    /** Shares per visitor who got a reply, in percent. */
    shareOfReplies: number | null;
};

export type WebFunnelSummary = {
    variants: WebFunnelVariant[];
    /** B's demo starts per viewer over A's: the test's headline number. */
    demoStartLift: number | null;
};

const STEP_EVENTS = WEB_FUNNEL_EVENTS.filter((event): event is Exclude<WebFunnelEvent, "hero_view"> => event !== "hero_view");

function percent(part: number, whole: number): number | null {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/**
 * One funnel per variant, counted in people, not events. A visitor belongs to
 * the variant of the first hero they were shown in the range, and only what
 * they did after that counts, so a step a visitor took on another page before
 * ever seeing the hero (or under the other variant, after a QA override)
 * never inflates either side.
 */
export function summarizeWebFunnel(rows: WebFunnelRow[]): WebFunnelSummary {
    const ordered = [...rows]
        .filter((row) => row.visitor_hash && isWebFunnelEvent(row.event) && (row.variant === "a" || row.variant === "b"))
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const viewers = new Map<string, {variant: HeroVariant; at: number}>();
    for (const row of ordered) {
        if (row.event !== "hero_view" || viewers.has(row.visitor_hash)) continue;
        viewers.set(row.visitor_hash, {variant: row.variant as HeroVariant, at: Date.parse(row.created_at)});
    }

    const did = new Map<string, Set<string>>();
    const firstStart = new Map<string, WebFunnelChipKind>();
    for (const row of ordered) {
        const viewer = viewers.get(row.visitor_hash);
        if (!viewer || row.event === "hero_view" || Date.parse(row.created_at) < viewer.at) continue;
        const key = `${viewer.variant}|${row.event}`;
        const people = did.get(key) ?? new Set<string>();
        people.add(row.visitor_hash);
        did.set(key, people);
        if (row.event === "demo_start" && !firstStart.has(row.visitor_hash)) {
            firstStart.set(row.visitor_hash, isWebFunnelChipKind(row.chip_kind) ? row.chip_kind : "typed");
        }
    }

    const variants: WebFunnelVariant[] = (["a", "b"] as const).map((variant) => {
        const viewerCount = Array.from(viewers.values()).filter((viewer) => viewer.variant === variant).length;
        const count = (event: WebFunnelEvent) => did.get(`${variant}|${event}`)?.size ?? 0;
        const starts: Record<WebFunnelChipKind, number> = {idea: 0, problem: 0, typed: 0, suggested: 0};
        firstStart.forEach((kind, visitor) => {
            if (viewers.get(visitor)?.variant === variant) starts[kind] += 1;
        });
        return {
            variant,
            viewers: viewerCount,
            steps: STEP_EVENTS.map((event) => ({event, visitors: count(event), rate: percent(count(event), viewerCount)})),
            starts,
            shareOfReplies: percent(count("share_take"), count("demo_reply"))
        };
    });

    const startRate = (variant: WebFunnelVariant) => variant.steps.find((step) => step.event === "demo_start")?.rate ?? null;
    const a = startRate(variants[0]);
    const b = startRate(variants[1]);
    return {variants, demoStartLift: a && b !== null ? Math.round((b / a) * 100) / 100 : null};
}
