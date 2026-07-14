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
    const featuredSymbolismPosts = symbolismPosts.slice(0, 3);
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
        <article className="mx-auto flex w-full max-w-[88rem] flex-col gap-12 px-4 py-12 md:px-8 md:py-20">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([schema])}} />

            <header className="grid gap-8 overflow-hidden rounded-lg border border-line-300 bg-gradient-to-br from-primary-500/14 via-surface-900 to-canvas-900 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
                <div className="p-6 md:p-10 lg:p-12">
                    <Link href="/" className="mb-6 inline-flex text-sm text-primary-200 transition-colors hover:text-primary-100" underline>
                        {t("eyebrow")}
                    </Link>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{t("guidesEyebrow")}</p>
                    <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl">{t("title")}</h1>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-200 md:text-xl">{t("description")}</p>
                    <div className="mt-8 grid gap-3 text-sm text-ink-300 sm:grid-cols-3">
                        <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                            <strong className="block text-2xl text-white">{symbolismPosts.length}</strong>
                            <span>Symbol guides</span>
                        </div>
                        <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                            <strong className="block text-2xl text-white">Bio</strong>
                            <span>Behavior context</span>
                        </div>
                        <div className="rounded-md border border-white/10 bg-canvas-950/35 p-3">
                            <strong className="block text-2xl text-white">SEO</strong>
                            <span>Meaning paths</span>
                        </div>
                    </div>
                </div>
                {featuredSymbolismPosts.length > 0 ? (
                    <div className="grid min-h-[24rem] gap-3 border-t border-line-300 bg-canvas-950/35 p-4 lg:border-l lg:border-t-0">
                        {featuredSymbolismPosts.map((post, index) => (
                            <Link key={post.slug} href={`/blog/${post.slug}`} className={`group relative overflow-hidden rounded-md border border-white/10 bg-surface-800 ${index === 0 ? "min-h-[13rem]" : "min-h-[9rem]"}`}>
                                <Image
                                    src={post.featuredImage.src}
                                    alt={post.featuredImage.alt}
                                    fill
                                    sizes="(min-width: 1024px) 32rem, 100vw"
                                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                    priority={index === 0}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">{post.tags[0] || t("guidesEyebrow")}</p>
                                    <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-white md:text-xl">{post.title}</h2>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : null}
            </header>

            <section className="border-t border-line-300 pt-8">
                <div className="mb-6 max-w-5xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{t("guidesEyebrow")}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("guidesTitle")}</h2>
                    <p className="mt-3 text-lg leading-8 text-ink-200 md:text-xl">{t("guidesDescription")}</p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {symbolismPosts.map((post) => (
                        <article
                            key={post.slug}
                            className="group flex flex-col overflow-hidden rounded-lg border border-line-300 bg-surface-900/75 transition-colors hover:border-primary-400/50"
                        >
                            <Link href={`/blog/${post.slug}`} className="block border-b border-line-300 bg-surface-800/60">
                                <Image
                                    src={post.featuredImage.src}
                                    alt={post.featuredImage.alt}
                                    width={post.featuredImage.width}
                                    height={post.featuredImage.height}
                                    sizes="(min-width: 1024px) 30vw, 100vw"
                                    className="aspect-[16/10] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                />
                            </Link>
                            <div className="flex flex-1 flex-col gap-3 p-5">
                                <h3 className="font-display text-2xl font-bold leading-tight text-white">{post.title}</h3>
                                <p className="text-base leading-7 text-ink-300">{post.description}</p>
                                <div className="flex flex-wrap gap-2">
                                    {post.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="rounded-md border border-line-300 bg-surface-800/65 px-3 py-1.5 text-xs text-ink-200">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <Link href={`/blog/${post.slug}`} underline className="mt-auto w-fit text-primary-200 hover:text-primary-100">
                                    {t("readGuide")}
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="grid gap-8 border-y border-line-300 py-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">{t("strategyEyebrow")}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{t("strategyTitle")}</h2>
                </div>
                <div>
                    <p className="text-lg leading-8 text-ink-200 md:text-xl">{t("strategyDescription")}</p>
                    <Link href="/powers" underline className="mt-5 inline-flex text-primary-200 hover:text-primary-100">
                        {t("strategyLink")}
                    </Link>
                </div>
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
