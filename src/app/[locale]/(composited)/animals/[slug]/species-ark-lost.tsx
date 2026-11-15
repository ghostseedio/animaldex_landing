"use client";

import {useEffect, useState} from "react";
import {AppDownloadLink} from "@/components/store/store-link";
import {arkExtinctHow, arkExtinctionOf, arkExtinctWhen, fetchArkExtinct, type ArkExtinction, type ArkLostWords} from "@/lib/ark-extinct";

/**
 * A species page's "Lost from the Ark" line (owner, 2026-11-15): when the server logged this species' extinction on
 * the Ark, the date and how the last one went, and "Catch one to bring it back" (the page's own app link). Rendered
 * from the page's read (`readArkExtinctions`), then checked again in the browser (`/api/ark/extinct`), so a species
 * that came back since the page was built says "Back aboard" and one that was never logged says nothing.
 */
type Props = {speciesProfileId: string | null; slug: string; initial: ArkExtinction | null; words: ArkLostWords};

export default function SpeciesArkLost({speciesProfileId, slug, initial, words}: Props) {
    const [entry, setEntry] = useState<ArkExtinction | null>(initial);
    useEffect(() => {
        let live = true;
        void fetchArkExtinct().then((answer) => {
            // (A failed read keeps what the page was built with.)
            if (live && answer.available) setEntry(arkExtinctionOf(answer.extinctions, {speciesProfileId, slug}));
        });
        return () => {
            live = false;
        };
    }, [slug, speciesProfileId]);
    if (!entry) return null;
    const how = arkExtinctHow(words, entry);
    if (entry.backAboard) {
        return (
            <p className="mt-2 text-base text-ink-200" data-ark-lost="back">
                <span className="mr-2 inline-flex items-center rounded-full bg-primary-400/15 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-primary-100">{words.back}</span>
                {arkExtinctWhen(words.speciesBack, entry, "en")}
            </p>
        );
    }
    return (
        <div className="mt-3 flex max-w-3xl flex-col items-start gap-3 border-l-2 border-[#8a8579] pl-4" data-ark-lost="extinct">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-300">{words.title}</p>
                <p className="mt-1 text-lg font-semibold text-white">{arkExtinctWhen(words.speciesLine, entry, "en")}</p>
                {how ? <p className="text-base text-ink-200">{how}.</p> : null}
            </div>
            <AppDownloadLink placement="species_card" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-bold text-canvas-950 transition-colors hover:bg-primary-300">
                {words.bringBack}
                <span aria-hidden="true">→</span>
            </AppDownloadLink>
        </div>
    );
}
