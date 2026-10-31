import {Metadata} from "next";
import type {ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import DisagreeStill from "@/app/[locale]/(composited)/_components/disagree-still";
import TextDiagramPanel from "@/app/[locale]/(composited)/_components/text-diagram-panel";
import HomeChatStill from "@/app/[locale]/(composited)/(home)/_components/home-chat-still";
import {
    getAnimalsWorkPoints,
    getDisagreeExample,
    getPerspectiveFlow,
    PERSPECTIVE_FLOW_WIDTHS,
    type AnimalsWorkPoint
} from "@/data/animal-perspective";
import {getHowItWorksContent, HOW_IT_WORKS_PATH, HOW_IT_WORKS_UPDATED, type HowItWorksDetail} from "@/data/how-it-works";
import {ADVICE_FATIGUE_HREF, ANIMAL_TRIALS_HREF, TALK_HREF} from "@/data/public-navigation";
import {localeConfig} from "@/i18n";
import {getScopedTranslator} from "@/loaders/translation";
import {getAbsoluteAssetUrl, getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {parseInlineMarkup} from "@/lib/inline-markup";
import {ogImagePath, withOgCard} from "@/lib/og/og-image";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {TRY_TALKING_SPECIES} from "@/lib/try-talking";
import {drawFlow} from "@/lib/text-diagram";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

type PageProps = {params: {locale: string}};

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const content = getHowItWorksContent(locale);
    const url = getLocalePath(locale, HOW_IT_WORKS_PATH);

    return withOgCard({
        title: content.metaTitle,
        description: content.metaDescription,
        alternates: {
            canonical: url,
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, HOW_IT_WORKS_PATH);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, HOW_IT_WORKS_PATH)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${content.metaTitle} | AnimalDex`,
            description: content.metaDescription,
            url,
            siteName: "AnimalDex"
        },
        twitter: {
            card: "summary_large_image",
            title: `${content.metaTitle} | AnimalDex`,
            description: content.metaDescription
        }
    }, content.metaTitle, "page", "how-it-works");
}

const ICON_PATHS: Record<AnimalsWorkPoint["id"], ReactNode> = {
    // A spark: the Power.
    power: <path d="M12 3.5 13.9 9.6 20 11.5 13.9 13.4 12 19.5 10.1 13.4 4 11.5 10.1 9.6Z" />,
    // A flag planted: its side, kept.
    side: <><path d="M6 20.5V4" /><path d="M6 4.5h11l-2.5 3.5L17 11.5H6" /></>,
    // A fork: two animals, two ways.
    disagree: <><path d="M12 20.5v-6" /><path d="M12 14.5 6 8.5V4" /><path d="M12 14.5l6-6V4" /><path d="M4 6l2-2 2 2" /><path d="M16 6l2-2 2 2" /></>,
    // The walking figure the chat puts on "YOUR STEP".
    step: <><circle cx="13" cy="4.3" r="1.8" fill="currentColor" stroke="none" /><path d="M11.4 8.6 8.9 13.9l3.6 1.9.9 5.2M11.4 8.6l3 1.2 1.8 3 2.8.7M8.9 13.9 6.8 20.5M11.4 8.6 7.8 10.3 6.4 13.2" /></>,
    // Three voices: a debate.
    debates: <><circle cx="7" cy="8" r="2.5" /><circle cx="17" cy="8" r="2.5" /><circle cx="12" cy="13" r="2.5" /><path d="M3.5 19c.6-2.4 2-3.8 3.5-3.8M20.5 19c-.6-2.4-2-3.8-3.5-3.8M8 21c.5-2.4 2.2-4 4-4s3.5 1.6 4 4" /></>,
    // A peak: its own challenge.
    trials: <><path d="M3.5 19.5 9.5 8l4 6.5 2.5-3.5 4.5 8.5Z" /><path d="M9.5 8V3.5l3 1.2-3 1.3" /></>
};

function PointIcon({id}: {id: AnimalsWorkPoint["id"]}) {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICON_PATHS[id]}
        </svg>
    );
}

function SectionHeader({eyebrow, title, description, id}: {eyebrow: string; title: string; description?: string; id: string}) {
    return (
        <div className="flex max-w-3xl flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{eyebrow}</p>
            <h2 id={id} className="font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl">{title}</h2>
            {description ? <p className="text-lg leading-8 text-ink-200">{description}</p> : null}
        </div>
    );
}

function DetailCopy({detail, children}: {detail: HowItWorksDetail; children?: ReactNode}) {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-primary-200">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-400/12 text-primary-200">
                    <PointIcon id={detail.id === "your-step" ? "step" : detail.id} />
                </span>
                {detail.eyebrow}
            </p>
            <h3 className="font-display text-3xl font-bold leading-tight text-white md:text-4xl">{detail.title}</h3>
            {detail.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-7 text-ink-200 md:text-lg md:leading-8">{paragraph}</p>
            ))}
            {children}
        </div>
    );
}

/** "1. Capture" is a list item's own number in the HTML list. */
function withoutNumber(title: string) {
    return title.replace(/^\d+\.\s*/, "");
}

export default async function HowItWorksPage({params}: PageProps) {
    const locale = pageLocale(params.locale);
    const content = getHowItWorksContent(locale);
    const points = getAnimalsWorkPoints(locale);
    const flow = getPerspectiveFlow(locale);
    const disagree = getDisagreeExample(locale, getSpeciesArtworkUrl);
    const home = await getScopedTranslator(locale, "home");
    const pageUrl = getAbsoluteUrl(locale, HOW_IT_WORKS_PATH);
    const [yourStep, trials, debates] = content.details;

    const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: content.metaTitle,
        description: content.metaDescription,
        inLanguage: locale,
        url: pageUrl,
        dateModified: HOW_IT_WORKS_UPDATED,
        image: getAbsoluteAssetUrl(ogImagePath("page", "how-it-works")),
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: points.map((point) => ({"@type": "Thing", name: point.title, description: point.text})),
        mainEntity: {
            "@type": "ItemList",
            name: content.pointsTitle,
            itemListElement: points.map((point, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: point.text
            }))
        }
    };

    return (
        <div className="relative w-full overflow-hidden bg-canvas-950">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(33,192,94,0.12),transparent_62%)]" />

            <div className="relative mx-auto flex w-full max-w-[88rem] flex-col gap-20 px-4 py-10 md:gap-24 md:px-8 md:py-14 lg:py-16">
                {/* Every animal is different (spec §3.1). */}
                <header className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
                    <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{content.eyebrow}</p>
                        <h1 className="max-w-2xl font-display text-5xl font-black uppercase leading-[0.92] tracking-[0.02em] text-white md:text-6xl lg:text-7xl">
                            {parseInlineMarkup(content.title).map((token, index) => (
                                token.type === "bold"
                                    ? <span key={index} className="text-primary-200">{token.text}</span>
                                    : <span key={index}>{token.text}</span>
                            ))}
                        </h1>
                        <p className="max-w-xl text-lg leading-8 text-ink-200 md:text-xl md:leading-9">{content.intro}</p>
                        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
                            <Link
                                href={TALK_HREF}
                                className="inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full bg-primary-400 px-7 font-display text-base font-bold uppercase tracking-[0.08em] text-canvas-950 shadow-[0_18px_50px_rgba(167,244,50,0.2)] transition-colors hover:bg-primary-300"
                            >
                                {content.primaryCta} <span aria-hidden="true">→</span>
                            </Link>
                            <Link
                                href={ADVICE_FATIGUE_HREF}
                                className="inline-flex min-h-[3.5rem] items-center justify-center rounded-full border border-primary-200/30 px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-200 transition-colors hover:border-primary-200/60 hover:text-white"
                            >
                                {content.articleCta}
                            </Link>
                        </div>
                    </div>
                    <div className="rounded-[2rem] border border-line-200 bg-canvas-900/85 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] light:shadow-[0_20px_60px_rgba(12,26,17,0.08)] md:p-7">
                        <DisagreeStill example={disagree} />
                    </div>
                </header>

                {/* The six points of the Help section (spec §3.2), made visual. */}
                <section aria-labelledby="how-points-title" className="flex flex-col gap-8">
                    <SectionHeader id="how-points-title" eyebrow={content.pointsEyebrow} title={content.pointsTitle} description={content.pointsDescription} />
                    <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {points.map((point, index) => (
                            <li key={point.id} className="flex flex-col gap-4 border border-white/[0.07] bg-[#071B0F]/85 p-6 light:border-line-200 light:bg-surface-900">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-400 text-canvas-950">
                                        <PointIcon id={point.id} />
                                    </span>
                                    <span aria-hidden="true" className="font-mono text-xs tabular-nums text-primary-400/70">{String(index + 1).padStart(2, "0")}</span>
                                </div>
                                <h3 className="font-display text-2xl font-bold uppercase tracking-[0.03em] text-white">{point.title}</h3>
                                <p className="text-base leading-7 text-ink-200">{point.text}</p>
                                {point.id === "power" ? (
                                    <p className="mt-auto border-t border-line-300 pt-3 text-sm leading-6 text-primary-200">{content.powerExample}</p>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                </section>

                {/* The loop, as the chat would draw it. */}
                <section aria-labelledby="how-loop-title" className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-14">
                    <SectionHeader id="how-loop-title" eyebrow={content.loopEyebrow} title={content.loopTitle} description={content.loopDescription} />
                    <TextDiagramPanel
                        title={flow.title}
                        lines={drawFlow({
                            steps: flow.steps,
                            width: PERSPECTIVE_FLOW_WIDTHS.step,
                            branch: {...flow.branch, width: PERSPECTIVE_FLOW_WIDTHS.branch}
                        })}
                        label={content.loopTitle}
                        equivalentLabel={locale === "id" ? "Baca sebagai daftar" : "Read it as a list"}
                        className="min-w-0"
                    >
                        <ol className="flex flex-col gap-2 text-base leading-7 text-ink-200">
                            {flow.steps.map((step, index) => (
                                <li key={step.title} className="flex gap-3">
                                    <span aria-hidden="true" className="font-mono text-sm text-primary-200">{index + 1}.</span>
                                    <span><strong className="text-white">{withoutNumber(step.title)}.</strong> {step.body}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-3 text-base leading-7 text-ink-200"><strong className="text-white">{flow.branch.title}:</strong> {flow.branch.body}</p>
                    </TextDiagramPanel>
                </section>

                {/* Your step, Trials and Debates. */}
                <section aria-label={`${yourStep.eyebrow}, ${trials.eyebrow}, ${debates.eyebrow}`} className="flex flex-col gap-16">
                    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
                        <DetailCopy detail={yourStep} />
                        <HomeChatStill
                            image={TRY_TALKING_SPECIES.image}
                            words={{
                                label: home("chatStill.label"),
                                animal: home("chatStill.animal"),
                                power: home("chatStill.power"),
                                you: home("chatStill.you"),
                                reply: home("chatStill.reply"),
                                stepLabel: home("chatStill.stepLabel"),
                                step: home("chatStill.step"),
                                accept: home("chatStill.accept"),
                                other: home("chatStill.other"),
                                caption: home("chatStill.caption")
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-10 border-t border-line-300 pt-12 lg:grid-cols-2 lg:gap-16">
                        <DetailCopy detail={trials}>
                            <Link href={ANIMAL_TRIALS_HREF} className="inline-flex w-fit items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200 transition-colors hover:text-white">
                                {content.trialsLink} <span aria-hidden="true">→</span>
                            </Link>
                        </DetailCopy>
                        <DetailCopy detail={debates}>
                            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {content.debateModes.map((mode) => (
                                    <div key={mode.title} className="flex flex-col gap-1.5 border border-white/[0.07] bg-[#071B0F]/85 p-4 light:border-line-200 light:bg-surface-900">
                                        <p className="font-display text-lg font-bold uppercase tracking-[0.04em] text-white">{mode.title}</p>
                                        <p className="text-sm leading-6 text-ink-300">{mode.body}</p>
                                    </div>
                                ))}
                            </div>
                        </DetailCopy>
                    </div>
                </section>

                <aside className="border border-amber-300/20 bg-amber-300/6 px-5 py-6 md:flex md:items-start md:gap-4 md:px-7 md:py-7">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/12 font-bold text-amber-200" aria-hidden="true">!</span>
                    <div className="mt-3 flex flex-col gap-2 md:mt-0">
                        <h2 className="font-display text-xl font-bold uppercase tracking-[0.03em] text-white md:text-2xl">{content.safetyTitle}</h2>
                        <p className="leading-relaxed text-ink-200">{content.safetyBody}</p>
                    </div>
                </aside>

                <section aria-labelledby="how-collection-title" className="flex flex-col items-center gap-4 border border-white/[0.07] bg-[#0A2112]/80 px-6 py-10 text-center light:border-line-200 light:bg-surface-800 md:px-10 md:py-12">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{content.collectionEyebrow}</p>
                    <h2 id="how-collection-title" className="max-w-3xl font-display text-3xl font-bold uppercase leading-tight tracking-[0.02em] text-white md:text-5xl">{content.collectionTitle}</h2>
                    <p className="max-w-2xl leading-relaxed text-ink-200 md:text-lg">{content.collectionBody}</p>
                    <StoreLinks className="!mt-3" />
                </section>

                <section aria-labelledby="how-cta-title" className="flex flex-col items-center gap-5 pb-4 text-center">
                    <h2 id="how-cta-title" className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[0.02em] text-white md:text-6xl">{content.ctaTitle}</h2>
                    <p className="max-w-2xl text-lg leading-8 text-ink-200">{content.ctaBody}</p>
                    <Link
                        href={TALK_HREF}
                        className="inline-flex min-h-[3.75rem] items-center justify-center gap-2 rounded-full bg-primary-400 px-8 font-display text-lg font-bold uppercase tracking-[0.08em] text-canvas-950 shadow-[0_18px_50px_rgba(167,244,50,0.2)] transition-colors hover:bg-primary-300"
                    >
                        {content.primaryCta} <span aria-hidden="true">→</span>
                    </Link>
                </section>
            </div>
        </div>
    );
}
