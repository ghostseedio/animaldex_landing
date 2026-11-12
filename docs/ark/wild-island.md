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
