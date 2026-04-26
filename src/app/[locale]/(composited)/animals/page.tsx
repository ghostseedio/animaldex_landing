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
                acc[localeItem] = `/${localeItem}/animals`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/animals`
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
                    url: "/images/og-animaldex.svg",
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
            images: ["/images/og-animaldex.svg"]
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
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <SpeciesDirectory
                locale={locale}
                speciesEntries={directoryPage.entries}
                totalSpecies={directoryPage.total}
                currentPage={directoryPage.currentPage}
                totalPages={directoryPage.totalPages}
                currentQuery={directoryPage.query}
                currentLetter={directoryPage.letter}
                currentRegion={directoryPage.region}
                currentLocation={directoryPage.location}
                currentStatus={directoryPage.status}
                copy={{
                    readSpecies: t("readSpecies"),
                    searchPlaceholder: t("searchPlaceholder"),
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
                    resultsSummary: t("resultsSummary"),
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

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-3 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </section>
    );
}
