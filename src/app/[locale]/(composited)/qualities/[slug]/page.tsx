import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {getPrincipleHubBySlug, resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
    return [
        {locale: "en", slug: "resilience"},
        {locale: "id", slug: "resilience"}
    ];
}

type PrinciplePageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

const PRINCIPLE_SPECIES_PAGE_SIZE = 18;

export async function generateMetadata({params}: PrinciplePageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "qualities");
    const principle = await getPrincipleHubBySlug(params.slug);

    if (!principle) {
        return {};
    }

    const basePath = `/powers/${principle.principleSlug}`;

    return buildContentMetadata({
        locale: params.locale,
        pathname: basePath,
        title: t("detailMetaTitle", {principle: principle.principle}),
        description: t("detailMetaDescription", {principle: principle.principle}),
        featuredImage: {
            src: "/images/og.png",
            alt: `${principle.principle} principle animals on AnimalDex`,
            width: 1200,
            height: 630
        },
        keywords: [
            `${principle.principle.toLowerCase()} animal meaning`,
            `${principle.principle.toLowerCase()} animal symbolism`,
            `${principle.principle.toLowerCase()} animal lesson`,
            "biology-backed animal powers"
        ]
    });
}

export default async function PrincipleDetailPage({params}: PrinciplePageProps) {
    const t = await getScopedTranslator(params.locale, "qualities");
    const principle = await getPrincipleHubBySlug(params.slug);

    if (!principle) {
        notFound();
    }

    const pageCount = Math.max(1, Math.ceil(principle.lessons.length / PRINCIPLE_SPECIES_PAGE_SIZE));
    const currentPage = 1;
    const pageStart = (currentPage - 1) * PRINCIPLE_SPECIES_PAGE_SIZE;
    const pageLessons = principle.lessons.slice(pageStart, pageStart + PRINCIPLE_SPECIES_PAGE_SIZE);
    const speciesItems = (
        await Promise.all(
            pageLessons.map(async (lesson) => {
                const entry = getSpeciesBySlug(lesson.slug);
                const profile = await resolveSpeciesBehaviorProfile(lesson.slug);
                return {entry, lesson, profile};
            })
        )
    );

    const sampleProfile = speciesItems[0]?.profile;
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: getAbsoluteUrl(params.locale)
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Qualities",
                item: getAbsoluteUrl(params.locale, "/powers")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: principle.principle,
                item: getAbsoluteUrl(params.locale, `/powers/${principle.principleSlug}`)
            }
        ]
    };

    return (
        <section className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([breadcrumbSchema])}}
            />
            <Link href="/powers" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <p className="text-primary-200 font-medium uppercase tracking-[0.18em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{principle.principle}</h1>
                <p className="text-ink-200 text-lg md:text-xl">{sampleProfile?.motto ?? principle.sampleMotto}</p>
                <p className="text-ink-300">{t("clusterIntro")}</p>
                <p className="text-ink-300">{t("speciesCount", {count: principle.speciesCount})}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {speciesItems.map(({entry, lesson, profile}, index) => {
                    const detailHref = entry ? `/animals/${entry.slug}` : `/animal-lessons/${lesson.slug}`;
                    const displayName = entry?.name ?? lesson.displayName;
                    const imageAlt = entry
                        ? getSpeciesImageAltText(entry, "thumbnail")
                        : `${lesson.displayName} animal lesson image on AnimalDex`;
                    const principleName = profile?.principle ?? lesson.principleName;
                    const motto = profile?.motto ?? lesson.shortMotto;
                    const coreLesson = profile?.coreLesson ?? lesson.coreLesson;
                    const biologicalBasis = profile?.biologicalBasis ?? lesson.biologicalBasis;

                    return (
                        <article
                            key={lesson.slug}
                            className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-4"
                        >
                            <Link href={detailHref} className="block">
                                <SpeciesArtworkImage
                                    slug={lesson.slug}
                                    alt={imageAlt}
                                    imageFile={lesson.imageFile}
                                    priority={index < 3}
                                    className="aspect-[4/3] rounded-2xl border border-line-300"
                                    sizes="(min-width: 1536px) 27vw, (min-width: 768px) 42vw, 100vw"
                                />
                            </Link>
                            <div className="flex flex-col gap-3">
                                <h2 className="font-display font-bold text-2xl text-white">{displayName}</h2>
                                <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">
                                    {t("speciesPrincipleLabel")}: {principleName}
                                </p>
                                {motto ? <p className="text-primary-200">{motto}</p> : null}
                                <p className="text-ink-200">{coreLesson}</p>
                                {biologicalBasis ? <p className="text-ink-300 text-sm">{biologicalBasis}</p> : null}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-auto">
                                {entry ? (
                                    <Link
                                        href={`/animals/${entry.slug}`}
                                        underline
                                        className="text-primary-200 hover:text-primary-100 transition-colors"
                                    >
                                        {t("openAnimal")}
                                    </Link>
                                ) : null}
                                <Link
                                    href={`/animal-lessons/${lesson.slug}`}
                                    underline
                                    className="text-primary-200 hover:text-primary-100 transition-colors"
                                >
                                    {t("openLesson")}
                                </Link>
                            </div>
                        </article>
                    );
                })}
            </div>

            {pageCount > 1 ? (
                <p className="text-center text-sm text-ink-300">{t("pageStatus", {page: currentPage, pages: pageCount})}</p>
            ) : null}

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("relatedIndexesTitle")}</h2>
                <div className="flex flex-wrap gap-3">
                    <Link href="/animals" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedSpecies")}
                    </Link>
                    <Link href="/animal-lessons" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedLessons")}
                    </Link>
                    <Link href="/animal-symbolism" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedSymbolism")}
                    </Link>
                </div>
            </section>
        </section>
    );
}
