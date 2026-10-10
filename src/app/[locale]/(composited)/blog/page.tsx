import {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getManagedBlogPosts, getManagedPageSummaries} from "@/lib/admin-content";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {answerPages, getAnswerPageImage} from "@/data/answer-pages";
import EditorialCard from "@/app/[locale]/(composited)/blog/_components/editorial-card";
import ArticleAppCta from "@/app/[locale]/(composited)/blog/_components/article-app-cta";
import {hasImage, imageFit} from "@/app/[locale]/(composited)/blog/_components/article-media";
import {withOgCard} from "@/lib/og/og-image";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const POSTS_PER_PAGE = 12;

type BlogIndexPageProps = {
    params: {locale: string};
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

export async function generateMetadata({params}: BlogIndexPageProps): Promise<Metadata> {
    const locale = params.locale;
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const indexedBlogPosts = await getManagedBlogPosts();
    const postKeywords = Array.from(new Set(indexedBlogPosts.flatMap((post) => post.searchIntents)));
    const title = messages.blog?.metaTitle || "AnimalDex Blog";
    const description = messages.blog?.metaDescription || messages.meta?.description || "";
    const currentPage = 1;
    const pagePath = getBlogPagePath(currentPage);
    const pageTitle = currentPage === 1
        ? title
        : `${title} – ${(messages.blog?.metaPageTitle || "Page {page}").replace("{page}", String(currentPage))}`;

    return withOgCard({
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
            url: getLocalePath(locale, pagePath)
        },
        twitter: {
            card: "summary_large_image",
            title: `${pageTitle} | AnimalDex`,
            description
        }
    }, "AnimalDex blog", "page", "blog");
}

export default async function BlogIndexPage({params}: BlogIndexPageProps) {
    const locale = params.locale;
    const t = await getScopedTranslator(locale, "blog");
    const indexedBlogPosts = await getManagedBlogPosts();
    const managedPageSummaries = await getManagedPageSummaries();
    const pageSummaryBySlug = new Map(managedPageSummaries.map((page) => [page.slug, page]));
    const currentPage = 1;
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
        <section className="editorial w-full bg-[color:var(--paper-950)] pb-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            {/* Masthead. A publication nameplate rather than a hero panel: no
                radial glow, no bordered box, just type on the page. */}
            <header className="editorial-grid pt-12 md:pt-16">
                <div className="span-wide flex flex-col gap-5 border-b border-[color:var(--rule)] pb-10 md:pb-14">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--lime)]">{t("eyebrow")}</p>
                        <span aria-hidden="true" className="h-px w-8 bg-[color:var(--rule-strong)]" />
                        <span className="font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">
                            {indexedBlogPosts.length} stories
                        </span>
                    </div>
                    <h1 className="max-w-[14ch] font-display text-[2.75rem] font-bold leading-[0.98] tracking-[-0.035em] text-[color:var(--text-100)] [text-wrap:balance] sm:text-6xl md:text-7xl lg:text-[5rem]">
                        Stories from the living world.
                    </h1>
                    <p className="max-w-[52ch] text-lg leading-[1.55] text-[color:var(--text-200)] md:text-xl">{t("description")}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2">
                        <a
                            href="#latest-stories"
                            className="group inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-100)] transition-colors hover:text-[color:var(--lime)]"
                        >
                            Latest stories
                            <span aria-hidden="true" className="transition-transform group-hover:translate-y-0.5">↓</span>
                        </a>
                        <Link
                            href="/blog/feed.xml"
                            className="text-[13px] font-semibold text-[color:var(--text-400)] transition-colors hover:text-[color:var(--text-100)]"
                        >
                            {t("rssLabel")}
                        </Link>
                    </div>
                </div>
            </header>

            {featuredPost && (
                <div className="editorial-grid pt-10 md:pt-14">
                    <article id="latest-stories" className="span-wide group scroll-mt-28">
                        {/* Without a photograph the lead is set wide and large, so
                            the slot reads as a deliberate typographic opener
                            rather than a half-empty image row. */}
                        <Link
                            href={`/blog/${featuredPost.slug}`}
                            className={hasImage(featuredPost.featuredImage)
                                ? "flex flex-col gap-7 lg:flex-row lg:items-center lg:gap-12"
                                : "flex flex-col gap-5 border-b border-[color:var(--rule)] pb-12"}
                        >
                            {hasImage(featuredPost.featuredImage) ? (
                                <div className="relative w-full shrink-0 overflow-hidden rounded-sm bg-[color:var(--paper-850)] lg:w-[58%]" style={{aspectRatio: "16 / 10"}}>
                                    <Image
                                        src={featuredPost.featuredImage.src}
                                        alt={featuredPost.featuredImage.alt}
                                        fill
                                        priority={currentPage === 1}
                                        sizes="(min-width: 1024px) 45rem, 100vw"
                                        className={`editorial-zoom ${imageFit(featuredPost.featuredImage)}`}
                                    />
                                </div>
                            ) : null}
                            <div className="flex min-w-0 flex-col gap-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--lime)]">
                                    Featured field guide
                                </p>
                                <h2 className={`font-display font-bold leading-[1.08] tracking-[-0.025em] text-[color:var(--text-100)] [text-wrap:balance] ${
                                    hasImage(featuredPost.featuredImage)
                                        ? "text-[2rem] md:text-[2.75rem]"
                                        : "max-w-[20ch] text-[2.25rem] md:text-[3.5rem] lg:text-[4rem]"
                                }`}>
                                    {featuredPost.title}
                                </h2>
                                <p className="max-w-[52ch] text-base leading-relaxed text-[color:var(--text-300)] md:text-lg">
                                    {featuredPost.description}
                                </p>
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">
                                    <span>{formatDate(locale, featuredPost.publishedAt)}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{featuredPost.readingMinutes} {t("minutes")}</span>
                                </p>
                                <span
                                    aria-hidden="true"
                                    className="mt-1 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-300)] transition-colors group-hover:text-[color:var(--lime)]"
                                >
                                    {t("readArticle")}
                                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                </span>
                            </div>
                        </Link>
                    </article>
                </div>
            )}

            {remainingPosts.length > 0 && (
                <div className="editorial-grid mt-16 md:mt-24">
                    <div className="span-wide flex flex-col gap-8">
                        <div className="flex items-center gap-4">
                            <h2 className="font-display text-xl font-bold tracking-[-0.015em] text-[color:var(--text-100)] md:text-2xl">
                                The archive
                            </h2>
                            <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--rule)]" />
                        </div>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                            {remainingPosts.map((post) => (
                                <article key={post.slug}>
                                    <EditorialCard
                                        href={`/blog/${post.slug}`}
                                        title={post.title}
                                        description={post.description}
                                        kicker={post.tags?.[0]}
                                        meta={`${formatDate(locale, post.publishedAt)} · ${post.readingMinutes} ${t("minutes")}`}
                                        image={post.featuredImage}
                                    />
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {totalPages > 1 && (
                <nav className="editorial-grid mt-16 md:mt-20" aria-label={t("paginationLabel")}>
                  <div className="span-wide flex flex-col items-center gap-4 border-t border-[color:var(--rule)] pt-10">
                    <p className="font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">
                        {t("pageLabel", {page: currentPage, totalPages})}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {currentPage > 1 && (
                            <Link
                                href={getBlogPagePath(currentPage - 1)}
                                rel="prev"
                                className="inline-flex min-h-[2.625rem] items-center rounded-full border border-[color:var(--rule-strong)] px-4 text-[13px] font-semibold text-[color:var(--text-200)] transition-colors hover:border-[color:var(--lime)] hover:text-[color:var(--text-100)]"
                            >
                                {t("previousPage")}
                            </Link>
                        )}
                        {paginationItems.map((item) => typeof item === "number" ? (
                            item === currentPage ? (
                                <span
                                    key={item}
                                    aria-current="page"
                                    className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center rounded-full border border-[color:var(--lime)] px-3 font-mono text-[13px] font-bold tabular-nums text-[color:var(--lime)]"
                                >
                                    {item}
                                </span>
                            ) : (
                                <Link
                                    key={item}
                                    href={getBlogPagePath(item)}
                                    aria-label={t("goToPage", {page: item})}
                                    className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center rounded-full px-3 font-mono text-[13px] tabular-nums text-[color:var(--text-300)] transition-colors hover:text-[color:var(--text-100)]"
                                >
                                    {item}
                                </Link>
                            )
                        ) : (
                            <span key={item} className="px-1 text-[color:var(--text-400)]" aria-hidden="true">…</span>
                        ))}
                        {currentPage < totalPages && (
                            <Link
                                href={getBlogPagePath(currentPage + 1)}
                                rel="next"
                                className="inline-flex min-h-[2.625rem] items-center rounded-full border border-[color:var(--rule-strong)] px-4 text-[13px] font-semibold text-[color:var(--text-200)] transition-colors hover:border-[color:var(--lime)] hover:text-[color:var(--text-100)]"
                            >
                                {t("nextPage")}
                            </Link>
                        )}
                    </div>
                  </div>
                </nav>
            )}

            {currentPage === 1 && (
                <section className="editorial-grid mt-16 md:mt-24">
                  <div className="span-wide">
                    <div className="flex flex-col gap-5 border-b border-[color:var(--rule)] pb-7 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--lime)]">Quick answers</p>
                                <span className="font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">
                                    {answerPages.length} guides
                                </span>
                            </div>
                            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-[color:var(--text-100)] md:text-3xl">{t("answersHubTitle")}</h2>
                            <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-[color:var(--text-300)]">{t("answersHubDescription")}</p>
                        </div>

                    </div>

                    <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                        {answerPages.map((page, index) => {
                            const pageSummary = pageSummaryBySlug.get(page.slug);
                            const guideImage = getAnswerPageImage(page, pageSummary?.featuredImage);
                            return (
                            <article key={page.slug} className="group min-w-0">
                                <Link
                                    href={`/${page.slug}`}
                                    aria-label={`${t("readAnswerPage")}: ${page.shortTitle}`}
                                    className="grid min-h-full grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-[color:var(--rule)] py-5 sm:grid-cols-[8rem_minmax(0,1fr)]"
                                >
                                    <div className="relative min-h-[4.5rem] overflow-hidden rounded-sm bg-[color:var(--paper-850)] sm:min-h-[5.5rem]">
                                        <Image
                                            src={guideImage.src}
                                            alt={guideImage.alt}
                                            fill
                                            unoptimized={guideImage.src.startsWith("http")}
                                            sizes="(min-width: 640px) 128px, 104px"
                                            className={`editorial-zoom ${imageFit(guideImage)}`}
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                        <p className="font-mono text-[10px] tabular-nums text-[color:var(--text-400)]">{String(index + 1).padStart(2, "0")}</p>
                                        <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-[color:var(--text-100)] sm:text-xl">
                                            {page.shortTitle}
                                        </h3>
                                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[color:var(--text-300)]">{page.metaDescription}</p>
                                        <span className="mt-auto inline-flex items-center gap-2 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-400)] transition-colors group-hover:text-[color:var(--lime)]">
                                            {t("readAnswerPage")}
                                            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                                        </span>
                                    </div>
                                </Link>
                            </article>
                            );
                        })}
                    </div>
                  </div>
                </section>
            )}

            <ArticleAppCta title={t("ctaTitle")} description={t("ctaDescription")} />
        </section>
    );
}
