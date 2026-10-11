import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import TierListFilters from "@/app/[locale]/(composited)/rankings/_components/tier-list-filters";
import {
    getExpandedRankingEntries,
    getRankingHeadline,
    rankingPages,
    RANKING_CANONICAL_BASE_PATH,
    sortRankingPagesForHub
} from "@/data/rankings";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {contentThumb} from "@/data/content-thumbnails";
import {getTierListHubLanguageAlternates} from "@/data/tier-list-hub-translations";
import {
    buildTierListHubFaqSchema,
    getTierListHubAnswers,
    getTierListHubLeaders,
    TierListHubAnswer,
    TierListHubFaq,
    TierListHubFaqItem,
    TierListHubIntro,
    TierListHubLanguageLinks,
    TierListHubQuickAnswers
} from "@/app/[locale]/(composited)/rankings/_components/tier-list-hub-sections";
import {ScopedTranslator} from "@/loaders/translation";
import HubPaginationNav from "@/app/[locale]/(composited)/_components/hub-pagination-nav";
import StatLessonExplainer from "@/app/[locale]/(composited)/rankings/_components/stat-lesson-explainer";
import {StatLessonsSection, buildStatLessonText} from "@/app/[locale]/(composited)/rankings/_components/stat-lessons-section";
import {parsePageParam, tierListPagination as pagination} from "@/data/hub-pagination";
import {notFound, redirect} from "next/navigation";

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

const tierListHubPageCount = pagination.pageCount(rankingPages.length);

type HubParams = {
    locale: string;
    /** Set on /tier-list/page/<n> only (tier-list/page/[page]/page.tsx re-exports this page). */
    page?: string;
};

/**
 * The hub page number from the route. /tier-list has none (page 1). A
 * /tier-list/page/<n> URL must be a canonical number within range, and /page/1
 * goes to the hub (next.config.js 308s it first; this is the fallback).
 */
function resolveHubPage(params: HubParams) {
    if (params.page === undefined) return 1;
    const page = parsePageParam(params.page);
    if (!page || page > tierListHubPageCount) notFound();
    if (page === 1) redirect(getLocalePath(params.locale, pagination.pagePath(1)));
    return page;
}

/**
 * Page 1 is the hub, with its Search-Console title and hreflang set. Later
 * pages are their own self-canonical URLs (/tier-list/page/<n>) with a plain
 * "page n" title, so they never compete with the hub for its queries.
 */
export async function generateMetadata({params}: {params: HubParams}): Promise<Metadata> {
    const locale = params.locale;
    const page = resolveHubPage(params);
    if (page > 1) {
        const t = await getScopedTranslator(locale, "rankings");
        const path = getLocalePath(locale, pagination.pagePath(page));
        const title = t("pageTitle", {page});
        const description = t("pageDescription", {page, pages: tierListHubPageCount});
        return {
            title,
            description,
            alternates: {canonical: path},
            openGraph: {type: "website", locale: getMetadataLocale(locale), title: `${title} | AnimalDex`, description, url: path}
        };
    }

    const messages = await loadLocaleMessages(locale);
    const t = await getScopedTranslator(locale, "rankings");
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const rankingKeywords = Array.from(new Set(rankingPages.flatMap((ranking) => ranking.searchIntents)));
    const title = messages.rankings?.metaTitle || "Animal Tier List: Fastest, Strongest & Smartest Animals";
    // The description names the current #1s, read from the same data as the lists.
    const description = messages.rankings?.metaDescription
        ? t("metaDescription", {...getTierListHubLeaders(getTierListHubAnswers())})
        : messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...rankingKeywords],
        alternates: {
            canonical: getLocalePath(locale, RANKING_CANONICAL_BASE_PATH),
            // en + id are next-intl locales; pt/es/fr are translated hub pages
            // (src/data/tier-list-hub-translations.ts), not site locales.
            languages: getTierListHubLanguageAlternates()
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, RANKING_CANONICAL_BASE_PATH),
            images: [
                {
                    url: contentThumb("rankings-hub").src,
                    width: contentThumb("rankings-hub").width,
                    height: contentThumb("rankings-hub").height,
                    alt: contentThumb("rankings-hub").alt
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: [contentThumb("rankings-hub").src]
        }
    };
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {month: "short", day: "numeric", year: "numeric"}).format(new Date(date));
}

function buildQuickAnswerItems(t: ScopedTranslator, answers: TierListHubAnswer[]) {
    return answers.map((answer) => ({
        slug: answer.slug,
        href: answer.href,
        label: t(`quickAnswers.${answer.slug}.label`),
        leader: answer.names[0],
        followedBy: t("quickAnswerFollowedBy", {second: answer.names[1], third: answer.names[2]})
    }));
}

function buildFaqItems(t: ScopedTranslator, answers: TierListHubAnswer[]): TierListHubFaqItem[] {
    return [
        {
            question: t("hubFaqWhatIsQuestion"),
            answer: `${t("introParagraphOne")} ${t("introParagraphTwo")}`
        },
        {
            question: t("statLessons.faqQuestion"),
            answer: t("statLessons.faqAnswer")
        },
        ...answers.map((answer) => {
            const noteKey = `quickAnswers.${answer.slug}.note`;
            const note = t(noteKey);
            // English uses the #1 entry's own reason; other locales carry a
            // translated note so the answer does not switch language mid-way.
            const context = note === noteKey ? answer.leaderReason : note;

            return {
                question: t(`quickAnswers.${answer.slug}.question`),
                answer: `${t("hubFaqAnswer", {
                    first: answer.names[0],
                    second: answer.names[1],
                    third: answer.names[2],
                    list: t(`quickAnswers.${answer.slug}.list`)
                })} ${context}`
            };
        })
    ];
}

function formatMethodologyLabel(categoryLabel: string, statRankingKey?: string) {
    if (statRankingKey) {
        return `${statRankingKey.replace(/_/g, " ")} stat`;
    }

    return `${categoryLabel} signals`;
}

export default async function RankingsIndexPage({params}: {params: HubParams}) {
    const locale = params.locale;
    const page = resolveHubPage(params);
    const t = await getScopedTranslator(locale, "rankings");
    const pageUrl = getAbsoluteUrl(locale, RANKING_CANONICAL_BASE_PATH);

    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: sortRankingPagesForHub(rankingPages).map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, `${RANKING_CANONICAL_BASE_PATH}/${page.slug}`),
            name: getRankingHeadline(page)
        }))
    };
    const cards = sortRankingPagesForHub(rankingPages).map((ranking) => {
        const categoryLabel = t(`categories.${ranking.category}`);

        return {
            slug: ranking.slug,
            title: getRankingHeadline(ranking),
            description: ranking.description,
            category: ranking.category,
            categoryLabel,
            image: {
                src: ranking.featuredImage.src,
                alt: ranking.featuredImage.alt,
                width: ranking.featuredImage.width,
                height: ranking.featuredImage.height
            },
            rankedSpeciesCount: ranking.statRankingKey
                ? ranking.statRankingLimit ?? getExpandedRankingEntries(ranking).length
                : getExpandedRankingEntries(ranking).length,
            updatedLabel: formatDate(locale, ranking.updatedAt || ranking.publishedAt),
            methodologyLabel: formatMethodologyLabel(categoryLabel, ranking.statRankingKey)
        };
    });
    const totalPages = tierListHubPageCount;
    const pageSlugs = pagination.slice(cards, page).map((card) => card.slug);
    const filterLabels = {
        allLabel: t("filterAll"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        resultSingularLabel: t("resultSingular"),
        resultPluralLabel: t("resultPlural"),
        actionLabel: t("viewRanking")
    };
    const pageLinks = (
        <HubPaginationNav pagination={pagination} page={page} totalPages={totalPages} locale={locale} label={t("paginationLabel")} />
    );

    if (page > 1) {
        // Later pages: the lists and the way back. The hub's intro, answers and
        // FAQ live on page 1 only, so nothing here duplicates it.
        return (
            <section className="mx-auto flex w-full max-w-[86rem] flex-col gap-10 overflow-hidden px-4 py-10 md:px-8 md:py-14">
                <header className="w-[calc(100vw-2rem)] max-w-full border-b border-line-300 pb-8 md:w-auto md:max-w-5xl">
                    <Link href={RANKING_CANONICAL_BASE_PATH} className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200 underline-offset-4 hover:underline">
                        {t("eyebrow")}
                    </Link>
                    <h1 className="mt-4 font-display text-3xl font-bold leading-[1.08] text-white md:text-5xl">{t("pageTitle", {page})}</h1>
                    <p className="mt-5 max-w-3xl text-base leading-8 text-ink-200 md:text-lg">
                        {t("pageDescription", {page, pages: totalPages})}
                    </p>
                </header>
                <TierListFilters id={pagination.anchor} items={cards} pageSlugs={pageSlugs} pagination={pageLinks} {...filterLabels} />
            </section>
        );
    }

    const hubAnswers = getTierListHubAnswers();
    const quickAnswerItems = buildQuickAnswerItems(t, hubAnswers);
    const faqItems = buildFaqItems(t, hubAnswers);
    const faqSchema = buildTierListHubFaqSchema(faqItems, locale);
    const credibilityItems = [
        t("credibilityEvidence"),
        t("credibilityMethodology"),
        t("credibilitySpecies")
    ];

    return (
        <section className="mx-auto flex w-full max-w-[86rem] flex-col gap-10 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema, faqSchema])}} />

            <header className="w-[calc(100vw-2rem)] max-w-full border-b border-line-300 pb-8 md:w-auto md:max-w-5xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200">{t("eyebrow")}</p>
                <h1 className="mt-4 max-w-full break-words font-display text-3xl font-bold leading-[1.08] text-white md:max-w-4xl md:text-5xl lg:text-6xl">
                    {t("title")}
                </h1>
                <p className="mt-5 max-w-full text-base leading-8 text-ink-200 md:max-w-3xl md:text-lg">
                    {t("description")}
                </p>
                <ul className="mt-6 flex flex-wrap gap-3 text-sm text-ink-300">
                    {credibilityItems.map((item) => (
                        <li key={item} className="rounded-md border border-line-300 bg-surface-900/70 px-3 py-2">{item}</li>
                    ))}
                </ul>
            </header>

            <StatLessonExplainer
                labels={{
                    eyebrow: t("statLessons.eyebrow"),
                    title: t("statLessons.title"),
                    description: t("statLessons.description"),
                    highLabel: t("statLessons.highLabel"),
                    lowLabel: t("statLessons.lowLabel"),
                    pause: t("statLessons.pause"),
                    play: t("statLessons.play"),
                    stats: buildStatLessonText(t)
                }}
            />

            <TierListHubIntro
                title={t("introTitle")}
                paragraphs={[t("introParagraphOne"), t("introParagraphTwo")]}
            />

            <TierListHubQuickAnswers
                title={t("quickAnswersTitle")}
                description={t("quickAnswersDescription")}
                items={quickAnswerItems}
                viewListLabel={t("quickAnswerViewList")}
            />

            <TierListFilters id={pagination.anchor} items={cards} pageSlugs={pageSlugs} pagination={pageLinks} {...filterLabels} />

            <StatLessonsSection t={t} />

            <section className="w-[calc(100vw-2rem)] max-w-full rounded-lg border border-line-300 bg-surface-900/75 p-5 md:w-auto md:p-6">
                <h2 className="font-display text-3xl font-bold text-white">{t("methodologyOverviewTitle")}</h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("methodologyOverviewDescription")}</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {[t("methodSpeed"), t("methodStrength"), t("methodSize"), t("methodBiteForce"), t("methodCognition"), t("methodRisk")].map((item) => (
                        <p key={item} className="rounded-md border border-line-400 bg-canvas-900/40 p-4 text-sm leading-6 text-ink-200">{item}</p>
                    ))}
                </div>
            </section>

            <TierListHubFaq title={t("hubFaqTitle")} items={faqItems} />

            <section className="w-[calc(100vw-2rem)] max-w-full border-t border-line-300 pt-8 md:w-auto">
                <h2 className="font-display text-3xl font-bold text-white">{t("relatedNavigationTitle")}</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        {href: "/animals", label: t("browseAnimals")},
                        {href: "/comparisons", label: t("compareAnimals")},
                        {href: "/locations", label: t("exploreHabitats")},
                        {href: "/animals", label: t("speciesGuides")}
                    ].map((item) => (
                        <Link
                            key={`${item.href}-${item.label}`}
                            href={item.href}
                            className="rounded-lg border border-line-300 bg-surface-900/70 p-4 font-semibold text-white transition-colors hover:border-primary-500/50 hover:text-primary-100 focus-visible:text-primary-100"
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <div className="mt-6">
                    <TierListHubLanguageLinks label={t("otherLanguages")} current={locale} />
                </div>
            </section>
        </section>
    );
}
