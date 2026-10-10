import {Metadata} from "next";
import {templateSafeTitle} from "@/lib/brand-title";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {
    ChallengeEntry,
    ChallengeComparisonType,
    challengeEntries,
    getChallengeComparisonTypeOptions
} from "@/data/challenges";
import ComparisonBuilder from "@/app/[locale]/(composited)/comparisons/_components/comparison-builder";
import ComparisonsDirectory, {
    type DirectoryCard,
    type QuickCategory
} from "@/app/[locale]/(composited)/comparisons/_components/comparisons-directory";
import {listSnapshotComparisons} from "@/lib/published-seo-page-data";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import battlesSnapshot from "@/data/published-comparison-battles.json";
import {getComparisonBattles} from "@/data/comparison-battles";
import {
    animalOptionsFromChallengeEntries
} from "@/data/species-comparisons";
import type {ComparableAnimal} from "@/data/comparison-animals";
import {getSpeciesBySlug} from "@/data/species";
import {buildSpeciesArtworkSrc} from "@/data/species-artwork-index";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {contentThumb} from "@/data/content-thumbnails";


export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

type ComparisonsIndexPageProps = {
    params: {locale: string};
};

const PAGE_SIZE = 12;
const HUB_STARTER_SLUGS = [
    "lion",
    "tiger",
    "grizzly-bear",
    "gorilla",
    "great-white-shark",
    "saltwater-crocodile",
    "african-elephant",
    "gray-wolf",
    "hippopotamus",
    "polar-bear",
    "king-cobra",
    "komodo-dragon",
    "cheetah",
    "jaguar",
    "leopard",
    "bald-eagle"
];

function toHubComparableAnimal(slug: string): ComparableAnimal | null {
    const entry = getSpeciesBySlug(slug);
    if (!entry) return null;
    return {
        slug: entry.slug,
        name: entry.name,
        category: entry.analysis.category,
        scientificName: entry.analysis.scientificName,
        animalDexNumber: getAnimalDexNumberFromEntry(entry),
        artworkUrl: buildSpeciesArtworkSrc(entry.slug, null)
    };
}

const POPULAR_SLUGS = [
    "tiger-vs-lion",
    "komodo-dragon-vs-king-cobra",
    "wolf-vs-hyena",
    "lion-vs-hyena",
    "crocodile-vs-shark",
    "gorilla-vs-tiger"
];
const FAQ_KEYS = ["anyPair", "howItWorks", "accuracy", "missing"] as const;
const HOW_IT_WORKS_KEYS = ["pick", "generate", "read"] as const;
const QUICK_CATEGORIES: Array<{key: QuickCategory; icon: string}> = [
    {key: "popular", icon: "🔥"},
    {key: "battles", icon: "⚔️"},
    {key: "predators", icon: "🦁"},
    {key: "reptiles", icon: "🐍"},
    {key: "mammals", icon: "🐻"},
    {key: "birds", icon: "🦅"},
    {key: "marine", icon: "🌊"},
    {key: "venomous", icon: "🦂"},
    {key: "fastest", icon: "⚡"},
    {key: "defence", icon: "🛡"},
    {key: "strength", icon: "💥"}
];

function getEntrySearchText(entry: ChallengeEntry) {
    const species = entry.speciesSlugs.map((slug) => getSpeciesBySlug(slug));
    return [
        entry.title,
        entry.description,
        entry.quickVerdict,
        entry.slug,
        ...entry.searchIntents,
        ...entry.statCategories.flatMap((stat) => [stat.key, stat.label, stat.takeaway]),
        ...species.flatMap((animal) => animal ? [animal.name, animal.analysis.category, animal.analysis.habitat, animal.analysis.nativeRange] : [])
    ].join(" ").toLowerCase();
}

/** Lean search text for the client directory (no descriptions or takeaways). */
function getCardSearchText(entry: ChallengeEntry) {
    const names = entry.speciesSlugs.map((slug) => getSpeciesBySlug(slug)?.name);
    return [entry.title, entry.slug, entry.animalADisplayName, entry.animalBDisplayName, ...names, ...entry.searchIntents, ...entry.statCategories.map((stat) => stat.label)]
        .filter(Boolean).join(" ").toLowerCase();
}

/** The newest player battle on a pair, for the tile overlay; animal A's player first. */
function toCardBattle(slug: string): DirectoryCard["battle"] {
    const battles = getComparisonBattles(slug);
    const latest = battles[0];
    if (!latest) return undefined;
    const players = [latest.attacker, latest.defender]
        .map((player, index) => ({player, side: index === 0 ? "attacker" as const : "defender" as const}))
        .sort((left, right) => left.player.comparisonSide.localeCompare(right.player.comparisonSide));
    return {
        players: players.map(({player, side}) => ({name: player.displayName, avatarUrl: player.avatarUrl, won: latest.winner === side})),
        credits: latest.winner === "draw" ? 0 : latest.payout,
        count: battles.length
    };
}

function matchesQuickCategory(entry: ChallengeEntry, quick: QuickCategory) {
    if (quick === "popular") return true;

    const species = entry.speciesSlugs.map((slug) => getSpeciesBySlug(slug)).filter(Boolean);
    const categories = species.map((animal) => animal?.analysis.category.toLowerCase() || "").join(" ");
    const habitats = species.map((animal) => `${animal?.analysis.habitat || ""} ${animal?.analysis.nativeRange || ""}`.toLowerCase()).join(" ");
    const text = getEntrySearchText(entry);

    if (quick === "reptiles") return categories.includes("reptile");
    if (quick === "mammals") return categories.includes("mammal");
    if (quick === "birds") return categories.includes("bird");
    if (quick === "marine") return /marine|ocean|sea|reef|coast|estuary|saltwater/.test(`${categories} ${habitats}`);
    if (quick === "venomous") return /venom|cobra|viper|scorpion|spider/.test(text);
    if (quick === "fastest") return entry.comparisonType === "speed" || /speed|fast|acceleration|sprint/.test(text);
    if (quick === "defence") return entry.comparisonType === "durability" || /defen|armor|armour|shell|durability|protection/.test(text);
    if (quick === "strength") return entry.comparisonType === "strength" || /strength|power|force|grappl|bite/.test(text);
    return /predator|carnivore|hunter|ambush|apex|bird of prey/.test(text);
}

function getPopularityScore(entry: ChallengeEntry) {
    const featuredIndex = POPULAR_SLUGS.indexOf(entry.slug);
    const featuredScore = featuredIndex === -1 ? 0 : (POPULAR_SLUGS.length - featuredIndex) * 100;
    return featuredScore + (entry.relatedChallengeSlugs?.length || 0) * 5 + entry.searchIntents.length;
}

function getWinner(entry: ChallengeEntry) {
    const scenario = entry.scenarioBreakdown.find((item) => item.slug.includes("broad") || item.slug.includes("overall"))
        || entry.scenarioBreakdown.at(-1);
    const animalA = getSpeciesBySlug(entry.animalASlug);
    const animalB = getSpeciesBySlug(entry.animalBSlug);

    if (scenario?.winner === "animalA") return {kind: "winner" as const, label: animalA?.name || entry.animalASlug};
    if (scenario?.winner === "animalB") return {kind: "winner" as const, label: animalB?.name || entry.animalBSlug};
    return {kind: scenario?.winner === "draw" ? "draw" as const : "depends" as const, label: ""};
}

export async function generateMetadata({params}: ComparisonsIndexPageProps): Promise<Metadata> {
    const locale = params.locale;
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const challengeKeywords = Array.from(new Set(challengeEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.comparisons?.metaTitle || "Compare Any Two Animals | AnimalDex";
    const description = messages.comparisons?.metaDescription || messages.meta?.description || "";

    return {
        title: templateSafeTitle(title),
        description,
        keywords: [...baseKeywords, ...challengeKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/comparisons"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/comparisons");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/comparisons")} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title,
            description,
            url: getLocalePath(locale, "/comparisons"),
            images: [{url: contentThumb("comparisons-hub").src, width: contentThumb("comparisons-hub").width, height: contentThumb("comparisons-hub").height, alt: contentThumb("comparisons-hub").alt}]
        },
        twitter: {card: "summary_large_image", title, description, images: [contentThumb("comparisons-hub").src]}
    };
}

export default async function ComparisonsIndexPage({params}: ComparisonsIndexPageProps) {
    const locale = params.locale;
    const t = await getScopedTranslator(locale, "comparisons");
    // Hand-written pages plus published generated pairs from the build-time
    // snapshot (yarn refresh:published-seo); the hub stays static, no DB read.
    const allEntries = [
        ...challengeEntries,
        ...listSnapshotComparisons().filter((entry) => !challengeEntries.some((local) => local.slug === entry.slug))
    ];
    const animalOptions = animalOptionsFromChallengeEntries(allEntries).map((slug) => ({
        value: slug,
        label: getSpeciesBySlug(slug)?.name
            || allEntries.find((entry) => entry.animalASlug === slug)?.animalADisplayName
            || allEntries.find((entry) => entry.animalBSlug === slug)?.animalBDisplayName
            || slug.replace(/-/g, " ")
    }));
    const directoryCards: DirectoryCard[] = allEntries.map((entry) => {
        const winner = getWinner(entry);
        return {
            slug: entry.slug,
            title: entry.title,
            comparisonType: entry.comparisonType,
            typeLabel: t(`comparisonTypes.${entry.comparisonType}`),
            winnerLabel: winner.kind === "winner" ? t("winnerShort", {animal: winner.label}) : t(`winnerLabels.${winner.kind}`),
            image: {src: entry.featuredImage.src, alt: entry.featuredImage.alt, width: entry.featuredImage.width, height: entry.featuredImage.height},
            statLabels: entry.statCategories.slice(0, 3).map((stat) => stat.label),
            search: getCardSearchText(entry),
            quick: QUICK_CATEGORIES.map((category) => category.key).filter((key) => key === "battles"
                ? getComparisonBattles(entry.slug).length > 0
                : key !== "popular" && matchesQuickCategory(entry, key)),
            popularity: getPopularityScore(entry),
            date: entry.updatedAt || entry.publishedAt,
            speciesSlugs: entry.speciesSlugs,
            battle: toCardBattle(entry.slug)
        };
    });
    const firstPage = [...allEntries]
        .sort((left, right) => getPopularityScore(right) - getPopularityScore(left) || left.title.localeCompare(right.title))
        .slice(0, PAGE_SIZE);
    const comparisonTypeOptions = getChallengeComparisonTypeOptions();
    const starterAnimals = HUB_STARTER_SLUGS
        .map(toHubComparableAnimal)
        .filter((animal): animal is ComparableAnimal => Boolean(animal))
        .slice(0, 16);
    // Same catalog the picker searches and /animals lists.
    const comparableAnimalCount = publishedSeoSlugs.animals.length;
    const battleCount = Object.values(battlesSnapshot.battles).reduce((sum, list) => sum + list.length, 0);
    const defaultAnimalA = toHubComparableAnimal("lion");
    const defaultAnimalB = toHubComparableAnimal("tiger");
    const speciesCount = new Set(allEntries.flatMap((entry) => entry.speciesSlugs)).size;
    const categoryCount = new Set(allEntries.map((entry) => entry.comparisonType)).size;
    const featuredCandidates = POPULAR_SLUGS.map((slug) => allEntries.find((entry) => entry.slug === slug)).filter((entry): entry is ChallengeEntry => Boolean(entry));
    const featured = featuredCandidates[Math.floor(Math.random() * featuredCandidates.length)] || allEntries[0];
    const featuredWinner = featured ? getWinner(featured) : null;
    const recentEntries = [...allEntries]
        .sort((left, right) => (right.updatedAt || right.publishedAt).localeCompare(left.updatedAt || left.publishedAt))
        .slice(0, 3);
    const mostViewed = POPULAR_SLUGS.slice(0, 3).map((slug) => allEntries.find((entry) => entry.slug === slug)).filter((entry): entry is ChallengeEntry => Boolean(entry));
    const pageUrl = getAbsoluteUrl(locale, "/comparisons");
    const collectionSchema = {"@context": "https://schema.org", "@type": "CollectionPage", name: t("title"), description: t("description"), url: pageUrl, inLanguage: locale};
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: allEntries.length,
        itemListElement: firstPage.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, `/comparisons/${entry.slug}`),
            name: entry.title
        }))
    };
    const faqEntries = FAQ_KEYS.map((key) => ({
        question: t(`faqEntries.${key}.question`, {count: comparableAnimalCount}),
        answer: t(`faqEntries.${key}.answer`, {count: comparableAnimalCount})
    }));
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqEntries.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {"@type": "Answer", text: entry.answer}
        }))
    };
    const popularPairs = POPULAR_SLUGS
        .map((slug) => allEntries.find((entry) => entry.slug === slug))
        .filter((entry): entry is ChallengeEntry => Boolean(entry))
        .slice(0, 6);

    return (
        <main className="mx-auto w-full max-w-[92rem] px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema, faqSchema])}} />

            <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12">
                <header className="max-w-[42rem]">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-200">{t("eyebrow")}</p>
                    <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-white md:text-5xl">{t("title")}</h1>
                    <p className="mt-3 text-base leading-7 text-ink-200 md:text-lg">{t("description")}</p>
                    <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t("statAnimals")}</dt>
                            <dd className="font-display text-2xl font-bold text-white">{comparableAnimalCount.toLocaleString(locale)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t("statComparisons")}</dt>
                            <dd className="font-display text-2xl font-bold text-white">{allEntries.length.toLocaleString(locale)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">{t("statBattles")}</dt>
                            <dd className="font-display text-2xl font-bold text-white">{battleCount.toLocaleString(locale)}</dd>
                        </div>
                    </dl>
                </header>

                <div>
                    <ComparisonBuilder
                        basePath={getLocalePath(locale, "/comparisons")}
                        starterAnimals={starterAnimals}
                        defaultAnimalA={defaultAnimalA ?? starterAnimals[0] ?? null}
                        defaultAnimalB={defaultAnimalB ?? starterAnimals[1] ?? null}
                        animalCount={comparableAnimalCount}
                        copy={{
                            animalALabel: t("builder.animalA"),
                            animalBLabel: t("builder.animalB"),
                            choosePlaceholder: t("builder.choose"),
                            searchPlaceholder: t("builder.searchPlaceholder"),
                            searchingLabel: t("builder.searching"),
                            noMatchesLabel: t("builder.noMatches"),
                            swapLabel: t("builder.swap"),
                            randomLabel: t("builder.random"),
                            compareLabel: t("builder.compare"),
                            compareBusyLabel: t("builder.comparing"),
                            sameAnimalError: t("builder.sameAnimal"),
                            searchAllLabel: t("builder.searchAll", {count: "{count}"}),
                            popularLabel: t("builder.popular"),
                            resultsLabel: t("builder.results", {count: "{count}"}),
                            changeLabel: t("builder.change"),
                            doneLabel: t("builder.done"),
                        }}
                    />

                    {popularPairs.length ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{t("popularPairsLabel")}</span>
                            {popularPairs.map((entry) => (
                                <Link
                                    key={entry.slug}
                                    href={`/comparisons/${entry.slug}`}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-primary-400/50 hover:text-white"
                                >
                                    {entry.animalADisplayName || entry.animalASlug.replace(/-/g, " ")} vs {entry.animalBDisplayName || entry.animalBSlug.replace(/-/g, " ")}
                                </Link>
                            ))}
                        </div>
                    ) : null}

                    <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                        {HOW_IT_WORKS_KEYS.map((key, index) => (
                            <li key={key} className="  border border-white/8 bg-white/[0.025] p-4">
                                <span className="font-display text-sm font-black text-primary-300">0{index + 1}</span>
                                <p className="mt-1.5 text-sm font-bold text-white">{t(`howItWorks.${key}.title`)}</p>
                                <p className="mt-1 text-xs leading-5 text-ink-300">{t(`howItWorks.${key}.detail`)}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <div className="mt-14 flex items-end justify-between gap-4 border-t border-white/10 pt-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("browseEyebrow")}</p>
                    <h2 className="mt-1 font-display text-3xl font-bold text-white md:text-4xl">{t("browseTitle")}</h2>
                    <p className="mt-2 max-w-[42rem] text-sm leading-6 text-ink-300">{t("browseDescription", {count: allEntries.length})}</p>
                </div>
            </div>

            <ComparisonsDirectory
                cards={directoryCards}
                featuredSlug={featured?.slug ?? null}
                featured={featured ? (
                    <section className="theme-dark relative mt-9 overflow-hidden  border border-white/10 bg-surface-900 shadow-2xl shadow-black/25">
                        <Image
                            src={featured.featuredImage.src}
                            alt={featured.featuredImage.alt}
                            width={featured.featuredImage.width}
                            height={featured.featuredImage.height}
                            priority
                            sizes="(min-width: 1280px) 1400px, 100vw"
                            className="h-[23rem] w-full object-cover transition-transform duration-700 hover:scale-[1.015] md:h-[31rem]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 md:p-10 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full bg-primary-400 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-black">{t("featuredLabel")}</span>
                                    <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                                        {featuredWinner?.kind === "winner" ? t("winner", {animal: featuredWinner.label}) : t(`winnerLabels.${featuredWinner?.kind ?? "depends"}`)}
                                    </span>
                                </div>
                                <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white md:text-5xl">{featured.title}</h2>
                            </div>
                            <Link href={`/comparisons/${featured.slug}`} className="inline-flex w-fit items-center rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:bg-primary-100">
                                {t("readChallenge")} <span className="ml-2" aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </section>
                ) : null}
                aside={(
                    <aside className="hidden xl:block">
                        <div className="sticky top-24 space-y-7 border-l border-white/10 pl-6">
                            <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                                <div><strong className="block font-display text-3xl text-white">{allEntries.length}</strong><span className="text-sm text-ink-300">{t("sidebarComparisons")}</span></div>
                                <div><strong className="block font-display text-3xl text-white">{speciesCount}</strong><span className="text-sm text-ink-300">{t("sidebarSpecies")}</span></div>
                                <div><strong className="block font-display text-3xl text-white">{categoryCount}</strong><span className="text-sm text-ink-300">{t("sidebarCategories")}</span></div>
                            </div>
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("mostViewed")}</h2>
                                <ol className="mt-3 divide-y divide-white/10">
                                    {mostViewed.map((entry, index) => <li key={entry.slug}><Link href={`/comparisons/${entry.slug}`} className="flex gap-3 py-3 text-sm font-semibold leading-5 text-ink-200 hover:text-primary-100"><span className="text-ink-500">0{index + 1}</span><span>{entry.title}</span></Link></li>)}
                                </ol>
                            </div>
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("recentlyAdded")}</h2>
                                <div className="mt-3 space-y-3">
                                    {recentEntries.map((entry) => <Link key={entry.slug} href={`/comparisons/${entry.slug}`} className="block text-sm font-semibold leading-5 text-ink-200 hover:text-primary-100">{entry.title}</Link>)}
                                </div>
                            </div>
                        </div>
                    </aside>
                )}
                quickCategories={QUICK_CATEGORIES.map((category) => ({...category, label: t(`quickCategories.${category.key}`)}))}
                typeOptions={comparisonTypeOptions.map((option) => ({value: option, label: t(`comparisonTypes.${option}`)}))}
                animalOptions={animalOptions}
                pageSize={PAGE_SIZE}
                copy={{
                    quickFiltersLabel: t("quickFiltersLabel"),
                    searchLabel: t("searchLabel"),
                    searchPlaceholder: t("searchPlaceholder"),
                    comparisonTypeLabel: t("comparisonTypeLabel"),
                    allTypes: t("allTypes"),
                    animalLabel: t("animalLabel"),
                    allAnimals: t("allAnimals"),
                    sortLabel: t("sortLabel"),
                    sorts: {popular: t("sorts.popular"), newest: t("sorts.newest"), az: t("sorts.az")},
                    applyFilters: t("applyFilters"),
                    clearFilters: t("clearFilters"),
                    libraryLabel: t("libraryLabel"),
                    resultsFound: t("resultsFound", {count: "{count}"}),
                    noResultsTitle: t("noResultsTitle"),
                    noResultsDescription: t("noResultsDescription"),
                    paginationLabel: t("paginationLabel"),
                    previousPage: t("previousPage"),
                    nextPage: t("nextPage"),
                    openComparison: t("openComparison"),
                    battleCreditsWon: t("battleCreditsWon", {count: "{count}"}),
                    battleMore: t("battleMore", {count: "{count}"})
                }}
            />

            <section className="mt-16 grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
                <div>
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("indexFaqTitle")}</h2>
                    <p className="mt-3 text-ink-200">{t("indexFaqDescription")}</p>
                </div>
                <div className="divide-y divide-white/10  border border-white/10 bg-white/[0.03] px-5 md:px-7">
                    {faqEntries.map((entry) => (
                        <details key={entry.question} className="group py-5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white marker:hidden">
                                {entry.question}
                                <span className="text-primary-300 transition group-open:rotate-45" aria-hidden="true">+</span>
                            </summary>
                            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-200">{entry.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="mt-16  border border-white/10 bg-gradient-to-br from-white/[0.055] to-primary-400/[0.035] px-6 py-9 text-center md:px-10">
                <h2 className="font-display text-3xl font-bold text-white">{t("ctaTitle")}</h2>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink-200">{t("ctaDescription")}</p>
                <StoreLinks className="mt-6" />
            </section>
        </main>
    );
}
