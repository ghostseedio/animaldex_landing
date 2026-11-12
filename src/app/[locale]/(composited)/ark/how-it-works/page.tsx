import type {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import TextPage, {LinkRow, Paragraphs, TextSection} from "@/components/seo/text-page";
import {readPublicArk} from "@/data/ark-public";
import {localeConfig} from "@/i18n";
import {ARK_HOW_IT_WORKS_PATH, ARK_PAGES_UPDATED, arkCountsLine, arkPageImage} from "@/lib/seo/ark-pages";
import {getArkWords} from "@/loaders/ark-words";
import {buildPageMetadata} from "@/lib/seo/page-metadata";
import {breadcrumbJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /ark/how-it-works (SEO lane S3): how the Ark really works, in plain words,
 * from the server ecology (`supabase/functions/_shared/ark-ecology/`, the
 * captures + thrive design and the islands rules in the AnimalDex repo):
 * captures, the two islands, condition from steps, food chains, breeding,
 * seasons and lifespans, and what the Ark is not. English and Indonesian.
 */

export const revalidate = 3600;

export function generateStaticParams() {
    return localeConfig.locales.map((locale) => ({locale}));
}

type Props = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

const SECTIONS = ["captures", "islands", "condition", "food", "breeding", "seasons", "honesty"] as const;

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [page, seo] = await Promise.all([getPageWords(locale, "pages.howItWorks"), getPageWords(locale, "seo")]);
    return buildPageMetadata({
        locale,
        path: ARK_HOW_IT_WORKS_PATH,
        title: word(page, "metaTitle"),
        description: word(page, "metaDescription"),
        image: arkPageImage(),
        imageAlt: word(seo, "arkImageAlt"),
        type: "article",
        modifiedTime: ARK_PAGES_UPDATED
    });
}

export default async function ArkHowItWorksPage({params}: Props) {
    const locale = pageLocale(params.locale);
    const [page, seo, snapshot, {words: ark}] = await Promise.all([getPageWords(locale, "pages.howItWorks"), getPageWords(locale, "seo"), readPublicArk(revalidate), getArkWords(locale)]);
    const crumbs = [
        {name: word(seo, "breadcrumbHome"), href: "/"},
        {name: word(seo, "breadcrumbArk"), href: "/ark"},
        {name: word(page, "breadcrumb"), href: ARK_HOW_IT_WORKS_PATH}
    ];
    const live = arkCountsLine(snapshot, word(page, "live"), word(page, "unavailable"), ark, locale);
    const jsonLd: JsonLd[] = [
        webPageJsonLd({
            locale,
            path: ARK_HOW_IT_WORKS_PATH,
            name: word(page, "title"),
            description: word(page, "metaDescription"),
            image: arkPageImage(),
            dateModified: ARK_PAGES_UPDATED,
            about: SECTIONS.map((id) => ({"@type": "Thing", name: word(page, `${id}.title`)}))
        }),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href})))
    ];
    const paragraphs = (id: string) => ["p1", "p2", "p3", "p4"].map((key) => word(page, `${id}.${key}`));

    return (
        <TextPage crumbs={crumbs} crumbsLabel={word(seo, "breadcrumbLabel")} eyebrow={word(page, "eyebrow")} title={word(page, "title")} intro={<p>{word(page, "intro")}</p>} live={live} jsonLd={jsonLd}>
            <nav aria-labelledby="ark-how-contents" className="flex flex-col gap-3">
                <h2 id="ark-how-contents" className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-300">{word(page, "contents")}</h2>
                <ol className="flex flex-col gap-1.5 text-base">
                    {SECTIONS.map((id, index) => (
                        <li key={id} className="flex gap-3">
                            <span aria-hidden="true" className="w-6 font-mono text-sm tabular-nums text-primary-300">{index + 1}.</span>
                            <a href={`#${id}`} className="font-semibold text-white underline-offset-4 hover:text-primary-200 hover:underline">{word(page, `${id}.title`)}</a>
                        </li>
                    ))}
                </ol>
            </nav>

            {SECTIONS.map((id) => (
                <TextSection key={id} id={id} title={word(page, `${id}.title`)}>
                    <Paragraphs items={paragraphs(id)} />
                    {id === "food" ? (
                        <p>
                            <Link href="/ark/food-chain" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary-200 underline-offset-4 hover:underline">
                                {word(page, "food.link")} <span aria-hidden="true">→</span>
                            </Link>
                        </p>
                    ) : null}
                </TextSection>
            ))}

            <section aria-labelledby="ark-how-cta" className="flex flex-col gap-5 border-t border-line-300 pt-10">
                <h2 id="ark-how-cta" className="font-display text-3xl font-black tracking-tight text-white md:text-4xl">{word(page, "ctaTitle")}</h2>
                <p className="max-w-2xl text-lg leading-8 text-ink-200">{word(page, "ctaBody")}</p>
                <LinkRow
                    links={[
                        {href: "/ark", label: word(page, "ctaArk"), primary: true},
                        {href: "/ark/food-chain", label: word(page, "ctaFoodChain")},
                        {href: "/about", label: word(page, "ctaAbout")}
                    ]}
                />
                <StoreLinks className="!mt-2" />
            </section>
        </TextPage>
    );
}
