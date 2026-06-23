import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getBehaviorLessonBySlug, getRelatedBehaviorLessons} from "@/data/species-behavior-lessons";
import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type AnimalLessonPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

export async function generateMetadata({params}: AnimalLessonPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lesson = await getBehaviorLessonBySlug(params.slug);
    const speciesEntry = getSpeciesBySlug(params.slug);

    if (!lesson) {
        return {};
    }

    return buildContentMetadata({
        locale: params.locale,
        pathname: `/animal-lessons/${lesson.slug}`,
        title: t("detailMetaTitle", {animal: lesson.displayName, principle: lesson.principleName}),
        description: t("detailMetaDescription", {
            animal: lesson.displayName,
            principle: lesson.principleName,
            lesson: lesson.coreLesson
        }),
        keywords: [
            `${lesson.displayName.toLowerCase()} lesson`,
            `lessons from ${lesson.displayName.toLowerCase()}`,
            `${lesson.principleName.toLowerCase()} animal lesson`,
            "biology backed animal lessons",
            "animal behavior lessons"
        ],
        featuredImage: speciesEntry
            ? {
                ...speciesEntry.featuredImage,
                alt: `${lesson.displayName} animal lesson on AnimalDex`
            }
            : {
                src: "/images/og.png",
                alt: `${lesson.displayName} animal lesson on AnimalDex`,
                width: 1200,
                height: 630
            }
    });
}

export default async function AnimalLessonDetailPage({params}: AnimalLessonPageProps) {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lesson = await getBehaviorLessonBySlug(params.slug);
    const speciesEntry = getSpeciesBySlug(params.slug);

    if (!lesson) {
        notFound();
    }

    const relatedLessons = await getRelatedBehaviorLessons(params.slug);
    const pageUrl = getAbsoluteUrl(params.locale, `/animal-lessons/${lesson.slug}`);
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "AnimalDex",
                item: getAbsoluteUrl(params.locale)
            },
            {
                "@type": "ListItem",
                position: 2,
                name: t("title"),
                item: getAbsoluteUrl(params.locale, "/animal-lessons")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: lesson.displayName,
                item: pageUrl
            }
        ]
    };
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: t("detailHeroTitle", {animal: lesson.displayName}),
        description: lesson.coreLesson,
        inLanguage: params.locale,
        url: pageUrl,
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: {
            "@type": "Thing",
            name: lesson.displayName,
            description: lesson.biologicalBasis
        },
        keywords: [lesson.principleName, ...lesson.bestUseCases].join(", ")
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
            {
                "@type": "Question",
                name: t("faqLessonQuestion", {animal: lesson.displayName}),
                acceptedAnswer: {
                    "@type": "Answer",
                    text: lesson.coreLesson
                }
            },
            {
                "@type": "Question",
                name: t("faqBiologyQuestion", {animal: lesson.displayName}),
                acceptedAnswer: {
                    "@type": "Answer",
                    text: lesson.biologicalBasis
                }
            }
        ]
    };

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema, breadcrumbSchema])}}
            />

            <Link href="/animal-lessons" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 items-center">
                    <div className="flex flex-col gap-4">
                        <p className="text-primary-200 font-medium uppercase tracking-[0.18em] text-sm">
                            {t("detailEyebrow", {principle: lesson.principleName})}
                        </p>
                        <h1 className="font-display font-bold text-5xl md:text-6xl text-white">
                            {t("detailHeroTitle", {animal: lesson.displayName})}
                        </h1>
                        {lesson.shortMotto && (
                            <p className="text-primary-200 text-lg md:text-xl">{lesson.shortMotto}</p>
                        )}
                        {lesson.principleExpression && (
                            <p className="text-ink-300 text-base md:text-lg">{lesson.principleExpression}</p>
                        )}
                    </div>
                    <SpeciesArtworkImage
                        slug={lesson.slug}
                        alt={speciesEntry ? getSpeciesImageAltText(speciesEntry, "featured") : `${lesson.displayName} animal lesson image on AnimalDex`}
                        imageFile={lesson.imageFile}
                        priority
                        className="aspect-[4/3] rounded-3xl border border-line-300"
                        sizes="(min-width: 1024px) 40vw, 100vw"
                    />
                </div>
            </section>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("coreLessonTitle")}</h2>
                <p className="text-white text-lg md:text-xl leading-8">{lesson.coreLesson}</p>
            </section>

            {lesson.biologicalBasis && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("biologicalBasisTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{lesson.biologicalBasis}</p>
                </section>
            )}

            {lesson.bestUseCases.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("bestForTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("bestForDescription")}</p>
                    <div className="flex flex-wrap gap-2">
                        {lesson.bestUseCases.map((item) => (
                            <span key={item} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-sm">
                                {item}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("relatedIndexesTitle")}</h2>
                <div className="flex flex-wrap gap-3">
                    {speciesEntry ? (
                        <Link href={`/animals/${lesson.slug}`} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                            {t("openAnimal")}
                        </Link>
                    ) : null}
                    <Link href="/animal-symbolism" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedSymbolism")}
                    </Link>
                    <Link href="/principles" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedPrinciples")}
                    </Link>
                </div>
            </section>

            {relatedLessons.length > 0 && (
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-display font-bold text-4xl text-white">{t("relatedLessonsTitle")}</h2>
                        <p className="text-ink-200 text-lg md:text-xl">
                            {t("relatedLessonsDescription", {principle: lesson.principleName})}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedLessons.map((relatedLesson) => (
                            <article
                                key={relatedLesson.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{relatedLesson.displayName}</h3>
                                <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{relatedLesson.shortMotto}</p>
                                <p className="text-ink-200">{relatedLesson.coreLesson}</p>
                                <Link
                                    href={`/animal-lessons/${relatedLesson.slug}`}
                                    underline
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                >
                                    {t("openLesson")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}
