import type {Metadata} from "next";
import ArkEndangeredList from "@/app/[locale]/(composited)/ark/endangered/ark-endangered-list";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import TextPage, {LinkRow} from "@/components/seo/text-page";
import {localeConfig} from "@/i18n";
import {arkDirection} from "@/lib/ark-languages";
import {arkCrisisFromQuery, arkEndangeredWords, ARK_ENDANGERED_PATH} from "@/lib/ark-crises";
import {ARK_PAGES_UPDATED, ARK_PATH, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {breadcrumbJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getArkWords} from "@/loaders/ark-words";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /ark/endangered (audit docs/ark/audits/ecosystem-audit-2026-11-18.md P0-8, owner decision 389): the kinds in an open
 * wild crisis, each with its icon, how many are left in the wild, how long the crisis has been open, the field guide's
 * habitat and country-level range, and "See it in the Ark". The page is text and cards only (it is the whole
 * experience in Ark Lite and with no WebGL) and its own lazily loaded route: /ark carries no weight for it.
 *
 * The list is read in the browser from `/api/ark/crises` (contract: docs/ark/audits/ecosystem/crises-api-contract.md;
 * the read is built by E4). With no read yet, a 404 or an empty list the page says, calmly, that no kind is in danger.
 * `?crisis=<id>` highlights that crisis (and shows it even when it has ended). `?lang=<app language>` reads the words in
 * that language (any of the Ark's 45), as /ark does. `?fixture=crises` (development only) shows three made-up crises;
 * `crises-ended` adds a saved one and one lost from the wild.
 *
 * Not indexed until the read is live: the page is mostly an empty state before then.
 */

type Props = {params: {locale: string}; searchParams: {crisis?: string; lang?: string; fixture?: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

function langOf(searchParams: Props["searchParams"]): string | null {
    return typeof searchParams.lang === "string" ? searchParams.lang.slice(0, 35) : null;
}

export async function generateMetadata({params, searchParams}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [{words}, seo] = await Promise.all([getArkWords(locale, langOf(searchParams)), getPageWords(locale, "seo")]);
    const endangered = arkEndangeredWords(words.endangered);
    return buildPageMetadata({
        locale,
        path: ARK_ENDANGERED_PATH,
        title: endangered.title,
        description: endangered.intro,
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt"),
        noindex: true
    });
}

export default async function ArkEndangeredPage({params, searchParams}: Props) {
    const locale = pageLocale(params.locale);
    const lang = langOf(searchParams);
    const [{words, language}, seo] = await Promise.all([getArkWords(locale, lang), getPageWords(locale, "seo")]);
    const endangered = arkEndangeredWords(words.endangered);
    // Development only: production never shows the fixture.
    const fixture = process.env.NODE_ENV === "development" && (searchParams.fixture === "crises" || searchParams.fixture === "crises-ended") ? searchParams.fixture : null;
    const crumbs = [
        {name: word(seo, "breadcrumbHome"), href: "/"},
        {name: word(seo, "breadcrumbArk"), href: ARK_PATH},
        {name: endangered.title, href: ARK_ENDANGERED_PATH}
    ];
    const jsonLd: JsonLd[] = [
        webPageJsonLd({locale, path: ARK_ENDANGERED_PATH, name: endangered.title, description: endangered.intro, image: arkPageImage(), dateModified: ARK_PAGES_UPDATED}),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href})))
    ];
    const readerLocale = lang ? language : locale;
    return (
        <div dir={arkDirection(language)}>
            <TextPage crumbs={crumbs} crumbsLabel={word(seo, "breadcrumbLabel")} eyebrow={words.eyebrow} title={endangered.title} intro={<p>{endangered.intro}</p>} jsonLd={jsonLd}>
                <ArkEndangeredList words={endangered} locale={readerLocale} lang={lang} highlight={arkCrisisFromQuery(searchParams.crisis)} fixture={fixture} />
                <LinkRow links={[{href: ARK_PATH, label: words.eyebrow, primary: true}]} />
                <StoreLinks className="!mt-2" />
            </TextPage>
        </div>
    );
}
