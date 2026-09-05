import type {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import {EarnGhostCta, EarnPrimaryCta} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import {EarnFaqList, EarnKicker, EarnPageShell, EarnStatusPill} from "@/app/[locale]/(composited)/_components/earn/earn-page-shell";
import {
    blogHrefs,
    creditsAreNotCash,
    earnPaths,
    earnProductPageMeta,
    earnStatus,
    supportArticleHrefs
} from "@/data/earn-economy";
import {buildEarnPageMetadata, earnBreadcrumbList, earnFaqSchema} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl} from "@/lib/site";

const path = earnPaths.creatorRewards;

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    return buildEarnPageMetadata({
        locale,
        path,
        title: earnProductPageMeta.creatorRewards.title,
        description: earnProductPageMeta.creatorRewards.description,
        keywords: [
            "wildlife creator rewards",
            "wildlife photography rewards app",
            "animal photography rewards",
            "wildlife creator platform"
        ]
    });
}

const faqs = [
    {
        question: "Is Creator Rewards paying right now?",
        answer: "No. The program is built, but it is currently paused and not open for payouts. Eligible contribution can still be built in the app."
    },
    {
        question: "If I buy Credits and send Gifts, do I earn more cash?",
        answer: "No. Gift Credit prices never determine Creator Rewards. A future period may count limited genuine Gift events as one community-support signal — never the Credit amount spent."
    },
    {
        question: "Does a high AnimalDex Score mean I get paid?",
        answer: "No. Score is public reputation. Creator Rewards, when a period is open, uses its own contribution review. Score is not redeemed for money."
    }
];

const signals = [
    {title: "Original live captures", body: "Wildlife you actually photographed in the moment. Imports do not add wildlife contribution."},
    {title: "Diversity", body: "A broader wild collection matters more than repeating the same easy animal."},
    {title: "Quality", body: "Clear, honest captures. Weak grades do not help a contribution review."},
    {title: "Consistency", body: "Showing up across a period, not a one-day spike."},
    {title: "Limited community support", body: "Genuine Gift activity may count as a capped signal. The Credit price of a Gift does not."}
];

export default async function CreatorRewardsPage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: earnProductPageMeta.creatorRewards.title,
            description: earnProductPageMeta.creatorRewards.description,
            url: getAbsoluteUrl(locale, path)
        },
        earnBreadcrumbList(locale, [
            {name: "Home", path: "/"},
            {name: "Ways to earn", path: earnPaths.earn},
            {name: "Creator Rewards", path}
        ]),
        earnFaqSchema(locale, path, "AnimalDex Creator Rewards", faqs)
    ];

    return (
        <EarnPageShell schema={schema}>
            <header className="flex max-w-4xl flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                    <EarnKicker>Creator Rewards</EarnKicker>
                    <EarnStatusPill>{earnStatus.creatorRewards}</EarnStatusPill>
                </div>
                <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-[0.02em] text-white md:text-7xl">
                    Your wildlife contribution should matter.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ink-200">
                    Creator Rewards is designed to reward eligible wildlife contribution when reward periods are open. It is a company-funded program — not a tip jar, not Score redemption, and not Credits turned into cash.
                </p>
            </header>

            <section
                aria-label="Current status"
                className="rounded-[1.4rem] border border-white/15 px-5 py-6 md:px-8"
            >
                <p className="font-display text-2xl font-bold uppercase tracking-[0.04em] text-white">
                    Not currently open for payouts
                </p>
                <p className="mt-3 max-w-3xl text-ink-300">
                    You can still join AnimalDex, build a live wild collection, and keep contributing. There is no open period to allocate against, and there is no Withdraw action for Creator Rewards today.
                </p>
            </section>

            <section aria-labelledby="what-it-is" className="grid gap-10 lg:grid-cols-2">
                <div>
                    <h2 id="what-it-is" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                        What contribution means
                    </h2>
                    <ul className="mt-8 space-y-6">
                        {signals.map((signal) => (
                            <li key={signal.title}>
                                <h3 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-primary-200">
                                    {signal.title}
                                </h3>
                                <p className="mt-1 text-ink-300">{signal.body}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="lg:border-l lg:border-white/10 lg:pl-10">
                    <h2 className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                        What does not determine Earnings
                    </h2>
                    <ul className="mt-8 space-y-3 text-ink-300">
                        <li>Credits you bought or were granted</li>
                        <li>AnimalDex Score</li>
                        <li>Capture XP or Capture Level</li>
                        <li>The Credit price of Gifts you sent or received</li>
                        <li>Imported or gallery photos treated as live wildlife</li>
                        <li>Low-quality captures that fail a quality threshold</li>
                    </ul>
                    <p className="mt-8 text-sm font-semibold uppercase tracking-[0.12em] text-primary-200">
                        {creditsAreNotCash}
                    </p>
                </div>
            </section>

            <section aria-labelledby="creator-faq">
                <h2 id="creator-faq" className="mb-6 font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Straight answers
                </h2>
                <EarnFaqList items={faqs} />
            </section>

            <section className="flex flex-col gap-5 border-t border-white/[0.07] pt-10">
                <h2 className="font-display text-2xl font-bold uppercase text-white">Start building your AnimalDex</h2>
                <p className="max-w-2xl text-ink-300">
                    The useful move now is the same move the program is designed to reward later: original live wildlife, photographed carefully, over time.
                </p>
                <div className="flex flex-wrap gap-3">
                    <EarnPrimaryCta href={earnPaths.download} event="creator_rewards_cta_clicked" label="download">
                        Start building your AnimalDex
                    </EarnPrimaryCta>
                    <EarnGhostCta href={supportArticleHrefs.whatCreatorRewards} event="creator_rewards_cta_clicked" label="support_creator">
                        Creator Rewards help
                    </EarnGhostCta>
                </div>
                <p className="text-sm text-ink-400">
                    <Link href={blogHrefs.genuineContribution} className="text-primary-200 hover:text-white">
                        How AnimalDex rewards genuine wildlife contribution
                    </Link>
                    {" · "}
                    <Link href={blogHrefs.photographerCollection} className="text-primary-200 hover:text-white">
                        Build a digital species collection
                    </Link>
                    {" · "}
                    <Link href={earnPaths.earn} className="text-primary-200 hover:text-white">
                        Credits vs Earnings
                    </Link>
                </p>
            </section>
        </EarnPageShell>
    );
}
