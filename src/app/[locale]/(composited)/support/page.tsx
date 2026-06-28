import {Metadata} from "next";
import {getLocale} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {getSupportContent} from "@/data/support-content";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

const supportPath = "/support";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
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

export default async function SupportPage() {
    const locale = await getLocale();
    const content = getSupportContent(locale);
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
            acceptedAnswer: {"@type": "Answer", text: item.answer}
        }))
    };

    return (
        <div className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-16 md:gap-20">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <header className="max-w-5xl mx-auto text-center flex flex-col items-center gap-5">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{content.eyebrow}</p>
                <h1 className="font-display font-bold text-5xl md:text-7xl text-white tracking-tight">{content.title}</h1>
                <p className="text-xl md:text-2xl text-ink-100 max-w-4xl">{content.description}</p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Link
                        href="/contact"
                        className="min-h-[3.5rem] flex items-center justify-center rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 hover:bg-primary-300 transition-colors"
                    >
                        {content.contactButton}
                    </Link>
                    <Link
                        href="/legal/privacy"
                        className="min-h-[3.5rem] flex items-center justify-center rounded-2xl border border-line-200 px-7 font-bold text-white hover:border-primary-400 hover:text-primary-100 transition-colors"
                    >
                        {content.privacyButton}
                    </Link>
                </div>
            </header>

            <section className="rounded-[2rem] border border-line-300 bg-surface-900/70 p-6 md:p-9 flex flex-col gap-6">
                <div className="max-w-3xl flex flex-col gap-2">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{content.quickHelpTitle}</h2>
                    <p className="text-ink-200 text-lg">{content.quickHelpDescription}</p>
                </div>
                <nav aria-label={content.quickHelpTitle} className="flex flex-wrap gap-3">
                    {content.sections.map((section) => (
                        <Link
                            key={section.id}
                            href={`#${section.id}`}
                            className="rounded-full border border-line-300 bg-canvas-950/50 px-4 py-2 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"
                        >
                            {section.title}
                        </Link>
                    ))}
                    <Link
                        href="#delete-account"
                        className="rounded-full border border-line-300 bg-canvas-950/50 px-4 py-2 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"
                    >
                        {content.deleteTitle}
                    </Link>
                </nav>
            </section>

            <aside className="rounded-[2rem] border border-amber-300/25 bg-amber-300/8 px-6 py-7 md:px-9 flex gap-4 items-start">
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200 font-bold" aria-hidden="true">!</span>
                <div className="flex flex-col gap-2">
                    <h2 className="font-display font-bold text-2xl text-white">{content.safetyTitle}</h2>
                    <p className="text-ink-100 text-lg">{content.safetyDescription}</p>
                </div>
            </aside>

            <div className="flex flex-col gap-16">
                {content.sections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-28 grid grid-cols-1 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-7 lg:gap-12">
                        <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:self-start">
                            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{section.title}</h2>
                            <p className="text-ink-200 text-lg">{section.description}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {section.items.map((item) => (
                                <details key={item.question} className="group rounded-3xl border border-line-300 bg-surface-900/65 px-5 py-1 open:border-primary-500/40">
                                    <summary className="cursor-pointer list-none py-5 text-lg md:text-xl font-semibold text-white flex items-start justify-between gap-4">
                                        <span>{item.question}</span>
                                        <span className="text-primary-300 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                                    </summary>
                                    <p className="pb-6 pr-8 text-ink-200 text-base md:text-lg leading-relaxed">{item.answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <section id="delete-account" className="scroll-mt-28 rounded-[2.5rem] border border-red-300/20 bg-gradient-to-br from-red-500/10 via-surface-900 to-surface-900 px-6 py-9 md:px-10 md:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div className="flex flex-col gap-3">
                    <p className="text-red-200 font-medium uppercase tracking-[0.18em] text-xs">Account control</p>
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{content.deleteTitle}</h2>
                    <p className="text-ink-200 text-lg">{content.deleteDescription}</p>
                </div>
                <div className="flex flex-col gap-5">
                    <ol className="flex flex-col gap-3">
                        {content.deleteSteps.map((step, index) => (
                            <li key={step} className="flex gap-4 text-ink-100 text-lg">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-400/15 text-red-200 font-bold">{index + 1}</span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                    <p className="text-ink-300 text-sm leading-relaxed">{content.deleteNote}</p>
                </div>
            </section>

            <section className="rounded-[2.5rem] bg-gradient-to-br from-primary-500/20 via-surface-800 to-violet-500/10 px-7 py-12 md:px-12 lg:px-16 flex flex-col items-center gap-4 text-center">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{content.contactTitle}</h2>
                <p className="text-ink-100 text-lg md:text-xl max-w-3xl">{content.contactDescription}</p>
                <Link
                    href="/contact"
                    className="mt-3 min-h-[3.5rem] flex items-center justify-center rounded-2xl bg-primary-400 px-8 font-bold text-canvas-950 hover:bg-primary-300 transition-colors"
                >
                    {content.contactButton}
                </Link>
            </section>

            <section className="text-center flex flex-col items-center gap-2">
                <h2 className="font-display font-bold text-2xl text-white">Get the latest AnimalDex version</h2>
                <p className="text-ink-300">Updates include reliability fixes and identification improvements.</p>
                <StoreLinks className="mt-3" />
            </section>
        </div>
    );
}
