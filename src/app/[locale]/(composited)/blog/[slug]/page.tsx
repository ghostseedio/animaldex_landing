import {Metadata} from "next";
import {notFound} from "next/navigation";
import Button from "@/app/[locale]/_components/button";
import Link from "@/app/[locale]/_components/link";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import {getAnswerPagesForIntents} from "@/data/answer-pages";
import {BlogMediaBlock, ContentImage} from "@/data/content-schema";
import {blogPosts, getBlogPost, getRelatedBlogPosts} from "@/data/blog";
import {getSpeciesBySlug} from "@/data/species";
import {getSystemsIntelligenceEntriesForSpeciesSlugs} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type BlogPostPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function formatSpeciesSlugName(slug: string) {
    return slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

function renderImageGallery(images: ContentImage[]) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((image) => (
                <ContentImageFigure
                    key={`${image.src}-${image.alt}`}
                    image={image}
                    sizes="(min-width: 1280px) 460px, (min-width: 768px) 40vw, 100vw"
                />
            ))}
        </div>
    );
}

function renderSectionMedia(media: BlogMediaBlock) {
    if (media.type === "image") {
        return <ContentImageFigure image={media.image} />;
    }

    return (
        <div className="flex flex-col gap-4">
            {media.title && (
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200">
                    {media.title}
                </p>
            )}
            {renderImageGallery(media.images)}
        </div>
    );
}

export async function generateMetadata({params}: BlogPostPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const post = getBlogPost(slug);

    if (!post) {
        return {};
    }

    return buildContentMetadata({
        locale,
        pathname: `/blog/${post.slug}`,
        title: post.title,
        description: post.description,
        keywords: [...post.searchIntents, ...post.tags],
        featuredImage: post.featuredImage,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        tags: post.tags
    });
}

export function generateStaticParams() {
    return blogPosts.map((post) => ({slug: post.slug}));
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "blog");
    const post = getBlogPost(slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = getRelatedBlogPosts(post.slug, 3);
    const relatedAnswerPages = getAnswerPagesForIntents(post.searchIntents, 3);
    const speciesLinks = post.speciesSlugs
        .map((speciesSlug) => getSpeciesBySlug(speciesSlug))
        .filter((entry): entry is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(entry));
    const systemsItems = getSystemsIntelligenceEntriesForSpeciesSlugs(post.systemsSpeciesSlugs || [])
        .flatMap(({slug: speciesSlug, entry}) => {
            const species = getSpeciesBySlug(speciesSlug);

            return [{
                slug: speciesSlug,
                name: species?.name || formatSpeciesSlugName(speciesSlug),
                href: species ? `/animals/${species.slug}` : undefined,
                entry
            }];
        });

    const postUrl = getAbsoluteUrl(locale, `/blog/${post.slug}`);
    const schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        inLanguage: locale,
        url: postUrl,
        image: getAbsoluteUrl(locale, post.featuredImage.src),
        articleSection: post.tags,
        keywords: post.searchIntents.join(", "),
        author: post.author ? {"@type": "Person", name: post.author} : {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        ...(post.updatedAt ? {dateModified: post.updatedAt} : {})
    };
    const faqSchema = post.faq && post.faq.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    } : null;
    const schemas = faqSchema ? [schema, faqSchema] : [schema];

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <div className="flex flex-col gap-4">
                <Link href="/blog" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{post.title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{post.description}</p>
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-4">
                    <span>{t("published")} {formatDate(locale, post.publishedAt)}</span>
                    {post.updatedAt && <span>{t("updated")} {formatDate(locale, post.updatedAt)}</span>}
                    <span>{post.readingMinutes} {t("minutes")}</span>
                    {post.author && <span>{t("author")} {post.author}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <ContentImageFigure image={post.featuredImage} priority />

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-8">
                {post.sections.map((section) => {
                    const sectionSpecies = (section.speciesSlugs || [])
                        .map((speciesSlug) => getSpeciesBySlug(speciesSlug))
                        .filter((entry): entry is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(entry));

                    return (
                        <section key={section.title} className="flex flex-col gap-4">
                            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{section.title}</h2>
                            {section.paragraphs.map((paragraph) => (
                                <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                                    {paragraph}
                                </p>
                            ))}
                            {section.media && renderSectionMedia(section.media)}
                            {sectionSpecies.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {sectionSpecies.map((species) => (
                                        <Link
                                            key={species.slug}
                                            href={`/animals/${species.slug}`}
                                            className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100 text-sm"
                                        >
                                            {species.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            <SystemsIntelligenceSection
                items={systemsItems}
                labels={{
                    title: t("systemsIntelligenceTitle"),
                    description: t("systemsIntelligenceDescription"),
                    systemRole: t("systemRoleLabel"),
                    specializedHardware: t("specializedHardwareLabel"),
                    systemsScript: t("systemsScriptLabel"),
                    strategicInsight: t("strategicInsightLabel"),
                    readSpeciesGuide: t("readSpeciesGuide")
                }}
            />

            {post.faq && post.faq.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                    {post.faq.map((item) => (
                        <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                            <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                        </div>
                    ))}
                </section>
            )}

            {speciesLinks.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("speciesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("speciesDescription")}</p>
                    <div className="flex flex-wrap gap-2">
                        {speciesLinks.map((species) => (
                            <Link
                                key={species.slug}
                                href={`/animals/${species.slug}`}
                                className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100 text-sm"
                            >
                                {species.name}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {relatedAnswerPages.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("answerPagesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("answerPagesDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedAnswerPages.map((page) => (
                            <article
                                key={page.slug}
                                className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{page.shortTitle}</h3>
                                <p className="text-ink-200 text-base">{page.metaDescription}</p>
                                <Link
                                    href={`/${page.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readAnswerPage")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                </div>
            </div>

            {relatedPosts.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedTitle")}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedPosts.map((relatedPost) => (
                            <article
                                key={relatedPost.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{relatedPost.title}</h3>
                                <p className="text-ink-200 text-base">{relatedPost.description}</p>
                                <Link
                                    href={`/blog/${relatedPost.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readArticle")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
}
