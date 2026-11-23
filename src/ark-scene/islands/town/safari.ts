/**
 * The safari park (p4 (safari), the owner, 2026-11-17: "just add a massive section to the zoo island for a commercial
 * safari, then move animals to it, make it nice and detailed so it matches the rest"). On the town island's new
 * north-west lobe (`plan.ts` SAFARI_LOBE), past the zoo and away from the downtown: an entrance plaza by the zoo's
 * spine (gatehouse, ticket kiosks, a car park off Farm Road, the safari trucks' depot), a visitor road looping
 * through the habitats, a hub with the lodge (restaurant), toilets and an observation tower, a raised boardwalk to a
 * deck over the river.
 *
 * The habitats are zoo enclosures (`areas.ts` zooLayout, `ZooSlot.safari`) so the schedules, the near-kept bring-out,
 * taps, colliders and grounding all work there as in the zoo: each borrows a server type's spec (capacity, feeding,
 * food) and has its own ground (dry savanna, desert sand, a forest edge, a wetland with the hippo pool, a river) with
 * waterholes level with the ground. Herbivores are held by ditches (ha-ha) and low rails; the predators' areas and
 * the outer edge are fenced (no cages on the plains).
 *
 * Who lives here is a rule over each resident's stored data (`safariHabitatOf`): which residents move, and why, is
 * the record's, never a list of animals. Pure: the same for every viewer.
 */

import {DOME_LAGOON, inDome} from "@/ark-scene/islands/town/dome";
import {box, corners, ellipse, inBox, polylineAt, smoothLine, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import type {ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import residents from "@/ark-scene/islands/town/safari-residents.json";

export type SafariHabitat = "plains" | "desert" | "forest" | "wetland" | "river" | "lions" | "tigers" | "hyenas";

/** A pool or waterhole: an ellipse cut level with the ground, its water 0.12 m under the rim, mud round it. */
export type SafariWater = {x: number; z: number; rx: number; rz: number; rot: number; /** Bed under the water (m). */ depth: number};

export type SafariArea = {
    /** The enclosure's name (`<id>-1`): what a moved resident's enclosure becomes (`safariEnclosureOf`). */
    id: string;
    habitat: SafariHabitat;
    /** The server type whose spec it takes (capacity aside): feeding times, food, keepers' rounds. */
    type: ZooEnclosureType;
    capacity: number;
    /** Hard bounds (the mask, inset 0.4 m as every enclosure's). */
    at: Box;
    predator: boolean;
    waters: SafariWater[];
    label: string;
};

/** The lobe's habitats (local frame; z negative is north). Each box clear of the loop road by 2 m or more. */
export const SAFARI_AREAS: SafariArea[] = [
    {id: "safari_plains-1", habitat: "plains", type: "savanna_paddocks", capacity: 40, at: box(-152, -233.5, 86, 27), predator: false, waters: [{x: -133, z: -237, rx: 7.5, rz: 4.6, rot: 0.2, depth: 0.9}], label: "Savanna plains"},
    {id: "safari_desert-1", habitat: "desert", type: "savanna_paddocks", capacity: 12, at: box(-226, -233.5, 50, 25), predator: false, waters: [{x: -214, z: -228, rx: 3, rz: 2, rot: 0.5, depth: 0.5}], label: "Desert and scrub"},
    {id: "safari_forest-1", habitat: "forest", type: "savanna_paddocks", capacity: 16, at: box(-216, -267, 58, 18), predator: false, waters: [{x: -201, z: -269, rx: 5.5, rz: 3.2, rot: -0.3, depth: 1.1}], label: "Asian forest edge"},
    {id: "safari_wetland-1", habitat: "wetland", type: "savanna_paddocks", capacity: 10, at: box(-158, -268, 46, 20), predator: false, waters: [{x: -160, z: -270, rx: 13, rz: 5.5, rot: 0.08, depth: 1.6}], label: "Wetland and hippo pool"},
    {id: "safari_river-1", habitat: "river", type: "big_cats", capacity: 8, at: box(-116, -268, 28, 20), predator: true, waters: [{x: -116, z: -269, rx: 11, rz: 4.2, rot: -0.15, depth: 1.5}], label: "Crocodile river"},
    {id: "safari_tigers-1", habitat: "tigers", type: "big_cats", capacity: 8, at: box(-226, -196, 54, 24), predator: true, waters: [{x: -240, z: -192, rx: 4, rz: 2.8, rot: 0.3, depth: 0.8}], label: "Tiger forest"},
    {id: "safari_hyenas-1", habitat: "hyenas", type: "bears_wolves", capacity: 8, at: box(-180, -201, 24, 15), predator: true, waters: [], label: "Hyena kopje"},
    {id: "safari_lions-1", habitat: "lions", type: "big_cats", capacity: 8, at: box(-139, -201, 48, 15), predator: true, waters: [{x: -122, z: -199, rx: 3, rz: 2, rot: 0, depth: 0.6}], label: "Lion pride"}
];

/** The visitor loop (a gravel track 5 m wide), closed: south leg west, round the west end, north leg east, round the east end. */
export const SAFARI_LOOP: Poly = smoothLine(
    [
        {x: -100, z: -215},
        {x: -150, z: -213.6},
        {x: -200, z: -215},
        {x: -246, z: -214},
        {x: -259, z: -220},
        {x: -264, z: -234},
        {x: -259, z: -247},
        {x: -246, z: -253},
        {x: -200, z: -251.6},
        {x: -150, z: -253},
        {x: -110, z: -252},
        {x: -99, z: -246},
        {x: -95, z: -236},
        {x: -96, z: -224},
        {x: -100, z: -215}
    ],
    2
);
export const SAFARI_ROAD_WIDTH = 5;

/** From the gatehouse to the loop's south-east corner. */
export const SAFARI_GATE_ROAD: Poly = [
    {x: -66, z: -206},
    {x: -68, z: -212},
    {x: -78, z: -215.5},
    {x: -100, z: -215},
    {x: -105, z: -214.85}
];

/**
 * The gate arch's place (ark-world, decision 447: "gate arch slightly off the road"): across the gate road, `GATE_ARCH_ALONG` m
 * in from its start, turned square to the road there. Its frame's local x runs across the road (the posts at x = ±3.6), so
 * its turn is the road's heading plus a quarter turn; the painted board's front (local +z) looks back at visitors coming
 * from the plaza. (It was turned by minus the heading plus a quarter turn: square to the road only when the road ran due
 * east or west, 37 degrees off on this one, and set on the road's very first point.) ark-world round 2 (the owner, "the
 * gate arch sits off the road"): at 3.2 m it stood square to the road's first 6 m stub, right where the road bends 55
 * degrees west, so seen from the plaza it framed grass with the road turning away behind one post. It now stands 24 m in,
 * on the road's long straight west leg (x -78 to -100), square to it, clear of the gatehouse, the depot and the tower.
 */
export const GATE_ARCH_ALONG = 24;
export function safariGateArch(road: Poly = SAFARI_GATE_ROAD): {x: number; z: number; rot: number; heading: number} {
    const {point, dir} = polylineAt(road, GATE_ARCH_ALONG);
    const heading = Math.atan2(dir.z, dir.x);
    return {x: point.x, z: point.z, rot: heading + Math.PI / 2, heading};
}

/**
 * The loop as a street (its drawn road): open, its end stopping short of its start so the two never lie one on the
 * other; the gate road runs on over the start, and the end meets the gate road's side as a junction
 * (`street-clip.ts` cuts the one under the other). The trucks drive the closed `SAFARI_LOOP`.
 */
export const SAFARI_LOOP_STREET: Poly = (() => {
    const start = SAFARI_LOOP[0];
    let end = SAFARI_LOOP.length - 1;
    while (end > 0 && Math.hypot(SAFARI_LOOP[end].x - start.x, SAFARI_LOOP[end].z - start.z) < 4) end--;
    return SAFARI_LOOP.slice(0, end + 1);
})();

/** The entrance: plaza, car park (off Farm Road's west end), depot, the zoo's walk, the hub. */
export const SAFARI = {
    plaza: box(-66, -197, 28, 18),
    carPark: box(-66.5, -172, 19, 28),
    depot: box(-91, -200, 20, 13),
    hub: box(-74, -237, 34, 38),
    gatehouse: box(-75, -202.5, 8, 5),
    kiosks: [box(-58.5, -203, 3, 2.6), box(-54.5, -203, 3, 2.6)],
    depotShed: box(-91, -202, 18, 8),
    lodge: box(-72, -246, 17, 10),
    toilets: box(-62, -226, 7, 4.5),
    tower: box(-84, -224, 4.6, 4.6),
    /** The zoo's walk: from the top of the zoo's spine through the car park to the plaza. */
    walk: [{x: -66, z: -150}, {x: -66, z: -189}] as Poly,
    /** Farm Road's west end into the car park. */
    drive: [{x: -56, z: -153}, {x: -57.5, z: -161}] as Poly,
    /** The raised boardwalk: from the lodge's terrace north to the deck over the river (1.6 m up). */
    boardwalk: [{x: -80, z: -252}, {x: -93, z: -259}, {x: -96, z: -271}] as Poly,
    /** Viewing decks: over the plains from the loop's south leg, over the hippo pool, the lions, the river. */
    decks: [
        {x: -134, z: -217.6, turn: Math.PI, w: 6, d: 2.6},
        {x: -175, z: -217.4, turn: Math.PI, w: 5, d: 2.6},
        {x: -160, z: -255.6, turn: 0, w: 6, d: 2.4},
        {x: -97, z: -273, turn: -Math.PI / 2, w: 3.4, d: 4}
    ],
    towerHeight: 14
};

/** Rock outcrops (kopjes): granite boulders piled in the plains, the hyenas' and the lions' areas. */
export const SAFARI_KOPJES: Array<{x: number; z: number; r: number; h: number; seed: number}> = [
    {x: -176, z: -229, r: 5.5, h: 3.6, seed: 11},
    {x: -117, z: -228, r: 4, h: 2.6, seed: 23},
    {x: -183, z: -203, r: 4, h: 2.8, seed: 37},
    {x: -153, z: -203, r: 3.6, h: 2.4, seed: 41},
    {x: -238, z: -226, r: 3.2, h: 2.2, seed: 53}
];

/** Termite mounds on the plains and the lions' grass. */
export const SAFARI_TERMITES: Pt[] = [
    {x: -160, z: -243},
    {x: -118, z: -243},
    {x: -190, z: -222},
    {x: -146, z: -224},
    {x: -128, z: -205}
];

/** The safari's whole footprint (for quick rejection): the lobe north of the zoo. */
export const SAFARI_BOUNDS = {x0: -272, x1: -46, z0: -284, z1: -150};

/** (p5 (zoospace): and the free-flight dome's footprint, whose lagoon is cut into the ground as the waterholes are.) */
export function inSafari(x: number, z: number): boolean {
    return (x >= SAFARI_BOUNDS.x0 && x <= SAFARI_BOUNDS.x1 && z >= SAFARI_BOUNDS.z0 && z <= SAFARI_BOUNDS.z1) || inDome(x, z);
}

/** Every pool and waterhole (p5 (zoospace): and the dome's lagoon, `dome.ts`). */
export const SAFARI_WATERS: SafariWater[] = [...SAFARI_AREAS.flatMap((a) => a.waters), DOME_LAGOON];

/** A water's outline. */
export function safariWaterPoly(w: SafariWater, scale = 1, n = 28): Poly {
    return ellipse(w.x, w.z, w.rx * scale, w.rz * scale, n, w.rot);
}

/** In a water's own measure (1 at its edge). */
export function safariWaterNorm(w: SafariWater, x: number, z: number): number {
    const dx = x - w.x;
    const dz = z - w.z;
    const c = Math.cos(w.rot);
    const s = Math.sin(w.rot);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    return Math.hypot(lx / w.rx, lz / w.rz);
}

/**
 * The ha-ha ditch along a herbivore area's sides (and between the plains and the desert): 2.4 m wide, 0.9 m deep,
 * just inside the area's edge, so the view from the road is open grass. Returns 0 (none) to 1 (its floor).
 */
export function safariDitch(x: number, z: number): number {
    let most = 0;
    for (const a of SAFARI_AREAS) {
        if (a.predator) continue;
        if (!inBox(a.at, x, z, 1)) continue;
        const dx = a.at.w / 2 - Math.abs(x - a.at.x);
        const dz = a.at.d / 2 - Math.abs(z - a.at.z);
        const edge = Math.min(dx, dz);
        // (The ditch's middle 1.4 m in from the edge; its sides ease over 1.2 m.)
        const t = 1 - Math.min(Math.abs(edge - 1.4) / 1.2, 1);
        most = Math.max(most, t * t * (3 - 2 * t));
    }
    return most;
}

// MARK: - Who lives in the safari

type Resident = {model_slug: string; scientific_name?: string | null; enclosure?: string | null; area?: string | null};

/** The server types residents move from: the zoo's crowded paddocks, the big cats, the bears and wolves, the reptile house. */
const FROM: Partial<Record<string, readonly SafariHabitat[]>> = {
    savanna_paddocks: ["plains", "desert", "forest", "wetland"],
    big_cats: ["lions", "tigers"],
    bears_wolves: ["hyenas"],
    reptile_house: ["river"]
};

/**
 * The large predators by species (binomial, the record's scientific name): each kind its own fenced area, never with
 * another predator or with prey. Only the kinds with an area built here move; any other stays in the zoo.
 */
const PREDATOR_AREAS: Record<string, SafariHabitat> = {"panthera leo": "lions", "panthera tigris": "tigers", "crocuta crocuta": "hyenas"};

const HERBIVORES = (residents as {habitats: Record<string, string>}).habitats as Record<string, SafariHabitat>;

/**
 * Where a zoo resident lives in the safari, or null (it stays in its zoo enclosure). The rule (`scripts/ark-safari-
 * residents.mts` writes the herbivores' and the river's table from the stored profiles; the predators by binomial):
 * - large herbivores (body ≥ 45, a quadruped or a big flightless bird, not a meat or fish eater)
 *   from the savanna paddocks, by their stored zone: grassland → the plains (a mixed herd), desert → the desert, rainforest or woodland → the
 *   forest edge, wetland or river → the wetland with the hippo pool;
 * - the big cats and the hyenas (meat eaters ≥ 45) from their zoo enclosures, each kind to its own fenced area;
 * - the crocodilians (reptile-house lizards ≥ 55 of wetland or river that eat fish or meat) to the river.
 */
export function safariHabitatOf(animal: Resident): SafariHabitat | null {
    if (animal.area !== undefined && animal.area !== null && animal.area !== "zoo") return null;
    const server = animal.enclosure ? animal.enclosure.slice(0, animal.enclosure.lastIndexOf("-")) : "";
    const allowed = FROM[server];
    if (!allowed) return null;
    let habitat: SafariHabitat | null = HERBIVORES[animal.model_slug] ?? null;
    if (!habitat) {
        const binomial = (animal.scientific_name ?? "").toLowerCase().split(/\s+/).slice(0, 2).join(" ");
        habitat = PREDATOR_AREAS[binomial] ?? null;
    }
    return habitat && allowed.includes(habitat) ? habitat : null;
}

/** A zoo resident's enclosure as the town draws it: its safari area's, or the server's own. */
export function safariEnclosureOf(animal: Resident): string | null {
    const habitat = safariHabitatOf(animal);
    if (!habitat) return animal.enclosure ?? null;
    return SAFARI_AREAS.find((a) => a.habitat === habitat)!.id;
}

export function safariArea(id: string): SafariArea | null {
    return SAFARI_AREAS.find((a) => a.id === id) ?? null;
}

export function isSafariEnclosure(id: string | null | undefined): boolean {
    return Boolean(id && id.startsWith("safari_"));
}

/** The area's fence line (predators) or its ditch's line, closed. */
export function safariAreaEdge(a: SafariArea): Poly {
    const c = corners(a.at);
    return [...c, c[0]];
}
