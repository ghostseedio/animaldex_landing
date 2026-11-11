/**
 * Recipe templates (rich-behaviours brief §3): each a sequence of building
 * blocks (`behaviour-blocks.ts`) with targets, timings, catches and carried
 * things, plus when it may run. Data only: the engine (`behaviour-recipes.ts`)
 * runs them, and each species' row in `recipes.json` (generated from stored
 * text by `scripts/ark-behaviour-recipes.mts`) says which templates it has,
 * with what weight and parameters. The generator and the tests check that
 * every step uses a block the engine has.
 *
 * Behaviour-only catches are only ever AMBIENT creatures (`PreyKind`): decorative fish, insects, worms, shellfish
 * and nuts that are not catalogue animals. A catalogue animal only disappears through a server meal event (`acts.ts`).
 */

/**
 * Where a step goes:
 * - anchor: where the episode began (the last step's anchor blends back into its schedule pose);
 * - here: where it is now;
 * - water: open water near the anchor (a dive's target, just under the surface);
 * - over_water: above that water, `h` metres up;
 * - shallows: wadeable water near the anchor (or near where it is, `near: "here"`);
 * - edge: the water's edge nearest the anchor;
 * - ground: walkable ground within `r` metres;
 * - air: a point in the air within `r` metres, at about the anchor's height;
 * - up: `h` metres above where it is;
 * - prey: an ambient school's or swarm's point near the water target (the school runs from it);
 * - nest: its nest site; material: a ground spot near the nest to pick material from;
 * - beach: dry sand a few metres inland of the edge;
 * - meet, meet_far, meet_side: a pair's meeting point (touching; a few body lengths apart; side by side);
 * - away: back off from the other in a pair.
 */
export type Target = "anchor" | "here" | "water" | "over_water" | "shallows" | "edge" | "ground" | "air" | "up" | "prey" | "nest" | "material" | "beach" | "meet" | "meet_far" | "meet_side" | "away";

/** Ambient prey only (never a catalogue animal). */
export type PreyKind = "fish" | "insect" | "worm" | "shellfish" | "nut" | "seed";
export type CarryAt = "beak" | "mouth" | "feet" | "back" | "chest";

export type TemplateStep = {
    b: string;
    /** Seconds (a hold's length; a travel's bounds round its distance at its own pace). */
    s?: [number, number];
    to?: Target;
    /** Metres up (over_water, up) or out (ground, air, shallows, material). */
    h?: number;
    r?: number;
    /** Targets near "here" rather than the anchor. */
    near?: "here";
    /** A catch attempt: what (ambient) and the chance it comes off. */
    catch?: PreyKind;
    p?: number;
    /** It picks up material for its nest, a nut, a stick or a stone (carried until it places it or eats). */
    pick?: "material" | "nut" | "stick" | "stone";
    carry?: CarryAt;
    /** Puts down what it carries. */
    drop?: boolean;
    /** Eats what it caught. */
    eat?: boolean;
    /** Faces: the water, the sun, the other in a pair, the way it was going. */
    face?: "water" | "sun" | "other" | "away";
    /** Only if it caught something; only for species that hover; only in a pair's role ("a": the dominant or the male). */
    if?: "caught" | "hovers";
    role?: "a" | "b";
};

export type Goal = "perch_water" | "perch" | "edge" | "water" | "ground" | "bare" | "bark" | "rock" | "nest" | "air" | "here";

export type Template = {
    id: string;
    label: string;
    /** stay: a goal chosen for it (or its stay where it is); pair: two animals meet; flock: its group together (or ambient flock-mates); mark: a trace it leaves (molehills), no steps. */
    kind: "stay" | "pair" | "flock" | "mark";
    /** Where the schedule sends it for this (stay templates); "here": no goal, it runs in a stay where it already is. */
    goal: Goal;
    /** The schedule behaviours (or doings) it may stand in for. */
    replaces: string[];
    /** The doing it shows as (the tap card's, its group's). */
    doing: string;
    hours?: "day" | "night" | "dawn_dusk" | "dusk" | "any";
    /** Only in its mating or nesting season (where the data has one). */
    season?: "mating" | "nesting";
    /** Only males (a display), or the pair's sexes (pair templates: "males" both male, "mixed" a male and a female, "any"). */
    sex?: "male" | "males" | "mixed" | "any";
    steps: TemplateStep[];
    /** Steps from this index repeat while time allows. */
    loop?: number;
    /** After the loop: the way back (then the engine blends into its schedule pose). */
    tail?: TemplateStep[];
};

const T = (t: Template) => t;

export const TEMPLATES: Record<string, Template> = Object.fromEntries(
    [
        // MARK: Fishing
        T({
            id: "perch_plunge",
            label: "plunge-dives from a perch for fish",
            kind: "stay",
            goal: "perch_water",
            replaces: ["forage", "perch", "fly", "wander", "hunt"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "perch", s: [6, 16], face: "water"},
                {b: "scan", s: [1.5, 3], face: "water"},
                {b: "take_off", to: "up", h: 0.6},
                {b: "dive_air", to: "water", catch: "fish", p: 0.55},
                {b: "surface", to: "here", s: [0.3, 0.6]},
                {b: "take_off", to: "up", h: 0.8, carry: "beak"},
                {b: "fly", to: "anchor"},
                {b: "beat_prey", s: [1.5, 2.6], if: "caught"},
                {b: "eat", s: [1, 1.6], if: "caught", eat: true}
            ],
            loop: 0
        }),
        T({
            id: "air_plunge",
            label: "plunge-dives from the air (terns, gannets, boobies, the brown pelican)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "fly", "soar", "swim", "wander"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "take_off", to: "up", h: 1.5},
                {b: "fly", to: "over_water", h: 6},
                {b: "hover", s: [0.8, 2.4], if: "hovers"},
                {b: "dive_air", to: "water", catch: "fish", p: 0.5},
                {b: "surface", to: "here", s: [0.4, 0.8]},
                {b: "eat", s: [1, 2], if: "caught", eat: true}
            ],
            loop: 0,
            tail: [{b: "swim", to: "anchor"}]
        }),
        T({
            id: "talon_grab",
            label: "snatches fish feet-first (the osprey, fish eagles)",
            kind: "stay",
            goal: "perch_water",
            replaces: ["forage", "perch", "fly", "soar", "hunt"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "perch", s: [4, 9], face: "water"},
                {b: "take_off", to: "up", h: 1.2},
                {b: "fly", to: "over_water", h: 7},
                {b: "hover", s: [1, 3], if: "hovers"},
                {b: "dive_feet", to: "water", catch: "fish", p: 0.6},
                {b: "take_off", to: "up", h: 1.4, carry: "feet"},
                {b: "fly", to: "anchor"},
                {b: "eat", s: [3, 6], if: "caught", eat: true}
            ]
        }),
        T({
            id: "wade_spear",
            label: "wades and spears fish (herons, egrets, storks)",
            kind: "stay",
            goal: "edge",
            replaces: ["forage", "drink", "wander", "hunt"],
            doing: "forage",
            steps: [
                {b: "wade", to: "shallows"},
                {b: "ambush", s: [4, 12], face: "water"},
                {b: "strike", s: [0.5, 0.8], catch: "fish", p: 0.45, carry: "beak"},
                {b: "eat", s: [1, 2], if: "caught", eat: true},
                {b: "wade", to: "shallows", near: "here", r: 1.5}
            ],
            loop: 1,
            tail: [{b: "wade", to: "anchor"}]
        }),
        T({
            id: "bill_sweep",
            label: "sweeps its bill through the shallows (spoonbills, avocets, flamingos)",
            kind: "stay",
            goal: "edge",
            replaces: ["forage", "drink", "wander"],
            doing: "forage",
            steps: [
                {b: "wade", to: "shallows"},
                {b: "sweep", s: [3, 7]},
                {b: "wade", to: "shallows", near: "here", r: 1}
            ],
            loop: 1,
            tail: [{b: "wade", to: "anchor"}]
        }),
        T({
            id: "pouch_scoop",
            label: "scoops fish with its pouch (pelicans)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "swim", "fly"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "swim", to: "water", r: 4},
                {b: "scan", s: [2, 4], face: "water"},
                {b: "scoop", s: [1.2, 2], catch: "fish", p: 0.6},
                {b: "eat", s: [1.5, 2.5], if: "caught", eat: true}
            ],
            loop: 1,
            tail: [{b: "swim", to: "anchor"}]
        }),
        T({
            id: "dabble",
            label: "dabbles and up-ends (ducks, swans)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "swim", "graze"],
            doing: "forage",
            steps: [
                {b: "swim", to: "water", r: 3},
                {b: "upend", s: [2, 5]},
                {b: "swim", to: "water", near: "here", r: 1.2}
            ],
            loop: 1,
            tail: [{b: "swim", to: "anchor"}]
        }),
        T({
            id: "surface_dive",
            label: "dives from the surface for fish (grebes, cormorants, loons)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "swim", "dive"],
            doing: "forage",
            steps: [
                {b: "swim", to: "water", r: 4},
                {b: "dive", to: "prey", catch: "fish", p: 0.5},
                {b: "surface", to: "water", near: "here", r: 2},
                {b: "eat", s: [1, 2], if: "caught", eat: true},
                {b: "swim", s: [2, 5], to: "water", near: "here", r: 2}
            ],
            loop: 1,
            tail: [{b: "swim", to: "anchor"}]
        }),
        T({
            id: "chase_fish",
            label: "chases fish underwater (penguins, seals, otters, dolphins)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "swim", "dive", "hunt", "wander"],
            doing: "forage",
            steps: [
                {b: "dive", to: "prey"},
                {b: "swim", to: "prey", r: 4},
                {b: "strike", s: [0.4, 0.7], catch: "fish", p: 0.5, carry: "mouth"},
                {b: "swim", to: "prey", r: 4},
                {b: "strike", s: [0.4, 0.7], catch: "fish", p: 0.5, carry: "mouth"},
                {b: "surface", to: "water", near: "here", r: 2},
                {b: "eat", s: [1.5, 3], if: "caught", eat: true}
            ],
            loop: 0,
            tail: [{b: "swim", to: "anchor"}]
        }),
        T({
            id: "river_fish",
            label: "fishes at the river (bears, the fishing cat)",
            kind: "stay",
            goal: "edge",
            replaces: ["forage", "drink", "hunt"],
            doing: "forage",
            steps: [
                {b: "wade", to: "shallows"},
                {b: "ambush", s: [4, 10], face: "water"},
                {b: "swipe", s: [0.8, 1.3], catch: "fish", p: 0.4, carry: "mouth"},
                {b: "eat", s: [3, 6], if: "caught", eat: true},
                {b: "wade", to: "shallows", near: "here", r: 1.5}
            ],
            loop: 1,
            tail: [
                {b: "wade", to: "edge"},
                {b: "shake_off", s: [1, 1.6]},
                {b: "walk", to: "anchor"}
            ]
        }),
        T({
            id: "shell_tool",
            label: "floats on its back and cracks shellfish on a stone (sea otters)",
            kind: "stay",
            goal: "water",
            replaces: ["forage", "swim", "dive", "rest"],
            doing: "forage",
            steps: [
                {b: "dive", to: "prey", catch: "shellfish", p: 0.75, carry: "chest"},
                {b: "surface", to: "water", near: "here", r: 1.5},
                {b: "float_back", s: [1, 2]},
                {b: "tool", s: [3, 6], if: "caught"},
                {b: "eat", s: [2, 4], if: "caught", eat: true},
                {b: "float_back", s: [2, 5]}
            ],
            loop: 0
        }),
        // MARK: Foraging on land and in the air
        T({
            id: "pounce",
            label: "stalks and pounces (a mousing leap)",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "stalk", "wander", "hunt"],
            doing: "forage",
            steps: [
                {b: "stalk", to: "ground", r: 3},
                {b: "freeze", s: [2, 5]},
                {b: "scan", s: [1, 2]},
                {b: "leap", to: "ground", near: "here", r: 1.4, catch: "insect", p: 0.3},
                {b: "dig", s: [0.6, 1.2]},
                {b: "eat", s: [0.8, 1.4], if: "caught", eat: true}
            ],
            loop: 0
        }),
        T({
            id: "hawk_insects",
            label: "sallies from a perch to snap insects in the air",
            kind: "stay",
            goal: "perch",
            replaces: ["forage", "perch", "fly"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "perch", s: [3, 8]},
                {b: "take_off", to: "up", h: 0.4},
                {b: "fly", to: "air", r: 4, catch: "insect", p: 0.65},
                {b: "fly", to: "anchor"},
                {b: "beat_prey", s: [0.6, 1.2], if: "caught"},
                {b: "eat", s: [0.5, 1], if: "caught", eat: true}
            ],
            loop: 0
        }),
        T({
            id: "hover_drop",
            label: "hovers and drops onto prey in the grass (kestrels)",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "fly", "soar", "hunt"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "take_off", to: "up", h: 2},
                {b: "fly", to: "up", h: 6},
                {b: "hover", s: [3, 7]},
                {b: "leap", to: "ground", near: "here", r: 1.5, catch: "insect", p: 0.4},
                {b: "eat", s: [1, 2], if: "caught", eat: true}
            ],
            loop: 0
        }),
        T({
            id: "worm_pull",
            label: "runs, stops, listens and pulls worms",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "graze"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "run", to: "ground", near: "here", r: 2},
                {b: "scan", s: [1, 2.5]},
                {b: "probe", s: [0.5, 1]},
                {b: "pull", s: [0.8, 1.4], catch: "worm", p: 0.45, carry: "beak"},
                {b: "eat", s: [0.8, 1.4], if: "caught", eat: true}
            ],
            loop: 0
        }),
        T({
            id: "probe_feed",
            label: "probes mud and soil with its bill",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "graze", "wander"],
            doing: "forage",
            steps: [
                {b: "walk", to: "ground", near: "here", r: 1.5},
                {b: "probe", s: [2, 4]},
                {b: "probe", s: [1.5, 3]}
            ],
            loop: 0
        }),
        T({
            id: "root_dig",
            label: "digs and roots for food",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "graze", "wander"],
            doing: "forage",
            steps: [
                {b: "walk", to: "ground", near: "here", r: 3},
                {b: "dig", s: [4, 9]},
                {b: "eat", s: [1, 2]}
            ],
            loop: 0
        }),
        T({
            id: "drum_bark",
            label: "drums and chisels on bark (woodpeckers)",
            kind: "stay",
            goal: "bark",
            replaces: ["forage", "climb", "perch"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "drum", s: [1, 2.2]},
                {b: "scan", s: [1, 3]},
                {b: "drum", s: [0.8, 1.6]},
                {b: "peck", s: [1.5, 3]}
            ],
            loop: 0
        }),
        T({
            id: "cache_food",
            label: "buries food to come back to (squirrels, jays)",
            kind: "stay",
            goal: "ground",
            replaces: ["forage", "wander"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "pick_up", s: [0.8, 1.5], pick: "nut", carry: "mouth"},
                {b: "go", to: "ground", r: 6},
                {b: "dig", s: [1.5, 3]},
                {b: "place", s: [0.6, 1], drop: true},
                {b: "dig", s: [1, 2]},
                {b: "scan", s: [1, 2]},
                {b: "go", to: "anchor"}
            ],
            loop: 0
        }),
        T({
            id: "stick_tool",
            label: "uses a stick to probe for food (crows, chimpanzees)",
            kind: "stay",
            goal: "bark",
            replaces: ["forage"],
            doing: "forage",
            hours: "day",
            steps: [
                {b: "pick_up", s: [1, 2], pick: "stick", carry: "beak"},
                {b: "tool", s: [4, 9]},
                {b: "eat", s: [1, 2]},
                {b: "tool", s: [3, 6]},
                {b: "place", s: [0.6, 1], drop: true}
            ]
        }),
        // MARK: Comfort
        T({id: "groom_self", label: "grooms or preens", kind: "stay", goal: "here", replaces: ["rest", "groom", "perch", "watch"], doing: "groom", steps: [{b: "groom", s: [4, 10]}, {b: "scan", s: [1, 2]}, {b: "groom", s: [3, 6]}]}),
        T({
            id: "preen_stretch",
            label: "preens, stretches a wing, ruffles",
            kind: "stay",
            goal: "here",
            replaces: ["rest", "groom", "perch"],
            doing: "groom",
            steps: [
                {b: "groom", s: [3, 6]},
                {b: "stretch", s: [1.2, 2]},
                {b: "groom", s: [2, 4]},
                {b: "shake_off", s: [0.6, 1]}
            ]
        }),
        T({id: "stretch_yawn", label: "stretches and yawns", kind: "stay", goal: "here", replaces: ["rest", "groom", "watch"], doing: "rest", steps: [{b: "stretch", s: [1.5, 2.5]}, {b: "yawn", s: [1, 1.8]}, {b: "rest", s: [3, 8]}]}),
        T({
            id: "bathe",
            label: "bathes in the shallows, then shakes and preens",
            kind: "stay",
            goal: "edge",
            replaces: ["drink", "groom", "rest"],
            doing: "groom",
            hours: "day",
            steps: [
                {b: "walk", to: "shallows", r: 0.6},
                {b: "bathe", s: [3, 6]},
                {b: "walk", to: "edge"},
                {b: "shake_off", s: [0.8, 1.2]},
                {b: "groom", s: [4, 8]}
            ]
        }),
        T({
            id: "dust_bathe",
            label: "dust-bathes in a scraped hollow",
            kind: "stay",
            goal: "bare",
            replaces: ["groom", "rest", "bask"],
            doing: "groom",
            hours: "day",
            steps: [
                {b: "dig", s: [1, 2]},
                {b: "dust_bathe", s: [6, 12]},
                {b: "shake_off", s: [0.8, 1.2]},
                {b: "groom", s: [2, 4]}
            ]
        }),
        T({
            id: "wallow",
            label: "wallows in mud at the water's edge",
            kind: "stay",
            goal: "edge",
            replaces: ["groom", "rest", "drink"],
            doing: "groom",
            steps: [
                {b: "wallow", s: [10, 20]},
                {b: "walk", to: "ground", near: "here", r: 2},
                {b: "shake_off", s: [1, 1.6]}
            ]
        }),
        T({id: "roll", label: "rolls on the ground", kind: "stay", goal: "bare", replaces: ["groom", "rest"], doing: "groom", hours: "day", steps: [{b: "roll", s: [3, 6]}, {b: "shake_off", s: [0.8, 1.2]}, {b: "rest", s: [2, 5]}]}),
        T({id: "bask_sun", label: "basks broadside to the sun", kind: "stay", goal: "here", replaces: ["bask"], doing: "bask", hours: "day", steps: [{b: "bask", s: [20, 60], face: "sun"}]}),
        T({id: "wing_dry", label: "spreads its wings to dry", kind: "stay", goal: "perch", replaces: ["perch", "rest", "bask"], doing: "rest", hours: "day", steps: [{b: "wing_dry", s: [15, 40], face: "sun"}, {b: "groom", s: [3, 6]}]}),
        T({id: "bury_sand", label: "buries itself in sand or mud", kind: "stay", goal: "here", replaces: ["rest", "hide"], doing: "hide", steps: [{b: "bury", s: [20, 60]}]}),
        // MARK: Display and voice
        T({
            id: "pushup",
            label: "push-up display on a rock",
            kind: "stay",
            goal: "rock",
            replaces: ["bask", "rest", "watch"],
            doing: "bask",
            hours: "day",
            sex: "male",
            steps: [
                {b: "pushup", s: [1.5, 3]},
                {b: "display", s: [2, 4]},
                {b: "scan", s: [2, 5]}
            ],
            loop: 0
        }),
        T({
            id: "strut_display",
            label: "struts and displays (tail, wings, crest, pouch)",
            kind: "stay",
            goal: "ground",
            replaces: ["wander", "forage", "rest"],
            doing: "idle",
            hours: "day",
            season: "mating",
            sex: "male",
            steps: [
                {b: "display", s: [6, 14]},
                {b: "walk", to: "ground", near: "here", r: 0.8},
                {b: "display", s: [4, 10]},
                {b: "call", s: [1, 2]}
            ],
            loop: 0
        }),
        T({id: "call_bout", label: "calls or sings", kind: "stay", goal: "here", replaces: ["rest", "perch", "watch", "groom"], doing: "rest", steps: [{b: "call", s: [1.5, 3]}, {b: "scan", s: [1, 3]}, {b: "call", s: [1.5, 3]}, {b: "rest", s: [2, 5]}], loop: 0}),
        T({
            id: "scent_mark",
            label: "scent-marks its ground",
            kind: "stay",
            goal: "ground",
            replaces: ["wander"],
            doing: "wander",
            steps: [
                {b: "walk", to: "ground", near: "here", r: 3},
                {b: "scent_mark", s: [2, 4]},
                {b: "scan", s: [1, 2]},
                {b: "walk", to: "ground", near: "here", r: 3},
                {b: "scent_mark", s: [2, 4]}
            ]
        }),
        // MARK: Pairs (both animals run the same timeline from the pair's seed)
        T({
            id: "antler_clash",
            label: "stags roar, walk side by side and clash antlers (the rut)",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            hours: "dawn_dusk",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "call", s: [2, 4], face: "other"},
                {b: "call", s: [2, 4], face: "other"},
                {b: "walk", to: "meet_side"},
                {b: "walk", to: "meet", face: "other"},
                {b: "fight", s: [4, 9], face: "other"},
                {b: "fight", s: [3, 6], face: "other"},
                {b: "flee", to: "away", role: "b"},
                {b: "call", s: [2, 3], role: "a"}
            ]
        }),
        T({
            id: "horn_clash",
            label: "rams rear and run head-on into each other",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            hours: "day",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "display", s: [1.5, 3], face: "other"},
                {b: "rear", s: [0.8, 1.2], face: "other"},
                {b: "clash", to: "meet", face: "other"},
                {b: "shake_off", s: [0.6, 1]},
                {b: "walk", to: "meet_far", face: "other"},
                {b: "rear", s: [0.8, 1.2], face: "other"},
                {b: "clash", to: "meet", face: "other"},
                {b: "shake_off", s: [0.6, 1]},
                {b: "flee", to: "away", role: "b"}
            ]
        }),
        T({
            id: "jaw_spar",
            label: "gape and push chest to chest (hippos, elephant seals)",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "display", s: [2, 4], face: "other"},
                {b: "walk", to: "meet", face: "other"},
                {b: "fight", s: [4, 8], face: "other"},
                {b: "display", s: [2, 3], face: "other"},
                {b: "flee", to: "away", role: "b"}
            ]
        }),
        T({
            id: "box_spar",
            label: "stand up and box (kangaroos, hares)",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet", face: "other"},
                {b: "rear", s: [1, 2], face: "other"},
                {b: "box", s: [4, 8], face: "other"},
                {b: "flee", to: "away", role: "b"}
            ]
        }),
        T({
            id: "lizard_contest",
            label: "rival males bob, show their sides and wrestle",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            hours: "day",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "pushup", s: [2, 3], face: "other"},
                {b: "display", s: [2, 4], face: "other"},
                {b: "pushup", s: [1.5, 2.5], face: "other"},
                {b: "walk", to: "meet", face: "other"},
                {b: "fight", s: [2, 4], face: "other"},
                {b: "flee", to: "away", role: "b"}
            ]
        }),
        T({
            id: "wrestle",
            label: "rival males grapple and push",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            season: "mating",
            sex: "males",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "display", s: [1.5, 3], face: "other"},
                {b: "walk", to: "meet", face: "other"},
                {b: "fight", s: [4, 8], face: "other"},
                {b: "flee", to: "away", role: "b"}
            ]
        }),
        T({
            id: "court_display",
            label: "a male displays to a female",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "idle",
            hours: "day",
            season: "mating",
            sex: "mixed",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "display", s: [6, 12], face: "other", role: "a"},
                {b: "scan", s: [6, 12], face: "other", role: "b"},
                {b: "dance", s: [3, 6], face: "other", role: "a"},
                {b: "rest", s: [3, 6], face: "other", role: "b"},
                {b: "call", s: [1, 2], role: "a"},
                {b: "groom", s: [1, 2], role: "b"}
            ]
        }),
        T({
            id: "court_dance",
            label: "a pair dances together (cranes, grebes, albatrosses)",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "play",
            hours: "day",
            season: "mating",
            sex: "mixed",
            steps: [
                {b: "walk", to: "meet_far", face: "other"},
                {b: "dance", s: [5, 10], face: "other"},
                {b: "call", s: [1.5, 3], face: "other"},
                {b: "dance", s: [4, 8], face: "other"}
            ]
        }),
        T({
            id: "allogroom",
            label: "two of a group groom each other",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "groom",
            sex: "any",
            steps: [
                {b: "walk", to: "meet", face: "other"},
                {b: "groom_other", s: [8, 16], face: "other", role: "a"},
                {b: "rest", s: [8, 16], face: "other", role: "b"},
                {b: "rest", s: [6, 12], face: "other", role: "a"},
                {b: "groom_other", s: [6, 12], face: "other", role: "b"}
            ]
        }),
        // MARK: Flocks
        T({id: "murmuration", label: "a murmuration over the roost at dusk", kind: "flock", goal: "here", replaces: [], doing: "fly", hours: "dusk", steps: [{b: "fly", s: [60, 120]}]}),
        T({id: "v_formation", label: "flies in a V or a line behind its leader", kind: "flock", goal: "here", replaces: [], doing: "fly", steps: [{b: "fly", s: [1, 1]}]}),
        T({id: "swarm", label: "a swarm round it by day (ambient insects: bees at the hive, wasps, locusts, dragonflies)", kind: "flock", goal: "here", replaces: [], doing: "fly", hours: "day", steps: []}),
        T({id: "swarm_dusk", label: "a swarm round it at dusk (ambient insects: mayflies dancing, termites' and ants' nuptial flights)", kind: "flock", goal: "here", replaces: [], doing: "fly", hours: "dusk", steps: []}),
        T({id: "cluster", label: "a crawling cluster round it (ambient bugs gathered on a warm surface)", kind: "flock", goal: "here", replaces: [], doing: "rest", steps: []}),
        T({id: "bat_emergence", label: "bats stream out of the roost at dusk (with ambient roost-mates)", kind: "flock", goal: "here", replaces: [], doing: "fly", hours: "dusk", steps: []}),
        T({
            id: "mixed_follow",
            label: "joins another species' flock or troop for a while (mixed flocks)",
            kind: "pair",
            goal: "here",
            replaces: [],
            doing: "forage",
            hours: "day",
            sex: "any",
            steps: []
        }),
        // MARK: Bats at night
        T({
            id: "bat_hawk",
            label: "hunts insects on the wing at night, in sallies and turns",
            kind: "stay",
            goal: "air",
            replaces: ["forage", "fly", "wander", "hunt"],
            doing: "fly",
            hours: "night",
            steps: [
                {b: "fly", to: "air", r: 5, catch: "insect", p: 0.5},
                {b: "fly", to: "air", r: 4},
                {b: "fly", to: "air", r: 6, catch: "insect", p: 0.5}
            ],
            loop: 0
        }),
        T({
            id: "bat_trawl",
            label: "trawls the water feet-first for fish at night",
            kind: "stay",
            goal: "air",
            replaces: ["forage", "fly", "hunt"],
            doing: "fly",
            hours: "night",
            steps: [
                {b: "fly", to: "over_water", h: 0.6},
                {b: "dive_feet", to: "water", catch: "fish", p: 0.35, carry: "feet"},
                {b: "fly", to: "air", r: 6},
                {b: "fly", to: "air", r: 5, catch: "insect", p: 0.3}
            ],
            loop: 0
        }),
        // MARK: Nests and digging
        T({id: "incubate_sit", label: "sits on its eggs on the nest", kind: "stay", goal: "nest", replaces: [], doing: "rest", steps: [{b: "incubate", s: [60, 78]}]}),
        T({id: "molehills", label: "pushes up molehills round its burrow (they fade)", kind: "mark", goal: "here", replaces: [], doing: "burrow", steps: []}),
        T({
            id: "nest_build",
            label: "carries material to its nest; the nest grows over the days",
            kind: "stay",
            goal: "nest",
            replaces: ["forage", "perch", "wander", "rest"],
            doing: "forage",
            hours: "day",
            season: "nesting",
            steps: [
                {b: "scan", s: [1, 2]},
                {b: "go", to: "material", r: 8},
                {b: "pick_up", s: [1, 2], pick: "material", carry: "beak"},
                {b: "go", to: "nest"},
                {b: "place", s: [1.5, 3], drop: true},
                {b: "incubate", s: [1.5, 3]}
            ],
            loop: 1
        }),
        T({
            id: "beach_nest",
            label: "hauls out at night, digs a pit in the sand and covers it",
            kind: "stay",
            goal: "edge",
            replaces: ["rest", "swim", "forage", "sleep"],
            doing: "forage",
            hours: "night",
            season: "nesting",
            steps: [
                {b: "crawl", to: "beach", r: 6},
                {b: "dig", s: [15, 28]},
                {b: "rest", s: [10, 18]},
                {b: "dig", s: [8, 14]},
                {b: "crawl", to: "edge"}
            ]
        }),
        T({
            id: "dig_burrow",
            label: "digs at its burrow, throwing out a mound of earth",
            kind: "stay",
            goal: "ground",
            replaces: ["burrow", "forage", "rest", "hide"],
            doing: "burrow",
            steps: [
                {b: "walk", to: "ground", near: "here", r: 1.2},
                {b: "dig", s: [6, 12]},
                {b: "scan", s: [1, 2]},
                {b: "dig", s: [4, 8]}
            ]
        })
    ].map((t) => [t.id, t])
);

/** Land-water crossings: the way in, the way out, and what follows (the schedule's enter and exit legs). */
export const ENTRY_STYLES = ["wade", "slide", "slip", "dive", "launch"] as const;
export const EXIT_STYLES = ["walk", "haul", "hop"] as const;
export const AFTER_STYLES = ["shake", "bask", "wing_dry", "preen", "none"] as const;
export type EntryStyle = (typeof ENTRY_STYLES)[number];
export type ExitStyle = (typeof EXIT_STYLES)[number];
export type AfterStyle = (typeof AFTER_STYLES)[number];
/** The blocks each crossing plays (validated with the templates). */
export const ENTRY_BLOCKS: Record<EntryStyle, string> = {wade: "wade", slide: "slide_in", slip: "slip_in", dive: "dive_in", launch: "launch"};
export const EXIT_BLOCKS: Record<ExitStyle, string> = {walk: "walk", haul: "haul_out", hop: "hop_out"};
export const AFTER_BLOCKS: Record<AfterStyle, string | null> = {shake: "shake_off", bask: "bask", wing_dry: "wing_dry", preen: "groom", none: null};

/** Sleeping postures (the sleep block's own states). */
export const POSTURES = ["one_leg", "tuck", "hang", "curl", "float", "stand", "huddle"] as const;
export type Posture = (typeof POSTURES)[number];
