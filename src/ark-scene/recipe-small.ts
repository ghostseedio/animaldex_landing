/**
 * Signature behaviours, wave 2, the small bodies (AnimalDex docs/ark/behaviours-plan.md, decision 367/369): blocks and
 * recipe templates written for the arthropods, the moths and the frogs whose own stored sentence states a behaviour the
 * wave-1 templates show only for another body plan (a box, a dance and a burrow written for a kangaroo, a crane and a
 * badger). Data only, like `recipe-templates.ts` and `behaviour-blocks.ts`, which spread these into their tables.
 *
 * What a small body can show. A hold block's own motion is its attitude (pitch, roll) and its bob (heave): the body
 * stays on the spot. So a front-legs-up dance is a body tipped up and rocked side to side; a boxing match a body tipped up
 * and nodding; the rest is the rig's own clip for the block's state (`rig-player.ts` RECIPE_CLIPS) or the far beat.
 *
 * Imports are types only (this file is read by the two tables it extends).
 */

import type {BlockDef} from "@/ark-scene/behaviour-blocks";
import type {Template} from "@/ark-scene/recipe-templates";

/** Blocks for the small bodies. */
export const SMALL_BLOCKS: BlockDef[] = [
    // A jumping spider's courting dance: the front legs held up and waved, the body rocking from side to side in jerks.
    {id: "leg_wave", label: "raise the front legs and wave them, rocking from side to side", motion: "hold", states: ["dance"], beat: "play", pitch: -0.5, rollWave: 0.32, heave: 0.1, rate: 2.2},
    // Ritualised front-leg boxing (ants at a border): up on the hind legs, nodding into each blow.
    {id: "front_box", label: "rear up and box with the front legs", motion: "hold", states: ["box"], beat: "play", pitch: -0.55, pitchWave: 0.2, rate: 2.6},
    // Claws raised and shoves from side to side (crabs at a burrow's mouth): the dust of the shoving.
    // A moth or a fly hanging in the air in front of a flower, its tongue unrolled: the wings a blur.
    {id: "hover_probe", label: "hang in the air in front of a flower, the tongue unrolled", motion: "hold", states: ["hover"], beat: "fly", aloft: true, pitch: -0.25, heave: 0.03, rate: 3},
    {id: "claw_shove", label: "claws raised, shoving the rival from side to side", motion: "hold", states: ["fight"], beat: "play", pitch: -0.3, rollWave: 0.22, heave: 0.04, rate: 1.5, fx: "dust", fxAt: "during"}
];

const T = (t: Template) => t;

/** Templates for the small bodies. */
export const SMALL_TEMPLATES: Template[] = [
    // Neighbouring ants (or any small ground animals) settling a border with raised front legs: no fight to the death.
    T({
        id: "border_spar",
        label: "two neighbours rear up and box with their front legs at the border",
        kind: "pair",
        goal: "here",
        replaces: [],
        doing: "play",
        sex: "any",
        steps: [
            {b: "walk", to: "meet_far", face: "other"},
            {b: "rear", s: [1, 2], face: "other"},
            {b: "front_box", s: [6, 12], face: "other"},
            {b: "flee", to: "away", role: "b"}
        ]
    }),
    // Crabs at the mouth of a burrow: claws raised, sideways shoves, the neighbour backing off.
    T({
        id: "claw_spar",
        label: "two neighbours raise their claws and shove each other from side to side",
        kind: "pair",
        goal: "here",
        replaces: [],
        doing: "play",
        sex: "any",
        steps: [
            {b: "walk", to: "meet_far", face: "other"},
            {b: "rear", s: [1, 2], face: "other"},
            {b: "claw_shove", s: [5, 9], face: "other"},
            {b: "flee", to: "away", role: "b"}
        ]
    }),
    // A jumping spider's courtship: the one dances with its front legs up, the other watches.
    T({
        id: "spider_dance",
        label: "a jumping spider dances side to side with its front legs raised",
        kind: "pair",
        goal: "here",
        replaces: [],
        doing: "play",
        hours: "day",
        season: "mating",
        sex: "mixed",
        steps: [
            {b: "walk", to: "meet_far", face: "other"},
            {b: "leg_wave", s: [6, 10], face: "other", role: "a"},
            {b: "scan", s: [6, 10], face: "other", role: "b"},
            {b: "leg_wave", s: [3, 6], face: "other", role: "a"},
            {b: "rest", s: [3, 6], face: "other", role: "b"}
        ]
    }),
    // A hornet out on the wing after the other wasps have stopped.
    T({
        id: "night_hawk",
        label: "hawks insects on the wing after dark",
        kind: "stay",
        goal: "air",
        replaces: ["forage", "fly", "wander", "hunt", "soar"],
        doing: "fly",
        hours: "night",
        steps: [
            {b: "fly", to: "air", r: 7},
            {b: "fly", to: "air", r: 4, catch: "insect", p: 0.6, fast: true},
            {b: "fly", to: "air", r: 8},
            {b: "fly", to: "air", r: 4, catch: "insect", p: 0.6, fast: true}
        ],
        loop: 0
    }),
    // A crayfish, a mud crab: its burrow dug into the bank at the water's edge (a seabed walker's ground is the bed).
    T({
        id: "bank_burrow",
        label: "digs a burrow into the bank at the water's edge",
        kind: "stay",
        goal: "edge",
        replaces: ["burrow", "forage", "rest", "hide"],
        doing: "burrow",
        steps: [
            {b: "dig", s: [6, 12]},
            {b: "scan", s: [1, 2]},
            {b: "dig", s: [4, 8]}
        ]
    }),
    // A hawkmoth, a bee-fly: at a flower, in the air, never landing; then on to the next.
    T({
        id: "flower_hover",
        label: "hangs in the air in front of a flower, its tongue unrolled, then swings on to the next",
        kind: "stay",
        goal: "flower",
        replaces: ["visit_flowers", "forage", "fly"],
        doing: "visit_flowers",
        steps: [
            {b: "hover_probe", s: [2.5, 5]},
            {b: "fly", to: "air", r: 2, near: "here"},
            {b: "hover_probe", s: [2, 4.5]}
        ],
        loop: 0
    }),
    // A frog at the water's edge: sits and waits, then snaps at what comes by.
    T({
        id: "edge_ambush",
        label: "sits at the water's edge and waits, then snaps at what comes by",
        kind: "stay",
        goal: "edge",
        replaces: ["forage", "watch"],
        doing: "forage",
        steps: [
            {b: "ambush", s: [8, 18]},
            {b: "strike", s: [0.5, 0.9], catch: "insect", p: 0.6},
            {b: "eat", s: [1, 1.8], if: "caught", eat: true}
        ],
        loop: 0
    }),
    // A toad, a mantis, a bug, a spider: sits still where it is and seizes what comes within reach.
    T({
        id: "sit_snap",
        label: "sits still and waits, then seizes what comes within reach",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "watch"],
        doing: "forage",
        steps: [
            {b: "ambush", s: [8, 18]},
            {b: "strike", s: [0.4, 0.8], catch: "insect", p: 0.6},
            {b: "eat", s: [1, 1.8], if: "caught", eat: true}
        ],
        loop: 0
    })
];
