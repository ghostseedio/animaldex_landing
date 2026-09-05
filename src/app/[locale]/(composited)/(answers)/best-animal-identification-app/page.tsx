import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {generateAnswerPageMetadata} from "@/app/[locale]/(composited)/(answers)/_shared";
import {AppChooser, AppComparisonTable} from "./_app-guide-interactive";
import {getAbsoluteUrl} from "@/lib/site";
import {getManagedPage} from "@/lib/admin-content";
import ManagedSectionInteractions from "./managed-section-interactions";

export const revalidate = 3600;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

export async function generateMetadata({params}: {params: {locale: string}}) {
    return generateAnswerPageMetadata("best-animal-identification-app", params.locale);
}

const quickPicks = [
    {label: "Best overall for collecting + learning", app: "AnimalDex", note: "Grades every capture, scores each species, and turns sightings into a collection and learning system.", accent: "text-primary-200"},
    {label: "Best for wildlife science", app: "iNaturalist", note: "Community-reviewed observations that can support research.", accent: "text-sky-300"},
    {label: "Best for beginners and families", app: "Seek", note: "Private, approachable, offline and built around exploration.", accent: "text-amber-300"},
    {label: "Best bird specialist", app: "Merlin Bird ID", note: "Excellent photo, sound and step-by-step bird identification.", accent: "text-rose-300"},
    {label: "Best general visual search", app: "Google Lens", note: "Fastest route from almost any image to broad web results.", accent: "text-violet-300"}
];

const appReviews = [
    {id: "animaldex", name: "AnimalDex", verdict: "Best if identification should lead somewhere", best: "Collectors, animal learners and people who want lessons and progression after a scan.", notIdeal: "You need community verification, research-grade observations or dependable offline identification.", strengths: ["Broad animal focus with thousands of indexed species profiles", "Video captures identified by consensus across sampled frames", "Every capture receives a 1–10 grade across seven weighted factors", "Species stats, E–S tiers and comparison battles", "Search any species for the nearest real place to see it", "A behavioural lesson attached to each species, not only a name"], weaknesses: ["No iNaturalist-style expert community verification", "Not the strongest offline field tool", "Does not identify plants", "Stats and tiers are an AnimalDex model, not a scientific ranking"]},
    {id: "inaturalist", name: "iNaturalist", verdict: "Best wildlife science platform", best: "Naturalists, photographers and anyone who wants observations reviewed and useful to biodiversity science.", notIdeal: "You want instant, private, game-like identification with no account or public data workflow.", strengths: ["Community can confirm or refine IDs", "Research Grade status makes records usable by science", "Plants, animals, fungi and more", "Observation maps show where a species has actually been recorded", "Free, nonprofit and science-oriented"], weaknesses: ["Research Grade rates the record, not the quality of your photo", "Photos and sound only—no video observations", "Community confirmation is not always instant", "Maps show where a species was seen before, not where to go now"]},
    {id: "seek", name: "Seek by iNaturalist", verdict: "Best beginner wildlife app", best: "Children, families, classrooms and hikers who want private, real-time identification without an account.", notIdeal: "You need the newest iNaturalist model, expert review or a serious public wildlife log.", strengths: ["Works without an internet connection", "Live camera identification in real time", "No account required and private by default", "Badges and challenges reward exploration"], weaknesses: ["Its on-device model can trail iNaturalist’s current online model", "Live view identifies but keeps no clip to re-examine", "No stats, grading or species-level progression", "Less suitable for research-grade records"]},
    {id: "merlin", name: "Merlin Bird ID", verdict: "The clear specialist for birds", best: "Birders who want photo, sound and guided identification, including in places with poor reception.", notIdeal: "You want mammals, reptiles, insects, plants or a general wildlife collection.", strengths: ["Photo ID and Sound ID work offline after setup", "Real-time sound identification is genuinely best in class", "eBird data powers likely-birds-near-you lists and range maps", "Maintains a bird life list"], weaknesses: ["Birds only", "Real-time analysis is audio, not video", "Regional packs require storage and preparation", "No grading, stats or comparison layer"]},
    {id: "google-lens", name: "Google Lens", verdict: "Best when you need broad visual search", best: "Occasional users who want a quick lead from any photo without maintaining a dedicated nature log.", notIdeal: "You need a curated field guide, offline use, collection progression or scientific verification.", strengths: ["Understands far more than wildlife", "Easy to access from the Google app and photos", "Returns visually similar images and web context", "Useful when the subject may not be an animal"], weaknesses: ["A search result is not a verified identification", "No wildlife-specific observation workflow", "Web results vary in quality and require judgment"]},
    {id: "picturethis", name: "PictureThis", verdict: "Best here for plants—not animals", best: "Gardeners who need plant identification, care guidance and disease diagnosis.", notIdeal: "Your priority is broad wildlife identification or animal collection.", strengths: ["Strong plant-first identification workflow", "Plant care and disease guidance", "Personal garden organization", "Detailed plant encyclopedia"], weaknesses: ["Not a general animal identifier", "Many care features sit behind premium access", "Wildlife features are not its core proposition"]}
];

const screenshots = [
    {title: "Scanner", caption: "Start with a photo and a likely identification.", src: "/images/placeholders/phone-scan-card.svg"},
    {title: "Collection", caption: "Keep discoveries instead of losing them after one search.", src: "/images/placeholders/phone-collection-card.svg"},
    {title: "Comparisons", caption: "Place species side by side and explore tradeoffs.", src: "/images/placeholders/phone-challenge-card.svg"},
    {title: "Lessons", caption: "Move from animal behavior to a memorable idea.", src: "/images/placeholders/phone-guide-card.svg"},
    {title: "Wild Profile", caption: "See patterns across the animals you connect with.", src: "/images/blog/what-animal-am-i/wild-profile-app-interface.webp"}
];

type FeatureDeepDive = {
    id: string;
    kicker: string;
    title: string;
    animalDex: string;
    others: string;
    matters: string;
    table?: {headers: string[]; rows: string[][]};
};

const featureDeepDives: FeatureDeepDive[] = [
    {
        id: "video-analysis",
        kicker: "Video analysis",
        title: "Identifying from a clip, not a lucky frame",
        animalDex: "AnimalDex accepts a video capture, samples frames across the clip with their timestamps, and identifies by consensus across those frames. One blurry frame cannot hijack the result, and one sharp frame cannot override weak agreement everywhere else—unless it uniquely shows decisive anatomy, such as an inverted hanging roost posture that separates a bat from a bird. The clip stays on the capture and plays back in the feed.",
        others: "Seek identifies live through the viewfinder but keeps no clip you can re-examine. Merlin's real-time strength is Sound ID, which analyses audio rather than moving images. iNaturalist accepts photos and sound recordings, not video. Google Lens works from a single frame.",
        matters: "Animals that never hold still—bats in flight, fish, a bird deep in a canopy—rarely give you one clean photo. A clip gives the model several chances at the same animal."
    },
    {
        id: "capture-grading",
        kicker: "Photo grading",
        title: "“Research Grade” and a capture grade measure different things",
        animalDex: "Every AnimalDex capture receives a grade from 1 to 10, built from seven weighted factors: identification confidence (24%), clarity and focus (20%), centering, proximity and framing (18%), shot quality (16%), body detail (8%), the animal's condition (8%) and habitat and setting (6%). Deductions apply for a likely non-live source such as a photo of a screen, poster or print, for heavy obstruction like cage bars, and for identifications the model could not resolve. Community endorsements add a small lift. A grade above 7 requires sharp focus and clear image quality.",
        others: "iNaturalist's Research Grade is a data-quality status, not a photo score: an observation needs a date, a location, media and a wild organism, and two-thirds of identifiers must agree on the species. A flat, unremarkable photo of an obvious species reaches Research Grade. A beautiful photo of a contested species does not. Seek, Merlin, Google Lens and PictureThis do not grade captures at all.",
        matters: "iNaturalist grades how useful your record is to science. AnimalDex grades the capture itself—so the feedback tells you how to take a better one next time."
    },
    {
        id: "stats-tiers-battles",
        kicker: "Stats, tiers and battles",
        title: "Every species carries numbers you can actually compare",
        animalDex: "Each indexed species holds five stats—dominance, speed, size, intelligence and rarity—plus a power score that resolves to a battle tier from E up to S. Matchups are restricted to species within one tier of each other, so the arena stays a real comparison rather than a fantasy free-for-all. Head-to-head comparisons run across battle, speed, strength, intelligence, stealth, durability and agility, and challenges are settled by a chosen deciding stat.",
        others: "No other app in this comparison assigns species-level stats, tiers or head-to-head matchups. The nearest equivalent elsewhere is a life list: a count of what you have seen, with nothing to compare between entries.",
        matters: "Stats turn a collection into something you can reason about. They are an AnimalDex model for comparison, not a scientific ranking, and the tier guide says so on every list."
    },
    {
        id: "animal-tracking",
        kicker: "Animal tracking",
        title: "A heatmap of the past, or directions to the nearest place",
        animalDex: "Search any species in AnimalDex and it resolves the nearest real place you could go and see it—a local venue that keeps or features the animal, or a highly likely look destination inside its native range, with notes on what to look for. When an animal is genuinely not plausible near you, it says so and routes to the native range instead of inventing a pin down the street. A separate nearby guide bands what is likely around you right now into 0–5 m, 5–20 m and 20–50 m, plus a possible-but-uncommon list.",
        others: "iNaturalist maps verified past observations—excellent evidence of where a species has been recorded, and the better tool if you want proof. Seek surfaces nearby species lists. Merlin uses eBird data for likely-birds-near-you and range maps, for birds only.",
        matters: "“Where has this been seen?” and “where can I go to see it?” are different questions. Most apps answer the first one well and the second one not at all."
    },
    {
        id: "species-depth",
        kicker: "Species depth",
        title: "Over 2,000 indexed species, each with a profile and a lesson",
        animalDex: "AnimalDex has indexed over 2,000 species, each with its own AnimalDex number and profile: a field-guide entry, stats, comparisons and a behavioural principle—a real trait or strategy the animal uses, written so it can be applied to something in your own life. The catalogue keeps growing, and captures link into it rather than sitting as loose photos.",
        others: "Other identification apps answer “what is this?” and stop. iNaturalist adds taxonomy and observation history, Merlin adds calls and range information, and PictureThis adds plant care—but none of them attach a transferable idea to the animal.",
        matters: "The name of an animal is the least interesting thing about it. The point of indexing a species is what you can carry away from it."
    },
    {
        id: "credits-and-limits",
        kicker: "Credits and limits",
        title: "What “free” actually costs in each app",
        animalDex: "AnimalDex is free to use and runs on credits. You earn them by doing the thing the app is for—logging captures, entering comparison battles, staying active—and you can buy more with real money if you want to. In normal use people very rarely run out, because ordinary exploring earns faster than it spends. There is no daily cap on how many animals you can capture.",
        others: "iNaturalist, Seek and Merlin Bird ID are genuinely free, backed by a nonprofit and a university lab, and that is the cleanest deal in the category. Google Lens is free. PictureThis gives you limited free use and pushes a subscription for its care features. Gotcha, a newer animal-capture app with a narrower feature set, indexes around 900 animals and stops free users at 10 captures per day unless they upgrade to Pro.",
        matters: "A daily capture cap stops you on the exact day you find something worth capturing. A credit balance you refill by using the app normally is a different shape of limit—and if the free tools cover what you need, use them.",
        table: {
            headers: ["App", "Cost model", "The limit you actually hit"],
            rows: [
                ["AnimalDex", "Free, with credits earned through captures and comparison battles; purchasable if you want more", "No daily capture cap; credits rarely run out in normal use"],
                ["iNaturalist", "Free, nonprofit", "None—but records are public by design"],
                ["Seek", "Free, no account needed", "None; on-device model can trail the online one"],
                ["Merlin Bird ID", "Free, from the Cornell Lab of Ornithology", "Birds only; regional packs must be downloaded"],
                ["Google Lens", "Free", "None, but it keeps no wildlife log for you"],
                ["PictureThis", "Limited free use, subscription for the rest", "Care and diagnosis features sit behind the paywall"],
                ["Gotcha", "Free tier with a Pro upgrade", "Limited free captures per day; fewer indexed animals"]
            ]
        }
    }
];

const faq = [
    ["Which app can identify an animal from a video?", "AnimalDex identifies from video captures by sampling frames across the clip and taking a consensus across them. Seek and Google Lens identify live through the camera without keeping a clip, Merlin analyses sound in real time rather than video, and iNaturalist accepts photos and audio but not video."],
    ["What is the difference between iNaturalist Research Grade and an AnimalDex grade?", "Research Grade is a data-quality status: an iNaturalist observation qualifies when it has a date, a location, media, a wild organism and community agreement on the species. An AnimalDex grade scores the capture itself from 1 to 10 across identification confidence, clarity and focus, framing, shot quality, body detail, condition and habitat, with deductions for photos of screens or posters, cage bars and unresolved identifications."],
    ["Which app tells you where to find an animal near you?", "AnimalDex resolves the nearest real place to see a searched species, or routes to a likely look area inside its native range when the animal is not plausible locally. iNaturalist maps where a species has previously been observed, and Merlin uses eBird data for likely birds near you. They answer related but different questions."],
    ["How many species does AnimalDex cover?", "Over 2,000 species are indexed, each with its own profile, stats, comparisons and a behavioural lesson drawn from how the animal actually lives."],
    ["Is AnimalDex free, and how do credits work?", "AnimalDex is free to use and runs on credits. You earn them by using the app—logging captures, entering comparison battles, staying active—and you can also buy them with real money. Because ordinary exploring earns credits faster than it spends them, people very rarely run out. There is no daily cap on captures."],
    ["Do any animal apps limit how many captures you can take per day?", "Gotcha limits free users to 10 captures a day unless they upgrade to Pro, and indexes around 900 animals. AnimalDex has no daily capture cap and uses earned credits instead. iNaturalist, Seek, Merlin Bird ID and Google Lens are free with no capture limit."],
    ["Is AnimalDex better than iNaturalist?", "Not for every job. iNaturalist is better for community verification, public wildlife records and citizen science. AnimalDex is the better fit when you want collecting, comparisons, progression and lessons after identification."],
    ["Should I use Seek or AnimalDex?", "Use Seek for a private, offline-friendly, child-safe nature explorer. Use AnimalDex when you want to build a collection and continue into comparisons, lessons and progression."],
    ["Which app works best for kids?", "Seek is the safest default recommendation because it requires no account, keeps observations on the device by default and uses badges and challenges. A parent may prefer AnimalDex when a shared collection and guided learning are the priority."],
    ["Which app identifies mammals?", "AnimalDex, iNaturalist, Seek and Google Lens can all suggest mammal identifications. iNaturalist offers the strongest path to human review; Seek is useful offline; AnimalDex adds collection and learning."],
    ["Can AI identify reptiles?", "Often, but not reliably from every image. Scale pattern, head shape, location and habitat can separate similar reptiles, so treat an AI result as a candidate—not proof, especially around venomous species."],
    ["Can AI identify insects?", "Yes, but insects are particularly difficult because many species differ through tiny structures that a casual photo will not show. Multiple angles and a location-aware platform materially improve the odds."],
    ["Which app is best offline?", "Merlin is the strongest offline specialist for birds after the relevant packs are downloaded. Seek is the best broad offline nature option. iNaturalist and Google Lens are more useful with a connection."],
    ["Is Google Lens accurate enough for wildlife?", "It is useful for generating leads and finding similar images. For difficult or safety-sensitive identifications, verify the result with field marks, distribution data or a knowledgeable human."],
    ["Are any of these apps completely free?", "iNaturalist, Seek, Merlin Bird ID and Google Lens are free to use. AnimalDex is free and runs on credits you earn by capturing and competing, with the option to buy more. PictureThis offers limited access and promotes a paid subscription, and Gotcha caps free users at 10 captures per day."],
    ["What photo gives an identification app the best chance?", "Use sharp natural light, fill the frame without cropping off key anatomy, photograph more than one angle and retain the location and date. For insects and plants, include close-up detail and the whole organism."]
];

function staticManagedHtml(html: string) {
    return html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

function isManagedWorkflowSection(section: {title?: string; html?: string}) {
    const html = section.html ?? "";
    return section.title === "The workflow, not just the pitch"
        || html.includes("animaldex-workflow")
        || html.includes("Inside the app")
        || html.includes("Five product surfaces");
}

function isManagedQuickAnswerSection(section: {title?: string; html?: string}) {
    const html = section.html ?? "";
    return section.title === "Five excellent apps. Five different jobs."
        || html.includes('id="quick-answer"')
        || html.includes("quick-answer-card");
}

function sectionByTitle(sections: Array<{title?: string; html?: string}> | undefined, title: string) {
    return sections?.find((section) => section.title === title);
}

function shouldShowFeaturedImage(src: string | undefined) {
    return Boolean(src && !src.includes("/images/placeholders/blog-image-slot.svg"));
}

function imageDisplayStyle(image: {displayHeight?: number}) {
    return image.displayHeight ? {height: `${image.displayHeight}px`} : undefined;
}

type ManagedDisplayImage = NonNullable<Awaited<ReturnType<typeof getManagedPage>>>["featuredImage"] & {displayHeight?: number};

function featuredFigureStyle(image: ManagedDisplayImage) {
    if (!image.displayHeight || !image.width || !image.height) return undefined;
    return {
        maxWidth: `${Math.round(image.displayHeight * image.width / image.height)}px`
    };
}

export default async function BestAnimalIdentificationAppPage({params}: {params: {locale: string}}) {
    const managed = await getManagedPage("best-animal-identification-app");
    const managedQuickAnswer = managed?.sections.find(isManagedQuickAnswerSection);
    const managedWorkflow = managed?.sections.find(isManagedWorkflowSection);
    const managedSections = managed?.sections;
    const managedHeaderHtml = managed?.headerHtml;
    const managedComparison = sectionByTitle(managedSections, "Compare features at a glance");
    const managedReviews = sectionByTitle(managedSections, "Where each app wins—and where it doesn’t");
    const managedChooser = sectionByTitle(managedSections, "Which app is right for you?");
    const managedWhyDifferent = sectionByTitle(managedSections, "Why AnimalDex is different");
    const managedDeepDives = sectionByTitle(managedSections, "Six differences that actually matter");
    const managedTrust = sectionByTitle(managedSections, "How to use AI identification responsibly");
    const managedFaq = sectionByTitle(managedSections, "Animal identification app FAQ");
    const managedRelated = sectionByTitle(managedSections, "Related guides");
    const visibleFeaturedImage = shouldShowFeaturedImage(managed?.featuredImage?.src) ? managed?.featuredImage as ManagedDisplayImage : null;
    const pageUrl = getAbsoluteUrl(params.locale, "/best-animal-identification-app");
    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Best Animal Identification Apps (2026)",
            description: "An independent comparison of AnimalDex, iNaturalist, Seek, Merlin Bird ID, Google Lens and PictureThis.",
            dateModified: "2026-08-12",
            inLanguage: params.locale,
            url: pageUrl,
            author: {"@type": "Organization", name: "AnimalDex Editorial"},
            publisher: {"@type": "Organization", name: "AnimalDex"}
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(([question, answer]) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: {"@type": "Answer", text: answer}
            }))
        }
    ];

    return (
        <article className="mx-auto flex w-full max-w-[92rem] flex-col gap-16 px-4 py-12 md:px-8 md:py-20 lg:gap-24">
            {managedSections?.length ? <ManagedSectionInteractions /> : null}
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData)}} />
            {managedHeaderHtml ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedHeaderHtml)}} /> : <header className="relative overflow-hidden border-b border-line-300 pb-12 pt-8 md:pb-16 md:pt-14">
                <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-500/10 blur-3xl" />
                <div className="relative mx-auto max-w-5xl text-center"><p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">Independent buying guide · Updated August 12th 2026</p><h1 className="mt-5 font-display text-5xl font-bold leading-[0.95] text-white md:text-7xl lg:text-8xl">Best Animal Identification Apps <span className="text-primary-400">(2026)</span></h1><p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-ink-200 md:text-2xl md:leading-9">We compared the most popular wildlife identification apps, bird apps and AI animal scanners to help you choose the right one.</p></div>
                <div className="relative mt-10"><p className="mb-3 text-center text-xs font-black uppercase tracking-[0.18em] text-ink-300">Quick comparison</p><div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto pb-2 md:justify-center">{["AnimalDex", "iNaturalist", "Seek", "Merlin Bird ID", "Google Lens", "PictureThis"].map((app) => <a key={app} href={`#${app.toLowerCase().replace(/\s+/g, "-").replace("-bird-id", "")}`} className="whitespace-nowrap rounded-full border border-line-300 bg-surface-900/70 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-primary-500/50">{app}</a>)}</div></div>
            </header>}

            {visibleFeaturedImage ? <figure style={featuredFigureStyle(visibleFeaturedImage)} className="mx-auto w-full overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900 shadow-2xl"><img src={visibleFeaturedImage.src} alt={visibleFeaturedImage.alt} width={visibleFeaturedImage.width} height={visibleFeaturedImage.height} style={imageDisplayStyle(visibleFeaturedImage)} className={`${visibleFeaturedImage.displayHeight ? "" : "aspect-video"} h-auto w-full object-cover`} />{visibleFeaturedImage.caption ? <figcaption className="border-t border-line-300 px-5 py-3 text-sm text-ink-400">{visibleFeaturedImage.caption}</figcaption> : null}</figure> : null}

            {managedQuickAnswer?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedQuickAnswer.html)}} /> : <section aria-labelledby="quick-answer" className="overflow-hidden rounded-[2.25rem] border border-line-300 bg-surface-900/70 shadow-2xl"><div className="border-b border-line-300 bg-gradient-to-r from-primary-500/20 to-transparent px-6 py-6 md:px-10"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Quick answer</p><h2 id="quick-answer" className="mt-1 font-display text-3xl font-bold text-white md:text-5xl">Five excellent apps. Five different jobs.</h2></div><div className="divide-y divide-line-300">{quickPicks.map((pick, index) => <div key={pick.app} className="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10"><span className="font-display text-2xl font-bold text-ink-400">0{index + 1}</span><div><p className={`text-xs font-black uppercase tracking-[0.14em] ${pick.accent}`}>{pick.label}</p><h3 className="mt-1 text-2xl font-bold text-white">{pick.app}</h3></div><p className="text-base leading-7 text-ink-200">{pick.note}</p></div>)}</div></section>}

            {managedComparison?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedComparison.html)}} /> : <section className="space-y-7"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Main comparison</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">Compare features at a glance</h2><p className="mt-4 text-lg leading-8 text-ink-200">A tick means the feature is a meaningful part of the product. A half-circle means support is limited, adjacent or not the app’s primary purpose.</p></div><AppComparisonTable /><p className="max-w-4xl text-sm leading-6 text-ink-400">Feature availability can vary by platform, region and downloaded content. “Offline” means identification can work offline—not merely that a photo can be saved for later upload.</p></section>}

            {managedReviews?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedReviews.html)}} /> : <section className="space-y-8"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Honest strengths</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">Where each app wins—and where it doesn’t</h2></div><div className="grid gap-x-6 gap-y-8 md:grid-cols-2">{appReviews.map((app, index) => <article id={app.id} key={app.name} className="scroll-mt-24 border-t border-line-300 pt-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">0{index + 1}</p><h3 className="mt-1 font-display text-3xl font-bold text-white md:text-4xl">{app.name}</h3><p className="mt-2 font-semibold text-primary-200">{app.verdict}</p></div><span className="rounded-full border border-line-300 px-3 py-1 text-xs text-ink-300">Reviewed</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><h4 className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Best if…</h4><p className="mt-2 text-sm leading-6 text-ink-200">{app.best}</p></div><div><h4 className="text-xs font-black uppercase tracking-[0.14em] text-rose-300">Not ideal if…</h4><p className="mt-2 text-sm leading-6 text-ink-200">{app.notIdeal}</p></div></div><div className="mt-6 grid gap-5 border-t border-line-300/70 pt-5 sm:grid-cols-2"><div><h4 className="font-bold text-white">Strengths</h4><ul className="mt-2 space-y-2 text-sm leading-6 text-ink-200">{app.strengths.map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-300">+</span>{item}</li>)}</ul></div><div><h4 className="font-bold text-white">Weaknesses</h4><ul className="mt-2 space-y-2 text-sm leading-6 text-ink-200">{app.weaknesses.map((item) => <li key={item} className="flex gap-2"><span className="text-rose-300">−</span>{item}</li>)}</ul></div></div></article>)}</div></section>}

            {managedChooser?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedChooser.html)}} /> : <AppChooser />}

            {managedWhyDifferent?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedWhyDifferent.html)}} /> : <section className="grid gap-10 border-y border-line-300 py-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">A different philosophy</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">Why AnimalDex is different</h2><p className="mt-5 text-lg leading-8 text-ink-200">Most identification tools optimize for one question: <strong className="text-white">“What is this?”</strong> AnimalDex is designed around the follow-up: <strong className="text-white">“What can I learn from this?”</strong></p><p className="mt-4 text-sm leading-6 text-ink-400">That is not automatically better. If your priority is scientific contribution, use iNaturalist. If your priority is birds, use Merlin. The AnimalDex approach is for people who want discovery to compound.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">{["Scan", "Identify", "Collect", "Level up", "Compare", "Learn", "Apply"].map((step, index) => <div key={step} className={`relative rounded-2xl border p-5 ${index === 6 ? "border-primary-400/50 bg-primary-500/20" : "border-line-300 bg-surface-900/70"}`}><span className="text-xs font-black text-primary-400">0{index + 1}</span><p className="mt-5 font-display text-xl font-bold text-white">{step}</p>{index < 6 ? <span className="absolute -bottom-3 left-1/2 z-10 text-primary-400">↓</span> : null}</div>)}</div></section>}

            {managedWorkflow?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedWorkflow.html)}} /> : <section className="space-y-8"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Inside the app</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">The workflow, not just the pitch</h2><p className="mt-4 text-lg text-ink-200">Five product surfaces showing what happens after the camera opens.</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">{screenshots.map((shot, index) => <figure key={shot.title} className={`overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900 ${index === 0 ? "md:col-span-2 xl:col-span-1" : ""}`}><div className="relative aspect-[9/14] overflow-hidden bg-gradient-to-b from-surface-800 to-canvas-950"><Image src={shot.src} alt={`${shot.title} interface in AnimalDex`} fill sizes="(min-width: 1280px) 18vw, (min-width: 768px) 45vw, 100vw" className="object-contain p-3" /></div><figcaption className="border-t border-line-300 p-5"><h3 className="font-bold text-white">{shot.title}</h3><p className="mt-1 text-sm leading-6 text-ink-300">{shot.caption}</p></figcaption></figure>)}</div></section>}

            {managedDeepDives?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedDeepDives.html)}} /> : <section className="space-y-8"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Feature deep dive</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">Six differences that actually matter</h2><p className="mt-4 text-lg leading-8 text-ink-200">The tick table above shows what exists. This section explains what those differences mean when you are standing in front of an animal—and what each app costs you to keep using.</p></div><div className="space-y-4">{featureDeepDives.map((feature, index) => <article id={feature.id} key={feature.id} className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900/60"><div className="border-b border-line-300 px-6 py-6 md:px-9"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">{`0${index + 1} · ${feature.kicker}`}</p><h3 className="mt-2 font-display text-2xl font-bold text-white md:text-4xl">{feature.title}</h3></div><div className="grid gap-6 px-6 py-7 md:grid-cols-2 md:px-9"><div><h4 className="text-xs font-black uppercase tracking-[0.14em] text-primary-200">In AnimalDex</h4><p className="mt-3 text-base leading-7 text-ink-200">{feature.animalDex}</p></div><div><h4 className="text-xs font-black uppercase tracking-[0.14em] text-ink-300">Everywhere else</h4><p className="mt-3 text-base leading-7 text-ink-200">{feature.others}</p></div></div>{feature.table ? <div className="border-t border-line-300 px-6 pb-7 pt-6 md:px-9"><div className="grid gap-2 md:hidden">{feature.table.rows.map((row) => <div key={row[0]} className={`rounded-2xl border p-4 ${row[0] === "AnimalDex" ? "border-primary-400/40 bg-primary-500/10" : "border-line-300 bg-surface-900/60"}`}><p className="font-bold text-white">{row[0]}</p>{feature.table!.headers.slice(1).map((header, headerIndex) => <p key={header} className="mt-2 text-sm leading-6 text-ink-200"><span className="text-xs font-black uppercase tracking-[0.1em] text-ink-400">{header}</span><br />{row[headerIndex + 1]}</p>)}</div>)}</div><div className="hidden overflow-x-auto rounded-2xl border border-line-300 md:block"><table className="w-full min-w-[46rem] border-collapse text-left text-sm"><thead><tr className="border-b border-line-300 bg-surface-800/80">{feature.table.headers.map((header) => <th key={header} className="px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-ink-200">{header}</th>)}</tr></thead><tbody>{feature.table.rows.map((row) => <tr key={row[0]} className={`border-b border-line-300/60 last:border-0 ${row[0] === "AnimalDex" ? "bg-primary-500/[0.045]" : ""}`}>{row.map((cell, cellIndex) => <td key={`${row[0]}-${cellIndex}`} className={`px-4 py-3 align-top leading-6 ${cellIndex === 0 ? "font-bold text-white" : "text-ink-200"}`}>{cell}</td>)}</tr>)}</tbody></table></div></div> : null}<p className="border-t border-line-300 bg-canvas-950/40 px-6 py-5 text-sm leading-6 text-ink-300 md:px-9"><strong className="text-white">Why it matters: </strong>{feature.matters}</p></article>)}</div></section>}

            {managedTrust?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedTrust.html)}} /> : <section className="space-y-8"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Trust before certainty</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-6xl">How to use AI identification responsibly</h2></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[["How identification works", "Models compare visible patterns with labeled examples. Better tools also use location, date and expected range to rerank likely matches."], ["Why AI isn’t perfect", "Lookalikes, juveniles, seasonal coats, poor angles and rare species can all defeat a confident-looking result."], ["Why habitat matters", "Two visually similar species may occupy different regions or habitats. A result that ignores geography deserves more skepticism."], ["How to get better results", "Use sharp light, multiple angles, an uncropped subject and close details. Keep date and location metadata whenever privacy allows."]].map(([title, body], index) => <article key={title} className="border-l-2 border-sky-400/50 bg-gradient-to-r from-sky-500/10 to-transparent p-5"><span className="text-xs font-black text-sky-300">0{index + 1}</span><h3 className="mt-3 text-xl font-bold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-ink-200">{body}</p></article>)}</div><aside className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100"><strong>Safety note:</strong> Never use an app result alone to handle, eat or approach an unfamiliar species. Venomous animals, toxic plants and protected wildlife require expert guidance.</aside></section>}

            {managedFaq?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedFaq.html)}} /> : <section className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Common questions</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-5xl">Animal identification app FAQ</h2></div><div className="divide-y divide-line-300 rounded-[2rem] border border-line-300 bg-surface-900/60 px-5 md:px-8">{faq.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold text-white marker:hidden">{question}<span className="text-primary-400 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-base leading-7 text-ink-200">{answer}</p></details>)}</div></section>}

            {managedRelated?.html ? <div dangerouslySetInnerHTML={{__html: staticManagedHtml(managedRelated.html)}} /> : <section className="space-y-7"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Continue researching</p><h2 className="mt-2 font-display text-4xl font-bold text-white md:text-5xl">Related guides</h2></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{[["Best Bird Identification Apps", "/identify-birds"], ["Best Wildlife Apps", "/wildlife-discovery-app"], ["Best Nature Apps", "/learn-from-animals"], ["Best AI Scanner Apps", "/animal-identifier-app"], ["iNaturalist vs AnimalDex", "#inaturalist"], ["Seek vs AnimalDex", "#seek"], ["Merlin vs AnimalDex", "#merlin"]].map(([title, href], index) => href.startsWith("#") ? <a key={title} href={href} className="rounded-2xl border border-line-300 bg-surface-900/60 p-5 transition hover:border-primary-500/50"><span className="text-xs font-black text-ink-400">0{index + 1}</span><h3 className="mt-3 font-bold text-white">{title}</h3></a> : <Link key={title} href={href} className="rounded-2xl border border-line-300 bg-surface-900/60 p-5 transition hover:border-primary-500/50"><span className="text-xs font-black text-ink-400">0{index + 1}</span><h3 className="mt-3 font-bold text-white">{title}</h3></Link>)}</div></section>}

            <footer className="border-t border-line-300 pt-8"><h2 className="font-display text-2xl font-bold text-white">How we checked this guide</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-ink-300">Feature claims were checked against official product documentation in August 2026. AnimalDex behaviour—grade weightings, video frame consensus, species stats and tiers, and the nearest-place lookup—is described from the shipping product. The recommendation labels are editorial judgments based on audience fit, not identification-accuracy rankings; no universal accuracy percentage is credible across species, image quality and geography.</p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-primary-200"><a href="https://www.inaturalist.org/pages/community" target="_blank" rel="noreferrer">iNaturalist methodology ↗</a><a href="https://help.inaturalist.org/en/support/solutions/articles/151000169914-what-is-the-difference-between-inaturalist-and-seek-by-inaturalist-" target="_blank" rel="noreferrer">Seek comparison ↗</a><a href="https://merlin.allaboutbirds.org/" target="_blank" rel="noreferrer">Merlin features ↗</a><a href="https://lens.google/intl/en-GB/howlensworks/" target="_blank" rel="noreferrer">Google Lens methodology ↗</a><a href="https://www.picturethisai.com/" target="_blank" rel="noreferrer">PictureThis features ↗</a></div></footer>
        </article>
    );
}
