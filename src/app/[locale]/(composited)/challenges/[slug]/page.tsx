import {Metadata} from "next";
import {notFound} from "next/navigation";
import Button from "@/app/[locale]/_components/button";
import Link from "@/app/[locale]/_components/link";
import ChallengeHero from "@/app/[locale]/(composited)/challenges/_components/challenge-hero";
import AnimalVsStatTable from "@/app/[locale]/(composited)/challenges/_components/animal-vs-stat-table";
import ScenarioBreakdown from "@/app/[locale]/(composited)/challenges/_components/scenario-breakdown";
import ChallengeVerdictCard from "@/app/[locale]/(composited)/challenges/_components/challenge-verdict-card";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import {challengeEntries, getChallenge, getRelatedChallenges} from "@/data/challenges";
import {getSpeciesBySlug} from "@/data/species";
import {getSystemsIntelligenceEntriesForSpeciesSlugs} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type ChallengePageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

type ChallengeCtaCopy = {
    title: string;
    description: string;
    button: string;
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

function buildChallengeCtaCopy(
    comparisonType: string,
    t: (key: string, values?: Record<string, string | number>) => string
): ChallengeCtaCopy {
    if (comparisonType === "battle") {
        return {
            title: t("ctaBattleTitle"),
            description: t("ctaBattleDescription"),
            button: t("ctaBattleButton")
        };
    }

    if (comparisonType === "speed") {
        return {
            title: t("ctaSpeedTitle"),
            description: t("ctaSpeedDescription"),
            button: t("ctaSpeedButton")
        };
    }

    return {
        title: t("ctaDefaultTitle"),
        description: t("ctaDefaultDescription"),
        button: t("ctaDefaultButton")
    };
}

export async function generateMetadata({params}: ChallengePageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const challenge = getChallenge(slug);

    if (!challenge) {
        return {};
    }

    const animalA = getSpeciesBySlug(challenge.animalASlug);
    const animalB = getSpeciesBySlug(challenge.animalBSlug);
    const keywords = [
        ...challenge.searchIntents,
        challenge.comparisonType,
        animalA?.name || challenge.animalASlug,
        animalB?.name || challenge.animalBSlug
    ];

    return buildContentMetadata({
        locale,
        pathname: `/challenges/${challenge.slug}`,
        title: challenge.title,
        description: challenge.description,
        keywords,
        featuredImage: challenge.featuredImage,
        publishedAt: challenge.publishedAt,
        updatedAt: challenge.updatedAt,
        tags: [challenge.comparisonType, animalA?.name || challenge.animalASlug, animalB?.name || challenge.animalBSlug]
    });
}

export function generateStaticParams() {
    return challengeEntries.map((entry) => ({slug: entry.slug}));
}

export default async function ChallengePage({params}: ChallengePageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "challenges");
    const challenge = getChallenge(slug);

    if (!challenge) {
        notFound();
    }

    const animalA = getSpeciesBySlug(challenge.animalASlug);
    const animalB = getSpeciesBySlug(challenge.animalBSlug);

    if (!animalA || !animalB) {
        notFound();
    }

    const relatedChallenges = getRelatedChallenges(challenge.slug, 4)
        .map((entry) => {
            const relatedAnimalA = getSpeciesBySlug(entry.animalASlug);
            const relatedAnimalB = getSpeciesBySlug(entry.animalBSlug);

            if (!relatedAnimalA || !relatedAnimalB) {
                return null;
            }

            return {
                slug: entry.slug,
                title: entry.title,
                quickVerdict: entry.quickVerdict,
                animalAName: relatedAnimalA.name,
                animalBName: relatedAnimalB.name,
                comparisonTypeLabel: t(`comparisonTypes.${entry.comparisonType}`)
            };
        })
        .filter((entry): entry is RelatedChallengeCard => Boolean(entry));
    const systemsItems = getSystemsIntelligenceEntriesForSpeciesSlugs(challenge.systemsSpeciesSlugs || challenge.speciesSlugs)
        .flatMap(({slug: speciesSlug, entry}) => {
            const species = getSpeciesBySlug(speciesSlug);

            if (!species) {
                return [];
            }

            return [{
                slug: speciesSlug,
                name: species.name,
                href: `/animals/${species.slug}`,
                entry
            }];
        });
    const ctaCopy = buildChallengeCtaCopy(challenge.comparisonType, t);
    const pageUrl = getAbsoluteUrl(locale, `/challenges/${challenge.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: challenge.title,
        description: challenge.description,
        datePublished: challenge.publishedAt,
        dateModified: challenge.updatedAt,
        inLanguage: locale,
        url: pageUrl,
        image: getAbsoluteUrl(locale, challenge.featuredImage.src),
        keywords: challenge.searchIntents.join(", "),
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: [
            {"@type": "Thing", name: animalA.name},
            {"@type": "Thing", name: animalB.name},
            {"@type": "Thing", name: challenge.comparisonType}
        ]
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: challenge.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };
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
                item: getAbsoluteUrl(locale, "/challenges")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: challenge.title,
                item: pageUrl
            }
        ]
    };

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema, breadcrumbSchema])}}
            />

            <Link href="/challenges" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <ChallengeHero
                challenge={challenge}
                comparisonTypeLabel={t(`comparisonTypes.${challenge.comparisonType}`)}
                animalAName={animalA.name}
                animalBName={animalB.name}
                publishedLabel={t("published")}
                publishedValue={formatDate(locale, challenge.publishedAt)}
                updatedLabel={t("updated")}
                updatedValue={formatDate(locale, challenge.updatedAt || challenge.publishedAt)}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("jumpToSpeciesTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("jumpToSpeciesDescription")}</p>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href={`/animals/${animalA.slug}`}
                        className="rounded-full border border-primary-500/30 px-4 py-3 text-primary-200 hover:text-primary-100 text-base md:text-lg"
                    >
                        {animalA.name}
                    </Link>
                    <Link
                        href={`/animals/${animalB.slug}`}
                        className="rounded-full border border-primary-500/30 px-4 py-3 text-primary-200 hover:text-primary-100 text-base md:text-lg"
                    >
                        {animalB.name}
                    </Link>
                </div>
            </section>

            <ChallengeVerdictCard
                title={t("quickVerdictTitle")}
                description={t("quickVerdictDescription")}
                summary={challenge.quickVerdict}
                paragraphs={challenge.shortAnswer}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whyInterestingTitle")}</h2>
                {challenge.whyThisMatchupIsInteresting.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <AnimalVsStatTable
                title={t("statsTitle")}
                description={t("statsDescription")}
                animalAName={animalA.name}
                animalBName={animalB.name}
                items={challenge.statCategories}
                labels={{
                    advantage: t("advantageLabel"),
                    takeaway: t("takeawayLabel"),
                    animalAAdvantage: animalA.name,
                    animalBAdvantage: animalB.name,
                    even: t("winnerLabels.even"),
                    depends: t("winnerLabels.depends")
                }}
            />

            <ScenarioBreakdown
                title={t("scenarioTitle")}
                description={t("scenarioDescription")}
                items={challenge.scenarioBreakdown}
                labels={{
                    winner: t("scenarioWinnerLabel"),
                    animalA: animalA.name,
                    animalB: animalB.name,
                    draw: t("winnerLabels.draw"),
                    depends: t("winnerLabels.depends")
                }}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("exploreAnimalsTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("exploreAnimalsDescription")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[animalA, animalB].map((species) => (
                        <article
                            key={species.slug}
                            className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3"
                        >
                            <h3 className="font-display font-bold text-2xl text-white">{species.name}</h3>
                            <p className="text-ink-200 text-base md:text-lg">{species.analysis.summary}</p>
                            <Link
                                href={`/animals/${species.slug}`}
                                className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                underline
                            >
                                {t("readSpecies")}
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            <SystemsIntelligenceSection
                items={systemsItems}
                labels={{
                    title: t("systemsIntelligenceTitle"),
                    description: t("systemsIntelligenceDescription"),
                    systemRole: t("systemRoleLabel"),
                    specializedHardware: t("specializedHardwareLabel"),
                    systemsScript: t("systemsScriptLabel"),
                    strategicInsight: t("strategicInsightLabel"),
                    readSpeciesGuide: t("readSpeciesGuide")
                }}
            />

            <ChallengeVerdictCard
                title={t("finalTakeTitle")}
                summary={challenge.finalTake[0]}
                paragraphs={challenge.finalTake.slice(1)}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                {challenge.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                    </div>
                ))}
            </section>

            <RelatedChallengesSection
                title={t("relatedTitle")}
                description={t("relatedDescription")}
                readChallengeLabel={t("readChallenge")}
                items={relatedChallenges}
            />

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{ctaCopy.title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{ctaCopy.description}</p>
                <div className="flex justify-center flex-wrap gap-3">
                    <Link href="/#download">
                        <Button as="span">{ctaCopy.button}</Button>
                    </Link>
                    <Link
                        href={`/animals/${animalA.slug}`}
                        className="rounded-full border border-primary-500/30 px-4 py-3 text-primary-200 hover:text-primary-100 text-base md:text-lg"
                    >
                        {t("trackSpecies", {animal: animalA.name})}
                    </Link>
                    <Link
                        href={`/animals/${animalB.slug}`}
                        className="rounded-full border border-primary-500/30 px-4 py-3 text-primary-200 hover:text-primary-100 text-base md:text-lg"
                    >
                        {t("trackSpecies", {animal: animalB.name})}
                    </Link>
                </div>
            </div>
        </article>
    );
}
