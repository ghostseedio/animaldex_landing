import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import QualitiesLibraryClient, {
    PrincipleCategory,
    PrincipleLibraryItem
} from "@/app/[locale]/(composited)/qualities/qualities-library-client";
import {getSpeciesBySlug} from "@/data/species";
import {getPrincipleHubIndex} from "@/data/species-behavior-lessons";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

type PrinciplesIndexPageProps = {
    params: {
        locale: string;
    };
};

const categorySignals: Array<[PrincipleCategory, RegExp]> = [
    ["focus", /focus|precision|timing|attention|observation|decision|clarity|discipline|patience|strategy/],
    ["social", /social|team|collaboration|communication|leadership|family|loyalty|service|trust|coordination/],
    ["survival", /survival|adapt|resilien|endurance|persistence|uncertain|instinct|resource|risk/],
    ["movement", /movement|speed|agility|pacing|navigation|direction|momentum|energy/],
    ["protection", /protection|boundary|defen|safety|camouflage|stealth|caution|self-trust/],
    ["learning", /learning|memory|wisdom|intelligence|pattern|knowledge|curiosity|problem/],
    ["emotion", /emotion|healing|sensitivity|presence|confidence|calm|self-command|identity/],
    ["creativity", /creativ|transformation|innovation|flexib|cunning|experiment|imagination/]
];

function categoriesForQuality(quality: string, searchText: string): PrincipleCategory[] {
    const source = `${quality} ${searchText}`.toLowerCase();
    const matches = categorySignals
        .filter(([, pattern]) => pattern.test(source))
        .map(([category]) => category);
    return matches.length > 0 ? matches.slice(0, 3) : ["survival"];
}

const examplePrinciples = [
    {slug: "barn-owl", animal: "Owl", principle: "Precision", lessonKey: "owl"},
    {slug: "wolf", animal: "Wolf", principle: "Teamwork", lessonKey: "wolf"},
    {slug: "elephant", animal: "Elephant", principle: "Memory", lessonKey: "elephant"},
    {slug: "spider", animal: "Spider", principle: "Patience", lessonKey: "spider"},
    {slug: "great-white-shark", animal: "Shark", principle: "Momentum", lessonKey: "shark"},
    {slug: "cat", animal: "Cat", principle: "Boundaries", lessonKey: "cat"},
    {slug: "dog", animal: "Dog", principle: "Loyalty", lessonKey: "dog"},
    {slug: "weasel", animal: "Weasel", principle: "Distraction", lessonKey: "weasel"},
    {slug: "honey-bee", animal: "Bee", principle: "Service", lessonKey: "bee"},
    {slug: "gorilla", animal: "Gorilla", principle: "Presence", lessonKey: "gorilla"}
];

export async function generateMetadata({params}: PrinciplesIndexPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "qualities");
    const title = t("metaTitle");
    const metadata = buildContentMetadata({
        locale: params.locale,
        pathname: "/powers",
        title,
        description: t("metaDescription"),
        featuredImage: {
            src: "/images/og.png",
            alt: "Animal powers on AnimalDex",
            width: 1200,
            height: 630
        },
        keywords: [
            "animal powers",
            "animal survival strategies",
            "lessons from animal behavior",
            "animal teamwork memory precision",
            "biology-backed animal lessons"
        ]
    });

    return {...metadata, title: {absolute: title}};
}

export default async function PrinciplesIndexPage({params}: PrinciplesIndexPageProps) {
    const t = await getScopedTranslator(params.locale, "qualities");
    const principles = await getPrincipleHubIndex();
    const uniqueLessons = Array.from(new Map(
        principles.flatMap((principle) => principle.lessons).map((lesson) => [lesson.slug, lesson] as const)
    ).values());
    const linkedAnimalCount = uniqueLessons.length;
    const catalogLessonCount = uniqueLessons.filter((lesson) => lesson.source === "catalog").length;
    const lessonPageCount = catalogLessonCount || uniqueLessons.length;
    const featuredPrinciples = principles.slice(0, 3);

    const libraryItems: PrincipleLibraryItem[] = principles.map((principle) => {
        const descriptionKey = `descriptions.${principle.principleSlug}`;
        const translatedDescription = t(descriptionKey);
        const description = translatedDescription === descriptionKey
            ? t("descriptionFallback", {principle: principle.principle.toLowerCase()})
            : translatedDescription;
        const previewAnimals = principle.lessons.slice(0, 5).map((lesson) => ({
            slug: lesson.slug,
            name: getSpeciesBySlug(lesson.slug)?.name ?? lesson.displayName,
            imageFile: lesson.imageFile
        }));
        const subPrinciples = Array.from(new Set(principle.lessons.map((lesson) => lesson.principleName)))
            .sort((left, right) => left.localeCompare(right));
        const searchText = [
            principle.principle,
            description,
            principle.sampleMotto,
            ...principle.lessons.flatMap((lesson) => [
                lesson.displayName,
                lesson.principleName,
                ...lesson.bestUseCases
            ])
        ].join(" ").toLowerCase();

        return {
            principle: principle.principle,
            principleSlug: principle.principleSlug,
            description,
            sampleMotto: principle.sampleMotto,
            linkedAnimalCount: principle.speciesCount,
            categories: categoriesForQuality(principle.principle, searchText),
            previewAnimals,
            subPrinciples,
            searchText
        };
    });

    const faqItems = [1, 2, 3, 4, 5, 6].map((number) => ({
        question: t(`faq.${number}.question`),
        answer: t(`faq.${number}.answer`)
    }));
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
                name: t("eyebrow"),
                item: getAbsoluteUrl(params.locale, "/powers")
            }
        ]
    };
    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: getAbsoluteUrl(params.locale, "/powers"),
        hasPart: principles.map((principle) => ({
            "@type": "CollectionPage",
            name: principle.principle,
            url: getAbsoluteUrl(params.locale, `/powers/${principle.principleSlug}`),
            numberOfItems: principle.speciesCount
        }))
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

    const clientLabels = {
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        categoryLabel: t("categoryLabel"),
        all: t("filterAll"),
        categories: {
            focus: t("categories.focus"),
            social: t("categories.social"),
            survival: t("categories.survival"),
            movement: t("categories.movement"),
            protection: t("categories.protection"),
            learning: t("categories.learning"),
            emotion: t("categories.emotion"),
            creativity: t("categories.creativity")
        },
        sortLabel: t("sortLabel"),
        sorts: {
            featured: t("sorts.featured"),
            alphabetic: t("sorts.alphabetic"),
            mostAnimals: t("sorts.mostAnimals")
        },
        featuredTitle: t("featuredTitle"),
        featuredDescription: t("featuredDescription"),
        allTitle: t("allTitle"),
        allDescription: t("allDescription"),
        resultsCount: t("resultsCount"),
        linkedAnimals: t("linkedAnimals"),
        subPrinciples: t("subPrinciples"),
        explorePrinciple: t("explorePrinciple"),
        noResultsTitle: t("noResultsTitle"),
        noResultsDescription: t("noResultsDescription"),
        clearFilters: t("clearFilters"),
        previousPage: t("previousPage"),
        nextPage: t("nextPage"),
        pageStatus: t("pageStatus")
    };

    return (
        <main className="mx-auto flex w-full max-w-[88rem] flex-col gap-16 px-4 py-12 md:gap-24 md:px-8 md:py-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, faqSchema, breadcrumbSchema])}}
            />

            <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_12%_12%,rgba(180,139,72,0.15),transparent_34%),linear-gradient(135deg,rgba(27,36,29,0.98),rgba(10,15,12,0.98))] p-6 md:p-10 lg:p-12">
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-14">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">{t("eyebrow")}</p>
                        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">{t("title")}</h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-100 md:text-xl">{t("description")}</p>
                        <p className="mt-3 max-w-3xl text-base leading-7 text-ink-300 md:text-lg">{t("descriptionSecondLine")}</p>

                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <Link href="#principle-library" className="flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-primary-400 px-6 font-bold text-canvas-950 hover:bg-primary-300">
                                {t("explorePrinciples")}
                            </Link>
                            <Link href="/animal-lessons" className="flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-white/15 px-6 font-bold text-white hover:border-primary-400 hover:text-primary-100">
                                {t("browseLessons")}
                            </Link>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                            <Link href="/animal-wisdom" className="text-ink-200 hover:text-primary-100" underline>{t("animalWisdom")}</Link>
                            <Link href="/animals" className="text-ink-200 hover:text-primary-100" underline>{t("animalEncyclopedia")}</Link>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-ink-100">{t("clusterStat", {count: principles.length})}</span>
                            <span className="rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-ink-100">{t("lessonStat", {count: lessonPageCount})}</span>
                            <span className="rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-ink-100">{t("linkedStat", {count: linkedAnimalCount})}</span>
                        </div>
                    </div>

                    <aside className="rounded-[1.75rem] bg-black/20 p-5 md:p-6" aria-label={t("featuredTitle")}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">{t("featuredTitle")}</p>
                        <div className="mt-4 divide-y divide-white/[0.09]">
                            {featuredPrinciples.map((principle) => (
                                <Link key={principle.principleSlug} href={`/powers/${principle.principleSlug}`} className="group flex items-center justify-between gap-5 py-4">
                                    <div>
                                        <p className="font-display text-2xl font-bold text-white">{principle.principle}</p>
                                        <p className="mt-1 line-clamp-1 text-sm text-ink-300">{principle.sampleMotto}</p>
                                    </div>
                                    <span className="text-xl text-primary-200 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                                </Link>
                            ))}
                        </div>
                    </aside>
                </div>
            </section>

            <section className="grid gap-7 border-y border-white/[0.08] py-10 md:py-14 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("explainerTitle")}</h2>
                <p className="max-w-4xl text-lg leading-8 text-ink-100 md:text-xl md:leading-9">{t("explainerBody")}</p>
            </section>

            <div id="principle-library" className="scroll-mt-28">
                <QualitiesLibraryClient items={libraryItems} labels={clientLabels} />
            </div>

            <section className="grid gap-10 border-t border-white/[0.08] pt-12 md:pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div>
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("whyTitle")}</h2>
                    <p className="mt-5 text-lg leading-8 text-ink-200">{t("whyBody")}</p>
                </div>
                <div>
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("examplesTitle")}</h2>
                    <div className="mt-6 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                        {examplePrinciples.map((example) => {
                            const species = getSpeciesBySlug(example.slug);
                            return (
                                <div key={example.animal} className="grid gap-2 py-4 sm:grid-cols-[8rem_8rem_minmax(0,1fr)] sm:items-center sm:gap-5">
                                    {species ? (
                                        <Link href={`/animals/${species.slug}`} className="font-semibold text-white hover:text-primary-100">{species.name}</Link>
                                    ) : (
                                        <span className="font-semibold text-white">{example.animal}</span>
                                    )}
                                    <span className="text-amber-100">{example.principle}</span>
                                    <span className="text-sm leading-6 text-ink-300">{t(`exampleLessons.${example.lessonKey}`)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section>
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("relatedTitle")}</h2>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{t("relatedDescription")}</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        ["/animal-lessons", t("relatedLessons"), t("relatedLessonsDescription")],
                        ["/animal-symbolism", t("relatedSymbolism"), t("relatedSymbolismDescription")],
                        ["/animal-wisdom", t("animalWisdom"), t("animalWisdomDescription")],
                        ["/animals", t("animalEncyclopedia"), t("animalEncyclopediaDescription")]
                    ].map(([href, title, description]) => (
                        <Link key={href} href={href} className="rounded-[1.5rem] bg-white/[0.05] p-5 transition-all hover:-translate-y-1 hover:bg-white/[0.075]">
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-ink-300">{description}</p>
                            <span className="mt-5 inline-block text-primary-200" aria-hidden="true">→</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="border-t border-white/[0.08] pt-12 md:pt-16">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("faqTitle")}</h2>
                <div className="mt-7 divide-y divide-white/[0.09] border-y border-white/[0.09]">
                    {faqItems.map((item, index) => (
                        <details key={item.question} className="group py-5" open={index === 0}>
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-semibold text-white md:text-xl">
                                {item.question}
                                <span className="text-primary-200 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                            </summary>
                            <p className="max-w-4xl pt-4 text-base leading-7 text-ink-200 md:text-lg md:leading-8">{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(53,181,89,0.18),transparent_42%),linear-gradient(145deg,rgba(25,41,29,0.98),rgba(10,16,12,0.98))] px-6 py-10 text-center md:px-12 md:py-14">
                <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold text-white md:text-5xl">{t("ctaTitle")}</h2>
                <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-ink-200 md:text-xl">{t("ctaDescription")}</p>
                <StoreLinks className="!mt-7" />
                <Link href="/animal-lessons" className="mt-6 inline-block font-semibold text-primary-200 hover:text-primary-100" underline>
                    {t("browseLessons")}
                </Link>
            </section>
        </main>
    );
}
