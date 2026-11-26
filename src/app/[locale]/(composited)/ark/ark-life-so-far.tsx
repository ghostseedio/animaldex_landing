"use client";

import React, {useEffect, useState} from "react";
import {arkHumanAgo} from "@/lib/ark-human-time";
import {ARK_LIFE_SO_FAR_ENGLISH, arkLifeSoFar, arkMomentText, arkMomentTone, decodeArkMoments, type ArkLifeSoFarWords, type ArkMoment} from "@/lib/ark-life-so-far";

/**
 * "Life so far" (lane BIO, `lib/ark-life-so-far.ts`; behind `?lifestory` until `voyage_animal_moments_v1` is live): the
 * animal's recorded moments, newest first, from the engine's own record. `part="line"`: its newest moment in one line
 * under its life on the card, which opens the life story; `part="list"`: the list at the top of the life story, the
 * newest four and "More". Lazy, as the card's other blocks, so /ark's static JavaScript stays inside its budget.
 *
 * `by`: the card's own "Brought by" / "Born to" line (the founders rules of its header, decision 483), shown on the
 * arrived or born moment. The read itself names nobody.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One read per animal per visit (both parts share it); a failed read is no list, never asked again on this visit. */
const reads = new Map<string, Promise<ArkMoment[] | null>>();
function readMoments(id: string): Promise<ArkMoment[] | null> {
    let read = reads.get(id);
    if (!read) {
        read = fetch(`/api/ark/moments/${encodeURIComponent(id)}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((json: {moments?: unknown} | null) => {
                const decoded = decodeArkMoments(json?.moments ?? null);
                return decoded ? arkLifeSoFar(decoded) : null;
            }, () => null);
        reads.set(id, read);
    }
    return read;
}

function useMoments(id: string): {moments: ArkMoment[] | null; loading: boolean} {
    const [state, setState] = useState<{id: string; moments: ArkMoment[] | null} | null>(null);
    useEffect(() => {
        if (!UUID.test(id)) return;
        let live = true;
        void readMoments(id).then((moments) => live && setState({id, moments}));
        return () => {
            live = false;
        };
    }, [id]);
    if (!UUID.test(id)) return {moments: null, loading: false};
    return state?.id === id ? {moments: state.moments, loading: false} : {moments: null, loading: true};
}

const TONE: Record<ReturnType<typeof arkMomentTone>, string> = {
    start: "bg-primary-300",
    family: "bg-[#f3a6c8]",
    food: "bg-[#9fd68a]",
    danger: "bg-[#ffb36b]",
    end: "bg-white/40",
    life: "bg-[#9fb0ff]"
};

type Props = {
    part: "line" | "list";
    animalId: string;
    /** Its own kind's name: a mate of its own kind is just "Mated". */
    self: string;
    human?: boolean;
    locale: string;
    words?: Partial<ArkLifeSoFarWords> | null;
    /** The card's "Brought by …" / "Born to …" line, for the arrived / born moment. */
    by?: React.ReactNode;
    /** `part="line"`: opens the life story, where the list is. */
    onOpen?: () => void;
    /** For "2 h ago": the card's minute clock. */
    now?: number;
};

export default function ArkLifeSoFar({part, animalId, self, human = false, locale, words: given, by = null, onOpen, now}: Props) {
    const words: ArkLifeSoFarWords = {...ARK_LIFE_SO_FAR_ENGLISH, ...(given ?? {})};
    const {moments, loading} = useMoments(animalId);
    const [open, setOpen] = useState<string | null>(null);
    const clock = now ?? Date.now();
    const stamp = (moment: ArkMoment) => arkHumanAgo(moment.at, clock, locale, "short");
    const say = (moment: ArkMoment) => arkMomentText(moment, {self, human, words});
    const withBy = (moment: ArkMoment) => by && (moment.kind === "arrived" || moment.kind === "born");

    if (part === "line") {
        const newest = moments?.[0];
        if (!newest) return null;
        return (
            <button type="button" onClick={onOpen} data-testid="ark-card-life-so-far-line" className="group flex w-full min-w-0 items-center gap-2 text-start text-[12px] leading-snug">
                <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{words.title}</span>
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[arkMomentTone(newest)]}`} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink-100 group-hover:text-white">{say(newest)}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-ink-400">{stamp(newest)}</span>
                <span aria-hidden="true" className="shrink-0 text-ink-400 group-hover:text-primary-300 rtl:rotate-180">›</span>
            </button>
        );
    }

    if (!loading && (!moments || moments.length === 0)) {
        return moments ? <p data-testid="ark-card-life-so-far" className="mt-2 text-[12px] italic text-ink-400">{words.empty}</p> : null;
    }
    const all = moments ?? [];
    const expanded = open === animalId;
    const shown = expanded ? all : all.slice(0, 4);
    return (
        <section data-testid="ark-card-life-so-far" aria-label={words.title} className="mt-2">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{words.title}</p>
            {loading ? (
                <p className="mt-1 h-[4.5rem] text-[12px] italic text-ink-400">{words.loading}</p>
            ) : (
                <ol className="relative mt-1 border-s border-white/10 ps-3">
                    {shown.map((moment) => (
                        <li key={moment.id} data-kind={moment.kind} className="relative flex min-w-0 items-baseline gap-2 py-[3px] text-[12.5px] leading-snug">
                            <span aria-hidden="true" className={`absolute -start-[calc(0.75rem+3.5px)] top-[0.6rem] h-[7px] w-[7px] rounded-full ring-2 ring-[#0d1a17] ${TONE[arkMomentTone(moment)]}`} />
                            <span className="min-w-0 flex-1">
                                <span className="font-semibold text-ink-100">{say(moment)}</span>
                                {withBy(moment) ? <span className="text-ink-300"> · {by}</span> : null}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-400" title={new Date(moment.at).toLocaleString(locale)}>{stamp(moment)}</span>
                        </li>
                    ))}
                </ol>
            )}
            {all.length > 4 ? (
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : animalId)} data-testid="ark-card-life-so-far-more" className="mt-1 ps-3 text-[12px] font-bold text-primary-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
                    {expanded ? words.less : words.more.replace("{n}", (all.length - 4).toLocaleString(locale))}
                </button>
            ) : null}
        </section>
    );
}
