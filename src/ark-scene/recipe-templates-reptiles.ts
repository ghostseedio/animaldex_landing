/**
 * Reptile and turtle variants of recipe templates (signature behaviours, lane SIG2-REPTILES; AnimalDex
 * docs/ark/signature-behaviours.json, decisions 367 and 369). A signature row names the recipe that shows its behaviour,
 * but several of those recipes are written for another body: a pounce is a four-legged hunter's mousing leap, a wallow
 * a pig's roll in the mud, a beach nest a sea turtle's night haul-out. Where the same behaviour needs another body's
 * way of doing it, the variant is its own template here, named `<recipe>~<variant>` (the plain recipe's card activity
 * and log kind still apply, `arkRecipeActivity`), and `scripts/ark-reptile-signatures.mts` gives it to exactly the
 * species whose own text says so.
 *
 *   pounce~lizard        a lizard's sit-and-wait: motionless, a short dash, a snap (not a leap)
 *   dig_burrow~nest      a female tortoise's nest pit in the soil: dig, lay, fill in
 *   wallow~turtle        a tortoise's settling into mud or damp litter (it cannot roll in it)
 *   probe_feed~turtle    a hawksbill's beak into a reef's crevices
 *   probe_feed~lizard    a skink's nose through the leaf litter, its body flat (SIG3)
 *   beach_nest~bank      a crocodilian's or a stream lizard's nest hole in a sandy bank (any hour, on foot)
 *   incubate_sit~reptile a reptile's guarding of its nest (no props' nest is drawn for a reptile: its mound is its own)
 *
 * Data only, like the other templates: the engine (`behaviour-recipes.ts`) runs them.
 */

import type {Template} from "@/ark-scene/recipe-templates";

const T = (t: Template) => t;

/** A variant's plain recipe (`pounce~lizard` → `pounce`): what the card's activity and the marks' kinds read. */
export function recipeBase(id: string): string {
    const at = id.indexOf("~");
    return at < 0 ? id : id.slice(0, at);
}

export const REPTILE_TEMPLATES: Template[] = [
    // A sit-and-wait hunter's attack: still, watching; a short rapid dash at the insect that comes, a snap.
    T({
        id: "pounce~lizard",
        label: "waits motionless, then dashes at an insect and snaps it up",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "wander", "bask", "rest", "watch"],
        doing: "forage",
        hours: "day",
        steps: [
            {b: "freeze", s: [6, 14]},
            {b: "scan", s: [1, 2]},
            {b: "run", to: "ground", near: "here", r: 0.9, fast: true},
            {b: "strike", s: [0.4, 0.7], catch: "insect", p: 0.65},
            {b: "eat", s: [0.8, 1.4], if: "caught", eat: true}
        ],
        loop: 0
    }),
    // A female tortoise's nest in the soil: she digs the pit, lowers herself over it to lay, fills it in.
    T({
        id: "dig_burrow~nest",
        label: "digs a nest pit in the soil, lays and fills it in",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "rest", "wander", "burrow", "graze"],
        doing: "burrow",
        hours: "day",
        season: "nesting",
        unstored: 0.3,
        sex: "female",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 2.5},
            {b: "dig", s: [12, 20]},
            {b: "incubate", s: [6, 10]},
            {b: "dig", s: [8, 14]}
        ]
    }),
    // A tortoise in the mud: it walks in and settles, only its shell showing.
    T({
        id: "wallow~turtle",
        label: "settles into mud or damp litter, its shell half sunk",
        kind: "stay",
        goal: "edge",
        replaces: ["groom", "rest", "drink", "hide"],
        doing: "rest",
        hours: "day",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.2},
            {b: "bury", s: [30, 55]}
        ]
    }),
    // A skink foraging through the leaf litter: a few steps, its nose in the litter, on a little, again (its body flat).
    T({
        id: "probe_feed~lizard",
        label: "noses through the leaf litter for food, its body flat on the ground",
        kind: "stay",
        goal: "ground",
        replaces: ["forage", "graze", "wander"],
        doing: "forage",
        steps: [
            {b: "walk", to: "ground", near: "here", r: 1.5},
            {b: "nose_litter", s: [2, 4]},
            {b: "walk", to: "ground", near: "here", r: 0.8},
            {b: "nose_litter", s: [1.5, 3]}
        ],
        loop: 0
    }),
    // A hawksbill at the reef: down to it, its narrow beak into a crevice, on to the next.
    T({
        id: "probe_feed~turtle",
        label: "dives to the reef and probes its crevices with its narrow beak",
        kind: "stay",
        goal: "water",
        replaces: ["forage", "swim", "dive", "wander"],
        doing: "forage",
        steps: [
            {b: "swim", to: "water", r: 5},
            {b: "dive", to: "prey"},
            {b: "probe_reef", s: [3, 6]},
            {b: "swim", to: "prey", near: "here", r: 1.5},
            {b: "probe_reef", s: [3, 5]},
            {b: "surface", to: "water", near: "here", r: 2}
        ],
        tail: [{b: "swim", to: "anchor"}]
    }),
    // A crocodilian's (or a stream lizard's) nest hole in a sandy bank: on foot, by day or night, in her season.
    T({
        id: "beach_nest~bank",
        label: "comes ashore, digs a nest hole in the bank, lays and covers it",
        kind: "stay",
        goal: "edge",
        replaces: ["rest", "swim", "forage", "bask", "wander"],
        doing: "burrow",
        season: "nesting",
        sex: "female",
        steps: [
            {b: "crawl", to: "beach", r: 5},
            {b: "dig", s: [14, 24]},
            {b: "incubate", s: [6, 12]},
            {b: "dig", s: [8, 14]},
            {b: "crawl", to: "edge"}
        ]
    }),
    // A reptile guarding its nest: she heaps and tidies it, lies over it, lifts her head to look about, lies down again.
    T({
        id: "incubate_sit~reptile",
        label: "guards her nest, lying over it",
        kind: "stay",
        goal: "nest",
        replaces: ["rest", "bask", "watch", "wander", "forage", "idle"],
        doing: "rest",
        season: "nesting",
        unstored: 0.3,
        sex: "female",
        steps: [
            {b: "scan", s: [1.5, 3]},
            {b: "mound_up", s: [4, 7]},
            {b: "incubate", s: [14, 24]},
            {b: "scan", s: [2, 3.5]},
            {b: "incubate", s: [10, 18]}
        ]
    })
];
