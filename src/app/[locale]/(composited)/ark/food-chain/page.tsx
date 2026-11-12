import type {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import ArkFoodChainExplorer from "@/components/ark/ark-food-chain-explorer";
import TextPage, {TextSection} from "@/components/seo/text-page";
import {arkFoodChainSpeciesList, readArkFoodChainAboard, readArkFoodChainFeatured} from "@/data/ark-food-chain";
import {readPublicArk} from "@/data/ark-public";
import {localeConfig} from "@/i18n";
import {ARK_FOOD_CHAIN_PATH, ARK_PAGES_UPDATED, arkCountsLine, arkPageImage} from "@/lib/seo/ark-pages";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {breadcrumbJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getLocalePath} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";
import {getFoodChainWords, getPageWords, word} from "@/loaders/page-words";

/**
 * /ark/food-chain (SEO lane S3, decision 244): who eats whom among the
 * animals aboard, tap by tap, from the stored food links and their phrases
 * (`src/data/ark-food-chain.ts`).
 *
 * Static and cached (an hour): the server renders the list and the first
 * species; `?species=<slug>` is read by the explorer in the browser (it keeps
 * the species in the address for sharing), so the HTML is the same for every
 * visitor and the CDN can keep it. The canonical is /ark/food-chain. The species
 * names link to their indexed /animals/ pages.
 */

export const revalidate = 3600;

export function generateStaticParams() {
    return localeConfig.locales.map((locale) => ({locale}));
}

type Props = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [{page}, seo] = await Promise.all([getFoodChainWords(locale), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ARK_FOOD_CHAIN_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt")
    });
}

export default async function ArkFoodChainPage({params}: Props) {
    const locale = pageLocale(params.locale);
    const [{words, page}, seo, read, snapshot, {words: ark}] = await Promise.all([
        getFoodChainWords(locale),
        getPageWords(locale, "seo"),
        readArkFoodChainAboard(revalidate),
        readPublicArk(revalidate),
        getArkWords(locale)
    ]);
    const crumbs = [
        {name: word(seo, "breadcrumbHome"), href: "/"},
        {name: word(seo, "breadcrumbArk"), href: "/ark"},
        {name: word(page, "breadcrumb"), href: ARK_FOOD_CHAIN_PATH}
    ];
    const featured = read ? await readArkFoodChainFeatured(read, 1) : [];
    const first = featured[0] ?? null;
    const index = read ? arkFoodChainSpeciesList(read) : [];
    const jsonLd: JsonLd[] = [
        webPageJsonLd({
            locale,
            path: ARK_FOOD_CHAIN_PATH,
            name: word(page, "title"),
            description: word(page, "metaDescription"),
            image: arkPageImage(),
            dateModified: ARK_PAGES_UPDATED,
            type: "CollectionPage",
            about: [{"@type": "Thing", name: "Food chain"}, {"@type": "Thing", name: "Predation"}, {"@type": "Thing", name: "Animal diet"}]
        }),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href})))
    ];

    return (
        <TextPage
            crumbs={crumbs}
            crumbsLabel={word(seo, "breadcrumbLabel")}
            eyebrow={word(page, "eyebrow")}
            title={word(page, "title")}
            intro={<p>{word(page, "intro")}</p>}
            live={arkCountsLine(snapshot, word(page, "live"), word(page, "unavailable"), ark, locale)}
            jsonLd={jsonLd}
            wide
        >
            {read && first ? (
                <section aria-labelledby="food-chain-explorer" className="flex flex-col gap-5">
                    <h2 id="food-chain-explorer" className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{word(page, "listTitle")}</h2>
                    <ArkFoodChainExplorer
                        variant="full"
                        entries={[first]}
                        index={index}
                        initial={first.species.id}
                        words={words}
                        locale={locale}
                        arkHref={getLocalePath(locale, "/ark")}
                        panelHeadingLevel={3}
                        readAddress
                    />
                </section>
            ) : (
                <p className="text-base text-ink-300">{word(page, "unavailable")}</p>
            )}

            <TextSection id="how-links-are-made" title={word(page, "howTitle")}>
                <p className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">{word(page, "howBody")}</p>
                <p className="text-[13px] text-ink-400">{word(page, "note")}</p>
                <p>
                    <Link href="/ark/how-it-works#food" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary-200 underline-offset-4 hover:underline">
                        {word(page, "howLink")} <span aria-hidden="true">→</span>
                    </Link>
                </p>
            </TextSection>
        </TextPage>
    );
}
