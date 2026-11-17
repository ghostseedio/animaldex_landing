/**
 * The zoo's new homes (p5 (zoospace)). The owner, 2026-11-17, after the safari: "anywhere else overcrowded?". A census of
 * the real snapshot found the aviaries at 40 birds each in 261 m² (storks, flamingos, vultures, pelicans and hornbills
 * in one flight: six times the zoo's median), the reptile house at 36 (iguanas, tortoises and pythons together), the
 * small mammals' at 16 in 122 m² (a serval with prairie dogs), the nocturnal house at 16, the deer at 18, the primate
 * house at 16, and the aquarium's river tunnel holding arapaima and gar with gourami.
 *
 * Real zoos split those by kind, so does the town, on the plots the safari freed (the two big-cat pens and the savanna
 * paddocks, whose residents went to the safari) and the types' own unopened plots:
 *
 * - **the free-flight dome** (`dome.ts`, on its own lobe of new land; the owner the same day: "add a giant dome for big
 *   aviary and we can move some birds from the smaller aviaries"): the waterbirds but the geese (flamingos, cranes,
 *   ibises, ducks, swans, pelicans: its lagoon), the big kinds that eat no meat or fish (macaws, hornbills, cockatoos,
 *   toucans: its canopy; peafowl, curassows, pheasants: its floor; the mountain kinds its cliff); no bird hunter and
 *   no carrion eater; the small kinds keep the five small aviaries;
 * - **the wetland lagoon** (the second savanna plot): the geese (they graze ashore) on an open lagoon's lawns under a net;
 * - **the raptor row** (the two big-cat plots): long narrow flights, one per size band, the birds of prey by day and
 *   the owls apart; **the vulture aviary and the stork flight** (the third savanna plot);
 * - **the tortoise paddock, the walkabout and the small carnivores' row** (the third hoofstock plot);
 * - **a snake house and a river house** (the third and fourth primate plots): the river giants (arapaima, gar,
 *   sturgeon) in one long tank, the river rays and the piranhas each in their own;
 * - the reptile house's kinds over its three houses (lizards, turtles and amphibians, the large hunters), and the
 *   rest of each crowded type spread over its own plots by species.
 *
 * Who goes where is a rule over each species' stored profile and the food links (`scripts/ark-zoo-homes.mts` writes
 * `zoo-homes.json`), never a list of animals: a hunter of its housemates' kind lives in a hunters' bay of its size band
 * (bands a factor 1.25 apart), so no animal shares an enclosure with a hunter that preys on it and is much bigger.
 * Per animal and pure (its own fields only): the same for every viewer, and the same whether the town's animals are
 * laid out all at once or a few at a time. Client only: the server's enclosure names are untouched.
 */

import {hashText, rng, sub, type Box} from "@/ark-scene/islands/town/geom";
import {ZOO_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import {safariEnclosureOf} from "@/ark-scene/islands/town/safari";
import {DOME_ID} from "@/ark-scene/islands/town/dome";
import table from "@/ark-scene/islands/town/zoo-homes.json";

/** How a new home is dressed (`render/zoo-habitat.ts`, `tanks.ts`): its theme over its type's own build. */
export type ZooAnnexTheme = "wetland" | "raptors" | "owls" | "vultures" | "waders" | "tortoises" | "walkabout" | "carnivores" | "snakes" | "river" | "dome";

export type ZooAnnex = {
    /** The enclosure's name (`<home>-<n>`): what a moved resident's enclosure becomes. */
    id: string;
    /** The server type whose build and spec it takes (barrier, house, feeding times, food). */
    type: ZooEnclosureType;
    theme: ZooAnnexTheme;
    /** The plan slot it is built on (another type's, free since the safari) and its part of it along the path (m from the slot's left end, as drawn from the path). */
    plot: string;
    from: number;
    width: number;
    capacity: number;
    label: string;
};

/** The gap between two homes on one plot (m): each has its own fence or net, never one on the other. */
export const ANNEX_GAP = 0.8;

/**
 * The new homes. Widths: each flight's share of its plot by the birds the real snapshot holds in it today (the band of
 * the hawks and kites, eight birds, the widest), the rest a 3.4 to 5 m flight for one to three birds.
 */
export const ZOO_ANNEXES: readonly ZooAnnex[] = [
    {id: "zoo_wetland-1", type: "aviaries", theme: "wetland", plot: "savanna_paddocks-2", from: 0, width: 27.7, capacity: 60, label: "Wetland lagoon"},
    {id: "zoo_vultures-1", type: "aviaries", theme: "vultures", plot: "savanna_paddocks-3", from: 0, width: 13.4, capacity: 16, label: "Vulture aviary"},
    {id: "zoo_waders-1", type: "aviaries", theme: "waders", plot: "savanna_paddocks-3", from: 14.2, width: 13.5, capacity: 14, label: "Stork and pelican flight"},
    {id: "zoo_raptors-1", type: "aviaries", theme: "raptors", plot: "big_cats-1", from: 0, width: 3.6, capacity: 6, label: "Falcons"},
    {id: "zoo_raptors-2", type: "aviaries", theme: "raptors", plot: "big_cats-1", from: 4.4, width: 8.4, capacity: 12, label: "Hawks and kites"},
    {id: "zoo_raptors-3", type: "aviaries", theme: "raptors", plot: "big_cats-1", from: 13.6, width: 4.4, capacity: 6, label: "Sea eagles"},
    {id: "zoo_raptors-4", type: "aviaries", theme: "raptors", plot: "big_cats-2", from: 0, width: 4.0, capacity: 6, label: "Great eagles"},
    {id: "zoo_owls-1", type: "aviaries", theme: "owls", plot: "big_cats-2", from: 4.8, width: 4.0, capacity: 6, label: "Small owls"},
    {id: "zoo_owls-2", type: "aviaries", theme: "owls", plot: "big_cats-2", from: 9.6, width: 4.0, capacity: 6, label: "Wood owls"},
    {id: "zoo_owls-3", type: "aviaries", theme: "owls", plot: "big_cats-2", from: 14.4, width: 3.6, capacity: 6, label: "Eagle owls"},
    {id: "zoo_tortoises-1", type: "small_mammals", theme: "tortoises", plot: "hoofstock_paddocks-3", from: 0, width: 6.0, capacity: 12, label: "Tortoise paddock"},
    {id: "zoo_walkabout-1", type: "hoofstock_paddocks", theme: "walkabout", plot: "hoofstock_paddocks-3", from: 6.8, width: 7.5, capacity: 12, label: "Walkabout"},
    {id: "zoo_carnivores-1", type: "big_cats", theme: "carnivores", plot: "hoofstock_paddocks-3", from: 15.1, width: 3.4, capacity: 3, label: "Martens"},
    {id: "zoo_carnivores-2", type: "big_cats", theme: "carnivores", plot: "hoofstock_paddocks-3", from: 19.3, width: 3.4, capacity: 3, label: "Fishers"},
    {id: "zoo_carnivores-3", type: "big_cats", theme: "carnivores", plot: "hoofstock_paddocks-3", from: 23.5, width: 3.4, capacity: 3, label: "Wild cats"},
    {id: "zoo_river-1", type: "aquarium", theme: "river", plot: "primate_house-3", from: 0, width: 16.3, capacity: 20, label: "River house"},
    {id: "zoo_snakes-1", type: "reptile_house", theme: "snakes", plot: "primate_house-4", from: 0, width: 16.3, capacity: 20, label: "Snake house"}
];

const BY_ID = new Map(ZOO_ANNEXES.map((a) => [a.id, a] as [string, ZooAnnex]));
/** The plots the new homes are built on (each another type's own slot). */
export const ANNEX_PLOTS: ReadonlySet<string> = new Set(ZOO_ANNEXES.map((a) => a.plot));

export function zooAnnex(id: string | null | undefined): ZooAnnex | null {
    return (id && BY_ID.get(id)) || null;
}

/** A home's ground on its plot's box: its part along the path, the plot's whole depth. */
export function annexBox(annex: ZooAnnex, plot: Box): Box {
    // (Along the path from the plot's left end as seen from the path: local x from −w/2.)
    const width = Math.min(annex.width, plot.w - annex.from);
    return sub(plot, -plot.w / 2 + annex.from + width / 2, 0, width, plot.d);
}

/**
 * The rest of a crowded type spread over its own plots (the server's numbering is its lowest free one: the first plots
 * filled, the last empty, and past its spares an enclosure shares its type's last plot), each species together, the
 * plots weighted by their ground (m²). Which plot a species takes is the table's (`spread` in `zoo-homes.json`: the
 * script balances the record's species over the plots, the most numerous first); a species the table has not seen
 * takes one by its own hash. The plots a new home stands on are left out. A type not listed keeps the server's
 * enclosure.
 */
export const ZOO_SPREAD: Partial<Record<ZooEnclosureType, ReadonlyArray<{id: string; weight: number}>>> = {
    aviaries: [
        // (The small kinds the dome leaves: the zoo's own five aviaries.)
        ...[1, 2, 3, 4, 5].map((n) => ({id: `aviaries-${n}`, weight: 288}))
    ],
    nocturnal_house: [{id: "nocturnal_house-1", weight: 140}, {id: "nocturnal_house-2", weight: 140}],
    primate_house: [{id: "primate_house-1", weight: 383}, {id: "primate_house-2", weight: 383}],
    hoofstock_paddocks: [{id: "hoofstock_paddocks-1", weight: 659}, {id: "hoofstock_paddocks-2", weight: 659}],
    // (Its fourth on the first spare plot, 15 x 24 m, the zoo's overflow order: `areas.ts` zooLayout.)
    small_mammals: [...[1, 2, 3].map((n) => ({id: `small_mammals-${n}`, weight: 140})), {id: "small_mammals-4", weight: 360}],
    // (The savanna's own residents after the safari: the big flightless birds, in the first paddock; its other two plots are new homes.)
    savanna_paddocks: [{id: "savanna_paddocks-1", weight: 1}]
};

const SPREAD_OF = (table as {spread?: Record<string, Partial<Record<ZooEnclosureType, string>>>}).spread ?? {};

/** A species' plot among its type's spread: the table's, else by rendezvous (the same one always). */
export function spreadHome(type: ZooEnclosureType, slug: string): string | null {
    const list = ZOO_SPREAD[type];
    if (!list) return null;
    const known = SPREAD_OF[slug]?.[type];
    if (known && list.some((x) => x.id === known)) return known;
    let best: string | null = null;
    let score = -Infinity;
    for (const {id, weight} of list) {
        // (Weighted rendezvous hashing: the highest ln(u)/w wins, so a plot's share follows its weight. FNV's last
        // characters barely reach its low bits: mixed through `rng` first.)
        const u = rng(hashText(`zoo-spread|${slug}|${id}`))() + 1e-9;
        const s = Math.log(u) / weight;
        if (s > score) {
            score = s;
            best = id;
        }
    }
    return best;
}

const HOMES = (table as {homes: Record<string, Partial<Record<ZooEnclosureType, string>>>}).homes;

/** A hunters' row's bay by size band (`<row>:<band>` in the table). */
function bay(row: string, band: number): string {
    if (row === "raptors") return `zoo_raptors-${band <= 13 ? 1 : band === 14 ? 2 : band === 15 ? 3 : 4}`;
    if (row === "owls") return `zoo_owls-${band <= 13 ? 1 : band === 14 ? 2 : 3}`;
    if (row === "carnivores") return `zoo_carnivores-${band <= 13 ? 1 : band === 14 ? 2 : 3}`;
    return "zoo_waders-1";
}

const NAMED: Record<string, string> = {
    wetland: "zoo_wetland-1",
    vultures: "zoo_vultures-1",
    tortoises: "zoo_tortoises-1",
    walkabout: "zoo_walkabout-1",
    snakes: "zoo_snakes-1",
    river: "zoo_river-1",
    piranhas: "zoo_river-1",
    rays: "zoo_river-1",
    turtles: "reptile_house-2",
    large_reptiles: "reptile_house-3"
};

/** In the river house, which tank: the piranhas' (the fish-eating schoolers), the river rays' or the river giants'. */
export function riverHouseTank(slug: string): "piranhas" | "rays" | "river" {
    const home = HOMES[slug]?.aquarium;
    return home === "piranhas" || home === "rays" ? home : "river";
}

/** In the free-flight dome, its zone by the rule (`dome:<zone>` in the table): the lagoon, the canopy, the floor, the cliff. */
export function domeZoneOf(slug: string): "lagoon" | "canopy" | "floor" | "cliff" | null {
    const home = HOMES[slug]?.aviaries;
    return home?.startsWith("dome:") ? (home.slice(5) as "lagoon" | "canopy" | "floor" | "cliff") : null;
}

type Resident = {model_slug: string; scientific_name?: string | null; enclosure?: string | null; area?: string | null};

/** The server type and number of an enclosure name (`<type>-<n>`). */
function parsed(name: string | null | undefined): {type: ZooEnclosureType; n: number} | null {
    const m = name ? /^([a-z_]+)-([0-9]{1,3})$/.exec(name) : null;
    return m && m[1] in ZOO_TYPES ? {type: m[1] as ZooEnclosureType, n: Number(m[2])} : null;
}

/**
 * A zoo resident's home by the rule, before any plot is found taken: its safari area (`safari.ts`, first), a new home
 * from the table, its type's spread, or the server's enclosure.
 */
export function zooHomeOf(animal: Resident): string | null {
    const safari = safariEnclosureOf(animal);
    if (safari !== (animal.enclosure ?? null)) return safari;
    const server = parsed(animal.enclosure);
    if (!server) return animal.enclosure ?? null;
    const home = HOMES[animal.model_slug]?.[server.type];
    if (home) {
        // (The free-flight dome, `dome.ts`: its zone inside is `domeZoneOf`.)
        if (home.startsWith("dome:")) return DOME_ID;
        const colon = home.indexOf(":");
        if (colon > 0) return bay(home.slice(0, colon), Number(home.slice(colon + 1)));
        if (NAMED[home]) return NAMED[home];
    }
    // (The reptile house's lizards, everyone it has no other home for, stay in its first house.)
    if (server.type === "reptile_house") return "reptile_house-1";
    return spreadHome(server.type, animal.model_slug) ?? animal.enclosure!;
}

/**
 * The plots a new home cannot use: another type's own slot the server's residents still fill (a big cat the safari has
 * no area for stays in its pen: the raptor row on that plot is not built, and its birds keep their aviaries' spread).
 * From the open enclosures' names (the whole snapshot's), or from the residents themselves.
 */
export function takenPlots(open: readonly string[]): Set<string> {
    const out = new Set<string>();
    for (const name of open) if (ANNEX_PLOTS.has(name)) out.add(name);
    return out;
}

/** A zoo resident's enclosure as the town draws it (its home, unless that home's plot is taken). */
export function zooEnclosureOf(animal: Resident, taken: ReadonlySet<string>): string | null {
    const home = zooHomeOf(animal);
    const annex = zooAnnex(home);
    if (!annex || !taken.has(annex.plot)) return home;
    const server = parsed(animal.enclosure);
    // (Its home's plot is taken: its type's spread, never a new home, else the server's.)
    const spread = server ? spreadHome(server.type, animal.model_slug) : null;
    return spread && !zooAnnex(spread) ? spread : animal.enclosure ?? null;
}

/** Every zoo resident's enclosure as the town draws it (a list whose entries change only where one moves). */
export function zooResidents<T extends Resident>(animals: readonly T[], open?: readonly string[]): readonly T[] {
    const taken = takenPlots(open ?? animals.filter((a) => a.area === "zoo").map((a) => zooHomeOf(a) ?? ""));
    let out: T[] | null = null;
    animals.forEach((a, i) => {
        if (a.area !== "zoo") return;
        const e = zooEnclosureOf(a, taken);
        if (e === (a.enclosure ?? null)) return;
        out ??= animals.slice();
        out[i] = {...a, enclosure: e};
    });
    return out ?? animals;
}
