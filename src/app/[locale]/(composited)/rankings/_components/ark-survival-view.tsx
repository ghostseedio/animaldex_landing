import type {Metadata} from "next";
import {ArkCauses, ArkFaq, ArkOpenCta, ArkPlaceCards, ArkUnavailable} from "@/app/[locale]/(composited)/rankings/_components/ark-ranking-sections";
import {
    arkArticleSchema,
    arkBreadcrumbSchema,
    arkFaqSchema,
    arkIconOf,
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
import {readArkSurvivalReport} from "@/data/ark-rankings";
import {ARK_RANK_WINDOW_DAYS, arkIsVertebrate} from "@/lib/ark-rankings";
import {
    arkCauseBars,
    arkFocusPath,
    arkHuntingLine,
    arkNumber,
    arkPlaceCards,
    arkRiskAnimalRows,
    arkRiskKindRows,
    arkSafestPlace,
    arkPercent
} from "@/lib/ark-rankings-text";
import {fillArkWords} from "@/lib/ark-words";

/**
 * /tier-list/ark-survival (Rankings, category Ark): who lives and who doesn't in the Ark, live from its public record. The
 * numbers come from `readArkSurvivalReport` (the snapshot, the last week of the event log, the population record and the
 * Ark card's survival model); they are built once an hour per process and read from the data cache, so the page is cheap
 * to serve. The page is static (revalidated hourly) like the tier lists; `/tier-list/<slug>/lang/<language>` reads it in any of the Ark's 45 languages (`?lang=<language>` redirects there) and is not indexed.
 */

const SLUG = "ark-survival" as const;

export async function arkSurvivalMetadata(props: ArkRankingProps): Promise<Metadata> {
    const {locale, lang, rankings} = await arkRankingContext(props);
    return arkRankingMetadata({
        locale,
        lang,
        slug: SLUG,
        title: rankings.survival.metaTitle,
        description: rankings.survival.metaDescription,
        keywords: ["ark survival", "animal survival rate", "animals most at risk", "what kills animals", "animal lifespan simulation", "AnimalDex Ark"],
        updatedAt: ARK_RANKING_UPDATED
    });
}

export async function ArkSurvivalView(props: ArkRankingProps) {
    const {locale, rankings: w, readerLocale, dir, time} = await arkRankingContext(props);
    const s = w.survival;
    const [report, related] = await Promise.all([readArkSurvivalReport(), arkRelatedItems(SLUG, locale, w)]);
    const title = s.title;
    const modified = report?.asOf ? report.asOf.slice(0, 10) : ARK_RANKING_UPDATED;
    const updatedValue = new Intl.DateTimeFormat(readerLocale, {dateStyle: "long"}).format(new Date(report?.asOf ?? ARK_RANKING_UPDATED));
    const days = ARK_RANK_WINDOW_DAYS;

    const survival = report?.survival ?? null;
    const risk = report?.risk ?? null;
    const cards = survival ? arkPlaceCards(survival, w, readerLocale) : [];
    const bars = survival ? arkCauseBars(survival, w, readerLocale) : [];
    const safest = survival ? arkSafestPlace(survival) : null;
    const huntingLine = report ? arkHuntingLine(report, w, readerLocale) : "";
    // The chances count hunting only where the species' food links were read; the page says so only then.
    const hunting = report && report.hunting === "counted" && report.hunt.state === "protected" ? s.huntingCounted : "";
    const animalRows = risk ? arkRiskAnimalRows(risk.animals, w, time, readerLocale, arkIconOf) : [];
    const kindRows = risk ? arkRiskKindRows(risk.kinds, (id) => risk.kindRank.get(id) ?? 0, w, time, readerLocale, arkIconOf) : [];
    // The vertebrate kinds nearest the end, up close: the table's insects would otherwise be all there is to see.
    const closeUps = risk
        ? risk.kinds.filter((kind) => arkIsVertebrate(kind.group)).slice(0, 4).map((kind) => ({kind, row: kindRows.find((one) => one.speciesSlug === kind.slug)}))
        : [];

    const tableLabels = {
        rank: w.table.rank,
        animal: w.table.animal,
        metric: w.table.chance,
        tier: "",
        whyItRanks: w.table.reason,
        readSpecies: w.seeInArk,
        search: w.table.search,
        searchPlaceholder: w.table.searchPlaceholder,
        tierFilter: "",
        domainFilter: w.table.placeFilter,
        all: w.table.all,
        showing: w.table.showing,
        of: w.table.of,
        backToTop: w.table.backToTop
    };

    const faqItems = report
        ? [
              {
                  question: s.faqQ1,
                  answer: safest && safest.share !== null
                      ? fillArkWords(s.faqA1, {place: w.places[safest.place], days, percent: arkPercent(safest.share, readerLocale, 1)})
                      : s.methodShare.replace("{days}", String(days))
              },
              {
                  question: s.faqQ2,
                  answer: survival
                      ? fillArkWords(s.faqA2, {
                            days,
                            old: arkNumber(survival.causes.falls.old, readerLocale),
                            starved: arkNumber(survival.causes.falls.starved, readerLocale),
                            eaten: arkNumber(survival.causes.falls.eaten, readerLocale),
                            hunting: huntingLine
                        }).trim()
                      : s.recoverNote
              },
          ]
        : [];
    const topKinds = risk ? risk.kinds.slice(0, 10).map((kind) => ({name: kind.name, path: arkFocusPath(kind.slug)})) : [];
    const schemas = [
        arkArticleSchema({locale, slug: SLUG, title, description: s.description, modifiedAt: modified}),
        ...(topKinds.length ? [arkItemListSchema(locale, topKinds)] : []),
        ...(faqItems.length ? [arkFaqSchema(faqItems)] : []),
        arkBreadcrumbSchema(locale, SLUG, {home: "AnimalDex", lists: w.breadcrumb, page: title})
    ];

    return (
        <article dir={dir} className="mx-auto flex w-full max-w-[86rem] flex-col gap-8 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <RankingBreadcrumbs items={[{href: "/tier-list", label: w.breadcrumb}, {label: w.category}, {label: title}]} />

            <RankingHero
                title={title}
                description={s.description}
                categoryLabel={w.category}
                updatedLabel={w.updated}
                updatedValue={updatedValue}
                rankedSpeciesLabel={s.animalsAboard}
                rankedSpeciesValue={report ? arkNumber(report.animals, readerLocale) : "–"}
                readingTimeLabel={w.readingTime}
                readingTimeValue={fillArkWords(w.readingMinutes, {minutes: 5})}
                methodologyHref="#methodology"
                methodologyLabel={w.methodLink}
            />

            <section className="max-w-4xl">
                <p className="text-base leading-7 text-ink-200 md:text-lg">{s.intro}</p>
            </section>

            {!report ? <ArkUnavailable text={w.unavailable} /> : null}

            {report && cards.length ? <ArkPlaceCards title={s.placesTitle} description={fillArkWords(s.placesDescription, {days})} cards={cards} openLabel={w.openArk} /> : null}

            {report && survival ? (
                <ArkCauses
                    title={s.causesTitle}
                    description={fillArkWords(s.causesDescription, {days})}
                    bars={bars}
                    notes={[
                        huntingLine,
                        hunting,
                        s.recoverNote,
                        s.notRecorded,
                        report.allTime ? fillArkWords(s.allTime, {born: arkNumber(report.allTime.born, readerLocale), died: arkNumber(report.allTime.died, readerLocale), eaten: arkNumber(report.allTime.eaten, readerLocale)}) : ""
                    ]}
                />
            ) : null}

            {closeUps.length ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{s.closeUpTitle}</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {closeUps.map(({kind, row}) =>
                            row ? (
                                <RankingEntryCard
                                    key={kind.kindId}
                                    rank={row.rank}
                                    speciesSlug={kind.slug}
                                    speciesName={kind.name}
                                    iconSrc={row.iconSrc}
                                    primaryMetric={row.primaryMetric}
                                    shortReason={row.shortReason}
                                    summary={kind.group ? w.groups[kind.group] : ""}
                                    readSpeciesLabel={w.seeInArk}
                                    href={row.href}
                                />
                            ) : null
                        )}
                    </div>
                </section>
            ) : null}

            {animalRows.length ? (
                <RankingTable
                    idPrefix="animals-"
                    showTier={false}
                    title={s.animalsTitle}
                    description={s.animalsDescription}
                    labels={tableLabels}
                    items={animalRows}
                />
            ) : null}

            {kindRows.length ? (
                <RankingTable
                    idPrefix="kinds-"
                    showTier={false}
                    title={s.kindsTitle}
                    description={s.kindsDescription}
                    labels={{...tableLabels, animal: w.table.kind, domainFilter: w.table.groupFilter}}
                    items={kindRows}
                />
            ) : null}

            <RankingMethodology
                title={s.methodTitle}
                description={fillArkWords(s.methodDescription, {days})}
                items={[fillArkWords(s.methodShare, {days}), s.methodChance, s.methodKinds]}
            />

            {faqItems.length ? <ArkFaq title={w.faqTitle} items={faqItems} /> : null}

            <RelatedRankingsSection title={w.relatedTitle} description={w.relatedDescription} readRankingLabel={w.readRanking} items={related} />

            <ArkOpenCta title={w.ctaTitle} body={w.ctaBody} button={w.openArk} />
        </article>
    );
}
