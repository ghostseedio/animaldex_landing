import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import IconCanvas from "@/app/[locale]/_components/icon-canvas";
import Image from "next/image";
import HomeChatStill from "@/app/[locale]/(composited)/(home)/_components/home-chat-still";
import {HomeDoneStill, HomeRevealStill} from "@/app/[locale]/(composited)/(home)/_components/home-stills";
import HomeAnimalOrbit, {type HomeOrbitAnimal} from "@/app/[locale]/(composited)/(home)/_components/home-animal-orbit";
import HomeAnimalWall, {type HomeWallAnimal} from "@/app/[locale]/(composited)/(home)/_components/home-animal-wall";
import HomeSides from "@/app/[locale]/(composited)/(home)/_components/home-sides";
import {checkedIcons} from "@/loaders/icons";
import {animalSilhouetteImages} from "@/data/animal-silhouettes";
import {default as downloads} from "@/data/downloads.json";
import {formatAnimalCount} from "@/lib/animal-count";
import Anchor from "@/app/[locale]/(composited)/_components/anchor";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl, storeLinks} from "@/lib/store-links";
import StoreLink from "@/components/store/store-link";
import {socialProfileUrlList} from "@/lib/social-links";
import {localeConfig} from "@/i18n";
import {loadLocaleMessages} from "@/loaders/locale";
import {getScopedTranslator} from "@/loaders/translation";
import {createDevRequestTimer, finishDevRequestTimer, timeDevStep} from "@/lib/dev-request-timing";
import {getHomeDownloadStatCounts} from "@/lib/home-download-stats";
import {getRecentPublicCaptures} from "@/data/discover-timeline";
import {getTalkPickerRows, type TalkPickerRows} from "@/data/talk-animals";
import {TRY_TALKING_SPECIES} from "@/lib/try-talking";
import {ADVICE_FATIGUE_HREF, HOW_IT_WORKS_HREF, TALK_HREF} from "@/data/public-navigation";
import {getDisagreeExample} from "@/data/animal-perspective";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {discoverPostPath} from "@/lib/discover-post";

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

/** The wall's tiles, with its last "all animals" tile: full rows at 3, 4 and 6 columns. */
const WALL_ROW_SETS = [24, 12] as const;

/**
 * The Talk picker's own faces, the featured and most talked to first, then
 * the disagreeing pairs; one tile each, only animals with art.
 */
function wallAnimals(rows: TalkPickerRows): HomeWallAnimal[] {
    const seen = new Set<string>();
    const animals: HomeWallAnimal[] = [];
    for (const animal of [...rows.popular, ...rows.disagree.flatMap((pair) => [pair.left, pair.right])]) {
        if (!animal.icon || seen.has(animal.slug)) continue;
        seen.add(animal.slug);
        animals.push({slug: animal.slug, name: animal.name, power: animal.power, image: animal.icon});
    }
    const tiles = WALL_ROW_SETS.find((count) => animals.length >= count - 1);
    return tiles ? animals.slice(0, tiles - 1) : animals;
}

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
            images: [{url: "/images/og-every-animal-has-a-lesson.png", width: 1200, height: 630, alt: fullTitle}]
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
    const socialImageUrl = new URL("/images/og-every-animal-has-a-lesson.png", rootSiteUrl).toString();
    const animalCount = formatAnimalCount(locale);
    const appSchemaDescription = `Talk to real animals with AI. Each of ${formatAnimalCount("en")} species answers from its own Power, a lesson from how its kind survives, takes a side on your problem and keeps it. Bring a real problem, hear a real side, and take one step. Photograph the animals you meet to collect them, and let them debate your problems.`;
    const disagree = getDisagreeExample(locale, getSpeciesArtworkUrl);
    const [downloadStatCounts, recentCaptures, talkRows] = await timeDevStep(
        timer,
        "home.data",
        () => Promise.all([
            getHomeDownloadStatCounts(),
            getRecentPublicCaptures(8, {imageVariant: "card-thumbnail"}),
            getTalkPickerRows().catch((): TalkPickerRows => ({popular: [], disagree: []}))
        ])
    );
    const wall = wallAnimals(talkRows);
    const catalogNames = new Map(wall.map((animal) => [animal.slug, animal.name]));
    const orbitCenter: HomeOrbitAnimal = {slug: TRY_TALKING_SPECIES.slug, name: t("chatStill.animal"), image: TRY_TALKING_SPECIES.image};
    const orbitAnimals: HomeOrbitAnimal[] = heroOrbitAnimals.map(({slug, name}) => ({
        slug,
        name: catalogNames.get(slug) ?? name,
        image: getSpeciesArtworkUrl(slug)
    }));
    // Full rows of photos at 2 and 4 columns, or none at all.
    const captures = recentCaptures.slice(0, recentCaptures.length - (recentCaptures.length % 4));
    // One label set for the same three numbers, here and in the download band
    // (WEB-28), and the one honest animal count every page quotes (WEB-29).
    const downloadHeroStats = [
        {value: downloadStatCounts.captures === null ? null : downloadStatCounts.captures.toLocaleString(locale), label: t("download.stats.capturesLabel")},
        {value: downloadStatCounts.users === null ? null : downloadStatCounts.users.toLocaleString(locale), label: t("download.stats.usersLabel")},
        {value: animalCount, label: t("download.stats.indexesLabel")}
    ];
    const downloadStoreLinks = downloads.filter(({name}) => name === "App Store" || name === "Google Play");
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
    const sectionTitle = "font-display text-4xl font-black uppercase leading-[0.94] tracking-[0.03em] text-white md:text-5xl lg:text-6xl";

        return (
        <>
            {/* No FAQPage: the questions left the page (2026-11-01), and the markup has to match what is shown. */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify([organizationSchema, webSiteSchema, softwareAppSchema, mobileAppSchema])}}
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
                    </div>
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
                    <HomeAnimalOrbit center={orbitCenter} animals={orbitAnimals} bubble={t("heroBubble")} label={t("orbitLabel")} />
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
            {/* Pick one (2026-11-01): the faces people talk to most, each opening its chat. */}
            <section aria-labelledby="home-wall-title" className="relative mx-auto mb-20 flex w-full max-w-[86rem] flex-col gap-8 px-4 md:px-8 lg:mb-28">
                <h2 id="home-wall-title" className={`${sectionTitle} text-center`}>{t("wall.title")}</h2>
                <HomeAnimalWall animals={wall} allLabel={t("wall.all", {count: animalCount})} />
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

            {/* Real photos, from the people who took them. */}
            {captures.length > 0 ? (
                <section aria-labelledby="home-captures-title" className="relative mx-auto mb-20 flex w-full max-w-[86rem] flex-col gap-8 px-4 md:px-8 lg:mb-28">
                    <h2 id="home-captures-title" className={`${sectionTitle} text-center`}>{t("captures.title")}</h2>
                    <ul className="grid grid-cols-2 gap-1 md:grid-cols-4">
                        {captures.map((capture) => (
                            <li key={capture.id}>
                                <Link href={discoverPostPath(capture.id)} className="theme-dark group relative block aspect-square overflow-hidden bg-white/5">
                                    <img
                                        src={capture.imageSrc}
                                        alt={capture.animalName}
                                        width={640}
                                        height={640}
                                        loading="lazy"
                                        decoding="async"
                                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
                                    />
                                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                                    <span className="absolute inset-x-0 bottom-0 truncate p-3 font-display text-base font-bold text-white md:p-4 md:text-xl">{capture.animalName}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

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
                                <div className="flex justify-center lg:justify-start">
                                    {downloadHeroStats.map((item, index) => (
                                        <div key={item.label} className={`flex min-w-0 flex-col gap-1.5 px-4 sm:px-6 ${index > 0 ? "border-l border-white/20" : "pl-0 sm:pl-0"}`}>
                                            <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-primary-200 sm:text-4xl">
                                                {item.value === null ? "—" : item.value}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-200 sm:text-[11px]">{item.label}</span>
                                        </div>
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
