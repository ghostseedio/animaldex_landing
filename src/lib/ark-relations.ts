/**
 * Who a tapped animal is tied to across the island (lane ARK-RELATION-LINES): the animals that COULD hunt it, the
 * animals it eats, and its possible partners, each nearest first. The page draws a line to the nearest few of each
 * (`ark-scene/relation-lines.ts`) and lists them in the card (`ark-relations.tsx`).
 *
 * Only released, public facts, and never a forecast: a predator here is one that could hunt it by the Ark's rules, never
 * one that will. Pure and client-safe:
 * - the food links are the species' entry of `/api/ark/food-chain` (`lib/ark-food-chain.ts`: the server ecology's own
 *   link test, kept animals and pet kinds already left out at the kind level);
 * - each animal then counts only in its own hunting region (`arkHuntingRegion`, the engine's `islands.ts` regionKey:
 *   its island, then D12's region by zone); a kept animal (house, farm, zoo) neither hunts nor is hunted: fed by keepers;
 * - partners are adults of its kind (A1: breeds count as their kind), of the other sex where the kind keeps sexes, in
 *   the same breeding place (`arkBreedingPlace`).
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {arkHuntingRegion, type ArkFoodChainEntry} from "@/lib/ark-food-chain";
import {arkSpeciesKey} from "@/lib/ark-population";

/**
 * `eggs`: the clutches an egg-eater could take (lines to the nests); `eggThreat`: on a parent sitting a clutch, the
 * egg-eaters that could take it. Both only while the server's `egg_predation` is on (see `arkRelations`).
 */
export type ArkRelationKind = "predator" | "prey" | "partner" | "eggs" | "eggThreat";
export const ARK_RELATION_KINDS: readonly ArkRelationKind[] = ["predator", "prey", "eggs", "eggThreat", "partner"];

/** Each kind's look: colour, dash (in CSS px), and its icon's SVG path in a 16 × 16 box (stroked, or filled). */
export const ARK_RELATION_STYLE: Record<ArkRelationKind, {color: string; dash: number[]; icon: string; fill: boolean}> = {
    // Claw marks: could hunt it.
    predator: {color: "#ff7a45", dash: [], icon: "M4.5 2.5 6.5 13.5M8 2.5l2 11M11.5 2.5l2 11", fill: false},
    // A fork: it eats it.
    prey: {color: "#56b4e9", dash: [9, 6], icon: "M5 2v4.5a3 3 0 0 0 6 0V2M8 2v12", fill: false},
    // A heart: a possible partner.
    partner: {color: "#f0e442", dash: [1.5, 6], icon: "M8 13.6S2.2 10.2 2.2 6a3.1 3.1 0 0 1 5.8-1.5A3.1 3.1 0 0 1 13.8 6c0 4.2-5.8 7.6-5.8 7.6z", fill: true},
    // An egg: a clutch it could take (cream, dash-dot).
    eggs: {color: "#f3e9cf", dash: [7, 4, 1.5, 4], icon: "M8 2c2.6 0 4.6 4 4.6 7a4.6 4.6 0 0 1-9.2 0C3.4 6 5.4 2 8 2z", fill: true},
    // A cracked egg on the hunter's colour: could take its eggs (vermillion, dash-dot).
    eggThreat: {color: "#ff7a45", dash: [7, 4, 1.5, 4], icon: "M8 2c2.6 0 4.6 4 4.6 7a4.6 4.6 0 0 1-9.2 0C3.4 6 5.4 2 8 2zM4.6 9.2l2 1.4 1.8-2 1.8 1.6 1.6-1", fill: false}
};

/** How many lines of each kind are drawn (the nearest); the rest are "+N more" in the card. */
export const ARK_RELATION_LINES_PER_KIND = 4;

type Placed = Pick<ArkAnimal, "area" | "island" | "enclosure">;

/**
 * Where an animal breeds: two adults of a kind breed only in the same place. Today this is the engine's `islands.ts`
 * placeOf exactly: the wild island; the town's houses, its farms, or its wildlife; one zoo enclosure (islands off: the
 * whole Ark, "*").
 *
 * The ONE place the page decides who can mate. Decision 416 moves the engine to "can physically reach each other"
 * (lane ark-home-breeding: the same tank, cage or pen, behind voyage_config container_breeding; lane ark-reachable-mates:
 * a path, connected water, the same enclosure). Neither is released yet, and the public read sends neither a container
 * nor a reach; when it does, it is added here (`container` below) and every caller follows.
 */
export function arkBreedingPlace(animal: Placed & {container?: string | null}, islandsOn: boolean): string {
    if (!islandsOn) return "*";
    if (animal.area === "zoo") return `zoo|${animal.enclosure ?? ""}`;
    if (animal.island === "town") {
        // (Container breeding, when the read sends the container: its own tank, cage, garden or pen.)
        if (animal.container && (animal.area === "house" || animal.area === "farm")) return `town|${animal.area}|${animal.container}`;
        return `town|${animal.area ?? "wild"}`;
    }
    return "wild";
}

/** The islands switch is on when the read names islands (`island` is sent only then). */
export function arkIslandsOn(animals: ReadonlyArray<Pick<ArkAnimal, "island">>): boolean {
    return animals.some((animal) => animal.island === "town" || animal.island === "wild");
}

/** What the scene knows of an animal: where it is now (x, z in metres), and its life stage and sex as drawn. */
export type ArkRelationBody = {x: number; z: number};
export type ArkRelationLife = {adult: boolean; sex: "male" | "female" | null};

/** One end of a line: an animal, or (`at`) a clutch at its nest, whose tap selects the parent sitting it (`id`, when one is). */
export type ArkRelationTarget = {id: string; /** Its kind (A1). */ kind: string; name: string; slug: string; distance: number; at?: {x: number; y: number; z: number}};

/**
 * A clutch the scene draws at its nest (the props' nest sites with eggs in: `ArkSceneHandle.eggSites`): its species, where
 * it is, and the parent sitting it (null: none drawn there).
 */
export type ArkEggSite = {key: string; speciesId: string; x: number; y: number; z: number; sitter: string | null};

export type ArkRelationList = {
    /** Every one, nearest first (the card counts them; the lines take the first few). */
    all: ArkRelationTarget[];
};

export type ArkRelations = {
    predator: ArkRelationList;
    prey: ArkRelationList;
    partner: ArkRelationList;
    eggs: ArkRelationList;
    eggThreat: ArkRelationList;
    /** Kept (a house, a farm, the zoo): fed by its keepers, outside the wild food chain both ways. */
    kept: boolean;
    /** Not grown yet: no partner listed. */
    young: boolean;
};

export type ArkRelationInput = {
    selected: ArkAnimal;
    animals: readonly ArkAnimal[];
    /** The species' food-chain entry (`/api/ark/food-chain`), or null (not read, a placeholder kind): no predators or prey. */
    entry: ArkFoodChainEntry | null;
    /** Where an animal is now; null when the scene has not placed it (left out). */
    bodyOf: (id: string) => ArkRelationBody | null;
    /** Its life stage and sex as the scene draws them; null: unknown (counted adult, any sex). */
    lifeOf: (id: string) => ArkRelationLife | null;
    /**
     * Egg lines (owner 2026-11-20): only while the server's `egg_predation` is on (the public read's `egg_predation`,
     * PROPOSED: lane ark-egg-predation adds the switch). Off or absent: no egg lines at all.
     */
    eggPredation?: boolean;
    /** The clutches drawn now (`eggSites`); absent: none. */
    eggSites?: readonly ArkEggSite[];
};

const kindOf = (animal: ArkAnimal) => arkSpeciesKey(animal).toLowerCase();

/** The relations of one animal: each list nearest first. */
export function arkRelations({selected, animals, entry, bodyOf, lifeOf, eggPredation = false, eggSites = []}: ArkRelationInput): ArkRelations {
    const own = kindOf(selected);
    const region = arkHuntingRegion(selected);
    const kept = region === null;
    const islandsOn = arkIslandsOn(animals);
    const ownLife = lifeOf(selected.id);
    const young = ownLife ? !ownLife.adult : false;
    const place = arkBreedingPlace(selected, islandsOn);

    const predatorKinds = new Set<string>();
    const preyKinds = new Set<string>();
    if (entry && !kept) {
        for (const item of entry.eatenBy) predatorKinds.add(item.predator.id.toLowerCase());
        for (const rule of entry.eats) for (const prey of rule.prey) preyKinds.add(prey.id.toLowerCase());
    }
    predatorKinds.delete(own);
    preyKinds.delete(own);
    // Eggs: which kinds' eggs it eats and which kinds eat its eggs, as the server's egg-eater table says
    // (`entry.eggs`, PROPOSED: ark-egg-predation's egg-eaters.json from the stored diets, through the food-chain read).
    // Never worked out here: no `entry.eggs`, no egg lines.
    const eggs = eggPredation && entry?.eggs && !kept ? entry.eggs : null;
    const eggKinds = new Set((eggs?.eats ?? []).map((s) => s.id.toLowerCase()).filter((id) => id !== own));
    const eggEaters = new Set((eggs?.eatenBy ?? []).map((s) => s.id.toLowerCase()).filter((id) => id !== own));
    const sitting = eggs && eggSites?.some((site) => site.sitter === selected.id) ? true : false;

    const here = bodyOf(selected.id);
    const lists: Record<ArkRelationKind, ArkRelationTarget[]> = {predator: [], prey: [], partner: [], eggs: [], eggThreat: []};
    const byId = new Map<string, ArkAnimal>();
    for (const other of animals) byId.set(other.id, other);
    for (const other of animals) {
        if (other.id === selected.id) continue;
        // (A parent on its clutch: the egg-eaters in its region, beside its own predators.)
        if (sitting && region !== null && eggEaters.has(kindOf(other)) && arkHuntingRegion(other) === region) {
            const body = bodyOf(other.id);
            if (body) lists.eggThreat.push({id: other.id, kind: kindOf(other), name: other.name, slug: other.model_slug, distance: here ? Math.hypot(body.x - here.x, body.z - here.z) : Number.POSITIVE_INFINITY});
        }
        const kind = kindOf(other);
        let as: ArkRelationKind | null = null;
        if (kind === own) {
            if (young || arkBreedingPlace(other, islandsOn) !== place) continue;
            const life = lifeOf(other.id);
            if (life && !life.adult) continue;
            if (ownLife?.sex && life?.sex && ownLife.sex === life.sex) continue;
            as = "partner";
        } else if (region !== null && (predatorKinds.has(kind) || preyKinds.has(kind))) {
            if (arkHuntingRegion(other) !== region) continue;
            as = predatorKinds.has(kind) ? "predator" : "prey";
        }
        if (!as) continue;
        const body = bodyOf(other.id);
        if (!body) continue;
        const distance = here ? Math.hypot(body.x - here.x, body.z - here.z) : Number.POSITIVE_INFINITY;
        lists[as].push({id: other.id, kind, name: other.name, slug: other.model_slug, distance});
    }
    // The clutches it could take: a nest is its sitting parent's place (the engine's rule: the eggs are at the home of
    // the parent that laid them), so a clutch with no parent on it, or a kept one's, is never listed.
    if (eggKinds.size && region !== null) {
        for (const site of eggSites) {
            const parent = site.sitter ? byId.get(site.sitter) : undefined;
            if (!parent || !eggKinds.has(kindOf(parent)) || arkHuntingRegion(parent) !== region) continue;
            const distance = here ? Math.hypot(site.x - here.x, site.z - here.z) : Number.POSITIVE_INFINITY;
            lists.eggs.push({id: parent.id, kind: kindOf(parent), name: parent.name, slug: parent.model_slug, distance, at: {x: site.x, y: site.y, z: site.z}});
        }
    }
    const near = (a: ArkRelationTarget, b: ArkRelationTarget) => a.distance - b.distance || a.id.localeCompare(b.id);
    return {
        predator: {all: lists.predator.sort(near)},
        prey: {all: lists.prey.sort(near)},
        partner: {all: lists.partner.sort(near)},
        eggs: {all: lists.eggs.sort(near)},
        eggThreat: {all: lists.eggThreat.sort(near)},
        kept,
        young
    };
}

/** One kind in the food chain: its icon and name, and how many of it are in the animal's region now (the lines' animals). */
export type ArkFoodChainKind = {id: string; slug: string; name: string; here: number};

export type ArkFoodChainRows = {
    /** The catalogue prey kinds it eats, in its diet's order. */
    eats: ArkFoodChainKind[];
    /**
     * Its background food in plain words (voyage_species_traits.ambient_phrases: "grasses", "plankton"), which feeds most
     * wild animals. PROPOSED: no public read sends it yet (the table is service-role only); until `entry.ambient` is sent
     * the chain shows the catalogue part only.
     */
    ambient: string[];
    /** The predator kinds whose links include it. */
    eatenBy: ArkFoodChainKind[];
};

/** The tapped animal's food chain, by kind (empty both ways for a kept animal: the card says it is fed and safe). */
export function arkFoodChainRows(entry: ArkFoodChainEntry | null, relations: ArkRelations): ArkFoodChainRows {
    if (!entry || relations.kept) return {eats: [], ambient: [], eatenBy: []};
    const count = (list: ArkRelationList) => {
        const n = new Map<string, number>();
        for (const t of list.all) n.set(t.kind, (n.get(t.kind) ?? 0) + 1);
        return n;
    };
    const preyHere = count(relations.prey);
    const predatorsHere = count(relations.predator);
    const eats = new Map<string, ArkFoodChainKind>();
    for (const rule of entry.eats) for (const prey of rule.prey) {
        const id = prey.id.toLowerCase();
        if (!eats.has(id)) eats.set(id, {id, slug: prey.slug, name: prey.name, here: preyHere.get(id) ?? 0});
    }
    const eatenBy = entry.eatenBy.map((item) => ({id: item.predator.id.toLowerCase(), slug: item.predator.slug, name: item.predator.name, here: predatorsHere.get(item.predator.id.toLowerCase()) ?? 0}));
    const ambient = Array.isArray(entry.ambient) ? entry.ambient.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim()) : [];
    // (Those in its region first, then by name.)
    const order = (a: ArkFoodChainKind, b: ArkFoodChainKind) => Number(b.here > 0) - Number(a.here > 0) || a.name.localeCompare(b.name);
    return {eats: Array.from(eats.values()).sort(order), ambient, eatenBy: eatenBy.sort(order)};
}

/** The nearest few of a list (the drawn lines), and how many more there are. */
export function arkRelationShown(list: ArkRelationList, most = ARK_RELATION_LINES_PER_KIND): {shown: ArkRelationTarget[]; more: number} {
    return {shown: list.all.slice(0, most), more: Math.max(0, list.all.length - most)};
}

/** The card's words for the relations (`ark.relations`, 45 languages); English fills any key a bundle lacks. */
export type ArkRelationsWords = {
    title: string;
    predator: string;
    prey: string;
    partner: string;
    /** Egg lines (only while the server's egg_predation is on): the clutches it could take; and, on a parent sitting one, who could take them. */
    eggs: string;
    eggThreat: string;
    /** The food chain: its heading, its two rows, how many are here, and a tap on a kind with none nearby. */
    chain: string;
    eats: string;
    eatenBy: string;
    here: string;
    noneNearby: string;
    noneAboard: string;
    /** A kept animal's chain: fed by its keepers, safe from predators. */
    keptFed: string;
    keptSafe: string;
    more: string;
    lines: string;
    young: string;
    none: string;
    note: string;
};

export const ARK_RELATIONS_ENGLISH: ArkRelationsWords = {
    title: "Around it",
    predator: "Could hunt it",
    prey: "It eats",
    partner: "Possible mates",
    eggs: "Eggs it could take",
    eggThreat: "Could take its eggs",
    chain: "Food chain",
    eats: "Eats",
    eatenBy: "Eaten by",
    here: "{n} here",
    noneNearby: "None nearby",
    noneAboard: "None aboard here",
    keptFed: "Fed by its keepers",
    keptSafe: "Safe from predators",
    more: "+{n} more",
    lines: "Lines",
    young: "Too young to have a mate.",
    none: "Nothing aboard could hunt it, feed it or be its mate here.",
    note: "Who could, by the Ark's rules: never who will."
};

/** The viewer's choice, remembered in this browser only (never sent anywhere); default on. */
export const ARK_RELATION_LINES_KEY = "ark.relationLines";

export function arkRelationLinesOn(): boolean {
    try {
        return window.localStorage.getItem(ARK_RELATION_LINES_KEY) !== "0";
    } catch {
        return true;
    }
}

export function arkSetRelationLinesOn(on: boolean): void {
    try {
        window.localStorage.setItem(ARK_RELATION_LINES_KEY, on ? "1" : "0");
    } catch {
        // (Private window or storage blocked: the choice lasts this visit only.)
    }
}
