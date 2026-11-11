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
    ["giant-african-land-snail", "Giant African Land Snail", "farm_garden"]
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
    return {...snapshot, animals: [...snapshot.animals, ...animals], ark_day: arkDay, nests};
}

export const PROPS_SHOTS = ["bird_nest", "ants_trunk", "web_dawn", "beehive_hollow", "house_night", "farm", "mountain_scree", "cave_roost", "turtle_nest", "snail_trail"] as const;
export type PropsShot = typeof PROPS_SHOTS[number];

type Locate = (id: string) => {x: number; y: number; z: number} | null;

export type PropsShotPlan = {view: ArkCameraView; hours: number; weather: Partial<PropsConditions> | null; environment: {wetness?: number; snow?: number; wind?: number}; anchor: string; minDistance?: number};

const look = (at: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number, lift = 0): ArkCameraView => ({target: {x: at.x, y: at.y + lift, z: at.z}, distance, polar, azimuth});

/** The view, the hour and the weather of a props shot, from where the props are. */
export function propsShot(shot: PropsShot, marks: PropsMarks, stats: PropsStats, locate: Locate): PropsShotPlan | null {
    const plan = framed(shot, marks, stats, locate);
    // Every shot in its own weather: dry and still unless it says otherwise (whatever the island clock says today).
    return plan ? {...plan, weather: {rain: 0, puddles: 0, mist: 0, ...(plan.weather ?? {})}} : null;
}

function framed(shot: PropsShot, marks: PropsMarks, stats: PropsStats, locate: Locate): PropsShotPlan | null {
    const spots = marks.spots;
    const calm = {wetness: 0, snow: 0.2, wind: 0.25};
    switch (shot) {
        case "bird_nest": {
            // The mallard's ground nest, under the mallard that sits it.
            const nest = stats.nests.find((n) => n.style === "ground" && n.sitter && /mallard/.test(n.key + (n.sitter ?? ""))) ?? stats.nests.find((n) => n.style === "ground" && n.sitter) ?? stats.nests[0];
            if (!nest) return null;
            const bird = nest.sitter ? locate(nest.sitter) : null;
            const at = bird ? {x: bird.x, y: nest.y, z: bird.z} : nest;
            return {view: look(at, 1.5, 1.1, 0.5, 0.12), hours: 9.5, weather: null, environment: calm, anchor: `nest ${nest.style} ${nest.key}`, minDistance: 0.3};
        }
        case "ants_trunk": {
            const mound = spots.ants;
            const tree = spots.antsTree ?? mound;
            if (!mound) return null;
            const mid = {x: mound.x * 0.6 + tree.x * 0.4, y: Math.max(mound.y, tree.y) + 0.45, z: mound.z * 0.6 + tree.z * 0.4};
            return {view: look(mid, 3.6, 1.15, Math.atan2(mound.x - tree.x, mound.z - tree.z) + Math.PI / 2), hours: 10.5, weather: null, environment: calm, anchor: "ant mound + trail", minDistance: 0.3};
        }
        case "web_dawn": {
            const web = spots.webBranch ?? spots.web;
            if (!web) return null;
            return {view: look(web, 1.4, 1.5, Math.PI + 0.3), hours: 6.4, weather: {dew: 1, mist: 0.6, wind: 0.05}, environment: {...calm, wind: 0.05}, anchor: "web", minDistance: 0.3};
        }
        case "beehive_hollow": {
            const hollow = spots.beesHollow;
            if (!hollow) return null;
            const facing = spots.beesFacing ?? {x: 0, y: 0, z: 1};
            return {view: look(hollow, 1.5, 1.45, Math.atan2(facing.x, facing.z)), hours: 11, weather: null, environment: calm, anchor: "bees' hollow", minDistance: 0.3};
        }
        case "house_night": {
            const chimney = spots.chimney;
            if (!chimney) return null;
            return {view: look({x: chimney.x + 1.2, y: chimney.y - 0.6, z: chimney.z + 1.8}, 15, 1.22, -0.45), hours: 21.5, weather: {cold: 0.8, wind: 0.3}, environment: {...calm, wind: 0.3}, anchor: "cottage + chimney"};
        }
        case "farm": {
            const farm = spots.farm;
            if (!farm) return null;
            return {view: look(farm, 19, 1.08, -0.5, 0.6), hours: 16.5, weather: {wetness: 0.7, puddles: 0.8}, environment: {...calm, wetness: 0.7}, anchor: "paddock + troughs (after rain)"};
        }
        case "mountain_scree": {
            const outcrop = spots.outcrop;
            if (!outcrop) return null;
            return {view: look(outcrop, 10, 1.18, 0.4, 0.6), hours: 8.5, weather: {cold: 0.9, snowCover: 0.6, wind: 0.8}, environment: {wetness: 0, snow: 0.2, wind: 0.8}, anchor: "strata outcrop + scree + drifts"};
        }
        case "cave_roost": {
            const cave = marks.cave;
            // From just outside the mouth, looking in and a little up at the ceiling.
            const inside = {x: cave.x - Math.sin(cave.facing) * 2.2, y: cave.y + 2.1, z: cave.z - Math.cos(cave.facing) * 2.2};
            return {view: look(inside, 6.5, 1.36, cave.facing + 0.2), hours: 11, weather: {cold: 0.75}, environment: calm, anchor: "cave mouth", minDistance: 0.3};
        }
        case "turtle_nest": {
            const nest = spots.turtleNest;
            if (!nest) return null;
            return {view: look(nest, 4.5, 1.0, Math.atan2(nest.x, nest.z) + 0.6), hours: 7.4, weather: null, environment: calm, anchor: "turtle nest + tracks", minDistance: 0.3};
        }
        case "snail_trail": {
            const wall = spots.slimeWall ?? spots.slimeRock;
            if (!wall) return null;
            return {view: look(wall, 2.4, 1.32, 0.35), hours: 7, weather: {wetness: 0.85, puddles: 0.5}, environment: {...calm, wetness: 0.85}, anchor: "slime trail on the wall", minDistance: 0.3};
        }
    }
}
