import {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalFuseTool from "@/app/[locale]/(composited)/animal-hybrids/animal-fuse-tool";
import AnimalHybridGrid from "@/app/[locale]/(composited)/animal-hybrids/animal-hybrid-grid";
import HubPaginationNav from "@/app/[locale]/(composited)/_components/hub-pagination-nav";
import FusionExplainer, {type FusionExplainerItem} from "@/components/explainers/fusion-explainer";
import {formatFusionStat, getFusableSpecies, publishedAnimalFusions} from "@/data/animal-fusions";
import {getAnimalHybridCards} from "@/data/animal-hybrid-cards";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH} from "@/data/animal-hybrids";
import {animalHybridsPagination as pagination, parsePageParam} from "@/data/hub-pagination";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {withOgCard} from "@/lib/og/og-image";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const title = "Animal Hybrid Lab";
const description = "Speculative animal hybrids that answer how a cross like zebra + rhino might look and behave, plus AnimalDex fusions: pick any two animals and see what one learns from the other.";

type AnimalHybridsIndexPageProps = {
    params: {
        locale: string;
        /** Set on /animal-hybrids/page/<n> only (animal-hybrids/page/[page]/page.tsx re-exports this page). */
        page?: string;
    };
};

/** Real published fusions for the explainer, in the order they play. */
const EXPLAINER_FUSION_SLUGS = [
    "burmese-python-learns-from-eurasian-tree-sparrow",
    "ostrich-learns-from-african-pygmy-hedgehog",
    "domestic-dog-learns-from-american-crow"
];

const fusionExplainerItems: FusionExplainerItem[] = EXPLAINER_FUSION_SLUGS.flatMap((slug) => {
    const fusion = publishedAnimalFusions.find((item) => item.slug === slug);
    const receiver = fusion ? getFusableSpecies(fusion.receiverSlug) : null;
    const donor = fusion ? getFusableSpecies(fusion.donorSlug) : null;
    if (!fusion || !receiver || !donor) return [];
    return [{
        slug,
        href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${slug}`,
        receiver: {slug: receiver.slug, name: receiver.name, principle: fusion.receiverPrinciple},
        donor: {slug: donor.slug, name: donor.name, principle: fusion.donorPrinciple},
        name: fusion.name,
        expression: fusion.expression,
        boosts: [
            fusion.primaryStat && fusion.boostPrimary > 0 ? `+${fusion.boostPrimary} ${formatFusionStat(fusion.primaryStat)}` : null,
            fusion.secondaryStat && fusion.boostSecondary > 0 ? `+${fusion.boostSecondary} ${formatFusionStat(fusion.secondaryStat)}` : null
        ].filter((boost): boost is string => Boolean(boost))
    }];
});

/**
 * The hub page from the route: /animal-hybrids is page 1; /animal-hybrids/page/<n>
 * must be a canonical number in range, and /page/1 goes to the hub
 * (next.config.js 308s it first; this is the fallback).
 */
function resolveHubPage(params: AnimalHybridsIndexPageProps["params"]) {
    if (params.page === undefined) return 1;
    const page = parsePageParam(params.page);
    if (!page || page > pagination.pageCount(getAnimalHybridCards().length)) notFound();
    if (page === 1) redirect(getLocalePath(params.locale, pagination.pagePath(1)));
    return page;
}

export async function generateMetadata({params}: AnimalHybridsIndexPageProps): Promise<Metadata> {
    const {locale} = params;
    const hubPage = resolveHubPage(params);
    if (hubPage > 1) {
        // Later pages: self-canonical, a plain "page n" title, never competing with the hub.
        const path = getLocalePath(locale, pagination.pagePath(hubPage));
        const pageTitle = `${title} — Page ${hubPage}`;
        const pageDescription = `Page ${hubPage} of the Animal Hybrid Lab: more imagined animal hybrids and AnimalDex fusions, where one animal learns another's power.`;
        return {
            title: pageTitle,
            description: pageDescription,
            alternates: {canonical: path},
            openGraph: {type: "website", locale: getMetadataLocale(locale), title: `${pageTitle} | AnimalDex`, description: pageDescription, url: path}
        };
    }

    return withOgCard({
        title,
        description,
        keywords: [
            "animal hybrids",
            "hypothetical animal hybrids",
            "zebra rhino hybrid",
            "animal cross ideas",
            "what would animal hybrids look like",
            "animal fusion",
            "fuse two animals"
        ],
        alternates: {
            canonical: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, ANIMAL_HYBRID_CANONICAL_BASE_PATH);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    }, "Animal hybrids on AnimalDex", "page", "animal-hybrids");
}

export default async function AnimalHybridsIndexPage({params}: AnimalHybridsIndexPageProps) {
    const {locale} = params;
    const hubPage = resolveHubPage(params);
    const allCards = getAnimalHybridCards();
    const cards = pagination.slice(allCards, hubPage);
    const totalPages = pagination.pageCount(allCards.length);
    const rangeStart = (hubPage - 1) * pagination.perPage + 1;
    const pageUrl = getAbsoluteUrl(locale, pagination.pagePath(hubPage));
    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: hubPage > 1 ? `${title} — Page ${hubPage}` : title,
        description,
        url: pageUrl,
        inLanguage: locale
    };
    // This page's cards; the other pages list their own.
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: cards.map((card, index) => ({
            "@type": "ListItem",
            position: rangeStart + index,
            name: card.title,
            url: getAbsoluteUrl(locale, card.href)
        }))
    };
    const grid = (
        <AnimalHybridGrid
            id={pagination.anchor}
            cards={cards}
            total={allCards.length}
            rangeStart={rangeStart}
            pagination={<HubPaginationNav pagination={pagination} page={hubPage} totalPages={totalPages} locale={locale} label="Hybrid pages" />}
        />
    );

    if (hubPage > 1) {
        return (
            <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col gap-10">
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />
                <header className="flex flex-col gap-4 border-b border-line-300 pb-8">
                    <Link href={ANIMAL_HYBRID_CANONICAL_BASE_PATH} className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm underline-offset-4 hover:underline">
                        {title}
                    </Link>
                    <h1 className="font-display font-bold text-4xl md:text-5xl text-white">{title} — Page {hubPage}</h1>
                    <p className="text-lg text-ink-200 max-w-3xl">
                        Hybrids imagine two animals as one creature; fusions keep both real, and one learns the other&rsquo;s power.
                        Cards {rangeStart}–{rangeStart + cards.length - 1} of {allCards.length}.
                    </p>
                </header>
                {grid}
            </article>
        );
    }

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <section className="flex flex-col gap-5 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">Explore</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl">{title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{description}</p>
            </section>

            <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Fictional crosses, biology-first answers</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Every pair of animals here is fictional. Hybrid pages separate real-world viability from the fun design question: what would the cross look like, how would it behave, and what ultimate ability would emerge? Fusions keep both animals real and ask what one would learn from the other.
                </p>
            </section>

            <FusionExplainer items={fusionExplainerItems} />

            <section className="flex flex-col gap-5" aria-labelledby="hybrids-fusions-explained">
                <h2 id="hybrids-fusions-explained" className="font-display font-bold text-3xl md:text-4xl text-white">Hybrids and fusions, explained</h2>
                <div className="grid gap-px border border-line-300 bg-line-300 md:grid-cols-2">
                    <div className="flex flex-col gap-3 bg-canvas-950 p-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-300">Hybrid · an imagined creature</p>
                        <p className="text-ink-200 leading-7">
                            Each hybrid asks a biology-first question: could these two animals ever breed, and if they did, what would the
                            cross look like, how would it behave, and what ultimate ability would it have? None of the hybrids are real.
                            The reasoning is, and it starts from how each parent actually lives.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 bg-canvas-950 p-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-300">Fusion · a lesson learned</p>
                        <p className="text-ink-200 leading-7">
                            In AnimalDex every animal has a power: the behaviour that keeps it alive, put into words you can use. Fuse two
                            animals and the first keeps its own power and learns the second&rsquo;s, with a small stat boost. In the app
                            each fused power gets its own Training and Trial, so the lesson loop starts again. Here you can fuse any two
                            species, and open every pair someone has already fused.
                        </p>
                    </div>
                </div>
            </section>

            <AnimalFuseTool />

            <section className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Hybrids and fusions</h2>
                <p className="text-ink-200 text-lg">Hybrids imagine two animals as one creature; fusions are made in the AnimalDex app, where one animal learns a power from another.</p>
            </section>
            {grid}
        </article>
    );
}
