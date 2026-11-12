import Link from "@/app/[locale]/_components/link";
import ArkFoodChainExplorer from "@/components/ark/ark-food-chain-explorer";
import {readArkFoodChainAboard, readArkFoodChainFeatured} from "@/data/ark-food-chain";
import {getLocalePath} from "@/lib/site";
import {getFoodChainWords, word} from "@/loaders/page-words";

/**
 * The compact food chain (SEO lane S3, the interface agreed with S2):
 *
 *   <ArkFoodChainSection locale={locale} variant="compact" limit={6} headingLevel={2} className="…" />
 *
 * An async server component: it reads who is aboard and the featured species'
 * stored food links itself (cached a day, memoised per process), loads its own
 * words (`pages.foodChain.*`) and renders a <section> with its heading, the
 * species chips, the first species' panel and a link to /ark/food-chain. It is
 * server-rendered (crawlable); a tap only swaps the panel. It renders nothing
 * when the Ark or its food links cannot be read.
 */

type Props = {
    locale: string;
    variant?: "compact";
    /** How many species to feature (1–12). */
    limit?: number;
    /** The section's heading level (the panel's is one below). */
    headingLevel?: 2 | 3;
    className?: string;
    /** The section's id (for an in-page link), default "ark-food-chain". */
    id?: string;
    /** How long who-is-aboard may be cached, in seconds (the page's ISR window follows it). Default an hour. */
    revalidate?: number;
};

export default async function ArkFoodChainSection({locale, limit = 6, headingLevel = 2, className, id = "ark-food-chain", revalidate = 3600}: Props) {
    const read = await readArkFoodChainAboard(revalidate);
    if (!read) return null;
    const [{words, page}, entries] = await Promise.all([getFoodChainWords(locale), readArkFoodChainFeatured(read, limit)]);
    if (!entries.length) return null;
    const Heading = `h${headingLevel}` as "h2" | "h3";
    const arkHref = getLocalePath(locale, "/ark");
    return (
        <section aria-labelledby={`${id}-title`} className={className}>
            <div className="flex max-w-3xl flex-col gap-2">
                <Heading id={`${id}-title`} className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">{word(page, "compactTitle")}</Heading>
                <p className="text-base leading-relaxed text-ink-200">{word(page, "compactIntro")}</p>
            </div>
            <div className="mt-6">
                <ArkFoodChainExplorer
                    variant="compact"
                    entries={entries}
                    initial={entries[0].species.id}
                    words={words}
                    locale={locale}
                    arkHref={arkHref}
                    panelHeadingLevel={(headingLevel + 1) as 3 | 4}
                />
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <Link href="/ark/food-chain" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-200/60 px-5 font-bold text-white transition-colors hover:border-primary-400 hover:bg-primary-400 hover:text-canvas-950">
                    {word(page, "compactMore")} <span aria-hidden="true">→</span>
                </Link>
                <span className="text-[13px] text-ink-400">{word(page, "note")}</span>
            </p>
        </section>
    );
}
