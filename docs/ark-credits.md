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
