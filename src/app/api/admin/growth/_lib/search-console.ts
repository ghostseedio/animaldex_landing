import "server-only";
import {createSign} from "node:crypto";

// Google clicks per day from Search Console, read with a service account that
// has been added as a user on the property. Days are Pacific time (Search
// Console's own). Data trails by a day or two; `through` is the last day it
// has, so newer days read as pending rather than zero.
//
//   GOOGLE_SEARCH_CONSOLE_CREDENTIALS  the service account's JSON key (raw or base64)
//   GOOGLE_SEARCH_CONSOLE_SITE         optional; defaults to sc-domain:animaldex.app

export type SearchClicks = {byDate: Record<string, number>; through: string | null; note?: string};

const env = (name: string) => process.env[name]?.trim() || "";

type ServiceAccount = {client_email: string; private_key: string};

function credentials(): ServiceAccount | null {
    const raw = env("GOOGLE_SEARCH_CONSOLE_CREDENTIALS");
    if (!raw) return null;
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(text) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) throw new Error("GOOGLE_SEARCH_CONSOLE_CREDENTIALS is not a service account key");
    return {client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n")};
}

let token: {value: string; expiresAt: number} | null = null;

async function accessToken(account: ServiceAccount) {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({alg: "RS256", typ: "JWT"})}.${encode({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}`}),
        cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error_description ?? `Google token exchange returned ${response.status}`);
    token = {value: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000};
    return token.value;
}

const cache = new Map<string, {at: number; value: SearchClicks}>();

export async function loadSearchClicks(startDate: string, endDate: string): Promise<SearchClicks> {
    let account: ServiceAccount | null;
    try {
        account = credentials();
    } catch (error) {
        return {byDate: {}, through: null, note: `Google clicks: ${error instanceof Error ? error.message : "bad credentials"}`};
    }
    if (!account) return {byDate: {}, through: null, note: "Google clicks: Search Console isn't connected (GOOGLE_SEARCH_CONSOLE_CREDENTIALS)"};
    const key = `${startDate}|${endDate}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value;
    try {
        const site = env("GOOGLE_SEARCH_CONSOLE_SITE") || "sc-domain:animaldex.app";
        const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
            method: "POST",
            headers: {Authorization: `Bearer ${await accessToken(account)}`, "Content-Type": "application/json"},
            // "all" includes the fresh, not-yet-final days.
            body: JSON.stringify({startDate, endDate, dimensions: ["date"], dataState: "all", rowLimit: 1000}),
            cache: "no-store"
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message ?? `Search Console returned ${response.status}`);
        const byDate: Record<string, number> = {};
        for (const row of body.rows ?? []) if (typeof row?.keys?.[0] === "string") byDate[row.keys[0]] = Math.round(Number(row.clicks) || 0);
        const dates = Object.keys(byDate).sort();
        const value: SearchClicks = {byDate, through: dates[dates.length - 1] ?? null};
        cache.set(key, {at: Date.now(), value});
        return value;
    } catch (error) {
        return {byDate: {}, through: null, note: `Google clicks: ${error instanceof Error ? error.message : "Search Console unavailable"}`};
    }
}

export type RisingQuery = {query: string; impressions: number; previous: number; position: number; clicks: number};

async function queryRows(account: ServiceAccount, startDate: string, endDate: string) {
    const site = env("GOOGLE_SEARCH_CONSOLE_SITE") || "sc-domain:animaldex.app";
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: "POST",
        headers: {Authorization: `Bearer ${await accessToken(account)}`, "Content-Type": "application/json"},
        body: JSON.stringify({startDate, endDate, dimensions: ["query"], dataState: "all", rowLimit: 2000}),
        cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message ?? `Search Console returned ${response.status}`);
    return (body.rows ?? []) as Array<{keys: string[]; clicks: number; impressions: number; position: number}>;
}

/**
 * Queries the site is gaining impressions on (last 7 days vs the 7 before),
 * still below the top 3: what searchers want from us now. For the trend radar.
 */
export async function loadRisingQueries(limit = 40): Promise<RisingQuery[]> {
    const account = credentials();
    if (!account) return [];
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const [recent, before] = await Promise.all([queryRows(account, day(8), day(2)), queryRows(account, day(15), day(9))]);
    const previous = new Map(before.map((row) => [row.keys[0], row.impressions]));
    return recent
        .map((row) => ({query: row.keys[0], impressions: row.impressions, previous: previous.get(row.keys[0]) ?? 0, position: Math.round(row.position * 10) / 10, clicks: row.clicks}))
        .filter((row) => row.impressions >= 30 && row.position > 3 && row.position <= 30 && row.impressions >= row.previous * 1.5)
        .sort((a, b) => (b.impressions - b.previous) - (a.impressions - a.previous))
        .slice(0, limit);
}
