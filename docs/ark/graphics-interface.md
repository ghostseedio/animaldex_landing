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

## The shared clock (runtime lane)

Everything that moves on its own runs on one clock, the same for every viewer (`src/ark-scene/shared-clock.ts`). Before, `ARK_TIME` was seconds since the page opened, so two people saw different wave and sway phases, and an animal riding `attachPointAt` swayed differently on each screen.

- **The shader time** `ARK_TIME.value` is epoch seconds from an origin that is a whole number of **600 s windows** (`ARK_TIME_PERIOD`; the reef lane's sea clock uses the same window). It starts under 600 when the page opens and grows with the visit, like the old clock, so float precision in the shaders is as before. It **never wraps while anyone is looking** (no seam to hide): it is brought back down by whole windows only at a moment nobody sees, when the scene is hidden or paused, once it has passed an hour (`ArkShaderClock.rebase`).
- **The rule for shared motion:** a periodic term is the same on every screen when its angular frequency makes a whole number of cycles in 600 s: `arkWholeCycles(f)` rounds one (steps of 2π/600 ≈ 0.01047 rad/s, under 1 % from any frequency above 1 rad/s, so nothing looks different). A `fract(t * rate)` loop: `arkWholeLoops(rate)` (whole loops in 600 s). CPU twins of shader motion (`treeSway`, fish schools) take `ARK_TIME.value`, or `arkWindowSeconds()` (epoch mod 600): for aligned terms both give the same phase.
- **The animals' idle clock** `ARK_CLOCK.value` (animal-material.ts) is epoch seconds mod an hour: shared, wrapping at the top of each UTC hour for everyone at once (it wrapped hourly per viewer before).
- **Pinning:** `pinArkClock(epochSeconds)` runs the shared clock from a fixed second (golden shots, recordings); `null` follows the real clock again. The visual CI freezes `Date.now` itself.

Consumers whose frequencies are not yet whole cycles (each owner rounds its constants with `arkWholeCycles`; until then the term moves smoothly but its phase differs between viewers who opened in different 10-minute windows):

| Where (owner) | Now (rad/s) | Whole cycles in 600 s |
|---|---|---|
| vegetation.ts foliage sway (graphics) | 1.5, 2.9 | 1.49749, 2.90074 |
| vegetation.ts leaf flutter (graphics) | 6.3, 5.1, 5.7 | 6.30413, 5.09985, 5.69675 |
| tree-assets.ts `treeSway` and asset-trees.ts windMaterial (graphics attach; keep the two equal, `ark-attach.test.ts`) | 1.25, 2.6, 7.1, 6.3, 6.7 | 1.24617, 2.59705, 7.10000, 6.30413, 6.70206 |
| terrain.ts shore foam phase (graphics) | 0.42 | 0.41888 |
| terrain.ts `arkCausticAt` (graphics) | 0.55, 0.47 | 0.55501, 0.47124 |
| terrain.ts `waves()`: ω = 0.55·√(9.8 f), f = 0.42, 0.67, 1.13, 1.71 (graphics) | 1.1158, 1.4093, 1.8303, 2.2515 | 1.12050, 1.41372, 1.83260, 2.25147 (set ω directly) |
| terrain.ts depth lines (graphics) | 1.4 | 1.40324 |
| marks.ts ring pulse, dot breathe (scene) | 2.2, 1.8 | 2.19911, 1.80118 |
| life.ts mote glow (scene) | 2.0 | 2.00015 |
| props/effects.ts drift, twinkle (props) | 0.7, 0.6, 1.5 | 0.70162, 0.59690, 1.49749 |

Already shared: props/effects.ts `fract(t·0.11)` and `fract(t·0.05)` (66 and 30 loops in 600 s); the reef lane's fish schools and corals (built on the 600 s window).

Not periodic, so not shared by rounding: per-particle frequencies (`t·(1.6 + seed·1.4)` in effects.ts, `t·(0.25 + seed·0.25)` in life.ts, the stars' `t·(1.5 + h·3)`; per-seed randomness anyway, nobody compares a twinkle) and the noise patterns scrolled by the wind (cloud shadows `CLOUD_GLSL`, the sky's clouds in lighting.ts, the water's lace, streaks, rapids and river flow in terrain.ts). Those move smoothly with no seam; to share them too, the noise needs a tile period P (`arkHash` of the lattice coordinate mod P) and each scroll's distance over 600 s a whole number of tiles, the wind's part integrated on the CPU from the island clock's weather rather than `arkWind · arkTime`. That is a graphics-lane change; it is listed here, not made.
