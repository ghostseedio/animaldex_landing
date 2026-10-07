import {Fragment} from "react";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {EarnContentLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import ArticleHero from "@/app/[locale]/(composited)/blog/_components/article-hero";
import ArticleFigure, {ArticleFigurePair} from "@/app/[locale]/(composited)/blog/_components/article-figure";
import {ArticleTocInline, ArticleTocRail} from "@/app/[locale]/(composited)/blog/_components/article-toc";
import {MINIMUM_TOC_SECTIONS} from "@/app/[locale]/(composited)/blog/_components/article-toc-config";
import ArticleAppCta from "@/app/[locale]/(composited)/blog/_components/article-app-cta";
import EditorialCard, {EditorialSectionHeading} from "@/app/[locale]/(composited)/blog/_components/editorial-card";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import {getAnswerPagesForIntents} from "@/data/answer-pages";
import {BlogMediaBlock, ContentImage} from "@/data/content-schema";
import {BlogLink, getBlogPost, getMentionedSpeciesSlugs, getRelatedBlogPosts, getRelatedChallengesForBlogPost} from "@/data/blog";
import {getSpeciesBySlug} from "@/data/species";
import {getSystemsIntelligenceEntriesForSpeciesSlugs} from "@/data/species-systems-intelligence";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteAssetUrl, getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";
import BlogListenControl from "@/app/[locale]/(composited)/blog/_components/blog-listen-control";
import {getManagedBlogPost} from "@/lib/admin-content";
import {canRenderCodeBlock, getRenderedCodeDocument} from "@/lib/rendered-code-block";
import RenderedCodeFrame from "@/app/_components/rendered-code-frame";

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
    return [
        {locale: "en", slug: "axolotl-symbolism"},
        {locale: "id", slug: "axolotl-symbolism"}
    ];
}

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

function buildNarrationText(post: NonNullable<ReturnType<typeof getBlogPost>>) {
    const sectionText = post.sections.flatMap((section) => [
        section.title,
        ...section.paragraphs,
        ...(section.cards || []).flatMap((card) => [card.label, card.body]),
        ...(section.table?.rows || []).flatMap((row) => row.cells),
        ...(section.subsections || []).flatMap((subsection) => [
            subsection.title,
            ...subsection.paragraphs
        ])
    ]);
    const faqText = (post.faq || []).flatMap((item) => [
        item.question,
        item.answer
    ]);

    return [
        post.title,
        post.description,
        ...sectionText,
        ...(faqText.length > 0 ? ["Frequently asked questions", ...faqText] : [])
    ].join(". ");
}

function renderImageGallery(images: ContentImage[]) {
    return <ArticleFigurePair images={images} />;
}

function renderSectionMedia(media: BlogMediaBlock) {
    if (media.type === "image") {
        return <ArticleFigure image={media.image} />;
    }

    if (media.type === "video") {
        return (
            <figure className="span-wide my-10 flex flex-col gap-3 md:my-14">
                {media.title && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">
                        {media.title}
                    </p>
                )}
                <div className="overflow-hidden rounded-sm bg-[color:var(--paper-850)]">
                    <iframe
                        src={media.embedUrl}
                        title={media.title || "AnimalDex video"}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
                {(media.caption || media.watchUrl) && (
                    <figcaption className="editorial-caption max-w-[52ch]">
                        {media.caption}
                        {media.watchUrl && (
                            <>
                                {" "}
                                <a
                                    href={media.watchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[color:var(--text-200)] underline decoration-[rgba(167,244,50,0.45)] underline-offset-4 transition-colors hover:decoration-[color:var(--lime)]"
                                >
                                    Watch on YouTube
                                </a>
                            </>
                        )}
                    </figcaption>
                )}
            </figure>
        );
    }

    return (
        <div className="span-wide my-10 flex flex-col gap-3 md:my-14">
            {media.title && (
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">
                    {media.title}
                </p>
            )}
            {renderImageGallery(media.images)}
        </div>
    );
}

function renderPullQuote(quote: string) {
    return (
        <blockquote className="span-wide my-10 border-l-2 border-[rgba(167,244,50,0.5)] pl-6 md:my-14 md:pl-8">
            <p className="max-w-[26ch] font-display text-[1.75rem] font-bold leading-[1.2] tracking-[-0.02em] text-[color:var(--text-100)] [text-wrap:balance] md:text-[2.5rem]">
                {quote}
            </p>
        </blockquote>
    );
}

function parseGenerationParagraph(paragraph: string) {
    const match = paragraph.match(/^(Generation [IVX]+):\s*(.+)$/);

    if (!match) {
        return null;
    }

    return {
        label: match[1],
        body: match[2]
    };
}

function pluralizeWord(word: string) {
    const lowerWord = word.toLowerCase();
    const irregularPlurals: Record<string, string> = {
        wolf: "wolves",
        jellyfish: "jellyfish",
        octopus: "octopuses"
    };

    if (irregularPlurals[lowerWord]) {
        return irregularPlurals[lowerWord];
    }

    if (lowerWord.endsWith("fe")) {
        return `${word.slice(0, -2)}ves`;
    }

    if (lowerWord.endsWith("f")) {
        return `${word.slice(0, -1)}ves`;
    }

    if (lowerWord.endsWith("y") && !/[aeiou]y$/.test(lowerWord)) {
        return `${word.slice(0, -1)}ies`;
    }

    if (/(s|x|z|ch|sh)$/i.test(word)) {
        return `${word}es`;
    }

    return `${word}s`;
}

function buildPluralPhrase(text: string) {
    const words = text.split(" ");

    if (words.length === 0) {
        return text;
    }

    const lastWord = words[words.length - 1];
    return [...words.slice(0, -1), pluralizeWord(lastWord)].join(" ");
}

function toAnchorId(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

function renderTableOfContents(items: string[], variant: "mobile" | "desktop") {
    if (items.length === 0) {
        return null;
    }

    const isDesktop = variant === "desktop";

    return (
        <nav
            className={isDesktop
                ? "hidden xl:flex sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto  border border-line-300 bg-surface-900/85 backdrop-blur px-5 py-6 flex-col gap-4"
                : "xl:hidden  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-7 md:px-8 flex flex-col gap-4"
            }
            aria-label="Table of contents"
        >
            <h2 className={isDesktop
                ? "font-display font-bold text-2xl text-white"
                : "font-display font-bold text-2xl md:text-3xl text-white"
            }>
                Contents
            </h2>
            <ol className={isDesktop ? "flex flex-col gap-2" : "grid grid-cols-1 md:grid-cols-2 gap-2"}>
                {items.map((item) => (
                    <li key={`${variant}-${item}`} className="list-none">
                        <a
                            href={`#${toAnchorId(item)}`}
                            className={isDesktop
                                ? "block rounded-2xl px-3 py-2 text-sm leading-5 text-ink-200 hover:bg-surface-800 hover:text-primary-100 transition-colors"
                                : "text-ink-200 hover:text-primary-100 transition-colors text-base md:text-lg"
                            }
                        >
                            {item}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

function resolveBlogLinkHref(link: BlogLink) {
    if (link.href) {
        return link.href;
    }

    return link.kind === "challenge" ? `/comparisons/${link.slug}` : `/animals/${link.slug}`;
}

function buildSpeciesTextLinks(speciesSlugs: string[]): BlogLink[] {
    return speciesSlugs
        .map((speciesSlug) => getSpeciesBySlug(speciesSlug))
        .filter((entry): entry is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(entry))
        .flatMap((species) => {
            const baseText = species.name.toLowerCase();
            const pluralText = buildPluralPhrase(baseText);

            return pluralText === baseText
                ? [{text: baseText, slug: species.slug}]
                : [
                    {text: baseText, slug: species.slug},
                    {text: pluralText, slug: species.slug}
                ];
        });
}

function renderSectionParagraphs(paragraphs: string[], links: BlogLink[]) {
    const generationItems = paragraphs
        .map((paragraph) => ({
            paragraph,
            parsed: parseGenerationParagraph(paragraph)
        }));

    if (generationItems.every((item) => item.parsed)) {
        return (
            <ul className="editorial-plain-list my-8 grid grid-cols-1 gap-x-8 gap-y-5 border-y border-[color:var(--rule)] py-6 sm:grid-cols-2">
                {generationItems.map(({paragraph, parsed}) => (
                    <li key={paragraph} className="flex list-none flex-col gap-1.5 pl-0">
                        <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--lime)]">
                            {parsed!.label}
                        </p>
                        <p className="text-[15px] leading-relaxed text-[color:var(--text-200)]">
                            {renderTextWithLinks(parsed!.body, links)}
                        </p>
                    </li>
                ))}
            </ul>
        );
    }

    return generationItems.map(({paragraph, parsed}) => {
        if (parsed) {
            return (
                <div key={paragraph} className="my-6 border-l-2 border-[color:var(--rule-strong)] pl-5">
                    <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--lime)]">
                        {parsed.label}
                    </p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[color:var(--text-200)]">
                        {renderTextWithLinks(parsed.body, links)}
                    </p>
                </div>
            );
        }

        return <p key={paragraph}>{renderTextWithLinks(paragraph, links)}</p>;
    });
}

function renderCodeBlocks(codeBlocks: NonNullable<ReturnType<typeof getBlogPost>>["sections"][number]["codeBlocks"]) {
    if (!codeBlocks?.length) return null;

    return (
        <div className="space-y-4">
            {codeBlocks.map((block, index) => block.render && canRenderCodeBlock(block.language) ? (
                <figure key={`${block.language ?? "html"}-${index}`} className="overflow-hidden  border border-line-300 bg-white">
                    <RenderedCodeFrame title={block.caption || `Embedded content ${index + 1}`} documentHtml={getRenderedCodeDocument(block)} minHeight={320} />
                    {block.caption ? <figcaption className="border-t border-line-300 bg-surface-900 px-4 py-3 text-xs text-ink-400">{block.caption}</figcaption> : null}
                </figure>
            ) : (
                <figure key={`${block.language ?? "text"}-${index}`} className="overflow-hidden  border border-line-300 bg-[#080d0a]">
                    <div className="flex items-center justify-between border-b border-line-300 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                        <span>{block.language || "Text"}</span>
                        <span>Code</span>
                    </div>
                    <pre className="max-w-full overflow-x-auto p-4 text-sm leading-6 text-primary-100"><code>{block.code}</code></pre>
                    {block.caption ? <figcaption className="border-t border-line-300 px-4 py-3 text-xs text-ink-400">{block.caption}</figcaption> : null}
                </figure>
            ))}
        </div>
    );
}

function renderSectionCards(cards: NonNullable<ReturnType<typeof getBlogPost>>["sections"][number]["cards"]) {
    if (!cards || cards.length === 0) {
        return null;
    }

    return (
        <ul className="editorial-plain-list my-8 grid grid-cols-1 gap-x-8 gap-y-6 border-t border-[color:var(--rule)] pt-6 sm:grid-cols-2">
            {cards.map((card) => (
                <li key={`${card.label}-${card.body}`} className="flex list-none flex-col gap-2 pl-0">
                    {card.image && (
                        <div className="relative mb-1 w-full overflow-hidden rounded-sm bg-[color:var(--paper-850)]" style={{aspectRatio: "3 / 2"}}>
                            <Image
                                src={card.image.src}
                                alt={card.image.alt}
                                fill
                                loading="lazy"
                                sizes="(min-width: 640px) 22rem, 100vw"
                                className="object-cover"
                            />
                        </div>
                    )}
                    <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--lime)]">
                        {card.label}
                    </p>
                    <p className="text-[15px] leading-relaxed text-[color:var(--text-200)]">
                        {renderTextWithLinks(card.body, card.links || [])}
                    </p>
                </li>
            ))}
        </ul>
    );
}

function renderSectionTable(table: NonNullable<ReturnType<typeof getBlogPost>>["sections"][number]["table"]) {
    if (!table || table.columns.length === 0 || table.rows.length === 0) {
        return null;
    }

    return (
        <div className="span-wide my-10 md:my-12">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                        <tr>
                            {table.columns.map((column) => (
                                <th
                                    key={column}
                                    scope="col"
                                    className="border-b border-[color:var(--rule-strong)] px-0 py-3 pr-6 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-300)]"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={`${row.cells.join("-")}-${rowIndex}`}>
                                {row.cells.map((cell, cellIndex) => {
                                    const CellTag = cellIndex === 0 ? "th" : "td";

                                    return (
                                        <CellTag
                                            key={`${cell}-${cellIndex}`}
                                            scope={cellIndex === 0 ? "row" : undefined}
                                            className={cellIndex === 0
                                                ? "border-b border-[color:var(--rule-soft)] px-0 py-3.5 pr-6 text-left align-top font-sans text-[15px] font-semibold normal-case tracking-normal text-[color:var(--text-100)]"
                                                : "border-b border-[color:var(--rule-soft)] px-0 py-3.5 pr-6 align-top text-[15px] leading-relaxed text-[color:var(--text-200)]"
                                            }
                                        >
                                            {cell}
                                        </CellTag>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function renderTextWithLinks(text: string, links: BlogLink[]) {
    if (links.length === 0) {
        return text;
    }

    const uniqueLinks = Array.from(
        new Map(
            links.map((link) => [link.text.toLowerCase(), link])
        ).values()
    ).sort((left, right) => right.text.length - left.text.length);
    const linkMap = new Map(uniqueLinks.map((link) => [link.text.toLowerCase(), link]));
    const pattern = uniqueLinks
        .map((link) => link.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    const matcher = new RegExp(`\\b(${pattern})\\b`, "gi");
    const parts: JSX.Element[] = [];
    const linkedSlugs = new Set<string>();
    let cursor = 0;

    for (const match of Array.from(text.matchAll(matcher))) {
        const matchText = match[0];
        const index = match.index;

        if (index === undefined) {
            continue;
        }

        const link = linkMap.get(matchText.toLowerCase());

        if (!link) {
            continue;
        }

        if (index > cursor) {
            parts.push(<span key={`text-${cursor}`}>{text.slice(cursor, index)}</span>);
        }

        if (linkedSlugs.has(link.slug)) {
            parts.push(<span key={`text-${index}`}>{matchText}</span>);
        } else {
            parts.push(
                <EarnContentLink
                    key={`link-${link.slug}-${index}`}
                    href={resolveBlogLinkHref(link)}
                    source="blog"
                    className="text-primary-200 hover:text-primary-100 underline underline-offset-4"
                >
                    {matchText}
                </EarnContentLink>
            );
            linkedSlugs.add(link.slug);
        }

        cursor = index + matchText.length;
    }

    if (cursor < text.length) {
        parts.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return parts;
}

export async function generateMetadata({params}: BlogPostPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const post = await getManagedBlogPost(slug);

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
        tags: post.tags,
        canonicalUrl: post.canonicalUrl
    });
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "blog");
    const post = await getManagedBlogPost(slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = getRelatedBlogPosts(post.slug, 3);
    const relatedChallenges = getRelatedChallengesForBlogPost(post.slug, 4);
    const relatedAnswerPages = getAnswerPagesForIntents(post.searchIntents, 3);
    const mentionedSpeciesLinks = getMentionedSpeciesSlugs(post)
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
    const ctaSupportItems = [
        t("ctaSupportOne"),
        t("ctaSupportTwo"),
        t("ctaSupportThree")
    ];

    const postUrl = post.canonicalUrl || getAbsoluteUrl(locale, `/blog/${post.slug}`);
    const schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        inLanguage: locale,
        url: postUrl,
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": postUrl
        },
        image: getAbsoluteAssetUrl(post.featuredImage.src),
        articleSection: post.tags,
        keywords: post.searchIntents.join(", "),
        author: post.author ? {"@type": "Person", name: post.author} : {"@type": "Organization", name: "AnimalDex"},
        publisher: {
            "@type": "Organization",
            name: "AnimalDex",
            logo: {
                "@type": "ImageObject",
                url: getAbsoluteAssetUrl("/images/logo.webp")
            }
        },
        ...(post.originalPublicationUrl ? {isBasedOn: post.originalPublicationUrl} : {})
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
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "AnimalDex",
                item: getAbsoluteUrl(locale, "/")
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Blog",
                item: getAbsoluteUrl(locale, "/blog")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: postUrl
            }
        ]
    };
    const schemas = faqSchema ? [schema, faqSchema, breadcrumbSchema] : [schema, breadcrumbSchema];
    const tableOfContentsTitles = post.tableOfContents && post.tableOfContents.length > 0
        ? post.tableOfContents
        : post.sections.filter((section) => section.html === undefined).map((section) => section.title);
    const tocItems = tableOfContentsTitles.map((title) => ({id: toAnchorId(title), title}));
    // A short article gets no rail, and therefore no reserved column for one.
    const showsTocRail = tocItems.length >= MINIMUM_TOC_SECTIONS;
    const narrationText = buildNarrationText(post);

    return (
        <article className="editorial w-full bg-[color:var(--paper-950)] pb-4">
            {/* Renders nothing: it tells the site-wide assistant what this page
                is about. Any species the article mentions leads the candidate
                list, and the question is free to move elsewhere. */}
            <AskSubjectBridge
                slug={mentionedSpeciesLinks[0]?.slug ?? null}
                name={mentionedSpeciesLinks[0]?.name ?? null}
                title={post.title}
                summary={post.description}
            />
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            {post.headerHtml ? (
                <div className="editorial-grid pt-10">
                    <div className="span-wide">
                        <RenderedCodeFrame title="Article header" documentHtml={getRenderedCodeDocument({language: "html+css+js", code: post.headerHtml})} minHeight={240} />
                    </div>
                </div>
            ) : (
                <ArticleHero
                    title={post.title}
                    description={post.description}
                    image={post.featuredImage}
                    tags={post.tags}
                    author={post.author}
                    publishedLabel={`${t("published")} ${formatDate(locale, post.publishedAt)}`}
                    updatedLabel={post.updatedAt ? `${t("updated")} ${formatDate(locale, post.updatedAt)}` : undefined}
                    readingLabel={`${post.readingMinutes} ${t("minutes")}`}
                    backLabel={t("back")}
                    originalPublication={post.originalPublicationUrl ? {
                        href: post.originalPublicationUrl,
                        label: post.originalPublicationLabel ?? "AnimalDex’s Substack"
                    } : null}
                />
            )}

            {/* Body: reading column with a contextual rail beside it on wide
                screens. The rail is outside the prose grid so figures inside can
                still break the measure without fighting it for space. */}
            <div className="mx-auto flex w-full max-w-[84rem] justify-center gap-0 px-0 xl:gap-12">
                <div className="min-w-0 flex-1">
                    <div className="editorial-grid">
                        <div className="mt-8 flex flex-col md:mt-10">
                            <BlogListenControl locale={locale} text={narrationText} />
                            <ArticleTocInline items={tocItems} label={t("contentsLabel")} />
                        </div>
                    </div>

                    <div className="editorial-grid editorial-prose mt-10 md:mt-14">
                        {post.sections.map((section) => {
                            if (section.html !== undefined) {
                                return (
                                    // The frame is transparent and defaults its text to white, so the backdrop must stay dark.
                                    <section key={section.title} className="span-wide my-10 overflow-hidden rounded-sm bg-[color:var(--paper-950)]">
                                        <RenderedCodeFrame title={section.title || "Custom page section"} documentHtml={getRenderedCodeDocument({language: "html+css+js", code: section.html})} minHeight={320} />
                                    </section>
                                );
                            }

                            const sectionTextLinks = [
                                ...buildSpeciesTextLinks([
                                    ...getMentionedSpeciesSlugs(post),
                                    ...(section.speciesSlugs || [])
                                ]),
                                ...(section.inlineLinks || [])
                            ];
                            const sectionSpecies = (section.speciesSlugs || [])
                                .map((speciesSlug) => getSpeciesBySlug(speciesSlug))
                                .filter((entry): entry is NonNullable<ReturnType<typeof getSpeciesBySlug>> => Boolean(entry));
                            const isAnswerSection = Boolean(section.kicker?.toLowerCase().includes("answer"));
                            const leadParagraph = isAnswerSection ? section.paragraphs[0] : undefined;
                            const bodyParagraphs = isAnswerSection ? section.paragraphs.slice(1) : section.paragraphs;

                            return (
                                <Fragment key={section.title}>
                                    <div id={toAnchorId(section.title)} className="scroll-mt-28">
                                        {section.kicker && !isAnswerSection ? (
                                            <p className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">
                                                {section.kicker}
                                            </p>
                                        ) : null}
                                        {(section.headingLevel ?? 2) === 3
                                            ? <h3>{section.title}</h3>
                                            : <h2>{section.title}</h2>}
                                    </div>

                                    {leadParagraph ? (
                                        <div data-speakable="true" className="border-l-2 border-[rgba(167,244,50,0.5)] pl-5 md:pl-6">
                                            {section.kicker ? (
                                                <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--lime)]">
                                                    {section.kicker}
                                                </p>
                                            ) : null}
                                            <p className="text-[1.0625rem] leading-relaxed text-[color:var(--text-100)] md:text-xl">
                                                {renderTextWithLinks(leadParagraph, sectionTextLinks)}
                                            </p>
                                        </div>
                                    ) : null}

                                    {bodyParagraphs.length > 0 ? renderSectionParagraphs(bodyParagraphs, sectionTextLinks) : null}
                                    {section.cards ? renderSectionCards(section.cards) : null}
                                    {section.table ? renderSectionTable(section.table) : null}
                                    {section.pullQuote ? renderPullQuote(section.pullQuote) : null}
                                    {renderCodeBlocks(section.codeBlocks)}
                                    {section.media ? renderSectionMedia(section.media) : null}

                                    {section.subsections ? section.subsections.map((subsection) => (
                                        <Fragment key={`${section.title}-${subsection.title}`}>
                                            <h3 id={toAnchorId(subsection.title)} className="scroll-mt-28">{subsection.title}</h3>
                                            {subsection.media ? renderSectionMedia(subsection.media) : null}
                                            {renderSectionParagraphs(subsection.paragraphs, sectionTextLinks)}
                                            {subsection.pullQuote ? renderPullQuote(subsection.pullQuote) : null}
                                        </Fragment>
                                    )) : null}

                                    {section.inlineLinks && section.inlineLinks.length > 0 ? (
                                        <p className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
                                            {section.inlineLinks.map((link) => (
                                                <EarnContentLink
                                                    key={`${section.title}-${link.slug}`}
                                                    href={resolveBlogLinkHref(link)}
                                                    source="blog"
                                                    className="font-semibold"
                                                >
                                                    {link.text}
                                                </EarnContentLink>
                                            ))}
                                        </p>
                                    ) : null}

                                    {sectionSpecies.length > 0 ? (
                                        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                                            {sectionSpecies.map((species) => (
                                                <Link
                                                    key={species.slug}
                                                    href={`/animals/${species.slug}`}
                                                    className="text-[color:var(--text-300)] underline decoration-[color:var(--rule-strong)] underline-offset-4 transition-colors hover:text-[color:var(--text-100)] hover:decoration-[color:var(--lime)]"
                                                >
                                                    {species.name}
                                                </Link>
                                            ))}
                                        </p>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </div>

                    <div className="editorial-grid">
                        <div className="span-wide">
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
                        </div>
                    </div>

                    {post.faq && post.faq.length > 0 ? (
                        <section className="editorial-grid mt-16 md:mt-24">
                            <div className="flex flex-col gap-6">
                                <EditorialSectionHeading title={t("faqTitle")} description={t("faqDescription")} />
                                <dl className="flex flex-col">
                                    {post.faq.map((item) => (
                                        <div key={item.question} className="border-b border-[color:var(--rule)] py-5 last:border-b-0">
                                            <dt className="font-display text-[1.0625rem] font-bold text-[color:var(--text-100)] md:text-lg">
                                                {item.question}
                                            </dt>
                                            <dd className="mt-2 text-[15px] leading-relaxed text-[color:var(--text-300)]">
                                                {item.answer}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </section>
                    ) : null}

                    {mentionedSpeciesLinks.length > 0 ? (
                        <section className="editorial-grid mt-16 md:mt-20">
                            <div className="flex flex-col gap-5">
                                <EditorialSectionHeading title={t("animalsMentionedTitle")} description={t("animalsMentionedDescription")} />
                                <p className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-[14px]">
                                    {mentionedSpeciesLinks.map((species) => (
                                        <Link
                                            key={species.slug}
                                            href={`/animals/${species.slug}`}
                                            className="text-[color:var(--text-200)] underline decoration-[color:var(--rule-strong)] underline-offset-4 transition-colors hover:text-[color:var(--text-100)] hover:decoration-[color:var(--lime)]"
                                        >
                                            {species.name}
                                        </Link>
                                    ))}
                                </p>
                            </div>
                        </section>
                    ) : null}

                    {post.sources && post.sources.length > 0 ? (
                        <section className="editorial-grid mt-16 md:mt-20">
                            <div className="flex flex-col gap-5">
                                <EditorialSectionHeading title="Sources and further reading" />
                                <ul className="flex flex-col">
                                    {post.sources.map((source) => (
                                        <li key={source.href} className="list-none border-b border-[color:var(--rule)] last:border-b-0">
                                            <a
                                                href={source.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-between gap-4 py-3.5 text-[14px] text-[color:var(--text-200)] transition-colors hover:text-[color:var(--text-100)]"
                                            >
                                                {source.label}
                                                <span aria-hidden="true" className="shrink-0 text-[color:var(--text-400)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--lime)]">↗</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>
                    ) : null}
                </div>

                {showsTocRail ? (
                    <aside className="hidden w-[14rem] shrink-0 pt-14 xl:block">
                        <ArticleTocRail items={tocItems} label={t("contentsLabel")} />
                    </aside>
                ) : null}
            </div>

            {relatedAnswerPages.length > 0 ? (
                <section className="editorial-grid mt-16 md:mt-24">
                    <div className="span-wide flex flex-col gap-6">
                        <EditorialSectionHeading title={t("answerPagesTitle")} description={t("answerPagesDescription")} />
                        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                            {relatedAnswerPages.map((page) => (
                                <EditorialCard
                                    key={page.slug}
                                    href={`/${page.slug}`}
                                    title={page.shortTitle}
                                    description={page.metaDescription}
                                    variant="row"
                                />
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}

            {relatedChallenges.length > 0 ? (
                <section className="editorial-grid mt-16 md:mt-20">
                    <div className="span-wide flex flex-col gap-6">
                        <EditorialSectionHeading title={t("relatedChallengesTitle")} description={t("relatedChallengesDescription")} />
                        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                            {relatedChallenges.map((challenge) => (
                                <EditorialCard
                                    key={challenge.slug}
                                    href={`/comparisons/${challenge.slug}`}
                                    title={challenge.title}
                                    description={challenge.quickVerdict}
                                    variant="row"
                                />
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}

            <ArticleAppCta
                title={t("ctaTitle")}
                description={t("ctaDescription")}
                supportItems={ctaSupportItems}
            />

            {relatedPosts.length > 0 ? (
                <section className="editorial-grid">
                    <div className="span-wide flex flex-col gap-8 border-t border-[color:var(--rule)] pt-10">
                        <EditorialSectionHeading title={t("relatedTitle")} />
                        {/* One lead recommendation, then the rest: a plain
                            three-up of identical cards is what made this read
                            as placeholders. */}
                        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
                            <EditorialCard
                                href={`/blog/${relatedPosts[0].slug}`}
                                title={relatedPosts[0].title}
                                description={relatedPosts[0].description}
                                kicker={relatedPosts[0].tags?.[0]}
                                meta={`${relatedPosts[0].readingMinutes} ${t("minutes")}`}
                                image={relatedPosts[0].featuredImage}
                                variant="feature"
                            />
                            {relatedPosts.length > 1 ? (
                                <div className="flex flex-col">
                                    {relatedPosts.slice(1).map((relatedPost) => (
                                        <EditorialCard
                                            key={relatedPost.slug}
                                            href={`/blog/${relatedPost.slug}`}
                                            title={relatedPost.title}
                                            description={relatedPost.description}
                                            meta={`${relatedPost.readingMinutes} ${t("minutes")}`}
                                            image={relatedPost.featuredImage}
                                            variant="row"
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}
        </article>
    );
}
