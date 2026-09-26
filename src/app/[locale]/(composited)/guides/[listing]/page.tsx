import type {ComponentType} from "react";
import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {ClockIcon, GroupIcon, MapPinIcon, PriceTagIcon} from "@/app/[locale]/_components/icons";
import GuideCard from "@/components/guides/guide-card";
import {GuideBookingRequestCta} from "@/components/guides/guide-booking-request";
import {GuidePageView} from "@/components/guides/guide-analytics";
import GuideAreaMap from "@/components/guides/guide-area-map";
import {HowBookingWorks} from "@/components/guides/how-booking-works";
import {earnPaths} from "@/data/earn-economy";
import {getGuideAreaLocation} from "@/data/guide-area-geocode";
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

export const revalidate = 86400;

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
    const areaLocation = await getGuideAreaLocation(listing);

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
                    <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <Fact icon={ClockIcon} label="Duration" value={formatDuration(listing.duration_minutes)} />
                        <Fact icon={GroupIcon} label="Maximum group" value={`${listing.max_guests} collectors`} />
                        <Fact icon={MapPinIcon} label="Public area" value={guideAreaServedName(listing)} />
                        <Fact icon={PriceTagIcon} label="Price per person" value={formatGuidePrice(listing.amount_minor, listing.currency_code, params.locale)} />
                    </div>
                </div>
                <div className="overflow-hidden border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/25">
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
                            <Fact icon={ClockIcon} label="Duration" value={formatDuration(listing.duration_minutes)} />
                            <Fact icon={GroupIcon} label="Group size" value={`Up to ${listing.max_guests}`} />
                            <Fact icon={PriceTagIcon} label="Price" value={`${formatGuidePrice(listing.amount_minor, listing.currency_code, params.locale)} / person`} />
                        </dl>
                    </div>
                    {areaLocation ? (
                        <div>
                            <h2 className="font-display text-3xl">Where you&rsquo;ll be looking</h2>
                            <p className="mt-4 flex items-center gap-2 text-lg leading-8 text-white/70">
                                <MapPinIcon className="shrink-0 text-primary-300" size={18} />
                                {guideAreaServedName(listing)}
                            </p>
                            <div className="mt-6">
                                <GuideAreaMap
                                    label={areaLocation.label}
                                    latitude={areaLocation.latitude}
                                    longitude={areaLocation.longitude}
                                    radiusMeters={areaLocation.radiusMeters}
                                />
                            </div>
                        </div>
                    ) : null}
                    <aside className="border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-white/70">
                        <h2 className="font-display text-xl text-white">Wildlife-first rules</h2>
                        <p className="mt-3"><strong className="text-white">Wildlife stays wild.</strong> Sightings are never guaranteed. The public area is approximate. Exact meeting details stay private until a request is accepted in AnimalDex. Wildlife should not be baited, lured, handled, or disturbed for a photo.</p>
                    </aside>
                </article>
                <aside className="h-fit border border-white/10 bg-white/[0.04] p-7">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">Meet your Guide</p>
                    <div className="mt-5 flex items-center gap-4">
                        <GuideAvatar url={listing.seller_avatar_url} name={listing.seller_display_name || username || host} />
                        <div className="min-w-0">
                            <h2 className="truncate font-display text-2xl leading-tight">{listing.seller_display_name || host}</h2>
                            {username ? (
                                <Link
                                    href={`/u/${encodeURIComponent(username)}`}
                                    className="mt-0.5 inline-block max-w-full truncate text-sm font-semibold text-primary-300 underline-offset-4 hover:text-white hover:underline"
                                >
                                    @{username}
                                </Link>
                            ) : null}
                        </div>
                    </div>
                    {/* The two counts the Guide programme actually qualifies on, read
                        as a profile stat row rather than a definition list — they belong
                        to the person in the avatar, not to the listing. */}
                    <dl className="mt-6 grid grid-cols-2 border border-white/10 bg-white/[0.03]">
                        <GuideStat
                            value={listing.qualifying_wild_capture_count.toLocaleString(params.locale)}
                            label="wild captures"
                        />
                        <GuideStat
                            value={listing.qualifying_wild_species_count.toLocaleString(params.locale)}
                            label="wild species"
                            className="border-l border-white/10"
                        />
                    </dl>
                    {username ? (
                        <Link
                            href={`/u/${encodeURIComponent(username)}`}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 transition-colors hover:text-primary-300"
                        >
                            View full collection
                            <span aria-hidden="true">&rarr;</span>
                        </Link>
                    ) : null}
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

/**
 * One headline fact about the listing.
 *
 * The icon sits on the label row rather than beside the value: the label is the
 * thing it restates, and keeping it out of the value row lets a long value (a
 * multi-word area name, a five-figure rupiah price) use the full tile width
 * instead of wrapping around a glyph.
 */
/**
 * The guide's avatar, falling back to their initial.
 *
 * A plain `<img>`: the URL is a public Supabase storage object, and the cover
 * image on this same page is loaded the same way, so neither needs the image
 * optimizer's remote-pattern allowlist.
 */
function GuideAvatar({url, name}: {url: string | null; name: string}) {
    if (url) {
        return (
            <img
                src={url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full border border-white/15 object-cover"
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] font-display text-2xl text-white/70"
        >
            {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
    );
}

function GuideStat({value, label, className = ""}: {value: string; label: string; className?: string}) {
    return (
        <div className={`p-4 ${className}`}>
            <dt className="sr-only">{label}</dt>
            <dd className="font-display text-3xl font-bold leading-none text-white">{value}</dd>
            <p aria-hidden="true" className="mt-1.5 text-xs uppercase tracking-wider text-white/45">{label}</p>
        </div>
    );
}

function Fact({icon: Icon, label, value}: {icon?: ComponentType<{className?: string; size?: number}>; label: string; value: string}) {
    return (
        <div className="border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-white/45">
                {Icon ? <Icon className="shrink-0 text-primary-300" size={14} /> : null}
                <span className="min-w-0">{label}</span>
            </div>
            <div className="mt-1.5 font-bold">{value}</div>
        </div>
    );
}

