import type {ArkSnapshot} from "@/ark-scene/types";
import {arkRankedSpecies} from "@/lib/ark-population-change";
import {localeConfig} from "@/i18n";
import {getLocalePath} from "@/lib/site";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * /ark in words, rendered on the server (Part 4d): what the Ark is, how
 * animals arrive, the live counts, how stored diets and breeding drive it,
 * and every species aboard with a link to its page. Search engines and
 * readers without WebGL get the Ark from here; the 3D world above is the
 * same Ark drawn.
 *
 * Decision 239: the population overlay over the world is the list of who is aboard now, so the long list by region
 * that stood here is a compact one, folded: every species biggest first with its count, each linked to its page
 * (for search and for readers without WebGL), and a link up to the overlay. The list is one HTML string (decision
 * 246): a thousand server-rendered rows would otherwise be a thousand nodes in the page's payload for React to walk
 * on load; as a string it is one prop, never hydrated row by row.
 *
 * Counts and species only: never who brought an animal, never a problem or a chat.
 */

type Props = {
    snapshot: ArkSnapshot | null;
    words: ArkWords;
    locale: string;
    /** Species page slugs that exist and are indexable: only those are linked. */
    speciesPages: ReadonlySet<string>;
};

function escaped(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale));
}

export default function ArkAbout({snapshot, words, locale, speciesPages}: Props) {
    const seo = words.seo;
    const species = arkRankedSpecies(snapshot);
    const siteLocale = localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
    const number = (value: number) => value.toLocaleString(locale);
    const live = !snapshot
        ? words.unavailable
        : snapshot.counts.animals === 0
            ? words.empty
            : fillArkWords(seo.liveCounts, {
                animals: counted(snapshot.counts.animals, words.animalsOne, words.animalsOther, locale),
                species: counted(snapshot.counts.species, words.speciesOne, words.speciesOther, locale)
            });
    return (
        <section aria-labelledby="ark-about" className="border-b border-line-200">
            <div className="mx-auto grid w-full max-w-[86rem] grid-cols-1 gap-10 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
                <div className="flex max-w-2xl flex-col gap-8">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{seo.aboutEyebrow}</p>
                        <h2 id="ark-about" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{seo.aboutTitle}</h2>
                        <p className="mt-3 text-base leading-relaxed text-ink-200">{seo.aboutBody}</p>
                        <p className="mt-3 text-base font-semibold leading-relaxed text-white">{live}</p>
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-extrabold text-white">{seo.arriveTitle}</h3>
                        <p className="mt-2 text-base leading-relaxed text-ink-200">{seo.arriveBody}</p>
                    </div>
                    <div>
                        <h3 className="font-display text-xl font-extrabold text-white">{seo.lifeTitle}</h3>
                        <p className="mt-2 text-base leading-relaxed text-ink-200">{seo.lifeBody}</p>
                        <p className="mt-3 text-base leading-relaxed text-ink-200">{seo.lifeRules}</p>
                        <p className="mt-3 text-[13px] leading-relaxed text-ink-400">{seo.lifeNote}</p>
                    </div>
                </div>

                <div className="min-w-0">
                    <h3 className="font-display text-xl font-extrabold text-white">{seo.listTitle}</h3>
                    {species.length ? (
                        <>
                            <p className="mt-2 text-[14px] leading-relaxed text-ink-300">
                                {words.hud.listIntro}{" "}
                                {/* The overlay over the world opens at its hash (`ark-population-hud.tsx`). */}
                                <a href="#ark-aboard" className="whitespace-nowrap font-bold text-primary-300 underline-offset-4 hover:underline">
                                    {words.hud.openList}
                                    <span aria-hidden="true"> ↑</span>
                                </a>
                            </p>
                            <details className="group mt-4 border-y border-line-300">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[14px] font-bold text-white [&::-webkit-details-marker]:hidden">
                                    {fillArkWords(words.hud.allSpecies, {count: number(species.length)})}
                                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7.5l5 5 5-5" /></svg>
                                </summary>
                                {/* Biggest first, in columns: a name (linked to its page when it has one) and its count per line. */}
                                <ul
                                    className="columns-2 gap-x-6 pb-3 text-[13px] leading-6 sm:columns-3 [&_a]:min-w-0 [&_a]:truncate [&_a]:text-ink-100 [&_a]:underline-offset-4 [&_a:hover]:text-primary-200 [&_a:hover]:underline [&_b]:min-w-0 [&_b]:truncate [&_b]:font-normal [&_b]:text-ink-100 [&_i]:shrink-0 [&_i]:not-italic [&_i]:tabular-nums [&_i]:text-ink-400 [&_li]:flex [&_li]:min-h-6 [&_li]:break-inside-avoid [&_li]:items-baseline [&_li]:justify-between [&_li]:gap-2"
                                    dangerouslySetInnerHTML={{__html: species.map((row) => `<li>${speciesPages.has(row.slug) ? `<a href="${escaped(getLocalePath(siteLocale, `/animals/${row.slug}`))}">${escaped(row.name)}</a>` : `<b>${escaped(row.name)}</b>`}<i>${escaped(number(row.count))}</i></li>`).join("")}}
                                />
                            </details>
                        </>
                    ) : (
                        <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{snapshot ? words.empty : words.unavailable}</p>
                    )}
                </div>
            </div>
        </section>
    );
}
