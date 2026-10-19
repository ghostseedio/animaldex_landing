import type {Metadata} from "next";
import {localeConfig} from "@/i18n";
import {GuideListPage} from "@/components/wildlife-guides/guide-list-page";
import {GuidePageView} from "@/components/wildlife-guides/guide-page-view";
import {getAllPublicWildlifeGuides} from "@/data/virtual-wildlife-guides";
import {locationsWithGuides} from "@/data/wildlife-guide-locations";
import {withOgCard} from "@/lib/og/og-image";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {MIN_INDEXABLE_GUIDE_LIST, guidePath} from "@/lib/virtual-wildlife-guides";

export const revalidate = 86400;

type Props = {params: {locale: string}};

const TITLE = "Virtual Wildlife Guides";
const DESCRIPTION = "Virtual wildlife guides to real places, built from explorers' own wild sightings: which animals they found, how rare they are and when, with notes, a chat with the author and local introductions.";

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const guides = await getAllPublicWildlifeGuides();
    const canonical = getLocalePath(params.locale, "/wildlife-guides");
    return withOgCard({
        title: TITLE,
        description: DESCRIPTION,
        // Nothing to list until guides go public: keep the page out of the index until then.
        robots: guides.length > 0 ? {index: true, follow: true} : {index: false, follow: true},
        alternates: {
            canonical,
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/wildlife-guides");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/wildlife-guides")} as Record<string, string>)
        },
        openGraph: {
            title: `AnimalDex ${TITLE}`,
            description: DESCRIPTION,
            url: canonical,
            locale: getMetadataLocale(params.locale)
        }
    }, "AnimalDex wildlife guides", "page", "wildlife-guides");
}

export default async function WildlifeGuidesPage({params}: Props) {
    const guides = await getAllPublicWildlifeGuides();
    const places = locationsWithGuides(guides, MIN_INDEXABLE_GUIDE_LIST);
    const pageUrl = getAbsoluteUrl(params.locale, "/wildlife-guides");
    const jsonLd: Record<string, unknown>[] = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: TITLE,
            description: DESCRIPTION,
            url: pageUrl,
            inLanguage: params.locale,
            isPartOf: {"@type": "WebSite", name: "AnimalDex", url: getAbsoluteUrl(params.locale, "/")}
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "Home", item: getAbsoluteUrl(params.locale, "/")},
                {"@type": "ListItem", position: 2, name: "Wildlife Guides", item: pageUrl}
            ]
        },
        ...(guides.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: guides.slice(0, 100).map((guide, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: guide.title,
                url: getAbsoluteUrl(params.locale, guidePath(guide))
            }))
        }] : [])
    ];

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c")}} />
            <GuidePageView event="wildlife_guide_web_list_view" dimensions={{page_type: "guide_index", location: "all"}} />
            <GuideListPage
                locale={params.locale}
                eyebrow="Virtual guides"
                title="Wildlife Guides"
                intro="Each guide is one place, written from an explorer's own wild sightings there: the animals they found, how rare they are and the months they saw them. Open a guide to see what it covers."
                links={places.map((place) => ({href: `/wildlife-guides/${place.slug}`, label: `${place.name} · ${place.count}`}))}
                linksTitle="Places"
                guides={guides}
                listTitle="All guides"
                emptyTitle="Guides are on their way"
                emptyDetail="Explorers' guides will appear here once guides launch. Log wild animals with location on in the AnimalDex app, and the places where you find several species become guides of your own."
            />
        </>
    );
}
