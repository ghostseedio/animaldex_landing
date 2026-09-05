import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {EarnContentLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import SupportSearch from "@/app/[locale]/(composited)/support/_components/support-search";
import TalkToSupportLink from "@/app/[locale]/(composited)/support/_components/talk-to-support-link";
import {getSupportContent} from "@/data/support-content";
import {getSupportArticlePath, slugifySupportText} from "@/lib/support-articles";
import {PUBLIC_SUPPORT_CHAT_HREF} from "@/lib/support-chat";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const supportEmail = "support@animaldex.app";
const supportPath = "/support";

function supportMailto(subject = "AnimalDex Support Request") {
    return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    const content = getSupportContent(locale);

    return {
        title: content.metaTitle,
        description: content.metaDescription,
        alternates: {
            canonical: getLocalePath(locale, supportPath),
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, supportPath);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, supportPath)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: content.metaTitle,
            description: content.metaDescription,
            url: getLocalePath(locale, supportPath),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: content.title}]
        },
        twitter: {
            card: "summary_large_image",
            title: content.metaTitle,
            description: content.metaDescription,
            images: ["/images/og.png"]
        }
    };
}

export default async function SupportPage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const content = getSupportContent(locale);
    const talkToSupportHref = PUBLIC_SUPPORT_CHAT_HREF;
    const allFAQs = content.sections.flatMap((section) => section.items);

    const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: content.title,
        description: content.description,
        url: getAbsoluteUrl(locale, supportPath),
        inLanguage: locale,
        mainEntity: allFAQs.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.linkHref
                    ? `${item.answer} ${item.linkLabel || "Learn more"}: ${getAbsoluteUrl(locale, item.linkHref)}`
                    : item.answer
            }
        }))
    };

    return (
        <div className="relative w-full overflow-hidden bg-[#07100B]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(33,192,94,0.1),transparent_62%)]" />

            <div className="relative mx-auto flex w-full max-w-[88rem] flex-col gap-14 px-4 py-10 md:gap-16 md:px-8 md:py-14 lg:gap-20 lg:py-16">
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

                <header className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{content.eyebrow}</p>
                    <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-[0.03em] text-white md:text-6xl lg:text-7xl">
                        {content.howCanWeHelp}
                    </h1>
                    <p className="max-w-3xl text-lg leading-relaxed text-ink-200 md:text-xl">{content.description}</p>
                </header>

                <section aria-label="Search help articles" className="mx-auto w-full max-w-3xl space-y-5">
                    <SupportSearch
                        locale={locale}
                        placeholder={content.searchPlaceholder}
                        emptyTitle={content.searchEmptyTitle}
                        emptyBody={content.searchEmptyBody}
                        talkToSupportLabel={content.talkToSupportLabel}
                        talkToSupportHref={talkToSupportHref}
                    />
                    <nav aria-label="Popular help topics" className="flex flex-wrap justify-center gap-2">
                        {content.sections.map((section) => (
                            <Link
                                key={section.id}
                                href={`#${section.id}`}
                                className="rounded-full border border-white/[0.08] bg-[#071B0F]/80 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-200 transition-colors hover:border-primary-200/35 hover:text-white"
                            >
                                {section.title}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex flex-col items-center gap-3 pt-1 text-center">
                        <p className="text-sm text-ink-400">{content.cantFindHelp}</p>
                        <TalkToSupportLink
                            href={talkToSupportHref}
                            className="inline-flex min-h-[3rem] items-center justify-center rounded-full bg-primary-400 px-6 font-display text-xs font-bold uppercase tracking-[0.14em] text-canvas-950 transition-colors hover:bg-primary-200"
                        >
                            {content.talkToSupportLabel} →
                        </TalkToSupportLink>
                    </div>
                </section>

                <section className="rounded-[1.35rem] border border-white/[0.07] bg-[#071B0F]/85 p-6 md:p-8">
                    <div className="max-w-3xl">
                        <h2 className="font-display text-2xl font-bold uppercase tracking-[0.03em] text-white md:text-3xl">{content.browseTopicsLabel}</h2>
                        <p className="mt-2 text-ink-300">{content.quickHelpDescription}</p>
                    </div>
                </section>

                <aside className="rounded-[1.35rem] border border-amber-300/20 bg-amber-300/6 px-5 py-6 md:flex md:items-start md:gap-4 md:px-7 md:py-7">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/12 text-amber-200 font-bold" aria-hidden="true">!</span>
                    <div className="mt-3 flex flex-col gap-2 md:mt-0">
                        <h2 className="font-display text-xl font-bold uppercase tracking-[0.03em] text-white md:text-2xl">{content.safetyTitle}</h2>
                        <p className="text-ink-200 leading-relaxed">{content.safetyDescription}</p>
                    </div>
                </aside>

                <div className="flex flex-col gap-16">
                    {content.sections.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-28 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
                            <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:self-start">
                                <h2 className="font-display text-3xl font-bold uppercase tracking-[0.03em] text-white md:text-4xl">{section.title}</h2>
                                <p className="text-ink-300 leading-relaxed">{section.description}</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                {section.items.map((item) => {
                                    const articleHref = getSupportArticlePath({
                                        categorySlug: section.id,
                                        slug: slugifySupportText(item.question)
                                    });

                                    return (
                                        <details key={item.question} className="group rounded-[1.2rem] border border-white/[0.07] bg-[#071B0F]/80 px-5 py-1 open:border-primary-200/25">
                                            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-lg font-semibold text-white md:text-xl">
                                                <span>{item.question}</span>
                                                <span className="text-primary-300 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                                            </summary>
                                            <div className="flex flex-col gap-3 pb-6 pr-4">
                                                <p className="text-base leading-relaxed text-ink-200 md:text-lg">{item.answer}</p>
                                                <div className="flex flex-wrap gap-4">
                                                    <Link href={articleHref} className="font-display text-xs font-bold uppercase tracking-[0.16em] text-primary-200 hover:text-white">
                                                        {content.readArticleLabel} →
                                                    </Link>
                                                    {item.linkHref && item.linkLabel ? (
                                                        <EarnContentLink href={item.linkHref} source="support" className="text-sm font-semibold text-ink-300 underline underline-offset-4 hover:text-primary-200">
                                                            {item.linkLabel}
                                                        </EarnContentLink>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>

                <section id="delete-account" className="scroll-mt-28 rounded-[1.35rem] border border-red-300/20 bg-[#071B0F]/90 px-6 py-9 md:px-10 md:py-12">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
                        <div className="flex flex-col gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Account control</p>
                            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{content.deleteTitle}</h2>
                            <p className="text-ink-200 leading-relaxed">{content.deleteDescription}</p>
                        </div>
                        <div className="flex flex-col gap-5">
                            <ol className="flex flex-col gap-3">
                                {content.deleteSteps.map((step, index) => (
                                    <li key={step} className="flex gap-4 text-ink-100">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-400/12 text-red-200 font-bold">{index + 1}</span>
                                        <span className="pt-0.5">{step}</span>
                                    </li>
                                ))}
                            </ol>
                            <p className="text-sm leading-relaxed text-ink-400">{content.deleteNote}</p>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="business-enquiry-title" className="rounded-[1.35rem] border border-white/[0.07] bg-[#071B0F]/85 px-6 py-7 md:flex md:items-center md:justify-between md:gap-8 md:px-8 md:py-8">
                    <div className="max-w-3xl flex flex-col gap-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-primary-200 sm:text-xs">{content.businessEnquiryEyebrow}</p>
                        <h2 id="business-enquiry-title" className="font-display text-2xl font-bold uppercase leading-tight tracking-[0.03em] text-white md:text-3xl">{content.businessEnquiryTitle}</h2>
                        <p className="text-sm leading-relaxed text-ink-300 md:text-base">{content.businessEnquiryDescription}</p>
                    </div>
                    <Link href="/contact" className="mt-5 inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center rounded-full border border-primary-200/30 px-6 font-display text-sm font-bold uppercase tracking-[0.12em] text-primary-200 transition-colors hover:border-primary-200/60 hover:bg-primary-400/10 hover:text-white md:mt-0 md:w-auto">
                        {content.businessEnquiryButton} →
                    </Link>
                </section>

                <section className="rounded-[1.35rem] border border-white/[0.07] bg-[#0A2112]/80 px-7 py-10 text-center md:px-10 md:py-12">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{content.contactTitle}</h2>
                    <p className="mx-auto mt-3 max-w-3xl text-ink-200 leading-relaxed">{content.contactDescription}</p>
                    <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <TalkToSupportLink href={talkToSupportHref} className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-primary-400 px-8 font-display text-xs font-bold uppercase tracking-[0.14em] text-canvas-950 transition-colors hover:bg-primary-200">
                            {content.talkToSupportLabel} →
                        </TalkToSupportLink>
                        <a href={supportMailto()} className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.08] px-8 font-display text-xs font-bold uppercase tracking-[0.14em] text-ink-200 transition-colors hover:border-primary-200/35 hover:text-white">
                            {content.contactButton}
                        </a>
                    </div>
                </section>

                <section className="text-center">
                    <h2 className="font-display text-2xl font-bold text-white">Get the latest AnimalDex version</h2>
                    <p className="mt-2 text-ink-400">Updates include reliability fixes and identification improvements.</p>
                    <StoreLinks className="mt-4" />
                </section>
            </div>
        </div>
    );
}
