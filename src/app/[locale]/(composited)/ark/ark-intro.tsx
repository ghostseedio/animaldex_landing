import Link from "@/app/[locale]/_components/link";
import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkRecentArrival} from "@/lib/ark-recent-arrivals";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";

export type ArkIntroWords = {
    what: string;
    arrive: string;
    /** "{animals}", "{species}" and "{founders}" are filled with the live counts. */
    counts: string;
    countsUnavailable: string;
    recentTitle: string;
    recentAria: string;
};

/**
 * Above the world (CC 3, 2026-11-13), rendered on the server so a crawler or
 * a reader without WebGL gets it before the scene: three short lines (what
 * the Ark is, how animals arrive, who is aboard now, each living by rules
 * based on its field guide) and the species that most recently came aboard,
 * each linked to its page. Species and counts only: never who brought one.
 */
export default function ArkIntro({label, words, counts, arrivals, locale}: {
    label: string;
    words: ArkIntroWords;
    counts: ArkSnapshot["counts"] | null;
    arrivals: ArkRecentArrival[] | null;
    locale: string;
}) {
    const number = (value: number) => value.toLocaleString(locale);
    const countsLine = counts && counts.animals
        ? words.counts.replace("{animals}", number(counts.animals)).replace("{species}", number(counts.species)).replace("{founders}", number(counts.founders))
        : words.countsUnavailable;
    const day = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", timeZone: "UTC"});
    return (
        <section aria-label={label} className="border-b border-line-200 bg-canvas-950">
            <div className="mx-auto flex w-full max-w-[86rem] flex-col gap-4 px-4 py-5 md:px-8 md:py-6">
                <ul className="grid gap-x-8 gap-y-2 text-[15px] leading-relaxed text-ink-200 md:grid-cols-3">
                    <li>{words.what}</li>
                    <li>{words.arrive}</li>
                    <li className="font-semibold text-white">{countsLine}</li>
                </ul>
                {arrivals && arrivals.length ? (
                    <p aria-label={words.recentAria} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] leading-6 text-ink-300">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.recentTitle}</span>
                        {arrivals.map((arrival) => {
                            const inner = (
                                <>
                                    {arrival.name}{" "}
                                    <time dateTime={arrival.at} className="text-ink-400">{day.format(new Date(arrival.at))}</time>
                                </>
                            );
                            return arrival.slug && isPublishedAnimalSlug(arrival.slug) ? (
                                <Link key={arrival.speciesProfileId} href={`/animals/${arrival.slug}`} className="text-ink-100 underline-offset-4 hover:text-primary-200 hover:underline">{inner}</Link>
                            ) : (
                                <span key={arrival.speciesProfileId} className="text-ink-100">{inner}</span>
                            );
                        })}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
