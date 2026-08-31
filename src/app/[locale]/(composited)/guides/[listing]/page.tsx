import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import GuideCard from "@/components/guides/guide-card";
import {GuideBookingRequestCta} from "@/components/guides/guide-booking-request";
import {GuidePageView} from "@/components/guides/guide-analytics";
import {HowBookingWorks} from "@/components/guides/how-booking-works";
import {earnPaths} from "@/data/earn-economy";
import {getPublicGuideListing, getPublicGuideListings} from "@/data/guide-marketplace";
import {isGuideListingIndexable} from "@/lib/guide-listing-quality";
import {
    categoryLabel,
    formatDuration,
    formatGuidePrice,
    guideAreaServedName,
    guideHostName,
    guideLocationSlug,
    guidePath,
    guideSeo,
    guideStructuredData,
    isLocationPageIndexable,
    locationInventory,
    parseGuideRouteSegment
} from "@/lib/guide-marketplace-core";
import {earnBreadcrumbList} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getViewerUserId} from "@/lib/viewer";

export const revalidate = 300;

type Props = {params: {locale: string; listing: string}};

const categoryExplore: Record<string, string> = {
    herping: "Reptiles, amphibians, and other herps that are active on public paths — never a promised species list.",
    birding: "Local birdlife at the pace of the morning or the weather, with identification help from your Guide.",
    night_wildlife: "Species that become active after dark. Lights are for looking, not for luring.",
    wildlife_photography: "Field time and identification context while you shoot. This is not a staged set.",
    marine_wildlife: "Coastal and shoreline wildlife from publicly accessible water edges.",
    insects_macro: "Slower looking at insects and other small wildlife most people walk past.",
    general_wildlife: "A mixed walk for whatever is active that day — birds, mammals, reptiles, or insects."
};

async function resolve(params: Props["params"]) {
    const route = parseGuideRouteSegment(params.listing);
    if (!route) return null;
    const listing = await getPublicGuideListing(route.listingId);
    return listing ? {route, listing} : null;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const resolved = await resolve(params);
    if (!resolved) return {title: "Wildlife Guide unavailable", robots: {index: false, follow: false}};
    const {listing} = resolved;
    const canonicalPath = guidePath(listing);
    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const seo = guideSeo(listing);
    const indexable = isGuideListingIndexable(listing);
    const ogImage = listing.cover_image_url?.startsWith("https://")
        ? listing.cover_image_url
        : "/images/og.png";
    return {
        title: {absolute: seo.title},
        description: seo.description,
        robots: indexable ? {index: true, follow: true} : {index: false, follow: true},
        alternates: {canonical: canonicalPath},
        openGraph: {
            type: "website",
            title: seo.title,
            description: seo.description,
            url: canonicalUrl,
            siteName: "AnimalDex",
            images: [{url: ogImage, width: 1200, height: 630, alt: listing.title}]
        },
        twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: [ogImage]}
    };
}

export default async function GuideListingPage({params}: Props) {
    const resolved = await resolve(params);
    if (!resolved) notFound();
    const {listing} = resolved;
    const canonicalPath = guidePath(listing);
    if (`/${params.listing}` !== canonicalPath.replace("/guides", "")) redirect(canonicalPath);
    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const structuredData = [
        guideStructuredData(listing, canonicalUrl, params.locale),
        earnBreadcrumbList(params.locale, [
            {name: "Home", path: "/"},
            {name: "Wildlife experiences", path: earnPaths.wildlifeExperiences},
            {name: listing.title, path: canonicalPath}
        ])
    ];
    const allListings = await getPublicGuideListings();
    const locationSlug = guideLocationSlug(listing);
    const related = allListings.filter((item) => item.id !== listing.id && (
        item.service_category === listing.service_category || guideLocationSlug(item) === locationSlug
    )).slice(0, 3);
    const showLocationLink = isLocationPageIndexable(locationInventory(allListings, locationSlug));
    const host = guideHostName(listing);
    const username = listing.seller_username?.replace(/^@/, "");
    const signedIn = Boolean(await getViewerUserId());
    const explore = categoryExplore[listing.service_category];
    const hasDescription = listing.description.trim().length > 0;
    const hasSummary = listing.public_summary.trim().length > 0;

    return <>
        <GuidePageView event="guide_listing_view" dimensions={{listing_id: listing.id, service_category: listing.service_category, country: listing.country_code, region: listing.region_code || "", page_type: "listing"}} />
        <GuidePageView event="guide_web_listing_view" dimensions={{listing_id: listing.id, service_category: listing.service_category, country: listing.country_code, region: listing.region_code || "", page_type: "listing"}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replace(/</g, "\\u003c")}} />
        <section className="relative overflow-hidden bg-canvas-950 px-5 pb-20 pt-32 text-white sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(33,192,94,0.18),transparent_42%)]" />
            <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                    <nav className="mb-8 flex flex-wrap gap-2 text-sm text-white/55" aria-label="Breadcrumb">
                        <Link href={earnPaths.wildlifeExperiences} className="hover:text-primary-300">Wildlife Experiences</Link>
                        <span>/</span>
                        {showLocationLink && (
                            <>
                                <Link href={`/wildlife-guides/${locationSlug}`} className="hover:text-primary-300">{guideAreaServedName(listing)}</Link>
                                <span>/</span>
                            </>
                        )}
                        <span>{listing.title}</span>
                    </nav>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-300">
                        {categoryLabel(listing.service_category)} experience near {guideAreaServedName(listing)}
                    </p>
                    <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] sm:text-7xl">{listing.title}</h1>
                    {hasSummary ? <p className="mt-6 max-w-3xl text-xl leading-8 text-white/70">{listing.public_summary}</p> : null}
                    <div className="mt-10 grid gap-4 sm:grid-cols-4">
                        <Fact label="Duration" value={formatDuration(listing.duration_minutes)} />
                        <Fact label="Maximum group" value={`${listing.max_guests} collectors`} />
                        <Fact label="Public area" value={guideAreaServedName(listing)} />
                        <Fact label="Price per person" value={formatGuidePrice(listing.amount_minor, listing.currency_code, params.locale)} />
                    </div>
                </div>
                <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/25">
                    <div className="relative h-80 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(34,211,238,0.16),rgba(0,0,0,0.18))]">
                        {listing.cover_image_url ? (
                            <img src={listing.cover_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <div className="grid h-full place-items-center text-white/35">
                                <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M10 4 8 9l4-2 4 2-2-5" />
                                    <path d="M6 10a6 6 0 0 0 12 0" />
                                    <path d="M7 20h10" />
                                </svg>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
                        <div className="absolute bottom-5 left-5 right-5">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-200">Request, then meet</p>
                            <p className="mt-2 text-sm leading-6 text-white/70">Send a request in AnimalDex. The Guide accepts before details are shared. You pay the Guide directly on the day.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        <section className="bg-canvas-900 px-5 py-20 text-white sm:px-8">
            <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.5fr_1fr]">
                <article className="flex flex-col gap-12">
                    {hasDescription ? (
                        <div>
                            <h2 className="font-display text-3xl">About this experience</h2>
                            <div className="mt-6 whitespace-pre-line text-lg leading-8 text-white/70">{listing.description}</div>
                        </div>
                    ) : null}
                    {explore ? (
                        <div>
                            <h2 className="font-display text-3xl">What you may explore</h2>
                            <p className="mt-4 text-lg leading-8 text-white/70">{explore}</p>
                        </div>
                    ) : null}
                    <div>
                        <h2 className="font-display text-3xl">Who this is for</h2>
                        <p className="mt-4 text-lg leading-8 text-white/70">
                            A {formatDuration(listing.duration_minutes).toLowerCase()} {categoryLabel(listing.service_category).toLowerCase()} outing for small groups of up to {listing.max_guests}.
                        </p>
                    </div>
                    <div>
                        <h2 className="font-display text-3xl">Duration, group size, and price</h2>
                        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                            <Fact label="Duration" value={formatDuration(listing.duration_minutes)} />
                            <Fact label="Group size" value={`Up to ${listing.max_guests}`} />
                            <Fact label="Price" value={`${formatGuidePrice(listing.amount_minor, listing.currency_code, params.locale)} / person`} />
                        </dl>
                    </div>
                    <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-white/70">
                        <h2 className="font-display text-xl text-white">Wildlife-first rules</h2>
                        <p className="mt-3"><strong className="text-white">Wildlife stays wild.</strong> Sightings are never guaranteed. The public area is approximate. Exact meeting details stay private until a request is accepted in AnimalDex. Wildlife should not be baited, lured, handled, or disturbed for a photo.</p>
                    </aside>
                </article>
                <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-7">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">Meet your Guide</p>
                    <h2 className="mt-3 font-display text-2xl">Hosted by {username ? `@${username}` : host}</h2>
                    <dl className="mt-6 space-y-4 text-white/70">
                        <FactRow value={listing.qualifying_wild_species_count.toLocaleString(params.locale)} label="wild species" />
                        <FactRow value={listing.qualifying_wild_capture_count.toLocaleString(params.locale)} label="qualifying wild captures" />
                    </dl>
                    <div className="mt-8">
                        <GuideBookingRequestCta
                            listingId={listing.id}
                            category={listing.service_category}
                            listingPath={canonicalPath}
                            signedIn={signedIn}
                            maxGuests={listing.max_guests}
                        />
                    </div>
                </aside>
            </div>
        </section>
        <section className="bg-canvas-950 px-5 py-20 text-white sm:px-8">
            <div className="mx-auto max-w-5xl">
                <HowBookingWorks />
                <p className="mt-8 text-sm text-white/45">
                    Browse more on{" "}
                    <Link href={earnPaths.wildlifeExperiences} className="text-primary-300 hover:text-white">Wildlife Experiences</Link>
                    {" or the "}
                    <Link href={earnPaths.wildlifeGuidesMarketplace} className="text-primary-300 hover:text-white">Guide marketplace</Link>.
                </p>
            </div>
        </section>
        {related.length > 0 && (
            <section className="bg-canvas-900 px-5 py-20 text-white sm:px-8">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-display text-3xl">Related wildlife experiences</h2>
                    <div className="mt-8 grid gap-5 md:grid-cols-3">
                        {related.map((item) => <GuideCard key={item.id} listing={item} locale={params.locale} />)}
                    </div>
                </div>
            </section>
        )}
    </>;
}

function Fact({label, value}: {label: string; value: string}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-wider text-white/45">{label}</div>
            <div className="mt-1 font-bold">{value}</div>
        </div>
    );
}

function FactRow({value, label}: {value: string | number; label: string}) {
    return (
        <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
            <dt>{label}</dt>
            <dd className="text-2xl font-bold text-white">{value}</dd>
        </div>
    );
}
