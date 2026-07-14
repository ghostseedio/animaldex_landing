import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import TierListFilters from "@/app/[locale]/(composited)/rankings/_components/tier-list-filters";
import {getExpandedRankingEntries, getRankingTierListTitle, rankingPages, RANKING_CANONICAL_BASE_PATH} from "@/data/rankings";
import {loadLocaleMessages} from "@/loaders/locale";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const rankingKeywords = Array.from(new Set(rankingPages.flatMap((page) => page.searchIntents)));
    const title = messages.rankings?.metaTitle || "Animal Tier Lists";
    const description = messages.rankings?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...rankingKeywords],
        alternates: {
            canonical: getLocalePath(locale, RANKING_CANONICAL_BASE_PATH),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, RANKING_CANONICAL_BASE_PATH);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, RANKING_CANONICAL_BASE_PATH)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, RANKING_CANONICAL_BASE_PATH),
            images: [
                {
                    url: "/images/placeholders/more-guide.svg",
                    width: 1200,
                    height: 675,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/placeholders/more-guide.svg"]
        }
    };
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {month: "short", day: "numeric", year: "numeric"}).format(new Date(date));
}

function formatMethodologyLabel(categoryLabel: string, statRankingKey?: string) {
    if (statRankingKey) {
        return `${statRankingKey.replace(/_/g, " ")} stat`;
    }

    return `${categoryLabel} signals`;
}

export default async function RankingsIndexPage() {
    const t = await getTranslations("rankings");
    const locale = await getLocale();
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
        itemListElement: rankingPages.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, `${RANKING_CANONICAL_BASE_PATH}/${page.slug}`),
            name: getRankingTierListTitle(page)
        }))
    };
    const cards = rankingPages.map((page) => {
        const categoryLabel = t(`categories.${page.category}`);

        return {
            slug: page.slug,
            title: getRankingTierListTitle(page),
            description: page.description,
            category: page.category,
            categoryLabel,
            image: {
                src: page.featuredImage.src,
                alt: page.featuredImage.alt,
                width: page.featuredImage.width,
                height: page.featuredImage.height
            },
            rankedSpeciesCount: page.statRankingKey
                ? page.statRankingLimit ?? getExpandedRankingEntries(page).length
                : getExpandedRankingEntries(page).length,
            updatedLabel: formatDate(locale, page.updatedAt || page.publishedAt),
            methodologyLabel: formatMethodologyLabel(categoryLabel, page.statRankingKey)
        };
    });
    const credibilityItems = [
        t("credibilityEvidence"),
        t("credibilityMethodology"),
        t("credibilitySpecies")
    ];

    return (
        <section className="mx-auto flex w-full max-w-[86rem] flex-col gap-10 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

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

            <TierListFilters
                items={cards}
                allLabel={t("filterAll")}
                searchLabel={t("searchLabel")}
                searchPlaceholder={t("searchPlaceholder")}
                resultSingularLabel={t("resultSingular")}
                resultPluralLabel={t("resultPlural")}
                actionLabel={t("viewRanking")}
            />

            <section className="w-[calc(100vw-2rem)] max-w-full rounded-lg border border-line-300 bg-surface-900/75 p-5 md:w-auto md:p-6">
                <h2 className="font-display text-3xl font-bold text-white">{t("methodologyOverviewTitle")}</h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("methodologyOverviewDescription")}</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {[t("methodSpeed"), t("methodStrength"), t("methodSize"), t("methodBiteForce"), t("methodCognition"), t("methodRisk")].map((item) => (
                        <p key={item} className="rounded-md border border-line-400 bg-canvas-900/40 p-4 text-sm leading-6 text-ink-200">{item}</p>
                    ))}
                </div>
            </section>

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
            </section>
        </section>
    );
}
