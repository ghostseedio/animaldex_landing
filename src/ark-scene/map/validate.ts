/**
 * The automatic spawn validator (the owner's brief, section 7; B4's
 * "every placed species stands on a surface its tags allow"). It places
 * every catalogue species at its spawn points, all aboard at once (each its
 * own cluster, a lone one and a cluster's third member), samples its
 * movement through the behaviour lane's states (`behaviour-state.ts`: asleep
 * at night or by day as its activity says, aloft for a bird of the air) and
 * fails an animal that:
 *
 * - floats above or sinks into the ground, the water or its attach point;
 * - stands inside scenery (a trunk, a rock, a building);
 * - is in the wrong medium (a swimmer on dry ground, a walker in the water);
 * - is in the wrong water depth band for its tag (the reef, the shallows,
 *   the deep), or in fresh water for a sea tag or the other way round
 *   (estuary, mangrove and salt lakes are brackish: either);
 * - is on a surface none of its tags allows;
 * - faces the wrong way on its surface (its back not along the surface's
 *   normal, its heading not along the surface, a clinger facing into a wall
 *   or a trunk);
 * - is small (size ≤ 15) and not on an attach point whose tag its tags allow
 *   and whose size range fits it (the owner, 2026-11-11); a small flyer
 *   with no perch that fits may land on its ground or water instead, and a
 *   flyer never sits in a worm hole or a burrow's entrance;
 * - sleeps (by the behaviour state) where its roost tag does not hold;
 * - walks, crawls, hops or digs where behaviour's walk grid does not let
 *   it walk (the slope; a mountain animal's steeper);
 * - (a partner with its host aboard) is not on its host's back, at its feet
 *   or beside it as its role says, or is in the water beside a host on land.
 *
 * Pure: the same terrain gives the same report. `src/lib/ark-map.test.ts`
 * runs it in CI (`npm test`); `scripts/ark-map-validate.mts` writes the
 * by-species report.
 */

import {canopyPoint, canopyTrees, tunnelPoint} from "@/ark-scene/layers";
import type {DecorItem} from "@/ark-scene/decor";
import {canopyTree, DECOR_SINK, limbAt} from "@/ark-scene/micro-decor";
import {surfacePoint} from "@/ark-scene/micro";
import {behaviourState} from "@/ark-scene/behaviour-state";
import {ARK_FLYERS} from "@/ark-scene/flyers";
import {arborealOf, atRock, CANOPY_LIMB_LOAD, CANOPY_TAGS, climbsTrees, denKindOf, mapPoints, onSchedule, rockHomes, scheduleRoost, shoreOf, wetOf} from "@/ark-scene/map/place";
import {attachFits} from "@/ark-scene/map/sampler";
import {bodyOf, mapSlugs, mapSpecies, mapSpeciesStored, trueMicro} from "@/ark-scene/map/species";
import {FRESH_TAGS, SEA_TAGS, type MapTag} from "@/ark-scene/map/tags";
import {inCoral, onFloor, waterSuits} from "@/ark-scene/map/water";
import {SHORE_REACH} from "@/ark-scene/map/points";
import {inRock} from "@/ark-scene/map/rocks";
import {MAX_SLOPE, MOUNTAIN_SLOPE} from "@/ark-scene/behaviour-nav";
import {depthSeed, safeLoopRadius, speciesDepth, waterLoopRadius, waterMotion} from "@/ark-scene/sea-depth";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {arkBody, arkStats, massFromSize} from "@/ark-scene/stats";
import type {ArkAnimal} from "@/ark-scene/types";
import {sunElevation} from "@/lib/ark-daylight";

export const VALIDATOR_CHECKS = ["floats_or_sinks", "inside_scenery", "wrong_medium", "wrong_depth_band", "wrong_water", "invalid_surface", "wrong_facing", "small_not_on_attach_point", "roost_invalid", "off_walk_grid", "inside_rock"] as const;
export type ValidatorCheck = typeof VALIDATOR_CHECKS[number];
export type ValidatorFailure = {slug: string; check: ValidatorCheck; detail: string; rank: number};

/** The depth bands (m) a sea tag's swimmers keep to (until `ark-sea-depth` brings the owner's bands). */
const DEPTH_BANDS: Partial<Record<MapTag, [number, number]>> = {
    coral_reef: [0.5, 7], cleaner_station: [0.5, 7], anemone: [0.5, 7], seagrass: [0.3, 3.6],
    coastal_shallows: [0.3, 5.2], seabed: [0.6, 10], kelp: [2, 9], open_ocean: [3, 999], attached_to_large: [3, 999],
    sea_surface: [2.5, 999], deep_water: [7.5, 999]
};
const BRACKISH = new Set<MapTag>(["estuary", "mangrove", "salt_lake", "mudflat"]);

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The validator's animals: every listed species, its own cluster (slot = its index in its zone), a lone one and a third member. */
export function validatorAnimals(): ArkAnimal[] {
    const slots = new Map<string, number>();
    const animals: ArkAnimal[] = [];
    for (const slug of mapSlugs()) {
        const stored = mapSpeciesStored(slug);
        if (!stored) continue;
        const slot = slots.get(stored.zone) ?? 0;
        slots.set(stored.zone, slot + 1);
        for (const rank of [0, 2]) {
            animals.push({
                id: `v-${slug}-${rank}`, species_profile_id: `v-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: stored.zone,
                arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Validator", named: false}, mine: false,
                activity: stored.activity, sociality: "group", slot, slot_rank: rank
            });
        }
    }
    return animals;
}

/**
 * A den's problems (as its schedule takes it: `scheduleRoost`): in the sea, its tide or its surf (a rock hyrax's on a
 * boulder in the surf, 2026-11-11); a crevice or cave dweller's away from any rock (a rock face, a ledge or a drawn
 * rock's foot), never a hole on open grass (the golden den_rock's rock hyrax). A water animal's home and den are the
 * water's; a den up a tree is above the surf; a micro animal's crevice is any crack (it is off the schedule); a partner
 * rides its host (a chicken mite); a shore's colony sleeps on its shore's rocks; one whose zone has no dry rock on its
 * ground could not be moved to one.
 */
export function denProblems(animal: ArkAnimal, place: Placement): Array<{check: ValidatorCheck; detail: string}> {
    const out: Array<{check: ValidatorCheck; detail: string}> = [];
    const kind = denKindOf(animal.model_slug);
    if (!kind || place.water || place.canopy || place.hamlet) return out;
    const all = mapPoints();
    const den = scheduleRoost(place, animal.zone);
    if (den && den.y - all.sampler.ground(den.x, den.z).height < 1 && all.inSurf(den.x, den.z)) out.push({check: "roost_invalid", detail: `its ${kind} in the sea's tide or surf at ${den.x.toFixed(1)},${den.z.toFixed(1)}`});
    const species = mapSpecies(animal.model_slug, animal.zone);
    if ((kind === "crevice" || kind === "cave") && species && !place.micro && !place.host && !place.map?.shore && !place.map?.held && onSchedule(place, animal.model_slug)) {
        if ((!den || !atRock(den.x, den.z, den.point)) && rockHomes(species, animal.zone, arkBody(animal).metres).length) out.push({check: "roost_invalid", detail: `its ${kind} den away from any rock${den ? ` at ${den.x.toFixed(1)},${den.z.toFixed(1)}` : ""}`});
    }
    return out;
}

export function validateMap(): {failures: ValidatorFailure[]; animals: number; species: number; placed: Map<string, Placement>} {
    const animals = validatorAnimals();
    const placed = placeAnimals(animals);
    const all = mapPoints();
    const sampler = all.sampler;
    const failures: ValidatorFailure[] = [];
    for (const animal of animals) {
        const place = placed.get(animal.id);
        const rank = animal.slot_rank ?? 0;
        const fail = (check: ValidatorCheck, detail: string) => failures.push({slug: animal.model_slug, check, detail, rank});
        // A body standing in a drawn rock (the asset rocks' own boxes): every place on the ground, the shore or the sea floor, and
        // every roost on the ground; on the rock itself (a ledge, a rock face, a tide pool at its foot) is the rock's surface.
        if (place && !place.hamlet) {
            // A tree is a climber's, a percher's or a flyer's only, and its limb must hold it (a buffalo never on a limb).
            const treePoint = place.perch && ["limb", "canopy_hang", "branch", "bark", "leaf", "tree_hollow"].includes(place.perch.tag) && !(place.perch.tag === "leaf" && (place.perch.y - sampler.ground(place.perch.x, place.perch.z).height) < 0.3);
            if ((place.canopy || treePoint) && !climbsTrees(animal.model_slug) && mapSpecies(animal.model_slug, animal.zone)?.move !== "crawl") failures.push({slug: animal.model_slug, check: "invalid_surface", detail: "in a tree, but it neither climbs, perches nor flies", rank});
            if (place.canopy && massFromSize(arkStats(animal).size) > CANOPY_LIMB_LOAD) failures.push({slug: animal.model_slug, check: "invalid_surface", detail: `${massFromSize(arkStats(animal).size).toFixed(0)} kg on a canopy limb that holds ${CANOPY_LIMB_LOAD}`, rank});
        }
        if (place && !place.canopy && !place.hamlet) {
            const length = arkBody(animal).metres;
            const onRock = place.micro || place.perch;
            const floorAnimal = place.map?.water && speciesDepth(animal.model_slug, animal.zone) && onFloor(speciesDepth(animal.model_slug, animal.zone)!);
            if (!onRock && (!place.water || floorAnimal) && inRock(place.x, place.z, Math.min(Math.max(length * 0.2, 0.05), 0.6), place.ground, Math.max(length * 0.5, 0.05))) {
                failures.push({slug: animal.model_slug, check: "inside_rock", detail: `in a drawn rock at ${place.x.toFixed(1)},${place.z.toFixed(1)}`, rank});
            }
            // A burrow's, a den's or a hole's mouth on the ground, never inside a drawn rock (the fennec fox's).
            const mouth = place.burrow ?? null;
            if (mouth && inRock(mouth.x, mouth.z, 0.15)) failures.push({slug: animal.model_slug, check: "inside_rock", detail: `its burrow's mouth in a drawn rock at ${mouth.x.toFixed(1)},${mouth.z.toFixed(1)}`, rank});
            const hole = place.perch ?? place.micro?.attach ?? null;
            if (hole && (hole.tag === "burrow_entrance" || hole.tag === "worm_hole") && inRock(hole.x, hole.z, Math.min(Math.max(length * 0.2, 0.05), 0.3))) failures.push({slug: animal.model_slug, check: "inside_rock", detail: `at a ${hole.tag} in a drawn rock at ${hole.x.toFixed(1)},${hole.z.toFixed(1)}`, rank});
            for (const problem of denProblems(animal, place)) failures.push({slug: animal.model_slug, ...problem, rank});
            const roost = place.map?.roost;
            if (rank === 0 && roost && (roost.kind === "ground") && inRock(roost.x, roost.z, Math.min(Math.max(length * 0.2, 0.05), 0.6), roost.y, Math.max(length * 0.5, 0.05))) failures.push({slug: animal.model_slug, check: "inside_rock", detail: `its roost in a drawn rock at ${roost.x.toFixed(1)},${roost.z.toFixed(1)}`, rank});
        }
        const species = mapSpecies(animal.model_slug, animal.zone);
        if (!place || !species) continue;
        const map = place.map;
        if (!map || map.held) continue;
        const length = arkBody(animal).metres;
        const allowed = species.allowed;
        if (place.host) {
            // A partner on its host (section 6): on its back, at its feet, or beside it; never inside scenery, the host aboard.
            const host = placed.get(place.host.id);
            if (!host) fail("invalid_surface", "its host is not aboard");
            else {
                if (Math.hypot(place.x - host.x - place.host.dx, place.z - host.z - place.host.dz) > 0.01) fail("floats_or_sinks", "off its host");
                if (place.host.role !== "rider" && !host.water) {
                    const g = sampler.ground(place.x, place.z);
                    if (Math.abs(place.ground - g.height) > 0.05) fail("floats_or_sinks", `beside its host at ${place.ground.toFixed(2)}, the ground at ${g.height.toFixed(2)}`);
                    if (g.water && !wetOf(species, map.tag!)) fail("wrong_medium", "beside its host in the water");
                }
                if (place.host.role === "rider" && host.water !== place.water) fail("wrong_medium", "a rider out of its host's medium");
            }
            continue;
        }
        if (place.burrow && map.attach) {
            // A small burrower: its burrow's entrance on its attach point, the chamber in the ground below.
            const point = map.attach;
            if (!all.tagsOf(point).some((tag) => allowed.has(tag))) fail("invalid_surface", `${point.tag} stands for ${all.tagsOf(point).join(" ")}`);
            if (point.tag === "limb" && (point.load ?? 0) < massFromSize(arkStats(animal).size)) fail("invalid_surface", `a limb that holds ${(point.load ?? 0).toFixed(0)} kg under ${massFromSize(arkStats(animal).size).toFixed(0)} kg`);
            if (point.tag === "canopy_hang" && species.move !== "hang" && bodyOf(animal.model_slug) !== "t") fail("invalid_surface", "on a hang point, but it neither hangs nor is a bat");
            if (!attachFits(point, length)) fail("small_not_on_attach_point", `${length.toFixed(3)} m does not fit ${point.tag}`);
            if (Math.hypot(place.burrow.x - point.x, place.burrow.z - point.z) > 0.01 || Math.abs(place.burrow.ground - point.y) > 0.05) fail("floats_or_sinks", "its burrow's entrance is not its point");
            if (tunnelPoint(place.burrow, 1).y > place.burrow.ground - 0.4) fail("floats_or_sinks", "its burrow's chamber is not underground");
            continue;
        }
        if ((place.micro || place.perch) && map.attach) {
            // A micro animal at its attach point, or a bird, bat or small vertebrate perched on it (its home and roost on the schedule).
            const point = map.attach;
            const tags = all.tagsOf(point);
            // A tree animal on a limb or a hang point: any tree its text names (a bamboo rat's bamboo), a hanger or a leaper any.
            const treeOk = (point.tag === "limb" || point.tag === "canopy_hang") && arborealOf(species, animal.model_slug) && (species.move === "hang" || species.move === "leap" || Array.from(allowed).some((tag) => CANOPY_TAGS.has(tag)));
            if (!treeOk && !tags.some((tag) => allowed.has(tag))) fail("invalid_surface", `${point.tag} at ${point.x.toFixed(1)},${point.z.toFixed(1)} stands for ${tags.join(" ")}`);
            if (point.tag === "limb" && (point.load ?? 0) < massFromSize(arkStats(animal).size)) fail("invalid_surface", `a limb that holds ${(point.load ?? 0).toFixed(0)} kg under ${massFromSize(arkStats(animal).size).toFixed(0)} kg`);
            if (point.tag === "canopy_hang" && species.move !== "hang" && bodyOf(animal.model_slug) !== "t") fail("invalid_surface", "on a hang point, but it neither hangs nor is a bat");
            if (!attachFits(point, length)) fail("small_not_on_attach_point", `${length.toFixed(3)} m does not fit ${point.tag} (${point.size.min}–${point.size.max})`);
            const at = place.perch ?? surfacePoint(place.micro!, animal.zone);
            if (place.micro && !trueMicro(species, animal.model_slug, length)) fail("invalid_surface", `a ${bodyOf(animal.model_slug) ?? "?"} drawn as a micro animal, off the behaviour schedule`);
            if (place.perch && trueMicro(species, animal.model_slug, length)) fail("invalid_surface", "a micro animal perched like a bird");
            if ((species.move === "fly" || species.move === "perch") && (point.tag === "worm_hole" || point.tag === "burrow_entrance")) fail("invalid_surface", `a flyer on a ${point.tag}`);
            // On it: never further off it than its surface allows a crawl (a hole's ground the most).
            if (Math.hypot(at.x - point.x, at.y - point.y, at.z - point.z) > 0.9) fail("floats_or_sinks", `${Math.hypot(at.x - point.x, at.y - point.y, at.z - point.z).toFixed(2)} m off its ${point.tag}`);
            const n = [at.nx, at.ny, at.nz];
            const t = [at.tx, at.ty, at.tz];
            if (Math.abs(Math.hypot(...n) - 1) > 0.02 || Math.abs(dot(n, t)) > 0.05 || dot(n, point.normal) < 0.95) fail("wrong_facing", `normal ${n.map((v) => v.toFixed(2))} heading ${t.map((v) => v.toFixed(2))} on ${point.tag}`);
            continue;
        }
        if (map.water) {
            // A water species, by its depth band (`water.ts`): in its band's water, salt or fresh as it lives, its loop in the water.
            const depth = speciesDepth(animal.model_slug, animal.zone)!;
            const g = sampler.ground(place.x, place.z);
            if (!place.water) fail("wrong_medium", `a ${depth.band} species out of the water`);
            if (!g.water) fail("wrong_medium", `a ${depth.band} species on dry ground at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            else if ((depth.water === "fresh") !== (g.water === "fresh")) fail("wrong_water", `${depth.water} water species in ${g.water} water`);
            if (!waterSuits(sampler, map.water, place.x, place.z)) fail("wrong_depth_band", `${depth.band} (${map.water}) in ${g.depth.toFixed(1)} m of ${g.water ?? "no"} water`);
            if (!map.tag || !g.tags.includes(map.tag) || !(SEA_TAGS.has(map.tag) || FRESH_TAGS.has(map.tag))) fail("invalid_surface", `${map.tag} (not water) at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            if (Math.abs(place.ground - g.height) > 0.05) fail("floats_or_sinks", `its floor at ${place.ground.toFixed(2)}, the ground at ${g.height.toFixed(2)}`);
            // The reef lane's coral heads: a floor animal never inside one (the reef's landmarks, `reef.ts`).
            if (onFloor(depth) && map.water !== "lake" && inCoral(place.x, place.z, 0)) fail("inside_scenery", `on the floor inside a coral head at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            const motion = waterMotion(depth);
            const radius = safeLoopRadius(place.x, place.z, waterLoopRadius(motion, depthSeed(animal.id), length));
            for (let k = 0; k < 8; k++) {
                const a = (k / 8) * Math.PI * 2;
                const floor = sampler.ground(place.x + Math.cos(a) * radius, place.z + Math.sin(a) * radius);
                if (!floor.water || floor.depth < 0.5) {
                    fail("floats_or_sinks", `its loop leaves the water (${radius.toFixed(1)} m round ${place.x.toFixed(1)},${place.z.toFixed(1)})`);
                    break;
                }
            }
            continue;
        }
        if (map.shore) {
            // A diver that hauls out (a penguin, a seal): standing on dry ground by the sea, never floating on it.
            const g = sampler.ground(place.x, place.z);
            if (g.water || place.water) fail("wrong_medium", `a ${map.shore} diver in the water at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            if (Math.abs(place.ground - g.height) > 0.05) fail("floats_or_sinks", `at ${place.ground.toFixed(2)}, the ground at ${g.height.toFixed(2)}`);
            if (sampler.blocked(place.x, place.z, Math.min(Math.max(length * 0.2, 0.1), 0.5))) fail("inside_scenery", `in a rock or building at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            let sea = false;
            for (let k = 0; k < 16 && !sea; k++) for (let r = 1; r <= SHORE_REACH + 2 && !sea; r += 1) sea = sampler.ground(place.x + Math.sin(k * Math.PI / 8) * r, place.z + Math.cos(k * Math.PI / 8) * r).water === "sea";
            if (!sea) fail("invalid_surface", `not by the sea at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
            // On its own shore: the cove's ice for the polar ones, its warm coast for the others (a Galápagos penguin never on the ice).
            if ((shoreOf(animal.model_slug, animal.zone) === "cove") !== (map.shore === "cove")) fail("invalid_surface", `a ${map.shore} diver whose shore is ${shoreOf(animal.model_slug, animal.zone)}`);
            continue;
        }
        // A small flyer with no perch that fits it in reach lands on its ground or its water (section 2: "only at valid perches, the ground or the water").
        if (species.small && species.move !== "fly" && species.move !== "perch" && !["water", "floor", "surface", "fixed", "air", "station", "anemone", "ice"].includes(species.attach)) fail("small_not_on_attach_point", `on ${place.canopy ? "a canopy limb" : "the ground"} (${map.tag})`);
        if (place.canopy) {
            const trees = canopyTrees(place.canopy.zone ?? animal.zone);
            const tree = trees[place.canopy.tree % trees.length].item;
            const point = canopyPoint(animal.zone, place.canopy);
            const anchor = sampler.anchors().find((a) => a.name === "canopy_tree" && a.x === tree.x && a.z === tree.z);
            // (A hanger or a leaper lives on a limb even where its text names only the forest's kind.)
            const limbAnyway = species.move === "hang" || species.move === "leap";
            if (!anchor || !(limbAnyway || anchor.tags.some((tag) => allowed.has(tag)))) fail("invalid_surface", `canopy tree at ${tree.x.toFixed(1)},${tree.z.toFixed(1)}`);
            if (!arborealOf(species, animal.model_slug)) fail("invalid_surface", `on a limb, but it neither climbs, hangs, leaps nor perches in the trees`);
            if (Math.hypot(point.x - tree.x, point.z - tree.z) > 4.5 * tree.scale || point.y < sampler.ground(point.x, point.z).height + 0.5) fail("floats_or_sinks", `off its tree (${point.y.toFixed(2)} m)`);
            if (Math.abs(Math.hypot(point.nx, point.ny, point.nz) - 1) > 0.02 || Math.abs(point.nx * point.tx + point.ny * point.ty + point.nz * point.tz) > 0.05) fail("wrong_facing", "on its limb");
            if (place.canopy.limb >= 0) {
                // Gripping its limb (the owner's sloth): on the drawn limb's own surface, not off it; a hanger under it, a percher on top.
                const off = offLimb(tree, place.canopy.limb, point);
                if (off > 0.02) fail("floats_or_sinks", `${off.toFixed(2)} m off its limb's surface (${place.canopy.mode})`);
                if (place.canopy.mode === "hang" ? point.ny > -0.5 : point.ny < 0.5) fail("wrong_facing", `${place.canopy.mode} with its back ${point.ny > 0 ? "up" : "down"}`);
            }
            continue;
        }
        // The owner's rule: hangers, climbers and perchers of the trees only on a real limb.
        if (arborealOf(species, animal.model_slug) && massFromSize(arkStats(animal).size) <= CANOPY_LIMB_LOAD) fail("invalid_surface", `a ${species.move}er of the trees on the ground (${map.tag})`);
        // On the ground, in the water, on the sea floor, a floe, the surface.
        const ground = sampler.ground(place.x, place.z);
        const tag = map.tag!;
        if (!ground.tags.includes(tag) || !allowed.has(tag)) fail("invalid_surface", `${tag} does not hold at ${place.x.toFixed(1)},${place.z.toFixed(1)} (${ground.tags.join(" ")})`);
        const wetAnimal = wetOf(species, tag);
        if (species.fish && ground.water === null) fail("wrong_medium", `a fish on dry ground (${tag})`);
        if (wetAnimal !== (ground.water !== null)) fail("wrong_medium", `${species.attach} (${species.move}) ${ground.water ? `in ${ground.water} water ${ground.depth.toFixed(1)} m` : "on dry ground"}`);
        if (ground.water) {
            const salt = SEA_TAGS.has(tag);
            const fresh = FRESH_TAGS.has(tag) && !BRACKISH.has(tag);
            if ((salt && ground.water !== "sea") || (fresh && ground.water !== "fresh")) fail("wrong_water", `${tag} in ${ground.water} water`);
            const band = DEPTH_BANDS[tag];
            if (band && species.attach === "water" && (ground.depth < band[0] || ground.depth > band[1])) fail("wrong_depth_band", `${tag} at ${ground.depth.toFixed(1)} m (band ${band[0]}–${band[1]})`);
            if (species.attach === "water" && ground.depth < 0.25) fail("floats_or_sinks", `swims in ${ground.depth.toFixed(2)} m of water`);
        }
        const expected = species.attach === "ice" ? 0.25 : species.attach === "surface" ? 0 : ground.height;
        if (species.attach !== "water" && Math.abs(place.ground - expected) > 0.05) fail("floats_or_sinks", `at ${place.ground.toFixed(2)} m, its surface at ${expected.toFixed(2)} m`);
        if (!ground.water && sampler.blocked(place.x, place.z, Math.min(Math.max(length * 0.2, 0.1), 0.6))) fail("inside_scenery", `in a trunk, rock or building at ${place.x.toFixed(1)},${place.z.toFixed(1)}`);
        // A walker where behaviour's walk grid lets it walk (a farm goat never on a cliff it cannot leave; the mountains' ibex on steep ground).
        const walker = ["walk", "crawl", "slither", "hop", "burrow"].includes(species.move);
        if (!ground.water && walker && sampler.walkable && !sampler.walkable(place.x, place.z, animal.zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE)) fail("off_walk_grid", `${species.move} at ${place.x.toFixed(1)},${place.z.toFixed(1)}, off behaviour's walk grid`);
        if (!Number.isFinite(place.yaw)) fail("wrong_facing", "no heading");
        if (place.burrow) {
            const chamber = tunnelPoint(place.burrow, 1);
            if (chamber.y > place.burrow.ground - 0.4) fail("floats_or_sinks", "its burrow's chamber is not underground");
        }
        // Movement: the behaviour lane's state at midnight and at noon; asleep, it is at its roost.
        if (rank === 0 && map.roost) {
            for (const hour of [0, 12]) {
                const state = behaviourState({activity: animal.activity, elevation: sunElevation(hour), flyer: ARK_FLYERS.has(animal.model_slug)});
                if (!state.asleep) continue;
                const roost = map.roost;
                if (roost.kind === "ground" || roost.kind === "water") {
                    const g = sampler.ground(roost.x, roost.z);
                    if (!g.tags.includes(roost.tag)) fail("roost_invalid", `${roost.tag} does not hold at its roost`);
                    if (roost.kind === "ground" && g.water) fail("roost_invalid", "a ground roost in the water");
                    if (roost.kind === "ground" && sampler.blocked(roost.x, roost.z, 0.2)) fail("inside_scenery", "its roost is inside scenery");
                }
                if (roost.kind === "attach" && roost.attach && !all.tagsOf(roost.attach).includes(roost.tag)) fail("roost_invalid", `${roost.attach.tag} does not stand for ${roost.tag}`);
                if (roost.kind === "burrow" && roost.burrow && tunnelPoint(roost.burrow, 1).y > roost.burrow.ground - 0.4) fail("roost_invalid", "its burrow is not underground");
                break;
            }
        }
    }
    return {failures, animals: animals.length, species: new Set(animals.map((a) => a.model_slug)).size, placed};
}

/**
 * How far a point is from the surface of a canopy tree's limb as drawn
 * (`micro-decor.ts` canopyTree, its item's place, turn and scale): its
 * distance from the limb's axis less the limb's radius there (m).
 */
export function offLimb(item: DecorItem, limbIndex: number, point: {x: number; y: number; z: number}): number {
    const tree = canopyTree(item.variant % 2);
    const limb = tree.limbs[limbIndex % tree.limbs.length];
    const c = Math.cos(item.rotation);
    const s = Math.sin(item.rotation);
    // Into the tree's own metres.
    const wx = (point.x - item.x) / item.scale;
    const wz = (point.z - item.z) / item.scale;
    const local = {x: wx * c - wz * s, y: (point.y - item.y + DECOR_SINK) / item.scale, z: wx * s + wz * c};
    let best = Infinity;
    for (let k = 0; k <= 200; k++) {
        const at = limbAt(limb, tree.base, k / 200);
        best = Math.min(best, Math.abs(Math.hypot(local.x - at.x, local.y - at.y, local.z - at.z) - at.radius));
    }
    return best * item.scale;
}

/** The failures by species: slug -> checks (with the first detail of each). */
export function failuresBySpecies(failures: ValidatorFailure[]): Map<string, Map<ValidatorCheck, string>> {
    const out = new Map<string, Map<ValidatorCheck, string>>();
    for (const failure of failures) {
        const checks = out.get(failure.slug) ?? new Map<ValidatorCheck, string>();
        if (!checks.has(failure.check)) checks.set(failure.check, failure.detail);
        out.set(failure.slug, checks);
    }
    return out;
}
