import type {Metadata} from "next";
import Image from "next/image";
import {getLocale} from "next-intl/server";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

const path = "/branding";

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const title = "AnimalDex Logo, Brand Assets & Usage Guidelines";
    const description = "Download the official AnimalDex logo and review brand colors, typography, spacing, accessibility, and logo usage guidelines.";

    return {
        title,
        description,
        keywords: ["AnimalDex logo", "AnimalDex brand", "AnimalDex branding", "AnimalDex logo download", "AnimalDex brand assets"],
        alternates: {
            canonical: getLocalePath(locale, path),
            languages: localeConfig.locales.reduce((items, item) => {
                items[item] = getLocalePath(item, path);
                return items;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, path)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            url: getLocalePath(locale, path),
            title,
            description,
            images: [{url: "/images/og-animaldex.svg", width: 1200, height: 630, alt: "AnimalDex official brand identity"}]
        },
        twitter: {card: "summary_large_image", title, description, images: ["/images/og-animaldex.svg"]}
    };
}

const colors = [
    {name: "AnimalDex Lime", value: "#A7F432", className: "bg-[#A7F432]", text: "text-canvas-950"},
    {name: "Primary Green", value: "#21C05E", className: "bg-[#21C05E]", text: "text-canvas-950"},
    {name: "Deep Forest", value: "#0D2A16", className: "bg-[#0D2A16]", text: "text-white"},
    {name: "Near Black", value: "#07100B", className: "bg-[#07100B]", text: "text-white"},
    {name: "White", value: "#FFFFFF", className: "bg-white", text: "text-canvas-950"},
    {name: "Muted Text", value: "#A8B0AA", className: "bg-[#A8B0AA]", text: "text-canvas-950"}
];

function DownloadIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 20h16" /></svg>;
}

function CheckIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-current stroke-2"><path d="m5 12 4 4L19 6" /></svg>;
}

export default async function BrandingPage() {
    const locale = await getLocale();
    const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnimalDex Brand Guidelines",
        description: "Official AnimalDex logo files, brand colors, typography, and usage guidance.",
        url: getAbsoluteUrl(locale, path),
        about: {
            "@type": "Organization",
            name: "AnimalDex",
            logo: getAbsoluteUrl(locale, "/images/logo.webp"),
            url: getAbsoluteUrl(locale)
        },
        primaryImageOfPage: {
            "@type": "ImageObject",
            contentUrl: getAbsoluteUrl(locale, "/images/logo.webp"),
            caption: "Official AnimalDex spiral paw logo"
        }
    };

    return (
        <div className="overflow-hidden">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <header className="relative px-4 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(167,244,50,.18),transparent_48%)]" />
                <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
                    <p className="font-display text-sm font-bold uppercase tracking-[.24em] text-primary-200">AnimalDex brand resources</p>
                    <h1 className="mt-5 max-w-5xl font-display text-5xl font-extrabold leading-[.95] tracking-tight text-white md:text-7xl lg:text-8xl">
                        Meet the mark behind the animal world.
                    </h1>
                    <p className="mt-7 max-w-3xl font-display text-lg font-semibold leading-8 text-ink-200 md:text-xl">
                        Official AnimalDex logos, colors, typography, and practical guidance for presenting our brand clearly and consistently.
                    </p>
                    <a href="/images/logo.webp" download className="mt-9 inline-flex items-center gap-2 rounded-full bg-primary-400 px-6 py-3.5 font-bold text-canvas-950 transition hover:bg-primary-300">
                        <DownloadIcon /> Download primary logo
                    </a>
                </div>
            </header>

            <main className="mx-auto flex max-w-7xl flex-col gap-24 px-4 pb-24 md:px-8 md:pb-32">
                <section aria-labelledby="official-logo">
                    <div className="mb-8 max-w-3xl">
                        <p className="text-xs font-bold uppercase tracking-[.22em] text-primary-200">01 · Official assets</p>
                        <h2 id="official-logo" className="mt-3 font-display text-4xl font-bold text-white md:text-6xl">The AnimalDex logo</h2>
                        <p className="mt-4 text-lg leading-8 text-ink-200">The spiral paw is our primary symbol. Use the combined lockup when the audience may not already recognize AnimalDex.</p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        <article className="flex min-h-[25rem] flex-col justify-between rounded-[2rem] bg-canvas-950 p-7 md:p-10">
                            <p className="text-xs font-bold uppercase tracking-[.18em] text-ink-400">Symbol · dark background</p>
                            <Image src="/images/logo.webp" alt="Official AnimalDex green spiral paw logo on a dark background" width={400} height={400} priority className="mx-auto h-auto w-full max-w-[15rem]" />
                            <a href="/images/logo.webp" download className="inline-flex items-center gap-2 self-start font-bold text-primary-200 hover:text-primary-100"><DownloadIcon /> Download WebP</a>
                        </article>
                        <article className="flex min-h-[25rem] flex-col justify-between rounded-[2rem] bg-white p-7 md:p-10">
                            <p className="text-xs font-bold uppercase tracking-[.18em] text-ink-400">Symbol · light background</p>
                            <Image src="/images/logo.webp" alt="Official AnimalDex green spiral paw logo on a light background" width={400} height={400} className="mx-auto h-auto w-full max-w-[15rem]" />
                            <a href="/images/logo.webp" download className="inline-flex items-center gap-2 self-start font-bold text-primary-600 hover:text-canvas-950"><DownloadIcon /> Download WebP</a>
                        </article>
                        <article className="flex min-h-[18rem] flex-col justify-between rounded-[2rem] bg-surface-900 p-7 md:col-span-2 md:p-10">
                            <p className="text-xs font-bold uppercase tracking-[.18em] text-ink-400">Wordmark · preferred lockup</p>
                            <Image src="/images/animaldex-logo-text.webp" alt="Official AnimalDex wordmark logo" width={1250} height={274} className="mx-auto h-auto w-full max-w-2xl" />
                            <a href="/images/animaldex-logo-text.webp" download className="inline-flex items-center gap-2 self-start font-bold text-primary-200 hover:text-primary-100"><DownloadIcon /> Download WebP</a>
                        </article>
                    </div>
                </section>

                <section aria-labelledby="logo-rules" className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[.22em] text-primary-200">02 · Usage</p>
                        <h2 id="logo-rules" className="mt-3 font-display text-4xl font-bold text-white md:text-6xl">Give it room to breathe.</h2>
                        <p className="mt-5 text-lg leading-8 text-ink-200">Keep clear space around the mark equal to at least one outer paw pad. At small sizes, use the symbol rather than forcing the full wordmark into limited space.</p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <article className="rounded-[2rem] bg-surface-900/70 p-7">
                            <h3 className="font-display text-2xl font-bold text-white">Do</h3>
                            <ul className="mt-5 space-y-4 text-ink-200">
                                {["Use the supplied artwork", "Maintain the original proportions", "Use a calm, high-contrast background", "Keep the mark legible and unobstructed"].map((item) => <li key={item} className="flex gap-3"><span className="text-primary-300"><CheckIcon /></span>{item}</li>)}
                            </ul>
                        </article>
                        <article className="rounded-[2rem] bg-surface-900/70 p-7">
                            <h3 className="font-display text-2xl font-bold text-white">Avoid</h3>
                            <ul className="mt-5 space-y-4 text-ink-200">
                                {["Stretching, skewing, or rotating", "Recoloring individual parts", "Adding shadows, outlines, or effects", "Placing it over visually busy imagery"].map((item) => <li key={item} className="flex gap-3"><span className="font-bold text-red-300">×</span>{item}</li>)}
                            </ul>
                        </article>
                    </div>
                </section>

                <section aria-labelledby="brand-colors">
                    <p className="text-xs font-bold uppercase tracking-[.22em] text-primary-200">03 · Color</p>
                    <h2 id="brand-colors" className="mt-3 font-display text-4xl font-bold text-white md:text-6xl">Wild, vivid, grounded.</h2>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {colors.map((color) => (
                            <article
                                key={color.name}
                                className={`${color.className} ${color.text} flex min-h-[13rem] flex-col justify-end rounded-[1.75rem] p-6 ${color.value === "#FFFFFF" ? "ring-1 ring-black/10" : "ring-1 ring-white/10"}`}
                            >
                            <h3 className="font-display text-xl font-bold">{color.name}</h3>
                            <p className="mt-1 font-mono text-sm opacity-75">{color.value}</p>
                        </article>
                        ))}
                    </div>
                    <p className="mt-5 max-w-3xl text-base leading-7 text-ink-300">AnimalDex lime is the fill for primary buttons and accents. Use primary green for supporting states and maps, near black for canvas, and muted text for supporting copy. Pair foreground and background colors with sufficient contrast.</p>
                </section>

                <section aria-labelledby="typography" className="rounded-[2.5rem] bg-surface-900/60 p-7 md:p-12">
                    <p className="text-xs font-bold uppercase tracking-[.22em] text-primary-200">04 · Typography</p>
                    <h2 id="typography" className="mt-3 font-display text-4xl font-extrabold text-white md:text-6xl">Compact headlines. Clean reading.</h2>
                    <div className="mt-10 grid gap-10 lg:grid-cols-2">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[.18em] text-ink-400">Barlow Condensed · Titles, hooks, subtitles</p>
                            <p className="mt-2 text-sm font-medium text-ink-300">SemiBold, Bold, and ExtraBold. Compact, tall, and adventurous without becoming messy.</p>
                            <p className="mt-4 font-display text-5xl font-extrabold uppercase leading-none tracking-tight text-white md:text-7xl">Discover. Collect. Conquer.</p>
                            <p className="mt-5 font-display text-2xl font-semibold text-ink-200">Scan animals in the wild and level up your discoveries.</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[.18em] text-ink-400">Inter · Body and UI</p>
                            <p className="mt-2 text-sm font-medium text-ink-300">Medium and SemiBold. Clean, modern, and aligned with the AnimalDex app UI.</p>
                            <p className="mt-4 text-xl font-medium leading-9 text-white">Inter keeps field guides, animal profiles, and product interfaces readable across screen sizes.</p>
                            <p className="mt-3 text-base font-semibold text-ink-200">Buttons, navigation, and supporting copy stay in Inter so the condensed display type can do the work of the hook.</p>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="brand-help" className="flex flex-col items-start justify-between gap-7 rounded-[2.5rem] bg-gradient-to-br from-primary-500/20 to-surface-900 p-8 md:flex-row md:items-center md:p-12">
                    <div className="max-w-3xl">
                        <h2 id="brand-help" className="font-display text-3xl font-bold text-white md:text-5xl">Need a different format?</h2>
                        <p className="mt-3 text-lg leading-8 text-ink-200">For press, partnerships, co-branding, or a format not provided here, contact us before recreating or modifying the logo.</p>
                    </div>
                    <a href="mailto:support@animaldex.app?subject=AnimalDex%20brand%20asset%20request" className="shrink-0 rounded-full bg-white px-6 py-3.5 font-bold text-canvas-950 hover:bg-primary-200">Request brand assets</a>
                </section>
            </main>
        </div>
    );
}
