/**
 * The broods harness's page (development only; `scripts/ark-broods-clips.mjs` builds it into `.ark-golden/broods/` and
 * serves it, nothing deploys it). The live scene with a cast-only snapshot (`?scene=broodnest|broodduck|...`) on a
 * controlled clock, and a brood read made by hand in the engine's contract shape (`fixtures/broods.ts`: never the real
 * Ark) handed to `setBroods` exactly as the live controller would, step by step along a timeline: laid, raided,
 * hatched, a take, a loss with no cause, failed, recruited. `?broods=none` gives the scene no read at all (the before
 * pictures: today's scene); `?broods=off` gives it a read that says `on: false` (it must be the same).
 * `window.__broods.shot(i)` moves the clock to the i-th moment of the scene's plan and frames the brood's place.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {FIXTURE_ARK_DAY_SECONDS, rawBrood, rawBroodsRead, rawLoss, type RawBrood} from "@/ark-scene/fixtures/broods";
import {ARK_BROODS_OFF, arkBroodCardLine, arkBroodsByParent, decodeArkBroods} from "@/lib/ark-broods";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; activity?: string};
type Ctx = {
    /** The moment (epoch s) and its Ark day. */
    epoch: number;
    day: number;
    /** The scene's brood (the first), and its lists: live, and ended in the last day. */
    b: RawBrood;
    live: RawBrood[];
    ended: RawBrood[];
    /** The cast's ids: `id(k, i)` the i-th of the k-th cast row; a hunter's record for a loss. */
    id: (k: number, i: number) => string;
    hunter: (k: number) => {id: string; species_profile_id: string; name: string; model_slug: string};
    /** A wild take's encounter: the hunter where it is now, the brood at its nest. */
    encounter: (k: number) => {t: number; predator: {x: number; z: number}; prey: {x: number; z: number; r: number}} | undefined;
    /** New animals come aboard (recruits): added to the snapshot, born on the brood's stage day. */
    recruit: (n: number) => string[];
};
type Shot = {s: number; label: string; distance?: number; polar?: number; azimuth?: number; /** Frame this animal (the k-th cast row's first) instead of the nest. */ follow?: number};
type Scene = {zone: string; hours: number; cast: Cast[]; distance: number; polar?: number; azimuth?: number; brood: (ctx: Omit<Ctx, "b" | "live" | "ended" | "epoch" | "encounter" | "recruit">) => RawBrood; steps: Array<[number, (ctx: Ctx) => void]>; shots: Shot[]};

let lossId = 900;
/** A loss on the brood: its counts moved, the row put first. */
const lose = (ctx: Ctx, cause: "taken" | "did_not_survive" | "failed" | "parent_lost" | "unsettled", count: number, hunterRow?: number, withEncounter = false) => {
    const b = ctx.b;
    b.count = Math.max(b.count - count, 0);
    if (cause === "taken") b.taken += count;
    else b.lost += count;
    b.losses.unshift(rawLoss(++lossId, ctx.epoch, ctx.day, cause, count, b.count, hunterRow === undefined ? null : ctx.hunter(hunterRow), hunterRow !== undefined && withEncounter ? ctx.encounter(hunterRow) : undefined));
    b.losses = b.losses.slice(0, 12);
};
/** The stage's change: the young start from what is left. */
const hatch = (ctx: Ctx, change: Partial<RawBrood> = {}) => {
    Object.assign(ctx.b, {stage: "young", stage_count: ctx.b.count, stage_ark_day: ctx.day, next_ark_day: ctx.day + 30, hold: null, ...change});
};
/** The brood ends: out of the live list, into the ended one. */
const end = (ctx: Ctx, outcome: NonNullable<RawBrood["outcome"]>) => {
    ctx.b.outcome = outcome;
    ctx.b.ended_ark_day = ctx.day;
    ctx.live.splice(ctx.live.indexOf(ctx.b), 1);
    ctx.ended.push(ctx.b);
};

const BROOD_ID = "b100d000-0000-4000-8000-000000000001";

const SCENES: Record<string, Scene> = {
    // A songbird's nest: laid, sat on, raided by a crow (the parent gives way), hatched, a nestling lost with no cause, failed: the nest stands empty.
    broodnest: {
        zone: "farm_garden", hours: 10, distance: 1.5, polar: 1.05,
        cast: [{slug: "american-robin", name: "American Robin", n: 2}, {slug: "american-crow", name: "American Crow", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "American Robin", model_slug: "american-robin", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 4, start: 4, zone: "farm_garden", care: "nest", hold: "sit", laid_ark_day: day, stage_ark_day: day, next_ark_day: day + 13}),
        steps: [
            [60, (c) => lose(c, "taken", 2, 1)],
            [200, (c) => hatch(c)],
            [260, (c) => lose(c, "did_not_survive", 1)],
            [320, (c) => { lose(c, "failed", 1); end(c, "failed"); }]
        ],
        shots: [
            {s: 0.9, label: "laid: the eggs come one by one"}, {s: 8, label: "4 eggs; the parent settles on them"}, {s: 40, label: "sitting"},
            {s: 141, label: "RAID: the crow on its way (+6 s)", distance: 5}, {s: 150.5, label: "RAID: at the nest, the parent gives way"}, {s: 151.6, label: "RAID: one egg gone"}, {s: 154, label: "RAID: 2 taken, 2 left"}, {s: 175, label: "the crow gone; back on 2 eggs"},
            {s: 200.6, label: "HATCH: the eggs rock"}, {s: 203, label: "HATCH: the young out"}, {s: 222, label: "2 nestlings in the nest"},
            {s: 261.5, label: "DID NOT SURVIVE: one fades"}, {s: 268, label: "1 nestling left"},
            {s: 322, label: "FAILED: the last fades"}, {s: 340, label: "the nest stands empty"}, {s: 925, label: "…and fades (10 min on)"}, {s: 935, label: "gone"}
        ]
    },
    // Ducklings: a scrape of 9 eggs sat on, hatched, 6 with the duck's own model and 3 instanced following her, a fox's take of 2 (a chase), 2 lost with no cause, recruitment: 3 hand over, 2 did not settle.
    broodduck: {
        zone: "wetland", hours: 10, distance: 4, polar: 1.1,
        cast: [{slug: "mallard", name: "Mallard", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Mallard", model_slug: "mallard", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 9, start: 9, zone: "wetland", care: "follow", hold: "sit", laid_ark_day: day - 27, stage_ark_day: day - 27, next_ark_day: day}),
        steps: [
            [30, (c) => hatch(c)],
            [120, (c) => lose(c, "taken", 2, 1, true)],
            [300, (c) => lose(c, "did_not_survive", 2)],
            [360, (c) => { c.recruit(3); lose(c, "unsettled", 2); c.b.count = 3; end(c, "independent"); }]
        ],
        shots: [
            {s: 12, label: "9 eggs in a scrape, sat on", distance: 2}, {s: 30.7, label: "HATCH: the eggs rock", distance: 2}, {s: 33.5, label: "HATCH: ducklings out", distance: 2}, {s: 40, label: "round the nest", distance: 3},
            {s: 70, label: "9 ducklings: 6 models + 3 instanced, with her", follow: 0}, {s: 100, label: "following", follow: 0},
            {s: 188, label: "TAKE: the fox comes", distance: 9}, {s: 196.5, label: "TAKE: the chase", distance: 9}, {s: 199, label: "TAKE: +4 s", distance: 9}, {s: 202, label: "TAKE: +7 s", distance: 9}, {s: 206, label: "TAKE: caught", distance: 7}, {s: 216, label: "TAKE: the fox feeds", distance: 7, follow: 1},
            {s: 250, label: "7 left with her", follow: 0}, {s: 301.5, label: "DID NOT SURVIVE: 2 fade", follow: 0}, {s: 310, label: "5 left", follow: 0},
            {s: 361, label: "RECRUITED: 3 hand over (0.8 s)", follow: 0}, {s: 363, label: "RECRUITED: +3 s", follow: 0}, {s: 375, label: "3 new animals; 2 did not settle", follow: 0}
        ]
    },
    // Plover chicks on dry ground: a scrape of 4 eggs, hatched, following the parent; a fox's take of 1 is a chase (`live-meals`).
    broodchick: {
        zone: "grassland", hours: 10, distance: 2.5, polar: 1.1,
        cast: [{slug: "killdeer", name: "Killdeer", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Killdeer", model_slug: "killdeer", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 4, start: 4, zone: "grassland", care: "follow", hold: "sit", laid_ark_day: day - 25, stage_ark_day: day - 25, next_ark_day: day}),
        steps: [[30, (c) => hatch(c)], [120, (c) => lose(c, "taken", 1, 1, true)]],
        shots: [
            {s: 12, label: "4 eggs in a scrape, sat on", distance: 1.2}, {s: 33.5, label: "HATCH: chicks out", distance: 1.2}, {s: 70, label: "4 chicks with the parent", follow: 0}, {s: 100, label: "following", follow: 0},
            {s: 188, label: "TAKE: the fox comes", distance: 8}, {s: 196, label: "TAKE: the chase +1 s", distance: 8}, {s: 198, label: "TAKE: +3 s", distance: 8}, {s: 200, label: "TAKE: +5 s", distance: 8}, {s: 203, label: "TAKE: +8 s", distance: 6, follow: 1}, {s: 210, label: "TAKE: the fox feeds", distance: 5, follow: 1},
            {s: 260, label: "3 left with the parent", follow: 0}
        ]
    },
    // Frog spawn: a clump of 1,200 that lasts, a duck's raid of 300, 300 lost with no cause, hatched: a school of tadpoles, a heron's take of 14, a census cut.
    broodfrog: {
        zone: "wetland", hours: 10, distance: 1.6, polar: 0.85,
        cast: [{slug: "common-frog", name: "Common Frog", n: 2}, {slug: "mallard", name: "Mallard", n: 1}, {slug: "great-blue-heron", name: "Great Blue Heron", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Common Frog", model_slug: "common-frog", parents: [id(0, 0), id(0, 1)], carer: null, stage: "egg", count: 1200, start: 1200, zone: "wetland", care: "none", hold: null, way: "amplexus", way_detail: "spawn_mass", laid_ark_day: day - 2, stage_ark_day: day - 2, next_ark_day: day + 10, young_mass_g: 0.1}),
        steps: [
            [40, (c) => lose(c, "taken", 300, 1)],
            [180, (c) => lose(c, "did_not_survive", 300)],
            [220, (c) => hatch(c)],
            [280, (c) => lose(c, "taken", 14, 2)],
            [420, (c) => lose(c, "did_not_survive", 400)]
        ],
        shots: [
            {s: 10, label: "1,200 eggs: a clump of spawn that lasts"}, {s: 122, label: "RAID: the duck comes", distance: 4}, {s: 133, label: "RAID: feeding at the spawn"}, {s: 139, label: "RAID: half its take gone"}, {s: 144, label: "300 taken: 900 left"},
            {s: 188, label: "300 did not survive: 600 left"}, {s: 221, label: "HATCH"}, {s: 224, label: "tadpoles out"}, {s: 245, label: "600 tadpoles: a school"}, {s: 247, label: "the school +2 s"},
            {s: 362, label: "RAID: the heron comes", distance: 5}, {s: 372, label: "RAID: the heron feeds on tadpoles", distance: 3}, {s: 390, label: "14 taken: 586 left"}, {s: 428, label: "400 did not survive: 186 left"}
        ]
    },
    // A toad's string.
    broodtoad: {
        zone: "wetland", hours: 10, distance: 1.4, polar: 0.7,
        cast: [{slug: "american-toad", name: "American Toad", n: 2}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "American Toad", model_slug: "american-toad", parents: [id(0, 0), id(0, 1)], carer: null, stage: "egg", count: 4000, start: 4000, zone: "wetland", care: "none", hold: null, way: "amplexus", way_detail: "string", laid_ark_day: day - 1, stage_ark_day: day - 1, next_ark_day: day + 8, young_mass_g: 0.05}),
        steps: [[60, (c) => lose(c, "did_not_survive", 2000)]],
        shots: [{s: 10, label: "4,000 eggs: a string wound through the weed"}, {s: 30, label: "it lasts"}, {s: 70, label: "2,000 did not survive: half the string"}]
    },
    // A stickleback's nest: the male fans his eggs for the whole egg stage; fry in a school with him.
    broodfish: {
        zone: "river_lake", hours: 10, distance: 0.7, polar: 1.0,
        cast: [{slug: "three-spined-stickleback", name: "Three-spined Stickleback", n: 2}, {slug: "great-blue-heron", name: "Great Blue Heron", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Three-spined Stickleback", model_slug: "three-spined-stickleback", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 120, start: 120, zone: "river_lake", care: "guard", hold: "guard", way: "spawn_pair", way_detail: "nest", laid_ark_day: day - 3, stage_ark_day: day - 3, next_ark_day: day + 5, young_mass_g: 0.02}),
        steps: [[60, (c) => hatch(c)], [120, (c) => lose(c, "did_not_survive", 60)]],
        shots: [{s: 10, label: "120 eggs in his nest; the male fans them"}, {s: 10.3, label: "fanning +0.3 s"}, {s: 10.6, label: "fanning +0.6 s"}, {s: 40, label: "still fanning (the whole egg stage)"}, {s: 61, label: "HATCH"}, {s: 64, label: "fry out"}, {s: 90, label: "120 fry: 6 models + a school"}, {s: 130, label: "60 did not survive: 60 left"}]
    },
    // A crocodile's clutch on the bank, guarded; a monitor's raid takes a share.
    broodcroc: {
        zone: "river_lake", hours: 10, distance: 4, polar: 1.0,
        cast: [{slug: "mugger-crocodile", name: "Mugger Crocodile", n: 2}, {slug: "savannah-monitor", name: "Savannah Monitor", n: 1}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Mugger Crocodile", model_slug: "mugger-crocodile", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 28, start: 28, zone: "river_lake", care: "guard", hold: "guard", laid_ark_day: day - 30, stage_ark_day: day - 30, next_ark_day: day + 30, young_mass_g: 70}),
        steps: [[40, (c) => lose(c, "taken", 9, 1)], [200, (c) => hatch(c, {care: "guard"})]],
        shots: [{s: 10, label: "28 eggs in a scrape (24 drawn), guarded"}, {s: 121, label: "RAID: the monitor comes", distance: 7}, {s: 131, label: "RAID: at the clutch"}, {s: 137, label: "RAID: eggs going"}, {s: 145, label: "9 taken: 19 left"}, {s: 201, label: "HATCH"}, {s: 204, label: "hatchlings out"}, {s: 230, label: "19 hatchlings: 6 models + 13 instanced, by the guarding parent", follow: 0, distance: 5}]
    },
    // A fox's litter: carried (nothing drawn), then cubs at the den; one lost with no cause.
    broodden: {
        zone: "woodland", hours: 10, distance: 3.5, polar: 1.1,
        cast: [{slug: "red-fox", name: "Red Fox", n: 2}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Red Fox", model_slug: "red-fox", parents: [id(0, 0), id(0, 1)], stage: "carried", count: 5, start: 5, zone: "woodland", care: "nest", hold: null, laid_ark_day: day - 50, stage_ark_day: day - 50, next_ark_day: day, young_mass_g: 100}),
        steps: [[30, (c) => { hatch(c); c.b.laid_ark_day = c.day; }], [120, (c) => lose(c, "did_not_survive", 1)]],
        shots: [{s: 10, label: "CARRIED: 5 young inside her (nothing drawn)"}, {s: 34, label: "BORN: 5 cubs at the den"}, {s: 60, label: "the litter at the den"}, {s: 100, label: "+40 s"}, {s: 121.5, label: "DID NOT SURVIVE: one fades"}, {s: 130, label: "4 cubs left"}]
    },
    // A wolf spider's egg sac, then spiderlings.
    broodspider: {
        zone: "farm_garden", hours: 10, distance: 0.35, polar: 0.9,
        cast: [{slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 2}],
        brood: ({id, day}) => rawBrood({id: BROOD_ID, name: "Carolina Wolf Spider", model_slug: "carolina-wolf-spider", parents: [id(0, 0), id(0, 1)], stage: "egg", count: 150, start: 150, zone: "farm_garden", care: "carry", hold: "guard", laid_ark_day: day - 5, stage_ark_day: day - 5, next_ark_day: day + 10, young_mass_g: 0.001}),
        steps: [[40, (c) => hatch(c, {care: "carry"})], [100, (c) => lose(c, "did_not_survive", 75)]],
        shots: [{s: 10, label: "150 eggs: one sac, guarded"}, {s: 44, label: "HATCH: spiderlings"}, {s: 70, label: "150 spiderlings: models on her + a cluster"}, {s: 108, label: "75 did not survive"}]
    }
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
    const name = params.get("scene") ?? "broodnest";
    const scene = SCENES[name];
    if (!scene) throw new Error(`no scene ${name}`);
    /** `on`: the fixture's read along the timeline. `off`: a read that says `on: false`. `none`: no read at all (today's scene). */
    // (`none2`: `none` again, the control for the comparison: how alike two loads of the very same scene are.)
    const asked = params.get("broods") ?? "on";
    const mode = (asked === "on" || asked === "off" ? asked : "none") as "on" | "off" | "none";
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    if (params.get("grass") === "0") (globalThis as {__arkNoGrass?: boolean}).__arkNoGrass = true;
    const template = fixture.animals[0];
    // (The scene's own Ark day at the scene's clock: from the voyage's start, as the live page has it.)
    let day0 = (Date.UTC(2026, 10, 20, scene.hours) + 60_000 - Date.parse(fixture.voyage.started_at)) / (FIXTURE_ARK_DAY_SECONDS * 1000);
    const animals: Raw[] = [];
    scene.cast.forEach((c, k) => {
        for (let i = 0; i < c.n; i++) animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: c.activity ?? "diurnal", sociality: k === 0 ? "pair" : "solitary", slot: 90 + k, slot_rank: i, origin: "arrived", born_ark_day: 0} as Raw);
    });
    const decoded = decodeArkSnapshot({...fixture, animals});
    if (!decoded) throw new Error("fixture did not decode");
    let snapshot = decoded;
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true)});
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
    console.log("[broods] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    type Entry = {animal: {id: string; model_slug: string}; place: {x: number; z: number; ground: number}; act: Record<string, unknown> | null; length: number};
    type Debug = {entries: () => Entry[]; broods: () => {broods: Array<{id: string; stage: string; ended: boolean; count: number; eggs: number; young: number; models: number; place: {x: number; z: number; y: number} | null; sitter: string | null; acts: Array<{id: string; kind: string; t0: number; effectAt: number; acted: boolean; over: boolean}>}>; drawn: Record<string, number>} | null; controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}; meals: () => Array<{key: string; t0: number; catchAt: number}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const a = castId(0, 0);
    const home = debug.entries().find((e) => e.animal.id === a)?.place ?? null;
    if (!home) throw new Error("cast not placed");
    // (Closer than the page lets a visitor come: an egg is a few centimetres.)
    debug.controls.minDistance = Math.min(debug.controls.minDistance, 0.2);
    debug.camera.near = 0.03;
    debug.camera.updateProjectionMatrix();
    // (The scene's own Ark day: the harness pins the island's hour, and the scene's day with it. The live page's is the voyage's.)
    const sceneDay = (debug as unknown as {liveliness?: {arkDayNow?: number}}).liveliness?.arkDayNow;
    if (typeof sceneDay === "number" && sceneDay > 0) day0 = sceneDay;
    console.log("[broods] ark day", day0);
    const hunter = (k: number) => ({id: castId(k, 0), species_profile_id: speciesId(k), name: scene.cast[k].name, model_slug: scene.cast[k].slug});
    const live: RawBrood[] = [scene.brood({id: castId, day: day0, hunter})];
    const ended: RawBrood[] = [];
    const b = live[0];
    let recruits = 0;
    const apply = (epoch: number) => {
        if (mode === "none") return;
        handle.setBroods?.(mode === "off" ? ARK_BROODS_OFF : decodeArkBroods(JSON.parse(JSON.stringify(rawBroodsRead(epoch, day0 + (epoch - t0) / FIXTURE_ARK_DAY_SECONDS, live, ended)))));
    };
    const ctxAt = (epoch: number): Ctx => ({
        epoch,
        day: day0 + (epoch - t0) / FIXTURE_ARK_DAY_SECONDS,
        b,
        live,
        ended,
        id: castId,
        hunter,
        encounter: (k) => {
            const at = handle.locate(castId(k, 0));
            const nest = debug.broods()?.broods[0]?.place ?? home;
            return at ? {t: epoch, predator: {x: at.x, z: at.z}, prey: {x: nest.x, z: nest.z, r: 2.5}} : undefined;
        },
        recruit: (n) => {
            const ids: string[] = [];
            for (let i = 0; i < n; i++) ids.push(castId(9, recruits++));
            if (mode !== "on") return ids;
            const young = ids.map((id, i) => ({...template, id, species_profile_id: speciesId(0), name: scene.cast[0].name, scientific_name: scene.cast[0].name, model_slug: scene.cast[0].slug, zone: scene.zone, activity: "diurnal", sociality: "pair", slot: 90, slot_rank: 2 + i, origin: "born", born_ark_day: b.stage_ark_day}) as Raw);
            animals.push(...young);
            const next = decodeArkSnapshot({...fixture, animals});
            if (next) {
                snapshot = next;
                handle.update(snapshot);
                handle.noteRecruits?.([{brood: b.id, young: ids, parents: b.parents}]);
            }
            return ids;
        }
    });
    // The first read (the brood as it is at the start), then each step at its own moment.
    await setAt(t0);
    apply(t0);
    let next = 0;
    const advance = async (s: number) => {
        while (next < scene.steps.length && scene.steps[next][0] <= s) {
            const [at, step] = scene.steps[next++];
            await setAt(t0 + at);
            step(ctxAt(t0 + at));
            apply(t0 + at);
            await frames(3);
        }
    };
    const view = (distance: number, at: {x: number; y?: number; z: number}, polar: number, azimuth: number): ArkCameraView => ({target: {x: at.x, y: (at.y ?? Math.max(handle.heightAt(at.x, at.z), 0)) + distance * 0.06, z: at.z}, distance, polar, azimuth});
    /** Where the brood is (kept from the `on` run's own layer; with no layer, the first parent's home). */
    let spot: {x: number; y: number; z: number} | null = null;
    const api = {
        plan: () => scene.shots,
        steps: () => scene.steps.map(([s]) => s),
        /** The view the last shot was framed with (the `on` run's are given to the others: the same camera before and after). */
        lastView: null as ArkCameraView | null,
        shot: async (i: number, given?: ArkCameraView | null) => {
            const shot = scene.shots[i];
            await advance(shot.s);
            await setAt(t0 + shot.s - 2.5);
            for (let k = 1; k <= 25; k++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const placed = debug.broods()?.broods[0]?.place as {x: number; y: number; z: number; top?: number; water?: boolean} | null | undefined;
            // (A brood in the water is framed from above its surface: the scene draws the freshwater's animals from there.)
            if (placed) spot = {x: placed.x, y: placed.water ? Math.max(placed.top ?? placed.y, placed.y) : placed.y, z: placed.z};
            const nest = spot ?? {x: home.x, y: home.ground, z: home.z};
            const who = shot.follow !== undefined ? handle.locate(castId(shot.follow, 0)) : null;
            const distance = shot.distance ?? scene.distance;
            const at = who ?? nest;
            // (From the clearest side: a nest under a fern or in a tuft was filmed through its leaves.)
            const clear = handle.clearView?.({x: at.x, y: at.y ?? 0, z: at.z}, distance, shot.polar ?? scene.polar ?? 1.1, shot.azimuth ?? scene.azimuth ?? 0.7) ?? null;
            const shown = given ?? view(distance, at, clear?.polar ?? shot.polar ?? scene.polar ?? 1.1, clear?.azimuth ?? shot.azimuth ?? scene.azimuth ?? 0.7);
            api.lastView = shown;
            // (Closer than the page lets a visitor come, set with each view: the scene puts its own floor back.)
            handle.setNearCut?.(null, Math.min(distance, 4));
            await frames(2);
            handle.setView(shown);
            await frames(3);
            const state = debug.broods();
            const row = state?.broods[0];
            const acts = debug.entries().filter((e) => e.act).map((e) => `${e.animal.model_slug}${e.animal.id.startsWith("brood:") ? `#${e.animal.id.slice(-1)}` : ""} ${String(e.act!.state ?? "")}${e.act!.hidden ? " hidden" : ""}${Number(e.act!.scale) < 1 ? ` scale ${Number(e.act!.scale).toFixed(2)}` : ""}`);
            const read = mode === "on" ? decodeArkBroods(rawBroodsRead(t0 + shot.s, day0, live, ended)) : ARK_BROODS_OFF;
            const card = arkBroodsByParent(read).get(a)?.[0];
            const line = card ? arkBroodCardLine(card, null, "en", (n) => `${/^[aeiou]/i.test(n) ? "an" : "a"} ${n}`) : null;
            const standIns = debug.entries().filter((e) => e.animal.id.startsWith("brood:")).length;
            const where = (id: string) => {
                const at = handle.locate(id);
                return at ? `${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)}` : "-";
            };
            const actOf = debug.entries().find((e) => e.animal.id === a)?.act as {base?: number; state?: string} | null | undefined;
            const sizes = debug.entries().filter((e) => e.animal.id.startsWith("brood:") || e.animal.id === a).map((e) => `${e.animal.id.slice(-2)}:${e.length.toFixed(3)}/${String((e.animal as {born_ark_day?: number}).born_ark_day ?? "-").slice(0, 8)}/${(e.animal as {origin?: string}).origin}`).join(" ");
            const arkNow = (debug as unknown as {liveliness?: {arkDayNow?: number; ageOf?: (e: unknown) => {stage?: string; scale?: number} | null}}).liveliness;
            const firstStandIn = debug.entries().find((e) => e.animal.id.startsWith("brood:"));
            const age = firstStandIn && arkNow?.ageOf ? arkNow.ageOf(firstStandIn) : null;
            const trace = `ark day ${arkNow?.arkDayNow} lengths ${sizes} age ${JSON.stringify(age ? {stage: age.stage, scale: age.scale} : null)} ground ${row?.place ? handle.heightAt(row.place.x, row.place.z).toFixed(2) : "-"} a.act ${actOf ? `${Number(actOf.base).toFixed(2)} ${actOf.state}` : "-"} nest ${row?.place ? `${row.place.x.toFixed(2)},${row.place.y.toFixed(2)},${row.place.z.toFixed(2)}` : "-"} home ${home.x.toFixed(2)},${home.ground.toFixed(2)},${home.z.toFixed(2)} a ${where(a)} b ${where(castId(0, 1))} c ${scene.cast[1] ? where(castId(1, 0)) : "-"} view ${JSON.stringify(handle.view?.() ?? null).slice(0, 160)}`;
            return [`${name} [${mode}] +${shot.s} s  ${shot.label}`, row ? `record: ${row.stage}${row.ended ? " (ended)" : ""} count ${row.count} · drawn: eggs ${row.eggs.toFixed(0)} young ${row.young.toFixed(1)} models ${row.models} (entries ${standIns}) sitter ${row.sitter ? "yes" : "no"} · instances ${JSON.stringify(state!.drawn)}` : "no brood layer", line ? `card: ${line.head}${line.notes.length ? ` — ${line.notes.join("; ")}` : ""}` : "", row ? `acts: ${row.acts.map((x) => `${x.kind}${x.acted ? "*" : ""}${x.over ? " over" : ` t0 ${(x.t0 - t0).toFixed(0)} → ${(x.effectAt - t0).toFixed(0)}`}`).join(", ")}` : "", acts.join(" | "), trace].filter(Boolean).join("\n");
        },
        handle
    };
    (window as unknown as {__broods: typeof api}).__broods = api;
}

main().catch((error) => {
    console.error("[broods]", error?.stack ?? error);
    (window as unknown as {__broodsError?: string}).__broodsError = String(error?.stack ?? error);
});
