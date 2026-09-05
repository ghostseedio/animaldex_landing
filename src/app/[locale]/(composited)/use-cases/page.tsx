import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {useCases} from "@/data/use-cases";
import {collectorPages} from "@/data/collector-pages";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

function catalogNumber(index: number) {
    return String(index + 1).padStart(3, "0");
}

/**
 * A small, consistent line-icon set (1.5px stroke, 24x24) used in place of emoji.
 * Order corresponds to the rotation applied to use-case cards below.
 */
function IconPaw({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <ellipse cx="12" cy="15.5" rx="5" ry="4" />
            <ellipse cx="6.2" cy="9.2" rx="1.8" ry="2.3" />
            <ellipse cx="11" cy="6.8" rx="1.8" ry="2.3" />
            <ellipse cx="15.8" cy="7.2" rx="1.8" ry="2.3" />
            <ellipse cx="18.2" cy="11" rx="1.7" ry="2.1" />
        </svg>
    );
}

function IconBinoculars({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M9 9V6.5a1.5 1.5 0 0 0-1.5-1.5h-1A1.5 1.5 0 0 0 5 6.5V9" />
            <path d="M15 9V6.5A1.5 1.5 0 0 1 16.5 5h1A1.5 1.5 0 0 1 19 6.5V9" />
            <path d="M10 9h4" />
            <circle cx="6.5" cy="14.5" r="3.5" />
            <circle cx="17.5" cy="14.5" r="3.5" />
            <path d="M9.6 13 10.4 9M14.4 13 13.6 9" />
        </svg>
    );
}

function IconGrowth({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M4 18 9.5 12.2l3.3 3.1L20 7.5" />
            <path d="M14.5 7.5H20v5.5" />
            <path d="M4 21h16" />
        </svg>
    );
}

function IconCamera({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-1.6A1 1 0 0 1 9.4 5h5.2a1 1 0 0 1 .9.6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5z" />
            <circle cx="12" cy="12.2" r="3.2" />
        </svg>
    );
}

function IconCompare({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="9" cy="12" r="5.2" />
            <circle cx="15" cy="12" r="5.2" />
        </svg>
    );
}

function IconCollect({className}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="5" y="4.5" width="11" height="14" rx="1.6" transform="rotate(-6 5 4.5)" opacity="0.45" />
            <rect x="6.5" y="5.5" width="11" height="14" rx="1.6" />
            <path d="M9.5 10.5h5M9.5 13.5h3.5" />
        </svg>
    );
}

const USE_CASE_ICONS = [IconPaw, IconBinoculars, IconGrowth, IconCamera, IconCompare, IconCollect];

function getUseCaseIcon(index: number) {
    return USE_CASE_ICONS[index % USE_CASE_ICONS.length];
}

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const useCaseKeywords = Array.from(new Set(useCases.flatMap((entry) => entry.searchIntents)));
    const title = messages.useCases?.metaTitle || "AnimalDex Use Cases";
    const description = messages.useCases?.metaDescription || messages.meta?.description || "";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...useCaseKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/use-cases"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/use-cases");
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, "/use-cases")
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, "/use-cases"),
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${title} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | AnimalDex`,
            description,
            images: ["/images/og.png"]
        }
    };
}

export default async function UseCasesIndexPage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const t = await getScopedTranslator(locale, "useCases");
    const pageUrl = getAbsoluteUrl(locale, "/use-cases");

    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("description"),
        url: pageUrl,
        inLanguage: locale,
        hasPart: useCases.map((entry) => ({
            "@type": "WebPage",
            name: entry.title,
            url: getAbsoluteUrl(locale, `/use-cases/${entry.slug}`),
            dateModified: entry.updatedAt
        }))
    };

    const featured = useCases[0];
    const remainingUseCases = useCases.slice(1);

    return (
        <main className="relative w-full overflow-hidden bg-surface-950">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <section className="mx-auto flex w-full max-w-[80rem] flex-col gap-16 px-4 py-12 md:px-8 md:py-20">

                {/* ---------- Hero ---------- */}
                <header className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                    <div className="pointer-events-none absolute -inset-x-12 -top-24 -z-10 h-[28rem] bg-[radial-gradient(circle_at_20%_0%,rgba(34,197,94,0.14),transparent_60%)]" />

                    <div className="flex flex-col gap-6">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-primary-200">
                            <span className="h-px w-6 bg-primary-400/50" />
                            {t("eyebrow")}
                        </p>

                        <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.05] text-white md:text-5xl lg:text-[3.4rem]">
                            One app, five reasons to open it
                        </h1>

                        <p className="max-w-lg text-base leading-7 text-ink-200 md:text-lg">
                            AnimalDex works differently depending on what you bring to it — a pet to log, a bird you
                            just spotted, or a collection you&apos;re building. Find the path that matches what you&apos;re
                            actually trying to do.
                        </p>

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                            <a
                                href="#paths"
                                className="inline-flex items-center justify-center rounded-full bg-primary-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-primary-300"
                            >
                                Find your path
                            </a>
                            <a
                                href="#download"
                                className="inline-flex items-center justify-center rounded-full border border-line-300 px-6 py-3 text-sm font-bold text-white transition hover:border-primary-400/50"
                            >
                                Download AnimalDex
                            </a>
                        </div>
                    </div>

                    {/* Product mockup: a real dex entry, not a decorative dashboard */}
                    <div className="relative mx-auto w-full max-w-sm">
                        <div className="absolute -inset-3 -z-10 rounded-[1.75rem] border border-line-300/60" />
                        <div className="rounded-3xl border border-line-300 bg-surface-900 p-5 shadow-2xl shadow-black/40">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-200">
                                    Dex Entry · No. 014
                                </span>
                                <span className="rounded-full bg-primary-400/15 px-2 py-0.5 text-[11px] font-bold text-primary-100">
                                    98% match
                                </span>
                            </div>

                            <div className="mt-4 flex items-center gap-4">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line-300 bg-surface-950">
                                    <IconBinoculars className="h-7 w-7 text-primary-200" />
                                </div>
                                <div>
                                    <p className="font-display text-xl font-bold text-white">Eastern Bluebird</p>
                                    <p className="text-sm italic text-ink-300">Sialia sialis</p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full border border-line-300 px-2.5 py-1 text-[11px] font-medium text-ink-200">Wildlife</span>
                                <span className="rounded-full border border-line-300 px-2.5 py-1 text-[11px] font-medium text-ink-200">First sighting</span>
                            </div>

                            <div className="mt-5 flex items-center justify-between border-t border-line-300 pt-4">
                                <p className="text-xs text-ink-400">Logged just now</p>
                                <p className="text-xs font-bold text-primary-200">Added to collection →</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ---------- Trust strip ---------- */}
                <section className="flex flex-col gap-4 rounded-2xl border border-line-300 px-6 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-white">
                        {useCases.length} use-case paths, built around how people actually use AnimalDex
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-ink-300">
                        <span>Free to start</span>
                        <span className="hidden text-line-300 sm:inline">·</span>
                        <span>iOS &amp; Android</span>
                        <span className="hidden text-line-300 sm:inline">·</span>
                        <span>{collectorPages.length} related guides</span>
                    </div>
                </section>

                {/* ---------- Featured ---------- */}
                {featured && (
                    <section className="grid gap-8 rounded-3xl border border-line-300 bg-surface-900/60 p-6 md:grid-cols-[0.8fr_1.2fr] md:p-10">
                        <div className="flex flex-col items-start justify-between">
                            <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary-200">
                                No. {catalogNumber(0)} · Featured path
                            </span>
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary-400/25 bg-primary-400/10">
                                <IconPaw className="h-9 w-9 text-primary-200" />
                            </div>
                        </div>

                        <div className="flex flex-col justify-center">
                            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-200">
                                {featured.shortLabel}
                            </p>
                            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                                {featured.title}
                            </h2>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-200">
                                {featured.description}
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {featured.searchIntents.slice(0, 5).map((intent) => (
                                    <IntentChip key={intent}>{intent}</IntentChip>
                                ))}
                            </div>

                            <Link
                                href={`/use-cases/${featured.slug}`}
                                className="mt-7 w-fit text-sm font-bold text-primary-200 transition hover:text-primary-100"
                                underline
                            >
                                {t("readCase")} →
                            </Link>
                        </div>
                    </section>
                )}

                {/* ---------- Paths grid ---------- */}
                <section id="paths" className="flex flex-col gap-8">
                    <SectionHeader
                        eyebrow="Audience paths"
                        title="What brings you here?"
                        description="Pick the path closest to what you're trying to do. Each page covers what AnimalDex does for that case, who it's for, and how to get started."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {remainingUseCases.map((entry, index) => {
                            const Icon = getUseCaseIcon(index);

                            return (
                                <article
                                    key={entry.slug}
                                    className="group relative flex flex-col rounded-2xl border border-line-300 bg-surface-900/40 p-6 transition hover:border-primary-400/40 hover:bg-surface-900/70"
                                >
                                    <div className="flex items-start justify-between">
                                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
                                            No. {catalogNumber(index + 1)}
                                        </span>
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-300 bg-surface-950 text-primary-200 transition group-hover:border-primary-400/40">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                    </div>

                                    <h3 className="mt-5 font-display text-2xl font-bold leading-snug text-white">
                                        {entry.title}
                                    </h3>

                                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-ink-200">
                                        {entry.description}
                                    </p>

                                    <div className="mt-4 rounded-xl border border-line-300 bg-surface-950/60 px-4 py-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                                            Best for
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                                            {entry.audience}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {entry.searchIntents.slice(0, 3).map((intent) => (
                                            <IntentChip key={intent}>{intent}</IntentChip>
                                        ))}
                                    </div>

                                    <div className="mt-5 flex items-center justify-between border-t border-line-300 pt-4">
                                        <span className="text-xs text-ink-400">
                                            Updated {formatDate(locale, entry.updatedAt)}
                                        </span>
                                        <Link
                                            href={`/use-cases/${entry.slug}`}
                                            className="text-sm font-bold text-primary-200 transition group-hover:text-primary-100"
                                        >
                                            {t("readCase")} →
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* ---------- Collector guides ---------- */}
                <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.7fr_1.3fr]">
                    <div className="flex flex-col justify-center">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-200">
                            More ways in
                        </p>
                        <h2 className="mt-3 font-display text-3xl font-bold text-white">
                            Collector &amp; discovery guides
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-ink-200">
                            Deeper reading on scanning, pricing, and building a collection in AnimalDex.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {collectorPages.map((entry) => (
                            <Link
                                key={entry.slug}
                                href={`/${entry.slug}`}
                                className="group flex items-center justify-between rounded-xl border border-line-300 px-5 py-4 transition hover:border-primary-400/40"
                            >
                                <p className="font-semibold text-white group-hover:text-primary-100">
                                    {entry.title}
                                </p>
                                <span className="text-primary-200 transition group-hover:translate-x-0.5">→</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* ---------- CTA ---------- */}
                <section
                    id="download"
                    className="relative overflow-hidden rounded-3xl border border-primary-500/25 bg-surface-900/60 p-8 text-center md:p-14"
                >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.14),transparent_60%)]" />
                    <div className="relative mx-auto max-w-2xl">
                        <h2 className="font-display text-3xl font-bold text-white md:text-5xl">
                            {t("ctaTitle")}
                        </h2>
                        <p className="mt-4 text-base leading-7 text-ink-200 md:text-lg">
                            {t("ctaDescription")}
                        </p>
                        <div className="mt-8 flex justify-center">
                            <StoreLinks variant="text" />
                        </div>
                    </div>
                </section>
            </section>
        </main>
    );
}

function SectionHeader({eyebrow, title, description}: {eyebrow: string; title: string; description: string}) {
    return (
        <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-200">
                {eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-ink-200">
                {description}
            </p>
        </div>
    );
}

function IntentChip({children}: {children: React.ReactNode}) {
    return (
        <span className="rounded-full border border-line-300 px-3 py-1 text-xs font-medium text-ink-200">
            {children}
        </span>
    );
}