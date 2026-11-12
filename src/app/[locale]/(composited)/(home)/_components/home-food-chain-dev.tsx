import Link from "@/app/[locale]/_components/link";
import ArkFoodChainExplorer from "@/components/ark/ark-food-chain-explorer";
import foodTable from "@/ark-scene/food-links.json";
import {readArkLandingSnapshot} from "@/data/ark-landing";
import {arkFoodChainPage} from "@/data/ark-food-chain";
import {arkFoodChainAboard, arkFoodChainCandidates, arkFoodChainEntry, arkFoodChainLinkCount, type ArkFoodChainEntry, type ArkFoodChainRow} from "@/lib/ark-food-chain";
import {getLocalePath} from "@/lib/site";
import {getFoodChainWords, word} from "@/loaders/page-words";

/**
 * DEVELOPMENT ONLY: the home page's food chain when SEO lane S3's section has nothing to show because this machine has
 * no Supabase keys (`voyage_food_links` is read with the service key). The same pieces S3's section uses (its pure
 * `arkFoodChainEntry` and its explorer) over real rows: the 2026-11-10 extraction of the stored food links, saved
 * git-excluded at `public/ark-local/food-rows.json`, and the live Ark. Returns null in production, or without the file.
 */

const sceneTable = foodTable as {slugs: string[]; links: Record<string, string>};

function scenePreyOf(slug: string): string[] {
    const row = sceneTable.links[slug];
    return row ? row.split(",").map((index) => sceneTable.slugs[Number.parseInt(index, 36)]).filter(Boolean) : [];
}

let rowsMemo: Promise<ArkFoodChainRow[] | null> | null = null;

async function localRows(): Promise<ArkFoodChainRow[] | null> {
    rowsMemo ??= (async () => {
        try {
            const [{readFile}, path] = await Promise.all([import("fs/promises"), import("path")]);
            const raw = JSON.parse(await readFile(path.join(process.cwd(), "public/ark-local/food-rows.json"), "utf8")) as {rows?: ArkFoodChainRow[]};
            return Array.isArray(raw.rows) ? raw.rows : null;
        } catch {
            return null;
        }
    })();
    return rowsMemo;
}

export default async function HomeFoodChainDev({locale, limit, className}: {locale: string; limit: number; className?: string}) {
    if (process.env.NODE_ENV !== "development") return null;
    const [snapshot, rows] = await Promise.all([readArkLandingSnapshot(), localRows()]);
    if (!snapshot || !rows) return null;
    const aboard = arkFoodChainAboard(snapshot);
    const candidates = arkFoodChainCandidates(aboard, scenePreyOf, limit * 2);
    const entries = candidates
        .map((kind) => arkFoodChainEntry(rows, aboard, kind, arkFoodChainPage))
        .filter((entry): entry is ArkFoodChainEntry => entry !== null && entry.eats.length > 0);
    const qualifying = entries.filter((entry) => arkFoodChainLinkCount(entry) > 1);
    const shown = (qualifying.length >= limit ? qualifying : entries).slice(0, limit);
    if (!shown.length) return null;
    const {words, page} = await getFoodChainWords(locale);
    return (
        <section aria-labelledby="ark-food-chain-title" className={className}>
            <div className="flex max-w-3xl flex-col gap-2">
                <h2 id="ark-food-chain-title" className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">{word(page, "compactTitle")}</h2>
                <p className="text-base leading-relaxed text-ink-200">{word(page, "compactIntro")}</p>
            </div>
            <div className="mt-6">
                <ArkFoodChainExplorer variant="compact" entries={shown} initial={shown[0].species.id} words={words} locale={locale} arkHref={getLocalePath(locale, "/ark")} panelHeadingLevel={3} />
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <Link href="/ark/food-chain" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-200/60 px-5 font-bold text-white">{word(page, "compactMore")}</Link>
                <span className="text-[13px] text-ink-400">{word(page, "note")} (development: the 2026-11-10 extraction)</span>
            </p>
        </section>
    );
}
