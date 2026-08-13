import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {LocationPage} from "@/data/locations";
import {getUniquePlaceSpeciesSlugs, WildlifePlace} from "@/data/location-places";
import {getSpeciesBySlug} from "@/data/species";
import {getAbsoluteUrl} from "@/lib/site";
import AnimalsToSpot, {type PlaceSpecies} from "./animals-to-spot";
import PlacesSearchFilter from "./places-search-filter";
import {PlaceCardLabels} from "./place-card";

export type LocationPlacesKind = "zoos" | "wildlife-reserves";

export type LocationPlacesLabels = PlaceCardLabels & {
    locations: string;
    pageCrumb: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    heroCopy: string;
    placesCount: string;
    animalsCount: string;
    quickSummaryTitle: string;
    quickSummary: string;
    searchTitle: string;
    searchDescription: string;
    searchLabel: string;
    searchPlaceholder: string;
    allTypes: string;
    allAnimals: string;
    allBestFor: string;
    resultCount: string;
    noResults: string;
    reset: string;
    featuredPlacesTitle: string;
    animalsTitle: string;
    animalsDescription: string;
    readSpecies: string;
    relatedSpeciesTitle: string;
    tipsTitle: string;
    tips: string[];
    backToLocation: string;
    browseLocations: string;
    browseAnimals: string;
    emptyTitle: string;
    emptyDescription: string;
    ctaTitle: string;
    ctaDescription: string;
    getAnimalDex: string;
    captiveNote: string;
};

export default function LocationPlacesPage({locale, location, places, kind, labels, species}: {
    locale: string;
    location: LocationPage;
    places: WildlifePlace[];
    kind: LocationPlacesKind;
    labels: LocationPlacesLabels;
    species: PlaceSpecies[];
}) {
    const speciesSlugs = getUniquePlaceSpeciesSlugs(places);
    const relatedSpecies = species;
    const pathname = `/locations/${location.slug}/${kind}`;
    const itemListSchema = places.length ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: labels.title,
        itemListElement: places.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: entry.name,
            url: `${getAbsoluteUrl(locale, pathname)}#${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        }))
    } : null;
    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: labels.title,
        description: labels.subtitle,
        url: getAbsoluteUrl(locale, pathname),
        inLanguage: locale,
        isPartOf: {"@type": "WebPage", url: getAbsoluteUrl(locale, `/locations/${location.slug}`), name: location.name}
    };
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {"@type": "ListItem", position: 1, name: labels.locations, item: getAbsoluteUrl(locale, "/locations")},
            {"@type": "ListItem", position: 2, name: location.name, item: getAbsoluteUrl(locale, `/locations/${location.slug}`)},
            {"@type": "ListItem", position: 3, name: labels.pageCrumb, item: getAbsoluteUrl(locale, pathname)}
        ]
    };

    return (
        <main className="w-full max-w-[88rem] mx-auto px-4 py-10 md:px-8 md:py-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, breadcrumbSchema, ...(itemListSchema ? [itemListSchema] : [])])}} />
            <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-300">
                <Link href="/locations" className="hover:text-primary-100">{labels.locations}</Link><span aria-hidden="true">→</span>
                <Link href={`/locations/${location.slug}`} className="hover:text-primary-100">{location.name}</Link><span aria-hidden="true">→</span>
                <span className="text-ink-100">{labels.pageCrumb}</span>
            </nav>

            <div className="flex flex-col gap-16 md:gap-24">
                <section className="relative overflow-hidden rounded-[2.25rem] bg-surface-900/80">
                    <Image src={location.featuredImage.src} alt={location.featuredImage.alt} width={location.featuredImage.width} height={location.featuredImage.height} priority className="absolute inset-0 h-full w-full object-cover opacity-35" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,13,9,0.98)_0%,rgba(7,13,9,0.83)_54%,rgba(7,13,9,0.45)_100%)]" />
                    <div className="relative max-w-4xl px-6 py-10 md:px-12 md:py-14">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.eyebrow}</p>
                        <h1 className="mt-4 font-display text-5xl font-bold tracking-tight text-white md:text-6xl">{labels.title}</h1>
                        <p className="mt-4 text-xl leading-8 text-amber-50">{labels.subtitle}</p>
                        <p className="mt-4 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{labels.heroCopy}</p>
                        <div className="mt-7 flex flex-wrap gap-2.5">
                            <span className="rounded-full bg-white/[0.08] px-3.5 py-2 text-sm text-ink-100">{location.name}</span>
                            {places[0]?.country ? <span className="rounded-full bg-white/[0.08] px-3.5 py-2 text-sm text-ink-100">{places[0].country}</span> : null}
                            <span className="rounded-full bg-white/[0.08] px-3.5 py-2 text-sm text-ink-100">{places.length} {labels.placesCount}</span>
                            <span className="rounded-full bg-white/[0.08] px-3.5 py-2 text-sm text-ink-100">{speciesSlugs.length} {labels.animalsCount}</span>
                        </div>
                    </div>
                </section>

                <section className="grid gap-5 md:grid-cols-[0.75fr_1.25fr] md:items-start">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.quickSummaryTitle}</h2>
                    <p className="text-lg leading-8 text-ink-100">{labels.quickSummary}</p>
                </section>

                {places.length ? (
                    <>
                        <section>
                            <div className="mb-7 max-w-3xl">
                                <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.searchTitle}</h2>
                                <p className="mt-3 text-lg leading-8 text-ink-200">{labels.searchDescription}</p>
                            </div>
                            <PlacesSearchFilter places={places} fallbackImage={location.featuredImage} labels={labels} />
                        </section>

                        <AnimalsToSpot species={species} title={labels.animalsTitle} description={labels.animalsDescription} readSpecies={labels.readSpecies} captiveNote={kind === "zoos" ? labels.captiveNote : undefined} />

                        <section>
                            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.relatedSpeciesTitle}</h2>
                            <div className="mt-5 flex flex-wrap gap-2.5">
                                {relatedSpecies.map((entry) => <Link key={entry.slug} href={`/animals/${entry.slug}`} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-primary-200 hover:bg-white/10">{entry.name}</Link>)}
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="rounded-[2rem] bg-surface-900/65 px-6 py-12 text-center md:px-10">
                        <h2 className="font-display text-3xl font-bold text-white">{labels.emptyTitle}</h2>
                        <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-ink-200">{labels.emptyDescription}</p>
                        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link href="/locations" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary-400 px-6 font-bold text-canvas-950">{labels.browseLocations}</Link>
                            <Link href="/animals" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white/[0.07] px-6 font-bold text-white">{labels.browseAnimals}</Link>
                        </div>
                    </section>
                )}

                <section className="rounded-[2rem] bg-[linear-gradient(135deg,rgba(28,47,33,0.9),rgba(12,20,15,0.96))] px-6 py-9 md:px-10">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.tipsTitle}</h2>
                    <ul className="mt-6 grid gap-3 md:grid-cols-2">
                        {labels.tips.map((tip) => <li key={tip} className="flex gap-3 text-base leading-7 text-ink-100"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-400" />{tip}</li>)}
                    </ul>
                </section>

                <section className="border-t border-white/[0.08] pt-9">
                    <div className="flex flex-wrap gap-3">
                        <Link href={`/locations/${location.slug}`} className="rounded-full bg-white/[0.06] px-4 py-2 font-semibold text-primary-200 hover:bg-white/10">{labels.backToLocation}</Link>
                        <Link href="/locations" className="rounded-full bg-white/[0.06] px-4 py-2 font-semibold text-primary-200 hover:bg-white/10">{labels.browseLocations}</Link>
                        <Link href="/animals" className="rounded-full bg-white/[0.06] px-4 py-2 font-semibold text-primary-200 hover:bg-white/10">{labels.browseAnimals}</Link>
                        <Link href="/blog" className="rounded-full bg-white/[0.06] px-4 py-2 font-semibold text-primary-200 hover:bg-white/10">Animal stories</Link>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_10%_20%,rgba(46,255,74,0.13),transparent_35%),linear-gradient(135deg,rgba(25,43,30,0.95),rgba(10,18,13,0.98))] px-6 py-10 text-center md:px-12 md:py-14">
                    <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{labels.ctaTitle}</h2>
                    <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-ink-100 md:text-xl">{labels.ctaDescription}</p>
                    <StoreLinks className="mt-7" />
                    <Link href="/animals" className="mt-5 inline-flex min-h-11 items-center text-primary-200 hover:text-primary-100">{labels.browseAnimals} →</Link>
                </section>
            </div>
        </main>
    );
}
