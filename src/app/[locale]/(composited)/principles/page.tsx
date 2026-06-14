import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {speciesEntries, getSpeciesBySlug} from "@/data/species";
import {getBehavioralPrinciplesIndex} from "@/data/species-behavioral-principles";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type PrinciplesIndexPageProps = {
    params: {
        locale: string;
    };
};

const principles = getBehavioralPrinciplesIndex(speciesSystemsIntelligence);

export async function generateMetadata({params}: PrinciplesIndexPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "principles");
    return buildContentMetadata({
        locale: params.locale,
        pathname: "/principles",
        title: t("metaTitle"),
        description: t("metaDescription"),
        featuredImage: {
            src: "/images/og.png",
            alt: "Animal principles on AnimalDex",
            width: 1200,
            height: 630
        },
        keywords: ["animal principles", "animal meaning", "animal symbolism", "animal lessons", "biology-backed animal meaning"]
    });
}

export default async function PrinciplesIndexPage({params}: PrinciplesIndexPageProps) {
    const t = await getScopedTranslator(params.locale, "principles");
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
                name: "Principles",
                item: getAbsoluteUrl(params.locale, "/principles")
            }
        ]
    };

    return (
        <section className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([breadcrumbSchema])}}
            />
            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {principles.map((principle) => {
                    const sampleSpecies = principle.speciesSlugs
                        .slice(0, 3)
                        .map((slug) => getSpeciesBySlug(slug))
                        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

                    return (
                        <article
                            key={principle.principleSlug}
                            className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                        >
                            <h2 className="font-display font-bold text-3xl text-white">{principle.principle}</h2>
                            <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{principle.sampleMotto}</p>
                            <p className="text-ink-200">{t("speciesCount", {count: principle.speciesCount})}</p>
                            <div className="flex flex-wrap gap-2">
                                {sampleSpecies.map((entry) => (
                                    <Link
                                        key={entry.slug}
                                        href={`/animals/${entry.slug}`}
                                        className="rounded-full border border-line-300/70 px-3 py-1 text-ink-200 text-sm"
                                    >
                                        {entry.name}
                                    </Link>
                                ))}
                            </div>
                            <Link
                                href={`/principles/${principle.principleSlug}`}
                                underline
                                className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                            >
                                {t("openPrinciple")}
                            </Link>
                        </article>
                    );
                })}
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("relatedIndexesTitle")}</h2>
                <div className="flex flex-wrap gap-3">
                    <Link href="/animals" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedSpecies")}
                    </Link>
                    <Link href="/animal-meanings" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedMeanings")}
                    </Link>
                    <Link href="/animal-symbolism" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedSymbolism")}
                    </Link>
                    <Link href="/animal-lessons" className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                        {t("relatedLessons")}
                    </Link>
                </div>
            </section>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-3 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/animals" underline className="text-primary-200 text-lg hover:text-primary-100 transition-colors">
                        {t("ctaButton")}
                    </Link>
                </div>
            </div>
        </section>
    );
}
