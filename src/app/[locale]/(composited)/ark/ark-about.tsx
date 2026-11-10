import Link from "@/app/[locale]/_components/link";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkPopulation} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/**
 * /ark in words, rendered on the server (Part 4d): what the Ark is, how
 * animals arrive, the live counts, how stored diets and breeding drive it,
 * and every species aboard with a link to its page. Search engines and
 * readers without WebGL get the Ark from here; the 3D world above is the
 * same Ark drawn.
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

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale));
}

export default function ArkAbout({snapshot, words, locale, speciesPages}: Props) {
    const seo = words.seo;
    const population = arkPopulation(snapshot);
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
                    {population.species ? (
                        <>
                            <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{seo.listIntro}</p>
                            <div className="mt-4 flex flex-col gap-5">
                                {population.regions.map((group) => (
                                    <div key={group.region}>
                                        <h4 className="flex items-baseline justify-between border-b border-line-300 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300">
                                            <span>{words.regions[group.region]}</span>
                                            <span className="tabular-nums font-semibold tracking-normal text-ink-400">{number(group.animals)}</span>
                                        </h4>
                                        <ul className="mt-1">
                                            {group.species.map((row) => (
                                                <li key={row.key} className="flex items-baseline justify-between gap-3 border-b border-line-300/60 py-2 text-[14px]">
                                                    {speciesPages.has(row.slug) ? (
                                                        <Link href={`/animals/${row.slug}`} className="font-bold text-white underline-offset-4 hover:text-primary-200 hover:underline">
                                                            {row.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-bold text-white">{row.name}</span>
                                                    )}
                                                    <span className="shrink-0 text-ink-300">
                                                        {fillArkWords(seo.listAboard, {count: number(row.count)})}
                                                        <span className="text-ink-400"> · {words.hud[row.status]}</span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="mt-2 text-[14px] leading-relaxed text-ink-300">{snapshot ? words.empty : words.unavailable}</p>
                    )}
                </div>
            </div>
        </section>
    );
}
