import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import NativeRangeMapCard from "@/app/[locale]/(composited)/animals/[slug]/native-range-map-card";
import FeaturedSpeciesImageCarousel from "@/app/[locale]/(composited)/animals/[slug]/featured-species-image-carousel";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import SpeciesStatsSection from "@/app/[locale]/(composited)/animals/[slug]/species-stats-section";
import SubtitleSpeaker from "@/app/[locale]/(composited)/animals/[slug]/subtitle-speaker";
import {getBlogPostsForSpecies} from "@/data/blog";
import {getChallengesForSpecies} from "@/data/challenges";
import {getRankingTierListTitle, getRankingsForSpecies} from "@/data/rankings";
import {getSpeciesDietContent} from "@/data/species-diet";
import {
    getSpeciesImageAltText,
    getSpeciesImageAttribution,
    getSpeciesImageRoute,
    getSpeciesImageReferences,
    getSpeciesRepresentativeImageReference
} from "@/data/species-images";
import {getMiniSystemsBySpeciesSlug} from "@/data/species-mini-systems";
import {getSpeciesSpottingContent} from "@/data/species-spotting";
import {getBattleTier, resolveSpeciesStats} from "@/data/species-stats";
import {getRelatedSpecies, getSpeciesBySlug, rarityLabel, speciesEntries} from "@/data/species";
import {resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {getSpeciesSubtitle} from "@/data/species-subtitles";
import {getSystemsIntelligenceBySpeciesSlug} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

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
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        return {};
    }

    const title = `${entry.name} Meaning, Symbolism, Lessons, Habitat & Facts`;
    const description = `${entry.name}: ${entry.analysis.summary} Explore biology-backed ${entry.name.toLowerCase()} meaning, symbolism, lessons, behavior, habitat, and related animals with AnimalDex.`;

    return buildContentMetadata({
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
}

export default async function SpeciesPage({params}: SpeciesPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "animals");
    const rankingsT = await getScopedTranslator(locale, "rankings");
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        notFound();
    }

    const related = getRelatedSpecies(entry.slug, 3);
    const relatedBlogPosts = getBlogPostsForSpecies(entry.slug, 3);
    const relatedChallenges = getChallengesForSpecies(entry.slug, 4);
    const featuredRankings = getRankingsForSpecies(entry.slug, 3);
    const systemsEntry = getSystemsIntelligenceBySpeciesSlug(entry.slug);
    const principleProfile = await resolveSpeciesBehaviorProfile(entry.slug);
    const relatedPrincipleSpecies = principleProfile
        ? principleProfile.relatedSpeciesSlugs
            .map((relatedSlug) => getSpeciesBySlug(relatedSlug))
            .filter((relatedEntry): relatedEntry is NonNullable<typeof relatedEntry> => Boolean(relatedEntry))
        : [];
    const dietContent = getSpeciesDietContent(entry);
    const spottingContent = getSpeciesSpottingContent(entry);
    const {descriptor, subtitleStory} = await getSpeciesSubtitle(entry.slug, locale);
    const miniSystemsSummary = getMiniSystemsBySpeciesSlug(entry.slug);
    const statsResult = await resolveSpeciesStats(entry.slug);
    const featuredMediaList = await getSpeciesImageReferences(entry.slug, 8);
    const featuredMedia = featuredMediaList[0] ?? await getSpeciesRepresentativeImageReference(entry.slug);
    const imageAttribution = getSpeciesImageAttribution(featuredMedia);
    const captureContextLabel = featuredMedia?.imagePath ? featuredMedia.contextLabel : null;
    const captureLocationLabel = featuredMedia?.captureId && featuredMedia.imageBucket && featuredMedia.imagePath
        ? featuredMedia.locationDisplayLabel
        : null;
    const resolvedRarityScore = statsResult.stats && statsResult.statsSource !== "generated"
        ? statsResult.stats.rarity
        : entry.analysis.rarityScore;
    const resolvedRarityLabel = rarityLabel(resolvedRarityScore);
    const battleTier = statsResult.stats && statsResult.statsSource !== "generated"
        ? getBattleTier(statsResult.stats)
        : null;
    const battleTierLabel = battleTier ? t("battleTierChip", {tier: battleTier}) : null;
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
                    name: "Principles",
                    item: getAbsoluteUrl(locale, "/principles")
                },
                ...(principleProfile.clusterPrincipleSlug ? [{
                    "@type": "ListItem",
                    position: 3,
                    name: principleProfile.clusterPrinciple ?? principleProfile.principle,
                    item: getAbsoluteUrl(locale, `/principles/${principleProfile.clusterPrincipleSlug}`)
                }] : []),
                {
                    "@type": "ListItem",
                    position: principleProfile.clusterPrincipleSlug ? 4 : 3,
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
                            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                                {resolvedRarityLabel}
                            </span>
                            <span className="rounded-full border border-primary-400/20 bg-primary-400/[0.08] px-3 py-1.5 text-sm font-semibold text-primary-100">
                                {entry.analysis.category}
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
                        {principleProfile ? (
                            <div className="border-l-2 border-amber-300/45 pl-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">{t("principleLabel")}</p>
                                <p className="mt-2 text-xl font-semibold text-white md:text-2xl">{principleProfile.principle}</p>
                                {principleProfile.motto ? <p className="mt-1 text-ink-200">{principleProfile.motto}</p> : null}
                            </div>
                        ) : null}
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
                        {featuredMediaList.length > 1 ? (
                            <FeaturedSpeciesImageCarousel
                                slides={featuredMediaList.map((item) => ({
                                    captureId: item.captureId,
                                    src: getSpeciesImageRoute(entry.slug, item.captureId),
                                    alt: getSpeciesImageAltText(entry, "featured"),
                                    attribution: getSpeciesImageAttribution(item),
                                    contextLabel: item.contextLabel,
                                    locationDisplayLabel: item.locationDisplayLabel
                                }))}
                                rarityLabel={resolvedRarityLabel}
                                battleTierLabel={battleTierLabel}
                            />
                        ) : featuredMedia?.imagePath ? (
                            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-2xl shadow-black/30">
                                <div className="relative overflow-hidden rounded-[1.5rem]">
                                    <SpeciesImage
                                        slug={entry.slug}
                                        alt={getSpeciesImageAltText(entry, "featured")}
                                        priority
                                        className="aspect-[4/5] rounded-[1.5rem]"
                                        sizes="(min-width: 1024px) 40vw, 100vw"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-5 pb-5 pt-16">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">{t("animalDexCardLabel")}</p>
                                        {captureContextLabel ? <p className="mt-1 text-lg font-semibold text-white">{captureContextLabel}</p> : null}
                                        {captureLocationLabel ? <p className="mt-1 text-sm text-ink-100">{captureLocationLabel}</p> : null}
                                    </div>
                                </div>
                                {imageAttribution ? <p className="px-2 pt-3 text-sm text-ink-300">{imageAttribution}</p> : null}
                            </div>
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

            <section aria-label={t("quickFactsTitle")} className="grid grid-cols-2 overflow-hidden rounded-3xl bg-surface-900/55 md:grid-cols-5">
                {[
                    [t("scientificName"), entry.analysis.scientificName],
                    [t("category"), entry.analysis.category],
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

            {principleProfile ? (
                <nav className="sticky top-20 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-white/[0.08] bg-canvas-950/90 px-4 py-4 backdrop-blur-xl md:top-24 md:mx-0 md:rounded-2xl md:border md:px-6">
                    <span className="text-ink-300 text-xs uppercase tracking-[0.18em]">{t("jumpToLabel")}</span>
                    <Link href="#meaning" className="text-sm text-primary-200 hover:text-primary-100">
                        {t("anchorMeaning")}
                    </Link>
                    <Link href="#symbolism" className="text-sm text-primary-200 hover:text-primary-100">
                        {t("anchorSymbolism")}
                    </Link>
                    <Link href="#biological-basis" className="text-sm text-primary-200 hover:text-primary-100">
                        {t("anchorBiologicalBasis")}
                    </Link>
                    <Link href="#behavior" className="text-sm text-primary-200 hover:text-primary-100">
                        {t("anchorBehavior")}
                    </Link>
                </nav>
            ) : null}

            {principleProfile ? (
                <section id="meaning" className="scroll-mt-40 border-t border-white/10 pt-10 md:pt-16">
                    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                                {t("lessonFromLabel", {animal: entry.name})}
                            </p>
                            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-white md:text-5xl">
                                {principleProfile.motto ?? t("principleTitle", {animal: entry.name})}
                            </h2>
                            <p className="mt-6 text-xl leading-9 text-ink-100 md:text-2xl md:leading-10">
                                {principleProfile.coreLesson}
                            </p>
                            <div id="biological-basis" className="mt-10 scroll-mt-40 border-l-2 border-primary-400/35 pl-5 md:pl-7">
                                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-100">{t("biologicalBasisLabel")}</h3>
                                <p className="mt-3 text-lg leading-8 text-ink-200">
                                    {renderTextWithSpeciesLinks(principleProfile.biologicalBasis, entry.slug)}
                                </p>
                            </div>
                            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                {principleProfile.hasLessonPage ? (
                                    <Link href={`/animal-lessons/${entry.slug}`} className="text-primary-200 hover:text-primary-100" underline>
                                        {t("lessonPageLink", {animal: entry.name})}
                                    </Link>
                                ) : null}
                                {principleProfile.clusterPrincipleSlug ? (
                                    <Link href={`/principles/${principleProfile.clusterPrincipleSlug}`} className="text-primary-200 hover:text-primary-100" underline>
                                        {principleProfile.clusterPrinciple}
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                        <aside className="self-start rounded-3xl bg-[linear-gradient(145deg,rgba(180,139,72,0.12),rgba(40,70,49,0.16))] p-6 md:p-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">{t("principleLabel")}</p>
                            <p className="mt-3 font-display text-3xl font-bold text-white">{principleProfile.principle}</p>
                            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">{t("bestForTitle")}</h3>
                            <ul className="mt-4 flex flex-col gap-3 text-ink-100">
                                {principleProfile.bestFor.map((item) => (
                                    <li key={item} className="flex gap-3"><span className="text-amber-200">—</span><span>{item}</span></li>
                                ))}
                            </ul>
                            {relatedPrincipleSpecies.length > 0 ? (
                                <div className="mt-8 border-t border-white/[0.08] pt-6">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">{t("relatedPrincipleSpeciesTitle", {principle: principleProfile.principle})}</h3>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {relatedPrincipleSpecies.map((item) => (
                                            <Link key={item.slug} href={`/animals/${item.slug}`} className="text-sm text-primary-200 hover:text-primary-100">
                                                {item.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </aside>
                    </div>
                </section>
            ) : null}

            {principleProfile ? (
                <section id="symbolism" className="scroll-mt-40 border-t border-white/10 pt-10 md:pt-16">
                    <div className="flex max-w-3xl flex-col gap-8">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                        {t("symbolismTitle", {animal: entry.name})}
                    </h2>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl md:text-2xl font-semibold text-white">{t("symbolismQuestionOne", {animal: entry.name.toLowerCase()})}</h3>
                        <p className="text-ink-200 text-lg md:text-xl leading-8">
                            {entry.name} most often symbolizes {principleProfile.principle.toLowerCase()} in AnimalDex because its real survival behavior repeatedly shows this pattern.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl md:text-2xl font-semibold text-white">{t("symbolismQuestionTwo", {animal: entry.name.toLowerCase()})}</h3>
                        <p className="text-ink-200 text-lg md:text-xl leading-8">{principleProfile.coreLesson}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl md:text-2xl font-semibold text-white">{t("symbolismQuestionThree")}</h3>
                        <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(principleProfile.biologicalBasis, entry.slug)}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl md:text-2xl font-semibold text-white">{t("symbolismQuestionFour")}</h3>
                        <p className="text-ink-200 text-lg md:text-xl leading-8">
                            AnimalDex assigns this principle from observable biology: body design, behavioral strategy, and ecosystem role documented for {entry.name.toLowerCase()}.
                        </p>
                    </div>
                    </div>
                </section>
            ) : null}

            <section className="max-w-3xl border-t border-white/10 pt-10 md:pt-16 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whatIsTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(entry.analysis.summary, entry.slug)}</p>
            </section>

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

            <section className="max-w-3xl border-t border-white/10 pt-10 md:pt-16 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("identifyTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.analysis.identification.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-[2rem] bg-[linear-gradient(145deg,rgba(40,70,49,0.13),rgba(255,255,255,0.025))] px-6 py-8 md:px-10 md:py-12 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whereFoundTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("habitatLabel")}: </span>
                    {renderTextWithSpeciesLinks(entry.analysis.habitat, entry.slug)}
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
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
                <div className="mt-2 flex flex-col gap-4">
                    <h3 className="text-xl md:text-2xl font-semibold text-white">{t("wildSpottingTitle", {animal: entry.name})}</h3>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(spottingContent.summary, entry.slug)}</p>
                    <div className="flex flex-col gap-3">
                        <h4 className="text-lg md:text-xl font-semibold text-white">{t("wildSpottingLocationsLabel")}</h4>
                        <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                            {spottingContent.locations.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item.charAt(0).toUpperCase() + item.slice(1), entry.slug)}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex flex-col gap-3">
                        <h4 className="text-lg md:text-xl font-semibold text-white">{t("wildSpottingTipsLabel")}</h4>
                        <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                            {spottingContent.tips.map((item) => (
                                <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="max-w-3xl border-t border-white/10 pt-10 md:pt-16 flex flex-col gap-5">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("dietTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("dietSummaryLabel")}: </span>
                    {renderTextWithSpeciesLinks(dietContent.summary, entry.slug)}
                </p>
                <div className="flex flex-col gap-3">
                    <h3 className="text-xl md:text-2xl font-semibold text-white">{t("dietFoodsLabel")}</h3>
                    <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                        {dietContent.foods.map((item) => (
                            <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                        ))}
                    </ul>
                </div>
                <p className="text-ink-300 text-base md:text-lg leading-8">
                    <span className="text-white">{t("dietFieldNoteLabel")}: </span>
                    {renderTextWithSpeciesLinks(dietContent.note, entry.slug)}
                </p>
            </section>

            <section className="rounded-[2rem] bg-amber-200/[0.07] px-6 py-8 md:px-10 md:py-12 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("rareTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    <span className="text-white">{t("rarityLabel")}: </span>
                    {resolvedRarityLabel} ({resolvedRarityScore}/100)
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(entry.analysis.rarityReason, entry.slug)}</p>
            </section>

            {systemsEntry && (
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
            )}

            <section id="behavior" className="scroll-mt-40 max-w-3xl border-t border-white/10 pt-10 md:pt-16 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("behaviorTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.behaviorTraits.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-[2rem] bg-white/[0.025] px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("interestingTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.whyInteresting.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="max-w-3xl border-t border-white/10 pt-10 md:pt-16 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("spottingTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.respectfulSpotting.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-[2rem] bg-white/[0.025] px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("lookalikesTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.lookalikes.map((item) => (
                        <li key={item}>{renderListItemWithSpeciesLink(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

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

            {principleProfile && relatedPrincipleSpecies.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">
                        {t("moreWithPrincipleTitle", {principle: principleProfile.principle})}
                    </h2>
                    <p className="text-ink-200 text-lg md:text-xl">
                        <Link href={`/principles/${principleProfile.clusterPrincipleSlug ?? principleProfile.principleSlug}`} underline className="text-primary-200 hover:text-primary-100">
                            {t("moreWithPrincipleHubLink", {principle: principleProfile.principle})}
                        </Link>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedPrincipleSpecies.map((item) => (
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
