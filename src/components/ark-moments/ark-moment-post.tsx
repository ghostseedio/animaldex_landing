"use client";

/**
 * An Ark moment in the Discover feed (`lib/ark-moments.ts`; iOS `ArkMomentDiscoverPostView`, Android `ArkMomentPost`):
 * one feed page beside the feedback poll. Flush edge-to-edge bands, no inset card and no gaps: the Ark band (mark,
 * time, "Not now"), the species' icon art on its Ark zone's tint (contract "Zone tint") (phase 1: the species' icon, never called a photo),
 * then the title, the facts line, the named bringer when there is one, and "See it in the Ark" (the Ark opened on the
 * animal, following it) or "Open the Ark". Marked seen once, the first time at least half of it is on screen.
 */

import {useEffect, useRef, useState, type CSSProperties} from "react";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {arkMomentAgo, arkMomentCaption, arkMomentHref, type ArkMoment, type ArkMomentWords} from "@/lib/ark-moments";

/** The sailboat the Ark's bands use. */
function ArkMark({className}: {className: string}) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 14h18l-2.2 4.2a2 2 0 0 1-1.8 1.1H7a2 2 0 0 1-1.8-1.1L3 14Z" />
            <path d="M7 14V9.5h10V14" />
            <path d="M12 9.5V5.5M10 5.5h4" />
        </svg>
    );
}

/** The contract's zone tints (the same on iOS, Android and the web): a radial gradient, centre at 50% 40%. */
const ZONE_TINTS: Record<string, readonly [string, string]> = {
    woodland: ["#2F5A3A", "#13261A"],
    rainforest: ["#2C6340", "#10281A"],
    grassland: ["#6B6A2E", "#2A2A12"],
    desert: ["#7A5A32", "#2E2112"],
    mountains: ["#4D5866", "#1C2229"],
    polar: ["#5D7480", "#1F2A30"],
    wetland: ["#2F6B61", "#142B27"],
    river_lake: ["#2E5F78", "#11252F"],
    seashore: ["#6E6447", "#2A261A"],
    coral_reef: ["#2F6F80", "#112A31"],
    open_ocean: ["#22507A", "#0D1F30"],
    farm_garden: ["#5A6A2F", "#232A12"]
};
const DEFAULT_TINT = ["#2F3A36", "#141816"] as const;

/** Extinction: flat and plain. The Ark's total has no species: the default tint. */
function zoneTint(moment: ArkMoment): CSSProperties {
    if (moment.kind === "extinction") return {background: "#101413"};
    const [centre, edge] = (moment.kind !== "ark_milestone" && moment.zone ? ZONE_TINTS[moment.zone] : undefined) ?? DEFAULT_TINT;
    return {background: `radial-gradient(circle at 50% 40%, ${centre} 0%, ${edge} 100%)`};
}

export default function ArkMomentPost({
    moment,
    words,
    locale,
    onSeen,
    onDismiss
}: {
    moment: ArkMoment;
    words: ArkMomentWords;
    locale: string;
    onSeen: (moment: ArkMoment) => void;
    onDismiss: (moment: ArkMoment) => void;
}) {
    const ref = useRef<HTMLElement | null>(null);
    const seenRef = useRef(false);
    /** The icon: the exact `animals/<slug>.webp` first (as chat avatars), then the artwork resolver's relatives, then the Ark mark. */
    const [iconStage, setIconStage] = useState<"exact" | "resolved" | "none">("exact");
    const caption = arkMomentCaption(moment, words, locale);
    const ago = arkMomentAgo(moment.happenedAt, locale);
    const extinct = moment.kind === "extinction";
    const slug = moment.kind === "ark_milestone" ? null : moment.speciesSlug ?? moment.modelSlug;

    useEffect(() => {
        const node = ref.current;
        if (!node || seenRef.current || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver((entries) => {
            if (seenRef.current || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
            seenRef.current = true;
            observer.disconnect();
            onSeen(moment);
        }, {threshold: [0.5]});
        observer.observe(node);
        return () => observer.disconnect();
    }, [moment, onSeen]);

    return (
        <article
            ref={ref}
            aria-label={caption.title}
            className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-black pt-[calc(4.75rem+env(safe-area-inset-top,0px))] [scrollbar-width:none] lg:pt-0 [&::-webkit-scrollbar]:hidden"
            data-testid="ark-moment-post"
            data-moment-kind={moment.kind}
        >
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#141816] px-4 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400 text-black">
                    <ArkMark className="h-3.5 w-3.5" />
                </span>
                <span className="text-[12px] font-black uppercase tracking-[0.14em] text-primary-200/90">{words.label}</span>
                {ago ? <span className="truncate text-[12px] font-semibold text-white/45">· {ago}</span> : null}
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={() => onDismiss(moment)}
                    className="min-h-8 shrink-0 px-1 text-[12px] font-bold text-white/55 hover:text-white"
                    data-testid="ark-moment-dismiss"
                >
                    {words.notNow}
                </button>
            </div>

            <div className="relative flex min-h-[11rem] w-full flex-1 items-center justify-center overflow-hidden lg:max-h-[30rem]" style={zoneTint(moment)}>
                {slug && iconStage !== "none" ? (
                    // The species' hand-made icon, not a photo.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={iconStage === "exact" ? getSpeciesArtworkUrl(slug) : `/api/species-artwork/${encodeURIComponent(slug)}?size=640`}
                        alt={moment.speciesName ?? ""}
                        className={`aspect-square w-[45%] max-w-[18rem] object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] ${extinct ? "opacity-70" : ""}`}
                        onError={() => setIconStage((stage) => (stage === "exact" ? "resolved" : "none"))}
                        // The resolver answers its "no image" placeholder when nothing matches: the Ark mark instead.
                        onLoad={(event) => { if (event.currentTarget.currentSrc.includes("species-no-image")) setIconStage("none"); }}
                        data-testid="ark-moment-icon"
                    />
                ) : (
                    <ArkMark className={`h-24 w-24 ${extinct ? "text-white/30" : "text-white/70"}`} />
                )}
            </div>

            <div className="flex shrink-0 flex-col gap-1 border-t border-white/[0.06] bg-[#141816] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] pt-3.5 lg:pb-4">
                <h2 className="line-clamp-3 font-display text-[19px] font-black leading-6 text-white">{caption.title}</h2>
                <p className="text-[13px] font-semibold leading-5 text-white/55" data-testid="ark-moment-facts">{caption.facts}</p>
                {caption.credit ? <p className="text-[13px] font-bold leading-5 text-primary-200" data-testid="ark-moment-credit">{caption.credit}</p> : null}
                <Link
                    href={arkMomentHref(moment)}
                    className="mt-2.5 flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary-400 px-6 text-[14px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    data-testid="ark-moment-open"
                >
                    {moment.focusAnimalId ? words.seeInArk : words.openArk}
                    <span aria-hidden="true">▸</span>
                </Link>
            </div>
        </article>
    );
}
