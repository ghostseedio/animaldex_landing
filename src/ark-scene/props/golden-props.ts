/**
 * The props lane's close-up golden shots (development only: the golden-shot
 * page, `golden.html?props=1`, and `scripts/ark-golden-shots.mjs --props`).
 *
 * The page's Ark is the v2 fixture plus one animal of each species whose
 * home the props draw only when it is aboard (ants, bees, hornets, termites,
 * a garden spider, a butterfly, an earthworm, a bat, a beaver, a land
 * snail), on an Ark day in the breeding season, with clutches in (A9
 * `nests` rows) for the mallard and the heron. Each shot is framed on where
 * the props module says the thing is (`__arkPropsModule.marks()`), in its
 * own light and weather.
 */

import type {ArkAnimal, ArkCameraView, ArkNestRow, ArkSnapshot, ArkZone} from "@/ark-scene/types";
import type {PropsConditions} from "@/ark-scene/props/conditions";
import type {PropsMarks, PropsStats} from "@/ark-scene/props";
import {nestStage} from "@/ark-scene/props/nest-growth";
import {place as namedPlace, surfaceAt} from "@/ark-scene/sampler";
import {homePlots} from "@/ark-scene/map/hamlet";
import {defaultHomePlots, type HomePlot} from "@/ark-scene/props/home-layout";

const EXTRA: Array<[slug: string, name: string, zone: ArkZone]> = [
    ["black-ant", "Black Ant", "woodland"],
    ["western-honey-bee", "Western Honey Bee", "farm_garden"],
    ["european-hornet", "European Hornet", "farm_garden"],
    ["mound-building-termite", "Mound-building Termite", "grassland"],
    ["black-and-yellow-garden-spider", "Black-and-yellow Garden Spider", "farm_garden"],
    ["brimstone-butterfly", "Brimstone Butterfly", "woodland"],
    ["common-earthworm", "Common Earthworm", "farm_garden"],
    ["kuhls-pipistrelle-bat", "Kuhl's Pipistrelle", "mountains"],
    ["north-american-beaver", "North American Beaver", "river_lake"],
    ["giant-african-land-snail", "Giant African Land Snail", "farm_garden"],
    ["village-weaver", "Village Weaver", "grassland"],
    ["great-crested-grebe", "Great Crested Grebe", "river_lake"],
    ["common-house-martin", "Common House Martin", "farm_garden"]
];

/** The fixture with the props' species aboard, in the breeding season (Ark day of the year 120), and two clutches in. */
export function propsFixture(snapshot: ArkSnapshot): ArkSnapshot {
    const animals: ArkAnimal[] = EXTRA.map(([slug, name, zone], k) => ({
        id: `props-${slug}`,
        species_profile_id: `props-${slug}`,
        name,
        scientific_name: null,
        model_slug: slug,
        zone,
        arrived_at: `2026-11-0${1 + (k % 8)}T00:00:00Z`,
        brought_by: {label: "Voyager 1", named: false},
        mine: false,
        origin: "arrived",
        generation: 0,
        condition: "well_fed",
        activity: "diurnal",
        sociality: "solitary"
    }));
    const day = typeof snapshot.ark_day === "number" ? snapshot.ark_day : 286;
    const arkDay = Math.floor(day / 365) * 365 + 120;
    const clutch = (slug: string, zone: ArkZone, eggs: number): ArkNestRow | null => {
        const animal = snapshot.animals.find((a) => a.model_slug === slug);
        return animal ? {species_profile_id: animal.species_profile_id, name: animal.name, model_slug: slug, zone, status: "egg", eggs, laid_ark_day: arkDay - 3, hatch_ark_day: arkDay + 25, mine: false} : null;
    };
    const nests = [clutch("mallard", "river_lake", 6), clutch("grey-heron", "wetland", 4), clutch("green-sea-turtle", "coral_reef", 9)].filter((row): row is ArkNestRow => row !== null);
    // As of now, so the nests' Ark day (props/index.ts arkDayNow) is the fixture's.
    return {...snapshot, animals: [...snapshot.animals, ...animals], ark_day: arkDay, as_of: new Date().toISOString(), nests};
}

export const PROPS_SHOTS = ["bird_nest", "nest_eyrie", "nest_heronry", "nest_weavers", "nest_growing", "nest_eaves", "nest_grebe", "ants_trunk", "web_dawn", "beehive_hollow", "house_night", "farm", "mountain_scree", "cave_roost", "turtle_nest", "snail_trail", "mist_dawn", "mist_meadow", "mist_shore", "hamlet_day", "hamlet_night", "hamlet_close_day", "hamlet_close_night"] as const;
export type PropsShot = typeof PROPS_SHOTS[number];

type Locate = (id: string) => {x: number; y: number; z: number} | null;

export type PropsShotPlan = {view: ArkCameraView; hours: number; weather: Partial<PropsConditions> | null; environment: {wetness?: number; snow?: number; wind?: number}; anchor: string; minDistance?: number};

const look = (at: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number, lift = 0): ArkCameraView => ({target: {x: at.x, y: at.y + lift, z: at.z}, distance, polar, azimuth});

/**
 * A view through something up in the air (a nest on a crown): the scene keeps its camera's target on the ground, so
 * the target is where the line from the camera through the thing meets the ground beyond it. The camera stands
 * `out` metres off (toward `azimuth`) and `above` metres higher than the thing.
 */
function lookThrough(at: {x: number; y: number; z: number}, azimuth: number, out: number, above: number): ArkCameraView {
    const sx = Math.sin(azimuth);
    const sz = Math.cos(azimuth);
    let run = (out / above) * Math.max(at.y - surfaceAt(at.x, at.z).height, 0.5);
    let ground = surfaceAt(at.x - sx * run, at.z - sz * run).height;
    // Twice round, so the ground's height where the line lands is the one it meets.
    run = (out / above) * Math.max(at.y - ground, 0.5);
    ground = surfaceAt(at.x - sx * run, at.z - sz * run).height;
    const target = {x: at.x - sx * run, y: ground, z: at.z - sz * run};
    const camera = {x: at.x + sx * out, y: at.y + above, z: at.z + sz * out};
    const distance = Math.hypot(camera.x - target.x, camera.y - target.y, camera.z - target.z);
    return {target, distance, polar: Math.acos(Math.min(Math.max((camera.y - target.y) / distance, -1), 1)), azimuth};
}

/** The view, the hour and the weather of a props shot, from where the props are. */
export function propsShot(shot: PropsShot, marks: PropsMarks, stats: PropsStats, locate: Locate): PropsShotPlan | null {
    const props = (globalThis as {__arkPropsModule?: {setArkDay: (day: number | null) => void}}).__arkPropsModule;
    // Every shot but the growing nest's sees the nests as the fixture's day has them.
    props?.setArkDay(null);
    // The hamlet's shots: the hamlet at 1× (the dry run's population: 7 houses, 3 smallholdings); every other shot today's two plots.
    const withPlots = (globalThis as {__arkPropsModule?: {setHomePlots: (plots: HomePlot[]) => void}}).__arkPropsModule;
    withPlots?.setHomePlots(shot.startsWith("hamlet") ? homePlots(7 * 130, 3 * 50) : defaultHomePlots());
    const plan = framed(shot, marks, stats, locate);
    if (shot === "nest_growing" && plan) props?.setArkDay(growingDay(stats));
    // Every shot in its own weather: dry and still unless it says otherwise (whatever the island clock says today).
    return plan ? {...plan, weather: {rain: 0, puddles: 0, mist: 0, ...(plan.weather ?? {})}} : null;
}

function framed(shot: PropsShot, marks: PropsMarks, stats: PropsStats, locate: Locate): PropsShotPlan | null {
    const spots = marks.spots;
    const calm = {wetness: 0, snow: 0.2, wind: 0.25};
    switch (shot) {
        case "bird_nest": {
            // The mallard's down-lined bowl, under the mallard that sits it.
            const nest = stats.nests.find((n) => n.form === "down_bowl" && n.sitter && /mallard/.test(n.key)) ?? stats.nests.find((n) => n.form === "down_bowl" && n.sitter) ?? stats.nests[0];
            if (!nest) return null;
            return {view: look(nest, Math.max(1.8, nest.radius * 4.2), 1.0, 0.5, 0.05), hours: 9.5, weather: null, environment: calm, anchor: `nest ${nest.form} ${nest.key}`, minDistance: 0.3};
        }
        case "nest_eyrie": {
            const nest = stats.nests.find((n) => n.form === "eyrie");
            if (!nest) return null;
            const turn = nestTurn(nest);
            return {view: look(nest, nest.radius * 4.5 + 1.5, 1.12, turn, nest.radius * 0.35), hours: 10, weather: null, environment: calm, anchor: `eyrie ${nest.key} r ${nest.radius.toFixed(2)}`, minDistance: 0.3};
        }
        case "nest_heronry": {
            // The lowest crown-top platform (the heronry's, on the wetland's trees), from above its crown.
            const nest = stats.nests.filter((n) => n.form === "platform" && n.site === "tree_top").sort((a, b) => a.y - b.y)[0];
            if (!nest) return null;
            return {view: lookThrough(nest, 0.9, nest.radius * 6 + 3, nest.radius * 3 + 1.5), hours: 10.5, weather: null, environment: calm, anchor: `platform ${nest.key} r ${nest.radius.toFixed(2)}`, minDistance: 0.3};
        }
        case "nest_weavers": {
            const nest = stats.nests.find((n) => n.form === "pendant");
            if (!nest) return null;
            return {view: look(nest, nest.radius * 9 + 1.2, 1.5, 0.4, -nest.radius * 1.2), hours: 9, weather: null, environment: calm, anchor: `pendant ${nest.key} r ${nest.radius.toFixed(2)}`, minDistance: 0.3};
        }
        case "nest_growing": {
            const nest = growingNest(stats);
            if (!nest) return null;
            return {view: look(nest, nest.radius * 4 + 1.2, 1.0, 0.6, 0.05), hours: 10.5, weather: null, environment: calm, anchor: `growing ${nest.form} ${nest.key}`, minDistance: 0.3};
        }
        case "nest_eaves": {
            const nest = stats.nests.find((n) => n.form === "mud_cup") ?? stats.nests.find((n) => n.form === "ball");
            if (!nest) return null;
            // Along the wall at the eave's height (the camera cannot look up from below): the cups seated under the roof,
            // backs to the wall, seen in profile.
            return {view: look(nest, 2.2, 1.36, nestTurn(nest) + 1.2, -0.25), hours: 15, weather: null, environment: calm, anchor: `eaves ${nest.form} ${nest.key}`, minDistance: 0.3};
        }
        case "nest_grebe": {
            const nest = stats.nests.find((n) => n.form === "floating");
            if (!nest) return null;
            return {view: look(nest, nest.radius * 5 + 1.4, 1.15, 0.6, 0.05), hours: 8.5, weather: null, environment: calm, anchor: `raft ${nest.key} r ${nest.radius.toFixed(2)}`, minDistance: 0.3};
        }
        case "ants_trunk": {
            const mound = spots.ants;
            const tree = spots.antsTree ?? mound;
            if (!mound) return null;
            const mid = {x: mound.x * 0.6 + tree.x * 0.4, y: Math.max(mound.y, tree.y) + 0.45, z: mound.z * 0.6 + tree.z * 0.4};
            // From beyond the mound, along the trail to the trunk it climbs.
            return {view: look(mid, 5.5, 0.78, Math.atan2(mound.x - tree.x, mound.z - tree.z) + 0.35, 0.3), hours: 10.5, weather: null, environment: calm, anchor: "ant mound + trail", minDistance: 0.3};
        }
        case "web_dawn": {
            const web = (spots.webBranch ?? spots.web) as {x: number; y: number; z: number; facing?: number; radius?: number} | undefined;
            if (!web) return null;
            // Square on to its face, the low sun behind the camera's shoulder.
            return {view: look(web, (web.radius ?? 0.3) * 4 + 0.5, 1.5, (web.facing ?? 0) + 0.3), hours: 6.4, weather: {dew: 1, mist: 0.6, wind: 0.05}, environment: {...calm, wind: 0.05}, anchor: "web", minDistance: 0.3};
        }
        case "beehive_hollow": {
            const hollow = spots.beesHollow;
            if (!hollow) return null;
            const facing = spots.beesFacing ?? {x: 0, y: 0, z: 1};
            return {view: look(hollow, 1.0, 1.36, Math.atan2(facing.x, facing.z)), hours: 11, weather: null, environment: calm, anchor: "bees' hollow", minDistance: 0.3};
        }
        case "house_night": {
            const chimney = spots.chimney;
            if (!chimney) return null;
            return {view: look({x: chimney.x + 1.2, y: chimney.y - 0.6, z: chimney.z + 1.8}, 15, 1.22, -0.45), hours: 21.5, weather: {cold: 0.8, wind: 0.3}, environment: {...calm, wind: 0.3}, anchor: "cottage + chimney"};
        }
        case "farm": {
            const farm = spots.farm;
            if (!farm) return null;
            // From beyond the paddock, looking back over it at the barn.
            const barn = spots.barn ?? {x: farm.x, y: farm.y, z: farm.z - 1};
            return {view: look(farm, 17, 1.05, Math.atan2(farm.x - barn.x, farm.z - barn.z) + 0.25, 0.6), hours: 16.5, weather: {wetness: 0.7, puddles: 0.8}, environment: {...calm, wetness: 0.7}, anchor: "paddock + troughs (after rain)"};
        }
        case "mountain_scree": {
            const outcrop = spots.outcrop;
            if (!outcrop) return null;
            // From below, looking up the scree fan at the outcrop.
            const out = (outcrop as {turn?: number}).turn ?? 0.4;
            return {view: look(outcrop, 12, 1.12, out, 0.6), hours: 8.5, weather: {cold: 0.75, snowCover: 0.3, wind: 0.8}, environment: {wetness: 0, snow: 0.2, wind: 0.8}, anchor: "strata outcrop + scree + drifts"};
        }
        case "cave_roost": {
            const cave = marks.cave;
            // From just outside the mouth, looking in at the roost: the guano heaped on the floor, the stained ceiling above it.
            const under = {x: cave.roost.x, y: cave.y + 1.1, z: cave.roost.z};
            return {view: look(under, 5.2, 1.3, cave.facing + 0.12), hours: 11, weather: {cold: 0.75}, environment: calm, anchor: "cave roost", minDistance: 0.3};
        }
        case "turtle_nest": {
            const nest = spots.turtleNest;
            if (!nest) return null;
            // From up the beach, looking down the crawl tracks to the sea.
            const facing = (nest as {facing?: number}).facing ?? Math.atan2(nest.x, nest.z);
            return {view: look(nest, 5.5, 0.95, facing + Math.PI + 0.35), hours: 7.4, weather: null, environment: calm, anchor: "turtle nest + tracks", minDistance: 0.3};
        }
        case "mist_dawn": {
            // Mist lying over the lake at a still dawn, from up the bank.
            const lake = namedPlace("lake");
            return {view: look({x: lake.x, y: 0, z: lake.z}, lake.radius * 1.6 + 18, 0.95, 2.4), hours: 6.3, weather: {mist: 0.9, dew: 1, wind: 0.05}, environment: {...calm, wind: 0.05}, anchor: "mist over the lake at dawn"};
        }
        case "mist_meadow": {
            // At an animal's height in the barn owl's meadow (the farm's mist), where a flat sheet used to read as a band.
            const owl = stats.nests.find((n) => n.form === "barn");
            const at = owl?.sitter ? locate(owl.sitter) : null;
            const spot = at ?? spots.farm;
            if (!spot) return null;
            return {view: look(spot, 5, 1.32, 0.6, 0.3), hours: 6.4, weather: {mist: 0.9, dew: 1, wind: 0.05}, environment: {...calm, wind: 0.05}, anchor: at ? "barn owl's meadow, misty dawn" : "farm, misty dawn"};
        }
        case "mist_shore": {
            // Low on the lake's shore (the fox's), looking along the bank through the mist.
            const lake = namedPlace("lake");
            const a = 2.2;
            const shore = {x: lake.x + Math.sin(a) * (lake.radius + 1.5), y: 0, z: lake.z + Math.cos(a) * (lake.radius + 1.5)};
            return {view: look(shore, 6, 1.3, a + 0.9, 0.4), hours: 6.4, weather: {mist: 0.9, dew: 1, wind: 0.05}, environment: {...calm, wind: 0.05}, anchor: "lake shore, misty dawn"};
        }
        case "hamlet_day":
        case "hamlet_night": {
            // The whole hamlet from above its middle.
            const plots = homePlots(7 * 130, 3 * 50);
            const middle = {x: plots.reduce((sum, p) => sum + p.x, 0) / plots.length, z: plots.reduce((sum, p) => sum + p.z, 0) / plots.length};
            const night = shot === "hamlet_night";
            return {view: look({x: middle.x, y: 0, z: middle.z}, 82, 0.85, -0.5), hours: night ? 21.5 : 11, weather: {cold: 0.3, wind: 0.2}, environment: calm, anchor: `hamlet 1x: ${plots.filter((p) => p.kind === "house").length} houses, ${plots.filter((p) => p.kind === "smallholding").length} smallholdings`};
        }
        case "hamlet_close_day":
        case "hamlet_close_night": {
            // Two of the new cottages and a new smallholding, closer.
            const plots = homePlots(7 * 130, 3 * 50);
            const chosen = plots.filter((p) => ["house-3", "house-4", "smallholding-2"].includes(p.id));
            const middle = {x: chosen.reduce((sum, p) => sum + p.x, 0) / chosen.length, z: chosen.reduce((sum, p) => sum + p.z, 0) / chosen.length};
            const night = shot === "hamlet_close_night";
            return {view: look({x: middle.x, y: 0, z: middle.z}, 34, 1.0, 0.4), hours: night ? 21.5 : 15.5, weather: {cold: 0.3, wind: 0.2}, environment: calm, anchor: "hamlet: house-3, house-4, smallholding-2"};
        }
        case "snail_trail": {
            const wall = spots.slimeWall ?? spots.slimeRock;
            if (!wall) return null;
            return {view: look(wall, 2.4, 1.32, 0.35), hours: 7, weather: {wetness: 0.85, puddles: 0.5}, environment: {...calm, wetness: 0.85}, anchor: "slime trail on the wall", minDistance: 0.3};
        }
    }
}

type ShotNest = PropsStats["nests"][number];

/** A nest's heading out (its site's turn: away from the wall, out over the drop). */
function nestTurn(nest: ShotNest): number {
    return nest.turn;
}

/** The Ark day the growing-nest shot is pinned to: when its nest is a little over half built. */
function growingNest(stats: PropsStats): ShotNest | null {
    // The grebe's raft: built in the open, without eggs yet (a nest with eggs is always finished).
    return stats.nests.find((n) => n.form === "floating") ?? stats.nests.find((n) => n.form === "platform") ?? stats.nests.find((n) => n.form === "pendant") ?? null;
}

function growingDay(stats: PropsStats): number | null {
    const nest = growingNest(stats);
    if (!nest) return null;
    let lo = 0;
    let hi = 365;
    // The stage rises through the season's first weeks: find where it crosses 0.55 (from day 0 of the year).
    for (let day = 0; day < 365; day += 0.25) {
        if (nestStage(nest.speciesId, nest.siteId, day) >= 0.55 && nestStage(nest.speciesId, nest.siteId, day - 0.25) < 0.55) {
            lo = day - 0.25;
            hi = day;
            break;
        }
    }
    return (lo + hi) / 2;
}
