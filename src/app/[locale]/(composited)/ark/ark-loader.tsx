"use client";

import React, {useEffect, useState} from "react";
import ArkSpeciesIcon from "@/app/[locale]/(composited)/ark/ark-species-icon";
import {ARK_GLASS} from "@/app/[locale]/(composited)/ark/ark-world-tools";
import {ARK_PLACEHOLDER_ICON, arkIconUrl} from "@/ark-scene/placeholder-icon";
import {arkAgoText, arkLoaderStageText, arkLoadProgress, arkLoadStage, arkLoadWorking, type ArkLoadState} from "@/lib/ark-loading";
import type {ArkWords} from "@/lib/ark-words";

/** The newest arrival the card names: the species, its icon's slug, and when it came aboard (real data only). */
export type ArkLoaderNewest = {name: string; slug: string | null; at: string};

/** After the opening view's animals are in, the card fades for this long, then goes. */
const FADE_MS = 450;

/**
 * /ark's loading card (lib/ark-loading.ts), over the world in the notices' place under the toolbar (decision 239's
 * column: the first place on screen over the world, on a phone too, now that the intro sits above it). Dark glass, like
 * the toolbar and the notices.
 *
 *   ● Building the island
 *   ▬▬▬▬▬▬▬▬▬▬▬────────────     the bar: real steps only; the step under way a still tint
 *   (icon) NEWEST ABOARD
 *          Fischer's Lovebird · 2 hours ago
 *
 * The newest arrival is the server's (the page's "Latest aboard"), or the Ark's own once read. The counts are the
 * population chip's, beside it, so they are not said twice. A screen reader hears the stage as it changes; the bar is
 * a progressbar with the stage as its text.
 */
export default function ArkLoaderCard({state, words, newest, locale}: {state: ArkLoadState; words: ArkWords; newest: ArkLoaderNewest | null; locale: string}) {
    // The icon is asked for once the world is drawn (17 KB was 0.1 s to the first frame on slow 4G): until then its circle.
    const showIcon = state.frame;
    const stage = arkLoadStage(state);
    const progress = arkLoadProgress(state);
    const working = arkLoadWorking(state);
    const text = arkLoaderStageText(stage, words.loader);
    // "2 hours ago" once on the client (the server's clock and the reader's would not agree on a render).
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => setNow(new Date()), []);
    // Done: a short fade, then nothing.
    const [gone, setGone] = useState(false);
    useEffect(() => {
        if (stage !== "done") return;
        const timer = setTimeout(() => setGone(true), FADE_MS);
        return () => clearTimeout(timer);
    }, [stage]);
    if (gone) return null;
    const percent = Math.round(progress * 100);
    return (
        <div
            data-ark-loader={stage}
            className={`${ARK_GLASS} pointer-events-auto w-full max-w-[20rem] rounded-2xl px-3.5 pb-3 pt-2.5 transition-opacity duration-[450ms] ease-out motion-reduce:transition-none ${stage === "done" ? "opacity-0" : "opacity-100"}`}
        >
            <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold leading-5">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8fa63] motion-safe:animate-pulse" />
                <span key={stage} className="rows-in min-w-0 truncate">{text}</span>
            </p>
            <div
                role="progressbar"
                aria-label={words.loading}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={text}
                className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.14]"
            >
                <span className="absolute inset-y-0 rounded-full bg-[#c8fa63] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{insetInlineStart: 0, width: `${progress * 100}%`}} />
                {working > 0 ? <span aria-hidden="true" className="ark-load-sheen absolute inset-y-0" style={{insetInlineStart: `${progress * 100}%`, width: `${working * 100}%`}} /> : null}
            </div>
            {newest ? (
                <div className="mt-2.5 flex min-w-0 items-center gap-2.5 border-t border-white/10 pt-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f6f1e7]">
                        {showIcon ? <ArkSpeciesIcon src={newest.slug ? arkIconUrl(newest.slug) : ARK_PLACEHOLDER_ICON} size={36} className="rows-in h-[82%] w-[82%] object-contain" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#c8fa63]">{words.loader.newest}</span>
                            {now ? <span className="shrink-0 text-[11.5px] font-medium text-white/55">{arkAgoText(newest.at, now, locale)}</span> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] font-semibold">{newest.name}</span>
                    </span>
                </div>
            ) : null}
        </div>
    );
}
