import "server-only";
import { fetchRows, isMissingTableError } from "@/app/api/admin/growth/_lib/rows";
import { heroVariantSplit } from "@/lib/hero-variant";
import { addDays, dayStartMs } from "@/lib/product-analytics";
import { summarizeWebFunnel, type WebFunnelRow, type WebFunnelSummary } from "@/lib/web-funnel";

/** The home hero test's funnel for /admin/metrics: one per variant, for the selected Jakarta days. */
export type WebFunnelPanel = WebFunnelSummary & {
  /** Percent of new visitors given B (`HERO_VARIANT_SPLIT`, 80 when unset). */
  splitB: number;
  note: string | null;
};

export async function loadWebFunnel(from: string, to: string): Promise<WebFunnelPanel> {
  const splitB = heroVariantSplit(process.env.HERO_VARIANT_SPLIT);
  const start = new Date(dayStartMs(from)).toISOString();
  const end = new Date(dayStartMs(addDays(to, 1))).toISOString();
  try {
    const rows = await fetchRows<WebFunnelRow>(
      "web_funnel_events",
      `select=visitor_hash,event,variant,chip_kind,created_at&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}&order=created_at.asc`,
    );
    return { ...summarizeWebFunnel(rows), splitB, note: null };
  } catch (error) {
    // The panel degrades on its own; the rest of the page still loads.
    const note = isMissingTableError(error, "web_funnel_events")
      ? "The hero test's funnel is recorded once landing migration 20261104180000 (web_funnel_events) is applied."
      : `The funnel could not be loaded: ${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}`;
    return { ...summarizeWebFunnel([]), splitB, note };
  }
}
