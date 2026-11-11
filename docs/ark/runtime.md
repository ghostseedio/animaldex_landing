# Ark runtime: loading, memory, battery, camera

The runtime lane (branch `ark-runtime-web`). Visual only: nothing here changes the server, the ecology or what any viewer sees happen; it changes when and how richly the page draws, and how the camera moves. Code in `src/ark-scene/runtime/`, wired into `mountArk` (`src/ark-scene/index.ts`) by a few one-line hooks marked "Runtime". The apps' side is `docs/ark/runtime-bridge.md`; the visual CI is `docs/ark/visual-ci.md`.

| Module | What it does |
|---|---|
| `governor.ts` | When to draw: paused when hidden, full rate while touched or while something moves on its own, 30 fps calm, 20 fps drowsy, 4 fps still (reduced motion); battery saver and heat cap the rate and ask for the low tier. |
| `power.ts` | The bridge's `ark:visible` / `ark:power`, and the browser's own sources: the page's visibility, the Battery API, the Compute Pressure API. |
| `load.ts` | The model queue's order (nearest in view first), the paced hand-over (a few finished models a frame, inside 4 ms), the first frame's shader warm-up (`compileAsync`). |
| `budgets.ts`, `memory.ts` | Per-tier skin sizes, memory ceilings and instance caps; GPU byte estimates (geometry, textures, instances). |
| `camera.ts` | Collision with the ground, trees, rocks and buildings; damping per second; the follow without lag; the mouse wheel's glide. |
| `ui.ts` | The quiet loading bar and the reset button. |
| `index.ts` | `createArkRuntime`: the one object mountArk makes; the handle's `setVisible`, `setPower`, `receive`, `resetView`, `runtime()`. |

## 1. Progressive loading

- **The first frame waits for the shaders, not on them.** Every material in the scene is compiled with `renderer.compileAsync` (KHR_parallel_shader_compile where the driver has it) into the post chain's render target, so the programs match the ones drawn; the first frame is drawn when they are ready (at most 5 s). Before, the first frame's first use of each program blocked the main thread while it compiled (`onFirstUse`, 3.4 s in the desktop profile).
- **Order by distance.** The model queue (`ModelLibrary.priority`) takes, each time a load ends, the queued level of the species that is in view and nearest; then in view and far; then out of view (×3 its distance); then the ones not seen at all (micro species not yet drawn, the deep, the underground). A species' near level ranks just behind its far one.
- **Paced hand-over.** A finished level waits in the library until the frame loop hands it to the scene, its skin uploaded to the GPU then (`renderer.initTexture`), a few a frame inside a 4 ms budget (at least one a frame), so a burst of loads never lands in one frame. While models are coming in the frame rate stays full.
- **New shaders never stall a frame.** A mesh the scene adds whose material's shader is new (a species' first instances, the first rig) waits undrawn on another layer while its shader compiles in parallel, then appears; after a tier change the scene's new shader variants compile the same way before the next draw (the last picture stays up). On the desktop walk (the camera flown animal to animal) the worst frame went from 5.5 s to 0.4–1.8 s.
- **A quiet loading state.** A 2 px bar at the foot of the world (above a tap band) shows the share of what was asked for that is in. It appears only if loading lasts more than 0.6 s and fades when everything asked for is in. No words. Hidden in recordings.
- **The grass is built for the tier.** `buildVegetation` used to build 56,000 tufts on every device and draw a tier's share; now it builds the tier's count (`GRASS_BUILD`: high 56,000, medium and low 22,000 so the lighter view can be turned off). The tufts are generated in order, so the first 22,000 of the big list are exactly the small list: the picture is the same.

### Measured

See §5 for the numbers and what they show.

## 2. Memory budgets per tier

The animals are what grows with the Ark: per species a near and a far model, each with its own 512² skin (1.33 MB on the GPU with mipmaps). At 150 species that is ~400 MB of skins, past what a phone's WebView keeps before it loses the GPU context. Per tier (`ARK_BUDGETS`):

| Tier | Skins (MB) | Meshes (MB) | Near skin | Far skin | Near instances | Near species | Models drawn |
|---|---|---|---|---|---|---|---|
| high | 320 | 96 | 512 | 256 | 150 | 60 | 150 |
| medium | 128 | 48 | 512 | 256 | 90 | 32 | 120 |
| low (and the lighter view) | 64 | 24 | 256 | 128 | 40 | 24 | 80 |

- **Skins are fitted on load**, before they reach the GPU (`createImageBitmap` with a resize, a canvas where that fails; Chrome does the resize on the main thread, about 2 ms a skin on the desktop and 8 ms at 4× throttle, between frames). A far model is a few dozen pixels tall on screen; a 256² skin is 4× smaller than 512² and looks the same there.
- **Ceilings.** Twice a second the library's bytes are summed (`memory.ts` estimates); over the tier's ceiling, the near level of the species drawn near least recently goes (`ModelLibrary.evict`), never one drawn near in the last 3 s, never a far level. Its far model stands in, and the near one is loaded again when the camera comes back.
- **Instance caps** per tier (were: high and medium the same; now medium has its own).
- The scenery's own cost is fixed per tier (ground, trees, grass, post-processing targets).

## 3. Visibility, idle and power

`governor.ts`, with the bridge in `docs/ark/runtime-bridge.md`:

- **Hidden** (`document.hidden`, `pagehide`, the world scrolled off screen, or `ark:visible` false): nothing draws and the frame loop stops requesting frames until it is visible again. (Before, it requested every frame and returned at once; and an app's covered panel kept drawing.)
- **Idle**: no input for 5 s and nothing moving on its own (flight, follow, replay, talking, opening, an arrival, a wheel glide): 30 fps; 2 min: 20 fps; reduced motion and nothing moving: 4 fps. Input brings the full rate back on the same frame. The tier check measures frames only at the full rate (a capped frame is not a slow device).
- **Power**: battery saver or heat `serious` → at most 30 fps and the low tier; heat `critical` → 20 fps. When the cap lets go, the tier from before comes back. From the apps (`ark:power`), else the Battery API (≤ 20 % and not charging), else CPU pressure (`critical` for 20 s counts as `serious`; a busy machine reads `serious` without being hot, so that alone changes nothing). A recording ignores the browser's hints; a tier pinned for measuring stays pinned.

Checked in the browser (desktop Chromium, the measurement page, the bridge messages through `handle.receive`): touched, 120 frames in 2 s; left alone, 30 fps; `ark:visible` false, 0 frames drawn and none even skipped (the loop sleeps); visible again, 30 fps; `ark:power` saver, the low tier and 30 fps even while touched; heat `critical`, 20 fps; `nominal`, the high tier back. A reset after a drag: the button showed, flew home, and hid (`scratchpad/runtime/ui/*.png` in the lane's report).

## 4. Camera

`camera.ts`:

- **Collision.** The camera's eye (0.35 m) never sits inside a tree trunk, a rock, the cottage or the barn: it is pushed out at once along the surface. Inside a crown it glides out over ~0.15 s. A crown the looked-at animal is in does not push (a bird in a tree). By a small animal (a close-up), only solid things push, by 6 cm. Over the ground it keeps the scene's clearance against ground rising just round the eye too, not only under it, easing up instead of jumping. The obstacles come from the scenery's own seeded lists (`worldDecor`, `forestFill` within the tier's fill share), so every viewer's camera meets the same trees. Not in recordings (the director's camera, the golden shots).
- **Momentum.** OrbitControls' damping is per frame (0.075 at 60 Hz): the glide after a drag lasted half as long on a 120 Hz screen and twice as long at 30 fps. It is now set per frame from the frame's time, so it is the same everywhere. A mouse wheel's notch glides over ~0.15 s (handed to OrbitControls in shrinking parts, so zoom-to-cursor still aims at the pointer); trackpads and pinches pass through as they are.
- **Smooth follow.** The follow closed 12 % of the gap per frame (frame-rate dependent, and always behind a moving animal). It now closes the gap with a 0.14 s time constant, aiming one time constant ahead by the animal's speed, which cancels the lag at a steady pace (tested: 3 m/s, under 8 cm behind after 4 s; the same at 30 fps).
- **Reset.** A round button at the foot of the world's end side (above a tap band) appears once the view is away from the whole-island view (and nothing is selected); it flies home. `handle.resetView()` and `ark:reset` do the same. Its accessible name is the page's `resetLabel`, from the Ark words' `a11y.resetView` (all 45 languages).

## 5. Numbers

`node scripts/ark-runtime-measure.mjs --label <name> [--devices desktop,phone] [--runs 3] [--network 4g] [--walk] [--budget <MB>] [--profile]` (the golden harness's devices; the phone is 360×800 at DPR 2, 4× CPU throttle, 8 cores / 4 GB reported, so the medium tier). Per run: time to the first frame, how long `mountArk` held the main thread, the long tasks, when the models in view were in, the JS heap and the scene's GPU estimate. `--walk` flies the camera animal to animal; `--budget` sets a small skin ceiling; `--profile` writes a CPU profile per run.

**Caveat:** measured on the shared Mac while 15+ other agents ran (load average 45–60 on 16 cores), so wall times swing ±30 % run to run. Before and after were interleaved (before, after, before, after…) on the same fixture (130 animals, 46 species) to share the noise; medians of 3. Before = `ark-release` a92a19b9, after = this branch.

| | first frame (ms) | mountArk (ms) | in view (ms) | longest task (ms) | worst after the 1st frame (ms) | JS heap (MB) | GPU: meshes + textures (MB) |
|---|---|---|---|---|---|---|---|
| desktop, before | 4,713 | 4,003 | 6,554 | 4,033 | 97 | 74 | 16 + 81 |
| desktop, after | 5,030 | 4,408 | 8,332 | 4,437 | 97 | 74 | 16 + **41** |
| phone, before | 19,445 | 18,504 | 24,298 | 18,606 | 525 | 70 | 16 + 71 |
| phone, after | 15,844 | 14,803 | 20,458 | 14,936 | 482 | 66 | 13 + **38** |

What they show:
- **GPU memory: halved** for the same Ark (the skins fitted per tier); it grows with species at about a quarter of the old rate on the medium tier, and the budgets bound it.
- **The long task is the mount itself**, before any frame: 4 s on the desktop, 15–18 s on the throttled phone profile, on a machine this loaded (2.5 s and 10.9 s on a quieter run earlier the same day). The runtime cannot split it from outside; it is the scenery and behaviour builds (profile, phone, ms of 12,200 in `mountArk`): `buildVegetation` 6,400 (the forest fill 4,000: 220,000 ground samples for 640 trees; the grass 1,700), `buildLandscape` 2,100, `setSnapshot` 2,000 (the behaviour schedule's places and walk grid 1,000). The runtime's part: the grass built for the tier (the phone builds 22,000 tufts, not 56,000: the phone median mount 18.5 → 14.8 s). A same-result speed-up of the forest fill is handed to the graphics lane (§8).
- **The first frame after the mount**: before, its first use of every shader compiled them on the main thread (`onFirstUse`, 3.4 s in a desktop profile); now the scene's shaders compile in parallel before it, in a 263 ms task plus a ~500 ms first draw on the phone profile (the post chain's and the shadow pass's own shaders still compile at first use).
- **In view** (every model asked for by then in) is within the noise; the desktop's later time comes from the load order now starting with what the camera sees after the opening (the old order was the snapshot's).
- The walk with a 6 MB skin ceiling (an impossible one: the far levels alone are 16 MB) let 74 near levels go in 30 s, never one drawn near, and loaded them again only when the camera came back within the near distance; no errors.

A quiet machine and a real phone will give cleaner numbers: rerun the same command (§6).

## 6. WebView testing (later lane)

Desktop Chrome with the phone profile is a proxy: it throttles the CPU but not the GPU, and its memory is not the WebView's. Plan for the app lanes:

1. **iOS** (WKWebView, a mid iPhone and an older one, e.g. iPhone 12 and SE 2): Safari Web Inspector attached to the app's WebView → Timelines (JavaScript & Events for long tasks, Rendering Frames for frame rate) for a cold open of the panel; Xcode's Memory gauge and Instruments' VM Tracker / Metal System Trace for GPU memory as the Ark fills (watch for a WebContent process jetsam: the page reloads blank). Check `scene.runtime()` from the inspector console (model bytes against the tier's budget, evictions).
2. **Android** (WebView, a mid-range phone with 4 GB, e.g. Galaxy A35, and a 3 GB one): `chrome://inspect` → Performance panel for a cold open; `adb shell dumpsys meminfo <package>` (Graphics and GL lines) as the Ark fills; `adb shell dumpsys gfxinfo <package> framestats` for frame times idle (expect 30 fps after 5 s) and covered (expect none with `ark:visible` false).
3. **Both**: the bridge's states (`docs/ark/runtime-bridge.md` §Testing): covered, background, Low Power Mode / battery saver, a heat override; the reset button and the loading bar at the panel's size; a WebGL context loss (Safari's "Lose context" in the inspector's Canvas tab) to see the page's fallback.
4. If a device loses the context or jetsams at its tier: lower that tier's `textureMB` in `budgets.ts`, or move the device class down a tier in `post.ts` `tierFor`.

## 7. At the captures scale (~3,100 animals at launch, ~9,400 in a year)

The owner's decision that captures bring animals aboard (AnimalDex `docs/ark/captures-backfill-dry-run.md`) puts the Ark at 25–70× today's fixture. The dry run measured what breaks: the mount's single task, then CPU per frame linear in the animals drawn one by one, then downloads and memory; not the GPU.

**The live budget** (`src/ark-scene/live-budget.ts`, wired in `setSnapshot`): at most **1,200 / 400 / 200** animals (high / medium / low and the lighter view) are drawn one by one; everyone else is **resting out of sight** by a rotation that is the same for every viewer:
- it depends only on the shared clock (5-minute steps of epoch seconds), the animals' ids and the budget, never on the camera; `arkOutside(candidates, budget, epochSeconds, pinned)` is pure, so the map and behaviour lanes can drive it (dens, burrows, roosts, the indoor/outdoor rule) without touching the scene;
- every kind keeps at least one outside when the budget allows (953 kinds at 1×: on the medium and low budgets the kinds themselves take turns, one each out), the rest of the budget by the kind's size;
- each step, one animal of each crowded kind goes in to rest and the next comes out (an entrance: it grows in); everyone takes a turn;
- nested across tiers: whoever a phone shows, a desktop shows too;
- the reader's own animals, a selected, followed or replayed one, are always out on top; selecting a resting animal from the HUD brings it out, as a herd member already did;
- the snapshot, the HUD's counts and the herds are untouched: the Ark holds everyone.

**Far models by budget and distance:** a big Ark asks up front only for the herds' kinds and the tier's 160 / 120 / 80 kinds nearest the view; the rest are asked for when an animal of the kind is in view within 260 / 160 / 110 m, in the load order of §1 (an animal without its model is drawn as its icon meanwhile).

**Measured** (scripts/ark-scale-fixture.mts and ark-scale-run.mjs from `ark-scale-test`, the same devices and populations), the release build (a92a19b9) and this branch run one after the other on the same machine, 07:40–08:07 UTC; the Mac's load average ~27–50:

| | Desktop 1× | Desktop 3× | Phone profile 1× | Phone profile 3× |
|---|---|---|---|---|
| Mount, longest task (ms), release → runtime | 4,514 → 3,489 | 13,411 → 4,095 | 20,362 → 14,339 | 51,584 → 9,772 |
| Scene CPU per frame (ms), the three views | 18–26 → 16–22 | 35–55 → 17–23 | 42–114 → 13–17 | 151–183 → 16–24 |
| Frame interval p50 (ms) | 17–33 → 17–33 | 33–67 → 17–33 | 50–117 → 17 | 133–167 → 17–33 |
| Drawn one by one | 2,447 → 1,195 | 6,225 → 1,179 | 2,339 → 200 | 5,697 → 200 |
| Load to quiet (s) | 78 → 112 | 135 → 77 | 160 → 40 | 297, not quiet → 28 |

The phone profile ran on the low tier in both builds (the scene drops a tier under the 4× throttle on this loaded Mac): budget 200; a phone that holds the medium tier gets 400. Per-frame CPU no longer grows with the population: 3× costs what 1× does. The desktop's 1× load to quiet is the one number that got slower (the release loaded the island's models in a different order and finished sooner; the branch asks for them as they come into view and was still filling in the near views). Full tables: `docs/ark/scale/runtime-budget-v1.md` (this branch) and `release-same-time-v1.md` (the release, same session); the dry run's own numbers (load ~61) are in `scale-v1.md`.

**Resting animals sit out first.** `ArkLiveCandidate.resting` (or, lazily, the scene asking behaviour's `restingAtRoost(...).resting` for the members of a crowded kind): a kind's quota is filled with the members not settled at their roost first, in ring order from the step's start, then the resting ones. Still the same for every viewer and nested across tiers (one ordered list, cut longer for a larger budget). Until behaviour's `restingAtRoost` is in the release the scene guards for its absence (no one counts as resting); the snapshot is laid out again once behaviour's world is built.

**Rule E and the hamlet (for the map lane).** `setArkZoneCapacity(zone => capacity | null)` (live-budget.ts) gives the scene each zone's visible capacity; the scene then keeps at most that many of a zone outside (`arkWithinCapacity`: the same shared ring by id, resting ones first, pins always), before the tier's budget, so it is the same on every device and the tiers stay nested. The map's hamlet takes the same rotation: `hamletState(residents, epoch, hours, arkOutside)` (`arkOutside` has the hamlet's `ArkOutsideFn` shape), replacing its `ringOutside` stand-in when map and runtime meet in the release.

**The prebuild (done).** `prepareArk({snapshot, workerUrl?, placesWorkerUrl?})` (`runtime/prebuild.ts`) runs the decor, the forest fill and the grass for the device's tier in a 20 KB worker (`prebuild-worker.ts`, no three.js), and, from 1,000 animals, their places in a second worker (`prebuild-places-worker.ts`, 1.1 MB: it carries the placement's species data); both are built into `public/ark/` by `scripts/build-ark-bundle.mjs` for the apps, and by the site's bundler from `new URL(..., import.meta.url)`, and hands them to the modules through thin prime hooks before `mountArk`:
- `decor.ts`: `primeDecor({decor, fill, grass})` (fills the existing `cached` and `fillCache`; `grassTufts(count)` returns a primed list of that count once);
- `placement.ts`: `primePlaces(animals, places)` (`placeAnimals` returns it once, for that very array).
The output is identical: `src/lib/ark-prebuild.test.ts` deep-compares every list after a structured clone. The /ark page and the embed await it before mounting; without workers nothing is primed and the mount computes as before. The grass travels packed (six numbers and a zone per tuft).

Measured (`node scripts/ark-runtime-measure.mjs --population 1x|3x [--prebuild]`, one run each, the same session, load ~30–50; the phone profile's 4× throttle applies to the main thread only, so its worker runs at desktop speed here: on a real phone the worker takes longer, on another core):

| | mount task, without → with the prebuild (ms) | first frame (ms) | worker (ms) |
|---|---|---|---|
| fixture, phone | 11,002 → 3,408 | 12,218 → 6,075 | 1,963 |
| 1×, desktop | 4,772 → 1,784 | 5,991 → 4,920 | 2,556 |
| 1×, phone | 16,879 → 7,592 | 18,526 → 10,725 | 2,180 |
| 3×, desktop | 4,729 → 1,727 | 5,886 → 4,980 | 2,672 |
| 3×, phone | 16,307 → 6,785 | 18,029 → 10,075 | 2,160 |

Not yet at the ~200 ms target: the ground (below) and the rest of the scene's setup stay in the mount, and with the prebuild the phone profile also showed one 2.6–2.7 s task a few seconds after the first frame (without it, 0.2–0.3 s), not yet attributed (a tier change's rebuild is the first suspect).

**What is left of the mount.** With the budget, the population's part of the mount is bounded (placing 9,420 animals is ~0.5 s); the rest is the scenery and the behaviour schedule, the same as for 130 animals: 3.5–4 s on the desktop and 10–14 s on the phone profile under this load. No single task under 50 ms needs it split, and the pieces are other lanes' builders, so this is the plan rather than the change:
1. **The ground (graphics).** `terrain.ts` `groundGeometry` samples the ground at every vertex (~2 s of the phone profile's remaining mount). The hook it needs: move its per-vertex loop into a pure `groundArrays()` returning the typed arrays (heights, colours, layers, the depth map), which the prebuild worker computes and `primeGround(arrays)` hands in; the geometry is then built from them. Transferred as typed arrays, no copy. (The behaviour world already builds in 6 ms slices, and the attach points too.)
2. **A progressive mount.** `mountArk` builds in slices under 50 ms (the ground, the water, each vegetation kind, the micro scene, the layers, the animals in batches), yielding between them, and draws the first frame from the ground and the sky while the rest comes in behind the quiet loading bar; the handle works from the first call (calls queue until the animals are in).
3. Meanwhile the forest fill's 2.3× speed-up (§8) and the grass by tier cut the scenery's share now.

## 8. For other lanes

- **Graphics** (`decor.ts` forestFill): test the clump noise before sampling the ground, against the densest zone's density (0.32): the same 639 trees, 2.3× faster (14.8 s → 6.4 s side by side in node on the loaded Mac; ~1.5 s of the phone profile's mount). Patch: `docs/ark/runtime/graphics-forestfill-prefilter.patch` (applies to ark-release a92a19b9), verified identical with a deep-equal test of the old and new lists.
- **Graphics / props / scene**: round the shader frequencies in graphics-interface.md's "shared clock" table.
- **Behaviour**: the schedule's places and walk grid (1 s of the phone profile's mount) to a worker or chunks, as planned; drive the resting rotation (`arkOutside`) from dens, roosts and burrows when ready.
- **Map**: the live budget's pure rotation is the hook for "resting out of sight" per area (home 240 / 120 / 60 in the dry run's proposal).
- **Map / owner** (seen in the 3× shots, `docs/ark/scale/`): the live budget bounds the animals drawn one by one, not the herds' figures. At 3× the house area shows about 900 herd figures (cats and dogs ×921, ×786 round the cottage). The same rotation can rest a share of each herd (`arkOutside` over herd members, or the home area's own budget); that is a look decision for the owner.
- **Graphics (reef)**: `fish-schools.ts` keeps its own sea clock (`seaEpochSeconds`, `pinSeaClock`, 600 s): the same window as the shared clock, so they agree; `seaEpochSeconds` can return `arkEpochSeconds()` and the golden page can pin both with `pinArkClock`.
- **Integrator**: on ark-release 02fbaa24 itself three tests fail (behaviour "prey watch a predator they can see", props "props build…" and "props nest sites…"); the same three fail on this branch after merging it, and nothing else.
- **i18n**: done here: `ark.a11y.resetView` in all 45 languages (the lane's own translations; a native read is welcome).
- **Apps**: post `ark:visible` and `ark:power` (docs/ark/runtime-bridge.md).

