import type {Metadata} from "next";
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
 * every refresh, to see the entrances) or `?fixture=sizes` (the v2 fixture
 * plus a ladybird, a mouse, a giraffe, a blue whale and a flamingo: the size scale's ends)
 * or `?fixture=micro` (the v2 fixture plus small animals at their microhabitats:
 * geckos, spiders and moths on the cottage, ants, bees on flowers, beetles on bark...).
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

type FixtureMode = "full" | "early" | "grow" | "sizes" | "micro";

function fixtureMode(searchParams: Props["searchParams"]): FixtureMode | null {
    const asked = searchParams.fixture;
    const development = process.env.NODE_ENV === "development";
    if (development && asked === "early") return "early";
    if (development && asked === "grow") return "grow";
    if (development && asked === "sizes") return "sizes";
    if (development && asked === "micro") return "micro";
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
    if (mode === "sizes") return {snapshot: withSizeLineUp(full), full: null};
    if (mode === "micro") return {snapshot: withSmallAnimals(full), full: null};
    // Grow: the first few, then more on each refresh (the client takes them from `full`).
    const animals = full.animals.slice(0, 6);
    return {snapshot: {...full, animals, counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size}}, full};
}

/**
 * `?fixture=sizes`: the v2 fixture with the ends of the size scale aboard
 * (the stats addendum's screenshots): a ladybird at the floor, a house mouse,
 * a giraffe (taller than long), a blue whale and a flamingo, each in a slot of its own.
 */
function withSizeLineUp(full: ArkSnapshot): ArkSnapshot {
    const extra: Array<[string, string, ArkSnapshot["animals"][number]["zone"]]> = [
        ["seven-spot-ladybird", "Seven-spot Ladybird", "farm_garden"],
        ["house-mouse", "House Mouse", "farm_garden"],
        ["giraffe", "Giraffe", "grassland"],
        ["blue-whale", "Blue Whale", "open_ocean"],
        ["greater-flamingo", "Greater Flamingo", "wetland"]
    ];
    const animals = [...full.animals];
    extra.forEach(([slug, name, zone], i) => {
        const slot = Math.max(-1, ...animals.filter((a) => a.zone === zone).map((a) => a.slot ?? -1)) + 1;
        animals.push({
            id: `00000000-0000-4000-8000-00000000000${i}`,
            species_profile_id: `size-${slug}`,
            name,
            scientific_name: null,
            model_slug: slug,
            zone,
            arrived_at: "2026-11-01T12:00:00Z",
            brought_by: {label: "Voyager 1", named: false},
            mine: false,
            origin: "arrived",
            generation: 0,
            condition: "well_fed",
            born_ark_day: 3,
            activity: "any",
            sociality: "solitary",
            bringers: [{label: "Voyager 1", named: false}],
            slot,
            slot_rank: 0
        });
    });
    return {...full, animals, counts: {...full.counts, animals: animals.length, species: full.counts.species + extra.length}};
}

/**
 * `?fixture=micro`: the v2 fixture plus small animals at every kind of
 * microhabitat (docs/ark-micro.md): geckos, house spiders, flies, ants and
 * moths on the cottage (the moths circle the porch light at night), a
 * mouse round it, hoverflies and butterflies on the flowers, a honey bee
 * and an anole on bark, beetles and a millipede in the leaf litter, a wall
 * lizard on the stones, water striders and a newt on the water. A few are
 * the reader's own (for "My animals"). Three black ants share a slot.
 */
function withSmallAnimals(full: ArkSnapshot): ArkSnapshot {
    type Zone = ArkSnapshot["animals"][number]["zone"];
    type Activity = NonNullable<ArkSnapshot["animals"][number]["activity"]>;
    const extra: Array<[string, string, Zone, Activity, boolean, number?]> = [
        ["mediterranean-house-gecko", "Mediterranean House Gecko", "farm_garden", "nocturnal", true],
        ["tropical-house-gecko", "Tropical House Gecko", "farm_garden", "nocturnal", false],
        ["common-house-gecko", "Common House Gecko", "farm_garden", "nocturnal", false],
        ["mediterranean-house-gecko", "Mediterranean House Gecko", "farm_garden", "nocturnal", false],
        ["common-house-spider", "Common House Spider", "farm_garden", "any", false],
        ["common-house-spider", "Common House Spider", "farm_garden", "any", false],
        ["house-centipede", "House Centipede", "farm_garden", "nocturnal", false],
        ["house-fly", "House Fly", "farm_garden", "diurnal", false],
        ["black-ant", "Black Ant", "farm_garden", "diurnal", true, 3],
        ["red-ant", "Red Ant", "farm_garden", "diurnal", false],
        ["clothes-house-moth", "Clothes Moth", "farm_garden", "nocturnal", false],
        ["pantry-moth", "Pantry Moth", "farm_garden", "nocturnal", false],
        ["plume-moth", "Plume Moth", "farm_garden", "nocturnal", false],
        ["emerald-moth", "Emerald Moth", "woodland", "nocturnal", true],
        ["house-mouse", "House Mouse", "farm_garden", "nocturnal", false],
        ["marmalade-hoverfly", "Marmalade Hoverfly", "farm_garden", "diurnal", false],
        ["red-admiral", "Red Admiral", "farm_garden", "diurnal", false],
        ["giant-honey-bee", "Giant Honey Bee", "farm_garden", "diurnal", false],
        ["western-honey-bee", "Western Honey Bee", "farm_garden", "diurnal", false],
        ["green-anole", "Green Anole", "farm_garden", "diurnal", false],
        ["common-wall-lizard", "Common Wall Lizard", "farm_garden", "diurnal", false],
        ["earwig", "Earwig", "farm_garden", "nocturnal", false],
        ["firebug", "Firebug", "farm_garden", "diurnal", false],
        ["red-breasted-nuthatch", "Red-breasted Nuthatch", "woodland", "diurnal", false],
        ["yellow-spotted-millipede", "Yellow-spotted Millipede", "woodland", "nocturnal", false],
        ["carpenter-ant", "Carpenter Ant", "woodland", "any", false],
        ["water-strider", "Water Strider", "river_lake", "diurnal", false],
        ["damselfly", "Damselfly", "river_lake", "diurnal", false],
        ["smooth-newt", "Smooth Newt", "river_lake", "any", false],
        ["bumblebee", "Bumblebee", "grassland", "diurnal", false],
        ["six-spotted-tiger-beetle", "Six-spotted Tiger Beetle", "grassland", "diurnal", false]
    ];
    const animals = [...full.animals];
    extra.forEach(([slug, name, zone, activity, mine, many = 1], i) => {
        const slot = Math.max(-1, ...animals.filter((a) => a.zone === zone).map((a) => a.slot ?? -1)) + 1;
        for (let rank = 0; rank < many; rank++) {
            animals.push({
                id: `00000000-0000-4000-9000-${String(i * 10 + rank).padStart(12, "0")}`,
                species_profile_id: `micro-${slug}`,
                name,
                scientific_name: null,
                model_slug: slug,
                zone,
                arrived_at: "2026-11-01T12:00:00Z",
                brought_by: {label: mine ? "You" : "Voyager 1", named: false},
                mine,
                origin: "arrived",
                generation: 0,
                condition: "well_fed",
                born_ark_day: 3,
                activity,
                sociality: many > 1 ? "group" : "solitary",
                bringers: [{label: "Voyager 1", named: false}],
                slot,
                slot_rank: rank
            });
        }
    });
    return {...full, animals, counts: {...full.counts, animals: animals.length, species: full.counts.species + extra.length}};
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
