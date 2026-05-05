import {getLocale, getTranslations} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import IconCanvas from "@/app/[locale]/_components/icon-canvas";
import Image from "next/image";
import DragSlider from "@/app/[locale]/_components/drag-slider";
import DownloadButton from "@/app/[locale]/(composited)/(home)/_components/download-button";
import TeamMember from "@/app/[locale]/(composited)/(home)/_components/team-member";
import FeaturesOverview from "@/app/[locale]/(composited)/(home)/_components/features-overview";
import Phone from "@/app/[locale]/(composited)/(home)/_components/phone";
import {checkedIcons} from "@/loaders/icons";
import Button from "@/app/[locale]/_components/button";
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
import {getAbsoluteUrl} from "@/lib/site";
import {ArrowSquareDownIcon} from "@/app/[locale]/_components/icons";

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

export default async function Home() {
    const t = await getTranslations('home');
    const locale = await getLocale();
    const siteUrl = getAbsoluteUrl(locale);
    const appStoreUrl = "https://apps.apple.com/app/6761607780";
    const brandLogoUrl = new URL("/images/logo.webp", siteUrl).toString();
    const socialImageUrl = new URL("/images/og.png", siteUrl).toString();
    const faqItems = ["identify", "family", "game", "respect"].map((id) => ({
        question: t(`faq.${id}.q`),
        answer: t(`faq.${id}.a`)
    }));
    const exploreLinks = [
        {
            href: "/journal",
            title: t("download.journalLink"),
            description: t("download.journalPrompt"),
            accent: "from-primary-500/18 via-primary-500/6 to-transparent"
        },
        {
            href: "/blog",
            title: t("download.blogLink"),
            description: t("download.blogPrompt"),
            accent: "from-primary-400/14 via-primary-400/6 to-transparent"
        },
        {
            href: "/best-animal-identification-app",
            title: t("download.answersLink"),
            description: t("download.answersPrompt"),
            accent: "from-line-300/20 via-line-300/6 to-transparent"
        },
        {
            href: "/animal-breed-price-estimator",
            title: t("download.breedPricingLink"),
            description: t("download.breedPricingPrompt"),
            accent: "from-primary-500/16 via-line-300/8 to-transparent"
        },
        {
            href: "/custom-animal-card-deck",
            title: t("download.customDeckLink"),
            description: t("download.customDeckPrompt"),
            accent: "from-primary-400/16 via-primary-500/8 to-transparent"
        },
        {
            href: "/learn-from-animals",
            title: t("download.learnAnimalsLink"),
            description: t("download.learnAnimalsPrompt"),
            accent: "from-line-300/18 via-primary-300/6 to-transparent"
        },
        {
            href: "/animal-wisdom",
            title: t("download.animalWisdomLink"),
            description: t("download.animalWisdomPrompt"),
            accent: "from-primary-500/12 via-primary-300/6 to-transparent"
        },
        {
            href: "/use-cases",
            title: t("download.useCasesLink"),
            description: t("download.useCasesPrompt"),
            accent: "from-primary-300/12 via-primary-300/6 to-transparent"
        },
        {
            href: "/animals",
            title: t("download.animalsLink"),
            description: t("download.animalsPrompt"),
            accent: "from-primary-500/14 via-primary-500/6 to-transparent"
        }
    ];
    const webSiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AnimalDex",
        url: siteUrl,
        image: socialImageUrl,
        description: t("supporting"),
        inLanguage: locale,
        publisher: {
            "@type": "Organization",
            name: "AnimalDex",
            url: siteUrl,
            logo: brandLogoUrl
        },
        potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/journal`,
            "query-input": "required name=search_term_string"
        }
    };
    const mobileAppSchema = {
        "@context": "https://schema.org",
        "@type": "MobileApplication",
        name: "AnimalDex",
        operatingSystem: "iOS",
        applicationCategory: "EducationalApplication",
        url: appStoreUrl,
        installUrl: appStoreUrl,
        downloadUrl: appStoreUrl,
        image: socialImageUrl,
        screenshot: socialImageUrl,
        description: t("description"),
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
        applicationCategory: "EducationalApplication",
        operatingSystem: "iOS",
        url: appStoreUrl,
        installUrl: appStoreUrl,
        downloadUrl: appStoreUrl,
        image: socialImageUrl,
        description: t("description"),
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
        url: siteUrl,
        logo: brandLogoUrl,
        image: brandLogoUrl,
        sameAs: [appStoreUrl]
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
                <p className="text-base md:text-lg text-ink-300 w-full max-w-3xl text-center">
                    {t("supporting")}
                </p>
                <Link
                    href="https://apps.apple.com/app/6761607780"
                    className="md:hidden"
                >
                    <Button as="span">
                        {t('more.download')}
                    </Button>
                </Link>
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
                {moreFeatures.map(({img, id, note, icon}, i) => {
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
                                {note &&
                                    <p className="text-ink-400 text-lg">
                                        {t("more." + id + ".note")}
                                    </p>
                                }
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
                <figure className="flex flex-col gap-4 lg:gap-6 items-center">
                    <h3 className="font-bold font-display text-4xl lg:text-7xl text-center text-white">
                        {t("more.title")}
                    </h3>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200 w-full max-w-lg text-center">
                        {t("more.description")}
                    </p>
                    <Link
                        href="https://apps.apple.com/app/6761607780"
                    >
                        <Button as="span">
                            {t('more.download')}
                        </Button>
                    </Link>
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

            <Anchor id="download" className="md:-top-48" />
            <section className="w-full flex justify-center items-center flex-col px-5 md:px-8 gap-8 md:gap-16">
                <h2 className="font-display font-bold text-5xl lg:text-7xl text-center text-white">{t("download.title")}</h2>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-3xl text-center">
                    {t("download.description")}
                </p>
                <div className="flex flex-row flex-wrap gap-8 justify-center w-full">
                    {
                        downloads.map(({name, icon, eyebrowId, unavailable, href}, i) => (
                            <DownloadButton
                                key={i}
                                name={name}
                                icon={unsafelyLoadSVG(localisePath(icon))}
                                eyebrow={t("download." + eyebrowId)}
                                {...(unavailable ? {disabled: true} : {href})}
                            />
                        ))
                    }
                </div>
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {exploreLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group relative overflow-hidden rounded-3xl border border-line-300/90 bg-surface-900/85
                            backdrop-blur px-5 py-5 md:px-6 md:py-6 flex flex-col gap-4 min-h-[12rem] hover:border-primary-500/60
                            transition-colors"
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} opacity-100`} />
                            <div className="relative flex flex-col gap-4 h-full">
                                <span className="text-primary-200 text-xs uppercase tracking-[0.18em] font-medium">
                                    Explore
                                </span>
                                <div className="flex flex-col gap-3">
                                    <h3 className="font-display font-bold text-2xl text-white leading-tight">
                                        {item.title}
                                    </h3>
                                    <p className="text-ink-200 text-base leading-7">
                                        {item.description}
                                    </p>
                                </div>
                                <span className="mt-auto text-primary-200 group-hover:text-primary-100 transition-colors font-medium">
                                    Open
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
                <div className="w-full max-w-4xl rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h3 className="font-display font-bold text-3xl md:text-4xl text-white text-center">{t("faq.title")}</h3>
                    <p className="text-ink-200 text-lg md:text-xl text-center">{t("faq.description")}</p>
                    <div className="flex flex-col gap-4 mt-2">
                        {faqItems.map((item) => (
                            <article
                                key={item.question}
                                className="rounded-2xl border border-line-300/80 bg-surface-800/60 px-4 py-4 md:px-6 md:py-5"
                            >
                                <h4 className="text-white text-xl font-semibold">{item.question}</h4>
                                <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
    )
}
