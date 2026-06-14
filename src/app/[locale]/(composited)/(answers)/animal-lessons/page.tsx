import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import ExploreKnowledgeLinks from "@/app/[locale]/(composited)/_components/explore-knowledge-links";
import {getBehaviorLessonIndex} from "@/data/species-behavior-lessons";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type AnimalLessonsPageProps = {
    params: {
        locale: string;
    };
};

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

export default async function AnimalLessonsPage({params}: AnimalLessonsPageProps) {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lessons = await getBehaviorLessonIndex();
    const pageDescription = t("description");
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: pageDescription,
        url: getAbsoluteUrl(params.locale, "/animal-lessons"),
        hasPart: lessons.slice(0, 120).map((lesson) => ({
            "@type": "Article",
            headline: t("detailHeroTitle", {animal: lesson.displayName}),
            description: lesson.coreLesson,
            url: getAbsoluteUrl(params.locale, `/animal-lessons/${lesson.slug}`)
        }))
    };

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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {lessons.map((lesson) => (
                    <section key={lesson.slug} className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                        <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{lesson.principleName}</p>
                        <h2 className="text-white font-display font-bold text-2xl md:text-3xl">{lesson.displayName}</h2>
                        {lesson.shortMotto && <p className="text-primary-200">{lesson.shortMotto}</p>}
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
                ))}
            </div>

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
                    principles: t("explorePrinciples"),
                    lessons: t("exploreLessons"),
                    meanings: t("exploreMeanings"),
                    symbolism: t("exploreSymbolism")
                }}
            />
        </article>
    );
}
