import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import RankingBreadcrumbs from "@/app/[locale]/(composited)/rankings/_components/ranking-breadcrumbs";
import RankingHero from "@/app/[locale]/(composited)/rankings/_components/ranking-hero";
import RankingTable from "@/app/[locale]/(composited)/rankings/_components/ranking-table";
import RankingEntryCard from "@/app/[locale]/(composited)/rankings/_components/ranking-entry-card";
import RankingMethodology from "@/app/[locale]/(composited)/rankings/_components/ranking-methodology";
import RelatedRankingsSection from "@/app/[locale]/(composited)/rankings/_components/related-rankings-section";
import TierLegend from "@/app/[locale]/(composited)/rankings/_components/tier-legend";
import TierListSummary from "@/app/[locale]/(composited)/rankings/_components/tier-list-summary";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import {getChallenge} from "@/data/challenges";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {getExpandedRankingEntries, getRankingPage, getRankingTierListTitle, getRelatedRankings, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {getSpeciesBySlug, speciesEntries, SpeciesEntry} from "@/data/species";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type RankingPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

type RelatedChallengeCard = {
    slug: string;
    title: string;
    quickVerdict: string;
    animalAName: string;
    animalBName: string;
    comparisonTypeLabel: string;
    image?: {src: string; alt: string; width: number; height: number};
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

function getSchemaImageUrl(locale: string, imageSrc: string) {
    return imageSrc.startsWith("http://") || imageSrc.startsWith("https://")
        ? imageSrc
        : getAbsoluteUrl(locale, imageSrc);
}

function getMovementDomain(entry: SpeciesEntry, labels: {air: string; water: string; land: string; mixed: string}) {
    const text = [
        entry.name,
        entry.analysis.category,
        entry.analysis.summary,
        entry.analysis.habitat,
        entry.analysis.nativeRange,
        ...entry.analysis.identification
    ].join(" ").toLowerCase();
    const air = /bird|falcon|eagle|owl|vulture|parrot|flight|flying|aerial|wing|soar|glide/.test(text);
    const water = /aquatic|marine|ocean|sea|river|lake|wetland|coastal|coral|reef|fish|shark|whale|dolphin|tuna|sailfish|swim/.test(text);

    if (air && water) {
        return labels.mixed;
    }

    if (air) {
        return labels.air;
    }

    if (water) {
        return labels.water;
    }

    return labels.land;
}

function estimateReadingMinutes(entriesCount: number, paragraphs: string[]) {
    const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length + entriesCount * 18;

    return Math.max(4, Math.ceil(words / 225));
}

async function getRankingSpeciesEntries() {
    try {
        return await getUnifiedSpeciesEntries();
    } catch (error) {
        console.error("Unable to load unified species catalog for ranking page. Falling back to static species entries.", error);
        return speciesEntries;
    }
}

export async function generateMetadata({params}: RankingPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const ranking = getRankingPage(slug);

    if (!ranking) {
        return {};
    }

    const keywords = [
        ...ranking.searchIntents,
        ranking.category,
        ...ranking.entries.slice(0, 5).map((entry) => getSpeciesBySlug(entry.speciesSlug)?.name || entry.speciesSlug)
    ];

    return buildContentMetadata({
        locale,
        pathname: `${RANKING_CANONICAL_BASE_PATH}/${ranking.slug}`,
        title: getRankingTierListTitle(ranking),
        description: ranking.description,
        keywords,
        featuredImage: ranking.featuredImage,
        publishedAt: ranking.publishedAt,
        updatedAt: ranking.updatedAt,
        tags: [ranking.category, ...ranking.entries.slice(0, 3).map((entry) => entry.speciesSlug)]
    });
}

export default async function RankingDetailPage({params}: RankingPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "rankings");
    const ranking = getRankingPage(slug);

    if (!ranking) {
        notFound();
    }

    const rankingSpeciesEntries = ranking.statRankingKey ? await getRankingSpeciesEntries() : speciesEntries;
    const rankingSpeciesBySlug = new Map(rankingSpeciesEntries.map((entry) => [entry.slug, entry]));
    const resolvedEntries = getExpandedRankingEntries(ranking, undefined, rankingSpeciesEntries).map((entry) => {
        const species = rankingSpeciesBySlug.get(entry.speciesSlug) ?? getSpeciesBySlug(entry.speciesSlug);

        if (!species) {
            return null;
        }

        return {
            ...entry,
            species
        };
    });

    if (resolvedEntries.some((entry) => !entry)) {
        notFound();
    }

    const entries = resolvedEntries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const title = getRankingTierListTitle(ranking);
    const domainLabels = {
        air: t("domainAir"),
        water: t("domainWater"),
        land: t("domainLand"),
        mixed: t("domainMixed")
    };
    const tableItems = entries.map((entry) => ({
        rank: entry.rank,
        tier: entry.tier,
        speciesSlug: entry.species.slug,
        speciesName: entry.species.name,
        iconSrc: getSpeciesArtworkUrl(entry.species.slug),
        primaryMetric: entry.primaryMetric,
        shortReason: entry.shortReason,
        domain: getMovementDomain(entry.species, domainLabels)
    }));
    const relatedChallenges = (ranking.relatedChallengeSlugs || [])
        .map((challengeSlug) => getChallenge(challengeSlug))
        .filter((challenge): challenge is NonNullable<ReturnType<typeof getChallenge>> => Boolean(challenge))
        .flatMap((challenge): RelatedChallengeCard[] => {
            const animalA = getSpeciesBySlug(challenge.animalASlug);
            const animalB = getSpeciesBySlug(challenge.animalBSlug);

            if (!animalA || !animalB) {
                return [];
            }

            return [{
                slug: challenge.slug,
                title: challenge.title,
                quickVerdict: challenge.quickVerdict,
                animalAName: animalA.name,
                animalBName: animalB.name,
                comparisonTypeLabel: t(`challengeCategories.${challenge.comparisonType}`),
                image: challenge.featuredImage
            }];
        });
    const relatedRankings = getRelatedRankings(ranking.slug, 3).map((page) => ({
        slug: page.slug,
        title: getRankingTierListTitle(page),
        description: page.description,
        categoryLabel: t(`categories.${page.category}`)
    }));
    const ctaSupportItems = [
        t("ctaSupportOne"),
        t("ctaSupportTwo"),
        t("ctaSupportThree")
    ];
    const pageUrl = getAbsoluteUrl(locale, `${RANKING_CANONICAL_BASE_PATH}/${ranking.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: ranking.description,
        datePublished: ranking.publishedAt,
        dateModified: ranking.updatedAt,
        inLanguage: locale,
        url: pageUrl,
        image: getSchemaImageUrl(locale, ranking.featuredImage.src),
        keywords: ranking.searchIntents.join(", "),
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"}
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: entries.map((entry) => ({
            "@type": "ListItem",
            position: entry.rank,
            name: entry.species.name,
            url: getAbsoluteUrl(locale, `/animals/${entry.species.slug}`)
        }))
    };
    const faqSchema = ranking.faq && ranking.faq.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: ranking.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    } : null;
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "AnimalDex",
                item: getAbsoluteUrl(locale)
            },
            {
                "@type": "ListItem",
                position: 2,
                name: t("title"),
                item: getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH)
            },
            {
                "@type": "ListItem",
                position: 3,
                name: title,
                item: pageUrl
            }
        ]
    };
    const schemas = faqSchema
        ? [articleSchema, itemListSchema, faqSchema, breadcrumbSchema]
        : [articleSchema, itemListSchema, breadcrumbSchema];
    const readingMinutes = estimateReadingMinutes(entries.length, [
        ranking.quickAnswer,
        ...ranking.introduction,
        ...ranking.methodology,
        ...ranking.breakdown,
        ...(ranking.faq || []).flatMap((item) => [item.question, item.answer])
    ]);

    return (
        <article className="mx-auto flex w-full max-w-[86rem] flex-col gap-8 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <RankingBreadcrumbs
                items={[
                    {href: RANKING_CANONICAL_BASE_PATH, label: t("breadcrumbTierLists")},
                    {label: t(`categories.${ranking.category}`)},
                    {label: title}
                ]}
            />

            <RankingHero
                title={title}
                description={ranking.description}
                categoryLabel={t(`categories.${ranking.category}`)}
                updatedLabel={t("updated")}
                updatedValue={formatDate(locale, ranking.updatedAt || ranking.publishedAt)}
                rankedSpeciesLabel={t("rankedSpecies")}
                rankedSpeciesValue={String(entries.length)}
                readingTimeLabel={t("readingTime")}
                readingTimeValue={t("readingTimeValue", {minutes: readingMinutes})}
                methodologyHref="#methodology"
                methodologyLabel={t("methodologyLink")}
            />

            <TierListSummary
                title={t("quickAnswerTitle")}
                answer={ranking.quickAnswer}
                clarification={ranking.breakdown[0] ?? t("summaryClarification")}
                readSpeciesLabel={t("readSpecies")}
                items={tableItems.slice(0, 3)}
            />

            <RankingTable
                title={t("tableTitle")}
                description={t("tableDescription", {count: entries.length})}
                labels={{
                    rank: t("rankLabel"),
                    animal: t("animalLabel"),
                    metric: t("metricLabel"),
                    tier: t("tierLabel"),
                    whyItRanks: t("whyItRanksLabel"),
                    readSpecies: t("readSpecies"),
                    search: t("animalSearchLabel"),
                    searchPlaceholder: t("animalSearchPlaceholder"),
                    tierFilter: t("tierFilterLabel"),
                    domainFilter: t("domainFilterLabel"),
                    all: t("filterAll"),
                    showing: t("showing"),
                    of: t("of"),
                    backToTop: t("backToTop")
                }}
                items={tableItems}
            />

            <TierLegend tiers={entries.map((entry) => entry.tier)} />

            <RankingMethodology
                title={t("methodologyTitle")}
                description={t("methodologyDescription")}
                items={ranking.methodology}
            />

            <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("breakdownTitle")}</h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("breakdownDescription")}</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {ranking.breakdown.map((paragraph) => (
                        <p key={paragraph} className="text-base leading-7 text-ink-200">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("entryCardsTitle")}</h2>
                    <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("entryCardsDescription")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {entries.slice(0, 8).map((entry) => (
                        <RankingEntryCard
                            key={`${entry.rank}-${entry.species.slug}`}
                            rank={entry.rank}
                            speciesSlug={entry.species.slug}
                            speciesName={entry.species.name}
                            iconSrc={getSpeciesArtworkUrl(entry.species.slug)}
                            primaryMetric={entry.primaryMetric}
                            shortReason={entry.shortReason}
                            summary={entry.species.analysis.summary}
                            readSpeciesLabel={t("readSpecies")}
                        />
                    ))}
                </div>
            </section>

            <RelatedRankingsSection
                title={t("relatedRankingsTitle")}
                description={t("relatedRankingsDescription")}
                readRankingLabel={t("readRanking")}
                items={relatedRankings}
            />

            <RelatedChallengesSection
                title={t("relatedChallengesTitle")}
                description={t("relatedChallengesDescription")}
                readChallengeLabel={t("readChallenge")}
                items={relatedChallenges}
            />

            {ranking.faq && ranking.faq.length > 0 && (
                <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("faqTitle")}</h2>
                    <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("faqDescription")}</p>
                    <div className="mt-5 grid gap-3">
                        {ranking.faq.map((item) => (
                            <div key={item.question} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                                <p className="mt-2 text-base leading-7 text-ink-200">{item.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <IntentCtaCard
                title={t("ctaTitle")}
                description={t("ctaDescription")}
                buttonLabel={t("ctaButton")}
                supportItems={ctaSupportItems}
            />

            <Link href={RANKING_CANONICAL_BASE_PATH} className="w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100" underline>
                {t("back")}
            </Link>
        </article>
    );
}
