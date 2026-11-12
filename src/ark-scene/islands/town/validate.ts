/**
 * The town island's validator (docs/ark/town-island.md): the plan is whole (nothing it asked for left out), nothing
 * overlaps (buildings, enclosures, farms, streets, water, the coast), every zoo enclosure is a closed hard bound with
 * its spots inside, and the places hold their animals: households, farms' outdoor spots, the town wildlife's and urban
 * wildlife's spots and the zoo's capacity, at today's counts, 3× and a year (islands plan §0–§1; the real snapshot's
 * house and farm counts when given). Errors fail; warnings are reported (the zoo past its room: decision 23).
 */

import {boxesOverlap, corners, inPoly, polylineNearest, type Box} from "@/ark-scene/islands/town/geom";
import {CANAL, CANAL_WIDTH, HARBOUR_BASIN, inland, landArea, MILLPOND, townPlan, townPlanMisses, TOWN_HALF, type TownPlan} from "@/ark-scene/islands/town/plan";
import {launchEnclosures, townAreas, zooLayout, type TownArea} from "@/ark-scene/islands/town/areas";
import {ZOO_ENCLOSURE_TYPES, ZOO_LAUNCH_TOTAL, ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";

/** Animals routed to the town island (islands plan §0–§1, 2026-11-12): today, 3× and a year. */
export const TOWN_POPULATION = {
    today: {house: 1063, farm: 149, garden: 528, urban: 199, zoo: 499},
    triple: {house: 3189, farm: 447, garden: 1584, urban: 597, zoo: 1497},
    year: {house: 4024, farm: 500, garden: 1960, urban: 745, zoo: 1087}
} as const;

/** The share of house and farm residents outdoors at once (the approved D10 rotation): at most 20%. */
export const OUTDOOR_SHARE = 0.2;

export type TownValidation = {errors: string[]; warnings: string[]; metrics: Record<string, number | string>};

function sample(b: Box, step = 1.5): Array<{x: number; z: number}> {
    const out: Array<{x: number; z: number}> = [];
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const nx = Math.max(1, Math.ceil(b.w / step));
    const nz = Math.max(1, Math.ceil(b.d / step));
    for (let i = 0; i <= nx; i++) {
        for (let k = 0; k <= nz; k++) {
            const lx = -b.w / 2 + 0.25 + ((b.w - 0.5) * i) / nx;
            const lz = -b.d / 2 + 0.25 + ((b.d - 0.5) * k) / nz;
            out.push({x: b.x + lx * c - lz * s, z: b.z + lx * s + lz * c});
        }
    }
    return out;
}

export function validateTown(plan: TownPlan = townPlan(), real?: {house?: number; farm?: number}): TownValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metrics: Record<string, number | string> = {};

    // The plan is whole.
    for (const miss of townPlanMisses()) errors.push(`plan: not placed: ${miss}`);

    // Counts.
    const count = (kind: string) => plan.buildings.filter((b) => b.kind === kind).length;
    const homes = count("house") + count("terrace") + count("flats");
    const households = plan.buildings.reduce((sum, b) => sum + b.households, 0);
    Object.assign(metrics, {houses: count("house"), terraces: count("terrace"), flats: count("flats"), homes, households, buildings: plan.buildings.length, farms: plan.farms.length, zooSlots: plan.zoo.slots.length, zooLaunch: ZOO_LAUNCH_TOTAL});
    if (homes < 110 || homes > 130) errors.push(`homes: ${homes}, want about 120`);
    if (households !== 360) errors.push(`households: ${households}, want 360`);
    if (plan.farms.length !== 10) errors.push(`farms: ${plan.farms.length}, want 10`);
    if (plan.farms.filter((f) => f.kind === "farmstead").length !== 2) errors.push("farms: want 2 farmsteads and 8 smallholdings");
    const land = landArea(1);
    metrics.landHa = Math.round(land / 100) / 100;
    if (land < 80000 || land > 140000) errors.push(`land: ${(land / 10000).toFixed(2)} ha, outside 8–14 ha`);

    // Nothing overlaps.
    const solids: Array<{id: string; at: Box}> = [...plan.buildings.map((b) => ({id: b.id, at: b.at})), ...plan.zoo.slots.map((s) => ({id: `slot:${s.id}`, at: s.at}))];
    for (let i = 0; i < solids.length; i++) {
        for (let j = i + 1; j < solids.length; j++) {
            const a = solids[i];
            const b = solids[j];
            // A zoo house is its slot's building in the plan only as a slot; farm buildings stand on their farm.
            if (boxesOverlap(a.at, b.at, 0.05)) errors.push(`overlap: ${a.id} × ${b.id}`);
        }
    }
    for (let i = 0; i < plan.farms.length; i++) {
        for (let j = i + 1; j < plan.farms.length; j++) if (boxesOverlap(plan.farms[i].at, plan.farms[j].at, 0.05)) errors.push(`overlap: ${plan.farms[i].id} × ${plan.farms[j].id}`);
        for (const s of plan.zoo.slots) if (boxesOverlap(plan.farms[i].at, s.at, 0.05)) errors.push(`overlap: ${plan.farms[i].id} × ${s.id}`);
    }
    // Buildings and enclosures off the streets, out of the water, on land.
    for (const item of solids) {
        for (const p of sample(item.at, 2)) {
            if (inland(p.x, p.z) < 1.5 && item.id !== "lighthouse") {
                errors.push(`coast: ${item.id} reaches the sea at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
                break;
            }
            const street = plan.streets.find((s) => polylineNearest(s.line, p.x, p.z).distance < s.width / 2 + s.pavement - 0.05);
            if (street) {
                errors.push(`street: ${item.id} stands on ${street.id} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
                break;
            }
            if (polylineNearest(CANAL, p.x, p.z).distance < CANAL_WIDTH / 2 || Math.hypot((p.x - MILLPOND.x) / MILLPOND.rx, (p.z - MILLPOND.z) / MILLPOND.rz) < 1 || (item.id !== "lighthouse" && inPoly(corners(HARBOUR_BASIN), p.x, p.z))) {
                errors.push(`water: ${item.id} stands in the water at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
                break;
            }
        }
    }
    if (Math.abs(TOWN_HALF - 237.6) > 1e-9) errors.push("grid: the town's square is not 9 chunks of 52.8 m");

    // The zoo: 13 types, slot counts as declared, launch openings, masks closed and disjoint, spots inside.
    for (const type of ZOO_ENCLOSURE_TYPES) {
        const n = plan.zoo.slots.filter((s) => s.type === type).length;
        if (n !== ZOO_TYPES[type].slots) errors.push(`zoo: ${type} has ${n} slots, the table says ${ZOO_TYPES[type].slots}`);
        if (ZOO_TYPES[type].launch > n) errors.push(`zoo: ${type} opens ${ZOO_TYPES[type].launch} at launch but has ${n} slots`);
        const ranks = plan.zoo.slots.filter((s) => s.type === type).map((s) => s.rank).sort((a, b) => a - b);
        if (ranks.some((r, i) => r !== i)) errors.push(`zoo: ${type} ranks are not 0…${n - 1}`);
        const spec = ZOO_TYPES[type];
        if (spec.capacity * spec.launch < spec.residents.today) errors.push(`zoo: ${type} at launch holds ${spec.capacity * spec.launch} < ${spec.residents.today} today`);
        if (spec.capacity * n < spec.residents.year) warnings.push(`zoo: ${type} past its room at a year (${spec.residents.year} for ${n} × ${spec.capacity}): more residents per enclosure, no births in full ones (decision 23)`);
    }
    const areas = townAreas();
    // Spares take enclosures a type opens past its own slots; past them, the type's last slot is shared.
    const busy = zooLayout([...launchEnclosures(), "small_mammals-4", "penguin_seal_pools-2", "bears_wolves-4"], plan);
    const onSpares = busy.enclosures.filter((e) => e.place.startsWith("spare-")).length;
    metrics.zooSpares = plan.zoo.spares.length;
    if (onSpares !== Math.min(3, plan.zoo.spares.length)) errors.push(`zoo: ${onSpares} overflow enclosures on spares, want ${Math.min(3, plan.zoo.spares.length)}`);
    for (let i = 0; i < plan.zoo.spares.length; i++) for (const s of [...plan.zoo.slots, ...plan.zoo.spares.slice(i + 1)]) if (boxesOverlap(plan.zoo.spares[i].at, s.at, 0.05)) errors.push(`overlap: ${plan.zoo.spares[i].id} × ${s.id}`);
    for (const e of areas.enclosures) {
        const spots = areas.spots.filter((s) => s.area === "zoo" && s.place === e.id);
        const outside = spots.filter((s) => !inPoly(e.mask, s.x, s.z));
        if (outside.length) errors.push(`zoo: ${outside.length} spots of ${e.id} outside its mask`);
        if (!spots.length) errors.push(`zoo: ${e.id} has no spots`);
    }

    // The places hold their animals.
    const spotsOf = (area: TownArea, filter?: (where: string) => boolean) => areas.spots.filter((s) => s.area === area && (!filter || filter(s.where))).length;
    const houseOutdoor = spotsOf("house", (w) => w !== "window");
    const farmOutdoor = spotsOf("farm");
    const garden = spotsOf("garden_wildlife");
    const urban = spotsOf("urban_wildlife");
    Object.assign(metrics, {houseOutdoorSpots: houseOutdoor, houseWindowSpots: spotsOf("house", (w) => w === "window"), farmOutdoorSpots: farmOutdoor, gardenWildlifeSpots: garden, urbanWildlifeSpots: urban, zooSpots: spotsOf("zoo"), tallPerches: spotsOf("urban_wildlife", (w) => w === "tall")});
    for (const [scale, counts] of Object.entries(TOWN_POPULATION)) {
        if (houseOutdoor < counts.house * OUTDOOR_SHARE * 0.98) (scale === "today" ? errors : warnings).push(`houses: ${houseOutdoor} outdoor spots < ${Math.round(counts.house * OUTDOOR_SHARE)} outdoors at once (${scale})`);
        if (farmOutdoor < counts.farm * 0.5) (scale === "today" ? errors : warnings).push(`farms: ${farmOutdoor} outdoor spots < half the ${counts.farm} farm animals (${scale})`);
        if (garden < counts.garden * 0.5) (scale === "today" ? errors : warnings).push(`garden wildlife: ${garden} spots < half of ${counts.garden} (${scale})`);
        if (urban < counts.urban * 0.5) (scale === "today" ? errors : warnings).push(`urban wildlife: ${urban} spots < half of ${counts.urban} (${scale})`);
    }
    if (real?.house !== undefined) {
        metrics.realHouse = real.house;
        metrics.realPerHousehold = Math.round((real.house / households) * 100) / 100;
        if (real.house * OUTDOOR_SHARE > houseOutdoor) errors.push(`houses: the snapshot's ${real.house} residents need ${Math.round(real.house * OUTDOOR_SHARE)} outdoor spots, have ${houseOutdoor}`);
    }
    if (real?.farm !== undefined) {
        metrics.realFarm = real.farm;
        if (real.farm > farmOutdoor * 2) errors.push(`farms: the snapshot's ${real.farm} residents for ${farmOutdoor} outdoor spots`);
    }
    if ((metrics.tallPerches as number) < 3) errors.push("urban: fewer than 3 tall perches (peregrines)");
    return {errors, warnings, metrics};
}
