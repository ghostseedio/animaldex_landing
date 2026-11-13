import Link from "@/app/[locale]/_components/link";
import SpeciesArkCount from "@/app/[locale]/(composited)/animals/[slug]/species-ark-count";
import {readArkFoodChainAboard, readArkFoodChainEntry} from "@/data/ark-food-chain";
import {readArkCanBoard, readArkFoodLinks, readPublicArk, type ArkFoodLink} from "@/data/ark-public";
import {readArkSpeciesTrends} from "@/data/ark-species-trends";
import {arkFoodChainKind, arkFoodChainLooks, type ArkFoodChainEntry, type ArkFoodChainSpecies} from "@/lib/ark-food-chain";
import {arkSpeciesAboard} from "@/lib/ark-population";
import {arkSpeciesTrendLine, arkSpeciesTrendOf} from "@/lib/ark-species-trend";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {getArkWords} from "@/loaders/ark-words";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * "In the Ark" on a species page (AnimalDex docs/ark-next.md, Part 4d): how
 * many of it are aboard the shared Ark, what its stored diet links say it
 * eats and is eaten by, and the way to see it there.
 *
 * - The count comes from the page's daily snapshot and is brought up to date
 *   in the browser (`species-ark-count`).
 * - The diet line comes only from `voyage_food_links` (each link taken from
 *   the species' field guide). While that table is not live, or holds nothing
 *   for this species, the line is not shown: never an invented diet.
 * - "One comes aboard when someone captures it" only for a species that can board
 *   (it has an Ark model).
 * - SEO lane S3: how its numbers changed over the last week (the event log,
 *   `readArkSpeciesTrends`), what it can eat and be eaten by among the animals
 *   aboard (the food chain's own rules, `src/lib/ark-food-chain.ts`), and a
 *   link to it in /ark/food-chain. All from reads shared by every species page.
 * - Counts and species only: never who brought one.
 */

/** The page's own window (its daily ISR): these reads add no extra rebuilds. */
const REVALIDATE_SECONDS = 86400;

/** What the section shows, read on the server with the page (null: say nothing about the Ark). */
/** The section's own words beyond the Ark's (`species.inTheArk.*`: species pages are English only). */
export type SpeciesArkExtraWords = {arkEats: string; arkEatenBy: string; foodChain: string};

export type SpeciesArk = {
    words: ArkWords;
    extra?: SpeciesArkExtraWords;
    count: number;
    focusSlug: string;
    canBoard: boolean | null;
    links: ArkFoodLink[];
    /** Its place in the Ark's food chain, while some of it is aboard and the links can be read. */
    foodChain?: ArkFoodChainEntry | null;
    /** "Since November 5: 2 came aboard." Null when the log could not be read to the end of the window. */
    trend?: string | null;
};

const TREND_DAYS = 7;

function trendDate(since: string): string {
    return new Intl.DateTimeFormat("en-US", {month: "long", day: "numeric", timeZone: "UTC"}).format(new Date(since));
}

export async function loadSpeciesArk({slug, speciesProfileId}: {slug: string; speciesProfileId: string | null}): Promise<SpeciesArk | null> {
    const [{words}, snapshot, links, canBoard, read, inTheArk] = await Promise.all([
        getArkWords("en"),
        readPublicArk(REVALIDATE_SECONDS),
        speciesProfileId ? readArkFoodLinks(speciesProfileId, REVALIDATE_SECONDS) : Promise.resolve(null),
        readArkCanBoard({speciesProfileId, slug}, REVALIDATE_SECONDS),
        readArkFoodChainAboard(REVALIDATE_SECONDS),
        getPageWords("en", "species.inTheArk")
    ]);
    // Before the Ark is open (or when it cannot be read) the page says nothing about it.
    if (!snapshot) return null;
    const aboard = arkSpeciesAboard(snapshot, {speciesProfileId, slug});
    // A species that cannot come aboard and is not aboard: nothing to show.
    if (!aboard.count && canBoard === false) return null;
    const kind = read ? arkFoodChainKind(read.aboard, speciesProfileId) ?? arkFoodChainKind(read.aboard, slug) : null;
    const [foodChain, trends] = await Promise.all([
        read && kind ? readArkFoodChainEntry(read, kind, REVALIDATE_SECONDS).catch(() => null) : Promise.resolve(null),
        read ? readArkSpeciesTrends(read.aboard, TREND_DAYS, REVALIDATE_SECONDS).catch(() => null) : Promise.resolve(null)
    ]);
    const keys = [speciesProfileId, ...(read && kind ? arkFoodChainLooks(read.aboard, kind) : [])].filter((value): value is string => Boolean(value));
    const trend = trends && keys.length && word(inTheArk, "trendLine")
        ? arkSpeciesTrendLine(arkSpeciesTrendOf(trends.trends, keys), {
            line: word(inTheArk, "trendLine"),
            none: word(inTheArk, "trendNone"),
            arrived: word(inTheArk, "trendArrived"),
            born: word(inTheArk, "trendBorn"),
            eaten: word(inTheArk, "trendEaten"),
            diedOld: word(inTheArk, "trendDiedOld"),
            starved: word(inTheArk, "trendStarved"),
            separator: word(inTheArk, "trendSeparator") || ", "
        }, trendDate(trends.since), "en")
        : null;
    const extra = {arkEats: word(inTheArk, "arkEats"), arkEatenBy: word(inTheArk, "arkEatenBy"), foodChain: word(inTheArk, "foodChain")};
    return {words, extra, count: aboard.count, focusSlug: aboard.animals[0]?.model_slug ?? slug, canBoard, links: links ?? [], foodChain, trend};
}

type Props = {slug: string; speciesProfileId: string | null; name: string; ark: SpeciesArk | null};

/** Up to `max` species aboard, biggest first, each linked to its page when it has one. */
function ArkNames({species, max = 8}: {species: ArkFoodChainSpecies[]; max?: number}) {
    const shown = species.slice(0, max);
    return (
        <>
            {shown.map((item, index) => (
                <span key={item.id}>
                    {index > 0 ? ", " : null}
                    {item.page ? (
                        <Link href={item.page} className="font-semibold text-primary-200 underline-offset-4 hover:underline">{item.name}</Link>
                    ) : (
                        <span className="font-semibold text-white">{item.name}</span>
                    )}
                </span>
            ))}
            {species.length > shown.length ? <span className="text-ink-300"> +{species.length - shown.length}</span> : null}
        </>
    );
}

function uniqueSpecies(list: ArkFoodChainSpecies[]): ArkFoodChainSpecies[] {
    const seen = new Map<string, ArkFoodChainSpecies>();
    for (const item of list) if (!seen.has(item.id)) seen.set(item.id, item);
    return Array.from(seen.values()).sort((a, b) => b.aboard - a.aboard || a.name.localeCompare(b.name));
}

function DietNames({links}: {links: ArkFoodLink[]}) {
    return (
        <>
            {links.map((link, index) => (
                <span key={`${link.name}-${index}`}>
                    {index > 0 ? ", " : null}
                    {link.slug && isPublishedAnimalSlug(link.slug) ? (
                        <Link href={`/animals/${link.slug}`} className="font-semibold text-primary-200 underline-offset-4 hover:underline">
                            {link.name}
                        </Link>
                    ) : (
                        <span className="font-semibold text-white">{link.name}</span>
                    )}
                </span>
            ))}
        </>
    );
}

export default function SpeciesArkSection({slug, speciesProfileId, name, ark}: Props) {
    if (!ark) return null;
    const {words, count, focusSlug, canBoard} = ark;
    const copy = words.species;
    const eats = ark.links.filter((link) => link.direction === "eats");
    const eatenBy = ark.links.filter((link) => link.direction === "eatenBy");
    const extra = ark.extra ?? {arkEats: "", arkEatenBy: "", foodChain: ""};
    const chain = ark.foodChain && !ark.foodChain.kept ? ark.foodChain : null;
    const arkPrey = chain ? uniqueSpecies(chain.eats.flatMap((rule) => rule.prey)) : [];
    const arkPredators = chain ? uniqueSpecies(chain.eatenBy.map((item) => item.predator)) : [];
    return (
        <section id="ark" aria-labelledby="species-ark-title" className="scroll-mt-28 border border-white/10 bg-surface-900/55 p-5 md:p-8">
            <h2 id="species-ark-title" className="font-display text-3xl font-bold text-white md:text-4xl">{copy.title}</h2>
            <SpeciesArkCount
                speciesProfileId={speciesProfileId}
                slug={slug}
                name={name}
                initial={count}
                words={{aboardOne: copy.aboardOne, aboardOther: copy.aboardOther, notAboard: canBoard ? copy.notAboard : copy.notAboardPlain}}
            />
            {ark.trend ? <p className="mt-1 text-base text-ink-200">{ark.trend}</p> : null}
            <p className="mt-2 max-w-3xl text-base leading-7 text-ink-200">{copy.body}</p>
            {eats.length || eatenBy.length ? (
                <dl className="mt-4 flex max-w-3xl flex-col gap-1.5 text-base leading-7">
                    {eats.length ? (
                        <div>
                            <dt className="inline text-ink-300">{copy.eats}: </dt>
                            <dd className="inline"><DietNames links={eats} /></dd>
                        </div>
                    ) : null}
                    {eatenBy.length ? (
                        <div>
                            <dt className="inline text-ink-300">{copy.eatenBy}: </dt>
                            <dd className="inline"><DietNames links={eatenBy} /></dd>
                        </div>
                    ) : null}
                </dl>
            ) : null}
            {arkPrey.length || arkPredators.length ? (
                <dl className="mt-3 flex max-w-3xl flex-col gap-1.5 text-base leading-7">
                    {arkPrey.length ? (
                        <div>
                            <dt className="inline text-ink-300">{extra.arkEats}: </dt>
                            <dd className="inline"><ArkNames species={arkPrey} /></dd>
                        </div>
                    ) : null}
                    {arkPredators.length ? (
                        <div>
                            <dt className="inline text-ink-300">{extra.arkEatenBy}: </dt>
                            <dd className="inline"><ArkNames species={arkPredators} /></dd>
                        </div>
                    ) : null}
                </dl>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
                href={count ? `/ark?focus=${encodeURIComponent(focusSlug)}` : "/ark"}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-200/60 px-5 text-sm font-bold text-white transition-colors hover:border-primary-400 hover:bg-primary-400 hover:text-canvas-950"
            >
                {count ? fillArkWords(copy.see, {animal: name}) : copy.seeArk}
                <span aria-hidden="true">→</span>
            </Link>
            {ark.foodChain && extra.foodChain ? (
                <Link href={`/ark/food-chain?species=${encodeURIComponent(ark.foodChain.species.slug)}`} className="text-sm font-bold text-primary-200 underline-offset-4 hover:underline">
                    {extra.foodChain} <span aria-hidden="true">→</span>
                </Link>
            ) : null}
            </div>
        </section>
    );
}
