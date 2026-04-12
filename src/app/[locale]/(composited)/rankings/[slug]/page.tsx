import {Metadata} from "next";
import {notFound} from "next/navigation";
import Button from "@/app/[locale]/_components/button";
import Link from "@/app/[locale]/_components/link";
import RankingHero from "@/app/[locale]/(composited)/rankings/_components/ranking-hero";
import RankingTable from "@/app/[locale]/(composited)/rankings/_components/ranking-table";
import RankingEntryCard from "@/app/[locale]/(composited)/rankings/_components/ranking-entry-card";
import RankingMethodology from "@/app/[locale]/(composited)/rankings/_components/ranking-methodology";
import RelatedRankingsSection from "@/app/[locale]/(composited)/rankings/_components/related-rankings-section";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import {getChallenge} from "@/data/challenges";
import {getRankingPage, getRelatedRankings, rankingPages} from "@/data/rankings";
import {getSpeciesBySlug} from "@/data/species";
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
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
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
        pathname: `/rankings/${ranking.slug}`,
        title: ranking.title,
        description: ranking.description,
        keywords,
        featuredImage: ranking.featuredImage,
        publishedAt: ranking.publishedAt,
        updatedAt: ranking.updatedAt,
        tags: [ranking.category, ...ranking.entries.slice(0, 3).map((entry) => entry.speciesSlug)]
    });
}

export function generateStaticParams() {
    return rankingPages.map((page) => ({slug: page.slug}));
}

export default async function RankingDetailPage({params}: RankingPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "rankings");
    const ranking = getRankingPage(slug);

    if (!ranking) {
        notFound();
    }

    const resolvedEntries = ranking.entries.map((entry) => {
        const species = getSpeciesBySlug(entry.speciesSlug);

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
    const relatedChallenges = (ranking.relatedChallengeSlugs || [])
        .map((challengeSlug) => getChallenge(challengeSlug))
        .filter((challenge): challenge is NonNullable<ReturnType<typeof getChallenge>> => Boolean(challenge))
        .map((challenge) => {
            const animalA = getSpeciesBySlug(challenge.animalASlug);
            const animalB = getSpeciesBySlug(challenge.animalBSlug);

            if (!animalA || !animalB) {
                return null;
            }

            return {
                slug: challenge.slug,
                title: challenge.title,
                quickVerdict: challenge.quickVerdict,
                animalAName: animalA.name,
                animalBName: animalB.name,
                comparisonTypeLabel: t(`challengeCategories.${challenge.comparisonType}`)
            };
        })
        .filter((entry): entry is RelatedChallengeCard => Boolean(entry));
    const relatedRankings = getRelatedRankings(ranking.slug, 3).map((page) => ({
        slug: page.slug,
        title: page.title,
        description: page.description,
        categoryLabel: t(`categories.${page.category}`)
    }));
    const pageUrl = getAbsoluteUrl(locale, `/rankings/${ranking.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: ranking.title,
        description: ranking.description,
        datePublished: ranking.publishedAt,
        dateModified: ranking.updatedAt,
        inLanguage: locale,
        url: pageUrl,
        image: getAbsoluteUrl(locale, ranking.featuredImage.src),
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
                item: getAbsoluteUrl(locale, "/rankings")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: ranking.title,
                item: pageUrl
            }
        ]
    };
    const schemas = faqSchema
        ? [articleSchema, itemListSchema, faqSchema, breadcrumbSchema]
        : [articleSchema, itemListSchema, breadcrumbSchema];

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <Link href="/rankings" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <RankingHero
                title={ranking.title}
                description={ranking.description}
                categoryLabel={t(`categories.${ranking.category}`)}
                publishedLabel={t("published")}
                publishedValue={formatDate(locale, ranking.publishedAt)}
                updatedLabel={t("updated")}
                updatedValue={formatDate(locale, ranking.updatedAt || ranking.publishedAt)}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("quickAnswerTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("quickAnswerDescription")}</p>
                <p className="text-white text-lg md:text-xl leading-8">{ranking.quickAnswer}</p>
                {ranking.introduction.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <RankingTable
                title={t("tableTitle")}
                description={t("tableDescription")}
                labels={{
                    rank: t("rankLabel"),
                    animal: t("animalLabel"),
                    metric: t("metricLabel"),
                    whyItRanks: t("whyItRanksLabel"),
                    readSpecies: t("readSpecies")
                }}
                items={entries.map((entry) => ({
                    rank: entry.rank,
                    speciesSlug: entry.species.slug,
                    speciesName: entry.species.name,
                    primaryMetric: entry.primaryMetric,
                    shortReason: entry.shortReason
                }))}
            />

            <RankingMethodology
                title={t("methodologyTitle")}
                description={t("methodologyDescription")}
                items={ranking.methodology}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("breakdownTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("breakdownDescription")}</p>
                {ranking.breakdown.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="font-display font-bold text-4xl text-white">{t("entryCardsTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("entryCardsDescription")}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entries.map((entry) => (
                        <RankingEntryCard
                            key={`${entry.rank}-${entry.species.slug}`}
                            rank={entry.rank}
                            speciesSlug={entry.species.slug}
                            speciesName={entry.species.name}
                            primaryMetric={entry.primaryMetric}
                            shortReason={entry.shortReason}
                            summary={entry.species.analysis.summary}
                            readSpeciesLabel={t("readSpecies")}
                        />
                    ))}
                </div>
            </section>

            <RelatedChallengesSection
                title={t("relatedChallengesTitle")}
                description={t("relatedChallengesDescription")}
                readChallengeLabel={t("readChallenge")}
                items={relatedChallenges}
            />

            <RelatedRankingsSection
                title={t("relatedRankingsTitle")}
                description={t("relatedRankingsDescription")}
                readRankingLabel={t("readRanking")}
                items={relatedRankings}
            />

            {ranking.faq && ranking.faq.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                    {ranking.faq.map((item) => (
                        <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                            <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                        </div>
                    ))}
                </section>
            )}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                </div>
            </div>
        </article>
    );
}
