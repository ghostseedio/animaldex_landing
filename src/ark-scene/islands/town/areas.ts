/**
 * Where the town island's animals can be (brief: "placement areas"; islands plan §3–§5, §7.1): pure spots and areas
 * from the plan, for placement, the server's slot atlas (encounter hunting) and player control.
 *
 * - **House** (pets; protected, D11): every household's outdoor spots (a house's garden 6, a terrace home's yard 2, a
 *   flat's balcony 1 and its block's courtyard 8) and indoor spots (by the windows, for tanks and cages).
 * - **Farm** (livestock; protected): each farm's paddock, yard and run spots (the D10 template).
 * - **Garden and countryside wildlife**: gardens, the park, allotments, the churchyard, the wood and wild corner,
 *   hedgerows and field margins, the canal, the millpond and the farm pond.
 * - **Urban wildlife**: rooftops and ridges, eaves, ledges, tall buildings' tops (peregrines: the church tower, the
 *   mill chimney, the lighthouse, the town hall's cupola), the belfry (bats), bins and drains (rats), the quay and the
 *   harbour wall (gulls), the square (pigeons), lamp-lit walls (house geckos).
 * - **Zoo**: each enclosure's mask (hard bounds), capacity, pool, house, feeding station and enrichment spots.
 *
 * Nothing here depends on who lives in the town: the town is complete from launch, so a spot never moves.
 */

import {corners, hashText, inBox, inPoly, local, polylineAt, polylineLength, rng, sub, type Box, type Poly, type Pt} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {CANAL, CANAL_LEVEL, CANAL_WIDTH, MILLPOND, townPlan, type Building, type Parcel, type TownPlan, type ZooSlot} from "@/ark-scene/islands/town/plan";
import {ZOO_ENCLOSURE_TYPES, ZOO_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import type {CarSpot} from "@/ark-scene/islands/town/people";
import type {SpotWhere} from "@/ark-scene/islands/town/niche";

export type TownArea = "house" | "farm" | "garden_wildlife" | "urban_wildlife" | "zoo";
export type SpotSize = "small" | "medium" | "large";

export type {SpotWhere} from "@/ark-scene/islands/town/niche";

export type TownSpot = {x: number; y: number; z: number; area: TownArea; where: SpotWhere; /** The parcel, farm, enclosure or habitat it belongs to. */ place: string; sizes: readonly SpotSize[]; protected: boolean};

const SMALL: readonly SpotSize[] = ["small"];
const SMALL_MEDIUM: readonly SpotSize[] = ["small", "medium"];
const ALL: readonly SpotSize[] = ["small", "medium", "large"];

/** Outdoor spots per home type (islands plan §3.3). */
export const HOME_OUTDOOR = {house: 6, terrace_home: 2, flat_balcony: 1, courtyard: 8} as const;
/** Outdoor spots per farm (the D10 template, scaled for the farmsteads). */
export const FARM_OUTDOOR = {smallholding: {paddock: 12, yard: 6, run: 6}, farmstead: {paddock: 26, yard: 12, run: 12}} as const;

function y(x: number, z: number): number {
    return townHeight(x, z);
}

/** Spots spread over a box on a jittered grid, `count` of them, deterministic from `seed`. */
function spread(b: Box, count: number, seed: number, margin = 0.6): Pt[] {
    const out: Pt[] = [];
    if (count <= 0) return out;
    const r = rng(seed);
    const w = Math.max(b.w - margin * 2, 0.2);
    const d = Math.max(b.d - margin * 2, 0.2);
    const columns = Math.max(1, Math.round(Math.sqrt((count * w) / d)));
    const rows = Math.ceil(count / columns);
    for (let i = 0; i < count; i++) {
        const c = i % columns;
        const k = Math.floor(i / columns);
        const lx = -w / 2 + (w * (c + 0.2 + r() * 0.6)) / columns;
        const lz = -d / 2 + (d * (k + 0.2 + r() * 0.6)) / rows;
        out.push(local(b, lx, lz));
    }
    return out;
}

/** Spots inside a polygon on a jittered grid `spacing` m apart. */
function scatter(poly: Poly, spacing: number, seed: number, keep: (x: number, z: number) => boolean = () => true): Pt[] {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const p of poly) {
        x0 = Math.min(x0, p.x);
        z0 = Math.min(z0, p.z);
        x1 = Math.max(x1, p.x);
        z1 = Math.max(z1, p.z);
    }
    const r = rng(seed);
    const out: Pt[] = [];
    for (let x = x0 + spacing / 2; x < x1; x += spacing) {
        for (let z = z0 + spacing / 2; z < z1; z += spacing) {
            const px = x + (r() - 0.5) * spacing * 0.7;
            const pz = z + (r() - 0.5) * spacing * 0.7;
            if (inPoly(poly, px, pz) && keep(px, pz)) out.push({x: px, z: pz});
        }
    }
    return out;
}

// MARK: - Homes and farms

export type Household = {id: string; building: string; parcel: string; kind: "house" | "terrace_home" | "flat"; index: number};

/** The town's 360 households, in plan order (ids are stable: `<building>#<n>`). */
export function townHouseholds(plan: TownPlan = townPlan()): Household[] {
    const out: Household[] = [];
    for (const b of plan.buildings) {
        if (!b.households) continue;
        const kind = b.kind === "house" ? "house" : b.kind === "terrace" ? "terrace_home" : "flat";
        for (let i = 0; i < b.households; i++) out.push({id: `${b.id}#${i}`, building: b.id, parcel: b.parcel ?? b.id, kind, index: i});
    }
    return out;
}

/**
 * The household a pet lives with: a rendezvous hash of the animal's id over the eligible households, so a household's
 * pets never move as the town fills (D10's `plotOf`, generalised). Dogs, cats, rabbits and the like go to houses and
 * terrace homes; fish, caged birds, small reptiles and invertebrates may also go to flats (islands plan §3.3).
 */
export function householdOf(animalId: string, keptIndoors: boolean, households: Household[] = townHouseholds()): Household {
    let best: Household = households[0];
    let bestScore = -1;
    for (const h of households) {
        if (!keptIndoors && h.kind === "flat") continue;
        const score = hashText(`${animalId}|${h.id}`);
        if (score > bestScore) {
            bestScore = score;
            best = h;
        }
    }
    return best;
}

function homeSpots(plan: TownPlan, buildings: Map<string, Building>): TownSpot[] {
    const out: TownSpot[] = [];
    const courts = new Set<string>();
    for (const p of plan.parcels) {
        const b = buildings.get(p.building);
        if (!b) continue;
        if (p.kind === "house" && p.back) {
            for (const s of spread(p.back, HOME_OUTDOOR.house - 1, p.seed)) out.push({...s, y: y(s.x, s.z), area: "house", where: "lawn", place: `${b.id}#0`, sizes: ALL, protected: true});
            if (p.front) {
                const s = local(p.front, 0, 0);
                out.push({...s, y: y(s.x, s.z), area: "house", where: "lawn", place: `${b.id}#0`, sizes: SMALL_MEDIUM, protected: true});
            }
        } else if (p.kind === "terrace_home" && p.back) {
            for (let k = 0; k < 4; k++) {
                const yard = sub(p.back, -p.back.w / 2 + p.back.w * (k + 0.5) / 4, 0, p.back.w / 4, p.back.d);
                for (const s of spread(yard, HOME_OUTDOOR.terrace_home, p.seed + k)) out.push({...s, y: y(s.x, s.z), area: "house", where: "yard", place: `${b.id}#${k}`, sizes: SMALL_MEDIUM, protected: true});
            }
        } else if (p.kind === "flats") {
            // A balcony for each flat above the ground floor (ground-floor flats: their patio), and the courtyard.
            for (let i = 0; i < b.households; i++) {
                const floor = Math.floor(i / 2);
                const side = i % 2 ? 1 : -1;
                const s = local(b.at, (side * b.at.w) / 4, -b.at.d / 2 - 0.9);
                out.push({x: s.x, y: y(b.at.x, b.at.z) + 0.15 + floor * (b.eaves / b.floors), z: s.z, area: "house", where: "balcony", place: `${b.id}#${i}`, sizes: SMALL, protected: true});
            }
            const court = p.back;
            const key = court ? `${Math.round(court.x)},${Math.round(court.z)}` : b.id;
            if (court && !courts.has(key)) {
                courts.add(key);
                for (const s of spread(court, HOME_OUTDOOR.courtyard * Math.max(1, plan.parcels.filter((q) => q.back && Math.round(q.back.x) === Math.round(court.x) && Math.round(q.back.z) === Math.round(court.z)).length), p.seed, 1.2)) out.push({...s, y: y(s.x, s.z), area: "house", where: "courtyard", place: b.id, sizes: SMALL_MEDIUM, protected: true});
            }
        }
        // Indoors by a window: tanks, cages and baskets (one per household).
        for (let i = 0; i < b.households; i++) {
            const s = local(b.at, -b.at.w / 2 + b.at.w * ((i % 4) + 0.5) / Math.min(b.households, 4), b.at.d / 2 - 1.2);
            out.push({x: s.x, y: y(b.at.x, b.at.z) + 0.95 + Math.floor(i / 2) * (b.eaves / b.floors), z: s.z, area: "house", where: "window", place: `${b.id}#${i}`, sizes: SMALL, protected: true});
        }
    }
    return out;
}

function farmSpots(plan: TownPlan): TownSpot[] {
    const out: TownSpot[] = [];
    for (const f of plan.farms) {
        const n = FARM_OUTDOOR[f.kind];
        for (const s of spread(f.paddock, n.paddock, f.seed, 1.2)) out.push({...s, y: y(s.x, s.z), area: "farm", where: "paddock", place: f.id, sizes: ALL, protected: true});
        for (const s of spread(f.yard, n.yard, f.seed + 1)) out.push({...s, y: y(s.x, s.z), area: "farm", where: "farmyard", place: f.id, sizes: ALL, protected: true});
        if (f.run) for (const s of spread(f.run, n.run, f.seed + 2, 0.5)) out.push({...s, y: y(s.x, s.z), area: "farm", where: "run", place: f.id, sizes: SMALL, protected: true});
    }
    return out;
}

/** The farm a farm animal lives on: a rendezvous hash weighted by the farm's outdoor spots (farmsteads hold twice). */
export function farmOf(animalId: string, plan: TownPlan = townPlan()): string {
    let best = plan.farms[0]?.id ?? "";
    let bestScore = -Infinity;
    for (const f of plan.farms) {
        const weight = f.kind === "farmstead" ? 2 : 1;
        const u = (hashText(`${animalId}|${f.id}`) + 1) / 4294967297;
        const score = -weight / Math.log(u);
        if (score > bestScore) {
            bestScore = score;
            best = f.id;
        }
    }
    return best;
}

// MARK: - Town wildlife

function wildlifeSpots(plan: TownPlan): TownSpot[] {
    const out: TownSpot[] = [];
    const greenWhere: Partial<Record<string, SpotWhere>> = {park: "park", allotments: "allotment", churchyard: "churchyard", wood: "wood", wild_corner: "wild_corner", green: "garden", beach: "beach"};
    for (const g of plan.greens) {
        const where = greenWhere[g.kind];
        if (!where) continue;
        for (const s of scatter(g.poly, where === "garden" ? 4 : 5, hashText(g.id), (x, z) => sampleTownGround(x, z).surface !== "water")) out.push({...s, y: y(s.x, s.z), area: "garden_wildlife", where, place: g.id, sizes: where === "wood" || where === "park" ? ALL : SMALL_MEDIUM, protected: false});
    }
    // Back gardens: the hedges and borders at their edges (shared with the pets, who are protected).
    for (const p of plan.parcels) {
        if (p.kind !== "house" || !p.back) continue;
        const s = local(p.back, p.back.w / 2 - 0.5, -p.back.d / 2 + 0.6);
        out.push({...s, y: y(s.x, s.z), area: "garden_wildlife", where: "garden", place: p.id, sizes: SMALL, protected: false});
    }
    // Hedgerows and field margins.
    for (const h of plan.hedges) {
        if (h.kind !== "hedge" || !(h.id.startsWith("field") || h.id.includes("smallholding") || h.id.includes("farmstead"))) continue;
        const length = polylineLength(h.line);
        for (let a = 3; a < length; a += 8) {
            const {point} = polylineAt(h.line, a);
            out.push({...point, y: y(point.x, point.z), area: "garden_wildlife", where: h.id.startsWith("field") ? "field_margin" : "hedgerow", place: h.id, sizes: SMALL_MEDIUM, protected: false});
        }
    }
    // The canal (both banks and the water), the millpond, the farm pond.
    const canalLength = polylineLength(CANAL);
    for (let a = 4; a < canalLength; a += 6) {
        const {point, dir} = polylineAt(CANAL, a);
        for (const side of [-1, 1]) {
            const off = side * (CANAL_WIDTH / 2 - 1.2);
            out.push({x: point.x - dir.z * off, y: CANAL_LEVEL, z: point.z + dir.x * off, area: "garden_wildlife", where: "canal", place: "canal", sizes: SMALL_MEDIUM, protected: false});
        }
    }
    for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        const r = k % 2 ? 0.55 : 1.08;
        out.push({x: MILLPOND.x + Math.cos(a) * MILLPOND.rx * r, y: CANAL_LEVEL, z: MILLPOND.z + Math.sin(a) * MILLPOND.rz * r, area: "garden_wildlife", where: "millpond", place: "millpond", sizes: SMALL_MEDIUM, protected: false});
    }
    for (const w of plan.waters) {
        if (w.kind !== "farm_pond") continue;
        for (const p of w.poly.filter((_, i) => i % 3 === 0)) out.push({...p, y: y(p.x, p.z), area: "garden_wildlife", where: "farm_pond", place: w.id, sizes: SMALL_MEDIUM, protected: false});
    }
    return out;
}

/** Rooftops, eaves, ledges, tall tops, the belfry, bins, drains, the quay and the square: urban wildlife's spots. */
function urbanSpots(plan: TownPlan): TownSpot[] {
    const out: TownSpot[] = [];
    for (const b of plan.buildings) {
        const floor = y(b.at.x, b.at.z) + 0.15;
        if (b.kind === "coop" || b.kind === "stable") continue;
        // The ridge (or a flat roof's middle), and the eaves front and back.
        const ridge = local(b.at, 0, 0);
        out.push({...ridge, y: floor + b.top, z: ridge.z, area: "urban_wildlife", where: b.roof === "flat" ? "ledge" : "roof", place: b.id, sizes: SMALL_MEDIUM, protected: false});
        if (b.at.w > 9) {
            for (const lx of [-b.at.w / 3, b.at.w / 3]) {
                const p = local(b.at, lx, 0);
                out.push({...p, y: floor + b.top, area: "urban_wildlife", where: "roof", place: b.id, sizes: SMALL_MEDIUM, protected: false});
            }
        }
        for (const lz of [b.at.d / 2 + 0.2, -b.at.d / 2 - 0.2]) {
            const p = local(b.at, 0, lz);
            out.push({...p, y: floor + b.eaves - 0.2, area: "urban_wildlife", where: "eave", place: b.id, sizes: SMALL, protected: false});
        }
        if (b.tall) out.push({x: b.tall.x, y: y(b.tall.x, b.tall.z) + b.tall.y, z: b.tall.z, area: "urban_wildlife", where: "tall", place: b.id, sizes: SMALL_MEDIUM, protected: false});
        if (b.kind === "church" && b.tall) out.push({x: b.tall.x, y: y(b.tall.x, b.tall.z) + 18.5, z: b.tall.z, area: "urban_wildlife", where: "belfry", place: b.id, sizes: SMALL, protected: false});
        // A lamp-lit wall by the door (house geckos hunt moths there at night).
        if (b.households > 0) {
            const p = local(b.at, -b.at.w / 4, b.at.d / 2 + 0.05);
            out.push({...p, y: floor + 2.4, area: "urban_wildlife", where: "lamp_wall", place: b.id, sizes: SMALL, protected: false});
        }
    }
    for (const bin of binSpots(plan)) out.push({x: bin.home.x, y: y(bin.home.x, bin.home.z), z: bin.home.z, area: "urban_wildlife", where: "bin", place: bin.id, sizes: SMALL, protected: false});
    for (const d of drainSpots(plan)) out.push({...d, y: y(d.x, d.z) - 0.3, area: "urban_wildlife", where: "drain", place: "drains", sizes: SMALL, protected: false});
    const quay = plan.streets.find((s) => s.id === "quay");
    if (quay) {
        const length = polylineLength(quay.line);
        for (let a = 2; a < length; a += 5) {
            const {point} = polylineAt(quay.line, a);
            out.push({...point, y: y(point.x, point.z), area: "urban_wildlife", where: "quay", place: "quay", sizes: SMALL_MEDIUM, protected: false});
        }
    }
    for (const s of spread(plan.square, 24, 7, 2)) out.push({...s, y: y(s.x, s.z), area: "urban_wildlife", where: "square", place: "square", sizes: SMALL_MEDIUM, protected: false});
    return out;
}

/** Each home's bin: by the house (`home`) and at the kerb (`kerb`) when it is out (`people.ts` binsOut). */
export function binSpots(plan: TownPlan = townPlan()): Array<{id: string; street: string; home: Pt; kerb: Pt; turn: number}> {
    const out: Array<{id: string; street: string; home: Pt; kerb: Pt; turn: number}> = [];
    for (const p of plan.parcels) {
        const b = plan.buildings.find((q) => q.id === p.building);
        if (!b) continue;
        if (p.kind === "house") {
            const side = p.drive ? (local(p.at, 0, 0).x < p.drive.x ? -1 : 1) : 1;
            const home = local(b.at, side * (b.at.w / 2 + 0.7), b.at.d / 2 - 1.2);
            const kerb = local(p.at, side * (p.at.w / 2 - 1.2), p.at.d / 2 + 0.5);
            out.push({id: `${b.id}#0`, street: p.street, home, kerb, turn: p.at.rot});
        } else if (p.kind === "terrace_home") {
            for (let k = 0; k < 4; k++) {
                const u = -b.at.w / 2 + b.at.w * (k + 0.5) / 4;
                const home = local(p.at, u + 1.3, p.at.d / 2 - (p.front ? 1.6 : 0.9));
                const kerb = local(p.at, u + 1.3, p.at.d / 2 + 0.5);
                out.push({id: `${b.id}#${k}`, street: p.street, home, kerb, turn: p.at.rot});
            }
        } else if (p.kind === "flats") {
            // A bin store by the block: four big bins, out together.
            for (let k = 0; k < 4; k++) {
                const home = local(b.at, b.at.w / 2 + 1.0, b.at.d / 2 - 1.0 - k * 1.3);
                const kerb = local(b.at, b.at.w / 2 + 1.0 + k * 1.3, b.at.d / 2 + 2.6);
                out.push({id: `${b.id}#bin${k}`, street: p.street, home, kerb, turn: b.at.rot + Math.PI / 2});
            }
        }
    }
    return out;
}

/** Storm drains along the streets' kerbs (every ~24 m) and the canal's outfalls: the rats' way in and out. */
export function drainSpots(plan: TownPlan = townPlan()): Pt[] {
    const out: Pt[] = [];
    for (const s of plan.streets) {
        if (!(s.kind === "high" || s.kind === "road")) continue;
        const length = polylineLength(s.line);
        for (let a = 10; a < length; a += 24) {
            const {point, dir} = polylineAt(s.line, a);
            const off = s.width / 2 - 0.3;
            out.push({x: point.x - dir.z * off, z: point.z + dir.x * off});
        }
    }
    const canal = polylineLength(CANAL);
    for (let a = 20; a < canal; a += 40) {
        const {point, dir} = polylineAt(CANAL, a);
        const off = CANAL_WIDTH / 2 + 0.2;
        out.push({x: point.x - dir.z * off, z: point.z + dir.x * off});
    }
    return out;
}

/** Car spots: every house's drive, kerbs along the residential streets, the farms' yards, the harbour. */
export function carSpots(plan: TownPlan = townPlan()): CarSpot[] {
    const out: CarSpot[] = [];
    for (const p of plan.parcels) {
        if (!p.drive) continue;
        const s = local(p.drive, 0, 0.3);
        out.push({id: `drive:${p.id}`, kind: "drive", x: s.x, z: s.z, turn: p.drive.rot});
    }
    for (const s of plan.streets) {
        if (s.kind !== "road" && s.kind !== "high") continue;
        const length = polylineLength(s.line);
        for (let a = 12; a < length - 12; a += 6.5) {
            const {point, dir} = polylineAt(s.line, a);
            const side = Math.floor(a / 6.5) % 2 ? 1 : -1;
            const off = side * (s.width / 2 - 1.05);
            const x = point.x - dir.z * off;
            const z = point.z + dir.x * off;
            // Not on a junction, a bridge or by a drive.
            if (plan.streets.some((o) => o.id !== s.id && o.kind !== "path" && o.kind !== "zoo_path" && nearLine(o.line, x, z, o.width / 2 + o.pavement + 4))) continue;
            if (nearLine(CANAL, x, z, CANAL_WIDTH / 2 + 7)) continue;
            out.push({id: `kerb:${s.id}:${Math.round(a)}`, kind: "kerb", x, z, turn: Math.atan2(dir.x, dir.z)});
        }
    }
    for (const f of plan.farms) {
        const s = local(f.yard, f.yard.w / 4, 0);
        out.push({id: `farm:${f.id}`, kind: "farm", x: s.x, z: s.z, turn: f.at.rot + Math.PI / 2});
    }
    for (let i = 0; i < 6; i++) out.push({id: `harbour:${i}`, kind: "harbour", x: 34 + (i % 3) * 3, z: 108 + Math.floor(i / 3) * 6, turn: 0});
    return out;
}

function nearLine(line: Poly, x: number, z: number, r: number): boolean {
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = dx * dx + dz * dz;
        const t = l > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / l, 0), 1) : 0;
        if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < r) return true;
    }
    return false;
}

// MARK: - The zoo

export type ZooEnclosure = {
    /** The server's enclosure name (`<type>-<n>`, `voyage_animals.enclosure`). */
    id: string;
    /** The plot it is drawn on: its type's own slot, or a spare (`slot.id` is the enclosure's name either way). */
    slot: ZooSlot;
    place: string;
    /** Drawn in its type's last own slot with that enclosure's residents (past every slot and spare). */
    shared: boolean;
    type: ZooEnclosureType;
    /** The fence: residents stay inside (hard bounds for placement, behaviour, the walk grid and player control). */
    mask: Poly;
    capacity: number;
    /** The pool (penguins and seals, bears, otters, the primates' moat) or none. */
    pool: Poly | null;
    /** Indoors (a house): the exhibit behind the glass. */
    indoor: boolean;
    /** Where food appears at feeding time (the keepers' hatch). */
    feeding: Pt;
    enrichment: Array<{what: string; at: Pt}>;
    feedingTimes: number[];
};

export type ZooLayout = {enclosures: ZooEnclosure[]; /** Plots with nothing open on them: landscaped (plan §3.5). */ closed: Array<{id: string; at: Box}>};

/** The enclosures open at launch with no snapshot: each type's first `launch` (the plan's 26). */
export function launchEnclosures(): string[] {
    return ZOO_ENCLOSURE_TYPES.flatMap((type) => Array.from({length: ZOO_TYPES[type].launch}, (_, i) => `${type}-${i + 1}`));
}

/** The open enclosures named in a snapshot's zoo animals (`enclosure`), in name order. */
export function enclosuresIn(animals: ReadonlyArray<{area?: string | null; enclosure?: string | null}>): string[] {
    const names = new Set<string>();
    for (const a of animals) if (a.area === "zoo" && a.enclosure) names.add(a.enclosure);
    return Array.from(names).sort();
}

function parseEnclosure(id: string): {type: ZooEnclosureType; n: number} | null {
    const match = /^([a-z_]+)-([0-9]{1,3})$/.exec(id);
    if (!match || !(ZOO_ENCLOSURE_TYPES as readonly string[]).includes(match[1])) return null;
    return {type: match[1] as ZooEnclosureType, n: Number(match[2])};
}

/**
 * Where each open enclosure is drawn. `<type>-<n>` takes its type's own slot n (the plan's slots are named the
 * server's way); one past its type's slots takes a spare, the lowest numbers first (then the types in order), so an
 * enclosure keeps its spare as others open after it; past the spares it shares its type's last own slot (more
 * residents per enclosure, decision 23). Unknown names are left out. Every other slot and spare is landscaped.
 */
export function zooLayout(open: readonly string[] = launchEnclosures(), plan: TownPlan = townPlan()): ZooLayout {
    const parsed = open.map((id) => ({id, p: parseEnclosure(id)})).filter((x): x is {id: string; p: {type: ZooEnclosureType; n: number}} => x.p !== null);
    const used = new Set<string>();
    const placed: Array<{id: string; type: ZooEnclosureType; n: number; slot: ZooSlot; place: string; shared: boolean}> = [];
    const overflow: typeof parsed = [];
    for (const x of parsed) {
        const own = plan.zoo.slots.find((s) => s.id === x.id);
        if (own) {
            used.add(own.id);
            placed.push({id: x.id, type: x.p.type, n: x.p.n, slot: own, place: own.id, shared: false});
        } else overflow.push(x);
    }
    overflow.sort((a, b) => a.p.n - b.p.n || ZOO_ENCLOSURE_TYPES.indexOf(a.p.type) - ZOO_ENCLOSURE_TYPES.indexOf(b.p.type));
    const spares = plan.zoo.spares.slice();
    for (const x of overflow) {
        const spare = spares.shift();
        if (spare) {
            used.add(spare.id);
            placed.push({id: x.id, type: x.p.type, n: x.p.n, slot: {id: x.id, type: x.p.type, rank: x.p.n - 1, at: spare.at, path: spare.path, seed: hashText(x.id)}, place: spare.id, shared: false});
            continue;
        }
        const own = plan.zoo.slots.filter((s) => s.type === x.p.type).sort((a, b) => b.rank - a.rank)[0];
        if (own) placed.push({id: x.id, type: x.p.type, n: x.p.n, slot: own, place: own.id, shared: true});
    }
    const enclosures = placed.filter((x) => !x.shared).map((x) => enclosureOn(x.id, x.slot, x.place, false));
    for (const x of placed.filter((y) => y.shared)) enclosures.push(enclosureOn(x.id, x.slot, x.place, true));
    const closed = [...plan.zoo.slots.filter((s) => !used.has(s.id)).map((s) => ({id: s.id, at: s.at})), ...plan.zoo.spares.filter((s) => !used.has(s.id)).map((s) => ({id: s.id, at: s.at}))];
    return {enclosures, closed};
}

function enclosureOn(id: string, slot: ZooSlot, place: string, shared: boolean): ZooEnclosure {
    const spec = ZOO_TYPES[slot.type];
    const inner = sub(slot.at, 0, 0, slot.at.w - 0.8, slot.at.d - 0.8);
    const indoor = spec.form === "house";
    const pool = slot.type === "penguin_seal_pools" ? corners(sub(slot.at, -slot.at.w * 0.12, 0.5, slot.at.w * 0.55, slot.at.d * 0.55)) : slot.type === "bears_wolves" || slot.type === "small_mammals" || slot.type === "primate_house" ? corners(sub(slot.at, slot.at.w * 0.28, slot.at.d * 0.22, slot.at.w * 0.28, slot.at.d * 0.26)) : null;
    const feeding = local(slot.at, slot.at.w * 0.3, -slot.at.d / 2 + 1.4);
    const r = rng(hashText(id));
    const enrichment = spec.enrichment.map((what) => ({what, at: local(slot.at, (r() - 0.5) * (slot.at.w - 3), (r() - 0.5) * (slot.at.d - 3))}));
    return {id, slot, place, shared, type: slot.type, mask: corners(inner), capacity: spec.capacity, pool, indoor, feeding, enrichment, feedingTimes: spec.feeding};
}

/** The open enclosures (the launch set by default). */
export function zooEnclosures(plan: TownPlan = townPlan(), open?: readonly string[]): ZooEnclosure[] {
    return zooLayout(open ?? launchEnclosures(), plan).enclosures;
}

/** Which of the plan's own slots are open for these arrived residents per type (decision 23), in opening order. */
export function openZooSlots(arrived: Partial<Record<ZooEnclosureType, number>>, plan: TownPlan = townPlan()): ZooSlot[] {
    const out: ZooSlot[] = [];
    for (const slot of plan.zoo.slots) {
        const spec = ZOO_TYPES[slot.type];
        const residents = arrived[slot.type] ?? 0;
        const open = residents > 0 ? Math.min(spec.slots, Math.max(1, Math.ceil(residents / spec.capacity))) : 0;
        if (slot.rank < open) out.push(slot);
    }
    return out;
}

/** Spots inside each open enclosure: outdoors on the ground, the pool's surface, indoors behind the glass. */
function zooSpots(plan: TownPlan, open?: readonly string[]): TownSpot[] {
    const out: TownSpot[] = [];
    for (const e of zooEnclosures(plan, open)) {
        if (e.shared) continue;
        const count = Math.min(e.capacity, 40);
        const inner = sub(e.slot.at, 0, -0.6, e.slot.at.w - 2.2, e.slot.at.d - 2.6);
        for (const s of spread(inner, count, e.slot.seed)) {
            const inPool = e.pool ? inPoly(e.pool, s.x, s.z) : false;
            out.push({...s, y: y(s.x, s.z), area: "zoo", where: e.indoor ? "indoor" : inPool ? "pool" : "enclosure", place: e.id, sizes: ALL, protected: true});
        }
    }
    return out;
}

// MARK: - All of it

/** The zoo's spots for the open enclosures (the snapshot's names): the enclosures' spots move only when one opens. */
export function zooSpotsFor(open: readonly string[]): TownSpot[] {
    return zooSpots(townPlan(), open);
}

export type TownAreas = {spots: TownSpot[]; households: Household[]; enclosures: ZooEnclosure[]};

let cached: TownAreas | null = null;

export function townAreas(): TownAreas {
    if (cached) return cached;
    const plan = townPlan();
    const buildings = new Map(plan.buildings.map((b) => [b.id, b] as [string, Building]));
    const spots = [...homeSpots(plan, buildings), ...farmSpots(plan), ...wildlifeSpots(plan), ...urbanSpots(plan), ...zooSpots(plan)];
    cached = {spots, households: townHouseholds(plan), enclosures: zooEnclosures(plan)};
    return cached;
}

export {TOWN_HABITATS_BY_ZONE, urbanNiche} from "@/ark-scene/islands/town/niche";

export {inBox};
export type {Parcel};
