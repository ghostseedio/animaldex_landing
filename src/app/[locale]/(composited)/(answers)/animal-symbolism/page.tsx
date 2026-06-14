import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {blogPosts} from "@/data/blog";
import {getSpeciesBySlug} from "@/data/species";
import {getBehavioralPrinciplesIndex} from "@/data/species-behavioral-principles";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {localeConfig} from "@/i18n";

type AnimalSymbolismPageProps = {
    params: {
        locale: string;
    };
};

const pageTitle = "Animal Symbolism";
const pageDescription = "Explore AnimalDex animal symbolism guides, from axolotl, snake, and octopus symbolism to biology-backed principle clusters that explain what animal behavior patterns can represent.";
const principleIndex = getBehavioralPrinciplesIndex(speciesSystemsIntelligence);
const symbolismPosts = blogPosts.filter((post) => post.slug.endsWith("-symbolism"));

function getAnimalSymbolismPath(locale: string) {
    return locale === localeConfig.defaultLocale ? "/animal-symbolism" : getLocalePath(locale, "/animal-symbolism");
}

function getAnimalSymbolismUrl(locale: string) {
    return new URL(getAnimalSymbolismPath(locale), getSiteUrl()).toString();
}

export async function generateMetadata({params}: AnimalSymbolismPageProps): Promise<Metadata> {
    const canonicalUrl = getAnimalSymbolismPath(params.locale);

    return {
        title: `${pageTitle} | AnimalDex`,
        description: pageDescription,
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
            title: `${pageTitle} | AnimalDex`,
            description: pageDescription,
            url: canonicalUrl,
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: `${pageTitle} | AnimalDex`}]
        }
    };
}

export default function AnimalSymbolismPage({params}: AnimalSymbolismPageProps) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: pageTitle,
        description: pageDescription,
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
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">Symbolism Index</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{pageTitle}</h1>
                <p className="text-lg md:text-xl text-ink-200 max-w-4xl">{pageDescription}</p>
            </div>

            <section className="rounded-4xl border border-primary-500/30 bg-primary-500/10 p-6 md:p-8 flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">Dedicated symbolism guides</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                        Long-form animal symbolism pages
                    </h2>
                    <p className="text-ink-200 text-lg md:text-xl max-w-5xl">
                        These guides keep their existing blog URLs, but this page now works as the main index for AnimalDex symbolism content.
                    </p>
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
                                    Read guide
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">Symbolism clusters</p>
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
                    Browse animal meaning by behavior pattern
                </h2>
                <p className="text-ink-200 text-lg md:text-xl max-w-5xl">
                    Principle clusters group animals by repeatable strategies in nature, so you can move from one dedicated guide into broader patterns like adaptation, patience, repair, speed, and social intelligence.
                </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {principleIndex.map((principle) => (
                    <section key={principle.principleSlug} className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                        <h2 className="text-white font-display font-bold text-3xl">{principle.principle}</h2>
                        <p className="text-ink-200">Symbolizes repeatable strategy patterns in nature.</p>
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
                            Explore symbolism cluster
                        </Link>
                    </section>
                ))}
            </div>
        </article>
    );
}
