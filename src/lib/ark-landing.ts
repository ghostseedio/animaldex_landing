/**
 * The home page's live Ark as `/api/ark/landing` answers it (`src/data/ark-landing.ts` builds it on the server), and
 * the one read the page's sections share: the numbers, the day's awake counts and the populations chart all wait on
 * the same request, made once per page load.
 */

import type {ArkPopulationSeries} from "@/lib/ark-population-series";

export type ArkLandingSummary = {
    available: boolean;
    /** When the snapshot was read (the server's `as_of`). */
    asOf: string | null;
    /** When the voyage's clock started. */
    startedAt: string | null;
    counts: {animals: number; species: number; founders: number};
    /** The last 24 hours of the log; null when it could not be read whole. */
    today: {since: string; arrivals: number; births: number; meals: number; deaths: number} | null;
    /** The species with the most aboard, biggest first (the Ark is what people photograph). */
    top: Array<{name: string; slug: string; count: number}>;
    /** How many of those aboard are awake at each island hour (0–23), by the scene's own rule (`isAwake`). */
    awake: number[];
    series: ArkPopulationSeries | null;
};

let read: Promise<ArkLandingSummary | null> | null = null;

/** The live Ark for this page load (null when it cannot be read). */
export function fetchArkLanding(): Promise<ArkLandingSummary | null> {
    read ??= fetch("/api/ark/landing")
        .then((response) => (response.ok ? (response.json() as Promise<ArkLandingSummary>) : null))
        .then((summary) => (summary && summary.available ? summary : null))
        .catch(() => null);
    return read;
}
