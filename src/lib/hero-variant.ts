/**
 * The home hero A/B test (Nov 2026 front door): A is the hero the page had
 * (the talking octopus and its orbit), B the split card ("The usual answer"
 * beside "Your lion's take", streamed live on a chip tap).
 *
 * The home page is a static ISR page, so the server cannot pick a variant per
 * visitor. Both heroes are in the HTML; a tiny script before them reads the
 * visitor's variant from the first-touch cookie (`adx_ft`), or draws one, and
 * sets `data-hero` on <html> before the first paint, so CSS shows one hero
 * and the other never flashes. A client navigation to the home page runs no
 * inline script; `resolveHeroAssignment` is the same rule for that path.
 *
 * The draw is 50/50 unless `HERO_VARIANT_SPLIT` (0-100, the share of new
 * visitors who get B) says otherwise, and `?hero=a|b` shows one variant for
 * QA without touching the visitor's own assignment (and without counting).
 *
 * Pure, so the rule and the script are tested.
 */

import {FIRST_TOUCH_COOKIE} from "@/lib/first-touch";

export const HERO_VARIANTS = ["a", "b"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

/** The attribute the boot script sets on <html>; globals.css hides the other arm. */
export const HERO_VARIANT_ATTRIBUTE = "data-hero";
/** The attribute each arm of the hero carries. */
export const HERO_ARM_ATTRIBUTE = "data-hero-arm";
/** `?hero=a` or `?hero=b`: show that variant, for QA. */
export const HERO_VARIANT_QUERY = "hero";
/** The share of new visitors who get B when the environment says nothing. */
export const DEFAULT_HERO_SPLIT = 50;

export function isHeroVariant(value: unknown): value is HeroVariant {
    return value === "a" || value === "b";
}

/** `HERO_VARIANT_SPLIT` as a whole percentage, 0-100; anything else is the default. */
export function heroVariantSplit(raw: string | null | undefined): number {
    const text = (raw ?? "").trim();
    if (!/^\d{1,3}(\.\d+)?$/.test(text)) return DEFAULT_HERO_SPLIT;
    const value = Math.round(Number(text));
    return value >= 0 && value <= 100 ? value : DEFAULT_HERO_SPLIT;
}

/** The QA override in a query string, or null. */
export function heroVariantFromQuery(search: string | null | undefined): HeroVariant | null {
    const match = /[?&]hero=([ab])(?:&|#|$)/.exec(search ?? "");
    return match && isHeroVariant(match[1]) ? match[1] : null;
}

/** A new visitor's draw: B when `random` (0 to 1) falls inside the split. */
export function pickHeroVariant(splitB: number, random: number): HeroVariant {
    return random * 100 < splitB ? "b" : "a";
}

/** The variant already kept in the first-touch cookie's raw value, if any. */
export function heroVariantFromCookieValue(raw: string | null | undefined): HeroVariant | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as {hero?: unknown} | null;
        return parsed && isHeroVariant(parsed.hero) ? parsed.hero : null;
    } catch {
        return null;
    }
}

/** The first-touch cookie's raw value out of `document.cookie`. */
export function firstTouchCookieValue(cookieHeader: string | null | undefined): string | null {
    const match = new RegExp(`(?:^|;\\s*)${FIRST_TOUCH_COOKIE}=([^;]*)`).exec(cookieHeader ?? "");
    return match ? match[1] : null;
}

export type HeroAssignment = {
    /** The visitor's own variant: kept, or drawn now. */
    variant: HeroVariant;
    /** Drawn on this view, so it still has to be kept in the cookie. */
    assigned: boolean;
    /** The QA override shown instead, when the address asks for one. */
    override: HeroVariant | null;
};

/** Which hero this view shows, and whether the visitor's variant is new. The boot script's rule. */
export function resolveHeroAssignment(input: {search: string; cookie: string | null | undefined; splitB: number; random: number}): HeroAssignment {
    const kept = heroVariantFromCookieValue(firstTouchCookieValue(input.cookie));
    return {
        variant: kept ?? pickHeroVariant(input.splitB, input.random),
        assigned: kept === null,
        override: heroVariantFromQuery(input.search)
    };
}

/** What the page shows: the override when there is one, else the visitor's variant. */
export function shownHeroVariant(assignment: HeroAssignment): HeroVariant {
    return assignment.override ?? assignment.variant;
}

/** The boot script's result, left on `window` for the hero's client half. */
export const HERO_BOOT_GLOBAL = "__adxHero";

/**
 * Runs inline before the hero markup on a full page load. Same rule as
 * `resolveHeroAssignment`; it never writes the cookie (the first-touch
 * record is the client half's to write, with the landing page in it).
 */
export function heroBootScript(splitB: number): string {
    const split = Math.min(100, Math.max(0, Math.round(splitB)));
    return `(function(){try{var d=document.documentElement,q=/[?&]hero=([ab])(?:&|#|$)/.exec(location.search),v=null,m=/(?:^|;\\s*)${FIRST_TOUCH_COOKIE}=([^;]*)/.exec(document.cookie);if(m){try{var t=JSON.parse(decodeURIComponent(m[1]));if(t&&(t.hero==="a"||t.hero==="b"))v=t.hero}catch(e){}}var n=!v;if(n)v=Math.random()*100<${split}?"b":"a";window.${HERO_BOOT_GLOBAL}={variant:v,assigned:n,override:q?q[1]:null};d.setAttribute("${HERO_VARIANT_ATTRIBUTE}",q?q[1]:v)}catch(e){}})()`;
}
