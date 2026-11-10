import "server-only";

/**
 * Writes the website's Ark events (lib/ark-measure) to `web_ark_events` with
 * the service role. No account or visitor id goes with them.
 *
 * Off with `WEB_ARK_EVENTS=off`. Outside production it logs instead of
 * writing (`WEB_ARK_EVENTS_RECORD_IN_DEV=1` writes), as the hero funnel does,
 * so a dev server pointed at the production project never adds test opens to
 * the dashboard. Before landing migration 20261110130000 a write reports
 * `missing_table` and the site carries on.
 */

import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {arkMeasureRow, type ArkMeasureReport} from "@/lib/ark-measure";

export type ArkMeasureRecording = "on" | "off" | "log";

export function arkMeasureRecording(): ArkMeasureRecording {
    if (process.env.WEB_ARK_EVENTS?.trim().toLowerCase() === "off") return "off";
    if (process.env.NODE_ENV !== "production" && process.env.WEB_ARK_EVENTS_RECORD_IN_DEV !== "1") return "log";
    return "on";
}

export type ArkMeasureWriteResult = {recorded: boolean; reason?: "off" | "log" | "unconfigured" | "missing_table" | "failed"};

let missingTableLogged = false;

export async function recordArkMeasureEvent(report: ArkMeasureReport): Promise<ArkMeasureWriteResult> {
    const mode = arkMeasureRecording();
    if (mode === "off") return {recorded: false, reason: "off"};
    const row = arkMeasureRow(report);
    if (mode === "log") {
        console.info("[ark-measure] not written outside production", row);
        return {recorded: false, reason: "log"};
    }
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return {recorded: false, reason: "unconfigured"};
    try {
        const response = await fetch(`${url}/rest/v1/web_ark_events`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Prefer: "return=minimal"}),
            body: JSON.stringify(row),
            cache: "no-store"
        });
        if (response.ok) return {recorded: true};
        const text = await response.text().catch(() => "");
        if (/PGRST205|42P01/.test(text)) {
            if (!missingTableLogged) console.warn("[ark-measure] web_ark_events is missing: apply landing migration 20261110130000");
            missingTableLogged = true;
            return {recorded: false, reason: "missing_table"};
        }
        console.warn("[ark-measure] write failed", response.status, text.slice(0, 200));
        return {recorded: false, reason: "failed"};
    } catch (error) {
        console.warn("[ark-measure] write failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return {recorded: false, reason: "failed"};
    }
}
