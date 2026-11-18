/**
 * When a record's act begins in the live world (V1 "hunting and mating you can see"; AnimalDex
 * docs/ark/audits/ecosystem-audit-2026-11-18.md §2.4 "Live chase timing", decision 389).
 *
 * The server decides a hunt on its tick and the record is released later (the drip): a meal's or an escape's row is
 * out minutes after the encounter's own step, and a viewer's page reads it up to a refresh after that. Acted from the
 * step, the chase was over before anyone could know of it: live viewers saw the feeding and never the chase; a death's
 * fall was a second long at a moment nobody had been told of.
 *
 * So the act is HELD until the record is out: it begins `ARK_ACT_HOLD_SECONDS` after the row's own time (`at`, the
 * moment the server released it, the same for every viewer), never before the encounter's step. Until then the animals
 * it names go on with their day (whoever has left the read stands in: `replay/cast.ts`). The hold is longer than a
 * page's refresh (45 s) and its read, so a viewer watching has the line, and can be looking, before the first stride.
 *
 * No look-ahead: nothing here is known before the server released it; the act is only ever later than the record.
 * Pure: the same start for every viewer, the live world and a replay of the event alike.
 */

/** From the record's release to its act's first frame (s): a page's refresh (45 s), the public read's cache (30 s). */
export const ARK_ACT_HOLD_SECONDS = 75;

/**
 * The act's start on the shared clock (epoch s). `recordAt`: the row's `at` (epoch s); `step`: the encounter's own
 * step when the server gives it. Without a record time, the step (an older answer).
 */
export function arkActStart(recordAt: number | null | undefined, step?: number | null): number {
    const at = typeof recordAt === "number" && Number.isFinite(recordAt) ? recordAt + ARK_ACT_HOLD_SECONDS : NaN;
    const own = typeof step === "number" && Number.isFinite(step) ? step : NaN;
    if (Number.isNaN(at)) return own;
    return Number.isNaN(own) ? at : Math.max(at, own);
}

/** The same from a row's ISO time. */
export function arkActStartOf(at: string | null | undefined, step?: number | null): number {
    return arkActStart(typeof at === "string" ? Date.parse(at) / 1000 : null, step);
}
