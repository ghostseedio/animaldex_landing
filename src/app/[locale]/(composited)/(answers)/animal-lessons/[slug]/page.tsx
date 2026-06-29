import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getBlogPost} from "@/data/blog";
import {
    getBehaviorLessonBySlug,
    getBehaviorLessonIndex,
    getPrincipleHubBySlug,
    getRelatedBehaviorLessons,
    resolveSpeciesBehaviorProfile
} from "@/data/species-behavior-lessons";
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

function toPrincipleSlug(principle: string) {
    return principle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function generateMetadata({params}: AnimalLessonPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lesson = await getBehaviorLessonBySlug(params.slug);
    const speciesEntry = getSpeciesBySlug(params.slug);

    if (!lesson) {
        return {};
    }

    const title = t("detailMetaTitle", {animal: lesson.displayName, principle: lesson.principleName});
    const metadata = buildContentMetadata({
        locale: params.locale,
        pathname: `/animal-lessons/${lesson.slug}`,
        title,
        description: t("detailMetaDescription", {
            animal: lesson.displayName,
            principle: lesson.principleName
        }),
        keywords: [
            `what can we learn from ${lesson.displayName.toLowerCase()}`,
            `lessons from ${lesson.displayName.toLowerCase()}`,
            `${lesson.displayName.toLowerCase()} lesson`,
            `${lesson.displayName.toLowerCase()} symbolism`,
            `${lesson.principleName.toLowerCase()} lessons from nature`,
            "animal behavior lessons"
        ],
        featuredImage: speciesEntry
            ? {
                ...speciesEntry.featuredImage,
                alt: `${lesson.displayName} lesson from nature on AnimalDex`
            }
            : {
                src: "/images/og.png",
                alt: `${lesson.displayName} lesson from nature on AnimalDex`,
                width: 1200,
                height: 630
            }
    });

    return {...metadata, title: {absolute: title}};
}

export default async function AnimalLessonDetailPage({params}: AnimalLessonPageProps) {
    const t = await getScopedTranslator(params.locale, "animalLessons");
    const lesson = await getBehaviorLessonBySlug(params.slug);
    const speciesEntry = getSpeciesBySlug(params.slug);

    if (!lesson) {
        notFound();
    }

    const [relatedLessons, behaviorProfile, lessonIndex] = await Promise.all([
        getRelatedBehaviorLessons(params.slug, 3),
        resolveSpeciesBehaviorProfile(params.slug),
        getBehaviorLessonIndex()
    ]);
    const orderedLessons = [...lessonIndex].sort((left, right) => left.displayName.localeCompare(right.displayName));
    const currentLessonIndex = orderedLessons.findIndex((item) => item.slug === lesson.slug);
    const nextLesson = orderedLessons.length > 1
        ? currentLessonIndex >= 0
            ? orderedLessons[(currentLessonIndex + 1) % orderedLessons.length]
            : orderedLessons.find((item) => item.slug !== lesson.slug) ?? null
        : null;
    const preferredPrincipleSlug = toPrincipleSlug(
        lesson.bestUseCases[0]
        ?? behaviorProfile?.bestFor[0]
        ?? lesson.principleName
    );
    const principleHub = await getPrincipleHubBySlug(preferredPrincipleSlug)
        ?? await getPrincipleHubBySlug(toPrincipleSlug(lesson.principleName));
    const symbolismPost = getBlogPost(`${lesson.slug}-symbolism`);
    const pageUrl = getAbsoluteUrl(params.locale, `/animal-lessons/${lesson.slug}`);
    const faqItems = [
        {
            question: t("faqLearnQuestion", {animal: lesson.displayName}),
            answer: t("faqLearnAnswer", {
                animal: lesson.displayName,
                principle: lesson.principleName,
                lesson: lesson.coreLesson
            })
        },
        {
            question: t("faqMainQuestion", {animal: lesson.displayName}),
            answer: t("faqMainAnswer", {motto: lesson.shortMotto, lesson: lesson.coreLesson})
        },
        {
            question: t("faqApplyQuestion", {animal: lesson.displayName}),
            answer: t("faqApplyAnswer", {application: lesson.applicationExample || lesson.coreLesson})
        },
        {
            question: t("faqPrincipleQuestion", {animal: lesson.displayName, principle: lesson.principleName}),
            answer: t("faqPrincipleAnswer", {biology: lesson.biologicalBasis})
        },
        {
            question: t("faqScienceQuestion"),
            answer: t("faqScienceAnswer")
        }
    ];
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: t("breadcrumbWisdom"),
                item: getAbsoluteUrl(params.locale, "/animal-wisdom")
            },
            {
                "@type": "ListItem",
                position: 2,
                name: t("breadcrumbLessons"),
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
        mainEntityOfPage: pageUrl,
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
        mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {"@type": "Answer", text: item.answer}
        }))
    };

    return (
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-14 px-4 py-12 md:gap-20 md:px-8 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema, breadcrumbSchema])}}
            />

            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
                <Link href="/animal-wisdom" className="hover:text-primary-100">{t("breadcrumbWisdom")}</Link>
                <span aria-hidden="true">/</span>
                <Link href="/animal-lessons" className="hover:text-primary-100">{t("breadcrumbLessons")}</Link>
                <span aria-hidden="true">/</span>
                <span className="text-ink-100">{lesson.displayName}</span>
            </nav>

            <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_12%_10%,rgba(180,139,72,0.15),transparent_33%),linear-gradient(135deg,rgba(27,36,29,0.98),rgba(10,15,12,0.98))] p-5 shadow-2xl shadow-black/20 md:p-10 lg:p-12">
                <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div className="order-2 flex flex-col items-start gap-6 lg:order-1">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">
                                {t("detailEyebrow", {principle: lesson.principleName})}
                            </p>
                            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl">
                                {t("detailHeroTitle", {animal: lesson.displayName})}
                            </h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100 md:text-xl">
                                {t("detailSubtitle", {
                                    animal: lesson.displayName,
                                    principle: lesson.principleName.toLowerCase(),
                                    lesson: lesson.coreLesson
                                })}
                            </p>
                            {lesson.principleExpression ? (
                                <p className="mt-4 max-w-2xl border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-ink-300 md:text-base">
                                    {lesson.principleExpression}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-amber-200/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
                                {t("animalLessonPill")}
                            </span>
                            <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-semibold text-white">
                                {lesson.principleName}
                            </span>
                            <span className="rounded-full bg-primary-400/[0.09] px-3 py-1.5 text-sm font-semibold text-primary-100">
                                {t("groundedPill")}
                            </span>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            {speciesEntry ? (
                                <Link href={`/animals/${lesson.slug}`} className="flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-primary-400 px-6 font-bold text-canvas-950 transition-colors hover:bg-primary-300">
                                    {t("viewProfile", {animal: lesson.displayName})}
                                </Link>
                            ) : null}
                            <Link href="/animal-wisdom" className="flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-white/15 px-6 font-bold text-white transition-colors hover:border-primary-400 hover:text-primary-100">
                                {t("exploreWisdom")}
                            </Link>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2">
                        <div className="rounded-[1.75rem] bg-black/20 p-3 shadow-2xl shadow-black/30">
                            <div className="relative overflow-hidden rounded-[1.35rem]">
                                <SpeciesArtworkImage
                                    slug={lesson.slug}
                                    alt={speciesEntry ? getSpeciesImageAltText(speciesEntry, "featured") : `${lesson.displayName} animal lesson image on AnimalDex`}
                                    imageFile={lesson.imageFile}
                                    priority
                                    className="aspect-[4/3] rounded-[1.35rem]"
                                    sizes="(min-width: 1024px) 40vw, 100vw"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-5 pb-5 pt-16">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">{t("imageLabel")}</p>
                                    <p className="mt-1 text-lg font-semibold text-white">{t("principleChip", {principle: lesson.principleName})}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto w-full max-w-4xl rounded-[1.75rem] bg-amber-200/[0.07] px-6 py-7 md:px-10 md:py-9">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">{t("quickAnswerTitle")}</h2>
                <p className="mt-4 text-lg leading-8 text-ink-100 md:text-xl md:leading-9">
                    {t("quickAnswerCopy", {
                        animal: lesson.displayName,
                        principle: lesson.principleName.toLowerCase(),
                        lesson: lesson.coreLesson,
                        biology: lesson.biologicalBasis
                    })}
                </p>
            </section>

            <section className="border-t border-white/[0.08] pt-10 md:pt-16">
                <div className="grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                            {t("coreLessonEyebrow", {animal: lesson.displayName})}
                        </p>
                        <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">{t("coreLessonTitle")}</h2>
                    </div>
                    <div className="max-w-3xl">
                        <blockquote className="font-display text-3xl font-semibold leading-tight text-white md:text-5xl">
                            {lesson.shortMotto || lesson.coreLesson}
                        </blockquote>
                        <p className="mt-7 text-xl leading-9 text-ink-100 md:text-2xl md:leading-10">{lesson.coreLesson}</p>
                        <p className="mt-5 text-base leading-7 text-ink-300 md:text-lg md:leading-8">{t("coreLessonBody")}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-[2rem] bg-[linear-gradient(145deg,rgba(180,139,72,0.13),rgba(42,72,51,0.16))] p-6 md:p-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">{t("realLifeExample")}</p>
                        <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">{t("applicationExampleTitle")}</h2>
                    </div>
                    <div className="grid gap-5">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{t("scenarioLabel")}</h3>
                            <p className="mt-2 text-lg leading-8 text-ink-100">{lesson.applicationExample || lesson.coreLesson}</p>
                        </div>
                        <div className="border-t border-white/[0.09] pt-5">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{t("animalLessonLabel")}</h3>
                            <p className="mt-2 text-lg leading-8 text-ink-100">{lesson.coreLesson}</p>
                        </div>
                        <div className="border-t border-white/[0.09] pt-5">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-100">{t("simpleActionLabel")}</h3>
                            <p className="mt-2 text-xl font-semibold text-white">{lesson.shortMotto || lesson.principleExpression || lesson.coreLesson}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-8 rounded-[2rem] bg-surface-900/55 p-6 md:p-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("biologicalBasisTitle")}</h2>
                <div>
                    <p className="text-lg leading-8 text-ink-100 md:text-xl md:leading-9">{lesson.biologicalBasis}</p>
                    <p className="mt-6 border-l-2 border-primary-400/35 pl-4 text-sm leading-6 text-ink-300">{t("biologyNote")}</p>
                </div>
            </section>

            {lesson.bestUseCases.length > 0 ? (
                <section>
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("bestForTitle")}</h2>
                    <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-200">{t("bestForDescription")}</p>
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {lesson.bestUseCases.map((item) => (
                            <div key={item} className="flex min-h-[4.5rem] items-center rounded-2xl bg-white/[0.055] px-5 py-4 text-base font-semibold text-ink-100">
                                <span className="mr-3 text-amber-200">—</span>{item}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="border-t border-white/[0.08] pt-10 md:pt-16">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("faqTitle")}</h2>
                <div className="mt-7 divide-y divide-white/[0.09] border-y border-white/[0.09]">
                    {faqItems.map((item, index) => (
                        <details key={item.question} className="group py-5" open={index === 0}>
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-semibold text-white md:text-xl">
                                {item.question}
                                <span className="text-primary-200 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                            </summary>
                            <p className="max-w-3xl pt-4 text-base leading-7 text-ink-200 md:text-lg md:leading-8">{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
                    {t("relatedIndexesTitle", {animal: lesson.displayName})}
                </h2>
                <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {speciesEntry ? (
                        <Link href={`/animals/${lesson.slug}`} className="rounded-3xl bg-white/[0.055] p-5 transition-transform hover:-translate-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">AnimalDex</p>
                            <p className="mt-2 text-lg font-semibold text-white">{t("animalProfileLink", {animal: lesson.displayName})}</p>
                        </Link>
                    ) : null}
                    {symbolismPost ? (
                        <Link href={`/blog/${symbolismPost.slug}`} className="rounded-3xl bg-amber-200/[0.07] p-5 transition-transform hover:-translate-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/80">{t("relatedMeanings")}</p>
                            <p className="mt-2 text-lg font-semibold text-white">{t("relatedSymbolism", {animal: lesson.displayName})}</p>
                        </Link>
                    ) : null}
                    {principleHub ? (
                        <Link href={`/qualities/${principleHub.principleSlug}`} className="rounded-3xl bg-primary-400/[0.07] p-5 transition-transform hover:-translate-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-100">{t("relatedPrinciples", {principle: lesson.principleName})}</p>
                            <p className="mt-2 text-lg font-semibold text-white">{t("lessonCount", {count: principleHub.speciesCount})}</p>
                        </Link>
                    ) : null}
                    <Link href="/animal-wisdom" className="rounded-3xl bg-white/[0.055] p-5 transition-transform hover:-translate-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">AnimalDex</p>
                        <p className="mt-2 text-lg font-semibold text-white">{t("animalWisdomLink")}</p>
                    </Link>
                </div>

                {relatedLessons.length > 0 ? (
                    <div className="mt-10">
                        <h3 className="font-display text-2xl font-bold text-white md:text-3xl">
                            {t("relatedLessonsTitle", {principle: lesson.principleName})}
                        </h3>
                        <p className="mt-2 text-ink-200">{t("relatedLessonsDescription", {principle: lesson.principleName})}</p>
                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            {relatedLessons.map((relatedLesson) => (
                                <article key={relatedLesson.slug} className="overflow-hidden rounded-3xl bg-surface-900/55">
                                    <Link href={`/animal-lessons/${relatedLesson.slug}`} className="block">
                                        <SpeciesArtworkImage
                                            slug={relatedLesson.slug}
                                            alt={`${relatedLesson.displayName} lesson from nature`}
                                            imageFile={relatedLesson.imageFile}
                                            className="aspect-[16/9]"
                                            sizes="(min-width: 768px) 30vw, 100vw"
                                        />
                                    </Link>
                                    <div className="p-5">
                                        <h4 className="font-display text-2xl font-bold text-white">{relatedLesson.displayName}</h4>
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-200">{relatedLesson.coreLesson}</p>
                                        <Link href={`/animal-lessons/${relatedLesson.slug}`} className="mt-4 inline-block text-sm font-semibold text-primary-200 hover:text-primary-100">
                                            {t("openLesson")} →
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(53,181,89,0.18),transparent_42%),linear-gradient(145deg,rgba(25,41,29,0.98),rgba(10,16,12,0.98))] px-6 py-10 text-center md:px-12 md:py-14">
                <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold text-white md:text-5xl">{t("ctaTitle")}</h2>
                <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-ink-200 md:text-xl">{t("ctaBody")}</p>
                <StoreLinks className="!mt-7" />
                <Link href="/animals" className="mt-6 inline-block font-semibold text-primary-200 hover:text-primary-100" underline>
                    {t("browseEncyclopedia")}
                </Link>
            </section>

            {nextLesson ? (
                <section aria-labelledby="next-animal-lesson-title">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">{t("nextLessonEyebrow")}</p>
                    <Link
                        href={`/animal-lessons/${nextLesson.slug}`}
                        className="group grid overflow-hidden rounded-[1.75rem] bg-white/[0.055] transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.075] sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                        <SpeciesArtworkImage
                            slug={nextLesson.slug}
                            alt={`${nextLesson.displayName} lesson from nature`}
                            imageFile={nextLesson.imageFile}
                            className="aspect-[16/8] sm:aspect-square"
                            sizes="(min-width: 640px) 160px, 100vw"
                        />
                        <div className="p-5 sm:px-7 sm:py-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-amber-100/80">{nextLesson.principleName}</p>
                            <h2 id="next-animal-lesson-title" className="mt-2 font-display text-2xl font-bold text-white md:text-3xl">
                                {t("nextLessonTitle", {animal: nextLesson.displayName})}
                            </h2>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-200 md:text-base">{nextLesson.shortMotto || nextLesson.coreLesson}</p>
                        </div>
                        <span className="mx-5 mb-5 flex min-h-[3rem] items-center justify-center rounded-2xl bg-primary-400 px-5 font-bold text-canvas-950 transition-colors group-hover:bg-primary-300 sm:mx-7 sm:mb-0" aria-hidden="true">
                            {t("nextLessonButton")} →
                        </span>
                    </Link>
                </section>
            ) : null}
        </article>
    );
}
