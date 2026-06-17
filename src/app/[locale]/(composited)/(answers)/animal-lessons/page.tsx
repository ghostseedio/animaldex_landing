import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import ExploreKnowledgeLinks from "@/app/[locale]/(composited)/_components/explore-knowledge-links";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getBehaviorLessonIndex} from "@/data/species-behavior-lessons";
import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type AnimalLessonsPageProps = {
    params: {
        locale: string;
    };
    searchParams?: {
        letter?: string | string[];
        page?: string | string[];
    };
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function getLetterHref(letter: string) {
    return letter === "all" ? "/animal-lessons" : `/animal-lessons?letter=${letter}`;
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
                acc[localeItem] = `/${localeItem}/animal-lessons`;
                return acc;
            }, {"x-default": `/${localeConfig.defaultLocale}/animal-lessons`} as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(params.locale),
            title: t("metaTitle"),
            description: pageDescription,
            url: getLocalePath(params.locale, "/animal-lessons"),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: t("metaTitle")}]
        }
    };
}

export default async function AnimalLessonsPage({params, searchParams}: AnimalLessonsPageProps) {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lessons = await getBehaviorLessonIndex();
    const requestedLetter = getSingleParam(searchParams?.letter)?.toUpperCase() ?? "all";
    const activeLetter = alphabet.includes(requestedLetter) ? requestedLetter : "all";
    const visibleLessons = activeLetter === "all"
        ? lessons
        : lessons.filter((lesson) => lesson.displayName.toUpperCase().startsWith(activeLetter));
    const PAGE_SIZE = 12;
    const requestedPage = Number.parseInt(getSingleParam(searchParams?.page) ?? "1", 10);
    const requestedPageValid = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const totalVisibleLessons = visibleLessons.length;
    const totalPages = totalVisibleLessons === 0 ? 1 : Math.ceil(totalVisibleLessons / PAGE_SIZE);
    const currentPage = Math.min(requestedPageValid, totalPages);
    const paginatedLessons = visibleLessons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const pageDescription = t("description");
    const indexPath = activeLetter === "all"
        ? currentPage === 1
            ? "/animal-lessons"
            : `/animal-lessons?page=${currentPage}`
        : currentPage === 1
            ? `/animal-lessons?letter=${activeLetter}`
            : `/animal-lessons?letter=${activeLetter}&page=${currentPage}`;
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: pageDescription,
        url: getAbsoluteUrl(params.locale, indexPath),
        hasPart: paginatedLessons.map((lesson) => ({
            "@type": "Article",
            headline: t("detailHeroTitle", {animal: lesson.displayName}),
            description: lesson.coreLesson,
            url: getAbsoluteUrl(params.locale, `/animal-lessons/${lesson.slug}`)
        }))
    };
    function getPageHref(page: number) {
        const base = activeLetter === "all" ? "/animal-lessons" : `/animal-lessons?letter=${activeLetter}`;
        if (page <= 1) {
            return base;
        }

        return base.includes("?") ? `${base}&page=${page}` : `${base}?page=${page}`;
    }

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema])}} />
            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{t("title")}</h1>
                <p className="text-lg md:text-xl text-ink-200 max-w-4xl">{pageDescription}</p>
                <p className="text-ink-300">{t("lessonCount", {count: lessons.length})}</p>
            </div>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 p-6 md:p-8 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{t("featuredEyebrow")}</p>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("featuredTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-5xl">{t("featuredDescription")}</p>
            </section>

            <nav className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-3" aria-label={t("alphabetLabel")}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{t("alphabetLabel")}</p>
                    <p className="text-sm text-ink-300">{t("filteredLessonCount", {count: paginatedLessons.length})}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={getLetterHref("all")}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            activeLetter === "all"
                                ? "border-primary-400 bg-primary-500/20 text-white"
                                : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                        }`}
                    >
                        {t("filterAll")}
                    </Link>
                    {alphabet.map((letter) => (
                        <Link
                            key={letter}
                            href={getLetterHref(letter)}
                            className={`h-9 min-w-9 rounded-full border px-3 text-sm transition-colors flex items-center justify-center ${
                                activeLetter === letter
                                    ? "border-primary-400 bg-primary-500/20 text-white"
                                    : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                            }`}
                        >
                            {letter}
                        </Link>
                    ))}
                </div>
            </nav>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedLessons.map((lesson) => {
                    const speciesEntry = getSpeciesBySlug(lesson.slug);
                    const imageAlt = speciesEntry
                        ? getSpeciesImageAltText(speciesEntry, "thumbnail")
                        : `${lesson.displayName} animal lesson image on AnimalDex`;

                    return (
                        <section key={lesson.slug} className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                            <div className="flex items-start gap-4">
                                <Link href={`/animal-lessons/${lesson.slug}`} className="block shrink-0" aria-label={t("detailHeroTitle", {animal: lesson.displayName})}>
                                    <SpeciesArtworkImage
                                        slug={lesson.slug}
                                        alt={imageAlt}
                                        className="h-20 w-20 rounded-2xl border border-line-300"
                                        sizes="80px"
                                    />
                                </Link>
                                <div className="min-w-0 flex flex-col gap-2">
                                    <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{lesson.principleName}</p>
                                    <h2 className="text-white font-display font-bold text-2xl md:text-3xl">{lesson.displayName}</h2>
                                    {lesson.shortMotto && <p className="text-primary-200">{lesson.shortMotto}</p>}
                                </div>
                            </div>
                            <p className="text-ink-200">{lesson.coreLesson}</p>
                            {lesson.bestUseCases.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {lesson.bestUseCases.slice(0, 3).map((item) => (
                                        <span key={item} className="rounded-full border border-line-300/70 px-3 py-1 text-xs text-ink-200">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <Link href={`/animal-lessons/${lesson.slug}`} underline className="text-primary-200 hover:text-primary-100 mt-auto">
                                {t("openLesson")}
                            </Link>
                        </section>
                    );
                })}
            </div>

            {totalPages > 1 ? (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm md:text-base text-ink-300">{t("pageLabel", {page: currentPage, totalPages})}</div>

                    <div className="flex items-center gap-3">
                        {currentPage > 1 ? (
                            <Link
                                href={getPageHref(currentPage - 1)}
                                className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                            >
                                {t("previousPage")}
                            </Link>
                        ) : (
                            <span />
                        )}

                        {currentPage < totalPages ? (
                            <Link
                                href={getPageHref(currentPage + 1)}
                                className="rounded-2xl border border-line-300 px-4 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-400 hover:text-white"
                            >
                                {t("nextPage")}
                            </Link>
                        ) : null}
                    </div>
                </section>
            ) : null}

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{t("strategyEyebrow")}</p>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("strategyTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-5xl">{t("strategyDescription")}</p>
                <Link href="/principles" underline className="text-primary-200 hover:text-primary-100 w-fit">
                    {t("strategyLink")}
                </Link>
            </section>

            <ExploreKnowledgeLinks
                title={t("exploreTitle")}
                description={t("exploreDescription")}
                labels={{
                    species: t("exploreSpecies"),
                    lessons: t("exploreLessons"),
                    symbolism: t("exploreSymbolism")
                }}
            />
        </article>
    );
}
