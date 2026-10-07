import Link from "@/app/[locale]/_components/link";
import {
    getExpandedRankingEntries,
    getRankingHeadline,
    getRankingPage,
    RANKING_CANONICAL_BASE_PATH,
    RankingEntry
} from "@/data/rankings";
import {getSpeciesBySlug} from "@/data/species";
import {
    TIER_LIST_HUB_ANSWER_SLUGS,
    TIER_LIST_HUB_LANGUAGE_LINKS,
    TierListHubAnswerSlug,
    TierListHubLeaders
} from "@/data/tier-list-hub-translations";

export type TierListHubAnswer = {
    slug: TierListHubAnswerSlug;
    href: string;
    headline: string;
    /** Top three species names, #1 first. */
    names: [string, string, string];
    leaderReason: string;
};

/**
 * Hub answers come from the same ranking data as the list pages, so the hub
 * cannot drift from them. Stat-ordered tables (fastest, smartest) sort by the
 * catalog stat profile, which puts niche species first; their curated
 * `entries` are the headline answer the list page itself gives, so those are
 * used. Curated lists use the resolved table order (curated picks pinned first).
 */
export function getTierListHubAnswers(): TierListHubAnswer[] {
    return TIER_LIST_HUB_ANSWER_SLUGS.flatMap((slug): TierListHubAnswer[] => {
        const page = getRankingPage(slug);
        if (!page) {
            return [];
        }

        const ordered: RankingEntry[] = page.statRankingKey
            ? [...page.entries].sort((left, right) => left.rank - right.rank)
            : getExpandedRankingEntries(page);
        const top = ordered
            .map((entry) => ({entry, species: getSpeciesBySlug(entry.speciesSlug)}))
            .filter((item) => Boolean(item.species))
            .slice(0, 3);

        if (top.length < 3) {
            return [];
        }

        return [{
            slug,
            href: `${RANKING_CANONICAL_BASE_PATH}/${slug}`,
            headline: getRankingHeadline(page),
            names: [top[0].species!.name, top[1].species!.name, top[2].species!.name],
            leaderReason: top[0].entry.shortReason
        }];
    });
}

export function getTierListHubLeaders(answers: TierListHubAnswer[]): TierListHubLeaders {
    const leader = (slug: TierListHubAnswerSlug) => answers.find((answer) => answer.slug === slug)?.names[0] ?? "";

    return {
        fastest: leader("fastest-animals"),
        strongest: leader("strongest-animals"),
        smartest: leader("smartest-animals"),
        dangerous: leader("most-dangerous-animals")
    };
}

export type TierListHubFaqItem = {question: string; answer: string};

export function buildTierListHubFaqSchema(items: TierListHubFaqItem[], inLanguage: string) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage,
        mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };
}

export type TierListHubQuickAnswerItem = {
    slug: string;
    href: string;
    label: string;
    leader: string;
    followedBy: string;
};

export function TierListHubIntro({title, paragraphs}: {title: string; paragraphs: string[]}) {
    return (
        <section className="w-[calc(100vw-2rem)] max-w-full md:w-auto md:max-w-4xl">
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{title}</h2>
            {paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-base leading-7 text-ink-200 md:text-lg md:leading-8">{paragraph}</p>
            ))}
            <ul className="mt-4 flex flex-wrap gap-2" aria-hidden="true">
                {["S", "A", "B", "C", "D"].map((tier) => (
                    <li key={tier} className="flex h-9 w-9 items-center justify-center rounded-md border border-line-300 bg-surface-900/70 font-display text-base font-bold text-primary-100">
                        {tier}
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function TierListHubQuickAnswers({
    title,
    description,
    items,
    viewListLabel
}: {
    title: string;
    description: string;
    items: TierListHubQuickAnswerItem[];
    viewListLabel: string;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="tier-list-quick-answers" className="w-[calc(100vw-2rem)] max-w-full md:w-auto">
            <h2 id="tier-list-quick-answers" className="font-display text-3xl font-bold text-white">{title}</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300">{description}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <li key={item.slug}>
                        <Link
                            href={item.href}
                            className="flex h-full flex-col rounded-lg border border-line-300 bg-surface-900/75 p-5 transition-colors hover:border-primary-500/50 focus-visible:border-primary-500/50"
                        >
                            <span className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-200">{item.label}</span>
                            <span className="mt-2 font-display text-2xl font-bold text-white">{item.leader}</span>
                            <span className="mt-1 text-sm leading-6 text-ink-300">{item.followedBy}</span>
                            <span className="mt-4 text-sm font-semibold text-primary-100">{viewListLabel} →</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function TierListHubFaq({title, items}: {title: string; items: TierListHubFaqItem[]}) {
    return (
        <section aria-labelledby="tier-list-hub-faq" className="w-[calc(100vw-2rem)] max-w-full md:w-auto">
            <h2 id="tier-list-hub-faq" className="font-display text-3xl font-bold text-white">{title}</h2>
            <div className="mt-5 grid gap-3">
                {items.map((item) => (
                    <div key={item.question} className="rounded-lg border border-line-300 bg-surface-900/75 p-5">
                        <h3 className="font-display text-lg font-bold text-white">{item.question}</h3>
                        <p className="mt-3 text-base leading-7 text-ink-200">{item.answer}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function TierListHubLanguageLinks({label, current}: {label: string; current: string}) {
    return (
        <nav aria-label={label} className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
            <span>{label}:</span>
            {TIER_LIST_HUB_LANGUAGE_LINKS.filter((item) => item.language !== current).map((item) => (
                <a
                    key={item.language}
                    href={item.href}
                    hrefLang={item.language}
                    lang={item.language}
                    className="rounded-md border border-line-300 bg-surface-900/70 px-3 py-1.5 font-semibold text-white transition-colors hover:border-primary-500/50 hover:text-primary-100"
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}
