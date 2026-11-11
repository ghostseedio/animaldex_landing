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
