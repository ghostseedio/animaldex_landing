import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {blogPosts} from "@/data/blog";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import Button from "@/app/[locale]/_components/button";
import {answerPages} from "@/data/answer-pages";

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const postKeywords = Array.from(new Set(blogPosts.flatMap((post) => post.searchIntents)));
    const title = messages.blog?.metaTitle || "AnimalDex Blog";
    const description = messages.blog?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...postKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/blog"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/blog`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/blog`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/blog"),
            images: [
                {
                    url: "/images/og-animaldex.svg",
                    width: 1200,
                    height: 630,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/og-animaldex.svg"]
        }
    };
}

export default async function BlogIndexPage() {
    const t = await getTranslations("blog");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/blog");
    const schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        blogPost: blogPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            url: getAbsoluteUrl(locale, `/blog/${post.slug}`),
            author: post.author ? {"@type": "Person", name: post.author} : {"@type": "Organization", name: "AnimalDex"}
        }))
    };

    return (
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {blogPosts.map((post) => (
                    <article
                        key={post.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <h2 className="font-display font-bold text-3xl text-white">{post.title}</h2>
                        <p className="text-ink-200 text-lg">{post.description}</p>
                        <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-4">
                            <span>{t("published")} {formatDate(locale, post.publishedAt)}</span>
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
                        <Link
                            href={`/blog/${post.slug}`}
                            className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                            underline
                        >
                            {t("readArticle")}
                        </Link>
                    </article>
                ))}
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("answersHubTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("answersHubDescription")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {answerPages.map((page) => (
                        <article key={page.slug} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-4 flex flex-col gap-2">
                            <h3 className="text-white text-xl font-semibold">{page.shortTitle}</h3>
                            <p className="text-ink-200 text-base">{page.metaDescription}</p>
                            <Link href={`/${page.slug}`} className="text-primary-200 hover:text-primary-100 transition-colors" underline>
                                {t("readAnswerPage")}
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <div className="flex justify-center">
                    <Link href="/#download">
                        <Button as="span">{t("ctaButton")}</Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
