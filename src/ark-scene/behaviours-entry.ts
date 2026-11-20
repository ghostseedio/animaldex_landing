/**
 * The behaviours harness's page (development only; `scripts/ark-behaviours-clips.mjs` builds it into
 * `.ark-golden/behaviours/` and serves it, nothing deploys it). The live scene with a cast-only snapshot
 * (`?scene=birth|den|contest|dung`) on a controlled clock, and made-up record events (a litter, a mating) handed to
 * `addBirths` / `addMatings` exactly as the events controller would: the live world acts them from their time.
 * `window.__behaviours.shot(s, distance, follow)` sets the world time to `s` seconds after the event and frames it.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {disturbedNow} from "@/ark-scene/defence-moves";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; young?: number};
type Scene = {zone: string; hours: number; cast: Cast[]; /** p3 (shake): on the town island (its millpond, its canal). */ town?: boolean; kind: "birth" | "mating" | "dung" | "defence" | "mob" | "look" | "lure" | "hatch" | "death" | "shake"};

const SCENES: Record<string, Scene> = {
    // A foal born in the open: licked, up on wobbly legs, suckling.
    birth: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 3, young: 1}]},
    // Cubs born in the den: tucked at her belly.
    den: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "african-lion", name: "African Lion", n: 2, young: 2}]},
    // The rut: a rival stag first, then the mating.
    contest: {zone: "grassland", hours: 8, kind: "mating", cast: [{slug: "red-deer", name: "Red Deer", n: 6}]},
    // The webs of a garden's spiders, respun through the day.
    web: {zone: "farm_garden", hours: 7, kind: "dung", cast: [{slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", n: 3}]},
    // A dormant kind: in its dens while the server says so (the marmots), the others about (the zebras).
    dormant: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "alpine-marmot", name: "Alpine Marmot", n: 4}, {slug: "plains-zebra", name: "Plains Zebra", n: 3}]},
    // 3.3 batch (A): defence moves. The first cast is the species with the move, the second a predator of it by the ecology's own food
    // links, which the harness stands next to it (`threat`): the reactive layer does the rest.
    curl: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "european-hedgehog", name: "European Hedgehog", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pangolin: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "sunda-pangolin", name: "Sunda Pangolin", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pill: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "pill-millipede", name: "Pill Millipede", n: 2}, {slug: "common-frog", name: "Common Frog", n: 1}]},
    coil: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "ball-python", name: "Ball Python", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    millipede: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-millipede", name: "Giant African Millipede", n: 2}, {slug: "cane-toad", name: "Cane Toad", n: 1}]},
    shell: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "greek-tortoise", name: "Greek Tortoise", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    snail: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-land-snail", name: "Giant African Land Snail", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    hermit: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "rugose-hermit-crab", name: "Rugose Hermit Crab", n: 2}, {slug: "asian-small-clawed-otter", name: "Asian Small-clawed Otter", n: 1}]},
    puff: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "southern-toad", name: "Southern Toad", n: 2}, {slug: "common-raccoon", name: "Common Raccoon", n: 1}]},
    monitor: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "savannah-monitor", name: "Savannah Monitor", n: 2}, {slug: "coyote", name: "Coyote", n: 1}]},
    puffer: {zone: "coral_reef", hours: 10, kind: "defence", cast: [{slug: "stars-and-stripes-pufferfish", name: "Stars and Stripes Pufferfish", n: 2}, {slug: "blacktip-reef-shark", name: "Blacktip Reef Shark", n: 1}]},
    flash: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "scarlet-tiger-moth", name: "Scarlet Tiger Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    eyes: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "polyphemus-moth", name: "Polyphemus Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    peacock: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "peacock-butterfly", name: "Peacock Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    owl: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "owl-butterfly", name: "Owl Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    harnessed: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "harnessed-moth", name: "Harnessed Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    blotched: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "green-blotched-moth", name: "Green-blotched Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    lubber: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-lubber-grasshopper", name: "Eastern Lubber Grasshopper", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    taildrop: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    salamander: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-red-backed-salamander", name: "Eastern Red-backed Salamander", n: 2}, {slug: "common-rat-snake", name: "Common Rat Snake", n: 1}]},
    // SIG-DEFENCE (P5 M rows): the new moves, each species beside a predator of it by the ecology's food links.
    rear: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    crab: {zone: "seashore", hours: 10, kind: "defence", cast: [{slug: "shore-crab", name: "Shore Crab", n: 2}, {slug: "herring-gull", name: "Herring Gull", n: 1}]},
    scorpion: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "malaysian-forest-scorpion", name: "Malaysian Forest Scorpion", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    tamandua: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "southern-tamandua", name: "Southern Tamandua", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    whirl: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "daddy-long-legs-spider", name: "Daddy Long-legs Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    webshake: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    thump: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "european-rabbit", name: "European Rabbit", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    thumpdomestic: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "domestic-rabbit", name: "Domestic Rabbit", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    cottontail: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "eastern-cottontail", name: "Eastern Cottontail", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    stamp: {zone: "woodland", hours: 10, kind: "defence", cast: [{slug: "white-tailed-deer", name: "White-tailed Deer", n: 2}, {slug: "coyote", name: "Coyote", n: 1}]},
    slug: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "leaf-eating-slug", name: "Leaf-eating Slug", n: 2}, {slug: "common-frog", name: "Common Frog", n: 1}]},
    tuck: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-house-spider", name: "Common House Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    beard: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "central-bearded-dragon", name: "Central Bearded Dragon", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    spines: {zone: "river_lake", hours: 10, kind: "defence", cast: [{slug: "amazon-sailfin-catfish", name: "Amazon Sailfin Catfish", n: 2}, {slug: "giant-otter", name: "Giant Otter", n: 1}]},
    gecko: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-house-gecko", name: "Common House Gecko", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    // 3.3 batch (B): magpies mobbing a fox near them, in turns (`mobbing.ts`; started by hand here, the cast is placed apart).
    mob: {zone: "grassland", hours: 9, kind: "mob", cast: [{slug: "australian-magpie", name: "Australian Magpie", n: 4}, {slug: "red-fox", name: "Red Fox", n: 1}, {slug: "coyote", name: "Coyote", n: 1}, {slug: "bobcat", name: "Bobcat", n: 1}, {slug: "tawny-owl", name: "Tawny Owl", n: 1}, {slug: "red-tailed-hawk", name: "Red-tailed Hawk", n: 1}]},
    // 3.3 batch (B): the tail habits (`tail-habit.ts`): a wagtail's pump, a wren's cocked tail, a swamphen's flick, a water tyrant's fan; a sparrow beside them has none.
    tail: {zone: "wetland", hours: 9, kind: "look", cast: [{slug: "grey-wagtail", name: "Grey Wagtail", n: 2}, {slug: "house-wren", name: "House Wren", n: 1}, {slug: "australasian-swamphen", name: "Australasian Swamphen", n: 1}, {slug: "masked-water-tyrant", name: "Masked Water Tyrant", n: 1}, {slug: "common-sandpiper", name: "Common Sandpiper", n: 1}, {slug: "house-sparrow", name: "House Sparrow", n: 1}]},
    // 3.3 batch (B): a killdeer's broken-wing display for a predator near it (`broken-wing.ts`; started by hand here).
    lure: {zone: "grassland", hours: 9, kind: "lure", cast: [{slug: "killdeer", name: "Killdeer", n: 5}, {slug: "coyote", name: "Coyote", n: 1}, {slug: "red-fox", name: "Red Fox", n: 1}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    // 3.3 batch (B): a Muscovy duck's brood jumping from the tree hole on the record's hatching (`duckling-drop.ts`).
    drop: {zone: "river_lake", hours: 9, kind: "hatch", cast: [{slug: "muscovy-duck", name: "Muscovy Duck", n: 2, young: 4}]},
    // 3.3 fix (mating tap): a mating line's tap, the old way (the first animal alone) and the new (the pair framed);
    // two Common Wall Lizards (a real pair of today's record; they start close), and two Australasian Swamphens (another),
    // the farthest apart of eight.
    tapone: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 4}]},
    tappair: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 4}]},
    tapfarone: {zone: "wetland", hours: 10, kind: "mating", cast: [{slug: "australasian-swamphen", name: "Australasian Swamphen", n: 8}]},
    tapfarpair: {zone: "wetland", hours: 10, kind: "mating", cast: [{slug: "australasian-swamphen", name: "Australasian Swamphen", n: 8}]},
    // 3.3 fix (log): a death of the record (old age): its body where it died, and its line's tap (`live-deaths.ts`). A
    // second death, a roadside hawk not in the roster (it has left it, as the dead have), placed from its event alone.
    death: {zone: "grassland", hours: 10, kind: "death", cast: [{slug: "red-deer", name: "Red Deer", n: 3}]},
    // 3.3 fix (breeding taps): real breeders of the 2026-11-16 record. Two Common Flesh Flies mated (the tap framed the
    // pair from metres back: two specks); two Common Wall Lizards mated and laid two eggs (the clutch was never drawn);
    // a Pea Aphid born (a 3 mm young with its mother); two Common Buzzards' young hatched.
    breedfly: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-flesh-fly", name: "Common Flesh Fly", n: 4}]},
    breedclutch: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 2}]},
    breedaphid: {zone: "farm_garden", hours: 10, kind: "birth", cast: [{slug: "pea-aphid", name: "Pea Aphid", n: 2, young: 1}]},
    breedbuzzard: {zone: "woodland", hours: 10, kind: "hatch", cast: [{slug: "common-buzzard", name: "Common Buzzard", n: 2, young: 1}]},
    // p3 (shake): out of the water and shaking it off (`water-shake.ts`): geese at the lake, a Labrador from the lake.
    shakegoose: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "greylag-goose", name: "Greylag Goose", n: 3}]},
    shakedog: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "labrador-retriever", name: "Labrador Retriever", n: 4}]},
    shakedog2: {zone: "wetland", hours: 10, kind: "shake", cast: [{slug: "labrador-retriever", name: "Labrador Retriever", n: 4}]},
    shaketown: {zone: "garden_wildlife", hours: 10, kind: "shake", town: true, cast: [{slug: "mallard", name: "Mallard", n: 6}]},
    shaketowngoose: {zone: "farm_garden", hours: 10, kind: "shake", town: true, cast: [{slug: "domestic-goose", name: "Domestic Goose", n: 6}]},
    shakeotter: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "european-otter", name: "European Otter", n: 2}]},
    // A herd's droppings along its day.
    dung: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 6}, {slug: "african-lion", name: "African Lion", n: 2}]}
};

const castId = (k: number, i: number) => `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const speciesId = (k: number) => `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });

async function main() {
    const params = new URLSearchParams(location.search);
    const scene = SCENES[params.get("scene") ?? "birth"];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    const template = fixture.animals[0];
    const day = fixture.voyage.ark_day;
    const animals: Raw[] = [];
    const youngIds: string[] = [];
    scene.cast.forEach((c, k) => {
        for (let i = 0; i < c.n + (c.young ?? 0); i++) {
            const young = i >= c.n;
            if (young) youngIds.push(castId(k, i));
            animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: "diurnal", sociality: "group", slot: 90 + k, slot_rank: i, origin: young ? "born" : "arrived", born_ark_day: young ? day : 0} as Raw);
        }
    });
    const decoded = decodeArkSnapshot({...fixture, animals});
    if (!decoded) throw new Error("fixture did not decode");
    let snapshot = decoded;
    // p3 (shake): a town scene: the cast on the town island, the town loaded beside the wild one (as rig-scenes-entry does).
    let islandOptions: Record<string, unknown> = {};
    if (scene.town) {
        snapshot = {...snapshot, animals: snapshot.animals.map((a) => ({...a, island: "town"}) as typeof a)};
        const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
        const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
        const town = await loadTownScene({tier: "high", animals: split(snapshot, "town").animals});
        islandOptions = {island: town, wildAnimals: split(snapshot, "wild").animals, openIsland: "town"};
        console.log("[behaviours] town origin", JSON.stringify(town.origin));
    }
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true), ...islandOptions});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const t0 = Date.UTC(2026, 10, 20, scene.hours) / 1000 + 60;
    const setAt = async (epoch: number) => {
        const ms = epoch * 1000;
        if (!fake) {
            fake = {date: ms, perf: realPerfNow()};
            handle.setClockScale(1, ms);
        } else {
            fake.perf += ms - fake.date;
            fake.date = ms;
        }
        await frames(3);
    };
    await setAt(t0 - 20);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log("[behaviours] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    type Debug = {births: () => Array<Record<string, unknown>>; matings: () => Array<Record<string, unknown>>; traces: () => Array<{kind: string; x: number; z: number; alpha: number}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>; mobbing?: () => unknown[]; mobStart?: (bird: string, threat: string) => boolean; lureStart?: (bird: string, threat: string) => boolean; lures?: () => unknown[]; drops?: () => Array<{mother: string | null}>; seenNow?: () => Array<{name: string; line?: string; episode: string}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const a = castId(0, 0);
    let b = castId(0, 1);
    if (scene.kind === "birth") handle.addBirths?.([{key: "birth:harness", parents: [a, b], young: youngIds, t0}]);
    // 3.3 fix (mating tap): the pair apart at their mating's time, as most of the record's pairs are.
    const tapScene = (params.get("scene") ?? "").startsWith("tap") || params.get("scene") === "breedfly";
    if (tapScene) {
        // (The one of its kind farthest from the first, as the record's pairs are often apart.)
        const at = handle.locate(a);
        let far = 0;
        for (let i = 1; i < scene.cast[0].n; i++) {
            const p = handle.locate(castId(0, i));
            const d = at && p ? Math.hypot(p.x - at.x, p.z - at.z) : 0;
            if (d > far) {
                far = d;
                b = castId(0, i);
            }
        }
        console.log("[behaviours] the pair", far.toFixed(1), "m apart");
    }
    if (scene.kind === "mating") handle.addMatings?.([{key: "mated:harness", a, b, t0}]);
    if (scene.kind === "hatch") handle.addHatchings?.([{key: "hatch:harness", parents: [a, b], young: youngIds, t0}]);
    if (scene.kind === "death") {
        const of = (id: string, slug: string, name: string, slot: number) => ({id, species_profile_id: speciesId(9), name, model_slug: slug, zone: scene.zone as never, arrived_at: null, origin: "arrived" as const, generation: 0, slot, slot_rank: 0, activity: "diurnal" as const, sociality: null, status: null, area: null});
        handle.addDeaths?.([{key: "death:harness", animal: of(a, "red-deer", "Red Deer", 90), t0}, {key: "death:gone", animal: of(castId(9, 0), "roadside-hawk", "Roadside Hawk", 91), t0}]);
    }
    await setAt(t0 + 0.05);
    await frames(4);
    // (The first of the cast's predators that is out in the open now: not in its den, not on the wing.)
    let foe = castId(1, 0);
    let star = a;
    if (scene.kind === "mob" || scene.kind === "lure") {
        console.log("[behaviours] the bird", JSON.stringify(handle.locate(a)));
        for (let k = 1; k < scene.cast.length; k++) {
            const at = handle.locate(castId(k, 0));
            console.log("[behaviours] foe?", scene.cast[k].slug, JSON.stringify(at));
            // (A display needs a bird on dry ground: the first of the cast's birds that can.)
            const bird = scene.kind === "lure" ? Array.from({length: scene.cast[0].n}, (_, i) => castId(0, i)).find((id) => debug.lureStart?.(id, castId(k, 0))) : undefined;
            if (bird) star = bird;
            if (at && (bird || (scene.kind === "mob" && at.y > at.ground + 0.05 && at.y < at.ground + 6 && debug.mobStart?.(a, castId(k, 0))))) {
                foe = castId(k, 0);
                console.log("[behaviours] mobbing", scene.cast[k].slug, JSON.stringify(at));
                break;
            }
        }
    }
    const at0 = handle.locate(a);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.5, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    let closeView: ArkCameraView | null = null;
    const api = {
        /** 3.3 fix (log): a death line's tap, from the island's overview: where the camera goes, after its flight. */
        tapDeath: async (key: string) => {
            handle.setView(view(150, at0, 0.9));
            await frames(3);
            const ok = handle.focusDeath?.(key) ?? false;
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                await frames(1);
            }
            return {ok, view: handle.view()};
        },
        deaths: () => (debug as unknown as {deaths?: () => unknown[]}).deaths?.() ?? [],
        info: () => ({drops: debug.drops?.() ?? [], births: debug.births(), matings: debug.matings(), young: youngIds, a: star, b, c: foe, ids: scene.cast.map((_, k) => castId(k, 0)), mobbing: debug.mobbing?.() ?? []}),
        dung: () => debug.traces().filter((t) => t.kind === "dung"),
        /** The first cast's kind dormant (or awake again), then what the scene shows of every animal. */
        dormant: async (on: boolean) => {
            handle.setDormant?.(on ? [speciesId(0)] : []);
            await frames(6);
            return debug.entries().map((e) => `${e.animal.model_slug} ${e.act ? `${String(e.act.meal)}${e.act.hidden ? " hidden" : ""}` : "about"} card:${handle.animalStatus?.(e.animal.id)?.activity ?? "-"}`);
        },
        /** The webs' mesh: where its first web is, how many threads, and the clock's place in the webs' cycle. */
        webs: () => {
            const lines = (debug as unknown as {scene: {getObjectByName: (n: string) => {geometry: {attributes: Record<string, {array: Float32Array; count: number}>}; visible: boolean} | undefined}}).scene.getObjectByName("props:webs");
            if (!lines) return null;
            const p = lines.geometry.attributes.position.array;
            return {x: p[0], y: p[1], z: p[2], vertices: lines.geometry.attributes.position.count, seed: lines.geometry.attributes.aSeed.array[0], visible: lines.visible};
        },
        /** The clock a little on (s), the view kept: the next moment of the same picture. */
        tick: async (seconds: number) => {
            fake!.perf += seconds * 1000;
            fake!.date += seconds * 1000;
            await frames(2);
            if (closeView) {
                (debug as unknown as {controls: {minDistance: number}}).controls.minDistance = closeView.distance;
                handle.setView(closeView);
            }
            await frames(1);
            return `+${seconds.toFixed(2)} s ${(debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`).join(" / ")}`;
        },
        /** An animal found where it is drawn now (a wide look first, so it is drawn), then framed close from its side. */
        find: async (id: string, distance: number) => {
            const far = handle.locate(id);
            if (far) handle.setView({target: {x: far.x, y: far.y, z: far.z}, distance: 40, polar: 0.9, azimuth: 0.7});
            await frames(4);
            const at = handle.locate(id);
            // (Closer than the page lets a visitor come: a wagtail is 15 cm long.)
            const rig = debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
            rig.controls.minDistance = Math.min(rig.controls.minDistance, distance);
            rig.camera.near = 0.03;
            rig.camera.updateProjectionMatrix();
            closeView = at ? {target: {x: at.x, y: at.y, z: at.z}, distance, polar: 1.45, azimuth: at.yaw + Math.PI / 2} : null;
            if (closeView) handle.setView(closeView);
            await frames(4);
            return at ? `${id.slice(-3)} at ${at.x.toFixed(1)}, ${at.z.toFixed(1)} length ${at.length.toFixed(2)} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${(debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`).join(" / ")}` : "not found";
        },
        /** The view on an animal where it is now, in the air too (after a `shot`, the clock standing). */
        closeOn: async (id: string, distance: number, polar = 1.35) => {
            const act = debug.entries().find((e) => e.animal.id === id)?.act as {x: number; z: number; base: number} | null | undefined;
            const at = act ? {x: act.x, y: act.base + 0.15, z: act.z} : handle.locate(id);
            const rig = debug as unknown as {controls: {minDistance: number}};
            rig.controls.minDistance = Math.min(rig.controls.minDistance, distance);
            if (at) handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth: 0.7});
            await frames(3);
        },
        /** The world at an absolute time (s), looking at a point from close by. */
        look: async (epoch: number, at: {x: number; y: number; z: number}, distance: number) => {
            await setAt(epoch);
            handle.setView({target: at, distance, polar: 1.35, azimuth: 0.4});
            await frames(6);
        },
        /** The world at `s` seconds after the event, from `distance`, on an animal (`follow`) or a point. */
        shot: async (s: number, distance: number, follow?: string, point?: {x: number; z: number}, azimuth = 0.7, polar = 1.15) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = point ?? handle.locate(follow ?? a) ?? at0;
            handle.setView(view(distance, {x: who.x, z: who.z}, polar, azimuth));
            await frames(3);
            // (The dung list is made every 2 s of the page's clock: a moment more for it.)
            fake!.perf += 2100;
            fake!.date += 2100;
            await frames(3);
            const acts = debug
                .entries()
                .filter((e) => e.act)
                .map((e) => `${e.animal.id.slice(-3)} ${e.animal.model_slug} ${String(e.act!.meal ?? "-")} ${String(e.act!.state ?? "")}${e.act!.hidden ? " hidden" : ""}${e.act!.lying ? ` lying ${Number(e.act!.lying).toFixed(2)}` : ""}`);
            const status = (id: string) => handle.animalStatus?.(id)?.activity ?? "-";
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            return `+${s.toFixed(1)} s   card a: ${status(a)}   card b: ${status(b)}   dung marks: ${api.dung().length}\n${acts.concat(said).join("\n")}${scene.kind === "lure" ? `\n${JSON.stringify(debug.lures?.())}` : ""}${scene.kind === "hatch" ? `\n${JSON.stringify(debug.drops?.())}` : ""}${scene.kind === "mob" ? `\n${JSON.stringify(debug.mobbing?.())} rigs ${JSON.stringify(scene.cast[0] ? Array.from({length: scene.cast[0].n}, (_, i) => (debug as unknown as {rigState: (id: string) => unknown}).rigState(castId(0, i))).concat((debug as unknown as {rigState: (id: string) => unknown}).rigState(foe)) : [])}` : ""}`;
        },
        /** p3 (shake): the cast's next climbs out of the water (the scene's own schedule), the earliest first. */
        outs: () => {
            const ask = (debug as unknown as {waterOuts: (id: string, from: number, slots: number) => Array<{arrive: number; x: number; z: number}>}).waterOuts;
            const all = scene.cast[0] ? Array.from({length: scene.cast[0].n}, (_, i) => ask(castId(0, i), t0, 1440).map((o) => ({...o, id: castId(0, i)}))).flat() : [];
            return all.sort((p, q) => p.arrive - q.arrive);
        },
        /** p3 (shake): the world run up to an absolute time a tenth of a second a frame (the drops fly), then the animal framed from `azimuth` off its heading (its side by default). */
        shakeShot: async (id: string, epoch: number, lengths: number, azimuth: number | null = null, polar = 1.4) => {
            await setAt(epoch - 1.5);
            for (let i = 0; i < 15; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const drawn = debug.entries().find((e) => e.animal.id === id) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const at = handle.locate(id);
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : at ? {x: at.x, y: at.y + drawn.length * 0.3, z: at.z} : null;
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            if (target) {
                for (let i = 0; i < 3; i++) {
                    controls.minDistance = 0.08;
                    handle.setView({target, distance: Math.max(lengths * drawn.length, 0.5), polar, azimuth: (at ? at.yaw : 0) + (azimuth ?? Math.PI / 2)});
                    await frames(1);
                }
            }
            const pose = (debug.entries().find((e) => e.animal.id === id) as unknown as {sched?: {pose?: {beat?: string; act?: {recipe?: string; shake?: Record<string, number>} | null}}}).sched?.pose;
            const shake = pose?.act?.shake ? JSON.stringify(Object.fromEntries(Object.entries(pose.act.shake).map(([k, v]) => [k, Number(v.toFixed(2))]))) : "";
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`)));
            const recipes = (debug as unknown as {scene: {getObjectByName: (n: string) => {children: Array<{type: string; geometry: {drawRange: {count: number}}}>} | undefined}}).scene.getObjectByName("ark-recipes");
            const drops = recipes?.children.find((c) => c.type === "Points")?.geometry.drawRange.count ?? -1;
            return `drops ${drops} beat ${pose?.beat ?? "-"} act ${pose?.act?.recipe ?? "-"} ${shake} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${said.join(" / ")}`;
        },
        /**
         * 3.3 batch (A): the predator (the second cast) stood `gap` body lengths of the first cast's animal from it, or
         * taken away again (null): its shared pose pinned there (`pinShared`), so the reactive layer sees a real predator.
         */
        threat: (gap: number | null) => {
            const pin = (debug as unknown as {pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void}).pinShared;
            const predator = castId(1, 0);
            const at = handle.locate(a);
            if (gap === null || !at) return void pin(predator, null);
            const length = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number};
            const x = at.x + Math.max(gap * length.length, 0.25);
            pin(predator, () => ({x, y: Math.max(handle.heightAt(x, at.z), 0), z: at.z, yaw: -Math.PI / 2, moving: false, aloft: false, doing: "watch"}));
        },
        /** SIG-DEFENCE: the world's clock moved on to the next disturbance the day's schedule gives the first cast's animal (`disturbedNow`), less `before` s. */
        disturb: async (before = 0.5) => {
            let t = fake!.date / 1000;
            while (!disturbedNow(a, t)) t += 1;
            const ms = (t - before) * 1000 - fake!.date;
            fake!.perf += ms;
            fake!.date += ms;
            await frames(3);
        },
        /** 3.3 batch (A): the world run on for `seconds` (a tenth of a second a frame), then the first cast's animal framed from `lengths` of its body away. */
        run: async (seconds: number, lengths: number, azimuth = 0.7, polar = 1.1) => {
            for (let i = 0; i < Math.round(seconds * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = handle.locate(a) ?? at0;
            const drawn = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const length = drawn.length;
            // (Its drawn middle: a moth is on a wall, a pufferfish under the water, not on the ground at its place.)
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : {x: who.x, y: Math.max(handle.heightAt(who.x, who.z), 0) + length * 0.3, z: who.z};
            // (Closer than the page lets a visitor come: these are small animals, and the move is in the body's shape.)
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            for (let i = 0; i < 3; i++) {
                controls.minDistance = 0.08;
                handle.setView({target, distance: Math.max(lengths * length, 0.12), polar, azimuth});
                await frames(1);
            }
            return `${api.defence()}   length ${length.toFixed(3)} m`;
        },
        /** What the first cast's animal does now: the reactive layer's action, its move, and what the scene reports as seen. */
        defence: () => {
            const d = (debug as unknown as {defence: (id: string) => {amount: number; tail: number; shed: number; episode: number} | null}).defence(a);
            const micro = (debug.entries().find((e) => e.animal.id === a) as unknown as {place: {micro?: unknown}; defenceNear?: number; level?: string});
            const seen = handle.seen?.().acts.filter((act) => act.recipe.startsWith("defence_")).map((act) => act.line) ?? [];
            return `action: ${micro.place.micro ? `(at its microhabitat) predator beside it ${micro.defenceNear ?? 0}` : handle.reactive?.(a)?.action ?? "-"}   move: ${d ? `amount ${d.amount.toFixed(2)} tail ${d.tail.toFixed(2)} shed ${d.shed.toFixed(1)} episode ${d.episode}` : "-"}   seen: ${seen.join(" / ") || "-"}   drawn as: ${micro.level ?? "-"}`;
        },
        /**
         * 3.3 fix (mating tap): the world run to `s` s after the mating's time, the line tapped there (`pair`: the new
         * tap, `selectPair`; else the old one, `select` of the first animal), then 3 s for the flight and the follow.
         */
        tap: async (s: number, pair: boolean) => {
            while (fake!.date / 1000 < t0 + s - 0.05) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            if (pair && handle.selectPair) handle.selectPair(a, b);
            else handle.select(a);
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const pa = handle.locate(a);
            const pb = handle.locate(b);
            const v = handle.view();
            const acts = debug.entries().filter((e) => e.animal.id === a || e.animal.id === b).map((e) => `${e.animal.id.slice(-3)} ${String(e.act?.state ?? "its day")}`);
            return `+${s} s, ${pair ? "new tap (the pair)" : "old tap (the first)"}: apart ${pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z).toFixed(1) : "?"} m, view ${v.distance.toFixed(1)} m from ${v.target.x.toFixed(1)},${v.target.z.toFixed(1)}; a ${pa ? `${pa.x.toFixed(1)},${pa.z.toFixed(1)}` : "-"} b ${pb ? `${pb.x.toFixed(1)},${pb.z.toFixed(1)}` : "-"}; ${acts.join(", ")}; ${JSON.stringify(debug.matings())}`;
        },
        /**
         * 3.3 fix (breeding taps): the line's tap as the controller now makes it (`breed-focus.ts`), at `s` s after the
         * event: "pair" a mating's two, "clutch" the pair and the clutch beside the mother, "young" the newborn with
         * its mother (`kin`); then 3 s for the flight.
         */
        breedTap: async (s: number, mode: "pair" | "clutch" | "young") => {
            while (fake!.date / 1000 < t0 + s - 0.05) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const young = youngIds[0];
            if (mode === "young") handle.selectPair?.(young, a, true);
            else handle.selectPair?.(a, b);
            if (mode === "clutch") handle.showClutch?.(`laid:harness:${s}`, [a, b], 2);
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const v = handle.view();
            const ids = mode === "young" ? [young, a] : [a, b];
            const at = ids.map((id) => handle.locate(id));
            const apart = at[0] && at[1] ? Math.hypot(at[0].x - at[1].x, at[0].z - at[1].z).toFixed(2) : "?";
            const laid = mode === "clutch" ? (debug as unknown as {liveClutch: () => {eggs: number | null; at: {x: number; y: number; z: number; size: number} | null} | null}).liveClutch() : null;
            const clutch = laid ? ` clutch of ${laid.eggs} at ${laid.at ? `${laid.at.x.toFixed(2)},${laid.at.z.toFixed(2)} ${laid.at.size.toFixed(3)} m` : "-"}; she at ${at[1] ? `${at[1].x.toFixed(2)},${at[1].z.toFixed(2)}` : "-"}` : "";
            return `+${s} s ${mode}:${clutch} view ${v.distance.toFixed(2)} m; apart ${apart} m; lengths ${at.map((p) => p?.length.toFixed(3) ?? "-").join("/")}`;
        },
        handle
    };
    (window as unknown as {__behaviours: typeof api}).__behaviours = api;
}

main().catch((error) => {
    console.error("[behaviours]", error?.stack ?? error);
    (window as unknown as {__behavioursError?: string}).__behavioursError = String(error?.stack ?? error);
});
