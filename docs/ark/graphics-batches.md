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

## Batch 4, item 6: small animals on the real scenery, the leaf shot (`ark-graphics-attach`)

- **Tree attach points on the drawn trees.** attach.json's points are computed before the level-of-detail cut and the leaves' fold, curl and growth: its leaf points sat a median 1–46 cm off the drawn lod0 leaves. `scripts/ark-tree-attach.mjs` moves each onto the drawn surface (a single leaf within 0.6 m first, else the leaf mass; bark and branch tops on the wood) and records the wind weights there (`src/ark-scene/tree-attach.json`, 1,011 points, 34 KB gzipped). `tree-assets.ts` places them where `asset-trees.ts` draws each tree (one shared `assetTreePlacement`); only decor trees and the fill every tier draws carry them.
- **Wind.** An animal on a leaf moves with it: `attachPointAt(point, ARK_TIME.value, ARK_WIND.value)` is the tree shader's own sway and flutter at that point (2–6 cm in a storm). Chosen over "only where the sway is small", because every leaf flutters.
- **Detail.** A tree is drawn at lod0 whenever the camera is within 2.5 m of its bounds, so a close-up's leaf is always the one the point is on (before, a camera up in a tall crown could see lod1).
- **Rocks.** Rock points now sit on the flat faces drawn, not the smooth shape between their corners.
- **Close-up golden shots** (`caterpillar_leaf`, `bee_flower`, `limpet_tidepool`, `gecko_wall`, and the new `ant_bark`): the animal at its true size, framed as the scene frames a tapped small animal (length × 6, 0.12–3 m; the leaf shot 0.55 m to show the whole leaf). The camera is checked clear both ways along its sight line, the leaf or trunk in the sun and with nothing in front of the lens, chosen once in the morning light and kept for dusk and night. The harness had been drawing them from 0.3 m or more: the scene eased its closest distance back out every frame; the shots now hold it. The leaf shot uses a small cabbage white (5 cm): there is still no caterpillar model.
- **Near plane under 5 cm.** The scene sets near to 8 % of the camera's distance to what it looks at (at least 1 cm). The 5 mm ant at 0.12 m has near 1 cm, nothing clips, and the 24-bit depth resolves about 0.1 µm there: no z-fighting between an animal and its leaf, bark or rock (2 mm off). No change was needed. GTAO (high tier) keeps its 1.2 m radius in close-ups: the same leaf shot is 3–5 % darker on high than on medium and the bark shot is the same, so it was left.

