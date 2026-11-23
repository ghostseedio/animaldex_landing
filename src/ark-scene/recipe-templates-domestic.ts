/**
 * The most-seen species' own acts (lane SIG5, decision 424: every species does its own signature behaviour, most-seen
 * first). Each is drawn only on clips the species' live v3 rig has (`docs/ark/rig-player.md` "Mapped"); an act whose
 * clip is missing (a dog's bark, roll, play-bow; a cat's knead) waits for the rigging lane, never a stand-in.
 *
 *   play_run          a burst of play: tearing round in fast loops, then a look round (dog, horse). The run clip.
 *   sniff_trail       nose to the ground along a scent, a few steps at a time (dog). The graze clip (head down).
 *   dig_burrow~scrape a cat's scrape in loose soil, covered over (the dug-soil mark). The dig clip.
 *   perch_watch       watching from a raised spot: a post, a log, a rock top (cat). The scan clip.
 *   rock_climb        up onto a rock top to stand and look out (goat). Walk, scan, call.
 *   butt_play         two of a herd rear and butt heads in play, any sex, any season (goat, sheep). The clash clip.
 *   ground_feed       hopping or walking about the grass, pecking at the grass (budgerigar, tree sparrow). The graze clip.
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
            {b: "peck", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 2.5},
            {b: "peck", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 2.5},
            {b: "peck", s: [1, 2.5]}
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
    // A cat watching from a raised spot (its own text: "observe their surroundings from elevated perches").
    T({
        id: "perch_watch",
        label: "watches from a raised spot",
        kind: "stay",
        goal: "lookout",
        replaces: ["rest", "watch", "wander", "perch"],
        doing: "watch",
        hours: "day",
        steps: [
            {b: "scan", s: [6, 12]},
            {b: "groom", s: [2, 4]},
            {b: "scan", s: [6, 12]}
        ]
    }),
    // A goat up on a rock top, standing and looking out, calling now and then.
    T({
        id: "rock_climb",
        label: "climbs onto a rock to stand and look out",
        kind: "stay",
        goal: "rock",
        replaces: ["rest", "watch", "wander", "bask"],
        doing: "climb",
        hours: "day",
        steps: [
            {b: "scan", s: [4, 8]},
            {b: "call", s: [1, 2]},
            {b: "scan", s: [5, 10]}
        ]
    }),
    // Two of a herd, any sex and any season: a rear and a butt, a look, another butt (play, not a rut's contest).
    T({
        id: "butt_play",
        label: "rears and butts heads in play",
        kind: "pair",
        goal: "here",
        replaces: [],
        doing: "play",
        hours: "day",
        sex: "any",
        steps: [
            {b: "walk", to: "meet_far", face: "other"},
            {b: "rear", s: [0.8, 1.2], face: "other"},
            {b: "clash", to: "meet", face: "other"},
            {b: "scan", s: [1, 2], face: "other"},
            {b: "walk", to: "meet_far", face: "other"},
            {b: "rear", s: [0.8, 1.2], face: "other"},
            {b: "clash", to: "meet", face: "other"},
            {b: "walk", to: "away", role: "b"}
        ]
    }),
    // A seed-eater about the grass: a few hops or steps, pecking at the grass.
    T({
        id: "ground_feed",
        label: "feeds on the ground, pecking at the grass",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "graze"],
        doing: "forage",
        hours: "day",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.2},
            {b: "peck", s: [1.5, 3]},
            {b: "walk", to: "ground", near: "here", r: 1},
            {b: "peck", s: [1.5, 3]}
        ],
        loop: 0
    })
];
