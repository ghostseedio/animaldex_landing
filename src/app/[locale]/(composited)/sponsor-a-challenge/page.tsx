import type {Metadata} from "next";
import {getLocale} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import {EarnGhostCta, EarnPrimaryCta} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import {EarnFaqList, EarnKicker, EarnPageShell, EarnStatusPill} from "@/app/[locale]/(composited)/_components/earn/earn-page-shell";
import {
    blogHrefs,
    challengeObjectives,
    earnPaths,
    earnProductPageMeta,
    earnStatus,
    sponsorAudiences,
    sponsorMailto,
    supportArticleHrefs
} from "@/data/earn-economy";
import {buildEarnPageMetadata, earnBreadcrumbList, earnFaqSchema} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl} from "@/lib/site";

const path = earnPaths.sponsor;

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    return buildEarnPageMetadata({
        locale,
        path,
        title: earnProductPageMeta.sponsor.title,
        description: earnProductPageMeta.sponsor.description,
        keywords: [
            "sponsor wildlife challenge",
            "wildlife app sponsorship",
            "zoo marketing campaign",
            "aquarium marketing campaign",
            "tourism wildlife campaign",
            "sponsored animal challenge"
        ]
    });
}

const faqs = [
    {
        question: "Is this a sweepstake or prize draw?",
        answer: "No. Collectors join free. There is no paid entry, no random winner, and no prize pool. Completion follows published objectives."
    },
    {
        question: "Can we launch a Challenge from a dashboard today?",
        answer: "Not yet. There is no self-serve sponsor portal. AnimalDex configures the Challenge with you after an enquiry."
    },
    {
        question: "Do people win cash today?",
        answer: "Achievement rewards are available today. Deterministic cash rewards may exist later. They are not live and should not be promised to visitors."
    }
];

const steps = [
    {title: "Tell us the goal", detail: "A zoo launch, an exhibition, a destination season, or a conservation week — what should people actually do?"},
    {title: "Define place, dates, and objective", detail: "Venue or radius, start and end, and whether the goal is unique animals, capture count, or active days."},
    {title: "AnimalDex configures the Challenge", detail: "Rules, eligibility, and presentation are set with the team. You do not publish this yourself yet."},
    {title: "Collectors participate free", detail: "They join in AnimalDex, capture under the rules, and can earn the achievement when they finish."},
    {title: "Review what happened", detail: "We can discuss participation after the window. We do not claim a live sponsor analytics suite that is not in product."}
];

export default async function SponsorAChallengePage() {
    const locale = await getLocale();
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: earnProductPageMeta.sponsor.title,
            description: earnProductPageMeta.sponsor.description,
            url: getAbsoluteUrl(locale, path)
        },
        earnBreadcrumbList(locale, [
            {name: "Home", path: "/"},
            {name: "Sponsor a Challenge", path}
        ]),
        earnFaqSchema(locale, path, "Sponsor an AnimalDex Challenge", faqs)
    ];

    return (
        <EarnPageShell schema={schema}>
            <header className="flex max-w-4xl flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                    <EarnKicker>Sponsored Challenges</EarnKicker>
                    <EarnStatusPill>{earnStatus.sponsoredChallenges}</EarnStatusPill>
                </div>
                <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-[0.02em] text-white md:text-7xl">
                    Sponsor a Challenge.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ink-200">
                    Turn real-world wildlife discovery into a branded experience people can actually take part in. Businesses can sponsor free-to-join AnimalDex Challenges.
                </p>
                <p className="text-sm uppercase tracking-[0.14em] text-ink-400">
                    {earnStatus.challengeAchievements}. {earnStatus.challengeCash}.
                </p>
            </header>

            <section aria-labelledby="what-is" className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                    <h2 id="what-is" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                        What an AnimalDex Challenge is
                    </h2>
                    <p className="mt-5 max-w-xl text-ink-300">
                        In the app, a Sponsored Challenge is a time-boxed campaign. Collectors join at no cost, follow published rules, and complete an objective. Apple is not a sponsor of these Challenges.
                    </p>
                    <p className="mt-4 max-w-xl text-sm text-ink-400">
                        This is not the public website’s animal-versus-animal comparison pages, and it is not Arena PvP with Credit stakes.
                    </p>
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Possible objectives</h3>
                    <ul className="mt-5 space-y-5">
                        {challengeObjectives.map((objective) => (
                            <li key={objective.id}>
                                <p className="font-display text-xl font-bold uppercase text-white">{objective.title}</p>
                                <p className="mt-1 text-sm text-ink-300">{objective.detail}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-6 text-sm text-ink-400">
                        A campaign can also require live camera captures, block imports, set a minimum Grade, lock to a species type or setting, or bind to a venue and discovery radius.
                    </p>
                </div>
            </section>

            <section aria-labelledby="who">
                <h2 id="who" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Who is this for?
                </h2>
                <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {sponsorAudiences.map((audience) => (
                        <div key={audience.title}>
                            <h3 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-primary-200">
                                {audience.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-300">{audience.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section aria-labelledby="how">
                <h2 id="how" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    How it works
                </h2>
                <ol className="mt-8 space-y-6">
                    {steps.map((step, index) => (
                        <li key={step.title} className="grid gap-3 border-l border-primary-200/30 pl-5 md:grid-cols-[14rem_1fr] md:border-l-0 md:pl-0">
                            <p className="font-display text-xl font-bold uppercase text-white">
                                <span className="mr-3 text-primary-200">{index + 1}</span>
                                {step.title}
                            </p>
                            <p className="text-ink-300">{step.detail}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section aria-labelledby="sponsor-faq">
                <h2 id="sponsor-faq" className="mb-6 font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Before you enquire
                </h2>
                <EarnFaqList items={faqs} />
            </section>

            <section className="flex flex-col gap-5 border-t border-white/[0.07] pt-10">
                <h2 className="font-display text-2xl font-bold uppercase text-white">Talk to us about a Challenge</h2>
                <p className="max-w-2xl text-ink-300">
                    Send the organisation name, campaign purpose, venue or region, dates, intended objective, and whether you want an achievement, a later cash conversation, or both. We reply from the same contact route used for partnerships.
                </p>
                <div className="flex flex-wrap gap-3">
                    <EarnPrimaryCta href={sponsorMailto} event="sponsor_cta_clicked" label="mailto" external>
                        Sponsor a Challenge
                    </EarnPrimaryCta>
                    <EarnGhostCta href={`${earnPaths.contact}#sponsors`} event="sponsor_cta_clicked" label="contact_sponsors">
                        Other contact routes
                    </EarnGhostCta>
                </div>
                <p className="text-sm text-ink-400">
                    <Link href={blogHrefs.whatSponsoredChallenge} className="text-primary-200 hover:text-white">
                        What is a sponsored wildlife challenge?
                    </Link>
                    {" · "}
                    <Link href={blogHrefs.sponsoredForBusiness} className="text-primary-200 hover:text-white">
                        How Sponsored Challenges work for businesses
                    </Link>
                    {" · "}
                    <Link href={supportArticleHrefs.howSponsor} className="text-primary-200 hover:text-white">
                        Support: how to sponsor
                    </Link>
                </p>
            </section>
        </EarnPageShell>
    );
}
