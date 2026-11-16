/**
 * The town's wetland (p2 (land), 2026-11-16, the owner: "the area should be inhabitable too by ducks also and maybe pond
 * animals like frogs and fish and insects despite being in the town island"): which of the town's wildlife (the server
 * routes it here: `voyage_route_v1`; this only says where in the town) lives at the millpond, the farm pond and the
 * canal rather than on the lawns, from the species' own stored record:
 *
 * - how it is in the water (`behaviours.json`, from the stored taxonomy and text: `scripts/ark-behaviour-profiles.mts`
 *   waterKindOf): the fish, the bed-dwellers and the water's surface skaters swim in it; the ducks, geese, swans,
 *   grebes, coots, divers, waders and amphibians live at its edge and on it;
 * - or its microhabitat (`microhabitats.json`, a phrase of its stored habitat text): "pond_surface" (dragonflies and
 *   damselflies, newts, pond bugs whose habitat names ponds, lakes, canals).
 *
 * A species of the sea's zones (seashore, reef, open ocean, polar) keeps its own niche (an oystercatcher is a wader of
 * the shore, not of a park pond). Nothing here invents an animal: it only moves those already in the town to the water.
 * Pure: the same for every viewer.
 */

import {behaviourProfile, hasBehaviourProfile, type ArkWaterKind} from "@/ark-scene/behaviour-profile";
import micro from "@/ark-scene/microhabitats.json";
import type {SpotWhere} from "@/ark-scene/islands/town/niche";

/** In the water itself (never on the bank): fish, bed-dwellers, surface skaters. */
const SWIMMERS = new Set<ArkWaterKind>(["fish", "bed", "skater"]);
/** At the water's edge and on it. */
const EDGE = new Set<ArkWaterKind>(["dabbler", "diver", "swan", "goose", "grebe", "coot", "wader", "amphibian"]);
const SEA_ZONES = new Set(["seashore", "coral_reef", "open_ocean", "polar"]);

/** The town's still fresh water, the millpond first (the park's, the biggest). */
export const TOWN_WETLAND: readonly SpotWhere[] = ["millpond", "farm_pond", "canal"];

export type TownWetland = {wheres: readonly SpotWhere[]; /** Its spot must be in the water (not the bank). */ swims: boolean; /** What decided it. */ why: string};

/** Where in the town's wetland a wild species lives, or null (its usual niche). */
export function townWetlandOf(slug: string, zone: string): TownWetland | null {
    if (SEA_ZONES.has(zone)) return null;
    const water = hasBehaviourProfile(slug) ? behaviourProfile(slug).water : null;
    if (water && SWIMMERS.has(water)) return {wheres: TOWN_WETLAND, swims: true, why: `water: ${water}`};
    if (water && EDGE.has(water)) return {wheres: TOWN_WETLAND, swims: false, why: `water: ${water}`};
    // (The table itself, not `micro.ts`: that one brings the wild island's decor and vegetation into the town's worker.)
    const row = (micro as unknown as {species: Record<string, string[]>}).species[slug];
    if (row?.[0] === "pond_surface") return {wheres: TOWN_WETLAND, swims: false, why: row[1]};
    return null;
}
