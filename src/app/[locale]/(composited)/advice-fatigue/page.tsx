import {Metadata} from "next";
import {Fragment} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import TextDiagramPanel from "@/app/[locale]/(composited)/_components/text-diagram-panel";
import InlineCopy from "@/app/[locale]/(composited)/_components/inline-copy";
import AnimalChatStill from "@/app/[locale]/(composited)/_components/animal-chat-still";
import {ArticleTocInline, ArticleTocRail} from "@/app/[locale]/(composited)/blog/_components/article-toc";
import {EditorialSectionHeading} from "@/app/[locale]/(composited)/blog/_components/editorial-card";
import {
    ADVICE_FATIGUE_PATH,
    ADVICE_FATIGUE_PUBLISHED,
    ADVICE_FATIGUE_UPDATED,
    adviceFatigueWordCount,
    getAdviceFatigueContent,
    type AdviceFatigueContent,
    type ArticleBlock
} from "@/data/advice-fatigue";
import {getPerspectiveFlow, ownPowerLine, PERSPECTIVE_FLOW_WIDTHS} from "@/data/animal-perspective";
import {TALK_HREF} from "@/data/public-navigation";
import {HOW_IT_WORKS_PATH} from "@/data/how-it-works";
import {localeConfig} from "@/i18n";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {ogImagePath, withOgCard} from "@/lib/og/og-image";
import {plainInlineText} from "@/lib/inline-markup";
import {drawFlow, drawGrid} from "@/lib/text-diagram";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

type PageProps = {params: {locale: string}};

/** Widths of the advice paradox's three columns: about 72 characters across, which fits the reading column. */
const PARADOX_WIDTHS = [13, 22, 26];
const WORDS_PER_MINUTE = 230;

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const content = getAdviceFatigueContent(locale);
    const url = getLocalePath(locale, ADVICE_FATIGUE_PATH);

    return withOgCard({
        title: content.metaTitle,
        description: content.metaDescription,
        keywords: content.keywords,
        alternates: {
            canonical: url,
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, ADVICE_FATIGUE_PATH);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, ADVICE_FATIGUE_PATH)} as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${content.metaTitle} | AnimalDex`,
            description: content.metaDescription,
            url,
            siteName: "AnimalDex",
            publishedTime: ADVICE_FATIGUE_PUBLISHED,
            modifiedTime: ADVICE_FATIGUE_UPDATED,
            authors: [content.author],
            tags: content.keywords
        },
        twitter: {
            card: "summary_large_image",
            title: `${content.metaTitle} | AnimalDex`,
            description: content.metaDescription
        }
    }, content.metaTitle, "page", "advice-fatigue");
}

const LINK = "underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:decoration-[color:var(--lime)]";

function Stats({block}: {block: Extract<ArticleBlock, {kind: "stats"}>}) {
    return (
        <div className="!mt-8 border-y border-[color:var(--rule)] py-6">
            <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                {block.items.map((item) => (
                    <div key={item.label} className="flex min-w-0 flex-col gap-1.5">
                        <dt className="order-2 text-[12px] leading-snug text-[color:var(--text-300)] sm:text-[13px]">{item.label}</dt>
                        <dd className="order-1 font-display text-3xl font-bold leading-none tracking-tight text-[color:var(--text-100)] sm:text-4xl md:text-5xl">{item.value}</dd>
                    </div>
                ))}
            </dl>
            <p className="mt-4 text-[12px] text-[color:var(--text-400)]">{block.source}</p>
        </div>
    );
}

function ParadoxPanel({content}: {content: AdviceFatigueContent}) {
    const {paradox} = content;
    return (
        <TextDiagramPanel
            title={paradox.title}
            lines={drawGrid({headers: paradox.headers, widths: PARADOX_WIDTHS, rows: paradox.rows})}
            label={paradox.label}
            caption={paradox.caption}
            equivalentLabel={paradox.tableLabel}
            className="!my-10"
        >
            <div className="overflow-x-auto">
                <table>
                    <caption className="sr-only">{paradox.title}</caption>
                    <thead>
                        <tr>
                            <th scope="col"><span className="sr-only">{paradox.aspectLabel}</span></th>
                            <th scope="col">{paradox.headers[1]}</th>
                            <th scope="col">{paradox.headers[2]}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paradox.rows.map((row) => (
                            <tr key={row[0]}>
                                <th scope="row">{row[0]}</th>
                                <td>{row[1]}</td>
                                <td>{row[2]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </TextDiagramPanel>
    );
}

/** "1. Capture" is a list item's own number in the HTML list. */
function withoutNumber(title: string) {
    return title.replace(/^\d+\.\s*/, "");
}

function FlowPanel({locale, content}: {locale: string; content: AdviceFatigueContent}) {
    const flow = getPerspectiveFlow(locale);
    return (
        <TextDiagramPanel
            title={flow.title}
            lines={drawFlow({
                steps: flow.steps,
                width: PERSPECTIVE_FLOW_WIDTHS.step,
                branch: {...flow.branch, width: PERSPECTIVE_FLOW_WIDTHS.branch}
            })}
            label={content.flow.label}
            caption={content.flow.caption}
            equivalentLabel={content.flow.listLabel}
            className="!my-10"
        >
            <ol>
                {flow.steps.map((step) => (
                    <li key={step.title}><strong>{withoutNumber(step.title)}.</strong> {step.body}</li>
                ))}
            </ol>
            <p className="mt-4"><strong>{flow.branch.title}:</strong> {flow.branch.body}</p>
        </TextDiagramPanel>
    );
}

function WorkedExample({locale, content}: {locale: string; content: AdviceFatigueContent}) {
    const {example} = content;
    return (
        <figure className="span-wide !my-12 flex flex-col gap-4" aria-label={example.label}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {example.animals.map((animal) => (
                    <AnimalChatStill
                        key={animal.slug}
                        label={`${animal.name}: ${animal.power}`}
                        youLabel={locale === "id" ? "Kamu:" : "You:"}
                        you={example.question}
                        animal={{
                            name: animal.name,
                            power: animal.power,
                            avatarUrl: getSpeciesArtworkUrl(animal.slug),
                            bubbles: animal.bubbles
                        }}
                        note={ownPowerLine(locale, animal.name)}
                        step={{label: example.stepLabel, text: animal.step, accept: example.accept, other: example.other}}
                    />
                ))}
            </div>
            <figcaption className="editorial-caption max-w-[60ch]">{example.caption}</figcaption>
        </figure>
    );
}

function Block({block, locale, content}: {block: ArticleBlock; locale: string; content: AdviceFatigueContent}) {
    switch (block.kind) {
        case "p":
            return <p><InlineCopy text={block.text} /></p>;
        case "h3":
            return <h3 id={block.id} className="scroll-mt-28">{block.text}</h3>;
        case "ul":
            return <ul>{block.items.map((item) => <li key={item}><InlineCopy text={item} /></li>)}</ul>;
        case "ol":
            return <ol>{block.items.map((item) => <li key={item}><InlineCopy text={item} /></li>)}</ol>;
        case "stats":
            return <Stats block={block} />;
        case "panel":
            return block.panel === "paradox" ? <ParadoxPanel content={content} /> : <FlowPanel locale={locale} content={content} />;
        case "example":
            return <WorkedExample locale={locale} content={content} />;
    }
}

export default async function AdviceFatiguePage({params}: PageProps) {
    const locale = pageLocale(params.locale);
    const content = getAdviceFatigueContent(locale);
    const pageUrl = getAbsoluteUrl(locale, ADVICE_FATIGUE_PATH);
    const siteUrl = getSiteUrl();
    const wordCount = adviceFatigueWordCount(content, getPerspectiveFlow(locale));
    const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
    const tocItems = [
        ...content.sections.map((section) => ({id: section.id, title: section.title})),
        {id: "faq", title: content.faqTitle},
        {id: "references", title: content.referencesTitle}
    ];

    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: content.title,
        description: content.metaDescription,
        inLanguage: locale,
        url: pageUrl,
        mainEntityOfPage: {"@type": "WebPage", "@id": pageUrl},
        image: getAbsoluteAssetUrl(ogImagePath("page", "advice-fatigue")),
        datePublished: ADVICE_FATIGUE_PUBLISHED,
        dateModified: ADVICE_FATIGUE_UPDATED,
        author: {"@type": "Organization", name: content.author, url: siteUrl},
        publisher: {
            "@type": "Organization",
            name: "AnimalDex",
            url: siteUrl,
            logo: {"@type": "ImageObject", url: new URL("/images/logo.webp", siteUrl).toString()}
        },
        keywords: content.keywords.join(", "),
        wordCount,
        citation: content.references.map((reference) => ({
            "@type": "CreativeWork",
            name: reference.citation,
            url: reference.links[0].href
        }))
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: locale,
        url: pageUrl,
        mainEntity: content.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {"@type": "Answer", text: plainInlineText(item.answer)}
        }))
    };

    return (
        <article className="editorial w-full bg-[color:var(--paper-950)] pb-4">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema])}} />

            {/* Masthead, as the blog's articles have it: the title is the strongest thing on the page. */}
            <header className="editorial-grid pt-10 md:pt-14">
                <div className="span-wide flex flex-col gap-6">
                    <Link
                        href="/blog"
                        className="group inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-400)] transition-colors hover:text-[color:var(--lime)]"
                    >
                        <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">←</span>
                        {content.backLabel}
                    </Link>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">{content.eyebrow}</p>
                    <h1 className="max-w-[22ch] font-display text-[2.4rem] font-bold leading-[1.02] tracking-[-0.025em] text-[color:var(--text-100)] [text-wrap:balance] sm:text-[3.1rem] md:text-[3.75rem] lg:text-[4.25rem]">
                        {content.title}
                    </h1>
                    <p className="max-w-[48ch] text-lg leading-[1.55] text-[color:var(--text-200)] [text-wrap:pretty] md:text-xl">{content.dek}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[color:var(--rule)] pt-5 text-[13px] text-[color:var(--text-300)]">
                        <span className="font-semibold text-[color:var(--text-100)]">{content.author}</span>
                        <span aria-hidden="true" className="text-[color:var(--rule-strong)]">·</span>
                        <time dateTime={ADVICE_FATIGUE_PUBLISHED}>{content.publishedLabel}</time>
                        <span aria-hidden="true" className="text-[color:var(--rule-strong)]">·</span>
                        <span>{content.readingLabel.replace("{minutes}", String(minutes))}</span>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-[84rem] justify-center gap-0 px-0 xl:gap-12">
                <div className="min-w-0 flex-1">
                    <div className="editorial-grid">
                        <div className="mt-8 flex flex-col md:mt-10">
                            <ArticleTocInline items={tocItems} label={content.contentsLabel} />
                        </div>
                    </div>

                    <div className="editorial-grid editorial-prose mt-10 md:mt-14">
                        {content.lead.map((paragraph, index) => (
                            <p key={paragraph} className={index === 0 ? "text-[color:var(--text-100)] md:text-[1.3rem] md:leading-[1.7]" : undefined}>
                                <InlineCopy text={paragraph} />
                            </p>
                        ))}

                        {content.sections.map((section) => (
                            <Fragment key={section.id}>
                                <h2 id={section.id} className="scroll-mt-28">{section.title}</h2>
                                {section.blocks.map((block, index) => (
                                    <Block key={`${section.id}-${index}`} block={block} locale={locale} content={content} />
                                ))}
                            </Fragment>
                        ))}
                    </div>

                    <section id="faq" className="editorial-grid mt-16 scroll-mt-28 md:mt-24">
                        <div className="flex flex-col gap-6">
                            <EditorialSectionHeading title={content.faqTitle} />
                            <dl className="flex flex-col">
                                {content.faq.map((item) => (
                                    <div key={item.question} className="border-b border-[color:var(--rule)] py-5 last:border-b-0">
                                        <dt className="font-display text-[1.0625rem] font-bold text-[color:var(--text-100)] md:text-lg">{item.question}</dt>
                                        <dd className="mt-2 text-[15px] leading-relaxed text-[color:var(--text-300)]">{item.answer}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </section>

                    <section id="references" className="editorial-grid mt-16 scroll-mt-28 md:mt-20">
                        <div className="flex flex-col gap-5">
                            <EditorialSectionHeading title={content.referencesTitle} />
                            <ol className="flex flex-col">
                                {content.references.map((reference, index) => (
                                    <li
                                        key={reference.id}
                                        id={reference.id}
                                        className="flex list-none scroll-mt-28 gap-4 border-b border-[color:var(--rule)] py-4 text-[14px] leading-relaxed text-[color:var(--text-200)] last:border-b-0 target:bg-[color:var(--paper-850)]"
                                    >
                                        <span aria-hidden="true" className="w-5 shrink-0 font-mono text-[12px] tabular-nums text-[color:var(--text-400)]">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="min-w-0">
                                            {reference.citation}
                                            {reference.note ? <> {reference.note}</> : null}
                                            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                                                {reference.links.map((link) => (
                                                    <a
                                                        key={link.href}
                                                        href={link.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`break-all text-[color:var(--text-100)] ${LINK}`}
                                                    >
                                                        {link.label} <span aria-hidden="true">↗</span>
                                                    </a>
                                                ))}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </section>
                </div>

                <aside className="hidden w-[14rem] shrink-0 pt-14 xl:block">
                    <ArticleTocRail items={tocItems} label={content.contentsLabel} />
                </aside>
            </div>

            {/* The close: one filled panel, the way the blog ends an article, with Talk first. */}
            <div className="editorial-grid my-16 md:my-24">
                <aside className="span-wide">
                    <div className="relative overflow-hidden rounded-sm border border-[color:var(--rule-strong)] bg-[color:var(--paper-850)]">
                        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--lime)] to-transparent opacity-70" />
                        <div className="grid gap-8 p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:p-10">
                            <div className="flex flex-col gap-3.5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--lime)]">{content.cta.eyebrow}</p>
                                <h2 className="max-w-[22ch] font-display text-2xl font-bold leading-[1.12] tracking-[-0.02em] text-[color:var(--text-100)] [text-wrap:balance] md:text-[2rem]">
                                    {content.cta.title}
                                </h2>
                                <p className="max-w-[50ch] text-[15px] leading-relaxed text-[color:var(--text-300)]">{content.cta.body}</p>
                            </div>
                            <div className="flex flex-col gap-3 md:items-end">
                                <Link
                                    href={TALK_HREF}
                                    className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-primary-400 px-7 font-display text-base font-bold uppercase tracking-[0.06em] text-canvas-950 transition-colors hover:bg-primary-300"
                                >
                                    {content.cta.primary} <span aria-hidden="true">→</span>
                                </Link>
                                <Link
                                    href={HOW_IT_WORKS_PATH}
                                    className="inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-[color:var(--rule-strong)] px-5 text-sm font-semibold text-[color:var(--text-100)] transition-colors hover:border-[color:var(--lime)]"
                                >
                                    {content.cta.secondary}
                                </Link>
                                <StoreLinks variant="text" className="!mt-1 !gap-x-5 md:!justify-end [&_a]:!text-sm" />
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </article>
    );
}
