import {Metadata} from "next";
import Image from "next/image";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import ContentImageFigure from "@/app/[locale]/(composited)/_components/content-image-figure";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import SystemsIntelligenceSection from "@/app/[locale]/(composited)/_components/systems-intelligence-section";
import {getAnswerPagesForIntents} from "@/data/answer-pages";
import {BlogMediaBlock, ContentImage} from "@/data/content-schema";
import {BlogLink, blogPosts, getBlogPost, getMentionedSpeciesSlugs, getRelatedBlogPosts, getRelatedChallengesForBlogPost} from "@/data/blog";
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
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generationItems.map(({paragraph, parsed}) => (
                    <li
                        key={paragraph}
                        className="list-none rounded-2xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-2"
                    >
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                            {parsed!.label}
                        </p>
                        <p className="text-ink-200 text-base md:text-lg leading-7">
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
                <div
                    key={paragraph}
                    className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-2"
                >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                        {parsed.label}
                    </p>
                    <p className="text-ink-200 text-base md:text-lg leading-7">
                        {renderTextWithLinks(parsed.body, links)}
                    </p>
                </div>
            );
        }

        return (
            <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                {renderTextWithLinks(paragraph, links)}
            </p>
        );
    });
}

function renderSectionCards(cards: NonNullable<ReturnType<typeof getBlogPost>>["sections"][number]["cards"]) {
    if (!cards || cards.length === 0) {
        return null;
    }

    return (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => (
                <li
                    key={`${card.label}-${card.body}`}
                    className="list-none overflow-hidden rounded-2xl border border-line-300/80 bg-surface-800/60"
                >
                    {card.image && (
                        <div className="border-b border-line-300/80 bg-surface-700/60">
                            <Image
                                src={card.image.src}
                                alt={card.image.alt}
                                width={card.image.width}
                                height={card.image.height}
                                sizes="(min-width: 1024px) 420px, 100vw"
                                className="h-auto w-full object-cover"
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-3 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                            {card.label}
                        </p>
                        <p className="text-ink-200 text-base md:text-lg leading-7">
                            {renderTextWithLinks(card.body, card.links || [])}
                        </p>
                    </div>
                </li>
            ))}
        </ul>
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
                <Link
                    key={`link-${link.slug}-${index}`}
                    href={resolveBlogLinkHref(link)}
                    className="text-primary-200 hover:text-primary-100 underline underline-offset-4"
                >
                    {matchText}
                </Link>
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

export default async function BlogPostPage({params}: BlogPostPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "blog");
    const post = getBlogPost(slug);

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

                    return (
                        <section key={section.title} className="flex flex-col gap-4">
                            {section.kicker && (
                                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-200">
                                    {section.kicker}
                                </p>
                            )}
                            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{section.title}</h2>
                            {section.cards ? renderSectionCards(section.cards) : renderSectionParagraphs(section.paragraphs, sectionTextLinks)}
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

            {mentionedSpeciesLinks.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("animalsMentionedTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("animalsMentionedDescription")}</p>
                    <div className="flex flex-wrap gap-2">
                        {mentionedSpeciesLinks.map((species) => (
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

            {relatedChallenges.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("relatedChallengesTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("relatedChallengesDescription")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedChallenges.map((challenge) => (
                            <article
                                key={challenge.slug}
                                className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">
                                    <Link
                                        href={`/comparisons/${challenge.slug}`}
                                        className="hover:text-primary-100 transition-colors"
                                    >
                                        {challenge.title}
                                    </Link>
                                </h3>
                                <p className="text-ink-200 text-base">{challenge.quickVerdict}</p>
                                <Link
                                    href={`/comparisons/${challenge.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readChallenge")}
                                </Link>
                            </article>
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

            <IntentCtaCard
                title={t("ctaTitle")}
                description={t("ctaDescription")}
                buttonLabel={t("ctaButton")}
                supportItems={ctaSupportItems}
            />

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
