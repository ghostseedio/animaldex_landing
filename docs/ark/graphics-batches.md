# Ark graphics pass: batches

Branch `ark-graphics`. Direction: "detailed, slightly stylised natural" (the options are in `graphics-step1.md`). The owner skipped the review stops, so each batch goes straight into the live scene on this branch. Nothing is deployed.

Golden shots: `node scripts/ark-golden-shots.mjs --label <name>` (add `--devices phone --gpu swiftshader` for the GPU-limited proxy). There are 11 named places × day/dusk/night, on desktop (1440×900, M3 Max) and on the phone profile (360×800, DPR 2, 4× CPU, medium tier).

The SwiftShader proxy is a relative GPU-cost index. It runs far slower than a real phone GPU. No real phone has been measured yet.

Measurement caveat: from batch 2 on, other lanes ran `tsc` and Blender on the same Mac during the runs, so CPU-side numbers are noisier.

## Batch 1: quick wins (371ed5da, fixes 188abb4b)

- **Ground:** nine CC0 texture sets (Poly Haven) in two texture arrays:
  - blended by height, slope and zone, with anti-tiling, normal maps and triplanar rock;
  - detail fades out far away;
  - the low tier uses one sample and no normals.
- **Light:**
  - the CC0 HDRI lights the day;
  - bright blue moonlight with a cool fill and softer moon shadows;
  - the vignette and tilt-shift turned right down.
- **Water:** turquoise shallows to deep blue, a bluer reflection, a sheen, wider foam.
- **Trees:**
  - leaf-card crowns;
  - a forest fill of 466 trees and 205 shrubs, drawn 100/60/30% by tier;
  - finer grass, twice the tufts.
- **Rocks:** triplanar CC0 rock, moss, a wet waterline, a salt line.
- **Tiers:** the auto-drop counts slow frames.
- **Island time and weather:** `src/lib/ark-clock.ts` (from `ark-liveliness`) sets the hour, sea level, wetness, snow, wind and cloud for everyone.
- **Interface:** `src/ark-scene/sampler.ts`, documented in `graphics-interface.md`.

| Run | fps (median) | Draw calls | Triangles | Tier |
|---|---|---|---|---|
| desktop, before → batch 1 | 60 → 60 | 121–338 → 106–336 | 0.84–1.6 M → 2.5–4.5 M | high |
| phone 4× CPU, before → batch 1 | 60 → 60 | 49–156 → 46–153 | 0.41–0.66 M → 0.97–1.47 M | medium |
| SwiftShader proxy, before → batch 1 | 5 (stuck on medium) → 12 (drops to low) | | | |

## Batch 2: depth (ef1bc7c1 and on)

- **Terrain:**
  - hills in the forests and grassland;
  - the river in a valley with a U-shaped bed;
  - the mountain a massif with peaks, ridges and gullies;
  - the treeline at 30 m.
- **Snow:** per pixel above a wandering snow line, off steep faces, wind streaks; the weather's snow cover lowers it.
- **Sky:** a cloud dome, a moon disc, a bluer day horizon, a warmer dusk; dither in the grade (no banding).
- **Under water:**
  - the bed absorbs light with depth, with ripples;
  - dimmer sun, exponential blue-green fog;
  - Snell's window on the surface from below; softer light shafts.
- **Beach:** the swash runs up the sand as a wet film with lace foam.
- **River:** ripples carried downstream, foam streaks and rapids over the shallows.
- **Close-up detail (`near-detail.ts`):**
  - pebbles, sparse shells, the strandline, leaves, twigs, pinecones, ferns, mushrooms and clover;
  - deterministic 2 m cells round the camera, 100/60/35% by tier.
- **Trees:** scaled to the cottage (×1.15–1.6); leaves flutter; foliage lit on both sides.
- **Flowers:** five-petal roses and open cups.
- **Other:** muted corals, kept out of the beach's shallows; greener grass.

Same-conditions A/B, batch 1 (188abb4b) against batch 2 (54f3ac3f). The runs were interleaved (A, B, A, B) on the loaded Mac, with three shots each:

| | GPU drain ms (desktop) | Scene CPU ms (desktop) | GPU drain ms (phone, medium) | Scene CPU ms (phone, 4×) |
|---|---|---|---|---|
| batch 1 | 12.4–14.7 | 2.1–3.1 | 4.3–8.2 | 7.5–11.1 |
| batch 2 | 13.9–16.8 (about +12%) | 2.6–3.0 (about +15%) | 4.8–8.1 (about +5%) | 8.4–11.0 (about +12%) |

Every run held 60 fps. Under that load the phone profile sometimes dropped itself to the low tier when it loaded, for both batches alike.

Golden shots added: `waves_beach` and `storm_trees`, each in its own pinned weather.

Still open:
- `caterpillar_leaf` needs leaf points taken from the real crown geometry. The asset lane's trees bring tagged points.
- Kelp and seagrass are still flat cards (asset lane).

## Batch 3: polish, trees, tiers (da20c767 and on)

- **Trees:** the asset lane's library (`ark-assets` 43ab2e2c, merged) replaces every decor and forest-fill tree. Zone decides the kind:
  - oak, beech, birch, willow and snag;
  - mangrove where the forest meets water;
  - rainforest emergents of every size;
  - pine and spruce, acacia, palm, apple.
- **Tree rendering (`asset-trees.ts`):**
  - instanced per tree and detail level (lod0, lod1, lod2, card), re-sorted as the camera moves;
  - level reach 1 / 0.45 / 0.3 by tier;
  - sway from the assets' own wind weights (trunk, branch, leaf flutter), stronger in wind and storms;
  - none on bare rock faces high on the mountain;
  - the procedural shapes stand in until the assets load.
- **Shared tree mapping:** `tree-assets.ts` is pure, so the renderer, `micro.ts` (bark animals climb the asset trunks) and the sampler agree on every tree.
- **Mountain:** foothills and two flanking summits beyond the mountain zone make a broad, many-peaked range (main peak 49 m, flanks 42–43 m). Snow lies above 27 m and holds on all but the steepest faces.
- **Light:** lamp halos are about 7° across close up, and dimmer. The image-based light dips gently at the photographed/generated sky handover (sun 12° up), so dusk and dawn never pop.
- **Swash:** the lace is soft and broken.
- **Labels:** region labels fade in only from far.
- **Underwater (from batch 2):** depth absorption, Snell's window, exponential fog, softer shafts.
- **Flythrough:** `node scripts/ark-flythrough.mjs` (60 s, real time per tier) plus a frame-by-frame video (`ark-flythrough-60s.mp4`, 1280×720, 30 fps).

The 60 s flythrough runs in real time through island far, coast, waves, river and pond, house, forest floor and mountain, from morning to night. It is vsync-capped at 60 on the M3:

| Device and tier | fps | p95 frame interval | Draw calls / triangles (last view) |
|---|---|---|---|
| desktop high | 59.4 | 16.8 ms | 386 / 3.7 M |
| desktop medium | 59.9 | 16.7 ms | 173 / 1.07 M |
| desktop low | 57.9 | 16.8 ms | 99 / 0.40 M |
| phone medium (4× CPU) | 59.4 | 16.8 ms | 160 / 1.03 M |
| phone low (4× CPU) | 59.7 | 16.7 ms | 100 / 0.40 M |

Batch 3 golden shots (median across the 13 places):
- desktop: 60 fps, 207–413 calls, 3.7–11.5 M triangles (11.5 M on the forest floor, where every tree around is at lod0), GPU drain 14 ms;
- phone medium: 60 fps, 71–171 calls, 1.0–2.3 M triangles, GPU drain 5.9 ms.

Known gaps:
- The real phone frame rate has not been measured: the GPU proxy was unusable under the shared load, and there was no device.
- The dark diamond in forest_floor and coast_rocks is a canopy tree's trunk right beside the camera, not a rendering fault.
- caterpillar_leaf needs the asset trees' leaf points wired into the sampler.
- Kelp and seagrass, the house and fields (props lane), and fish schools are with other lanes.

## Batch 4: terrain and near-camera (f04ebfb4 and on)

Lane: terrain and near-camera. The reef, kelp, fish schools (`ark-graphics-reef`) and the leaf/bark attach points (`ark-graphics-attach`) are separate lanes.

- **Near-camera fade (`near-fade.ts`):**
  - a tree that passes beside the lens dissolves in a fine screen-space dither instead of cutting a dark shard across the picture;
  - the fade ends at 0.45 × the camera's distance to its target (at most 2.2 m), so a close-up's subject (a flower at 1.1 m, a leaf at 0.55 m, bark at 0.12 m) is never touched;
  - only on the leaf-card trees (`foliageMaterial`, which cut out already) and on the asset trees whose crown reaches over the camera (a separate "near" bucket in `asset-trees.ts` with a fading copy of `windMaterial`): everything else keeps the GPU's early depth test.
- **Trees never black (`windMaterial`):** light comes through the leaves from the sky (most where seen from below) and from the sun behind them; shaded bark keeps a little sky bounce; dark bark is lifted and given a grain. All from the scene's own sky, image light and sun, so night stays night. The wind maths is unchanged.
- **Golden cameras:**
  - `golden-world.ts` lists the map's trunks, canopy limbs, lamps and buildings; `forest_floor` and `coast_rocks` turn to the nearest bearing whose camera (and the near part of its sight line) stands clear of them, never inside a hill;
  - `coast_rocks` picks a rock cluster on a real shore (a steep bank behind counts against it) and looks along it from the shallows;
  - new `fields_close`: low over standing crops well inside the farm.
- **Mountain (`terrain.ts`):**
  - rock beds about 5 m thick, dipping a few degrees and folded, hard (dark cliff bands, streaked, shade under their foot) or soft (ledges with a pale lip), thin bedding planes inside, and the ledges bend the shading normal; contrast fades where a bed is a few pixels tall. This replaces the `sin(y + fbm)` swirl that read as a fingerprint;
  - ribs and gullies down the steep faces (bare ribs through the snow, darker gullies in the rock);
  - two-scale triplanar rock: the 5 m detail only within ~90 m, a greyed 27 m layer under it out to ~700 m;
  - scree: a per-vertex layer from the heightfield (gentle ground within ~7 m below steep rock);
  - snow: the upper third holds snow on all but the steepest hard faces, broken patches on gentle ledges below the line, blue in shade, dimmer at night.
- **Fields (`fields.ts`, `terrain.ts`, `near-detail.ts`):**
  - one definition of the fields for the shader and the plants: the shader's 9 × 6.5 m grid, a crop per field (pasture, ploughed, sprouts, cabbages, cereal, maize) and its row direction from an integer hash that is exact on the CPU and the GPU, a headland at each edge; the animals' clearing, the cottage's yard, the barn and the orchard stay grass;
  - the ground paints each crop's rows (antialiased), the furrows tip the shading normal, cereal ripples as the wind passes;
  - close up, sprouts, cabbages, wheat and maize stand on the painted rows (`snapToRow`);
  - rows only well inside the farm: never on the beach or the lake's grass where the farm layer fades out.
- **Sea bed (for the reef lane):** under the water the bed is coral sand and rubble (grey-brown fragments in patches, a coarse grain), matte (it was treated as wet sand and mirrored the sun, so the reef's floor read as snow), absorbed a little more with depth. Shores above the water are unchanged.
- **Tests:** `src/lib/ark-graphics.test.ts` (fade reach, camera clearance and ground, coast anchor, fields and rows).
- **Credits:** nothing third-party; everything is drawn in code from the existing CC0 ground textures.

Same-conditions A/B, baseline (7fb87467 scene source) against batch 4 with the reef lane merged (97cb85ed). The runs were interleaved A, B, A, B on six places whose cameras did not change (island far, mountain, house and fields, storm trees, river and pond, waves on the beach), in day light, with the tier pinned. The Mac's load average was 50 to 60 throughout:

| | interval p50 / p95 ms | scene CPU ms | GPU drain ms | draw calls | triangles |
|---|---|---|---|---|---|
| phone medium, baseline | 16.7 / 16.7 | 8.5–9.9 | 5.5–6.1 | 131.5 | 1.22 M |
| phone medium, batch 4 | 16.7 / 16.7–16.8 | 9.9–10.2 | 6.4–7.2 | 136 | 1.24 M |
| desktop high, baseline | 16.7 / 16.8–33.4 | 3.1–3.3 | 13.1–28.8 | 345 | 5.9 M |
| desktop high, batch 4 | 16.7 / 16.8–25.0 | 3.1–3.5 | 16.0–20.6 | 353 | 6.0 M |

The phone profile held 60 fps in every run. GPU drain is about 1 ms higher (the mountain's beds and the near-tree bucket; the merged sea life is in these numbers too). On desktop the swings between runs of the same code are bigger than the difference. The SwiftShader proxy was not run: under this load it measures the Mac, not the shader. A real mid-range phone is still unmeasured.

Golden shots: the before/after sheets are `batch4-desktop-before-after.jpg`, `batch4-desktop-closeups-reef.jpg` and `batch4-phone-before-after.jpg` in the handover folder's `ark/graphics/`. Pin the tier for comparisons (`--quality high` on desktop, `--quality medium` on phone): under load the auto tier drops while the page prepares, and the shots then differ in more than the change.

Seen while checking, not this lane's: the props lane's mist (`props/effects.ts` on `ark-release`) is flat horizontal sheets 0.6 to 1.5 m above the ground at each patch's middle. On sloping woodland and farm ground a sheet cuts through the land and the animals, and seen nearly edge-on it reads as a frosted band with straight edges (the animal-look lane's barn owl and fox shots). Over the lake it makes the shore's grass look as if it were under the water. A fix: give each sheet segments and drape it over the ground (`sampleGround` per vertex plus the offset), and fade it as the camera comes within about 2 m of its height.

## Batch 4, reef and coast water (branch `ark-graphics-reef`, cut from `ark-graphics` 7fb87467)

Handover §4.1 items 3–4. Visual only: nothing here touches the server, the snapshot, the stats or the ecology.

- **Coast:** no coral grows in the beach's shallows. `reef.ts` places nothing stony shallower than 1.9 m, nearer than 0.9 m to the mean surface, or within 45 m of the beach in water under 3 m (tested). The coast_rocks shallows show only rock and sand.
- **Reef (`reef.ts` places, `reef-render.ts` draws):**
  - branching corals (staghorn with pale tips; bushy with blue-violet tips), table corals (one or two tiers), brain corals (warped meanders), boulder and column corals (polyps), sea fans (an organic open lattice) and sea whips, anemones (swaying tentacles), barrel, tube and ball sponges;
  - encrusting cover (turf, crusts, pink coralline algae) on the reef framework between the heads;
  - placed by depth and substrate: the patch reefs' framework and rocky slopes take corals by depth band (flat and crest: branching, tables, brain; upper slope: tables, boulders, the first fans and sponges; deeper: fans, barrel sponges). Sand takes seagrass; rubble takes the odd boulder, sponge or anemone;
  - real reef colours (tans, browns, olive, ochre, purple-grey; red and purple fans; orange and purple sponges), with the red absorbed with depth and the sun's caustics on what faces up;
  - the map lane's anemone and cleaning-station anchors are an anemone patch and a big boulder coral.
- **Kelp and seagrass:** real meshes.
  - Kelp: holdfasts, bowed stipes, ruffled blades trailing along the coast, and floats. It grows on rock off the cliff coasts at 2.2–9 m and reaches to within about 0.4–1.2 m of the surface.
  - Seagrass: strap-blade clumps in the reef's lagoon and in patchy meadows off the beach (1.8–3.5 m, never in the swash). The far version is a low mat, so a meadow reads from above as a dark patch.
  - Sway: one surge, on and off the shore (an 8 s swell with a second wave), in the vertex shader. It runs on the sea's clock (epoch seconds, so every viewer sees the same; every frequency makes whole cycles in the 600 s wrap). Kelp bends in a wave that runs up its stipes. The surge grows with wind and storm and fades with depth.
- **Fish (`fish-schools.ts` model and API, `fish-render.ts` drawing):** decoration only, not catalogue animals; never counted, selectable or in stats.
  - Fifteen schools: damselfish and anthias hovering over coral heads, grunts by the cleaning station, tangs grazing round the reef, bait schools that mill into bait balls off the reef edge and in the open water, jacks, fry in the beach shallows, and perch in the kelp.
  - Closed form from the clock, so there is no state.
  - A near fish (body, tail, fins, countershading, stripes or bars, eye, tail beat) and a far fish of ten triangles.
  - Schools outside the view cone are not placed.
  - API: `fishSchoolsNear(pos, radius)`, documented in `graphics-interface.md`.
- **LOD:** every reef kind has a near and a far version, instanced and re-sorted round the camera in 8 m cells (when it moves 1 m, or every 30 frames). Nothing is drawn past the far reach, so far views pay nothing. The tier's fill share pulls the reaches in (high 1, medium 0.76, low 0.58) and thins the schools.
- **Under water fix (`lighting.ts`):** `apply()` turned the sky domes back on under water, and the sky showed past the terrain's edge as a white band. They now stay hidden under water.
- **Golden cameras:** `reef_closeup` (down among the corals at a head that fish hover over) and `kelp_forest` (mid-water in the densest stand, looking along the coast and a little up). The sea's clock is pinned per shot, so the fish are in the same place each time.

Numbers. The Mac was shared with other lanes' headless runs during these: load average 50–73 on 16 cores, against about 15–20 for the 7fb87467 baseline. Only same-conditions comparisons mean anything.

Same-conditions A/B: the same build with the sea life on and off (a temporary local edit), interleaved on, off, on, off, on the phone profile (360×800, DPR 2, 4× CPU, medium tier), day:

| Shot | Scene CPU ms (on) | Scene CPU ms (off) | Draw calls on / off | Triangles on / off | fps |
|---|---|---|---|---|---|
| reef_underwater | 11.4, 11.7 | 9.0, 9.7 | 140 / 101 | 1.24 M / 0.99 M | 60 |
| reef_closeup | 9.2, 9.2 | 9.7, 9.3 | 127 / 89 | 1.07 M / 0.88 M | 59–60 |
| waves_beach | 7.4, 8.9 | 8.8, 8.8 | 99 / 94 | 1.16 M / 1.13 M | 60 |

GPU drain was within the noise. Desktop high (`reef-final2-desktop`) held 60 fps on every reef and coast shot, at 3.1–3.8 ms scene CPU and 250–360 calls. The fish placement costs about 0.2–0.3 ms a frame on the desktop CPU for the schools in view: each fish's matrix is built straight from its motion, and schools outside the view cone are skipped.

## Batch 5: rocks, crops, the range, the floor, still water (b73d2b75 and on)

From the coordinator's review of batch 4 ("several places still read as a demo") and the liveliness lane's tides.

- **Rocks (`rock-assets.ts`, `asset-rocks.ts`):**
  - the asset lane's rocks (merged from `ark-assets` 6f4adca4) replace the procedural ellipsoids: each decor rock keeps its place, turn and footprint, and takes a kind from where it lies (tide-pool rocks and barnacled clusters on the shore, mossy boulders in the woods and by water, boulders and clusters elsewhere);
  - LOD-instanced and culled against the view; the material keeps the assets' colours (lifted from near black) and adds a fine grain, lichen on the dry upper faces, a wet glossy band and a salt line;
  - `rock_face` points keep their ids and sit on the asset's own faces (attach.json, measured on the drawn lod0 surface), outward, on the outer hull, never buried in a sloping beach (0 of 684; graphics-interface.md has the rule).
- **Fields:**
  - cereal stands as a mass: crossed cards along the rows with a stalks-and-ears texture painted in code, built once for every cereal field (4 triangles a card), ripe or green per field, shown to 140 m, thinned by tier; single stalks only on a field's fringe;
  - a field is crop or grass whole (decided at its middle);
  - meadow grass keeps out of the crops (`cropsGrowAt`), on the margins and pasture.
- **The range (`world.ts`, `terrain.ts`):**
  - sharp horns with three arêtes each and deep cols (west 39 m, col 35, main 48, col 32, east 44) instead of smooth domes;
  - snow whiter with a crisper edge (it read as a grey wash), a faint sheen; scree fans lighter and reaching further, visible from the far view;
  - a golden-only camera (`window.__arkGoldenCamera`, development builds only) lets the mountain shot look up from the valley; the user's camera limits are unchanged.
- **Forest floor (`near-detail.ts`, `windMaterial`):** litter mats (leaves, twigs, needles painted in code, along the slope), needle clusters under the conifers, more and bigger ferns, saplings, moss on the roots.
- **Still water (`water-level.ts`, `terrain.ts`, `sampler.ts`):** the lake and the river keep a fixed level; the sea rises and falls with the tide. Two water meshes from one shader (the sea discards over fresh water); the ground and the sampler use the same rule (`waterLevelAt`).
- **Waterfall:** skipped. The island's one river runs from the lake in the middle (level 0) to the southern coast; nothing flows out of the mountains, so no drop fits without a new stream (a map change).
- **Close-up framing:** a micro shot takes the best point whose camera stands above the ground; the gecko keeps off the side windows. Note: reshaping the range shifted the decor indices, and so the `rock_face:decor<i>` ids and the sampler's later random points (the gecko's and the leaf's spots moved). Any map change does this.

Same-conditions A/B, batch 4 (97cb85ed scene source) against batch 5 (c372c52f). The runs were interleaved A, B, A, B on six places whose cameras did not change in batch 5 (island far, house and fields, storm trees, river and pond, waves on the beach, coast rocks), in day light, with the tier pinned. Load average was 11 to 15. Both sides draw the same tree and rock GLBs from `public/`, so this is the scene code's own cost:

| | interval p50 / p95 ms | scene CPU ms | GPU drain ms | draw calls | triangles |
|---|---|---|---|---|---|
| phone medium, batch 4 | 16.7 / 16.7–16.8 | 5.8–5.9 | 4.8 | 134.5 | 1.27 M |
| phone medium, batch 5 | 16.7 / 16.7–16.8 | 6.4–6.7 | 4.8–5.1 | 140.5 | 1.20 M |
| desktop high, batch 4 | 16.7 / 16.7–16.8 | 2.2–2.4 | 13.8 | 354 | 6.62 M |
| desktop high, batch 5 | 16.7 / 16.7–16.8 | 2.3 | 14.0–14.1 | 373 | 6.52 M |

The phone profile held 60 fps in every run. It draws about 6 more calls (rock levels, litter, needles, saplings, wheat), with about 5% fewer triangles (the rock assets' far levels are lighter than the procedural rocks). Its GPU drain is level to +6%, and its scene CPU is about +0.7 ms at 4× throttle. A real mid-range phone is still unmeasured.

Golden sheets: `batch5-desktop-before-after.jpg`, `batch5-phone-before-after.jpg` and `batch5-lake-level-tides.jpg` (mean tide against spring high) in the handover folder's `ark/graphics/`.

## Batch 4, item 6: small animals on the real scenery, the leaf shot (`ark-graphics-attach`)

- **Tree attach points on the drawn trees.** attach.json's points are computed before the level-of-detail cut and the leaves' fold, curl and growth: its leaf points sat a median 1–46 cm off the drawn lod0 leaves. `scripts/ark-tree-attach.mjs` moves each onto the drawn surface (a single leaf within 0.6 m first, else the leaf mass; bark and branch tops on the wood) and records the wind weights there (`src/ark-scene/tree-attach.json`, 1,011 points, 34 KB gzipped). `tree-assets.ts` places them where `asset-trees.ts` draws each tree (one shared `assetTreePlacement`); only decor trees and the fill every tier draws carry them.
- **Wind.** An animal on a leaf moves with it: `attachPointAt(point, ARK_TIME.value, ARK_WIND.value)` is the tree shader's own sway and flutter at that point (2–6 cm in a storm). Chosen over "only where the sway is small", because every leaf flutters.
- **Detail.** A tree is drawn at lod0 whenever the camera is within 2.5 m of its bounds, so a close-up's leaf is always the one the point is on (before, a camera up in a tall crown could see lod1).
- **Rocks.** Rock points sat on the smooth rock shape, not the flat faces drawn (a true-size limpet half buried); `drawnRockPoint` fixed that. Since batch 5 the rocks are the asset lane's (`rock-assets.ts`), and `drawnRockPoint` only applies if the rock set is missing.
- **Close-up golden shots** (`caterpillar_leaf`, `bee_flower`, `limpet_tidepool`, `gecko_wall`, and the new `ant_bark`): the animal at its true size, framed as the scene frames a tapped small animal (length × 6, 0.12–3 m; the leaf shot 0.55 m to show the whole leaf). The camera is checked clear both ways along its sight line, the leaf or trunk in the sun and with nothing in front of the lens, chosen once in the morning light and kept for dusk and night. The harness had been drawing them from 0.3 m or more: the scene eased its closest distance back out every frame; the shots now hold it. The leaf shot uses a small cabbage white (5 cm): there is still no caterpillar model.
- **Near plane under 5 cm.** The scene sets near to 8 % of the camera's distance to what it looks at (at least 1 cm). The 5 mm ant at 0.12 m has near 1 cm, nothing clips, and the 24-bit depth resolves about 0.1 µm there: no z-fighting between an animal and its leaf, bark or rock (2 mm off). No change was needed. GTAO (high tier) keeps its 1.2 m radius in close-ups: the same leaf shot is 3–5 % darker on high than on medium and the bark shot is the same, so it was left.

