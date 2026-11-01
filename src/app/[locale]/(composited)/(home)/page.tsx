import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import IconCanvas from "@/app/[locale]/_components/icon-canvas";
import Image from "next/image";
import HomeFeatureCaptureCard from "@/app/[locale]/(composited)/(home)/_components/home-feature-capture-card";
import FeaturesOverview from "@/app/[locale]/(composited)/(home)/_components/features-overview";
import HomeArchiveModule from "@/app/[locale]/(composited)/(home)/_components/home-archive-module";
import FaqSection from "@/app/[locale]/(composited)/(home)/_components/faq-section";
import HomeChatStill from "@/app/[locale]/(composited)/(home)/_components/home-chat-still";
import {HomeDoneStill, HomeRevealStill} from "@/app/[locale]/(composited)/(home)/_components/home-stills";
import {checkedIcons} from "@/loaders/icons";
import {animalSilhouetteImages} from "@/data/animal-silhouettes";
import Marquee from "@/app/[locale]/_components/marquee";
import {default as features} from "@/data/features.json";
import {default as moreFeatures} from "@/data/more.json";
import {default as downloads} from "@/data/downloads.json";
import {localisePath} from "@/loaders/path";
import {unsafelyLoadSVG} from "@/loaders/svg";
import {formatAnimalCount} from "@/lib/animal-count";
import Anchor from "@/app/[locale]/(composited)/_components/anchor";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl, storeLinks} from "@/lib/store-links";
import StoreLink from "@/components/store/store-link";
import {ArrowSquareDownIcon} from "@/app/[locale]/_components/icons";
import {socialProfileUrlList} from "@/lib/social-links";
import {localeConfig} from "@/i18n";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {getHomeDownloadStatCounts} from "@/lib/home-download-stats";
import {getRecentPublicCaptures} from "@/data/discover-timeline";
import {TRY_TALKING_SPECIES} from "@/lib/try-talking";
import {ADVICE_FATIGUE_HREF, HOW_IT_WORKS_HREF, TALK_HREF} from "@/data/public-navigation";
import DisagreeStill from "@/app/[locale]/(composited)/_components/disagree-still";
import TextDiagramPanel from "@/app/[locale]/(composited)/_components/text-diagram-panel";
import {getDisagreeExample} from "@/data/animal-perspective";
import {getAdviceFatigueContent} from "@/data/advice-fatigue";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {drawGrid} from "@/lib/text-diagram";

const heroBackgroundImage =
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/admin-assets/blog/2026-08-30/animaldex-background-2dc78d85-1954-4033-8418-78155bedb274.avif";

// The hero word's texture is the same photo at the size a phone's background
// already fetched (w=828 through the image optimizer), so it costs no second download.
const heroTextureImage = `/_next/image?url=${encodeURIComponent(
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/admin-assets/blog/2026-08-30/animaldex-background-2dc78d85-1954-4033-8418-78155bedb274.avif"
)}&w=828&q=75`;

/**
 * Three problems people bring (W2), each opening the Talk picker with the
 * question carried, and two animals who would answer it differently.
 */
const homeProblems = [
    {id: "work", animals: ["little-owl", "cheetah"]},
    {id: "clash", animals: ["gray-wolf", "common-octopus"]},
    {id: "habit", animals: ["western-honey-bee", "african-bush-elephant"]}
] as const;

const heroLaurelWreathImage =
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/admin-assets/blog/2026-08-30/laurel-wreath-ede0a9b0-7b2e-45c3-a4fa-12bf9615c29d.webp";

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
            images: [{url: "/images/og-talk-to-animals.png", width: 1200, height: 630, alt: fullTitle}]
        }
    };
}

export default async function Home({params}: HomePageProps) {
    const timer = createDevRequestTimer("home.page");
    const locale = localeConfig.locales.includes(params.locale) ? params.locale : localeConfig.defaultLocale;

    try {
        const t = await timeDevStep(timer, "translations", () => getScopedTranslator(locale, "home"));
    const siteUrl = getAbsoluteUrl(locale);
    const rootSiteUrl = getSiteUrl();
    const brandLogoUrl = new URL("/images/logo.webp", rootSiteUrl).toString();
    const socialImageUrl = new URL("/images/og-talk-to-animals.png", rootSiteUrl).toString();
    const animalCount = formatAnimalCount(locale);
    const appSchemaDescription = `Talk to real animals with AI. Each of ${formatAnimalCount("en")} species answers from its own Power, a lesson from how its kind survives, takes a side on your problem and keeps it. Bring a real problem, hear a real side, and take one step. Photograph the animals you meet to collect them, and let them debate your problems.`;
    const disagree = getDisagreeExample(locale, getSpeciesArtworkUrl);
    const paradox = getAdviceFatigueContent(locale).paradox;
    const fatigueStats = ["models", "affirm", "people"].map((id) => ({
        value: t(`fatigue.stats.${id}.value`),
        label: t(`fatigue.stats.${id}.label`)
    }));
    const faqItems = ["free", "agree", "ai", "power", "capture"].map((id) => ({
        question: t(`faq.${id}.q`),
        answer: t(`faq.${id}.a`)
    }));
    const faqTrustItems = ["beginner", "families", "behavior"].map((id) => t(`faq.trust.${id}`));
    const [downloadStatCounts, featureCaptures] = await timeDevStep(
        timer,
        "home.data",
        () => Promise.all([
            getHomeDownloadStatCounts(),
            getRecentPublicCaptures(features.length, {imageVariant: "card-thumbnail"})
        ]),
        {featureCount: features.length}
    );
    // One label set for the same three numbers, here and in the download band
    // (WEB-28), and the one honest animal count every page quotes (WEB-29).
    const downloadHeroStats = [
        {value: downloadStatCounts.captures === null ? null : downloadStatCounts.captures.toLocaleString(locale), label: t("download.stats.capturesLabel")},
        {value: downloadStatCounts.users === null ? null : downloadStatCounts.users.toLocaleString(locale), label: t("download.stats.usersLabel")},
        {value: animalCount, label: t("download.stats.indexesLabel")}
    ];
    const downloadTrustItems = [
        downloadStatCounts.captures === null
            ? t("download.trust.scanner")
            : t("download.stats.captures", {count: downloadStatCounts.captures.toLocaleString(locale)}),
        downloadStatCounts.users === null
            ? t("download.trust.collect")
            : t("download.stats.users", {count: downloadStatCounts.users.toLocaleString(locale)}),
        t("download.stats.indexes", {count: animalCount})
    ];
    const downloadStoreLinks = downloads.filter(({name}) => name === "App Store" || name === "Google Play");
    // Six cards fill the 4-column bento exactly (WEB-28): the article on why an
    // animal that takes a side matters leads, side by side comes last (W6).
    const keepExploringCards: Array<{id: string; href: string; image: string | null; layout: "featured" | "medium" | "small" | "wide"}> = [
        {id: "adviceFatigue", href: ADVICE_FATIGUE_HREF, image: null, layout: "featured"},
        {id: "wolfLessons", href: "/animal-powers/wolf", image: "/images/blog/wolf-symbolism/wolf-symbolism-hero.webp", layout: "medium"},
        {id: "owlSymbolism", href: "/blog/owl-symbolism", image: "/images/blog/owl-symbolism/owl-symbolism-hero.webp", layout: "medium"},
        {id: "octopusMind", href: "/blog/octopus-symbolism", image: "/images/blog/how-octopus-intelligence-works/common-octopus.webp", layout: "small"},
        {id: "lionProfile", href: "/animals/lion", image: "/images/blog/lion-symbolism/lion-symbolism-hero.webp", layout: "small"},
        {id: "tigerLion", href: "/comparisons/tiger-vs-lion", image: "/images/blog/tiger-symbolism/tiger-symbolism-hero.webp", layout: "wide"}
    ];
    const webSiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AnimalDex",
        url: rootSiteUrl,
        image: socialImageUrl,
        description: t("supporting"),
        inLanguage: locale,
        publisher: {
            "@type": "Organization",
            name: "AnimalDex",
            url: rootSiteUrl,
            logo: brandLogoUrl
        },
        potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/blog`,
            "query-input": "required name=search_term_string"
        }
    };
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
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
        },
        isFamilyFriendly: true,
        audience: [
            {"@type": "Audience", "audienceType": "Animal lovers"},
            {"@type": "Audience", "audienceType": "Wildlife learners"},
            {"@type": "Audience", "audienceType": "Families"},
            {"@type": "Audience", "audienceType": "Travelers"},
            {"@type": "Audience", "audienceType": "Photographers"},
            {"@type": "Audience", "audienceType": "Collectors"},
            {"@type": "Audience", "audienceType": "Breeders and breed researchers"},
            {"@type": "Audience", "audienceType": "Animal card creators"},
            {"@type": "Audience", "audienceType": "Self-improvement learners"}
        ],
        featureList: [
            "Talk to animals that answer from their own Power, take a side and keep it",
            "Your step: one real step from your own problem, which earns the animal's Power",
            "Debates between animals on your problem, private or public with a community vote",
            "Trials: each animal's own challenges",
            "AI animal scanning and analysis",
            "Animal identification and field-guide context",
            "Breed identification, grading, and pricing context",
            "Collectible wildlife cards and journals",
            "Custom animal card decks for pets, wildlife, and creator projects",
            "Albums, sets, missions, and progression",
            "Discovery feed for real animal sightings",
            "Trading animals",
            "Family-friendly animal learning",
            "Animal-inspired reflection and self-improvement prompts",
            "Respectful wildlife observation and habitat curiosity"
        ],
        about: [
            {"@type": "Thing", "name": "Talking to animals"},
            {"@type": "Thing", "name": "Perspective-driven AI"},
            {"@type": "Thing", "name": "Advice fatigue"},
            {"@type": "Thing", "name": "Animal identification"},
            {"@type": "Thing", "name": "Animal breed grading"},
            {"@type": "Thing", "name": "Animal breed pricing"},
            {"@type": "Thing", "name": "Wildlife learning"},
            {"@type": "Thing", "name": "Animal card collecting"},
            {"@type": "Thing", "name": "Custom animal card decks"},
            {"@type": "Thing", "name": "Animal-inspired self-improvement"},
            {"@type": "Thing", "name": "Wildlife photography"},
            {"@type": "Thing", "name": "Zoo and safari animal discovery"}
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
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD"
        },
        featureList: mobileAppSchema.featureList
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
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };

        return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([organizationSchema, webSiteSchema, softwareAppSchema, mobileAppSchema, faqSchema])}}
            />
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
            <IconCanvas
                probability={0.02}
                paths={checkedIcons}
                imageSources={animalSilhouetteImages}
                color="#21C05E"
                height={2000}
            />

            <section
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
                    <p className="mt-6 max-w-lg text-lg font-medium leading-8 text-white md:text-xl md:leading-9">
                        {t("heroSubhead")}
                    </p>
                    <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-4 lg:items-start">
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
                        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                            <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">{t("heroGetApp")}</span>
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
                    </div>
                    <Link
                        href={HOW_IT_WORKS_HREF}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-200 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                        {t("heroHowItWorks")} <span aria-hidden="true">→</span>
                    </Link>
                    <div className="mt-10 flex w-full max-w-xl items-stretch justify-center lg:justify-start">
                        {downloadHeroStats.map((item, index) => (
                            <div
                                key={item.label}
                                className={`min-w-0 flex-1 ${index > 0 ? "border-l border-white/20 pl-4 sm:pl-5" : ""} ${index < downloadHeroStats.length - 1 ? "pr-4 sm:pr-5" : ""}`}
                            >
                                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary-400 text-primary-400" aria-hidden="true">
                                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                                            <path d="M3.5 8.2 6.4 11.2 12.5 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-white sm:text-4xl">
                                        {item.value === null ? "—" : item.value}
                                    </span>
                                    <span className="col-start-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white sm:text-[11px]">
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="relative z-10 flex w-full items-center justify-center pb-10 lg:pb-0">
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
                </div>
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-full max-w-xl -translate-x-1/2 px-4 opacity-90 sm:bottom-4 lg:bottom-6">
                    <div className="relative mx-auto w-full max-w-[18rem] sm:max-w-[21rem] md:max-w-[24rem]">
                        <Image
                            src={heroLaurelWreathImage}
                            alt=""
                            width={720}
                            height={180}
                            // It is drawn at most 24rem wide: without sizes the browser fetched the 1920 px rendition.
                            sizes="(min-width: 768px) 24rem, (min-width: 640px) 21rem, 18rem"
                            className="h-auto w-full select-none opacity-85"
                            aria-hidden="true"
                        />
                        <div className="absolute inset-0 flex items-center justify-center px-[11%] sm:px-[12%]">
                            <p className="-translate-y-1 whitespace-nowrap text-center font-display text-[9px] font-semibold uppercase leading-none tracking-[0.15em] text-white/85 sm:-translate-y-1.5 sm:text-[10px] sm:tracking-[0.17em] md:text-xs md:tracking-[0.19em]">
                                {t("heroLaurelMadeFor")}{" "}
                                <span className="ml-1.5 text-primary-200 sm:ml-2">{t("heroLaurelExplorers")}</span>.
                                {" "}{t("heroLaurelBuiltFor")}{" "}
                                <span className="ml-1.5 text-primary-200 sm:ml-2">{t("heroLaurelCurious")}</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            {/* Every animal is different (spec §3): one question, two sides. */}
            <section
                aria-labelledby="home-different-title"
                className="relative mx-auto mb-16 grid w-full max-w-[86rem] grid-cols-1 items-center gap-10 px-4 md:px-8 lg:mb-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16"
            >
                <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{t("different.eyebrow")}</p>
                    <h2 id="home-different-title" className="max-w-xl font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl lg:text-6xl">
                        {t("different.title")}
                    </h2>
                    <p className="max-w-xl text-lg leading-8 text-ink-200">{t("different.body")}</p>
                    <Link href={HOW_IT_WORKS_HREF} className="mt-1 inline-flex items-center gap-2 text-base font-bold text-primary-200 transition-colors hover:text-white">
                        {t("different.link")} <span aria-hidden="true">→</span>
                    </Link>
                </div>
                <div className="rounded-[2rem] border border-line-200 bg-canvas-900/85 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] light:shadow-[0_20px_60px_rgba(12,26,17,0.08)] md:p-7">
                    <DisagreeStill example={disagree} />
                </div>
            </section>

            {/* Advice fatigue: why an animal that takes a side matters, and the article. */}
            <section aria-labelledby="home-fatigue-title" className="relative mx-auto mb-16 w-full max-w-[86rem] px-4 md:px-8 lg:mb-20">
                <div className="relative overflow-hidden rounded-[2rem] border border-primary-200/15 bg-[#071B0F] p-6 light:border-line-200 light:bg-surface-900 md:p-10 lg:p-14">
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary-200/40 to-transparent" />
                    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
                        <div className="flex min-w-0 flex-col gap-5">
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{t("fatigue.eyebrow")}</p>
                            <h2 id="home-fatigue-title" className="font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl">
                                {t("fatigue.title")}
                            </h2>
                            <p className="text-lg leading-8 text-ink-200">{t("fatigue.body")}</p>
                            <dl className="grid grid-cols-3 gap-3 border-y border-line-200 py-5 sm:gap-4">
                                {fatigueStats.map((stat) => (
                                    <div key={stat.label} className="flex min-w-0 flex-col gap-1.5">
                                        <dt className="order-2 text-xs leading-snug text-ink-300 sm:text-sm">{stat.label}</dt>
                                        <dd className="order-1 font-display text-3xl font-extrabold leading-none tracking-tight text-white sm:text-4xl">{stat.value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="-mt-2 text-xs text-ink-400">{t("fatigue.source")}</p>
                            <p className="text-lg font-semibold leading-8 text-white">{t("fatigue.line")}</p>
                            <div className="flex flex-wrap items-center justify-start gap-3">
                                <Link
                                    href={ADVICE_FATIGUE_HREF}
                                    className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-primary-400 px-6 text-base font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                                >
                                    {t("fatigue.cta")} <span aria-hidden="true">→</span>
                                </Link>
                            </div>
                        </div>
                        <TextDiagramPanel
                            title={paradox.title}
                            lines={drawGrid({headers: paradox.headers, widths: [13, 22, 26], rows: paradox.rows})}
                            label={paradox.label}
                            caption={paradox.caption}
                            equivalentLabel={paradox.tableLabel}
                            className="min-w-0"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                    <caption className="sr-only">{paradox.title}</caption>
                                    <thead>
                                        <tr className="border-b border-line-200 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300">
                                            <th scope="col" className="py-2 pr-4"><span className="sr-only">{paradox.aspectLabel}</span></th>
                                            <th scope="col" className="py-2 pr-4">{paradox.headers[1]}</th>
                                            <th scope="col" className="py-2">{paradox.headers[2]}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paradox.rows.map((row) => (
                                            <tr key={row[0]} className="border-b border-line-300 last:border-b-0 align-top">
                                                <th scope="row" className="py-2.5 pr-4 font-semibold text-white">{row[0]}</th>
                                                <td className="py-2.5 pr-4 text-ink-300">{row[1]}</td>
                                                <td className="py-2.5 text-ink-100">{row[2]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TextDiagramPanel>
                    </div>
                </div>
            </section>

            <Anchor id="features" className="top-12 lg:-top-48" />
            <section
                className="bg-canvas-950 text-white justify-between flex -mb-24 flex-col w-full-no-offset gap-8
                rounded-4xl p-4 pt-8 pb-6 sm:p-8 sm:pt-10 sm:pb-7 mx-offset md:o-16 mt-10
                lg:-mb-48 lg:flex-row lg:items-start lg:gap-6 lg:min-h-[36rem] lg:px-16 lg:pt-14 lg:pb-8 lg:rounded-6xl lg:mt-14 xl:-mb-56 xl:px-20"
            >
                <div className="flex flex-col gap-5 justify-center lg:justify-start lg:gap-6">
                    <h3 className="font-display text-5xl font-bold leading-[0.92] tracking-tight text-center lg:text-left lg:text-6xl lg:leading-[0.94] 2xl:text-8xl 2xl:leading-[0.95]">
                        {t("features.titleLead")}{" "}
                        <span className="whitespace-nowrap text-primary-200">
                            {t("features.titleAccentLine")} {t("features.titleAccentEnd")}
                        </span>
                    </h3>
                    <div className="flex w-full max-w-lg flex-col gap-2 text-center lg:text-left md:gap-2.5">
                        <p className="text-lg leading-snug text-ink-400 md:text-xl xl:text-2xl">
                            <span className="font-semibold text-white">{t("features.description")}</span>{" "}
                            {t("features.wisdomDescription")}
                        </p>
                        <p className="text-lg leading-snug text-ink-300 md:text-xl xl:text-2xl">
                            <span className="font-semibold text-white">{t("features.appliedInsightLead")}</span>{" "}
                            {t("features.appliedInsightBody")}
                        </p>
                        <div className="pt-1 text-center lg:text-left">
                            <HomeArchiveModule
                                line={t("archive.line")}
                                cta={t("archive.cta")}
                            />
                        </div>
                    </div>
                </div>

                <FeaturesOverview
                    features={[
                        ...features.map(({id, img}, index) => {
                            const capture = featureCaptures[index];

                            return {
                                name: t("features." + id),
                                content: capture ? (
                                    <div className="h-full w-full pt-2 lg:pt-3">
                                        <HomeFeatureCaptureCard capture={capture} locale={locale} />
                                    </div>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <Image
                                            src={localisePath(img.src, locale)}
                                            width={img.width}
                                            height={img.height}
                                            unoptimized={img.src.endsWith(".svg")}
                                            alt={t("features." + id)}
                                            className="max-h-full object-contain"
                                        />
                                    </div>
                                )
                            };
                        }),
                        {
                            name: t("features.more"),
                            content: (
                                <div className="flex h-full w-full flex-col items-center justify-start gap-6 pt-6 sm:pt-8 lg:gap-8 lg:pt-10">
                                    <Link
                                        href="/#more"
                                        aria-label={t("features.button")}
                                        className="w-32 h-32 aspect-square hover:bg-primary-400 flex-col hover:text-canvas-950
                                        rounded-full bg-surface-900 text-primary-500 flex justify-center items-center transition-colors
                                        active:bg-primary-400 active:text-canvas-950 duration-300 ease-in-out border border-primary-500/40"
                                    >
                                        <ArrowSquareDownIcon size={60} />
                                    </Link>
                                    <p className="text-ink-400 text-xl font-medium">{t("features.button")}</p>
                                </div>
                            )
                        },
                    ]}
                    className="flex min-h-[30rem] flex-col border border-line-400 light:border-line-200 bg-canvas-950 light:bg-surface-900 text-white sm:min-h-[34rem] lg:h-[40rem] lg:min-h-[40rem] lg:w-[40rem] xl:w-[44rem] rounded-3xl shadow-[0_30px_120px_rgba(0,0,0,0.35)]"
                    leftOffset={0}
                    showLabel={t("features.showLabel")}
                />
            </section>

            <Anchor id="more" />
            <section className="relative mb-16 w-full-no-offset overflow-hidden bg-[#071B0F] light:bg-canvas-900 mx-offset o-4 md:o-16">
                <div className="relative">
                    {moreFeatures.slice(0, 2).map(({id, icon}, i) => {
                        const iconMarkup = unsafelyLoadSVG(localisePath(icon, locale));
                        const reversed = i % 2 === 1;

                        return (
                            <div key={id}>
                                {i > 0 ? (
                                    <div
                                        aria-hidden="true"
                                        className="mx-auto flex max-w-[88rem] items-center px-4 sm:px-8 lg:px-20 xl:px-24"
                                    >
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#163322]/90 to-[#163322]/40 light:via-line-200 light:to-line-200/40" />
                                        <div className="mx-5 flex h-7 w-7 items-center justify-center text-primary-200/35">
                                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
                                                <path d="M8 11 3 6h10L8 11Z" />
                                            </svg>
                                        </div>
                                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#163322]/90 to-[#163322]/40 light:via-line-200 light:to-line-200/40" />
                                    </div>
                                ) : null}
                                <figure
                                    className={`mx-auto grid w-full max-w-[88rem] grid-cols-1 items-center gap-10 px-4 py-12 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-x-16 lg:px-20 lg:py-16 xl:gap-x-20 xl:px-24 ${
                                        reversed ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""
                                    }`}
                                >
                                    <div className="relative w-full min-w-0 lg:justify-self-stretch">
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.16)_0%,rgba(7,27,15,0)_70%)] blur-3xl" />
                                        {id === "theme" ? (
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
                                        ) : (
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
                                        )}
                                    </div>
                                    <figcaption className="flex min-w-0 flex-col justify-center gap-5 text-center lg:max-w-[22rem] lg:justify-self-start lg:gap-6 lg:text-left xl:max-w-[24rem]">
                                        {iconMarkup ? (
                                            <div className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-400 text-canvas-950 shadow-[0_0_24px_rgba(167,244,50,0.28)] lg:mx-0 [&_svg]:h-[1.15rem] [&_svg]:w-[1.15rem]">
                                                {iconMarkup}
                                            </div>
                                        ) : null}
                                        <h3 className="font-display text-[1.65rem] font-black uppercase leading-[1.02] tracking-[0.06em] text-white sm:text-[1.85rem] lg:text-[2rem] xl:text-[2.15rem]">
                                            {t(`more.${id}.headlineLead`)}{" "}
                                            <span className="text-primary-200">{t(`more.${id}.headlineAccent`)}</span>
                                        </h3>
                                        <div className="space-y-3">
                                            <p className="text-[1.45rem] font-medium leading-[1.25] text-white sm:text-[1.6rem] lg:text-[1.7rem]">
                                                {t(`more.${id}.line1`)}
                                            </p>
                                            <p className="text-base leading-relaxed text-ink-300 sm:text-[1.05rem]">
                                                {t(`more.${id}.line2`)}
                                            </p>
                                        </div>
                                    </figcaption>
                                </figure>
                            </div>
                        );
                    })}
                    <figure className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:px-8 lg:px-16 lg:pb-16">
                        <div className="relative overflow-hidden border border-white/[0.08] bg-[#0A2112]/90 light:bg-surface-900 px-5 py-5 text-center shadow-[0_22px_70px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.07)] md:px-7 md:py-6 lg:text-left">
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary-200 via-primary-500 to-transparent" />
                        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-primary-200/[0.10]" />
                        <div className="pointer-events-none absolute -right-8 top-8 h-24 w-24 rounded-full border border-primary-200/[0.12]" />
                        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary-200/[0.28] to-transparent" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-col gap-2.5">
                                <span className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">
                                    {t("more.download")}
                                </span>
                                <h3 className="font-display text-4xl font-bold leading-none text-white md:text-5xl lg:text-6xl">
                                    {t("more.title")}
                                </h3>
                                <p className="mx-auto max-w-xl text-base leading-7 text-ink-200 md:text-lg lg:mx-0">
                                    {t("more.description")}
                                </p>
                            </div>
                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[28rem]">
                                {downloadStoreLinks.map(({name}) => (
                                    <StoreLink
                                        key={name}
                                        store={name === "App Store" ? "app_store" : "google_play"}
                                        placement="home_more"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/store relative flex min-h-[4.75rem] items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-left text-white transition-[transform,border-color,background-color,color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary-200/55 hover:bg-primary-400 hover:text-canvas-950 hover:shadow-[0_18px_50px_rgba(167,244,50,0.16)]"
                                    >
                                        <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70 group-hover/store:via-canvas-950/20" />
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas-950 text-primary-100 transition-colors duration-300 group-hover/store:bg-canvas-950 group-hover/store:text-primary-200">
                                            {name === "App Store" ? (
                                                <svg aria-hidden="true" viewBox="0 0 32 32" className="h-6 w-6 fill-current">
                                                    <path d="M21.8 4.2c.1 1.4-.4 2.8-1.3 3.8-.9 1.1-2.4 1.9-3.8 1.8-.2-1.3.4-2.8 1.2-3.7.9-1.1 2.5-1.9 3.9-1.9Zm4.7 19.2c-.6 1.4-.9 2.1-1.7 3.3-1.1 1.7-2.7 3.8-4.7 3.8-1.8 0-2.2-1.1-4.6-1.1s-2.9 1.1-4.6 1.2c-2 0-3.5-1.9-4.7-3.6-3.2-4.9-3.6-10.6-1.6-13.7 1.4-2.2 3.6-3.4 5.7-3.4 2.1 0 3.5 1.2 5.3 1.2 1.7 0 2.8-1.2 5.3-1.2 1.9 0 3.9 1 5.3 2.8-4.7 2.6-3.9 9.3.3 10.7Z" />
                                                </svg>
                                            ) : (
                                                <svg aria-hidden="true" viewBox="0 0 42 42" className="h-6 w-6 fill-current">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M21.5435 24.9506C20.8295 24.234 19.6675 24.234 18.9547 24.9506C17.0825 26.8266 5.34416 38.5968 3.76343 40.1699C5.59743 42.1248 8.91926 42.5982 11.2471 41.1779L28.1031 31.5178C26.5478 29.9677 23.1204 26.5326 21.5435 24.9506Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M18.9544 17.1818C19.6684 17.8983 20.8291 17.8983 21.5431 17.1818L25.4797 13.2363L25.4759 13.2338L28.155 10.5572L11.3129 0.859026C8.93803 -0.627523 5.51693 -0.11843 3.67529 1.87466C5.21911 3.40958 17.114 15.3401 18.9544 17.1818Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M16.3722 22.3631C17.0874 21.6453 17.0874 20.4846 16.3722 19.7668L5.82886 9.19418L2.04249 5.4129C2.01576 5.63436 1.99667 5.8749 2.00049 6.10909L2.00303 35.9533C2.01194 36.2333 2.05267 36.5592 2.09594 36.8404C4.58922 34.3993 13.7656 25.0193 16.3722 22.3631Z" />
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M37.0414 15.6736L31.4388 12.4473C29.797 14.0764 25.8045 18.0906 24.127 19.7693C23.4105 20.4871 23.4105 21.6478 24.127 22.3657C25.8146 24.0457 29.7385 27.9988 31.3905 29.6368L36.9892 26.4295C41.2223 24.3295 41.2541 17.8105 37.0414 15.6736Z" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-display text-xl font-bold leading-none md:text-2xl">
                                                {name}
                                            </span>
                                        </span>
                                    </StoreLink>
                                ))}
                            </div>
                        </div>
                        </div>
                    </figure>
                </div>
            </section>

            <div
                className="overflow-hidden w-full my-8 md:my-16 flex flex-col justify-center h-96 sm:h-[32rem] md:h-[48rem]
                word-spacing-6 text-6xl sm:text-8xl md:text-9xl font-bold font-display"
            >
                <Marquee rotation={8} className="text-line-300" scrollBoost={0.25}>
                    {t("marquee")}
                </Marquee>
                <div className="h-4 md:h-12" />
                <Marquee rotation={8} baseVelocity={-1} className="text-white text-outline-line-300" scrollBoost={0.25}>
                    {t("marquee")}
                </Marquee>
            </div>

            <Anchor id="team" />
            {/* Three problems people bring (W2): each opens the picker with the question carried. */}
            <section aria-labelledby="home-problems-title" className="mb-32 flex w-full flex-col items-center gap-10 md:gap-12">
                <div className="flex max-w-4xl flex-col items-center gap-4 px-4 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">
                        {t("team.eyebrow")}
                    </p>
                    <h2 id="home-problems-title" className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.04em] text-white md:text-5xl lg:text-6xl">
                        {t("team.title")}
                    </h2>
                    <div className="max-w-2xl space-y-1 text-lg md:text-xl">
                        <p className="font-semibold text-white">{t("team.descriptionLead")}</p>
                        <p className="text-ink-300">{t("team.descriptionBody")}</p>
                    </div>
                </div>
                <ul className="grid w-full max-w-6xl grid-cols-1 gap-4 px-4 md:grid-cols-3 md:px-8">
                    {homeProblems.map((problem) => (
                        <li key={problem.id} className="flex">
                            <Link
                                href={`${TALK_HREF}?ask=${encodeURIComponent(t(`team.problems.${problem.id}.question`))}`}
                                className="group flex w-full flex-col gap-5 rounded-3xl border border-line-200 bg-surface-900/60 p-6 transition-[transform,border-color,background-color] duration-[240ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1 hover:border-primary-400/45 hover:bg-surface-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 md:p-7"
                            >
                                <span className="font-display text-2xl font-bold leading-tight text-white">{t(`team.problems.${problem.id}.title`)}</span>
                                <span className="flex-1 text-lg leading-8 text-ink-200">&ldquo;{t(`team.problems.${problem.id}.question`)}&rdquo;</span>
                                <span className="flex items-center justify-between gap-3">
                                    <span className="flex -space-x-2" role="img" aria-label={t("team.pairLabel")}>
                                        {problem.animals.map((slug) => (
                                            <span key={slug} className="relative h-10 w-10 overflow-hidden rounded-full border border-line-200 bg-canvas-950">
                                                <Image src={getSpeciesArtworkUrl(slug)} alt="" fill sizes="40px" className="object-contain p-1" />
                                            </span>
                                        ))}
                                    </span>
                                    <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-200 transition-colors group-hover:text-primary-100">
                                        {t("team.explore")} <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <p className="px-4 text-center text-sm text-ink-400">
                    {t("team.guidesPrompt")}{" "}
                    <Link href="/wildlife-guides" className="text-primary-200 underline underline-offset-4 hover:text-white">
                        {t("team.guidesLink")}
                    </Link>
                    {t("team.guidesTail")}
                </p>
            </section>

            <section className="w-full flex justify-center items-center px-5 md:px-8 mb-16">
                <FaqSection
                    title={t("faq.title")}
                    description={t("faq.description")}
                    trustItems={faqTrustItems}
                    items={faqItems}
                />
            </section>

            <Anchor id="download" className="md:-top-48" />
            <section className="relative w-full flex justify-center items-center flex-col px-5 md:px-8 gap-10 md:gap-14">
                <div className="relative w-full max-w-6xl">
                    <div className="pointer-events-none absolute inset-x-10 top-8 -z-10 h-56 rounded-full bg-primary-500/[0.18] blur-3xl motion-safe:animate-[ctaGlow_5s_ease-in-out_infinite]" />
                    <div
                        className="relative overflow-hidden rounded-[2rem] border border-primary-200/15 light:border-line-200 light:bg-none light:bg-surface-900 bg-[radial-gradient(circle_at_20%_0%,rgba(167,244,50,0.16),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(167,244,50,0.10),transparent_34%),linear-gradient(135deg,rgba(28,37,32,0.92),rgba(7,11,9,0.96))] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur md:p-8 lg:p-10 motion-safe:animate-[ctaRise_700ms_ease-out_both]"
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 1100 420"
                            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035]"
                            preserveAspectRatio="none"
                        >
                            <path d="M66 205C132 126 234 104 300 153C349 190 334 238 410 253C498 271 539 204 623 234C706 264 697 346 785 360C855 371 891 324 960 334C1017 342 1052 380 1082 413H30C20 330 28 251 66 205Z" fill="#FFFFFF" />
                            <path d="M731 64C791 26 865 33 912 78C949 113 945 158 990 183C1019 199 1054 196 1082 188V5H686C693 31 708 49 731 64Z" fill="#FFFFFF" />
                            <path d="M58 35C117 9 183 20 222 63C251 95 250 132 285 151C309 164 339 162 365 155V0H42C38 15 43 27 58 35Z" fill="#FFFFFF" />
                        </svg>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10),transparent_28%,transparent_70%,rgba(167,244,50,0.08))]" />
                        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
                            <div className="flex flex-col gap-6 text-center lg:text-left">
                                <div className="flex flex-col gap-4">
                                    <h2 className="font-display text-4xl font-bold leading-[0.96] text-white md:text-6xl lg:text-7xl">
                                        {t("download.title")}
                                    </h2>
                                    <p className="mx-auto max-w-2xl text-lg leading-8 text-ink-200 md:text-xl lg:mx-0">
                                        {t("download.description")}
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2.5 lg:justify-start">
                                    {downloadTrustItems.map((item, i) => (
                                        <span
                                            key={item}
                                            className="rounded-full border border-primary-200/[0.14] bg-white/[0.045] px-3.5 py-2 text-xs font-black uppercase tracking-[0.16em] text-ink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] motion-safe:animate-[ctaChip_560ms_ease-out_both]"
                                            style={{animationDelay: `${160 + i * 90}ms`}}
                                        >
                                            ✓ {item}
                                        </span>
                                    ))}
                                </div>
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
                                        className="group/store flex min-h-[5.25rem] items-center gap-4 rounded-2xl border border-white/10 bg-[#07100B]/88 light:bg-surface-800 px-5 py-4 text-left text-white shadow-[0_18px_60px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary-200/45 hover:bg-[#0D2A16] light:hover:bg-surface-700 hover:shadow-[0_22px_70px_rgba(33,192,94,0.12),inset_0_1px_0_rgba(255,255,255,0.10)]"
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.055] text-primary-100 transition-colors duration-300 group-hover/store:border-primary-200/30 group-hover/store:text-white">
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
                <div className="w-full max-w-6xl pt-10 md:pt-16">
                    <div className="mb-8 flex flex-col gap-4 text-center md:mb-12">
                        <h3 className="font-display text-5xl font-bold leading-none text-white md:text-6xl lg:text-7xl">
                            {t("explore.title")}
                        </h3>
                        <p className="mx-auto max-w-2xl text-lg leading-8 text-ink-200 md:text-xl">
                            {t("explore.description")}
                        </p>
                    </div>
                    <div className="grid auto-rows-[17rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[16.5rem]">
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
                                    className={`group relative flex overflow-hidden rounded-3xl bg-surface-900 text-white shadow-[0_22px_80px_rgba(0,0,0,0.18)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_30px_100px_rgba(0,0,0,0.32)] ${cardClassName}`}
                                >
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={t(`explore.cards.${item.id}.alt`)}
                                            fill
                                            sizes={isFeatured ? "(min-width: 1024px) 50vw, 100vw" : isWide ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"}
                                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-canvas-950 via-canvas-950/58 to-canvas-950/4 light:bg-[linear-gradient(to_top,rgb(var(--c-canvas-950))_0%,rgb(var(--c-canvas-950)/0.92)_40%,rgb(var(--c-canvas-950)/0.6)_68%,rgb(var(--c-canvas-950)/0.1)_100%)] transition-opacity duration-500 group-hover:opacity-95" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(167,244,50,0.22),transparent_34%)] opacity-60 light:opacity-0 transition-opacity duration-500 group-hover:opacity-90" />
                                    <div className={`relative mt-auto flex w-full flex-col ${isFeatured ? "gap-5 p-6 md:p-8" : "gap-3 p-5 md:p-6"}`}>
                                        <span className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">
                                            {t(`explore.cards.${item.id}.eyebrow`)}
                                        </span>
                                        <div className="flex flex-col gap-2">
                                            <h4 className={`font-display font-bold leading-[0.98] ${isFeatured ? "text-4xl md:text-5xl lg:text-6xl" : "text-2xl md:text-3xl"}`}>
                                                {t(`explore.cards.${item.id}.title`)}
                                            </h4>
                                            <p className={`max-w-xl leading-7 text-ink-200 ${isFeatured ? "text-lg md:text-xl" : "text-base"}`}>
                                                {t(`explore.cards.${item.id}.description`)}
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-200 transition-colors group-hover:text-primary-100 md:text-base">
                                            {t(`explore.cards.${item.id}.cta`)}
                                            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                                        </span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>
        </>
        );
    } finally {
        finishDevRequestTimer(timer, {locale});
    }
}
