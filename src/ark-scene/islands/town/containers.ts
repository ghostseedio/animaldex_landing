/**
 * Container breeding (decision 416: pets breed only within one tank, farm animals within one pen, and what you see must
 * match): the container the server stores for a kept animal (`ArkAnimal.container`, AnimalDex migration 20261209130000,
 * sent only for a house or farm animal and only while the server's `container_breeding` switch is on) is the place the
 * town draws it in, and a young one born there is drawn beside its parents.
 *
 * A container is an opaque id of THIS plan, as the web itself drew the animal when the containers were loaded
 * (`scripts/ark-containers-truth.mts`), or as the engine inherited it for a young one from its parents':
 *   `house-3#0:tank`      a home's display: its tank, cage, vivarium or garden pond (`tanks.ts` homeSites)
 *   `house-40#0~room`     a home's glass garden room; `tower-3~f10l` a tower apartment (`home-rooms.ts`)
 *   `house-3#0`           a home's garden, yard, balcony or courtyard (a household of `areas.ts`)
 *   `smallholding-2`      a farm's plot (its paddock, run and yard are one container)
 *   `rural-sheep-fold`    a countryside field (`rural.ts` RURAL_PENS)
 * An id this plan does not know (the plan changed since, or the server's own first guess) resolves to nothing: the animal
 * is placed as before, from a hash of its id, so with no stored container nothing moves.
 *
 * Pure in the plan: the same for every viewer.
 */

import {townHouseholds, type Household} from "@/ark-scene/islands/town/areas";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {homeSites, type HomeDisplay} from "@/ark-scene/islands/town/tanks";
import {gardenRoomOf, towerApartments, type HomeRoom} from "@/ark-scene/islands/town/home-rooms";
import {RURAL_PENS, type RuralPen} from "@/ark-scene/islands/town/rural";

/** What a stored container names. */
export type Container =
    /** A home's tank, cage, vivarium or garden pond. */
    | {kind: "display"; home: Household; display: HomeDisplay}
    /** A home's garden room (its household) or a tower apartment (no household). */
    | {kind: "room"; home: Household | null; room: HomeRoom}
    /** A home's own ground: its garden, yard, balcony or courtyard (and, for a pet kept in a display, the home it is kept at). */
    | {kind: "home"; home: Household}
    /** A farm's plot. */
    | {kind: "farm"; farm: string}
    /** A countryside field. */
    | {kind: "field"; field: RuralPen};

type Tables = {
    homes: Map<string, Household>;
    displays: Map<string, {home: Household; display: HomeDisplay}>;
    rooms: Map<string, {home: Household | null; room: HomeRoom}>;
    farms: Set<string>;
    fields: Map<string, RuralPen>;
    memo: Map<string, Container | null>;
};

let tables: {plan: TownPlan; t: Tables} | null = null;

function tablesFor(): Tables {
    const plan = townPlan();
    if (tables && tables.plan === plan) return tables.t;
    const households = townHouseholds(plan);
    const homes = new Map(households.map((h) => [h.id, h] as [string, Household]));
    const displays = new Map<string, {home: Household; display: HomeDisplay}>();
    const rooms = new Map<string, {home: Household | null; room: HomeRoom}>();
    const sites = homeSites(households, plan);
    for (const h of households) {
        const site = sites.get(h.id);
        if (!site) continue;
        for (const d of [site.displays.tank, site.displays.cage, site.displays.vivarium, site.displays.pond]) if (d) displays.set(d.id, {home: h, display: d});
        const room = gardenRoomOf(site, h.kind);
        if (room) rooms.set(room.id, {home: h, room});
    }
    for (const a of towerApartments(plan)) rooms.set(a.id, {home: null, room: a});
    const t: Tables = {homes, displays, rooms, farms: new Set(plan.farms.map((f) => f.id)), fields: new Map(RURAL_PENS.map((p) => [p.id, p] as [string, RuralPen])), memo: new Map()};
    tables = {plan, t};
    return t;
}

/** What a container id names in this plan, or null (none stored, or an id the plan does not know). */
export function resolveContainer(id: string | null | undefined): Container | null {
    if (!id || id.length > 80) return null;
    const t = tablesFor();
    const memo = t.memo.get(id);
    if (memo !== undefined) return memo;
    let found: Container | null = null;
    const field = t.fields.get(id);
    const display = t.displays.get(id);
    const room = t.rooms.get(id);
    const home = t.homes.get(id);
    if (field) found = {kind: "field", field};
    else if (display) found = {kind: "display", home: display.home, display: display.display};
    else if (room) found = {kind: "room", home: room.home, room: room.room};
    else if (home) found = {kind: "home", home};
    else if (t.farms.has(id)) found = {kind: "farm", farm: id};
    t.memo.set(id, found);
    return found;
}

/** A town animal's stored container, for a house or farm animal only (the zoo's and the wild's have none). */
export function storedContainer(animal: {container?: string | null; area?: string | null}): Container | null {
    if (!animal.container || (animal.area !== "house" && animal.area !== "farm")) return null;
    return resolveContainer(animal.container);
}

/**
 * The container an animal is DRAWN in, in the words the server stores: its display's id, its room's id, else the home, farm
 * plot or field it stands in (`TownPlace.place`). What `scripts/ark-containers-truth.mts` loads, and what the tests compare
 * with the stored one.
 */
export function drawnContainer(info: {place: string; display?: {id: string}; room?: {room: {id: string}}}): string {
    return info.display?.id ?? info.room?.room.id ?? info.place;
}
