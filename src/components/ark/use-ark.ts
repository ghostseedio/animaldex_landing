"use client";

/**
 * Life Sim in the browser (docs/life-sim/CONTRACT.md): the calls behind the
 * revision cards, the Diary's Undo and Public/Private switch, and the
 * reader's display currency. The server is the authority: these only say
 * what it answered, and every caller puts back what it showed on a failure.
 */

import {useEffect, useState} from "react";
import {
    CURRENCY_PREFERENCE_COOKIE,
    formatDisplayMoney,
    isSupportedCurrency,
    resolveDisplayCurrency
} from "@/lib/account-settings";
import {systemCurrencyFor} from "@/lib/request-country";
import {
    arkProblemCode,
    decodeArkChange,
    decodeArkChanges,
    decodeArkStats,
    type ArkChange,
    type ArkDiaryVisibility,
    type ArkProblemCode,
    type ArkStats
} from "@/lib/ark";

export type ArkCallResult<T> = {ok: true; value: T} | {ok: false; code: ArkProblemCode};

async function post(body: Record<string, unknown>): Promise<{ok: true; payload: Record<string, unknown>} | {ok: false; code: ArkProblemCode}> {
    try {
        const response = await fetch("/api/app/ark", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok || payload?.ok !== true) return {ok: false, code: arkProblemCode(payload?.code)};
        return {ok: true, payload};
    } catch {
        return {ok: false, code: "ark_unavailable"};
    }
}

/** The ledger for one animal (or all), newest first; null when it could not be read (an old server included). */
export async function fetchArkChanges(params: {speciesProfileId?: string | null; since?: string | null; limit?: number} = {}): Promise<ArkChange[] | null> {
    const query = new URLSearchParams({view: "changes"});
    if (params.speciesProfileId) query.set("speciesProfileId", params.speciesProfileId);
    if (params.since) query.set("since", params.since);
    if (params.limit) query.set("limit", String(params.limit));
    try {
        const response = await fetch(`/api/app/ark?${query}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        const payload = response.ok ? await response.json() as {changes?: unknown; available?: boolean} : null;
        if (!payload || payload.available === false) return null;
        return decodeArkChanges(payload.changes);
    } catch {
        return null;
    }
}

export async function fetchArkStats(userId?: string | null): Promise<ArkStats | null> {
    const query = new URLSearchParams({view: "stats"});
    if (userId) query.set("userId", userId);
    try {
        const response = await fetch(`/api/app/ark?${query}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        const payload = response.ok ? await response.json() as {stats?: unknown} : null;
        return payload ? decodeArkStats(payload.stats) : null;
    } catch {
        return null;
    }
}

/** Undo a revision (never a reveal): the undone change as the server now holds it. */
export async function undoArkRevision(changeId: string): Promise<ArkCallResult<ArkChange | null>> {
    const result = await post({action: "undo", changeId});
    return result.ok ? {ok: true, value: decodeArkChange(result.payload.change)} : result;
}

export async function setDiaryVisibility(visibility: ArkDiaryVisibility): Promise<ArkCallResult<ArkDiaryVisibility>> {
    const result = await post({action: "visibility", visibility});
    return result.ok ? {ok: true, value: visibility} : result;
}

function readCurrencyCookie(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CURRENCY_PREFERENCE_COOKIE}=`));
    if (!match) return null;
    try {
        return decodeURIComponent(match.slice(CURRENCY_PREFERENCE_COOKIE.length + 1));
    } catch {
        return null;
    }
}

const GEO_CURRENCY_KEY = "animaldex-geo-currency";

/** The "System" currency the server worked out from Cloudflare's country (`/api/geo`), once per tab session. */
async function geoSystemCurrency(): Promise<string | null> {
    try {
        const cached = window.sessionStorage.getItem(GEO_CURRENCY_KEY);
        if (cached) return cached === "-" ? null : cached;
    } catch {
        // Storage blocked: ask the server every time.
    }
    try {
        const response = await fetch("/api/geo", {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const payload = await response.json().catch(() => null) as {currency?: unknown} | null;
        const currency = typeof payload?.currency === "string" ? payload.currency : null;
        try {
            window.sessionStorage.setItem(GEO_CURRENCY_KEY, currency ?? "-");
        } catch {
            // Not remembered; harmless.
        }
        return currency;
    } catch {
        return null;
    }
}

/**
 * The reader's display currency (Settings → Currency, else the visitor's
 * country, else the browser's region, else USD), as the server pages resolve
 * it. `initial` is the server's answer when the page has one; otherwise the
 * browser's languages give a first answer and `/api/geo` (Cloudflare's
 * country) the final one, so a cached page agrees with the server.
 */
export function useDisplayCurrency(initial?: string | null): string {
    const [currency, setCurrency] = useState(() => initial ?? "USD");
    useEffect(() => {
        if (initial) return;
        const preference = readCurrencyCookie() ?? "system";
        const languages = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
        setCurrency(resolveDisplayCurrency(preference, systemCurrencyFor({languages})));
        // An explicit choice in Settings (even USD) wins; nothing to ask the server.
        if (isSupportedCurrency(preference)) return;
        let live = true;
        void geoSystemCurrency().then((system) => {
            if (live && system) setCurrency(resolveDisplayCurrency(preference, system));
        });
        return () => {
            live = false;
        };
    }, [initial]);
    return currency;
}

/** Cents in the display currency ("£1,140"). */
export function arkMoneyFormatter(currency: string, locale?: string): (usd: number) => string {
    return (usd: number) => formatDisplayMoney(usd, currency, locale);
}
