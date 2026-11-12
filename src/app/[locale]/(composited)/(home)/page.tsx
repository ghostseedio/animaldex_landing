import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import HomeArkHero from "@/app/[locale]/(composited)/(home)/_components/home-ark-hero";
import HomeLiveNumbers from "@/app/[locale]/(composited)/(home)/_components/home-live-numbers";
import HomeArkDay, {type HomeArkDayFrame} from "@/app/[locale]/(composited)/(home)/_components/home-ark-day";
import HomeArkPopulations from "@/app/[locale]/(composited)/(home)/_components/home-ark-populations";
import HomeLoopVideo from "@/app/[locale]/(composited)/(home)/_components/home-loop-video";
import ArkFoodChainSection from "@/components/ark/ark-food-chain-section";
import HomeFoodChainDev from "@/app/[locale]/(composited)/(home)/_components/home-food-chain-dev";
import Anchor from "@/app/[locale]/(composited)/_components/anchor";
import StoreLink from "@/components/store/store-link";
import {formatAnimalCount} from "@/lib/animal-count";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl, storeLinks} from "@/lib/store-links";
import {socialProfileUrlList} from "@/lib/social-links";
import {localeConfig} from "@/i18n";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator, type ScopedTranslator} from "@/loaders/translation";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {tideAt, weatherAt} from "@/lib/ark-clock";
import {daylightAt} from "@/lib/ark-daylight";

/**
 * The home page (landing lane S2, 2026-11-12): the live Ark first, then what it is made of, in pictures.
 *
 *   1. The hero: the real Ark (a frame of it, then the live 3D world) behind the tagline.
 *   2. Who is aboard right now (the public read and the event log).
 *   3. From your camera to the Ark: a real capture, a Komodo dragon in the Ark, its talking model.
 *   4. A day on the Ark: one real day of the shared clock, as the reader scrolls.
 *   5. The food chain, from the stored food links (SEO lane S3's compact explorer).
 *   6. Populations over time, from the event log.
 *   7. Get the app.
 *
 * Words are few on purpose: the text pages (/ark/how-it-works, /ark/food-chain, /about) carry the explanation.
 * Honest by construction: the world is built from each animal's field guide and never called accurate; every number
 * is read live, and nothing personal reaches the page (no names, no chats, no problems).
 */

const ART = "/images/home/ark";

/** The hero's frame: the Ark at 17:18 island time on 10 November 2026, rendered from the live world. */
const POSTER_AT = Date.UTC(2026, 10, 10, 17, 18);

/** A day on the Ark: the frames drawn, each at its island hour of 10 November 2026 (island time is UTC). */
const DAY_FRAMES: Array<{key: string; hours: number}> = [
    {key: "0200", hours: 2},
    {key: "0600", hours: 6},
    {key: "1100", hours: 11},
    {key: "1400", hours: 14},
    {key: "1736", hours: 17.6},
    {key: "1824", hours: 18.4},
    {key: "2100", hours: 21}
];
const DAY_AT = Date.UTC(2026, 10, 10);

/** The capture (a player's public card, shown without their name) and the Komodo dragon aboard. */
const CAPTURED_AT = Date.UTC(2026, 9, 14);
const ABOARD_AT = Date.UTC(2026, 10, 9);

export const revalidate = 86400;

export function generateStaticParams() {
    return [];
}

type HomePageProps = {
    params: {locale: string};
};

export async function generateMetadata({params}: HomePageProps): Promise<Metadata> {
    const locale = localeConfig.locales.includes(params.locale) ? params.locale : localeConfig.defaultLocale;
    const messages = await loadLocaleMessages(locale);
    const meta = (messages.meta || {}) as Record<string, unknown>;
    const fullTitle = typeof meta.fullTitle === "string" ? meta.fullTitle : "AnimalDex";
    const description = typeof meta.description === "string" ? meta.description : fullTitle;
    const canonicalPath = getLocalePath(locale);

    return {
        alternates: {
            canonical: canonicalPath,
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale)
            } as Record<string, string>)
        },
        // A page's openGraph replaces the layout's wholesale, so the brand card
        // has to be repeated here or the home page shares with no image at all.
        openGraph: {
            type: "website",
            url: canonicalPath,
            locale: getMetadataLocale(locale),
            title: fullTitle,
            description,
            siteName: "AnimalDex",
            images: [{url: "/images/og-every-animal-has-a-lesson.png", width: 1200, height: 630, alt: fullTitle}]
        }
    };
}

function islandClock(ms: number, locale: string) {
    return new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"}).format(new Date(ms));
}

function shortDate(ms: number, locale: string) {
    return new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}).format(new Date(ms));
}

/** The shared clock's words for one frame: its phase of the day, its weather and its tide, at that exact moment. */
function dayFrame(frame: {key: string; hours: number}, t: ScopedTranslator, locale: string): HomeArkDayFrame {
    const ms = DAY_AT + frame.hours * 3_600_000;
    const tide = tideAt(ms);
    const tideKey = tide.height > 0.75 * tide.amplitude ? "high" : tide.height < -0.75 * tide.amplitude ? "low" : tide.rising ? "rising" : "falling";
    const time = islandClock(ms, locale);
    const srcset = (format: string) => [960, 1600].map((width) => `${ART}/day-${frame.key}-${width}.${format} ${width}w`).join(", ");
    return {
        key: frame.key,
        hours: frame.hours,
        time,
        phase: t(`day.phase.${daylightAt(frame.hours).phase}`),
        weather: t(`day.weather.${weatherAt(ms).kind}`),
        tide: t(`day.tide.${tideKey}`),
        alt: t("day.frameAlt", {time}),
        avif: srcset("avif"),
        webp: srcset("webp")
    };
}

/** A section's head, the same everywhere: a numbered plate label over a hairline, the title, a line of intro. */
function SectionHead({index, eyebrow, title, intro, id}: {index: string; eyebrow: string; title: string; intro?: string; id: string}) {
    return (
        <header className="grid gap-y-4 md:grid-cols-12 md:gap-x-8">
            <p className="flex items-center gap-3 border-t border-line-200 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300 md:col-span-12">
                <span className="text-primary-200 [font-variant-numeric:tabular-nums]">{index}</span>
                <span>{eyebrow}</span>
            </p>
            <h2 id={id} className="font-display text-[2.5rem] font-bold leading-[0.95] tracking-tight text-white [text-wrap:balance] md:col-span-7 md:text-6xl">{title}</h2>
            {intro ? <p className="max-w-xl self-end text-base leading-relaxed text-ink-200 md:col-span-5 md:text-lg">{intro}</p> : null}
        </header>
    );
}

/** The figure's specimen label: what it is, its scientific name in italic, and where or when. */
function Specimen({name, latin, line}: {name: string; latin: string; line: string}) {
    return (
        <div className="absolute bottom-3 left-3 right-3 max-w-[18rem] rounded-sm bg-[#f4f1e8] px-3 py-2.5 text-[#13221a] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
            <p className="font-display text-lg font-bold leading-none">{name}</p>
            <p className="mt-1 text-[13px] italic leading-tight text-[#13221a]/75">{latin}</p>
            <p className="mt-2 border-t border-[#13221a]/15 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#13221a]/70">{line}</p>
        </div>
    );
}

function Picture({name, widths, alt, sizes, className}: {name: string; widths: number[]; alt: string; sizes: string; className?: string}) {
    const set = (format: string) => widths.map((width) => `${ART}/${name}-${width}.${format} ${width}w`).join(", ");
    return (
        <picture>
            <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ART}/${name}-${widths[0]}.webp`} srcSet={set("webp")} sizes={sizes} alt={alt} loading="lazy" decoding="async" className={className} />
        </picture>
    );
}

/** The official store badges (Apple's and Google's own artwork), with the placement each was clicked from. */
function StoreBadges({locale, placement, t}: {locale: string; placement: "home_hero" | "home_download"; t: ScopedTranslator}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <StoreLink store="app_store" placement={placement} inheritPlacement={placement === "home_download"} target="_blank" rel="noopener noreferrer" aria-label={t("app.appStore")} className="block rounded-[9px] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${ART}/badge-app-store.svg`} alt="" width={132} height={44} className="h-11 w-auto" />
            </StoreLink>
            <StoreLink store="google_play" placement={placement} inheritPlacement={placement === "home_download"} target="_blank" rel="noopener noreferrer" aria-label={t("app.googlePlay")} className="block rounded-[9px] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${ART}/badge-google-play-${locale === "id" ? "id" : "en"}.png`} alt="" width={locale === "id" ? 148 : 148} height={44} className="h-11 w-auto" />
            </StoreLink>
        </div>
    );
}

export default async function Home({params}: HomePageProps) {
    const timer = createDevRequestTimer("home.page");
    const locale = localeConfig.locales.includes(params.locale) ? params.locale : localeConfig.defaultLocale;

    try {
        const [t, home] = await timeDevStep(timer, "translations", () => Promise.all([
            getScopedTranslator(locale, "landing"),
            getScopedTranslator(locale, "home")
        ]));
        const siteUrl = getAbsoluteUrl(locale);
        const rootSiteUrl = getSiteUrl();
        const brandLogoUrl = new URL("/images/logo.webp", rootSiteUrl).toString();
        const socialImageUrl = new URL("/images/og-every-animal-has-a-lesson.png", rootSiteUrl).toString();
        // (Structured data: SEO lane S3 owns its wording and builders; kept as it was until S3's home pass.)
        const appSchemaDescription = `Take any idea, plan or decision to an animal and get a genuinely different take. Each of ${formatAnimalCount("en")} species answers from a real behaviour of its kind, its Power, how it lives and its field guide, and turns it into an angle you would not hear elsewhere. The animals remember you and the angles you have already heard, and every real animal you meet and photograph adds a new way of seeing. Steps that work bring animals into the Ark, a live, shared animal world whose rules are based on each animal's field guide.`;
        const webSiteSchema = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "AnimalDex",
            url: rootSiteUrl,
            image: socialImageUrl,
            description: home("supporting"),
            inLanguage: locale,
            publisher: {"@type": "Organization", name: "AnimalDex", url: rootSiteUrl, logo: brandLogoUrl},
            potentialAction: {"@type": "SearchAction", target: `${siteUrl}/blog`, "query-input": "required name=search_term_string"}
        };
        const featureList = [
            "Take any idea, plan or decision to an animal for a genuinely different take",
            "Each animal answers from a real behaviour of its species: its Power, how it lives and its field guide",
            "Animals that remember you and the angles you have already heard",
            "Hear two more of your animals on the same idea",
            "One step to try, when you want one",
            "Every animal you meet and photograph adds a new way of seeing",
            "The Ark: a live, shared 3D animal world, where animals whose steps worked live, eat and raise young by rules based on each animal's field guide",
            "AI animal identification and field-guide context",
            "Collectible wildlife cards and journals",
            "Respectful wildlife observation and habitat curiosity"
        ];
        const mobileAppSchema = {
            "@context": "https://schema.org",
            "@type": "MobileApplication",
            name: "AnimalDex",
            operatingSystem: "iOS, Android",
            applicationCategory: "EducationApplication",
            url: rootSiteUrl,
            installUrl: [appStoreUrl, googlePlayUrl],
            downloadUrl: [appStoreUrl, googlePlayUrl],
            image: socialImageUrl,
            screenshot: socialImageUrl,
            description: appSchemaDescription,
            offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
            audience: [
                {"@type": "Audience", "audienceType": "People with an idea, a plan or a decision"},
                {"@type": "Audience", "audienceType": "Curious minds who want a different take"},
                {"@type": "Audience", "audienceType": "Animal lovers"},
                {"@type": "Audience", "audienceType": "Wildlife learners"},
                {"@type": "Audience", "audienceType": "Travelers"},
                {"@type": "Audience", "audienceType": "Photographers"}
            ],
            featureList,
            about: [
                {"@type": "Thing", "name": "A different take on your ideas"},
                {"@type": "Thing", "name": "Talking to animals"},
                {"@type": "Thing", "name": "Perspective-driven AI"},
                {"@type": "Thing", "name": "Animal behaviour"},
                {"@type": "Thing", "name": "Animal world simulation"},
                {"@type": "Thing", "name": "Animal identification"},
                {"@type": "Thing", "name": "Wildlife learning"},
                {"@type": "Thing", "name": "Wildlife photography"}
            ]
        };
        const softwareAppSchema = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AnimalDex",
            applicationCategory: "EducationApplication",
            operatingSystem: "iOS, Android",
            url: siteUrl,
            installUrl: [appStoreUrl, googlePlayUrl],
            downloadUrl: [appStoreUrl, googlePlayUrl],
            image: socialImageUrl,
            description: appSchemaDescription,
            offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
            featureList
        };
        const organizationSchema = {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "AnimalDex",
            url: rootSiteUrl,
            logo: brandLogoUrl,
            image: brandLogoUrl,
            sameAs: [...storeLinks.map((store) => store.href), ...socialProfileUrlList]
        };

        const posterWide = (format: string) => [1280, 1920, 2400].map((width) => `${ART}/poster-wide-${width}.${format} ${width}w`).join(", ");
        const posterTall = (format: string) => [640, 1080].map((width) => `${ART}/poster-tall-${width}.${format} ${width}w`).join(", ");
        const posterCaption = t("hero.poster", {time: islandClock(POSTER_AT, locale), date: shortDate(POSTER_AT, locale)});
        const dayFrames = DAY_FRAMES.map((frame) => dayFrame(frame, t, locale));
        const plateSizes = "(min-width: 1024px) 28rem, (min-width: 640px) 45vw, 92vw";
        const foodChainClass = "[&_h2]:font-display [&_h2]:text-[2.5rem] [&_h2]:font-bold [&_h2]:leading-[0.95] [&_h2]:tracking-tight md:[&_h2]:text-6xl";
        // (Called, not mounted: an async server component as JSX fails this React's types. In development without keys
        // S3's section has nothing to read, and the same pieces run over the local extraction instead.)
        const foodChain = (await ArkFoodChainSection({locale, variant: "compact", limit: 6, headingLevel: 2, className: foodChainClass}))
            ?? (await HomeFoodChainDev({locale, limit: 6, className: foodChainClass}));

        return (
            <>
                {/* No FAQPage: the questions left the page (2026-11-01), and the markup has to match what is shown. */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify([organizationSchema, webSiteSchema, softwareAppSchema, mobileAppSchema])}}
                />

                {/* 1. The live Ark. */}
                <HomeArkHero
                    locale={locale}
                    lang={locale}
                    words={{
                        seeLive: t("hero.seeLive"),
                        loading: t("hero.loading"),
                        interact: t("hero.interact"),
                        interactDone: t("hero.interactDone"),
                        poster: posterCaption,
                        live: t("hero.live"),
                        sceneLabel: t("hero.sceneLabel")
                    }}
                    poster={
                        <picture>
                            <source media="(min-width: 768px)" type="image/avif" srcSet={posterWide("avif")} sizes="100vw" />
                            <source media="(min-width: 768px)" type="image/webp" srcSet={posterWide("webp")} sizes="100vw" />
                            <source type="image/avif" srcSet={posterTall("avif")} sizes="100vw" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                data-ark-poster=""
                                src={`${ART}/poster-tall-640.webp`}
                                srcSet={posterTall("webp")}
                                sizes="100vw"
                                alt={posterCaption}
                                fetchPriority="high"
                                decoding="async"
                                className="h-full w-full object-cover object-[50%_40%] md:object-[38%_50%]"
                            />
                        </picture>
                    }
                >
                    <h1 className="max-w-5xl text-white">
                        <span className="block font-display text-[3.1rem] font-extrabold uppercase leading-[0.86] tracking-[-0.005em] [text-wrap:balance] sm:text-7xl lg:text-[6.25rem]">{t("hero.taglineLead")}</span>
                        <span className="mt-3 block font-display-italic text-[1.7rem] font-semibold italic leading-[1.02] text-white/90 [text-wrap:balance] sm:text-4xl lg:mt-4 lg:text-[2.75rem]">{t("hero.taglineRest")}</span>
                    </h1>
                    <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-white/80 md:mt-6 md:text-lg">{t("hero.sentence")}</p>
                    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                        <StoreBadges locale={locale} placement="home_hero" t={t} />
                        <Link href="/ark" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline decoration-white/40 underline-offset-[6px] transition-colors hover:decoration-primary-400">
                            {t("hero.explore")}
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                        </Link>
                    </div>
                </HomeArkHero>

                <div className="mx-auto w-full max-w-[86rem] px-4 md:px-8">
                    {/* 2. Who is aboard right now. */}
                    <section aria-labelledby="home-numbers-title" className="pt-10 md:pt-14">
                        <h2 id="home-numbers-title" className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300">{t("numbers.title")}</h2>
                        <HomeLiveNumbers
                            locale={locale}
                            words={{
                                title: t("numbers.title"),
                                animals: t("numbers.animals"),
                                species: t("numbers.species"),
                                founders: t("numbers.founders"),
                                births: t("numbers.births"),
                                meals: t("numbers.meals"),
                                asOf: t("numbers.asOf"),
                                unavailable: t("numbers.unavailable"),
                                noMeals: t("numbers.noMeals"),
                                top: t("numbers.top")
                            }}
                        />
                    </section>

                    {/* 3. From your camera to the Ark. */}
                    <section aria-labelledby="home-steps-title" className="pt-24 md:pt-32">
                        <SectionHead id="home-steps-title" index="01" eyebrow={t("steps.eyebrow")} title={t("steps.title")} />
                        <ol className="mt-10 grid gap-x-8 gap-y-12 md:mt-14 sm:grid-cols-2 lg:grid-cols-3">
                            <li>
                                <figure>
                                    <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-900">
                                        <Picture name="catch-komodo" widths={[480, 960]} alt={t("steps.catchAlt")} sizes={plateSizes} className="h-full w-full object-cover" />
                                        <Specimen name="Komodo Dragon" latin="Varanus komodoensis" line={t("steps.catchLabel", {date: shortDate(CAPTURED_AT, locale)})} />
                                    </div>
                                    <figcaption className="mt-5 grid grid-cols-[3.5rem_1fr] gap-x-3">
                                        <span className="pt-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-200">{t("steps.fig", {n: "2a"})}</span>
                                        <span>
                                            <span className="block font-display text-3xl font-bold leading-none text-white">{t("steps.catchTitle")}</span>
                                            <span className="mt-2 block text-base leading-relaxed text-ink-200">{t("steps.catchBody")}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            </li>
                            <li>
                                <figure>
                                    <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-900">
                                        <Picture name="aboard-komodo" widths={[480, 720]} alt={t("steps.aboardAlt")} sizes={plateSizes} className="h-full w-full object-cover" />
                                        <Specimen name="Komodo Dragon" latin="Varanus komodoensis" line={t("steps.aboardLabel", {date: shortDate(ABOARD_AT, locale)})} />
                                    </div>
                                    <figcaption className="mt-5 grid grid-cols-[3.5rem_1fr] gap-x-3">
                                        <span className="pt-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-200">{t("steps.fig", {n: "2b"})}</span>
                                        <span>
                                            <span className="block font-display text-3xl font-bold leading-none text-white">{t("steps.aboardTitle")}</span>
                                            <span className="mt-2 block text-base leading-relaxed text-ink-200">{t("steps.aboardBody")}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            </li>
                            <li className="sm:col-span-2 lg:col-span-1">
                                <figure className="sm:mx-auto sm:max-w-[calc(50%-1rem)] lg:max-w-none">
                                    <div className="theme-dark relative aspect-[4/5] overflow-hidden rounded-sm bg-[#3a2a17]">
                                        <HomeLoopVideo
                                            sources={[{src: `${ART}/talk-komodo.webm`, type: "video/webm"}, {src: `${ART}/talk-komodo.mp4`, type: "video/mp4"}]}
                                            poster={`${ART}/talk-komodo-960.webp`}
                                            label={t("steps.talkAlt")}
                                            className="h-full w-full object-cover"
                                        />
                                        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
                                            <p className="ml-auto max-w-[80%] rounded-sm bg-primary-400 px-3 py-2 text-sm font-semibold leading-snug text-canvas-950">{t("steps.you")}</p>
                                            <p className="max-w-[92%] rounded-sm bg-[#0b130e]/90 px-3 py-2 text-sm leading-snug text-white backdrop-blur-sm">{t("steps.reply")}</p>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">{t("steps.example")}</p>
                                        </div>
                                    </div>
                                    <figcaption className="mt-5 grid grid-cols-[3.5rem_1fr] gap-x-3">
                                        <span className="pt-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-200">{t("steps.fig", {n: "2c"})}</span>
                                        <span>
                                            <span className="block font-display text-3xl font-bold leading-none text-white">{t("steps.talkTitle")}</span>
                                            <span className="mt-2 block text-base leading-relaxed text-ink-200">{t("steps.talkBody")}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            </li>
                        </ol>
                    </section>

                    {/* 4. A day on the Ark: the head here, the day itself full bleed below. */}
                    <section aria-labelledby="home-day-title" className="pt-24 md:pt-32">
                        <SectionHead id="home-day-title" index="02" eyebrow={t("day.eyebrow")} title={t("day.title")} intro={t("day.intro")} />
                    </section>
                </div>

                <div className="mt-10 md:mt-14">
                    <HomeArkDay frames={dayFrames} locale={locale} words={{awake: t("day.awake"), awakeLabel: t("day.awakeLabel"), date: t("day.date")}} />
                </div>

                <div className="mx-auto w-full max-w-[86rem] px-4 md:px-8">
                    {/* 5. Who eats whom (S3's compact explorer, its own heading set in this page's section style); nothing when it can't be read. */}
                    {foodChain ? (
                        <div className="pt-24 md:pt-32">
                            <p className="mb-4 flex items-center gap-3 border-t border-line-200 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300">
                                <span className="text-primary-200">03</span>
                                <span>{t("foodChain.eyebrow")}</span>
                            </p>
                            {foodChain}
                        </div>
                    ) : null}

                    {/* 6. Populations over time. */}
                    <section aria-labelledby="home-population-title" className="pt-24 md:pt-32">
                        <SectionHead id="home-population-title" index="04" eyebrow={t("population.eyebrow")} title={t("population.title")} intro={t("population.intro")} />
                        <div className="mt-10 md:mt-14">
                            <HomeArkPopulations
                                locale={locale}
                                words={{
                                    total: t("population.total"),
                                    backfill: t("population.backfill"),
                                    day24: t("population.day24"),
                                    same: t("population.same"),
                                    unavailable: t("population.unavailable"),
                                    axisStart: t("population.axisStart"),
                                    axisNow: t("population.axisNow"),
                                    legend: t("population.legend")
                                }}
                            />
                        </div>
                    </section>

                    {/* 7. Get the app. */}
                    <Anchor id="download" className="md:-top-24" />
                    <section aria-labelledby="home-app-title" className="py-24 md:py-32">
                        <div className="grid gap-10 border-t border-line-200 pt-10 md:grid-cols-12 md:gap-8 md:pt-14">
                            <div className="flex flex-col gap-5 md:col-span-8">
                                <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-300">
                                    <span className="text-primary-200">05</span>
                                    <span>{t("app.eyebrow")}</span>
                                </p>
                                <h2 id="home-app-title" className="font-display text-[2.5rem] font-bold leading-[0.95] tracking-tight text-white [text-wrap:balance] md:text-6xl">{t("app.title")}</h2>
                                <p className="text-base text-ink-200 md:text-lg">{t("app.body")}</p>
                                <StoreBadges locale={locale} placement="home_download" t={t} />
                            </div>
                            <figure className="hidden flex-col items-start gap-3 md:col-span-4 md:flex md:items-end">
                                <div className="rounded-sm bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`${ART}/qr-get-app.svg`} alt={t("app.qrAlt")} width={144} height={144} loading="lazy" className="h-36 w-36" />
                                </div>
                                <figcaption className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-300">{t("app.qr")}</figcaption>
                            </figure>
                        </div>
                    </section>
                </div>
            </>
        );
    } finally {
        finishDevRequestTimer(timer, {locale});
    }
}
