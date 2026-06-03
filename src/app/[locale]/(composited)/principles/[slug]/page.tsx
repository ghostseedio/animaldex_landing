import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesBySlug} from "@/data/species";
import {getBehavioralPrincipleProfile, getBehavioralPrinciplesIndex} from "@/data/species-behavioral-principles";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type PrinciplePageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function getPrincipleBySlug(slug: string) {
    return getBehavioralPrinciplesIndex(speciesSystemsIntelligence)
        .find((item) => item.principleSlug === slug);
}

export async function generateMetadata({params}: PrinciplePageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "principles");
    const principle = getPrincipleBySlug(params.slug);

    if (!principle) {
        return {};
    }

    return buildContentMetadata({
        locale: params.locale,
        pathname: `/principles/${principle.principleSlug}`,
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
            "biology-backed animal principles"
        ]
    });
}

export default async function PrincipleDetailPage({params}: PrinciplePageProps) {
    const t = await getScopedTranslator(params.locale, "principles");
    const principle = getPrincipleBySlug(params.slug);

    if (!principle) {
        notFound();
    }

    const speciesItems = principle.speciesSlugs
        .map((slug) => {
            const entry = getSpeciesBySlug(slug);
            if (!entry) {
                return null;
            }
            const profile = getBehavioralPrincipleProfile(entry.slug, speciesSystemsIntelligence[entry.slug], speciesSystemsIntelligence);
            return profile ? {entry, profile} : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

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
                name: "Principles",
                item: getAbsoluteUrl(params.locale, "/principles")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: principle.principle,
                item: getAbsoluteUrl(params.locale, `/principles/${principle.principleSlug}`)
            }
        ]
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([breadcrumbSchema])}}
            />
            <Link href="/principles" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <p className="text-primary-200 font-medium uppercase tracking-[0.18em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{principle.principle}</h1>
                <p className="text-ink-200 text-lg md:text-xl">{sampleProfile?.motto}</p>
                <p className="text-ink-300">{t("speciesCount", {count: principle.speciesCount})}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {speciesItems.map(({entry, profile}) => (
                    <article
                        key={entry.slug}
                        className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                    >
                        <h2 className="font-display font-bold text-2xl text-white">{entry.name}</h2>
                        <p className="text-primary-200 text-sm uppercase tracking-[0.16em]">{profile.motto}</p>
                        <p className="text-ink-200">{profile.coreLesson}</p>
                        <p className="text-ink-300 text-sm">{profile.biologicalBasis}</p>
                        <Link
                            href={`/animals/${entry.slug}`}
                            underline
                            className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                        >
                            {t("openAnimal")}
                        </Link>
                    </article>
                ))}
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("relatedIndexesTitle")}</h2>
                <div className="flex flex-wrap gap-3">
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
        </section>
    );
}
