import "server-only";

/**
 * Writes front-door funnel steps (lib/web-funnel) to `web_funnel_events`
 * with the service role. The visitor's random id never reaches the table:
 * only an HMAC of it, keyed by `WEB_FUNNEL_SALT` (a fixed key when unset).
 *
 * Off with `WEB_FUNNEL_EVENTS=off`. Outside production it logs instead of
 * writing (`WEB_FUNNEL_RECORD_IN_DEV=1` writes), so a dev server pointed at
 * the production project never adds test clicks to the experiment. Before
 * the migration (20261104180000) a write reports `missing_table` and the
 * site carries on.
 */

import {createHmac} from "node:crypto";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {parseFirstTouch} from "@/lib/first-touch";
import type {HeroVariant} from "@/lib/hero-variant";
import {funnelPath, type WebFunnelChipKind, type WebFunnelEvent} from "@/lib/web-funnel";

const DEFAULT_SALT = "animaldex-web-funnel-v1";

export function hashFunnelVisitor(visitorId: string): string {
    const salt = process.env.WEB_FUNNEL_SALT?.trim() || DEFAULT_SALT;
    return createHmac("sha256", salt).update(visitorId).digest("hex");
}

export type WebFunnelRecording = "on" | "off" | "log";

export function webFunnelRecording(): WebFunnelRecording {
    if (process.env.WEB_FUNNEL_EVENTS?.trim().toLowerCase() === "off") return "off";
    if (process.env.NODE_ENV !== "production" && process.env.WEB_FUNNEL_RECORD_IN_DEV !== "1") return "log";
    return "on";
}

export type WebFunnelWrite = {
    event: WebFunnelEvent;
    variant: HeroVariant;
    visitorId: string;
    chipKind: WebFunnelChipKind | null;
    path: string | null;
};

export type WebFunnelWriteResult = {recorded: boolean; reason?: "off" | "log" | "unconfigured" | "missing_table" | "failed"};

let missingTableLogged = false;

export async function recordWebFunnelEvent(write: WebFunnelWrite): Promise<WebFunnelWriteResult> {
    const mode = webFunnelRecording();
    if (mode === "off") return {recorded: false, reason: "off"};
    const row = {
        visitor_hash: hashFunnelVisitor(write.visitorId),
        event: write.event,
        variant: write.variant,
        chip_kind: write.chipKind,
        path: write.path
    };
    if (mode === "log") {
        console.info("[web-funnel] not written outside production", {...row, visitor_hash: `${row.visitor_hash.slice(0, 8)}…`});
        return {recorded: false, reason: "log"};
    }
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return {recorded: false, reason: "unconfigured"};
    try {
        const response = await fetch(`${url}/rest/v1/web_funnel_events`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Prefer: "return=minimal"}),
            body: JSON.stringify(row),
            cache: "no-store"
        });
        if (response.ok) return {recorded: true};
        const text = await response.text().catch(() => "");
        if (/PGRST205|42P01/.test(text)) {
            if (!missingTableLogged) console.warn("[web-funnel] web_funnel_events is missing: apply landing migration 20261104180000");
            missingTableLogged = true;
            return {recorded: false, reason: "missing_table"};
        }
        console.warn("[web-funnel] write failed", response.status, text.slice(0, 200));
        return {recorded: false, reason: "failed"};
    } catch (error) {
        console.warn("[web-funnel] write failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return {recorded: false, reason: "failed"};
    }
}

/** An account this new, at the sign-in callback, was just made there. */
const NEW_ACCOUNT_MS = 30 * 60 * 1000;

/**
 * `signup`: the sign-in callback calls this with the first-touch cookie and
 * the account. Counted only for a visitor in the hero test and only for an
 * account made in the last half hour (a returning sign-in is not a signup).
 * Not awaited: the person's redirect never waits on analytics.
 */
export function recordWebFunnelSignup(input: {firstTouchCookie: string | null | undefined; accountCreatedAt: string | null | undefined; path: string}) {
    const touch = parseFirstTouch(input.firstTouchCookie);
    if (!touch?.hero || !touch.vid) return;
    const created = Date.parse(input.accountCreatedAt ?? "");
    if (!Number.isFinite(created) || Date.now() - created > NEW_ACCOUNT_MS) return;
    void recordWebFunnelEvent({event: "signup", variant: touch.hero, visitorId: touch.vid, chipKind: null, path: funnelPath(input.path)}).catch(() => undefined);
}
