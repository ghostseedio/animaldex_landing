import {Metadata} from "next";
import {redirect} from "next/navigation";
import TierListFilters from "@/app/[locale]/(composited)/rankings/_components/tier-list-filters";
import {
    buildTierListHubFaqSchema,
    getTierListHubAnswers,
    getTierListHubLeaders,
    TierListHubFaq,
    TierListHubFaqItem,
    TierListHubIntro,
    TierListHubLanguageLinks,
    TierListHubQuickAnswers
} from "@/app/[locale]/(composited)/rankings/_components/tier-list-hub-sections";
import {
    getExpandedRankingEntries,
    getRankingHeadline,
    rankingPages,
    RANKING_CANONICAL_BASE_PATH,
    sortRankingPagesForHub
} from "@/data/rankings";
import {
    getTierListHubLanguageAlternates,
    getTranslatedTierListHub,
    getTranslatedTierListHubPath,
    TranslatedTierListHubLanguage
} from "@/data/tier-list-hub-translations";
import {contentThumb} from "@/data/content-thumbnails";
import {localeConfig} from "@/i18n";
import {getAbsoluteAssetUrl} from "@/lib/site";

/**
 * /pt/tier-list, /es/tier-list and /fr/tier-list are translated copies of the
 * hub only, not next-intl locales. next-intl's as-needed routing rewrites them
 * to the default locale (`/en/pt/tier-list`), so they live under [locale].
 * Any other locale prefix (`/id/pt/tier-list`, reachable from the header's
 * locale toggle) is sent to that locale's own hub.
 */
export function assertTranslatedHubLocale(locale: string) {
    if (locale !== localeConfig.defaultLocale) {
        redirect(`/${locale}${RANKING_CANONICAL_BASE_PATH}`);
    }
}

export function buildTranslatedTierListHubMetadata(language: TranslatedTierListHubLanguage): Metadata {
    const copy = getTranslatedTierListHub(language);
    const path = getTranslatedTierListHubPath(language);
    const description = copy.metaDescription(getTierListHubLeaders(getTierListHubAnswers()));
    const image = contentThumb("rankings-hub");

    return {
        title: copy.metaTitle,
        description,
        keywords: [copy.metaTitle, `tier list ${language === "fr" ? "animaux" : language === "es" ? "animales" : "animais"}`],
        alternates: {
            canonical: path,
            languages: getTierListHubLanguageAlternates()
        },
        openGraph: {
            type: "website",
            locale: copy.openGraphLocale,
            title: `${copy.metaTitle} | AnimalDex`,
            description,
            url: path,
            images: [{url: image.src, width: image.width, height: image.height, alt: image.alt}]
        },
        twitter: {
            card: "summary_large_image",
            title: `${copy.metaTitle} | AnimalDex`,
            description,
            images: [image.src]
        }
    };
}

export default function TranslatedTierListHub({language}: {language: TranslatedTierListHubLanguage}) {
    const copy = getTranslatedTierListHub(language);
    const pageUrl = getAbsoluteAssetUrl(getTranslatedTierListHubPath(language));
    const answers = getTierListHubAnswers();
    const quickAnswerItems = answers.map((answer) => ({
        slug: answer.slug,
        href: answer.href,
        label: copy.lists[answer.slug].label,
        leader: answer.names[0],
        followedBy: copy.followedBy(answer.names[1], answer.names[2])
    }));
    const faqItems: TierListHubFaqItem[] = [
        {question: copy.introTitle, answer: copy.intro.join(" ")},
        ...answers.map((answer) => {
            const list = copy.lists[answer.slug];

            return {
                question: list.question,
                answer: `${copy.faqAnswer(answer.names[0], answer.names[1], answer.names[2], list.listName)} ${list.note}`
            };
        })
    ];
    const sortedPages = sortRankingPagesForHub(rankingPages);
    const dateFormatter = new Intl.DateTimeFormat(copy.htmlLang, {month: "short", day: "numeric", year: "numeric"});
    const cards = sortedPages.map((page) => {
        const categoryLabel = copy.categories[page.category] ?? page.category;
        const rankedSpeciesCount = page.statRankingKey
            ? page.statRankingLimit ?? getExpandedRankingEntries(page).length
            : getExpandedRankingEntries(page).length;

        return {
            slug: page.slug,
            // List titles stay English: each card opens the English list page.
            title: getRankingHeadline(page),
            description: copy.cardDescription(categoryLabel, rankedSpeciesCount),
            category: page.category,
            categoryLabel,
            image: {
                src: page.featuredImage.src,
                alt: getRankingHeadline(page),
                width: page.featuredImage.width,
                height: page.featuredImage.height
            },
            rankedSpeciesCount,
            updatedLabel: dateFormatter.format(new Date(page.updatedAt || page.publishedAt)),
            methodologyLabel: categoryLabel
        };
    });

    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: copy.title,
        description: copy.intro[0],
        url: pageUrl,
        inLanguage: copy.htmlLang
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: sortedPages.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteAssetUrl(`${RANKING_CANONICAL_BASE_PATH}/${page.slug}`),
            name: getRankingHeadline(page)
        }))
    };
    const faqSchema = buildTierListHubFaqSchema(faqItems, copy.htmlLang);

    return (
        // The root layout owns <html lang> (it is the next-intl locale, "en"),
        // so the translated content declares its own language here.
        <section lang={copy.htmlLang} className="mx-auto flex w-full max-w-[86rem] flex-col gap-10 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema, faqSchema])}} />

            <header className="w-[calc(100vw-2rem)] max-w-full border-b border-line-300 pb-8 md:w-auto md:max-w-5xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200">{copy.eyebrow}</p>
                <h1 className="mt-4 max-w-full break-words font-display text-3xl font-bold leading-[1.08] text-white md:max-w-4xl md:text-5xl lg:text-6xl">
                    {copy.title}
                </h1>
                <p className="mt-5 max-w-full text-base leading-8 text-ink-200 md:max-w-3xl md:text-lg">
                    {copy.englishNotice}
                </p>
                <div className="mt-6">
                    <TierListHubLanguageLinks label={copy.otherLanguages} current={language} />
                </div>
            </header>

            <TierListHubIntro title={copy.introTitle} paragraphs={copy.intro} />

            <TierListHubQuickAnswers
                title={copy.quickAnswersTitle}
                description={copy.quickAnswersDescription}
                items={quickAnswerItems}
                viewListLabel={copy.viewList}
            />

            <section className="flex flex-col gap-6">
                <div className="w-[calc(100vw-2rem)] max-w-full md:w-auto">
                    <h2 className="font-display text-3xl font-bold text-white">{copy.allListsTitle}</h2>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300">{copy.allListsDescription}</p>
                </div>
                <TierListFilters
                    items={cards}
                    allLabel={copy.filterAll}
                    searchLabel={copy.searchLabel}
                    searchPlaceholder={copy.searchLabel}
                    resultSingularLabel={copy.resultSingular}
                    resultPluralLabel={copy.resultPlural}
                    actionLabel={copy.viewRanking}
                    rankedSpeciesLabel={copy.rankedSpeciesLabel}
                    methodLabel={copy.methodLabel}
                />
            </section>

            <section className="w-[calc(100vw-2rem)] max-w-full rounded-lg border border-line-300 bg-surface-900/75 p-5 md:w-auto md:p-6">
                <h2 className="font-display text-3xl font-bold text-white">{copy.methodologyTitle}</h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{copy.methodologyDescription}</p>
            </section>

            <TierListHubFaq title={copy.faqTitle} items={faqItems} />
        </section>
    );
}
