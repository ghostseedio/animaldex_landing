import type {Metadata} from "next";
import ArkAbout from "@/app/[locale]/(composited)/ark/ark-about";
import ArkView, {type ArkFixtureLife} from "@/app/[locale]/(composited)/ark/ark-view";
import {readPublicArk} from "@/data/ark-public";
import {readArkVoyage} from "@/data/ark-voyage";
import {localeConfig} from "@/i18n";
import {templateSafeTitle, withBrandSuffix} from "@/lib/brand-title";
import {arkFocusSlug, arkOgImagePath, arkSpeciesShare} from "@/lib/ark-seo";
import {fillArkWords} from "@/lib/ark-words";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {TALKING_MODELS_BASE_URL} from "@/lib/talking-models/catalog";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl} from "@/lib/store-links";
import {getArkWords} from "@/loaders/ark-words";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";

/**
 * /ark: the shared Ark (Ark v1 contract, section 5). Every animal in it came
 * aboard because someone's step from that animal's way worked.
 *
 * Public, read as the visitor (their own animals come back `mine`). Indexed
 * (Part 4d): under the world the page says in words what the Ark is, how
 * animals arrive and live, and who is aboard, rendered on the server
 * (`ark-about`). `?focus=` pages share a card of that species but keep /ark
 * as their canonical. The scene is `src/ark-scene`, loaded in the browser only.
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
 */

export const dynamic = "force-dynamic";

type Props = {params: {locale: string}; searchParams: {fixture?: string; focus?: string; hour?: string; since?: string; publicStory?: string}};

type FixtureMode = "full" | "early" | "grow";

function fixtureMode(searchParams: Props["searchParams"]): FixtureMode | null {
    const asked = searchParams.fixture;
    const development = process.env.NODE_ENV === "development";
    if (development && asked === "early") return "early";
    if (development && asked === "grow") return "grow";
    if (development && asked && asked !== "0") return "full";
    return process.env.NEXT_PUBLIC_ARK_FIXTURE === "1" ? "full" : null;
}

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

/** How long the share card's counts and the page's metadata may be cached (the scene itself refreshes every 45 s). */
const META_REVALIDATE_SECONDS = 300;

export async function generateMetadata({params, searchParams}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [{words}, snapshot] = await Promise.all([getArkWords(locale), readPublicArk(META_REVALIDATE_SECONDS)]);
    const seo = words.seo;
    // `?focus=<species>`: that species' card and title; the page itself stays /ark.
    const focus = arkFocusSlug(snapshot, typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 120) : null);
    const species = focus ? arkSpeciesShare(snapshot, focus) : null;
    const focusName = species?.name ?? null;
    const title = focusName ? fillArkWords(seo.metaFocusTitle, {animal: focusName}) : seo.metaTitle;
    const description = focusName ? fillArkWords(seo.metaFocusDescription, {animal: focusName}) : seo.metaDescription;
    const canonical = getLocalePath(locale, "/ark");
    const image = focusName && focus ? arkOgImagePath(focus, species?.count ?? 0) : arkOgImagePath(null, snapshot?.counts.animals ?? 0);
    const alt = focusName ?? words.eyebrow;
    return {
        title: templateSafeTitle(title),
        description,
        alternates: {
            canonical,
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, "/ark");
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/ark")} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: withBrandSuffix(title),
            description,
            url: canonical,
            siteName: "AnimalDex",
            images: [{url: image, width: 1200, height: 630, alt}]
        },
        twitter: {
            card: "summary_large_image",
            title: withBrandSuffix(title),
            description,
            images: [{url: image, alt}]
        }
    };
}

/**
 * The Ark as schema.org says it: a browser game (VideoGame, a simulation)
 * that is part of the AnimalDex app, and where it sits on the site.
 */
function arkJsonLd(locale: string, description: string, name: string, homeName: string, snapshot: ArkSnapshot | null) {
    const url = getAbsoluteUrl(locale, "/ark");
    const site = getSiteUrl();
    return [
        {
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name,
            url,
            description,
            inLanguage: locale,
            genre: ["Simulation"],
            gamePlatform: ["Web browser"],
            applicationCategory: "GameApplication",
            operatingSystem: "Any (web browser)",
            isAccessibleForFree: true,
            image: new URL(arkOgImagePath(null, snapshot?.counts.animals ?? 0), site).toString(),
            offers: {"@type": "Offer", price: "0", priceCurrency: "USD"},
            publisher: {"@type": "Organization", name: "AnimalDex", url: site},
            isPartOf: {
                "@type": "MobileApplication",
                name: "AnimalDex",
                operatingSystem: "iOS, Android",
                applicationCategory: "EducationApplication",
                url: site,
                installUrl: [appStoreUrl, googlePlayUrl]
            }
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: homeName, item: getAbsoluteUrl(locale)},
                {"@type": "ListItem", position: 2, name, item: url}
            ]
        }
    ];
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
    const locale = pageLocale(params.locale);
    const mode = fixtureMode(searchParams);
    const development = process.env.NODE_ENV === "development";
    const hour = development && searchParams.hour !== undefined ? Number(searchParams.hour) : NaN;
    const since = development && searchParams.since && !Number.isNaN(Date.parse(searchParams.since)) ? searchParams.since : null;
    const [{words, talk}, data] = await Promise.all([
        getArkWords(locale),
        mode ? loadFixture(mode).then((fixture) => ({fixture, read: null})) : readArkVoyage().then((read) => ({fixture: null, read}))
    ]);
    const snapshot = data.fixture?.snapshot ?? (data.read?.available ? data.read.snapshot : null);
    const fixtureLife = mode ? await loadFixtureLife() : null;
    // The words under the world: the snapshot the page drew (the same Ark for everyone; `mine` is never said there).
    const speciesPages = new Set((snapshot?.animals ?? []).map((animal) => animal.model_slug).filter((slug) => isPublishedAnimalSlug(slug)));
    return (
        <>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{__html: JSON.stringify(arkJsonLd(locale, words.seo.metaDescription, words.eyebrow, words.seo.breadcrumbHome, snapshot)).replace(/</g, "\\u003c")}}
        />
        <ArkView
            locale={locale}
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
            shareLocalePath={getLocalePath(locale, "/ark")}
        />
        <ArkAbout snapshot={snapshot} words={words} locale={locale} speciesPages={speciesPages} />
        </>
    );
}
