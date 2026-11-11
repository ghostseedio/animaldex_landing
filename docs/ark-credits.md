# Ark credits

## Graphics (terrain, water, sky)

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

Every third-party asset the Ark scene uses, with its licence. Only CC0, public domain, CC BY and CC BY-SA, or another licence free for commercial use, checked before download. Nothing NC or ND, because Pro is paid. The graphics lane adds its own section (terrain, water, sky) to this file.

## Sound

### Where the sounds come from

The Ark plays the same recordings as the chat's animal sounds. Nothing new is downloaded for them.
- **Bucket:** `animal-chat-sounds`.
- **Records:** `AnimalDex/scripts/animal-sounds/`.
- **Audit:** 2026-11-11, in the liveliness lane's report.

**Species recordings.**
- **Path:** `v1/<species_profile_id>/manifest.json` with `"kind": "species"`.
- **What they are:** real field recordings of that one species, from iNaturalist, Wikimedia Commons and GBIF.
- **Coverage:** 657 of the 2,680 Ark species.
- **Who recorded what:** each manifest's `credits` (recordist, licence, source, page). The full list is `AnimalDex/scripts/animal-sounds/data/published-species.csv`.
- **Held back:** the 18 banks held by the chat's final listen never call in the Ark (`ARK_HELD_SOUND_BANKS` in `src/lib/ark-sound.ts`).

**Habitat beds.**
- **Path:** `v1/habitat/<habitat>/sprite-<sha8>.m4a`.
- **What they are:** real recordings of a place, shared by every species of that habitat.
- **Use in the Ark:** ambient beds only. Never an animal's voice.

**Licences in use.** The habitat beds' credits are in the table below; the species banks' are in the published CSV.

| Licence | What it requires |
|---|---|
| CC0 | Nothing. Credited anyway. |
| Public domain | Nothing. Credited anyway. |
| CC BY (2.5, 3.0, 4.0) | Credit the recordist and licence, and link the original. |
| CC BY-SA (1.0, 2.5, 3.0, 4.0) | Credit and link as for CC BY. Our trimmed, level-matched cuts of these recordings stay under CC BY-SA. |

### How the Ark credits them on screen

The credit lines come from the manifests themselves. `soundCreditLines()` in `src/lib/ark-sound.ts` dedupes them by recordist, licence and source, and sorts them.

1. **Sounds panel:** opened from the sound toggle. It lists every recording heard in this visit, as "Recordist (licence, source)", each linking to its original `page`. It shows both the calls (species banks) and the beds (habitat banks).
2. **Tap card:** when the tapped animal has its own voice, the card adds one "Sounds:" line with its recordists. A breed calling with its kind's voice (A1) credits the kind's recordists.
3. **Clips and the livestream:** sounds used in a recorded clip are listed in the clip's description from the same function.

A recording that would play without its manifest's credits is not played. The parser drops any credit without a recordist, licence and source.

### Habitat beds used as ambience

Copied from `AnimalDex/scripts/animal-sounds/data/published-habitats.csv`.

| Ark bed | Habitat bank | Credits |
|---|---|---|
| waves | shore (`sprite-9f77a0de`) | Jarrod stanley (CC0); Ganesh Mohan T (CC BY-SA 4.0); earthcalling (public domain); Dsw4 (CC BY 3.0); me (CC BY-SA 3.0). All Wikimedia Commons. |
| wind | grassland (`sprite-5cea18c0`) | Beeld en Geluid (CC BY-SA 3.0, Wikimedia Commons) |
| river | river (`sprite-6be9222a`) | Dirtslayer (PD); Amada44 (CC BY-SA 4.0); Thomas Bresson (CC BY 4.0); stephan (PD); Dsw4 (PD), all Wikimedia Commons. National Park Service (PD). |
| pond | pond (`sprite-b8de66d4`) | Burkhard Mücke (CC BY-SA 4.0); thoschi (CC0); Andrew Migneault (CC BY-SA 4.0); Amuzujoe (CC BY-SA 4.0). All Wikimedia Commons. |
| forest by day | forest-canopy (`sprite-a6e8f999`) | Robert EA Harvey (CC BY-SA 4.0); luc de bruijn (CC BY 3.0); Gravity Sound (CC BY 4.0); W.carter (CC BY-SA 4.0). All Wikimedia Commons. |
| forest by day, rainforest | rainforest (`sprite-124204c6`) | Robert EA Harvey (CC BY-SA 4.0); Mijesty (CC BY-SA 4.0); Gravity Sound (CC BY 4.0); Beeld en Geluid (CC BY-SA 3.0). All Wikimedia Commons. |
| underwater | open-ocean (`sprite-0809ccac`) | L. Ginzkey (CC BY 2.5); Crone T, Wilcock W, Barclay A, Parsons J (CC BY 2.5). Both Wikimedia Commons. |
| underwater, reef | reef (`sprite-8e0e78d2`) | H.dav.are (CC BY-SA 4.0); Caldas-Morgan M, Alvarez-Rosario A, Rodrigues Padovese L (CC BY 4.0). Both Wikimedia Commons. |
| polar wind | snow-ice (`sprite-e229331d`) | Beeld en Geluid (CC BY-SA 3.0, 2 recordings); National Park Service (PD); Ludwig Berger (CC BY-SA 4.0) |
| desert wind | desert (`sprite-5e750224`) | Tvabutzku1234 (CC0); Beeld en Geluid (CC BY-SA 3.0); 胡蘿蔔 (CC0). All Wikimedia Commons. |

### Still needed

There is no bank for these yet. Each needs a CC0 or free-for-commercial-use recording, logged here before it is used (`ARK_AMBIENT_SOURCES` in `src/lib/ark-sound.ts`). Downloads go in their own folder, licence checked first. None have been downloaded.

- **Rain:** light and heavy, from one recording.
- **Night bed:** crickets and frogs.
- **Dawn chorus bed:** until then, the species' own calls at dawn carry it.
- **Thunder:** a few distant rolls.
- **Mountain wind with no rockfall:** the mountain bank was set aside.
