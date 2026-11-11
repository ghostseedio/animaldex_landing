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
- `yaw`: its heading round the normal. A model is set on a point with quaternion = `setFromUnitVectors(+y, normal) · rotationY(yaw)`; `yawFor(normal, forward)` gives the yaw that points the model's +z along `forward`;
- `size`: [min, max] body length in metres;
- `zone`;
- `host`: what the point sits on;
- `hostKind`: the host's decor kind (`broadleaf`, `rock`, …), `house`, `lamp`, `pond`, `lake` or `ground`.

Tree points (`leaf`, `bark`, `branch`) also carry, all optional (added 2026-11-11, `ark-graphics-attach`):
- `asset`: the asset tree they are on (`oak-a`);
- `forward`: along the surface (a leaf's midrib base → tip, up the trunk, along the branch);
- `open`: 0–1, the share of sight lines within 40° of out-and-up that leave the tree unblocked (how visible the point is from outside the tree);
- `leaf`: `blade` (a single leaf) or `clump` (the crown's leaf mass), on leaves;
- `wind`: how the tree's wind moves the point (see below).

Points are seeded, so every viewer gets the same ones.

| tag | spot | where |
|---|---|---|
| `leaf` | canopy | on the drawn leaves of each asset tree (lod0), on top of the leaf over its middle, facing along its midrib |
| `branch` | canopy | on top of the drawn branches' wood, where it faces the sky |
| `bark` | bark | on the drawn trunk's wood, facing out, forward up the trunk |
| `canopy_perch`, `canopy_hang`, `canopy_climb` | canopy | the canopy trees' limbs (on top, under) and trunk |
| `flower_head` | flowers | the top of each flower |
| `rock_face` | rocks | round every rock |
| `tide_pool` | rocks | at the foot of the shore's low rocks |
| `house_wall`, `house_eave` | house | the cottage's four walls and its eaves |
| `porch_light`, `lamp` | lamp | the porch light and each zone's lamp post |
| `pond_surface` | pond_surface | the garden pond and the lake's margin |
| `leaf_litter` | leaf_litter | the forest floor |
| `worm_hole`, `burrow` | burrow | soft open ground, and banks |

### Trees: on the real geometry (2026-11-11)

- **Source.** The asset lane's `public/ark/assets/v1/trees/attach.json` says where on each tree; `scripts/ark-tree-attach.mjs` moves every leaf, bark and branch point onto the drawn lod0 surface of that tree and records the surface's wind weights there, into `src/ark-scene/tree-attach.json`. attach.json's own leaf points sit up to 0.46 m off the drawn leaves (they are computed before the level-of-detail cut and the leaves' fold, curl and growth), so they are not used raw. **When the asset lane rebuilds the trees, run `node scripts/ark-tree-attach.mjs`** (`--check` says whether it is needed); `src/lib/ark-attach.test.ts` fails until then.
- **Placement.** `tree-assets.ts` `assetTreePlacement(item)` is the one place a tree's instance (position, turn, scale) is decided; `asset-trees.ts` draws from it and `treeAttachPoints(item)` puts the points on it, so the two always agree.
- **Which trees.** Every decor tree, and the forest fill up to rank `EVERY_TIER_FILL` (0.3, the share the low tier draws), so an animal on a tree never floats where a lighter tier leaves its tree out. Per tree: up to 12 leaves, 6 bark and 8 branch points (pines and snags have no leaf points: needles and bare wood).
- **Detail.** A tree is drawn at lod0 whenever the camera is within 2.5 m of its bounds (`treeLodDistance`, `TREE_CLOSE`), so the leaf under a close-up is always the one the point is on.
- **Leaf size.** A leaf point takes animals up to 12 cm, whatever the leaf.
- **Every other point** (rocks, the house, lamps, ponds, the ground, the canopy trees) keeps the id and position it had before.

### Wind: an animal on a leaf moves with the leaf

`attachPointAt(point, time, wind) → Vec3` is where the point is now; `attachSway(point, time, wind)` is the offset. Pass the shader's own clock and wind, `ARK_TIME.value` and `ARK_WIND.value` (glsl.ts): the result is the tree shader's sway and leaf flutter at that point, so an animal set there each frame stays on its leaf (a leaf moves 2–6 cm in a storm, more than a small animal's length). Points on still hosts return no sway. This is drawing only: the time is the viewer's scene clock, and nothing shared depends on it. `treeSway` in `tree-assets.ts` is the CPU twin of `asset-trees.ts` windMaterial; the test fails if the shader's wind lines change without it.

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
