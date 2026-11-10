import type {Metadata} from "next";
import ArkRecordView from "@/app/[locale]/(composited)/ark/ark-record-view";
import ArkView, {type ArkFixtureLife} from "@/app/[locale]/(composited)/ark/ark-view";
import {readArkVoyage} from "@/data/ark-voyage";
import {TALKING_MODELS_BASE_URL} from "@/lib/talking-models/catalog";
import {getLocalePath} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";

/**
 * /ark: the shared Ark (Ark v1 contract, section 5). Every animal in it came
 * aboard because someone's step from that animal's way worked.
 *
 * Public, read as the visitor (their own animals come back `mine`), and kept
 * out of search until launch. The scene is `src/ark-scene`, loaded in the
 * browser only.
 *
 * Local testing before the migration is applied: `NEXT_PUBLIC_ARK_FIXTURE=1`,
 * or in development `?fixture=1` (about 120 animals), `?fixture=early` (the
 * two real arrivals) or `?fixture=grow` (starts small; more come aboard on
 * every refresh, to see the entrances).
 *
 * `?focus=<species_profile_id or slug>` flies to that species on load (the
 * capture page's "See it in the Ark"), the reader's own one first.
 *
 * Life v2 in development: `?fixture=1` is the v2 fixture (born young,
 * condition, activity, sociality) with its event log and life stories
 * (`scripts/generate-ark-life-fixtures.mts`, in the server's shapes). `?hour=5.5` pins the light's
 * hour (dawn), `?since=2026-11-08T12:00:00Z` replays "while you were away"
 * from then on (otherwise from the last visit, kept in localStorage), and
 * `?publicStory=1` lets the fixture's public-debate stories through, as the
 * server's `public_story` flag would.
 *
 * `?record=1` (development, or a server with `ARK_RECORD_ENABLED=1`): the
 * Ark alone for the marketing clip recorder (`scripts/ark-clips.mts`), its
 * camera and clock driven by `window.__arkDirector`. With `?fixture=1` it is
 * the fixture (samples only); otherwise the live Ark.
 */

export const dynamic = "force-dynamic";

type Props = {params: {locale: string}; searchParams: {fixture?: string; focus?: string; hour?: string; since?: string; publicStory?: string; record?: string}};

type FixtureMode = "full" | "early" | "grow";

function fixtureMode(searchParams: Props["searchParams"]): FixtureMode | null {
    const asked = searchParams.fixture;
    const development = process.env.NODE_ENV === "development";
    if (development && asked === "early") return "early";
    if (development && asked === "grow") return "grow";
    if (development && asked && asked !== "0") return "full";
    return process.env.NEXT_PUBLIC_ARK_FIXTURE === "1" ? "full" : null;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {words} = await getArkWords(params.locale);
    return {
        title: words.metaTitle,
        description: words.metaDescription,
        alternates: {canonical: getLocalePath(params.locale, "/ark")},
        robots: {index: false, follow: false, googleBot: {index: false, follow: false}}
    };
}

async function loadFixture(mode: FixtureMode): Promise<{snapshot: ArkSnapshot; full: ArkSnapshot | null}> {
    // The fixtures are the server's answers verbatim (scripts/ark-life-fixtures-from-server.mts): decoded as the live ones are.
    const full = decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot-v2.json")).default)!;
    if (mode === "full") return {snapshot: full, full: null};
    if (mode === "early") return {snapshot: decodeArkSnapshot((await import("@/ark-scene/fixtures/snapshot-early.json")).default)!, full: null};
    // Grow: the first few, then more on each refresh (the client takes them from `full`).
    const animals = full.animals.slice(0, 6);
    return {snapshot: {...full, animals, counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size}}, full};
}

function modelBase(): string {
    const configured = process.env.NEXT_PUBLIC_ARK_MODELS_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    return process.env.NODE_ENV === "development" ? "/api/dev/ark-models/v1/ark" : `${TALKING_MODELS_BASE_URL}/ark`;
}

/** The fixture's event log and life stories, as the server's reads would answer. */
async function loadFixtureLife(): Promise<ArkFixtureLife> {
    const [events, lives] = await Promise.all([import("@/ark-scene/fixtures/events.json"), import("@/ark-scene/fixtures/lives.json")]);
    return {events: events.default as unknown, lives: lives.default as unknown as Record<string, unknown>};
}

export default async function ArkPage({params, searchParams}: Props) {
    const mode = fixtureMode(searchParams);
    const development = process.env.NODE_ENV === "development";
    const hour = development && searchParams.hour !== undefined ? Number(searchParams.hour) : NaN;
    const since = development && searchParams.since && !Number.isNaN(Date.parse(searchParams.since)) ? searchParams.since : null;
    const [{words, talk}, data] = await Promise.all([
        getArkWords(params.locale),
        mode ? loadFixture(mode).then((fixture) => ({fixture, read: null})) : readArkVoyage().then((read) => ({fixture: null, read}))
    ]);
    const snapshot = data.fixture?.snapshot ?? (data.read?.available ? data.read.snapshot : null);
    const fixtureLife = mode ? await loadFixtureLife() : null;
    const record = searchParams.record === "1" && (development || process.env.ARK_RECORD_ENABLED === "1");
    if (record && snapshot) return <ArkRecordView initial={snapshot} fixture={Boolean(mode)} modelBase={modelBase()} events={fixtureLife?.events ?? null} />;
    return (
        <ArkView
            locale={params.locale}
            initial={snapshot}
            growFrom={data.fixture?.full ?? null}
            fixture={Boolean(mode)}
            signedIn={data.read?.signedIn ?? false}
            words={words}
            talkTitles={talk}
            modelBase={modelBase()}
            focus={typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 120) : null}
            fixtureLife={fixtureLife}
            hours={Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 24) : null}
            since={since}
            publicStory={Boolean(mode) && searchParams.publicStory === "1"}
        />
    );
}
