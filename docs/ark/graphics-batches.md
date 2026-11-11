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
