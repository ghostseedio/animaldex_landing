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
