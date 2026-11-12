# Ark Part C: the bigger wild island

Lane W1, landing branches `ark-wild-island` (the island on its own, from `ark-streaming`) and `ark-wild-island-next` (the island inside `ark-next`'s one world). The plan is AnimalDex `docs/ark/islands-plan.md` §2 (`ark-islands-plan` 353dc2b1), with decisions 15–28 and 141–143 in AnimalDex `docs/ark/DECISIONS.md`. The code is in `src/ark-scene/islands/wild/`; the tests are in `src/lib/ark-wild-island.test.ts`.

**The one rule, as on today's island:** every position is a pure function of the terrain and the ids. Nothing reads a clock or a random number: every shape is a constant or a seeded noise, so every device, the server's slot atlas and player control see the same island. Chunking (Part B) only decides what is drawn.

## 1. What is built

| | |
|---|---|
| Frame | A 528 m square: **10 × 10 Part B chunks** of 52.8 m (48 segments of 1.1 m), half 264, x east, z south. Decision 21 asked for 512 m in 8 × 8 of the plan's 64 m chunks; Part B's chunk is 52.8 m (decision 63), and 10 × 10 is the nearest square that keeps 60–80 m of sea for the lagoon and the drop-off. |
| Land | **11.93 ha** (measured at 1 m), about 411 × 388 m. Peak 85 m. |
| Coast | A radial coast with headlands and bays. The **polar cove** is an inlet in the north shore between two massifs, with its ice shelf reaching the sea and floes on its water. Cliffs only in the north-west and west; **the coast toward the town (compass 67.5°) is beach and dunes**, never cliffs (decision 141). |
| Mountains | A west–east spine with 5 summits (46–70 m above the crest, peak 85 m), arêtes and gullies from ridged noise, snow above 52 m. |
| Fresh water | A river from a spring at 21 m, through rapids, into a 28 m lake (level 6 m), out through the wetland's basin (water 0.95 m) and its floodplain, to a mangrove estuary on the south-west coast. Its water stands at its own level everywhere, so the river descends. |
| Sea | The reef lagoon off the south-west (its crest about 46 m out), kelp off the cold north-west, the drop-off in the east to about 90 m (the whales' water, in the strait facing the town). |
| Biomes | Islands plan §2.2: climate fields, not nearest centres (§3). |
| Scenery | At the scenery lane's real heights (decision 34): about 560 trees (the canopy kept apart by its crowns, and an understorey), 900 shrubs, 1,200 ground plants, 2,400 grass clumps plus tufts by chunk near the camera, 420 rocks sat into their slopes, 70 logs, 340 kelp, 475 coral heads, reeds and lilies, 14 floes, 18 termite mounds, 5 caves. All from the CC0 asset library already in `public/ark/assets/v1` (`docs/ark-credits.md`); nothing new was added. |

### Land per biome (1 m grid, by the zone with the most weight)

| Zone | Built | Plan |
|---|---:|---:|
| Rainforest | 2.42 ha | 2.4 |
| Woodland | 1.60 | 2.0 |
| Grassland and savanna | 2.16 | 2.0 |
| Desert | 1.38 | 1.0 |
| Mountains | 1.34 | 1.6 |
| River and lake banks, wetland, fresh water | 0.70 + 0.68 + 0.33 | 1.6 |
| Coast | 1.16 | 0.9 |
| Polar cove | 0.49 | 0.5 |

Sea inside the square: lagoon 0.75 ha, shallow (< 5 m) 2.82, 5–15 m 3.61, 15–40 m 4.98, deeper 3.46.

## 2. Files

| File | What |
|---|---|
| `frame.ts` | The square, Part B's grid (`WILD_GRID` = `chunkGridFor(264, 480)`), `wildChunkOf`, `wildChunkDistance`. |
| `fields.ts` | The landforms and the climate fields: coast, cove, ice shelf, cliffs, spine and summits, the river's two reaches with their levels, the lake, the wetland's basin, the sea floor (lagoon, kelp, drop-off, the cove's water), elevation, temperature, moisture. |
| `biomes.ts` | The zone weights: landform zones first, then the climate zones by a soft-max in (temperature, moisture). |
| `ground.ts` | `sampleWildGround(x, z)`: `world.ts` GroundSample's shape plus the island's own fields (fresh water and its level, ice, lagoon, drop-off, estuary, the river's nearest point). |
| `terrain-cache.ts` | The ground on a 2 m grid for slopes. |
| `reserves.ts` | Room for true-size animals (§4): big-animal ranges, whale cells. |
| `scenery.ts` | Everything that grows and lies on the island (helper A converts it to the motion pass's decor on `ark-next`). |
| `map-sampler.ts` | The Ark map's `ArkMapSampler` over the island: ground tags, blocking, anchors, attach points. |
| `zone-sites.ts`, `sites.ts` | Zone sites (`world.ts` ZONE_SITES' shape), the map's own `MapPoints` over the sampler, capacity against the plan's counts. |
| `validate.ts` | The spawn validator (§5). |
| `summary.ts` | Measures: land per biome, cores, fresh water, sea bands, the transitions' widths. |
| `world-v2.ts` | The v2 world as `world.ts` serves it (§8). |
| `render/ground.ts` | The ground in `terrain.ts` GroundArrays' layout, the fresh water's geometry at its own levels. |
| `render/index.ts`, `render/grass.ts`, `entry.ts` | The workbench: the island alone under the Ark's sky (stills, flythrough, perf, visual check). |
| `index.ts` | The archipelago hook: `WILD_ISLAND`, `wildReachToward(angle)`, `wildLandBounds()`, `loadWildIsland`. |
| `scripts/ark-wild-plan.mts` | The plan picture (1 px = 1 m) and the numbers. |
| `scripts/ark-wild.mts` | `stills`, `fly`, `perf`, `visual [--update]`, `eval`. |

## 3. Biomes: climate fields and their transitions

- **Landform zones** come first, each a smooth membership of the land itself, taking its share of what is left in this order: the wetland (its low basin), the river and the lake (their water and banks, wider where the river is lower), the polar cove (the coldest low ground), the coast (low ground within 13–30 m of the sea, wider at the estuary, narrower at cliffs), the mountains (by the regional elevation, 12–44 m).
- **Climate zones** share the rest by temperature and moisture, as on a Whittaker chart: rainforest (0.88, 0.84), woodland (0.63, 0.60), grassland (0.84, 0.36), desert (0.84, 0.06), a soft-max over each one's distance in (temperature, moisture), softness 0.02.
  - **Temperature** falls to the north (0.4 over the island) and with the regional elevation (1/95 per m), and is coldest by the cove.
  - **Moisture** runs from the wet west to the dry east (±0.44), with the sea wind in the south-west, the rain shadow north-east of the spine, and the riparian, lake and wetland lift.
- **Transitions**, the 10–90% width of the pair's share, measured on transects:

  | Pair | Width |
  |---|---:|
  | grassland ↔ woodland | 47 m |
  | rainforest ↔ woodland | 34 m |
  | rainforest ↔ wetland | 34 m |
  | desert ↔ grassland | 31 m |
  | rainforest ↔ river/lake | 31 m |
  | mountains ↔ woodland | 28 m |
  | desert ↔ mountains | 25 m |
  | polar ↔ woodland | 21 m |
  | coast pairs | 18–21 m (the plan's 15–20) |

  The tests hold every measured pair to 15–55 m.
- The zone ids are the Ark's own eleven wild zones; `farm_garden` is never present (decision 16).

## 4. Room for true-size animals (decisions 53 and 54)

- **Big-animal ranges** (decision 54, left to Part C):
  - Every land zone keeps ranges: spots of open, gentle, dry ground in its core, 16 m apart, each with a 7 m clear disc gentle all round.
  - No tree, rock or mound stands in a disc, and no smaller animal's cell lies within 2 m of one.
  - Land walkers 2.5 m and longer take their zone's ranges, a second cluster 4 m round the first.
  - There are 116: grassland 40, rainforest 24, desert 14, woodland 13, wetland 10, river and lake 6–7, coast 5, mountains 3.
- **Whale cells** (decision 53 carried over):
  - 13 cells in the east's drop-off, 15 m deep and more (76–90 m), 30 m apart.
  - No other swimmer's cell lies within 14 m of one, plus a 2.5 m margin.
- Both are static, from the terrain alone, so no arrival or departure moves anyone.

## 5. Placement and the validator

- **Sites:** `wildZoneSites()` (`world.ts` ZONE_SITES' shape). A land zone's site is the core cell nearest its core's middle. The coral reef's is the lagoon's middle, the open ocean's is the east's deep water, the river and lake's is a ring round the lake, the coast's is the southern beach.
- **Cells:** the map's own `MapPoints` (2.5 m cells, one tag each, launch points first) runs unchanged on the island's sampler (`map-sampler.ts`).
  - The sampler's tags follow today's stub on the island's fields, with no house, garden or farm tags.
  - **Steep ground:** steeper than 0.82, only cliff, mountain, sea-cliff, cave and snow tags hold; steeper than 2.2, only the sky. So no walker is placed on a face it cannot walk.
- **The validator** (`validate.ts`) checks every catalogue species of the wild zones (2,229) at its own cluster's slot and at its zone's year slot (4,458 placements). Its checks:
  - room;
  - the island's square;
  - medium and water;
  - depth band;
  - surface;
  - scenery (after a 2.5 m settle, as the scene's placement settles);
  - the walk grid's slope (a rock climber's 2.4);
  - reserved room;
  - big animals on ranges, whales in the deep;
  - small animals on fitting attach points (down to 0.1 mm, decision 55);
  - roosts.

  **0 failures.** It lists, without failing:
  - 3 species whose tags are all homestead ones: they take their zone's fallback ground (pied crow, golden tortoise beetle, spinybacked orbweaver);
  - 8 whose roost the island lacks within reach (6 house roosts, the weedy seadragon's kelp, the coelacanth's rocky shore): they sleep at home, the schedule's own choice.
- **Capacity** (rule E: cells plus attach points plus ranges): every zone shows more than 6× its year's count at once. River and lake is lowest at 6.4×, then wetland 8.3×, woodland 12.6×, grassland 11.5×, rainforest 14.3×.

## 6. The archipelago (decisions 141–143)

- The town stands across a 250 m strait at −22.5° (atan2(dz, dx)).
- Its origin is `wildReachToward(angle) + 250 + townReach` along that angle. `wildReachToward(−22.5°)` is **190.5 m**, against today's island's 90.25.
- `wildLandBounds()`: x −217…198, z −199…195.
- One world, one sea (decision 143, T3's): the island exposes its depth field (RGBA per ground vertex over ±264: depth/12 m, reef, fresh, the river's flow) and its own sea plane, which the world may drop.

## 7. The workbench: stills, flythrough, visual check, performance

`npx tsx scripts/ark-wild.mts stills|fly|perf|visual`. Shots:
- island_far and island_dusk (the opening view);
- island_north;
- town_side (the coast the town faces);
- cove_peaks;
- lagoon_rainforest;
- savanna, desert_dunes, lake_river, woodland_valley and ecotone_edge (ground level);
- wetland_estuary;
- mountain_meadow.

The visual check (`tests/ark-visual/wild/`) has four SwiftShader shots at 800 × 500 on the medium tier. The flythrough and per-tier performance are still to be recorded on `ark-wild-island-next`, inside the one world.

## 8. Integration with `ark-next` (P1: the world switch)

**For helpers A and B, and anyone coding against v2.** On `ark-next` the wild island is `world.ts`, which about 60 modules import directly. The v2 island replaces it through a switch inside `world.ts`; there is no parallel scene.

### The API (`src/ark-scene/world.ts`)

```ts
export type ArkWorldId = "v1" | "v2";
export function arkWorld(): ArkWorldId;                       // the world in use
export function setArkWorld(world: ArkWorldId): void;         // choose it, once, before anything builds from it
export function onArkWorld(listener: (w: ArkWorldId) => void): void;   // runs on a change (never at registration)
```

- **The state** is on `globalThis.__arkWorldSwitch`, like `no-hamlet.ts`'s switch, so two copies of the modules in one process follow one switch.
- **`setArkWorld("v2")` also sets `setNoHamlet(true)`:** v2 is islands mode, with no hamlet. The hamlet's resets fire.
- **How the choice is made:**
  - **Page:** the archipelago (`islands/archipelago.ts`) chooses `v2` in islands mode when the `wildIsland` setting says so, or the URL has `?wild=v2`. It calls `setArkWorld` before `import("@/ark-scene")`, so every module the scene loads after it sees v2 from the start. With islands off it never calls it, and v1 is unchanged. (The archipelago wiring is P1's last step; until then, set `window.__ARK_WORLD__ = "v2"` before mounting.)
  - **At load,** `world.ts` reads `globalThis.__ARK_WORLD__`, then `?world=v2` in `location.search`, then `ARK_WORLD=v2` in the environment.
  - **Prebuild workers:** `runtime/prebuild.ts` adds `?world=v2` to their URLs, so the worker's `world.ts` is v2 before any of the worker's modules build.
  - **Tests and scripts:** run with `ARK_WORLD=v2`, or call `setArkWorld("v2")` at the top before importing what builds. `node --test` runs each file in its own process.

### Live bindings, reassigned by the switch (read them at use, never copy at load)

| Export | v1 | v2 (from `islands/wild/world-v2.ts`) |
|---|---|---|
| `ZONE_SITES` | today's | `wildZoneSites()` (`zone-sites.ts`; helper B owns it from P1) |
| `LAKE` | {−4, −4, 10.5} | {−62, −14, 28} (its surface at 6 m: `freshLevelAt`) |
| `RIVER` | lake → mouth | the lower river, lake → mouth |
| `RIVER_UPPER` (new) | `[]` | the upper river, spring → lake |
| `VISITOR_LANDING` | the jetty | a natural landing on the south beach: `deckFrom` = `deckTo` = `foot`, so there is no jetty to draw |
| `HAMLET_LANES` | today's | `[]` |
| `TERRAIN_HALF` | 132 | 264 |
| `TERRAIN_SEGMENTS` (new) | 240 | 480 |
| `WORLD_RADIUS` | 120 | 220 |

### Functions that answer per world

- `sampleGround`: v2 returns `sampleWildGround`, GroundSample's shape plus `fresh`, `freshLevel`, `riverHit`, `temperature`, `moisture`, `ice`, `estuary`…
- `heightAt`;
- `coastRadius(theta)`;
- `homeLobe` (0 on v2);
- `riverDistance` (both reaches);
- `regionLabelAnchor`;
- `laneDistance` is Infinity on v2, because there are no lanes.

Unchanged: `zoneAt`, the noise and hash functions, `regionCentre`.

### What follows the switch already (P1/P2)

- **`terrain.ts`:**
  - `GROUND_SEGMENTS` is a live binding (480 on v2).
  - `groundArrays()` on v2 returns `islands/wild/render/ground.ts` `wildGroundArrays()`.
  - The ground material's snow line is 52 m on v2 (program key `ark-ground-3-snow52`).
  - The fresh water's mesh on v2 is the ground's quads at each vertex's own level, in a lighter lake colour.
- **`water-level.ts`:** `freshLevelAt(x, z)` gives the v2 lake's or river's own level, and `waterLevelAt` uses it. `freshFrom` reads the v2 sample's `fresh`.
- **`sea-depth.ts`:** `LAKE_SWIM_RADIUS` follows the switch. Its lake test `height < −0.9` still assumes a surface at 0; helper B fixes that against `freshLevelAt`.
- **`grounding/drawn-ground.ts`:** `DRAWN_GROUND_SEGMENTS`, the grid and its kept heights follow the switch.
- **`runtime/prebuild.ts`:** the worker URLs carry the world.
- **P2, second half (W1b):**
  - **The one sea** takes v2's depth field as it stands: the wild island's water material reads `halfSize` = TERRAIN_HALF (264) and the depth map from v2's ground arrays at build, and T3's town patch (`islandDepth`/`islandPatch`) lies outside v2's square (the town's square starts at x 363.6). Checked in stills: the lagoon and its crest, the drop-off and the strait read as before. On v2 the sea plane is 12 km across (v1 4 km): the whole views stand ~220 m up, so the frame's top meets the sea ~2.5 km out, past the old plane's edge.
  - **The fresh-water bed:** the ground shader's bed rule (underwater tint, caustics, the dull wet bed) uses each vertex's own fresh level on v2: `GroundArrays.freshBed` (`render/ground.ts`, a bank vertex takes its neighbours' level) as the `arkFreshLevel` attribute, which `streaming/ground-tiles.ts` copies only when the arrays carry it. Program key `ark-ground-3-snow52-bed`. v1's shader text, arrays and tiles are unchanged (hashed).
- **P6 (W1b):**
  - `islands/index.ts` `ARK_ISLANDS.wild` is a getter: v1's record, or v2's (half 264, 10 chunks, 11.9 ha, `WILD_ISLAND.home`). `ARK_ISLANDS.town` is a getter too, its `archipelago` the town's origin in the world in use (v1 508.6, −210.7; v2 601.2, −249), memoised per world.
  - **The default views** are a pure function now, `islands/views.ts` `wildHomeView(aspect, fov, town)`, with the frame per world in `wildFrame()`; `index.ts` homeView calls it. v1's numbers are today's, to the bit. v2:
    - desktop: fits a 204 m circle round (−10, 22), moved 70 m toward the town, turned 45 % of the way to it (the town upper right), polar 1.15;
    - upright phone: from 950 m whatever its width, aimed 130 m out from (−10, 0) toward the town, polar 0.9 (a little more from above): the island fills the lower part, the town the upper, and the town's far shore stays inside the low tier's 1,600 m map distance;
    - the camera's reach is 1,000 m on v2 from the first frame (v1: 340, then 900 with the town);
    - v2 opens on the two-island view: the town's place is known before it is built, so nothing moves when it joins.
  - `src/lib/ark-wild-frame.test.ts` holds it: v1's records, v2's records, the desktop view holding the whole coast and the town's land, the phone's across the strait, and no chunk of either island out or hazed from the default views on high, medium and low.
- **The reef on v2 (W1b, after P3):** `reef.ts` keeps its own patch reefs and the anemone and cleaning-station anchors round v2's reef site (−162, 154; 34 m), and on v2 adds the island generator's coral heads over the whole lagoon, its kelp in the cold north-west and its seagrass, each under the reef's own rules (corals on hard ground 1.9–10 m by depth band with their cover, seagrass 1.2–3.5 m, kelp reaching 0.4–1.2 m under the surface along the coast). v1's beach seagrass and cliff kelp (sections 3 and 4) are v1's only. The reef, its landmarks and the coast's cliffs drop on `onArkWorld`. v2: 5,023 items (v1 2,215).

### The split of the remaining work

| Step | Who | What |
|---|---|---|
| P2 | W1 | ground and water through the scene (done in terrain.ts; the world sea's depth patch with T3) |
| P3 | helper A (`ark-wild-scenery`) | `scenery.ts` → the motion pass's decor (`worldDecor`, `forestFill`, `grassTufts`, floor, rocks, mounds) on v2; L6 spacing, `drawnRocks`, L3 attach points, L5 colliders follow |
| P4, P5 | helper B (`ark-wild-map`) | the map stub's and the behaviour world's samplers on v2 (`half`/`centre` for `extentOf`), ranges and whale cells in `map/place.ts`, zone keys as the server's, the live validator (707 wild animals) |
| P6 | W1 | the frame: `WILD_REACH` from `wildReachToward` on v2 (the town moves out about 100 m, the strait stays 250 m), the default views on desktop and the upright phone |
| P7, P8 | whoever is last | the gates (tests, tsc, lint, a phone-profile memory and fps run, stills); placement final, then the positions atlas regenerated by the encounter lane (POSITIONS_VERSION through the coordinator) |

**Rules for v2 code:** key on `arkWorld()`; never copy a world value into a module constant at load (register `onArkWorld` if you must derive one); drop anything built from the world in an `onArkWorld` listener; keep v1 byte-identical (the tests hash it).

## 9. Decisions (rows for AnimalDex `docs/ark/DECISIONS.md`)

| Topic | Decision | Why |
|---|---|---|
| The square | 10 × 10 Part B chunks, 528 m (decision 21's 512 m on Part B's grid) | 8 × 8 of 52.8 m is 422 m: too little sea for the lagoon and the drop-off |
| Biomes | Landform zones first, then climate zones by a soft-max in (temperature, moisture) | Boundaries follow the fields' contours; transitions measured 18–47 m |
| The town-side coast | No cliffs within 30° of compass 67.5°; the whales' drop-off lies in the strait (decision 141) | The owner's one world: shore facing the town |
| Steep ground | Steeper than 0.82 only steep tags hold; steeper than 2.2 only the sky | No walker placed on a face it cannot walk |
| Homestead-only species | Their zone's fallback ground on the wild island; listed | The wild island has no buildings (§2.4) |
| Roosts the island lacks | Sleep at home (the schedule's own choice); listed | No houses; far kelp or rocky shore is out of reach |
| Big-animal ranges | 16 m apart, 7 m clear discs, gentle all round; land walkers ≥ 2.5 m | Decision 54, static |
| Whale cells | The east's drop-off, ≥ 15 m deep, 30 m apart, 14 m clear | Decision 53 carried to the new map |
| Snow line | 52 m on v2 (27 m on v1), patched in the ground material per world | The v2 peaks are 85 m |
| Fresh water | At its own levels, the river descending; a lighter lake colour | A 6 m lake and a river from 21 m |
| Attach points | Any body down to 0.1 mm (decision 55) on the island's points | The common rotifer |
| The world switch | Inside `world.ts`: global state, live bindings, `onArkWorld`, v2 implies no hamlet | About 60 modules import `world.ts` directly; no parallel scene |
| The fresh-water bed on v2 (W1b) | A per-vertex level (`freshBed`, attribute `arkFreshLevel`), over a uniform per mesh or sampling the depth map in the ground shader | The river descends from 21 m: one level per mesh is wrong; the attribute keeps v1's shader text and arrays as they are |
| `ARK_ISLANDS` on v2 (W1b) | Getters on `arkWorld()` over a v2 twin record | Callers keep `ARK_ISLANDS.wild`/`.town`; the town's origin read at use, not at module load (the world is chosen after the module loads) |
| The default views (W1b) | A pure `islands/views.ts` (`wildFrame`, `wildHomeView`) over keeping the math inside `mountArk` | Testable: the tests project the coast and the town through it and run Part B's streamer from its eye |
| v2's desktop view (W1b) | 204 m circle round (−10, 22), 70 m toward the town, polar 1.15 | The whole 411 m island and the town's land in frame, the town upper right, as v1's composition |
| v2's upright phone view (W1b) | 950 m out, aimed 130 m toward the town, polar 0.9 | Fitting the island's whole width puts the town's far shore past the low tier's 1,600 m map distance (hazed); this frames the island's width on a 390 × 557 canvas and keeps the town whole on every tier |
| v2's camera reach (W1b) | 1,000 m from the first frame (v1 unchanged: 340, then 900) | The phone's default view is 950 m out; v2 is islands mode only |
| v2 opens on the two-island view (W1b) | The town's origin is used before the town is built | No camera flight when the town joins a few seconds after the first frame |
| v2's sea plane (W1b) | 12 km (v1 4 km) | The whole views stand ~220 m up; the old plane's corners showed at the top of the frame |
| The reef on v2 (W1b) | The generator's lagoon-wide coral, kelp and seagrass through `reef.ts`, under its rules; the reef site's patch reefs and anchors kept | One path (`reef-render.ts`, `fish-schools.ts`, the map's landmarks) as A did the decor; the generator's own reef and kelp fields are v2's design |
| The workbench renderer (W1b) | `islands/wild/render/index.ts` kept for now | `scripts/ark-wild.mts` and the visual baselines (`tests/ark-visual/wild/`) use it; it is not on the page's path (only `loadWildIsland`'s dynamic import). Drop it with those after v2 is the default |

## 10. Handover (W1, then W1b, 2026-11-12): state, what is left, the next commands, the traps

**Branch:** landing `ark-wild-island-next`: `origin/ark-next` with `ark-wild-island`, helper A's `ark-wild-scenery` (P3) and helper B's `ark-wild-map` (P4, P5) merged in. W1b's worktree is `scratchpad/wt-wild-W1b` (detached, pushed with `git push origin HEAD:ark-wild-island-next`; `npm ci` done, `yarn.lock` restored after it; `public/ark-local/` links to wt-view's real data, never committed; `node scripts/build-ark-bundle.mjs` run so the dev page's workers exist). The integrator merges it only after the islands release is cut. Until then, keep merging `origin/ark-next` into it as that moves.

### Done

- **The island on its own** (§1–§7): generator, scenery, reserves, map sampler, sites, validator (0 failures), the workbench (stills, visual baselines), the archipelago hook.
- **P0:** merged onto `ark-next`; the wild tests pass there.
- **P1, the world switch** (§8): `world.ts` `arkWorld`, `setArkWorld`, `onArkWorld`, the live bindings, the per-world functions. Global state; v2 implies `setNoHamlet(true)`; the choice is read at load (`__ARK_WORLD__`, `?world=v2`, `ARK_WORLD=v2`); the prebuild workers' URLs carry it.
- **The archipelago's choice:** in islands mode only, `?wild=v2` or the `wildIsland: "v2"` option (`ArkArchipelagoOptions.wildIsland`) calls `setArkWorld("v2")` before the scene's modules load (`islands/archipelago.ts`). Islands off never calls it.
- **P2, ground and water** (W1, then W1b): v2's segments, arrays, snow line and fresh water at its own levels; the one sea with v2's depth field (checked in stills) and a 12 km plane on v2; the ground shader's fresh bed at each vertex's own level (§8).
- **P3** (helper A, merged 22c33056): the scenery through the motion pass (`islands/wild/decor-v2.ts`): 0 tree clashes over 1,350 bodies, 0 floating or intersecting props, 20,948 attach points, 3,574 colliders; collide audit on v2 (fixture, 2 h at 4 s): pass-throughs 0, fence crossings 0, cliffs 430, overlaps 1.54 M.
- **The reef on v2** (W1b): the generator's lagoon-wide coral, kelp and seagrass through `reef.ts` (§8).
- **P4, P5** (helper B, merged f61cbaaf): the map's and the behaviour world's samplers on v2, the walk mask v2, ranges and whale cells, the validator at 0 on v2 (synthetic 5,230; live 707; 3× 2,121; a year 2,884); placement of the live snapshot's 3,145 animals 14.8 s against v1's 12.0 s in the same run (decision 207).
- **P6** (W1, then W1b): the town's origin from `wildReachNow()` (601.2, −249 on v2); `ARK_ISLANDS` per world; the default views per world in `islands/views.ts` (§8).

### Left

- **P7, gates:** see the gate list in the coordinator's brief and the results below; the default switch (`archipelago.ts` `wildIslandAsked`: v2 unless `v1`) once they pass.
- **P8:** when placement is final (B says it is, from f61cbaaf), the coordinator has the encounter lane regenerate `atlas.json` (and POSITIONS_VERSION) with `ARK_WORLD=v2`. Don't edit those files.
- **The apps' embed** (`public/ark/embed.html`) mounts one island with `mountArk` and never calls `setArkWorld`: it stays v1 whatever islands mode says. With v2 the web default in islands mode, the apps and the web see different wild islands until the embed takes the archipelago (or `?world=v2`). That is the islands-on-the-apps lane's call; W1b checked only that `?world=v2` renders and frames the island alone there.
- **The workbench renderer** (`islands/wild/render/index.ts`, `entry.ts`, `scripts/ark-wild.mts`, `tests/ark-visual/wild/`): kept until v2 is the default; then retire it with its baselines.

### P7 results (W1b, 2026-11-12, `ark-wild-island-next` 4af53066)

| Gate | Result |
|---|---|
| v1 byte-identical | 22 hashes against `ark-next` (sampleGround, the world's constants, ground arrays and keys, the ground shader's vertex, fragment and key, the water shader, tiles, decor, fill, grass, floor, drawn and mountain rocks, mounds, attach points, colliders, reef and landmarks, the islands' records, the validator's places), islands off and no-hamlet: all identical (`scratchpad/w1b-v1-hash.mts`) |
| v1 tests | map, grounding, collide, behaviour build/recipes/schedule/state, islands, town, collide-town, streaming, wild island/scenery/map/frame, sea-depth, reef, prebuild, attach, no-hamlet, graphics: 216 pass, 0 fail (1 skipped) |
| Map validator, v2 | synthetic 0 failures (B: 5,230 animals); live islands mode 0 (707 wild animals, 440 species) |
| Collide audit, v2 (`--wild-island`, 2 h at 4 s) | live snapshot: pass-throughs 0, fences 0, cliffs 0, overlaps 21,115; **fixture (CI's): pass-throughs 34** (one common vampire bat at rest 0.17 m inside `rock:decor1273`, −71.2, −98.1), fences 0, cliffs 0, overlaps 1.07 M: with B |
| Tests with `ARK_WORLD=v2` | 36 of 167 fail. Not applicable (v1 constants or v1 fixture homes): streaming's v1 grid and views, town-island's frame, the hamlet's fences and paddocks, the recipes' fixture homes (the kingfisher at −70, 22…), the "v1 stays today's" tests, the garden pond. **Open, with B:** behaviour-schedule (a mallard's 5.1 m slot jump, an alligator's 8.5 m, flyers 2.45 turns a minute, 3.9 % circling), sea-depth (114–116 keep v1's lake rule), behaviour-build (node out of memory), grounding (a tent-making bat in a crown), map 93 (a v1 terrain swap). The reef's two are fixed. `ark-wild-island.test.ts` under `ARK_WORLD=v2` trips the load-order trap below (not a gate: it tests the generator itself) |
| tsc, eslint | 0; clean on the changed files |
| Phone (4× CPU, 360 × 800, islands mode, the live 3,145 animals, prebuild workers, production bundle, 90 s) | v2 low: peak heap 361 MB of 384, GPU 126 of 192, 60 fps, first frame 15.4 s, longest task 3.5 s. v2 medium: 439 of 512, 127 of 320, 54 fps, 16.1 s, 3.6 s. v1: low 222 MB / 104 MB / 55 fps / 17.7 s; medium 224 / 165 / 19 fps / 17.9 s. (`scripts/ark-runtime-measure.mjs --islands --world v2 --prebuild --population-file …`.) The phone's default view draws v2 all in map style (950 m out). The floor's plants were not thinned: they draw only in chunks that are in, and their instances are a few hundred KB of the heap |
| Stills | desktop and phone on the `/ark` page's own layout, day and night, the idle sway, underwater (lagoon, kelp), the biomes: `scratchpad/w1b-shots/` |
| Town join | the town's prebuild worker 35–74 s on v2, 102 s on v1 (dev page, production workers, load 15–18): T3's, the same on both worlds |

### Next commands

```sh
cd <worktree on ark-wild-island-next>
git fetch origin && git merge origin/ark-next            # keep current (docs, L5's audit fix before the cut)
npm ci && git checkout yarn.lock
npx tsc --noEmit -p tsconfig.json                          # only the 2 known header-menu errors
nice -n 10 npx tsx --test src/lib/ark-map.test.ts src/lib/ark-grounding.test.ts src/lib/ark-streaming.test.ts \
  src/lib/ark-islands.test.ts src/lib/ark-town-island.test.ts src/lib/ark-wild-island.test.ts src/lib/ark-sea-depth.test.ts \
  src/lib/ark-prebuild.test.ts src/lib/ark-collide.test.ts src/lib/ark-behaviour-build.test.ts      # v1: all pass
ARK_WORLD=v2 nice -n 10 npx tsx -e 'import("./src/ark-scene/world.ts").then((w) => console.log(w.arkWorld(), w.TERRAIN_HALF))'
nice -n 10 npx tsx scripts/ark-wild-plan.mts --out .ark-golden/wild               # the plan picture and numbers
nice -n 10 npx tsx scripts/ark-wild.mts stills --size 960x540                      # the workbench stills (Metal)
# The scene in islands mode on v2: wt-view's local real data (never commit public/ark-local):
#   /ark?snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json&wild=v2
```

### Traps

- **Choose the world before anything builds from it.** `setArkWorld` after a sample warns: any cache not registered with `onArkWorld` (decor, map points, the behaviour world, attach points, colliders) stays as built. In the page, the archipelago calls it before `import("@/ark-scene")`. The page's static imports evaluate `world.ts` as v1 first, which is fine only because they build nothing from it.
- **Never copy a world value into a module constant at load.** Read the live binding at use, or register `onArkWorld`. Known derived-at-load values that are now handled:
  - `terrain.ts` SEGMENTS;
  - `grounding/drawn-ground.ts` SIZE and SEGMENT;
  - `sea-depth.ts` LAKE_SWIM_RADIUS.

  Still v1-derived at load, all hamlet or v1-only:
  - `map/hamlet.ts` OTHER_SITES and HOME_SITE;
  - `map/world-sampler.ts` MOUTH (B's).
- **Module cycle:** `world.ts` → `islands/wild/world-v2.ts` → the wild generator → `world.ts`'s noise functions. These are hoisted function declarations, so the cycle is safe. Keep the wild generator's module-level code free of calls into `world.ts`, and of module-level `const`s that `sampleWildGround` reads (`ground.ts`'s VALLEY was moved inline for this).
- **`?world=v2` vs `?wild=v2`:**
  - `world=` is read by `world.ts` itself, meant for worker URLs and tests, and works even with islands off.
  - `wild=` is the page's review override, honoured only in islands mode.
- **Fresh water on v2 has its own levels** (the lake at 6 m, the river from 21 m down). Anything assuming fresh water at 0 is wrong on v2: the ground shader's bed tint, `sea-depth`'s lake test, `map/water.ts`. Use `freshLevelAt`.
- **The shared Mac:** render with `nice -n 10`; SwiftShader shots take minutes under load. Never `gradlew --stop`.
