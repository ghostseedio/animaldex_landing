import type {Metadata} from "next";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import Link from "@/app/[locale]/_components/link";
import {EarnTrackLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import GuideCard from "@/components/guides/guide-card";
import {GuidePageView} from "@/components/guides/guide-analytics";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {categoryLabel, guideAreaServedName, guideLocationSlug, isLocationPageIndexable, type GuideCategory} from "@/lib/guide-marketplace-core";

export const revalidate = 86400;

type WildlifeGuidesPageProps = {
    params: {locale: string};
};

export async function generateMetadata({params}: WildlifeGuidesPageProps): Promise<Metadata> {
    const title = "Wildlife Guides";
    const description = "Find published wildlife experiences hosted by approved AnimalDex Guide sellers, with public areas, group sizes, prices and verified aggregate wildlife credentials.";
    const canonical = getLocalePath(params.locale, "/wildlife-guides");

    return {
        title,
        description,
        alternates: {
            canonical,
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/wildlife-guides");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/wildlife-guides")} as Record<string, string>)
        },
        openGraph: {
            title: "AnimalDex Wildlife Guides",
            description: "Explore real wildlife experiences hosted by approved AnimalDex Guide sellers.",
            url: canonical,
            locale: getMetadataLocale(params.locale),
            images: ["/images/og.png"]
        }
    };
}

export default async function WildlifeGuidesPage({params}: WildlifeGuidesPageProps) {
    const listings = await getPublicGuideListings();
    const categories = Array.from(new Set(listings.map((item) => item.service_category)));
    const locations = Array.from(new Map(listings.map((item) => [guideLocationSlug(item), guideAreaServedName(item)])).entries())
        .filter(([slug]) => isLocationPageIndexable(listings.filter((item) => guideLocationSlug(item) === slug)));
    return <>
        <GuidePageView event="guide_web_location_page_view" dimensions={{page_type: "guide_discovery", location: "all"}} />
        <section className="bg-canvas-950 px-5 pb-16 pt-32 text-white sm:px-8"><div className="mx-auto max-w-6xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary-300">Marketplace directory</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl sm:text-7xl">Browse all Wildlife Guides</h1>
            <p className="mt-6 max-w-3xl text-xl leading-8 text-white/65">Every published listing, grouped by category. Compare public area, duration, group size, price, and each host’s aggregate wild-species record, then open a listing to request a date in AnimalDex.</p>
            <p className="mt-4 max-w-3xl text-base text-white/50">New here? Start on <Link href="/wildlife-experiences" className="text-primary-300 hover:text-white">Wildlife Experiences</Link> for how requests work, categories, and FAQs. This page is the marketplace index — not a second booking product.</p>
            <p className="mt-4 max-w-3xl text-base text-white/50">Want to lead outings yourself? <EarnTrackLink href="/become-a-wildlife-guide" event="guide_cta_clicked" label="marketplace_become_guide" className="text-primary-300 hover:text-white">Become an AnimalDex Wildlife Guide</EarnTrackLink>.</p>
            {categories.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{categories.map((category) => <a key={category} href={`#${category}`} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-primary-300">{categoryLabel(category as GuideCategory)}</a>)}</div>}
        </div></section>
        <section className="min-h-[36rem] bg-canvas-900 px-5 py-16 text-white sm:px-8"><div className="mx-auto max-w-6xl">
            {locations.length > 0 && <nav aria-label="Guide locations" className="mb-12"><h2 className="font-display text-2xl">Browse established locations</h2><div className="mt-4 flex flex-wrap gap-3">{locations.map(([slug, label]) => <Link key={slug} href={`/wildlife-guides/${slug}`} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm hover:bg-white/10">Wildlife Guides in {label}</Link>)}</div></nav>}
            {listings.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10"><h2 className="font-display text-3xl">New experiences are being reviewed</h2><p className="mt-4 max-w-2xl text-white/60">There are no publicly available Guide listings right now. Published experiences will appear here after seller and listing approval.</p></div>
                : <div className="space-y-16">{categories.map((category) => { const rows = listings.filter((item) => item.service_category === category); return <section key={category} id={category}><h2 className="font-display text-3xl">{categoryLabel(category as GuideCategory)} Guides</h2><div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{rows.map((listing) => <GuideCard key={listing.id} listing={listing} locale={params.locale}/>)}</div></section>; })}</div>}
        </div></section>
    </>;
}
