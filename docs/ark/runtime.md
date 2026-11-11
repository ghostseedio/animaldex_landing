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
- **Paced hand-over.** A finished level waits in the library until the frame loop hands it to the scene, a few a frame inside a 4 ms budget (at least one a frame), so a burst of loads never lands in one frame.
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

- **Skins are fitted on load**, before they reach the GPU (`createImageBitmap` with a resize, off the main thread where the browser can; a canvas otherwise). A far model is a few dozen pixels tall on screen; a 256² skin is 4× smaller than 512² and looks the same there.
- **Ceilings.** Twice a second the library's bytes are summed (`memory.ts` estimates); over the tier's ceiling, the near level of the species drawn near least recently goes (`ModelLibrary.evict`), never one drawn near in the last 3 s, never a far level. Its far model stands in, and the near one is loaded again when the camera comes back.
- **Instance caps** per tier (were: high and medium the same; now medium has its own).
- The scenery's own cost is fixed per tier (ground, trees, grass, post-processing targets).

## 3. Visibility, idle and power

`governor.ts`, with the bridge in `docs/ark/runtime-bridge.md`:

- **Hidden** (`document.hidden`, `pagehide`, the world scrolled off screen, or `ark:visible` false): nothing draws and the frame loop stops requesting frames until it is visible again. (Before, it requested every frame and returned at once; and an app's covered panel kept drawing.)
- **Idle**: no input for 5 s and nothing moving on its own (flight, follow, replay, talking, opening, an arrival, a wheel glide): 30 fps; 2 min: 20 fps; reduced motion and nothing moving: 4 fps. Input brings the full rate back on the same frame. The tier check measures frames only at the full rate (a capped frame is not a slow device).
- **Power**: battery saver or heat `serious` → at most 30 fps and the low tier; heat `critical` → 20 fps. When the cap lets go, the tier from before comes back. From the apps (`ark:power`), else the Battery API (≤ 20 % and not charging), else CPU pressure (`critical` for 20 s counts as `serious`; a busy machine reads `serious` without being hot, so that alone changes nothing). A recording ignores the browser's hints; a tier pinned for measuring stays pinned.

## 4. Camera

`camera.ts`:

- **Collision.** The camera's eye (0.35 m) never sits inside a tree trunk, a rock, the cottage or the barn: it is pushed out at once along the surface. Inside a crown it glides out over ~0.15 s. A crown the looked-at animal is in does not push (a bird in a tree). By a small animal (a close-up), only solid things push, by 6 cm. Over the ground it keeps the scene's clearance against ground rising just round the eye too, not only under it, easing up instead of jumping. The obstacles come from the scenery's own seeded lists (`worldDecor`, `forestFill` within the tier's fill share), so every viewer's camera meets the same trees. Not in recordings (the director's camera, the golden shots).
- **Momentum.** OrbitControls' damping is per frame (0.075 at 60 Hz): the glide after a drag lasted half as long on a 120 Hz screen and twice as long at 30 fps. It is now set per frame from the frame's time, so it is the same everywhere. A mouse wheel's notch glides over ~0.15 s (handed to OrbitControls in shrinking parts, so zoom-to-cursor still aims at the pointer); trackpads and pinches pass through as they are.
- **Smooth follow.** The follow closed 12 % of the gap per frame (frame-rate dependent, and always behind a moving animal). It now closes the gap with a 0.14 s time constant, aiming one time constant ahead by the animal's speed, which cancels the lag at a steady pace (tested: 3 m/s, under 8 cm behind after 4 s; the same at 30 fps).
- **Reset.** A round button at the foot of the world's end side (above a tap band) appears once the view is away from the whole-island view (and nothing is selected); it flies home. `handle.resetView()` and `ark:reset` do the same. Its accessible name is the page's `resetLabel` (English until the Ark words carry `a11y.resetView` in every language).

## 5. Numbers

`node scripts/ark-runtime-measure.mjs --label <name> [--devices desktop,phone] [--runs 3] [--network 4g]` (the golden harness's devices; the phone is 360×800 at DPR 2, 4× CPU throttle, 8 cores / 4 GB reported, so the medium tier). Per run: time to the first frame, how long `mountArk` held the main thread, the long tasks, when the models in view were in, the JS heap and the scene's GPU estimate. `--profile` writes a CPU profile per run.

(Filled in below from the A/B runs.)

## 6. WebView testing (later lane)

Desktop Chrome with the phone profile is a proxy: it throttles the CPU but not the GPU, and its memory is not the WebView's. Plan for the app lanes:

1. **iOS** (WKWebView, a mid iPhone and an older one, e.g. iPhone 12 and SE 2): Safari Web Inspector attached to the app's WebView → Timelines (JavaScript & Events for long tasks, Rendering Frames for frame rate) for a cold open of the panel; Xcode's Memory gauge and Instruments' VM Tracker / Metal System Trace for GPU memory as the Ark fills (watch for a WebContent process jetsam: the page reloads blank). Check `scene.runtime()` from the inspector console (model bytes against the tier's budget, evictions).
2. **Android** (WebView, a mid-range phone with 4 GB, e.g. Galaxy A35, and a 3 GB one): `chrome://inspect` → Performance panel for a cold open; `adb shell dumpsys meminfo <package>` (Graphics and GL lines) as the Ark fills; `adb shell dumpsys gfxinfo <package> framestats` for frame times idle (expect 30 fps after 5 s) and covered (expect none with `ark:visible` false).
3. **Both**: the bridge's states (`docs/ark/runtime-bridge.md` §Testing): covered, background, Low Power Mode / battery saver, a heat override; the reset button and the loading bar at the panel's size; a WebGL context loss (Safari's "Lose context" in the inspector's Canvas tab) to see the page's fallback.
4. If a device loses the context or jetsams at its tier: lower that tier's `textureMB` in `budgets.ts`, or move the device class down a tier in `post.ts` `tierFor`.
