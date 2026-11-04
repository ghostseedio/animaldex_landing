/**
 * The browser half of the front-door funnel (lib/web-funnel): who this
 * visitor is to the hero test (their variant and random id, kept in the
 * first-touch cookie), and the steps they take, sent to /api/funnel.
 *
 * Only visitors who were shown the home hero are counted: every step waits
 * for an assignment. A tab that opened the hero with a `?hero=` override is
 * QA and sends nothing. Every step goes at most once per tab session; the
 * first and second message and the first reply at most once per visitor.
 * Browser-only; every call is a no-op on the server.
 */

import {
    firstTouchCookie,
    firstTouchFromLocation,
    firstTouchRemainingSeconds,
    isFunnelVisitorId,
    parseFirstTouch,
    withHeroAssignment,
    type FirstTouch
} from "@/lib/first-touch";
import {firstTouchCookieValue, isHeroVariant, type HeroVariant} from "@/lib/hero-variant";
import type {WebFunnelChipKind, WebFunnelEvent} from "@/lib/web-funnel";

export const WEB_FUNNEL_ENDPOINT = "/api/funnel";

/** The visitor's assignment when no cookie could keep it: this tab only. */
const SESSION_ASSIGNMENT_KEY = "animaldex:hero:assignment";
/** Set when this tab was shown a variant through `?hero=`: QA, never counted. */
const QA_KEY = "animaldex:hero:qa";
/** The steps this tab session already sent. */
const SENT_KEY = "animaldex:funnel:sent";
/** How many messages this visitor sent, and whether a reply came back. */
const MESSAGES_KEY = "animaldex:funnel:messages";

export type FunnelIdentity = {variant: HeroVariant; vid: string};

function inBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

function session(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function local(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function newVisitorId(): string {
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID().replace(/-/g, "") : "";
    if (isFunnelVisitorId(uuid)) return uuid;
    let id = "";
    while (id.length < 24) id += Math.random().toString(36).slice(2);
    return id.slice(0, 24);
}

function readTouch(): FirstTouch | null {
    return parseFirstTouch(firstTouchCookieValue(document.cookie));
}

/** Marks this tab as QA: the variant on screen came from `?hero=`, so nothing is counted. */
export function markHeroQaSession() {
    if (!inBrowser()) return;
    session()?.setItem(QA_KEY, "1");
}

/**
 * Keeps a newly drawn variant, with a visitor id, in the first-touch cookie:
 * added to the touch already there (keeping its expiry), or as the first
 * touch itself on a first visit. Returns the assignment in force, which is
 * the one already kept when there is one.
 */
export function keepHeroAssignment(variant: HeroVariant): FunnelIdentity | null {
    if (!inBrowser()) return null;
    const existing = readTouch();
    if (existing?.hero && existing.vid) return {variant: existing.hero, vid: existing.vid};
    const vid = existing?.vid ?? newVisitorId();
    const base = existing ?? firstTouchFromLocation(window.location.href, document.referrer);
    if (base) {
        const next = withHeroAssignment(base, variant, vid);
        document.cookie = firstTouchCookie(next, {secure: window.location.protocol === "https:", maxAgeSeconds: firstTouchRemainingSeconds(next)});
        const kept = readTouch();
        if (kept?.hero && kept.vid) return {variant: kept.hero, vid: kept.vid};
    }
    // No first touch to add it to (a later page of a visit whose cookie is
    // gone), or cookies are off: the assignment lasts for this tab.
    const identity: FunnelIdentity = {variant: existing?.hero ?? variant, vid};
    session()?.setItem(SESSION_ASSIGNMENT_KEY, JSON.stringify(identity));
    return identity;
}

/** The visitor's assignment, or null when they have none (never shown the hero) or this tab is QA. */
export function readFunnelIdentity(): FunnelIdentity | null {
    if (!inBrowser()) return null;
    const store = session();
    if (store?.getItem(QA_KEY)) return null;
    const touch = readTouch();
    if (touch?.hero && touch.vid) return {variant: touch.hero, vid: touch.vid};
    try {
        const kept = JSON.parse(store?.getItem(SESSION_ASSIGNMENT_KEY) ?? "null") as Partial<FunnelIdentity> | null;
        if (kept && isHeroVariant(kept.variant) && isFunnelVisitorId(kept.vid)) return {variant: kept.variant, vid: kept.vid};
    } catch {
        // A damaged entry is no assignment.
    }
    return null;
}

function sentThisSession(): string[] {
    try {
        const sent = JSON.parse(session()?.getItem(SENT_KEY) ?? "[]") as unknown;
        return Array.isArray(sent) ? sent.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
        return [];
    }
}

/** Sends one step of the funnel for this visitor, once per tab session. */
export function trackFunnel(event: Exclude<WebFunnelEvent, "signup">, options: {chipKind?: WebFunnelChipKind} = {}) {
    if (!inBrowser()) return;
    const identity = readFunnelIdentity();
    if (!identity || navigator.webdriver) return;
    const sent = sentThisSession();
    if (sent.includes(event)) return;
    try {
        session()?.setItem(SENT_KEY, JSON.stringify([...sent, event]));
    } catch {
        // Without session storage a step may be sent twice; the admin counts people, not events.
    }
    const body = JSON.stringify({
        event,
        variant: identity.variant,
        vid: identity.vid,
        chip_kind: options.chipKind ?? null,
        path: window.location.pathname
    });
    // A beacon outlives the page: a store tap or "Keep talking" navigates away at once.
    try {
        if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(WEB_FUNNEL_ENDPOINT, new Blob([body], {type: "application/json"}))) return;
    } catch {
        // Fall through to fetch.
    }
    void fetch(WEB_FUNNEL_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body, keepalive: true}).catch(() => undefined);
}

type MessageCounts = {vid: string; sent: number; replied: boolean};

function readCounts(vid: string): MessageCounts {
    try {
        const stored = JSON.parse(local()?.getItem(MESSAGES_KEY) ?? "null") as Partial<MessageCounts> | null;
        if (stored && stored.vid === vid && typeof stored.sent === "number") return {vid, sent: stored.sent, replied: stored.replied === true};
    } catch {
        // Start counting again.
    }
    return {vid, sent: 0, replied: false};
}

function writeCounts(counts: MessageCounts) {
    try {
        local()?.setItem(MESSAGES_KEY, JSON.stringify(counts));
    } catch {
        // Private mode: the steps are still sent once per tab session.
    }
}

/** A message to an animal: the visitor's first is `demo_start` (with what started it), the second `second_message`. */
export function noteFunnelMessage(chipKind: WebFunnelChipKind) {
    if (!inBrowser()) return;
    const identity = readFunnelIdentity();
    if (!identity) return;
    const counts = readCounts(identity.vid);
    counts.sent += 1;
    writeCounts(counts);
    if (counts.sent === 1) trackFunnel("demo_start", {chipKind});
    else if (counts.sent === 2) trackFunnel("second_message");
}

/** A reply from an animal: the first one after the first message is `demo_reply`. */
export function noteFunnelReply() {
    if (!inBrowser()) return;
    const identity = readFunnelIdentity();
    if (!identity) return;
    const counts = readCounts(identity.vid);
    if (counts.replied || counts.sent < 1) return;
    writeCounts({...counts, replied: true});
    trackFunnel("demo_reply");
}

const STORE_HREF = /^https:\/\/(apps\.apple\.com|play\.google\.com)\//;

/** Every tap through to a store, from any link on the page: `store_click`. Returns the cleanup. */
export function listenForStoreClicks(): () => void {
    if (!inBrowser()) return () => undefined;
    const onClick = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (target instanceof HTMLAnchorElement && STORE_HREF.test(target.href)) trackFunnel("store_click");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("auxclick", onClick, true);
    };
}
