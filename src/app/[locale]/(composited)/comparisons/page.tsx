import {Metadata} from "next";
import Image from "next/image";
import {getLocale, getTranslations} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {
    ChallengeEntry,
    ChallengeComparisonType,
    challengeEntries,
    getChallengeComparisonTypeOptions,
    isChallengeComparisonType
} from "@/data/challenges";
import {
    animalOptionsFromChallengeEntries,
    listMergedChallengeEntries
} from "@/data/species-comparisons";
import {getSpeciesBySlug} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type ComparisonSort = "popular" | "newest" | "az";
type QuickCategory = "popular" | "predators" | "reptiles" | "mammals" | "birds" | "marine" | "venomous" | "fastest" | "defence" | "strength";

type ComparisonsIndexPageProps = {
    searchParams?: {
        q?: string | string[];
        type?: string | string[];
        animal?: string | string[];
        sort?: string | string[];
        quick?: string | string[];
        page?: string | string[];
    };
};

type DirectoryState = {
    query: string;
    comparisonType: ChallengeComparisonType | "all";
    animal: string;
    sort: ComparisonSort;
    quick: QuickCategory;
    page: number;
};

const PAGE_SIZE = 12;
const POPULAR_SLUGS = [
    "tiger-vs-lion",
    "komodo-dragon-vs-king-cobra",
    "wolf-vs-hyena",
    "lion-vs-hyena",
    "crocodile-vs-shark",
    "gorilla-vs-tiger"
];
const QUICK_CATEGORIES: Array<{key: QuickCategory; icon: string}> = [
    {key: "popular", icon: "🔥"},
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

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function isComparisonSort(value?: string): value is ComparisonSort {
    return value === "popular" || value === "newest" || value === "az";
}

function isQuickCategory(value?: string): value is QuickCategory {
    return QUICK_CATEGORIES.some((category) => category.key === value);
}

function buildComparisonsIndexHref(state: DirectoryState) {
    const params = new URLSearchParams();

    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.comparisonType !== "all") params.set("type", state.comparisonType);
    if (state.animal !== "all") params.set("animal", state.animal);
    if (state.sort !== "popular") params.set("sort", state.sort);
    if (state.quick !== "popular") params.set("quick", state.quick);
    if (state.page > 1) params.set("page", String(state.page));

    const queryString = params.toString();
    return queryString ? `/comparisons?${queryString}` : "/comparisons";
}

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

function getDirectoryEntries(state: DirectoryState, sourceEntries: ChallengeEntry[]) {
    const normalizedQuery = state.query.trim().toLowerCase();
    const filtered = sourceEntries.filter((entry) => {
        if (state.comparisonType !== "all" && entry.comparisonType !== state.comparisonType) return false;
        if (state.animal !== "all" && !entry.speciesSlugs.includes(state.animal)) return false;
        if (!matchesQuickCategory(entry, state.quick)) return false;
        return !normalizedQuery || getEntrySearchText(entry).includes(normalizedQuery);
    });

    filtered.sort((left, right) => {
        if (state.sort === "az") return left.title.localeCompare(right.title);
        if (state.sort === "newest") {
            return (right.updatedAt || right.publishedAt).localeCompare(left.updatedAt || left.publishedAt)
                || right.publishedAt.localeCompare(left.publishedAt)
                || left.title.localeCompare(right.title);
        }
        return getPopularityScore(right) - getPopularityScore(left) || left.title.localeCompare(right.title);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, state.page), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;

    return {entries: filtered.slice(start, start + PAGE_SIZE), total, totalPages, currentPage};
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

function getPageNumbers(currentPage: number, totalPages: number) {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({length: end - start + 1}, (_, index) => start + index);
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const mergedEntries = await listMergedChallengeEntries().catch(() => challengeEntries);
    const challengeKeywords = Array.from(new Set(mergedEntries.flatMap((entry) => entry.searchIntents)));
    const title = messages.comparisons?.metaTitle || "Animal Comparisons | AnimalDex";
    const description = messages.comparisons?.metaDescription || messages.meta?.description || "";

    return {
        title,
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
            images: [{url: "/images/placeholders/more-challenges.svg", width: 1200, height: 675, alt: title}]
        },
        twitter: {card: "summary_large_image", title, description, images: ["/images/placeholders/more-challenges.svg"]}
    };
}

export default async function ComparisonsIndexPage({searchParams}: ComparisonsIndexPageProps) {
    const t = await getTranslations("comparisons");
    const locale = await getLocale();
    const allEntries = await listMergedChallengeEntries().catch(() => challengeEntries);
    const animalOptions = animalOptionsFromChallengeEntries(allEntries);
    const query = getSingleParam(searchParams?.q) ?? "";
    const typeParam = getSingleParam(searchParams?.type);
    const animalParam = getSingleParam(searchParams?.animal);
    const sortParam = getSingleParam(searchParams?.sort);
    const quickParam = getSingleParam(searchParams?.quick);
    const pageParam = Number.parseInt(getSingleParam(searchParams?.page) ?? "1", 10);
    const state: DirectoryState = {
        query,
        comparisonType: typeParam && isChallengeComparisonType(typeParam) ? typeParam : "all",
        animal: animalParam && animalOptions.includes(animalParam) ? animalParam : "all",
        sort: isComparisonSort(sortParam) ? sortParam : "popular",
        quick: isQuickCategory(quickParam) ? quickParam : "popular",
        page: Number.isFinite(pageParam) ? pageParam : 1
    };
    const directory = getDirectoryEntries(state, allEntries);
    state.page = directory.currentPage;
    const comparisonTypeOptions = getChallengeComparisonTypeOptions();
    const speciesCount = new Set(allEntries.flatMap((entry) => entry.speciesSlugs)).size;
    const categoryCount = new Set(allEntries.map((entry) => entry.comparisonType)).size;
    const featuredCandidates = POPULAR_SLUGS.map((slug) => allEntries.find((entry) => entry.slug === slug)).filter((entry): entry is ChallengeEntry => Boolean(entry));
    const featured = featuredCandidates[Math.floor(Math.random() * featuredCandidates.length)] || allEntries[0];
    const showFeatured = state.page === 1 && !state.query && state.comparisonType === "all" && state.animal === "all" && state.quick === "popular";
    const gridEntries = showFeatured ? directory.entries.filter((entry) => entry.slug !== featured.slug) : directory.entries;
    const featuredWinner = getWinner(featured);
    const recentEntries = [...allEntries]
        .sort((left, right) => (right.updatedAt || right.publishedAt).localeCompare(left.updatedAt || left.publishedAt))
        .slice(0, 3);
    const mostViewed = POPULAR_SLUGS.slice(0, 3).map((slug) => allEntries.find((entry) => entry.slug === slug)).filter((entry): entry is ChallengeEntry => Boolean(entry));
    const pageUrl = getAbsoluteUrl(locale, "/comparisons");
    const collectionSchema = {"@context": "https://schema.org", "@type": "CollectionPage", name: t("title"), description: t("description"), url: pageUrl, inLanguage: locale};
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: directory.total,
        itemListElement: directory.entries.map((entry, index) => ({
            "@type": "ListItem",
            position: (directory.currentPage - 1) * PAGE_SIZE + index + 1,
            url: getAbsoluteUrl(locale, `/comparisons/${entry.slug}`),
            name: entry.title
        }))
    };

    return (
        <main className="mx-auto w-full max-w-[92rem] px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <header className="max-w-[46rem]">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-200">{t("eyebrow")}</p>
                <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-white md:text-5xl">{t("title")}</h1>
                <p className="mt-3 max-w-[42rem] text-base leading-7 text-ink-200 md:text-lg">{t("description")}</p>
                <p className="mt-5 text-sm font-semibold text-white">{t("comparisonCount", {count: allEntries.length})}</p>
            </header>

            {showFeatured ? (
                <section className="relative mt-9 overflow-hidden rounded-[2rem] border border-white/10 bg-surface-900 shadow-2xl shadow-black/25">
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
                                    {featuredWinner.kind === "winner" ? t("winner", {animal: featuredWinner.label}) : t(`winnerLabels.${featuredWinner.kind}`)}
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

            <nav aria-label={t("quickFiltersLabel")} className="mt-9 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_CATEGORIES.map((category) => {
                    const active = state.quick === category.key;
                    return (
                        <Link
                            key={category.key}
                            href={buildComparisonsIndexHref({...state, quick: category.key, page: 1})}
                            aria-current={active ? "page" : undefined}
                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-primary-400/60 bg-primary-400/15 text-primary-100" : "border-white/10 bg-white/[0.035] text-ink-200 hover:border-white/25 hover:text-white"}`}
                        >
                            <span className="mr-2" aria-hidden="true">{category.icon}</span>{t(`quickCategories.${category.key}`)}
                        </Link>
                    );
                })}
            </nav>

            <div className="sticky top-3 z-30 mt-4 rounded-2xl border border-white/10 bg-[#111713]/90 p-2 shadow-xl shadow-black/20 backdrop-blur-xl md:top-5">
                <form action={getLocalePath(locale, "/comparisons")} method="get" className="grid gap-2 md:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(9rem,0.65fr))_auto_auto]">
                    {state.quick !== "popular" ? <input type="hidden" name="quick" value={state.quick} /> : null}
                    <label className="relative">
                        <span className="sr-only">{t("searchLabel")}</span>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true">⌕</span>
                        <input name="q" defaultValue={state.query} placeholder={t("searchPlaceholder")} className="h-11 w-full rounded-xl border border-transparent bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-ink-400 focus:border-primary-400/60" />
                    </label>
                    <label>
                        <span className="sr-only">{t("comparisonTypeLabel")}</span>
                        <select name="type" defaultValue={state.comparisonType} className="h-11 w-full rounded-xl border border-transparent bg-black/20 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            <option value="all">{t("allTypes")}</option>
                            {comparisonTypeOptions.map((option) => <option key={option} value={option}>{t(`comparisonTypes.${option}`)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">{t("animalLabel")}</span>
                        <select name="animal" defaultValue={state.animal} className="h-11 w-full rounded-xl border border-transparent bg-black/20 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            <option value="all">{t("allAnimals")}</option>
                            {animalOptions.map((option) => <option key={option} value={option}>{getSpeciesBySlug(option)?.name || option}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">{t("sortLabel")}</span>
                        <select name="sort" defaultValue={state.sort} className="h-11 w-full rounded-xl border border-transparent bg-black/20 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            <option value="popular">{t("sorts.popular")}</option>
                            <option value="newest">{t("sorts.newest")}</option>
                            <option value="az">{t("sorts.az")}</option>
                        </select>
                    </label>
                    <button type="submit" className="h-11 rounded-xl bg-primary-400 px-5 text-sm font-bold text-black transition hover:bg-primary-300">{t("applyFilters")}</button>
                    <Link href="/comparisons" className="flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-ink-300 transition hover:bg-white/5 hover:text-white">{t("clearFilters")}</Link>
                </form>
            </div>

            <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
                <section>
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("libraryLabel")}</p>
                            <h2 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">{t("resultsFound", {count: directory.total})}</h2>
                        </div>
                    </div>

                    {gridEntries.length ? (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                            {gridEntries.map((entry, index) => {
                                const winner = getWinner(entry);
                                const wide = index % 6 === 0;
                                return (
                                    <article key={entry.slug} className={`group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:border-primary-400/35 hover:shadow-[0_20px_50px_rgba(0,0,0,0.32)] ${wide ? "md:col-span-12 xl:col-span-8" : "md:col-span-6 xl:col-span-4"}`}>
                                        <Link href={`/comparisons/${entry.slug}`} className="relative block overflow-hidden">
                                            <Image src={entry.featuredImage.src} alt={entry.featuredImage.alt} width={entry.featuredImage.width} height={entry.featuredImage.height} sizes={wide ? "(min-width:1280px) 60vw, 100vw" : "(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"} className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${wide ? "h-72 md:h-96" : "h-64 md:h-72"}`} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/5 to-black/30" />
                                            <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">{t(`comparisonTypes.${entry.comparisonType}`)}</span>
                                            <span className="absolute right-4 top-4 rounded-full bg-primary-400/90 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-black">
                                                {winner.kind === "winner" ? t("winnerShort", {animal: winner.label}) : t(`winnerLabels.${winner.kind}`)}
                                            </span>
                                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-5xl font-black italic tracking-[-0.08em] text-white/90 drop-shadow-xl" aria-hidden="true">VS</span>
                                            <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                                                <h3 className={`font-display font-bold leading-tight text-white ${wide ? "text-3xl md:text-4xl" : "text-2xl"}`}>{entry.title}</h3>
                                            </div>
                                        </Link>
                                        <div className="flex items-center justify-between gap-3 px-5 py-4">
                                            <div className="flex min-w-0 gap-3 overflow-hidden text-xs font-semibold uppercase tracking-[0.12em] text-ink-300">
                                                {entry.statCategories.slice(0, 3).map((stat) => <span key={stat.key} className="truncate">{stat.label}</span>)}
                                            </div>
                                            <span className="shrink-0 text-sm font-bold text-primary-200 transition group-hover:translate-x-0.5">{t("openComparison")} →</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] px-6 py-14 text-center">
                            <h2 className="font-display text-3xl font-bold text-white">{t("noResultsTitle")}</h2>
                            <p className="mt-3 text-ink-200">{t("noResultsDescription")}</p>
                            <Link href="/comparisons" className="mt-6 inline-flex rounded-full bg-primary-400 px-5 py-3 text-sm font-bold text-black">{t("clearFilters")}</Link>
                        </div>
                    )}

                    {directory.totalPages > 1 ? (
                        <nav aria-label={t("paginationLabel")} className="mt-9 flex flex-wrap items-center justify-center gap-2">
                            {directory.currentPage > 1 ? <Link href={buildComparisonsIndexHref({...state, page: directory.currentPage - 1})} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-white/25 hover:text-white">{t("previousPage")}</Link> : null}
                            {getPageNumbers(directory.currentPage, directory.totalPages).map((page) => <Link key={page} href={buildComparisonsIndexHref({...state, page})} aria-current={page === directory.currentPage ? "page" : undefined} className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${page === directory.currentPage ? "bg-primary-400 text-black" : "border border-white/10 text-ink-200 hover:border-white/25 hover:text-white"}`}>{page}</Link>)}
                            {directory.currentPage < directory.totalPages ? <Link href={buildComparisonsIndexHref({...state, page: directory.currentPage + 1})} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-white/25 hover:text-white">{t("nextPage")}</Link> : null}
                        </nav>
                    ) : null}
                </section>

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
            </div>

            <section className="mt-16 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.055] to-primary-400/[0.035] px-6 py-9 text-center md:px-10">
                <h2 className="font-display text-3xl font-bold text-white">{t("ctaTitle")}</h2>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink-200">{t("ctaDescription")}</p>
                <StoreLinks className="mt-6" />
            </section>
        </main>
    );
}
