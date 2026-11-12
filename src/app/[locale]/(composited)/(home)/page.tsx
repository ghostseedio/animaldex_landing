import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import Image from "next/image";
import HomeChatStill from "@/app/[locale]/(composited)/(home)/_components/home-chat-still";
import {HomeDoneStill, HomeRevealStill} from "@/app/[locale]/(composited)/(home)/_components/home-stills";
import HomeAnimalOrbit, {type HomeOrbitAnimal} from "@/app/[locale]/(composited)/(home)/_components/home-animal-orbit";
import HomeSides from "@/app/[locale]/(composited)/(home)/_components/home-sides";
import HomeIdeaDemo, {type HomeIdeaDemoWords} from "@/app/[locale]/(composited)/(home)/_components/home-idea-demo";
import HeroVariantGate from "@/app/[locale]/(composited)/(home)/_components/hero-variant-gate";
import {default as downloads} from "@/data/downloads.json";
import Anchor from "@/app/[locale]/(composited)/_components/anchor";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import StoreLink from "@/components/store/store-link";
import {localeConfig} from "@/i18n";
import {ARK_RENDER_IMAGE} from "@/lib/seo/ark-pages";
import {homeFeatureList} from "@/lib/seo/home-features";
import {homeJsonLd, jsonLdHtml} from "@/lib/seo/structured-data";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {TRY_TALKING_SPECIES} from "@/lib/try-talking";
import {ADVICE_FATIGUE_HREF, HOW_IT_WORKS_HREF, TALK_HREF} from "@/data/public-navigation";
import {getDisagreeExample} from "@/data/animal-perspective";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {HERO_ARM_ATTRIBUTE, heroBootScript, heroVariantSplit} from "@/lib/hero-variant";
import {HERO_DEMO_ANIMAL, HERO_DEMO_CHIPS, type HeroDemoChip} from "@/lib/hero-demo";

const heroBackgroundImage =
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/admin-assets/blog/2026-08-30/animaldex-background-2dc78d85-1954-4033-8418-78155bedb274.avif";

// The hero word's texture is the same photo at the size a phone's background
// already fetched (w=828 through the image optimizer), so it costs no second download.
const heroTextureImage = `/_next/image?url=${encodeURIComponent(
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/admin-assets/blog/2026-08-30/animaldex-background-2dc78d85-1954-4033-8418-78155bedb274.avif"
)}&w=828&q=75`;

/**
 * The animals around the hero's talking octopus (2026-11-01). Each has icon
 * art in the `animals` bucket; the name is the catalog's when the Talk rows
 * carry it, these otherwise.
 */
const heroOrbitAnimals = [
    {slug: "gray-wolf", name: "Gray Wolf"},
    {slug: "little-owl", name: "Little Owl"},
    {slug: "african-bush-elephant", name: "African Bush Elephant"},
    {slug: "cheetah", name: "Cheetah"},
    {slug: "emperor-penguin", name: "Emperor Penguin"},
    {slug: "honey-badger", name: "Honey Badger"}
] as const;

/** Hero B's chips, with the reader's words for each (`home.demo.chips`). */
function demoChips(raw: unknown): HeroDemoChip[] {
    const chips = raw && typeof raw === "object" ? raw as Record<string, {label?: unknown; message?: unknown; usual?: unknown}> : {};
    return HERO_DEMO_CHIPS.flatMap(({id, kind}) => {
        const words = chips[id];
        const usual = Array.isArray(words?.usual) ? words.usual.filter((line): line is string => typeof line === "string") : [];
        return typeof words?.label === "string" && typeof words.message === "string" && usual.length > 0
            ? [{id, kind, label: words.label, message: words.message, usual}]
            : [];
    });
}

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
            images: [{url: ARK_RENDER_IMAGE, width: 1200, height: 630, alt: fullTitle}]
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            images: [{url: ARK_RENDER_IMAGE, alt: fullTitle}]
        }
    };
}

export default async function Home({params}: HomePageProps) {
    const timer = createDevRequestTimer("home.page");
    const locale = localeConfig.locales.includes(params.locale) ? params.locale : localeConfig.defaultLocale;

    try {
        const [t, messages] = await timeDevStep(timer, "translations", () => Promise.all([
            getScopedTranslator(locale, "home"),
            loadLocaleMessages(locale)
        ]));
    // Structured data (SEO lane S3, S1's audit): one app entity in the world positioning, no SearchAction.
    const homeSchema = homeJsonLd({
        locale,
        name: "AnimalDex",
        description: String((messages.meta as {description?: unknown} | undefined)?.description ?? ""),
        image: ARK_RENDER_IMAGE,
        featureList: homeFeatureList(locale)
    });
    const disagree = getDisagreeExample(locale, getSpeciesArtworkUrl);
    const orbitCenter: HomeOrbitAnimal = {slug: TRY_TALKING_SPECIES.slug, name: t("chatStill.animal"), image: TRY_TALKING_SPECIES.image};
    const orbitAnimals: HomeOrbitAnimal[] = heroOrbitAnimals.map(({slug, name}) => ({slug, name, image: getSpeciesArtworkUrl(slug)}));
    const downloadStoreLinks = downloads.filter(({name}) => name === "App Store" || name === "Google Play");
    // The hero test (lib/hero-variant): read at render, so the split changes with the server's environment.
    const heroSplit = heroVariantSplit(process.env.HERO_VARIANT_SPLIT);
    const chips = demoChips((messages.home as {demo?: {chips?: unknown}} | undefined)?.demo?.chips);
    const askT = await getScopedTranslator(locale, "askAnimalDex");
    const demoWords: HomeIdeaDemoWords = {
        label: t("demo.label"),
        eyebrow: t("demo.eyebrow"),
        chipsLabel: t("demo.chipsLabel"),
        usualTitle: t("demo.usualTitle"),
        exampleTag: t("demo.exampleTag"),
        exampleNote: t("demo.exampleNote"),
        takeTitle: t("demo.takeTitle"),
        idle: t("demo.idle"),
        ask: t("demo.ask"),
        thinking: t("demo.thinking"),
        keepTalking: t("demo.keepTalking"),
        share: t("demo.share"),
        copied: t("demo.copied"),
        shareTitle: t("demo.shareTitle"),
        failed: t("demo.failed"),
        tryAgain: t("demo.tryAgain"),
        limit: t("demo.limit"),
        limitCta: t("demo.limitCta"),
        disclosure: t("demo.disclosure"),
        safetyLink: t("demo.safetyLink"),
        aiTagLabel: askT("aiTagLabel"),
        under13Title: askT("under13Title")
    };
    // Six cards fill the 4-column bento exactly (WEB-28): the article on why an
    // animal that takes a side matters leads, side by side comes last (W6).
    // Pictures and a title only (2026-11-01).
    const keepExploringCards: Array<{id: string; href: string; image: string | null; layout: "featured" | "medium" | "small" | "wide"}> = [
        {id: "adviceFatigue", href: ADVICE_FATIGUE_HREF, image: null, layout: "featured"},
        {id: "wolfLessons", href: "/animal-powers/wolf", image: "/images/blog/wolf-symbolism/wolf-symbolism-hero.webp", layout: "medium"},
        {id: "owlSymbolism", href: "/blog/owl-symbolism", image: "/images/blog/owl-symbolism/owl-symbolism-hero.webp", layout: "medium"},
        {id: "octopusMind", href: "/blog/octopus-symbolism", image: "/images/blog/how-octopus-intelligence-works/common-octopus.webp", layout: "small"},
        {id: "lionProfile", href: "/animals/lion", image: "/images/blog/lion-symbolism/lion-symbolism-hero.webp", layout: "small"},
        {id: "tigerLion", href: "/comparisons/tiger-vs-lion", image: "/images/blog/tiger-symbolism/tiger-symbolism-hero.webp", layout: "wide"}
    ];
    const sectionTitle = "font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl lg:text-6xl";
    const heroStoreRow = (
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {/* Its own line on a phone, so the row never rewraps when the web font
                arrives (it shifted the hero by 48 px: CLS 0.043). */}
            <span className="mr-1 basis-full text-center text-[11px] font-bold uppercase tracking-[0.16em] text-white/75 sm:basis-auto sm:text-left">{t("heroGetApp")}</span>
            {downloadStoreLinks.map(({name}) => (
                <StoreLink
                    key={name}
                    store={name === "App Store" ? "app_store" : "google_play"}
                    placement="home_hero"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-200/60 px-4 text-sm font-bold text-white transition-colors duration-300 hover:border-primary-400 hover:bg-primary-400 hover:text-canvas-950"
                >
                    {name}
                </StoreLink>
            ))}
        </div>
    );

        return (
        <>
            {/* No FAQPage: the questions left the page (2026-11-01), and the markup has to match what is shown. */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: jsonLdHtml(homeSchema)}}
            />
            {/* The hero test: marks <html> with this visitor's hero before either is painted. */}
            <script dangerouslySetInnerHTML={{__html: heroBootScript(heroSplit)}} />
            <HeroVariantGate splitB={heroSplit} />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[min(120svh,56rem)] overflow-hidden"
            >
                <Image
                    src={heroBackgroundImage}
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="hero-background-feather object-cover object-center light:opacity-30"
                />
            </div>

            {/* Hero A: the hero the page had, the talking octopus and its orbit (Nov 2026: without the stats and the laurel). */}
            <section
                {...{[HERO_ARM_ATTRIBUTE]: "a"}}
                className="relative mx-auto -mt-6 mb-16 grid min-h-[calc(100svh-7rem)] w-full max-w-[86rem] grid-cols-1 items-center gap-10 px-4 pb-12 pt-8 sm:pb-14 md:px-8 lg:-mt-8 lg:mb-8 lg:grid-cols-2 lg:items-center lg:gap-6 lg:pb-16 lg:pt-8 xl:gap-10"
                id="top"
            >
                <div className="relative z-10 flex flex-col items-center text-center lg:-ml-3 lg:items-start lg:text-left xl:-ml-5">
                    {/* The repositioning (2026-10-31): talking, and an animal that takes a side, first. */}
                    <h1 className="font-display font-extrabold uppercase leading-[0.9] tracking-tight text-white">
                        <span
                            className="hero-wild-textured block text-6xl font-semibold leading-[0.85] sm:text-7xl lg:text-[5.25rem] xl:text-[6.25rem]"
                            style={{"--hero-wild-texture": `url(${heroTextureImage})`} as React.CSSProperties}
                        >
                            {t("heroTalkLead")}
                        </span>
                        <span className="mt-3 block text-[2.1rem] leading-[0.95] [text-wrap:balance] sm:text-5xl lg:text-[3rem] xl:text-[3.5rem]">{t("heroTalkAccent")}</span>
                    </h1>
                    <div className="mt-9 flex w-full max-w-xl flex-col items-center gap-4 lg:items-start">
                        <Link
                            href={TALK_HREF}
                            className="group/talk relative flex min-h-[4.25rem] w-full items-center gap-3 overflow-hidden rounded-full border border-primary-200/40 bg-primary-400 py-3.5 pl-4 pr-6 text-left text-canvas-950 shadow-[0_18px_50px_rgba(167,244,50,0.22),inset_0_1px_0_rgba(255,255,255,0.38)] transition-[transform,box-shadow,background-color] duration-300 ease-out hover:-translate-y-1 hover:bg-primary-300 hover:shadow-[0_26px_74px_rgba(167,244,50,0.32)] sm:w-auto sm:min-w-[22rem]"
                        >
                            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center">
                                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 5.5h16v10H9.5L5 19.5v-4H4z" />
                                    <path d="M8 10.5h8" />
                                </svg>
                            </span>
                            <span className="min-w-0 flex-1 font-display text-xl font-bold leading-none sm:text-2xl">{t("heroCta")}</span>
                            <span aria-hidden="true" className="text-2xl transition-transform duration-300 group-hover/talk:translate-x-1">→</span>
                        </Link>
                        {heroStoreRow}
                    </div>
                </div>
                <div className="relative z-10 flex w-full items-center justify-center pb-10 lg:pb-0">
                    <HomeAnimalOrbit center={orbitCenter} animals={orbitAnimals} bubble={t("heroBubble")} label={t("orbitLabel")} />
                </div>
            </section>

            {/* Hero B: the demo first (SPEC section 1): the usual answer beside the lion's own take, live. */}
            <section
                {...{[HERO_ARM_ATTRIBUTE]: "b"}}
                aria-labelledby="home-idea-title"
                className="relative mx-auto -mt-4 mb-16 flex w-full max-w-5xl flex-col items-center gap-7 px-4 pb-10 pt-4 sm:pt-8 md:px-8 lg:mb-20 lg:pt-10"
                id="try"
            >
                <h1 id="home-idea-title" className="w-full text-center font-display font-extrabold uppercase leading-[0.9] tracking-tight text-white">
                    <span
                        className="hero-wild-textured block text-[2.65rem] font-semibold leading-[0.88] [text-wrap:balance] sm:text-6xl lg:text-[4.5rem] xl:text-[5rem]"
                        style={{"--hero-wild-texture": `url(${heroTextureImage})`} as React.CSSProperties}
                    >
                        {t("heroIdeaLead")}
                    </span>
                    <span className="mt-3 block text-[1.6rem] leading-[0.95] [text-wrap:balance] sm:text-4xl lg:text-[2.75rem]">{t("heroTalkAccent")}</span>
                </h1>
                <HomeIdeaDemo chips={chips} words={demoWords} locale={locale} animalImage={getSpeciesArtworkUrl(HERO_DEMO_ANIMAL.slug)} />
                {heroStoreRow}
            </section>

            {/* Every animal is different (spec §3): one question, two animals facing off across it. */}
            <section aria-labelledby="home-different-title" className="relative mx-auto mb-20 flex w-full max-w-5xl flex-col items-center gap-10 px-4 md:px-8 lg:mb-28">
                <h2 id="home-different-title" className={`${sectionTitle} max-w-3xl text-center`}>{t("different.title")}</h2>
                <HomeSides example={disagree} />
            </section>

            {/* Three pictures for how it goes: capture one, talk to it, do the step and keep its Power. */}
            <Anchor id="features" className="top-12 lg:-top-24" />
            <section aria-labelledby="home-flow-title" className="relative mb-20 w-full overflow-hidden bg-[#071B0F] py-14 light:bg-canvas-900 md:py-20 lg:mb-28">
                <h2 id="home-flow-title" className="sr-only">{t("heroHowItWorks")}</h2>
                <ol className="mx-auto flex w-full max-w-[86rem] snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:px-8 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                    {[
                        {
                            label: t("flow.capture"),
                            still: (
                                <HomeRevealStill
                                    image={getSpeciesArtworkUrl("red-fox")}
                                    words={{
                                        label: t("more.theme.alt"),
                                        eyebrow: t("more.theme.stillLabel"),
                                        animal: "Red Fox",
                                        scientificName: "Vulpes vulpes",
                                        power: `${t("chatStill.power").split("·")[0].trim()} · Cunning`,
                                        motto: "Work the edges.",
                                        talk: t("more.theme.stillTalk"),
                                        stars: t("more.theme.stillStars")
                                    }}
                                />
                            )
                        },
                        {
                            label: t("flow.talk"),
                            still: (
                                <HomeChatStill
                                    image={TRY_TALKING_SPECIES.image}
                                    words={{
                                        label: t("chatStill.label"),
                                        animal: t("chatStill.animal"),
                                        power: t("chatStill.power"),
                                        you: t("chatStill.you"),
                                        reply: t("chatStill.reply"),
                                        stepLabel: t("chatStill.stepLabel"),
                                        step: t("chatStill.step"),
                                        accept: t("chatStill.accept"),
                                        other: t("chatStill.other"),
                                        caption: t("chatStill.caption")
                                    }}
                                />
                            )
                        },
                        {
                            label: t("flow.grow"),
                            still: (
                                <HomeDoneStill
                                    image={getSpeciesArtworkUrl("gray-wolf")}
                                    words={{
                                        label: t("more.ui.alt"),
                                        animal: "Gray Wolf",
                                        power: `${t("chatStill.power").split("·")[0].trim()} · Cooperation`,
                                        you: t("more.ui.you"),
                                        reply: t("more.ui.reply"),
                                        doneLabel: t("more.ui.doneLabel"),
                                        doneText: t("more.ui.doneText")
                                    }}
                                />
                            )
                        }
                    ].map((step, index) => (
                        <li key={step.label} className="flex w-[86%] max-w-[24rem] shrink-0 snap-center flex-col items-center gap-6 sm:w-[60%] lg:w-auto lg:max-w-none">
                            <p className="flex items-baseline gap-3 font-display font-black uppercase leading-none text-white">
                                <span className="text-5xl text-primary-400 md:text-6xl">{String(index + 1).padStart(2, "0")}</span>
                                <span className="text-2xl tracking-[0.04em] md:text-3xl">{step.label}</span>
                            </p>
                            <div className="w-full">{step.still}</div>
                        </li>
                    ))}
                </ol>
                <p className="mt-10 px-4 text-center">
                    <Link href={HOW_IT_WORKS_HREF} className="inline-flex items-center gap-2 text-base font-bold text-primary-200 transition-colors hover:text-white">
                        {t("heroHowItWorks")} <span aria-hidden="true">→</span>
                    </Link>
                </p>
            </section>

            {/* The Ark (Part 4d): where an animal goes when its step works. */}
            <section aria-labelledby="home-ark-title" className="relative mx-auto mb-20 flex w-full max-w-5xl flex-col items-center gap-5 px-4 text-center md:px-8 lg:mb-28">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{t("ark.eyebrow")}</p>
                <h2 id="home-ark-title" className="max-w-3xl font-display text-3xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white [text-wrap:balance] md:text-5xl">{t("ark.title")}</h2>
                <p className="max-w-2xl text-base leading-7 text-ink-200 md:text-lg md:leading-8">{t("ark.body")}</p>
                <Link href="/ark" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-200/60 px-5 text-sm font-bold text-white transition-colors duration-300 hover:border-primary-400 hover:bg-primary-400 hover:text-canvas-950">
                    {t("ark.cta")} <span aria-hidden="true">→</span>
                </Link>
            </section>

            <Anchor id="download" className="md:-top-48" />
            <section className="relative mb-20 flex w-full flex-col items-center px-4 md:px-8 lg:mb-28">
                <div className="relative w-full max-w-6xl">
                    <div className="pointer-events-none absolute inset-x-10 top-8 -z-10 h-56 rounded-full bg-primary-500/[0.18] blur-3xl motion-safe:animate-[ctaGlow_5s_ease-in-out_infinite]" />
                    <div className="relative overflow-hidden border border-primary-200/15 bg-[radial-gradient(circle_at_20%_0%,rgba(167,244,50,0.16),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(167,244,50,0.10),transparent_34%),linear-gradient(135deg,rgba(28,37,32,0.92),rgba(7,11,9,0.96))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] light:border-line-200 light:bg-none light:bg-surface-900 md:p-10 motion-safe:animate-[ctaRise_700ms_ease-out_both]">
                        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                            <div className="flex flex-col gap-6 text-center lg:text-left">
                                <h2 className="font-display text-5xl font-bold leading-[0.96] text-white md:text-6xl lg:text-7xl">
                                    {t("download.title")}
                                </h2>
                            </div>
                            <div className="flex flex-col gap-3">
                                {downloadStoreLinks.map(({name}) => (
                                    <StoreLink
                                        key={name}
                                        store={name === "App Store" ? "app_store" : "google_play"}
                                        placement="home_download"
                                        inheritPlacement
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/store flex min-h-[5.25rem] items-center gap-4 rounded-[2px] border border-white/10 bg-[#07100B]/88 px-5 py-4 text-left text-white shadow-[0_18px_60px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary-200/45 hover:bg-[#0D2A16] hover:shadow-[0_22px_70px_rgba(33,192,94,0.12),inset_0_1px_0_rgba(255,255,255,0.10)] light:bg-surface-800 light:hover:bg-surface-700"
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.055] text-primary-100 transition-colors duration-300 group-hover/store:border-primary-200/30 group-hover/store:text-white">
                                            {name === "App Store" ? (
                                                <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-current">
                                                    <path d="M21.8 4.2c.1 1.4-.4 2.8-1.3 3.8-.9 1.1-2.4 1.9-3.8 1.8-.2-1.3.4-2.8 1.2-3.7.9-1.1 2.5-1.9 3.9-1.9Zm4.7 19.2c-.6 1.4-.9 2.1-1.7 3.3-1.1 1.7-2.7 3.8-4.7 3.8-1.8 0-2.2-1.1-4.6-1.1s-2.9 1.1-4.6 1.2c-2 0-3.5-1.9-4.7-3.6-3.2-4.9-3.6-10.6-1.6-13.7 1.4-2.2 3.6-3.4 5.7-3.4 2.1 0 3.5 1.2 5.3 1.2 1.7 0 2.8-1.2 5.3-1.2 1.9 0 3.9 1 5.3 2.8-4.7 2.6-3.9 9.3.3 10.7Z" />
                                                </svg>
                                            ) : (
                                                <svg aria-hidden="true" viewBox="0 0 42 42" className="h-7 w-7 fill-current">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M21.5435 24.9506C20.8295 24.234 19.6675 24.234 18.9547 24.9506C17.0825 26.8266 5.34416 38.5968 3.76343 40.1699C5.59743 42.1248 8.91926 42.5982 11.2471 41.1779L28.1031 31.5178C26.5478 29.9677 23.1204 26.5326 21.5435 24.9506Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M18.9544 17.1818C19.6684 17.8983 20.8291 17.8983 21.5431 17.1818L25.4797 13.2363L25.4759 13.2338L28.155 10.5572L11.3129 0.859026C8.93803 -0.627523 5.51693 -0.11843 3.67529 1.87466C5.21911 3.40958 17.114 15.3401 18.9544 17.1818Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M16.3722 22.3631C17.0874 21.6453 17.0874 20.4846 16.3722 19.7668L5.82886 9.19418L2.04249 5.4129C2.01576 5.63436 1.99667 5.8749 2.00049 6.10909L2.00303 35.9533C2.01194 36.2333 2.05267 36.5592 2.09594 36.8404C4.58922 34.3993 13.7656 25.0193 16.3722 22.3631Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M37.0414 15.6736L31.4388 12.4473C29.797 14.0764 25.8045 18.0906 24.127 19.7693C23.4105 20.4871 23.4105 21.6478 24.127 22.3657C25.8146 24.0457 29.7385 27.9988 31.3905 29.6368L36.9892 26.4295C41.2223 24.3295 41.2541 17.8105 37.0414 15.6736Z" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[0.68rem] font-black uppercase tracking-[0.22em] text-primary-200/85">
                                                {t("download.available")}
                                            </span>
                                            <span className="mt-1 block font-display text-2xl font-bold leading-none">
                                                {name}
                                            </span>
                                        </span>
                                        <span className="text-2xl text-primary-200 transition-transform duration-300 group-hover/store:translate-x-1">
                                            →
                                        </span>
                                    </StoreLink>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section aria-labelledby="home-explore-title" className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 md:px-8">
                <h2 id="home-explore-title" className={`${sectionTitle} text-center`}>{t("explore.title")}</h2>
                <div className="grid auto-rows-[15rem] grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[16.5rem]">
                    {keepExploringCards.map((item) => {
                        const isFeatured = item.layout === "featured";
                        const isMedium = item.layout === "medium";
                        const isWide = item.layout === "wide";
                        const cardClassName = isFeatured
                            ? "md:col-span-2 lg:row-span-2"
                            : isMedium
                                ? "lg:col-span-2"
                                : isWide
                                    ? "md:col-span-2"
                                    : "";

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group relative flex overflow-hidden bg-surface-900 text-white ${cardClassName}`}
                            >
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={t(`explore.cards.${item.id}.alt`)}
                                        fill
                                        sizes={isFeatured ? "(min-width: 1024px) 50vw, 100vw" : isWide ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"}
                                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                                    />
                                ) : (
                                    // The article has no photograph: two animals who would disagree, facing each other.
                                    <div role="img" aria-label={t(`explore.cards.${item.id}.alt`)} className="absolute inset-0 flex items-start justify-center gap-[6%] bg-[radial-gradient(circle_at_30%_30%,rgba(167,244,50,0.18),transparent_45%),radial-gradient(circle_at_75%_35%,rgba(33,192,94,0.14),transparent_45%)] px-8 pt-10 md:pt-14">
                                        {["little-owl", "cheetah"].map((slug, index) => (
                                            <span key={slug} className={`relative aspect-square w-[34%] max-w-[13rem] ${index === 1 ? "-scale-x-100" : ""}`}>
                                                <Image src={getSpeciesArtworkUrl(slug)} alt="" fill sizes="(min-width: 1024px) 14rem, 34vw" className="object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]" />
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-canvas-950 via-canvas-950/30 to-transparent light:bg-[linear-gradient(to_top,rgb(var(--c-canvas-950))_0%,rgb(var(--c-canvas-950)/0.7)_30%,rgb(var(--c-canvas-950)/0)_60%)]" />
                                <div className={`relative mt-auto flex w-full items-end justify-between gap-4 ${isFeatured ? "p-6 md:p-8" : "p-5"}`}>
                                    <h3 className={`font-display font-bold leading-[0.98] ${isFeatured ? "text-4xl md:text-5xl lg:text-6xl" : "text-2xl md:text-3xl"}`}>
                                        {t(`explore.cards.${item.id}.title`)}
                                    </h3>
                                    <span aria-hidden="true" className="shrink-0 text-2xl text-primary-200 transition-transform duration-300 group-hover:translate-x-1">→</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </section>
        </>
        );
    } finally {
        finishDevRequestTimer(timer, {locale});
    }
}
