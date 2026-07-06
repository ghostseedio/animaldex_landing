import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getIndexedBlogPosts} from "@/data/blog";
import {loadLocaleMessages} from "@/loaders/locale";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {answerPages} from "@/data/answer-pages";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

const POSTS_PER_PAGE = 12;

type BlogIndexPageProps = {
    searchParams?: {
        page?: string | string[];
    };
};

function getSingleParam(value?: string | string[]) {
    return Array.isArray(value) ? value[0] : value;
}

function getRequestedPage(value?: string | string[]) {
    const page = Number.parseInt(getSingleParam(value) ?? "1", 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function getBlogPagePath(page: number) {
    return page === 1 ? "/blog" : `/blog?page=${page}`;
}

function getPaginationItems(currentPage: number, totalPages: number) {
    if (totalPages <= 7) {
        return Array.from({length: totalPages}, (_, index) => index + 1);
    }

    const pages = Array.from(new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]))
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

    return pages.flatMap<(number | string)>((page, index) => {
        const previousPage = pages[index - 1];
        return previousPage && page - previousPage > 1
            ? [`gap-${previousPage}-${page}`, page]
            : [page];
    });
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata({searchParams}: BlogIndexPageProps): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const indexedBlogPosts = getIndexedBlogPosts();
    const postKeywords = Array.from(new Set(indexedBlogPosts.flatMap((post) => post.searchIntents)));
    const title = messages.blog?.metaTitle || "AnimalDex Blog";
    const description = messages.blog?.metaDescription || messages.meta?.description || "";
    const currentPage = getRequestedPage(searchParams?.page);
    const pagePath = getBlogPagePath(currentPage);
    const pageTitle = currentPage === 1
        ? title
        : `${title} – ${(messages.blog?.metaPageTitle || "Page {page}").replace("{page}", String(currentPage))}`;

    return {
        title: pageTitle,
        description,
        keywords: [...baseKeywords, ...postKeywords],
        alternates: {
            canonical: getLocalePath(locale, pagePath),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, pagePath);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, pagePath)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${pageTitle} | AnimalDex`,
            description,
            url: getLocalePath(locale, pagePath),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${pageTitle} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${pageTitle} | AnimalDex`,
            description,
            images: ["/images/og.png"]
        }
    };
}

export default async function BlogIndexPage({searchParams}: BlogIndexPageProps) {
    const t = await getTranslations("blog");
    const locale = await getLocale();
    const indexedBlogPosts = getIndexedBlogPosts();
    const currentPage = getRequestedPage(searchParams?.page);
    const totalPages = Math.max(1, Math.ceil(indexedBlogPosts.length / POSTS_PER_PAGE));

    if (currentPage > totalPages) {
        notFound();
    }

    const pagePath = getBlogPagePath(currentPage);
    const pageUrl = getAbsoluteUrl(locale, pagePath);
    const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
    const paginatedPosts = indexedBlogPosts.slice(pageStart, pageStart + POSTS_PER_PAGE);
    const paginationItems = getPaginationItems(currentPage, totalPages);
    const schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        blogPost: paginatedPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            url: getAbsoluteUrl(locale, `/blog/${post.slug}`),
            author: post.author ? {"@type": "Person", name: post.author} : {"@type": "Organization", name: "AnimalDex"}
        }))
    };

    return (
        <section className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="flex flex-col gap-4 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{t("eyebrow")}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl">{t("title")}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{t("description")}</p>
                <Link href="/blog/feed.xml" className="text-primary-200 text-lg hover:text-primary-100 transition-colors" underline>
                    {t("rssLabel")}
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                {paginatedPosts.map((post) => (
                    <article
                        key={post.slug}
                        className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                    >
                        <Link href={`/blog/${post.slug}`} className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60">
                            <Image
                                src={post.featuredImage.src}
                                alt={post.featuredImage.alt}
                                width={post.featuredImage.width}
                                height={post.featuredImage.height}
                                sizes="(min-width: 1536px) 29vw, (min-width: 1024px) 44vw, 100vw"
                                className="h-auto w-full object-cover"
                            />
                        </Link>
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

            {totalPages > 1 && (
                <nav className="flex flex-col items-center gap-4" aria-label={t("paginationLabel")}>
                    <p className="text-sm text-ink-300">
                        {t("pageLabel", {page: currentPage, totalPages})}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {currentPage > 1 && (
                            <Link
                                href={getBlogPagePath(currentPage - 1)}
                                rel="prev"
                                className="rounded-full border border-line-300 px-4 py-2 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"
                            >
                                {t("previousPage")}
                            </Link>
                        )}
                        {paginationItems.map((item) => typeof item === "number" ? (
                            item === currentPage ? (
                                <span
                                    key={item}
                                    aria-current="page"
                                    className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center rounded-full bg-primary-400 px-3 font-bold text-canvas-950"
                                >
                                    {item}
                                </span>
                            ) : (
                                <Link
                                    key={item}
                                    href={getBlogPagePath(item)}
                                    aria-label={t("goToPage", {page: item})}
                                    className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center rounded-full border border-line-300 px-3 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"
                                >
                                    {item}
                                </Link>
                            )
                        ) : (
                            <span key={item} className="px-1 text-ink-400" aria-hidden="true">…</span>
                        ))}
                        {currentPage < totalPages && (
                            <Link
                                href={getBlogPagePath(currentPage + 1)}
                                rel="next"
                                className="rounded-full border border-line-300 px-4 py-2 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"
                            >
                                {t("nextPage")}
                            </Link>
                        )}
                    </div>
                </nav>
            )}

            {currentPage === 1 && <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
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
            </section>}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <StoreLinks />
            </div>
        </section>
    );
}
