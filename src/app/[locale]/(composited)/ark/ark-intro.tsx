import Link from "@/app/[locale]/_components/link";
import type {ArkSnapshot} from "@/ark-scene/types";
import type {ArkRecentArrival} from "@/lib/ark-recent-arrivals";
import type {ArkIntroWords} from "@/lib/ark-words";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";

export type {ArkIntroWords};

/**
 * The band over the world (owner, 2026-11-14: "way too much text for casual viewers"; it replaced CC 3's three
 * paragraphs). Rendered on the server so a crawler or a reader without WebGL gets it before the scene:
 *
 * - the page's one heading, "AnimalDex Ark" (what people search for), and one short line;
 * - the live figures (animals · species · people), the same counts the page has always shown, never made up;
 * - "How the Ark works" (the long explanation lives there and in the words under the world);
 * - the species that most recently came aboard, each linked to its page, on one line that never wraps: it scrolls
 *   sideways and fades at its end instead.
 *
 * Its height is fixed per breakpoint (`ARK_INTRO_HEIGHT`) so the world under it fills the rest of the screen and the
 * band can never run into it. Species and counts only: never who brought one.
 */

/** The band's height: the world under it is the screen less the header and this (`ark-view.tsx`). */
export const ARK_INTRO_HEIGHT = "[--ark-intro-h:8.25rem] md:[--ark-intro-h:8.75rem] lg:[--ark-intro-h:5.75rem]";

export default function ArkIntro({words, counts, arrivals, locale, howHref}: {
    words: ArkIntroWords;
    counts: ArkSnapshot["counts"] | null;
    arrivals: ArkRecentArrival[] | null;
    locale: string;
    howHref: string;
}) {
    const number = (value: number) => value.toLocaleString(locale);
    const day = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", timeZone: "UTC"});
    const figures = counts && counts.animals
        ? [{value: counts.animals, label: words.animals}, {value: counts.species, label: words.species}, {value: counts.founders, label: words.people}]
        : null;
    return (
        <section aria-labelledby="ark-title" data-ark-intro="" className="-mt-8 h-[var(--ark-intro-h)] overflow-hidden border-b border-white/[0.08] bg-canvas-950">
            <div className="mx-auto grid h-full w-full max-w-[86rem] grid-cols-[minmax(0,1fr)_auto] content-center items-center gap-x-4 gap-y-1.5 px-4 [grid-template-areas:'title_figures'_'tag_tag'_'latest_latest'] md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-6 md:gap-y-2 md:px-8 md:[grid-template-areas:'title_figures_how'_'tag_tag_tag'_'latest_latest_latest'] lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:[grid-template-areas:'title_tag_figures_how'_'latest_latest_latest_latest']">
                <div className="flex min-w-0 items-center gap-2 [grid-area:title]">
                    <h1 id="ark-title" className="whitespace-nowrap font-display text-[19px] [@media(max-width:359px)]:text-[17px] font-extrabold leading-none tracking-tight text-white md:text-[22px]">
                        {words.title}
                    </h1>
                    {/* On a phone the way to the long explanation is a small "i" beside the name (its words show from md). */}
                    <Link href={howHref} aria-label={words.how} title={words.how} className="-my-2 inline-flex h-9 w-9 [@media(max-width:359px)]:hidden shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:text-primary-200 md:hidden">
                        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                            <circle cx="10" cy="10" r="7.5" />
                            <path d="M10 9v4.5M10 6.4v.1" />
                        </svg>
                    </Link>
                </div>
                <p title={words.tagline} className="min-w-0 truncate text-[13px] leading-5 text-ink-300 [grid-area:tag] md:text-[14px]">{words.tagline}</p>

                {figures ? (
                    <dl aria-label={words.figuresLabel} className="flex items-start gap-3.5 [grid-area:figures] [@media(max-width:359px)]:gap-2.5 md:gap-5">
                        {figures.map((figure) => (
                            <div key={figure.label} className="flex flex-col-reverse items-start">
                                <dt className="text-[10.5px] font-semibold uppercase leading-4 tracking-[0.12em] text-ink-400 [@media(max-width:359px)]:tracking-normal">{figure.label}</dt>
                                <dd className="font-display text-[16px] font-extrabold leading-5 tabular-nums text-white md:text-[18px] md:leading-6">{number(figure.value)}</dd>
                            </div>
                        ))}
                    </dl>
                ) : <span className="[grid-area:figures]" />}

                <Link href={howHref} className="hidden min-h-9 items-center gap-1.5 justify-self-end whitespace-nowrap rounded-full border border-white/15 px-4 text-[13px] font-bold text-primary-300 transition-colors [grid-area:how] hover:border-primary-300 hover:text-primary-200 md:inline-flex">
                    {words.how}
                    <span aria-hidden="true" className="[[dir=rtl]_&]:rotate-180">→</span>
                </Link>

                {arrivals && arrivals.length ? (
                    <div className="flex min-w-0 items-center gap-3 [grid-area:latest]">
                        <p aria-hidden="true" className="shrink-0 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.latest}</p>
                        {/* One line, never wrapped: it scrolls sideways (a swipe, a trackpad, Tab through the links) and fades at its end. */}
                        <ul
                            aria-label={words.latestAria}
                            className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto overscroll-x-contain whitespace-nowrap text-[13px] leading-6 [-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)] [mask-image:linear-gradient(to_right,#000_calc(100%-3rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [[dir=rtl]_&]:[-webkit-mask-image:linear-gradient(to_left,#000_calc(100%-3rem),transparent)] [[dir=rtl]_&]:[mask-image:linear-gradient(to_left,#000_calc(100%-3rem),transparent)]"
                        >
                            {arrivals.map((arrival) => {
                                const inner = (
                                    <>
                                        {arrival.name}{" "}
                                        <time dateTime={arrival.at} className="text-ink-400">{day.format(new Date(arrival.at))}</time>
                                    </>
                                );
                                return (
                                    <li key={arrival.speciesProfileId} className="shrink-0 last:[padding-inline-end:3rem]">
                                        {arrival.slug && isPublishedAnimalSlug(arrival.slug) ? (
                                            <Link href={`/animals/${arrival.slug}`} className="text-ink-100 underline-offset-4 hover:text-primary-200 hover:underline">{inner}</Link>
                                        ) : (
                                            <span className="text-ink-100">{inner}</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
