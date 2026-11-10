import type {Metadata} from "next";
import ArkView, {type ArkWords} from "@/app/[locale]/(composited)/ark/ark-view";
import {readArkVoyage} from "@/data/ark-voyage";
import {TALKING_MODELS_BASE_URL} from "@/lib/talking-models/catalog";
import {getLocalePath} from "@/lib/site";
import {loadLocaleMessages} from "@/loaders/locale";
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
 */

export const dynamic = "force-dynamic";

type Props = {params: {locale: string}; searchParams: {fixture?: string}};

type FixtureMode = "full" | "early" | "grow";

function fixtureMode(searchParams: Props["searchParams"]): FixtureMode | null {
    const asked = searchParams.fixture;
    const development = process.env.NODE_ENV === "development";
    if (development && asked === "early") return "early";
    if (development && asked === "grow") return "grow";
    if (development && asked && asked !== "0") return "full";
    return process.env.NEXT_PUBLIC_ARK_FIXTURE === "1" ? "full" : null;
}

const EN_FALLBACK_LOCALE = "en";

async function arkWords(locale: string): Promise<{words: ArkWords; talk: {a: string; an: string}}> {
    const [english, local] = await Promise.all([
        loadLocaleMessages(EN_FALLBACK_LOCALE),
        locale === EN_FALLBACK_LOCALE ? Promise.resolve(null) : loadLocaleMessages(locale).catch(() => null)
    ]);
    // Other locales fall back to English key by key.
    const pick = (path: string[]): unknown => {
        const read = (messages: Record<string, unknown> | null) => path.reduce<unknown>((at, key) => (at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined), messages);
        return read(local) ?? read(english);
    };
    const englishArk = english.ark as Record<string, unknown>;
    const words = Object.fromEntries(Object.entries(englishArk).map(([key, value]) => {
        if (value && typeof value === "object") {
            return [key, Object.fromEntries(Object.keys(value).map((inner) => [inner, String(pick(["ark", key, inner]) ?? "")]))];
        }
        return [key, String(pick(["ark", key]) ?? "")];
    })) as ArkWords;
    return {words, talk: {a: String(pick(["talkPage", "animalTitleA"]) ?? "Talk to a {animal}"), an: String(pick(["talkPage", "animalTitleAn"]) ?? "Talk to an {animal}")}};
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {words} = await arkWords(params.locale);
    return {
        title: words.metaTitle,
        description: words.metaDescription,
        alternates: {canonical: getLocalePath(params.locale, "/ark")},
        robots: {index: false, follow: false, googleBot: {index: false, follow: false}}
    };
}

async function loadFixture(mode: FixtureMode): Promise<{snapshot: ArkSnapshot; full: ArkSnapshot | null}> {
    const full = (await import("@/ark-scene/fixtures/snapshot.json")).default as unknown as ArkSnapshot;
    if (mode === "full") return {snapshot: full, full: null};
    if (mode === "early") return {snapshot: (await import("@/ark-scene/fixtures/snapshot-early.json")).default as unknown as ArkSnapshot, full: null};
    // Grow: the first few, then more on each refresh (the client takes them from `full`).
    const animals = full.animals.slice(0, 6);
    return {snapshot: {...full, animals, counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size}}, full};
}

function modelBase(): string {
    const configured = process.env.NEXT_PUBLIC_ARK_MODELS_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    return process.env.NODE_ENV === "development" ? "/api/dev/ark-models/v1/ark" : `${TALKING_MODELS_BASE_URL}/ark`;
}

export default async function ArkPage({params, searchParams}: Props) {
    const mode = fixtureMode(searchParams);
    const [{words, talk}, data] = await Promise.all([
        arkWords(params.locale),
        mode ? loadFixture(mode).then((fixture) => ({fixture, read: null})) : readArkVoyage().then((read) => ({fixture: null, read}))
    ]);
    const snapshot = data.fixture?.snapshot ?? (data.read?.available ? data.read.snapshot : null);
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
        />
    );
}
