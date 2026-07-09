import {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AnimalDexNumberBadge from "@/app/[locale]/(composited)/animals/animaldex-number-badge";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import NativeRangeMapCard from "@/app/[locale]/(composited)/animals/[slug]/native-range-map-card";
import FeaturedSpeciesImageCarousel from "@/app/[locale]/(composited)/animals/[slug]/featured-species-image-carousel";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import SpeciesLessonValueSection from "@/app/[locale]/(composited)/animals/[slug]/species-lesson-value-section";
import {SpeciesEndorsementAndSize, SpeciesLevelProgress} from "@/app/[locale]/(composited)/animals/[slug]/species-progress-interactive";
import SpeciesStatsSection from "@/app/[locale]/(composited)/animals/[slug]/species-stats-section";
import SpeciesDetailTabs from "@/app/[locale]/(composited)/animals/[slug]/species-detail-tabs";
import SpeciesFieldGuideAccordion from "@/app/[locale]/(composited)/animals/[slug]/species-field-guide-accordion";
import SpeciesGrowthPanel from "@/app/[locale]/(composited)/animals/[slug]/species-growth-panel";
import SpeciesRankingCarousel from "@/app/[locale]/(composited)/animals/[slug]/species-ranking-carousel";
import SpeciesLifeStagesSection from "@/app/[locale]/(composited)/animals/[slug]/species-life-stages-section";
import SubtitleSpeaker from "@/app/[locale]/(composited)/animals/[slug]/subtitle-speaker";
import LegendaryEarthBeastBadge from "@/app/[locale]/(composited)/animals/legendary-earth-beast-badge";
import {getBlogPostsForSpecies} from "@/data/blog";
import {getChallengesForSpecies} from "@/data/challenges";
import {getRankingTierListTitle, getRankingsForSpecies} from "@/data/rankings";
import {getSpeciesDietContent} from "@/data/species-diet";
import {getResolvedSpeciesBySlug, getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {
    getSpeciesImageAltText,
    getSpeciesImageAttribution,
    getSpeciesImageRoute,
    getSpeciesImageReferences,
    getSpeciesRepresentativeImageReference
} from "@/data/species-images";
import {getMiniSystemsBySpeciesSlug} from "@/data/species-mini-systems";
import {getSpeciesSpottingContent} from "@/data/species-spotting";
import {resolveSpeciesLessonValue} from "@/data/species-lesson-value";
import {getBattleTier, resolveSpeciesStats} from "@/data/species-stats";
import {getRelatedSpecies, getSpeciesBySlug, rarityLabel, speciesEntries} from "@/data/species";
import type {SpeciesEntry} from "@/data/species";
import {getPrincipleHubBySlug, resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {getSpeciesRankings} from "@/data/species-rankings";
import {getSpeciesGrowthContext} from "@/data/species-growth";
import {getSpeciesSubtitle} from "@/data/species-subtitles";
import {getSystemsIntelligenceBySpeciesSlug} from "@/data/species-systems-intelligence";
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

export const revalidate = 3600;

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

const RELATED_NAME_STOP_WORDS = new Set(["animal", "common", "domestic", "eastern", "greater", "lesser", "northern", "southern", "western"]);

function getRelatedNameTokens(entry: SpeciesEntry) {
    return new Set(
        entry.name.toLowerCase().split(/[^a-z0-9]+/)
            .filter((token) => token.length >= 4 && !RELATED_NAME_STOP_WORDS.has(token))
    );
}

function getScientificGenus(entry: SpeciesEntry) {
    const scientificName = entry.analysis.scientificName.trim();

    if (!scientificName || scientificName.toLowerCase().includes("under review")) {
        return null;
    }

    return scientificName.split(/\s+/)[0]?.toLowerCase() ?? null;
}

function getAutomaticRelatedSpecies(entry: SpeciesEntry, entries: SpeciesEntry[], limit = 3) {
    const currentTokens = getRelatedNameTokens(entry);
    const currentGenus = getScientificGenus(entry);

    return entries
        .filter((candidate) => candidate.slug !== entry.slug)
        .map((candidate) => {
            const candidateTokens = getRelatedNameTokens(candidate);
            const sharedNameTokens = Array.from(currentTokens).filter((token) => candidateTokens.has(token)).length;
            const candidateGenus = getScientificGenus(candidate);
            const sameGenus = Boolean(currentGenus && candidateGenus === currentGenus);
            const sameSpecificCategory = entry.analysis.category !== "Animal" && candidate.analysis.category === entry.analysis.category;
            const score = (sameGenus ? 100 : 0) + sharedNameTokens * 20 + (sameSpecificCategory ? 5 : 0);

            return {candidate, score};
        })
        .filter(({score}) => score > 0)
        .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
        .slice(0, limit)
        .map(({candidate}) => candidate);
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

const GLOBAL_SPECIES_TEXT_LINKS = buildSpeciesTextLinks(speciesEntries, SPECIES_ALIAS_TEXT_LINKS)
    .sort((left, right) => right.text.length - left.text.length);

function renderTextWithSpeciesLinks(text: string, currentSlug: string) {
    const links = GLOBAL_SPECIES_TEXT_LINKS.filter((item) => item.slug !== currentSlug);

    if (links.length === 0) {
        return text;
    }

    const linkMap = new Map(links.map((item) => [item.text.toLowerCase(), item]));
    const pattern = links
        .map((item) => item.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    const matcher = new RegExp(`\\b(${pattern})\\b`, "gi");
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

function renderListItemWithSpeciesLink(text: string, currentSlug: string) {
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

    return renderTextWithSpeciesLinks(text, currentSlug);
}

export async function generateMetadata({params}: SpeciesPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = await getResolvedSpeciesBySlug(slug);

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

    return entry.databaseSource && !entry.databaseSource.seoIndexable
        ? {...metadata, robots: {index: false, follow: true}}
        : shouldNoindexLifeStageAliasSlug(slug, entry.slug)
            ? {...metadata, robots: {index: false, follow: true}}
            : metadata;
}

export default async function SpeciesPage({params}: SpeciesPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "animals");
    const rankingsT = await getScopedTranslator(locale, "rankings");
    const entry = await getResolvedSpeciesBySlug(slug);

    if (!entry) {
        notFound();
    }

    if (entry.slug !== slug.trim().toLowerCase()) {
        redirect(getLocalePath(locale, `/animals/${entry.slug}`));
    }

    const legendaryBeast = getLegendaryEarthBeast(entry.slug);
    const legendaryCatalogSeed = legendaryBeast ? getLegendaryCatalogSeedByBeastSlug(legendaryBeast.slug) : null;
    const legendaryCaptureNote = legendaryBeast ? getLegendaryCaptureRequirementMessage(legendaryBeast.slug) : null;
    const unifiedSpeciesEntries = entry.databaseSource ? await getUnifiedSpeciesEntries() : speciesEntries;
    const unifiedSpeciesBySlug = new Map(unifiedSpeciesEntries.map((item) => [item.slug, item]));
    const related = legendaryBeast
        ? getRelatedLegendaryEarthBeasts(entry.slug, 3)
            .map((beast) => unifiedSpeciesBySlug.get(beast.slug) ?? getSpeciesBySlug(beast.slug))
            .filter((item): item is SpeciesEntry => Boolean(item))
        : (() => {
            const staticRelated = getRelatedSpecies(entry.slug, 3);
            return staticRelated.length > 0
                ? staticRelated
                : getAutomaticRelatedSpecies(entry, unifiedSpeciesEntries, 3);
        })();
    const relatedBlogPosts = getBlogPostsForSpecies(entry.slug, 3);
    const relatedChallenges = getChallengesForSpecies(entry.slug, 4);
    const featuredRankings = getRankingsForSpecies(entry.slug, 3);
    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(entry.slug);
    const principleProfile = await resolveSpeciesBehaviorProfile(entry.slug);
    const primaryQuality = principleProfile?.bestFor[0] ?? null;
    const primaryQualitySlug = primaryQuality ? toQualitySlug(primaryQuality) : null;
    const primaryQualityHub = primaryQualitySlug ? await getPrincipleHubBySlug(primaryQualitySlug) : null;
    const relatedPowerSpecies = primaryQualityHub
        ? primaryQualityHub.lessons
            .filter((lesson) => lesson.slug !== entry.slug)
            .slice(0, 3)
            .map((lesson) => unifiedSpeciesBySlug.get(lesson.slug))
            .filter((relatedEntry): relatedEntry is SpeciesEntry => Boolean(relatedEntry))
        : principleProfile
            ? principleProfile.relatedSpeciesSlugs
                .map((relatedSlug) => unifiedSpeciesBySlug.get(relatedSlug))
                .filter((relatedEntry): relatedEntry is SpeciesEntry => Boolean(relatedEntry))
            : [];
    const dietContent = getSpeciesDietContent(entry);
    const databaseFieldGuide = entry.databaseSource?.fieldGuide;
    const spottingContent = getSpeciesSpottingContent(entry);
    const {descriptor, subtitleStory} = await getSpeciesSubtitle(entry.slug, locale);
    const miniSystemsSummary = getMiniSystemsBySpeciesSlug(entry.slug);
    const statsResult = await resolveSpeciesStats(entry.slug, entry);
    const lessonValueResult = statsResult.stats
        ? await resolveSpeciesLessonValue(entry, statsResult.stats)
        : null;
    const rankingItems = await getSpeciesRankings(entry);
    const featuredMediaList = await getSpeciesImageReferences(entry.slug, 8, entry);
    const featuredMedia = featuredMediaList[0] ?? await getSpeciesRepresentativeImageReference(entry.slug, entry);
    const growthContext = await getSpeciesGrowthContext(entry, featuredMedia?.captureId ?? null);
    const speciesCaptures = growthContext.speciesCaptures;
    const heroFeaturedMedia = featuredMediaList.length > 0
        ? featuredMediaList
        : featuredMedia?.imagePath
            ? [featuredMedia]
            : [];
    const resolvedRarityScore = statsResult.stats
        ? statsResult.stats.rarity
        : entry.analysis.rarityScore;
    const resolvedRarityLabel = rarityLabel(resolvedRarityScore);
    const battleTier = statsResult.stats
        ? getBattleTier(statsResult.stats)
        : null;
    const battleTierLabel = battleTier ? t("battleTierChip", {tier: battleTier}) : null;
    const formatCaptureGradeLabel = (grade: string | null | undefined) => {
        const normalizedGrade = grade?.trim();
        return normalizedGrade ? `Grade ${normalizedGrade}` : null;
    };
    const isBreed = isBreedSpeciesEntry(entry);
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
                    otherName: otherSpecies.name
                }] as const;
            }).filter((item): item is readonly [string, {challengeSlug: string; otherName: string}] => Boolean(item))
        ).values()
    ).slice(0, 4);
    const ctaSupportItems = [
        t("ctaSupportOne"),
        t("ctaSupportTwo"),
        t("ctaSupportThree")
    ];
    const heroSubtitle = [descriptor ? `${descriptor}.` : null, subtitleStory ?? [entry.analysis.summary, miniSystemsSummary].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" ");
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
    const principleBreadcrumbSchema = principleProfile ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: principleProfile.hasLessonPage
            ? [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: getAbsoluteUrl(locale)
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Animal Lessons",
                    item: getAbsoluteUrl(locale, "/animal-lessons")
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: entry.name,
                    item: getAbsoluteUrl(locale, `/animal-lessons/${entry.slug}`)
                }
            ]
            : [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: getAbsoluteUrl(locale)
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Powers",
                    item: getAbsoluteUrl(locale, "/powers")
                },
                ...(primaryQualitySlug ? [{
                    "@type": "ListItem",
                    position: 3,
                    name: primaryQuality ?? principleProfile.principle,
                    item: getAbsoluteUrl(locale, `/powers/${primaryQualitySlug}`)
                }] : []),
                {
                    "@type": "ListItem",
                    position: primaryQualitySlug ? 4 : 3,
                    name: entry.name,
                    item: pageUrl
                }
            ]
    } : null;
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

    const fieldGuideSections = [
        {
            id: "introduction",
            title: t("fieldGuideIntroductionTitle", {animal: entry.name}),
            content: (
                <div className="flex flex-col gap-5 text-lg leading-8 text-ink-200">
                    <p>{renderTextWithSpeciesLinks(entry.analysis.summary, entry.slug)}</p>
                    <div>
                        <h4 className="text-base font-semibold text-white">{t("identifyTitle", {animal: entry.name})}</h4>
                        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                            {entry.analysis.identification.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                            ))}
                        </ul>
                    </div>
                    {entry.premiumDetails.whyInteresting.length > 0 ? (
                        <div>
                            <h4 className="text-base font-semibold text-white">{t("interestingTitle", {animal: entry.name})}</h4>
                            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                                {entry.premiumDetails.whyInteresting.map((item) => (
                                    <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            )
        },
        {
            id: "environment",
            title: t("fieldGuideEnvironmentTitle", {habitat: entry.analysis.habitat.split(",")[0] ?? entry.name}),
            content: (
                <div className="flex flex-col gap-5 text-lg leading-8 text-ink-200">
                    <p>
                        <span className="text-white">{t("habitatLabel")}: </span>
                        {renderTextWithSpeciesLinks(entry.analysis.habitat, entry.slug)}
                    </p>
                    <p>
                        <span className="text-white">{t("nativeRangeLabel")}: </span>
                        {renderTextWithSpeciesLinks(entry.analysis.nativeRange, entry.slug)}
                    </p>
                    <NativeRangeMapCard
                        entry={entry}
                        labels={{
                            title: t("nativeRangeCardTitle"),
                            description: t("nativeRangeCardDescription"),
                            missingAssets: t("nativeRangeMissingAssets")
                        }}
                    />
                    <div className="flex flex-col gap-4">
                        <p>{renderTextWithSpeciesLinks(spottingContent.summary, entry.slug)}</p>
                        <ul className="flex list-disc flex-col gap-2 pl-5">
                            {spottingContent.locations.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item.charAt(0).toUpperCase() + item.slice(1), entry.slug)}</li>
                            ))}
                        </ul>
                        <ul className="flex list-disc flex-col gap-2 pl-5">
                            {spottingContent.tips.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: "diet",
            title: t("fieldGuideDietTitle"),
            content: (
                <div className="flex flex-col gap-4 text-lg leading-8 text-ink-200">
                    <p>{renderTextWithSpeciesLinks(databaseFieldGuide?.dietSummary ?? dietContent.summary, entry.slug)}</p>
                    {!databaseFieldGuide?.dietSummary ? (
                        <>
                            <ul className="flex list-disc flex-col gap-2 pl-5">
                                {dietContent.foods.map((item) => (
                                    <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                                ))}
                            </ul>
                            <p className="text-ink-300">{renderTextWithSpeciesLinks(dietContent.note, entry.slug)}</p>
                        </>
                    ) : null}
                </div>
            )
        },
        ...(databaseFieldGuide?.predatorsSummary ? [{
            id: "predators",
            title: "Predators, threats, and defense",
            content: <p className="text-lg leading-8 text-ink-200">{renderTextWithSpeciesLinks(databaseFieldGuide.predatorsSummary, entry.slug)}</p>
        }] : []),
        ...(databaseFieldGuide && (databaseFieldGuide.sleepPattern || databaseFieldGuide.lifespanEstimate) ? [{
            id: "life-cycle",
            title: "Daily rhythm and lifespan",
            content: (
                <div className="flex flex-col gap-4 text-lg leading-8 text-ink-200">
                    {databaseFieldGuide.sleepPattern ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.sleepPattern, entry.slug)}</p> : null}
                    {databaseFieldGuide.lifespanEstimate ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.lifespanEstimate, entry.slug)}</p> : null}
                </div>
            )
        }] : []),
        ...(databaseFieldGuide && (databaseFieldGuide.femaleOffspringNotes || databaseFieldGuide.sexDifferenceNotes) ? [{
            id: "reproduction",
            title: "Offspring and sex differences",
            content: (
                <div className="flex flex-col gap-4 text-lg leading-8 text-ink-200">
                    {databaseFieldGuide.femaleOffspringNotes ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.femaleOffspringNotes, entry.slug)}</p> : null}
                    {databaseFieldGuide.sexDifferenceNotes ? <p>{renderTextWithSpeciesLinks(databaseFieldGuide.sexDifferenceNotes, entry.slug)}</p> : null}
                </div>
            )
        }] : []),
        {
            id: "behavior",
            title: t("fieldGuideBehaviorTitle", {animal: entry.name}),
            content: (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-lg leading-8 text-ink-200">
                    {entry.premiumDetails.behaviorTraits.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            )
        },
        ...(principleProfile ? [{
            id: "meaning",
            title: t("fieldGuideMeaningTitle", {principle: principleProfile.principle}),
            content: (
                <div className="flex flex-col gap-5 text-lg leading-8 text-ink-200">
                    <p>{entry.name} most often symbolizes {principleProfile.principle.toLowerCase()} in AnimalDex because its real survival behavior repeatedly shows this pattern.</p>
                    <p>{principleProfile.coreLesson}</p>
                    <p>{renderTextWithSpeciesLinks(principleProfile.biologicalBasis, entry.slug)}</p>
                </div>
            )
        }] : []),
        {
            id: "spotting",
            title: t("fieldGuideSpottingTitle"),
            content: (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-lg leading-8 text-ink-200">
                    {entry.premiumDetails.respectfulSpotting.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            )
        },
        ...(entry.premiumDetails.lookalikes.length > 0 ? [{
            id: "lookalikes",
            title: t("fieldGuideLookalikesTitle"),
            content: (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-lg leading-8 text-ink-200">
                    {entry.premiumDetails.lookalikes.map((item) => (
                        <li key={item}>{renderListItemWithSpeciesLink(item, entry.slug)}</li>
                    ))}
                </ul>
            )
        }] : [])
    ];

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-16 md:gap-24">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([
                    thingSchema,
                    articleSchema,
                    faqSchema,
                    animalBreadcrumbSchema,
                    ...(principleBreadcrumbSchema ? [principleBreadcrumbSchema] : [])
                ])}}
            />

            <Link href="/animals" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[radial-gradient(circle_at_15%_10%,rgba(180,139,72,0.16),transparent_34%),linear-gradient(135deg,rgba(26,34,28,0.96),rgba(12,17,14,0.98))] p-5 md:p-10 lg:p-12">
                <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div className="order-2 flex flex-col items-start gap-6 lg:order-1">
                        <div className="flex flex-wrap gap-2">
                            {animalDexNumber ? <AnimalDexNumberBadge number={animalDexNumber} /> : null}
                            {legendaryBeast ? <LegendaryEarthBeastBadge compact /> : null}
                            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                                {resolvedRarityLabel}
                            </span>
                            {isBreed ? (
                                <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-sm font-semibold text-violet-100">
                                    {t("breedLabel")}
                                </span>
                            ) : null}
                            <span className="rounded-full border border-primary-400/20 bg-primary-400/[0.08] px-3 py-1.5 text-sm font-semibold text-primary-100">
                                {displayCategory}
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
                            <p className="max-w-2xl text-lg leading-8 text-ink-200 md:text-xl">
                                {t("profileDescription")}
                            </p>
                        </div>
                        <SubtitleSpeaker
                            text={heroSubtitle}
                            locale={locale}
                            cacheKey={`${locale}:${entry.slug}:${heroSubtitle}`}
                            refreshUrl={`/api/species-subtitles/${entry.slug}?locale=${encodeURIComponent(locale)}`}
                        />
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <Link href="/#download" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 transition-colors hover:bg-primary-300">
                                {t("getAnimalDex")}
                            </Link>
                            <Link href="/animals" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl border border-white/15 px-7 font-bold text-white transition-colors hover:border-primary-400 hover:text-primary-100">
                                {t("browseAnimals")}
                            </Link>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2">
                        {heroFeaturedMedia.length > 0 ? (
                            <FeaturedSpeciesImageCarousel
                                slides={heroFeaturedMedia.map((item) => ({
                                    captureId: item.captureId,
                                    src: getSpeciesImageRoute(entry.slug, item.captureId),
                                    alt: getSpeciesImageAltText(entry, "featured"),
                                    gradeLabel: formatCaptureGradeLabel(item.imageGrade),
                                    attribution: getSpeciesImageAttribution(item),
                                    username: item.username,
                                    contextLabel: item.contextLabel,
                                    locationDisplayLabel: item.locationDisplayLabel
                                }))}
                                rarityLabel={resolvedRarityLabel}
                            />
                        ) : (
                            <div className="flex aspect-[4/5] flex-col items-center justify-center rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_50%_35%,rgba(180,139,72,0.18),transparent_34%),rgba(5,10,7,0.72)] p-8 text-center shadow-2xl shadow-black/30">
                                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/[0.08] text-3xl text-amber-100">✦</div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">{t("animalDexCardLabel")}</p>
                                <h2 className="mt-3 font-display text-3xl font-bold text-white">{t("unlockCardTitle")}</h2>
                                <p className="mt-3 max-w-sm text-base leading-7 text-ink-200">{t("unlockCardDescription")}</p>
                                <Link href="/#download" className="mt-7 rounded-2xl border border-primary-400/35 px-5 py-3 font-semibold text-primary-100 hover:border-primary-300 hover:text-white">
                                    {t("getAnimalDex")}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

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

            <SpeciesDetailTabs
                defaultTab="story"
                labels={{
                    story: t("tabStory"),
                    progress: t("tabProgress"),
                    growth: t("tabGrowth")
                }}
                story={(
                    <div className="flex flex-col gap-10 md:gap-16">
                        {principleProfile ? (
                            <section id="meaning" className="scroll-mt-40">
                                <div className="overflow-hidden rounded-[1.75rem] border border-amber-200/15 bg-[linear-gradient(145deg,rgba(180,139,72,0.1),rgba(34,58,41,0.14))] p-5 md:p-8">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                                            <span aria-hidden="true">✦</span>
                                            {t("animalPowerLabel")}
                                        </div>
                                        <p className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
                                            {principleProfile.principle}
                                        </p>
                                        {principleProfile.motto ? (
                                            <p className="mt-2 text-lg font-semibold text-amber-100 md:text-xl">
                                                {principleProfile.motto}
                                            </p>
                                        ) : null}
                                        {principleProfile.principleExpression ? (
                                            <p className="mt-2 text-sm leading-6 text-ink-300 md:text-base">
                                                {principleProfile.principleExpression}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mt-8 border-l-2 border-amber-300/55 pl-5 md:pl-6">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/90">
                                            {t("whatItTeachesLabel")}
                                        </p>
                                        <p className="mt-3 text-xl leading-9 text-white md:text-2xl md:leading-10">
                                            {principleProfile.coreLesson}
                                        </p>
                                    </div>

                                    {principleProfile.applicationExample ? (
                                        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-black/15 p-5 md:p-6">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                                                {t("tryItLabel")}
                                            </p>
                                            <p className="mt-3 text-lg leading-8 text-ink-100">
                                                {principleProfile.applicationExample}
                                            </p>
                                        </div>
                                    ) : null}

                                    <div id="biological-basis" className="mt-8 scroll-mt-40">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-100">
                                            {t("natureProofLabel")}
                                        </p>
                                        <p className="mt-3 text-lg leading-8 text-ink-200">
                                            {renderTextWithSpeciesLinks(principleProfile.biologicalBasis, entry.slug)}
                                        </p>
                                    </div>

                                    {principleProfile.bestFor.length > 0 ? (
                                        <div className="mt-8">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">
                                                {t("useItForLabel")}
                                            </p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {principleProfile.bestFor.map((item) => (
                                                    <span
                                                        key={item}
                                                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-ink-100"
                                                    >
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.08] pt-6 text-sm">
                                        {principleProfile.hasLessonPage ? (
                                            <Link href={`/animal-lessons/${entry.slug}`} className="text-primary-200 hover:text-primary-100" underline>
                                                {t("lessonPageLink", {animal: entry.name})}
                                            </Link>
                                        ) : null}
                                        {primaryQualitySlug ? (
                                            <Link href={`/powers/${primaryQualitySlug}`} className="text-primary-200 hover:text-primary-100" underline>
                                                {primaryQuality}
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>

                                {relatedPowerSpecies.length > 0 && primaryQuality ? (
                                    <aside className="mt-8 rounded-3xl bg-[linear-gradient(145deg,rgba(180,139,72,0.12),rgba(40,70,49,0.16))] p-6 md:p-8">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                                            {t("relatedPrincipleSpeciesTitle", {principle: primaryQuality})}
                                        </p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {relatedPowerSpecies.map((item) => (
                                                <Link key={item.slug} href={`/animals/${item.slug}`} className="text-sm text-primary-200 hover:text-primary-100">
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </aside>
                                ) : null}
                            </section>
                        ) : null}

                        <SpeciesFieldGuideAccordion
                            headerTitle={principleProfile
                                ? t("fieldGuideHeaderTitle", {principle: principleProfile.principle})
                                : t("fieldGuideHeaderTitleFallback", {animal: entry.name})}
                            headerDescription={t("fieldGuideHeaderDescription")}
                            sections={fieldGuideSections}
                            defaultOpenId="introduction"
                        />
                    </div>
                )}
                progress={(
                    <div className="flex flex-col gap-10 md:gap-16">
                        <SpeciesLevelProgress progress={growthContext.progress} />

                        <SpeciesStatsSection
                            result={statsResult}
                            battleTier={battleTier}
                            labels={{
                                title: t("statsTitle", {animal: entry.name}),
                                description: t("statsDescription"),
                                battleTierChip: battleTierLabel ?? t("battleTierChip", {tier: "{tier}"}),
                                sourceLabel: t("statsSourceLabel"),
                                dominance: t("dominanceStat"),
                                speed: t("speedStat"),
                                size: t("sizeStat"),
                                intelligence: t("intelligenceStat"),
                                rarity: t("rarityStat"),
                                sourceSpeciesProfile: t("statsSourceSpeciesProfile"),
                                sourceAnalysisBase: t("statsSourceAnalysisBase"),
                                sourceAnalysisEffective: t("statsSourceAnalysisEffective"),
                                sourceRawJson: t("statsSourceRawJson"),
                                sourceGenerated: t("statsSourceGenerated"),
                                sourceNone: t("statsSourceNone"),
                                unavailableTitle: t("statsUnavailableTitle"),
                                unavailableDescription: t("statsUnavailableDescription")
                            }}
                        />

                        <SpeciesEndorsementAndSize
                            progress={growthContext.progress}
                            speciesName={entry.name}
                            speciesSlug={entry.slug}
                            sizeScore={statsResult.stats?.size ?? null}
                            isAuthenticated={growthContext.isAuthenticated}
                        />

                        {lessonValueResult ? (
                            <SpeciesLessonValueSection
                                result={lessonValueResult}
                                locale={locale === "id" ? "id-ID" : "en-US"}
                                labels={{
                                    title: t("lessonValueTitle"),
                                    estimatedLabel: t("lessonValueEstimated"),
                                    rangeLabel: t("lessonValueRange"),
                                    rangeOnlyLabel: t("lessonValueRangeOnly"),
                                    confidenceLabel: t("lessonValueConfidence"),
                                    footer: t("lessonValueFooter"),
                                    disclaimer: t("lessonValueDisclaimer"),
                                    stewardshipBasis: t("lessonValueStewardshipBasis"),
                                    generatedBasis: t("lessonValueGeneratedBasis")
                                }}
                            />
                        ) : null}

                        <SpeciesRankingCarousel
                            speciesSlug={entry.slug}
                            speciesName={entry.name}
                            items={rankingItems}
                            labels={{
                                title: t("rankingsTitle", {animal: entry.name}),
                                description: t("rankingsDescription"),
                                empty: t("rankingsEmpty"),
                                rankLabel: t("rankingsRankLabel"),
                                scoreLabel: t("rankingsScoreLabel"),
                                byPhotographer: t("rankingsByPhotographer")
                            }}
                        />

                        {speciesCaptures.length > 0 ? (
                            <SpeciesLifeStagesSection
                                speciesName={entry.name}
                                captures={speciesCaptures}
                                labels={{
                                    title: "Life stages you've seen",
                                    description: `Captures on this page keep their original scan labels and count toward ${entry.name}.`,
                                    captureTitle: "Your capture"
                                }}
                            />
                        ) : null}

                        <section className="rounded-[2rem] bg-amber-200/[0.07] px-6 py-8 md:px-10 md:py-12 flex flex-col gap-4">
                            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("rareTitle", {animal: entry.name})}</h2>
                            <p className="text-ink-200 text-lg md:text-xl leading-8">
                                <span className="text-white">{t("rarityLabel")}: </span>
                                {resolvedRarityLabel} ({resolvedRarityScore}/100)
                            </p>
                            <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(entry.analysis.rarityReason, entry.slug)}</p>
                        </section>

                        {systemsEntry ? (
                            <SystemsIntelligenceSection
                                items={[
                                    {
                                        slug: entry.slug,
                                        name: entry.name,
                                        entry: systemsEntry
                                    }
                                ]}
                                labels={{
                                    title: t("systemsIntelligenceTitle"),
                                    description: t("systemsIntelligenceDescription"),
                                    systemRole: t("systemRoleLabel"),
                                    specializedHardware: t("specializedHardwareLabel"),
                                    systemsScript: t("systemsScriptLabel"),
                                    strategicInsight: t("strategicInsightLabel")
                                }}
                            />
                        ) : null}
                    </div>
                )}
                growth={(
                    <SpeciesGrowthPanel
                        speciesSlug={entry.slug}
                        speciesName={entry.name}
                        lessonSlug={principleProfile?.hasLessonPage ? entry.slug : null}
                        qualitySlug={primaryQualitySlug}
                        qualityName={primaryQuality}
                        growth={growthContext}
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

            <section className="flex flex-col gap-4">
                <h2 className="font-display font-bold text-4xl text-white">{t("relatedTitle")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {related.map((item) => (
                        <article
                            key={item.slug}
                            className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                        >
                            <h3 className="font-display font-bold text-2xl text-white">{item.name}</h3>
                            <p className="text-ink-200 text-base">{renderTextWithSpeciesLinks(item.analysis.summary, entry.slug)}</p>
                            <Link
                                href={`/animals/${item.slug}`}
                                className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                underline
                            >
                                {t("readSpecies")}
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            {primaryQuality && relatedPowerSpecies.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">
                        {t("moreWithPrincipleTitle", {principle: primaryQuality})}
                    </h2>
                    <p className="text-ink-200 text-lg md:text-xl">
                        <Link href={`/powers/${primaryQualitySlug}`} underline className="text-primary-200 hover:text-primary-100">
                            {t("moreWithPrincipleHubLink", {principle: primaryQuality})}
                        </Link>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedPowerSpecies.map((item) => (
                            <article
                                key={`principle-${item.slug}`}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{item.name}</h3>
                                <p className="text-ink-200 text-base">{renderTextWithSpeciesLinks(item.analysis.summary, entry.slug)}</p>
                                <Link
                                    href={`/animals/${item.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readSpecies")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
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
