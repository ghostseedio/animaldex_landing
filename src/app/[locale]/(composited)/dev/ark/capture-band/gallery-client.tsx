"use client";

import {useState} from "react";
import ArkCaptureBand from "@/components/animal-detail/ark-capture-band";
import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkWords} from "@/lib/ark-words";
import type {ArkCaptureState} from "@/lib/ark-thrive";

/** `captureState`: the server's answer for the reader's own capture (captures + thrive); null: none, the species' band. */
type Case = {label: string; speciesProfileId: string; slug: string; name: string; captureState?: ArkCaptureState | null};

/** Each state inside a copy of the card's About column (#090909, its 20px gutters). */
export default function ArkCaptureBandGallery({words, snapshot, cases}: {words: ArkWords; snapshot: ArkSnapshot; cases: Case[]}) {
    const [talked, setTalked] = useState<string | null>(null);
    return (
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 pb-16">
            <p className="px-4 text-sm text-white/60 md:px-0" aria-live="polite">{talked ? `Opens the chat: ${talked}` : "The Ark band on /app/capture/<id>, from fixture answers (voyage_capture_state_v1 and the snapshot)."}</p>
            {cases.map((item) => (
                <div key={item.label} className="flex flex-col gap-2">
                    <p className="px-4 text-xs font-bold uppercase tracking-[0.12em] text-white/40 md:px-0">{item.label}</p>
                    <section className="overflow-hidden border border-white/[0.08] bg-[#090909] font-sans">
                        <div>
                            <ArkCaptureBand
                                speciesProfileId={item.speciesProfileId}
                                slug={item.slug}
                                name={item.name}
                                words={words}
                                snapshot={snapshot}
                                captureState={item.captureState ?? null}
                                onTalk={() => setTalked(item.name)}
                            />
                        </div>
                    </section>
                </div>
            ))}
        </div>
    );
}
