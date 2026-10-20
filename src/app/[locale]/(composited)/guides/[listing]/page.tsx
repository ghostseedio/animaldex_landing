import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import GuideDetail from "@/components/wildlife-guides/guide-detail";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getPublicWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {earnBreadcrumbList} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {
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

function visibleMedia(guide: GuideDetailData) {
    return guide.media.filter((media) => !media.hidden && media.captureId);
}

function shareImage(guide: GuideDetailData) {
    const src = guideMediaSrc(visibleMedia(guide)[0], "hero");
    return src ? new URL(src, getSiteUrl()).toString() : null;
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
        guideStructuredData(guide, canonicalUrl, shareImage(guide)),
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
