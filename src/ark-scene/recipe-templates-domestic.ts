/**
 * The most-seen species' own acts (lane SIG5, decision 424: every species does its own signature behaviour, most-seen
 * first). Each is drawn only on clips the species' live v3 rig has (`docs/ark/rig-player.md` "Mapped"); an act whose
 * clip is missing (a dog's bark, roll, play-bow; a cat's knead) waits for the rigging lane, never a stand-in.
 *
 *   play_run          a burst of play: tearing round in fast loops, then a look round (dog, horse). The run clip.
 *   sniff_trail       nose to the ground along a scent, a few steps at a time (dog). The graze clip (head down), by the
 *                     `eat` block: a `peck`'s 0.45 rad nose-down is added on top of the clip's own and doubles it.
 *   dig_burrow~scrape a cat's scrape in loose soil, covered over (the dug-soil mark). The dig clip.
 *   bask_sun~loaf     a cat loafing in the sun in place of a rest. The lie clip (a bask never sits: `index.ts`).
 *   ground_feed       walking about the grass, head down feeding (budgerigar, tree sparrow). The graze clip, by the
 *                     `eat` block: a `peck` hold's bob reads as a walk's pace on a bird this small, so its walk plays instead.
 *
 * Data only, like the other templates: the engine (`behaviour-recipes.ts`) runs them. Nothing is caught.
 */

import type {Template} from "@/ark-scene/recipe-templates";

const T = (t: Template) => t;

export const DOMESTIC_TEMPLATES: Template[] = [
    // A dog's or a horse's burst of play: four fast legs that swing round, then it stops and looks about.
    T({
        id: "play_run",
        label: "bursts into a play run, tearing round in loops",
        kind: "stay",
        goal: "ground",
        replaces: ["wander", "rest", "watch"],
        doing: "wander",
        hours: "day",
        often: 0.6,
        // (Its loops are the act: a play run swings round on purpose, not counted against the turn budget.)
        airTurns: true,
        steps: [
            {b: "run", to: "ground", near: "here", r: 12, fast: true},
            {b: "run", to: "ground", near: "here", r: 12, fast: true},
            {b: "run", to: "ground", near: "here", r: 10, fast: true},
            {b: "run", to: "ground", near: "here", r: 10, fast: true},
            {b: "scan", s: [1.5, 3]}
        ],
        tail: [{b: "walk", to: "anchor"}]
    }),
    // A dog following a scent: a few steps, nose down, a few more.
    T({
        id: "sniff_trail",
        label: "follows a scent, nose to the ground",
        kind: "stay",
        goal: "ground",
        replaces: ["wander", "forage"],
        doing: "wander",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 3},
            {b: "eat", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 2.5},
            {b: "eat", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 2.5},
            {b: "eat", s: [1, 2.5]}
        ]
    }),
    // A cat's scrape: it digs a hollow in loose soil, looks round, and rakes the soil back over it.
    T({
        id: "dig_burrow~scrape",
        label: "scrapes a hollow in loose soil, then rakes it over",
        kind: "stay",
        goal: "bare",
        replaces: ["wander", "rest", "groom"],
        doing: "wander",
        often: 0.5,
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.5},
            {b: "dig", s: [2, 3.5]},
            {b: "scan", s: [1.5, 3]},
            {b: "dig", s: [1.5, 2.5]}
        ]
    }),
    // A cat loafing in the sun: lying broadside to it for a long while (the plain bask_sun replaces only a bask, which a
    // cat's day never has; this one takes a rest).
    T({
        id: "bask_sun~loaf",
        label: "lies loafing in the sun",
        kind: "stay",
        goal: "here",
        replaces: ["rest", "idle", "watch", "bask"],
        doing: "bask",
        hours: "day",
        often: 0.5,
        steps: [{b: "bask", s: [30, 90], face: "sun"}]
    }),
    // A seed-eater about the grass: a few steps, head down feeding, a few more.
    T({
        id: "ground_feed",
        label: "feeds on the ground among the grass",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "graze"],
        doing: "forage",
        hours: "day",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.2},
            {b: "eat", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 1},
            {b: "eat", s: [1.5, 3]}
        ],
        loop: 0
    })
];
