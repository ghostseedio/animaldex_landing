import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import NativeRangeMapCard from "@/app/[locale]/(composited)/animals/[slug]/native-range-map-card";
import FeaturedSpeciesImageCarousel from "@/app/[locale]/(composited)/animals/[slug]/featured-species-image-carousel";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import SpeciesStatsSection from "@/app/[locale]/(composited)/animals/[slug]/species-stats-section";
import SubtitleSpeaker from "@/app/[locale]/(composited)/animals/[slug]/subtitle-speaker";
import {getBlogPostsForSpecies} from "@/data/blog";
import {getChallengesForSpecies} from "@/data/challenges";
import {getRankingsForSpecies} from "@/data/rankings";
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

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
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
    const entry = getSpeciesBySlug(slug);

    if (!entry) {
        return {};
    }

    const title = `${entry.name} — Identification, Habitat, Rarity & Facts`;
    const description = `${entry.name}: ${entry.analysis.summary} Learn identification traits, habitat, native range, rarity, behavior, and related animals with AnimalDex.`;

    return buildContentMetadata({
        locale,
        pathname: `/animals/${entry.slug}`,
        title,
        description,
        keywords: [...entry.searchIntents, entry.name, entry.analysis.scientificName, "animal identification app", "wildlife app"],
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

export function generateStaticParams() {
    return speciesEntries.map((entry) => ({slug: entry.slug}));
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
    const heroSubtitle = [descriptor ? `${descriptor}.` : null, subtitleStory ?? [entry.analysis.summary, miniSystemsSummary].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" ");
    const pageUrl = getAbsoluteUrl(locale, `/animals/${entry.slug}`);
    const thingSchema = {
        "@context": "https://schema.org",
        "@type": "Thing",
        name: entry.name,
        alternateName: entry.analysis.scientificName,
        description: entry.analysis.summary,
        category: entry.analysis.category
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
        ]
    };

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([thingSchema, articleSchema])}}
            />

            <Link href="/animals" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

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
            ) : (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-3 md:p-4">
                    <div className="relative overflow-hidden rounded-[2rem]">
                        <SpeciesImage
                            slug={entry.slug}
                            alt={getSpeciesImageAltText(entry, "featured")}
                            priority
                            className="aspect-[4/3] rounded-[2rem]"
                        />
                        <div className="absolute left-4 top-4 md:left-5 md:top-5 flex max-w-[calc(100%-2rem)] md:max-w-[calc(100%-2.5rem)] flex-col items-start gap-2">
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-amber-200/30 bg-gradient-to-r from-amber-500/70 via-orange-400/65 to-rose-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold text-white shadow-[0_12px_30px_rgba(245,158,11,0.28)]">
                                    {resolvedRarityLabel}
                                </span>
                                {battleTierLabel ? (
                                    <span className="rounded-full border border-cyan-200/30 bg-gradient-to-r from-sky-500/70 via-cyan-500/65 to-teal-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.24)]">
                                        {battleTierLabel}
                                    </span>
                                ) : null}
                            </div>
                            {captureContextLabel && captureLocationLabel ? (
                                <span className="max-w-[min(68vw,26rem)] truncate rounded-full border border-emerald-200/25 bg-gradient-to-r from-emerald-500/62 via-green-500/58 to-lime-500/58 px-3 py-1.5 text-xs md:text-sm font-medium text-white shadow-[0_10px_28px_rgba(34,197,94,0.2)] backdrop-blur">
                                    {captureLocationLabel}
                                </span>
                            ) : null}
                        </div>
                        {captureContextLabel ? (
                            <div className="absolute right-4 top-4 md:right-5 md:top-5">
                                <span className="rounded-full border border-fuchsia-200/30 bg-gradient-to-r from-fuchsia-500/70 via-violet-500/65 to-indigo-500/70 backdrop-blur px-4 py-2 text-sm md:text-base font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_rgba(168,85,247,0.24)]">
                                    {captureContextLabel}
                                </span>
                            </div>
                        ) : null}
                        {!captureContextLabel && captureLocationLabel ? (
                            <div className="absolute right-4 top-4 md:right-5 md:top-5 max-w-[min(75vw,32rem)]">
                                <span className="block truncate rounded-full border border-emerald-200/25 bg-gradient-to-r from-emerald-500/62 via-green-500/58 to-lime-500/58 px-3 py-1.5 text-xs md:text-sm font-medium text-white shadow-[0_10px_28px_rgba(34,197,94,0.2)] backdrop-blur">
                                    {captureLocationLabel}
                                </span>
                            </div>
                        ) : null}
                    </div>
                    {imageAttribution ? (
                        <div className="px-2 pt-3">
                            <p className="text-sm md:text-base text-ink-300">
                                {imageAttribution}
                            </p>
                        </div>
                    ) : null}
                </section>
            )}

            <div className="flex flex-col gap-4">
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{entry.heroTitle}</h1>
                <SubtitleSpeaker
                    text={heroSubtitle}
                    locale={locale}
                    cacheKey={`${locale}:${entry.slug}:${heroSubtitle}`}
                    refreshUrl={`/api/species-subtitles/${entry.slug}?locale=${encodeURIComponent(locale)}`}
                />
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-x-6 gap-y-3">
                    <span>
                        <span className="text-white">{t("scientificName")}: </span>
                        {entry.analysis.scientificName}
                    </span>
                    <span>
                        <span className="text-white">{t("category")}: </span>
                        {entry.analysis.category}
                    </span>
                    <span>
                        <span className="text-white">{t("published")}: </span>
                        {formatDate(locale, entry.publishedAt)}
                    </span>
                    <span>
                        <span className="text-white">{t("updated")}: </span>
                        {formatDate(locale, entry.updatedAt)}
                    </span>
                </div>
            </div>

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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whatIsTitle", {animal: entry.name})}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{renderTextWithSpeciesLinks(entry.analysis.summary, entry.slug)}</p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("identifyTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.analysis.identification.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-5">
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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("behaviorTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.behaviorTraits.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("interestingTitle", {animal: entry.name})}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.whyInteresting.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("spottingTitle")}</h2>
                <ul className="flex flex-col gap-2 text-ink-200 text-lg md:text-xl list-disc pl-5">
                    {entry.premiumDetails.respectfulSpotting.map((item) => (
                        <li key={item}>{renderTextWithSpeciesLinks(item, entry.slug)}</li>
                    ))}
                </ul>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
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
                                    href={`/challenges/${item.challengeSlug}`}
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
                                        href={`/challenges/${challenge.slug}`}
                                        className="hover:text-primary-100 transition-colors"
                                    >
                                        {challenge.title}
                                    </Link>
                                </h3>
                                <p className="text-ink-200 text-base">{challenge.quickVerdict}</p>
                                <Link
                                    href={`/challenges/${challenge.slug}`}
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
                                            href={`/rankings/${ranking.slug}`}
                                            className="hover:text-primary-100 transition-colors"
                                        >
                                            {ranking.title}
                                        </Link>
                                    </h3>
                                    <p className="text-ink-200 text-base">{rankingEntry.shortReason}</p>
                                    <Link
                                        href={`/rankings/${ranking.slug}`}
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

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </article>
    );
}
