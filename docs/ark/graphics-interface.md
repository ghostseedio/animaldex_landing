# Ark scenery interface (for the map, behaviour, props and liveliness lanes)

The graphics pass owns the terrain and scenery (branch `ark-graphics`). Other lanes place things on it only through `src/ark-scene/sampler.ts`. The signatures below stay stable; what is underneath (heights, trees, the house) changes with each batch.

## Surface

`surfaceAt(x, z, environment?) → {height, normal, surface, weights, wetness, waterDepth, zone, cliff}`

- `surface` and `weights` use the ground shader's own layers: `grass, forest_floor, soil, sand, wet_sand, rock, mud, snow, tilled, seabed, lakebed`.
- `wetness` (0–1) covers the waterline, mud and banks, plus the weather's wetness. Footprints and sheen read it.
- `waterDepth` is measured at the given sea level, so the tide is included.
- **Snow** (2026-11-11, `snow.ts`, re-derived for graphics batch 5's ribs and crisper edge): follows the terrain shader's rule: the ice's own layer, and the mountain's snow above a line at 27 m that the weather's snow cover (`environment.snow`) brings down 12 m, held on all but the steepest faces. `surface` is `snow` only where the shader draws snow whatever its per-pixel noise does, and never where it may not; `weights.snow` is the expected drawn cover. (Before, a band from 19 to 25.5 m, and snow cover painted everything.) The patches of snow on the ledges below the line are not counted. `ark-attach.test` holds snow.ts to terrain.ts's lines.
- `groundNormal(x, z)` and `shoreRadius(theta)` are helpers.

## Named places

`place(name) → {x, y, z, radius, facing?}`. Available names: `island_middle, beach, shore_rocks, tide_pools, visitor_landing, forest_floor, rainforest, woodland, house, house_porch_light, garden_pond, fields, lake, river_source, river_mouth, wetland, grassland, desert, mountain, mountain_peak, cold_cove, reef, open_ocean, cave`.

- `cave` (added 2026-11-11): the props lane's cave site (`CAVE_SITE`), a rock outcrop on flat open ground at the ice's edge below the mountain. `y` is its floor; `facing` is the way out of its mouth (radians about y, three's convention: local +z → (sin, cos)), toward the island's middle. The test checks the site stays flat (within 0.3 m over 4.5 m) and clear of decor and forest fill (6.5 m).

The map build keeps these names and moves their positions. Golden shots and spawn rules use names, never coordinates.

## Attach points

`attachPoints({tag?, spot?, near?, size?, zone?}) → AttachPoint[]`; `allAttachPoints()` returns all of them.

**Building them without a long task (2026-11-11).** The points are built once, on first use: about 0.3 s on the phone profile (4× CPU) and 0.1 s on a desktop, in one go. Call `prepareAttachPoints(sliceMs = 6) → Promise<AttachPoint[]>` at mount instead: it builds them a slice a frame (at most about 6 ms each; 7 ms measured on the phone profile, 46 slices). A synchronous `allAttachPoints()` while that runs finishes the build at once. The points, their ids and their order are the same either way (`ark-attach.test`).

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

Tree points (`leaf`, `bark`, `branch`, `tree_hollow`) also carry, all optional (added 2026-11-11, `ark-graphics-attach`):
- `asset`: the asset tree they are on (`oak-a`);
- `forward`: along the surface (a leaf's midrib base → tip, up the trunk, along the branch);
- `open`: 0–1, the share of sight lines within 40° of out-and-up that leave the tree unblocked (how visible the point is from outside the tree);
- `leaf`: `blade` (a single leaf) or `clump` (the crown's leaf mass), on leaves;
- `depth`: how deep the hole runs into the trunk (m), on hollows;
- `radius`: the limb's radius there (m), on `limb`, `canopy_perch` and `canopy_hang`;
- `load`: about what the limb holds there (kg), on `limb` (`limbLoad(radius, arm)`: a cantilever in green wood, 20 MPa, the lever being the distance out from the trunk; a 10 cm thick limb 1 m out holds about 200 kg, a 6 cm one about 40 kg). An estimate for matching animal to limb;
- `clearAbove`: the clear room above a `limb`, to the tree's wood (m, up to 3);
- `clearBelow`: the clear drop below a `limb` or `canopy_hang`, to anything of its tree or the ground (m);
- `wind`: how the tree's wind moves the point (see below).

Points are seeded, so every viewer gets the same ones. Since 2026-11-11 each host (a tree, a rock, the house, the pond, the ground's own search) draws from its own seeded stream, so a change to one part of the scenery moves only the points on it. `src/lib/ark-attach.test.ts` keeps a baseline (`src/lib/ark-attach-baseline.json`) of each host's points keyed to what they are made from (its item, its asset and that asset's data, the ground round it; the terrain for the ground's points): a host whose scenery changed may move, any other may not. Re-record it (`ARK_ATTACH_BASELINE=write npx tsx --test src/lib/ark-attach.test.ts`) only after a deliberate change to the points.

| tag | spot | where |
|---|---|---|
| `leaf` | canopy | on the drawn leaves of each asset tree (lod0), on top of the leaf over its middle, facing along its midrib |
| `branch` | canopy | on top of the drawn branches' wood, where it faces the sky |
| `bark` | bark | on the drawn trunk's wood, facing out, forward up the trunk |
| `tree_hollow` | bark | the middle of the mouth of each hole drawn in the oaks' and snags' trunks (from attach.json), facing out of the hole, with its `depth`: parrots, owls, a bees' hollow (added 2026-11-11) |
| `canopy_perch`, `canopy_hang`, `canopy_climb` | canopy | the 16 canopy trees' limbs (2 mm over the top, 2 mm under the underside of the limb as drawn, with `radius`) and trunk. `canopy_hang` also on the asset trees (added 2026-11-11): the underside of a thick limb (radius 3 cm and up) where nothing of the tree is below for at least 1.2 m (`clearBelow`, which also counts the ground): bats, hanging sloths; up to 4 a tree. The canopy trees' points moved down onto the limbs as drawn (they sat 8 cm high: a hanging bat was inside the limb) |
| `limb` | canopy | for large climbers (added 2026-11-11: sloths, orangutans, tree kangaroos, koalas): the top of thick (radius 3 cm and up), not too steep (top normal y ≥ 0.6) wood up in the asset trees every tier draws, not on palms. Each has `radius`, `load`, `clearAbove` and `clearBelow`; `size` is [0.15, min(1.6, 24 × radius)]. Up to 10 a tree, at least 0.9 m apart, thickest first: about 1,800 points (the forests alone have hundreds, on 60+ trees). Match an animal to a limb by `radius` and `load` |
| `fence_post` | house | the top of each fence post, 2 mm up, up is up, `forward` along the fence (added 2026-11-11): the props lane's paddock (post and rail) and garden picket fences on the home plots (`fence_post:paddock:<n>`, `fence_post:picket:<n>`, from `props/home-layout.ts` `fencePostTops(plots)`; 15 and 20 today), and any decor fences (vegetation.ts `fence`, one post where segments meet; none on today's map). The plots are an input: `setAttachHomePlots(plots)` (the props module's `setHomePlots` passes the map's `homePlots()` on) rebuilds the points on next use; set them before the points are first read |
| `roof_edge` | house | along the cottage's ridge cap and its two eaves' top edges, and the barn's ridge and eaves; up is up, `forward` along the edge (added 2026-11-11): perching birds, basking lizards |
| `flower_head` | flowers | the top of each flower |
| `rock_face` | rocks | round every rock, 2 mm off the flat faces vegetation.ts draws (`drawnRockPoint`), facing out |
| `tide_pool` | rocks | at the foot of the shore's low rocks |
| `house_wall`, `house_eave` | house | the cottage's four walls; under its eaves, 4 mm below the drawn roof (the long walls under the slope, 0.21 m out; the gable ends under the verge's peak) |
| `porch_light`, `lamp` | lamp | the porch light and each zone's lamp post |
| `pond_surface` | pond_surface | the garden pond and the lake's margin |
| `leaf_litter` | leaf_litter | the forest floor |
| `worm_hole`, `burrow` | burrow | soft open ground, and banks |
| `ledge` | rocks | cliff and rock shelves where a bird nests or perches (added 2026-11-11): steep ground on the sea cliffs, the mountain and the ice (`ledge:ground:N`, the props lane's search and seed, so its ids are unchanged), and the flat tops of the big shore, mountain and ice rocks (`ledge:decorN:0`). The normal is up (the animal stands on the shelf); `forward` and the yaw face out of the slope, or away from the island's middle on a rock. A nest prop on a cliff ledge turns by `forward`, not the normal. |

### Trees: on the real geometry (2026-11-11)

- **Source.** The asset lane's `public/ark/assets/v1/trees/attach.json` says where on each tree; `scripts/ark-tree-attach.mjs` moves every leaf, bark and branch point onto the drawn lod0 surface of that tree and records the surface's wind weights there, into `src/ark-scene/tree-attach.json`. attach.json's own leaf points sit up to 0.46 m off the drawn leaves (they are computed before the level-of-detail cut and the leaves' fold, curl and growth), so they are not used raw. **When the asset lane rebuilds the trees, run `node scripts/ark-tree-attach.mjs`** (`--check` says whether it is needed); `src/lib/ark-attach.test.ts` fails until then.
- **Placement.** `tree-assets.ts` `assetTreePlacement(item)` is the one place a tree's instance (position, turn, scale) is decided; `asset-trees.ts` draws from it and `treeAttachPoints(item)` puts the points on it, so the two always agree.
- **Which trees.** Every decor tree, and the forest fill up to rank `EVERY_TIER_FILL` (0.3, the share the low tier draws), so an animal on a tree never floats where a lighter tier leaves its tree out. Per tree: up to 12 leaves, 6 bark and 8 branch points (pines and snags have no leaf points: needles and bare wood).
- **Detail.** A tree is drawn at lod0 whenever the camera is within 2.5 m of its bounds (`treeLodDistance`, `TREE_CLOSE`), so the leaf under a close-up is always the one the point is on.
- **Leaf size.** A leaf point takes animals up to 12 cm, whatever the leaf.
- **Every other point** (the house walls, lamps, ponds, the ground, the canopy trees) keeps the id and position it had before. The four eave points keep their ids but moved under the drawn roof (they sat above it on the long walls and in mid-air at the gables).

### Scaling the climbers' points

The owner's captures will bring many more animals aboard. The climbers' points scale by data, not code: each asset tree holds up to 16 `limb` and 8 `canopy_hang` candidates (`scripts/ark-tree-attach.mjs`), of which the sampler keeps up to `TREE_CAP.limb` (10) and `TREE_CAP.canopy_hang` (4) on each tree drawn at every tier. Raise those caps (and the generator's 16/8, 0.9 m spacing) for more; or let small climbers share a thick limb by `load`. The fill trees past rank 0.3 carry none (the low tier does not draw them): raising `EVERY_TIER_FILL` needs the low tier to draw more fill.

### Wind: an animal on a leaf moves with the leaf

`attachPointAt(point, time, wind) → Vec3` is where the point is now; `attachSway(point, time, wind)` is the offset. Pass the shader's own clock and wind, `ARK_TIME.value` and `ARK_WIND.value` (glsl.ts): the result is the tree shader's sway and leaf flutter at that point, so an animal set there each frame stays on its leaf (a leaf moves 2–6 cm in a storm, more than a small animal's length). Points on still hosts return no sway. This is drawing only: the time is the viewer's scene clock, and nothing shared depends on it. `treeSway` in `tree-assets.ts` is the CPU twin of `asset-trees.ts` windMaterial; the test fails if the shader's wind lines change without it.

**Rocks (batch 5):** every decor rock is drawn as one of the asset lane's rocks (`rock-assets.ts` `rockAssetFor(item)`: same place, turn and footprint; tide-pool rocks and barnacled clusters on the shore, mossy boulders in the woods and by the water, boulders and clusters elsewhere). A rock's `rock_face` points keep their ids (`rock_face:decor<i>:<k>`, four per rock) and now sit on the asset's own faces and ledges (`rockAttachPoints(placement)`, from the asset's attach.json, measured on the drawn lod0 surface), choosing faces that look outward. The assets also carry `ledge`, `crevice`, `burrow_entrance` and `tide_pool` points: `rockAttachPoints` returns them all, for any lane that wants them. When `ark-graphics-attach` is merged, its `drawnRockPoint` (the procedural rock's triangles) applies only where `rockAssetFor` returns null (the rock set missing).

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

