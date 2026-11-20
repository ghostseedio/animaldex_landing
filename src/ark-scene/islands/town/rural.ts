/**
 * The countryside (p5 (rural), the owner, 2026-11-17: "we also need somewhere to move the domestic animals, currently so
 * many dogs and horses and cows etc. in one garden. Add more to the town island like a rural area with lots of fields";
 * then "add chicken farms too"). On the town island's new eastern lobe (`plan.ts` RURAL_LOBE), past the homes east of
 * East Road and the farmland on the country lane, away from the downtown (south-west) and the safari (north-west):
 * Rural Lane runs on from the country lane's end down the lobe, farm tracks off it, and either side a patchwork of
 * hedged and dry-stone-walled fields: a dairy farm (cubicle barn, milking parlour, collecting yard, the cows' pasture),
 * a stable yard with a riding arena and horse paddocks with field shelters, a sheep fold, a goat paddock, a pig unit
 * with arks, a free-range poultry farm (mobile hen houses on grass inside low netting), a farmhouse with a farmyard
 * coop and run, an orchard with a hen house, a duck pond, a hay meadow with bales and crops in rows.
 *
 * Who lives here is a rule over each animal's record (`ruralPenOf`): its area (a home's or a farm's, or the zoo's
 * children's farm past a small petting set) and its kind by the record's scientific name (the genus: `rural-residents.json`,
 * written by `scripts/ark-rural-residents.mts`). Pure: the same for every viewer. The wild island and the server are
 * untouched: placement stays client-side.
 */

import {box, corners, ellipse, hashText, inBox, smoothLine, unitOf, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import residents from "@/ark-scene/islands/town/rural-residents.json";

/** What a field holds, by the residents' kind (`RuralKind`). */
export type RuralKind = "cattle" | "horses" | "donkeys" | "sheep" | "camelids" | "goats" | "pigs" | "poultry" | "waterfowl";

/** A field's boundary: a hawthorn hedge, a dry-stone wall, post-and-rail, low poultry netting, a pig's low wire. */
export type RuralEdge = "hedge" | "drystone" | "paddock_rail" | "poultry_net" | "pig_wire";

/** The ground: grazed grass, a sand school, a muddy pig field, a concrete yard, an orchard's grass. */
export type RuralGround = "pasture" | "arena" | "pig" | "yard" | "orchard" | "pond" | "crop";

export type RuralPen = {
    id: string;
    label: string;
    /** The field's bounds: its boundary runs on this box's sides (the residents keep inside it). */
    at: Box;
    edge: RuralEdge;
    ground: RuralGround;
    /** Who lives here (empty: no animals, a crop or hay field). */
    kinds: readonly RuralKind[];
    /** How many of its kinds' residents it takes, against the other fields of the same kind (rendezvous weight). */
    weight: number;
    /** The crop or the grass's drape (`render/scenery.ts` CROP). */
    crop?: string;
    /** Where its gate stands: the side nearest the lane or a track. */
    gate: "n" | "s" | "e" | "w";
};

/** The lane: on from the country lane's east end, round the dairy and down the lobe to the duck pond. */
export const RURAL_LANE: Poly = smoothLine(
    [
        {x: 182, z: -111},
        {x: 200, z: -110.5},
        {x: 222, z: -107},
        {x: 236, z: -98},
        {x: 239, z: -70},
        {x: 239, z: -30},
        {x: 238.5, z: 10},
        {x: 237, z: 40},
        {x: 233, z: 58}
    ],
    2
);
export const RURAL_LANE_WIDTH = 4.5;

/** Farm tracks (gravel, 3.2 m) off the lane: to the stable yard and the arena; to the farmhouse and the orchard. */
export const RURAL_TRACKS: Array<{id: string; line: Poly}> = [
    {id: "rural_track_stables", line: [{x: 236.6, z: -80}, {x: 222, z: -80}, {x: 204, z: -80}]},
    {id: "rural_track_farmhouse", line: [{x: 236.6, z: -38}, {x: 222, z: -38}, {x: 205, z: -38}]}
];

/**
 * The fields (local frame: x east, z south). West of the lane (x 199-235): the dairy's yard, the stable yard and arena,
 * the farmhouse's yard, the orchard, the goats, the duck pond. East (x 243-288): the cows' pasture, two horse paddocks,
 * the sheep fold, the free-range poultry farm, the pig unit, the hay meadow.
 */
export const RURAL_PENS: RuralPen[] = [
    {id: "rural-dairy-pasture", label: "Dairy pasture", at: box(255, -128, 30, 25), edge: "hedge", ground: "pasture", kinds: ["cattle"], weight: 1, crop: "pasture", gate: "w"},
    {id: "rural-dairy-yard", label: "Dairy collecting yard", at: box(214, -122, 26, 9), edge: "paddock_rail", ground: "yard", kinds: [], weight: 0, gate: "s"},
    {id: "rural-paddock-1", label: "Horse paddock", at: box(262, -94, 36, 24), edge: "paddock_rail", ground: "pasture", kinds: ["horses"], weight: 1, crop: "pasture", gate: "w"},
    {id: "rural-paddock-2", label: "Horse and donkey paddock", at: box(264, -63, 40, 24), edge: "paddock_rail", ground: "pasture", kinds: ["horses", "donkeys"], weight: 1, crop: "pasture", gate: "w"},
    {id: "rural-arena", label: "Riding arena", at: box(216, -63, 30, 18), edge: "paddock_rail", ground: "arena", kinds: [], weight: 0, gate: "n"},
    {id: "rural-sheep-fold", label: "Sheep fold", at: box(264, -32, 40, 24), edge: "drystone", ground: "pasture", kinds: ["sheep", "camelids"], weight: 1, crop: "pasture", gate: "w"},
    {id: "rural-orchard", label: "Orchard and hen house", at: box(217, -14, 28, 22), edge: "hedge", ground: "orchard", kinds: ["poultry"], weight: 1, crop: "orchard", gate: "e"},
    {id: "rural-free-range", label: "Free-range poultry farm", at: box(264, 2, 40, 30), edge: "poultry_net", ground: "pasture", kinds: ["poultry"], weight: 3, crop: "pasture", gate: "w"},
    {id: "rural-farmyard-run", label: "Farmyard coop and run", at: box(226, -30, 12, 8), edge: "poultry_net", ground: "yard", kinds: ["poultry"], weight: 1, gate: "e"},
    {id: "rural-goats", label: "Goat paddock", at: box(217, 13, 28, 20), edge: "paddock_rail", ground: "pasture", kinds: ["goats"], weight: 1, crop: "pasture", gate: "e"},
    {id: "rural-pigs", label: "Pig unit", at: box(262, 33, 34, 22), edge: "pig_wire", ground: "pig", kinds: ["pigs"], weight: 1, gate: "w"},
    {id: "rural-duck-pond", label: "Duck pond", at: box(217, 40, 24, 22), edge: "paddock_rail", ground: "pasture", kinds: ["waterfowl"], weight: 1, crop: "pasture", gate: "e"},
    {id: "rural-hay", label: "Hay meadow", at: box(258, 58, 26, 11), edge: "hedge", ground: "crop", kinds: [], weight: 0, crop: "stubble", gate: "w"}
];

/** The duck pond: still water in the duck pond's field, a farm pond (`ground.ts` cuts it, pass 3's reflections apply). */
export const RURAL_POND = {x: 216, z: 43, rx: 7, rz: 5, rot: 0.2};
export const RURAL_POND_POLY: Poly = ellipse(RURAL_POND.x, RURAL_POND.z, RURAL_POND.rx, RURAL_POND.rz, 24, RURAL_POND.rot);

/** A building of the countryside (`render/rural.ts` draws the new kinds; the farmhouse, barns and stable as the farms'). */
export type RuralBuildingKind = "farmhouse" | "barn" | "stable" | "coop" | "shed" | "milking_parlour" | "field_shelter" | "pig_ark" | "hen_house";
export type RuralBuilding = {id: string; kind: RuralBuildingKind; at: Box; eaves: number; top: number; roof: "gable" | "lean" | "none"};

const PIG_ARKS: RuralBuilding[] = [0, 1, 2, 3].map((i) => ({id: `rural-pig-ark-${i}`, kind: "pig_ark", at: box(250 + i * 8, 27, 2.4, 2.8, 0.1 * (i % 2)), eaves: 1.2, top: 1.25, roof: "none"}));
const HEN_HOUSES: RuralBuilding[] = [0, 1, 2].map((i) => ({id: `rural-hen-house-${i}`, kind: "hen_house", at: box(252 + i * 12, -6 + (i % 2) * 15, 3.2, 2.2, 0.15 - i * 0.12), eaves: 1.9, top: 2.5, roof: "gable"}));

export const RURAL_BUILDINGS: RuralBuilding[] = [
    // The dairy: the cubicle barn (the cows' winter housing), the milking parlour by the collecting yard, a hay barn.
    {id: "rural-cow-barn", kind: "barn", at: box(209, -138, 20, 12), eaves: 4.6, top: 8.2, roof: "gable"},
    {id: "rural-milking-parlour", kind: "milking_parlour", at: box(226.5, -138, 9, 8), eaves: 3.2, top: 5.4, roof: "gable"},
    // The stable yard: a block of loose boxes facing the yard, the tack room's end.
    {id: "rural-stables", kind: "stable", at: box(214, -90, 22, 5.5), eaves: 3, top: 4.5, roof: "lean"},
    // The farmhouse and its hay barn.
    {id: "rural-farmhouse", kind: "farmhouse", at: box(211, -31, 10, 8), eaves: 5.2, top: 8, roof: "gable"},
    {id: "rural-hay-barn", kind: "barn", at: box(212, -46, 14, 8), eaves: 4.2, top: 7.2, roof: "gable"},
    // The farmyard's coop in its run, the orchard's hen house.
    {id: "rural-farmyard-coop", kind: "coop", at: box(229.5, -31.5, 2.6, 2), eaves: 1.4, top: 2.1, roof: "gable"},
    {id: "rural-orchard-hen-house", kind: "hen_house", at: box(207, -20, 3.2, 2.2), eaves: 1.9, top: 2.5, roof: "gable"},
    // Field shelters (open-fronted) in the paddocks, the cows' pasture and the sheep fold.
    {id: "rural-shelter-paddock-1", kind: "field_shelter", at: box(276, -102.5, 6, 3.4), eaves: 2.4, top: 3.2, roof: "lean"},
    {id: "rural-shelter-paddock-2", kind: "field_shelter", at: box(279, -71.5, 6, 3.4), eaves: 2.4, top: 3.2, roof: "lean"},
    {id: "rural-shelter-sheep", kind: "field_shelter", at: box(279, -40.5, 5, 3), eaves: 2.2, top: 3, roof: "lean"},
    {id: "rural-shelter-goats", kind: "field_shelter", at: box(208, 19.5, 5, 3), eaves: 2.2, top: 3, roof: "lean"},
    ...PIG_ARKS,
    ...HEN_HOUSES
];

/** The orchard's apple trees (rows 5 m apart, clear of its hen house). */
export function ruralOrchardTrees(): Pt[] {
    const o = RURAL_PENS.find((p) => p.id === "rural-orchard")!.at;
    const out: Pt[] = [];
    for (let i = 0; i < 5; i++) {
        for (let k = 0; k < 4; k++) {
            const x = o.x - o.w / 2 + 3 + i * ((o.w - 6) / 4);
            const z = o.z - o.d / 2 + 3 + k * ((o.d - 6) / 3);
            if (Math.hypot(x - 207, z + 20) < 4) continue;
            out.push({x, z});
        }
    }
    return out;
}

/** Round bales in rows on the hay meadow, a stack by the dairy (`farm.ts` props: colliders, drawn as the farms'). */
export const RURAL_BALES: Array<{id: string; at: Box; kind: "round_bales" | "square_bales"; top: number}> = [
    {id: "rural:round_bales:0", at: box(252, 56, 3.9, 1.3, 0.1), kind: "round_bales", top: 1.2},
    {id: "rural:round_bales:1", at: box(263, 60, 3.9, 1.3, -0.05), kind: "round_bales", top: 1.2},
    {id: "rural:square_bales:0", at: box(198.5, -124, 2.4, 1.2, Math.PI / 2), kind: "square_bales", top: 1.4},
    {id: "rural:round_bales:2", at: box(221, -45.5, 3.9, 1.3, Math.PI / 2), kind: "round_bales", top: 2.3}
];

/** Water troughs in the grazing fields (inside, by the gate side). */
export const RURAL_TROUGHS: Box[] = [box(243, -128, 2.2, 0.65, Math.PI / 2), box(247, -100, 2.2, 0.65, Math.PI / 2), box(247, -55, 2.2, 0.65, Math.PI / 2), box(248, -24, 2.2, 0.65, Math.PI / 2), box(230, 16, 2.2, 0.65, Math.PI / 2)];

/** The lobe's whole footprint (quick rejection). */
export const RURAL_BOUNDS = {x0: 180, x1: 300, z0: -172, z1: 92};

export function inRural(x: number, z: number): boolean {
    return x >= RURAL_BOUNDS.x0 && x <= RURAL_BOUNDS.x1 && z >= RURAL_BOUNDS.z0 && z <= RURAL_BOUNDS.z1;
}

export function ruralPen(id: string): RuralPen | null {
    return RURAL_PENS.find((p) => p.id === id) ?? null;
}

/** A pen's boundary line, closed. */
export function ruralPenEdge(p: RuralPen): Poly {
    const c = corners(p.at);
    return [...c, c[0]];
}

/**
 * The duck pond's waterfowl (Ark ducks: they stood on its bank, their swims aimed at the sea): their spots are in its
 * deep water, inside this measure (its ellipse's, 1 at the water's edge: the bowl is over half a metre deep there,
 * `ground.ts`, deep enough for a swim cell), and the range they keep (m), a little under its shorter half-axis, so a
 * swim's goal lands on the pond's own water, not on the rim of its deep part.
 */
export const RURAL_POND_DEEP = 0.65;
export const RURAL_POND_RANGE = 4;

/** Whether a point is in the duck pond's water (in its own measure, < 1). */
export function ruralPondNorm(x: number, z: number): number {
    const dx = x - RURAL_POND.x;
    const dz = z - RURAL_POND.z;
    const c = Math.cos(RURAL_POND.rot);
    const s = Math.sin(RURAL_POND.rot);
    return Math.hypot((dx * c + dz * s) / RURAL_POND.rx, (-dx * s + dz * c) / RURAL_POND.rz);
}

// MARK: - Who lives in the countryside

type Resident = {id: string; model_slug: string; scientific_name?: string | null; area?: string | null; enclosure?: string | null};

const TABLE = residents as {genera: Record<string, RuralKind>; equus: Record<string, RuralKind>};

/** The record's kind by its scientific name's genus (`rural-residents.json`; Equus by its species), or null: a pet. */
export function ruralKindOf(animal: {scientific_name?: string | null}): RuralKind | null {
    const [genus, species] = (animal.scientific_name ?? "").trim().split(/\s+/);
    if (!genus) return null;
    const g = genus[0].toUpperCase() + genus.slice(1).toLowerCase();
    if (g === "Equus") return TABLE.equus[(species ?? "").toLowerCase()] ?? null;
    return TABLE.genera[g] ?? null;
}

/**
 * How many the zoo's children's farm keeps for petting, of its big animals and of its birds (one of each kind in turn,
 * so the set is varied; the rest of its horses, donkeys, goats, sheep, pigs and poultry live in the countryside): the
 * coordinator's census, 2026-11-17, "30 animals in 287 m², 10 overlaps".
 */
export const PETTING_KEEP = 6;

/** A backyard hen: this share of a home's poultry stays in its garden (a hash of its id, so none ever moves back and forth). */
export const BACKYARD_HENS = 0.12;

/**
 * Which field a town animal lives in, or null (it stays where it is):
 * - livestock and poultry of a home or a farm (by the genus: cattle, horses, donkeys, sheep, camelids, goats, pigs,
 *   chickens and the other fowl, ducks and geese), except a few backyard hens (`BACKYARD_HENS`) who stay at home;
 * - the children's farm's livestock past its petting set, a farm's past its few (`stays` passes the ones kept: `stayingSet`);
 * - a farm's dog (the record's area says it is the farm's) to the dairy's yard with the farmer; a home's dog stays home.
 * Among a kind's fields, a rendezvous of its id over them by weight: the same for every viewer, never moved by others.
 */
export function ruralPenOf(animal: Resident, stays?: (animal: Resident) => boolean): RuralPen | null {
    const area = animal.area ?? null;
    if (area !== "house" && area !== "farm" && area !== "zoo") return null;
    if (area === "zoo") {
        const server = animal.enclosure ? animal.enclosure.slice(0, animal.enclosure.lastIndexOf("-")) : "";
        if (server !== "childrens_farm") return null;
    }
    if ((area === "zoo" || area === "farm") && (!stays || stays(animal))) return null;
    const kind = ruralKindOf(animal);
    if (!kind) {
        if (area === "farm" && /^canis lupus familiaris|^canis familiaris/i.test(animal.scientific_name ?? "")) return ruralPen("rural-dairy-yard");
        return null;
    }
    if (area === "house" && kind === "poultry" && unitOf(animal.id, "backyard-hen") < BACKYARD_HENS) return null;
    return pickPen(animal.id, kind);
}

function pickPen(id: string, kind: RuralKind): RuralPen | null {
    let best: RuralPen | null = null;
    let bestScore = -Infinity;
    for (const p of RURAL_PENS) {
        if (!p.kinds.includes(kind) || p.weight <= 0) continue;
        // (A weighted rendezvous: −w / ln(u), the highest wins; u from the id and the field.)
        const u = (hashText(`${id}|${p.id}`) + 0.5) / 4294967296;
        const score = -p.weight / Math.log(u);
        if (score > bestScore) {
            bestScore = score;
            best = p;
        }
    }
    return best;
}

/** How many a farm keeps at home (its paddock's big animals, its run's birds); the rest live in the countryside. */
export const FARM_KEEP = {farmstead: {big: 6, birds: 5}, smallholding: {big: 3, birds: 3}} as const;

/**
 * Who stays where the record puts them: the children's farm's petting set (of each kind in each of its enclosures,
 * the `PETTING_KEEP` whose ids hash lowest), and each farm's few (`FARM_KEEP`: its big animals and its birds, the
 * lowest hashes; `farmOf` is the farm a farm animal's record puts it on, `areas.ts`). Worked out over the whole list of
 * town animals: one arriving can take a place at home from one who then moves out to the fields (the census's crowding
 * otherwise: the coordinator, 2026-11-17, "farmstead paddocks 31/30 big animals in 238 m²").
 */
export function stayingSet(animals: readonly Resident[], farmOf: (id: string) => {id: string; kind: "farmstead" | "smallholding"} | null, taken: ReadonlyMap<string, number> = new Map()): Set<string> {
    const groups = new Map<string, {cap: number; list: Array<{id: string; h: number; kind: string}>}>();
    const add = (key: string, cap: number, id: string, kind: string) => {
        let g = groups.get(key);
        if (!g) groups.set(key, (g = {cap, list: []}));
        g.list.push({id, h: hashText(`${id}|stays`), kind});
    };
    for (const a of animals) {
        const kind = ruralKindOf(a);
        if (!kind) continue;
        const birds = kind === "poultry" || kind === "waterfowl";
        if (a.area === "zoo" && a.enclosure?.startsWith("childrens_farm-")) add(`${a.enclosure}|${birds ? "birds" : "big"}`, PETTING_KEEP, a.id, kind);
        else if (a.area === "farm") {
            const farm = farmOf(a.id);
            if (!farm) continue;
            add(`${farm.id}|${birds ? "birds" : "big"}`, FARM_KEEP[farm.kind][birds ? "birds" : "big"], a.id, kind);
        }
    }
    const out = new Set<string>();
    groups.forEach((g, key) => {
        // (Each kind's in hash order, then one of each kind in turn: a varied few, the lowest hashes first.)
        g.list.sort((a, b) => a.h - b.h || a.id.localeCompare(b.id));
        const turn = new Map<string, number>();
        const ranked = g.list.map((k) => {
            const n = turn.get(k.kind) ?? 0;
            turn.set(k.kind, n + 1);
            return {...k, n};
        });
        ranked.sort((a, b) => a.n - b.n || a.h - b.h || a.id.localeCompare(b.id));
        // (Container breeding: the ones the server keeps at the farm already hold places of its few: `stayKey`.)
        for (const k of ranked.slice(0, Math.max(g.cap - (taken.get(key) ?? 0), 0))) out.add(k.id);
    });
    return out;
}

/** The group `stayingSet` counts a farm's resident in, for a farm and a kind of resident (its big animals, its birds). */
export function stayKey(farmId: string, kind: RuralKind): string {
    return `${farmId}|${kind === "poultry" || kind === "waterfowl" ? "birds" : "big"}`;
}

/** The fields' boxes inside which nothing else is placed (the plan keeps clear of them). */
export function ruralKeepOut(): Box[] {
    return RURAL_PENS.map((p) => p.at);
}

export function inRuralPen(x: number, z: number, margin = 0): RuralPen | null {
    for (const p of RURAL_PENS) if (inBox(p.at, x, z, margin)) return p;
    return null;
}

// MARK: - Shut in at dusk

/**
 * The poultry's day (the owner, 2026-11-17: "hens ranging out by day and shut in at dusk"): the free-range flocks, the
 * orchard's and the farmyard's go in to their hen house as the light fades and are shut in, let out in the morning, by
 * the shared clock (island hours): walking to the pophole over the half hour before `in`, inside until `out`, out over
 * the half hour after. The same for every viewer. (Hens go to roost as the sun goes: the island's sun is down at 18:00
 * and its lamps on by about 18:20 (`people.ts` darkness), so they walk in from 18:00 and are shut in at 18:30; first
 * frames at 19:15 showed the range full of hens in the dark.)
 */
export const COOP_HOURS = {in: 18.5, out: 6.75, walk: 0.5};

const POULTRY_HOUSES: Record<string, string[]> = {
    "rural-free-range": HEN_HOUSES.map((h) => h.id),
    "rural-orchard": ["rural-orchard-hen-house"],
    "rural-farmyard-run": ["rural-farmyard-coop"]
};

/** The hen house a bird of this field goes in to (a hash of its id over the field's houses), or null for another field. */
export function henHouseOf(fieldId: string, id: string): RuralBuilding | null {
    const ids = POULTRY_HOUSES[fieldId];
    if (!ids) return null;
    const pickId = ids[hashText(`${id}|hen-house`) % ids.length];
    return RURAL_BUILDINGS.find((b) => b.id === pickId) ?? null;
}

function houseLocal(b: RuralBuilding, lx: number, lz: number): Pt {
    const c = Math.cos(b.at.rot);
    const s = Math.sin(b.at.rot);
    return {x: b.at.x + lx * c - lz * s, z: b.at.z + lx * s + lz * c};
}

/**
 * Where a bird is now against its hen house (local frame): null while it ranges (its schedule's pose stands), else the
 * point it walks to or rests at and whether it is inside (shut in: its floor is the house's, `floor` m over the ground).
 */
export function coopPose(fieldId: string, id: string, hours: number, x: number, z: number): {x: number; z: number; inside: boolean; floor: number} | null {
    const house = henHouseOf(fieldId, id);
    if (!house) return null;
    const {in: shut, out, walk} = COOP_HOURS;
    const h = ((hours % 24) + 24) % 24;
    const door = houseLocal(house, (house.at.w * 0.2), house.at.d / 2 + 0.45);
    const r = hashText(`${id}|perch`);
    const spot = houseLocal(house, ((r % 100) / 100 - 0.5) * (house.at.w - 1), (((r >>> 8) % 100) / 100 - 0.5) * (house.at.d - 1));
    const floor = house.kind === "hen_house" ? 0.75 : 0.5;
    const ease = (t: number) => t * t * (3 - 2 * t);
    if (h >= shut - walk && h < shut) {
        const t = ease((h - (shut - walk)) / walk);
        return {x: x + (door.x - x) * t, z: z + (door.z - z) * t, inside: false, floor: 0};
    }
    if (h >= shut || h < out) return {x: spot.x, z: spot.z, inside: true, floor};
    if (h < out + walk) {
        const t = ease((h - out) / walk);
        return {x: door.x + (x - door.x) * t, z: door.z + (z - door.z) * t, inside: false, floor: 0};
    }
    return null;
}

/**
 * A number that changes whenever the poultry's standing places change by the clock: 0 while they range, -1 shut in, and
 * a step every half minute of the walks in and out. The town's resting figures (drawn still at their places, out of the
 * live budget) are placed again when it changes, so the whole flock goes in, not only the animated few.
 */
export function coopTick(hours: number): number {
    const {in: shut, out, walk} = COOP_HOURS;
    const h = ((hours % 24) + 24) % 24;
    if (h >= shut - walk && h < shut) return 1 + Math.floor(((h - (shut - walk)) / walk) * 60);
    if (h >= shut || h < out) return -1;
    if (h < out + walk) return 100 + Math.floor(((h - out) / walk) * 60);
    return 0;
}
