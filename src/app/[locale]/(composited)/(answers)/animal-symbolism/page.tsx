import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import ExploreKnowledgeLinks from "@/app/[locale]/(composited)/_components/explore-knowledge-links";
import {blogPosts} from "@/data/blog";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type AnimalSymbolismPageProps = {
    params: {
        locale: string;
    };
};

const symbolismPosts = blogPosts.filter((post) => post.slug.endsWith("-symbolism"));

function getAnimalSymbolismPath(locale: string) {
    return locale === localeConfig.defaultLocale ? "/animal-symbolism" : getLocalePath(locale, "/animal-symbolism");
}

function getAnimalSymbolismUrl(locale: string) {
    return new URL(getAnimalSymbolismPath(locale), getSiteUrl()).toString();
}

export async function generateMetadata({params}: AnimalSymbolismPageProps): Promise<Metadata> {
    const t = await getScopedTranslator(params.locale, "animalSymbolism");
    const canonicalUrl = getAnimalSymbolismPath(params.locale);

    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
        keywords: ["animal symbolism", "what does an animal symbolize", "biology backed symbolism", "animal archetype meaning"],
        alternates: {
            canonical: canonicalUrl,
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getAnimalSymbolismPath(localeItem);
                return acc;
            }, {"x-default": "/animal-symbolism"} as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(params.locale),
            title: t("metaTitle"),
            description: t("metaDescription"),
            url: canonicalUrl,
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: t("metaTitle")}]
        }
    };
}

export default async function AnimalSymbolismPage({params}: AnimalSymbolismPageProps) {
    const t = await getScopedTranslator(params.locale, "animalSymbolism");
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: getAnimalSymbolismUrl(params.locale),
        hasPart: symbolismPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            url: post.canonicalUrl || getAbsoluteUrl(params.locale, `/blog/${post.slug}`),
            image: post.featuredImage.src,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt
        }))
    };

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema])}} />
            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{t("title")}</h1>
                <p className="text-lg md:text-xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 p-6 md:p-8 flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">{t("guidesEyebrow")}</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("guidesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl max-w-5xl">{t("guidesDescription")}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {symbolismPosts.map((post) => (
                        <article
                            key={post.slug}
                            className="overflow-hidden rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur flex flex-col"
                        >
                            <Link href={`/blog/${post.slug}`} className="block border-b border-line-300 bg-surface-800/60">
                                <Image
                                    src={post.featuredImage.src}
                                    alt={post.featuredImage.alt}
                                    width={post.featuredImage.width}
                                    height={post.featuredImage.height}
                                    sizes="(min-width: 1024px) 30vw, 100vw"
                                    className="aspect-[16/10] h-auto w-full object-cover"
                                />
                            </Link>
                            <div className="p-5 flex flex-col gap-3 flex-1">
                                <h3 className="font-display font-bold text-2xl text-white">{post.title}</h3>
                                <p className="text-ink-200 text-base leading-7">{post.description}</p>
                                <div className="flex flex-wrap gap-2">
                                    {post.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <Link href={`/blog/${post.slug}`} underline className="text-primary-200 hover:text-primary-100 mt-auto w-fit">
                                    {t("readGuide")}
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

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
