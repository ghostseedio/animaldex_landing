/**
 * The behaviour recipes' clip page (development only; `scripts/ark-recipe-clips.mjs` builds it into
 * `.ark-golden/recipes/` and serves it, nothing deploys it). The live scene with a cast-only snapshot for one
 * clip (`?clip=kingfisher|stags|murmuration|nest|heron|osprey`; the chases: `pounce|heron_strike|osprey_dive|dolphin_chase|
 * swallow_hawk|meal_chase`), at a pinned hour. It finds the moment with the
 * engine's own pure functions (a world built the same as the scene's, the scene's own wired animals), then
 * `window.__clip` steps a controlled clock frame by frame so a one-second dive gets every frame.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";
import {forgetSchedules, roostOf, scheduleWorld, SLOT_SECONDS, tripAt, tripEpisode, recipeNest, poseOnTrip, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {microMurmuration, nestStageAt, pairWindows, ROOST_AMBIENT, roostPoint, setFallbackNests, setNestSource, sexLook, type Episode, type Key, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {hashString, heightAt} from "@/ark-scene/world";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Species = {id: string; name: string; zone: string; activity: string | null; sociality: string | null};
const SPECIES: Record<string, Species> = {
    "common-kingfisher": {id: "0d991095-9587-402c-892c-a2cbea1750cf", name: "Common Kingfisher", zone: "river_lake", activity: "diurnal", sociality: null},
    "red-deer": {id: "9e4c04ec-46ac-4019-b396-7b9e5afb2028", name: "Red Deer", zone: "grassland", activity: "crepuscular", sociality: "group"},
    "european-starling": {id: "47097175-041c-45e3-8b17-19ecec9ad72d", name: "European Starling", zone: "farm_garden", activity: "diurnal", sociality: "group"},
    "black-billed-magpie": {id: "ddf29082-be9b-449a-9007-dbc34818102f", name: "Black-billed Magpie", zone: "woodland", activity: "diurnal", sociality: "group"},
    "barn-swallow": {id: "389d6e31-1cd3-491e-b92d-3c23a94b2a1e", name: "Barn Swallow", zone: "farm_garden", activity: "diurnal", sociality: null},
    "grey-heron": {id: "18bed140-4543-4a6f-b741-d32f764b75ce", name: "Grey Heron", zone: "wetland", activity: "diurnal", sociality: null},
    osprey: {id: "360d1b44-2874-4312-aa80-c4f99d5e1156", name: "Osprey", zone: "seashore", activity: "diurnal", sociality: null},
    "giant-burrowing-mayfly": {id: "90f14d65-4f5c-4625-a6f0-5516ae48cb04", name: "Giant Burrowing Mayfly", zone: "river_lake", activity: null, sociality: null},
    // (Staged in the grassland for the clips: lone acacias, so the roost and the stream are seen against the sky, not in a crown.)
    "kuhls-pipistrelle-bat": {id: "015d256f-f9c3-45b4-bdfc-88c9b56c1ea9", name: "Kuhl's Pipistrelle", zone: "grassland", activity: "nocturnal", sociality: "group"},
    "large-flying-fox": {id: "b4cc55f6-a237-4578-96db-267844168da4", name: "Large Flying Fox", zone: "grassland", activity: "nocturnal", sociality: "group"},
    mallard: {id: "85fd945d-1452-4b1d-b3e8-3d737b2eac6c", name: "Mallard", zone: "river_lake", activity: "any", sociality: "group"},
    // The chases (motion pass, L7).
    serval: {id: "656dc11e-271e-41d9-ac6a-ae6fbfa69fe2", name: "Serval", zone: "grassland", activity: "diurnal", sociality: null},
    "spinner-dolphin": {id: "0000c0de-0000-4000-8000-00000000d01f", name: "Spinner Dolphin", zone: "coral_reef", activity: "any", sociality: "group"},
    "african-lion": {id: "7e7080ec-9c17-4a75-9d85-5a4f6a38e430", name: "African Lion", zone: "grassland", activity: "diurnal", sociality: "group"},
    "plains-zebra": {id: "c77f8bc4-c073-4a77-ad24-788b76fbbbda", name: "Plains Zebra", zone: "grassland", activity: "diurnal", sociality: "group"},
    // Signature behaviours, wave 2 (birds): staged by day (an owl is "any": its schedule forages in the light for the clip).
    "brown-shrike": {id: "0000b1d0-0000-4000-8000-000000000001", name: "Brown Shrike", zone: "grassland", activity: "diurnal", sociality: null},
    "american-kestrel": {id: "0000b1d0-0000-4000-8000-000000000002", name: "American Kestrel", zone: "grassland", activity: "diurnal", sociality: null},
    "little-owl": {id: "0000b1d0-0000-4000-8000-000000000003", name: "Little Owl", zone: "farm_garden", activity: "any", sociality: null},
    "laughing-kookaburra": {id: "0000b1d0-0000-4000-8000-000000000004", name: "Laughing Kookaburra", zone: "woodland", activity: "diurnal", sociality: null},
    "spotted-wood-owl": {id: "0000b1d0-0000-4000-8000-000000000005", name: "Spotted Wood Owl", zone: "woodland", activity: "any", sociality: null},
    rook: {id: "0000b1d0-0000-4000-8000-000000000006", name: "Rook", zone: "woodland", activity: "diurnal", sociality: "group"},
    // (Lane SIG10: the black vulture's communal roost, its roost-mates in the dark tone.)
    "black-vulture": {id: "d0d1c412-a1d6-4944-b2fe-afea3710315a", name: "Black Vulture", zone: "woodland", activity: "diurnal", sociality: "group"},
    "house-sparrow": {id: "0000b1d0-0000-4000-8000-000000000007", name: "House Sparrow", zone: "farm_garden", activity: "diurnal", sociality: "group"},
    "african-penguin": {id: "0000b1d0-0000-4000-8000-000000000009", name: "African Penguin", zone: "seashore", activity: "diurnal", sociality: "group"},
    "song-thrush": {id: "0000b1d0-0000-4000-8000-00000000000a", name: "Song Thrush", zone: "farm_garden", activity: "diurnal", sociality: null},
    limpkin: {id: "0000b1d0-0000-4000-8000-00000000000b", name: "Limpkin", zone: "wetland", activity: "diurnal", sociality: null},
    "black-swan": {id: "0000b1d0-0000-4000-8000-00000000000c", name: "Black Swan", zone: "river_lake", activity: "diurnal", sociality: "group"},
    "emu": {id: "0000b1d0-0000-4000-8000-00000000000e", name: "Emu", zone: "grassland", activity: "diurnal", sociality: "group"},
    "white-throated-kingfisher": {id: "0000b1d0-0000-4000-8000-00000000000d", name: "White-throated Kingfisher", zone: "grassland", activity: "diurnal", sociality: null}
};

type Moment = {start: number; seconds: number; step: number; /** Signature wave 2 (birds): the world times (epoch s) of the frames, where uniform steps would miss a second-long swoop: the recorder takes these in place of `step`. */ times?: number[]; view: ArkCameraView; note: string; follow?: string | null; /** Signature wave 2 (birds): the camera follows this animal (its place each frame, the view's distance and angles kept). */ track?: string | null; /** A replay to play from the start (a meal's chase). */ play?: ArkAct[]; /** Closer than the scene's 4 m (a grasshopper's chase): the view held each frame, the near limit lowered. */ close?: boolean};
type Clip = {cast: Array<[string, string, number]>; hours: number; date: number; /** Signature wave 2 (birds): the island hour follows the clock (a roost's evening), not pinned at `hours`. */ live?: boolean; /** Signature wave 2 (birds): the Ark day pinned (a nesting season), else the clock's. */ arkDay?: number; /** Signature wave 2 (birds): clutches in the snapshot (the props' nests, the eggs a male sits). */ nests?: string[]; find: (ctx: Context) => Moment | null};
type Context = {world: ReturnType<typeof scheduleWorld>; animals: Array<{id: string; slug: string; animal: ScheduleAnimal; profile: ArkBehaviourProfile; activity: ArkBehaviourProfile["activity"] | null; place: {x: number; z: number}; zone: string}>; micro: Array<{id: string; slug: string; at: {x: number; y: number; z: number}}>; hoursAt: (epoch: number) => number; date: number};

const view = (x: number, y: number, z: number, distance: number, polar = 1.15, azimuth = 0.6): ArkCameraView => ({target: {x, y, z}, distance, polar, azimuth});

/** Slots of an animal from a time on, with their trips. */
function trips(ctx: Context, a: Context["animals"][number], from: number, hours: number): Trip[] {
    const out: Trip[] = [];
    for (let t = from; t < from + hours * 3600; t += SLOT_SECONDS) out.push(tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity));
    return out;
}

const CLIPS: Record<string, Clip> = {
    kingfisher: {
        cast: [["kf", "common-kingfisher", 3]],
        hours: 10,
        date: Date.UTC(2026, 6, 14, 10) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "perch_plunge") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const dive = ep?.keys.find((k) => k.block.id === "dive_air" && k.catch?.ok);
                    if (!ep || !dive) continue;
                    const perch = trip.to;
                    const mid = {x: (perch.x + dive.to.x) / 2, y: (perch.y + dive.to.y) / 2, z: (perch.z + dive.to.z) / 2};
                    const span = Math.hypot(perch.x - dive.to.x, perch.y - dive.to.y, perch.z - dive.to.z);
                    const side = Math.atan2(dive.to.x - perch.x, dive.to.z - perch.z) + Math.PI / 2;
                    // From the side, the perch and the water both in frame; half speed (48 steps a world second, played at 24).
                    return {start: dive.t0 - 2.5, seconds: 7, step: 1 / 48, view: view(mid.x, mid.y, mid.z, Math.max(span * 2.1, 6), 1.33, side), note: `${a.slug} ${a.id}: dive at ${dive.t0.toFixed(1)}, perch ${perch.y.toFixed(1)} m up, ${span.toFixed(1)} m to the water`};
                }
            }
            return null;
        }
    },
    stags: {
        cast: [["deer", "red-deer", 8]],
        // Crepuscular deer are up while the sun is under 22°: an early morning.
        hours: 6.4,
        date: Date.UTC(2026, 9, 6, 7) / 1000,
        find: (ctx) => {
            // Only inside the pairs' meeting windows (pure, from each pair's key): the first with a fight in it.
            for (const a of ctx.animals.filter((x) => sexLook(x.id, x.slug).sex === "male")) {
                for (const w of pairWindows(a.animal, a.slug, ctx.date, ctx.date + 2 * 86400)) {
                    for (let t = w.start; t < w.end; t += 1) {
                        const pa = poseOnTrip(ctx.world, tripAt(ctx.world, a.profile, a.animal, t, ctx.hoursAt, a.activity), t) as RecipePose;
                        if (pa.act?.block !== "fight") continue;
                        // From the side of the line between the two, so the clash is seen across, not along.
                        const b = ctx.animals.find((x) => x.id === w.other)!;
                        const pb = poseOnTrip(ctx.world, tripAt(ctx.world, b.profile, b.animal, t, ctx.hoursAt, b.activity), t);
                        const across = Math.atan2(pb.z - pa.z, -(pb.x - pa.x));
                        return {start: w.start - 1, seconds: Math.min(w.end - w.start, 70), step: 1 / 8, view: view((pa.x + pb.x) / 2, pa.y + 0.9, (pa.z + pb.z) / 2, 7.5, 1.3, across), note: `${a.id} and ${w.other}: ${w.template} window ${w.start}, fighting at ${t}`};
                    }
                }
            }
            return null;
        }
    },
    murmuration: {
        cast: [["st", "european-starling", 16]],
        hours: 17.8,
        date: Date.UTC(2026, 10, 11, 17) / 1000,
        find: (ctx) => {
            // House starlings (micro animals, off the schedule): their flock's murmuration is over their spot.
            const entry = ctx.micro[0];
            if (!entry) return null;
            const m = microMurmuration(entry.id, entry.slug, entry.at, ctx.date + 1200, ctx.hoursAt(0), heightAt);
            const c = m?.act.flock?.centre ?? entry.at;
            return {start: ctx.date + 1200, seconds: 30, step: 1 / 6, view: view(c.x, c.y, c.z, 90, 1.36, 0.9), note: `centre ${c.x.toFixed(1)},${c.z.toFixed(1)}`};
        }
    },
    nest: {
        cast: [["sw", "barn-swallow", 2]],
        hours: 11,
        date: Date.UTC(2026, 3, 1, 11) / 1000,
        find: (ctx) => {
            const a = ctx.animals[0];
            const site = recipeNest(ctx.world, a.profile, a.animal, ctx.date + 86400);
            if (!site) return null;
            // A trip of it carrying material, a few days in.
            for (const trip of trips(ctx, a, ctx.date + 2.3 * 86400, 10)) {
                if (trip.recipe !== "nest_build") continue;
                const ep = tripEpisode(ctx.world, trip);
                const carry = ep?.keys.find((k) => k.carry?.item === "material" && k.block.motion === "travel");
                if (!ep || !carry) continue;
                // Facing the wall or ledge it is on (out along the point's normal), a little to one side.
                const out = Math.atan2(site.nx, site.nz) + 0.35;
                return {start: carry.t0 - 2, seconds: 14, step: 1 / 8, view: view(site.x, site.y - 0.2, site.z, 3.2, 1.25, out), note: `site ${site.x.toFixed(1)},${site.y.toFixed(1)},${site.z.toFixed(1)}; stage now ${nestStageAt(a.slug, carry.t0).toFixed(2)}`};
            }
            return null;
        }
    },
    heron: {
        cast: [["he", "grey-heron", 2]],
        hours: 9,
        date: Date.UTC(2026, 6, 14, 9) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "wade_spear") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const strike = ep?.keys.find((k) => k.block.id === "strike" && k.catch?.ok);
                    if (!ep || !strike) continue;
                    return {start: strike.t0 - 4, seconds: 9, step: 1 / 12, view: view(strike.from.x, strike.from.y + 0.6, strike.from.z, 4.5, 1.3, 1.1), note: `${a.id} strike at ${strike.t0}`};
                }
            }
            return null;
        }
    },
    swarm: {
        cast: [["mf", "giant-burrowing-mayfly", 2]],
        hours: 17.8,
        date: Date.UTC(2026, 5, 20, 17) / 1000,
        find: (ctx) => {
            const a = ctx.animals[0];
            if (!a) return null;
            const h = a.animal.home;
            return {start: ctx.date + 600, seconds: 12, step: 1 / 12, view: view(h.x, h.y + 1.2, h.z, 3.2, 1.3, 0.7), note: `mayflies dancing over ${h.x.toFixed(1)},${h.z.toFixed(1)}`};
        }
    },
    bats: {
        cast: [["pi", "kuhls-pipistrelle-bat", 3], ["ff", "large-flying-fox", 2]],
        hours: 17.9,
        date: Date.UTC(2026, 5, 20, 17) / 1000,
        find: (ctx) => {
            const a = ctx.animals.find((x) => x.slug === "large-flying-fox") ?? ctx.animals[0];
            if (!a) return null;
            const roost = roostOf(ctx.world, a.profile, a.animal);
            // From the east, low, against the sunset glow in the west (bats are seen against the sky), 80 m off.
            // The scene's own selection camera on the bat (it finds a clear view into a crown), from just before it leaves.
            return {start: ctx.date + 600, seconds: 16, step: 1 / 10, view: view(roost.x, Math.max(heightAt(roost.x, roost.z), 0), roost.z, 50, 1.36, Math.PI / 2 + 0.5), note: `${a.slug} roost ${roost.point}, ${roost.y.toFixed(1)} m up`};
        }
    },
    bats_day: {
        cast: [["pi", "kuhls-pipistrelle-bat", 3], ["ff", "large-flying-fox", 2]],
        hours: 12,
        date: Date.UTC(2026, 5, 20, 12) / 1000,
        find: (ctx) => {
            // The pipistrelles (woodland, lower limbs), close under the limb.
            const a = ctx.animals.find((x) => x.slug === "large-flying-fox") ?? ctx.animals[0];
            if (!a) return null;
            const roost = roostOf(ctx.world, a.profile, a.animal);
            return {start: ctx.date + 600, seconds: 2, step: 1, view: view(roost.x, Math.max(heightAt(roost.x, roost.z), 0), roost.z, 15, 1.36, Math.PI / 2 + 0.5), note: `${a.slug} hanging at ${roost.point}, ${roost.y.toFixed(1)} m up`};
        }
    },
    sitter: {
        cast: [["md", "mallard", 2]],
        hours: 10,
        date: Date.UTC(2026, 4, 10, 10) / 1000,
        find: (ctx) => {
            // The duck (the female: drakes don't sit) with eggs in a stand-in for the props lane's nest, at the nearest water's edge.
            const a = ctx.animals.find((x) => sexLook(x.id, x.slug).sex === "female") ?? ctx.animals[0];
            if (!a) return null;
            const edge = ctx.world.sampler.attachPoints("water_edge", {x: a.animal.home.x, z: a.animal.home.z, r: 30})[0];
            if (!edge) return null;
            const site = {x: edge.x, y: Math.max(ctx.world.sampler.heightAt(edge.x, edge.z), 0), z: edge.z};
            setNestSource((id) => (id === a.id ? {...site, stage: 1, eggs: 8} : null));
            setFallbackNests(true);
            forgetSchedules();
            return {start: ctx.date + 900, seconds: 16, step: 1 / 4, view: view(site.x, site.y, site.z, 2.6, 1.25, 0.9), note: `${a.id.slice(-4)} on its nest at ${site.x.toFixed(1)},${site.z.toFixed(1)} (8 eggs, stand-in source)`};
        }
    },
    osprey: {
        cast: [["os", "osprey", 2]],
        hours: 10,
        date: Date.UTC(2026, 6, 14, 10) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 6)) {
                    if (trip.recipe !== "talon_grab") continue;
                    const ep = tripEpisode(ctx.world, trip);
                    const dive = ep?.keys.find((k) => k.block.id === "dive_feet" && k.catch?.ok);
                    if (!ep || !dive) continue;
                    return {start: dive.t0 - 3, seconds: 10, step: 1 / 16, view: view(dive.to.x, 2, dive.to.z, 14, 1.3, 0.3), note: `${a.id} dive at ${dive.t0}`};
                }
            }
            return null;
        }
    },
    // MARK: Signature behaviours, wave 2 (birds): the perch-hunters' drop, a communal roost, a kingfisher's tunnel, a thrush's anvil, a limpkin's snail, a swan's preening.
    drop_shrike: {cast: [["sh", "brown-shrike", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop_insect", true)},
    drop_kestrel: {cast: [["ke", "american-kestrel", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop_insect_feet", true)},
    drop_owl: {cast: [["ow", "little-owl", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop", false)},
    drop_kookaburra: {cast: [["kb", "laughing-kookaburra", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop", false)},
    drop_woodowl: {cast: [["wo", "spotted-wood-owl", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop", false)},
    drop_wtkingfisher: {cast: [["wk", "white-throated-kingfisher", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => dropMoment(ctx, "perch_drop", false)},
    // The roost: the busiest hour of arrivals (a time lapse of the evening) and the minute of the busiest wave (real time).
    roost_lapse: {live: true, cast: [["rk", "rook", 5]], hours: 17.1, date: Date.UTC(2026, 10, 12, 17) / 1000 + 360, find: (ctx) => roostMoment(ctx, "lapse")},
    roost_wave: {live: true, cast: [["rk", "rook", 5]], hours: 17.1, date: Date.UTC(2026, 10, 12, 17) / 1000 + 360, find: (ctx) => roostMoment(ctx, "wave")},
    roost_sparrow: {live: true, cast: [["hs", "house-sparrow", 5]], hours: 17.1, date: Date.UTC(2026, 10, 12, 17) / 1000 + 360, find: (ctx) => roostMoment(ctx, "wave")},
    roost_vulture: {live: true, cast: [["bv", "black-vulture", 4]], hours: 17.1, date: Date.UTC(2026, 10, 12, 17) / 1000 + 360, find: (ctx) => roostMoment(ctx, "wave")},
    roost_vulture_night: {live: true, cast: [["bv", "black-vulture", 4]], hours: 22, date: Date.UTC(2026, 10, 12, 22) / 1000, find: (ctx) => roostMoment(ctx, "night")},
    roost_night: {live: true, cast: [["rk", "rook", 5]], hours: 22, date: Date.UTC(2026, 10, 12, 22) / 1000, find: (ctx) => roostMoment(ctx, "night")},
    roost_dawn: {live: true, cast: [["rk", "rook", 5]], hours: 5.4, date: Date.UTC(2026, 10, 13, 5) / 1000 + 1500, find: (ctx) => roostMoment(ctx, "dawn")},
    kingfisher_tunnel: {
        arkDay: 150,
        cast: [["kt", "common-kingfisher", 3]],
        hours: 10,
        date: Date.UTC(2026, 3, 14, 10) / 1000,
        find: (ctx) => digMoment(ctx, "bank_burrow")
    },
    penguin_dig: {
        cast: [["pg", "african-penguin", 3]],
        hours: 10,
        date: Date.UTC(2026, 3, 14, 10) / 1000,
        find: (ctx) => digMoment(ctx, "dig_burrow")
    },
    thrush_anvil: {cast: [["th", "song-thrush", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => blockMoment(ctx, "anvil_smash", "beat_prey", 10, 6)},
    limpkin_snail: {cast: [["lk", "limpkin", 3]], hours: 10, date: Date.UTC(2026, 3, 14, 10) / 1000, find: (ctx) => blockMoment(ctx, "snail_extract", "tool", 9, 5)},
    // The male alone sits the clutch (an emu's): the seeded male of four, on the nest the props draw, the clutch the record's.
    emu_nest: {
        arkDay: 150,
        nests: ["emu"],
        cast: [["em", "emu", 4]],
        hours: 10,
        date: Date.UTC(2026, 10, 10, 10) / 1000,
        find: (ctx) => {
            const male = ctx.animals.find((x) => sexLook(x.id, x.slug).sex === "male");
            if (!male) return null;
            return {start: ctx.date + 600, seconds: 16, step: 1, close: true, track: male.id, view: view(male.place.x, Math.max(heightAt(male.place.x, male.place.z), 0), male.place.z, 5.5, 1.2, 0.9), note: `the male ${male.id.slice(-4)} of ${ctx.animals.length} emus`};
        }
    },
    swan_preen: {
        cast: [["sw", "black-swan", 3]],
        hours: 10,
        date: Date.UTC(2026, 3, 14, 10) / 1000,
        find: (ctx) => {
            for (const a of ctx.animals) {
                for (const trip of trips(ctx, a, ctx.date, 12)) {
                    const ep = tripEpisode(ctx.world, trip);
                    if (ep?.recipe !== "groom_self") continue;
                    const k = ep.keys.find((key) => key.block.id === "groom");
                    if (!k) continue;
                    return {start: ep.t0 - 1, seconds: Math.min(ep.t1 - ep.t0 + 2, 22), step: 1 / 2, close: true, track: a.id, view: view(k.from.x, k.from.y + 0.5, k.from.z, 4.5, 1.3, k.yaw + Math.PI / 2), note: `${a.id.slice(-4)} groom_self ${(ep.t1 - ep.t0).toFixed(0)} s`};
                }
            }
            return null;
        }
    },
    // MARK: The chases (motion pass, lane L7): visual hunts of ambient prey, and a meal's chase.
    pounce: {
        cast: [["sv", "serval", 2]],
        hours: 9,
        date: Date.UTC(2026, 10, 12, 9) / 1000,
        find: (ctx) => huntMoment(ctx, "pounce", "leap", (k, ep) => {
            const from = ep.keys[ep.keys.indexOf(k) - 1] ?? k;
            const side = Math.atan2(k.to.x - from.from.x, k.to.z - from.from.z) + Math.PI / 2;
            // (On the landing, where the grasshopper is caught or hops away; the rush comes in from one side.)
            return {before: 6, after: 3, step: 1 / 48, close: true, view: view(k.to.x, k.to.y + 0.15, k.to.z, 2.8, 1.15, side)};
        })
    },
    heron_strike: {
        cast: [["he", "grey-heron", 2]],
        hours: 9,
        date: Date.UTC(2026, 10, 12, 9) / 1000,
        // (Its head and the water ahead of it both in frame, a little from above: the fish under the bill.)
        find: (ctx) => huntMoment(ctx, "wade_spear", "strike", (k) => ({before: 6, after: 2.5, step: 1 / 30, close: true, view: view(k.from.x + Math.sin(k.yaw) * 0.4, Math.max(k.from.y, -0.1) + 0.5, k.from.z + Math.cos(k.yaw) * 0.4, 3, 1.02, k.yaw + Math.PI / 2)}))
    },
    osprey_dive: {
        cast: [["os", "osprey", 2]],
        hours: 10,
        date: Date.UTC(2026, 10, 12, 10) / 1000,
        // (From the side and a little below the hover, the whole drop in frame: the hover, the stoop, the strike, the climb.)
        find: (ctx) => huntMoment(ctx, "talon_grab", "dive_feet", (k) => ({before: 4, after: 3.5, step: 1 / 40, close: true, view: view(k.to.x, Math.max(k.from.y * 0.45, 3), k.to.z, Math.max(k.from.y * 1.5, 12), 1.15, 0.3 + Math.PI / 2)}))
    },
    dolphin_chase: {
        cast: [["dl", "spinner-dolphin", 3]],
        hours: 11,
        date: Date.UTC(2026, 10, 12, 11) / 1000,
        find: (ctx) => huntMoment(ctx, "chase_fish", "strike", (k, ep) => {
            const swim = ep.keys[ep.keys.indexOf(k) - 1] ?? k;
            const side = Math.atan2(k.to.x - swim.from.x, k.to.z - swim.from.z) + Math.PI / 2;
            return {before: Math.min(k.t0 - swim.t0 + 1.5, 6), after: 2.5, step: 1 / 40, view: view((swim.from.x + k.to.x) / 2, Math.min(k.to.y, -0.3), (swim.from.z + k.to.z) / 2, 7, 0.95, side)};
        })
    },
    swallow_hawk: {
        cast: [["sw", "barn-swallow", 2]],
        hours: 11,
        date: Date.UTC(2026, 10, 12, 11) / 1000,
        // (Slow motion, close to the catch: it sweeps metres a second.)
        find: (ctx) => huntMoment(ctx, "aerial_hawk", "fly", (k) => ({before: 1.2, after: 1.2, step: 1 / 120, close: true, view: view(k.to.x, k.to.y, k.to.z, 3.2, 1.25, Math.atan2(k.to.x - k.from.x, k.to.z - k.from.z) + Math.PI / 2)}))
    },
    meal_chase: {
        cast: [["li", "african-lion", 1], ["ze", "plains-zebra", 4]],
        hours: 9,
        date: Date.UTC(2026, 10, 12, 9) / 1000,
        find: (ctx) => {
            const lion = ctx.animals.find((a) => a.slug === "african-lion");
            const zebra = ctx.animals.find((a) => a.slug === "plains-zebra");
            if (!lion || !zebra) return null;
            // The server's record (encounter hunting): the lion's foray waypoint 15 m from the zebra, toward its home;
            // the zebra's home disc. The scene starts the chase from the waypoint (its home is far off).
            const dx = lion.place.x - zebra.place.x;
            const dz = lion.place.z - zebra.place.z;
            const d = Math.hypot(dx, dz) || 1;
            const encounter = {t: ctx.date + 30, predator: {x: zebra.place.x + (dx / d) * 15, z: zebra.place.z + (dz / d) * 15}, prey: {x: zebra.place.x, z: zebra.place.z, r: 3}};
            const event = (a: Context["animals"][number]): ArkEventAnimal => ({id: a.id, species_profile_id: SPECIES[a.slug].id, name: SPECIES[a.slug].name, model_slug: a.slug, zone: a.zone as ArkEventAnimal["zone"], arrived_at: null, origin: "arrived", generation: null, slot: null, slot_rank: null, activity: null, sociality: null, status: "aboard" as ArkEventAnimal["status"]});
            const act = {kind: "meal", at: new Date((ctx.date + 30) * 1000).toISOString(), predator: event(lion), prey: event(zebra), phrase: null, extinct: false, encounter} as ArkAct;
            return {start: ctx.date + 30, seconds: 12, step: 1 / 30, view: view(zebra.place.x, 1, zebra.place.z, 30, 1.2, 0.6), note: `lion ${lion.id.slice(-4)} on zebra ${zebra.id.slice(-4)}: waypoint ${encounter.predator.x.toFixed(1)},${encounter.predator.z.toFixed(1)}`, play: [act]};
        }
    }
};

/** A hunt's moment: the first of the recipe's catches of this block that comes off (`recipe-hunt.ts` draws its quarry). */
function huntMoment(ctx: Context, recipe: string, block: string, frame: (k: Key, ep: Episode) => {before: number; after: number; step: number; view: ArkCameraView; follow?: boolean; close?: boolean; track?: boolean}): Moment | null {
    for (const a of ctx.animals) {
        for (const trip of trips(ctx, a, ctx.date, 30)) {
            if (trip.recipe !== recipe) continue;
            const ep = tripEpisode(ctx.world, trip);
            const k = ep?.keys.find((key) => key.block.id === block && key.catch?.ok && key.catch.kind !== "worm" && (block !== "fly" || key.t1 - key.t0 > 0.4));
            if (!ep || !k) continue;
            const f = frame(k, ep);
            // (Where its quarry is through the hunt, for the record: `recipe-hunt.ts`.)
            const q = [k.t0 - 2, k.t0, k.t1 - 0.05].map((t) => (poseOnTrip(ctx.world, trip, t) as RecipePose).act?.quarry).map((x) => (x ? `${x.look} ${x.phase} ${x.x.toFixed(2)},${x.y.toFixed(2)},${x.z.toFixed(2)}` : "none"));
            return {start: k.t0 - f.before, seconds: f.before + (k.t1 - k.t0) + f.after, step: f.step, view: f.view, close: f.close, follow: f.follow ? a.id : null, track: f.track ? a.id : null, note: `${a.slug} ${a.id.slice(-4)} ${recipe}: ${block} at ${k.t0.toFixed(1)}; quarry ${q.join(" | ")}`};
        }
    }
    return null;
}

/** Signature wave 2 (birds): a perch-hunter's drop: from before it watches to its flight back (`swoop` onto the ground; a catch only where `ok`). */
function dropMoment(ctx: Context, recipe: string, ok: boolean): Moment | null {
    for (const a of ctx.animals) {
        for (const trip of trips(ctx, a, ctx.date, 30)) {
            if (trip.recipe !== recipe) continue;
            const ep = tripEpisode(ctx.world, trip);
            const k = ep?.keys.find((key) => key.block.id === "swoop" && (!ok || key.catch?.ok));
            if (!ep || !k) continue;
            const span = Math.hypot(k.to.x - k.from.x, k.to.y - k.from.y, k.to.z - k.from.z);
            const side = Math.atan2(k.to.x - k.from.x, k.to.z - k.from.z) + Math.PI / 2;
            const mid = {x: (k.from.x + k.to.x) / 2, y: (k.from.y + k.to.y) / 2, z: (k.from.z + k.to.z) / 2};
            const times = [-5, -2.5, -0.8, 0, 0.12, 0.25, 0.4, 0.55, 0.8, 1.2, 2.2, 3.5, 5, 7].map((d) => k.t0 + d);
            return {start: k.t0 - 7, seconds: 14, step: 1 / 6, times, close: true, track: a.id, view: view(mid.x, mid.y, mid.z, Math.max(a.animal.length * 9, 1.3), 1.3, side), note: `${a.slug} ${a.id.slice(-4)} ${recipe}: perch ${k.from.y.toFixed(1)} m up, ${span.toFixed(1)} m to the drop at ${k.t0.toFixed(1)}, catch ${k.catch ? (k.catch.ok ? "yes" : "miss") : "none drawn"}`};
        }
    }
    return null;
}

/** A tunnel or a burrow dug: the dig, framed close from the side. */
function digMoment(ctx: Context, recipe: string): Moment | null {
    for (const a of ctx.animals) {
        for (const trip of trips(ctx, a, ctx.date, 30)) {
            const ep = tripEpisode(ctx.world, trip);
            if (ep?.recipe !== recipe) continue;
            const k = ep.keys.find((key) => key.block.id === "dig");
            if (!k) continue;
            return {start: k.t0 - 2, seconds: Math.min(k.t1 - k.t0 + 4, 16), step: 1 / 2, close: true, track: a.id, view: view(k.from.x, k.from.y + 0.2, k.from.z, Math.max(a.animal.length * 5, 1.6), 1.2, k.yaw + Math.PI / 2), note: `${a.slug} ${a.id.slice(-4)} ${recipe}: dig at ${k.t0.toFixed(1)}`};
        }
    }
    return null;
}

/** A stay's block (a thrush beating its snail on the stone, a limpkin working a snail out of its shell): the bird followed close from its side. */
function blockMoment(ctx: Context, recipe: string, block: string, before: number, after: number): Moment | null {
    for (const a of ctx.animals) {
        for (const trip of trips(ctx, a, ctx.date, 30)) {
            if (trip.recipe && trip.recipe !== recipe) continue;
            const ep = tripEpisode(ctx.world, trip);
            if (ep?.recipe !== recipe) continue;
            const k = ep.keys.find((key) => key.block.id === block);
            if (!k) continue;
            return {start: k.t0 - before, seconds: before + (k.t1 - k.t0) + after, step: 1 / 2, close: true, track: a.id, view: view(k.from.x, k.from.y + 0.1, k.from.z, Math.max(a.animal.length * 7, 1.4), 1.25, k.yaw + Math.PI / 2), note: `${a.slug} ${a.id.slice(-4)} ${recipe}: ${block} at ${k.t0.toFixed(1)}`};
        }
    }
    return null;
}

/** A communal roost: its leader's roost point; the evening as a time lapse, the busiest wave in real time, the night, the dawn. */
function roostMoment(ctx: Context, kind: "lapse" | "wave" | "night" | "dawn"): Moment | null {
    const a = ctx.animals[0];
    if (!a) return null;
    const roost = roostOf(ctx.world, a.profile, a.animal);
    const group = a.animal.group?.leader ?? a.animal;
    const leaderRoost = a.animal.group ? roostOf(ctx.world, a.animal.group.profile, group) : roost;
    const centre = {x: leaderRoost.x, y: leaderRoost.y, z: leaderRoost.z};
    const seed = hashString(`${group.id}#roost`);
    // The window's start in world seconds: the evening's 17:00 (hours map to the clock one to one).
    const t0 = Date.UTC(2026, 10, 12, 17) / 1000;
    const inFlight = (epoch: number) => {
        let n = 0;
        for (let i = 0; i < ROOST_AMBIENT; i++) {
            const p = roostPoint(centre, seed, i, epoch, t0);
            if (p && !p.perched) n++;
        }
        return n;
    };
    const view0 = (distance: number, azimuth = 0.8) => view(centre.x, centre.y, centre.z, distance, 1.3, azimuth);
    if (kind === "lapse") return {start: t0 + 360, seconds: 5200, step: 450, view: view0(9), note: `roost at ${centre.x.toFixed(1)},${centre.y.toFixed(1)},${centre.z.toFixed(1)} (${a.animal.group ? "group" : "alone"})`};
    if (kind === "night") return {start: t0 + 5 * 3600, seconds: 4, step: 1, view: view0(5.5), note: "perched at night"};
    if (kind === "dawn") return {start: t0 + 12.4 * 3600, seconds: 2400, step: 200, view: view0(12), note: "leaving at dawn"};
    let best = t0 + 600;
    let most = 0;
    for (let t = t0 + 360; t < t0 + 5400; t += 3) {
        const n = inFlight(t);
        if (n > most) {
            most = n;
            best = t;
        }
    }
    return {start: best - 8, seconds: 16, step: 1, view: view0(20, 0.6), note: `busiest wave at ${(best - t0).toFixed(0)} s: ${most} in flight; roost at ${centre.x.toFixed(1)},${centre.y.toFixed(1)},${centre.z.toFixed(1)}`};
}

function castId(k: number, i: number): string {
    return `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
}

function castAnimals(cast: Clip["cast"]): Raw[] {
    const template = fixture.animals[0];
    const out: Raw[] = [];
    cast.forEach(([, slug, n], k) => {
        const sp = SPECIES[slug];
        for (let i = 0; i < n; i++) out.push({...template, id: castId(k, i), species_profile_id: sp.id, name: sp.name, scientific_name: sp.name, model_slug: slug, zone: sp.zone, activity: sp.activity, sociality: sp.sociality, slot: 90 + k, slot_rank: i} as Raw);
    });
    return out;
}

// MARK: The controlled clock (capture only)

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) => new Promise<void>((resolve) => {
    let left = n;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
});

async function main() {
    const params = new URLSearchParams(location.search);
    const name = params.get("clip") ?? "kingfisher";
    const clip = CLIPS[name];
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    // (A nesting season: the Ark day the props and the recipes' seasons read, pinned.)
    if (clip.arkDay !== undefined) (globalThis as {__arkPropsArkDay?: number}).__arkPropsArkDay = clip.arkDay;
    const nests = (clip.nests ?? []).map((slug) => ({species_profile_id: SPECIES[slug].id, name: SPECIES[slug].name, model_slug: slug, zone: SPECIES[slug].zone, status: "egg", eggs: 4, laid_ark_day: 140, hatch_ark_day: 190, mine: false}));
    const snapshot = decodeArkSnapshot({...fixture, animals: castAnimals(clip.cast), ...(nests.length ? {nests} : {})});
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const el = document.getElementById("ark")!;
    const handle: ArkSceneHandle = mountArk(el, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: clip.hours, onReady: () => (ready = true)});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.25, storm: 0, windDirection: 0.4});
    handle.setClockScale(1, clip.date * 1000);
    // (A roost's evening: the island hour is the clock's, so the window moves with the time the frames step through.)
    if (clip.live) handle.setHours(null);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log(`[clip] loaded ${name} in ${((realPerfNow() - (until - 120_000)) / 1000).toFixed(0)} s`);
    const debug = (window as unknown as {__arkDebug: {entries: () => Array<{animal: {id: string; model_slug: string; zone: string; activity: ArkBehaviourProfile["activity"] | null}; place: {x: number; z: number; ground: number; micro?: unknown}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile} | null}>}}).__arkDebug;
    const ctx: Context = {
        world: scheduleWorld(worldSampler()),
        animals: debug
            .entries()
            .filter((e) => e.sched)
            .map((e) => ({id: e.animal.id, slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity, place: {x: e.place.x, z: e.place.z}, zone: e.animal.zone})),
        micro: debug
            .entries()
            .filter((e) => e.place.micro)
            .map((e) => ({id: e.animal.id, slug: e.animal.model_slug, at: {x: e.place.x, y: e.place.ground, z: e.place.z}})),
        hoursAt: () => clip.hours,
        date: clip.date
    };
    const moment = clip.find(ctx);
    console.log(`[clip] moment ${moment ? moment.note : "none"}`);
    let calls = 0;
    const api = {
        moment,
        sexes: ctx.animals.map((a) => `${a.id.slice(-4)} ${sexLook(a.id, a.slug).sex}`),
        /** Sets the controlled clock to a world time (epoch seconds) and waits for the scene to draw it. */
        at: async (epoch: number) => {
            const ms = epoch * 1000;
            if (!fake) {
                fake = {date: ms, perf: realPerfNow()};
                handle.setClockScale(1, ms);
            } else {
                fake.perf += ms - fake.date;
                fake.date = ms;
            }
            // (A replay: where the acting animals are, now and then, for the record.)
            if (moment?.play && (calls++ % 15 === 0)) {
                const acting = (debug.entries() as unknown as Array<{animal: {id: string; model_slug: string}; act?: {x: number; z: number; base: number; state?: string; speed?: number; hidden?: boolean} | null}>).filter((e) => e.act);
                console.log(`[clip] t=${epoch.toFixed(2)} cam ${JSON.stringify(handle.view?.() ?? null)} ${acting.map((e) => `${e.animal.model_slug} ${e.act!.x.toFixed(1)},${e.act!.z.toFixed(1)} y${e.act!.base.toFixed(2)} ${e.act!.state ?? ""} v${(e.act!.speed ?? 0).toFixed(1)}${e.act!.hidden ? " hidden" : ""}`).join(" | ")}`);
            }
            if (moment?.close) {
                (debug as unknown as {controls: {minDistance: number}}).controls.minDistance = moment.track ? 0.5 : 0.8;
                // (Following a small bird: the view's place is where it is drawn now, its distance and angles kept; two passes, the first lets the scene place it.)
                for (let pass = 0; pass < (moment.track ? 2 : 1); pass++) {
                    const at = moment.track ? handle.locate(moment.track) : null;
                    handle.setView(at ? {...moment.view, target: {x: at.x, y: at.y + at.length * 0.3, z: at.z}} : moment.view);
                    if (pass === 0 && moment.track) await frames(1);
                }
            }
            await frames(3);
        },
        view: (v: ArkCameraView) => handle.setView(v),
        handle
    };
    if (moment) {
        handle.setView(moment.view);
        await api.at(moment.start - 4);
        if (moment.follow) {
            handle.select(moment.follow, true);
            await wait(4000);
        }
        // Near models in, at the first frame's place.
        const wait2 = realPerfNow() + 30_000;
        while (realPerfNow() < wait2 && handle.loading()) await wait(200);
        await wait(1500);
        // A replay (a meal's chase) begins at the first frame.
        if (moment.play) {
            await api.at(moment.start);
            console.log("[clip] playing the replay");
            handle.play(moment.play);
        }
    }
    // (For the record: where the cast is drawn and what it is doing at the first frame.)
    if (moment) {
        const rows = (debug as unknown as {entries: () => Array<{animal: {id: string; model_slug: string}; level?: string; sched?: {pose?: {act?: {block?: string; state?: string} | null} | null} | null}>}).entries();
        console.log(`[clip] cast ${rows.slice(0, 5).map((e) => `${e.animal.id.slice(-4)} ${e.level ?? "?"} ${JSON.stringify(handle.locate(e.animal.id))} ${e.sched?.pose?.act?.block ?? "-"}`).join(" | ")}`);
    }
    (window as unknown as {__clip: typeof api}).__clip = api;
}

void main();
