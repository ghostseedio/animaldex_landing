/**
 * The templates of the group acts (`behaviour-group.ts`): what each one plays at the place the group's window sent the
 * animal to. Kind "group": the schedule's recipe pick never chooses them (it takes stay templates); `groupIntent`
 * does, for the whole group at once. Merged into `TEMPLATES` by `recipe-templates.ts`.
 */

import type {Template} from "@/ark-scene/recipe-templates";

export const GROUP_TEMPLATES: Template[] = [
    {id: "huddle", label: "huddles tight with its group, resting", kind: "group", goal: "here", replaces: [], doing: "rest", steps: [{b: "rest", s: [25, 60]}]},
    {
        id: "sentinel_post",
        label: "keeps watch from a post while its group feeds",
        kind: "group",
        goal: "here",
        replaces: [],
        doing: "watch",
        steps: [
            {b: "scan", s: [4, 8]},
            {b: "call", s: [1.2, 2.4]},
            {b: "scan", s: [4, 8]}
        ],
        loop: 0
    },
    {
        id: "dusk_gather",
        label: "gathers at its roost with its group, calling, before the night",
        kind: "group",
        goal: "here",
        replaces: [],
        doing: "perch",
        steps: [
            {b: "call", s: [1.5, 3]},
            {b: "scan", s: [1, 3]},
            {b: "groom", s: [2, 5]},
            {b: "call", s: [1.5, 3]}
        ],
        loop: 0
    },
    {
        id: "chorus",
        label: "calls with its whole group, heads up",
        kind: "group",
        goal: "here",
        replaces: [],
        doing: "rest",
        steps: [
            {b: "call", s: [2.5, 4.5]},
            {b: "scan", s: [0.8, 1.6]},
            {b: "call", s: [2.5, 4.5]}
        ],
        loop: 0
    },
    {
        id: "tree_feast",
        label: "eats at a fruiting tree with its group",
        kind: "group",
        goal: "here",
        replaces: [],
        doing: "forage",
        steps: [
            {b: "pick_up", s: [1, 2]},
            {b: "eat", s: [2, 4]},
            {b: "scan", s: [1, 2]}
        ],
        loop: 0
    },
    {id: "bask_pile", label: "basks stacked with its group on a log", kind: "group", goal: "here", replaces: [], doing: "bask", steps: [{b: "bask", s: [30, 60], face: "sun"}]},
    {
        id: "lick_gather",
        label: "lands with its flock on bare ground to eat soil",
        kind: "group",
        goal: "here",
        replaces: [],
        doing: "forage",
        steps: [
            {b: "probe", s: [3, 6]},
            {b: "scan", s: [1, 2.5]},
            {b: "probe", s: [3, 6]}
        ],
        loop: 0
    }
];
