import type {Metadata} from "next";
import {notFound, permanentRedirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {readArkVoyage, type ArkVoyageRead} from "@/data/ark-voyage";
import {readArkFounder} from "@/data/ark-founders";
import {arkFounderStories, arkFoundersOf, ARK_NO_FOUNDERS, type ArkFounderPage, type ArkFounders} from "@/lib/ark-founders";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {getCompanionWords} from "@/loaders/companion-words";
import {getProfileViewerState} from "@/data/profile-authenticated";
import {getPublicArkSummary, getPublicProfileCard, normalizePublicHandle} from "@/data/public-profiles";
import {arkPersonView, arkScoreShare} from "@/lib/ark-world";
import {fillArkWords} from "@/lib/ark-words";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {getAbsoluteUrl, getLocalePath} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";

/**
 * /u/{handle}/ark (Ark 3.3, docs/ark-next.md Part 3): one person's animals in
 * the shared Ark, opened from their profile's Ark Score card and by the
 * apps' deep link.
 *
 * Privacy as the spec (anonymous by default, names only by opt-in): the
 * Ark is read as the visitor, so your own page lists your animals (with the
 * label others see on them); someone else's lists theirs only when they
 * chose to show their name on the Ark; otherwise it says they travel
 * anonymously and shows only their Ark Score (public, as on their profile)
 * and the whole Ark's counts. Never which step, problem or chat brought one.
 *
 * Founders (founders contract, section 5): while the server's
 * `founder_names` switch is on, `voyage_founder_v1` lists the arrivals they
 * are named on with the stories they chose to share, under "How their
 * animals got aboard". It answers null with the switch off (or before the
 * migration), and the page is then exactly as before.
 */

export const dynamic = "force-dynamic";

type Props = {params: {locale: string; handle: string}; searchParams?: {fixture?: string}};

/**
 * Development only: `?fixture=self` (your own page, the fixture Ark's three
 * `mine` animals), `?fixture=named` (someone who shows their name: one
 * Voyager's animals named as them), `?fixture=anonymous`, `?fixture=founder`
 * (names on: Voyager 1's animals named as them, with their shared stories).
 */
async function fixtureRead(mode: string | undefined, username: string): Promise<{snapshot: ArkSnapshot; isSelf: boolean; founders?: ArkFounders; founderPage?: ArkFounderPage} | null> {
    if (process.env.NODE_ENV !== "development" || !mode) return null;
    if (mode === "founder") {
        const fixture = await import("@/lib/ark-founders-fixture");
        const raw = fixture.withArkFixtureFounders((await import("@/ark-scene/fixtures/snapshot.json")).default);
        const named = decodeArkSnapshot(raw);
        if (!named) return null;
        const maya = fixture.ARK_FIXTURE_FOUNDERS["Voyager 1"];
        // The fixture's founder is the page's person: their handle on the animals they are named on.
        const founders = arkFoundersOf(raw);
        const animals = Object.fromEntries(Object.entries(founders.animals).map(([id, entry]) => [id, {...entry, brought_by: entry.brought_by?.handle === maya.handle ? {...maya, handle: username} : entry.brought_by}]));
        const page = fixture.fixtureArkFounderPage(maya.handle);
        return {snapshot: named, isSelf: false, founders: {...founders, animals}, founderPage: {...page, founder: page.founder ? {...page.founder, handle: username} : null}};
    }
    const snapshot = decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot.json")).default);
    if (!snapshot) return null;
    if (mode === "self") return {snapshot, isSelf: true};
    if (mode === "named") {
        const label = snapshot.animals[0]?.brought_by.label;
        return {
            snapshot: {...snapshot, animals: snapshot.animals.map((animal) => (animal.brought_by.label === label ? {...animal, brought_by: {label: username, named: true}} : animal))},
            isSelf: false
        };
    }
    return {snapshot: {...snapshot, animals: snapshot.animals.map((animal) => ({...animal, mine: false}))}, isSelf: false};
}

function arkPath(handle: string) {
    return `/u/${encodeURIComponent(handle)}/ark`;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const handle = normalizePublicHandle(params.handle);
    if (!handle) return {};
    const [profile, {words}] = await Promise.all([getPublicProfileCard(handle), getArkWords(params.locale)]);
    if (!profile) return {};
    const url = getAbsoluteUrl(params.locale, arkPath(profile.username));
    return {
        title: fillArkWords(words.person.metaTitle, {name: profile.displayName}),
        description: words.metaDescription,
        alternates: {canonical: getLocalePath(params.locale, arkPath(profile.username))},
        robots: {index: false, follow: true},
        other: {"apple-itunes-app": `app-id=6761607780, app-argument=${url}`},
        appLinks: {
            ios: {url, app_store_id: "6761607780", app_name: "AnimalDex"},
            android: {url, package: "app.animaldex", app_name: "AnimalDex"}
        }
    };
}

export default async function PersonArkPage({params, searchParams}: Props) {
    const handle = normalizePublicHandle(params.handle);
    if (!handle) notFound();
    const profile = await getPublicProfileCard(handle);
    if (!profile) notFound();
    if (profile.username.toLowerCase() !== handle) permanentRedirect(getLocalePath(params.locale, arkPath(profile.username)));

    const [viewer, live, summary, {words}, companion, fixture, founderRead] = await Promise.all([
        getProfileViewerState(profile.userId),
        readArkVoyage(),
        getPublicArkSummary(profile.userId).catch(() => null),
        getArkWords(params.locale),
        getCompanionWords(params.locale),
        fixtureRead(searchParams?.fixture, profile.username),
        readArkFounder(profile.username)
    ]);
    const read: ArkVoyageRead = fixture ? {available: true, snapshot: fixture.snapshot, founders: fixture.founders ?? ARK_NO_FOUNDERS, signedIn: true} : live;
    // Founders: null while the server names nobody (switch off, or before the migration): the page as before.
    const founderPage = fixture ? fixture.founderPage ?? null : founderRead;
    const founders = read.available ? read.founders : ARK_NO_FOUNDERS;
    const person = words.person;
    const isSelf = fixture ? fixture.isSelf : viewer.isOwner;
    const view = read.available
        ? arkPersonView(read.snapshot.animals, {isSelf, username: profile.username, founderHandle: (animal) => founders.animals[animal.id]?.brought_by?.handle ?? null})
        : null;
    // Only a named founder's page lists stories: an anonymous Voyager's are never tied to a profile.
    const stories = founderPage?.founder ? arkFounderStories(founderPage) : null;
    const number = (value: number) => new Intl.NumberFormat(params.locale).format(value);
    const count = (value: number, one: string, other: string) => fillArkWords(value === 1 ? one : other, {count: number(value)});
    const dateFormat = new Intl.DateTimeFormat(params.locale, {day: "numeric", month: "short", year: "numeric"});
    const profileHref = `/u/${encodeURIComponent(profile.username)}`;

    return (
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 md:px-8 md:py-16" data-testid="person-ark">
            <Link href={profileHref} className="self-start text-[13px] font-semibold text-ink-300 hover:text-white">
                <span aria-hidden="true">←</span> {person.back}
            </Link>
            <header className="flex flex-col gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary-300">{words.eyebrow}</p>
                <h1 className="font-display text-3xl font-bold text-white md:text-4xl">
                    {isSelf ? person.titleSelf : fillArkWords(person.title, {name: profile.displayName})}
                </h1>
                <p className="text-sm text-white/50">@{profile.username}</p>
            </header>

            {summary ? (
                <section className="border border-white/10 bg-white/[0.03] px-[18px] py-5" data-testid="person-ark-score">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/40">{companion.ark.score}</p>
                    <p className="mt-1 flex items-baseline gap-2">
                        <span className="font-display text-[44px] font-black leading-none tabular-nums text-primary-400">{number(summary.score.value)}</span>
                        <span className="text-sm font-semibold text-white/40">{fillArkWords(person.outOf, {max: summary.score.outOf})}</span>
                    </p>
                    <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary-400" style={{width: `${arkScoreShare(summary.score)}%`}} />
                    </span>
                    {summary.score.world ? <p className="mt-2 text-[12px] leading-4 text-white/50">{isSelf ? person.scoreAboutSelf : person.scoreAbout}</p> : null}
                </section>
            ) : null}

            {!view ? (
                <p className="text-sm text-white/60">{words.unavailable}</p>
            ) : view.kind === "anonymous" ? (
                <section className="flex flex-col gap-2 border border-white/10 bg-white/[0.03] px-[18px] py-5" data-testid="person-ark-anonymous">
                    <h2 className="text-[15px] font-bold text-white">{person.anonymousTitle}</h2>
                    <p className="text-[13px] leading-5 text-white/65">{fillArkWords(person.anonymousBody, {name: profile.displayName})}</p>
                </section>
            ) : (
                <section className="flex flex-col gap-3" data-testid="person-ark-listed">
                    {view.animals > 0 ? (
                        <p className="text-[13px] font-semibold text-white/70">
                            {fillArkWords(person.summary, {
                                animals: count(view.animals, words.animalsOne, words.animalsOther),
                                species: count(view.species.length, words.speciesOne, words.speciesOther)
                            })}
                        </p>
                    ) : (
                        <p className="text-[13px] leading-5 text-white/65">{person.noneSelf}</p>
                    )}
                    {view.self && view.animals > 0 ? (
                        <p className="text-[12px] leading-[18px] text-white/45" data-testid="person-ark-privacy">
                            {view.named ? person.selfNamed : fillArkWords(person.selfPrivate, {label: view.label ?? ""})}
                        </p>
                    ) : null}
                    <ul className="flex flex-col border-t border-white/[0.06]">
                        {view.species.map((species) => (
                            <li key={species.speciesProfileId || species.slug} className="flex items-center gap-3 border-b border-white/[0.06] py-3" data-testid="person-ark-species">
                                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6f1e7]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={getSpeciesArtworkUrl(species.slug)} alt="" width={44} height={44} className="h-[82%] w-[82%] object-contain" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-semibold text-white">
                                        {species.name}
                                        {species.count > 1 ? <span className="ml-1.5 text-[13px] font-bold text-primary-300">×{number(species.count)}</span> : null}
                                    </p>
                                    {species.since ? (
                                        <p className="text-[12px] text-white/45">{fillArkWords(person.since, {date: dateFormat.format(new Date(species.since))})}</p>
                                    ) : null}
                                </div>
                                <Link
                                    href={`/ark?focus=${encodeURIComponent(species.speciesProfileId || species.slug)}`}
                                    className="shrink-0 rounded-full border border-white/14 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-200"
                                >
                                    {person.see}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {stories ? (
                <section className="flex flex-col gap-3" aria-labelledby="person-ark-stories" data-testid="person-ark-stories">
                    <h2 id="person-ark-stories" className="text-[15px] font-bold text-white">{words.founders.founder.storiesTitle}</h2>
                    {stories.length === 0 ? (
                        <p className="text-[13px] leading-5 text-white/60" data-testid="person-ark-no-stories">{words.founders.founder.noStories}</p>
                    ) : (
                        <ul className="flex flex-col border-t border-white/[0.06]">
                            {stories.map((animal) => (
                                <li key={animal.id} className="flex items-start gap-3 border-b border-white/[0.06] py-3.5" data-testid="person-ark-story">
                                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6f1e7]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={getSpeciesArtworkUrl(animal.model_slug ?? "")} alt="" width={44} height={44} className="h-[82%] w-[82%] object-contain" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-white">
                                            {animal.name}
                                            {animal.arrived_at ? <span className="text-[12px] font-normal text-white/45">{fillArkWords(person.since, {date: dateFormat.format(new Date(animal.arrived_at))})}</span> : null}
                                        </p>
                                        <p className="mt-1 text-[14px] leading-5 text-white/85">{animal.story.step}</p>
                                        {animal.story.problem ? <p className="mt-1 text-[13px] italic leading-5 text-white/55">{`\u201C${animal.story.problem}\u201D`}</p> : null}
                                    </div>
                                    <Link
                                        href={`/ark?focus=${encodeURIComponent(animal.species_profile_id || animal.model_slug || "")}`}
                                        className="shrink-0 rounded-full border border-white/14 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-200"
                                    >
                                        {person.see}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ) : null}

            {read.available ? (
                <footer className="flex flex-col gap-3 border-t border-white/10 pt-5">
                    <p className="text-[13px] text-white/55">
                        {fillArkWords(person.arkLine, {
                            animals: count(read.snapshot.counts.animals, words.animalsOne, words.animalsOther),
                            species: count(read.snapshot.counts.species, words.speciesOne, words.speciesOther),
                            founders: count(read.snapshot.counts.founders, words.foundersOne, words.foundersOther)
                        })}
                    </p>
                    <Link href="/ark" className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-full bg-primary-400 px-5 text-[13px] font-bold text-canvas-950 transition-colors hover:bg-primary-300" data-testid="person-ark-open">
                        {person.openArk}
                        <span aria-hidden="true">→</span>
                    </Link>
                </footer>
            ) : null}
        </article>
    );
}
