import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesBySlug} from "@/data/species";
import {getBehavioralPrinciplesIndex} from "@/data/species-behavioral-principles";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

type AnimalLessonsPageProps = {
    params: {
        locale: string;
    };
};

const pageTitle = "Animal Lessons";
const pageDescription = "Find practical lessons from animals using AnimalDex principle clusters. Lessons are linked to ecology, behavior, and survival strategy.";

export async function generateMetadata({params}: AnimalLessonsPageProps): Promise<Metadata> {
    return {
        title: `${pageTitle} | AnimalDex`,
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
            title: `${pageTitle} | AnimalDex`,
            description: pageDescription,
            url: getLocalePath(params.locale, "/animal-lessons"),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: `${pageTitle} | AnimalDex`}]
        }
    };
}

export default function AnimalLessonsPage({params}: AnimalLessonsPageProps) {
    const principleIndex = getBehavioralPrinciplesIndex(speciesSystemsIntelligence);
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: pageTitle,
        description: pageDescription,
        url: getAbsoluteUrl(params.locale, "/animal-lessons")
    };

    return (
        <article className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema])}} />
            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">Lessons Index</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{pageTitle}</h1>
                <p className="text-lg md:text-xl text-ink-200 max-w-4xl">{pageDescription}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {principleIndex.map((principle) => (
                    <section key={principle.principleSlug} className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                        <h2 className="text-white font-display font-bold text-3xl">{principle.principle}</h2>
                        <p className="text-primary-200">{principle.sampleMotto}</p>
                        <div className="flex flex-wrap gap-2">
                            {principle.speciesSlugs.slice(0, 4).map((slug) => {
                                const entry = getSpeciesBySlug(slug);
                                if (!entry) return null;
                                return (
                                    <Link key={slug} href={`/animals/${slug}`} className="rounded-full border border-line-300/70 px-3 py-1 text-sm text-ink-200">
                                        {entry.name}
                                    </Link>
                                );
                            })}
                        </div>
                        <Link href={`/principles/${principle.principleSlug}`} underline className="text-primary-200 hover:text-primary-100 mt-auto">
                            Explore lesson cluster
                        </Link>
                    </section>
                ))}
            </div>
        </article>
    );
}
