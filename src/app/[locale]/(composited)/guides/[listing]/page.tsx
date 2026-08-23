import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import GuideCard from "@/components/guides/guide-card";
import {GuideAppLink, GuidePageView} from "@/components/guides/guide-analytics";
import {getPublicGuideListing, getPublicGuideListings} from "@/data/guide-marketplace";
import {appStoreUrl} from "@/lib/store-links";
import {categoryLabel, formatDuration, formatGuidePrice, guideLocationSlug, guidePath, guideSeo, guideStructuredData, isLocationPageIndexable, locationInventory, parseGuideRouteSegment} from "@/lib/guide-marketplace-core";
import {getAbsoluteUrl} from "@/lib/site";

export const revalidate = 300;

type Props = {params: {locale: string; listing: string}};

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
    return {
        title: {absolute: seo.title}, description: seo.description,
        alternates: {canonical: canonicalPath},
        openGraph: {type: "website", title: seo.title, description: seo.description, url: canonicalUrl, siteName: "AnimalDex", images: [{url: "/images/og.png", width: 1200, height: 630, alt: "AnimalDex Wildlife Guides"}]},
        twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: ["/images/og.png"]}
    };
}

export default async function GuideListingPage({params}: Props) {
    const resolved = await resolve(params);
    if (!resolved) notFound();
    const {route, listing} = resolved;
    const canonicalPath = guidePath(listing);
    if (`/${params.listing}` !== canonicalPath.replace("/guides", "")) redirect(canonicalPath);
    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const structuredData = guideStructuredData(listing, canonicalUrl, params.locale);
    const allListings = await getPublicGuideListings();
    const locationSlug = guideLocationSlug(listing);
    const related = allListings.filter((item) => item.id !== listing.id && (item.service_category === listing.service_category || guideLocationSlug(item) === locationSlug)).slice(0, 3);
    const showLocationLink = isLocationPageIndexable(locationInventory(allListings, locationSlug));
    const username = listing.seller_username?.replace(/^@/, "");

    return <>
        <GuidePageView event="guide_web_listing_view" dimensions={{listing_id: listing.id, service_category: listing.service_category, country: listing.country_code, region: listing.region_code || "", page_type: "listing"}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replace(/</g, "\\u003c")}} />
        <section className="relative overflow-hidden bg-canvas-950 px-5 pb-20 pt-32 text-white sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(27,196,81,0.18),transparent_42%)]" />
            <div className="relative mx-auto max-w-5xl">
                <nav className="mb-8 flex flex-wrap gap-2 text-sm text-white/55" aria-label="Breadcrumb">
                    <Link href="/wildlife-guides" className="hover:text-primary-300">Wildlife Guides</Link><span>/</span>
                    {showLocationLink && <><Link href={`/wildlife-guides/${locationSlug}`} className="hover:text-primary-300">{listing.public_area_label}</Link><span>/</span></>}
                    <span>{listing.title}</span>
                </nav>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-300">{categoryLabel(listing.service_category)} · {listing.public_area_label}</p>
                <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[1.05] sm:text-7xl">{listing.title}</h1>
                <p className="mt-6 max-w-3xl text-xl leading-8 text-white/70">{listing.public_summary}</p>
                <div className="mt-10 grid gap-4 sm:grid-cols-4">
                    <Fact label="Duration" value={formatDuration(listing.duration_minutes)} />
                    <Fact label="Maximum group" value={`${listing.max_guests} collectors`} />
                    <Fact label="Public area" value={listing.public_area_label} />
                    <Fact label="Price per person" value={formatGuidePrice(listing.amount_minor, listing.currency_code, params.locale)} />
                </div>
            </div>
        </section>
        <section className="bg-canvas-900 px-5 py-20 text-white sm:px-8"><div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1.5fr_1fr]">
            <article>
                <h2 className="font-display text-3xl">About this wildlife experience</h2>
                <div className="mt-6 whitespace-pre-line text-lg leading-8 text-white/70">{listing.description}</div>
                <aside className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-white/70"><strong className="text-white">Wildlife stays wild.</strong> Sightings are never guaranteed. The public area is approximate; exact meeting details should only be shared privately after a request is accepted in AnimalDex.</aside>
            </article>
            <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-300">Approved AnimalDex Guide seller</p>
                <h2 className="mt-3 font-display text-2xl">Hosted by {username ? `@${username}` : listing.seller_display_name || "an AnimalDex Guide"}</h2>
                <dl className="mt-6 space-y-4 text-white/70"><FactRow value={listing.qualifying_wild_species_count.toLocaleString(params.locale)} label="wild species"/><FactRow value={listing.qualifying_wild_capture_count.toLocaleString(params.locale)} label="qualifying wild captures"/></dl>
                <div className="mt-8"><GuideAppLink href={appStoreUrl} listingId={listing.id} category={listing.service_category}>View on AnimalDex</GuideAppLink></div>
                <p className="mt-4 text-xs leading-5 text-white/45">The full page remains available here. The AnimalDex app is used for requests and private conversation; no payment is collected on this website.</p>
            </aside>
        </div></section>
        {related.length > 0 && <section className="bg-canvas-950 px-5 py-20 text-white sm:px-8"><div className="mx-auto max-w-5xl"><h2 className="font-display text-3xl">More Wildlife Guides</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{related.map((item) => <GuideCard key={item.id} listing={item} locale={params.locale}/>)}</div></div></section>}
    </>;
}

function Fact({label, value}: {label: string; value: string}) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-wider text-white/45">{label}</div><div className="mt-1 font-bold">{value}</div></div>; }
function FactRow({value, label}: {value: string | number; label: string}) { return <div className="flex items-baseline justify-between border-b border-white/10 pb-3"><dt>{label}</dt><dd className="text-2xl font-bold text-white">{value}</dd></div>; }
