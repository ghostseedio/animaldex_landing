# Ark scenery interface (for the map, behaviour, props and liveliness lanes)

The graphics pass owns the terrain and scenery (branch `ark-graphics`). Other lanes place things on it only through `src/ark-scene/sampler.ts`. The signatures below stay stable; what is underneath (heights, trees, the house) changes with each batch.

## Surface

`surfaceAt(x, z, environment?) → {height, normal, surface, weights, wetness, waterDepth, zone, cliff}`

- `surface` and `weights` use the ground shader's own layers: `grass, forest_floor, soil, sand, wet_sand, rock, mud, snow, tilled, seabed, lakebed`.
- `wetness` (0–1) covers the waterline, mud and banks, plus the weather's wetness. Footprints and sheen read it.
- `waterDepth` is measured at the given sea level, so the tide is included.
- `groundNormal(x, z)` and `shoreRadius(theta)` are helpers.

## Named places

`place(name) → {x, y, z, radius}`. Available names: `island_middle, beach, shore_rocks, tide_pools, visitor_landing, forest_floor, rainforest, woodland, house, house_porch_light, garden_pond, fields, lake, river_source, river_mouth, wetland, grassland, desert, mountain, mountain_peak, cold_cove, reef, open_ocean`.

The map build keeps these names and moves their positions. Golden shots and spawn rules use names, never coordinates.

## Attach points

`attachPoints({tag?, spot?, near?, size?, zone?}) → AttachPoint[]`; `allAttachPoints()` returns all of them.

Each point has:
- `id`: stable, `<tag>:<host>:<n>`;
- `tag`;
- `spot`: the microhabitats.json / layers.json tag;
- `position`;
- `normal`: the animal's up;
- `yaw`: its heading round the normal;
- `size`: [min, max] body length in metres;
- `zone`;
- `host`: what the point sits on.

Points are seeded, so every viewer gets the same ones.

| tag | spot | where |
|---|---|---|
| `leaf`, `branch` | canopy | round every tree's crown (the decor trees and the forest fill) |
| `bark` | bark | trunks, facing out |
| `canopy_perch`, `canopy_hang`, `canopy_climb` | canopy | the canopy trees' limbs (on top, under) and trunk |
| `flower_head` | flowers | the top of each flower |
| `rock_face` | rocks | round every rock |
| `tide_pool` | rocks | at the foot of the shore's low rocks |
| `house_wall`, `house_eave` | house | the cottage's four walls and its eaves |
| `porch_light`, `lamp` | lamp | the porch light and each zone's lamp post |
| `pond_surface` | pond_surface | the garden pond and the lake's margin |
| `leaf_litter` | leaf_litter | the forest floor |
| `worm_hole`, `burrow` | burrow | soft open ground, and banks |

**Coming next:** up close, the leaf, flower head, bark patch or rock face round the camera is swapped for a detailed near version that an animal can sit on. The asset lane's models will bring their own tagged points, merged into the same list.

## Weather and tide

The scene follows the shared island clock (`src/lib/ark-clock.ts`):
- the hour is `islandHours(Date.now(), 0)`, the same for every viewer;
- sea level comes from `seaLevelAt`;
- wetness, snow, wind and storm come from `weatherAt`.

`handle.setEnvironment({seaLevel, wetness, snow, wind, storm, windDirection})` pins any of these, and `null` follows the clock again. `handle.setHours(h)` pins the hour. Golden shots pin both.

The shaders read `ARK_ENV` (`glsl.ts`):
- the water reads sea level and roughness;
- the ground reads wetness and the snow line;
- the foliage reads the wind's strength through `ARK_WIND`.

## Under the sea (graphics batch 4, branch `ark-graphics-reef`)

Pure and deterministic, like the rest of this file: no three.js, no DOM, the same answer for every viewer.

### Reef growth (`src/ark-scene/reef.ts`)

- `reefGrowth() → ReefItem[]`: every coral, sponge, anemone, kelp plant and seagrass clump, with `kind`, `variant`, position (`y` is the bed), `scale`, `rotation`, `depth` (water over it at mean tide) and `substrate` (`reef | rock | rubble | sand`).
- `seaBedAt(x, z) → {depth, height, slope, substrate, reef, framework, shore, inland, cliff}`: what the sea bed is made of there.
- `reefLandmarks() → {anemones, cleaning, heads}`: the anemone patch and the cleaning station (the map lane's `anemone` and `cleaner_station` anchors, same positions), and the biggest coral heads with the height of their crowns (`top`).
- `REEF_HEIGHT[kind]`: each kind's height at scale 1, so a lane that puts an animal on a coral head can find its crown.

Placement rules: nothing stony shallower than 1.9 m (`CORAL_MIN_DEPTH`) or nearer than 0.9 m to the mean surface; corals on the reef's hard ground (patch reefs and rocky slopes) by depth band; seagrass on sand at 1.2–3.5 m (the lagoon, and patchy meadows off the beach); kelp on rock off the cliff coasts at 2.2–9 m. The map lane's tags (`coral_reef`, `seagrass`, `kelp`) use the same rules.

### Ambient fish schools (`src/ark-scene/fish-schools.ts`)

Decoration only, NOT catalogue animals: never counted, never selectable, never in the stats or the snapshot. Every fish's place is a closed-form function of the shared clock (epoch seconds) and its school's id: no simulation state, no per-viewer randomness.

- `fishSchoolsNear(pos, radius, epochSeconds?) → FishSchoolNow[]`: the schools whose middle is within `radius` of `pos` (y ignored if not given), nearest first. Each has:
  - `id` (stable, `fish:<habitat>:<n>`), `kind` (the look), `habitat` (`reef | reef_edge | open_water | kelp | shallows`), `style` (`school | roam | hover`);
  - `centre` {x, y, z}, `radius` (m), `heading` (unit, horizontal), `speed` (m/s), `count`;
  - `mode`: `"mill"` while it is balled up (a bait ball: what a predator chases), `"cruise"` streaming along, `"hover"` over its coral head; `milling` 0…1 as it eases in and out.
- `fishSchools()`: the static list (homes, ranges, sizes); `fishSchoolAt(school, epochSeconds?)`: one school now.
- `schoolFish(school, epochSeconds?) → Vec3[]`: every fish's position (for a predator picking one to lunge at).
- `seaEpochSeconds()`: the sea's clock (epoch seconds; golden shots pin it with `pinSeaClock`). Pass your own epoch to ask about any moment: the same epoch always gives the same answer.

Bait schools mill on seeded 50 s slots of the clock (about a third of the time for the reef-edge and open-water schools). Behaviour lanes that want a predator to chase a bait ball, or a bird or seal to fish, read `fishSchoolsNear` and steer their animal to `centre`. Nothing is caught and nothing changes in the ecology.

#### Chasers: fish split round a hunter (optional input)

- `setFishChasers(() => chasers)` (`src/ark-scene/fish-render.ts`) takes a function, read once a frame, that returns `Array<{x, y, z, r}>`: each hunter's position and reach in metres. The recipes lane's `recipeScene.chasers` has exactly this shape: `r = max(length × 2.5, 0.8)`, and the array is rebuilt each frame, so pass the function, not the array. `null` clears it. Typical hook, one line where the recipe scene is built: `setFishChasers(() => recipeScene.chasers)`.
- The fish near a chaser split round it, flee and rejoin behind it. This uses `fleeFrom(p, chasers, offset, flee)` in `fish-schools.ts`, which is pure:
  - Each fish inside a chaser's reach (`r + 0.6` m) is pushed straight out from it, by half the reach at the middle down to nothing at the edge: `(1 − d/reach)²`. The push up or down is 0.6 of the push sideways.
  - The school opens a hole of half the reach round the hunter. It never folds over itself: a fish nearer the hunter always stays nearer.
  - It closes again behind the hunter as it passes.
  - Each fish is also turned away from the hunter: a flee velocity is added to its heading, and its tail beats harder.
- The shared closed-form motion stays the base, and the flight is an offset from it. It depends only on the chaser positions, so everyone who sees the same chasers sees the same flight. It applies only to the schools drawn near the camera; far schools, and every school when there are no chasers, are exactly the shared motion.

