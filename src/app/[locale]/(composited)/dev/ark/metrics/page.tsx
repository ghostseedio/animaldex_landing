import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {ARK_BASELINE_FROM, ARK_LAUNCH_DAY, summarizeArkMeasure, type ArkArrivalRow, type ArkSeenRow, type ArkTrialRow, type ArkWebEventRow} from "@/lib/ark-measure";
import {dayKeyOf} from "@/lib/product-analytics";
import ArkMetricsGallery from "./gallery-client";
import fixture from "./fixture.json";

/**
 * DEV ONLY: the Ark tab of /admin/metrics drawn by the real view from
 * fixture rows (`fixture.json`, made up), since the admin needs its password
 * and the service role locally. 404s in production.
 *
 *   /dev/ark/metrics               without dev testers
 *   /dev/ark/metrics?testers=1     with them
 *   /dev/ark/metrics?empty=1       before the new tables exist (web_ark_events, ark_seen_events)
 */

export const metadata: Metadata = {title: "Ark metrics", robots: {index: false, follow: false}};

export default function ArkMetricsDevPage({searchParams}: {searchParams?: {testers?: string; empty?: string}}) {
    if (process.env.NODE_ENV === "production") notFound();
    const empty = searchParams?.empty === "1";
    const includeTesters = searchParams?.testers === "1";
    const to = dayKeyOf(Date.now());
    const summary = summarizeArkMeasure({
        from: ARK_BASELINE_FROM,
        to,
        trials: fixture.trials as ArkTrialRow[],
        arrivals: fixture.arrivals as ArkArrivalRow[],
        seen: empty ? null : fixture.seen as ArkSeenRow[],
        events: empty ? null : fixture.events as ArkWebEventRow[],
        testers: new Set(fixture.testers),
        includeTesters
    });
    return (
        <ArkMetricsGallery
            data={{
                ok: true,
                today: to,
                generatedAt: new Date().toISOString(),
                from: ARK_BASELINE_FROM,
                to,
                launchDay: ARK_LAUNCH_DAY,
                summary,
                arrivalsFrom: "voyage_animals",
                seenRecorded: !empty,
                eventsRecorded: !empty,
                notes: empty ? ["Fixture: as before landing migration 20261110130000 and AnimalDex migration 20261111150000."] : ["Fixture data (made up)."]
            }}
        />
    );
}
