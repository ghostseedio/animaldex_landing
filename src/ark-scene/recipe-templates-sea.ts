/**
 * The sea's own feeding acts (lane SEA-SIG, 2026-11-26, owner priority 3: the sea spectacle, with the real animals
 * aboard). Each is drawn only with blocks and clips the scene already has; each species' row quotes its own stored text
 * (`data/ark/signature-recipes-sea.json`).
 *
 *   seagrass_graze    a green sea turtle on the seagrass bed: head down, cropping, a short swim on along the meadow, and
 *                     again. The turtle rig's graze clip, by the `eat` block (as SIG5's `sniff_trail`: a `peck`'s nose-down
 *                     on top of the clip's own doubles it).
 *
 * (A reef fish's `peck` pick, `reef_pick`, was tried and dropped: drawn, the fish held its swim pose mid-band, nose clear of
 * the rock, and the pick did not read.)
 *
 * It is `banded`: the swimmer keeps its own depth band (`sea-depth.ts`: a reef animal within a metre of the floor) while
 * the act moves it on, turns it and tips it nose down; a recipe's own pose would have it swim at the surface.
 *
 * Data only, like the other templates: the engine (`behaviour-recipes.ts`) runs them. Nothing is caught or eaten.
 */

import type {Template} from "@/ark-scene/recipe-templates";

const T = (t: Template) => t;

export const SEA_TEMPLATES: Template[] = [
    T({
        id: "seagrass_graze",
        label: "grazes the seagrass on the bed, head down, swimming on a little between bites",
        kind: "stay",
        goal: "water",
        replaces: ["forage", "graze", "swim", "wander"],
        doing: "forage",
        hours: "day",
        drift: true,
        banded: true,
        steps: [
            {b: "swim", to: "water", r: 4},
            {b: "eat", s: [4, 8]},
            // (A body length or so on along the meadow between bites: not a turn on the spot.)
            {b: "swim", to: "water", near: "here", r: 1.2}
        ],
        loop: 1,
        tail: [{b: "swim", to: "anchor"}]
    })
];
