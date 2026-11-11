# Ark scene: third-party assets and licences

Every asset the Ark scene (`src/ark-scene`, `public/ark`) uses from outside the project. Licence checked before download. Downloads are kept outside the repo; only the processed files below are committed.

| Asset | Source | Licence | Used as | Committed file(s) |
|---|---|---|---|---|
| leafy_grass | https://polyhaven.com/a/leafy_grass | CC0 (polyhaven.com/license) | ground: grass layer | `public/ark/graphics/ground-albedo-512.webp`, `ground-normal-512.webp` (layer 0) |
| forest_leaves_02 | https://polyhaven.com/a/forest_leaves_02 | CC0 | ground: forest floor | same strips, layer 1 |
| dirt | https://polyhaven.com/a/dirt | CC0 | ground: soil, paths | layer 2 |
| coast_sand_01 | https://polyhaven.com/a/coast_sand_01 | CC0 | ground: dry sand, desert | layer 3 |
| damp_beach_sand | https://polyhaven.com/a/damp_beach_sand | CC0 | ground: wet sand at the waterline | layer 4 |
| rock_face_03 | https://polyhaven.com/a/rock_face_03 | CC0 | ground: rock on slopes, cliffs; rocks | layer 5 |
| brown_mud_02 | https://polyhaven.com/a/brown_mud_02 | CC0 | ground: wetland mud, river banks | layer 6 |
| snow_02 | https://polyhaven.com/a/snow_02 | CC0 | ground: snow | layer 7 |
| farm_soil | https://polyhaven.com/a/farm_soil | CC0 | ground: tilled fields | layer 8 |
| kloofendal_48d_partly_cloudy_puresky | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 | sky light (image-based lighting) | `public/ark/graphics/sky-day.hdr` (downsampled) |

Processing: the 1k JPG diffuse maps are high-passed (large-scale light drift divided out, so repeats don't show) and resized to 512 px; the OpenGL normal maps are resized to 512 px; each set becomes one layer of a vertical strip, read into a texture array at load. Licences: Poly Haven "Our assets are all licensed as CC0" (polyhaven.com/license, checked 2026-11-11); ambientCG is CC0 1.0 (docs.ambientcg.com/license, checked 2026-11-11, nothing used from it yet).

Tools (not shipped): `playwright-core` (Apache-2.0, existing dev dependency) for the golden-shot harness.

## Asset library (`public/ark/assets/v1`, the asset lane)

Every mesh in `public/ark/assets/v1/` (trees, plants, rocks, forest floor) is generated in this repo by `scripts/ark-assets/` (procedural Python, run inside Blender 5.2 for the contact-sheet renders): no downloaded models, textures or scans. Colour is vertex colour only (no textures, so no KTX2). Made for AnimalDex and released as CC0 1.0 by its authors; no attribution needed.

| Asset | Source | Licence | Author | Committed file(s) |
|---|---|---|---|---|
| Trees (12 kinds, 33 variants), plants, rocks, forest floor | generated: `scripts/ark-assets/{trees,plants,rocks,floor}.py` | CC0 1.0 (made in this repo) | AnimalDex (asset lane, 2026-11-11) | `public/ark/assets/v1/<set>/*.glb`, `<set>/attach.json`, `src/ark-scene/assets-manifest.json` |

Tools (not shipped): Blender 5.2 (GPL-3.0, renders the contact sheets only; nothing from it is in the output), gltfpack 1.3.0 (MIT, npm `gltfpack@1.3.0`, meshopt compression; the same pinned tool the model lane uses), Pillow (HPND, contact-sheet layout), three.js `GLTFLoader` + `MeshoptDecoder` (MIT, existing dependency, `scripts/ark-assets/verify.mjs`).

Batch 4, reef and coast water (`reef.ts`, `reef-render.ts`, `fish-schools.ts`, `fish-render.ts`): no third-party assets. Every coral, sponge, anemone, kelp and seagrass shape, every fish and every surface pattern is built in code.
