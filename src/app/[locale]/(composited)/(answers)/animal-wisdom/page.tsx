import {Metadata} from "next";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import StoreLinks from "@/app/[locale]/(composited)/_components/store-links";
import {blogPosts} from "@/data/blog";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

type AnimalWisdomPageProps = {
    params: {
        locale: string;
    };
};

const pageTitle = "Animal Wisdom";
const pageDescription = "Explore what animals mean, what they teach, and what real behavior reveals about survival, instinct, emotion, intelligence, and adaptation.";
const updatedAt = "2026-06-28";
const heroAnimals = [
    {slug: "barn-owl", name: "Owl", principle: "Precision"},
    {slug: "wolf", name: "Wolf", principle: "Cooperation"},
    {slug: "elephant", name: "Elephant", principle: "Memory"}
];
const starterAnimals = [
    {slug: "barn-owl", name: "Owl", lesson: "Precision and deep listening"},
    {slug: "wolf", name: "Wolf", lesson: "Cooperation and social intelligence"},
    {slug: "elephant", name: "Elephant", lesson: "Memory and social knowledge"},
    {slug: "great-white-shark", name: "Shark", lesson: "Momentum and sensory awareness"},
    {slug: "harbor-seal", name: "Seal", lesson: "Rhythm, rest, and awareness"},
    {slug: "crow", name: "Crow", lesson: "Problem-solving and adaptation"}
];
const wisdomPaths = [
    {
        number: "01",
        label: "Meanings",
        title: "Animal Symbolism",
        description: "Explore animal meanings across culture, dreams, stories, and spiritual traditions, with interpretation clearly separated from biological fact.",
        href: "/animal-symbolism",
        cta: "Explore animal symbolism",
        examples: [
            {label: "Wolf symbolism", href: "/blog/wolf-symbolism"},
            {label: "Owl symbolism", href: "/blog/owl-symbolism"}
        ]
    },
    {
        number: "02",
        label: "Lessons",
        title: "Lessons from Animals",
        description: "Learn what observable behavior can teach about courage, attention, timing, cooperation, resilience, and emotional growth.",
        href: "/animal-lessons",
        cta: "Browse animal lessons",
        examples: [
            {label: "Seal lesson", href: "/animal-lessons/harbor-seal"},
            {label: "Elephant lesson", href: "/animal-lessons/elephant"}
        ]
    },
    {
        number: "03",
        label: "Abilities",
        title: "Animal Abilities",
        description: "Browse abilities expressed through real animal behavior, from precision and observation to cooperation, memory, and adaptation.",
        href: "/powers",
        cta: "Explore animal abilities",
        examples: [
            {label: "Precision", href: "/powers/precision"},
            {label: "Observation", href: "/powers/observation"}
        ]
    }
];
const latestWisdomPosts = blogPosts
    .filter((post) => post.tags.some((tag) => /symbolism|animal behavior|animal intelligence/i.test(tag)))
    .slice(0, 3);
const featuredEssay = blogPosts.find((post) => post.slug === "what-if-every-animal-is-a-lesson");
const faq = [
    {
        question: "What is Animal Wisdom in AnimalDex?",
        answer: "Animal Wisdom is AnimalDex's home for animal symbolism, lessons from real behavior, and animal powers such as patience, timing, teamwork, focus, and adaptability."
    },
    {
        question: "Are Animal Wisdom lessons based on real behavior?",
        answer: "Yes. AnimalDex connects interpretation to observable biology, ecology, and repeatable behavior rather than presenting metaphor as scientific fact."
    },
    {
        question: "What is the difference between symbolism, lessons, and powers?",
        answer: "Symbolism explores cultural and interpretive meaning, lessons turn behavior into practical takeaways, and powers group animals by strengths expressed through recurring behavior in nature."
    },
    {
        question: "Does Animal Wisdom replace the animal scanner or card collection?",
        answer: "No. Animal Wisdom is separate supporting context. AnimalDex remains an AI animal scanner and collectible real-animal card app first."
    }
];

export async function generateMetadata({params}: AnimalWisdomPageProps): Promise<Metadata> {
    const {locale} = params;

    return {
        title: `${pageTitle} | AnimalDex`,
        description: pageDescription,
        keywords: [
            "Animal Wisdom",
            "animal symbolism",
            "lessons from animals",
            "animal powers",
            "learn from animals",
            "animal behavior strategies",
            "animal self-improvement"
        ],
        alternates: {
            canonical: getLocalePath(locale, "/animal-wisdom"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/animal-wisdom");
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, "/animal-wisdom")
            } as Record<string, string>)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${pageTitle} | AnimalDex`,
            description: pageDescription,
            url: getLocalePath(locale, "/animal-wisdom"),
            modifiedTime: updatedAt,
            images: [
                {
                    url: "/images/og.png",
                    width: 1200,
                    height: 630,
                    alt: `${pageTitle} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${pageTitle} | AnimalDex`,
            description: pageDescription,
            images: ["/images/og.png"]
        }
    };
}

export default function AnimalWisdomPage({params}: AnimalWisdomPageProps) {
    const pageUrl = getAbsoluteUrl(params.locale, "/animal-wisdom");
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: pageTitle,
        description: pageDescription,
        dateModified: updatedAt,
        inLanguage: params.locale,
        url: pageUrl,
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"},
        about: [
            {"@type": "Thing", name: "Animal Wisdom"},
            {"@type": "Thing", name: "Animal behavior"},
            {"@type": "Thing", name: "Animal symbolism"},
            {"@type": "Thing", name: "Lessons from animals"},
            {"@type": "Thing", name: "Animal powers"}
        ]
    };
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    };

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-20 md:gap-28">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema])}} />

            <section className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] items-center gap-12 lg:gap-20 min-h-[34rem]">
                <div className="flex flex-col items-start gap-6">
                    <Link href="/" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                        Back to AnimalDex
                    </Link>
                    <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">Meaning grounded in nature</p>
                    <h1 className="font-display font-bold text-6xl md:text-7xl xl:text-8xl text-white tracking-tight">{pageTitle}</h1>
                    <p className="text-xl md:text-2xl xl:text-[1.75rem] xl:leading-10 text-ink-100 max-w-3xl">
                        Animals aren&apos;t just something to identify or collect. Every species has evolved its own way of surviving, adapting and succeeding.
                    </p>
                    <p className="text-base md:text-lg text-ink-300 max-w-2xl">
                        AnimalDex helps you discover what those strategies can teach us — through abilities, behavior, lessons, and cultural symbolism, with interpretation kept distinct from biological fact.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
                        <Link href="#wisdom-paths" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-primary-400 px-7 font-bold text-canvas-950 hover:bg-primary-300 transition-colors">
                            Explore Wisdom
                        </Link>
                        <Link href="/#download" className="flex min-h-[3.5rem] items-center justify-center rounded-2xl border border-line-200 px-7 font-bold text-white hover:border-primary-400 hover:text-primary-100 transition-colors">
                            Get AnimalDex
                        </Link>
                    </div>
                </div>

                <div className="relative mx-auto grid w-full max-w-xl grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-1" aria-label="Animal Wisdom examples">
                    <div className="absolute inset-12 rounded-full bg-primary-500/15 blur-3xl" aria-hidden="true" />
                    {heroAnimals.map((animal, index) => (
                        <Link
                            key={animal.slug}
                            href={`/animals/${animal.slug}`}
                            className={`group relative overflow-hidden rounded-3xl bg-surface-800 shadow-2xl lg:w-[82%] ${index === 1 ? "lg:ml-auto" : ""}`}
                        >
                            <SpeciesImage
                                slug={animal.slug}
                                alt={`${animal.name}, representing ${animal.principle} in Animal Wisdom`}
                                priority={index === 0}
                                sizes="(min-width: 1024px) 34vw, 30vw"
                                className="aspect-[3/4] lg:aspect-[16/5] transition-transform duration-500 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 lg:p-5">
                                <p className="text-white text-base sm:text-xl font-bold">{animal.name}</p>
                                <p className="text-primary-200 text-xs sm:text-sm font-semibold uppercase tracking-[0.14em]">{animal.principle}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="-mx-4 md:-mx-8 bg-gradient-to-r from-primary-500/15 via-primary-500/8 to-transparent px-6 py-12 md:px-12 md:py-16">
                <div className="max-w-5xl flex flex-col gap-6">
                    <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">More than identification</p>
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">More than an animal name</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 text-lg md:text-xl leading-8 text-ink-200">
                        <p>AnimalDex begins with identification: what species is this, where does it live, and how does it behave?</p>
                        <p>Animal Wisdom goes deeper, connecting real behavior with the meanings and lessons people recognize in nature without confusing metaphor with scientific fact.</p>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary-100">
                        <span>Biology first</span>
                        <span>Symbolism clearly marked</span>
                        <span>Lessons grounded in behavior</span>
                    </div>
                </div>
            </section>

            {featuredEssay ? (
                <section className="grid grid-cols-1 overflow-hidden rounded-[2.5rem] bg-[#efe8d7] text-[#182019] lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="relative min-h-[22rem] lg:min-h-[34rem]">
                        <Image
                            src={featuredEssay.featuredImage.src}
                            alt={featuredEssay.featuredImage.alt}
                            fill
                            sizes="(min-width: 1024px) 44vw, 100vw"
                            className="object-cover"
                        />
                    </div>
                    <div className="flex flex-col justify-center gap-6 p-7 md:p-12 lg:p-16">
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#745d2d]">Featured essay</p>
                        <h2 className="font-display text-4xl font-bold leading-tight md:text-5xl">{featuredEssay.title}</h2>
                        <p className="text-lg leading-8 text-[#465044] md:text-xl">{featuredEssay.description}</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-3">
                            <Link href={`/blog/${featuredEssay.slug}`} className="font-bold text-[#245d34] transition-colors hover:text-[#173e23]">
                                Read the essay →
                            </Link>
                            {featuredEssay.originalPublicationUrl ? (
                                <a
                                    href={featuredEssay.originalPublicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-[#745d2d] underline underline-offset-4 hover:text-[#4e3e1e]"
                                >
                                    Read on Substack
                                </a>
                            ) : null}
                        </div>
                    </div>
                </section>
            ) : null}

            <section id="wisdom-paths" className="scroll-mt-32 flex flex-col gap-10">
                <div className="max-w-3xl flex flex-col gap-3">
                    <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">Choose a path</p>
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Three ways to explore</h2>
                    <p className="text-ink-200 text-lg md:text-xl">Move between cultural meaning, practical lessons, and recurring patterns across species.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                    {wisdomPaths.map((path) => (
                        <article key={path.href} className="flex flex-col gap-5 border-t-2 border-primary-500/60 pt-6">
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.18em]">{path.label}</p>
                                <span className="font-display text-3xl text-ink-400">{path.number}</span>
                            </div>
                            <h3 className="font-display text-3xl font-bold text-white">{path.title}</h3>
                            <p className="text-ink-200 text-lg leading-8">{path.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {path.examples.map((example) => (
                                    <Link key={example.href} href={example.href} className="rounded-full bg-surface-800/70 px-3 py-1.5 text-sm text-ink-200 hover:text-primary-100 transition-colors">
                                        {example.label}
                                    </Link>
                                ))}
                            </div>
                            <Link href={path.href} className="mt-auto pt-3 text-primary-200 font-bold hover:text-primary-100 transition-colors">
                                {path.cta} →
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-10">
                <div className="max-w-3xl flex flex-col gap-3">
                    <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">Begin anywhere</p>
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Start with an animal</h2>
                    <p className="text-ink-200 text-lg md:text-xl">Every animal profile begins with biology, then opens into behavior, meaning, and related lessons.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {starterAnimals.map((animal) => (
                        <Link key={animal.slug} href={`/animals/${animal.slug}`} className="group flex flex-col overflow-hidden rounded-3xl bg-surface-800/50">
                            <SpeciesImage
                                slug={animal.slug}
                                alt={`${animal.name}: ${animal.lesson}`}
                                sizes="(min-width: 768px) 28vw, 45vw"
                                className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="flex flex-col gap-1 p-4 md:p-5">
                                <h3 className="text-xl md:text-2xl font-bold text-white">{animal.name}</h3>
                                <p className="text-sm md:text-base text-ink-300">{animal.lesson}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-[2.5rem] bg-[#e5f3df] text-[#122016]">
                <SpeciesImage
                    slug="harbor-seal"
                    alt="Harbor seal resting between periods of coastal foraging"
                    sizes="(min-width: 1024px) 44vw, 100vw"
                    className="min-h-[22rem] lg:min-h-[34rem]"
                />
                <div className="flex flex-col justify-center gap-6 p-7 md:p-12 lg:p-16">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#347344]">Featured lesson</p>
                    <h2 className="font-display text-4xl md:text-5xl font-bold">The Harbor Seal: rhythm before intensity</h2>
                    <p className="text-lg md:text-xl leading-8 text-[#304437]">
                        Harbor seals alternate between resting on shore and precise foraging in coastal water. Their rhythm suggests a practical lesson: awareness includes knowing when conditions call for movement and when recovery is part of the work.
                    </p>
                    <Link href="/animal-lessons/harbor-seal" className="font-bold text-[#245d34] hover:text-[#173e23] transition-colors w-fit">
                        Read the Harbor Seal lesson →
                    </Link>
                </div>
            </section>

            <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-500/25 via-surface-800 to-violet-500/15 px-7 py-12 md:px-12 lg:px-16 lg:py-16">
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-10 items-center">
                    <div className="flex flex-col gap-5">
                        <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">From reading to discovery</p>
                        <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Turn animal wisdom into a real-world collection</h2>
                        <p className="text-ink-100 text-lg md:text-xl leading-8">
                            Scan animals, collect species, unlock profiles, and learn from the living world around you—at zoos, on nature walks, with pets, or wherever discovery happens.
                        </p>
                        <Link href="/#more" className="text-primary-200 font-bold hover:text-primary-100 transition-colors w-fit">
                            See how AnimalDex works →
                        </Link>
                    </div>
                    <StoreLinks className="lg:!mt-0" />
                </div>
            </section>

            {latestWisdomPosts.length > 0 && (
                <section className="flex flex-col gap-10">
                    <div className="max-w-3xl flex flex-col gap-3">
                        <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">Continue reading</p>
                        <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Latest from Animal Wisdom</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                        {latestWisdomPosts.map((post) => (
                            <article key={post.slug} className="flex flex-col gap-4">
                                <Link href={`/blog/${post.slug}`} className="relative overflow-hidden rounded-3xl bg-surface-800">
                                    <Image
                                        src={post.featuredImage.src}
                                        alt={post.featuredImage.alt}
                                        width={post.featuredImage.width}
                                        height={post.featuredImage.height}
                                        sizes="(min-width: 768px) 30vw, 100vw"
                                        className="aspect-[16/10] h-auto w-full object-cover hover:scale-[1.02] transition-transform duration-500"
                                    />
                                </Link>
                                <h3 className="font-display text-2xl font-bold text-white">{post.title}</h3>
                                <p className="text-ink-300 line-clamp-3">{post.description}</p>
                                <Link href={`/blog/${post.slug}`} className="text-primary-200 font-semibold hover:text-primary-100 transition-colors mt-auto">
                                    Read article →
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <section className="border-t border-line-300 pt-12 flex flex-col gap-8 max-w-5xl">
                <div className="flex flex-col gap-3">
                    <p className="text-primary-200 text-sm font-semibold uppercase tracking-[0.2em]">Questions, answered</p>
                    <h2 className="font-display font-bold text-4xl md:text-5xl text-white">About Animal Wisdom</h2>
                </div>
                <div className="divide-y divide-line-300">
                    {faq.map((item) => (
                        <details key={item.question} className="group py-6">
                            <summary className="cursor-pointer list-none flex items-center justify-between gap-6 text-xl md:text-2xl font-semibold text-white">
                                {item.question}
                                <span className="text-primary-200 text-3xl font-light transition-transform group-open:rotate-45">+</span>
                            </summary>
                            <p className="text-ink-200 text-base md:text-lg leading-8 mt-4 max-w-4xl">{item.answer}</p>
                        </details>
                    ))}
                </div>
            </section>
        </article>
    );
}
