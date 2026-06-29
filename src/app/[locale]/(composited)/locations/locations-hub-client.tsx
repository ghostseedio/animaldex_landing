"use client";

import Image from "next/image";
import {CSSProperties, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

export type LocationHubRegion = "africa" | "asia" | "europe" | "north-america" | "south-america" | "oceania";
export type LocationHubType = "zoo" | "park" | "wetland" | "forest" | "beach" | "island" | "city" | "safari" | "backyard" | "farm";

export type LocationHubItem = {
    slug: string;
    name: string;
    title: string;
    description: string;
    image: {src: string; alt: string; width: number; height: number};
    region: LocationHubRegion;
    types: LocationHubType[];
    animalNames: string[];
    placeGuides: {zoos: boolean; reserves: boolean};
    placeGuideTitles: {zoos?: string; reserves?: string};
};

export type LocationPlaceGuideLink = {
    href: string;
    kind: "zoos" | "wildlife-reserves";
    title: string;
    region: LocationHubRegion;
    locationName: string;
    description: string;
    placeCount: number;
    animalCount: number;
    animalsPreview: string[];
    image?: string;
    country?: string;
    searchTerms: string[];
};

type Labels = {
    eyebrow: string;
    heroTitle: string;
    heroDescription: string;
    heroTrust: string;
    exploreMap: string;
    browseLocations: string;
    locationGuidesStat: string;
    animalProfilesStat: string;
    spottingIdeasStat: string;
    mapTitle: string;
    mapDescription: string;
    chooseRegion: string;
    chooseRegionDescription: string;
    locationGuidesCount: string;
    popularAnimals: string;
    viewRegionGuides: string;
    featuredTitle: string;
    featuredDescription: string;
    browseTypeTitle: string;
    browseTypeDescription: string;
    allTitle: string;
    allDescription: string;
    searchPlaceholder: string;
    animalsToSpot: string;
    openGuide: string;
    noGuidesTitle: string;
    noGuidesDescription: string;
    showAll: string;
    ctaTitle: string;
    ctaDescription: string;
    browseAnimals: string;
    relatedTitle: string;
    relatedDescription: string;
    animalWisdom: string;
    animalStories: string;
    animalEncyclopedia: string;
    allRegions: string;
    regions: Record<LocationHubRegion, string>;
    types: Record<LocationHubType, string>;
    findPlacesTitle: string;
    findPlacesDescription: string;
    findPlacesPlaceholder: string;
    allPlaceGuides: string;
    zoosAndParks: string;
    wildlifeReserves: string;
    findPlacesBenefits: string[];
    guidesFound: string;
    placesStat: string;
    animalsStat: string;
    showMoreGuides: string;
    viewAllGuides: string;
    noPlaceGuidesTitle: string;
    noPlaceGuidesBody: string;
    showAllGuides: string;
};

type LocationsHubClientProps = {
    items: LocationHubItem[];
    placeGuideLinks: LocationPlaceGuideLink[];
    animalProfileCount: number;
    labels: Labels;
};

const regions: LocationHubRegion[] = ["africa", "asia", "europe", "north-america", "south-america", "oceania"];
const types: LocationHubType[] = ["zoo", "park", "wetland", "forest", "beach", "island", "city", "safari", "backyard", "farm"];
const featuredSlugs = ["bali", "singapore-zoo", "komodo-national-park", "african-safari", "costa-rica", "australia"];

const regionMapAssets: Record<LocationHubRegion, string[]> = {
    africa: ["/images/native-range/range_north_africa_middle_east.svg", "/images/native-range/range_sub_saharan_africa.svg"],
    asia: ["/images/native-range/range_central_asia.svg", "/images/native-range/range_south_asia.svg", "/images/native-range/range_southeast_asia.svg", "/images/native-range/range_east_asia.svg"],
    europe: ["/images/native-range/range_europe.svg"],
    "north-america": ["/images/native-range/range_north_america.svg"],
    "south-america": ["/images/native-range/range_south_america.svg"],
    oceania: ["/images/native-range/range_australia_oceania.svg"]
};

const pinPositions: Record<LocationHubRegion, {left: string; top: string}> = {
    "north-america": {left: "20%", top: "35%"},
    "south-america": {left: "31%", top: "67%"},
    europe: {left: "50%", top: "30%"},
    africa: {left: "52%", top: "55%"},
    asia: {left: "69%", top: "39%"},
    oceania: {left: "82%", top: "69%"}
};

function MaskLayer({assetPath, active}: {assetPath: string; active: boolean}) {
    const style = {
        backgroundColor: active ? "rgba(46, 255, 74, 0.72)" : "rgba(169, 186, 173, 0.2)",
        maskImage: `url(${assetPath})`,
        WebkitMaskImage: `url(${assetPath})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain"
    } as CSSProperties;

    return <span className="pointer-events-none absolute inset-0 transition-colors duration-300" style={style} />;
}

function RegionMap({selectedRegion, onSelect, labels}: {
    selectedRegion: LocationHubRegion | null;
    onSelect: (region: LocationHubRegion) => void;
    labels: Labels;
}) {
    return (
        <div className="relative aspect-[16/9] min-h-[15rem] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_50%_45%,rgba(56,92,65,0.32),transparent_58%),linear-gradient(145deg,rgba(9,18,12,0.96),rgba(17,28,20,0.92))] p-3 sm:p-5">
            <span
                className="pointer-events-none absolute inset-3 opacity-75 sm:inset-5"
                style={{
                    backgroundColor: "rgba(217,228,217,0.16)",
                    maskImage: "url(/images/native-range/world_base.svg)",
                    WebkitMaskImage: "url(/images/native-range/world_base.svg)",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                    maskSize: "contain",
                    WebkitMaskSize: "contain"
                }}
            />
            {regions.flatMap((region) => regionMapAssets[region].map((assetPath) => (
                <MaskLayer key={assetPath} assetPath={assetPath} active={selectedRegion === region} />
            )))}
            {regions.map((region) => {
                const active = selectedRegion === region;
                return (
                    <button
                        key={region}
                        type="button"
                        aria-pressed={active}
                        aria-label={labels.regions[region]}
                        onClick={() => onSelect(region)}
                        className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1.5 text-[10px] font-bold shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-300 sm:text-xs ${active ? "border-primary-300 bg-primary-400 text-canvas-950 ring-2 ring-primary-400/25" : "border-white/15 bg-canvas-950/85 text-ink-100 hover:border-primary-400/60 hover:text-white"}`}
                        style={pinPositions[region]}
                    >
                        {labels.regions[region]}
                        {active ? <span className="sr-only"> selected</span> : null}
                    </button>
                );
            })}
        </div>
    );
}

function LocationCard({item, labels, featured = false}: {item: LocationHubItem; labels: Labels; featured?: boolean}) {
    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-surface-900/65 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)] transition duration-300 hover:-translate-y-1 hover:bg-surface-900">
            <div className="relative block aspect-[16/10] overflow-hidden bg-surface-800">
                <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    sizes={featured ? "(min-width: 1024px) 31vw, 90vw" : "(min-width: 1280px) 28vw, (min-width: 768px) 45vw, 100vw"}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur">
                    {labels.regions[item.region]}
                </span>
            </div>
            <div className="flex flex-1 flex-col p-5 md:p-6">
                <div className="flex flex-wrap gap-2">
                    {item.types.slice(0, 2).map((type) => (
                        <span key={type} className="rounded-full bg-amber-200/[0.08] px-2.5 py-1 text-xs font-medium text-amber-100/85">
                            {labels.types[type]}
                        </span>
                    ))}
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold text-white">{item.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-200 md:text-base">{item.description}</p>
                {item.animalNames.length > 0 ? (
                    <div className="mt-5 border-t border-white/[0.07] pt-4">
                        <p className="text-xs font-semibold text-ink-300">{labels.animalsToSpot}</p>
                        <p className="mt-1 line-clamp-1 text-sm text-ink-100">{item.animalNames.join(" · ")}</p>
                    </div>
                ) : null}
                <Link href={`/locations/${item.slug}`} className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary-200 hover:text-primary-100">
                    {labels.openGuide} <span aria-hidden="true" className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                </Link>
                {(item.placeGuides.zoos || item.placeGuides.reserves) ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/[0.07] pt-3 text-xs font-semibold">
                        {item.placeGuides.zoos && item.placeGuideTitles.zoos ? <Link href={`/locations/${item.slug}/zoos`} className="text-ink-200 hover:text-primary-100">{item.placeGuideTitles.zoos}</Link> : null}
                        {item.placeGuides.reserves && item.placeGuideTitles.reserves ? <Link href={`/locations/${item.slug}/wildlife-reserves`} className="text-ink-200 hover:text-primary-100">{item.placeGuideTitles.reserves}</Link> : null}
                    </div>
                ) : null}
            </div>
        </article>
    );
}

function PlaceGuideIcon({kind}: {kind: LocationPlaceGuideLink["kind"]}) {
    return kind === "zoos" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="19.5" cy="12" r="1.5"/><path d="M8 18.5c1.7 1.3 6.3 1.3 8 0 1.8-1.4.4-5.5-4-5.5s-5.8 4.1-4 5.5Z"/>
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M19.5 4.5C12 5 6.3 8.4 5.6 14.2c-.3 2.2 1.3 4.3 3.6 4.3 5.8 0 9.2-5.7 10.3-14Z"/><path d="M4 20c3.2-4.8 6.8-7.8 11.5-10"/>
        </svg>
    );
}

function PlaceGuideCard({guide, labels}: {guide: LocationPlaceGuideLink; labels: Labels}) {
    const isZoo = guide.kind === "zoos";
    return (
        <Link
            href={guide.href}
            className={`group flex h-full flex-col rounded-[1.35rem] border p-4 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.9)] md:p-5 ${isZoo ? "border-amber-100/10 bg-[linear-gradient(145deg,rgba(53,48,34,0.34),rgba(29,38,31,0.62))]" : "border-primary-200/10 bg-[linear-gradient(145deg,rgba(29,49,35,0.5),rgba(25,37,31,0.62))]"}`}
        >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-amber-100/85">
                <span className={`grid h-8 w-8 place-items-center rounded-full ${isZoo ? "bg-amber-100/10 text-amber-100" : "bg-primary-300/10 text-primary-200"}`}><PlaceGuideIcon kind={guide.kind} /></span>
                <span>{isZoo ? labels.zoosAndParks : labels.wildlifeReserves}</span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-300">{labels.regions[guide.region]}</span>
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-amber-50 md:text-2xl">{guide.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-200">{guide.description}</p>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink-300">
                <span>{guide.placeCount} {labels.placesStat}</span><span aria-hidden="true">·</span><span>{guide.animalCount} {labels.animalsStat}</span>
            </div>
            {guide.animalsPreview.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {guide.animalsPreview.slice(0, 4).map((animal) => <span key={animal} className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[11px] text-ink-100">{animal}</span>)}
                </div>
            ) : null}
            <span className="mt-4 inline-flex items-center text-sm font-bold text-primary-200 group-hover:text-primary-100">{labels.openGuide} <span className="ml-1 transition-transform group-hover:translate-x-1">→</span></span>
        </Link>
    );
}

export default function LocationsHubClient({items, placeGuideLinks, animalProfileCount, labels}: LocationsHubClientProps) {
    const [selectedRegion, setSelectedRegion] = useState<LocationHubRegion | null>(null);
    const [selectedType, setSelectedType] = useState<LocationHubType | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [placeSearch, setPlaceSearch] = useState("");
    const [placeMode, setPlaceMode] = useState<"all" | "zoos" | "reserves">("all");
    const [placeRegion, setPlaceRegion] = useState<LocationHubRegion | null>(null);
    const [showAllPlaceGuides, setShowAllPlaceGuides] = useState(false);

    const filteredItems = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return items.filter((item) => {
            if (selectedRegion && item.region !== selectedRegion) return false;
            if (selectedType && !item.types.includes(selectedType)) return false;
            if (!normalizedQuery) return true;
            return [item.name, item.title, item.description, ...item.animalNames]
                .some((value) => value.toLowerCase().includes(normalizedQuery));
        });
    }, [items, searchQuery, selectedRegion, selectedType]);

    const selectedRegionItems = selectedRegion ? items.filter((item) => item.region === selectedRegion) : [];
    const popularAnimals = Array.from(new Set(selectedRegionItems.flatMap((item) => item.animalNames))).slice(0, 5);
    const featuredItems = featuredSlugs.map((slug) => items.find((item) => item.slug === slug)).filter((item): item is LocationHubItem => Boolean(item));
    const placeGuideResults = useMemo(() => {
        const normalized = placeSearch.trim().toLowerCase();
        return placeGuideLinks.filter((guide) => {
            if (placeMode === "zoos" && guide.kind !== "zoos") return false;
            if (placeMode === "reserves" && guide.kind !== "wildlife-reserves") return false;
            if (placeRegion && guide.region !== placeRegion) return false;
            if (!normalized) return true;
            return [guide.title, guide.locationName, guide.country || "", guide.description, labels.regions[guide.region], ...guide.searchTerms, ...guide.animalsPreview]
                .some((value) => value.toLowerCase().includes(normalized));
        });
    }, [labels.regions, placeGuideLinks, placeMode, placeRegion, placeSearch]);
    const visiblePlaceGuides = showAllPlaceGuides ? placeGuideResults : placeGuideResults.slice(0, 6);

    function resetPlaceGuides() {
        setPlaceSearch(""); setPlaceMode("all"); setPlaceRegion(null); setShowAllPlaceGuides(false);
    }

    function resetFilters() {
        setSelectedRegion(null);
        setSelectedType(null);
        setSearchQuery("");
    }

    return (
        <div className="flex flex-col gap-20 md:gap-28">
            <section className="relative overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_10%_10%,rgba(46,255,74,0.13),transparent_34%),linear-gradient(135deg,rgba(20,34,24,0.98),rgba(8,14,10,0.98))] px-6 py-9 md:px-10 md:py-12 lg:px-14">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/[0.07] blur-3xl" />
                <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div className="flex flex-col items-start">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.eyebrow}</p>
                        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold tracking-tight text-white md:text-6xl">{labels.heroTitle}</h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100 md:text-xl">{labels.heroDescription}</p>
                        <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <a href="#explore-map" className="flex min-h-12 items-center justify-center rounded-2xl bg-primary-400 px-6 font-bold text-canvas-950 hover:bg-primary-300">{labels.exploreMap}</a>
                            <a href="#location-guides" className="flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-6 font-bold text-white hover:border-primary-300/60">{labels.browseLocations}</a>
                        </div>
                        <p className="mt-5 text-sm text-ink-300">{labels.heroTrust}</p>
                        <div className="mt-7 flex flex-wrap gap-2.5">
                            <span className="rounded-full bg-white/[0.06] px-3.5 py-2 text-sm text-ink-100">{items.length} {labels.locationGuidesStat}</span>
                            <span className="rounded-full bg-white/[0.06] px-3.5 py-2 text-sm text-ink-100">{animalProfileCount} {labels.animalProfilesStat}</span>
                            <span className="rounded-full bg-white/[0.06] px-3.5 py-2 text-sm text-ink-100">{labels.spottingIdeasStat}</span>
                        </div>
                    </div>
                    <div className="relative min-h-[21rem]">
                        {featuredItems.slice(0, 3).map((item, index) => (
                            <Link
                                key={item.slug}
                                href={`/locations/${item.slug}`}
                                className="absolute left-1/2 block w-[84%] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-surface-900 shadow-2xl transition hover:z-20 hover:-translate-y-1"
                                style={{top: `${index * 25}%`, transform: `translateX(-50%) rotate(${(index - 1) * 2.2}deg)`, zIndex: 10 - index}}
                            >
                                <div className="grid grid-cols-[7rem_1fr] items-center gap-4 p-3 sm:grid-cols-[9rem_1fr]">
                                    <Image src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} className="h-24 w-full rounded-2xl object-cover sm:h-28" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-amber-100">{labels.regions[item.region]}</p>
                                        <p className="mt-1 truncate font-display text-xl font-bold text-white">{item.name}</p>
                                        <p className="mt-1 truncate text-sm text-ink-300">{item.animalNames.join(" · ")}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section id="explore-map" className="scroll-mt-28">
                <div className="mb-7 max-w-2xl">
                    <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.mapTitle}</h2>
                    <p className="mt-3 text-lg text-ink-200">{labels.mapDescription}</p>
                </div>
                <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                    <button type="button" aria-pressed={!selectedRegion} onClick={() => setSelectedRegion(null)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${!selectedRegion ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-100"}`}>{labels.allRegions}</button>
                    {regions.map((region) => (
                        <button key={region} type="button" aria-pressed={selectedRegion === region} onClick={() => setSelectedRegion(region)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${selectedRegion === region ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-100 hover:bg-white/10"}`}>{labels.regions[region]}</button>
                    ))}
                </div>
                <div className="grid gap-5 rounded-[2rem] bg-surface-900/55 p-4 md:p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
                    <RegionMap selectedRegion={selectedRegion} onSelect={setSelectedRegion} labels={labels} />
                    <div className="flex min-h-[15rem] flex-col justify-center rounded-[1.75rem] bg-black/15 p-6 md:p-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">{selectedRegion ? labels.regions[selectedRegion] : labels.eyebrow}</p>
                        <h3 className="mt-3 font-display text-3xl font-bold text-white">{selectedRegion ? `${labels.regions[selectedRegion]}` : labels.chooseRegion}</h3>
                        <p className="mt-3 leading-7 text-ink-200">{selectedRegion ? `${selectedRegionItems.length} ${labels.locationGuidesCount}` : labels.chooseRegionDescription}</p>
                        {popularAnimals.length > 0 ? <p className="mt-5 text-sm leading-6 text-ink-100"><span className="font-semibold text-white">{labels.popularAnimals}:</span> {popularAnimals.join(" · ")}</p> : null}
                        <a href="#location-guides" className="mt-6 inline-flex min-h-11 w-fit items-center rounded-xl bg-primary-400 px-5 font-bold text-canvas-950 hover:bg-primary-300">{labels.viewRegionGuides}</a>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[radial-gradient(circle_at_0%_0%,rgba(190,166,105,0.08),transparent_34%),linear-gradient(145deg,rgba(31,45,35,0.72),rgba(18,28,22,0.76))] p-5 md:p-8 lg:p-10">
                <div className="grid gap-9 lg:grid-cols-[0.54fr_1fr] lg:gap-12">
                    <div className="lg:sticky lg:top-28 lg:self-start">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/80">AnimalDex place guides</p>
                        <h2 className="mt-3 font-display text-3xl font-bold text-amber-50 md:text-4xl">{labels.findPlacesTitle}</h2>
                        <p className="mt-4 text-base leading-7 text-ink-200 md:text-lg">{labels.findPlacesDescription}</p>
                        <ul className="mt-6 space-y-3">
                            {labels.findPlacesBenefits.map((benefit) => (
                                <li key={benefit} className="flex items-center gap-3 text-sm font-semibold text-ink-100">
                                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-300/10 text-xs text-primary-200">✓</span>{benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="min-w-0">
                        <label className="relative block">
                            <span className="sr-only">{labels.findPlacesPlaceholder}</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                            <input
                                value={placeSearch}
                                onChange={(event) => {setPlaceSearch(event.target.value); setShowAllPlaceGuides(false);}}
                                placeholder={labels.findPlacesPlaceholder}
                                className="min-h-[3.25rem] w-full rounded-2xl border border-white/10 bg-canvas-950/55 py-3 pl-12 pr-4 text-white outline-none placeholder:text-ink-300 focus:border-primary-400/60"
                            />
                        </label>

                        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                            {(["all", "zoos", "reserves"] as const).map((mode) => (
                                <button key={mode} type="button" aria-pressed={placeMode === mode} onClick={() => {setPlaceMode(mode); setShowAllPlaceGuides(false);}} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${placeMode === mode ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-100 hover:bg-white/10"}`}>
                                    {mode === "all" ? labels.allPlaceGuides : mode === "zoos" ? labels.zoosAndParks : labels.wildlifeReserves}
                                </button>
                            ))}
                        </div>
                        <div className="mt-1 flex gap-2 overflow-x-auto pb-2">
                            <button type="button" aria-pressed={!placeRegion} onClick={() => {setPlaceRegion(null); setShowAllPlaceGuides(false);}} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition ${!placeRegion ? "bg-amber-100 text-canvas-950" : "border border-white/[0.08] text-ink-200 hover:bg-white/[0.05]"}`}>{labels.allRegions}</button>
                            {regions.map((region) => (
                                <button key={region} type="button" aria-pressed={placeRegion === region} onClick={() => {setPlaceRegion(region); setShowAllPlaceGuides(false);}} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition ${placeRegion === region ? "bg-amber-100 text-canvas-950" : "border border-white/[0.08] text-ink-200 hover:bg-white/[0.05]"}`}>{labels.regions[region]}</button>
                            ))}
                        </div>

                        {placeGuideResults.length ? (
                            <>
                                <p className="mt-3 text-sm font-semibold text-ink-300">{placeGuideResults.length} {labels.guidesFound}</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    {visiblePlaceGuides.map((guide, index) => (
                                        <div key={guide.href} className={!showAllPlaceGuides && index >= 4 ? "hidden sm:block" : "block"}>
                                            <PlaceGuideCard guide={guide} labels={labels} />
                                        </div>
                                    ))}
                                </div>
                                {!showAllPlaceGuides && placeGuideResults.length > 4 ? (
                                    <button type="button" onClick={() => setShowAllPlaceGuides(true)} className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-primary-200 hover:border-primary-300/30 hover:bg-white/[0.04] sm:hidden">
                                        {labels.showMoreGuides} <span className="ml-1">↓</span>
                                    </button>
                                ) : null}
                                {!showAllPlaceGuides && placeGuideResults.length > 6 ? (
                                    <button type="button" onClick={() => setShowAllPlaceGuides(true)} className="mt-5 hidden min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-primary-200 hover:border-primary-300/30 hover:bg-white/[0.04] sm:inline-flex">
                                        {labels.viewAllGuides} <span className="ml-1">↓</span>
                                    </button>
                                ) : null}
                            </>
                        ) : (
                            <div className="mt-5 rounded-[1.35rem] border border-white/[0.06] bg-white/[0.035] px-5 py-8 text-center">
                                <h3 className="font-display text-2xl font-bold text-amber-50">{labels.noPlaceGuidesTitle}</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-200">{labels.noPlaceGuidesBody}</p>
                                <button type="button" onClick={resetPlaceGuides} className="mt-5 min-h-11 rounded-xl bg-primary-400 px-5 text-sm font-bold text-canvas-950">{labels.showAllGuides}</button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section>
                <div className="mb-8 max-w-2xl">
                    <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.featuredTitle}</h2>
                    <p className="mt-3 text-lg text-ink-200">{labels.featuredDescription}</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {featuredItems.map((item) => <LocationCard key={item.slug} item={item} labels={labels} featured />)}
                </div>
            </section>

            <section>
                <div className="mb-6 max-w-2xl">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.browseTypeTitle}</h2>
                    <p className="mt-3 text-lg text-ink-200">{labels.browseTypeDescription}</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3">
                    {types.map((type) => (
                        <button key={type} type="button" aria-pressed={selectedType === type} onClick={() => setSelectedType(selectedType === type ? null : type)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition ${selectedType === type ? "bg-amber-200 text-canvas-950" : "bg-white/[0.06] text-ink-100 hover:bg-white/10"}`}>{labels.types[type]}</button>
                    ))}
                </div>
            </section>

            <section id="location-guides" className="scroll-mt-28">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.allTitle}</h2>
                        <p className="mt-3 text-lg text-ink-200">{labels.allDescription}</p>
                    </div>
                    <label className="relative block w-full md:max-w-sm">
                        <span className="sr-only">{labels.searchPlaceholder}</span>
                        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={labels.searchPlaceholder} className="min-h-12 w-full rounded-2xl border border-white/10 bg-surface-900/70 px-4 text-white outline-none placeholder:text-ink-300 focus:border-primary-400/60" />
                    </label>
                </div>
                <p className="mt-5 text-sm text-ink-300">{filteredItems.length} {labels.locationGuidesCount}</p>
                {filteredItems.length > 0 ? (
                    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredItems.map((item) => <LocationCard key={item.slug} item={item} labels={labels} />)}
                    </div>
                ) : (
                    <div className="mt-8 rounded-[2rem] bg-surface-900/60 px-6 py-14 text-center">
                        <h3 className="font-display text-3xl font-bold text-white">{labels.noGuidesTitle}</h3>
                        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-200">{labels.noGuidesDescription}</p>
                        <button type="button" onClick={resetFilters} className="mt-6 min-h-12 rounded-2xl bg-primary-400 px-6 font-bold text-canvas-950">{labels.showAll}</button>
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_10%_20%,rgba(46,255,74,0.12),transparent_35%),linear-gradient(135deg,rgba(25,43,30,0.95),rgba(10,18,13,0.98))] px-6 py-10 text-center md:px-12 md:py-14">
                <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.ctaTitle}</h2>
                <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-ink-100 md:text-xl">{labels.ctaDescription}</p>
                <StoreLinks className="mt-7" />
                <Link href="/animals" className="mt-5 inline-flex min-h-11 items-center text-primary-200 hover:text-primary-100">{labels.browseAnimals} →</Link>
            </section>

            <section className="border-t border-white/[0.08] pt-10">
                <h2 className="font-display text-3xl font-bold text-white">{labels.relatedTitle}</h2>
                <p className="mt-3 max-w-2xl text-ink-200">{labels.relatedDescription}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/animals" className="rounded-full bg-white/[0.06] px-4 py-2 text-primary-200 hover:bg-white/10">{labels.animalEncyclopedia}</Link>
                    <Link href="/animal-wisdom" className="rounded-full bg-white/[0.06] px-4 py-2 text-primary-200 hover:bg-white/10">{labels.animalWisdom}</Link>
                    <Link href="/blog" className="rounded-full bg-white/[0.06] px-4 py-2 text-primary-200 hover:bg-white/10">{labels.animalStories}</Link>
                </div>
            </section>
        </div>
    );
}
