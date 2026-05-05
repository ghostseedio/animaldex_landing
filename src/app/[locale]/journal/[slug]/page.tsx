import Link from "@/app/[locale]/_components/link";
import {getJournalPost, getRelatedJournalPosts, journalPosts} from "@/data/journal";
import {Metadata} from "next";
import {notFound} from "next/navigation";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";

type JournalPostPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata({params}: JournalPostPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const post = getJournalPost(slug);

    if (!post) {
        return {};
    }

    return {
        title: post.title,
        description: post.description,
        keywords: [...post.tags, ...post.searchIntents],
        alternates: {
            canonical: getLocalePath(locale, `/journal/${post.slug}`),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/journal/${post.slug}`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/journal/${post.slug}`
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${post.title} | AnimalDex`,
            description: post.description,
            url: getLocalePath(locale, `/journal/${post.slug}`),
            publishedTime: post.publishedAt,
            modifiedTime: post.updatedAt,
            tags: post.tags,
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${post.title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${post.title} | AnimalDex`,
            description: post.description,
            images: ["/images/og.png"]
        }
    };
}

export default async function JournalPostPage({params}: JournalPostPageProps) {
    const {locale, slug} = params;
    const post = getJournalPost(slug);
    const t = await getScopedTranslator(locale, "journal");

    if (!post) {
        notFound();
    }

    const postUrl = getAbsoluteUrl(locale, `/journal/${post.slug}`);
    const relatedPosts = getRelatedJournalPosts(post.slug, 3);
    const schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        inLanguage: locale,
        url: postUrl,
        keywords: post.searchIntents.join(", "),
        articleSection: post.tags,
        author: {
            "@type": "Organization",
            name: "AnimalDex"
        },
        publisher: {
            "@type": "Organization",
            name: "AnimalDex"
        }
    };

    return (
        <article className="w-full max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}}
            />

            <div className="flex flex-col gap-4">
                <Link href="/journal" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {t("back")}
                </Link>
                <div className="flex flex-wrap gap-2 text-sm text-primary-200">
                    {post.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-primary-500/30 px-3 py-1">
                            {tag}
                        </span>
                    ))}
                </div>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{post.title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{post.description}</p>
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-4">
                    <span>{t("published")} {formatDate(locale, post.publishedAt)}</span>
                    <span>{t("updated")} {formatDate(locale, post.updatedAt)}</span>
                    <span>{post.readingMinutes} {t("minutes")}</span>
                </div>
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-2">
                    <span className="text-white">{t("audiencesLabel")}:</span>
                    {post.audiences.map((audience) => (
                        <span key={audience} className="rounded-full border border-line-300/80 px-3 py-1">{audience}</span>
                    ))}
                </div>
                <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-2">
                    <span className="text-white">{t("intentsLabel")}:</span>
                    {post.searchIntents.map((intent) => (
                        <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200">{intent}</span>
                    ))}
                </div>
            </div>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-8">
                {post.sections.map((section) => (
                    <section key={section.title} className="flex flex-col gap-4">
                        <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{section.title}</h2>
                        {section.paragraphs.map((paragraph) => (
                            <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                                {paragraph}
                            </p>
                        ))}
                    </section>
                ))}
            </div>

            {relatedPosts.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-4xl text-white">{t("relatedTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("relatedDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedPosts.map((relatedPost) => (
                            <article
                                key={relatedPost.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">{relatedPost.title}</h3>
                                <p className="text-ink-200 text-base">{relatedPost.description}</p>
                                <Link
                                    href={`/journal/${relatedPost.slug}`}
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
