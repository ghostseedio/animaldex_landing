import {Metadata} from "next";
import {notFound} from "next/navigation";
import {getLocale} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import {EarnContentLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import SupportArticleFeedback from "@/app/[locale]/(composited)/support/_components/support-article-feedback";
import {getSupportContent} from "@/data/support-content";
import {
    getRelatedSupportArticles,
    getSupportArticleBySlugs,
    getSupportArticlePath,
    slugifySupportText
} from "@/lib/support-articles";
import {getSupportChatHref} from "@/lib/support-chat";
import {getSupportArticleFeedbackStatsForArticle} from "@/lib/support-article-feedback";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type ArticlePageProps = {
    params: {locale: string; categorySlug: string; articleSlug: string};
};

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: ArticlePageProps): Promise<Metadata> {
    const locale = await getLocale();
    const article = getSupportArticleBySlugs(params.categorySlug, params.articleSlug, locale);
    if (!article) return {};

    const path = getSupportArticlePath(article);

    return {
        title: `${article.title} — AnimalDex Help Center`,
        description: article.summary,
        alternates: {
            canonical: getLocalePath(locale, path),
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, path);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, path)} as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: article.title,
            description: article.summary,
            url: getLocalePath(locale, path)
        }
    };
}

export default async function SupportArticlePage({params}: ArticlePageProps) {
    const locale = await getLocale();
    const content = getSupportContent(locale);
    const article = getSupportArticleBySlugs(params.categorySlug, params.articleSlug, locale);

    if (!article) notFound();

    const related = getRelatedSupportArticles(article, 3, locale);
    const [talkToSupportHref, feedbackStats] = await Promise.all([
        getSupportChatHref(),
        getSupportArticleFeedbackStatsForArticle(article.id)
    ]);
    const path = getSupportArticlePath(article);
    const updated = new Date(article.updatedAt).toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.summary,
        dateModified: article.updatedAt,
        datePublished: article.publishedAt,
        url: getAbsoluteUrl(locale, path),
        articleSection: article.categoryTitle,
        inLanguage: locale
    };

    return (
        <div className="relative w-full overflow-hidden bg-[#07100B]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(33,192,94,0.08),transparent_62%)]" />

            <article className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

                <header className="flex flex-col gap-4">
                    <nav aria-label="Breadcrumb" className="text-sm text-ink-400">
                        <ol className="flex flex-wrap items-center gap-2">
                            <li><Link href="/support" className="hover:text-primary-200">{content.eyebrow}</Link></li>
                            <li aria-hidden="true" className="text-primary-200/35">/</li>
                            <li><Link href={`/support#${article.categorySlug}`} className="hover:text-primary-200">{article.categoryTitle}</Link></li>
                        </ol>
                    </nav>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-primary-200">{article.categoryTitle}</p>
                    <h1 className="font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl">
                        {article.title}
                    </h1>
                    <p className="text-lg leading-relaxed text-ink-200">{article.summary}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-500">{content.articleUpdatedLabel} {updated}</p>
                </header>

                <div className="prose-support space-y-4 text-base leading-relaxed text-ink-100 md:text-lg">
                    {article.body.split(/\n\n+/).map((paragraph) => (
                        <p key={slugifySupportText(paragraph).slice(0, 48)}>{paragraph}</p>
                    ))}
                    {article.linkHref && article.linkLabel ? (
                        <p>
                            <EarnContentLink href={article.linkHref} source="support" className="font-semibold text-primary-200 underline underline-offset-4 hover:text-white">
                                {article.linkLabel}
                            </EarnContentLink>
                        </p>
                    ) : null}
                </div>

                <SupportArticleFeedback
                    articleId={article.id}
                    yesLabel={content.feedbackYes}
                    noLabel={content.feedbackNo}
                    prompt={content.feedbackPrompt}
                    thanksYes={content.feedbackThanksYes}
                    thanksNo={content.feedbackThanksNo}
                    stillStuckLabel={content.feedbackStillStuck}
                    escalationDescription={content.feedbackEscalationDescription}
                    talkToSupportLabel={content.talkToSupportLabel}
                    talkToSupportHref={talkToSupportHref}
                    statsSummaryTemplate={content.feedbackStatsSummary}
                    statsFirstLabel={content.feedbackStatsFirst}
                    initialStats={{
                        helpfulCount: feedbackStats.helpfulCount,
                        unhelpfulCount: feedbackStats.unhelpfulCount,
                        helpfulnessPercent: feedbackStats.helpfulnessPercent
                    }}
                />

                {related.length ? (
                    <section aria-labelledby="related-articles-title">
                        <h2 id="related-articles-title" className="font-display text-sm font-black uppercase tracking-[0.22em] text-ink-400">
                            {content.relatedArticlesLabel}
                        </h2>
                        <ul className="mt-4 space-y-3">
                            {related.map((item) => (
                                <li key={item.id}>
                                    <Link href={getSupportArticlePath(item)} className="block rounded-2xl border border-white/[0.07] bg-[#071B0F]/80 px-4 py-4 transition-colors hover:border-primary-200/30 hover:text-white">
                                        <span className="font-display text-lg font-bold text-white">{item.title}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </article>
        </div>
    );
}
