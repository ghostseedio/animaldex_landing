"use client";

import {useEffect, useState} from "react";
import {useParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot, ArkThrive} from "@/ark-scene/types";
import {arkSpeciesAboard, pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {noteArkArrivalsSeen} from "@/lib/ark-measure-client";
import {arkCaptureBandView, arkThriveWords, decodeArkCaptureState, type ArkCaptureState} from "@/lib/ark-thrive";

/**
 * The Ark on a capture's card (captures + thrive, owner 2026-11-11):
 * captures bring animals aboard, steps make them thrive. For the reader's own
 * capture the server says what this capture did (`/api/ark/capture-state`,
 * `voyage_capture_state_v1`):
 *
 * - "Aboard the Ark": this capture brought their animal aboard (and, with two,
 *   "Your pair is aboard"), its condition in plain words, and "Steps with it
 *   keep your {animal} thriving";
 * - "Coming aboard": queued (about a minute), or waiting for its 3D model;
 * - "Your pair is aboard": they already have two of the kind, so it adds no more;
 * - "It was aboard the Ark": the one it brought has died (their next capture
 *   of one brings another); "Not on the Ark": a species that can't come aboard.
 *
 * Otherwise (capture arrivals not switched on yet, someone else's capture, a
 * server without the read) the species' band from the public snapshot, as
 * before: how many are aboard and whether one is the reader's. Still being
 * identified, not identified, or an under-13 account: no band at all.
 *
 * Never a capture's place, time of day or nickname. Nothing shows until its
 * reads answer, so it is never a broken band.
 */

let shared: Promise<ArkSnapshot | null> | null = null;

function readArk(): Promise<ArkSnapshot | null> {
    shared ??= fetch("/api/ark/voyage", {credentials: "same-origin"})
        .then((response) => (response.ok ? response.json() : null))
        .then((body: {snapshot?: unknown} | null) => decodeArkSnapshot(body?.snapshot))
        .catch(() => null)
        .then((snapshot) => {
            // A later card reads afresh (a capture that came aboard since).
            setTimeout(() => {
                shared = null;
            }, 30_000);
            return snapshot;
        });
    return shared;
}

async function readCaptureState(captureId: string): Promise<ArkCaptureState | null> {
    try {
        const response = await fetch(`/api/ark/capture-state?capture=${encodeURIComponent(captureId)}`, {credentials: "same-origin", cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {state?: unknown};
        return decodeArkCaptureState(body.state);
    } catch {
        return null;
    }
}

/** While it is coming aboard, the band reads again (the outbox brings it within about a minute). */
const COMING_POLL_MS = [20_000, 45_000, 90_000] as const;

type Props = {
    speciesProfileId: string | null;
    slug: string | null;
    /** The species' name, for when the server sends none. */
    name: string;
    words: ArkWords;
    /** Opens this animal's chat: where a step comes from. */
    onTalk: () => void;
    /** The reader's own capture (its band says what this capture did); null or absent: the species' band only. */
    captureId?: string | null;
    /** Development's gallery: a snapshot instead of the read (`undefined` reads). */
    snapshot?: ArkSnapshot | null;
    /** Development's gallery: the capture's state instead of the read (`undefined` reads; null: none, the species' band). */
    captureState?: ArkCaptureState | null;
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

const PRIMARY = "inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-4 text-sm font-black text-black transition-colors hover:bg-primary-300";
const QUIET = "text-sm font-bold text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline";

/** The condition in the tap card's words, as a small chip, and what steps do: the band's second line. */
function ThriveLine({band, line, words}: {band: ArkThrive; line: string; words: ArkWords}) {
    return (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 text-white/75" data-testid="ark-capture-thrive" data-thrive={band}>
            <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold leading-5 ${band === "ordinary" ? "bg-white/[0.08] text-white/80" : "bg-primary-400/15 text-primary-200"}`}>
                {arkThriveWords(band, words.life)}
            </span>
            <span>{line}</span>
        </p>
    );
}

export default function ArkCaptureBand({speciesProfileId, slug, name, words, onTalk, captureId = null, snapshot: given, captureState: givenState}: Props) {
    const [snapshot, setSnapshot] = useState<ArkSnapshot | null | undefined>(given);
    const [state, setState] = useState<{value: ArkCaptureState | null; read: boolean}>(() => ({value: givenState ?? null, read: givenState !== undefined || !captureId}));
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
    useEffect(() => {
        if (givenState !== undefined) {
            setState({value: givenState, read: true});
            return;
        }
        if (!captureId) {
            setState({value: null, read: true});
            return;
        }
        let live = true;
        void readCaptureState(captureId).then((value) => {
            if (live) setState({value, read: true});
        });
        return () => {
            live = false;
        };
    }, [captureId, givenState]);
    // Coming aboard: read again a few times, so the band turns to "Aboard the Ark" on its own.
    const coming = state.value?.state === "coming_aboard";
    useEffect(() => {
        if (!coming || !captureId || givenState !== undefined) return;
        let live = true;
        const timers = COMING_POLL_MS.map((delay) => window.setTimeout(() => {
            void readCaptureState(captureId).then((value) => {
                if (live && value) setState({value, read: true});
            });
        }, delay));
        return () => {
            live = false;
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [coming, captureId, givenState]);

    // "Yours is aboard" on the card is the reader seeing their own arrival (Ark measurement, lib/ark-measure).
    const mineAboard = given === undefined && snapshot ? arkSpeciesAboard(snapshot, {speciesProfileId, slug}).animals.filter((animal) => animal.mine) : [];
    const mineKey = mineAboard.map((animal) => animal.id).join(",");
    useEffect(() => {
        if (mineAboard.length) noteArkArrivalsSeen(mineAboard, "capture_band");
        // Keyed by the ids: a new snapshot with the same animals asks nothing again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mineKey]);
    if ((!speciesProfileId && !slug) || !state.read) return null;
    const copy = words.capture;
    const aboard = snapshot ? arkSpeciesAboard(snapshot, {speciesProfileId, slug}) : null;
    const view = arkCaptureBandView(state.value);
    if (view.kind === "hidden") return null;

    // The Ark's own key for it (the canonical species), so a folded capture still lands on it; the animal this capture brought first.
    const brought = state.value?.animalId ? snapshot?.animals.find((animal) => animal.id === state.value?.animalId) ?? null : null;
    const newest = brought ?? aboard?.animals[0] ?? null;
    const focus = newest?.species_profile_id || newest?.model_slug || speciesProfileId || slug || "";
    const seeHref = `/ark?focus=${encodeURIComponent(focus)}&from=capture`;

    if (view.kind !== "species") {
        const read = view.state;
        const animal = read.species ?? newest?.name ?? name;
        // English names two in the plural ("your Komodo Dragons"); other languages say the name as it is (A17).
        const animals = locale === "en" ? pluralAnimalName(animal) : animal;
        const yours = read.livingBrought >= 2 ? animals : animal;
        const thrive = fillArkWords(copy.thrive, {animal: yours});
        const lines: Record<typeof view.kind, {title: string; body: string; thrive: boolean; tone: "mine" | "plain"}> = {
            aboard: {title: copy.aboardTitle, body: [fillArkWords(copy.aboardBody, {animal}), read.livingBrought >= 2 ? copy.aboardPair : ""].filter(Boolean).join(" "), thrive: true, tone: "mine"},
            already: {title: copy.aboardTitle, body: [fillArkWords(copy.alreadyBody, {animal: yours}), read.livingBrought >= 2 ? copy.aboardPair : ""].filter(Boolean).join(" "), thrive: true, tone: "mine"},
            coming: {title: copy.comingTitle, body: fillArkWords(copy.comingBody, {animal}), thrive: true, tone: "mine"},
            waiting: {title: copy.comingTitle, body: fillArkWords(copy.waitingBody, {animal}), thrive: true, tone: "mine"},
            pair_full: {title: copy.pairFullTitle, body: fillArkWords(copy.pairFullBody, {animals}), thrive: true, tone: "mine"},
            was_aboard: {title: copy.wasAboardTitle, body: fillArkWords(copy.wasAboardBody, {animal}), thrive: read.livingBrought > 0, tone: "plain"},
            not_on_ark: {title: copy.notOnArkTitle, body: copy.notOnArkBody, thrive: false, tone: "plain"}
        };
        const shown = lines[view.kind];
        const canSee = view.kind === "aboard" || view.kind === "already" || view.kind === "pair_full";
        return (
            <section
                className={`flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 font-sans ${shown.tone === "mine" ? "bg-primary-400/[0.05]" : ""}`}
                data-testid="ark-capture-band"
                data-state={read.state}
                data-view={view.kind}
            >
                <div className="flex items-start gap-3.5">
                    <ArkGlyph />
                    <div className="min-w-0 pt-px">
                        <h3 className="text-base font-bold text-white">{shown.title}</h3>
                        <p className="mt-0.5 text-sm leading-6 text-white/65">{shown.body}</p>
                        {shown.thrive ? <ThriveLine band={read.thrive} line={thrive} words={words} /> : null}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.375rem]">
                    {canSee ? (
                        <>
                            <Link href={seeHref} className={PRIMARY}>
                                {copy.see}
                                <span aria-hidden="true">→</span>
                            </Link>
                            <button type="button" onClick={onTalk} className={QUIET}>{copy.start}</button>
                        </>
                    ) : view.kind === "not_on_ark" ? (
                        <Link href="/ark?from=capture" className={QUIET}>{copy.seeArk}</Link>
                    ) : (
                        <>
                            <button type="button" onClick={onTalk} className={PRIMARY}>
                                {copy.start}
                                <span aria-hidden="true">→</span>
                            </button>
                            <Link href="/ark?from=capture" className={QUIET}>{copy.seeArk}</Link>
                        </>
                    )}
                </div>
            </section>
        );
    }

    // The species' band, from the public snapshot.
    if (!snapshot || !aboard) return null;
    const arkName = newest?.name ?? name;
    if (!aboard.count || !aboard.status) {
        return (
            <section className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 font-sans" data-testid="ark-capture-band" data-state="not-aboard" data-view="species">
                <div className="flex items-start gap-3.5">
                    <ArkGlyph />
                    <div className="min-w-0 pt-px">
                        <h3 className="text-base font-bold text-white">{copy.notAboardTitle}</h3>
                        <p className="mt-0.5 text-sm leading-6 text-white/65">{copy.notAboardBody}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.375rem]">
                    <button type="button" onClick={onTalk} className={PRIMARY}>
                        {copy.start}
                        <span aria-hidden="true">→</span>
                    </button>
                    <Link href="/ark?from=capture" className={QUIET}>{copy.seeArk}</Link>
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
    // The reader's own: their condition for the kind (the best of theirs) and what steps do; anyone else's: how the kind stands.
    const mineBands = aboard.animals.filter((animal) => animal.mine && animal.origin !== "born").map((animal) => animal.thrive ?? "ordinary");
    const band: ArkThrive = mineBands.includes("prime") ? "prime" : mineBands.includes("good") ? "good" : "ordinary";
    const mineName = mineBands.length >= 2 && locale === "en" ? pluralAnimalName(arkName) : arkName;

    return (
        <section className="flex flex-col gap-4 border-b border-white/[0.08] bg-primary-400/[0.05] px-5 py-5 font-sans" data-testid="ark-capture-band" data-state="aboard" data-view="species">
            <div className="flex items-start gap-3.5">
                <ArkGlyph />
                <div className="min-w-0 pt-px">
                    <h3 className="text-base font-bold text-white">{yours ? `${headline}, ${yours}` : headline}</h3>
                    <p className="mt-0.5 text-sm leading-6 text-white/65">
                        {aboard.count === 1 && !aboard.mine ? copy.needsMate : status.charAt(0).toUpperCase() + status.slice(1)}
                    </p>
                    {mineBands.length ? <ThriveLine band={band} line={fillArkWords(copy.thrive, {animal: mineName})} words={words} /> : null}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[3.375rem]">
                <Link href={seeHref} className={PRIMARY}>
                    {copy.see}
                    <span aria-hidden="true">→</span>
                </Link>
                <button type="button" onClick={onTalk} className={QUIET}>{copy.start}</button>
            </div>
        </section>
    );
}
