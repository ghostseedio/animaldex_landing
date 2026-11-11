# Ark animal look

The animals brought up to the detail of the world round them: fur, feathers, scales, skin, shell and slime by species; wet and dusty by the island's weather; eyes that catch the light; fur shells close up; full-resolution skins close up; contact shadows that sit on the slope, the wall or the leaf. Visual only: nothing here decides anything on the Ark. Deterministic and shared: everything is a function of the species, the animal's id, where it stands and the island clock (`src/lib/ark-clock.ts`). There is no `Math.random`, so every viewer sees the same wet seal.

One switch puts every animal back exactly as before: `ArkSceneOptions.animalLook: false`, or `handle.setAnimalLook(false)`. Golden shots use it for "before".

## Files

| File | What |
|---|---|
| `src/ark-scene/animal-look-rules.ts` | Which surface a species has, from stored data, with the reason kept. |
| `scripts/ark-animal-look.mts` | Runs the rules over the model set into `src/ark-scene/animal-look.json` and the report `docs/ark/animal-look-classes.tsv`. |
| `src/ark-scene/animal-look-shader.ts` | The shader pieces spliced into the animals' `MeshStandardMaterial` (`animal-material.ts`). |
| `src/ark-scene/animal-look.ts` | Per-animal wet and dust, the tier settings, eyes, fur-shell and close-up bookkeeping. |
| `src/ark-scene/fur-shells.ts` | Fur shells: an instanced re-draw of the near or rigged mesh in layers. |
| `src/ark-scene/closeup-textures.ts` | Close-up skins (KTX2), fetched only when the camera is close. |
| `src/ark-scene/marks.ts` | Contact shadows (`ContactShadows`), now lying on the surface's normal. |
| AnimalDex `scripts/talking-models/ark/export_closeup.py`, `publish_closeup.py` | Build the close-up skins offline, and (owner-approved only) upload them. |

## Surface by species (`animal-look-rules.ts`)

The evidence, strongest first:
1. **Taxonomy** (class, order, family; `rig/plans.json`, `rig/taxonomy.json`) where the class settles it:
   - birds have feathers; turtles have a shell; crocodiles, lizards and snakes have scales;
   - sharks and rays have denticle skin;
   - frogs and salamanders have slimy skin, but true toads (Bufonidae) have dry skin;
   - cephalopods, jellyfish and worms are slimy;
   - arthropods have a shell (exoskeleton), unless the photo shows them hairy;
   - moths and butterflies are soft and matte (drawn as fur);
   - whales, sirenians, elephants, rhinos, hippos and naked mole-rats have skin.
2. **The photo's covering** (`out/<slug>/landmarks.json`, `head_box.covering`): a pangolin's scales, an armadillo's shell, fish.
3. **The body plan**, only when neither exists. The row is then flagged as a default.

| Class | Species |
|---|---|
| fur | 805 |
| feathers | 681 |
| shell | 473 |
| scales | 383 |
| skin | 164 |
| slimy | 124 |

Flags: `wet-after-swim` (semi-aquatic: land or air plus sea or fresh water, from the traits lane's realms); `aquatic` (always wet); `dusty` (a ground animal of dry land).

## The shader, by tier

`ARK_LOOK_TIER` 0 applies to low and to every far model: the class's tint, roughness, rim, wet and dust, plus the eyes on near models. Tier 1 (medium, which is phones) adds the class's relief:
- fur strands combed head to tail, flatter where the hair points at the viewer;
- feather tips laid in rows;
- raised scales, skin creases, shell plates;
- a slime's slow undulation;
- a clear coat on shell, scales and anything wet;
- light through thin edges (ears, a frog's flank).

Tier 2 (high, desktop) is the same, plus fur shells and more close-up skins.

The relief is made in the model's rest-pose space, so it stays on the body as it walks. It also follows a rigged mesh and a fur shell, because they run the same vertex shader. The relief fades out where it would be smaller than a pixel.

**Eyes:** the talking model's two glossy eyes (from its build) get a dome for the light and the sky to catch, and a small catchlight up and to the left, softer at night. On a rigged animal the dome turns with the head bones, so the look-at and the clips keep the catchlight on the eye.

## Wet and dust (from ark-clock's weather)

The scene passes `weatherAt(…)`'s `rain`, `wetness` (the ground's) and `wind` to `AnimalLook.begin`, or a pinned environment's values.
- **Coat wetness** is `max(min(1, 1.8 × rain), 0.6 × wetness²)`. Coats soak within the rain's first minutes and dry well before the ground does.
- **In the water or aquatic:** a sheen (0.5), not the dark, glossy look of a coat just out of the water. Under water the light is soft, and a turtle went near-black at 1.
- **Semi-aquatic:** wet from its own swims as well. In each quarter hour of island time about half of them swim, each ending at a moment of its own (`swimWetness`: a pure function of id and world time). They dry over about six minutes.
- **Wet look:** darker, glossier and sleeker; fur shells collapse. Each class takes its own share of it: feathers 0.3, because they shed water (a duck on the pond is not soaked); scales and shell 0.85; fur, skin and slime the full amount.
- **Dust** applies to dusty-flagged animals on bare, dry ground (sand, soil, tilled, some rock; little on grass). It is scaled by the weather: none on wet ground, a little more in a dry wind. It shows as a pale, dry film on the legs and belly.

## Fur shells, and the cheap version

Shells cost one extra draw per layer of the body, with a discard, so they are gated:

| Tier | Shells | Close-up skins |
|---|---|---|
| high (desktop) | the nearest 4 furred mammals within 9 m and over 120 px long | within 9 m, up to 8 |
| medium (phones) | none: the cheap version only | within 5.5 m, up to 3 |
| low | none | none |
| lite view | none | 0.6 × the range, up to 2 |

**By distance** (`shellLevel`): 6 layers up close, 4 further out, 2 at the edge. The coat's reach shrinks smoothly to nothing over the last 30 % of the range, so shells never pop. The shells stand toward the outline and thin away where the coat faces the camera, so they soften the edge without speckling the coat.

**The cheap version** (every animal without shells, and every phone) is the fur relief plus a rim broken into strands. The coat's edge glints hair by hair, with no extra draw.

## Close-up skins (offline; NOT uploaded)

The Ark set's near model carries a 512² WebP skin. The full skin it was made from (`<build>/assets/<slug>.talking.jpg`, 1024², the same UV layout) is re-encoded as KTX2 (Basis ETC1S, quality 255, full mips, one thread for the same bytes every run) by `export_closeup.py`. The scene swaps it in for the near model only while the camera is close, and lets it go 8 s after.

Local build (2026-11-11): `~/animaldex-talking-models/ark-closeup/`: 2,630 species, 0 failed.

**What would be uploaded** (`publish_closeup.py`, a dry run by default, which reads no key):
- 2,630 × `v1/ark-closeup/<slug>/<version>.near.ktx2` (`image/ktx2`, cached a year, immutable names);
- then `v1/ark-closeup/manifest.json` (88,300 B, cached 10 min), last.
- Total: 2,631 files, 710,438,449 bytes (about 678 MiB).
- Per skin: 164 KB min, 266 KB median, 297 KB p95, 320 KB max.

This needs the release approval; nothing is uploaded until then. Until the manifest exists, every animal keeps its 512² skin. The web code is already in place and inert.

To regenerate: `export_closeup.py --all --jobs 6` (needs `brew install basis_universal`). To list the upload: `publish_closeup.py` (dry run).

## Contact shadows (`marks.ts`)

With the pass on, the blob gets a dark core where the body meets the ground, fading wide and soft:
- it is a little darker without sun shadows (low tier), lighter with them;
- near animals' shadows lie on the ground's slope (its normal, cached on a 1 m grid);
- a small animal on a wall, a leaf, a flower or a stone gets its shadow on that surface, under its body, long the way it crawls, lifted by a little of its own size.

## Golden close-ups

```
node scripts/ark-golden-shots.mjs --animals red-fox,mallard,... [--rigged red-fox,...] [--detail] [--wet] --quality high --devices desktop
node scripts/ark-golden-shots.mjs --animals ... --quality medium --devices phone
```

Each species gets the pass off ("before") then on ("after"):
- the default view is face to face, as close as a viewer can come: the scene's 4 m floor, or a small animal's own close distance (about six lengths);
- the bearing is the first one where no other animal and no ground stands between;
- the world clock restarts from one fixed moment (island midday) for every shot, so before and after match;
- `--detail` comes closer than a viewer can (development only) to judge the surface;
- `--wet` adds a rain shot;
- `--rigged` adds a moving shot with the rig playing, to check skinned meshes.

The close-up skins are served from the local build.

## Perf (golden harness, 2026-11-11, the Mac shared with about 17 agents)

**Phone profile** (360×800, DPR 2, 4× CPU throttle, tier medium; the Mac's GPU, not a phone's):

| Species | Look | Frame p50 | p95 | CPU ms | GPU drain ms | Draws |
|---|---|---|---|---|---|---|
| red-fox | off | 16.7 | 16.7 | 8.2 | 5.3 | 67 |
| red-fox | on | 16.7 | 16.8 | 10.4 | 5.5 | 69 |
| african-lion | off | 16.7 | 16.7 | 10.7 | 4.7 | 77 |
| african-lion | on | 16.7 | 16.7 | 8.3 | 4.5 | 77 |
| komodo-dragon | off | 16.7 | 16.7 | 7.4 | 4.4 | 75 |
| komodo-dragon | on | 16.7 | 16.8 | 7.8 | 3.8 | 75 |
| mallard | off | 16.7 | 16.8 | 8.8 | 4.5 | 111 |
| mallard | on | 16.7 | 16.7 | 9.9 | 4.6 | 111 |

Reading: no shells on this tier. The draw count rises by 0–2 and triangles don't change. CPU and GPU stay within run-to-run noise (CPU varies 7–11 ms either way).

**Desktop** (1440×900, tier high, fur shells on): frame p50 is unchanged. Draws rise by 2–12 with shells (one instanced draw per shelled species). CPU rises by about 0.1–0.3 ms. GPU drain swung between 11 and 46 ms from run to run, in both directions, under the shared load, so this harness cannot show the shells' fill cost.

Still to measure: a real mid-range phone (the handover's open item, owner).

## Known issues and notes for other lanes

- **Product camera floor:** a viewer can't come closer than 4 m to a normal-sized animal (`controls.minDistance`, reset every frame), so on desktop most of the surface detail and the fur shells show only when the camera is close to a large animal. On a phone at 4 m a fox fills most of the width. The golden `--detail` shots come closer, for development only. Whether to allow closer is the runtime and camera lane's call.
- **Fixed in this lane:** fur shells never drew before 2026-11-11 (the shell material found no species).
- **Mist (resolved):** the pale sheet on the fox's lake shore and the band across the barn owl's meadow were the props lane's flat mist sheet. With `ark-props` 54a82ee2 (draped mist) merged locally, both views are clean (re-checked 2026-11-11).
- **Behaviour lane:** lions stand in among the zebras (the lion shots).
- **Golden harness:** the bearing is checked clear of other animals, the ground and `golden-world.ts`'s trunks, lamps and buildings along the whole sight line. Limits: a sea animal on the seabed (the lobster) is not framed, and a canopy animal's detail shot goes inside the tree (the macaw).
- **Fur shells' reach:** none on the front of the head (a muzzle is short-haired or bare; on a zebra the shells made a grey halo) or the hooves. The coat's length grows from behind the eyes, measured on the rest pose.
