import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesDirectoryPage, speciesEntries, SpeciesRarityStatusKey} from "@/data/species";
import {isNativeRangeRegionKey} from "@/data/native-range";
import {getLocationPage} from "@/data/locations";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import SpeciesDirectory from "./species-directory";
import SpeciesImage from "./species-image";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

const featuredAnimals = [
    {slug: "barn-owl", name: "Owl", lesson: "Precision and deep listening"},
    {slug: "wolf", name: "Wolf", lesson: "Cooperation and social intelligence"},
    {slug: "elephant", name: "Elephant", lesson: "Memory and family wisdom"},
    {slug: "great-white-shark", name: "Shark", lesson: "Momentum and sensory power"}
];

const popularSearches = ["Owl", "Wolf", "Elephant", "Shark", "Cat", "Dog", "Dolphin"];

const animalCategories = [
    {label: "Mammals", query: "mammal"},
    {label: "Birds", query: "bird"},
    {label: "Reptiles", query: "reptile"},
    {label: "Marine animals", query: "marine"},
    {label: "Insects", query: "insect"},
    {label: "Pets", query: "domestic"},
    {label: "Endangered animals", query: "endangered"}
];

type AnimalsIndexPageProps = {
    searchParams?: {
        q?: string | string[];
        letter?: string | string[];
        region?: string | string[];
        location?: string | string[];
        status?: string | string[];
        page?: string | string[];
    };
};

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function isSpeciesRarityStatusKey(value: string): value is SpeciesRarityStatusKey {
    return ["very-rare", "rare", "uncommon", "relatively-common"].includes(value);
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const metaKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const speciesKeywords = Array.from(new Set(speciesEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.animals?.metaTitle || "Animal Species Guides";
    const description = messages.animals?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...metaKeywords, ...speciesKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/animals"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/animals");
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, "/animals")
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/animals"),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/og.png"]
        }
    };
}

export default async function AnimalsIndexPage({searchParams}: AnimalsIndexPageProps) {
    const t = await getTranslations("animals");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/animals");
    const query = getSingleParam(searchParams?.q) ?? "";
    const letter = getSingleParam(searchParams?.letter) ?? "all";
    const regionParam = getSingleParam(searchParams?.region);
    const region = regionParam && isNativeRangeRegionKey(regionParam) ? regionParam : "all";
    const locationParam = getSingleParam(searchParams?.location);
    const location = locationParam && getLocationPage(locationParam) ? locationParam : "all";
    const statusParam = getSingleParam(searchParams?.status);
    const status = statusParam && isSpeciesRarityStatusKey(statusParam) ? statusParam : "all";
    const page = Number.parseInt(getSingleParam(searchParams?.page) ?? "1", 10);
    const directoryPage = getSpeciesDirectoryPage({
        query,
        letter,
        region,
        location,
        status,
        page: Number.isFinite(page) ? page : 1
    });

    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        hasPart: directoryPage.entries.map((entry) => ({
            "@type": "Article",
            headline: entry.heroTitle,
            about: entry.name,
            url: getAbsoluteUrl(locale, `/animals/${entry.slug}`)
        }))
    };

    return (
        <section className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-20 md:gap-24">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-5 text-center items-center max-w-5xl mx-auto">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-6xl md:text-7xl lg:text-8xl text-white tracking-tight">{t("title")}</h1>
                <p className="text-xl md:text-2xl text-ink-100 max-w-4xl">{t("description")}</p>
                <p className="text-base md:text-lg text-ink-300 max-w-3xl">{t("heroSupporting")}</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
                    <Link href="#all-animals" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 hover:bg-primary-300 transition-colors">
                        {t("browseAnimals")}
                    </Link>
                    <Link href="/#download" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl border border-line-200 px-7 font-bold text-white hover:border-primary-400 hover:text-primary-100 transition-colors">
                        {t("getAnimalDex")}
                    </Link>
                </div>
            </div>

            <section className="-mx-4 md:-mx-8 bg-gradient-to-r from-primary-500/15 via-primary-500/8 to-transparent px-6 py-10 md:px-12 md:py-12">
                <div className="max-w-5xl mx-auto flex flex-col gap-5">
                    <div className="flex flex-col gap-2 text-center">
                        <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("searchTitle")}</h2>
                        <p className="text-ink-200 text-lg">{t("searchDescription")}</p>
                    </div>
                    <form action={`${getLocalePath(locale, "/animals")}#all-animals`} method="get" className="flex flex-col sm:flex-row gap-3">
                        <input
                            name="q"
                            defaultValue={query}
                            placeholder={t("searchPlaceholder")}
                            className="min-h-[3.75rem] flex-1 rounded-2xl border border-line-300 bg-canvas-950/80 px-5 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                        />
                        <button type="submit" className="min-h-[3.75rem] rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 hover:bg-primary-300 transition-colors">
                            {t("searchButton")}
                        </button>
                    </form>
                    <div className="flex flex-wrap justify-center items-center gap-2">
                        <span className="mr-1 text-sm text-ink-300">{t("popularSearches")}:</span>
                        {popularSearches.map((animal) => (
                            <Link key={animal} href={`/animals?q=${encodeURIComponent(animal)}#all-animals`} className="rounded-full bg-surface-800/70 px-3 py-1.5 text-sm text-ink-200 hover:text-primary-100 transition-colors">
                                {animal}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="flex flex-col gap-9">
                <div className="max-w-3xl flex flex-col gap-3">
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{t("featuredTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("featuredDescription")}</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {featuredAnimals.map((animal) => (
                        <Link key={animal.slug} href={`/animals/${animal.slug}`} className="group overflow-hidden rounded-3xl bg-surface-800/50">
                            <SpeciesImage
                                slug={animal.slug}
                                alt={`${animal.name}: ${animal.lesson}`}
                                sizes="(min-width: 1024px) 22vw, 46vw"
                                className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="p-4 md:p-5">
                                <h3 className="text-xl md:text-2xl font-bold text-white">{animal.name}</h3>
                                <p className="mt-1 text-sm md:text-base text-ink-300">{animal.lesson}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-8">
                <div className="max-w-3xl flex flex-col gap-3">
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{t("categoriesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("categoriesDescription")}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {animalCategories.map((category) => (
                        <Link key={category.label} href={`/animals?q=${encodeURIComponent(category.query)}#all-animals`} className="rounded-2xl border border-line-300 bg-surface-900/50 px-5 py-3 text-lg font-semibold text-white hover:border-primary-400 hover:text-primary-100 transition-colors">
                            {category.label}
                        </Link>
                    ))}
                </div>
            </section>

            <section id="all-animals" className="scroll-mt-32 flex flex-col gap-8">
                <div className="max-w-3xl flex flex-col gap-3">
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{t("allGuidesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("allGuidesDescription")}</p>
                </div>
                <SpeciesDirectory
                    locale={locale}
                    speciesEntries={directoryPage.entries}
                    currentPage={directoryPage.currentPage}
                    totalPages={directoryPage.totalPages}
                    currentQuery={directoryPage.query}
                    currentLetter={directoryPage.letter}
                    currentRegion={directoryPage.region}
                    currentLocation={directoryPage.location}
                    currentStatus={directoryPage.status}
                    copy={{
                        readSpecies: t("readSpecies"),
                        filtersButton: t("filtersButton"),
                        closeFiltersButton: t("closeFiltersButton"),
                        locationLabel: t("locationLabel"),
                        locationDescription: t("locationDescription"),
                        allRegions: t("allRegions"),
                        mapAriaLabel: t("mapAriaLabel"),
                        mapActiveLabel: t("mapActiveLabel"),
                        openLocationFilter: t("openLocationFilter"),
                        closeLocationFilter: t("closeLocationFilter"),
                        statusLabel: t("statusLabel"),
                        alphabetLabel: t("alphabetLabel"),
                        filterAll: t("filterAll"),
                        resultsSummary: t("resultsSummary", {count: directoryPage.entries.length, total: directoryPage.total}),
                        noResultsTitle: t("noResultsTitle"),
                        noResultsDescription: t("noResultsDescription"),
                        clearFilters: t("clearFilters"),
                        previousPage: "Previous",
                        nextPage: "Next",
                        pageLabel: "Page {page} of {totalPages}",
                        rarityStatuses: {
                            "very-rare": t("rarityStatuses.veryRare"),
                            "rare": t("rarityStatuses.rare"),
                            "uncommon": t("rarityStatuses.uncommon"),
                            "relatively-common": t("rarityStatuses.relativelyCommon")
                        }
                    }}
                />
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("exploreMoreTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("exploreMoreDescription")}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link href="/pokemon-animals" className="rounded-full border border-primary-500/30 px-4 py-2 text-primary-200 hover:border-primary-400 hover:text-primary-100 transition-colors">
                        {t("explorePokemon")}
                    </Link>
                    <Link href="/animal-hybrids" className="rounded-full border border-primary-500/30 px-4 py-2 text-primary-200 hover:border-primary-400 hover:text-primary-100 transition-colors">
                        {t("exploreHybrids")}
                    </Link>
                    <Link href="/tier-list" className="rounded-full border border-primary-500/30 px-4 py-2 text-primary-200 hover:border-primary-400 hover:text-primary-100 transition-colors">
                        {t("exploreTierLists")}
                    </Link>
                </div>
            </section>

            <div className="rounded-[2.5rem] bg-gradient-to-br from-primary-500/25 via-surface-800 to-violet-500/15 px-7 py-12 md:px-12 lg:px-16 lg:py-16 flex flex-col gap-4 text-center items-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-100 text-lg md:text-xl max-w-3xl">{t("ctaDescription")}</p>
                <StoreLinks />
            </div>
        </section>
    );
}
