import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import UniversalSearchField from "@/app/[locale]/(composited)/animals/_components/universal-search-field";
import UniversalSearchResults from "@/app/[locale]/(composited)/animals/_components/universal-search-results";
import {
    getStarterComparableAnimals,
    searchComparableAnimals
} from "@/data/comparison-animals";
import {fetchTrendingSearches, normalizeSearchQuery} from "@/data/universal-search";
import {getLocalePath} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type Props = {
    params: {locale: string};
    searchParams?: {q?: string | string[]};
};

function getQuery(searchParams?: Props["searchParams"]) {
    const raw = Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q;
    return normalizeSearchQuery(raw ?? "");
}

export async function generateMetadata({params, searchParams}: Props): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "animalSearch");
    const query = getQuery(searchParams);

    // Internal search results: useful to readers, not something to index.
    return {
        title: query ? t("metaTitleQuery", {query}) : t("metaTitle"),
        description: t("metaDescription"),
        robots: {index: false, follow: true}
    };
}

export default async function AnimalSearchPage({params, searchParams}: Props) {
    const {locale} = params;
    const t = await getScopedTranslator(locale, "animalSearch");
    const query = getQuery(searchParams);

    const [suggestionCatalog, previewMatches, trending] = await Promise.all([
        getStarterComparableAnimals(40).catch(() => []),
        query ? searchComparableAnimals(query, 6).catch(() => []) : Promise.resolve([]),
        fetchTrendingSearches(8).catch(() => [])
    ]);

    const catalogEntries = suggestionCatalog.map((animal) => ({
        slug: animal.slug,
        name: animal.name,
        animalDexNumber: animal.animalDexNumber
    }));

    return (
        <main className="mx-auto w-full max-w-[80rem] px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
            <Link
                href="/animals"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary-200 hover:text-primary-100"
            >
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("backToDirectory")}
            </Link>

            <header className="mt-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-200">{t("eyebrow")}</p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">
                    {query ? t("titleQuery", {query}) : t("title")}
                </h1>
            </header>

            <div className="mt-6">
                <UniversalSearchField
                    basePath={getLocalePath(locale, "/animals")}
                    locale={locale}
                    initialQuery={query}
                    catalogEntries={catalogEntries}
                    trending={trending.map((item) => ({query: item.query, isPopular: item.isPopular}))}
                    copy={{
                        placeholder: t("placeholder"),
                        searchLabel: t("searchLabel"),
                        clearLabel: t("clearLabel"),
                        voiceLabel: t("voiceLabel"),
                        voiceListening: t("voiceListening"),
                        recentTitle: t("recentTitle"),
                        clearAll: t("clearAll"),
                        seeMore: t("seeMore"),
                        trendingTitle: t("trendingTitle"),
                        popularBadge: t("popularBadge"),
                        suggestionsTitle: t("suggestionsTitle"),
                        submit: t("submit"),
                        filterDirectory: t("filterDirectory")
                    }}
                />
            </div>

            <div className="mt-10">
                {query ? (
                    <UniversalSearchResults
                        query={query}
                        locale={locale}
                        previewSpecies={previewMatches.map((animal) => ({
                            slug: animal.slug,
                            name: animal.name,
                            scientificName: animal.scientificName,
                            category: animal.category
                        }))}
                        copy={{
                            loading: t("loading"),
                            loadingHint: t("loadingHint"),
                            errorTitle: t("errorTitle"),
                            errorBody: t("errorBody"),
                            rateLimited: t("rateLimited"),
                            emptyTitle: t("emptyTitle"),
                            emptyBody: t("emptyBody"),
                            retry: t("retry"),
                            previewTitle: t("previewTitle"),
                            speciesTitle: t("speciesTitle"),
                            comparisonsTitle: t("comparisonsTitle"),
                            locationsTitle: t("locationsTitle"),
                            learnTitle: t("learnTitle"),
                            factsTitle: t("factsTitle"),
                            helpTitle: t("helpTitle"),
                            openSpecies: t("openSpecies"),
                            openComparison: t("openComparison"),
                            viewOnMaps: t("viewOnMaps"),
                            poweredNote: t("poweredNote")
                        }}
                    />
                ) : (
                    <p className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center text-ink-300">
                        {t("emptyQueryPrompt")}
                    </p>
                )}
            </div>
        </main>
    );
}
