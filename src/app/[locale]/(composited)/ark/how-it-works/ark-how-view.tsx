import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {Breadcrumbs, Paragraphs, TextSection} from "@/components/seo/text-page";
import {ArkHowStyle, arkHowSteps, arkHowWords} from "@/app/[locale]/(composited)/ark/how-it-works/ark-how-visual";
import {arkHumanYear} from "@/lib/ark-human-time";
import {arkDirection} from "@/lib/ark-languages";
import {readPublicArk} from "@/data/ark-public";
import {readArkSeeds} from "@/data/ark-seeds";
import {readArkHeartsRules} from "@/data/ark-hearts-rules";
import {arkHeartsEscape, arkHeartsVariant} from "@/lib/ark-hearts-rules";
import ArkFairSeeds from "@/app/[locale]/(composited)/ark/how-it-works/ark-fair-seeds";
import {ARK_HOW_IT_WORKS_PATH, ARK_PAGES_UPDATED, ARK_RENDER_IMAGE, arkCountsLine, arkPageImage} from "@/lib/seo/ark-pages";
import {getArkWords} from "@/loaders/ark-words";
import {breadcrumbJsonLd, jsonLdHtml, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getPageWords, word} from "@/loaders/page-words";


const revalidate = 3600;

const SECTIONS = ["captures", "islands", "condition", "food", "breeding", "seasons", "honesty"] as const;

/**
 * The page's sections: the fairness one goes before "what the Ark isn't" while the year seeds are published, and "hearts"
 * (what a heart does) after the lifespans while the server's `hearts_escape` is on: the page says nothing of hearts until a heart
 * is a survived attack, so with the switch off it is exactly what it was.
 */
function sectionsFor(fair: boolean, hearts: boolean): readonly string[] {
    const after = SECTIONS.indexOf("seasons") + 1;
    const base: readonly string[] = hearts ? [...SECTIONS.slice(0, after), "hearts", ...SECTIONS.slice(after)] : SECTIONS;
    return fair ? [...base.slice(0, -1), "fair", base[base.length - 1]] : base;
}

/** The page, its pictures' captions in `lang` (one of the Ark's 45 languages: `lang/[lang]/page.tsx`) or the site's. */
export default async function ArkHowItWorksView({locale, lang}: {locale: string; lang: string | null}) {
    const [page, seo, snapshot, {words: ark, language}, seeds, heartsRules] = await Promise.all([getPageWords(locale, "pages.howItWorks"), getPageWords(locale, "seo"), readPublicArk(revalidate), getArkWords(locale, lang), readArkSeeds(revalidate), readArkHeartsRules(revalidate)]);
    const wordsLocale = lang && language !== locale ? language : locale;
    const fair = seeds?.available === true;
    // A heart a survived attack (the server's `hearts_escape`), and whether old age is final or still returns: said as the server runs it.
    const hearts = arkHeartsEscape(heartsRules) && Boolean(word(page, "hearts.title"));
    const sections = sectionsFor(fair, hearts);
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
            about: sections.map((id) => ({"@type": "Thing", name: word(page, `${id}.title`)}))
        }),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href})))
    ];
    const paragraphs = (id: string) => ["p1", "p2", "p3", "p4"].map((key) => word(page, `${id}.${key === "p2" && id === "hearts" ? arkHeartsVariant(heartsRules, "p2", "p2", "p2Old") : key}`));
    const how = arkHowWords(ark.how);
    const steps = arkHowSteps(how, arkHumanYear(wordsLocale));
    const counts = snapshot?.counts ?? null;
    const number = (value: number) => value.toLocaleString(wordsLocale);

    return (
        <div className="relative w-full overflow-hidden bg-canvas-950" lang={wordsLocale !== locale ? wordsLocale : undefined} dir={wordsLocale !== locale ? arkDirection(wordsLocale) : undefined}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdHtml(jsonLd)}} />
            <ArkHowStyle />
            {/* The hero: the Ark itself (a still of the 3D world), its name and one line over it. */}
            <header className="relative isolate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ARK_RENDER_IMAGE} alt={word(seo, "arkImageAlt")} width={1600} height={840} className="absolute inset-0 -z-10 h-full w-full object-cover" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,10,0.25)_0%,rgba(9,12,10,0.55)_45%,#0b0f0c_100%)]" />
                <div className="mx-auto flex min-h-[23rem] w-full max-w-6xl flex-col justify-end gap-4 px-4 pb-10 pt-8 md:min-h-[30rem] md:px-8 md:pb-14">
                    <Breadcrumbs items={crumbs} label={word(seo, "breadcrumbLabel")} />
                    <h1 className="max-w-3xl font-display text-[2.6rem] font-black leading-[1.02] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] md:text-7xl">{ark.intro?.how ?? word(page, "title")}</h1>
                    <p className="max-w-xl text-lg font-medium leading-snug text-white/85 md:text-xl">{how.lead}</p>
                    {counts && counts.animals ? (
                        <dl className="mt-1 flex flex-wrap gap-2">
                            {[[counts.animals, ark.intro?.animals ?? "animals"], [counts.species, ark.intro?.species ?? "species"], [counts.founders, ark.intro?.people ?? "people"]].map(([value, label]) => (
                                <div key={String(label)} className="ark-glass flex items-baseline gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5">
                                    <dd className="font-display text-[17px] font-extrabold tabular-nums text-white">{number(Number(value))}</dd>
                                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/65">{String(label)}</dt>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </div>
            </header>

            <main className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-8">
                {/* The rules as pictures: a numbered card each, a drawn scene and one short caption. */}
                <ol className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                    {steps.map((step, index) => (
                        <li key={step.id} id={step.id} className={`group scroll-mt-28 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-3 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] ${index === 0 || index === steps.length - 1 ? "lg:col-span-2" : ""}`}>
                            {step.picture}
                            <div className="flex items-start gap-3 px-2 pb-2 pt-4">
                                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-400 font-display text-[15px] font-black text-canvas-950">{index + 1}</span>
                                <div className="min-w-0">
                                    <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-white">{step.title}</h2>
                                    <p className="mt-1 text-[15.5px] leading-snug text-ink-200">{step.caption}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="mt-10 flex flex-wrap items-center gap-3">
                    <Link href="/ark" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-400 px-6 text-[16px] font-extrabold text-canvas-950 shadow-[0_12px_32px_-10px_rgba(167,244,50,0.55)] transition-colors hover:bg-primary-200">
                        {how.cta} <span aria-hidden="true" className="rtl:rotate-180">→</span>
                    </Link>
                    <Link href="/ark/food-chain" className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-5 text-[15px] font-bold text-white transition-colors hover:border-primary-300">{word(page, "ctaFoodChain")}</Link>
                    <StoreLinks variant="text" className="!mt-0 !justify-start ms-2 !gap-x-5" />
                </div>

                {/* Every rule in full (the page's own words): folded away, the same facts as the pictures. */}
                <details className="group mt-12 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.02] open:bg-white/[0.03]">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[16px] font-bold text-white [&::-webkit-details-marker]:hidden">
                        {how.more}
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-300 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7.5l5 5 5-5" /></svg>
                    </summary>
                    <div className="flex flex-col gap-8 px-5 pb-8 pt-2">
                        {live ? <p className="text-base font-semibold text-white">{live}</p> : null}
                        <p className="max-w-3xl text-base leading-7 text-ink-200">{word(page, "intro")}</p>
                        {sections.map((id) => (
                            <TextSection key={id} id={`${id}-rules`} title={word(page, `${id}.title`)}>
                                <Paragraphs items={paragraphs(id)} />
                                {id === "food" ? (
                                    <p>
                                        <Link href="/ark/food-chain" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary-200 underline-offset-4 hover:underline">
                                            {word(page, "food.link")} <span aria-hidden="true">→</span>
                                        </Link>
                                    </p>
                                ) : null}
                                {id === "fair" && seeds ? <ArkFairSeeds seeds={seeds} page={page} locale={locale} /> : null}
                            </TextSection>
                        ))}
                    </div>
                </details>
            </main>
        </div>
    );
}
