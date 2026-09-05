import type {Metadata} from "next";
import {Suspense} from "react";
import Link from "@/app/[locale]/_components/link";
import {EarnGhostCta, EarnPrimaryCta, EarnTrackLink} from "@/app/[locale]/(composited)/_components/earn/earn-chrome";
import {EarnFaqList, EarnKicker, EarnPageShell} from "@/app/[locale]/(composited)/_components/earn/earn-page-shell";
import ExperienceCard from "@/app/[locale]/(composited)/wildlife-experiences/experience-card";
import ExperiencesDirectory from "@/app/[locale]/(composited)/wildlife-experiences/experiences-directory";
import {HowBookingWorks} from "@/components/guides/how-booking-works";
import {GuidePageView} from "@/components/guides/guide-analytics";
import {blogHrefs, earnPaths, earnProductPageMeta, supportArticleHrefs} from "@/data/earn-economy";
import {getPublicGuideListings} from "@/data/guide-marketplace";
import {GUIDE_CATEGORIES, guidePath, type GuideCategory, type PublicGuideListing} from "@/lib/guide-marketplace-core";
import {buildEarnPageMetadata, earnBreadcrumbList, earnFaqSchema} from "@/lib/earn-page-metadata";
import {getAbsoluteUrl} from "@/lib/site";

export const revalidate = 86400;

const path = earnPaths.wildlifeExperiences;

const categoryStories: Array<{id: GuideCategory; title: string; body: string}> = [
    {id: "herping", title: "Herping & reptiles", body: "Look for snakes, lizards, frogs and other herps with a local Guide who already walks those public paths. Some listings are evening or night walks; none of them promise a specific animal."},
    {id: "birding", title: "Birding", body: "Spend time with local birdlife — dawn choruses, wetlands, and edges — with someone who can help you notice and identify what is actually there."},
    {id: "night_wildlife", title: "Night wildlife", body: "Join a night wildlife walk for species that become active after dark. Lights are for looking, not for luring."},
    {id: "wildlife_photography", title: "Wildlife photography", body: "Find field time, subjects, and identification context with a wildlife-focused Guide. This is not a staged photography tour."},
    {id: "marine_wildlife", title: "Marine wildlife", body: "Explore coastal and marine species from publicly accessible shorelines and tide lines."},
    {id: "insects_macro", title: "Insects & macro", body: "Slow down and look at the smaller wildlife most people walk past."},
    {id: "general_wildlife", title: "General wildlife", body: "A mixed local wildlife activity for birds, mammals, reptiles, and whatever is active that day."}
];

const faqs = [
    {
        question: "What is an AnimalDex Wildlife Guide?",
        answer: "An AnimalDex Wildlife Guide is an independent seller approved to list small-group wildlife experiences. They are not AnimalDex staff, and AnimalDex does not operate the outing."
    },
    {
        question: "How do I request a wildlife experience?",
        answer: "Open a listing, then send a request in the AnimalDex app. The Guide accepts or declines. A request is not a confirmed booking, and this website does not take payment."
    },
    {
        question: "Do AnimalDex Guides guarantee wildlife sightings?",
        answer: "No. Wildlife does not keep appointments. A good listing is honest about season, habitat, and what you might see — not a promise of a specific animal."
    },
    {
        question: "How do I pay a Wildlife Guide?",
        answer: "You pay the Guide in cash on the day. AnimalDex does not collect that payment, and Credits are never used for the outing."
    },
    {
        question: "Can I find herping experiences on AnimalDex?",
        answer: "Yes, when a Guide has published a herping listing. Filter by Herping on this page. Availability depends on who is approved and currently listed — we do not invent extra trips."
    },
    {
        question: "Are AnimalDex Wildlife Guides employees of AnimalDex?",
        answer: "No. Guides are independent sellers. AnimalDex publishes approved listings and records a completed outing. It does not employ the Guide or run the walk."
    },
    {
        question: "Can I become a Wildlife Guide?",
        answer: "Yes, if you meet the live-beta gates: 45 wild captures, 20 wild species, a 30-day account, age 18+, current Guide Seller Terms, and human review. Start on Become a Wildlife Guide."
    }
];

export async function generateMetadata({params}: {params: {locale: string}}): Promise<Metadata> {
    const locale = params.locale;
    return buildEarnPageMetadata({
        locale,
        path,
        title: earnProductPageMeta.wildlifeExperiences.title,
        description: earnProductPageMeta.wildlifeExperiences.description
    });
}

export default async function WildlifeExperiencesPage({params}: {params: {locale: string}}) {
    const locale = params.locale;
    const listings = await getPublicGuideListings();
    const herpingListings = listings.filter((listing) => listing.service_category === "herping");
    const emptyCategories = (Object.keys(GUIDE_CATEGORIES) as GuideCategory[]).filter(
        (id) => !listings.some((listing) => listing.service_category === id)
    );

    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: earnProductPageMeta.wildlifeExperiences.title,
            description: earnProductPageMeta.wildlifeExperiences.description,
            url: getAbsoluteUrl(locale, path)
        },
        earnBreadcrumbList(locale, [
            {name: "Home", path: "/"},
            {name: "Wildlife experiences", path}
        ]),
        itemListSchema(locale, listings),
        earnFaqSchema(locale, path, "Wildlife experiences on AnimalDex", faqs)
    ];

    return (
        <EarnPageShell schema={schema}>
            <GuidePageView event="wildlife_experiences_view" dimensions={{page_type: "experiences_hub", listing_count: String(listings.length)}} />

            <header className="flex max-w-4xl flex-col gap-6 pt-10">
                <EarnKicker>Wildlife experiences</EarnKicker>
                <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-[0.02em] text-white md:text-7xl">
                    Find your next
                    <span className="block text-primary-200">wild encounter.</span>
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-ink-200">
                    Browse local wildlife experiences led by approved AnimalDex Guides — birding, herping, night wildlife walks, photography-focused field time, marine looking, and other guided activities. Some people call these trips or tours; on AnimalDex they are requested experiences, not a same-day confirmation.
                </p>
                <p className="max-w-2xl text-sm text-ink-400">
                    This page is for discovering published outings. The{" "}
                    <Link href={earnPaths.wildlifeGuidesMarketplace} className="text-primary-200 hover:text-white">
                        Wildlife Guides marketplace
                    </Link>{" "}
                    is the full browse-all directory. AnimalDex does not operate the outings. Sightings are never guaranteed.
                </p>
                <div className="flex flex-wrap gap-3">
                    <EarnPrimaryCta href="#experiences" event="wildlife_experience_category_clicked" label="explore_experiences">
                        Explore experiences ↓
                    </EarnPrimaryCta>
                    <EarnGhostCta href={earnPaths.becomeGuide} event="wildlife_experiences_to_guide_apply" label="become_guide">
                        Become a Wildlife Guide →
                    </EarnGhostCta>
                </div>
            </header>

            <section id="experiences" className="scroll-mt-28 flex flex-col gap-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white md:text-4xl">
                            Published experiences
                        </h2>
                        <p className="mt-3 max-w-2xl text-ink-300">
                            Only listings that are currently public. Unpublished or unapproved Guides do not appear here.
                        </p>
                    </div>
                    <Link href={earnPaths.wildlifeGuidesMarketplace} className="text-sm text-primary-200 hover:text-white">
                        Open the marketplace directory →
                    </Link>
                </div>

                {listings.length === 0 ? (
                    <div className="rounded-[1.35rem] border border-primary-200/20 px-6 py-10 md:px-10">
                        <h3 className="font-display text-3xl font-black uppercase leading-tight text-white md:text-4xl">
                            Wildlife experiences are just getting started.
                        </h3>
                        <p className="mt-4 max-w-2xl text-ink-300">
                            AnimalDex Guides will be able to list birding, herping, photography, marine and other local wildlife experiences here after approval.
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <EarnPrimaryCta href={earnPaths.becomeGuide} event="wildlife_experiences_to_guide_apply" label="empty_become_guide">
                                Become a Wildlife Guide
                            </EarnPrimaryCta>
                            <EarnGhostCta href={earnPaths.download} event="wildlife_experiences_to_guide_apply" label="empty_download">
                                Get AnimalDex
                            </EarnGhostCta>
                        </div>
                    </div>
                ) : (
                    <Suspense fallback={<DirectoryFallback listings={listings} locale={params.locale} />}>
                        <ExperiencesDirectory listings={listings} locale={params.locale} />
                    </Suspense>
                )}
            </section>

            <HowBookingWorks />

            <section aria-labelledby="kinds" className="flex flex-col gap-8">
                <h2 id="kinds" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white md:text-4xl">
                    What kind of wildlife experience are you looking for?
                </h2>
                <div className="grid gap-8 md:grid-cols-2">
                    {categoryStories.map((item) => (
                        <EarnTrackLink
                            key={item.id}
                            href={`${path}?category=${item.id}#experiences`}
                            event="wildlife_experience_category_clicked"
                            label={item.id}
                            className="group border-l border-primary-200/25 pl-5"
                        >
                            <h3 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white group-hover:text-primary-200">
                                {item.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink-300">{item.body}</p>
                            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
                                {GUIDE_CATEGORIES[item.id]} experiences →
                            </p>
                        </EarnTrackLink>
                    ))}
                </div>
                {emptyCategories.length > 0 && listings.length > 0 ? (
                    <div className="rounded-[1.2rem] border border-white/10 px-6 py-8">
                        <h3 className="font-display text-2xl font-bold uppercase text-white">
                            Looking for {emptyCategoryLabel(emptyCategories)}?
                        </h3>
                        <p className="mt-3 max-w-2xl text-ink-300">
                            We&apos;re still growing the Guide network. Those categories have no published listing yet — browse what is live, or apply to lead one.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <EarnGhostCta href="#experiences" event="wildlife_experience_category_clicked" label="scarcity_browse_all">
                                Browse all experiences
                            </EarnGhostCta>
                            <EarnGhostCta href={earnPaths.becomeGuide} event="wildlife_experiences_to_guide_apply" label="scarcity_become_guide">
                                Become a Wildlife Guide
                            </EarnGhostCta>
                        </div>
                    </div>
                ) : null}
            </section>

            <section aria-labelledby="herping" className="flex flex-col gap-6 border-t border-white/[0.07] pt-10">
                <h2 id="herping" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white md:text-4xl">
                    Herping experiences
                </h2>
                <p className="max-w-2xl text-ink-300">
                    Looking for snakes, lizards, frogs or other reptiles and amphibians in the field? AnimalDex Wildlife Guides can list local herping experiences built around ethical observation, field knowledge and realistic wildlife encounters.
                </p>
                <p className="max-w-2xl text-sm text-ink-400">
                    This page is for finding a bookable outing. If you want to log your own finds, use the{" "}
                    <Link href="/use-cases/herping-field-journal" className="text-primary-200 hover:text-white">
                        herping field journal
                    </Link>
                    .
                </p>
                {herpingListings.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-white/10 px-6 py-8">
                        <h3 className="font-display text-2xl font-bold uppercase text-white">Looking for a herping experience?</h3>
                        <p className="mt-3 max-w-xl text-ink-300">We&apos;re still growing the Guide network. No herping listings are public right now.</p>
                        <div className="mt-5 flex flex-wrap gap-4">
                            <Link href="#experiences" className="font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200">
                                Browse all experiences
                            </Link>
                            <Link href={earnPaths.becomeGuide} className="font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-200">
                                Become a Wildlife Guide
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {herpingListings.map((listing) => (
                            <ExperienceCard key={listing.id} listing={listing} locale={params.locale} />
                        ))}
                    </div>
                )}
            </section>

            <section aria-labelledby="before-you-book" className="flex flex-col gap-6">
                <h2 id="before-you-book" className="font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Before you request
                </h2>
                <ul className="max-w-3xl space-y-3 text-ink-300">
                    <li>Guides are independent sellers, not AnimalDex staff.</li>
                    <li>Wildlife sightings are never guaranteed.</li>
                    <li>Guides are responsible for the permits, licences, and insurance their activity requires.</li>
                    <li>Exact meeting details stay private until the Guide accepts your request in the app.</li>
                    <li>Wildlife should not be baited, lured, handled, or disturbed for a photo or a “sure thing.”</li>
                    <li>You pay the Guide in cash on the day. AnimalDex does not collect that payment.</li>
                </ul>
                <p className="text-sm text-ink-400">
                    <Link href={supportArticleHrefs.guidePayments} className="text-primary-200 hover:text-white">
                        How Guide bookings and payments work
                    </Link>
                    {" · "}
                    <Link href={earnPaths.wildlifeGuidesMarketplace} className="text-primary-200 hover:text-white">
                        Wildlife Guides marketplace
                    </Link>
                </p>
            </section>

            <section aria-labelledby="experience-faq">
                <h2 id="experience-faq" className="mb-6 font-display text-3xl font-black uppercase tracking-[0.04em] text-white">
                    Common questions
                </h2>
                <EarnFaqList items={faqs} />
            </section>

            <p className="text-sm text-ink-400">
                Related:{" "}
                <Link href={blogHrefs.chooseLocalGuide} className="text-primary-200 hover:text-white">How to choose a local wildlife guide</Link>
                {" · "}
                <Link href={blogHrefs.ethicalHerpingTours} className="text-primary-200 hover:text-white">Ethical herping tours</Link>
                {" · "}
                <Link href={blogHrefs.wildlifeActivities} className="text-primary-200 hover:text-white">Types of wildlife activities</Link>
                {" · "}
                <Link href={earnPaths.becomeGuide} className="text-primary-200 hover:text-white">Become a Wildlife Guide</Link>
            </p>
        </EarnPageShell>
    );
}

function emptyCategoryLabel(ids: GuideCategory[]) {
    const labels = ids.map((id) => GUIDE_CATEGORIES[id].toLowerCase());
    if (labels.length === 1) return `a ${labels[0]} experience`;
    if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

function itemListSchema(locale: string, listings: PublicGuideListing[]) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        numberOfItems: listings.length,
        itemListElement: listings.map((listing, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, guidePath(listing)),
            name: listing.title
        }))
    };
}

function DirectoryFallback({listings, locale}: {listings: PublicGuideListing[]; locale: string}) {
    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.slice(0, 6).map((listing) => (
                <div key={listing.id} className="min-h-[22rem] rounded-[1.35rem] border border-white/10 bg-white/[0.03]" aria-hidden="true">
                    <span className="sr-only">{listing.title} in {locale}</span>
                </div>
            ))}
        </div>
    );
}
