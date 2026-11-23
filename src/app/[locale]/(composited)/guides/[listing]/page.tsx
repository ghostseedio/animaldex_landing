import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import GuideDetail from "@/components/wildlife-guides/guide-detail";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getPublicWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {earnBreadcrumbList} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {ogCardImageUrl} from "@/lib/seo/structured-data";
import {
    guideHeroMedia,
    guideMediaSrc,
    guidePath,
    guideSeo,
    guideStructuredData,
    parseGuideRouteSegment,
    type GuideDetail as GuideDetailData
} from "@/lib/virtual-wildlife-guides";

export const revalidate = 86400;

type Props = {params: {locale: string; listing: string}};

async function resolve(params: Props["params"]) {
    const route = parseGuideRouteSegment(params.listing);
    if (!route) return null;
    return getPublicWildlifeGuide(route.listingId);
}

function shareImage(guide: GuideDetailData) {
    const src = guideMediaSrc(guideHeroMedia(guide), "hero");
    return src ? new URL(src, getSiteUrl()).toString() : null;
}

/**
 * Images Google can fetch for the guide's structured data (SEO pass 2,
 * 2026-11-21): the share cards of its first three species with a page. The
 * hero is a capture rendition under the robots-disallowed /api/ (og:image
 * keeps it, for link previews); the site card when no species has a page.
 */
function guideStructuredDataImages(guide: GuideDetailData): string[] {
    const cards = guide.species
        .map((item) => item.landingPageSlug?.trim())
        .filter((slug): slug is string => Boolean(slug))
        .slice(0, 3)
        .map((slug) => ogCardImageUrl("species", slug));
    return cards.length ? cards : [new URL("/images/og.png", getSiteUrl()).toString()];
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const guide = await resolve(params);
    if (!guide) return {title: "Wildlife Guide unavailable", robots: {index: false, follow: false}};
    const canonicalPath = guidePath(guide);
    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const seo = guideSeo(guide);
    const image = shareImage(guide) ?? "/images/og.png";
    return {
        title: {absolute: seo.title},
        description: seo.description,
        robots: {index: true, follow: true},
        alternates: {canonical: canonicalPath},
        openGraph: {
            type: "website",
            title: seo.title,
            description: seo.description,
            url: canonicalUrl,
            siteName: "AnimalDex",
            images: [{url: image, alt: guide.title}]
        },
        twitter: {card: "summary_large_image", title: seo.title, description: seo.description, images: [image]}
    };
}

export default async function WildlifeGuidePage({params}: Props) {
    const guide = await resolve(params);
    if (!guide) notFound();
    const canonicalPath = guidePath(guide);
    if (`/guides/${params.listing}` !== canonicalPath) redirect(canonicalPath);

    const canonicalUrl = getAbsoluteUrl(params.locale, canonicalPath);
    const structuredData = [
        guideStructuredData(guide, canonicalUrl, guideStructuredDataImages(guide)),
        earnBreadcrumbList(params.locale, [
            {name: "Home", path: "/"},
            {name: "Wildlife Guides", path: "/wildlife-guides"},
            {name: guide.title, path: canonicalPath}
        ])
    ];

    return (
        <>
            <GuidePageView
                event="wildlife_guide_web_view"
                dimensions={{guide_id: guide.id, country: guide.countryCode, service_category: guide.serviceCategory ?? "", page_type: "guide"}}
            />
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replace(/</g, "\\u003c")}} />
            <GuideDetail guide={guide} locale={params.locale} />
        </>
    );
}
