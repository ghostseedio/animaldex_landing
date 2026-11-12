import Link from "@/app/[locale]/_components/link";
import ArkFoodChainSection from "@/components/ark/ark-food-chain-section";
import {ABOUT_PATH, ARK_FOOD_CHAIN_PATH, ARK_HOW_IT_WORKS_PATH} from "@/lib/seo/ark-pages";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * Under /ark's world and its words (SEO lane S3): the way into the pages that
 * explain it (how it works, who eats whom, the research world), and the
 * compact food chain of the animals aboard. Server-rendered, so crawlers and
 * readers without WebGL get it; below the canvas, apart from the scene's files.
 */
export default async function ArkSeoSummary({locale}: {locale: string}) {
    const [seo, foodChain] = await Promise.all([
        getPageWords(locale, "seo"),
        ArkFoodChainSection({locale, limit: 6, headingLevel: 2, revalidate: 300, className: "mx-auto w-full max-w-[86rem] px-4 pb-12 md:px-8 md:pb-16", id: "ark-food-chain"})
    ]);
    const cards = [
        {href: ARK_HOW_IT_WORKS_PATH, title: word(seo, "arkSummary.howTitle"), body: word(seo, "arkSummary.howBody")},
        {href: ARK_FOOD_CHAIN_PATH, title: word(seo, "arkSummary.foodTitle"), body: word(seo, "arkSummary.foodBody")},
        {href: ABOUT_PATH, title: word(seo, "arkSummary.aboutTitle"), body: word(seo, "arkSummary.aboutBody")}
    ];
    return (
        <div className="border-b border-line-200">
            <section aria-labelledby="ark-learn" className="mx-auto flex w-full max-w-[86rem] flex-col gap-6 px-4 py-10 md:px-8 md:py-14">
                <div className="flex max-w-2xl flex-col gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-300">{word(seo, "arkSummary.eyebrow")}</p>
                    <h2 id="ark-learn" className="font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">{word(seo, "arkSummary.title")}</h2>
                    <p className="text-base leading-relaxed text-ink-200">{word(seo, "arkSummary.intro")}</p>
                </div>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {cards.map((card) => (
                        <li key={card.href}>
                            <Link href={card.href} className="flex h-full min-h-11 flex-col gap-2 border border-line-300 bg-surface-900/60 p-5 transition-colors hover:border-primary-300">
                                <span className="font-display text-lg font-extrabold text-white">{card.title} <span aria-hidden="true">→</span></span>
                                <span className="text-[14px] leading-relaxed text-ink-300">{card.body}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
            {foodChain}
        </div>
    );
}
