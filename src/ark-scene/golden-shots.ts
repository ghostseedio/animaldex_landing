/**
 * The graphics pass's golden shots (docs/ark/graphics-step1.md): fixed camera
 * positions used for every before/after picture of the Ark, each anchored to
 * a NAMED place on the map, never to raw coordinates, so they stay meaningful
 * when the map is rebuilt (docs/ark/map-plan.md on AnimalDex main).
 *
 * The shots only ask a `GoldenWorld` where things are ("the beach", "the
 * cottage", "the reef"). `golden-entry.ts` builds that from today's world
 * modules (`world.ts`, `decor.ts`, `micro-decor.ts`); when the map build
 * renames or moves them, only that adapter changes, and the shots keep their
 * names, framing and lens.
 *
 * Pure: no three.js, no DOM. Development only (the golden-shot harness,
 * scripts/ark-golden-shots.mjs); nothing in the live scene imports it.
 */

import type {ArkCameraView} from "@/ark-scene/types";

export const GOLDEN_PLACES = ["island_far", "coast_rocks", "forest_floor", "house_fields", "river_pond", "mountain", "reef_underwater", "caterpillar_leaf", "bee_flower", "limpet_tidepool", "gecko_wall"] as const;

/**
 * The small-animal close-ups (graphics pass): a real catalogue species set on an attach point of the scenery
 * (`sampler.ts`), framed close. The catalogue has no caterpillar model yet, so the leaf shot uses a small butterfly.
 */
export const GOLDEN_MICRO: Partial<Record<GoldenPlace, {slug: string; tag: "leaf" | "flower_head" | "rock_face" | "house_wall"; near: "forest_floor" | "house" | "tide_pools"; distance: number}>> = {
    caterpillar_leaf: {slug: "small-cabbage-white", tag: "leaf", near: "forest_floor", distance: 0.9},
    bee_flower: {slug: "bumblebee", tag: "flower_head", near: "house", distance: 1.1},
    limpet_tidepool: {slug: "common-limpet", tag: "rock_face", near: "tide_pools", distance: 0.8},
    gecko_wall: {slug: "common-house-gecko", tag: "house_wall", near: "house", distance: 1.2}
};
export type GoldenPlace = typeof GOLDEN_PLACES[number];

/** The three lights every shot is taken in (hours on the scene's clock: `src/lib/ark-daylight.ts`). */
export const GOLDEN_TIMES = {
    /** Mid-morning: sun about 41° up, long enough shadows to read the ground's shape. */
    day: 10.5,
    /** The sun about 6° up: the golden, low-light key. */
    dusk: 17.6,
    /** Moonlit night: sun 50° below the horizon, the night dome in full. */
    night: 22
} as const;
export type GoldenTime = keyof typeof GOLDEN_TIMES;

export const GOLDEN_LABELS: Record<GoldenPlace, string> = {
    island_far: "Whole island, far",
    coast_rocks: "Coast close-up with rocks",
    forest_floor: "Forest floor close-up",
    house_fields: "House and fields",
    river_pond: "River and pond",
    mountain: "Mountain",
    reef_underwater: "Underwater reef",
    caterpillar_leaf: "Small animal on a leaf (no caterpillar model yet: a small butterfly)",
    bee_flower: "Bee on a flower",
    limpet_tidepool: "Limpet in a tide pool",
    gecko_wall: "Gecko on the house wall"
};

type XZ = {x: number; z: number};

/**
 * Where the named places are. Each is a question about the map, answered by
 * whatever the current map calls it. Anything may be missing (null) after a
 * map change: the shot then says which fallback it used.
 */
export type GoldenWorld = {
    /** The whole world in view, as the page opens on it. */
    homeView: () => ArkCameraView;
    /** The ground's height (the sea floor under the sea). */
    groundAt: (x: number, z: number) => number;
    /** The sandy beach's animals' spot (the Coast region). */
    beach: () => XZ | null;
    /** Rocks on the shore, half in the water. */
    shoreRocks: () => Array<XZ & {scale: number}>;
    /** A patch of forest floor: litter, stones and flowers under the trees. */
    forestFloor: () => XZ | null;
    /** The house (cottage) and the fields beside it. */
    house: () => XZ | null;
    fields: () => XZ | null;
    /** The lake (or pond) the river leaves, and the river's line downstream of it. */
    lake: () => XZ | null;
    river: () => XZ[] | null;
    /** The mountain region's middle: the peak is searched for round it. */
    mountainArea: () => (XZ & {radius: number}) | null;
    /** The coral reef's middle, under the sea. */
    reef: () => XZ | null;
};

export type GoldenView = {place: GoldenPlace; view: ArkCameraView; /** How the anchor was found (for the report). */ anchor: string};

/** The bearing from the island's middle out to a point: the camera stands outside, looking in (as the director's shots do). */
function outward(point: XZ): number {
    return Math.hypot(point.x, point.z) > 1 ? Math.atan2(point.x, point.z) : 0;
}

/** The bearing from `from` toward `to`, as a camera azimuth (0 = +z). */
function bearing(from: XZ, to: XZ): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

const mix = (a: XZ, b: XZ, k: number): XZ => ({x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k});

export function goldenView(place: GoldenPlace, world: GoldenWorld): GoldenView {
    const home = world.homeView();
    const fallback = (why: string): GoldenView => ({place, view: home, anchor: `fallback: home view (${why})`});
    switch (place) {
        case "island_far":
            return {place, view: home, anchor: "homeView"};

        case "coast_rocks": {
            const beach = world.beach();
            const rocks = world.shoreRocks();
            if (!beach && !rocks.length) return fallback("no beach, no shore rocks");
            // The biggest cluster of shore rocks nearest the beach: score each rock by its neighbours' size, less its distance.
            const from = beach ?? {x: 0, z: 80};
            let best: (XZ & {scale: number}) | null = null;
            let bestScore = -Infinity;
            for (const rock of rocks) {
                const near = rocks.filter((other) => Math.hypot(other.x - rock.x, other.z - rock.z) < 7).reduce((sum, other) => sum + other.scale, 0);
                const score = near * 3 - Math.hypot(rock.x - from.x, rock.z - from.z) * 0.08;
                if (score > bestScore) {
                    bestScore = score;
                    best = rock;
                }
            }
            const at = best ?? from;
            const ground = Math.max(world.groundAt(at.x, at.z), 0);
            // From the sea, a little to one side, so the shore runs across the picture.
            return {place, anchor: best ? "shore rock cluster nearest the beach" : "beach", view: {target: {x: at.x, y: ground + 0.6, z: at.z}, distance: 16, polar: 1.16, azimuth: outward(at) + 0.5}};
        }

        case "forest_floor": {
            const floor = world.forestFloor();
            if (!floor) return fallback("no forest floor");
            const ground = world.groundAt(floor.x, floor.z);
            return {place, anchor: "forest floor corner", view: {target: {x: floor.x, y: ground + 0.25, z: floor.z}, distance: 4.6, polar: 1.18, azimuth: outward(floor) + 0.3}};
        }

        case "house_fields": {
            const house = world.house();
            if (!house) return fallback("no house");
            const fields = world.fields() ?? house;
            const at = mix(house, fields, 0.35);
            const ground = Math.max(world.groundAt(at.x, at.z), 0);
            // From the south-east of it, the house in front and the fields behind.
            return {place, anchor: "house + fields", view: {target: {x: at.x, y: ground + 1.2, z: at.z}, distance: 27, polar: 1.12, azimuth: bearing(fields, house) + 0.35}};
        }

        case "river_pond": {
            const lake = world.lake();
            const river = world.river();
            if (!lake) return fallback("no lake");
            // Where the river leaves the lake, seen from downstream looking up it: water, banks and the lake behind.
            const downstream = river && river.length > 2 ? river[2] : {x: lake.x, z: lake.z + 20};
            const at = river && river.length > 1 ? mix(lake, river[1], 0.75) : lake;
            const ground = Math.max(world.groundAt(at.x, at.z), 0);
            return {place, anchor: river ? "lake outflow" : "lake", view: {target: {x: at.x, y: ground + 0.4, z: at.z}, distance: 24, polar: 1.1, azimuth: bearing(at, downstream) + 0.25}};
        }

        case "mountain": {
            const area = world.mountainArea();
            if (!area) return fallback("no mountains");
            // The peak: the highest ground round the mountains' middle.
            let peak = {x: area.x, z: area.z, y: world.groundAt(area.x, area.z)};
            const step = 2;
            for (let x = area.x - area.radius; x <= area.x + area.radius; x += step) {
                for (let z = area.z - area.radius; z <= area.z + area.radius; z += step) {
                    const y = world.groundAt(x, z);
                    if (y > peak.y) peak = {x, z, y};
                }
            }
            // From the island's middle side, looking up at it.
            return {place, anchor: `peak ${peak.y.toFixed(1)} m`, view: {target: {x: peak.x, y: peak.y * 0.42, z: peak.z}, distance: 96, polar: 1.3, azimuth: bearing(peak, {x: 0, z: 0}) + 0.3}};
        }

        case "caterpillar_leaf":
        case "bee_flower":
        case "limpet_tidepool":
        case "gecko_wall":
            // Framed by the page itself once the animal is placed (golden-entry.ts `microShot`).
            return fallback("micro shot: framed on its attach point");

        case "reef_underwater": {
            const reef = world.reef();
            if (!reef) return fallback("no reef");
            const seabed = world.groundAt(reef.x, reef.z);
            // Under the surface, level with the coral, looking in toward the island.
            const y = Math.min(seabed + 1.1, -0.8);
            return {place, anchor: `reef, seabed ${seabed.toFixed(1)} m`, view: {target: {x: reef.x, y, z: reef.z}, distance: 9, polar: 1.5, azimuth: outward(reef)}};
        }
    }
}

/** The harness's two devices. */
export const GOLDEN_DEVICES = {
    desktop: {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, cpuThrottle: 1},
    /** A mid-range Android phone: 360×800 CSS px at DPR 2, 4× CPU throttle, 8 cores / 4 GB reported, coarse pointer. */
    phone: {width: 360, height: 800, deviceScaleFactor: 2, mobile: true, cpuThrottle: 4}
} as const;
export type GoldenDevice = keyof typeof GOLDEN_DEVICES;
