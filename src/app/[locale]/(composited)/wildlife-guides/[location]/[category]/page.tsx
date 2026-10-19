import type {Metadata} from "next";
import {notFound, permanentRedirect} from "next/navigation";
import {GuideListPage} from "@/components/wildlife-guides/guide-list-page";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getPublicWildlifeGuidesForLocation as guidesForQuery} from "@/data/virtual-wildlife-guides";
import {getGuideLocation} from "@/data/wildlife-guide-locations";
import {getAbsoluteUrl} from "@/lib/site";
import {MIN_INDEXABLE_GUIDE_LIST, guideCategoryLabel, isGuideCategory} from "@/lib/virtual-wildlife-guides";

export const revalidate = 86400;

type Props = {params: {locale: string; location: string; category: string}};

/** A place's guides of one kind, by the category the server gives each guide from its animals. */
async function resolve(params: Props["params"]) {
    const location = getGuideLocation(params.location);
    if (!location) return null;
    if (!isGuideCategory(params.category)) return {kind: "redirect", to: `/wildlife-guides/${location.page.slug}`} as const;
    const guides = (await guidesForQuery(location.query)).filter((guide) => guide.serviceCategory === params.category);
    return {kind: "list", ...location, guides, category: params.category} as const;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const resolved = await resolve(params);
    if (!resolved || resolved.kind === "redirect") return {robots: {index: false, follow: false}};
    const {page, guides, category} = resolved;
    const label = guideCategoryLabel(category);
    return {
        title: `${label} Wildlife Guides in ${page.name}`,
        description: `Virtual ${label.toLowerCase()} guides to ${page.name}, written from explorers' own wild sightings.`,
        robots: guides.length >= MIN_INDEXABLE_GUIDE_LIST ? {index: true, follow: true} : {index: false, follow: true},
        alternates: {canonical: `/wildlife-guides/${page.slug}/${category}`}
    };
}

export default async function GuideLocationCategoryPage({params}: Props) {
    const resolved = await resolve(params);
    if (!resolved) notFound();
    if (resolved.kind === "redirect") permanentRedirect(resolved.to);
    const {page, guides, category} = resolved;
    const label = guideCategoryLabel(category);
    const pageUrl = getAbsoluteUrl(params.locale, `/wildlife-guides/${page.slug}/${category}`);
    const jsonLd = [
        {"@context": "https://schema.org", "@type": "CollectionPage", name: `${label} Wildlife Guides in ${page.name}`, url: pageUrl, inLanguage: params.locale},
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "Home", item: getAbsoluteUrl(params.locale, "/")},
                {"@type": "ListItem", position: 2, name: "Wildlife Guides", item: getAbsoluteUrl(params.locale, "/wildlife-guides")},
                {"@type": "ListItem", position: 3, name: page.name, item: getAbsoluteUrl(params.locale, `/wildlife-guides/${page.slug}`)},
                {"@type": "ListItem", position: 4, name: label, item: pageUrl}
            ]
        }
    ];
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")}} />
            <GuidePageView event="wildlife_guide_web_list_view" dimensions={{page_type: "location_category", location: page.slug, service_category: category}} />
            <GuideListPage
                locale={params.locale}
                eyebrow={`${label} · virtual guides`}
                title={`${label} guides in ${page.name}`}
                intro={`Virtual guides to ${page.name} whose animals are mostly ${label.toLowerCase()}, each written from an explorer's own wild sightings there.`}
                back={{href: `/wildlife-guides/${page.slug}`, label: `Wildlife Guides in ${page.name}`}}
                guides={guides}
                listTitle="Guides"
                emptyTitle={`No ${label.toLowerCase()} guides to ${page.name} yet`}
                emptyDetail={`See every guide to ${page.name} instead.`}
            />
        </>
    );
}
