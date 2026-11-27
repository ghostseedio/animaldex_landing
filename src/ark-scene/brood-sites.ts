/**
 * BROODS: where a bird's nest is drawn (AnimalDex docs/ark/broods.md 7; coordinator 2026-11-27: "American Robins nest in
 * trees and shrubs"). The record copies a parent's home slot onto its brood, and a small bird's home is the perch it
 * keeps (a rock's top, a fence post, a branch), which is not where its kind builds. A kind that nests up off the ground
 * (`props/nest-kinds.ts`: a fork low in a tree's crown, the crown's top, a twig tip, a hole in a trunk, a ledge, the eaves)
 * has its nest drawn where it would build, within reach of the parent's home:
 *
 *   1. the pair's own nest as the props already draw it in season (`props/homes.ts`): the brood's eggs go in it;
 *   2. else a site found the way the props find one (`props/nest-sites.ts` `nestSpots`: a branch 1.4 to 7 m up in the
 *      nearest tree for a cup, the highest leaf of a crown for a crow's or a heron's platform, a tree hollow or a bark
 *      point for a hole, the sampler's ledges, a house's eaves);
 *   3. else, for a kind that nests in a fork or at a twig tip, the nearest shrub, half way up its crown (a robin, a
 *      thrush or a finch builds in a shrub as readily as in a tree);
 *   4. else nothing: no nest of such a kind is drawn on the open ground.
 *
 * A kind that nests on the ground or the water keeps its home as its place (`live-broods.ts`). Loaded with the brood
 * layer, only for a brood read that says `on: true`. Deterministic: the same sites for every viewer.
 */

import type {ArkBrood} from "@/lib/ark-broods";
import type {ArkZone} from "@/ark-scene/types";
import type {Placement} from "@/ark-scene/placement";
import {worldDecor} from "@/ark-scene/decor";
import {nestProfile, nestRadius, type NestSite} from "@/ark-scene/props/nest-kinds";
import {nestSites} from "@/ark-scene/props/nest-growth";
import {nestSpots} from "@/ark-scene/props/nest-sites";

/** How far from the parent's home its nest may be (m): a songbird's territory is a few tens of metres across. */
export const BROOD_NEST_REACH = 60;
/** A decor shrub's height at scale 1 (m): `vegetation.ts` shrub(), blobs to about 1.1 m. */
const SHRUB_HEIGHT = 1.1;

const RAISED: ReadonlySet<NestSite> = new Set<NestSite>(["tree_fork", "tree_top", "branch_tip", "trunk_hole", "eaves", "barn", "cliff_ledge", "bank"]);
const SHRUB_OK: ReadonlySet<NestSite> = new Set<NestSite>(["tree_fork", "branch_tip"]);

export type BroodNestSite = {x: number; y: number; z: number; props: boolean; hidden: boolean};

/** Whether a bird kind builds up off the ground (its nest is not at its home's foot). Pure. */
export function nestsRaised(brood: Pick<ArkBrood, "model_slug" | "name" | "zone">): boolean {
    return RAISED.has(nestProfile({model_slug: brood.model_slug, name: brood.name, zone: brood.zone as ArkZone}).site);
}

/**
 * A bird brood's nest site: where its kind builds within reach of `home` (the parent's home), null where it builds up
 * off the ground and nothing in reach will take it, undefined where it nests on the ground or the water. `drawn`: the
 * bird's drawn length (m), for the nest's size. `placeOf`: the scene's placements (the sitter's own).
 */
export function broodNestSite(brood: Pick<ArkBrood, "model_slug" | "name" | "zone" | "kind" | "species_profile_id" | "parents" | "carer">, home: {x: number; z: number}, drawn: number, placeOf: (id: string) => Placement | null): BroodNestSite | null | undefined {
    const zone = brood.zone as ArkZone;
    const profile = nestProfile({model_slug: brood.model_slug, name: brood.name, zone});
    if (!RAISED.has(profile.site)) return undefined;
    // (A hole's, a burrow's and a barn's clutch is inside, out of sight.)
    const hidden = profile.form === "hole" || profile.form === "burrow" || profile.form === "barn";
    const within = (p: {x: number; z: number}) => Math.hypot(p.x - home.x, p.z - home.z) <= BROOD_NEST_REACH;
    const kind = brood.kind || brood.species_profile_id;
    const own = nestSites().find((site) => site.speciesId === kind && site.sitter !== null && brood.parents.includes(site.sitter) && within(site.position));
    if (own) return {x: own.position.x, y: own.position.y, z: own.position.z, props: true, hidden};
    const sitter = brood.carer ?? brood.parents[0] ?? null;
    const radius = nestRadius(profile, Math.max(drawn, 0.05));
    const spot = nestSpots({key: `${kind}|${zone}`, speciesId: kind, slug: brood.model_slug, name: brood.name, zone, profile, sitter, eggs: 0, chicks: 0, season: 1}, radius, placeOf, new Set())[0];
    if (spot && within(spot)) return {x: spot.x, y: spot.y, z: spot.z, props: false, hidden};
    if (SHRUB_OK.has(profile.site)) {
        let best: {x: number; y: number; z: number} | null = null;
        let near = BROOD_NEST_REACH;
        for (const item of worldDecor()) {
            if (item.kind !== "shrub" || !(item.scale > 0.3)) continue;
            const d = Math.hypot(item.x - home.x, item.z - home.z);
            if (d < near) {
                near = d;
                best = {x: item.x, y: item.y + SHRUB_HEIGHT * item.scale * 0.5, z: item.z};
            }
        }
        if (best) return {...best, props: false, hidden: false};
    }
    return null;
}
