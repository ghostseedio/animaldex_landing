import {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import ChallengeHero from "@/app/[locale]/(composited)/challenges/_components/challenge-hero";
import AnimalVsStatTable from "@/app/[locale]/(composited)/challenges/_components/animal-vs-stat-table";
import ChallengeSpeciesStatsComparison from "@/app/[locale]/(composited)/challenges/_components/challenge-species-stats-comparison";
import ScenarioBreakdown from "@/app/[locale]/(composited)/challenges/_components/scenario-breakdown";
import ChallengeVerdictCard from "@/app/[locale]/(composited)/challenges/_components/challenge-verdict-card";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import ComparisonPageNavigation from "@/app/[locale]/(composited)/challenges/_components/comparison-page-navigation";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import ComparisonGenerating from "@/app/[locale]/(composited)/comparisons/[slug]/_components/comparison-generating";
import ComparisonVotePanel from "@/app/[locale]/(composited)/comparisons/[slug]/_components/comparison-vote-panel";
import ComparisonComments from "@/app/[locale]/(composited)/comparisons/[slug]/_components/comparison-comments";
import {getChallenge} from "@/data/challenges";
import {findComparableAnimal, type ComparableAnimal} from "@/data/comparison-animals";
import {
    COMMENT_MAX_LENGTH,
    fetchComparisonComments,
    fetchVoteTally
} from "@/data/comparison-engagement";
import {
    buildComparisonSpeciesFallback,
    fetchSpeciesComparisonBySlug,
    getRelatedMergedChallenges,
    canonicalUnpublishedComparisonSlug,
    parseComparisonSlug,
    resolveReadyChallengeEntry,
    reversedComparisonSlug
} from "@/data/species-comparisons";
import {buildSpeciesArtworkSrc, resolveSpeciesArtworkFiles} from "@/data/species-artwork-index";
import {getSpeciesBySlug, type SpeciesEntry} from "@/data/species";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getSystemsIntelligenceEntriesForSpeciesSlugs} from "@/data/species-systems-intelligence";
import {getBattleTier, resolveSpeciesStats} from "@/data/species-stats";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type Props = {params: {locale: string; slug: string}};

export const revalidate = 300;

type ComparisonSpecies = SpeciesEntry & {hasCatalogPage: boolean};

async function resolveComparisonSpecies(
    slug: string,
    displayName?: string | null
): Promise<ComparisonSpecies> {
    const resolved = (await getResolvedSpeciesBySlug(slug)) ?? getSpeciesBySlug(slug) ?? null;
    if (resolved) {
        return {...resolved, hasCatalogPage: true};
    }

    return {
        ...buildComparisonSpeciesFallback(slug, displayName),
        hasCatalogPage: false
    };
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "medium"}).format(new Date(date));
}

function getReadMinutes(parts: string[]) {
    return Math.max(4, Math.ceil(parts.join(" ").trim().split(/\s+/).length / 210));
}

/**
 * A slug that is not published yet but names two catalog species — the page is
 * generated on demand from the client instead of blocking the render.
 */
async function resolvePendingPair(slug: string): Promise<{
    animalA: ComparableAnimal;
    animalB: ComparableAnimal;
    comparisonType: string;
} | null> {
    const parsed = parseComparisonSlug(slug);
    if (!parsed) return null;

    const [animalA, animalB] = await Promise.all([
        findComparableAnimal(parsed.animalASlug),
        findComparableAnimal(parsed.animalBSlug)
    ]);

    if (!animalA || !animalB || animalA.slug === animalB.slug) return null;
    return {animalA, animalB, comparisonType: parsed.comparisonType};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const challenge = await resolveReadyChallengeEntry(params.slug);

    if (!challenge) {
        const pending = await resolvePendingPair(params.slug);
        if (!pending) return {};
        // Keep the loading state out of the index; the finished page is indexable.
        return {
            title: `${pending.animalA.name} vs ${pending.animalB.name}`,
            robots: {index: false, follow: true}
        };
    }
    const [animalA, animalB] = await Promise.all([
        resolveComparisonSpecies(challenge.animalASlug, challenge.animalADisplayName),
        resolveComparisonSpecies(challenge.animalBSlug, challenge.animalBDisplayName)
    ]);
    return buildContentMetadata({
        locale: params.locale,
        pathname: `/comparisons/${challenge.slug}`,
        title: challenge.title,
        description: challenge.description,
        keywords: [...challenge.searchIntents, challenge.comparisonType, animalA.name, animalB.name],
        featuredImage: challenge.featuredImage,
        publishedAt: challenge.publishedAt,
        updatedAt: challenge.updatedAt,
        tags: [challenge.comparisonType, animalA.name, animalB.name]
    });
}

export default async function ComparisonDetailPage({params}: Props) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "comparisons");
    const challenge = await resolveReadyChallengeEntry(slug);

    if (!challenge) {
        const pending = await resolvePendingPair(slug);
        if (!pending) notFound();

        const reversedSlug = reversedComparisonSlug(slug);
        if (reversedSlug && await resolveReadyChallengeEntry(reversedSlug)) {
            redirect(getLocalePath(locale, `/comparisons/${reversedSlug}`));
        }

        const unpublishedCanonicalSlug = canonicalUnpublishedComparisonSlug(slug);
        if (unpublishedCanonicalSlug && unpublishedCanonicalSlug !== slug) {
            redirect(getLocalePath(locale, `/comparisons/${unpublishedCanonicalSlug}`));
        }

        return (
            <ComparisonGenerating
                basePath={getLocalePath(locale, "/comparisons")}
                slug={slug}
                animalAName={pending.animalA.name}
                animalBName={pending.animalB.name}
                animalAArtwork={pending.animalA.artworkUrl}
                animalBArtwork={pending.animalB.artworkUrl}
                copy={{
                    eyebrow: t("generating.eyebrow"),
                    title: t("generating.title", {animalA: pending.animalA.name, animalB: pending.animalB.name}),
                    description: t("generating.description"),
                    steps: [
                        t("generating.stepOne"),
                        t("generating.stepTwo"),
                        t("generating.stepThree"),
                        t("generating.stepFour")
                    ],
                    elapsedLabel: t("generating.elapsed", {seconds: "{seconds}"}),
                    errorTitle: t("generating.errorTitle"),
                    errorDescription: t("generating.errorDescription"),
                    rateLimitTitle: t("generating.rateLimitTitle"),
                    rateLimitDescription: t("generating.rateLimitDescription"),
                    retryLabel: t("generating.retry"),
                    browseLabel: t("generating.browse")
                }}
            />
        );
    }

    const [animalA, animalB] = await Promise.all([
        resolveComparisonSpecies(challenge.animalASlug, challenge.animalADisplayName),
        resolveComparisonSpecies(challenge.animalBSlug, challenge.animalBDisplayName)
    ]);

    const [animalAStatsResult, animalBStatsResult] = await Promise.all([
        resolveSpeciesStats(animalA.slug, animalA),
        resolveSpeciesStats(animalB.slug, animalB)
    ]);
    const animalABattleTier = animalAStatsResult.stats ? getBattleTier(animalAStatsResult.stats) : null;
    const animalBBattleTier = animalBStatsResult.stats ? getBattleTier(animalBStatsResult.stats) : null;

    const decisiveScenarios = challenge.scenarioBreakdown.filter((item) => item.winner === "animalA" || item.winner === "animalB");
    const aWins = decisiveScenarios.filter((item) => item.winner === "animalA").length;
    const bWins = decisiveScenarios.filter((item) => item.winner === "animalB").length;
    const winnerSide = aWins === bWins ? challenge.scenarioBreakdown.find((item) => item.winner === "animalA" || item.winner === "animalB")?.winner : aWins > bWins ? "animalA" : "animalB";
    const winner = winnerSide === "animalA" ? animalA : winnerSide === "animalB" ? animalB : null;
    const winnerLabel = winner ? t("winner", {animal: winner.name}) : t("winnerLabels.depends");
    const confidence = winner ? Math.min(94, 66 + Math.round((Math.max(aWins, bWins) / Math.max(1, decisiveScenarios.length)) * 26)) : 55;
    const readMinutes = getReadMinutes([challenge.description, challenge.quickVerdict, ...challenge.shortAnswer, ...challenge.whyThisMatchupIsInteresting, ...challenge.statCategories.flatMap((item) => [item.animalAValue, item.animalBValue, item.takeaway]), ...challenge.scenarioBreakdown.flatMap((item) => [item.verdict, item.explanation]), ...challenge.finalTake, ...challenge.faq.flatMap((item) => [item.question, item.answer])]);

    const relatedEntries = [];
    for (const relatedSlug of challenge.relatedChallengeSlugs || []) {
        const entry = getChallenge(relatedSlug) ?? (await fetchSpeciesComparisonBySlug(relatedSlug));
        if (entry) relatedEntries.push(entry);
    }
    const relatedSource = relatedEntries.length > 0
        ? relatedEntries.slice(0, 4)
        : await getRelatedMergedChallenges(challenge.slug, 4);
    const relatedChallenges = relatedSource.flatMap((entry) => {
        const relatedA = getSpeciesBySlug(entry.animalASlug);
        const relatedB = getSpeciesBySlug(entry.animalBSlug);
        if (!relatedA || !relatedB) {
            return [{
                slug: entry.slug,
                title: entry.title,
                quickVerdict: entry.quickVerdict,
                animalAName: entry.animalASlug.replace(/-/g, " "),
                animalBName: entry.animalBSlug.replace(/-/g, " "),
                comparisonTypeLabel: t(`comparisonTypes.${entry.comparisonType}`),
                image: entry.featuredImage
            }];
        }
        return [{slug: entry.slug, title: entry.title, quickVerdict: entry.quickVerdict, animalAName: relatedA.name, animalBName: relatedB.name, comparisonTypeLabel: t(`comparisonTypes.${entry.comparisonType}`), image: entry.featuredImage}];
    });
    const staticSystemsItems = getSystemsIntelligenceEntriesForSpeciesSlugs(challenge.systemsSpeciesSlugs || challenge.speciesSlugs).flatMap(({slug: speciesSlug, entry}) => {
        const species = getSpeciesBySlug(speciesSlug);
        return species ? [{slug: speciesSlug, name: species.name, href: `/animals/${species.slug}`, entry}] : [];
    });
    const systemsItems = staticSystemsItems.length > 0
        ? staticSystemsItems
        : (challenge.systemsIntelligenceEntries || []).map(({slug: speciesSlug, entry}) => ({
            slug: speciesSlug,
            name: speciesSlug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
            href: `/animals/${speciesSlug}`,
            entry
        }));

    const [voteTally, comments, artworkFiles] = await Promise.all([
        fetchVoteTally(challenge.slug).catch(() => ({animalAVotes: 0, animalBVotes: 0, totalVotes: 0})),
        fetchComparisonComments(challenge.slug).catch(() => []),
        resolveSpeciesArtworkFiles([animalA.slug, animalB.slug]).catch(() => new Map<string, string | null>())
    ]);

    const pageUrl = getAbsoluteUrl(locale, `/comparisons/${challenge.slug}`);
    const schemas = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: challenge.title,
            description: challenge.description,
            datePublished: challenge.publishedAt,
            dateModified: challenge.updatedAt,
            inLanguage: locale,
            url: pageUrl,
            image: getAbsoluteUrl(locale, challenge.featuredImage.src),
            author: {"@type": "Organization", name: "AnimalDex"},
            publisher: {"@type": "Organization", name: "AnimalDex"},
            commentCount: comments.length,
            ...(comments.length
                ? {
                    comment: comments.map((item) => ({
                        "@type": "Comment",
                        text: item.body,
                        dateCreated: item.createdAt,
                        author: {"@type": "Person", name: item.authorName}
                    }))
                }
                : {})
        },
        {"@context": "https://schema.org", "@type": "FAQPage", mainEntity: challenge.faq.map((item) => ({"@type": "Question", name: item.question, acceptedAnswer: {"@type": "Answer", text: item.answer}}))},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl(locale)}, {"@type": "ListItem", position: 2, name: t("title"), item: getAbsoluteUrl(locale, "/comparisons")}, {"@type": "ListItem", position: 3, name: challenge.title, item: pageUrl}]}
    ];

    const speciesCards = [
        {species: animalA, stats: animalAStatsResult.stats, tier: animalABattleTier},
        {species: animalB, stats: animalBStatsResult.stats, tier: animalBBattleTier}
    ];

    const secondaryLinks = [
        animalA.hasCatalogPage
            ? {href: `/animals/${animalA.slug}`, label: t("trackSpecies", {animal: animalA.name})}
            : null,
        animalB.hasCatalogPage
            ? {href: `/animals/${animalB.slug}`, label: t("trackSpecies", {animal: animalB.name})}
            : null
    ].filter((link): link is {href: string; label: string} => Boolean(link));

    return (
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-9 px-4 pb-12 pt-5 md:px-8 md:pb-20 md:pt-8">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />
            <Link
                href="/comparisons"
                className="-mb-4 inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-primary-200 hover:text-primary-100"
            >
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("back")}
            </Link>

            <ChallengeHero challenge={challenge} comparisonTypeLabel={t(`comparisonTypes.${challenge.comparisonType}`)} animalAName={animalA.name} animalBName={animalB.name} updatedLabel={t("updated")} updatedValue={formatDate(locale, challenge.updatedAt || challenge.publishedAt)} winnerLabel={winnerLabel} readTimeLabel={t("minuteRead", {minutes: readMinutes})} quickVerdictLabel={t("quickVerdictBadge")} />

            <ComparisonPageNavigation title={challenge.title} labels={{compareAnother: t("compareAnother"), meetAnimals: t("meetAnimalsAction"), jumpStats: t("jumpStats"), share: t("share"), overview: t("navOverview"), winner: t("navWinner"), stats: t("navStats"), scenarios: t("navScenarios"), faq: t("navFaq"), related: t("navRelated")}} />

            <ChallengeVerdictCard title={t("quickVerdictTitle")} description={t("quickVerdictDescription")} summary={challenge.quickVerdict} paragraphs={challenge.shortAnswer} winner={winner ? {slug: winner.slug, name: winner.name} : undefined} winnerLabel={t("winnerBadge")} confidence={confidence} confidenceLabel={t("confidence")} fullAnalysisLabel={t("fullAnalysis")} />


            <ComparisonVotePanel
                slug={challenge.slug}
                animalAName={animalA.name}
                animalBName={animalB.name}
                animalAArtwork={buildSpeciesArtworkSrc(animalA.slug, artworkFiles.get(animalA.slug))}
                animalBArtwork={buildSpeciesArtworkSrc(animalB.slug, artworkFiles.get(animalB.slug))}
                initialTally={voteTally}
                initialVote={null}
                copy={{
                    eyebrow: t("vote.eyebrow"),
                    title: t("vote.title"),
                    description: t("vote.description"),
                    votedLabel: t("vote.voted"),
                    changeHint: t("vote.changeHint"),
                    totalVotes: t("vote.totalVotes", {count: "{count}"}),
                    noVotesYet: t("vote.noVotesYet"),
                    errorMessage: t("vote.error"),
                    rateLimitMessage: t("vote.rateLimited"),
                    votePrompt: t("vote.prompt")
                }}
            />

            <section className="grid gap-6 border-y border-line-300 py-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
                <div><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">{t("editorialNote")}</p><h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("whyDisagreeTitle")}</h2><p className="mt-4 text-base leading-7 text-ink-200">{challenge.whyThisMatchupIsInteresting[0]}</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {challenge.statCategories.slice(0, 3).map((item, index) => (
                        <article key={item.key} className="border-l-2 border-amber-300/60 bg-gradient-to-r from-amber-500/10 to-transparent p-5"><span className="text-xs font-black text-amber-300">0{index + 1}</span><h3 className="mt-2 text-lg font-bold text-white">{item.label}</h3><p className="mt-2 text-sm leading-6 text-ink-200">{item.takeaway}</p></article>
                    ))}
                </div>
                {challenge.whyThisMatchupIsInteresting.length > 1 ? <details className="lg:col-start-2"><summary className="cursor-pointer font-semibold text-primary-200">{t("fullAnalysis")} +</summary><div className="mt-4 space-y-3">{challenge.whyThisMatchupIsInteresting.slice(1).map((paragraph) => <p key={paragraph} className="text-base leading-7 text-ink-200">{paragraph}</p>)}</div></details> : null}
            </section>

            <section id="faq" className="scroll-mt-28 grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
                <div><h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("faqTitle")}</h2><p className="mt-3 text-ink-200">{t("faqDescription")}</p></div>
                <div className="divide-y divide-line-300 rounded-3xl border border-line-300 bg-surface-900/55 px-5 md:px-7">{challenge.faq.map((item) => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white marker:hidden">{item.question}<span className="text-primary-300 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-base leading-7 text-ink-200">{item.answer}</p></details>)}</div>
            </section>

            <ChallengeSpeciesStatsComparison title={t("speciesStatsTitle")} description={t("speciesStatsDescription")} animalAName={animalA.name} animalBName={animalB.name} animalAResult={animalAStatsResult} animalBResult={animalBStatsResult} animalABattleTier={animalABattleTier} animalBBattleTier={animalBBattleTier} labels={{advantage: t("advantageLabel"), even: t("winnerLabels.even"), battleTierChip: t("battleTierChip", {tier: "{tier}"}), dominance: t("dominanceStat"), speed: t("speedStat"), size: t("sizeStat"), intelligence: t("intelligenceStat"), rarity: t("rarityStat")}} />

            <AnimalVsStatTable title={t("statsTitle")} description={t("statsDescription")} animalAName={animalA.name} animalBName={animalB.name} items={challenge.statCategories} labels={{advantage: t("advantageLabel"), takeaway: t("takeawayLabel"), animalAAdvantage: animalA.name, animalBAdvantage: animalB.name, even: t("winnerLabels.even"), depends: t("winnerLabels.depends")}} />

            <section className="space-y-6 py-4">
                <div><p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{t("verdictTimelineEyebrow")}</p><h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("verdictTimelineTitle")}</h2></div>
                <div className="relative grid gap-3 md:grid-cols-3 xl:grid-cols-6">{challenge.statCategories.slice(0, 6).map((item, index) => { const name = item.advantage === "animalA" ? animalA.name : item.advantage === "animalB" ? animalB.name : item.advantage === "even" ? t("winnerLabels.even") : t("winnerLabels.depends"); return <article key={item.key} className="relative rounded-2xl border border-line-300 bg-surface-900/65 p-4"><span className={`mb-4 block h-2 w-2 rounded-full ${item.advantage === "animalA" ? "bg-emerald-400" : item.advantage === "animalB" ? "bg-sky-400" : "bg-amber-300"}`} /><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-300">0{index + 1} · {item.label}</p><p className="mt-2 font-bold text-white">{name}</p></article>; })}</div>
            </section>

            <ScenarioBreakdown title={t("scenarioTitle")} description={t("scenarioDescription")} items={challenge.scenarioBreakdown} labels={{winner: t("scenarioWinnerLabel"), animalA: animalA.name, animalB: animalB.name, draw: t("winnerLabels.draw"), depends: t("winnerLabels.depends"), confidence: t("confidence"), select: t("selectScenario")}} />

            <section id="meet-animals" className="scroll-mt-28 space-y-6">
                <div><p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{t("fieldProfiles")}</p><h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("exploreAnimalsTitle")}</h2></div>
                <div className="grid gap-5 md:grid-cols-2">{speciesCards.map(({species, stats, tier}) => (
                    <article key={species.slug} className="group overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900">
                        <div className="h-64 p-5 md:p-6">
                            <SpeciesArtworkImage
                                slug={species.slug}
                                alt={species.name}
                                fit="contain"
                                className="h-full w-full rounded-2xl transition duration-500 group-hover:scale-[1.02]"
                                sizes="(min-width: 768px) 50vw, 100vw"
                            />
                        </div>
                        <div className="space-y-5 p-6 md:p-7">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-display text-3xl font-bold text-white">{species.name}</h3>
                                    <p className="italic text-ink-300">{species.analysis.scientificName}</p>
                                </div>
                                {tier ? <span className="rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-bold text-primary-100">{t("battleTierChip", {tier})}</span> : null}
                            </div>
                            <p className="line-clamp-2 text-sm leading-6 text-ink-200">{species.analysis.habitat}</p>
                            <div className="grid grid-cols-3 gap-2 border-y border-line-300 py-4 text-center">
                                <div><span className="block text-xs text-ink-300">{t("animalCategory")}</span><strong className="text-sm text-white">{species.analysis.category}</strong></div>
                                <div><span className="block text-xs text-ink-300">{t("speedStat")}</span><strong className="text-lg text-white">{stats?.speed ?? "—"}</strong></div>
                                <div><span className="block text-xs text-ink-300">{t("sizeStat")}</span><strong className="text-lg text-white">{stats?.size ?? "—"}</strong></div>
                            </div>
                            {species.hasCatalogPage ? (
                                <Link href={`/animals/${species.slug}`} className="inline-flex whitespace-nowrap font-bold text-primary-200 hover:text-primary-100" underline>{t("readSpecies")}</Link>
                            ) : (
                                <p className="text-sm text-ink-300">Species guide coming soon.</p>
                            )}
                        </div>
                    </article>
                ))}</div>
            </section>

            <SystemsIntelligenceSection items={systemsItems} labels={{title: t("systemsIntelligenceTitle"), description: t("systemsIntelligenceDescription"), systemRole: t("systemRoleLabel"), specializedHardware: t("specializedHardwareLabel"), systemsScript: t("systemsScriptLabel"), strategicInsight: t("strategicInsightLabel"), readSpeciesGuide: t("readSpeciesGuide")}} />

            <ChallengeVerdictCard title={t("finalTakeTitle")} summary={challenge.finalTake[0]} paragraphs={challenge.finalTake.slice(1)} fullAnalysisLabel={t("fullAnalysis")} />

            <IntentCtaCard title={t(challenge.comparisonType === "battle" ? "ctaBattleTitle" : challenge.comparisonType === "speed" ? "ctaSpeedTitle" : "ctaDefaultTitle")} description={t(challenge.comparisonType === "battle" ? "ctaBattleDescription" : challenge.comparisonType === "speed" ? "ctaSpeedDescription" : "ctaDefaultDescription")} buttonLabel={t(challenge.comparisonType === "battle" ? "ctaBattleButton" : challenge.comparisonType === "speed" ? "ctaSpeedButton" : "ctaDefaultButton")} supportItems={[t("ctaSupportOne"), t("ctaSupportTwo"), t("ctaSupportThree")]} secondaryLinks={secondaryLinks} />


            <ComparisonComments
                slug={challenge.slug}
                signInHref={`/account?next=${encodeURIComponent(`/comparisons/${challenge.slug}#comments`)}`}
                isSignedIn={false}
                initialComments={comments}
                maxLength={COMMENT_MAX_LENGTH}
                copy={{
                    eyebrow: t("comments.eyebrow"),
                    title: t("comments.title"),
                    description: t("comments.description"),
                    placeholder: t("comments.placeholder"),
                    submit: t("comments.submit"),
                    submitting: t("comments.submitting"),
                    signedOutPrompt: t("comments.signedOutPrompt"),
                    signIn: t("comments.signIn"),
                    empty: t("comments.empty"),
                    delete: t("comments.delete"),
                    report: t("comments.report"),
                    reported: t("comments.reported"),
                    errorMessage: t("comments.error"),
                    rateLimitMessage: t("comments.rateLimited"),
                    tooShort: t("comments.tooShort"),
                    remaining: t("comments.remaining", {count: "{count}"}),
                    linksStrippedHint: t("comments.linksStripped")
                }}
            />

            <RelatedChallengesSection title={t("relatedTitle")} description={t("relatedDescription")} readChallengeLabel={t("readChallenge")} items={relatedChallenges} />
        </article>
    );
}
