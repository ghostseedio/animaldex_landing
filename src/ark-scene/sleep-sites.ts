/**
 * Where an animal sleeps, by its kind (lane ark-sleep, the owner 2026-11-21: "generally animals don't sleep in the open -
 * they find a hiding spot or something"). Its own roost comes first (its stored text's or its profile's: a den, a burrow,
 * a tree); when that finds nothing in reach, the cover its kind sleeps in, in order, from the places the scene already
 * has (`world-sampler.ts` ATTACH_TAGS), before the open ground at its home:
 *
 * - primates: up in a tree (a limb), else a rock or a ledge (baboons sleep on cliffs);
 * - cats, dogs, bears, hyenas (hunters): a cave's mouth or a den, a rock (its foot, the kopje's), the shade under trees
 *   and bushes;
 * - small mammals: a burrow, under a bush, by a log or a rock, in the leaf litter;
 * - birds: a branch, a tree hole, a ledge, a post, a rock, the reeds, the water's edge (a wader on the bank);
 * - reptiles and amphibians: a rock's face or foot, a burrow, a log, the leaf litter, the shade of a bush;
 * - grazers (herds): out in the open is right, clustered with the herd (`behaviour-schedule.ts` groups), near shade if any.
 *
 * Water animals stay in the water (never asked). Pure: from the species' stored rows (`sleep.json`, `behaviours.json`)
 * and its body length, the same for every viewer.
 */

import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {sleepStyle} from "@/ark-scene/sleep";
import type {AttachTag} from "@/ark-scene/world-sampler";

export type SleepSiteKind = "primate" | "hunter" | "small" | "grazer" | "bird" | "reptile" | "other";

const LOW_WATER = new Set(["lizard", "snake", "croc", "turtle", "amphibian"]);

/** Its kind for where it sleeps (see the top). */
export function sleepSiteKind(profile: Pick<ArkBehaviourProfile, "slug" | "move" | "moves" | "diet" | "water">, length: number): SleepSiteKind {
    const style = sleepStyle(profile.slug);
    const postures = [style.posture, ...style.alts];
    if (style.mammal) {
        // (A primate sits hunched asleep and climbs; a wallaby sits too but never climbs.)
        if (postures.includes("sit") && (profile.move === "climb" || profile.moves.includes("climb"))) return "primate";
        if (postures.includes("hang")) return "other";
        if (profile.diet === "meat" || profile.diet === "carrion" || (profile.diet === "omnivore" && length >= 0.9)) return length >= 0.45 ? "hunter" : "small";
        if ((profile.diet === "grazer" || profile.diet === "browser") && length >= 0.7) return "grazer";
        return length < 0.7 ? "small" : "grazer";
    }
    if (postures.includes("tuck") || postures.includes("one_leg")) return "bird";
    if (postures.includes("flat") || (profile.water && LOW_WATER.has(profile.water))) return "reptile";
    return "other";
}

/** The cover its kind sleeps in, best first (none: wherever it is). */
export const SLEEP_COVER: Record<SleepSiteKind, readonly AttachTag[]> = {
    primate: ["branch", "rock_top", "cliff_ledge"],
    hunter: ["cave_mouth", "burrow_entrance", "rock_top", "shade"],
    small: ["burrow_entrance", "shade", "log_top", "rock_top", "leaf_litter"],
    bird: ["branch", "tree_hollow", "cliff_ledge", "post", "rock_top", "reeds", "water_edge"],
    reptile: ["rock_face", "burrow_entrance", "log_top", "rock_top", "leaf_litter", "shade"],
    grazer: ["shade"],
    other: []
};

/** The cover tags for this animal (see `SLEEP_COVER`). */
export function sleepCover(profile: Pick<ArkBehaviourProfile, "slug" | "move" | "moves" | "diet" | "water">, length: number): readonly AttachTag[] {
    return SLEEP_COVER[sleepSiteKind(profile, length)];
}
