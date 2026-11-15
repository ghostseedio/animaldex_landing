"use client";

import {useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SdRhythmCompare from "@/components/ark/sd-rhythm-compare";
import type {SdCategory, SdFrequency, SdRhythmState} from "@/lib/ark-sd-rhythm";
import {ARK_RHYTHM_ENGLISH} from "@/lib/ark-sd-rhythm-words";

/**
 * "In the Ark" under a species' System Dynamics (lane `ark-sd-align`): one of its kind's sample day in the Ark (the
 * shared schedule, worked out offline: `/api/ark/sd-day`) beside its SD waveform, its modes' weights against its time,
 * its tempo, and the way to see one live (`/ark?focus=<species>`, whose card shows that animal's own last 24 hours).
 * Nothing when its kind is not in the Ark or its modes say nothing the Ark shows.
 */

type Day = {slug: string; tempo: SdFrequency; score: number; state: SdRhythmState; bout: number; line: number[]; shares: Array<[SdCategory, number, number]>};

export default function SdInTheArk({speciesProfileId, sdPath}: {speciesProfileId: string; sdPath: string | null}) {
    const [day, setDay] = useState<Day | null>(null);
    const words = ARK_RHYTHM_ENGLISH;
    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(`/api/ark/sd-day?speciesProfileId=${encodeURIComponent(speciesProfileId)}`, {headers: {Accept: "application/json"}, signal: controller.signal});
                if (!response.ok) return;
                const payload = await response.json();
                setDay(payload?.day ?? null);
            } catch {
                // (No day: the block is left out.)
            }
        })();
        return () => controller.abort();
    }, [speciesProfileId]);
    if (!day) return null;
    return (
        <section aria-labelledby={`sd-in-ark-${speciesProfileId}`} data-testid="sd-in-the-ark" className="border-t border-white/10 bg-canvas-950/60 px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`sd-in-ark-${speciesProfileId}`} className="font-display text-[15px] font-extrabold text-white">In the Ark</h3>
                <Link href={`/ark?focus=${encodeURIComponent(speciesProfileId)}`} className="text-[13px] font-bold text-primary-300 underline-offset-2 hover:underline" data-testid="sd-see-live">
                    {words.seeLive} →
                </Link>
            </div>
            <div className="mt-2">
                <SdRhythmCompare sdPath={sdPath} line={day.line} live={false} shares={day.shares.map(([category, sd, ark]) => ({category, sd, ark}))} tempo={day.tempo} boutMinutes={day.bout} state={day.state} score={day.score} words={words} />
            </div>
        </section>
    );
}
