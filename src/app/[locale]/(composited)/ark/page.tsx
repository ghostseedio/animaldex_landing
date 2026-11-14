import type {Metadata} from "next";
import ArkRecordView from "@/app/[locale]/(composited)/ark/ark-record-view";
import ArkAbout from "@/app/[locale]/(composited)/ark/ark-about";
import ArkSeoSummary from "@/app/[locale]/(composited)/ark/ark-seo-summary";
import ArkIntro, {ARK_INTRO_HEIGHT} from "@/app/[locale]/(composited)/ark/ark-intro";
import {readArkRecentArrivals} from "@/data/ark-recent-arrivals";
import {getPageWords, word} from "@/loaders/page-words";
import {ABOUT_PATH, ARK_FOOD_CHAIN_PATH, ARK_HOW_IT_WORKS_PATH, ARK_RENDER_IMAGE} from "@/lib/seo/ark-pages";
import {clampMetaDescription} from "@/lib/seo/page-metadata";
import {arkJsonLd, breadcrumbJsonLd, jsonLdHtml, siteNavigationJsonLd, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import ArkView, {type ArkFixtureLife} from "@/app/[locale]/(composited)/ark/ark-view";
import {readPublicArk} from "@/data/ark-public";
import {readArkVoyage} from "@/data/ark-voyage";
import {localeConfig} from "@/i18n";
import {templateSafeTitle, withBrandSuffix} from "@/lib/brand-title";
import {arkFocusSlug, arkOgImagePath, arkSpeciesShare} from "@/lib/ark-seo";
import {fillArkWords} from "@/lib/ark-words";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {TALKING_MODELS_BASE_URL} from "@/lib/talking-models/catalog";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";
import {getArkWords} from "@/loaders/ark-words";
import {arkDirection} from "@/lib/ark-languages";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkFoundersOf, ARK_NO_FOUNDERS, type ArkFounders} from "@/lib/ark-founders";
import {arkLocalSnapshotOf, arkLocalSnapshotPath} from "@/lib/ark-local-snapshot";
import {rigBaseFrom} from "@/ark-scene/rig-clips";
import {arkPageSummary} from "@/lib/ark-page-summary";

/**
 * /ark: the shared Ark (Ark v1 contract, section 5). Every animal in it came
 * aboard with someone's capture (or, before captures did, after a step that
 * worked); steps keep them thriving.
 *
 * Public. The server renders from the public read (cached, decision 246); the
 * client then reads the Ark as the visitor (their own animals come back
 * `mine`) after the first paint, behind a poster frame of the world. Indexed
 * (Part 4d): under the world the page says in words what the Ark is, how
 * animals arrive and live, and who is aboard, rendered on the server
 * (`ark-about`). `?focus=` pages share a card of that species but keep /ark
 * as their canonical. The scene is `src/ark-scene`, loaded in the browser only.
 *
 * Real data only by default (owner, 2026-11-11: "only use real player data and animals"): the page reads the
 * live Ark, and nothing made-up shows unless a development parameter asks for it. Production never shows a
 * fixture (there is no environment switch for one).
 *
 * In development, `?snapshot=/ark-local/real.json`: a snapshot file under /public (gitignored `public/ark-local/`)
 * read as the Ark's answer, founders and all (`src/lib/ark-local-snapshot.ts`): the real population before the
 * captures backfill runs in production. The live log reads the real event log beside it; nothing is made up.
 *
 * Made-up data, development only: `?fixture=1` (about 120 animals), `?fixture=early` (the
 * two real arrivals) or `?fixture=grow` (starts small; more come aboard on
 * every refresh, to see the entrances) or `?fixture=sizes` (the v2 fixture
 * plus a ladybird, a mouse, a giraffe, a blue whale and a flamingo: the size scale's ends)
 * or `?fixture=micro` (the v2 fixture plus small animals at their microhabitats:
 * geckos, spiders and moths on the cottage, ants, bees on flowers, beetles on bark...)
 * or `?fixture=layers` (that plus the vertical layers: primates, a sloth and birds in the
 * canopy, moles underground, crabs and an octopus on the reef floor, the deep's fish, a whale shark).
 *
 * The edge cases (docs/ark-next.md part 8), in development: `?fixture=herd1000`
 * (1,000 Plains Zebras, A14), `?fixture=herd5` (1,000 over five species),
 * `?fixture=placeholder` (species with no Ark model, A13) and `?fixture=eggs`
 * (clutches laid and hatching, A9; add `&since=2026-11-08T00:00:00Z` to replay them).
 *
 * `?focus=<species_profile_id or slug>` flies to that species on load (the
 * capture page's "See it in the Ark"), the reader's own one first.
 *
 * Life v2 in development: `?fixture=1` is the v2 fixture (born young,
 * condition, activity, sociality; and, captures + thrive, each animal's
 * `thrive` band, `area`, `source` and its life story's family line,
 * `src/lib/ark-thrive-fixture.ts`) with its event log and life stories
 * (`scripts/generate-ark-life-fixtures.mts`, in the server's shapes). `?hour=5.5` pins the light's
 * hour (dawn), `?since=2026-11-08T12:00:00Z` replays "while you were away"
 * from then on (otherwise from the last visit, kept in localStorage), and
 * `?publicStory=1` lets the fixture's public-debate stories through, as the
 * server's `public_story` flag would. Every `?fixture=` answers as the server
 * does with names on (owner, 2026-11-11): bringers as their @usernames
 * (@mayachen with a shared story, @lendawg, …; two stay Voyagers), and
 * `&founders=0` as a server that names nobody (`src/lib/ark-founders-fixture.ts`).
 *
 * `?record=1` (development, or a server with `ARK_RECORD_ENABLED=1`): the
 * Ark alone for the marketing clip recorder (`scripts/ark-clips.mts`), its
 * camera and clock driven by `window.__arkDirector`. With `?fixture=1` it is
 * the fixture (samples only); otherwise the live Ark.
 *
 * The live log and bars in development: `&feed=1` (or `?fixture=live`) runs a made-up feed over the fixture,
 * what a running tick would send (arrivals, births, clutches, meals, deaths), a beat every 8 s
 * (`src/lib/ark-live-fixture.ts`); `?fixture=grow` runs it by default (`&feed=0`: the old growth only).
 *
 * `?lang=<app language>` (any of the apps' 44, e.g. `ja`, `ar`, `zh-Hant`)
 * shows the Ark's words in that language from its Ark-only bundle
 * (`src/lib/ark-languages.ts`), English key by key, right to left where it reads so.
 */

/*
 * Not `force-dynamic` (decision 246): that also turned off Next's data cache, so every request read the whole live
 * Ark (2-3 s) and handed it to the client as 4 MB of props. Now the server reads the public Ark from the data cache
 * (`readPublicArk`, stale-while-revalidate, PUBLIC_REVALIDATE_SECONDS) for the words under the world, the metadata
 * and the first paint's counts; the client reads the visitor's own Ark (`/api/ark/voyage`) after the first paint.
 * The page stays dynamic for its query (`?focus=` cards, `?lang=`), but its render is cheap.
 */

type Props = {params: {locale: string}; searchParams: {fixture?: string; snapshot?: string; islands?: string; island?: string; focus?: string; hour?: string; since?: string; publicStory?: string; record?: string; lang?: string; rig?: string; rigv?: string; models?: string; founders?: string; feed?: string}};

type FixtureMode = "full" | "early" | "grow" | "sizes" | "micro" | "layers" | "herd1000" | "herd5" | "placeholder" | "eggs";

const EDGE_MODES = new Set<FixtureMode>(["herd1000", "herd5", "placeholder", "eggs"]);

function fixtureMode(searchParams: Props["searchParams"]): FixtureMode | null {
    const asked = searchParams.fixture;
    const development = process.env.NODE_ENV === "development";
    if (development && asked === "early") return "early";
    if (development && asked === "grow") return "grow";
    if (development && asked === "sizes") return "sizes";
    if (development && asked === "micro") return "micro";
    if (development && asked === "layers") return "layers";
    if (development && asked && EDGE_MODES.has(asked as FixtureMode)) return asked as FixtureMode;
    if (development && asked && asked !== "0") return "full";
    // (No environment switch: production never shows the fixture.)
    return null;
}

/**
 * Development's `?snapshot=<path under /public>`: that file read as the Ark's answer (`src/lib/ark-local-snapshot.ts`),
 * or null (production, a path that is not a plain .json under /public, a file that is missing or does not decode).
 */
async function readLocalArk(asked: string | undefined, islandsAsked?: string): Promise<{snapshot: ArkSnapshot; founders: ArkFounders} | null> {
    const local = arkLocalSnapshotPath(asked, process.env.NODE_ENV === "development");
    if (!local) return null;
    const [{readFile}, path] = await Promise.all([import("fs/promises"), import("path")]);
    const root = path.join(process.cwd(), "public");
    const file = path.join(root, local);
    if (!file.startsWith(root + path.sep)) return null;
    try {
        const raw = JSON.parse(await readFile(file, "utf8"));
        // Part C preview, development only: `&islands=/ark-local/islands-routing.json` (T1's routing from a rolled-back
        // switch-on) merged by id at read time, as the server's read will carry it once `islands` is on. Never written.
        const routing = arkLocalSnapshotPath(islandsAsked, true);
        const routingFile = routing ? path.join(root, routing) : null;
        if (routingFile && routingFile.startsWith(root + path.sep)) {
            const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
            const {merged, matched} = mergeArkIslandsRouting(raw, JSON.parse(await readFile(routingFile, "utf8")));
            console.info(`/ark?snapshot=${local}&islands=${routing}: ${matched} animals given their island`);
            return arkLocalSnapshotOf(merged);
        }
        return arkLocalSnapshotOf(raw);
    } catch (error) {
        console.warn(`/ark?snapshot=${local}: not read (${(error as Error).message}); the live Ark instead`);
        return null;
    }
}

/** `?lang=`: the app language asked for, if any (the site locale otherwise). */
function langOf(searchParams: Props["searchParams"]): string | null {
    return typeof searchParams.lang === "string" ? searchParams.lang.slice(0, 35) : null;
}

function pageLocale(locale: string) {
    return localeConfig.locales.includes(locale) ? locale : localeConfig.defaultLocale;
}

/**
 * How long the public read behind the page may be served from cache: the metadata, the share card's counts, the words
 * under the world and the first paint's counts (the client reads the live Ark itself after the first paint).
 */
const PUBLIC_REVALIDATE_SECONDS = 60;

export async function generateMetadata({params, searchParams}: Props): Promise<Metadata> {
    const locale = pageLocale(params.locale);
    const [{words}, snapshot] = await Promise.all([getArkWords(locale, langOf(searchParams)), readPublicArk(PUBLIC_REVALIDATE_SECONDS)]);
    const seo = words.seo;
    // `?focus=<species>`: that species' card and title; the page itself stays /ark.
    const focus = arkFocusSlug(snapshot, typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 120) : null);
    const species = focus ? arkSpeciesShare(snapshot, focus) : null;
    const focusName = species?.name ?? null;
    const title = focusName ? fillArkWords(seo.metaFocusTitle, {animal: focusName}) : seo.metaTitle;
    // Cut to what a result shows (the Indonesian one ran to 172 characters).
    const description = clampMetaDescription(focusName ? fillArkWords(seo.metaFocusDescription, {animal: focusName}) : seo.metaDescription);
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
 * The Ark as schema.org says it (SEO lane S3, S1's D5): the page, a free browser simulation (WebApplication) that is
 * part of the AnimalDex app, where it sits on the site, and its own links as navigation (2026-11-14: someone searching
 * "animaldex ark" should land here, with the pages about it as sitelinks). Named "AnimalDex Ark", "The Ark" as its
 * other name.
 */
function arkPageJsonLd(input: {locale: string; title: string; description: string; name: string; alternateName: string; homeName: string; links: Array<{name: string; path: string}>}): JsonLd[] {
    const {locale, name} = input;
    return [
        webPageJsonLd({locale, path: "/ark", name: input.title, description: input.description, image: ARK_RENDER_IMAGE, mainEntity: {"@type": "WebApplication", "@id": `${getAbsoluteUrl("en", "/ark")}#ark`, name}}),
        arkJsonLd({locale, name, alternateName: input.alternateName, description: input.description, image: ARK_RENDER_IMAGE}),
        breadcrumbJsonLd(locale, [{name: input.homeName, path: "/"}, {name, path: "/ark"}]),
        siteNavigationJsonLd(locale, input.links)
    ];
}

async function loadFixture(mode: FixtureMode, founders: boolean): Promise<{snapshot: ArkSnapshot; full: ArkSnapshot | null; founders: ArkFounders}> {
    const named = founders ? (await import("@/lib/ark-founders-fixture")).withArkFixtureFounders : null;
    const read = await loadFixtureSnapshot(mode, named);
    return {...read, founders: read.raw ? arkFoundersOf(read.raw) : ARK_NO_FOUNDERS};
}

async function loadFixtureSnapshot(mode: FixtureMode, named: (<T>(raw: T) => T) | null): Promise<{snapshot: ArkSnapshot; full: ArkSnapshot | null; raw: unknown}> {
    // The fixtures are the server's answers verbatim (scripts/ark-life-fixtures-from-server.mts): decoded as the live ones are.
    // Captures + thrive: with the frozen contract's `thrive`, `area` and `source` laid on (`lib/ark-thrive-fixture`).
    const {withArkThriveFixture} = await import("@/lib/ark-thrive-fixture");
    const base = withArkThriveFixture((await import("@/ark-scene/fixtures/snapshot-v2.json")).default);
    // Founders (on unless `&founders=0`): the same answer as names-on writes it.
    const raw = named ? named(base) : base;
    if (EDGE_MODES.has(mode)) {
        const edge = await import("@/ark-scene/fixtures/edge");
        const base = JSON.parse(JSON.stringify(raw)) as Parameters<typeof edge.herdFixture>[0];
        const built = mode === "herd1000" || mode === "herd5" ? edge.herdFixture(base, mode) : mode === "placeholder" ? edge.placeholderFixture(base) : edge.eggsFixture(base).snapshot;
        return {snapshot: decodeArkSnapshot(built)!, full: null, raw: built};
    }
    const full = decodeArkSnapshot(raw)!;
    if (mode === "full") return {snapshot: full, full: null, raw};
    if (mode === "early") {
        const earlyBase = (await import("@/ark-scene/fixtures/snapshot-early.json")).default;
        const early = named ? named(earlyBase) : earlyBase;
        return {snapshot: decodeArkSnapshot(early)!, full: null, raw: early};
    }
    if (mode === "sizes") return {snapshot: withSizeLineUp(full), full: null, raw};
    if (mode === "micro") return {snapshot: withSmallAnimals(full), full: null, raw};
    if (mode === "layers") return {snapshot: withLayerAnimals(withSmallAnimals(full)), full: null, raw};
    // Grow: the first few, then more on each refresh (the client takes them from `full`).
    const animals = full.animals.slice(0, 6);
    return {snapshot: {...full, animals, counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: new Set(animals.map((a) => a.brought_by.label)).size}}, full, raw};
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

/**
 * `?fixture=layers`: the micro fixture plus an animal of every layer and mode
 * (docs/ark-micro.md, "Layers"): primates climbing and leaping, a sloth
 * hanging, a toucan perching in the canopy; moles and mole-rats underground;
 * crabs and an octopus on the reef floor, a glowing pineapplefish, a whale
 * shark at the plankton, the deep's lanternfish, loosejaw (glowing) and giant
 * squid; a tawny owl and a gull for the moments; and the depth bands' water species (trout, a catfish,
 * a pike, koi and swans in the lake, a plaice, a moray, orcas, a narwhal, a wrasse off the beach, jellyfish).
 */
function withLayerAnimals(base: ArkSnapshot): ArkSnapshot {
    type Zone = ArkSnapshot["animals"][number]["zone"];
    type Activity = NonNullable<ArkSnapshot["animals"][number]["activity"]>;
    const extra: Array<[string, string, Zone, Activity, number?]> = [
        ["spider-monkey", "Spider Monkey", "rainforest", "diurnal", 3],
        ["siamang", "Siamang", "rainforest", "diurnal"],
        ["sumatran-orangutan", "Sumatran Orangutan", "rainforest", "diurnal"],
        ["tufted-capuchin", "Tufted Capuchin", "rainforest", "diurnal"],
        ["brown-throated-sloth", "Brown-throated Sloth", "rainforest", "any"],
        ["keel-billed-toucan", "Keel-billed Toucan", "rainforest", "diurnal"],
        ["clouded-leopard", "Clouded Leopard", "rainforest", "nocturnal"],
        ["red-squirrel", "Red Squirrel", "woodland", "diurnal"],
        ["star-nosed-mole", "Star-nosed Mole", "woodland", "any"],
        ["naked-mole-rat", "Naked Mole-rat", "desert", "any", 2],
        ["cape-golden-mole", "Cape Golden Mole", "desert", "nocturnal"],
        ["northern-hairy-nosed-wombat", "Northern Hairy-nosed Wombat", "grassland", "nocturnal"],
        ["red-spotted-guard-crab", "Red-spotted Guard Crab", "coral_reef", "any"],
        ["wonderpus-octopus", "Wonderpus Octopus", "coral_reef", "any"],
        ["common-octopus", "Common Octopus", "coral_reef", "nocturnal"],
        ["australian-pineapplefish", "Australian Pineapplefish", "coral_reef", "nocturnal"],
        ["whale-shark", "Whale Shark", "open_ocean", "any"],
        ["stoplight-loosejaw", "Stoplight Loosejaw", "open_ocean", "any"],
        ["spotted-lanternfish", "Spotted Lanternfish", "open_ocean", "any", 3],
        ["giant-squid", "Giant Squid", "open_ocean", "any"],
        ["tawny-owl", "Tawny Owl", "woodland", "nocturnal"],
        ["herring-gull", "Herring Gull", "seashore", "diurnal"],
        // The depth bands (`sea-depth.ts`): the lake's fish in its mid-water and on its bed, a koi of the farm in the lake,
        // a swan on it, a plaice on the seabed, a moray in its hole, an orca and a narwhal that come up to breathe,
        // a wrasse of the shore in the sea off it, a school of jellyfish in mid-water.
        ["rainbow-trout", "Rainbow Trout", "river_lake", "diurnal", 3],
        ["wels-catfish", "Wels Catfish", "river_lake", "nocturnal"],
        ["northern-pike", "Northern Pike", "river_lake", "diurnal"],
        ["koi", "Koi", "farm_garden", "diurnal", 2],
        ["mute-swan", "Mute Swan", "river_lake", "diurnal", 2],
        ["european-plaice", "European Plaice", "open_ocean", "any"],
        ["green-moray", "Green Moray", "coral_reef", "nocturnal"],
        ["orca", "Orca", "open_ocean", "any", 2],
        ["narwhal", "Narwhal", "polar", "any"],
        ["ballan-wrasse", "Ballan Wrasse", "seashore", "diurnal"],
        ["moon-jellyfish", "Moon Jellyfish", "open_ocean", "any", 3]
    ];
    const animals = [...base.animals];
    extra.forEach(([slug, name, zone, activity, many = 1], i) => {
        const slot = Math.max(-1, ...animals.filter((a) => a.zone === zone).map((a) => a.slot ?? -1)) + 1;
        for (let rank = 0; rank < many; rank++) {
            animals.push({
                id: `00000000-0000-4000-a000-${String(i * 10 + rank).padStart(12, "0")}`,
                species_profile_id: `layer-${slug}`,
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
                activity,
                sociality: many > 1 ? "group" : "solitary",
                bringers: [{label: "Voyager 1", named: false}],
                slot,
                slot_rank: rank
            });
        }
    });
    return {...base, animals, counts: {...base.counts, animals: animals.length, species: base.counts.species + extra.length}};
}

/**
 * The Ark model set. Development's `?models=local` reads the local build
 * through the dev route (the 14 birds turned to face the right way, before
 * that upload), `?models=live` the bucket's, whatever the environment says.
 */
function modelBase(searchParams?: Props["searchParams"]): string {
    const asked = process.env.NODE_ENV === "development" ? searchParams?.models : undefined;
    if (asked === "local") return "/api/dev/ark-models/v1/ark";
    if (asked === "live") return `${TALKING_MODELS_BASE_URL}/ark`;
    const configured = process.env.NEXT_PUBLIC_ARK_MODELS_URL?.trim();
    if (configured) return configured.replace(/\/+$/, "");
    return process.env.NODE_ENV === "development" ? "/api/dev/ark-models/v1/ark" : `${TALKING_MODELS_BASE_URL}/ark`;
}

/**
 * Development only: `?rig=0` draws every animal procedural, `?rig=<folder>`
 * reads the rigs from another folder (the local publish build is served at
 * the default, `/api/dev/ark-models/ark-rig/v1`). Production: beside the
 * model set.
 */
function rigOverride(searchParams: Props["searchParams"]): string | null | undefined {
    if (process.env.NODE_ENV !== "development") return undefined;
    // `?rigv=v2`: another rig set beside the model set (a re-made one, before the release moves ARK_RIG_VERSION).
    if (typeof searchParams.rigv === "string" && typeof searchParams.rig !== "string") return rigBaseFrom(modelBase(searchParams), searchParams.rigv) ?? undefined;
    if (typeof searchParams.rig !== "string") return undefined;
    if (searchParams.rig === "0") return null;
    return /^(\/|https?:\/\/)/.test(searchParams.rig) ? searchParams.rig.replace(/\/+$/, "") : undefined;
}

/** The fixture's event log and life stories, as the server's reads would answer (the eggs fixture: its own log). */
async function loadFixtureLife(mode: FixtureMode, founders: boolean): Promise<ArkFixtureLife> {
    const [events, read, thrive, snapshot] = await Promise.all([import("@/ark-scene/fixtures/events.json"), import("@/ark-scene/fixtures/lives.json"), import("@/lib/ark-thrive-fixture"), import("@/ark-scene/fixtures/snapshot-v2.json")]);
    // Captures + thrive: each life story's `thrive`, `area`, `origin.source` and `lineage`, as the contract's read answers.
    const told = thrive.withArkThriveFixtureLives(read.default as unknown as Record<string, unknown>, thrive.withArkThriveFixture(snapshot.default));
    const lives = {default: founders ? (await import("@/lib/ark-founders-fixture")).withArkFixtureFounderLives(told) : told};
    if (mode === "eggs") {
        const edge = await import("@/ark-scene/fixtures/edge");
        const raw = JSON.parse(JSON.stringify((await import("@/ark-scene/fixtures/snapshot-v2.json")).default)) as Parameters<typeof edge.eggsFixture>[0];
        return {events: edge.eggsFixture(raw).events, lives: lives.default as unknown as Record<string, unknown>};
    }
    return {events: events.default as unknown, lives: lives.default as unknown as Record<string, unknown>};
}

export default async function ArkPage({params, searchParams}: Props) {
    const locale = pageLocale(params.locale);
    const development = process.env.NODE_ENV === "development";
    // A local snapshot (development) is real data: it takes the place of the live read, and of any fixture asked for.
    const local = await readLocalArk(searchParams.snapshot, searchParams.islands);
    const mode = local ? null : fixtureMode(searchParams);
    const hour = development && searchParams.hour !== undefined ? Number(searchParams.hour) : NaN;
    const since = development && searchParams.since && !Number.isNaN(Date.parse(searchParams.since)) ? searchParams.since : null;
    // Names are on by default (owner, 2026-11-11: every bringer with a handle shows as their @username); `&founders=0`: a server that names nobody.
    const fixtureFounders = Boolean(mode) && development && searchParams.founders !== "0";
    const record = searchParams.record === "1" && (development || process.env.ARK_RECORD_ENABLED === "1");
    // The live Ark: the public read from the data cache (decision 246); the visitor's own (`mine`) only for the recorder.
    const [{words, talk, language}, data, arrivals, navWords] = await Promise.all([
        getArkWords(locale, langOf(searchParams)),
        mode ? loadFixture(mode, fixtureFounders).then((fixture) => ({fixture, read: null, shared: null}))
            : local ? Promise.resolve({fixture: null, read: null, shared: null})
            : record ? readArkVoyage().then((read) => ({fixture: null, read, shared: null}))
            : readPublicArk(PUBLIC_REVALIDATE_SECONDS).then((shared) => ({fixture: null, read: null, shared})),
        // The newest arrivals under the heading (CC 3): the live log only, never beside a fixture or a local snapshot.
        mode || local ? Promise.resolve(null) : readArkRecentArrivals(),
        getPageWords(locale, "nav")
    ]);
    const snapshot = local?.snapshot ?? data.fixture?.snapshot ?? (data.read?.available ? data.read.snapshot : null) ?? data.shared;
    // Handed to the client as props only in development's modes: the live Ark is read by the client after the first paint.
    const handed = local || mode ? snapshot : null;
    const fixtureLife = mode ? await loadFixtureLife(mode, fixtureFounders) : null;
    const founders = local?.founders ?? data.fixture?.founders ?? (data.read?.available ? data.read.founders : ARK_NO_FOUNDERS);
    if (record && snapshot) return <ArkRecordView initial={snapshot} fixture={Boolean(mode)} modelBase={modelBase(searchParams)} events={fixtureLife?.events ?? null} />;
    const otherLanguage = langOf(searchParams) !== null && language !== locale;
    const wordsLocale = otherLanguage ? language : locale;
    // The words under the world: the snapshot the page drew (the same Ark for everyone; `mine` is never said there).
    const speciesPages = new Set((snapshot?.animals ?? []).map((animal) => animal.model_slug).filter((slug) => isPublishedAnimalSlug(slug)));
    const view = (
        <>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{__html: jsonLdHtml(arkPageJsonLd({
                locale,
                title: words.seo.metaTitle,
                description: clampMetaDescription(words.seo.metaDescription),
                name: words.intro.title,
                alternateName: words.eyebrow,
                homeName: words.seo.breadcrumbHome,
                links: [
                    {name: word(navWords, "animalDexArk"), path: "/ark"},
                    {name: word(navWords, "howTheArkWorks"), path: ARK_HOW_IT_WORKS_PATH},
                    {name: word(navWords, "arkFoodChain"), path: ARK_FOOD_CHAIN_PATH},
                    {name: word(navWords, "aboutAnimalDex"), path: ABOUT_PATH}
                ]
            }))}}
        />
        <ArkIntro words={words.intro} counts={snapshot?.counts ?? null} arrivals={arrivals} locale={wordsLocale} howHref={ARK_HOW_IT_WORKS_PATH} />
        <ArkView
            locale={wordsLocale}
            initial={handed}
            summary={arkPageSummary(snapshot)}
            founders={founders}
            growFrom={data.fixture?.full ?? null}
            fixture={Boolean(mode)}
            local={Boolean(local)}
            signedIn={data.read?.signedIn ?? false}
            words={words}
            talkTitles={talk}
            modelBase={modelBase(searchParams)}
            rigBase={rigOverride(searchParams)}
            focus={typeof searchParams.focus === "string" ? searchParams.focus.slice(0, 120) : null}
            island={searchParams.island === "wild" || searchParams.island === "town" ? searchParams.island : null}
            fixtureLife={fixtureLife}
            hours={Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 24) : null}
            since={since}
            publicStory={Boolean(mode) && searchParams.publicStory === "1"}
            shareLocalePath={getLocalePath(locale, "/ark")}
            liveFeed={Boolean(mode) && development && (searchParams.feed === "1" || searchParams.fixture === "live" || (mode === "grow" && searchParams.feed !== "0"))}
            newest={arrivals?.[0] ? {name: arrivals[0].name, slug: arrivals[0].slug, at: arrivals[0].at} : null}
        />
        <ArkAbout snapshot={snapshot} words={words} locale={wordsLocale} speciesPages={speciesPages} />
        {await ArkSeoSummary({locale})}
        </>
    );
    // Another language than the site's: its own lang and direction, so screen readers and right-to-left scripts read it right.
    // The band's height as a variable for the world under it (`ARK_INTRO_HEIGHT`).
    return otherLanguage ? <div lang={language} dir={arkDirection(language)} className={ARK_INTRO_HEIGHT}>{view}</div> : <div className={ARK_INTRO_HEIGHT}>{view}</div>;
}
