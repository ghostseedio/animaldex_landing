/**
 * The most-seen species' own acts (lane SIG5, decision 424: every species does its own signature behaviour, most-seen
 * first). Each is drawn only on clips the species' live v3 rig has (`docs/ark/rig-player.md` "Mapped"); an act whose
 * clip is missing (a dog's play-bow) waits for the rigging lane, never a stand-in.
 *
 *   play_run          a burst of play: tearing round in fast loops, then a look round (dog, horse). The run clip.
 *   sniff_trail       nose to the ground along a scent, a few steps at a time (dog). The graze clip (head down), by the
 *                     `eat` block: a `peck`'s 0.45 rad nose-down is added on top of the clip's own and doubles it.
 *   dig_burrow~scrape a cat's scrape in loose soil, covered over (the dug-soil mark). The dig clip.
 *   bask_sun~loaf     a cat loafing in the sun in place of a rest. The lie clip (a bask never sits: `index.ts`).
 *   knead_settle      a cat treading with its forepaws, then settling to rest (Kit34's knead clip).
 *   dig_burrow~hole   a dog digging a hole, a look round, digging on (Kit34's dig clip; the dug-soil mark).
 *   play_run~bow      a dog's play-bow (kit38's display clip), then the play run.
 *   stretch_yawn~cat  a cat's long stretch (kit39c), a yawn, rest.
 *   tail_wave~still   a house gecko still on its wall, its tail waving slowly (kit42).
 *   scratch_feed      a hen raking the ground back with its feet, then pecking (kit36's scratch clip), walking home.
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
    }),
    // A cat treading with its forepaws before it settles (Kit34's knead clip, a loop).
    T({
        id: "knead_settle",
        label: "kneads with its forepaws, then settles down",
        kind: "stay",
        goal: "here",
        replaces: ["rest", "idle"],
        doing: "rest",
        often: 0.5,
        steps: [
            {b: "knead", s: [4, 8]},
            {b: "rest", s: [15, 35]}
        ]
    }),
    // A dog digging a hole: at it hard, a look round, at it again.
    T({
        id: "dig_burrow~hole",
        label: "digs a hole, earth flying",
        kind: "stay",
        goal: "bare",
        replaces: ["wander", "rest", "forage"],
        doing: "wander",
        often: 0.5,
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.5},
            {b: "dig", s: [2.5, 4]},
            {b: "scan", s: [1.5, 2.5]},
            {b: "dig", s: [2, 3]}
        ]
    }),
    // A hen scratching about the yard: feet raking back, then head down at what it turned up; it walks back (a
    // seed-eater flies home; a hen's flap home read as a tumble). Kit36's scratch clip.
    T({
        id: "scratch_feed",
        label: "scratches about the yard, then pecks at what it turned up",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "graze", "wander"],
        doing: "forage",
        hours: "day",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.2},
            {b: "scratch", s: [1.6, 3.2]},
            {b: "eat", s: [1.2, 2.4]},
            {b: "walk", to: "ground", near: "here", r: 1},
            {b: "scratch", s: [1.6, 3.2]},
            {b: "eat", s: [1.2, 2.4]}
        ],
        loop: 0,
        tail: [{b: "walk", to: "anchor"}]
    }),
    // A dog's invitation to play: the play-bow (kit38's display clip: front end down, tail up and wagging), then the run.
    T({
        id: "play_run~bow",
        label: "play-bows, then bursts into a play run",
        kind: "stay",
        goal: "ground",
        replaces: ["wander", "rest", "watch"],
        doing: "wander",
        hours: "day",
        often: 0.6,
        airTurns: true,
        steps: [
            {b: "display", s: [1.5, 3]},
            {b: "run", to: "ground", near: "here", r: 12, fast: true},
            {b: "run", to: "ground", near: "here", r: 12, fast: true},
            {b: "display", s: [1, 2]},
            {b: "run", to: "ground", near: "here", r: 10, fast: true},
            {b: "scan", s: [1.5, 3]}
        ],
        tail: [{b: "walk", to: "anchor"}]
    }),
    // A cat's stretch on waking (kit39c's stretch clip, 3 s once: forepaws out, chest down, rump up), a yawn, then rest.
    T({
        id: "stretch_yawn~cat",
        label: "stretches long, forepaws out, and yawns",
        kind: "stay",
        goal: "here",
        replaces: ["rest", "groom", "watch"],
        doing: "rest",
        steps: [
            {b: "stretch", s: [3, 3.3]},
            {b: "yawn", s: [1, 1.8]},
            {b: "rest", s: [3, 8]}
        ]
    }),
    // A house gecko still on its wall or rock, waving its tail slowly from side to side (kit42's tail_wave clip).
    T({
        id: "tail_wave~still",
        label: "lies still, waving its tail slowly from side to side",
        kind: "stay",
        goal: "here",
        replaces: ["rest", "watch", "idle", "bask"],
        doing: "rest",
        often: 0.6,
        steps: [
            {b: "tail_wave", s: [4, 8]},
            {b: "rest", s: [8, 20]},
            {b: "tail_wave", s: [3, 6]}
        ]
    })
];
