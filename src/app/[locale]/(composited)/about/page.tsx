import type {Metadata} from "next";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import TextPage, {LinkRow, Paragraphs, TextSection} from "@/components/seo/text-page";
import {readPublicArk} from "@/data/ark-public";
import {localeConfig} from "@/i18n";
import {formatAnimalCount} from "@/lib/animal-count";
import {ABOUT_PATH, ARK_PAGES_UPDATED, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {animalDexAppJsonLd, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getArkWords} from "@/loaders/ark-words";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /about (SEO lane S3): what AnimalDex is in the owner's positioning: catch
 * animals in real life and turn them into AI companions in a 3D world, a living
 * research world rather than a game, built from each animal's field guide and
 * said honestly. English and Indonesian.
 */

export const revalidate = 3600;

export function generateStaticParams() {
    return localeConfig.locales.map((locale) => ({locale}));
}

type Props = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

const SECTIONS = ["research", "pointOfView", "fieldGuides", "privacy", "who"] as const;

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [page, seo] = await Promise.all([getPageWords(locale, "pages.about"), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ABOUT_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt")
    });
}

function count(value: number, locale: string) {
    return value.toLocaleString(locale === "id" ? "id-ID" : "en-US");
}

export default async function AboutPage({params}: Props) {
    const locale = pageLocale(params.locale);
    const [page, seo, snapshot, {words: ark}] = await Promise.all([getPageWords(locale, "pages.about"), getPageWords(locale, "seo"), readPublicArk(revalidate), getArkWords(locale)]);
    const crumbs = [
        {name: word(seo, "breadcrumbHome"), href: "/"},
        {name: word(page, "breadcrumb"), href: ABOUT_PATH}
    ];
    const counts = snapshot?.counts;
    const live = counts && counts.animals
        ? word(page, "live", {
            animals: counts.animals === 1 ? ark.animalsOne : ark.animalsOther.replace("{count}", count(counts.animals, locale)),
            species: counts.species === 1 ? ark.speciesOne : ark.speciesOther.replace("{count}", count(counts.species, locale)),
            people: counts.founders === 1 ? word(page, "peopleOne") : word(page, "peopleOther", {count: count(counts.founders, locale)})
        })
        : null;
    const jsonLd: JsonLd[] = [
        webPageJsonLd({
            locale,
            path: ABOUT_PATH,
            name: word(page, "title"),
            description: word(page, "metaDescription"),
            image: arkPageImage(),
            dateModified: ARK_PAGES_UPDATED,
            type: "AboutPage",
            mainEntity: {"@type": "Organization", "@id": `${organizationJsonLd()["@id"]}`, name: "AnimalDex"}
        }),
        organizationJsonLd(),
        animalDexAppJsonLd({description: word(page, "tagline"), image: arkPageImage(), inLanguage: locale}),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href})))
    ];
    const paragraphs = (id: string) => ["p1", "p2"].map((key) => word(page, `${id}.${key}`, {catalog: formatAnimalCount(locale)}));

    return (
        <TextPage
            crumbs={crumbs}
            crumbsLabel={word(seo, "breadcrumbLabel")}
            eyebrow={word(page, "eyebrow")}
            title={word(page, "title")}
            intro={
                <>
                    <p className="font-semibold text-white">{word(page, "tagline")}</p>
                    <p className="mt-3">{word(page, "intro")}</p>
                </>
            }
            live={live}
            jsonLd={jsonLd}
        >
            {SECTIONS.map((id) => (
                <TextSection key={id} id={id} title={word(page, `${id}.title`)}>
                    <Paragraphs items={paragraphs(id)} />
                </TextSection>
            ))}
            <section aria-labelledby="about-links" className="flex flex-col gap-5 border-t border-line-300 pt-10">
                <h2 id="about-links" className="font-display text-3xl font-black tracking-tight text-white md:text-4xl">{word(page, "linksTitle")}</h2>
                <LinkRow
                    links={[
                        {href: "/ark", label: word(page, "linkArk"), primary: true},
                        {href: "/ark/how-it-works", label: word(page, "linkHow")},
                        {href: "/ark/food-chain", label: word(page, "linkFood")},
                        {href: "/talk", label: word(page, "linkTalk")}
                    ]}
                />
                <StoreLinks className="!mt-2" />
            </section>
        </TextPage>
    );
}
