import {Metadata} from "next";
import Image from "next/image";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalDexNumberBadge from "@/app/[locale]/(composited)/animals/animaldex-number-badge";
import IdentityKindChip from "@/app/[locale]/(composited)/animals/identity-kind-chip";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import NativeRangeMapCard from "@/app/[locale]/(composited)/animals/[slug]/native-range-map-card";
import SpeciesDetailTabs from "@/app/[locale]/(composited)/animals/[slug]/species-detail-tabs";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import SpeciesEncyclopediaNav from "@/app/[locale]/(composited)/animals/[slug]/species-encyclopedia-nav";
import SpeciesEncyclopediaAnalytics from "@/app/[locale]/(composited)/animals/[slug]/species-encyclopedia-analytics";
import SpeciesAtAGlanceCard from "@/app/[locale]/(composited)/animals/[slug]/species-at-a-glance";
import SpeciesUnderstandGuide, {type UnderstandGuideSection} from "@/app/[locale]/(composited)/animals/[slug]/species-understand-guide";
import SpeciesAnimalPowerGuide from "@/app/[locale]/(composited)/animals/[slug]/species-animal-power-guide";
import SpeciesAskAnimalDex from "@/app/[locale]/(composited)/animals/[slug]/species-ask-animaldex";
import SpeciesGrowthPanel from "@/app/[locale]/(composited)/animals/[slug]/species-growth-panel";
import SpeciesRankingCarousel from "@/app/[locale]/(composited)/animals/[slug]/species-ranking-carousel";
import RelatedSpeciesSection from "@/app/[locale]/(composited)/animals/[slug]/related-species-section";
import {type EnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import {getLocationsFeaturingSpecies} from "@/data/species-ask-grounding";
import {buildSpeciesAskSuggestions, SPECIES_ASK_DAILY_LIMITS, type SpeciesAskGrounding} from "@/lib/species-ask";
import {buildSpeciesAtAGlance, speciesHasSubstantiveFieldGuide} from "@/lib/species-field-guide";
import {INSTAGRAM_IMPORT_PATH} from "@/lib/instagram-import";
import {buildComparisonSlug} from "@/lib/comparison-slug";
import AnimalStoryCard from "@/components/animal-detail/animal-story-card";
import AnimalStatsPanel from "@/components/animal-detail/animal-stats-panel";
import CaptureMetadataBand from "@/components/animal-detail/capture-metadata-band";
import LegendaryEarthBeastBadge from "@/app/[locale]/(composited)/animals/legendary-earth-beast-badge";
import {getBlogPostsForSpecies} from "@/data/blog";
import {getChallengesForSpecies} from "@/data/challenges";
import {getRankingTierListTitle, getRankingsForSpecies} from "@/data/rankings";
import {getSpeciesDietContent} from "@/data/species-diet";
import {getSpeciesPageData} from "@/data/database-species-pages";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {
    getSpeciesImageAltText,
    getSpeciesImageRoute
} from "@/data/species-images";
import {getMiniSystemsBySpeciesSlug} from "@/data/species-mini-systems";
import {getSpeciesSpottingContent} from "@/data/species-spotting";
import {getBattleTier, resolveLocalSpeciesStats, type SpeciesStats} from "@/data/species-stats";
import {getRelatedSpecies, getSpeciesBySlug, rarityLabel, speciesEntries} from "@/data/species";
import type {SpeciesEntry} from "@/data/species";
import {resolveLocalSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {createEmptyPublicSpeciesGrowthContext} from "@/data/species-growth";
import {getSpeciesDescriptorBySlug} from "@/data/species-descriptors";
import {getSpeciesSubtitleStoryBySlug} from "@/data/species-subtitle-stories";
import {getLegendaryEarthBeastSubtitle} from "@/data/legendary-earth-beasts-species";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {shouldNoindexLifeStageAliasSlug} from "@/lib/species-life-stage-policy";
import {
    getLegendaryEarthBeast,
    getRelatedLegendaryEarthBeasts,
    LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH
} from "@/data/legendary-earth-beasts";
import {getLegendaryCatalogSeedByBeastSlug} from "@/data/legendary-earth-beasts-catalog-seed";
import {getLegendaryCaptureRequirementMessage} from "@/lib/legendary-earth-beast-capture";
import {getScopedTranslator} from "@/loaders/translation";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {isBreedSpeciesEntry, speciesDisplayCategory} from "@/lib/species-breed";

export const revalidate = 86400;
export const dynamicParams = true;

// Empty paths would keep this a request-dynamic λ route. One seed slug opts
// the segment into on-demand ISR; other animals generate on first anonymous GET.
export function generateStaticParams() {
    return [
        {locale: "en", slug: "tiger"},
        {locale: "id", slug: "tiger"}
    ];
}

type SpeciesPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

type SpeciesTextLink = {
    text: string;
    slug: string;
};

function toQualitySlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function pluralizeWord(word: string) {
    const lowerWord = word.toLowerCase();
    const irregularPlurals: Record<string, string> = {
        wolf: "wolves",
        jellyfish: "jellyfish",
        octopus: "octopuses"
    };

    if (irregularPlurals[lowerWord]) {
        return irregularPlurals[lowerWord];
    }

    if (lowerWord.endsWith("fe")) {
        return `${word.slice(0, -2)}ves`;
    }

    if (lowerWord.endsWith("f")) {
        return `${word.slice(0, -1)}ves`;
    }

    if (lowerWord.endsWith("y") && !/[aeiou]y$/.test(lowerWord)) {
        return `${word.slice(0, -1)}ies`;
    }

    if (/(s|x|z|ch|sh)$/i.test(word)) {
        return `${word}es`;
    }

    return `${word}s`;
}

function buildPluralPhrase(text: string) {
    const words = text.split(" ");

    if (words.length === 0) {
        return text;
    }

    const lastWord = words[words.length - 1];
    return [...words.slice(0, -1), pluralizeWord(lastWord)].join(" ");
}

function buildSpeciesTextLinks(entries: typeof speciesEntries, aliases: SpeciesTextLink[]) {
    const entryLinks = entries.flatMap((item) => {
        const baseText = item.name.toLowerCase();
        const pluralText = buildPluralPhrase(baseText);

        return pluralText === baseText
            ? [{text: baseText, slug: item.slug}]
            : [
                {text: baseText, slug: item.slug},
                {text: pluralText, slug: item.slug}
            ];
    });
    const aliasLinks = aliases.flatMap((item) => {
        const baseText = item.text.toLowerCase();
        const pluralText = buildPluralPhrase(baseText);

        return pluralText === baseText
            ? [{text: baseText, slug: item.slug}]
            : [
                {text: baseText, slug: item.slug},
                {text: pluralText, slug: item.slug}
            ];
    });

    return Array.from(
        new Map(
            [...entryLinks, ...aliasLinks].map((item) => [`${item.slug}:${item.text}`, item])
        ).values()
    );
}

const SPECIES_ALIAS_TEXT_LINKS: SpeciesTextLink[] = [
    {text: "Alligator", slug: "american-alligator"}
];

function captureStatsOrFallback(
    values: Record<string, number> | null | undefined,
    fallback: SpeciesStats | null
): SpeciesStats | null {
    const keys = ["dominance", "speed", "size", "intelligence", "rarity"] as const;
    const stats = Object.fromEntries(keys.map((key) => [key, Number(values?.[key] ?? fallback?.[key])])) as SpeciesStats;

    return keys.every((key) => Number.isFinite(stats[key])) ? stats : fallback;
}

const GLOBAL_SPECIES_TEXT_LINKS = buildSpeciesTextLinks(speciesEntries, SPECIES_ALIAS_TEXT_LINKS)
    .sort((left, right) => right.text.length - left.text.length);

function createSpeciesLinkMatcher(currentSlug: string) {
    const links = GLOBAL_SPECIES_TEXT_LINKS.filter((item) => item.slug !== currentSlug);
    if (links.length === 0) return null;

    const linkMap = new Map(links.map((item) => [item.text.toLowerCase(), item]));
    const pattern = links
        .map((item) => item.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    const matcher = new RegExp(`\\b(${pattern})\\b`, "gi");
    return {matcher, linkMap};
}

function renderTextWithSpeciesLinks(text: string, matcherState: ReturnType<typeof createSpeciesLinkMatcher>) {
    if (!matcherState) return text;
    const {matcher, linkMap} = matcherState;
    const parts: JSX.Element[] = [];
    const linkedSlugs = new Set<string>();
    let cursor = 0;

    for (const match of Array.from(text.matchAll(matcher))) {
        const matchText = match[0];
        const index = match.index;

        if (index === undefined) {
            continue;
        }

        const link = linkMap.get(matchText.toLowerCase());

        if (!link) {
            continue;
        }

        if (index > cursor) {
            parts.push(<span key={`text-${cursor}`}>{text.slice(cursor, index)}</span>);
        }

        if (linkedSlugs.has(link.slug)) {
            parts.push(<span key={`text-${index}`}>{matchText}</span>);
        } else {
            parts.push(
                <Link
                    key={`link-${link.slug}-${index}`}
                    href={`/animals/${link.slug}`}
                    className="text-primary-200 hover:text-primary-100 underline underline-offset-4"
                >
                    {matchText}
                </Link>
            );
            linkedSlugs.add(link.slug);
        }

        cursor = index + matchText.length;
    }

    if (cursor < text.length) {
        parts.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return parts;
}

function resolveSpeciesMentionSlug(text: string, currentSlug: string) {
    const normalized = text.trim().toLowerCase();

    for (const item of GLOBAL_SPECIES_TEXT_LINKS) {
        if (item.slug === currentSlug) {
            continue;
        }

        if (
            normalized === item.text
            || normalized.startsWith(`${item.text} `)
            || normalized.startsWith(`${item.text}(`)
            || normalized.startsWith(`${item.text},`)
        ) {
            return item.slug;
        }
    }

    return null;
}

function renderListItemWithSpeciesLink(text: string, currentSlug: string, matcherState: ReturnType<typeof createSpeciesLinkMatcher>) {
    const slug = resolveSpeciesMentionSlug(text, currentSlug);

    if (slug) {
        return (
            <Link
                href={`/animals/${slug}`}
                className="text-primary-200 hover:text-primary-100 underline underline-offset-4"
            >
                {text}
            </Link>
        );
    }

    return renderTextWithSpeciesLinks(text, matcherState);
}

export async function generateMetadata({params}: SpeciesPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = await getSpeciesPageData(slug);

    if (!entry) {
        return {};
    }

    const title = `${entry.name} Meaning, Symbolism, Lessons, Habitat & Facts`;
    const description = `${entry.name}: ${entry.analysis.summary} Explore biology-backed ${entry.name.toLowerCase()} meaning, symbolism, lessons, behavior, habitat, and related animals with AnimalDex.`;

    const metadata = buildContentMetadata({
        locale,
        pathname: `/animals/${entry.slug}`,
        title,
        description,
        keywords: [
            ...entry.searchIntents,
            entry.name,
            entry.analysis.scientificName,
            `${entry.name.toLowerCase()} meaning`,
            `${entry.name.toLowerCase()} symbolism`,
            `${entry.name.toLowerCase()} lesson`,
            `${entry.name.toLowerCase()} behavior meaning`,
            "animal meaning",
            "animal symbolism",
            "biology-backed animal meaning",
            "animal identification app",
            "wildlife app"
        ],
        featuredImage: {
            ...entry.featuredImage,
            src: getSpeciesImageRoute(entry.slug),
            alt: getSpeciesImageAltText(entry, "metadata")
        },
        publishedAt: entry.publishedAt,
        updatedAt: entry.updatedAt,
        tags: entry.searchIntents
    });

    const indexable = speciesHasSubstantiveFieldGuide({
        name: entry.name,
        summary: entry.analysis.summary,
        habitat: entry.analysis.habitat,
        nativeRange: entry.analysis.nativeRange,
        identification: entry.analysis.identification,
        behaviorTraits: entry.premiumDetails.behaviorTraits,
        interestingFacts: entry.premiumDetails.whyInteresting,
        diet: entry.databaseSource?.fieldGuide.dietSummary ?? null,
        predators: entry.databaseSource?.fieldGuide.predatorsSummary ?? null,
        sleepPattern: entry.databaseSource?.fieldGuide.sleepPattern ?? null,
        lifespan: entry.databaseSource?.fieldGuide.lifespanEstimate ?? null
    }) && !(entry.databaseSource && !entry.databaseSource.seoIndexable)
        && !shouldNoindexLifeStageAliasSlug(slug, entry.slug);

    return indexable ? metadata : {...metadata, robots: {index: false, follow: true}};
}

export default async function SpeciesPage({params}: SpeciesPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "animals");
    const rankingsT = await getScopedTranslator(locale, "rankings");
    const entry = await getSpeciesPageData(slug);

    if (!entry) {
        notFound();
    }

    if (entry.slug !== slug.trim().toLowerCase()) {
        redirect(getLocalePath(locale, `/animals/${entry.slug}`));
    }

    const legendaryBeast = getLegendaryEarthBeast(entry.slug);
    const legendaryCatalogSeed = legendaryBeast ? getLegendaryCatalogSeedByBeastSlug(legendaryBeast.slug) : null;
    const legendaryCaptureNote = legendaryBeast ? getLegendaryCaptureRequirementMessage(legendaryBeast.slug) : null;
    const relatedBlogPosts = getBlogPostsForSpecies(entry.slug, 3);
    const relatedChallenges = getChallengesForSpecies(entry.slug, 4);
    const featuredRankings = getRankingsForSpecies(entry.slug, 3);
    const principleProfile = resolveLocalSpeciesBehaviorProfile(entry.slug);
    const enhancedPower = null;
    const primaryQuality = principleProfile?.bestFor[0] ?? null;
    const primaryQualitySlug = primaryQuality ? toQualitySlug(primaryQuality) : null;
    const relatedSlugs = Array.from(new Set([
        ...(legendaryBeast
            ? getRelatedLegendaryEarthBeasts(entry.slug, 3).map((beast) => beast.slug)
            : getRelatedSpecies(entry.slug, 3).map((item) => item.slug)),
        ...(principleProfile?.relatedSpeciesSlugs ?? [])
    ])).filter((relatedSlug) => relatedSlug !== entry.slug).slice(0, 3);
    const related = relatedSlugs
        .map((relatedSlug) => getSpeciesBySlug(relatedSlug))
        .filter((item): item is SpeciesEntry => Boolean(item));
    const relatedPowerSpecies = related.slice(0, 3);
    const dietContent = getSpeciesDietContent(entry);
    const databaseFieldGuide = entry.databaseSource?.fieldGuide;
    const spottingContent = getSpeciesSpottingContent(entry);
    const subtitleStory = getLegendaryEarthBeastSubtitle(entry.slug)?.subtitleStory
        ?? getSpeciesSubtitleStoryBySlug(entry.slug)
        ?? getSpeciesDescriptorBySlug(entry.slug)
        ?? null;
    const miniSystemsSummary = getMiniSystemsBySpeciesSlug(entry.slug);
    const statsResult = resolveLocalSpeciesStats(entry);
    const growthContext = createEmptyPublicSpeciesGrowthContext();
    const resolvedRarityScore = statsResult.stats
        ? statsResult.stats.rarity
        : entry.analysis.rarityScore;
    const resolvedRarityLabel = rarityLabel(resolvedRarityScore);
    const battleTier = statsResult.stats
        ? getBattleTier(statsResult.stats)
        : null;
    const battleTierLabel = battleTier ? t("battleTierChip", {tier: battleTier}) : null;
    const featuredCaptureId = null;
    const featuredCaptureGrade = null;
    const featuredCaptureLocation = null;
    const featuredCaptureSetting = null;
    const featuredStorySetting = null;
    const featuredBaseStats = captureStatsOrFallback(undefined, statsResult.stats);
    const featuredEffectiveStats = featuredBaseStats;
    const featuredIsZooComparisonBanned = false;
    const featuredHasChallengeStats = false;
    const isBreed = isBreedSpeciesEntry(entry);
    const identityKind = entry.databaseSource?.identityKind ?? null;
    const displayCategory = speciesDisplayCategory(entry);
    const animalDexNumber = getAnimalDexNumberFromEntry(entry);
    const compareWithLinks = Array.from(
        new Map(
            relatedChallenges.map((challenge) => {
                const otherSlug = challenge.animalASlug === entry.slug ? challenge.animalBSlug : challenge.animalASlug;
                const otherSpecies = getSpeciesBySlug(otherSlug);

                if (!otherSpecies) {
                    return null;
                }

                return [otherSlug, {
                    challengeSlug: challenge.slug,
                    otherSlug,
                    otherName: otherSpecies.name
                }] as const;
            }).filter((item): item is readonly [string, {challengeSlug: string; otherSlug: string; otherName: string}] => Boolean(item))
        ).values()
    ).slice(0, 4);
    const ctaSupportItems = [
        t("ctaSupportOne"),
        t("ctaSupportTwo"),
        t("ctaSupportThree")
    ];
    const storyText = subtitleStory ?? ([entry.analysis.summary, miniSystemsSummary].filter(Boolean).join(" ") || null);
    const linkMatcher = createSpeciesLinkMatcher(entry.slug);
    const pageUrl = getAbsoluteUrl(locale, `/animals/${entry.slug}`);
    const faqItems = [
        {
            question: t("faqWhatSymbolize", {animal: entry.name.toLowerCase()}),
            answer: principleProfile
                ? `${entry.name} symbolizes ${principleProfile.principle.toLowerCase()} in AnimalDex because its repeatable behavior patterns show that strategy in nature.`
                : `${entry.name} symbolizes observable survival strategy in AnimalDex, grounded in behavior and ecology rather than mystical claims.`
        },
        {
            question: t("faqCoreLesson", {animal: entry.name.toLowerCase()}),
            answer: principleProfile
                ? principleProfile.coreLesson
                : `${entry.name} teaches practical lessons through habitat fit, behavioral timing, and adaptation under pressure.`
        },
        {
            question: t("faqBiologicalBasis", {animal: entry.name.toLowerCase()}),
            answer: principleProfile
                ? principleProfile.biologicalBasis
                : `${entry.analysis.summary} ${entry.analysis.habitat}`
        },
        {
            question: t("faqWhereFound", {animal: entry.name.toLowerCase()}),
            answer: `${entry.name} is found in ${entry.analysis.nativeRange}`
        }
    ];
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };
    const animalBreadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: getAbsoluteUrl(locale)
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Animals",
                item: getAbsoluteUrl(locale, "/animals")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: entry.name,
                item: pageUrl
            }
        ]
    };
    const thingSchema = {
        "@context": "https://schema.org",
        "@type": "Thing",
        name: entry.name,
        alternateName: entry.analysis.scientificName,
        description: entry.analysis.summary,
        category: entry.analysis.category,
        ...(principleProfile ? {
            additionalProperty: [
                {"@type": "PropertyValue", name: "principle", value: principleProfile.principle},
                {"@type": "PropertyValue", name: "coreLesson", value: principleProfile.coreLesson},
                {"@type": "PropertyValue", name: "biologicalBasis", value: principleProfile.biologicalBasis}
            ]
        } : {})
    };
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: entry.heroTitle,
        description: entry.analysis.summary,
        datePublished: entry.publishedAt,
        dateModified: entry.updatedAt,
        image: getAbsoluteUrl(locale, getSpeciesImageRoute(entry.slug)),
        author: {
            "@type": "Organization",
            name: "AnimalDex"
        },
        publisher: {
            "@type": "Organization",
            name: "AnimalDex"
        },
        mainEntityOfPage: pageUrl,
        about: [
            {
                "@type": "Thing",
                name: entry.name
            },
            {
                "@type": "Thing",
                name: entry.analysis.scientificName
            }
        ],
        ...(principleProfile ? {
            articleSection: ["Animal Principle", "Animal Symbolism & Meaning", "Field Guide"],
            keywords: [
                `${entry.name} meaning`,
                `${entry.name} symbolism`,
                `${entry.name} lesson`,
                `${entry.name} behavior meaning`
            ],
            additionalProperty: [
                {"@type": "PropertyValue", name: "principle", value: principleProfile.principle},
                {"@type": "PropertyValue", name: "coreLesson", value: principleProfile.coreLesson},
                {"@type": "PropertyValue", name: "biologicalBasis", value: principleProfile.biologicalBasis}
            ]
        } : {})
    };

    const habitatLead = entry.analysis.habitat.split(",")[0]?.trim() || entry.analysis.habitat;
    const powerProfile: EnhancedAnimalPowerProfile | null = enhancedPower ?? (principleProfile ? {
        speciesProfileId: entry.speciesProfileId ?? "",
        principleName: principleProfile.principle,
        principleExpression: principleProfile.principleExpression ?? null,
        coreLesson: principleProfile.coreLesson,
        shortMotto: principleProfile.motto,
        corePattern: null,
        biologicalBasis: principleProfile.biologicalBasis,
        applicationExample: principleProfile.applicationExample ?? null,
        behavioralEvidence: [],
        powerContinuum: null,
        embodimentPractices: [],
        reflectionQuestions: [],
        relatedPowers: [],
        availability: "legacy"
    } : null);
    const askGrounding: SpeciesAskGrounding = {
        slug: entry.slug,
        name: entry.name,
        scientificName: entry.analysis.scientificName,
        category: displayCategory,
        summary: entry.analysis.summary,
        identification: entry.analysis.identification,
        habitat: entry.analysis.habitat,
        nativeRange: entry.analysis.nativeRange,
        diet: databaseFieldGuide?.dietSummary ?? dietContent.summary,
        predators: databaseFieldGuide?.predatorsSummary ?? null,
        sleepPattern: databaseFieldGuide?.sleepPattern ?? null,
        lifespan: databaseFieldGuide?.lifespanEstimate ?? null,
        reproduction: databaseFieldGuide?.femaleOffspringNotes ?? null,
        sexDifference: databaseFieldGuide?.sexDifferenceNotes ?? null,
        interestingFacts: entry.premiumDetails.whyInteresting,
        behaviorTraits: entry.premiumDetails.behaviorTraits,
        spottingTips: spottingContent.tips,
        principleName: powerProfile?.principleName ?? null,
        principleExpression: powerProfile?.principleExpression ?? null,
        coreLesson: powerProfile?.coreLesson ?? null,
        corePattern: powerProfile?.corePattern ?? null,
        biologicalBasis: powerProfile?.biologicalBasis ?? null,
        shortMotto: powerProfile?.shortMotto ?? null,
        relatedSpecies: (compareWithLinks.length > 0
            ? compareWithLinks.map((item) => ({slug: item.otherSlug, name: item.otherName}))
            : related.slice(0, 4).map((item) => ({slug: item.slug, name: item.name}))
        ),
        relatedLocations: getLocationsFeaturingSpecies(entry.slug)
    };
    const askSuggestions = buildSpeciesAskSuggestions(askGrounding);
    const encyclopediaNav = [
        {id: "understand", label: t("understandNav")},
        ...(powerProfile ? [{id: "animal-power", label: t("animalPowerLabel")}] : []),
        {id: "ask", label: t("askNav")},
        {id: "compare", label: t("compareNav")},
        {id: "where", label: t("whereNav")}
    ];

    const understandSections: UnderstandGuideSection[] = [
        {
            id: "overview",
            navLabel: t("understandOverview"),
            title: t("fieldGuideIntroductionTitle", {animal: entry.name}),
            whyQuestion: `Why is ${entry.name} built this way?`,
            content: (
                <div className="flex flex-col gap-5">
                    <p>{renderTextWithSpeciesLinks(entry.analysis.summary, linkMatcher)}</p>
                    <div>
                        <h4 className="text-base font-semibold text-white">{t("identifyTitle", {animal: entry.name})}</h4>
                        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                            {entry.analysis.identification.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                            ))}
                        </ul>
                    </div>
                    {entry.premiumDetails.whyInteresting.length > 0 ? (
                        <div>
                            <h4 className="text-base font-semibold text-white">{t("interestingTitle", {animal: entry.name})}</h4>
                            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                                {entry.premiumDetails.whyInteresting.map((item) => (
                                    <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            )
        },
        {
            id: "abilities",
            navLabel: t("understandAbilities"),
            title: t("understandAbilitiesTitle", {animal: entry.name}),
            whyQuestion: `What biological abilities make ${entry.name} successful?`,
            content: (
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    {entry.analysis.identification.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                    ))}
                </ul>
            )
        },
        {
            id: "behavior",
            navLabel: t("understandBehavior"),
            title: t("fieldGuideBehaviorTitle", {animal: entry.name}),
            whyQuestion: `Why does ${entry.name} behave this way?`,
            content: (
                <div className="flex flex-col gap-4">
                    <ul className="flex list-disc flex-col gap-2 pl-5">
                        {entry.premiumDetails.behaviorTraits.map((item) => (
                            <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                        ))}
                    </ul>
                    {databaseFieldGuide?.sleepPattern ? (
                        <p>{renderTextWithSpeciesLinks(databaseFieldGuide.sleepPattern, linkMatcher)}</p>
                    ) : null}
                </div>
            )
        },
        {
            id: "habitat",
            navLabel: t("understandHabitat"),
            title: t("fieldGuideEnvironmentTitle", {habitat: habitatLead}),
            whyQuestion: `Why do ${entry.name} live in ${habitatLead}?`,
            content: (
                <div className="flex flex-col gap-5">
                    <p>
                        <span className="text-white">{t("habitatLabel")}: </span>
                        {renderTextWithSpeciesLinks(entry.analysis.habitat, linkMatcher)}
                    </p>
                    <p>
                        <span className="text-white">{t("nativeRangeLabel")}: </span>
                        {renderTextWithSpeciesLinks(entry.analysis.nativeRange, linkMatcher)}
                    </p>
                    <NativeRangeMapCard
                        entry={entry}
                        labels={{
                            title: t("nativeRangeCardTitle"),
                            description: t("nativeRangeCardDescription"),
                            missingAssets: t("nativeRangeMissingAssets")
                        }}
                    />
                </div>
            )
        },
        {
            id: "diet",
            navLabel: t("understandDiet"),
            title: t("fieldGuideDietTitle"),
            whyQuestion: `Why do ${entry.name} eat this way?`,
            content: (
                <div className="flex flex-col gap-4">
                    <p>{renderTextWithSpeciesLinks(databaseFieldGuide?.dietSummary ?? dietContent.summary, linkMatcher)}</p>
                    {!databaseFieldGuide?.dietSummary ? (
                        <>
                            <ul className="flex list-disc flex-col gap-2 pl-5">
                                {dietContent.foods.map((item) => (
                                    <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                                ))}
                            </ul>
                            <p className="text-ink-300">{renderTextWithSpeciesLinks(dietContent.note, linkMatcher)}</p>
                        </>
                    ) : null}
                </div>
            )
        },
        ...((databaseFieldGuide?.lifespanEstimate || databaseFieldGuide?.sleepPattern) ? [{
            id: "life-cycle",
            navLabel: t("understandLifeCycle"),
            title: t("understandLifeCycleTitle"),
            whyQuestion: `Why does ${entry.name} live this life cycle?`,
            content: (
                <div className="flex flex-col gap-4">
                    {databaseFieldGuide?.sleepPattern ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.sleepPattern, linkMatcher)}</p> : null}
                    {databaseFieldGuide?.lifespanEstimate ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.lifespanEstimate, linkMatcher)}</p> : null}
                </div>
            )
        } satisfies UnderstandGuideSection] : []),
        ...((databaseFieldGuide?.femaleOffspringNotes || databaseFieldGuide?.sexDifferenceNotes) ? [{
            id: "reproduction",
            navLabel: t("understandReproduction"),
            title: t("understandReproductionTitle", {animal: entry.name}),
            whyQuestion: `Why does ${entry.name} reproduce this way?`,
            content: (
                <div className="flex flex-col gap-4">
                    {databaseFieldGuide?.femaleOffspringNotes ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.femaleOffspringNotes, linkMatcher)}</p> : null}
                    {databaseFieldGuide?.sexDifferenceNotes ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.sexDifferenceNotes, linkMatcher)}</p> : null}
                </div>
            )
        } satisfies UnderstandGuideSection] : []),
        ...(databaseFieldGuide?.predatorsSummary ? [{
            id: "predators",
            navLabel: t("understandPredators"),
            title: t("understandPredatorsTitle"),
            whyQuestion: `Why do these predators and threats matter for ${entry.name}?`,
            content: <p>{renderTextWithSpeciesLinks(databaseFieldGuide.predatorsSummary, linkMatcher)}</p>
        } satisfies UnderstandGuideSection] : []),
        ...(entry.premiumDetails.lookalikes.length > 0 ? [{
            id: "lookalikes",
            navLabel: t("understandLookalikes"),
            title: t("fieldGuideLookalikesTitle"),
            whyQuestion: `Why do these lookalikes matter for identifying ${entry.name}?`,
            content: (
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    {entry.premiumDetails.lookalikes.map((item) => (
                        <li key={item}>{renderListItemWithSpeciesLink(item, entry.slug, linkMatcher)}</li>
                    ))}
                </ul>
            )
        } satisfies UnderstandGuideSection] : []),
        {
            id: "conservation",
            navLabel: t("understandConservation"),
            title: t("understandConservationTitle"),
            whyQuestion: `What conservation pressure shapes ${entry.name}?`,
            content: (
                <div className="flex flex-col gap-4">
                    <p>
                        <span className="text-white">{t("rarityLabel")}: </span>
                        {resolvedRarityLabel} · {resolvedRarityScore}/100. {renderTextWithSpeciesLinks(entry.analysis.rarityReason, linkMatcher)}
                    </p>
                    <ul className="flex list-disc flex-col gap-2 pl-5">
                        {entry.premiumDetails.respectfulSpotting.map((item) => (
                            <li key={item}>{renderTextWithSpeciesLinks(item, linkMatcher)}</li>
                        ))}
                    </ul>
                </div>
            )
        }
    ];

    return (
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-16 px-4 py-6 md:gap-24 md:px-8 md:py-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([
                    thingSchema,
                    articleSchema,
                    faqSchema,
                    animalBreadcrumbSchema
                ])}}
            />

            <div className="flex flex-col gap-4 md:gap-5">
                <Link
                    href="/animals"
                    className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100"
                >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7.5 10H16" strokeLinecap="round" />
                    </svg>
                    {t("back")}
                </Link>

                <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[radial-gradient(circle_at_15%_10%,rgba(180,139,72,0.16),transparent_34%),linear-gradient(135deg,rgba(26,34,28,0.96),rgba(12,17,14,0.98))] p-5 md:p-10 lg:p-12">
                <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div className="order-2 flex flex-col items-start gap-6 lg:order-1">
                        <div className="flex flex-wrap gap-2">
                            {animalDexNumber ? <AnimalDexNumberBadge number={animalDexNumber} /> : null}
                            {legendaryBeast ? <LegendaryEarthBeastBadge compact /> : null}
                            <IdentityKindChip identityKind={identityKind} animalName={entry.name} />
                            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                                {resolvedRarityLabel}
                            </span>
                            {isBreed && identityKind?.toLowerCase() !== "breed" && identityKind?.toLowerCase() !== "variant" ? (
                                <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-sm font-semibold text-violet-100">
                                    {t("breedLabel")}
                                </span>
                            ) : null}
                            <span className="rounded-full border border-primary-400/20 bg-primary-400/[0.08] px-3 py-1.5 text-sm font-semibold text-primary-100">
                                {displayCategory}
                            </span>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1.5 text-sm font-semibold text-cyan-100">
                                {habitatLead}
                            </span>
                            {battleTierLabel ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-ink-100">
                                    {battleTierLabel}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex max-w-3xl flex-col gap-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">{t("fieldGuideLabel")}</p>
                            <h1 className="font-display text-5xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl">{entry.name}</h1>
                            <p className="text-lg italic text-ink-300 md:text-xl">{entry.analysis.scientificName}</p>
                            <p className="max-w-2xl text-lg leading-8 text-ink-200 md:text-xl">{entry.analysis.summary}</p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <Link href="/#download" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 transition-colors hover:bg-primary-300">
                                {t("collectCta", {animal: entry.name})}
                            </Link>
                            <Link href="/animals" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl border border-white/15 px-7 font-bold text-white transition-colors hover:border-primary-400 hover:text-primary-100">
                                {t("browseAnimals")}
                            </Link>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2">
                            <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_50%_35%,rgba(180,139,72,0.18),transparent_34%),rgba(5,10,7,0.72)] p-8 text-center shadow-2xl shadow-black/30">
                                <div className="relative mb-6 h-28 w-28 overflow-hidden rounded-[1.5rem] border border-amber-200/20 bg-amber-200/[0.06] p-3">
                                    <Image
                                        src={getSpeciesArtworkRoute(entry.slug)}
                                        alt={getSpeciesImageAltText(entry, "thumbnail")}
                                        fill
                                        unoptimized
                                        sizes="112px"
                                        className="object-contain p-2 brightness-0 invert opacity-80"
                                    />
                                </div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">{t("animalDexCardLabel")}</p>
                                <h2 className="mt-3 font-display text-3xl font-bold text-white">{t("unlockCardTitle")}</h2>
                                <p className="mt-3 max-w-sm text-base leading-7 text-ink-200">{t("unlockCardDescription")}</p>
                                <Link href="/#download" className="mt-7 rounded-2xl border border-primary-400/35 px-5 py-3 font-semibold text-primary-100 hover:border-primary-300 hover:text-white">
                                    {t("getAnimalDex")}
                                </Link>
                            </div>
                    </div>
                </div>
            </section>
            </div>

            <SpeciesEncyclopediaAnalytics slug={entry.slug} />

            <SpeciesAtAGlanceCard
                animalName={entry.name}
                glance={buildSpeciesAtAGlance({
                    category: displayCategory,
                    habitat: habitatLead,
                    nativeRange: entry.analysis.nativeRange,
                    rarityLabel: resolvedRarityLabel,
                    identification: entry.analysis.identification,
                    behaviorTraits: entry.premiumDetails.behaviorTraits,
                    principleName: powerProfile?.principleName ?? null
                })}
                labels={{
                    title: t("glanceTitle"),
                    knownFor: t("glanceKnownFor"),
                    power: t("glancePower")
                }}
            />

            {legendaryBeast ? (
                <section className="rounded-[1.75rem] border border-amber-400/25 bg-amber-400/[0.06] p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Legendary Earth Beast · Tier {legendaryBeast.tier}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white">
                        {legendaryCatalogSeed?.captureSite ?? legendaryBeast.captureSite}
                    </h2>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">
                        {legendaryBeast.lesson}
                    </p>
                    {legendaryCaptureNote ? (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/90">{legendaryCaptureNote}</p>
                    ) : null}
                    <Link
                        href={`${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${legendaryBeast.slug}`}
                        className="mt-5 inline-flex rounded-2xl border border-amber-300/35 px-5 py-3 text-sm font-bold text-amber-100 transition hover:border-amber-200 hover:text-white"
                    >
                        Read the {legendaryBeast.legendaryFormName} travel guide
                    </Link>
                </section>
            ) : null}

            <SpeciesEncyclopediaNav items={encyclopediaNav} />

            <SpeciesUnderstandGuide
                animalName={t("understandTitle", {animal: entry.name})}
                slug={entry.slug}
                eyebrow={t("understandEyebrow")}
                description={t("understandDescription")}
                whyLabel={t("askWhy")}
                sections={understandSections}
            />

            {powerProfile ? (
                <SpeciesAnimalPowerGuide
                    animalName={entry.name}
                    profile={powerProfile}
                    artwork={(
                        <div className="relative h-44 w-44 overflow-hidden rounded-[1.5rem] border border-primary-400/20 bg-primary-400/[0.06] p-4">
                            <SpeciesArtworkImage
                                slug={entry.slug}
                                alt={getSpeciesImageAltText(entry, "thumbnail")}
                                className="h-full w-full !bg-transparent object-contain"
                                sizes="176px"
                                fit="contain"
                            />
                        </div>
                    )}
                    labels={{
                        eyebrow: t("animalPowerLabel"),
                        pattern: t("powerPattern"),
                        natureProof: t("natureProofLabel"),
                        observation: t("powerObservation"),
                        function: t("powerFunction"),
                        interpretation: t("powerInterpretation"),
                        continuum: t("powerContinuum"),
                        deficient: t("powerDeficient"),
                        balanced: t("powerBalanced"),
                        excess: t("powerExcess"),
                        practise: t("tryItLabel"),
                        reflection: t("powerReflection"),
                        legacyBasis: t("biologicalBasisLabel"),
                        legacyPractice: t("applicationExampleLabel")
                    }}
                />
            ) : null}

            <SpeciesAskAnimalDex
                slug={entry.slug}
                animalName={entry.name}
                suggestions={askSuggestions}
                labels={{
                    eyebrow: t("askEyebrow"),
                    title: t("askTitle"),
                    description: t("askDescription"),
                    placeholder: t("askPlaceholder"),
                    submit: t("askSubmit"),
                    thinking: t("askThinking"),
                    quota: t("askQuota", {
                        anonymous: String(SPECIES_ASK_DAILY_LIMITS.anonymous),
                        signedIn: String(SPECIES_ASK_DAILY_LIMITS.signedIn),
                        pro: String(SPECIES_ASK_DAILY_LIMITS.pro)
                    }),
                    remaining: t("askRemaining"),
                    followups: t("askFollowups"),
                    noscript: t("askNoscript"),
                    limitReached: t("askLimitReached"),
                    collectCta: t("askCollectCta"),
                    collectHref: "/#download",
                    error: t("askError"),
                    layers: {
                        biology: {title: t("askLayerBiology"), caption: t("askLayerBiologyCaption")},
                        why: {title: t("askLayerWhy"), caption: t("askLayerWhyCaption")},
                        lesson: {title: t("askLayerLesson"), caption: t("askLayerLessonCaption")},
                        symbolism: {title: t("askLayerSymbolism"), caption: t("askLayerSymbolismCaption")}
                    }
                }}
            />

            <section id="compare" className="scroll-mt-28 flex flex-col gap-5">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">{t("compareEyebrow")}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                        {t("compareTitle", {animal: entry.name})}
                    </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(compareWithLinks.length > 0 ? compareWithLinks : related.slice(0, 3).map((item) => ({
                        challengeSlug: buildComparisonSlug(entry.slug, item.slug),
                        otherName: item.name
                    }))).map((item) => (
                        <Link
                            key={item.challengeSlug}
                            href={`/comparisons/${item.challengeSlug}`}
                            className="rounded-[1.5rem] border border-white/10 bg-surface-900/55 p-5 transition hover:-translate-y-0.5 hover:border-primary-300/40"
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">VS</p>
                            <h3 className="mt-2 font-display text-2xl font-bold text-white">{item.otherName}</h3>
                            <p className="mt-2 text-sm text-ink-300">{t("compareWithLink", {animal: item.otherName})}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <section id="where" className="scroll-mt-28 rounded-[1.75rem] border border-white/10 bg-surface-900/55 p-5 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{t("whereEyebrow")}</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                    {t("whereTitle", {animal: entry.name})}
                </h2>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">
                    {renderTextWithSpeciesLinks(spottingContent.summary, linkMatcher)}
                </p>
                {askGrounding.relatedLocations.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                        {askGrounding.relatedLocations.map((location) => (
                            <Link
                                key={location.slug}
                                href={`/locations/${location.slug}`}
                                className="rounded-full border border-cyan-300/25 bg-cyan-400/[0.08] px-4 py-2 text-sm font-semibold text-cyan-100 hover:border-cyan-200 hover:text-white"
                            >
                                {location.name}
                            </Link>
                        ))}
                    </div>
                ) : null}
                <ul className="mt-5 flex list-disc flex-col gap-2 pl-5 text-lg leading-8 text-ink-200">
                    {spottingContent.locations.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item.charAt(0).toUpperCase() + item.slice(1), linkMatcher)}</li>
                    ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                        href="/wildlife-experiences"
                        className="rounded-2xl border border-primary-400/30 px-5 py-3 text-sm font-bold text-primary-100 hover:border-primary-200 hover:text-white"
                    >
                        {t("whereExperiencesCta")}
                    </Link>
                    <Link
                        href={INSTAGRAM_IMPORT_PATH}
                        className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:border-primary-300"
                    >
                        {t("whereInstagramCta")}
                    </Link>
                </div>
            </section>

            <SpeciesDetailTabs
                defaultTab="learn"
                eyebrow={t("fieldGuideLabel")}
                title={entry.name}
                labels={{
                    story: t("tabStory"),
                    progress: t("tabProgress"),
                    growth: t("tabGrowth")
                }}
                learn={(
                    <div
                        id="meaning"
                        className="flex scroll-mt-40 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start lg:gap-6"
                    >
                        <div className="flex min-w-0 flex-col gap-5">
                            <div className="-mx-5 lg:mx-0">
                                <AnimalStoryCard
                                    layout="wide"
                                    contentKey={statsResult.species_profile_id ?? entry.normalizedIdentityKey ?? entry.slug}
                                    story={storyText}
                                    settingTag={featuredStorySetting}
                                    principle={principleProfile ? {
                                        name: principleProfile.principle,
                                        motto: principleProfile.motto,
                                        expression: principleProfile.principleExpression,
                                        coreLesson: principleProfile.coreLesson,
                                        biologicalBasis: principleProfile.biologicalBasis,
                                        applicationExample: principleProfile.applicationExample,
                                        bestUseCases: principleProfile.bestFor
                                    } : null}
                                />
                            </div>

                            <SpeciesRankingCarousel
                                layout="wide"
                                speciesSlug={entry.slug}
                                speciesName={entry.name}
                                items={[]}
                                currentCaptureId={featuredCaptureId}
                                currentCaptureGrade={featuredCaptureGrade}
                                labels={{
                                    title: t("rankingsTitle", {animal: entry.name}),
                                    description: t("rankingsDescription"),
                                    empty: t("rankingsEmpty"),
                                    rankLabel: t("rankingsRankLabel"),
                                    scoreLabel: t("rankingsScoreLabel"),
                                    byPhotographer: t("rankingsByPhotographer")
                                }}
                            />
                        </div>

                        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
                            {featuredCaptureId ? (
                                <CaptureMetadataBand
                                    layout="wide"
                                    captureId={featuredCaptureId}
                                    capturedAt={undefined}
                                    locationLabel={featuredCaptureLocation}
                                    locationHref={null}
                                    saved={growthContext.progress?.isOwnedByCurrentUser === true}
                                />
                            ) : null}

                            <div className="-mx-5 lg:mx-0">
                                <NativeRangeMapCard
                                    entry={entry}
                                    variant="animal-card"
                                    layout="wide"
                                    settingTag={undefined}
                                    humanContext={undefined}
                                    labels={{
                                        title: t("nativeRangeCardTitle"),
                                        description: t("nativeRangeCardDescription"),
                                        missingAssets: t("nativeRangeMissingAssets")
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
                stats={(
                    featuredBaseStats && featuredEffectiveStats ? (
                        <AnimalStatsPanel
                            layout="wide"
                            speciesName={entry.name}
                            speciesSlug={entry.slug}
                            baseStats={featuredBaseStats}
                            effectiveStats={featuredEffectiveStats}
                            totalProgressionXP={growthContext.progress?.totalProgressionXP}
                            recentProgressionSource={undefined}
                            captureGrade={featuredCaptureGrade}
                            settingTag={featuredCaptureSetting}
                            conservationTier={undefined}
                        />
                    ) : null
                )}
                compare={(
                    <SpeciesGrowthPanel
                        layout="wide"
                        speciesSlug={entry.slug}
                        speciesName={entry.name}
                        lessonSlug={principleProfile?.hasLessonPage ? entry.slug : null}
                        qualitySlug={primaryQualitySlug}
                        qualityName={primaryQuality}
                        growth={growthContext}
                        compareOnly
                        comparisonTier={null}
                        settingTag={featuredCaptureSetting}
                        isZooComparisonBanned={featuredIsZooComparisonBanned}
                        isChallengeAnalysisEligible={false}
                        hasChallengeGameStats={featuredHasChallengeStats}
                        labels={{
                            apexPathEyebrow: t("growthApexPathEyebrow"),
                            apexInsightTitle: t("growthApexInsightTitle"),
                            apexInsightDescription: t("growthApexInsightDescription"),
                            useThisPower: t("growthUseThisPower"),
                            acceptChallenge: t("growthAcceptChallenge"),
                            challengeInProgress: t("growthChallengeInProgress"),
                            challengeCompleted: t("growthChallengeCompleted"),
                            challengeProofApp: t("growthChallengeProofApp"),
                            challengeWaiting: t("growthChallengeWaiting"),
                            wildProfileCta: t("growthWildProfileCta"),
                            refreshWildProfileCta: t("growthRefreshWildProfileCta"),
                            powerFusionTitle: t("growthPowerFusionTitle"),
                            powerFusionDescription: t("growthPowerFusionDescription"),
                            fusePowers: t("growthFusePowers"),
                            fusionCostLabel: t("growthFusionCostLabel"),
                            fusionLearnedCount: t("growthFusionLearnedCount"),
                            fusionNoDonors: t("growthFusionNoDonors"),
                            fusionSelectDonor: t("growthFusionSelectDonor"),
                            fusionSearchPlaceholder: t("growthFusionSearchPlaceholder"),
                            fusionSubmit: t("growthFusionSubmit"),
                            fusionSuccess: t("growthFusionSuccess"),
                            bestFor: t("growthBestFor"),
                            collectedAnimalsTitle: t("growthYourCapturesTitle", {animal: entry.name}),
                            signInPrompt: t("growthSignInPrompt"),
                            signInButton: t("growthSignInButton"),
                            emptyCapturesTitle: t("growthEmptyCapturesTitle"),
                            emptyCapturesDescription: t("growthEmptyCapturesDescription"),
                            scoreLabel: t("growthScoreLabel"),
                            openLesson: t("growthOpenLesson", {animal: entry.name}),
                            openPower: t("growthOpenPower", {power: "{power}"})
                        }}
                    />
                )}
            />

            <section aria-label={t("quickFactsTitle")} className="grid grid-cols-2 overflow-hidden rounded-3xl bg-surface-900/55 md:grid-cols-5">
                {[
                    [t("scientificName"), entry.analysis.scientificName],
                    [t("category"), displayCategory],
                    [t("habitatLabel"), entry.analysis.habitat],
                    [t("rarityLabel"), `${resolvedRarityLabel} · ${resolvedRarityScore}/100`],
                    [t("nativeRangeLabel"), entry.analysis.nativeRange]
                ].map(([label, value], index) => (
                    <div key={label} className={`min-w-0 px-5 py-5 md:px-6 ${index > 0 ? "border-l border-white/[0.07]" : ""} ${index > 1 ? "border-t border-white/[0.07] md:border-t-0" : ""}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{label}</p>
                        <p className="mt-2 line-clamp-2 text-base font-medium text-white">{value}</p>
                    </div>
                ))}
            </section>

            <RelatedSpeciesSection
                title={t("relatedTitle")}
                openLabel={t("readSpecies")}
                items={related}
            />

            {primaryQuality && relatedPowerSpecies.length > 0 ? (
                <RelatedSpeciesSection
                    title={t("moreWithPrincipleTitle", {principle: primaryQuality})}
                    hubHref={`/powers/${primaryQualitySlug}`}
                    hubLabel={t("moreWithPrincipleHubLink", {principle: primaryQuality})}
                    openLabel={t("readSpecies")}
                    items={relatedPowerSpecies}
                />
            ) : null}

            <IntentCtaCard
                title={t("ctaTitle")}
                description={t("ctaDescription")}
                buttonLabel={t("ctaButton")}
                supportItems={ctaSupportItems}
            />

            {relatedBlogPosts.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedBlogTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("relatedBlogDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedBlogPosts.map((post) => (
                            <article
                                key={post.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{post.title}</h3>
                                <p className="text-ink-200 text-base">{post.description}</p>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readBlog")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {relatedChallenges.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedChallengesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("relatedChallengesDescription")}</p>
                    {compareWithLinks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-white text-sm md:text-base font-semibold uppercase tracking-[0.22em]">
                                {t("compareWithTitle")}
                            </span>
                            {compareWithLinks.map((item) => (
                                <Link
                                    key={item.challengeSlug}
                                    href={`/comparisons/${item.challengeSlug}`}
                                    className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100 text-sm md:text-base"
                                >
                                    {t("compareWithLink", {animal: item.otherName})}
                                </Link>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedChallenges.map((challenge) => (
                            <article
                                key={challenge.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">
                                    <Link
                                        href={`/comparisons/${challenge.slug}`}
                                        className="hover:text-primary-100 transition-colors"
                                    >
                                        {challenge.title}
                                    </Link>
                                </h3>
                                <p className="text-ink-200 text-base">{challenge.quickVerdict}</p>
                                <Link
                                    href={`/comparisons/${challenge.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readChallenge")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {featuredRankings.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("featuredRankingsTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("featuredRankingsDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {featuredRankings.map((ranking) => {
                            const rankingEntry = ranking.entries.find((item) => item.speciesSlug === entry.slug);

                            if (!rankingEntry) {
                                return null;
                            }

                            return (
                                <article
                                    key={ranking.slug}
                                    className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                                >
                                    <p className="text-primary-200 text-sm md:text-base font-semibold uppercase tracking-[0.18em]">
                                        #{rankingEntry.rank} · {rankingsT(`categories.${ranking.category}`)}
                                    </p>
                                    <h3 className="font-display font-bold text-2xl text-white">
                                        <Link
                                            href={`/tier-list/${ranking.slug}`}
                                            className="hover:text-primary-100 transition-colors"
                                        >
                                            {getRankingTierListTitle(ranking)}
                                        </Link>
                                    </h3>
                                    <p className="text-ink-200 text-base">{rankingEntry.shortReason}</p>
                                    <Link
                                        href={`/tier-list/${ranking.slug}`}
                                        className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                        underline
                                    >
                                        {rankingsT("readRanking")}
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

        </article>
    );
}
