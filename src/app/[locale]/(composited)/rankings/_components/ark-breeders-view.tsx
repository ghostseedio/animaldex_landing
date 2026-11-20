import type {Metadata} from "next";
import {ArkFaq, ArkOpenCta, ArkStatStrip, ArkUnavailable} from "@/app/[locale]/(composited)/rankings/_components/ark-ranking-sections";
import {
    arkArticleSchema,
    arkBreadcrumbSchema,
    arkFaqSchema,
    arkIconResolver,
    arkItemListSchema,
    arkRankingContext,
    arkRankingMetadata,
    arkRelatedItems,
    type ArkRankingProps
} from "@/app/[locale]/(composited)/rankings/_components/ark-ranking-page";
import RankingBreadcrumbs from "@/app/[locale]/(composited)/rankings/_components/ranking-breadcrumbs";
import RankingEntryCard from "@/app/[locale]/(composited)/rankings/_components/ranking-entry-card";
import RankingHero from "@/app/[locale]/(composited)/rankings/_components/ranking-hero";
import RankingMethodology from "@/app/[locale]/(composited)/rankings/_components/ranking-methodology";
import RankingTable from "@/app/[locale]/(composited)/rankings/_components/ranking-table";
import RelatedRankingsSection from "@/app/[locale]/(composited)/rankings/_components/related-rankings-section";
import {ARK_RANKING_UPDATED} from "@/data/ark-ranking-pages";
import {readArkBreedersReport} from "@/data/ark-rankings";
import {arkIsVertebrate} from "@/lib/ark-rankings";
import {arkBreederRows, arkFocusPath, arkNumber} from "@/lib/ark-rankings-text";
import {fillArkWords} from "@/lib/ark-words";

/**
 * /tier-list/ark-fastest-breeders (Rankings, category Ark): which kinds are having the most young in the Ark, live from its
 * public record: births per kind in the last day, the last week and all time (`voyage_population_history_v1`), and young
 * per adult (births against the grown animals of the kind aboard now), with the engine's breeding rules in plain words.
 * Vertebrates and mammals have their own lists, so the insects that breed fastest of all do not bury them. The page is static (revalidated hourly) like the tier
 * lists; `/tier-list/<slug>/lang/<language>` reads it in any of the Ark's 45 languages (`?lang=<language>` redirects there) and is not indexed.
 */

const SLUG = "ark-fastest-breeders" as const;
const LIST_SIZE = 25;

export async function arkBreedersMetadata(props: ArkRankingProps): Promise<Metadata> {
    const {locale, lang, rankings} = await arkRankingContext(props);
    return arkRankingMetadata({
        locale,
        lang,
        slug: SLUG,
        title: rankings.breeders.metaTitle,
        description: rankings.breeders.metaDescription,
        keywords: ["fastest breeding animals", "animal birth rate", "young per adult", "animal breeding simulation", "fastest breeding mammals", "AnimalDex Ark"],
        updatedAt: ARK_RANKING_UPDATED
    });
}

export async function ArkBreedersView(props: ArkRankingProps) {
    const {locale, rankings: w, readerLocale, dir} = await arkRankingContext(props);
    const b = w.breeders;
    const [report, related, arkIconOf] = await Promise.all([readArkBreedersReport(), arkRelatedItems(SLUG, locale, w), arkIconResolver()]);
    const title = b.title;
    const modified = report?.asOf ? report.asOf.slice(0, 10) : ARK_RANKING_UPDATED;
    const updatedValue = new Intl.DateTimeFormat(readerLocale, {dateStyle: "long"}).format(new Date(report?.asOf ?? ARK_RANKING_UPDATED));

    const all = report?.breeders ?? [];
    const vertebrates = all.filter((row) => arkIsVertebrate(row.group)).slice(0, LIST_SIZE);
    const mammals = all.filter((row) => row.group === "mammal").slice(0, LIST_SIZE);
    const everything = all.slice(0, LIST_SIZE);
    const rows = {
        vertebrates: arkBreederRows(vertebrates, w, readerLocale, arkIconOf),
        // (one group: no group filter on this list)
        mammals: arkBreederRows(mammals, w, readerLocale, arkIconOf).map((row) => ({...row, domain: ""})),
        all: arkBreederRows(everything, w, readerLocale, arkIconOf)
    };
    const labels = {
        rank: w.table.rank,
        animal: w.table.kind,
        metric: w.table.youngPerAdult,
        tier: "",
        whyItRanks: w.table.reason,
        readSpecies: w.seeInArk,
        search: w.table.search,
        searchPlaceholder: w.table.searchPlaceholder,
        tierFilter: "",
        domainFilter: w.table.groupFilter,
        all: w.table.all,
        showing: w.table.showing,
        of: w.table.of,
        backToTop: w.table.backToTop
    };
    const topVertebrates = vertebrates.slice(0, 4).map((row, index) => ({row, item: rows.vertebrates[index]}));
    const lead = vertebrates[0];
    const faqItems = report
        ? [
              {
                  question: b.faqQ1,
                  answer: lead
                      ? fillArkWords(b.faqA1, {name: lead.name, value: arkNumber(lead.youngPerAdult, readerLocale, 1), born: arkNumber(lead.bornAll, readerLocale), adults: arkNumber(lead.adults, readerLocale)})
                      : b.rule1
              },
              {question: b.faqQ2, answer: b.faqA2}
          ]
        : [];
    const schemas = [
        arkArticleSchema({locale, slug: SLUG, title, description: b.description, modifiedAt: modified}),
        ...(vertebrates.length ? [arkItemListSchema(locale, vertebrates.slice(0, 10).map((row) => ({name: row.name, path: arkFocusPath(row.slug)})))] : []),
        ...(faqItems.length ? [arkFaqSchema(faqItems)] : []),
        arkBreadcrumbSchema(locale, SLUG, {home: "AnimalDex", lists: w.breadcrumb, page: title})
    ];

    return (
        <article dir={dir} className="mx-auto flex w-full max-w-[86rem] flex-col gap-8 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <RankingBreadcrumbs items={[{href: "/tier-list", label: w.breadcrumb}, {label: w.category}, {label: title}]} />

            <RankingHero
                title={title}
                description={b.description}
                categoryLabel={w.category}
                updatedLabel={w.updated}
                updatedValue={updatedValue}
                rankedSpeciesLabel={b.kindsRanked}
                rankedSpeciesValue={report ? arkNumber(all.length, readerLocale) : "–"}
                readingTimeLabel={w.readingTime}
                readingTimeValue={fillArkWords(w.readingMinutes, {minutes: 4})}
                methodologyHref="#methodology"
                methodologyLabel={w.methodLink}
            />

            <section className="max-w-4xl">
                <p className="text-base leading-7 text-ink-200 md:text-lg">{b.intro}</p>
            </section>

            {!report ? <ArkUnavailable text={w.unavailable} /> : null}

            {report ? (
                <ArkStatStrip
                    title={b.totalsTitle}
                    items={[
                        {label: b.totalsDay, value: arkNumber(report.births.day, readerLocale)},
                        {label: b.totalsWeek, value: arkNumber(report.births.week, readerLocale)},
                        {label: b.totalsAll, value: arkNumber(report.births.all, readerLocale)}
                    ]}
                />
            ) : null}

            <RankingMethodology id="rules" title={b.rulesTitle} description="" items={[b.rule1, b.rule2, b.rule3, b.rule4]} />

            {topVertebrates.length ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{b.topTitle}</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {topVertebrates.map(({row, item}) => (
                            <RankingEntryCard
                                key={row.kindId}
                                rank={item.rank}
                                speciesSlug={row.slug}
                                speciesName={row.name}
                                iconSrc={item.iconSrc}
                                primaryMetric={item.primaryMetric}
                                shortReason={item.shortReason}
                                summary={row.group ? w.groups[row.group] : ""}
                                readSpeciesLabel={w.seeInArk}
                                href={item.href}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            {rows.vertebrates.length ? <RankingTable idPrefix="vertebrates-" showTier={false} title={b.vertebratesTitle} description={b.vertebratesDescription} labels={labels} items={rows.vertebrates} /> : null}
            {rows.mammals.length ? <RankingTable idPrefix="mammals-" showTier={false} title={b.mammalsTitle} description={b.mammalsDescription} labels={labels} items={rows.mammals} /> : null}
            {rows.all.length ? <RankingTable idPrefix="all-" showTier={false} title={b.allTitle} description={b.allDescription} labels={labels} items={rows.all} /> : null}

            <RankingMethodology
                title={b.methodTitle}
                description={b.methodDescription}
                items={[b.methodYoung, b.methodGroups]}
            />

            {faqItems.length ? <ArkFaq title={w.faqTitle} items={faqItems} /> : null}

            <RelatedRankingsSection title={w.relatedTitle} description={w.relatedDescription} readRankingLabel={w.readRanking} items={related} />

            <ArkOpenCta title={w.ctaTitle} body={w.ctaBody} button={w.openArk} />
        </article>
    );
}
