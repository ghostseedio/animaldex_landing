import type {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import GuideCard from "@/components/guides/guide-card";
import {GuidePageView} from "@/components/guides/guide-analytics";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {GUIDE_CATEGORIES, categoryLabel, isLocationPageIndexable, locationInventory, type GuideCategory} from "@/lib/guide-marketplace-core";

export const revalidate = 300;
type Props = {params: {locale: string; location: string; category: string}};
async function resolve(params: Props["params"]) {
    if (!(params.category in GUIDE_CATEGORIES)) return null;
    const listings = locationInventory(await getPublicGuideListings(), params.location, params.category as GuideCategory);
    return isLocationPageIndexable(listings) ? listings : null;
}
export async function generateMetadata({params}: Props): Promise<Metadata> {
    const listings = await resolve(params); if (!listings) return {robots: {index: false, follow: false}};
    const area = listings[0].public_area_label; const category = categoryLabel(params.category as GuideCategory);
    return {title: `${category} Guides in ${area}`, description: `Compare published ${category.toLowerCase()} experiences in ${area} hosted by approved AnimalDex Guide sellers.`, alternates: {canonical: `/wildlife-guides/${params.location}/${params.category}`}};
}
export default async function GuideLocationCategoryPage({params}: Props) {
    const listings = await resolve(params); if (!listings) notFound();
    const area = listings[0].public_area_label; const category = categoryLabel(params.category as GuideCategory);
    return <><GuidePageView event="guide_web_location_page_view" dimensions={{page_type: "location_category", location: params.location, service_category: params.category}}/><section className="bg-canvas-950 px-5 pb-16 pt-32 text-white sm:px-8"><div className="mx-auto max-w-6xl"><Link href={`/wildlife-guides/${params.location}`} className="text-sm text-primary-300">Wildlife Guides in {area}</Link><h1 className="mt-5 font-display text-5xl sm:text-7xl">{category} Guides in {area}</h1><p className="mt-6 max-w-3xl text-xl leading-8 text-white/65">Published {category.toLowerCase()} experiences with clear public areas, duration, capacity, pricing and AnimalDex wildlife credentials.</p></div></section><section className="bg-canvas-900 px-5 py-16 text-white sm:px-8"><div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">{listings.map((listing) => <GuideCard key={listing.id} listing={listing} locale={params.locale}/>)}</div></section></>;
}
