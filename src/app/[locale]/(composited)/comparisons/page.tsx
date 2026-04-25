import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import Button from "@/app/[locale]/_components/button";
import {
    challengeEntries,
    getChallengeAnimalOptions,
    getChallengeComparisonTypeOptions,
    getChallengeDirectoryPage,
    isChallengeComparisonType
} from "@/data/challenges";
import {getSpeciesBySlug} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type ComparisonsIndexPageProps = {
    searchParams?: {
        q?: string | string[];
        type?: string | string[];
        animal?: string | string[];
        page?: string | string[];
    };
};

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function buildComparisonsIndexHref({
    query,
    comparisonType,
    animal,
    page
}: {
    query: string;
    comparisonType: string;
    animal: string;
    page: number;
}) {
    const params = new URLSearchParams();

    if (query.trim()) {
        params.set("q", query.trim());
    }

    if (comparisonType !== "all") {
        params.set("type", comparisonType);
    }

    if (animal !== "all") {
        params.set("animal", animal);
    }

    if (page > 1) {
        params.set("page", String(page));
    }

    const queryString = params.toString();

    return queryString ? `/comparisons?${queryString}` : "/comparisons";
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const challengeKeywords = Array.from(new Set(challengeEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.comparisons?.metaTitle || "AnimalDex Comparisons";
    const description = messages.comparisons?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...challengeKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/comparisons"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/comparisons`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/comparisons`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/comparisons"),
            images: [
                {
                    url: "/images/placeholders/more-challenges.svg",
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
            images: ["/images/placeholders/more-challenges.svg"]
        }
    };
}

export default async function ComparisonsIndexPage({searchParams}: ComparisonsIndexPageProps) {
    const t = await getTranslations("comparisons");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/comparisons");
    const query = getSingleParam(searchParams?.q) ?? "";
    const comparisonTypeParam = getSingleParam(searchParams?.type);
    const comparisonType = comparisonTypeParam && isChallengeComparisonType(comparisonTypeParam)
        ? comparisonTypeParam
        : "all";
    const animalOptions = getChallengeAnimalOptions();
    const animalParam = getSingleParam(searchParams?.animal);
    const animal = animalParam && animalOptions.includes(animalParam) ? animalParam : "all";
    const pageParam = Number.parseInt(getSingleParam(searchParams?.page) ?? "1", 10);
    const directoryPage = getChallengeDirectoryPage({
        query,
        comparisonType,
        animal,
        page: Number.isFinite(pageParam) ? pageParam : 1
    });
    const comparisonTypeOptions = getChallengeComparisonTypeOptions();

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
        itemListElement: directoryPage.entries.map((entry, index) => ({
            "@type": "ListItem",
            position: (directoryPage.currentPage - 1) * 12 + index + 1,
            url: getAbsoluteUrl(locale, `/comparisons/${entry.slug}`),
            name: entry.title
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-5">
                <form action={getLocalePath(locale, "/comparisons")} method="get" className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] gap-3 items-end">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="challenge-search" className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">
                            {t("searchLabel")}
                        </label>
                        <input
                            id="challenge-search"
                            name="q"
                            defaultValue={directoryPage.query}
                            placeholder={t("searchPlaceholder")}
                            className="w-full rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="challenge-type" className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">
                            {t("comparisonTypeLabel")}
                        </label>
                        <select
                            id="challenge-type"
                            name="type"
                            defaultValue={directoryPage.comparisonType}
                            className="w-full rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-base text-white outline-none transition-colors focus:border-primary-400"
                        >
                            <option value="all">{t("filterAll")}</option>
                            {comparisonTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {t(`comparisonTypes.${option}`)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="challenge-animal" className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">
                            {t("animalLabel")}
                        </label>
                        <select
                            id="challenge-animal"
                            name="animal"
                            defaultValue={directoryPage.animal}
                            className="w-full rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-base text-white outline-none transition-colors focus:border-primary-400"
                        >
                            <option value="all">{t("filterAll")}</option>
                            {animalOptions.map((option) => {
                                const species = getSpeciesBySlug(option);

                                return (
                                    <option key={option} value={option}>
                                        {species?.name || option}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-400"
                        >
                            {t("applyFilters")}
                        </button>
                        <Link
                            href="/comparisons"
                            className="rounded-2xl border border-line-300 px-5 py-3 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                        >
                            {t("clearFilters")}
                        </Link>
                    </div>
                </form>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm md:text-base text-ink-300">
                        {t("resultsSummary", {
                            count: directoryPage.entries.length,
                            total: directoryPage.total
                        })}
                    </p>
                    {directoryPage.totalPages > 1 ? (
                        <p className="text-sm md:text-base text-ink-300">
                            {t("pageLabel", {
                                page: directoryPage.currentPage,
                                totalPages: directoryPage.totalPages
                            })}
                        </p>
                    ) : null}
                </div>
            </div>

            {directoryPage.entries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {directoryPage.entries.map((entry) => {
                        const animalA = getSpeciesBySlug(entry.animalASlug);
                        const animalB = getSpeciesBySlug(entry.animalBSlug);

                        return (
                            <article
                                key={entry.slug}
                                className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                            >
                                <Link href={`/comparisons/${entry.slug}`} className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60">
                                    <Image
                                        src={entry.featuredImage.src}
                                        alt={entry.featuredImage.alt}
                                        width={entry.featuredImage.width}
                                        height={entry.featuredImage.height}
                                        sizes="(min-width: 1024px) 42vw, 100vw"
                                        className="h-auto w-full object-cover"
                                    />
                                </Link>
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                                        {t(`comparisonTypes.${entry.comparisonType}`)}
                                    </span>
                                    {animalA ? (
                                        <Link href={`/animals/${animalA.slug}`} className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 hover:text-primary-100 text-xs">
                                            {animalA.name}
                                        </Link>
                                    ) : null}
                                    {animalB ? (
                                        <Link href={`/animals/${animalB.slug}`} className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 hover:text-primary-100 text-xs">
                                            {animalB.name}
                                        </Link>
                                    ) : null}
                                </div>
                                <h2 className="font-display font-bold text-3xl text-white">{entry.title}</h2>
                                <p className="text-ink-200 text-lg">{entry.description}</p>
                                <p className="text-white text-lg leading-8">{entry.quickVerdict}</p>
                                <Link
                                    href={`/comparisons/${entry.slug}`}
                                    className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readChallenge")}
                                </Link>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-8 md:p-10 text-center flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl text-white">{t("noResultsTitle")}</h2>
                    <p className="text-ink-200 text-lg">{t("noResultsDescription")}</p>
                    <div className="flex justify-center">
                        <Link href="/comparisons" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                            {t("clearFilters")}
                        </Link>
                    </div>
                </div>
            )}

            {directoryPage.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-4 flex-wrap rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-5">
                    <div className="text-sm md:text-base text-ink-300">
                        {t("pageLabel", {
                            page: directoryPage.currentPage,
                            totalPages: directoryPage.totalPages
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        {directoryPage.currentPage > 1 ? (
                            <Link
                                href={buildComparisonsIndexHref({
                                    query: directoryPage.query,
                                    comparisonType: directoryPage.comparisonType,
                                    animal: directoryPage.animal,
                                    page: directoryPage.currentPage - 1
                                })}
                                className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                            >
                                {t("previousPage")}
                            </Link>
                        ) : <span />}

                        {directoryPage.currentPage < directoryPage.totalPages ? (
                            <Link
                                href={buildComparisonsIndexHref({
                                    query: directoryPage.query,
                                    comparisonType: directoryPage.comparisonType,
                                    animal: directoryPage.animal,
                                    page: directoryPage.currentPage + 1
                                })}
                                className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                            >
                                {t("nextPage")}
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
