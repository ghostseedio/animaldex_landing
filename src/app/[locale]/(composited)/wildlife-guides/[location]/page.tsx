import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import GuideCard from "@/components/guides/guide-card";
import {GuidePageView} from "@/components/guides/guide-analytics";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {categoryLabel, guideAreaServedName, isLocationPageIndexable, locationInventory, type GuideCategory} from "@/lib/guide-marketplace-core";

export const revalidate = 300;
type Props = {params: {locale: string; location: string}};

async function resolve(location: string) {
    const all = await getPublicGuideListings();
    const listings = locationInventory(all, location);
    return isLocationPageIndexable(listings) ? listings : null;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const listings = await resolve(params.location);
    if (!listings) return {title: "Wildlife Guides unavailable", robots: {index: false, follow: false}};
    const area = guideAreaServedName(listings[0]);
    return {title: `Wildlife Guides in ${area}`, description: `Explore ${listings.length} published AnimalDex wildlife experiences around ${area}, with public prices, group sizes and Guide wildlife credentials.`, alternates: {canonical: `/wildlife-guides/${params.location}`}};
}

export default async function GuideLocationPage({params}: Props) {
    const listings = await resolve(params.location);
    if (!listings) notFound();
    const area = guideAreaServedName(listings[0]);
    const categories = Array.from(new Set(listings.map((item) => item.service_category)));
    return <>
        <GuidePageView event="guide_web_location_page_view" dimensions={{page_type: "location", location: params.location}} />
        <section className="bg-canvas-950 px-5 pb-16 pt-32 text-white sm:px-8"><div className="mx-auto max-w-6xl"><Link href="/wildlife-guides" className="text-sm text-primary-300">All Wildlife Guides</Link><h1 className="mt-5 font-display text-5xl sm:text-7xl">Wildlife Guides in {area}</h1><p className="mt-6 max-w-3xl text-xl leading-8 text-white/65">Compare currently published AnimalDex Guide experiences in {area}. Each listing shows a public approximate area, real-money price, group size and aggregate wild-observation credentials.</p></div></section>
        <section className="bg-canvas-900 px-5 py-16 text-white sm:px-8"><div className="mx-auto max-w-6xl"><div className="mb-10 flex flex-wrap gap-3">{categories.map((category) => { const categoryRows = listings.filter((item) => item.service_category === category); return isLocationPageIndexable(categoryRows) ? <Link key={category} href={`/wildlife-guides/${params.location}/${category}`} className="rounded-full border border-white/15 px-4 py-2 text-sm">{categoryLabel(category)} in {area}</Link> : null; })}</div><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{listings.map((listing) => <GuideCard key={listing.id} listing={listing} locale={params.locale}/>)}</div></div></section>
    </>;
}
