import Link from "@/app/[locale]/_components/link";
import type {ArkFoodChainEntry, ArkFoodChainSpecies} from "@/lib/ark-food-chain";

/**
 * One species' food links aboard the Ark (SEO lane S3): what it eats, rule by
 * rule with the field guide's words, and what eats it. No hooks, so the server
 * renders it inside the explorer and in the compact embed, and crawlers read it.
 */

export type ArkFoodChainWords = {
    aboardOne: string;
    aboardOther: string;
    eats: string;
    eatenBy: string;
    eatsNone: string;
    eatenByNone: string;
    kept: string;
    pet: string;
    fieldGuide: string;
    about: string;
    seeInArk: string;
    loading: string;
    error: string;
    searchLabel: string;
    searchPlaceholder: string;
    listTitle: string;
    listHint: string;
    noMatch: string;
    showAll: string;
    chooseLabel: string;
};

export const ARK_FOOD_CHAIN_WORD_KEYS: Array<keyof ArkFoodChainWords> = [
    "aboardOne", "aboardOther", "eats", "eatenBy", "eatsNone", "eatenByNone", "kept", "pet", "fieldGuide", "about", "seeInArk",
    "loading", "error", "searchLabel", "searchPlaceholder", "listTitle", "listHint", "noMatch", "showAll", "chooseLabel"
];

export function arkAboardLabel(count: number, words: Pick<ArkFoodChainWords, "aboardOne" | "aboardOther">, locale: string): string {
    return count === 1 ? words.aboardOne : words.aboardOther.replace("{count}", count.toLocaleString(locale));
}

function SpeciesName({species, className}: {species: ArkFoodChainSpecies; className?: string}) {
    return species.page ? (
        <Link href={species.page} className={`underline-offset-4 hover:text-primary-200 hover:underline ${className ?? ""}`}>
            {species.name}
        </Link>
    ) : (
        <span className={className}>{species.name}</span>
    );
}

function Count({count, words, locale}: {count: number; words: ArkFoodChainWords; locale: string}) {
    return <span className="shrink-0 tabular-nums text-ink-400">{arkAboardLabel(count, words, locale)}</span>;
}

type Props = {
    entry: ArkFoodChainEntry;
    words: ArkFoodChainWords;
    locale: string;
    /** The Ark's path in the reader's locale ("/ark", "/id/ark"). */
    arkHref: string;
    headingLevel: 2 | 3 | 4;
    /** The panel's heading id (the explorer's live region points at it). */
    headingId?: string;
};

export default function ArkFoodChainPanel({entry, words, locale, arkHref, headingLevel, headingId}: Props) {
    const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
    const Sub = `h${Math.min(headingLevel + 1, 6)}` as "h3" | "h4" | "h5";
    const {species} = entry;
    return (
        <article className="flex min-w-0 flex-col gap-5" aria-labelledby={headingId}>
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Heading id={headingId} className="font-display text-2xl font-extrabold text-white md:text-3xl">
                    <SpeciesName species={species} />
                </Heading>
                <p className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold">
                    <Count count={species.aboard} words={words} locale={locale} />
                    <Link href={`${arkHref}?focus=${encodeURIComponent(species.slug)}`} locale={locale} className="text-primary-200 underline-offset-4 hover:underline">
                        {words.seeInArk} <span aria-hidden="true">→</span>
                    </Link>
                </p>
            </header>

            {entry.kept ? <p className="text-[15px] leading-relaxed text-ink-300">{words.kept}</p> : null}

            {!entry.kept ? (
                <section>
                    <Sub className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.eats}</Sub>
                    {entry.eats.length ? (
                        <ul className="mt-2 flex flex-col gap-3">
                            {entry.eats.map((rule, index) => (
                                <li key={`${rule.phrase ?? rule.group ?? "rule"}-${index}`} className="border-l-2 border-primary-400/40 pl-3">
                                    {rule.phrase ? (
                                        <p className="text-[13px] italic leading-relaxed text-ink-300">{words.fieldGuide.replace("{phrase}", rule.phrase)}</p>
                                    ) : null}
                                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                                        {rule.prey.map((prey) => (
                                            <li key={prey.id} className="flex items-baseline gap-1.5">
                                                <SpeciesName species={prey} className="font-bold text-white" />
                                                <Count count={prey.aboard} words={words} locale={locale} />
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{words.eatsNone}</p>
                    )}
                </section>
            ) : null}

            {!entry.kept ? (
                <section>
                    <Sub className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{words.eatenBy}</Sub>
                    {entry.neverPrey ? (
                        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{words.pet}</p>
                    ) : entry.eatenBy.length ? (
                        <ul className="mt-2 flex flex-col gap-2">
                            {entry.eatenBy.map((item) => (
                                <li key={item.predator.id} className="flex flex-col gap-0.5 border-b border-line-300/60 pb-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                                    <span className="flex items-baseline gap-1.5 text-[15px]">
                                        <SpeciesName species={item.predator} className="font-bold text-white" />
                                        <Count count={item.predator.aboard} words={words} locale={locale} />
                                    </span>
                                    {item.phrase ? <span className="text-[13px] italic text-ink-400">{words.fieldGuide.replace("{phrase}", item.phrase)}</span> : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{words.eatenByNone}</p>
                    )}
                </section>
            ) : null}

            {species.page ? (
                <p className="text-sm">
                    <Link href={species.page} className="font-bold text-primary-200 underline-offset-4 hover:underline">
                        {words.about.replace("{animal}", species.name)} <span aria-hidden="true">→</span>
                    </Link>
                </p>
            ) : null}
        </article>
    );
}
