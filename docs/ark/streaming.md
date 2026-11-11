# Ark Part B: render distance and streaming

Branch `ark-streaming` (landing). This is the groundwork for Part C, which makes the wild island much bigger and adds a second island (town, countryside and zoo), with one island loaded at a time. The code is in `src/ark-scene/streaming/`; the tests are in `src/lib/ark-streaming.test.ts`.

**The one rule:** chunking never moves anything. Every position stays a pure function of the shared clock and the ids. A chunk decides only what is drawn and what is kept loaded. Two viewers with different tiers see the same animals in the same places; one of them sees less of the far distance.

## 1. Chunks

- **The grid is the ground's own.** A chunk is 48 of the terrain's segments square, which is 52.8 m on today's island (240 segments of 1.1 m make a 5 × 5 grid). Chunk edges lie on the ground's grid lines, so a terrain tile is exactly the ground's vertices inside its chunk.
- **Placement.** A point belongs to the chunk it falls in. A point off the grid (a sea animal far out) belongs to the nearest edge chunk.
- **Part C** keeps 48 segments a chunk. A 1 km island at the same 1.1 m spacing is a 19 × 19 grid.
- **Vertical reach.** Each chunk has a span: the ground's lowest point, and its highest point plus 30 m of headroom for trees, flyers and things up in the air.
- **Distance to a chunk** is from the camera's eye to the nearest point of that box (`distanceToChunk`).

**What each chunk owns:**

| Owner | In the chunk | Drawn `in` | Drawn `map` | Drawn `out` |
|---|---|---|---|---|
| Ground (`ground-tiles.ts`) | its tile of the ground's arrays | every vertex | every 4th vertex, with a 3 m skirt | nothing; GPU geometry released after 6 s |
| Decor plants, forest fill (`vegetation.ts` → `instances.ts`) | instances whose matrix origin falls in it | yes | yes | no |
| Grass (`vegetation.ts` → `instances.ts`) | tufts | yes | no | no |
| Asset trees and rocks (`asset-trees.ts`, `asset-rocks.ts`) | instances | yes | yes | no |
| Forest floor (`AssetFloor`) | instances | yes | no | no |
| Props: homes, nests, areas, effects (`cull.ts`) | objects whose bounds centre falls in it | yes | no | no |
| Animals (`index.ts` updateInstances) | its pose now (its schedule's position) | modelled, stepped, rigged | a 5 px marker | nothing, and its schedule is not stepped |
| Herds (`planHerds`) | whole herd sphere | figures and specks | badge only | badge only |
| Attach points (`sampler.ts`) | data only, never drawn | — | — | — |

The badges, labels, HUD counts and population are data and are always there.

- **Attach points.** These are built for the whole island at mount (a slice a frame). That stays cheap at today's size. For Part C, `prepareAttachPoints` should take a chunk and build on first load. The points are pure functions of the scenery, so building them per chunk changes nothing.
- **Instanced plants.** Each mesh keeps its built list (matrices, colours, `arkTint`). The GPU buffer holds only the instances in drawn chunks, in their original order. A tier's share stays a prefix of the built list, exactly as before (the grass count, the forest fill's share).
- **Exactness.** When every chunk holding one of the first `limit` instances is drawn, the buffer is the built list byte for byte. The tests check that, and that the tiled ground has the same vertices, attributes and triangles as the single ground mesh.

## 2. Load, unload and hysteresis

- **States.** A chunk goes `in` when its box comes within the render distance. It stays `in` until the box is past the distance plus a margin (40 / 32 / 26 m on high / medium / low), so a camera resting on a boundary does not flicker. Out of range, a chunk is `map` from the map view and `out` otherwise.
- **When states are checked.** The streamer checks them when the eye has moved 2 m, or every 0.5 s. It calls its listeners only when a state changed.
- **Unloading the ground.** A hidden tile, or the level it no longer uses (full or map), is released after 6 s, so its geometry leaves the GPU. Coming back rebuilds it from the arrays (about 1 ms for a 49 × 49 tile).
- **Unloading animals.** An animal past the distance is not stepped, posed, modelled or rigged. Its position is worked out again every 2–3 s (staggered by its phase) from its schedule, which is the same for every viewer, so one walking in is noticed within the hysteresis margin.
- **Animals always drawn:** the reader's own, the selected, the followed, a visitor, one in an act or a moment.
- **Models.** These are never asked for beyond the distance, because animals there never ask. The model library's existing budgets and eviction (`runtime/budgets.ts`) still bound what is loaded.

## 3. Render distance and haze per tier

| Tier | Render distance | Hysteresis | Haze (radial distance → depth) | JS heap budget | GPU budget |
|---|---|---|---|---|---|
| high | 960 m | 40 m | 0.7 → 1.0 of the distance | 512 MB | 640 MB |
| medium | 640 m | 32 m | 0.7 → 1.0 | 320 MB | 320 MB |
| low (and the lighter view) | 440 m | 26 m | 0.7 → 1.0 | 200 MB | 160 MB |

- **Sized for Part C.** On today's island (land within about 112 m of the middle, and an eye at most about 460 m out), every chunk is `in` from every view the camera can take on medium and high. The test sweeps targets, distances, polar angles and azimuths. The low tier's 440 m covers both home views: the phone's far shore is about 415 m off. So **the default view is unchanged on every tier**, and the visual CI is unchanged.
- **The haze is the scene's own fog, pulled in** (`haze.ts`). The fog's `near` and `far` become accessors: whoever sets them (the scene, the weather) sets the base, and three reads the nearer of the base and the haze.
  - The haze is on only while some chunk with content (land, plants, an animal's home) lies past the distance. It ramps up over the last 25 m and eases in over 0.6 s. It is never on in the map view.
  - With it off, the fog is exactly its base: `max(f, 0) = f`.
  - Chunks are culled by radial distance, but three's fog is by depth, so the haze is whole at the distance × cos(the view's half diagonal). A chunk just past the distance at a corner of the picture is already fully fogged.
  - It fades into the horizon colour, the same colour the sky meets the sea in.
- **Map view.** The camera is 150 m or more from its target (it leaves below 135 m). Today's home views are 220–320 m. In the map view, past the distance the world is drawn as a map:
  - the ground at every 4th vertex;
  - the trees and plants;
  - no grass, forest floor or props;
  - each animal as a small marker.
  So a Part C island can be seen whole from above at little cost.
- **Memory pressure.** Every 2 s the streamer reads the JS heap (where the browser gives it) and the scene's GPU estimate (`runtime/memory.ts`, walked at most every 10 s). If either is over the tier's budget, the distance pulls in by 15 %, down to 60 % of the tier's. If memory is still over at 60 %, the tier drops. When both are under 70 % for 30 s, the distance steps back out. The heap budget is never more than half the heap's own limit.
- **Development overrides:** `window.__arkRenderDistance = <m>` or `window.__arkRenderScale = <share>` before mounting. The measurement page takes `?render=<m>` and `?renderScale=<share>`.

## 4. Choosing the tier

`chooseTier` in `tiers.ts`, called by `post.ts` `tierFor`:

| The device says | Tier |
|---|---|
| ≤ 2 GB (the browser's `deviceMemory`, or the app's figure) | low |
| 3 GB | low on touch, medium otherwise |
| No touch, 8+ cores, 8 GB | high |
| 6+ cores and 4 GB or more (or unknown, as on iOS) | medium |
| Otherwise | low on touch, medium otherwise |

- **These are the old answers**, plus the memory rows. A 2 GB phone with 8 cores was already low on touch; a 2 GB or 3 GB desktop was medium or high.
- **The app's figure.** iOS never tells a page its memory, and Chromium caps `deviceMemory` at 8. The apps can pass the real figure: `mountArk(..., {deviceMemoryGB})`, or `?mem=<GB>` on `/ark/embed.html`. This is optional; until the apps send it, iOS goes by cores.
- **The heap's limit is not a tier signal**, because Chromium gives 4 GB Android phones a small one. It caps the heap budget instead.
- **After that, measured performance decides.** If frames run long (median interval over 21 ms for 2 s at the full rate), the tier drops (unchanged). Memory pressure pulls the distance in, then drops the tier (§3). Battery saver and heat ask for low (unchanged).

## 5. Beyond the distance: markers and data

- **Markers.** In the map view, an animal in a `map` chunk is a 5 px marker at its last worked-out place (the `FindDots` the scene already uses for tiny animals). Outside the map view, nothing is drawn: the haze has hidden it.
- **Data.** The snapshot holds every animal, so the following come from data and are not changed by distance:
  - the HUD's counts and live bars;
  - the zone and population labels;
  - herd badges;
  - the live budget's rotation (`arkOutside`), which never looks at the camera.
- **Selecting.** `select(id)` on an animal past the distance pins it, so it is drawn wherever it is, and flies the camera there.

## 6. The far-model pack and `ark.json` in the GLB

These are the Part B inputs from `runtime.md` §10.

**`ark.json` in the GLB.**
- Each far model gets a new file, `<version>.far-ark.glb`. It is the published far GLB with its `ark.json` as the glTF's top-level `extras.ark`.
- Every other byte is as published. `--verify` decodes each file's meshopt geometry and compares it with the published file's; all 2,630 match.
- three's GLTFLoader puts the extras on `gltf.userData.ark`, and the library reads `behaviour` from there.
- The manifest says `far_ark: true`, so a far model is one request instead of two.
- The old `.far.glb` and `.ark.json` stay where they are, so an older page that read the old manifest keeps working.

**The far-model pack, one per tier, in two parts** (`streaming/pack.ts`).
- Layout of each part: `ARKP`, version, a JSON header of `{slug, version, offset, length}`, then the far-ark GLBs.
- A tier's pack holds the starting view's kinds: the first 160 / 120 / 80 far models (high / medium / low) that a run of the real Ark asked for.
- It comes in two parts. The first holds the 60 kinds the starting view asks for first (`FIRST_VIEW_KINDS`); the second holds the rest. They are fetched one after the other, so on a phone's link the first part is not sharing its bandwidth. Each kind waits only for its own part.
- The skins are fitted to the tier's far size, 256 px (high, medium) or 128 px (low), with cwebp at quality 85. The runtime fitted them to that size anyway.
- The manifest's `packs.<tier>` is the list of parts, each `{file, kinds}`.
- The library fetches the first tier's parts as soon as the manifest is in. A kind in a part at the manifest's version loads from it; any other kind loads its single file. A dropped tier never fetches another pack. A recording reads no pack.

| Pack | Kinds | Part 1 (60 kinds) | Part 2 | The same kinds as published single files |
|---|---|---|---|---|
| high | 160 | 2.05 MB | 3.37 MB | 10.70 MB, 320 requests (far.glb + ark.json) |
| medium | 120 | 2.08 MB | 2.07 MB | 8.25 MB, 240 requests |
| low | 80 | 1.22 MB | 0.42 MB | 5.54 MB, 160 requests |

**Tooling:** `scripts/ark-model-pack.mjs`.
- It reads the live manifest, and takes each file from the local talking-models build where its version matches, else from the bucket (read only).
- It writes `<out>/packed/`: the far-ark files, the packs and the manifest.
- `--serve-layout` adds `<out>/base/` (today's layout, linked), so `ark-runtime-measure.mjs --models-dir` can measure both.
- The kinds come from measurement runs (`--kinds`, pointing at their `runtime.json`; the library records `farOrder`).
- The publish pipeline can rebuild the packs from the live population whenever it publishes. A kind that leaves the starting view still loads, from its own file.

**The upload is owner-approved only. Nothing has been uploaded.**
```
node scripts/ark-model-pack.mjs --out <dir> --kinds <kinds.json> --serve-layout --verify      # build (done locally)
node scripts/ark-model-pack.mjs upload --out <dir>                                             # dry run: lists 2,636 files + the manifest
ARK_PACK_UPLOAD_APPROVED=1 SERVICE_KEY=<service_role key> node scripts/ark-model-pack.mjs upload --out <dir>
```
- The upload sends the far-ark files and the packs first, under new versioned names, immutable for a year, never overwritten (`x-upsert: false`). The manifest goes last (10 minutes, upsert), as `publish_ark.py` does.
- Rollback is re-uploading the previous manifest. The new files are inert without it.
- **The visual CI:** the golden page reads the live bucket. A recording never reads a pack, because it waits for every model anyway, and the far-ark files carry the published skins byte for byte. So once the packed manifest is live, the golden shots are the same models. Re-run the visual CI after the upload anyway.

## 7. Measured

See §9. Per tier: peak JS heap, GPU estimate, frame rate, view complete and mount time. Measured on the desktop and phone profiles in headless Chrome, the iOS Simulator's WebView and an Android emulator's WebView, including a 2 GB AVD as the low-memory phone. Emulators are not real devices.
