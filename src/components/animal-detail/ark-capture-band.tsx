"use client";

import {useEffect, useState} from "react";
import {useParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkSpeciesAboard, pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {noteArkArrivalsSeen} from "@/lib/ark-measure-client";

/**
 * The Ark on a capture's card: whether this species is aboard the shared
 * Ark, and the next move. Aboard: how many (and whether one is the
 * reader's), and "See it in the Ark", which flies there. Not aboard: how one
 * comes aboard (a step with it that works), and the way into its chat.
 *
 * One light read, shared by every band on the page: `/api/ark/voyage`, the
 * page's own 45-second snapshot. Nothing shows until the Ark is open (the
 * read answers 503 before the migration), so it is never a broken band.
 */

let shared: Promise<ArkSnapshot | null> | null = null;

function readArk(): Promise<ArkSnapshot | null> {
    shared ??= fetch("/api/ark/voyage", {credentials: "same-origin"})
        .then((response) => (response.ok ? response.json() : null))
        .then((body: {snapshot?: unknown} | null) => decodeArkSnapshot(body?.snapshot))
        .catch(() => null)
        .then((snapshot) => {
            // A later card reads afresh (a step that worked since brings one aboard).
            setTimeout(() => {
                shared = null;
            }, 30_000);
            return snapshot;
        });
    return shared;
}

type Props = {
    speciesProfileId: string | null;
    slug: string | null;
    /** The species' name, for when none is aboard yet. */
    name: string;
    words: ArkWords;
    /** Opens this animal's chat: where a step comes from. */
    onTalk: () => void;
    /** Development's gallery: a snapshot instead of the read (`undefined` reads). */
    snapshot?: ArkSnapshot | null;
};

function ArkGlyph() {
    return (
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-400/[0.14] text-primary-300">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 14h18l-2.2 4.2a2 2 0 0 1-1.8 1.1H7a2 2 0 0 1-1.8-1.1L3 14Z" />
                <path d="M7 14V9.5h10V14" />
                <path d="M12 9.5V5.5M10 5.5h4" />
            </svg>
        </span>
    );
}

export default function ArkCaptureBand({speciesProfileId, slug, name, words, onTalk, snapshot: given}: Props) {
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null | undefined>(given);
    // The URL's locale (English has no prefix).
    const locale = useParams<{locale?: string}>()?.locale ?? "en";
    useEffect(() => {
        if (given !== undefined) {
            setSnapshot(given);
            return;
        }
        let live = true;
        void readArk().then((read) => {
            if (live) setSnapshot(read);
        });
        return () => {
            live = false;
        };
    }, [given]);

    // "Yours is aboard" on the card is the reader seeing their own arrival (Ark measurement, lib/ark-measure).
    const mineAboard = given === undefined && snapshot ? arkSpeciesAboard(snapshot, {speciesProfileId, slug}).animals.filter((animal) => animal.mine) : [];
    const mineKey = mineAboard.map((animal) => animal.id).join(",");
    useEffect(() => {
        if (mineAboard.length) noteArkArrivalsSeen(mineAboard, "capture_band");
        // Keyed by the ids: a new snapshot with the same animals asks nothing again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mineKey]);
    if (!snapshot || (!speciesProfileId && !slug)) return null;
    const copy = words.capture;
    const aboard = arkSpeciesAboard(snapshot, {speciesProfileId, slug});
    const newest = aboard.animals[0];
    const arkName = newest?.name ?? name;
    // The Ark's own key for it (the canonical species), so a folded capture still lands on it.
    const focus = newest?.species_profile_id || newest?.model_slug || "";

    if (!aboard.count || !aboard.status) {
        return (
            <section className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 font-sans" data-testid="ark-capture-band" data-state="not-aboard">
                <div className="flex items-start gap-3.5">
                    <ArkGlyph />
                    <div className="min-w-0 pt-px">
                        <h3 className="text-base font-bold text-white">{copy.notAboardTitle}</h3>
                        <p className="mt-0.5 text-sm leading-6 text-white/65">{copy.notAboardBody}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.375rem]">
                    <button type="button" onClick={onTalk} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-4 text-sm font-black text-black transition-colors hover:bg-primary-300">
                        {copy.start}
                        <span aria-hidden="true">→</span>
                    </button>
                    <Link href="/ark?from=capture" className="text-sm font-bold text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline">
                        {copy.seeArk}
                    </Link>
                </div>
            </section>
        );
    }

    // The plural is English's ("Komodo Dragons"); other languages say the count with the name as it is (A17).
    const headline = aboard.count === 1
        ? fillArkWords(copy.aboardOne, {animal: arkName})
        : fillArkWords(copy.aboardOther, {count: aboard.count.toLocaleString(locale), animals: locale === "en" ? pluralAnimalName(arkName) : arkName});
    const yours = !aboard.mine ? null
        : aboard.count === 1 ? copy.mineOnly
        : aboard.mine === 1 ? copy.mineOne
        : fillArkWords(copy.mineOther, {count: aboard.mine.toLocaleString(locale)});
    const status = words.hud[aboard.status];

    return (
        <section className="flex flex-col gap-4 border-b border-white/[0.08] bg-primary-400/[0.05] px-5 py-5 font-sans" data-testid="ark-capture-band" data-state="aboard">
            <div className="flex items-start gap-3.5">
                <ArkGlyph />
                <div className="min-w-0 pt-px">
                    <h3 className="text-base font-bold text-white">{yours ? `${headline}, ${yours}` : headline}</h3>
                    <p className="mt-0.5 text-sm leading-6 text-white/65">
                        {aboard.count === 1 && !aboard.mine ? copy.needsMate : status.charAt(0).toUpperCase() + status.slice(1)}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.375rem]">
                <Link href={`/ark?focus=${encodeURIComponent(focus)}&from=capture`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-4 text-sm font-black text-black transition-colors hover:bg-primary-300">
                    {copy.see}
                    <span aria-hidden="true">→</span>
                </Link>
                {aboard.count === 1 ? (
                    <button type="button" onClick={onTalk} className="text-sm font-bold text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline">
                        {copy.bringMate}
                    </button>
                ) : null}
            </div>
        </section>
    );
}
