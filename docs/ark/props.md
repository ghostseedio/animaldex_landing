# Ark props: homes, nests and area details

The props lane (branch `ark-props`) draws what animals build and what each area holds, on top of the graphics lane's terrain and scenery. It is one scene module (`src/ark-scene/props/index.ts`, registered in `scene-modules.ts`). It is visual only: nothing here decides anything on the server or in the ecology, and everything that varies is seeded from ids, the Ark day and the island clock, so every viewer sees the same thing.

## Files

| File | What it does |
|---|---|
| `props/presence.ts` | Which homes show: a group (ants, bees, wasps, termites, spiders, moths, rabbits, worms, dens, lairs, bats, sea turtles, beavers, snails, birds) shows only while the Ark holds a species of that kind. It reads the snapshot only. It also gives one nest plan per bird species and zone, in its breeding season or when it has a clutch or chicks. |
| `props/nest-kinds.ts` | What nest a bird builds: form, site, size against the bird, colony, build days, and lining. |
| `props/nest-sites.ts` | Where each nest goes, found only through the scenery sampler. |
| `props/nest-shapes.ts` | The nests, built strand by strand, each vertex carrying its build order (`aBuild`). |
| `props/nest-growth.ts` | `nestStage(speciesId, siteId, t)`: how far built a nest is. |
| `props/homes.ts` | Nests and eggs, ant mounds and trails, the bees' hollow and hive, the wasps' nest, termite mounds, webs, chrysalises, the warren, worm casts, dens and lairs, the turtles' nest and tracks, the beavers' lodge and dam, and slime trails. |
| `props/home-layout.ts` | The home area by plots (pure: no sampler, no three.js). `HomePlot` {id, kind: house or smallholding, x, z, rotation, floor?, barn?}; `defaultHomePlots()` (today's cottage and barn; the map lane's `homePlots()` replaces them via the module's `setHomePlots(plots)`); `plotFrame(plot)`; `chimneyTop`, `picketRuns`/`picketPosts`, `paddockRect`/`paddockSegments`, `coopSpot`; and **`fencePostTops(plots)`**, every fence post top the props draw (`{fence: "paddock" or "picket", n, plot, position, forward}`) for the sampler's `fence_post:<fence>:<n>` points. |
| `props/areas.ts` | Details that are always there. House and garden: gutters, a water butt, moss, the path, the fence, the vegetable patch, the bird box, puddles. Farm: hay shelter, loft door, paddock, troughs, mud. Mountain: strata outcrops, scree, drifts, icicles. Grassland: tussocks, wildflower drifts, old termite mounds. |
| `props/cave.ts` | The cave, plus the bats' roost when bats are aboard. |
| `props/effects.ts` | Chimney smoke, moths at the porch light, dew, mist, blowing snow and dust. The mist's sheets are draped over the ground and the water every couple of metres, 0.25–1 m up. They fade as the camera comes down to their height or sees them edge-on, and they are soft and broken at their edges, so they never cut across a slope or an animal as a band. |
| `props/conditions.ts` | The island clock's weather as the props read it. |
| `props/kit.ts` | Shared pieces: the instanced near/far `LodBatch`, `LodPiece`, the per-tier caps (`PROPS_TIERS`), and the weather-aware material (`propMaterial`, which takes the `growth` option for nests). |
| `props/golden-props.ts` | The props' close-up golden shots. |

## Nests by species

A weaver's purse is not an eagle's eyrie. `nestProfile(animal)` reads the slug, then its head noun, then the zone:

| Form | Site | Birds (examples) |
|---|---|---|
| `cup`: woven twigs and grass, lined with moss or hair | `tree_fork` | songbirds, hummingbirds (small), kittiwakes (on a ledge) |
| `platform`: a flat stack of sticks with a shallow cup | `tree_top` / `tree_fork` | herons and egrets (colony of 3), hawks, crows, pigeons (flimsy) |
| `eyrie`: a deep heap of big sticks, green sprigs in the cup, rebuilt every year | `cliff_ledge` / `tree_top` | eagles, ospreys, storks |
| `scrape`: a hollow with a rim of thrown soil and a few pebbles | `shore` / `ground` / `cliff_ledge` | gulls, terns, plovers, falcons, guillemots (bare ledge), ratites |
| `down_bowl`: a grass bowl lined with the bird's own down | `ground` | ducks, geese, gamebirds |
| `mud_cup`: mud pellets against a wall, widest at the eave | `eaves` | swallows (open, feather rim), martins (closed, `closed`) |
| `ball` / `dome`: a ball with a side entrance | `eaves` / `tree_fork` / `tree_top` | sparrows, wrens, magpies, hammerkops |
| `pendant`: a woven purse hanging from a twig tip | `branch_tip` | weavers (colony of 4), orioles, sunbirds |
| `floating`: a raft of wet weed | `water_margin` | grebes, coots, loons |
| `mound`: a reed heap, or a mud cone (`lining: mud`) | `water_margin` / `shore` / `ground` | swans, cranes, flamingos (colony of 6), albatrosses, gannets |
| `pebbles`: a ring of stones | `ground` | Adélie, gentoo and chinstrap penguins |
| `megapode`: a leaf-litter heap metres across | `ground` | brush-turkeys, malleefowl |
| `hole` / `burrow` / `barn` | `trunk_hole` / `bank` / `barn` | woodpeckers, parrots, owls / kingfishers, bee-eaters, puffins / barn owls |
| `none` | | cuckoos and other brood parasites; emperor and king penguins |

**Size.** On the ground, on the shore and at the water's edge, the bird stands on its nest in the scene, so the nest fits the bird's drawn length (`sizes.ts`). Up a tree, on a cliff or a wall, the nest is at the scenery's scale: the real body length × 1.35, with a floor of 0.3 × the drawn length (`stats.ts` `arkBody`). With the catalogue's lengths this gives, for example, a golden eagle's eyrie about 2.2 m across and a village weaver's purse about 0.7 m long.

**Eggs.** Eggs show only when the server says a clutch is in (`voyage_public_v2` `nests`), and only in the sitter's own nest. They are about a tenth of the bird's length and coloured by species (blue for herons, green-buff for ducks, blotched for raptors, white for hole-nesters, speckled for scrapes). Sea turtles' eggs are buried and never drawn.

## Nest sites (all through the scenery sampler)

- `ground` / `shore`: under the sitter when it stands on dry land, else a spiral search on `surfaceAt` (dry, gentle ground; sand for `shore`), seated so a nest on a slope never floats off its low side.
- `water_margin`: where `surfaceAt(x, z).waterDepth` is 5–60 cm near the sitter. A raft floats at the surface.
- `tree_top`: the highest upward-facing `leaf` attach point of each nearby tree, on its drawn crown, only where `open` ≥ 0.3 (the leaf sees the sky).
- `tree_fork`: a `branch` point 1.4–7 m up.
- `branch_tip`: the `branch` points of one tree furthest from its trunk (a colony hangs from one tree).
- `trunk_hole`: a drawn `tree_hollow` within 80 m (the asset draws the hole), else a sideways `bark` point more than 1 m up, where the props cut a hole.
- `cliff_ledge`: from the sampler's cliff `ledge` points, uphill (against `forward`) to the first level shelf (normal.y ≥ 0.82) with at least a 1 m drop in front; or straight onto a big rock's `ledge` shelf.
- `eaves`: the sampler's `house_eave` points (under the drawn roof), back and side walls first (the front's is over the porch roof), the nest's top just under the point, its back to the wall.
- `bank`: the sampler's `burrow` points.

The props never offset from a canopy or a trunk on their own. The ant trail, the bees' hollow and the webs also use the sampler: the trail runs up a `bark` point's trunk, the hollow is cut at an open-fronted `bark` point, and the webs hang between pairs of `flower_head` points, on the porch, and at the gate.

## Growing nests (for the recipes lane, `ark-behaviour-recipes`)

```ts
import {nestStage, nestSites, setNestStageSource, scheduledStage} from "@/ark-scene/props/nest-growth";

nestStage(speciesId, siteId, t)  // 0…1; t = the Ark day (fractional, the server's count; 1 Ark day ≈ 55 real minutes)
nestSites()                      // every nest drawn now: speciesId, siteId, slug, zone, form, position, up, radius, sitter, eggs, chicks, buildDays, carriedOver
setNestStageSource((speciesId, siteId, t) => number | null)  // a recipe's own schedule; null keeps the default
```

The props module also has `nestSites()` (the same list, each with its `stage` now) and `setArkDay(day | null)`, which pins the day.

- **Default schedule** (`scheduledStage`): building starts 0–6 Ark days into the zone's breeding season (the day comes from a hash of the species and site ids) and takes the form's `buildDays` (a scrape 0.5–1, a down bowl 2, a cup 4, a platform 5–6, a mud cup 6–7, an eyrie 10, a megapode mound 30). An eyrie starts from `carriedOver` (0.65) of last year's. Out of the season a nest is finished, if it shows at all (`presence.ts` decides that). With eggs or chicks it is always 1.
- **Drawing**: every twig, blade, pellet and tuft carries `aBuild`. The base goes in first, then the walls and rim, then the lining and down; a weaver builds its ring, then the roof, the chamber and the entrance tube. The nest material (`propMaterial({growth: true})`) collapses every vertex whose `aBuild` is past the instance's `iStage` (an instanced attribute that `LodBatch` keeps per nest). A nest at stage 0 is not drawn. The module re-reads the stages once a second and refills only when a nest has grown a hundredth.
- **A recipe that acts out building** (twigs carried to `position` over `buildDays`) can either follow the default schedule (read `nestStage` to know when to fly) or drive it with `setNestStageSource`. Its source must stay a pure function of `(speciesId, siteId, t)`, with no per-viewer randomness.

## Golden shots

`node scripts/ark-golden-shots.mjs --props all [--devices desktop,phone]` (or `--props nest_eyrie,web_dawn`). The page is the v2 fixture, plus one of each species whose home shows only when it is aboard, plus a village weaver, a great crested grebe and a house martin, on Ark day 120 of the year with clutches in for the mallard, the heron and the green turtle.

Shots: `bird_nest` (mallard's down bowl), `nest_eyrie`, `nest_heronry`, `nest_weavers`, `nest_growing` (pinned to the day the heron's platform is 55% built), `nest_eaves`, `nest_grebe`, `ants_trunk`, `web_dawn`, `beehive_hollow`, `house_night`, `farm`, `mountain_scree`, `cave_roost`, `turtle_nest`, `snail_trail`, `mist_dawn` (mist over the lake), `mist_meadow` (at an animal's height in the barn owl's meadow), `mist_shore` (low on the lake's shore).

## Budget

These are the props' own draw calls and triangles, worst of nine named places, with the camera 6 m off and 4 m up (`ark-props.test.ts`, "props budget"; the fixture plus every gated species):

| Tier | Draw calls (worst) | Triangles (worst) |
|---|---|---|
| high (desktop) | 45 | 369 k |
| medium (mid-range phone) | 41 | 225 k |
| low (battery saver, and the golden phone profile on a loaded Mac) | 25 | 47 k |

The scene's own phone numbers are 71–171 calls and 1.0–2.3 M triangles (graphics-batches.md). A nest is 1.3–6.1 k triangles at lod0, and only the nests within the tier's near radius are drawn. The test fails if medium goes over 45 calls or 400 k triangles, or low over 30 calls or 200 k.

## Home plots

The hamlet grows by plots. Each house plot gets its own garden: a picket fence with posts, a path, vegetable beds, compost, a water butt, gutters, moss and a bird box. Each smallholding gets its own yard: a hay shelter (the loft door only when a barn stands there), a paddock on pasture clear of trees, troughs, mud, puddles and a hens' coop. Each is laid out in the plot's frame and seeded by its id, so a new plot is the same for every viewer. The original two plots keep their old seeds.

### The hamlet's buildings and land
- **Buildings:** `props/hamlet-buildings.ts` draws a cottage on each house plot and a barn or a smaller farm shed on each smallholding, except today's two, which the graphics lane draws. It uses the graphics lane's own builders: `micro-scene.ts` `cottageGeometry(style)` and `vegetation.ts` `barnGeometry(style)`. With `COTTAGE_STYLE` and `BARN_STYLE` they give today's meshes byte for byte, and a test pins their hashes.
  - Each plot's look comes from its id (`home-layout.ts`). `cottageStyle` sets the limewash, tiles, woodwork, chimney side, a porch or not, and a scale of 0.9–1. `barnStyle` sets the colours and size, or makes a shed.
  - The garden's house-hung details (gutters, downpipe, moss, bird box) scale with the cottage.
  - The windows light at night.
  - The whole hamlet is two draw calls.
- **Land:** `props/hamlet-land.ts` is pure. It reads the slot table plus the map's footprints, which are baked into `hamlet-footprints.json` (a test checks them against `plotFootprint`). With it:
  - no crops grow on a reserved plot (`fields.ts` `cropAt` and the shader twin `arkHamletLot`);
  - no grass tufts grow under a house or a barn, and about half grow on the rest of a plot (`decor.ts` `grassTufts`).
  - No decor item is moved or removed, so the decor's ids do not shift. `fieldCropAt` is the raw field; the props' paddocks and the map's slot planning keep reading it.
- **Golden shots:** `hamlet_day`, `hamlet_night`, `hamlet_close_day` and `hamlet_close_night`, with the hamlet at 1× (7 houses, 3 smallholdings).

### Where no animal stands
`home-layout.ts` `plotKeepOuts(plot)` lists the rectangles in a plot's frame that animals should keep off:
- a house plot's vegetable beds and bean wigwam, compost bin and water butt;
- a smallholding's hay shelter, loose hay, troughs, and the coop's house (its run stays open to the hens).

`onHomeKeepOut(x, z, plots, margin = 0.3)` checks a world point against every plot. `props/areas.ts` draws from the same constants (`GARDEN_BEDS`, `COMPOST`, `troughSpots`, `coopSpot`), so the map lane's yard and lawn spots can avoid them. Today two of the map's coop-run spots fall on a hay shelter (smallholding-1 and smallholding-2; the test logs them).

## Mount cost (the runtime lane's measure, docs/ark/runtime.md)

The scenery is built after the first frame, a few milliseconds a frame, so the props add no long task to a big Ark's mount:
- The sampler prepares its attach points (`prepareAttachPoints`).
- Then the areas and the homes are built by `buildAreasSteps` and `buildHomesSteps`, run by `kit.ts` `runSliced` at 6 ms a slice. Built all at once (`buildAreas`, `buildHomes`), they are the same; the test checks every step its own frame against all at once.
- A newer build supersedes an older one, and the old stays drawn until the new is in.

`nestSpots` keeps the ground height under each trunk and branch point it has asked about, and checks height only for the points it looks at, nearest first. Before, at the captures' scale, hundreds of nests sampled the same thousands of points.

Phone profile (4× CPU), the 1× population (3,140 animals), the golden page, one run each on the loaded Mac:

| | before (5774c2b1) | after (cd717508) |
|---|---:|---:|
| `nestSpots` | 5,300 ms | 232 ms |
| homes, in all | 5,617 ms, one task | 421 ms, in 6 ms slices |
| areas | 374 ms, one task | 441 ms, in 6 ms slices |
| `createPropsModule` inside `mountArk` | 451 ms | 177 ms (the mist drapes with one ground sample a vertex) |
| the props in the long tasks after the mount | 7.0 s task (homes 5.6 s) | none |

What remains after the mount is not the props: behaviour's `spaceHomes` (3.4 s) and the first shader compiles (0.3 s).

## Other lanes

- **Graphics / attach lane (`ark-graphics-attach`, merged here at 4873e79d):** the props use only the sampler's own tags.
  - Cliff nesters use `ledge` points. Up is up; the way out of the cliff is `forward` / `yaw`. Rock shelves (`ledge:decorN:0`) hold a nest directly.
  - The cave uses `place("cave")`, with its `facing`.
  - Hole nesters and the bees use the drawn `tree_hollow` points; the asset draws the hole itself, and the props add only the comb.
  - Eave nests sit under the sampler's `house_eave` points, which are under the drawn roof.
  - Tree-top nests use the attach lane's leaf points on the drawn crowns, only where `open` ≥ 0.3.
  - The props' own `ledges()`, `CAVE_SITE` and eave workaround are gone.
- **Golden shots of things up in the air:** the scene keeps its camera target on the ground, so `golden-props.ts` `lookThrough` aims at the ground beyond the nest, on the line from the camera through it.
