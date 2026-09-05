import type {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {EarnGhostCta, EarnPrimaryCta} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import {EarnFaqList, EarnKicker, EarnPageShell, EarnStatusPill} from "@/app/[locale]/(composited)/_components/earn/earn-page-shell";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {buildEarnPageMetadata, earnBreadcrumbList, earnFaqSchema} from "@/lib/earn-page-metadata";
import {
    blogHrefs,
    earnFacts,
    earnPaths,
    earnProductPageMeta,
    earnStatus,
    guideCategories,
    supportArticleHrefs
} from "@/data/earn-economy";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";

const path = earnPaths.becomeGuide;

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    return buildEarnPageMetadata({
        locale,
        path,
        title: earnProductPageMeta.becomeGuide.title,
        description: earnProductPageMeta.becomeGuide.description,
        keywords: [
            "become wildlife guide",
            "wildlife guiding app",
            "birding guide marketplace",
            "local nature guide",
            "AnimalDex Wildlife Guide"
        ]
    });
}

const faqs = [
    {
        question: "If I hit 45 captures, am I a Guide?",
        answer: "No. Meeting 45 qualifying wild captures, 20 wild species, and a 30-day account unlocks the application. A person reviews every application. Approval can be withdrawn."
    },
    {
        question: "Does AnimalDex pay me for bookings?",
        answer: "No. The collector pays you in cash on the day. AnimalDex does not collect or process that cash. When you mark the outing complete, seller net is recorded on Earnings."
    },
    {
        question: "Is this the same as a Bali wildlife guide article?",
        answer: "No. Location pages such as a Bali wildlife guide are field-guide articles about animals you can see there. This page is the AnimalDex Wildlife Guide marketplace: people who lead bookable local experiences."
    }
];

export default async function BecomeAWildlifeGuidePage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const session = await getAuthenticatedAppContext();
    const setupHref = getLocalePath(locale, "/app/guides");
    const primaryHref = session ? setupHref : earnPaths.download;
    const primaryLabel = session ? "Set up Wildlife Guides" : "Become eligible to apply";
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: earnProductPageMeta.becomeGuide.title,
            description: earnProductPageMeta.becomeGuide.description,
            url: getAbsoluteUrl(locale, path)
        },
        earnBreadcrumbList(locale, [
            {name: "Home", path: "/"},
            {name: "Ways to earn", path: earnPaths.earn},
            {name: "Become a Wildlife Guide", path}
        ]),
        earnFaqSchema(locale, path, "Become an AnimalDex Wildlife Guide", faqs)
    ];

    return (
        <EarnPageShell schema={schema}>
            <header className="flex max-w-4xl flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                    <EarnKicker>AnimalDex Wildlife Guides</EarnKicker>
                    <EarnStatusPill>{earnStatus.guides}</EarnStatusPill>
                </div>
                <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-[0.02em] text-white md:text-7xl">
                    Know your local wildlife?
                    <span className="block text-primary-200">Guide someone through it.</span>
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ink-200">
                    An AnimalDex Wildlife Guide is a person who lists a real-money local experience — birding, herping, macro, coast, or night wildlife — and meets collectors in the field. Sightings are never guaranteed.
                </p>
            </header>

            <section aria-labelledby="qualify" className="grid gap-8 md:grid-cols-[14rem_1fr] md:items-start">
                <h2 id="qualify" className="font-display text-2xl font-black uppercase tracking-[0.06em] text-primary-200">
                    Meeting the requirements lets you apply
                </h2>
                <div>
                    <p className="mb-8 max-w-2xl text-ink-300">
                        These numbers unlock the application. They do not approve you automatically.
                    </p>
                    <ol className="grid gap-6 sm:grid-cols-3">
                        <Gate n={String(earnFacts.wildCaptures)} label="Qualifying wild captures" />
                        <Gate n={String(earnFacts.wildSpecies)} label="Canonical wild species" />
                        <Gate n={`${earnFacts.accountAgeDays}d`} label="Account age before you apply" />
                    </ol>
                    <p className="mt-6 text-sm text-ink-400">
                        You also attest that you are 18+, accept the current Guide Seller Terms, and pass a human review. You are responsible for local permits, licences, and insurance.
                    </p>
                </div>
            </section>

            <section aria-labelledby="categories" className="flex flex-col gap-8">
                <h2 id="categories" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    What you can list
                </h2>
                <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
                    {guideCategories.map((category) => (
                        <div key={category.id} className="border-l border-primary-200/25 pl-4">
                            <h3 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white">
                                {category.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-300">{category.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section aria-labelledby="money" className="grid gap-10 lg:grid-cols-2">
                <div>
                    <h2 id="money" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                        How money actually moves
                    </h2>
                    <ol className="mt-8 space-y-5 text-ink-200">
                        {[
                            "You publish an approved listing with a real-money price per person. Credits are never used.",
                            "A collector sends a booking request for a date and group size.",
                            "You accept. Exact meeting details stay private until then.",
                            "The collector pays you in cash on the day. AnimalDex does not handle that payment.",
                            "You mark the outing complete. Seller net is recorded on Earnings."
                        ].map((step, index) => (
                            <li key={step} className="flex gap-4">
                                <span className="font-display text-2xl font-black text-primary-200">{index + 1}</span>
                                <span className="pt-1">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="flex flex-col justify-between gap-8 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                    <div>
                        <h3 className="font-display text-2xl font-bold uppercase tracking-[0.04em] text-white">
                            What makes a good Guide
                        </h3>
                        <ul className="mt-5 space-y-3 text-ink-300">
                            {[
                                "Local knowledge of public paths and seasons",
                                "Ethical wildlife behaviour — no baiting, luring, calling in, or handling",
                                "Realistic expectations. Wildlife sightings cannot be promised",
                                "A honest public area, duration, group size, and price",
                                "Permits and insurance your place actually requires"
                            ].map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-sm text-ink-400">
                        See what collectors can already book on{" "}
                        <Link href={earnPaths.wildlifeExperiences} className="text-primary-200 hover:text-white">
                            Wildlife Experiences
                        </Link>
                        {" "}or the{" "}
                        <Link href={earnPaths.wildlifeGuidesMarketplace} className="text-primary-200 hover:text-white">
                            Wildlife Guides marketplace
                        </Link>
                        . Those pages are for booking. This page is for becoming a seller.
                    </p>
                </div>
            </section>

            <section aria-labelledby="guide-faq">
                <h2 id="guide-faq" className="mb-6 font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Questions before you apply
                </h2>
                <EarnFaqList items={faqs} />
            </section>

            <section className="flex flex-col gap-5 border-t border-white/[0.07] pt-10">
                <h2 className="font-display text-2xl font-bold uppercase text-white">Build your wild collection</h2>
                <p className="max-w-2xl text-ink-300">
                    {session
                        ? "You are signed in. Open Guide setup to check eligibility, apply, publish listings, and manage booking requests on the web."
                        : "Eligibility is earned in the app with live wild captures. Open AnimalDex, keep collecting honestly, then apply when the numbers unlock."}
                </p>
                <div className="flex flex-wrap gap-3">
                    <EarnPrimaryCta href={primaryHref} event="guide_cta_clicked" label={session ? "web_setup" : "download"}>
                        {primaryLabel}
                    </EarnPrimaryCta>
                    <EarnGhostCta href={supportArticleHrefs.becomeGuide} event="guide_cta_clicked" label="support_become_guide">
                        Read the Guide help article
                    </EarnGhostCta>
                </div>
                <p className="text-sm text-ink-400">
                    <Link href={blogHrefs.ethicalGuide} className="text-primary-200 hover:text-white">
                        What makes a great ethical Wildlife Guide
                    </Link>
                    {" · "}
                    <Link href={blogHrefs.guidingSideIncome} className="text-primary-200 hover:text-white">
                        Turn local knowledge into a guiding side income
                    </Link>
                    {" · "}
                    <Link href={earnPaths.earn} className="text-primary-200 hover:text-white">
                        All ways to earn
                    </Link>
                </p>
            </section>
        </EarnPageShell>
    );
}

function Gate({n, label}: {n: string; label: string}) {
    return (
        <div>
            <p className="font-display text-6xl font-black leading-none text-white">{n}</p>
            <p className="mt-2 text-sm uppercase tracking-[0.12em] text-ink-400">{label}</p>
        </div>
    );
}
