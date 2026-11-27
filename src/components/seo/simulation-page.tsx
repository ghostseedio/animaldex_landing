import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import TextPage, {LinkRow, Paragraphs, TextSection} from "@/components/seo/text-page";
import {arkFoodChainPage} from "@/data/ark-food-chain";
import {readArkLandingSummary} from "@/data/ark-landing";
import {readPublicArk} from "@/data/ark-public";
import {arkSpeciesCounts} from "@/lib/ark-seo";
import {
    ANIMAL_SIMULATION_PATH,
    ARK_FOOD_CHAIN_PATH,
    ARK_HOW_IT_WORKS_PATH,
    ARK_PATH,
    ARK_RENDER_IMAGE,
    ECOSYSTEM_SIMULATION_PATH,
    SIMULATION_PAGES_UPDATED,
    arkCountsLine,
    arkPageImage
} from "@/lib/seo/ark-pages";
import {SIMULATION_PAGES, simulationFaq, type SimulationPageId} from "@/lib/seo/simulation-pages";
import {isSeoSsgRemoteForbidden} from "@/lib/seo-ssg-remote-guard";
import {breadcrumbJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {getAbsoluteUrl} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";
import {getPageWords, word} from "@/loaders/page-words";

/**
 * /animal-simulation and /ecosystem-simulation (SEO audit 2026-11-27): the pages for people searching for an animal
 * or ecosystem simulation. The Ark is one, and the App Store listing is named "Animal Simulator", yet no page on the
 * site said either phrase. The owner wants the home page and /ark kept visual, so the words live here: what the
 * simulation is, what it runs, and what it is not, with the Ark's live figures (the public read and the public event
 * log, the same reads the home page uses; the log is never read during the build), a real render of the world that opens it, and the questions people ask.
 *
 * Every rule stated here is one /ark/how-it-works states; nothing is claimed that the Ark does not do. English and
 * Indonesian. Server-rendered, cached an hour.
 */

const SECTION_PARAGRAPHS = ["p1", "p2"] as const;
const RUNS = ["food", "breeding", "life", "seasons", "islands"] as const;
const TOP_SPECIES = 12;

function count(value: number, locale: string) {
    return value.toLocaleString(locale === "id" ? "id-ID" : "en-US");
}

function Stat({value, label}: {value: string; label: string}) {
    return (
        <div className="flex flex-col gap-1 border-s border-line-300 ps-4">
            <dd className="font-display text-3xl font-black tabular-nums tracking-tight text-white md:text-4xl">{value}</dd>
            <dt className="text-[13px] leading-5 text-ink-300">{label}</dt>
        </div>
    );
}

export default async function SimulationPage({locale, id}: {locale: string; id: SimulationPageId}) {
    const config = SIMULATION_PAGES[id];
    const [page, seo, {words: ark}, snapshot, summary] = await Promise.all([
        getPageWords(locale, `pages.${id}`),
        getPageWords(locale, "seo"),
        getArkWords(locale),
        readPublicArk(3600),
        // The last day's figures come from the Ark's event log, a long read on a cold process: never during the build
        // (the page then shows the counts alone, and gains the day's figures at its first hourly refresh on the server).
        isSeoSsgRemoteForbidden() ? null : readArkLandingSummary().catch(() => null)
    ]);
    const other = id === "animalSimulation" ? ECOSYSTEM_SIMULATION_PATH : ANIMAL_SIMULATION_PATH;
    const crumbs = [
        {name: word(seo, "breadcrumbHome"), href: "/"},
        {name: word(seo, "breadcrumbArk"), href: ARK_PATH},
        {name: word(page, "breadcrumb"), href: config.path}
    ];
    const faq = simulationFaq((key) => word(page, `faq.${key}`));
    const counts = snapshot?.counts.animals ? snapshot.counts : null;
    const today = summary?.available ? summary.today : null;
    const top = config.topSpecies ? arkSpeciesCounts(snapshot).slice(0, TOP_SPECIES) : [];

    const jsonLd: JsonLd[] = [
        webPageJsonLd({
            locale,
            path: config.path,
            name: word(page, "title"),
            description: word(page, "metaDescription"),
            image: arkPageImage(),
            dateModified: SIMULATION_PAGES_UPDATED,
            about: config.topics.map((name) => ({"@type": "Thing", name})),
            // The simulation itself is the Ark: the same entity /ark declares.
            mainEntity: {"@type": "WebApplication", "@id": `${getAbsoluteUrl("en", ARK_PATH)}#ark`, name: "AnimalDex Ark", url: getAbsoluteUrl(locale, ARK_PATH)}
        }),
        breadcrumbJsonLd(locale, crumbs.map((crumb) => ({name: crumb.name, path: crumb.href}))),
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item) => ({"@type": "Question", name: item.question, acceptedAnswer: {"@type": "Answer", text: item.answer}}))
        }
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
        >
            <figure className="flex flex-col gap-4">
                <Link href={ARK_PATH} aria-label={word(page, "openArk")} className="block overflow-hidden rounded-2xl border border-line-300">
                    <img src={ARK_RENDER_IMAGE} alt={word(seo, "arkImageAlt")} width={1200} height={630} className="h-auto w-full" />
                </Link>
                <figcaption className="text-[13px] text-ink-400">{word(page, "heroCaption")}</figcaption>
                <LinkRow
                    links={[
                        {href: ARK_PATH, label: word(page, "openArk"), primary: true},
                        {href: ARK_HOW_IT_WORKS_PATH, label: word(page, "howLink")}
                    ]}
                />
            </figure>

            {counts ? (
                <TextSection id="live" title={word(page, "statsTitle")}>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">
                        <Stat value={count(counts.animals, locale)} label={word(page, "statAnimals")} />
                        <Stat value={count(counts.species, locale)} label={word(page, "statSpecies")} />
                        <Stat value={count(counts.founders, locale)} label={word(page, "statPeople")} />
                    </dl>
                    {today ? (
                        <>
                            <h3 className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-primary-200">{word(page, "dayTitle")}</h3>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
                                <Stat value={count(today.births, locale)} label={word(page, "statBorn")} />
                                <Stat value={count(today.arrivals, locale)} label={word(page, "statArrived")} />
                                <Stat value={count(today.meals, locale)} label={word(page, "statMeals")} />
                                <Stat value={count(today.deaths, locale)} label={word(page, "statDied")} />
                            </dl>
                        </>
                    ) : null}
                </TextSection>
            ) : null}

            {config.sections.map((section) => (
                <TextSection key={section} id={section} title={word(page, `sections.${section}.title`)}>
                    {section === "runs" ? (
                        <dl className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
                            {RUNS.map((item) => (
                                <div key={item} className="flex flex-col gap-1.5">
                                    <dt className="font-display text-lg font-extrabold text-white">{word(page, `sections.runs.${item}Title`)}</dt>
                                    <dd className="text-base leading-7 text-ink-200">{word(page, `sections.runs.${item}Body`)}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <Paragraphs items={SECTION_PARAGRAPHS.map((key) => word(page, `sections.${section}.${key}`))} />
                    )}
                    {section === "real" && top.length ? (
                        <>
                            <h3 className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-primary-200">{word(page, "topTitle")}</h3>
                            <ul className="flex flex-wrap gap-2">
                                {top.map((species) => {
                                    const href = arkFoodChainPage(species.slug);
                                    const label = (
                                        <>
                                            {species.name} <span className="tabular-nums text-ink-300">{count(species.count, locale)}</span>
                                        </>
                                    );
                                    return (
                                        <li key={species.slug}>
                                            {href ? (
                                                <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-300 px-4 text-sm font-semibold text-white transition-colors hover:border-primary-200">{label}</Link>
                                            ) : (
                                                <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-300 px-4 text-sm font-semibold text-white">{label}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    ) : null}
                    {section === "food" ? (
                        <p>
                            <Link href={ARK_FOOD_CHAIN_PATH} className="inline-flex min-h-11 items-center gap-2 font-bold text-primary-200 underline-offset-4 hover:underline">
                                {word(page, "foodLink")} <span aria-hidden="true">→</span>
                            </Link>
                        </p>
                    ) : null}
                    {section === "populations" ? (
                        <p className="flex flex-wrap gap-x-6 gap-y-1">
                            {[
                                {href: "/tier-list/ark-survival", label: word(page, "survivalLink")},
                                {href: "/tier-list/ark-fastest-breeders", label: word(page, "breedersLink")}
                            ].map((link) => (
                                <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center gap-2 font-bold text-primary-200 underline-offset-4 hover:underline">
                                    {link.label} <span aria-hidden="true">→</span>
                                </Link>
                            ))}
                        </p>
                    ) : null}
                </TextSection>
            ))}

            <TextSection id="faq" title={word(page, "faqTitle")}>
                <dl className="flex flex-col gap-6">
                    {faq.map((item) => (
                        <div key={item.question} className="flex flex-col gap-1.5">
                            <dt className="font-display text-lg font-extrabold text-white">{item.question}</dt>
                            <dd className="max-w-3xl text-base leading-7 text-ink-200">{item.answer}</dd>
                        </div>
                    ))}
                </dl>
            </TextSection>

            <section aria-labelledby="simulation-links" className="flex flex-col gap-5 border-t border-line-300 pt-10">
                <h2 id="simulation-links" className="font-display text-3xl font-black tracking-tight text-white md:text-4xl">{word(page, "linksTitle")}</h2>
                <p className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{word(page, "linksBody")}</p>
                <LinkRow
                    links={[
                        {href: ARK_PATH, label: word(page, "openArk"), primary: true},
                        {href: other, label: word(page, "otherLink")},
                        {href: ARK_HOW_IT_WORKS_PATH, label: word(page, "howLink")},
                        {href: ARK_FOOD_CHAIN_PATH, label: word(page, "foodLink")}
                    ]}
                />
                <StoreLinks className="!mt-2" />
            </section>
        </TextPage>
    );
}
