import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";

type AnimalWisdomPageProps = {
    params: {
        locale: string;
    };
};

const pageTitle = "Animal Wisdom";
const pageDescription = "Animal Wisdom explains how AnimalDex uses real animal behavior, Species Subtitles, and optional Applied Insight to support learning, curiosity, and practical self-improvement.";
const updatedAt = "2026-04-24";
const faq = [
    {
        question: "What is Animal Wisdom in AnimalDex?",
        answer: "Animal Wisdom is a supporting learning layer that turns real animal behavior into practical strategies such as patience, timing, teamwork, focus, and adaptability."
    },
    {
        question: "What are Species Subtitles?",
        answer: "Species Subtitles are short, memorable interpretations of an animal's role, behavior, or strategy so users can understand each card more quickly."
    },
    {
        question: "What is Applied Insight?",
        answer: "Applied Insight is an optional Pro feature that helps users privately connect animal strategies to their own current goals."
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
            "Applied Insight",
            "Species Subtitles",
            "learn from animals",
            "animal behavior strategies",
            "animal self-improvement"
        ],
        alternates: {
            canonical: getLocalePath(locale, "/animal-wisdom"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/animal-wisdom`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/animal-wisdom`
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
            {"@type": "Thing", name: "Species Subtitles"},
            {"@type": "Thing", name: "Applied Insight"}
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
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([articleSchema, faqSchema])}} />

            <div className="flex flex-col gap-4">
                <Link href="/" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    Back to AnimalDex
                </Link>
                <p className="text-primary-200 text-sm uppercase tracking-[0.14em]">Learning layer</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{pageTitle}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200">{pageDescription}</p>
            </div>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">A supporting layer, not a repositioning</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    AnimalDex is still an AI animal scanner and collectible real-animal card app first. Animal Wisdom adds a concise learning layer for people who want each animal card to carry practical meaning.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    The goal is simple: learn practical strategies from real animal behavior, from patience and timing to teamwork, focus, and adaptability.
                </p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                    <h2 className="text-white text-2xl font-semibold">Animal Wisdom</h2>
                    <p className="text-ink-200 text-base md:text-lg">A practical interpretation layer that connects animal behavior to memorable strategies for learning and reflection.</p>
                </div>
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                    <h2 className="text-white text-2xl font-semibold">Species Subtitles</h2>
                    <p className="text-ink-200 text-base md:text-lg">Short subtitles that make each species easier to remember by summarizing its role, behavior, or standout strategy.</p>
                </div>
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3">
                    <h2 className="text-white text-2xl font-semibold">Applied Insight</h2>
                    <p className="text-ink-200 text-base md:text-lg">An optional Pro feature that privately connects animal strategies to a user&apos;s current goals without changing the core scanner and collection experience.</p>
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Grounded in real behavior</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Animal Wisdom should stay tied to observable biology: how animals move, survive, cooperate, signal, adapt, rest, hunt, hide, and protect energy. It should not turn animals into vague motivational symbols.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    That keeps the layer useful for curiosity, family learning, collection memory, and optional self-improvement while preserving the product&apos;s main promise.
                </p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">FAQ</h2>
                {faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                        <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                        <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                    </div>
                ))}
            </section>
        </article>
    );
}
