import {Metadata} from "next";
import {templateSafeTitle, withBrandSuffix} from "@/lib/brand-title";
import {Suspense} from "react";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesDirectoryPage, getDefaultSpeciesDirectorySortOrder, speciesEntries, SpeciesEntry} from "@/data/species";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {getBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import {identityKindShortLabel} from "@/lib/identity-kind";
import {localeConfig} from "@/i18n";
import SpeciesDirectory from "./species-directory";
import SpeciesImage from "./species-image";
import AnimalsSearch, {type AnimalsSearchSuggestion} from "./animals-search";
import UniversalSearchField from "@/app/[locale]/(composited)/animals/_components/universal-search-field";
import {getScopedTranslator} from "@/loaders/translation";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

/** Kept in sync with buildDirectoryRequestUrl in ./species-directory. */
const DIRECTORY_API_PATH = "/api/animals/directory";

function getSuggestionBattleTier(entry: SpeciesEntry) {
    if (getLegendaryEarthBeast(entry.slug)) return "S";

    const rawStats = entry.databaseSource?.canonicalGameStats;
    if (!rawStats) return null;

    const stats = {} as SpeciesStats;
    for (const key of STAT_KEYS) {
        const value = Number(rawStats[key]);
        if (!Number.isFinite(value)) return null;
        stats[key] = value;
    }

    return getBattleTier(stats);
}

function toSearchSuggestion(entry: SpeciesEntry): AnimalsSearchSuggestion {
    const identityKind = entry.databaseSource?.identityKind ?? null;
    return {
        name: entry.name,
        slug: entry.slug,
        scientificName: entry.analysis.scientificName,
        category: entry.analysis.category,
        animalDexNumber: getAnimalDexNumberFromEntry(entry),
        battleTier: getSuggestionBattleTier(entry),
        identityKind,
        identityKindLabel: identityKindShortLabel(identityKind)
    };
}

const featuredAnimals = [
    {slug: "barn-owl", name: "Owl", lesson: "Precision and deep listening"},
    {slug: "wolf", name: "Wolf", lesson: "Cooperation and social intelligence"},
    {slug: "elephant", name: "Elephant", lesson: "Memory and family wisdom"},
    {slug: "great-white-shark", name: "Shark", lesson: "Momentum and sensory power"}
];

type CatalogQuickLink = {
    label: string;
    href: string;
    kind: "query" | "sort" | "tier";
    icon: "bird" | "paw" | "bolt" | "gem" | "snail" | "mountain" | "alert" | "lizard";
    tier?: "S" | "A" | "B";
};

const hubTrendingSearches = [
    {query: "tiger", isPopular: true},
    {query: "lion", isPopular: true},
    {query: "wolf", isPopular: true},
    {query: "owl", isPopular: true},
    {query: "bird", isPopular: false},
    {query: "shark", isPopular: false},
    {query: "reptile", isPopular: false},
    {query: "endangered", isPopular: false}
];

const catalogQuickLinks: CatalogQuickLink[] = [
    {label: "Birds", href: "/animals?q=bird", kind: "query", icon: "bird"},
    {label: "Pets", href: "/animals?q=domestic", kind: "query", icon: "paw"},
    {label: "Fastest animals", href: "/animals?sort=speed", kind: "sort", icon: "bolt"},
    {label: "Rarest animals", href: "/animals?sort=rarity", kind: "sort", icon: "gem"},
    {label: "Slowest animals", href: "/animals?sort=speed&order=asc", kind: "sort", icon: "snail"},
    {label: "Biggest animals", href: "/animals?sort=size", kind: "sort", icon: "mountain"},
    {label: "Tier S", href: "/animals?tier=S", kind: "tier", icon: "bolt", tier: "S"},
    {label: "Tier A", href: "/animals?tier=A", kind: "tier", icon: "bolt", tier: "A"},
    {label: "Tier B", href: "/animals?tier=B", kind: "tier", icon: "bolt", tier: "B"},
    {label: "Endangered animals", href: "/animals?q=endangered", kind: "query", icon: "alert"},
    {label: "Reptiles", href: "/animals?q=reptile", kind: "query", icon: "lizard"}
];

const TIER_CHIP_STYLE = {
    S: {
        color: "rgba(167, 244, 50, 1)",
        background: "rgba(167, 244, 50, 0.14)",
        border: "rgba(167, 244, 50, 0.4)",
        activeBackground: "rgba(167, 244, 50, 0.22)",
        activeBorder: "rgba(167, 244, 50, 0.55)"
    },
    A: {
        color: "rgba(167, 244, 50, 0.92)",
        background: "rgba(167, 244, 50, 0.12)",
        border: "rgba(167, 244, 50, 0.34)",
        activeBackground: "rgba(167, 244, 50, 0.2)",
        activeBorder: "rgba(167, 244, 50, 0.5)"
    },
    B: {
        color: "rgba(34, 211, 238, 0.95)",
        background: "rgba(34, 211, 238, 0.12)",
        border: "rgba(34, 211, 238, 0.36)",
        activeBackground: "rgba(34, 211, 238, 0.2)",
        activeBorder: "rgba(34, 211, 238, 0.5)"
    }
} as const;

function CatalogQuickLinkIcon({icon, className}: {icon: CatalogQuickLink["icon"]; className?: string}) {
    const common = `shrink-0 ${className ?? "h-3.5 w-3.5"}`;
    switch (icon) {
        case "bird":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 14c2-1 4-2 7-1 2 .5 3.5 1.5 5 1.5 2 0 4-1.5 4-1.5s-1 4-5 4c-2.5 0-4-1-5.5-2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 13c1-3 3.5-5.5 7-6-1.5 2-2 3.5-2 5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="18.5" cy="7.2" r="0.7" fill="currentColor" stroke="none" />
                </svg>
            );
        case "paw":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden="true">
                    <ellipse cx="12" cy="16.5" rx="3.6" ry="3" />
                    <circle cx="8.2" cy="10.8" r="1.55" />
                    <circle cx="10.7" cy="8.8" r="1.55" />
                    <circle cx="13.3" cy="8.8" r="1.55" />
                    <circle cx="15.8" cy="10.8" r="1.55" />
                </svg>
            );
        case "bolt":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <path d="M13 3 6.5 13H12l-.5 8L18.5 11H13l0-8Z" strokeLinejoin="round" />
                </svg>
            );
        case "gem":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 8.5 9.5 4h5L18 8.5 12 20 6 8.5Z" strokeLinejoin="round" />
                    <path d="M6 8.5h12M9.5 4 12 8.5 14.5 4" strokeLinejoin="round" />
                </svg>
            );
        case "snail":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3.5 16.5h11.5c2.5 0 4.5-1.8 4.5-4.2S18 8 15.5 8H13" strokeLinecap="round" />
                    <circle cx="10" cy="13.5" r="3.2" />
                    <circle cx="10" cy="13.5" r="1.3" />
                    <path d="M15.5 8c.8-1.4 1.2-2.6 1-3.5M17.8 8c.9-1.3 1.5-2.4 1.4-3.4" strokeLinecap="round" />
                </svg>
            );
        case "mountain":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="m3.5 17.5 5-8 3 4.5 2.5-3.5 6.5 7" strokeLinejoin="round" />
                    <path d="m10.5 10 1.6-2.4L14 10" strokeLinejoin="round" />
                </svg>
            );
        case "alert":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M12 4.5 20 18.5H4L12 4.5Z" strokeLinejoin="round" />
                    <path d="M12 10v4.5M12 16.8v.2" strokeLinecap="round" />
                </svg>
            );
        case "lizard":
            return (
                <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 13.5c2.5 0 4-.8 5.5-2 1.2-1 2.3-1.5 3.5-1.5 2 0 3.5 1.2 5 2.5" strokeLinecap="round" />
                    <path d="M9.5 11.5 7 8.5M12.5 10.2 11 7M15.5 11.5l2-2.8M18 12.5c1 .8 1.8 2 2 3.5" strokeLinecap="round" />
                    <circle cx="6.2" cy="13.2" r="0.7" fill="currentColor" stroke="none" />
                </svg>
            );
        default:
            return null;
    }
}

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

type AnimalsIndexPageProps = {
    params: {locale: string};
};

export async function generateMetadata({params}: AnimalsIndexPageProps): Promise<Metadata> {
    const locale = params.locale;
    const messages = await loadLocaleMessages(locale);
    const metaKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const speciesKeywords = Array.from(new Set(speciesEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.animals?.metaTitle || "Animal Species Guides";
    const description = messages.animals?.metaDescription || messages.meta?.description || "";

    return {
        title: templateSafeTitle(title),
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
            title: withBrandSuffix(title),
            description,
            url: getLocalePath(locale, "/animals"),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: withBrandSuffix(title)
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: withBrandSuffix(title),
            description,
            images: ["/images/og.png"]
        }
    };
}

function SpeciesDirectorySkeleton() {
    return (
        <div
            aria-hidden="true"
            className="grid grid-cols-4 gap-0 overflow-hidden bg-black light:bg-transparent sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
        >
            {Array.from({length: 24}, (_, index) => (
                <div key={index} className="aspect-square w-full animate-pulse bg-surface-800/60" />
            ))}
        </div>
    );
}

/**
 * One heading treatment for every section below the directory. The page used to
 * mix a small `text-2xl` heading above the featured grid with `text-4xl` ones on
 * the panels underneath, which read as three unrelated blocks rather than a page.
 */
function SectionHeading({
    title,
    description,
    align = "left"
}: {
    title: string;
    description?: string;
    align?: "left" | "center";
}) {
    const centered = align === "center";

    return (
        <div className={`flex flex-col gap-3 ${centered ? "items-center text-center" : ""}`}>
            <span
                aria-hidden="true"
                className={`h-[3px] w-10 rounded-full ${centered
                    ? "bg-primary-400/70"
                    : "bg-gradient-to-r from-primary-400 to-primary-500/20"}`}
            />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
            {description ? (
                <p className={`text-sm leading-relaxed text-ink-300 md:text-base ${centered ? "max-w-2xl" : "max-w-3xl"}`}>
                    {description}
                </p>
            ) : null}
        </div>
    );
}

/** Nudges right on hover so a whole-card link shows it is one. */
function CardArrow() {
    return (
        <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-ink-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-200"
        >
            <path
                d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default async function AnimalsIndexPage({params}: AnimalsIndexPageProps) {
    const locale = params.locale;
    const t = await getScopedTranslator(locale, "animals");
    const pageUrl = getAbsoluteUrl(locale, "/animals");
    const query = "";
    const letter = "all";
    const region = "all" as const;
    const location = "all" as const;
    const status = "all" as const;
    const sort = "number" as const;
    const order = getDefaultSpeciesDirectorySortOrder(sort);
    const tier = "all" as const;
    const ts = await getScopedTranslator(locale, "animalSearch");
    const directoryPage = getSpeciesDirectoryPage({
        query,
        letter,
        region,
        location,
        status,
        sort,
        order,
        tier,
        page: 1,
        entries: speciesEntries
    });
    // The database catalog and per-user capture state are deliberately kept off this
    // page so it stays statically generated; SpeciesDirectory fetches them on mount.
    const capturedSpecies = Object.fromEntries(directoryPage.entries.map((entry) => [entry.slug, false]));
    const speciesImages = Object.fromEntries(directoryPage.entries.map((entry) => [entry.slug, getSpeciesImageRoute(entry.slug)]));
    const publicCaptureSpecies = Object.fromEntries(directoryPage.entries.map((entry) => [entry.slug, false]));

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
        <section className="mx-auto flex w-full max-w-[88rem] flex-col gap-10 px-4 py-6 md:gap-14 md:px-8 md:py-8">
            {/* This page is statically rendered from the local catalog, so SpeciesDirectory
             *  always replaces the server-rendered grid with the database catalog on mount.
             *  Preloading that first page lets the browser start the request while it is
             *  still parsing this document, instead of after hydration. The href has to stay
             *  byte-identical to buildDirectoryRequestUrl(defaults, 1) and must not carry
             *  crossorigin, or the fetch will miss this entry and request the page twice. */}
            <link rel="preload" as="fetch" href={`${DIRECTORY_API_PATH}?page=1`} />

            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            {/* SEO copy stays in the document; UI leads with search. */}
            <header className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                    <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">{t("title")}</h1>
                    <p className="sr-only">{t("description")} {t("heroSupporting")}</p>
                </div>
                <UniversalSearchField
                    basePath={getLocalePath(locale, "/animals")}
                    locale={locale}
                    initialQuery={query}
                    directoryFilterPath={getLocalePath(locale, "/animals")}
                    catalogEntries={speciesEntries
                        .filter((entry) => !getLegendaryEarthBeast(entry.slug))
                        .slice(0, 400)
                        .map((entry) => ({
                            slug: entry.slug,
                            name: entry.name,
                            animalDexNumber: getAnimalDexNumberFromEntry(entry)
                        }))}
                    trending={hubTrendingSearches}
                    copy={{
                        placeholder: ts("placeholder"),
                        searchLabel: ts("searchLabel"),
                        clearLabel: ts("clearLabel"),
                        voiceLabel: ts("voiceLabel"),
                        voiceListening: ts("voiceListening"),
                        recentTitle: ts("recentTitle"),
                        clearAll: ts("clearAll"),
                        seeMore: ts("seeMore"),
                        trendingTitle: ts("trendingTitle"),
                        popularBadge: ts("popularBadge"),
                        suggestionsTitle: ts("suggestionsTitle"),
                        submit: ts("submit"),
                        filterDirectory: ts("filterDirectory")
                    }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                    {catalogQuickLinks.map((item) => {
                        const isActive = false;

                        if (item.kind === "tier" && item.tier) {
                            const tone = TIER_CHIP_STYLE[item.tier];
                            return (
                                <Link
                                    key={item.label}
                                    href={`${item.href}#all-animals`}
                                    className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em] transition-colors"
                                    style={{
                                        color: tone.color,
                                        backgroundColor: isActive ? tone.activeBackground : tone.background,
                                        borderColor: isActive ? tone.activeBorder : tone.border
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{backgroundColor: tone.color}}
                                    />
                                    {item.label}
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.label}
                                href={`${item.href}#all-animals`}
                                className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    isActive
                                        ? "border-primary-400/50 bg-primary-400/15 text-primary-100"
                                        : "border-white/10 bg-white/[0.03] text-ink-300 hover:border-primary-400/40 hover:text-primary-100"
                                }`}
                            >
                                <CatalogQuickLinkIcon icon={item.icon} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </header>

            <section id="all-animals" className="scroll-mt-28 flex flex-col gap-5">
                <h2 className="sr-only">{t("allGuidesTitle")}</h2>
                {/* SpeciesDirectory reads useSearchParams; without this boundary Next
                    opts the whole route out of server rendering and ships an empty grid. */}
                <Suspense fallback={<SpeciesDirectorySkeleton />}>
                <SpeciesDirectory
                    locale={locale}
                    speciesEntries={directoryPage.entries}
                    capturedSpecies={capturedSpecies}
                    speciesImages={speciesImages}
                    publicCaptureSpecies={publicCaptureSpecies}
                    currentPage={directoryPage.currentPage}
                    totalPages={directoryPage.totalPages}
                    total={directoryPage.total}
                    currentQuery={directoryPage.query}
                    currentLetter={directoryPage.letter}
                    currentRegion={directoryPage.region}
                    currentLocation={directoryPage.location}
                    currentStatus={directoryPage.status}
                    currentSort={directoryPage.sort}
                    currentOrder={directoryPage.order}
                    currentTier={directoryPage.tier}
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
                        sortLabel: t("sortLabel"),
                        sortAscendingLabel: t("sortAscendingLabel"),
                        sortDescendingLabel: t("sortDescendingLabel"),
                        filterAll: t("filterAll"),
                        resultsSummary: t("resultsSummary", {count: "{count}", total: "{total}"}),
                        loadingMore: t("loadingMore"),
                        perPageLabel: t("perPageLabel"),
                        paginationLabel: t("paginationLabel"),
                        paginationPrevious: t("paginationPrevious"),
                        paginationNext: t("paginationNext"),
                        paginationPage: t("paginationPage", {page: "{page}", total: "{total}"}),
                        noResultsTitle: t("noResultsTitle"),
                        noResultsDescription: t("noResultsDescription"),
                        clearFilters: t("clearFilters"),
                        battleTierChip: t("battleTierChip", {tier: "{tier}"}),
                        sortOptions: {
                            number: {title: t("sortNumberTitle"), detail: t("sortNumberDetail")},
                            rarity: {title: t("sortRarityTitle"), detail: t("sortRarityDetail")},
                            dominance: {title: t("sortDominanceTitle"), detail: t("sortDominanceDetail")},
                            speed: {title: t("sortSpeedTitle"), detail: t("sortSpeedDetail")},
                            size: {title: t("sortSizeTitle"), detail: t("sortSizeDetail")},
                            intelligence: {title: t("sortIntelligenceTitle"), detail: t("sortIntelligenceDetail")},
                            name: {title: t("sortNameTitle"), detail: t("sortNameDetail")}
                        },
                        rarityStatuses: {
                            "very-rare": t("rarityStatuses.veryRare"),
                            "rare": t("rarityStatuses.rare"),
                            "uncommon": t("rarityStatuses.uncommon"),
                            "relatively-common": t("rarityStatuses.relativelyCommon")
                        }
                    }}
                />
                </Suspense>
            </section>

            <section className="flex flex-col gap-6">
                <SectionHeading title={t("featuredTitle")} description={t("featuredDescription")} />
                {/* Hairline gaps over a rule-coloured bed, so these read as one tiled
                    surface like the species grid above rather than floating cards. */}
                <div className="grid grid-cols-2 gap-px overflow-hidden bg-line-300 lg:grid-cols-4">
                    {featuredAnimals.map((animal) => (
                        <Link
                            key={animal.slug}
                            href={`/animals/${animal.slug}`}
                            className="group relative flex flex-col overflow-hidden bg-surface-900 transition-colors duration-300 hover:bg-surface-800/70 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-200"
                        >
                            {/* Lit plinth: the artwork is a cut-out, so it needs a light
                                source behind it rather than a flat panel. */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 top-0 aspect-square bg-[radial-gradient(58%_54%_at_50%_44%,rgba(167,244,50,0.10),transparent_70%)] opacity-80 transition-opacity duration-500 group-hover:opacity-100"
                            />
                            <SpeciesImage
                                slug={animal.slug}
                                alt={`${animal.name}: ${animal.lesson}`}
                                fit="contain"
                                sizes="(min-width: 1024px) 22vw, 46vw"
                                surfaceClassName="bg-transparent"
                                imageClassName="p-5 transition-transform duration-500 ease-out group-hover:scale-[1.06] sm:p-7"
                                className="aspect-square w-full"
                            />
                            <div className="relative flex items-center gap-2 border-t border-line-300 px-4 py-3.5 sm:px-5 sm:py-4">
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-display text-base font-bold tracking-tight text-white sm:text-lg lg:text-xl">{animal.name}</h3>
                                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-300 sm:text-sm">{animal.lesson}</p>
                                </div>
                                <CardArrow />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-6">
                <SectionHeading title={t("exploreMoreTitle")} description={t("exploreMoreDescription")} />
                <div className="grid grid-cols-1 gap-px overflow-hidden bg-line-300 sm:grid-cols-3">
                    {[
                        {href: "/pokemon-animals", label: t("explorePokemon"), icon: "gem" as const},
                        {href: "/animal-hybrids", label: t("exploreHybrids"), icon: "paw" as const},
                        {href: "/tier-list", label: t("exploreTierLists"), icon: "bolt" as const}
                    ].map((collection) => (
                        <Link
                            key={collection.href}
                            href={collection.href}
                            className="group flex items-center gap-4 bg-surface-900 px-4 py-5 transition-colors duration-300 hover:bg-surface-800/70 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-200 sm:px-5"
                        >
                            <span className="grid h-10 w-10 shrink-0 place-items-center border border-primary-500/25 bg-primary-400/10 text-primary-200 transition-colors duration-300 group-hover:border-primary-400/50 group-hover:bg-primary-400/16">
                                <CatalogQuickLinkIcon icon={collection.icon} className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-semibold text-white sm:text-base">{collection.label}</span>
                            <CardArrow />
                        </Link>
                    ))}
                </div>
            </section>

            <section className="relative overflow-hidden border-y border-line-300 bg-surface-900 px-5 py-12 md:px-12 md:py-16">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_130%_at_50%_0%,rgba(167,244,50,0.15),transparent_62%)]"
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/50 to-transparent"
                />
                <div className="relative flex flex-col items-center gap-6">
                    <SectionHeading align="center" title={t("ctaTitle")} description={t("ctaDescription")} />
                    <ul className="flex flex-wrap justify-center gap-2">
                        {[t("ctaSupportOne"), t("ctaSupportTwo"), t("ctaSupportThree")].map((support) => (
                            <li
                                key={support}
                                className="inline-flex items-center gap-1.5 border border-line-200 bg-surface-800/60 px-3 py-1.5 text-xs font-medium text-ink-200"
                            >
                                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary-400" />
                                {support}
                            </li>
                        ))}
                    </ul>
                    <StoreLinks className="!mt-2" />
                </div>
            </section>
        </section>
    );
}
