"use client";

import {useEffect, useId, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {ARK_PLACEHOLDER_ICON, arkIconUrl} from "@/ark-scene/placeholder-icon";
import {arkExtinctHow, arkExtinctWhen, fetchArkExtinct, type ArkExtinction, type ArkLostWords} from "@/lib/ark-extinct";

/**
 * "Lost from the Ark" under the population overlay's living list (owner, 2026-11-15): every species the server logged
 * an extinction for, newest first, its icon greyed, "Extinct on Ark day 117 · 13 Nov", how the last one went, and
 * "Back aboard" when a capture brought one back. A row opens the species page. Folded to one line at first (the
 * living list stays the panel's business); nothing at all until `/api/ark/extinct` answers with at least one, so the
 * section hides while the server read is not there. Counts elsewhere are unchanged.
 */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#c8fa63]";

function Row({one, words, locale}: {one: ArkExtinction; words: ArkLostWords; locale: string}) {
    const how = arkExtinctHow(words, one);
    const when = arkExtinctWhen(words.when, one, locale);
    const body = (
        <>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7] ${one.backAboard ? "" : "opacity-60 grayscale"}`}>
                <ArkSpeciesIcon src={one.modelSlug ? arkIconUrl(one.modelSlug) : ARK_PLACEHOLDER_ICON} size={24} className="h-[84%] w-[84%] object-contain" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                    <span className={`truncate text-[13px] font-semibold leading-tight ${one.backAboard ? "" : "text-white/75"}`}>{one.name}</span>
                    {one.backAboard ? <span className="shrink-0 rounded-full bg-[#c8fa63]/15 px-1.5 py-px text-[10px] font-bold leading-tight text-[#c8fa63]">{words.back}</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/50">{when}</span>
                {how ? <span className="block truncate text-[11px] leading-tight text-white/40">{how}</span> : null}
            </span>
        </>
    );
    const label = [one.name, when, how, one.backAboard ? words.back : null].filter(Boolean).join(", ");
    const row = "flex min-h-11 w-full items-center gap-2.5 px-3.5 py-1.5 text-left";
    return (
        <li>
            {one.pageSlug ? (
                <Link href={`/animals/${one.pageSlug}`} aria-label={label} className={`${row} transition-colors hover:bg-white/[0.06] ${FOCUS}`}>{body}</Link>
            ) : (
                <div aria-label={label} className={row}>{body}</div>
            )}
        </li>
    );
}

export default function ArkLostList({words, locale}: {words: ArkLostWords; locale: string}) {
    const id = useId();
    const [list, setList] = useState<ArkExtinction[]>([]);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let live = true;
        void fetchArkExtinct().then((answer) => {
            if (live && answer.available) setList(answer.extinctions);
        });
        return () => {
            live = false;
        };
    }, []);
    if (!list.length) return null;
    return (
        <div className="border-t border-white/[0.08]" data-ark-lost={list.length}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls={id}
                className={`flex min-h-11 w-full items-center gap-2 px-3.5 text-left text-[12px] font-bold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white md:min-h-9 ${FOCUS}`}
            >
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8a8579]" />
                <span className="flex-1">{words.title}</span>
                <span className="tabular-nums text-white/50">{list.length.toLocaleString(locale)}</span>
                <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 opacity-75 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 7.5l5 5 5-5" />
                </svg>
            </button>
            <div id={id} hidden={!open}>
                <p className="px-3.5 pb-1 text-[11px] leading-snug text-white/45">{words.intro}</p>
                <ul aria-label={words.listLabel} className="max-h-[22svh] overflow-y-auto md:max-h-[14rem] overscroll-contain pb-1 [scrollbar-width:thin]">
                    {list.map((one) => <Row key={one.speciesProfileId} one={one} words={words} locale={locale} />)}
                </ul>
            </div>
        </div>
    );
}
