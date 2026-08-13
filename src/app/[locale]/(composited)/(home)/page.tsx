import {getLocale, getTranslations} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import IconCanvas from "@/app/[locale]/_components/icon-canvas";
import Image from "next/image";
import DragSlider from "@/app/[locale]/_components/drag-slider";
import TeamMember from "@/app/[locale]/(composited)/(home)/_components/team-member";
import FeaturesOverview from "@/app/[locale]/(composited)/(home)/_components/features-overview";
import FaqSection from "@/app/[locale]/(composited)/(home)/_components/faq-section";
import Phone from "@/app/[locale]/(composited)/(home)/_components/phone";
import {checkedIcons} from "@/loaders/icons";
import Marquee from "@/app/[locale]/_components/marquee";
import {default as phone} from "@/data/phone.json";
import {default as features} from "@/data/features.json";
import {default as moreFeatures} from "@/data/more.json";
import {default as splashes} from "@/data/splashes.json";
import {default as team} from "@/data/team.json";
import {default as downloads} from "@/data/downloads.json";
import {localisePath} from "@/loaders/path";
import {unsafelyLoadSVG} from "@/loaders/svg";
import Anchor from "@/app/[locale]/(composited)/_components/anchor";
import {getAbsoluteUrl, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl, storeLinks} from "@/lib/store-links";
import {ArrowSquareDownIcon} from "@/app/[locale]/_components/icons";
import {socialProfileUrlList} from "@/lib/social-links";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

const animalBackgroundImages = [
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/mantis-shrimp.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/mountain-tapir.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/pekin-duck.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/red-kite.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/rex-rabbit.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/zander.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/thorny-devil.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/tibetan-fox.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/samoyed.webp",
    "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/swamp-harrier.webp"
];

const statRevalidateSeconds = 60 * 30;

type DownloadStatCounts = {
    captures: number | null;
    users: number | null;
    lessons: number | null;
};

function parseContentRangeCount(contentRange: string | null) {
    if (!contentRange) {
        return null;
    }

    const rangeParts = contentRange.split("/");
    const countValue = rangeParts[rangeParts.length - 1];
    if (!countValue || countValue === "*") {
        return null;
    }

    const count = Number.parseInt(countValue, 10);
    return Number.isFinite(count) ? count : null;
}

async function fetchTableCount(table: string, selectColumn: string) {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();

    if (!supabaseUrl || !key) {
        return null;
    }

    const searchParams = new URLSearchParams({select: selectColumn});

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${searchParams.toString()}`, {
            headers: getSupabaseHeaders(key, {
                Prefer: "count=exact",
                Range: "0-0",
                "Range-Unit": "items"
            }),
            next: {revalidate: statRevalidateSeconds}
        });

        if (!response.ok) {
            return null;
        }

        return parseContentRangeCount(response.headers.get("content-range"));
    } catch {
        return null;
    }
}

async function getDownloadStatCounts(): Promise<DownloadStatCounts> {
    const [captures, users, lessons] = await Promise.all([
        fetchTableCount("captures", "id"),
        fetchTableCount("profiles", "id"),
        fetchTableCount("species_behavior_principles", "species_profile_id")
    ]);

    return {captures, users, lessons};
}

export default async function Home() {
    const t = await getTranslations('home');
    const locale = await getLocale();
    const siteUrl = getAbsoluteUrl(locale);
    const rootSiteUrl = getSiteUrl();
    const brandLogoUrl = new URL("/images/logo.webp", rootSiteUrl).toString();
    const socialImageUrl = new URL("/images/og.png", rootSiteUrl).toString();
    const appSchemaDescription = "Discover what animals can teach you. Every encounter is a chance to learn how they succeed.";
    const faqItems = ["identify", "family", "game", "respect"].map((id) => ({
        question: t(`faq.${id}.q`),
        answer: t(`faq.${id}.a`)
    }));
    const faqTrustItems = ["beginner", "families", "behavior"].map((id) => t(`faq.trust.${id}`));
    const downloadStatCounts = await getDownloadStatCounts();
    const downloadTrustItems = [
        downloadStatCounts.captures === null
            ? t("download.trust.scanner")
            : t("download.stats.captures", {count: downloadStatCounts.captures.toLocaleString(locale)}),
        downloadStatCounts.users === null
            ? t("download.trust.collect")
            : t("download.stats.users", {count: downloadStatCounts.users.toLocaleString(locale)}),
        downloadStatCounts.lessons === null
            ? t("download.trust.learn")
            : t("download.stats.lessons", {count: downloadStatCounts.lessons.toLocaleString(locale)})
    ];
    const downloadStoreLinks = downloads.filter(({name}) => name === "App Store" || name === "Google Play");
    const keepExploringCards = [
        {
            id: "tigerLion",
            href: "/comparisons/tiger-vs-lion",
            image: "/images/blog/tiger-symbolism/tiger-symbolism-hero.webp",
            layout: "featured"
        },
        {
            id: "wolfLessons",
            href: "/animal-lessons/wolf",
            image: "/images/blog/wolf-symbolism/wolf-symbolism-hero.webp",
            layout: "medium"
        },
        {
            id: "owlSymbolism",
            href: "/animal-symbolism/owl-symbolism",
            image: "/images/blog/owl-symbolism/owl-symbolism-hero.webp",
            layout: "medium"
        },
        {
            id: "scannerGuide",
            href: "/best-animal-identification-app",
            image: "/images/blog/what-animal-am-i/wild-profile-hero.webp",
            layout: "small"
        },
        {
            id: "rareAnimals",
            href: "/rankings/rarest-animals",
            image: "/images/blog/black-rhinoceros-symbolism/black-rhinoceros-symbolism-hero.webp",
            layout: "small"
        },
        {
            id: "lionProfile",
            href: "/animals/lion",
            image: "/images/blog/lion-symbolism/lion-symbolism-hero.webp",
            layout: "small"
        },
        {
            id: "octopusMind",
            href: "/animal-symbolism/octopus-symbolism",
            image: "/images/blog/octopus-symbolism/octopus-symbolism-hero.webp",
            layout: "wide"
        }
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
            {"@type": "Audience", "audienceType": "Competitive players"},
            {"@type": "Audience", "audienceType": "Breeders and breed researchers"},
            {"@type": "Audience", "audienceType": "Animal card creators"},
            {"@type": "Audience", "audienceType": "Self-improvement learners"}
        ],
        featureList: [
            "AI animal scanning and analysis",
            "Animal identification and field-guide context",
            "Breed identification, grading, and pricing context",
            "Collectible wildlife cards and journals",
            "Custom animal card decks for pets, wildlife, and creator projects",
            "Albums, sets, missions, and progression",
            "Discovery feed for real animal sightings",
            "Challenge, battle, and trading loops",
            "Family-friendly animal learning",
            "Animal-inspired reflection and self-improvement prompts",
            "Respectful wildlife observation and habitat curiosity"
        ],
        about: [
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
            <IconCanvas
                probability={0.02}
                paths={checkedIcons}
                imageSources={animalBackgroundImages}
                color="#1BC451"
                height={2000}
            />

            <section className="w-full flex justify-center items-center flex-col gap-4 mt-48 md:mt-72 mb-16 px-4" id="top">
                <Image
                    src="/images/animaldex-logo-text.webp"
                    alt={t("title")}
                    width={520}
                    height={124}
                    priority
                    className="w-full max-w-[20rem] md:max-w-[26rem] lg:max-w-[32rem] h-auto"
                />
                <p className="text-xl md:text-2xl text-ink-200 w-full md:w-[34rem] text-center">{t("description")}</p>
                <div className="mt-3 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
                    {downloadStoreLinks.map(({name, href}) => (
                        <a
                            key={name}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/store relative flex min-h-[4.9rem] flex-1 items-center gap-3 overflow-hidden rounded-[1.45rem] border border-primary-200/25 bg-primary-400 px-5 py-4 text-left text-canvas-950 shadow-[0_18px_50px_rgba(49,255,79,0.18),inset_0_1px_0_rgba(255,255,255,0.38)] transition-[transform,box-shadow,background-color,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary-100 hover:bg-primary-300 hover:shadow-[0_26px_74px_rgba(49,255,79,0.26),inset_0_1px_0_rgba(255,255,255,0.45)]"
                        >
                            <span className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-canvas-950 text-primary-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
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
                                <span className="block font-display text-2xl font-bold leading-none">
                                    {name}
                                </span>
                            </span>
                            <span className="text-2xl transition-transform duration-300 group-hover/store:translate-x-1">
                                →
                            </span>
                        </a>
                    ))}
                </div>
                <div className="flex w-full max-w-3xl flex-wrap justify-center gap-2.5 pt-1">
                    {downloadTrustItems.map((item) => (
                        <span
                            key={item}
                            className="rounded-full border border-primary-200/[0.18] bg-surface-900/55 px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-ink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur"
                        >
                            ✓ {item}
                        </span>
                    ))}
                </div>
                <Phone
                    data={
                        phone.elements.map((item) => ({
                            ...item,
                            src: localisePath(item.src),
                            alt: t('phone.' + item.id)
                        }))
                    }
                    phone={{
                        src: localisePath(phone.phone),
                        alt: t('phone.phone'),
                        width: phone.phoneWidth,
                        height: phone.phoneHeight
                    }}
                />
            </section>
            <Anchor id="features" className="top-12 lg:-top-48" />
            <section
                className="bg-canvas-950 text-white justify-between flex lg:px-24 lg:py-36 lg:gap-4 mb-16 flex-col w-full-no-offset
                lg:flex-row rounded-4xl lg:rounded-6xl lg:h-[28rem] mt-64 sm:p-12 sm:pt-16 gap-12 p-4 pt-12 mx-offset md:o-16"
            >
                <div className="flex flex-col gap-4 justify-center">
                    <h3 className="font-bold font-display text-5xl lg:text-6xl 2xl:text-8xl text-center lg:text-left">
                        {t("features.title")}
                    </h3>
                    <p className="text-lg md:text-xl xl:text-2xl w-full lg:max-w-lg text-center lg:text-left text-ink-200">
                        {t("features.description")}
                    </p>
                    <p className="text-base md:text-lg w-full lg:max-w-lg text-center lg:text-left text-ink-300">
                        {t("features.wisdomDescription")}
                    </p>
                    <p className="text-sm md:text-base w-full lg:max-w-lg text-center lg:text-left text-ink-400">
                        {t("features.appliedInsight")}
                    </p>
                </div>

                <FeaturesOverview
                    features={[
                        ...features.map(({id, img}) => ({
                            name: t("features." + id),
                            content: (
                                <div className="flex items-end justify-center w-full h-full">
                                    <Image
                                        src={localisePath(img.src)}
                                        width={img.width} height={img.height} alt={t("features." + id)}
                                        className="object-contain max-h-full"
                                    />
                                </div>
                            )
                        })),
                        {
                            name: t("features.more"),
                            content: (
                                <div className="flex flex-col items-center gap-8 justify-center w-full h-full">
                                    <Link
                                        href="/#more"
                                        role="button"
                                        className="w-32 h-32 aspect-square hover:bg-primary-500 flex-col hover:text-canvas-950
                                        rounded-full bg-canvas-950 text-primary-500 flex justify-center items-center transition-colors
                                        active:bg-primary-400 active:text-canvas-950 duration-300 ease-in-out border border-primary-500/40"
                                    >
                                        <ArrowSquareDownIcon size={60} />
                                    </Link>
                                    <p className="text-ink-400 text-xl font-medium">{t("features.button")}</p>
                                </div>
                            )
                        },
                    ]}
                    className="lg:w-[32rem] h-fit md:h-[36rem] lg:-translate-y-96 rounded-3xl bg-primary-100 text-canvas-950 shadow-[0_30px_120px_rgba(27,196,81,0.16)]"
                    leftOffset={24}
                />
            </section>

            <Anchor id="more" />
            <section
                className="flex justify-center items-center flex-col gap-24 mb-16 border-2 py-12 px-4 md:px-12 lg:p-20
                border-line-300 rounded-4xl md:rounded-6xl bg-surface-900/80 backdrop-blur md:o-16 o-4 mx-offset w-full-no-offset"
            >
                {moreFeatures.map(({img, id, icon}, i) => {
                    const iconMarkup = unsafelyLoadSVG(localisePath(icon))
                    return (
                        <figure
                            className={"flex w-full justify-between gap-8 md:gap-24 items-center flex-col-reverse " +
                                (i % 2 ? 'md:flex-row-reverse' : 'md:flex-row')}
                            key={i}
                        >
                            <Image
                                src={localisePath(img.src)}
                                alt={t("more." + id + ".alt")}
                                width={img.width}
                                height={img.height}
                                quality={100}
                                className="w-full md:w-5/12 h-auto"
                            />
                            <figcaption
                                className="flex flex-col justify-center gap-1 text-center md:text-left md:w-7/12 h-fit">
                                {iconMarkup && (
                                    <div
                                        className="flex justify-center p-4 rounded-full bg-primary-500 text-canvas-950 w-min
                                        h-min items-center mx-auto md:mx-0 mb-4"
                                    >
                                        {iconMarkup}
                                    </div>
                                )}
                                <h3 className="font-bold font-display text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl text-white">
                                    {t("more." + id + ".title")}
                                </h3>
                                <p className="text-ink-200 text-lg md:text-xl xl:text-2xl mt-4 md:mt-6">
                                    {t("more." + id + ".description")}
                                </p>
                            </figcaption>
                        </figure>
                    )
                })}
                <figure className="w-full max-w-5xl">
                    <div className="relative overflow-hidden border border-white/[0.08] bg-[#080D0A]/95 px-5 py-5 text-center shadow-[0_22px_70px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.07)] md:px-7 md:py-6 lg:text-left">
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
                                {downloadStoreLinks.map(({name, href}) => (
                                    <a
                                        key={name}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/store relative flex min-h-[4.75rem] items-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-left text-white transition-[transform,border-color,background-color,color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary-200/55 hover:bg-primary-400 hover:text-canvas-950 hover:shadow-[0_18px_50px_rgba(49,255,79,0.16)]"
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
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </figure>
            </section>

            <div
                className="overflow-hidden w-full my-8 md:my-16 flex flex-col justify-center h-96 sm:h-[32rem] md:h-[48rem]
                word-spacing-6 text-6xl sm:text-8xl md:text-9xl font-bold font-display"
            >
                <Marquee rotation={8} className="text-line-300" scrollBoost={0.25}>
                    {splashes.join(" ")}
                </Marquee>
                <div className="h-4 md:h-12" />
                <Marquee rotation={8} baseVelocity={-1} className="text-white text-outline-line-300" scrollBoost={0.25}>
                    {splashes.join(" ")}
                </Marquee>
            </div>

            <Anchor id="team" />
            <section className="w-full flex justify-center items-center flex-col gap-16 mb-32">
                <h2 className="font-display font-bold text-5xl lg:text-7xl text-center text-white">{t("team.title")}</h2>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 w-full max-w-4xl text-center px-4">
                    {t("team.description")}
                </p>
                <DragSlider>
                    {
                        team.map(({img, roles, ...member}, i) => (
                            <TeamMember
                                key={i}
                                buttonText={t("team.contact")}
                                img={localisePath(img)}
                                role={roles.map(role => t(`team.roles.${role}`)).join(', ')}
                                {...member}
                            />
                        ))
                    }
                </DragSlider>
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
                        className="relative overflow-hidden rounded-[2rem] border border-primary-200/15 bg-[radial-gradient(circle_at_20%_0%,rgba(131,255,174,0.16),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(49,255,79,0.10),transparent_34%),linear-gradient(135deg,rgba(28,37,32,0.92),rgba(7,11,9,0.96))] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur md:p-8 lg:p-10 motion-safe:animate-[ctaRise_700ms_ease-out_both]"
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 1100 420"
                            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035]"
                            preserveAspectRatio="none"
                        >
                            <path d="M66 205C132 126 234 104 300 153C349 190 334 238 410 253C498 271 539 204 623 234C706 264 697 346 785 360C855 371 891 324 960 334C1017 342 1052 380 1082 413H30C20 330 28 251 66 205Z" fill="#F4FFF5" />
                            <path d="M731 64C791 26 865 33 912 78C949 113 945 158 990 183C1019 199 1054 196 1082 188V5H686C693 31 708 49 731 64Z" fill="#F4FFF5" />
                            <path d="M58 35C117 9 183 20 222 63C251 95 250 132 285 151C309 164 339 162 365 155V0H42C38 15 43 27 58 35Z" fill="#F4FFF5" />
                        </svg>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10),transparent_28%,transparent_70%,rgba(49,255,79,0.08))]" />
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
                                {downloadStoreLinks.map(({name, href}) => (
                                    <a
                                        key={name}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/store flex min-h-[5.25rem] items-center gap-4 rounded-[1.45rem] border border-white/10 bg-[#090D0B]/88 px-5 py-4 text-left text-white shadow-[0_18px_60px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary-200/45 hover:bg-[#0D1510] hover:shadow-[0_22px_70px_rgba(27,196,81,0.12),inset_0_1px_0_rgba(255,255,255,0.10)]"
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
                                    </a>
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
                    <div className="grid auto-rows-[17rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[15rem]">
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
                                    <Image
                                        src={item.image}
                                        alt={t(`explore.cards.${item.id}.alt`)}
                                        fill
                                        unoptimized={item.image.startsWith("http")}
                                        sizes={isFeatured ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"}
                                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-canvas-950 via-canvas-950/58 to-canvas-950/4 transition-opacity duration-500 group-hover:opacity-95" />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(131,255,174,0.22),transparent_34%)] opacity-60 transition-opacity duration-500 group-hover:opacity-90" />
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
    )
}
