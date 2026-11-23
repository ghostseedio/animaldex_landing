/**
 * Gifts as Ark care on the /ark tap card (AnimalDex GIFTS-CARE, owner decision 387; AnimalDex docs/ark/gifts-care.md).
 * A gift sent from a card is a meal, shelter or nesting help for the living animal that card brought aboard: no XP, no
 * stats, no rank. The server decides everything (`ark_animal_care_v1`, behind its `gift_care` switch, off by default):
 * what was given in the last week, by whom as the viewer may see it (the card's owner sees @usernames, a sender sees
 * "you" on their own, anyone else "a visitor"), and what the viewer could give now. This only reads and says it.
 *
 * Lazy with the card block (`ark-card-care.tsx`): never in /ark's static JavaScript.
 */

import {fillArkWords} from "@/lib/ark-words";

export type ArkCareKind = "meal" | "shelter" | "nest";

export type ArkCareItem = {
    care: ArkCareKind;
    state: "queued" | "applied";
    sentAt: number;
    untilAt: number | null;
    usedAt: number | null;
    byYou: boolean;
    byUsername: string | null;
};

export type ArkCareOffer = {id: string; care: ArkCareKind; cost: number; available: boolean; reason: string | null; realDays: number | null};

export type ArkCare = {
    /** The card that brought it aboard (where a gift is sent), or null (born aboard, a card traded or gone). */
    card: string | null;
    /** The viewer owns it: they see who gave, and give nothing to their own animal. */
    mine: boolean;
    items: ArkCareItem[];
    /** What the viewer could give now (signed in, not theirs); empty otherwise. */
    offers: ArkCareOffer[];
};

export type ArkCareWords = {
    title: string;
    meal: string;
    shelter: string;
    nest: string;
    fedBy: string;
    shelteredBy: string;
    nestBy: string;
    you: string;
    aVisitor: string;
    fuller: string;
    safe: string;
    helping: string;
    stoppedHunt: string;
    nestUsed: string;
    onItsWay: string;
    mealDoes: string;
    shelterDoes: string;
    nestDoes: string;
    credits: string;
    send: string;
    cancel: string;
    sent: string;
    noCredits: string;
    notNow: string;
    limit: string;
    tooNew: string;
    failed: string;
};

export const ARK_CARE_ENGLISH: ArkCareWords = {
    title: "Care from visitors",
    meal: "A meal",
    shelter: "Shelter",
    nest: "Nesting help",
    fedBy: "Fed by {who}",
    shelteredBy: "Sheltered by {who}",
    nestBy: "Nesting help from {who}",
    you: "you",
    aVisitor: "a visitor",
    fuller: "fuller for {time}",
    safe: "safe for {time}",
    helping: "helping for {time}",
    stoppedHunt: "it stopped a hunt",
    nestUsed: "it helped with young",
    onItsWay: "on its way",
    mealDoes: "Fuller for {time}",
    shelterDoes: "Safe from one hunt for {time}",
    nestDoes: "A better chance of young for {time}",
    credits: "{n} Credits",
    send: "Send for {n} Credits",
    cancel: "Cancel",
    sent: "Sent. If it can't help, your Credits come back.",
    noCredits: "You need more Credits for this.",
    notNow: "Not possible right now.",
    limit: "You've given the most care for today.",
    tooNew: "Care opens once your account is a week old and has a card.",
    failed: "Couldn't send. Try again."
};

/** The reader's words over English (any key a bundle lacks). */
export function arkCareWords(words: Partial<ArkCareWords> | null | undefined): ArkCareWords {
    const out = {...ARK_CARE_ENGLISH};
    for (const key of Object.keys(out) as Array<keyof ArkCareWords>) {
        const value = words?.[key];
        if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
}

const KINDS = new Set<ArkCareKind>(["meal", "shelter", "nest"]);
const CARE_SLUG: Record<string, ArkCareKind> = {ark_meal: "meal", ark_shelter: "shelter", ark_nest: "nest"};
const time = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const USERNAME = /^[A-Za-z0-9._-]{1,40}$/;

/** `/api/ark/care`'s body, read; null while the switch is off (nothing shows). */
export function parseArkCare(json: unknown): ArkCare | null {
    const body = json as {care?: unknown} | null;
    const raw = body && typeof body === "object" ? (body.care as Record<string, unknown> | null) : null;
    if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;
    const items: ArkCareItem[] = [];
    for (const row of Array.isArray(raw.care) ? (raw.care as Array<Record<string, unknown>>) : []) {
        const care = row?.care as ArkCareKind;
        const state = row?.state;
        const sentAt = time(row?.sent_at);
        if (!KINDS.has(care) || (state !== "queued" && state !== "applied") || !Number.isFinite(sentAt)) continue;
        const untilAt = time(row.until_at);
        const usedAt = time(row.used_at);
        const username = typeof row.by_username === "string" && USERNAME.test(row.by_username) ? row.by_username : null;
        items.push({care, state, sentAt, untilAt: Number.isFinite(untilAt) ? untilAt : null, usedAt: Number.isFinite(usedAt) ? usedAt : null, byYou: row.by_you === true, byUsername: username});
    }
    const catalog = raw.catalog as {enabled?: unknown; definitions?: unknown} | null | undefined;
    const offers: ArkCareOffer[] = [];
    if (catalog && catalog.enabled === true && Array.isArray(catalog.definitions)) {
        for (const d of catalog.definitions as Array<Record<string, unknown>>) {
            const care = (KINDS.has(d?.care_kind as ArkCareKind) ? d.care_kind : CARE_SLUG[String(d?.slug ?? "")]) as ArkCareKind | undefined;
            const id = typeof d?.id === "string" ? d.id : "";
            const cost = Number(d?.credit_cost);
            if (!care || !id || !Number.isFinite(cost) || cost <= 0) continue;
            const days = Number((d.effect as {real_days?: unknown} | null | undefined)?.real_days);
            offers.push({id, care, cost: Math.round(cost), available: d.available === true, reason: typeof d.reason === "string" ? d.reason : null, realDays: Number.isFinite(days) && days > 0 ? days : null});
        }
    }
    return {card: typeof raw.card === "string" ? raw.card : null, mine: raw.mine === true, items, offers};
}

/** A span of time in the reader's language ("2 days", "5 hours"), by the browser's own unit names. */
export function arkCareSpan(ms: number, locale: string): string {
    const hours = Math.max(1, Math.round(ms / 3_600_000));
    const [value, unit] = hours >= 24 ? [Math.round(hours / 24), "day"] : [hours, "hour"];
    try {
        return new Intl.NumberFormat(locale, {style: "unit", unit, unitDisplay: "long"}).format(value);
    } catch {
        return `${value} ${unit}${value === 1 ? "" : "s"}`;
    }
}

/** One care line: "Fed by @ada · fuller for 2 days", "Sheltered by you · it stopped a hunt", "Nesting help from a visitor · on its way". */
export function arkCareLine(item: ArkCareItem, words: ArkCareWords, locale: string, now: number): string {
    const who = item.byYou ? words.you : item.byUsername ? `@${item.byUsername}` : words.aVisitor;
    const head = fillArkWords(item.care === "meal" ? words.fedBy : item.care === "shelter" ? words.shelteredBy : words.nestBy, {who});
    let tail: string | null = null;
    if (item.state === "queued") tail = words.onItsWay;
    else if (item.usedAt !== null) tail = item.care === "shelter" ? words.stoppedHunt : item.care === "nest" ? words.nestUsed : null;
    else if (item.untilAt !== null && item.untilAt > now) tail = fillArkWords(item.care === "meal" ? words.fuller : item.care === "shelter" ? words.safe : words.helping, {time: arkCareSpan(item.untilAt - now, locale)});
    return tail ? `${head} · ${tail}` : head;
}

/** The lines to show, newest first: what is still working or waiting, then what was used, at most `max`. */
export function arkCareLines(care: ArkCare, words: ArkCareWords, locale: string, now: number, max = 3): string[] {
    const live = (i: ArkCareItem) => i.state === "queued" || i.usedAt !== null || (i.untilAt !== null && i.untilAt > now);
    return care.items.filter(live).sort((a, b) => b.sentAt - a.sentAt).slice(0, max).map((i) => arkCareLine(i, words, locale, now));
}

/** What a gift does, for its button: "Fuller for 20 days", "Safe from one hunt for 1 day". */
export function arkCareDoes(offer: ArkCareOffer, words: ArkCareWords, locale: string): string {
    const days = offer.realDays ?? (offer.care === "shelter" ? 1 : offer.care === "nest" ? 3 : null);
    const span = days !== null ? arkCareSpan(days * 86_400_000, locale) : "";
    const template = offer.care === "meal" ? words.mealDoes : offer.care === "shelter" ? words.shelterDoes : words.nestDoes;
    return span ? fillArkWords(template, {time: span}) : words[offer.care];
}

/** A failed send in the reader's words (the server's codes, `send_capture_gift_v2`). */
export function arkCareError(raw: string | null | undefined, words: ArkCareWords): string {
    const text = (raw ?? "").toLowerCase();
    if (text.includes("insufficient_credits")) return words.noCredits;
    if (text.includes("gift_rate_limited")) return words.limit;
    if (text.includes("gift_account_too_new")) return words.tooNew;
    if (text.includes("gift_not_available") || text.includes("self_gift") || text.includes("users_blocked") || text.includes("capture_not_giftable")) return words.notNow;
    return words.failed;
}
