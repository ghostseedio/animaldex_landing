import type {Metadata} from "next";
import {getLocale} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import {EarnGhostCta, EarnPrimaryCta, EarnTrackLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import {EarnFaqList, EarnKicker, EarnPageShell, EarnStatusPill} from "@/app/[locale]/(composited)/_components/earn/earn-page-shell";
import {
    blogHrefs,
    creditsAreNotCash,
    earnFacts,
    earnPaths,
    earnProductPageMeta,
    earnStatus,
    supportArticleHrefs
} from "@/data/earn-economy";
import {buildEarnPageMetadata, earnBreadcrumbList, earnFaqSchema} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl} from "@/lib/site";

const path = earnPaths.earn;

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    return buildEarnPageMetadata({
        locale,
        path,
        title: earnProductPageMeta.earn.title,
        description: earnProductPageMeta.earn.description,
        keywords: [
            "earn on AnimalDex",
            "AnimalDex earnings",
            "AnimalDex Credits",
            "wildlife guide marketplace",
            "wildlife creator rewards"
        ]
    });
}

const faqs = [
    {
        question: "Can I cash out AnimalDex Credits?",
        answer: "No. Credits are a closed virtual currency for scans, unlocks, Packs, and in-app actions. They cannot be withdrawn or converted into Earnings."
    },
    {
        question: "What can actually become real money?",
        answer: "Only Earnings. Today that means completed AnimalDex Wildlife Guide outings, where the collector pays the Guide in cash on the day and seller net is recorded after completion. Creator Rewards and Sponsored Challenge cash are not currently paying."
    },
    {
        question: "Do I need payouts set up to start?",
        answer: "No. You can build a collection, apply to become a Guide, and join Sponsored Challenges without a payout method. Payouts are reviewed when Earnings become Available — they are not instant."
    }
];

export default async function EarnOnAnimalDexPage() {
    const locale = await getLocale();
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: earnProductPageMeta.earn.title,
            description: earnProductPageMeta.earn.description,
            url: getAbsoluteUrl(locale, path)
        },
        earnBreadcrumbList(locale, [
            {name: "Home", path: "/"},
            {name: "Ways to earn", path}
        ]),
        earnFaqSchema(locale, path, "Ways to earn on AnimalDex", faqs)
    ];

    return (
        <EarnPageShell schema={schema}>
            <header className="flex max-w-3xl flex-col gap-5">
                <EarnKicker>Earn on AnimalDex</EarnKicker>
                <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-[0.03em] text-white md:text-7xl">
                    Ways to earn on AnimalDex
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ink-200">
                    AnimalDex has two separate economies. Credits power the collection. Earnings is the real-money ledger. They never mix.
                </p>
            </header>

            <section
                aria-label="Credits are not cash"
                className="rounded-[1.4rem] border border-primary-200/25 bg-[#0A1A10] px-5 py-6 md:px-8 md:py-7"
            >
                <p className="font-display text-2xl font-bold uppercase leading-tight tracking-[0.04em] text-primary-200 md:text-3xl">
                    {creditsAreNotCash}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-300 md:text-base">
                    Score, Capture XP, Grade, Gifts, Packs, PvP stakes, and Credit Offers stay inside Credits. None of them become a bank transfer.
                </p>
            </section>

            <section aria-labelledby="two-ledgers" className="grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-6 border-t border-primary-200/25 pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 id="two-ledgers" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                            Real-money Earnings
                        </h2>
                    </div>
                    <p className="text-ink-300">
                        Fiat recorded on the Earnings tab. Only these product areas may ever post money.
                    </p>
                    <ul className="flex flex-col divide-y divide-white/[0.07]">
                        <LedgerRow
                            href={earnPaths.becomeGuide}
                            event="earn_path_clicked"
                            label="wildlife_guides"
                            title="Wildlife Guides"
                            status={earnStatus.guides}
                            detail="Approved locals list real-money experiences. Collectors pay cash on the day. Completing the outing records seller net."
                        />
                        <LedgerRow
                            href={earnPaths.creatorRewards}
                            event="earn_path_clicked"
                            label="creator_rewards"
                            title="Creator Rewards"
                            status={earnStatus.creatorRewards}
                            detail="A company-funded pool for eligible live wildlife contribution during open reward periods. Not currently paying."
                        />
                        <LedgerRow
                            href={earnPaths.sponsor}
                            event="earn_path_clicked"
                            label="sponsored_challenge_cash"
                            title="Sponsored Challenge cash"
                            status="PLANNED"
                            detail="Deterministic cash grants may come later. Joining and achievement rewards are already live. Cash is not marketed as live."
                        />
                    </ul>
                </div>

                <div className="flex flex-col gap-6 border-t border-white/10 pt-6">
                    <h2 className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                        Credits
                    </h2>
                    <p className="text-ink-300">
                        Virtual currency you spend in the app. Useful. Not withdrawable.
                    </p>
                    <ul className="grid gap-3 text-sm text-ink-200 sm:grid-cols-2">
                        {[
                            `Starter grant: ${earnFacts.starterCredits} Credits`,
                            `Missions: 2–40 Credits`,
                            `Referrals: +${earnFacts.referralInviterCredits} / +${earnFacts.referralInviteeCredits} after a friend’s first qualifying capture`,
                            `First wild species: +${earnFacts.firstWildSpeciesCredits} Credit each`,
                            `Sealed Packs: Credits after a ${earnFacts.packPlatformFeePercent}% platform fee`,
                            "PvP / Arena stakes: Credits, never cash",
                            "Credit Offers: user-to-user Credit escrow",
                            "Gifts: sender spends Credits; the recipient gets Capture XP, not cash"
                        ].map((item) => (
                            <li key={item} className="border-l border-primary-200/30 pl-3">
                                {item}
                            </li>
                        ))}
                    </ul>
                    <Link href={supportArticleHrefs.whatCredits} className="text-sm font-semibold text-primary-200 hover:text-white">
                        What are AnimalDex Credits? →
                    </Link>
                </div>
            </section>

            <section aria-labelledby="choose-path" className="flex flex-col gap-8">
                <h2 id="choose-path" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white md:text-4xl">
                    Choose a path
                </h2>
                <div className="grid gap-10 md:grid-cols-3">
                    <PathBlock
                        href={earnPaths.becomeGuide}
                        event="earn_path_clicked"
                        label="become_guide"
                        kicker="Live beta"
                        title="Become a Wildlife Guide"
                        body="The only live real-money loop. Build the wild collection, apply, and list an experience."
                    />
                    <PathBlock
                        href={earnPaths.creatorRewards}
                        event="earn_path_clicked"
                        label="creator_rewards_page"
                        kicker="Paused"
                        title="Creator Rewards"
                        body="Join and keep making genuine live captures. Reward periods are not open right now."
                    />
                    <PathBlock
                        href={earnPaths.sponsor}
                        event="earn_path_clicked"
                        label="sponsor_page"
                        kicker="For businesses"
                        title="Sponsor a Challenge"
                        body="Zoos, parks, and destinations can run a free-to-join Challenge. Enquire with the team."
                    />
                </div>
            </section>

            <section aria-labelledby="earn-faq" className="flex flex-col gap-6">
                <h2 id="earn-faq" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Common questions
                </h2>
                <EarnFaqList items={faqs} />
            </section>

            <section className="flex flex-col gap-4 border-t border-white/[0.07] pt-10 md:flex-row md:items-center md:justify-between">
                <p className="max-w-xl text-ink-300">
                    Read the Help Center articles, or open the app and start building a live wild collection.
                </p>
                <div className="flex flex-wrap gap-3">
                    <EarnPrimaryCta href={earnPaths.download} event="earn_page_cta_clicked" label="download">
                        Get AnimalDex
                    </EarnPrimaryCta>
                    <EarnGhostCta href={supportArticleHrefs.howEarn} event="earn_page_cta_clicked" label="support_how_earn">
                        Support: How earning works
                    </EarnGhostCta>
                </div>
            </section>

            <p className="text-sm text-ink-400">
                Related:{" "}
                <Link href={blogHrefs.genuineContribution} className="text-primary-200 hover:text-white">
                    How AnimalDex rewards genuine wildlife contribution
                </Link>
                {" · "}
                <Link href={blogHrefs.becomeGuideHowTo} className="text-primary-200 hover:text-white">
                    How to become a Wildlife Guide
                </Link>
            </p>
        </EarnPageShell>
    );
}

function LedgerRow({
    href,
    event,
    label,
    title,
    status,
    detail
}: {
    href: string;
    event: string;
    label: string;
    title: string;
    status: string;
    detail: string;
}) {
    return (
        <li className="py-5">
            <EarnTrackLink href={href} event={event} label={label} className="group flex flex-col gap-2">
                <span className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white group-hover:text-primary-200">
                        {title}
                    </span>
                    <EarnStatusPill>{status}</EarnStatusPill>
                </span>
                <span className="text-sm leading-relaxed text-ink-300">{detail}</span>
            </EarnTrackLink>
        </li>
    );
}

function PathBlock({
    href,
    event,
    label,
    kicker,
    title,
    body
}: {
    href: string;
    event: string;
    label: string;
    kicker: string;
    title: string;
    body: string;
}) {
    return (
        <EarnTrackLink href={href} event={event} label={label} className="group flex flex-col gap-3">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-primary-200">{kicker}</p>
            <h3 className="font-display text-2xl font-bold uppercase leading-tight tracking-[0.03em] text-white group-hover:text-primary-200">
                {title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-300">{body}</p>
        </EarnTrackLink>
    );
}
