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
| Animals (`index.ts` updateInstances) | its pose now (its schedule's position) | modelled, stepped, rigged | its model while ≥ 6 px on screen (true scale: a whale), else a 5 px marker | nothing, and its schedule is not stepped |
| Herds (`planHerds`) | whole herd sphere | figures and specks | figures while ≥ 6 px on screen, else badge only | badge only |
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
| high | 960 m | 40 m | 0.7 → 1.0 of the distance | 768 MB | 512 MB |
| medium | 640 m | 32 m | 0.7 → 1.0 | 512 MB | 320 MB |
| low (and the lighter view) | 440 m | 26 m | 0.7 → 1.0 | 384 MB | 192 MB |

The budgets are about twice the peaks measured on the real Ark (§7), so today's island never pulls its distance in.

- **Sized for Part C.** On today's island (land within about 112 m of the middle, and an eye at most about 460 m out), every chunk is `in` from every view the camera can take on medium and high. The test sweeps targets, distances, polar angles and azimuths. The low tier's 440 m covers both home views: the phone's far shore is about 415 m off. So **the default view is unchanged on every tier**, and the visual CI is unchanged.
- **The haze is the scene's own fog, pulled in** (`haze.ts`). The fog's `near` and `far` become accessors: whoever sets them (the scene, the weather) sets the base, and three reads the nearer of the base and the haze.
  - The haze is on only while some chunk with content (land, plants, an animal's home) lies past the distance. It ramps up over the last 25 m and eases in over 0.6 s. It is never on in the map view.
  - With it off, the accessors return the base unchanged, so the fog is exactly what it was.
  - Chunks are culled by radial distance, but three's fog is by depth, so the haze is whole at the distance × cos(the view's half diagonal). A chunk just past the distance at a corner of the picture is already fully fogged.
  - It fades into the horizon colour, the same colour the sky meets the sea in.
- **Map view.** The camera is 150 m or more from its target (it leaves below 135 m). Today's home views are 220–320 m. In the map view, past the distance the world is drawn as a map:
  - the ground at every 4th vertex;
  - the trees and plants;
  - no grass, forest floor or props;
  - each animal as a small marker, unless it is at least 6 px long on screen, when it keeps its model (true scale, below).
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
- **True scale (lane L4, `ark-true-scale`).** What is drawn goes by size on screen, not distance alone.
  - Inside the distance, L4's own rules apply: the model cap goes to the animals largest on screen, and those under 10 px past the cap are find-dots.
  - Past the distance in the map view, an animal (or a herd) at least `MAP_MODEL_PIXELS` = 6 px long on screen keeps its model; smaller ones are markers.
  - In a ground view nothing past the distance is drawn, big or small: the haze is whole there, like the land the animal stands on.
  - On a phone held upright (800 CSS px tall, 38°):
    - **A 25 m whale** is 66 px at low's 440 m, 45 px at medium's 640 m and 30 px at high's 960 m. It keeps its model from the map view out to about 4.8 km, so across any Part C island.
    - **A 7.5 mm beetle** is 6 px at 1.45 m and under 1 px past 9 m. It is a model only right up close (inside the distance, L4's cap and dots decide, and as before not past 42 m), and a marker past the distance in the map view.
  - The two branches merge cleanly (checked); the test is `ark-streaming.test.ts` "true scale past the render distance".
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

**How.**
- The real Ark: 3,137 animals, the local snapshot, never copied. The prebuild was on.
- The model set was the public bucket's, read only, except in the pack runs.
- `scripts/ark-runtime-measure.mjs` ran on 2026-11-12. The shared Mac carried 15+ other lanes, at a load average of **43–63 during the headless runs and 120–160 during the emulator runs**. Wall times swing a lot run to run.
- What was measured:
  - Peak JS heap is the largest `usedJSHeapSize` sampled every 250 ms (Chromium only).
  - Peak GPU is the scene's own estimate (`runtime/memory.ts`).
  - fps is over the steady part, after view complete.
  - View complete is from the script's first line until every model the starting view draws is in.
  - Mount is the time `mountArk` held the main thread.

**Headless Chromium, the GPU on (Metal), 2 runs each.** The phone profile is 360×800 at DPR 2 with a 4× CPU throttle.

| Profile / tier | Peak JS heap | Peak GPU est | fps | View complete | Mount |
|---|---|---|---|---|---|
| desktop high | 324–336 MB | 187–205 MB | 59 | 10.4–10.9 s | 201–220 ms |
| desktop medium | 181–183 MB | 142–147 MB | 60 | 8.3–9.0 s | 199 ms |
| desktop low | 200–201 MB | 77–81 MB | 60 | 5.6–9.0 s | 199–200 ms |
| phone medium (its own tier) | 167–168 MB | 119 MB | 42–52 | 12.4–12.9 s | 787–792 ms |
| phone low | 170–172 MB | 72 MB | 56–58 | 10.2–12.4 s | 816–942 ms |
| phone high (forced) | 207–208 MB | 80 MB | 17 | 16.0–24.7 s | 840–970 ms |

**The iOS app's own WKWebView**, in the Simulator on an iPhone SE (3rd gen).
- This was the AnimalDex DEBUG build from main, in the Your Step gallery with the Ark panel held open (`-AnimalDexArkPanel open`). The measurement page was loaded through `-AnimalDexArkEmbedURL`, and the gallery snapshot came from the real file.
- Memory is the WebContent process's footprint (`footprint`), sampled every 2 s from the Mac.
- WebKit has no heap reading; the JS VM line of the footprint stands in for it.
- 1 run each. The Simulator draws with the Mac's GPU, so this is not an iPhone.

| Tier | WebContent footprint, peak | JS VM | Peak GPU est | fps | View complete | Mount |
|---|---|---|---|---|---|---|
| auto (picked medium: 8 cores reported, no memory figure) | 247 MB | 85 MB | 128 MB | 24 | 21.4 s | 563 ms |
| high (forced) | 399 MB | 95 MB | 154 MB | 17 | 26.0 s | 634 ms |
| medium | 408 MB | 96 MB | 123 MB | 34 | 19.4 s | 571 ms |
| low | 334 MB | 84 MB | 72 MB | 45 | 37.2 s | 644 ms |

(Two earlier probes at medium, on a quieter Mac: 54.8–56 fps, view complete 15.5–20.8 s, mount 327–1,293 ms.)

**The low-memory Android phone: the streaming lane's own AVD, `ArkStreamingLowMem`.**
- Android 15 (API 35, google_apis, arm64), 720×1600, Android System WebView 124.
- **2.0 GB RAM.** The emulator raises a 2 GB AVD to 2.5 GB by itself; `-qemu -m 2048` holds it at 2,022,068 kB.
- The page ran in a WebView with the Android app's Ark panel settings (`scripts/ark-webview-host/`, ArkHost.apk, built with the SDK's tools: JavaScript and DOM storage on, the same zoom, file and media settings). The app itself shows the Ark only after sign-in.
- Memory is `dumpsys meminfo` PSS. **Emulators are not phones**, and this one ran at about 12 % of one Mac core: the host's load was 120–160.

| Run | Tier | WebView renderer PSS, peak | App process | What happened |
|---|---|---|---|---|
| auto, software GL (SwiftShader) | low (picked: touch, 4 cores; the WebView reports no `deviceMemory`) | 195 MB | 78 MB | Mount 13.0 s; the scene's first frame never came within 60 s (shaders and mount steps on a starved CPU); 1.8 page fps |
| auto, host GPU (M3 Max through the emulator's GL) | low | 203 MB | 75 MB | Mount 11.4 s; still no first frame within 60 s; the guest swapping (1.9 of 2.0 GB used, 470 MB in swap) |
| auto, host GPU, 200 s | low | ~300 MB (`top` RES) | — | The prebuild worker timed out at 61 s (places fell back to the main thread); mount 21.1 s; no first frame in 200 s |

So on the 2 GB AVD the page loads, picks the low tier on its own, and holds the renderer at about 200–300 MB with the system swapping. But on this starved emulator it does not reach a drawn frame. That is the CPU, not memory (no renderer kill, no low-memory kill). A real 2 GB phone, or this AVD on a quiet Mac, is the test that remains (§8).

**Streaming itself on today's island.**
- Every chunk is `in` on every tier from every view the tests sweep, and no animal is skipped. So these numbers are the scene's own, at the tier's budgets.
- The tour runs (the camera down in each region and back up, phone profile): medium at its whole distance peaked at 97 MB GPU; with the distance forced to 0.4×, it peaked at 71 MB (as few as 10 of the 25 chunks in). Low was unchanged at 78 MB, because the island is small next to 176 m.
- A fixed ground view with the distance forced to 150 m (an island about 4× this one, seen from the same place) is in §7.1.

### 7.1 A short render distance

This shows what the distance saves once a world outgrows it.
- **The setup:** a fixed ground view, the camera brought down to the coast (`--focus coast`), on the phone profile at the medium tier, 2 runs each. The whole distance (640 m: all 25 chunks in) is compared with the distance forced to 150 m (as if the island were about 4× this one, seen from the same place).
- **The haze:** on (1.0) at 150 m and whole by then, 0 at the whole distance.
- **Frame CPU time:** within the noise, 23–31 ms either way. This view's cost is the near scene; the Mac's load was ~150.

| Distance | Chunks in | Tiles hidden | Triangles (median) | Draw calls | Far models loaded | Peak GPU est | Peak JS heap |
|---|---|---|---|---|---|---|---|
| 640 m (the tier's) | 25 | 0 | 680–697 k | 116–135 | 181 | 73–75 MB | 167–184 MB |
| 150 m (forced) | 14–15 | 10 | 547 k (−21 %) | 108 (−13 %) | 133–135 (−26 %) | 68–70 MB (−7 %) | 152–154 MB (−10 %) |

Screenshots: `scratchpad/streaming/haze-full.png`, `haze-150.png` (the coast at night: the far fields fade into the night air) and `haze-map150.png` (the home view at 150 m: the map view draws the whole island, the ground beyond 150 m at every 4th vertex, its animals as markers; no cracks).

### 7.2 The far-model pack

**The setup.**
- Both runs use the same local copy of the model set, each request answered after 180 ms (the bucket's measured time to first byte). The phone profile also has a 4G link (9 Mbit/s, 60 ms).
- **base** is today's layout (`far.glb` + `ark.json`). **packed** is the two-part pack plus far-ark files.
- Runs were interleaved, 2 each. "After first frame" is view complete minus the first frame.

| Phone profile, 4G | Requests to the starting view | View complete | After first frame | Far models from the pack |
|---|---|---|---|---|
| medium, base | 143–145 | 26.1–30.6 s | 12.9–14.6 s | — |
| medium, packed | **51–52 (−64 %)** | 26.6–30.9 s | 13.7–13.8 s | 107–112 of 231–236 |
| low, base | 77–79 | 24.0–26.6 s | 8.0–8.4 s | — |
| low, packed | **25–26 (−67 %)** | 22.6–24.9 s | 7.9–8.3 s | 71–72 of 118–125 |

(An earlier run with one pack per tier: desktop high 157–427 → 78 requests to view.)

- **Requests and bytes fall by about two thirds and one half.** The medium pack is 4.16 MB for 120 kinds, against 8.25 MB as single files.
- **Time to the starting view did not change on this machine.** At a load average of ~120, the phone profile's 4×-throttled main thread (decoding and handing over the models, `drain`'s 4 ms a frame) is the bottleneck, not the network. In runtime.md's round 7 the cost per file (~0.2 s to first byte, 240 files) was the bottleneck.
- **What remains to measure:** a real phone on a real network, where each request also pays radio and TLS setup. The pack's saving is in requests, so that is where it should show.

## 8. What is left (Part C and the apps)

- **Generation per chunk (Part C).** Today the decor, forest fill, grass, attach points and the ground's arrays are built for the whole island once (in the prebuild worker), then split by chunk. That is what keeps today's picture exact. For a much bigger island, each generator should take a chunk:
  - the ground's arrays per tile, from the worker as the tile comes in;
  - the decor, fill and grass seeded per chunk;
  - `prepareAttachPoints` per chunk.
  A new island's content can be seeded that way from the start, since Part C makes new land anyway. The streamer's `onChange` is the hook.
- **Coarser map tiles.** A `map` tile today is every 4th vertex. A 1 km island seen whole wants every 8th or 16th, by distance.
- **Culling to the view.** Instances are compacted by distance only. Compacting to the camera's view as well would cut more when the camera is close, but trees behind the camera still cast shadows into the view, so it needs the shadow camera's frustum too.
- **The apps:**
  - pass `?mem=<GB>` on the embed URL (iOS `ProcessInfo.physicalMemory`; Android `ActivityManager.MemoryInfo.totalMem`, whose WebView reports no `deviceMemory`);
  - open the panel on a real low-memory Android phone (2–3 GB) and an older iPhone;
  - read the WebView renderer's PSS (`dumpsys meminfo`) and the WebContent footprint as the Ark fills.
- **The 2 GB AVD on a quiet Mac.** This lane's runs never reached a first frame on a starved emulator (§7). The same `ArkStreamingLowMem` AVD with `-gpu host -qemu -m 2048` and `scripts/ark-webview-host/` can repeat it in a few minutes once the load is down.
- **The pack on a real network.** See §7.2.
