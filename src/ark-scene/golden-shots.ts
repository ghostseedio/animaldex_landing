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

export const GOLDEN_PLACES = ["island_far", "coast_rocks", "forest_floor", "house_fields", "river_pond", "mountain", "reef_underwater", "reef_closeup", "kelp_forest", "caterpillar_leaf", "bee_flower", "limpet_tidepool", "gecko_wall", "ant_bark", "waves_beach", "storm_trees", "fields_close"] as const;

/** Shots in their own weather (everything else is calm, mean tide). */
export const GOLDEN_WEATHER: Partial<Record<GoldenPlace, {wind: number; storm: number; cloud: number; wetness: number}>> = {
    storm_trees: {wind: 1, storm: 1, cloud: 0.95, wetness: 0.85},
    waves_beach: {wind: 0.7, storm: 0, cloud: 0.35, wetness: 0}
};

/**
 * The small-animal close-ups (graphics pass): a real catalogue species at its true size on an attach point of the
 * scenery (`sampler.ts`), framed as the scene frames a small animal you tap (its length × 6, 0.12–3 m away) unless
 * the shot gives a distance. The catalogue has no caterpillar model yet, so the leaf shot uses a small butterfly
 * (5 cm, a caterpillar's length); the ant on the bark (5 mm) checks the near plane for the smallest animals.
 */
export const GOLDEN_MICRO: Partial<Record<GoldenPlace, {slug: string; tag: "leaf" | "bark" | "flower_head" | "rock_face" | "house_wall"; near: "forest_floor" | "house" | "tide_pools"; distance?: number}>> = {
    caterpillar_leaf: {slug: "small-cabbage-white", tag: "leaf", near: "forest_floor", distance: 0.55},
    bee_flower: {slug: "bumblebee", tag: "flower_head", near: "house"},
    limpet_tidepool: {slug: "common-limpet", tag: "rock_face", near: "tide_pools"},
    gecko_wall: {slug: "common-house-gecko", tag: "house_wall", near: "house"},
    ant_bark: {slug: "black-ant", tag: "bark", near: "forest_floor"}
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
    reef_closeup: "Reef close-up (corals, sponges, anemones, fish)",
    kelp_forest: "Kelp forest off a cliff coast",
    caterpillar_leaf: "Small animal on a leaf (no caterpillar model yet: a small butterfly)",
    bee_flower: "Bee on a flower",
    limpet_tidepool: "Limpet in a tide pool",
    gecko_wall: "Gecko on the house wall",
    ant_bark: "Ant on a tree's bark (5 mm: the near plane)",
    waves_beach: "Waves running up the beach",
    storm_trees: "Trees in a storm",
    fields_close: "Crop rows close up"
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
    /** A dense knot of corals on the reef (its bed height), and the bearing to look at it from. */
    reefCloseup?: () => (XZ & {y: number; azimuth: number}) | null;
    /** The middle of a kelp stand (its bed height), and the bearing to look across it from. */
    kelpStand?: () => (XZ & {y: number; azimuth: number}) | null;
    /** An open clearing inside the forest (a site's own ground), to look out at the trees from. */
    forestClearing?: () => XZ | null;
    /** Trunks, lamps and walls as circles on the ground (`golden-world.ts`): the close shots stand clear of them. */
    obstacles?: () => Array<XZ & {radius: number}>;
    /** A field of standing crops (batch 4: the fields' close shot). */
    cropField?: () => XZ | null;
};

export type GoldenView = {
    place: GoldenPlace;
    view: ArkCameraView;
    /** How the anchor was found (for the report). */
    anchor: string;
    /** A view the user's camera may not take (batch 5: the mountain from low down): the golden page lifts the limits. */
    camera?: {maxPolar?: number; free?: boolean};
};

/** The bearing from the island's middle out to a point: the camera stands outside, looking in (as the director's shots do). */
function outward(point: XZ): number {
    return Math.hypot(point.x, point.z) > 1 ? Math.atan2(point.x, point.z) : 0;
}

/** The bearing from `from` toward `to`, as a camera azimuth (0 = +z). */
function bearing(from: XZ, to: XZ): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

const mix = (a: XZ, b: XZ, k: number): XZ => ({x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k});

/** Where a view's camera stands on the ground plane (the scene's orbit: polar from straight up, azimuth from +z). */
export function goldenEye(view: ArkCameraView): {x: number; y: number; z: number} {
    const t = view.target;
    return {
        x: t.x + Math.sin(view.polar) * Math.sin(view.azimuth) * view.distance,
        y: t.y + Math.cos(view.polar) * view.distance,
        z: t.z + Math.sin(view.polar) * Math.cos(view.azimuth) * view.distance
    };
}

/**
 * How clear a view's near field is (batch 4): the least gap (m) between any obstacle and the camera, or the first
 * 60% of its sight line to the target, where a trunk would fill the picture.
 */
export function goldenClearance(view: ArkCameraView, obstacles: Array<XZ & {radius: number}>): number {
    const eye = goldenEye(view);
    let least = Infinity;
    for (const o of obstacles) {
        if (Math.abs(o.x - eye.x) > 12 || Math.abs(o.z - eye.z) > 12) continue;
        for (let k = 0; k <= 6; k++) {
            const at = mix(eye, view.target, k * 0.1);
            // Along the sight line only the camera's own spot needs the full margin; further out a trunk is smaller.
            least = Math.min(least, Math.hypot(o.x - at.x, o.z - at.z) - o.radius + k * 0.25);
        }
    }
    return least;
}

/**
 * The bearing nearest the preferred one whose camera stands at least `clear` metres from every obstacle (else the
 * clearest within reach), so the close shots never open with a trunk or limb beside the lens.
 */
function clearView(view: ArkCameraView, world: GoldenWorld, clear: number, reach = 1.6): ArkCameraView {
    const obstacles = world.obstacles?.() ?? [];
    if (!obstacles.length) return view;
    let best = view;
    let bestGap = -Infinity;
    for (let step = 0; step <= Math.round(reach / 0.08); step++) {
        const turn = ((step + 1) >> 1) * (step % 2 ? 1 : -1) * 0.08;
        const candidate = {...view, azimuth: view.azimuth + turn};
        const eye = goldenEye(candidate);
        // Never a spot inside a hill.
        const gap = eye.y > world.groundAt(eye.x, eye.z) + 0.8 ? goldenClearance(candidate, obstacles) : -Infinity;
        if (gap >= clear) return candidate;
        if (gap > bestGap) {
            bestGap = gap;
            best = candidate;
        }
    }
    return best;
}

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
            // The biggest cluster of shore rocks nearest the beach: score each rock by its neighbours' size, less its distance,
            // less a steep bank behind it (batch 4: a shore, not the foot of a wall of sand).
            const from = beach ?? {x: 0, z: 80};
            let best: (XZ & {scale: number}) | null = null;
            let bestScore = -Infinity;
            for (const rock of rocks) {
                const near = rocks.filter((other) => Math.hypot(other.x - rock.x, other.z - rock.z) < 7).reduce((sum, other) => sum + other.scale, 0);
                const r = Math.hypot(rock.x, rock.z) || 1;
                const rise = world.groundAt(rock.x - (rock.x / r) * 8, rock.z - (rock.z / r) * 8) - Math.max(world.groundAt(rock.x, rock.z), 0);
                const score = near * 3 - Math.hypot(rock.x - from.x, rock.z - from.z) * 0.08 - Math.max(rise - 2, 0);
                if (score > bestScore) {
                    bestScore = score;
                    best = rock;
                }
            }
            const at = best ?? from;
            const ground = Math.max(world.groundAt(at.x, at.z), 0);
            // From the shallows, looking along the shore (batch 4): the rocks run into the distance, the sea and its
            // horizon on one side, the beach on the other, and no forest edge cut off at the frame's top.
            const view = {target: {x: at.x, y: ground + 0.5, z: at.z}, distance: 13, polar: 1.27, azimuth: outward(at) + 1.05};
            return {place, anchor: best ? "shore rock cluster nearest the beach" : "beach", view: clearView(view, world, 4)};
        }

        case "forest_floor": {
            const floor = world.forestFloor();
            if (!floor) return fallback("no forest floor");
            const ground = world.groundAt(floor.x, floor.z);
            // Batch 4: turned to the nearest bearing where no trunk or limb stands beside the lens.
            const view = {target: {x: floor.x, y: ground + 0.25, z: floor.z}, distance: 4.6, polar: 1.18, azimuth: outward(floor) + 0.3};
            return {place, anchor: "forest floor corner", view: clearView(view, world, 2.6)};
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
            // From the island's middle side, low (batch 5, a golden-only camera): the range against the sky, its foot in
            // view, as a mountain is seen from the valley rather than from a plane at its own height.
            return {place, anchor: `peak ${peak.y.toFixed(1)} m`, view: {target: {x: peak.x, y: peak.y * 0.5, z: peak.z}, distance: 125, polar: 1.5, azimuth: bearing(peak, {x: 0, z: 0}) + 0.3}, camera: {maxPolar: 1.56, free: true}};
        }

        case "caterpillar_leaf":
        case "bee_flower":
        case "limpet_tidepool":
        case "gecko_wall":
        case "ant_bark":
            // Framed by the page itself once the animal is placed (golden-entry.ts `microShot`).
            return fallback("micro shot: framed on its attach point");

        case "waves_beach": {
            const beach = world.beach();
            if (!beach) return fallback("no beach");
            // Low over the wet sand at the water's edge, looking along the shore.
            const out = outward(beach);
            const r = Math.hypot(beach.x, beach.z);
            const edge = {x: beach.x + (beach.x / r) * 4.5, z: beach.z + (beach.z / r) * 4.5};
            return {place, anchor: "beach waterline", view: {target: {x: edge.x, y: 0.3, z: edge.z}, distance: 9, polar: 1.3, azimuth: out + 1.25}};
        }

        case "fields_close": {
            const field = world.cropField?.() ?? null;
            if (!field) return fallback("no crop field");
            const ground = world.groundAt(field.x, field.z);
            // Low over the field's edge, the rows running away into it, the cottage's side of the farm behind.
            const view = {target: {x: field.x, y: ground + 0.4, z: field.z}, distance: 7, polar: 1.22, azimuth: outward(field) + 0.4};
            return {place, anchor: "standing crops", view: clearView(view, world, 2)};
        }

        case "storm_trees": {
            const floor = world.forestFloor();
            const clearing = world.forestClearing?.() ?? null;
            if (!floor) return fallback("no forest");
            const ground = world.groundAt(floor.x, floor.z);
            // From inside the clearing, looking out at the trees beyond its edge.
            const from = clearing ?? {x: floor.x, z: floor.z + 10};
            const away = bearing(floor, from);
            return {place, anchor: "forest edge from the clearing", view: {target: {x: floor.x, y: ground + 3.5, z: floor.z}, distance: 10, polar: 1.42, azimuth: away}};
        }

        case "reef_closeup": {
            const spot = world.reefCloseup?.() ?? null;
            if (!spot) return fallback("no reef close-up spot");
            // Down among the corals, a little above them, from the open water side.
            return {place, anchor: `coral knot, bed ${spot.y.toFixed(1)} m`, view: {target: {x: spot.x, y: spot.y + 0.45, z: spot.z}, distance: 4.2, polar: 1.3, azimuth: spot.azimuth}};
        }

        case "kelp_forest": {
            const stand = world.kelpStand?.() ?? null;
            if (!stand) return fallback("no kelp stand");
            // Mid-water in the stand, looking across it, a little up toward the light.
            return {place, anchor: `kelp stand, bed ${stand.y.toFixed(1)} m`, view: {target: {x: stand.x, y: Math.min(stand.y + 2.4, -1.2), z: stand.z}, distance: 5.5, polar: 1.6, azimuth: stand.azimuth}};
        }

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
