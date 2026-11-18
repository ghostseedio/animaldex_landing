"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {ARK_PLACEHOLDER_ICON, arkIconUrl} from "@/ark-scene/placeholder-icon";
import {
    arkCrisisBandWord,
    arkCrisisCountries,
    arkCrisisDuration,
    arkCrisisSeeItPath,
    arkCrisisSummary,
    decodeArkCrises,
    fetchArkCrises,
    type ArkCrisis,
    type ArkCrisesAnswer,
    type ArkEndangeredWords
} from "@/lib/ark-crises";
import {arkCrisesFixture} from "@/lib/ark-crises-fixture";

/**
 * The Endangered now list (text and cards: nothing here needs WebGL, so Ark Lite and a phone with no 3D read the same
 * page). Reads `/api/ark/crises` once on load and every minute while visible; nothing shown is invented: a count, a
 * band, and how long ago the crisis opened. No read, a 404 or an empty list is the calm empty state; only a transport
 * error says "can't check right now".
 */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8fa63]";
const REFRESH_MS = 60_000;

type Props = {words: ArkEndangeredWords; locale: string; lang: string | null; highlight: string | null; fixture: string | null};

function Band({crisis, words}: {crisis: ArkCrisis; words: ArkEndangeredWords}) {
    // An ended crisis says how it ended in its own line below; only an open one has a band.
    if (crisis.status !== "open") return null;
    const last = crisis.band === "last";
    return (
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-tight ${last ? "bg-[#ff8a5b]/20 text-[#ffb08f]" : "bg-[#f2c14e]/20 text-[#f7d37a]"}`}>
            {arkCrisisBandWord(words, crisis)}
        </span>
    );
}

function Card({crisis, words, locale, now, highlighted}: {crisis: ArkCrisis; words: ArkEndangeredWords; locale: string; now: number; highlighted: boolean}) {
    const seeIt = arkCrisisSeeItPath(crisis);
    const countries = arkCrisisCountries(crisis.countries, locale);
    const open = crisis.status === "open";
    return (
        <li
            id={`crisis-${crisis.id}`}
            data-crisis={crisis.id}
            data-band={crisis.band}
            data-status={crisis.status}
            aria-label={arkCrisisSummary(words, crisis, now, locale)}
            className={`flex flex-col gap-4 rounded-2xl border bg-white/[0.04] p-4 md:p-5 ${highlighted ? "border-primary-300 ring-2 ring-primary-300/60" : "border-line-300"}`}
        >
            <div className="flex items-start gap-3">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f6f1e7] ${open ? "" : "opacity-70 grayscale"}`}>
                    <ArkSpeciesIcon src={crisis.modelSlug ? arkIconUrl(crisis.modelSlug) : ARK_PLACEHOLDER_ICON} size={56} className="h-[86%] w-[86%] object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="min-w-0 break-words font-display text-lg font-extrabold leading-tight text-white">{crisis.name}</h3>
                        <Band crisis={crisis} words={words} />
                    </div>
                    {crisis.scientificName ? <p className="mt-0.5 text-[13px] italic leading-snug text-ink-300">{crisis.scientificName}</p> : null}
                </div>
            </div>

            {open ? (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[15px] font-semibold leading-snug text-white">
                    <span>{words.wildCount.replace("{count}", crisis.wildCount.toLocaleString(locale))}</span>
                    <span className="text-ink-300" aria-hidden="true">·</span>
                    <span>{words.openFor.replace("{duration}", arkCrisisDuration(crisis.openedAt, now, locale))}</span>
                </p>
            ) : (
                <p className="text-[15px] font-semibold leading-snug text-white">{crisis.status === "saved" ? words.saved : words.lost}</p>
            )}

            {crisis.habitat || countries.length ? (
                <dl className="flex flex-col gap-2 text-[14px] leading-snug text-ink-200">
                    {crisis.habitat ? (
                        <div className="flex gap-2"><dt className="w-20 shrink-0 font-bold text-ink-300">{words.habitat}</dt><dd className="min-w-0 flex-1">{crisis.habitat}</dd></div>
                    ) : null}
                    {countries.length ? (
                        <div className="flex gap-2"><dt className="w-20 shrink-0 font-bold text-ink-300">{words.foundIn}</dt><dd className="min-w-0 flex-1">{countries.join(", ")}</dd></div>
                    ) : null}
                </dl>
            ) : null}

            {seeIt ? (
                <Link
                    href={seeIt}
                    className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary-400 px-5 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-canvas-950 transition-colors hover:bg-primary-300 ${FOCUS}`}
                >
                    {words.seeInArk} <span aria-hidden="true">→</span>
                </Link>
            ) : null}
        </li>
    );
}

function Skeleton() {
    return (
        <ul aria-hidden="true" className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2].map((one) => (
                <li key={one} className="h-44 animate-pulse rounded-2xl border border-line-300 bg-white/[0.03] motion-reduce:animate-none" />
            ))}
        </ul>
    );
}

export default function ArkEndangeredList({words, locale, lang, highlight, fixture}: Props) {
    const [answer, setAnswer] = useState<ArkCrisesAnswer | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const scrolled = useRef(false);

    const load = useCallback(async () => {
        if (fixture) {
            const decoded = decodeArkCrises(arkCrisesFixture(Date.now(), fixture === "crises-ended").crises) ?? [];
            setAnswer({state: "ready", crises: decoded});
        } else {
            setAnswer(await fetchArkCrises({crisis: highlight, lang}));
        }
        setNow(Date.now());
    }, [fixture, highlight, lang]);

    useEffect(() => {
        void load();
        const timer = setInterval(() => {
            if (typeof document === "undefined" || !document.hidden) void load();
        }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    // A deep link: bring that crisis into view once it is drawn.
    useEffect(() => {
        if (!highlight || scrolled.current || !answer?.crises.some((one) => one.id === highlight)) return;
        scrolled.current = true;
        document.getElementById(`crisis-${highlight}`)?.scrollIntoView({block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }, [answer, highlight]);

    if (!answer) {
        return (
            <div aria-busy="true" data-ark-endangered="loading">
                <Skeleton />
            </div>
        );
    }
    if (answer.state === "error") {
        return (
            <div role="status" data-ark-endangered="error" className="flex flex-col items-start gap-4 rounded-2xl border border-line-300 bg-white/[0.04] p-5">
                <p className="text-base leading-7 text-ink-100">{words.unavailable}</p>
                <button
                    type="button"
                    onClick={() => void load()}
                    className={`inline-flex min-h-11 items-center rounded-full border border-primary-200/50 px-5 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-primary-200 transition-colors hover:border-primary-200 hover:text-white ${FOCUS}`}
                >
                    {words.retry}
                </button>
            </div>
        );
    }
    if (!answer.crises.length) {
        return (
            <div role="status" data-ark-endangered="empty" className="flex flex-col gap-2 rounded-2xl border border-line-300 bg-white/[0.04] p-6 md:p-8">
                <p className="font-display text-xl font-extrabold leading-snug text-white md:text-2xl">{words.empty}</p>
                <p className="max-w-xl text-base leading-7 text-ink-200">{words.emptyHint}</p>
            </div>
        );
    }
    return (
        <ul aria-label={words.listLabel} data-ark-endangered={answer.crises.length} className="grid gap-4 md:grid-cols-2">
            {answer.crises.map((crisis) => (
                <Card key={crisis.id} crisis={crisis} words={words} locale={locale} now={now} highlighted={crisis.id === highlight} />
            ))}
        </ul>
    );
}
