import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getManagedBlogPosts, getManagedPageSummaries} from "@/lib/admin-content";
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
    const indexedBlogPosts = await getManagedBlogPosts();
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
    const indexedBlogPosts = await getManagedBlogPosts();
    const managedPageSummaries = await getManagedPageSummaries();
    const pageSummaryBySlug = new Map(managedPageSummaries.map((page) => [page.slug, page]));
    const currentPage = getRequestedPage(searchParams?.page);
    const totalPages = Math.max(1, Math.ceil(indexedBlogPosts.length / POSTS_PER_PAGE));

    if (currentPage > totalPages) {
        notFound();
    }

    const pagePath = getBlogPagePath(currentPage);
    const pageUrl = getAbsoluteUrl(locale, pagePath);
    const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
    const paginatedPosts = indexedBlogPosts.slice(pageStart, pageStart + POSTS_PER_PAGE);
    const [featuredPost, ...remainingPosts] = paginatedPosts;
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
        <section className="relative mx-auto flex w-full max-w-[92rem] flex-col gap-10 overflow-hidden px-4 py-10 md:px-8 md:py-16 lg:gap-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[42rem] w-[72rem] -translate-x-1/2 rounded-full bg-primary-500/[0.08] blur-[140px]" />

            <div className="relative overflow-hidden rounded-[2rem] border border-primary-500/20 bg-[radial-gradient(circle_at_80%_0%,rgba(81,214,132,0.14),transparent_38%),linear-gradient(145deg,rgba(17,37,25,0.98),rgba(9,18,13,0.98))] px-6 py-10 shadow-[0_35px_120px_-65px_rgba(68,219,128,0.5)] md:px-10 md:py-14 lg:px-14">
                <div className="absolute inset-y-0 right-0 hidden w-2/5 opacity-20 [background-image:radial-gradient(circle,rgba(126,238,162,0.8)_1px,transparent_1px)] [background-size:18px_18px] lg:block" />
                <div className="relative flex max-w-5xl flex-col gap-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary-200 md:text-sm">{t("eyebrow")}</p>
                        <span className="h-px w-10 bg-primary-400/60" aria-hidden="true" />
                        <span className="text-sm text-ink-300">{indexedBlogPosts.length} field notes and deep dives</span>
                    </div>
                    <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.96] tracking-[-0.04em] text-white md:text-7xl lg:text-[5.5rem]">
                        Stories from the <span className="text-primary-100">living world.</span>
                    </h1>
                    <p className="max-w-3xl text-lg leading-8 text-ink-200 md:text-xl">{t("description")}</p>
                    <div className="flex flex-wrap gap-3">
                        <a href="#latest-stories" className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-primary-200/45 bg-canvas-950/85 px-6 text-sm font-black text-primary-100 shadow-[0_14px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:border-primary-100 hover:bg-primary-400 hover:text-canvas-950">
                            Explore latest stories
                        </a>
                        <Link href="/blog/feed.xml" className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-line-200/70 bg-white/[0.03] px-6 text-sm font-semibold text-ink-100 transition-colors hover:border-primary-300 hover:text-primary-100">
                            {t("rssLabel")}
                        </Link>
                    </div>
                </div>
            </div>

            {featuredPost && (
                <article id="latest-stories" className="group grid scroll-mt-28 overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900/80 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.95)] lg:grid-cols-[1.15fr_0.85fr]">
                    <Link href={`/blog/${featuredPost.slug}`} className="relative min-h-[20rem] overflow-hidden bg-surface-800 lg:min-h-[32rem]">
                        <Image
                            src={featuredPost.featuredImage.src}
                            alt={featuredPost.featuredImage.alt}
                            fill
                            priority={currentPage === 1}
                            sizes="(min-width: 1024px) 58vw, 100vw"
                            className="object-cover transition duration-700 group-hover:scale-[1.035]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-canvas-950/50 via-transparent to-transparent" />
                        <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-canvas-950/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-100 backdrop-blur">
                            Featured field guide
                        </span>
                    </Link>
                    <div className="flex flex-col justify-center gap-5 p-6 md:p-9 lg:p-12">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-300">
                            <span>{formatDate(locale, featuredPost.publishedAt)}</span>
                            <span className="h-1 w-1 rounded-full bg-primary-300" aria-hidden="true" />
                            <span>{featuredPost.readingMinutes} {t("minutes")}</span>
                        </div>
                        <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.025em] text-white md:text-5xl">
                            <Link href={`/blog/${featuredPost.slug}`} className="transition-colors hover:text-primary-100">
                                {featuredPost.title}
                            </Link>
                        </h2>
                        <p className="text-lg leading-8 text-ink-200">{featuredPost.description}</p>
                        <div className="flex flex-wrap gap-2">
                            {featuredPost.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full border border-primary-500/25 bg-primary-500/[0.06] px-3 py-1 text-xs text-primary-100">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <Link href={`/blog/${featuredPost.slug}`} className="mt-2 inline-flex w-fit items-center gap-2 text-base font-bold text-primary-200 transition-all hover:gap-3 hover:text-primary-100">
                            {t("readArticle")} <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                </article>
            )}

            {remainingPosts.length > 0 && (
                <div className="flex flex-col gap-6">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-200">The archive</p>
                            <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">More discoveries</h2>
                        </div>
                        <p className="hidden text-sm text-ink-300 sm:block">Curated for curious minds</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
                {remainingPosts.map((post) => (
                    <article
                        key={post.slug}
                        className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-line-300 bg-surface-900/75 transition duration-300 hover:-translate-y-1 hover:border-primary-500/35 hover:shadow-[0_24px_70px_-45px_rgba(82,223,132,0.45)]"
                    >
                        <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-800/60">
                            <Image
                                src={post.featuredImage.src}
                                alt={post.featuredImage.alt}
                                width={post.featuredImage.width}
                                height={post.featuredImage.height}
                                sizes="(min-width: 1536px) 29vw, (min-width: 1024px) 44vw, 100vw"
                                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-canvas-950/45 to-transparent opacity-60" />
                        </Link>
                        <div className="flex flex-1 flex-col gap-4 p-6">
                            <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.1em] text-ink-300">
                                <span>{formatDate(locale, post.publishedAt)}</span>
                                <span className="h-1 w-1 rounded-full bg-primary-300" aria-hidden="true" />
                                <span>{post.readingMinutes} {t("minutes")}</span>
                            </div>
                            <h3 className="font-display text-3xl font-bold leading-tight text-white">
                                <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-primary-100">{post.title}</Link>
                            </h3>
                            <p className="line-clamp-3 text-base leading-7 text-ink-200">{post.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {post.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="rounded-full border border-primary-500/25 px-3 py-1 text-xs text-primary-200">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <Link
                                href={`/blog/${post.slug}`}
                                className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-bold text-primary-200 transition-all hover:gap-3 hover:text-primary-100"
                            >
                                {t("readArticle")} <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </article>
                ))}
                    </div>
                </div>
            )}

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

            {currentPage === 1 && (
                <section className="overflow-hidden rounded-[2rem] border border-line-300 bg-[linear-gradient(145deg,rgba(16,29,21,0.96),rgba(9,17,12,0.98))] shadow-[0_28px_90px_-60px_rgba(61,210,119,0.38)]">
                    <div className="flex flex-col gap-5 border-b border-line-300 px-6 py-7 md:flex-row md:items-end md:justify-between md:px-9 md:py-9">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-3">
                                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">Quick answers</p>
                                <span className="rounded-full border border-primary-500/25 bg-primary-500/10 px-2.5 py-1 text-[11px] font-bold text-primary-100">
                                    {answerPages.length} guides
                                </span>
                            </div>
                            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">{t("answersHubTitle")}</h2>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-300 md:text-lg">{t("answersHubDescription")}</p>
                        </div>
                        <p className="hidden shrink-0 text-sm font-semibold text-ink-400 md:block">Choose a topic to get started</p>
                    </div>

                    <div className="grid grid-cols-1 gap-px bg-line-300/80 md:grid-cols-2">
                        {answerPages.map((page, index) => {
                            const pageSummary = pageSummaryBySlug.get(page.slug);
                            const guideImage = pageSummary?.featuredImage ?? {
                                src: "/images/og.png",
                                alt: `${page.shortTitle} guide on AnimalDex`,
                                width: 1200,
                                height: 630
                            };
                            return (
                            <article key={page.slug} className="group min-w-0 bg-surface-900/95">
                                <Link
                                    href={`/${page.slug}`}
                                    aria-label={`${t("readAnswerPage")}: ${page.shortTitle}`}
                                    className="grid min-h-full grid-cols-[9rem_minmax(0,1fr)] gap-4 p-4 transition-colors hover:bg-primary-500/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary-300 sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-5 lg:grid-cols-[14rem_minmax(0,1fr)]"
                                >
                                    <div className="relative min-h-[8rem] overflow-hidden rounded-xl bg-surface-800 sm:min-h-[9rem] lg:min-h-[9.75rem]">
                                        <Image
                                            src={guideImage.src}
                                            alt={guideImage.alt}
                                            fill
                                            unoptimized={guideImage.src.startsWith("http")}
                                            sizes="(min-width: 640px) 128px, 104px"
                                            className="object-cover transition duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-canvas-950/35 to-transparent" />
                                        <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-canvas-950/75 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-primary-100 backdrop-blur">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-200">AnimalDex answer</p>
                                        <h3 className="mt-1.5 font-display text-xl font-bold leading-tight text-white transition-colors group-hover:text-primary-100 sm:text-2xl">
                                            {page.shortTitle}
                                        </h3>
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-300 sm:text-[15px]">{page.metaDescription}</p>
                                        <span className="mt-auto inline-flex items-center gap-2 pt-3 text-sm font-bold text-primary-200">
                                            {t("readAnswerPage")}
                                            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                                        </span>
                                    </div>
                                </Link>
                            </article>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("ctaTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("ctaDescription")}</p>
                <StoreLinks />
            </div>
        </section>
    );
}
