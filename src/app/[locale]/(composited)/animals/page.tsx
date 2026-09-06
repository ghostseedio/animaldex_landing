import {Metadata} from "next";
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

function CatalogQuickLinkIcon({icon}: {icon: CatalogQuickLink["icon"]}) {
    const common = "h-3.5 w-3.5 shrink-0";
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
                                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.06em] transition-colors"
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
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
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
            </section>

            <section className="flex flex-col gap-5">
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">{t("featuredTitle")}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
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
