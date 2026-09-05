import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import ExploreKnowledgeLinks from "@/app/[locale]/(composited)/_components/explore-knowledge-links";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getBehaviorLessonIndex, SpeciesBehaviorLesson} from "@/data/species-behavior-lessons";
import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type LessonTag = "popular" | "leadership" | "wisdom" | "teamwork" | "adaptation" | "survival" | "focus" | "intelligence" | "engineering" | "cooperation" | "patience";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

type AnimalLessonsPageProps = {
    params: {locale: string};
};

type LessonCollection = {
    key: string;
    title: string;
    description: string;
    lessons: SpeciesBehaviorLesson[];
};

const PAGE_SIZE = 18;
const FEATURED_SLUGS = ["common-kingfisher", "octopus", "wolf", "honey-bee", "elephant", "barn-owl", "red-fox"];
const POPULAR_SLUGS = ["wolf", "barn-owl", "red-fox", "elephant", "octopus", "honey-bee", "common-kingfisher"];
const TAGS: Array<{key: LessonTag; icon: string}> = [
    {key: "popular", icon: "🔥"},
    {key: "leadership", icon: "🦁"},
    {key: "wisdom", icon: "🦉"},
    {key: "teamwork", icon: "🐜"},
    {key: "adaptation", icon: "🦎"},
    {key: "survival", icon: "🐺"},
    {key: "focus", icon: "🦅"},
    {key: "intelligence", icon: "🐙"},
    {key: "engineering", icon: "🦫"},
    {key: "cooperation", icon: "🐝"},
    {key: "patience", icon: "🐢"}
];

const TAG_PATTERNS: Record<Exclude<LessonTag, "popular">, RegExp> = {
    leadership: /leadership|lead|authority|confidence|command|protect the group|decisive/,
    wisdom: /wisdom|memory|experience|observation|judgment|knowledge|awareness/,
    teamwork: /teamwork|team|coordination|collective|pack|colony|shared effort/,
    adaptation: /adapt|flexib|change|versatil|adjust|conditions shift|resourceful/,
    survival: /survival|resilien|endurance|danger|defen|protect|persist|risk/,
    focus: /focus|precision|attention|timing|patient observation|concentrat/,
    intelligence: /intelligen|problem.solv|learning|cognition|strategy|creative|curiosity/,
    engineering: /engineer|build|structure|design|architecture|tool|construct|system/,
    cooperation: /cooperat|communicat|social|mutual|community|colony|collaborat/,
    patience: /patience|patient|wait|stillness|restraint|timing|slow|persistence/
};

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function isLessonTag(value?: string): value is LessonTag {
    return TAGS.some((tag) => tag.key === value);
}

function lessonText(lesson: SpeciesBehaviorLesson) {
    return [
        lesson.displayName,
        lesson.slug,
        lesson.principleName,
        lesson.principleExpression,
        lesson.coreLesson,
        lesson.biologicalBasis,
        lesson.shortMotto,
        lesson.applicationExample,
        ...lesson.bestUseCases
    ].filter(Boolean).join(" ").toLowerCase();
}

function scoreLesson(lesson: SpeciesBehaviorLesson, pattern: RegExp) {
    const text = lessonText(lesson);
    const matches = text.match(new RegExp(pattern.source, "g"));
    return (matches?.length || 0) * 10 + lesson.bestUseCases.length + (lesson.applicationExample ? 2 : 0);
}

function buildLessonsHref({query, tag, page}: {query: string; tag: LessonTag; page: number}) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (tag !== "popular") params.set("tag", tag);
    if (page > 1) params.set("page", String(page));
    const queryString = params.toString();
    return queryString ? `/animal-lessons?${queryString}` : "/animal-lessons";
}

function getDailyIndex(length: number, offset = 0) {
    if (!length) return 0;
    const now = new Date();
    const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
    return (day + offset) % length;
}

function getImageAlt(lesson: SpeciesBehaviorLesson) {
    const species = getSpeciesBySlug(lesson.slug);
    return species ? getSpeciesImageAltText(species, "thumbnail") : `${lesson.displayName} animal lesson on AnimalDex`;
}

function pickBySlugs(lessons: SpeciesBehaviorLesson[], slugs: string[]) {
    return slugs.map((slug) => lessons.find((lesson) => lesson.slug === slug)).filter((lesson): lesson is SpeciesBehaviorLesson => Boolean(lesson));
}

function pickCollectionLessons(
    lessons: SpeciesBehaviorLesson[],
    used: Set<string>,
    pattern: RegExp,
    limit = 5
) {
    const selected = lessons
        .map((lesson) => ({lesson, score: scoreLesson(lesson, pattern)}))
        .filter(({lesson, score}) => score > lesson.bestUseCases.length && !used.has(lesson.slug))
        .sort((left, right) => right.score - left.score || left.lesson.displayName.localeCompare(right.lesson.displayName))
        .slice(0, limit)
        .map(({lesson}) => lesson);
    selected.forEach((lesson) => used.add(lesson.slug));
    return selected;
}

function LessonCard({lesson, wide = false, readLabel}: {lesson: SpeciesBehaviorLesson; wide?: boolean; readLabel: string}) {
    return (
        <article className={`group overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:border-primary-400/35 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${wide ? "md:col-span-2" : ""}`}>
            <Link href={`/animal-lessons/${lesson.slug}`} className="relative block overflow-hidden">
                <SpeciesArtworkImage
                    slug={lesson.slug}
                    imageFile={lesson.imageFile}
                    alt={getImageAlt(lesson)}
                    className={`w-full transition-transform duration-700 group-hover:scale-105 ${wide ? "h-72 md:h-80" : "h-64"}`}
                    sizes={wide ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 28vw, (min-width: 768px) 50vw, 100vw"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-100">{lesson.principleName}</p>
                    <h3 className={`mt-2 font-display font-bold leading-none text-white ${wide ? "text-4xl" : "text-3xl"}`}>{lesson.displayName}</h3>
                </div>
            </Link>
            <div className="flex min-h-[9.5rem] flex-col p-5">
                <p className="line-clamp-2 text-sm leading-6 text-ink-200">{lesson.shortMotto || lesson.coreLesson}</p>
                {lesson.bestUseCases.length ? (
                    <div className="mt-4 flex gap-2 overflow-hidden">
                        {lesson.bestUseCases.slice(0, 2).map((item) => <span key={item} className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs text-ink-300">{item}</span>)}
                    </div>
                ) : null}
                <Link href={`/animal-lessons/${lesson.slug}`} className="mt-auto pt-4 text-sm font-bold text-primary-200 transition group-hover:translate-x-0.5">{readLabel} →</Link>
            </div>
        </article>
    );
}

function CollectionSection({collection, readLabel}: {collection: LessonCollection; readLabel: string}) {
    if (!collection.lessons.length) return null;
    return (
        <section>
            <div className="mb-5 max-w-2xl">
                <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">{collection.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-300 md:text-base">{collection.description}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {collection.lessons.map((lesson, index) => <LessonCard key={lesson.slug} lesson={lesson} wide={index === 0} readLabel={readLabel} />)}
            </div>
        </section>
    );
}

function getPageNumbers(currentPage: number, totalPages: number) {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({length: end - start + 1}, (_, index) => start + index);
}

export async function generateMetadata({params}: AnimalLessonsPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const pageDescription = t("metaDescription");
    return {
        title: t("metaTitle"),
        description: pageDescription,
        keywords: ["animal lessons", "lessons from animals", "animal behavior lessons", "biology backed lessons"],
        alternates: {
            canonical: getLocalePath(params.locale, "/animal-lessons"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/animal-lessons");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/animal-lessons")} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(params.locale),
            title: t("metaTitle"),
            description: pageDescription,
            url: getLocalePath(params.locale, "/animal-lessons"),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: t("metaTitle")}]
        }
    };
}

export default async function AnimalLessonsPage({params}: AnimalLessonsPageProps) {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lessons = await getBehaviorLessonIndex();
    const query = "";
    const activeTag: LessonTag = "popular";
    const requestedPage = 1;
    const isFiltering = Boolean(query.trim()) || activeTag !== "popular";
    const normalizedQuery = query.trim().toLowerCase();
    const filteredLessons = lessons
        .filter((lesson) => !normalizedQuery || lessonText(lesson).includes(normalizedQuery))
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
    const totalPages = Math.max(1, Math.ceil(filteredLessons.length / PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1), totalPages);
    const paginatedLessons = filteredLessons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const principlesCount = new Set(lessons.map((lesson) => lesson.principleName)).size;
    const qualitiesCount = new Set(lessons.flatMap((lesson) => lesson.bestUseCases.map((item) => item.toLowerCase().trim())).filter(Boolean)).size;
    const featuredCandidates = pickBySlugs(lessons, FEATURED_SLUGS);
    const featured = featuredCandidates[getDailyIndex(featuredCandidates.length)] || lessons[getDailyIndex(lessons.length)];
    const surpriseLesson = lessons[getDailyIndex(lessons.length, 19)] || featured;
    const popularLessons = pickBySlugs(lessons, POPULAR_SLUGS);
    const recentLessons = lessons.filter((lesson) => lesson.source === "catalog").slice(-3).reverse();
    const principleFrequency = lessons.reduce((counts, lesson) => counts.set(lesson.principleName, (counts.get(lesson.principleName) || 0) + 1), new Map<string, number>());
    const featuredPrinciple = Array.from(principleFrequency.entries()).sort((left, right) => right[1] - left[1])[0];
    const used = new Set<string>(featured ? [featured.slug] : []);
    const trendingLessons = popularLessons.filter((lesson) => !used.has(lesson.slug)).slice(0, 5);
    trendingLessons.forEach((lesson) => used.add(lesson.slug));
    const editorPicks = pickBySlugs(lessons, ["common-kingfisher", "dung-beetle", "fennec-fox", "rhinoceros-beetle", "rainbow-bee-eater"]).filter((lesson) => !used.has(lesson.slug));
    editorPicks.forEach((lesson) => used.add(lesson.slug));
    const collections: LessonCollection[] = [
        {key: "trending", title: t("collections.trending.title"), description: t("collections.trending.description"), lessons: trendingLessons},
        {key: "editors", title: t("collections.editors.title"), description: t("collections.editors.description"), lessons: editorPicks},
        {key: "practical", title: t("collections.practical.title"), description: t("collections.practical.description"), lessons: pickCollectionLessons(lessons, used, /practical|daily|decision|work|planning|focus|patience|adapt|communicat/)},
        {key: "leadership", title: t("collections.leadership.title"), description: t("collections.leadership.description"), lessons: pickCollectionLessons(lessons, used, TAG_PATTERNS.leadership)},
        {key: "problemSolving", title: t("collections.problemSolving.title"), description: t("collections.problemSolving.description"), lessons: pickCollectionLessons(lessons, used, /problem.solv|intelligen|strategy|creative|tool|learning|resourceful/)},
        {key: "engineering", title: t("collections.engineering.title"), description: t("collections.engineering.description"), lessons: pickCollectionLessons(lessons, used, TAG_PATTERNS.engineering)},
        {key: "communication", title: t("collections.communication.title"), description: t("collections.communication.description"), lessons: pickCollectionLessons(lessons, used, /communicat|signal|social|cooperat|team|community/)},
        {key: "survival", title: t("collections.survival.title"), description: t("collections.survival.description"), lessons: pickCollectionLessons(lessons, used, TAG_PATTERNS.survival)},
        {key: "family", title: t("collections.family.title"), description: t("collections.family.description"), lessons: pickCollectionLessons(lessons, used, /parent|child|young|family|teach|nurtur|care|protect the group/)},
        {key: "surprising", title: t("collections.surprising.title"), description: t("collections.surprising.description"), lessons: pickCollectionLessons(lessons, used, /unexpected|surpris|unusual|remarkable|hidden|ingenious|specialized/)}
    ];
    const schemaPath = isFiltering ? buildLessonsHref({query, tag: activeTag, page: currentPage}) : "/animal-lessons";
    const schemaLessons = isFiltering ? paginatedLessons : collections.flatMap((collection) => collection.lessons);
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: getAbsoluteUrl(params.locale, schemaPath),
        numberOfItems: filteredLessons.length,
        hasPart: schemaLessons.map((lesson) => ({"@type": "Article", headline: t("detailHeroTitle", {animal: lesson.displayName}), description: lesson.coreLesson, url: getAbsoluteUrl(params.locale, `/animal-lessons/${lesson.slug}`) }))
    };

    return (
        <main className="mx-auto w-full max-w-[92rem] px-4 pb-20 pt-10 md:px-8 md:pb-28 md:pt-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <header className="max-w-[48rem]">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-200">{t("eyebrow")}</p>
                <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-white md:text-5xl">{t("title")}</h1>
                <p className="mt-5 text-sm font-semibold text-white">{t("lessonCount", {count: lessons.length})}</p>
            </header>

            <section className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4"><strong className="block font-display text-2xl text-white">{lessons.length.toLocaleString(params.locale)}</strong><span className="text-sm text-ink-300">{t("stats.animals")}</span></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4"><strong className="block font-display text-2xl text-white">{principlesCount.toLocaleString(params.locale)}</strong><span className="text-sm text-ink-300">{t("stats.principles")}</span></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4"><strong className="block font-display text-2xl text-white">100%</strong><span className="text-sm text-ink-300">{t("stats.biology")}</span></div>
            </section>

            {!isFiltering && featured ? (
                <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-surface-900 shadow-2xl shadow-black/25">
                    <SpeciesArtworkImage slug={featured.slug} imageFile={featured.imageFile} alt={getImageAlt(featured)} priority className="h-[24rem] w-full md:h-[34rem]" sizes="(min-width: 1280px) 1400px, 100vw" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/35 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 max-w-3xl p-6 md:p-10">
                        <span className="rounded-full bg-primary-400 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-black">{t("featuredEyebrow")}</span>
                        <h2 className="mt-4 font-display text-4xl font-bold text-white md:text-6xl">{featured.displayName}</h2>
                        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-100">{t("learnLabel")} {featured.principleName}</p>
                        <p className="mt-3 line-clamp-2 max-w-2xl text-base leading-7 text-ink-100 md:text-lg">{featured.applicationExample || featured.coreLesson}</p>
                        <Link href={`/animal-lessons/${featured.slug}`} className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:bg-primary-100">{t("openLesson")} →</Link>
                    </div>
                </section>
            ) : null}

            <section className="mt-8">
                <form action={getLocalePath(params.locale, "/animal-lessons")} method="get" className="relative">
                    {activeTag !== "popular" ? <input type="hidden" name="tag" value={activeTag} /> : null}
                    <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xl text-ink-400" aria-hidden="true">⌕</span>
                    <input name="q" defaultValue={query} aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="h-16 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-14 pr-32 text-base text-white shadow-xl shadow-black/10 outline-none placeholder:text-ink-400 focus:border-primary-400/60 md:text-lg" />
                    <button type="submit" className="absolute right-2 top-2 h-12 rounded-xl bg-primary-400 px-6 text-sm font-bold text-black transition hover:bg-primary-300">{t("searchButton")}</button>
                </form>
                <nav aria-label={t("popularTagsLabel")} className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {TAGS.map((tag) => {
                        const active = activeTag === tag.key;
                        return <Link key={tag.key} href={buildLessonsHref({query, tag: tag.key, page: 1})} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-primary-400/60 bg-primary-400/15 text-primary-100" : "border-white/10 bg-white/[0.03] text-ink-200 hover:border-white/25 hover:text-white"}`}><span className="mr-2" aria-hidden="true">{tag.icon}</span>{t(`tags.${tag.key}`)}</Link>;
                    })}
                </nav>
            </section>

            <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="space-y-16">
                    {isFiltering ? (
                        <section>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("searchResultsLabel")}</p>
                            <h2 className="mt-1 font-display text-3xl font-bold text-white">{t("resultsFound", {count: filteredLessons.length})}</h2>
                            {paginatedLessons.length ? (
                                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {paginatedLessons.map((lesson, index) => <LessonCard key={lesson.slug} lesson={lesson} wide={index % 9 === 0} readLabel={t("openLesson")} />)}
                                </div>
                            ) : (
                                <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.035] px-6 py-12 text-center">
                                    <h2 className="font-display text-3xl font-bold text-white">{t("noResultsTitle")}</h2>
                                    <p className="mt-3 text-ink-200">{t("noResultsDescription")}</p>
                                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                                        {["Lion", "Fox", "Owl", "Eagle", "Teamwork", "Focus"].map((suggestion) => <Link key={suggestion} href={`/animal-lessons?q=${encodeURIComponent(suggestion)}`} className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-200 hover:border-primary-400/50 hover:text-white">{suggestion}</Link>)}
                                    </div>
                                </div>
                            )}
                            {totalPages > 1 ? (
                                <nav aria-label={t("paginationLabel")} className="mt-9 flex flex-wrap items-center justify-center gap-2">
                                    {currentPage > 1 ? <Link href={buildLessonsHref({query, tag: activeTag, page: currentPage - 1})} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:text-white">{t("previousPage")}</Link> : null}
                                    {getPageNumbers(currentPage, totalPages).map((page) => <Link key={page} href={buildLessonsHref({query, tag: activeTag, page})} aria-current={page === currentPage ? "page" : undefined} className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${page === currentPage ? "bg-primary-400 text-black" : "border border-white/10 text-ink-200 hover:text-white"}`}>{page}</Link>)}
                                    {currentPage < totalPages ? <Link href={buildLessonsHref({query, tag: activeTag, page: currentPage + 1})} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:text-white">{t("nextPage")}</Link> : null}
                                </nav>
                            ) : null}
                        </section>
                    ) : collections.map((collection) => <CollectionSection key={collection.key} collection={collection} readLabel={t("openLesson")} />)}
                </div>

                <aside className="hidden xl:block">
                    <div className="sticky top-24 space-y-7 border-l border-white/10 pl-6">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("sidebar.trending")}</h2>
                            <ol className="mt-3 divide-y divide-white/10">{popularLessons.slice(0, 3).map((lesson, index) => <li key={lesson.slug}><Link href={`/animal-lessons/${lesson.slug}`} className="flex gap-3 py-3 text-sm font-semibold text-ink-200 hover:text-primary-100"><span className="text-ink-500">0{index + 1}</span><span>{lesson.displayName}</span></Link></li>)}</ol>
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("sidebar.recent")}</h2>
                            <div className="mt-3 space-y-3">{recentLessons.map((lesson) => <Link key={lesson.slug} href={`/animal-lessons/${lesson.slug}`} className="block text-sm font-semibold text-ink-200 hover:text-primary-100">{lesson.displayName}</Link>)}</div>
                        </div>
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("sidebar.mostViewed")}</h2>
                            <div className="mt-3 space-y-3">{popularLessons.slice(3, 6).map((lesson) => <Link key={lesson.slug} href={`/animal-lessons/${lesson.slug}`} className="block text-sm font-semibold text-ink-200 hover:text-primary-100">{lesson.displayName}</Link>)}</div>
                        </div>
                        {featuredPrinciple ? <div className="rounded-2xl border border-primary-400/20 bg-primary-400/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-200">{t("sidebar.featuredPrinciple")}</p><p className="mt-2 font-display text-xl font-bold text-white">{featuredPrinciple[0]}</p><p className="mt-1 text-sm text-ink-300">{t("sidebar.lessonCount", {count: featuredPrinciple[1]})}</p></div> : null}
                        {surpriseLesson ? <div><h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{t("sidebar.randomAnimal")}</h2><p className="mt-3 font-display text-xl font-bold text-white">{surpriseLesson.displayName}</p><p className="mt-1 text-sm text-ink-300">{surpriseLesson.principleName}</p><Link href={`/animal-lessons/${surpriseLesson.slug}`} className="mt-4 inline-flex rounded-full bg-primary-400 px-4 py-2 text-sm font-bold text-black">{t("sidebar.surpriseMe")} →</Link></div> : null}
                    </div>
                </aside>
            </div>

            <section className="mt-16 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.055] to-primary-400/[0.035] p-7 md:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-200">{t("strategyEyebrow")}</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-white">{t("strategyTitle")}</h2>
                <p className="mt-3 max-w-3xl text-ink-200">{t("strategyDescription")}</p>
                <Link href="/powers" className="mt-5 inline-flex font-bold text-primary-200 hover:text-primary-100">{t("strategyLink")} →</Link>
            </section>

            <div className="mt-10">
                <ExploreKnowledgeLinks title={t("exploreTitle")} description={t("exploreDescription")} labels={{species: t("exploreSpecies"), lessons: t("exploreLessons"), symbolism: t("exploreSymbolism")}} />
            </div>
        </main>
    );
}
