import Link from "@/app/[locale]/_components/link";
import SpeciesArkCount from "@/app/[locale]/(composited)/animals/[slug]/species-ark-count";
import {readArkCanBoard, readArkFoodLinks, readPublicArk, type ArkFoodLink} from "@/data/ark-public";
import {arkSpeciesAboard} from "@/lib/ark-population";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {getArkWords} from "@/loaders/ark-words";

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
 * - "One comes aboard when a step works" only for a species that can board
 *   (it has an Ark model).
 * - Counts and species only: never who brought one.
 */

/** The page's own window (its daily ISR): these reads add no extra rebuilds. */
const REVALIDATE_SECONDS = 86400;

/** What the section shows, read on the server with the page (null: say nothing about the Ark). */
export type SpeciesArk = {
    words: ArkWords;
    count: number;
    focusSlug: string;
    canBoard: boolean | null;
    links: ArkFoodLink[];
};

export async function loadSpeciesArk({slug, speciesProfileId}: {slug: string; speciesProfileId: string | null}): Promise<SpeciesArk | null> {
    const [{words}, snapshot, links, canBoard] = await Promise.all([
        getArkWords("en"),
        readPublicArk(REVALIDATE_SECONDS),
        speciesProfileId ? readArkFoodLinks(speciesProfileId, REVALIDATE_SECONDS) : Promise.resolve(null),
        readArkCanBoard({speciesProfileId, slug}, REVALIDATE_SECONDS)
    ]);
    // Before the Ark is open (or when it cannot be read) the page says nothing about it.
    if (!snapshot) return null;
    const aboard = arkSpeciesAboard(snapshot, {speciesProfileId, slug});
    // A species that cannot come aboard and is not aboard: nothing to show.
    if (!aboard.count && canBoard === false) return null;
    return {words, count: aboard.count, focusSlug: aboard.animals[0]?.model_slug ?? slug, canBoard, links: links ?? []};
}

type Props = {slug: string; speciesProfileId: string | null; name: string; ark: SpeciesArk | null};

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
            <Link
                href={count ? `/ark?focus=${encodeURIComponent(focusSlug)}` : "/ark"}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-200/60 px-5 text-sm font-bold text-white transition-colors hover:border-primary-400 hover:bg-primary-400 hover:text-canvas-950"
            >
                {count ? fillArkWords(copy.see, {animal: name}) : copy.seeArk}
                <span aria-hidden="true">→</span>
            </Link>
        </section>
    );
}
