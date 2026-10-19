import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {GuideListPage} from "@/components/wildlife-guides/guide-list-page";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getPublicWildlifeGuidesForLocation as guidesForQuery} from "@/data/virtual-wildlife-guides";
import {getGuideLocation} from "@/data/wildlife-guide-locations";
import {getAbsoluteUrl} from "@/lib/site";
import {GUIDE_CATEGORIES, MIN_INDEXABLE_GUIDE_LIST, guideCategoryLabel, guidePath} from "@/lib/virtual-wildlife-guides";

export const revalidate = 86400;

type Props = {params: {locale: string; location: string}};

async function resolve(slug: string) {
    const location = getGuideLocation(slug);
    if (!location) return null;
    return {...location, guides: await guidesForQuery(location.query)};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const resolved = await resolve(params.location);
    if (!resolved) return {title: "Wildlife Guides unavailable", robots: {index: false, follow: false}};
    const {page, guides} = resolved;
    const indexable = guides.length >= MIN_INDEXABLE_GUIDE_LIST;
    return {
        title: `Wildlife Guides in ${page.name}`,
        description: guides.length > 0
            ? `${guides.length} virtual wildlife guide${guides.length === 1 ? "" : "s"} to ${page.name}, written from explorers' own wild sightings: the animals they found, how rare they are and when.`
            : `Virtual wildlife guides to ${page.name}, written from explorers' own wild sightings.`,
        robots: indexable ? {index: true, follow: true} : {index: false, follow: true},
        alternates: {canonical: `/wildlife-guides/${page.slug}`}
    };
}

export default async function GuideLocationPage({params}: Props) {
    const resolved = await resolve(params.location);
    if (!resolved) notFound();
    const {page, guides} = resolved;
    const pageUrl = getAbsoluteUrl(params.locale, `/wildlife-guides/${page.slug}`);
    const categories = Object.keys(GUIDE_CATEGORIES)
        .map((category) => ({category, count: guides.filter((guide) => guide.serviceCategory === category).length}))
        .filter((row) => row.count >= MIN_INDEXABLE_GUIDE_LIST && row.count < guides.length);
    const jsonLd = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Wildlife Guides in ${page.name}`,
            url: pageUrl,
            inLanguage: params.locale,
            ...(guides.length > 0 ? {
                mainEntity: {
                    "@type": "ItemList",
                    itemListElement: guides.map((guide, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        name: guide.title,
                        url: getAbsoluteUrl(params.locale, guidePath(guide))
                    }))
                }
            } : {})
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "Home", item: getAbsoluteUrl(params.locale, "/")},
                {"@type": "ListItem", position: 2, name: "Wildlife Guides", item: getAbsoluteUrl(params.locale, "/wildlife-guides")},
                {"@type": "ListItem", position: 3, name: page.name, item: pageUrl}
            ]
        }
    ];
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")}} />
            <GuidePageView event="wildlife_guide_web_list_view" dimensions={{page_type: "location", location: page.slug}} />
            <GuideListPage
                locale={params.locale}
                eyebrow="Virtual guides"
                title={`Wildlife Guides in ${page.name}`}
                intro={`Virtual guides to ${page.name}, each written from an explorer's own wild sightings there. Every guide lists the animals the author found, how rare they are and when they saw them.`}
                back={{href: "/wildlife-guides", label: "All Wildlife Guides"}}
                links={[
                    {href: `/locations/${page.slug}`, label: `Animals in ${page.name}`},
                    ...categories.map((row) => ({href: `/wildlife-guides/${page.slug}/${row.category}`, label: `${guideCategoryLabel(row.category)} · ${row.count}`}))
                ]}
                linksTitle="More about this place"
                guides={guides}
                listTitle="Guides"
                emptyTitle={`No guides to ${page.name} yet`}
                emptyDetail={`When an explorer logs several wild species around ${page.name}, their guide shows up here.`}
            />
        </>
    );
}
