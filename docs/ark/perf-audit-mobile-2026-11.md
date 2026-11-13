# Ark on phones: performance audit and fixes (2026-11)

The owner: the Ark "is a little laggy on phones" (an iPhone and an Android, the site and the apps' Ark panel), and should
be "extremely smooth". Branch `ark-perf-mobile` (landing). Measured first, then fixed by measured win. Visual only: nothing
here changes the server, the shared world or what any viewer sees happen (the collision and behaviour audits are
identical before and after, §6).

## 1. How it was measured

- **The page:** `/ark/embed.html` (the apps' panel and the home page's hero), which mounts the archipelago exactly as
  `/ark` does: the wild island first, the town built in its worker and joined. Not the measurement page: its islands mode
  builds the town on the main thread, which no live page does.
- **The Ark:** the real one (3,145 animals, the 2026-11-12 read with the islands routing merged: 707 wild, 2,438 town;
  usernames replaced), read in place by the harness, never copied into the repo. The fixture's 130 animals hide most of
  what a phone pays for.
- **The phones** (`scripts/ark-runtime-measure.mjs`, headless Chromium, the production bundle):
  - *phone*: 360×800 at DPR 2, 4× CPU throttle, 8 cores / 4 GB reported (the medium tier by the device's answer);
  - *low phone* (new, `--devices phone-low`): the same screen, 6× CPU throttle, 4 cores / 3 GB (the low tier);
  - each on the three tiers pinned (`--quality`), 4× and 6× (`--throttle`);
  - *touched* (`--interact`: a pointer move every 200 ms, the runtime's full rate while the view drifts) and *untouched*
    (calm: 30 fps after 5 s);
  - the home page's hero (`--page hero`: the embed in a frame the hero's size, its `refresh=600&idle=900`) on the desktop
    and the phone.
- **Per run:** every drawn frame's interval and main-thread work (requestAnimationFrame wrapped before the page's script:
  works on any build, so the base is measured the same way), steady from 60–70 s after the first frame (past the world's
  build, the first models and the first snapshot refresh, whose stall is counted separately); the heap's growth between
  frames (allocation); bytes before the first frame; long tasks; and with `--perf` the scene's own sections.
- **Sections** (`runtime/perf.ts`, behind `?perf=1`): the frame loop marks where its time goes: the behaviour world's
  build, the town, the camera, streaming, scenery modules, the resting warm-up, the schedule's sampling, the shared
  collisions, the per-animal loop, the reactive layer, keep-apart and recipes, rigs, locomotion (`rigLivePose`), the
  instance writes, herds and specks, particles and weather, the plants' LOD, the render submit, labels, the runtime's
  hand-over. GPU counts from `renderer.info`: draw calls (all passes), triangles, programs, textures.

To repeat a run (a real snapshot file kept outside the repo; the base measured the same way from its own worktree):

```
node scripts/ark-runtime-measure.mjs --label lowphone --page embed --devices phone-low --interact \
    --seconds 130 --steady-from 70 --population-file <snapshot.json> --production --perf
# --quality low|medium|high, --throttle 4|6, --page hero, --gc-points --gc-steady 120 (the heap budget)
```

**Caveats.** The CPU throttle slows the main thread only: the Mac's GPU draws every frame, so fill rate (DPR, the finish's
passes, shadows) is not measured here; that is what the on-device overlay is for (§5). The Mac ran 15+ other agents
(load average 30–460 during the runs), so wall times swing; every before/after pair was run back to back on the same
profile, and the per-frame sections (the scene's own work) are steadier than the intervals.

## 2. Where the time went (before)

The low phone (6×, embed, touched, steady 100–170 s; the base build with the profiler only), ms of main-thread time per
drawn frame, ranked:

| # | Cause | Low phone ms/frame | Phone (4×) ms/frame | What it is |
|---|---|---|---|---|
| 1 | **The first snapshot refresh** | one task of **21.1–22.7 s** at ~46 s | one of **14.6 s** | The embed reads the Ark every 45 s (the apps' panel; `/ark` and the hero less often). Every read was laid out again, and the first one placed the wild island's 707 animals on the main thread, building the map's sampler there (the mount had them from the places worker). Each later read ~0.3–0.6 s: placement, the props' homes and nests, the schedules, 4 s of full frame rate for "entrances". |
| 2 | **The shared collisions** (`withCollisions`) | **13.3** mean, spikes of 300–600 ms every few seconds | 5.0 | Every scheduled animal drawn as a model (and every one past the render distance: they kept the "far" level) worked its pose out of anything solid every half second; a wedged animal's ring search (thousands of probes) ran again every time, with the very same inputs. 1,858 `pushOut` calls in 30 s, only 354 distinct; 78 ring searches. |
| 3 | **The render submit** (draw calls) | **12.7** | 8.2 | 438 draw calls on the low tier (406 on the phone's), 1.08 M triangles. ~300 of them are the town's: each of its ~60 chunks draws its ground, paving, buildings, nets, hedges and windows as separate meshes, all of them while the town is across the strait. Plus `setProgram`'s program re-check: the zoo's glass, bars and nets are transparent double-sided, which three draws in two passes, marking the material changed twice an object a frame (~17 program look-ups a frame, ~4 MB/s of garbage). |
| 4 | **The resting warm-up** | **19** for a minute in every five | 9–15 | The live budget's rotation asks, for all 3,145 animals, whether each is at its roost at the next 5-minute step; it was 6 ms a frame in the step's last minute, but one ask is ~4 ms on the phone profile (~1 ms on a desktop core), so it overran to 8–19 ms a frame, and on the phone profile did not finish by the step (the rest was then asked in one go). |
| 5 | **The behaviour world's build** | ~25 for the first 60–70 s | ~18 for 40 s | Built a slice a frame after the first frame; animals are hidden until it is done ("in view" 70 s on the low phone, 37 s on the phone). Sliced already; not changed here. |
| 6 | **A tier dropped for good during the start** | — | the medium tier lost | The tier check measured the first 2 s after the first frame (the world being built, the models coming in), so a phone that holds the medium tier dropped to low every time. |
| 7 | **Garbage** | 28 MB/s, heap 330 → 564 MB → GC | 37 MB/s | Biggest sources: the streamer's island lookup (an array per call, per plant and animal: 3.7 MB/s), three's program look-ups (#3), the wild assets' LOD re-sort (all instances re-written and uploaded every few frames while the view drifts), per-frame arrays in the animal loop. |
| 8 | Herds and specks, the animal loop | 1.3, 0.9 | 0.9, 0.6 | Small. |
| — | The HUD | — | — | The `/ark` HUD is light: the tap card reads the animal's status once a second and re-renders only when it changed; the live log and bars are plain DOM on a 500 ms tick; labels are style writes. The overlay counts the page's React renders a second on the device (§5). |

Frames (before): the low phone touched drew **30.7 fps** with p95 **150 ms** and p99 **333 ms** in steady play (5.5 fps in
its first minute, while the world was built); the phone, dropped to low, 46 fps with p99 200 ms. Network before the first
frame: 19–24 MB (the bundle and workers, the snapshot, the first view's models).

## 3. What changed

Ranked by the measured win. Everything that is not a picture choice is exact: the same poses, places and answers.

1. **A read that changes nothing is not laid out again** (`runtime/same.ts`, the scene's `update`). Deep-equal but its
   time; the Ark day may move up to 0.05 day (~2.7 minutes) before it counts as new (the young's ages and the nests read
   it). A read that does change the wild animals is **placed in the places worker first** (as the mount's and a
   replay's are) and laid out when the answer is in; a newer read meanwhile replaces it; `select` of an animal that read
   brings waits for it. The places worker is kept a minute after it answers (its map sampler built once): measured, an
   arrival read and selected at once is placed in ~5 s off the main thread the first time (it froze the page before) and
   ~0.1 s for the next within the minute. A read of the same animals keeps their places (they depend only on the
   animals). A recording lays out at once, as before. *The 21 s / 15 s stall and the 0.5 s every 45 s are gone; a read
   of the same Ark sent to a running embed: no long task at all.*
2. **Collisions: the same answer is not worked out twice** (`collide/layer.ts`). `pushOut` is a pure function of the
   colliders, the body and the pose's place, height, heading, surface points and hold; the layer keeps each animal's last
   answer and its inputs, and gives it back when they are the same (a resting or wedged animal, most of the island most
   of the time). A test compares it with a layer that forgets, moment after moment. **Animals past the render distance
   are sampled as icons** (once a second, without the collisions, as an animal out of view already was) and worked out
   with them at once when drawn as a model again. *13.3 → 0.2 ms a frame on the low phone; the 300–600 ms spikes gone.*
3. **Frame pacing on phones** (`runtime/pace.ts`, touch devices only; desktops and recordings keep the old check),
   fed every drawn frame's interval and work, judged once a second on the last 45 frames:
   - *resolution first*: when a quarter of the frames are late but their work is short (the GPU is the limit: fill
     rate, the finish's passes), the drawing buffer's scale steps down 0.1 at a time to 0.7 of the tier's pixel ratio;
     back up after 6 s on time, never to a scale found too high at that rate in the last 90 s (no bouncing);
   - *then a steady 30*: when a quarter of the frames still miss 60 (a jittery 40–50), the rate locks to 30; it tries 60
     again after 8 s and waits twice as long after each try that fails at once (8, 16, 32 … 120 s);
   - *the start is forgotten when it ends* (the world built and spaced, the first view in or 20 s on): measurements
     restart and 60 is tried again within 2 s. The old check judged the first 2 s after the first frame, while the
     world was being built, and dropped a tier for good (the phone profile lost the medium tier every time);
   - *a tier down only after the start*: locked at 30 and at the lowest scale and still missing 30 for 3 s, or held at
     30 by the script's own work for 15 s on end (a phone then trades the tier's finish for 60);
   - *the start tier*: on a touch device a 2 ms CPU benchmark (best of three) adds to the device's own answer: a main
     thread slower than ~5× a desktop core starts on the low tier, at a steady 30.
4. **The resting warm-up: only what the step will ask, spread over the step.** The rotation asks only a crowded kind's
   members, in ring order, until its quota of awake ones is found (and the crowded zones' likewise); the warm-up asked
   about all 3,145 animals aboard. It now asks exactly the next step's first asks (`arkRestingAsks`: the rotation run
   ahead with unknown answers taken as awake; a test checks that with those answers the rotation asks nothing else), a
   few hundred, spread evenly from the step's first seconds at the measured frame rate and never more than one a frame;
   the schedules made for animals not drawn one by one are kept per snapshot and behaviour world. Same answers, same
   rotation; before, 8–19 ms a frame for the step's last minute on the phone profiles, and not done by the step.
5. **The sun's shadow map every other frame on phones** while its box stands still (the drift turns round what the view
   looks at; the box moves only with a pan, a zoom or the hour), every frame whenever it moves: no shadow swims. Desktop:
   every frame as before.
6. **Garbage and repeated work:** the streamer's island lookup allocation-free; the wild assets' LOD re-sort writes and
   uploads nothing when no instance changed level (exactly what it wrote last time).
7. **The town's transparent double-sided meshes** (the zoo's glass, cage bars and nets; `runtime/two-sided.ts`): three
   draws each in two passes (its back faces, then its front) and marks the material changed before each, so each costs
   two program look-ups a frame (~17 a frame, ~0.8 ms at 4×, ~4 MB/s of garbage). Each is now a back-face mesh and a
   front-face child sharing its geometry and place: the same draws in the same order (the transparent sort's last word is
   the object's id, and the child's comes next), no look-ups. Not on shadow casters or meshes with draw hooks.
8. **The overlay** (§5) and the harness (§1).

## 4. Before and after

Every pair below ran back to back (base = `origin/main` 9f123c9c, after = the branch), one run each: the Mac's load
average swung between 30 and 460 during them (other agents), so read the shape rather than the last digit, and the
stalls (worst task, tasks over 200 ms) more than the fps. *fps* counts drawn frames; *> 16.7 / > 33 ms* are the share of
intervals past one and two 60 Hz frames; *frame work* is the frame's own main-thread time; *main thread busy* is that
work a second. Steady play from 60–70 s after the first frame; the worst task covers the whole run (the base's is the
first snapshot refresh).

**The final branch** (dc5dc78b), the touched profiles and the low phone's heap:

| Profile | Build | Tier at end | fps | Interval p50 / p95 / p99 ms | > 16.7 ms | > 33 ms | Frame work p50 / p95 ms | Main thread busy | Alloc MB/s | Worst task after 1st frame | Tasks > 200 ms after | First frame s | KB before 1st frame |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Low phone 6×, auto (low), touched | base | low | 49.2 | 16.7 / 33.4 / 66.7 | 11.5% | 3.8% | 15.8 / 32.4 | 92% | 46.7 | 20.8 s | 11 | 14.0 | 21,387 |
|  | after | low | 36 | 33.3 / 33.4 / 33.5 | 65.5% | 1% | 17.2 / 23.8 | 64% | 16.8 | 1.5 s | 7 | 13.9 | 21,912 |
| Phone 4×, auto, touched | base | low | 46.6 | 16.7 / 50 / 99.9 | 14.6% | 5.6% | 11.4 / 44.1 | 80% | 77.6 | 13.7 s | 10 | 10.0 | 18,884 |
|  | after | low | 59.9 | 16.7 / 16.7 / 16.8 | 0.1% | 0.1% | 11.8 / 15.8 | 72% | 28.4 | 1.0 s | 3 | 10.1 | 19,665 |
| Phone 4×, low | base | low | 45.9 | 16.7 / 49.9 / 66.7 | 20.8% | 5.4% | 13.8 / 40.6 | 86% | 79.9 | 13.4 s | 5 | 10.2 | 18,751 |
|  | after | low | 52.8 | 16.7 / 33.4 / 33.4 | 13.4% | 0.2% | 11.6 / 15.7 | 64% | 23.7 | 1.1 s | 2 | 10.8 | 21,532 |
| Phone 4×, medium | base | medium | 20.9 | 33.4 / 100 / 250 | 90.2% | 45.5% | 34.1 / 96.5 | 93% | 61.2 | 16.5 s | 32 | 10.2 | 18,799 |
|  | after | medium | 30.1 | 33.3 / 33.4 / 50 | 96.9% | 2.4% | 21.5 / 26.9 | 65% | 23.5 | 1.5 s | 4 | 11.3 | 18,768 |

**Every profile** (base against 9d2a7ee9, the branch before the warm-up asked only the step's own questions: its rows
still carry 4–7 ms a frame of warm-up at 4–6×, which the final branch removes, as the rows above show):

| Profile | Build | Tier at end | fps | Interval p50 / p95 / p99 ms | > 16.7 ms | > 33 ms | Frame work p50 / p95 ms | Main thread busy | Alloc MB/s | Worst task after 1st frame | Tasks > 200 ms after | First frame s | KB before 1st frame |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Low phone 6×, auto, untouched | base | low | 25.4 | 33.4 / 50.1 / 83.4 | 92.2% | 32.6% | 21.7 / 39.5 | 61% | 26.7 | 26.7 s | 16 | 12.5 | 18,751 |
|  | after | low | 25 | 33.4 / 50.1 / 100 | 95.7% | 33.4% | 19.3 / 51.8 | 62% | 33.3 | 1.8 s | 9 | 12.3 | 19,042 |
| Phone 4×, high | base | high | 12.1 | 66.7 / 133.4 / 250 | 100% | 99.9% | 68.8 / 135.9 | 95% | 71.9 | 19.5 s | 19 | 10.0 | 18,935 |
|  | after | high | 16.8 | 50 / 83.4 / 133.3 | 100% | 97.1% | 54.1 / 84.9 | 98% | 77.1 | 5.0 s | 9 | 10.1 | 19,103 |
| Phone 6×, medium | base | medium | 25 | 33.3 / 50.1 / 316.7 | 88.5% | 20.3% | 32.6 / 50.1 | 94% | 36.6 | 20.2 s | 34 | 12.2 | 18,772 |
|  | after | medium | 22.5 | 33.4 / 66.7 / 116.7 | 96.8% | 49.7% | 38.3 / 69.5 | 95% | 31.5 | 2.4 s | 15 | 14.6 | 19,108 |
| Phone 6×, high | base | high | 8.3 | 100 / 216.7 / 383.3 | 100% | 100% | 94.1 / 202.4 | 92% | 40.6 | 24.0 s | 37 | 16.2 | 22,323 |
|  | after | high | 9.5 | 100 / 166.7 / 216.7 | 100% | 100% | 92.8 / 161.2 | 96% | 54.2 | 7.3 s | 19 | 14.3 | 22,339 |
| Home hero, desktop 1×, untouched | base | high | 30 | 33.3 / 33.4 / 33.4 | 99.9% | 0.3% | 12.7 / 16 | 40% | 139.4 | 0.2 s | 1 | 6.2 | 18,713 |
|  | after | high | 30.3 | 33.3 / 33.4 / 50 | 96.7% | 1.4% | 12.4 / 22.5 | 42% | 148.9 | 0.2 s | 1 | 6.1 | 18,857 |
| Home hero, phone 4×, untouched | base | medium | 29.1 | 33.3 / 50 / 50.1 | 99.7% | 6.4% | 16.7 / 22.6 | 51% | 32.2 | 1.2 s | 2 | 9.6 | 18,824 |
|  | after | low | 27.6 | 33.3 / 50 / 66.7 | 96.5% | 16.9% | 20.6 / 42.5 | 65% | 49.5 | 1.0 s | 6 | 9.9 | 18,836 |

**The scene's own sections** on the final branch (ms a frame; draw calls of every pass):

| Profile | Tier | Calls | Triangles | Programs | Textures | Top sections (ms a frame) |
|---|---|---|---|---|---|---|
| Low phone 6×, auto (low), touched | low | 442 | 1.09 M | 106 | 330 | render 13.65, herds 1.41, animals 0.89, plants 0.44, camera 0.4, schedule 0.31 |
| Phone 4×, auto, touched | low | 446 | 1.10 M | 107 | 327 | render 8.77, herds 0.94, animals 0.6, camera 0.3, plants 0.29, town 0.19 |
| Phone 4×, low | low | 437 | 1.09 M | 106 | 338 | render 9.12, herds 0.96, animals 0.51, camera 0.29, plants 0.28, schedule 0.24 |
| Phone 4×, medium | medium | 495 | 1.28 M | 154 | 324 | render 14.87, animals 2.52, herds 0.88, instances 0.46, schedule 0.44, camera 0.43 |


**The heap budget** (low phone, forced collections; decision 292: post-GC ≤ 384 MB): final branch **301 MB** at the
first frame and **286 MB** in steady play (base 297 / 314 MB; the branch before the warm-up fix 280 / 309 MB). Before a
collection the steady heap is 315 MB on the branch against 362 MB on the base (less garbage).

**Bytes before the first frame** (~18–21 MB, unchanged by this lane): the first view's models ~10 MB, the bundle
`ark-scene.js` 5.1 MB, the snapshot 1.6 MB, icons and textures 1.6 MB, the rest 0.4 MB.

**Time until animals are in view** (the behaviour world built: animals are hidden until then), from the profiler's
timeline: the low phone ~83 s before (the first refresh's 21 s stall fell in the middle of the build), ~55 s after; the
phone ~37–42 s both.


## 5. The overlay: `?perf=1`

On `/ark`, `/ark/embed.html` and the measurement page: `?perf=1` turns it on and remembers it on that device (until
`?perf=0`). In the apps' Ark panel, where the address cannot be changed: **tap the world's top-left corner five times
quickly** (within 3 s, the 64 px square just below the panel's title strip); five more taps turn it off. It is remembered
in the panel's own storage, so it is still on the next time the panel opens. Off, it costs one early return per mark.

It is rewritten twice a second, top-left:

```
30 fps  p95 34.2 ms          drawn frames a second; the frame interval's 95th percentile
>16ms 100%  >33ms 0.4%       share of frame intervals past one 60 Hz frame and past two
cpu 4.3/10.2 ms  calm        the frame's own main-thread time, p50/p95; full / calm / drowsy
medium  dpr 1.5              the tier; the drawing buffer's pixels per CSS pixel (x0.8 when the pacing scaled it)
calls 586  tris 1.45M        draw calls (every pass) and triangles a frame
prog 155  tex 297            shader programs and textures alive
heap 450 MB                  the JS heap (n/a in Safari / WKWebView, which do not say)
animals 5  rigged 0          animals drawn one by one (models and icons) and rigged
hud 0/s                      the /ark page's React renders a second
render 2.8  resting 1.3      the costliest sections, ms a frame
animals 0.5  herds 0.2
```

Remembered per site and per app: once on in Safari or Chrome at animaldex.app it also shows in the home page's hero;
the apps' panel keeps its own (the five taps). On an iPhone the `heap` line reads `n/a` (WebKit does not say), and the
tier line is worth reading: Safari reports neither memory nor (always) the real core count, so an iPhone may run the
low tier; a fast one there with `cpu` well under 8 ms could carry the medium tier (a choice for the owner, §7).

What to read back: the first four lines and `calls`, standing still and while dragging, on the iPhone (Safari and the
panel) and on the Android. A steady `30 fps` with `>33ms` near 0 is the pacing's lock holding; `dpr` under the tier's
(`x0.8`) means the phone's GPU is the limit; a large `render` with many `calls` is the draw-call cost (§7).

## 6. Gates

| Gate | Result |
|---|---|
| Types (`npx tsc --noEmit -p tsconfig.json`) | clean |
| Lint (`npm run lint`) | exit 0 (only the known `<img>` warnings, none in the changed files) |
| Unit and integration (`npx tsx --test 'src/lib/**/*.test.ts'`) | 2,633 tests: 2,631 pass, 0 fail, 2 skipped (the lane's own: `src/lib/ark-perf-mobile.test.ts`, 14: the pacing on model devices, the start tier, a read that changes nothing, the collisions' memo against a layer that forgets it, the two-sided split, the warm-up's list) |
| Collision audit, three modes (CI's commands: islands v2, islands v1, today's) | base and branch **identical** (every report the same but its timings); all three checks pass |
| Behaviour audit (CI's command) and encounters | base and branch **identical** (but the commit and the timings); "All 25 checks hold" |
| Motion CI, the default view ×2 (`ark-rig-scenes.mjs --island --seconds 60`) | branch: pace ratio median 1.01 / 1.06, backwards 2.4% / 0.7%, over 1 s 2 / 0, ground turns 1.0 / 0.3 a minute; main the same minutes: 0.98 / 1.07, 0.8% / 2.1%, 1 / 1, 0.5 / 1.4. The same spread (the clock picks what moves); recordings take none of the pacing |
| Visual CI on GitHub (run 43463825786, dispatched on d7e20c23: every change to what is drawn) | **green**: 19/19 golden shots within tolerance (worst: 0.14% of pixels changed), the other lanes' checks green. Later commits change only what touch devices and new reads do, never a recording |
| Motion metrics (a visual-CI hook) | green in that run's hooks job |
| Heap budget (low phone, `--gc-points`: post-GC ≤ 384 MB at the first frame and in steady play) | **301 MB** at the first frame, **286 MB** in steady play (final branch; base 297 / 314 MB) |
| Rendering throttles change no shared result | the audits above; the memo's test; the read skip is a deep equality; placement in the worker is the mount's own (`src/lib/ark-prebuild.test.ts` compares every place) |


## 7. What is left (for other lanes)

1. **The town's draw calls (town lane).** ~300 of the ~440 draw calls on the low tier, ~10 ms a frame at 6×: the
   largest cost left on every phone. Each of the town's ~60 chunks draws its ground, paving, buildings, nets, hedges and
   windows as separate meshes, and all of them while the town is across the strait. A plan with no extra memory and the
   same triangles: build each opaque layer (ground, paving, buildings) of all chunks into one geometry whose attributes
   every chunk's mesh shares (three uploads a shared attribute once), each chunk's mesh a view of its own range
   (`drawRange`), plus one mesh per layer drawing the whole range; while every town chunk is past the render distance
   (`applyStream`: the phones' tiers from the wild island, never the desktop's high tier, whose distance reaches the
   town), show the whole-range meshes and hide the chunks' (~180 fewer draw calls); otherwise as now. Windows and panes
   keep their chunks (their lit attribute), and the near detail is untouched. Opaque draws are sorted by material first,
   so the order between layers is the same.
2. **Two-pass transparent materials: done here** (§3, 7), applied to the town every few seconds from outside its build;
   the town lane may prefer to build its glass, bars and nets that way itself.
3. **The behaviour world's build** (behaviour lane): 60–70 s on the low phone before animals show (~25 ms a frame).
   In the prebuild worker, as the places are.
4. **`restingAtRoost` itself** (behaviour): ~1 ms an ask on a desktop core, ~4 ms on the phone profile. The warm-up now
   asks only a few hundred a step, spread; answering them in a worker would take the rest off the main thread.
5. **Per-frame garbage in the animal loop** (scene): the candidates' objects, filter/sort/map chains and Sets each frame;
   pooled arrays would cut most of the remaining 15–25 MB/s.
6. **The snapshot's parse** (embed and page): the 1.6 MB read is parsed on the main thread every 45 s in the apps'
   panel (~0.3–0.5 s on the low phone profile, now with no layout after it); an `ETag` on `/api/ark/voyage` (a 304 for
   the same Ark) or the parse in a worker would remove it.
7. **On-device numbers.** Read the overlay on the owner's iPhone and Android (§5); if `dpr` sits at its floor, lower the
   medium tier's pixel-ratio cap from 1.5 for phones, or move post passes (the tilt-shift's two passes) off the medium
   tier on phones. If an iPhone shows `low` with `cpu` well under 8 ms and a steady 60, the start tier could let a fast
   touch device up to medium (`tierForCpu` never raises today: a fidelity choice for the owner, not a smoothness one).
8. **The first view's ~10 MB of models before the first frame** (streaming): unchanged here; on a phone's cellular link
   that is most of the wait.

## 8. Decisions

| Question | Options | Choice | Why |
|---|---|---|---|
| What page to measure | the measurement page; the embed; `/ark` in Next | the embed (`/ark/embed.html`), the hero as its host | It mounts the archipelago exactly as `/ark` and the apps do (town in its worker); the measurement page builds the town on the main thread, and Next's dev build is not the site's. The `/ark` HUD measured by its render count on the device. |
| What Ark to measure on | the fixture; the scale fixtures; the real Ark | the real Ark (3,145 animals, islands routing merged), usernames replaced, read in place | Owner rule: real data only; the fixture hides most of the cost. |
| How to define the low phone | 4× like the phone; 6×; lower memory only | 360×800 @2, 6×, 4 cores / 3 GB | The brief's 6×; 3 GB puts it on the low tier by the device's own answer. |
| Collisions: how to cut them | sample less often; skip far ones; memoise | memoise `pushOut` exactly per animal, and sample animals past the render distance as icons | No change to any drawn pose; the shared world is untouched (the audits match). |
| A read that changes nothing | always lay out; compare animals only; compare all but the read's time | all fields deep-equal but `as_of`, the Ark day within 0.05 day | The day feeds the young's ages and the nests; 0.05 day (~2.7 min) is far under what they show. |
| A read that does change | lay out at once on the main thread; place in the worker first | the places worker first, `select` of a new animal deferred | The mount and replays already do; the main-thread placement was the 21 s stall. |
| Where the pacing applies | everywhere; touch devices; phones by UA | touch devices (`pointer: coarse`), never a recording | Desktops and the golden shots keep today's behaviour and picture. |
| What a slow phone gives up first | the tier; the frame rate; the resolution | resolution (GPU-bound), then a steady 30 (script-bound), then the tier | Least visible first; a steady 30 beats a jittery 45; the tier only when 30 cannot be held, or when the script alone keeps it at 30 for 15 s after the start (then 60 at the lower tier). |
| When the rate counts as not held | the median interval over 19 ms; the 75th percentile | the 75th percentile (a quarter of the frames late) | The median missed judder: the low phone at 42 fps had its median at 16.7 ms with 31% of frames late. |
| When to try 60 again | when the frames are light; by backoff alone | by backoff alone (8 → 120 s), and soon after the start ends | The frames' work measured at 30 reads heavier than at 60 (much of it is per second): a phone that held 59 fps on low was kept at 30 by the light-work rule (measured, then fixed). |
| What says the GPU is the limit | the 75th percentile late with short work; the median late with short work | the median (frames late as a rule) | On the loaded Mac, preemption made a quarter of the frames late with short work and the first version scaled resolution to its floor; a slow GPU makes every frame late, a collection or another task only some. |
| The places worker for new reads | a fresh worker each read; one kept for the page; one kept a minute | kept a minute after each answer | A fresh one rebuilds its map sampler (~5 s here) for every arrival; kept for good it holds that heap in the apps' panel; a minute covers an arrival and the next. |
| The resolution floor and steps | 0.5; 0.6; 0.7 | 0.7 of the tier's pixel ratio, 0.1 steps, 1.5 s apart, 90 s ceilings | Below 0.7 the medium tier's 1.5 becomes ~1, visibly soft on a 3× phone. |
| The start tier | the device's answer only; a warm-up of the scene; a CPU benchmark | the device's answer, then a 3×-repeated 2 ms benchmark on touch devices: over 9.5 ms → low | A slow phone no longer builds the medium tier's scenery to drop it; calibrated on the throttled profiles (1× 1.9, 4× 7.6, 6× 11.7 ms). |
| The low tier's rate | 60 like the others; a steady 30 always | a steady 30 only on a slow main thread; else the display's, locked if needed | A phone dropped to low to reach 60 must get the chance. |
| The resting warm-up | as was; a lower budget; spread by count; only what the step will ask | the next step's first asks only (`arkRestingAsks`), spread by count at the measured frame rate, at most one a frame | Same answers and rotation; a few hundred asks a step instead of 3,145; first measured spread over all 3,145, which cost 4–10 ms a frame on the phone profiles for most of each step. |
| Shadows on phones | every frame; half rate; static only | every other frame while the shadow box stands still, every frame when it moves | Saves half the shadow pass with nothing swimming; animals' contact shadows are separate. |
| The overlay in the apps' panel | a host message; a URL flag; a gesture | `?perf=1` remembered, and five taps on the top-left corner | The panel's URL cannot be changed by hand; no app release needed. |
| The town's draw calls | merge now; a far proxy; leave to the town lane | the town lane, with the plan and numbers (§7) | Its chunks feed streaming, near detail and window lighting; a merge belongs with its owners and its visual gate. |

## 9. Round 2 (`ark-perf-2`): the first frame and the payload

### The `onReady` frame was a fog wash

The archipelago mounts the wild island first and the town after the first frame (decision 153), but the camera opens
on the two-island view. The fog's clear reach is pushed out for two islands only when the town registers with the
streamer (`updateFog`, decision 142), so the first drawn frames showed the ~900 m view in the one island's fog (near
420 m, far 1,700 m: a wash) until the town came, ~230 ms later on the desktop and ~670 ms on the phone profile. Now the
scene, mounted with the town coming (`wildAnimals`), tells the streamer where the town will be (`expectIsland`:
`townWorldOrigin()` and `TOWN_GRID`, the very values the archipelago builds it with), so the fog has both islands'
reach (812 / 3,288 m) from the first drawn frame, and does not move when the town registers (a test checks both).
Measured on the embed, first eight drawn frames, desktop and phone profile: the same fog in every one. The page can
take the `onReady` frame as the real view; `arkWhenSettled`'s wait for the second frame is no longer needed for this.

### What a phone downloads, measured as the site serves it

The first round's "18–21 MB before the first frame" was the harness serving everything uncompressed on an open
link and counting what had finished by then. The site serves text compressed (Cloudflare: the bundle and workers
gzip, the API brotli), so the harness now gzips text the same way, has a slow 4G profile (`--network slow4g`:
1.6 Mbit/s, 150 ms, Lighthouse's) and logs every request and the bytes on the wire at the first frame. Phone profile,
slow 4G, the real Ark:

- **On the wire at the first frame: ~3.2–3.3 MB**, almost all on the first frame's own path: the bundle 1,578 KB (8 s
  of the link), the snapshot 235 KB, the wild island's prebuild and places workers ~660 KB, the town's worker ~485 KB
  (the town lane's). Models were 0.2 MB of it: they are asked for after the mount and mostly arrive after the frame.
- **The first frame at ~25 s**: the bundle (8 s), the snapshot (1.5 s), the workers and their work (~12 s), the mount
  and the shaders (~3 s, the main thread at 4×).
- **After it, the first minute**: 256 icons (3.4 MB) for every live kind, though the phone's opening view draws
  markers; then the up-front far models (the medium tier asks for its 120 nearest kinds, ~62 KB each: ~7.4 MB in all);
  the opening view's own scenery (the asset trees' levels) queued behind them, complete only at 83–98 s.

### What changed (phones only; a desktop and a recording load as before)

- **Icons when drawn**: a touch device fetches a kind's icon when an animal of it is first drawn as an icon (or
  selected), not every live kind's at layout.
- **Up front, only the herds' far models**: a touch device asks up front only for the herds' kinds (their figures are
  drawn from afar); every other kind's far model when it comes into view, as the rest already were. The view's own
  models come first either way.
- **The 45 s read revalidated**: an anonymous `/api/ark/voyage` answer carries a content validator
  (`lib/ark-voyage-etag.ts`: everything but the read's own time, the Ark day in 0.05 steps, as `sameArkRead` treats a
  read), an unchanged Ark answers 304, and the embed revalidates (`cache: "no-cache"`) and does not even parse the same
  Ark again. The apps' panel read ~400 KB (brotli) every 45 s whatever happened: ~32 MB an hour with the panel open; now
  only when the Ark changes. Signed-in answers stay `no-store` (a reader's own marks are never kept in a cache). The
  page's own reads revalidate by themselves.

### Before and after (phone profile, slow 4G, two pairs back to back)

| Run | First frame (s) | On the wire at the first frame (KB) | First 60 s: icons KB (files) | Models KB (files) | Opening scenery KB | Total KB | Opening scenery all in (s) |
|---|---|---|---|---|---|---|---|
| before 1 | 25.0 | 3,184 | 3,325 (256) | 1,108 (14) | 168 | 6,540 | 82.9 |
| after 1 | 25.0 | 3,211 | 5 (1) | 1,365 (19) | 754 | 4,590 | 74.0 |
| before 2 | 24.7 | 3,276 | 3,417 (256) | 1,445 (19) | 71 | 6,873 | 97.7 |
| after 2 | 25.3 | 3,285 | 0 (0) | 0 (0) | 752 | 3,200 | 66.4 |

The 45 s read in the embed (phone profile, 110 s, the harness answering as the route now does): 1 whole read, then 2
unchanged reads answered 304, no body.

The first frame did not move, and on these changes it should not: what it waits for is code (the bundle and the
workers) and the main thread, not models or icons. What did move is everything a phone downloads in its first minute
that it did not draw (−30 to −53%), and the opening view's own scenery, no longer queued behind them (9–31 s sooner).

### The embed's first paint (the apps' iOS panel)

`/ark/embed.html` loaded the scene's code with a `<script>` in the body, which WebKit (the apps' iOS panel) holds its
first paint behind: nothing drew until the ~1.6 MB (gzip) bundle had downloaded and run, so the loading screen's
blurred frame and card (the loading lane's, merged here from `ark-loading`) could not show, and on slow 4G the panel
showed the app's spinner for the whole download. Now:

- the bundle is preloaded in the head (`<link rel="preload" as="script">`: its download starts with the page, as
  before, nothing waits on it) and inserted as an async script only once two animation frames have been drawn (or after
  250 ms when the page draws none, hidden); the embed's own script runs on its load (`AnimalDexArkStart`). Nothing
  blocks the parser any more;
- the first `ark:progress` goes to the host only after two drawn frames (a frame with the loading screen on it), not
  at parse time;
- the host's messages before the scene's code runs (an app may speak as soon as the page has loaded, which can now come
  first) are kept by the loading screen's script and handed over in order (`AnimalDexArkEarly`): an `ark:visible false`
  sent before the code ran still held the drawing, and the world drew once it was told `true`.

Measured in Chromium (phone profile, slow 4G, two pairs): first paint 220 / 236 ms before, 260 / 228 ms after; the first
`ark:progress` 208 / 225 ms before (before the first paint), 240 / 255 ms after (after it); the bundle fetched once
(the preload reused), done at 9.2–9.3 s both; the first 3D frame 24.4–26.7 s both. Chromium already painted ahead of the
blocking script, so its numbers barely move; WebKit is the case that changes (from the end of the bundle's download, ~9 s
on slow 4G, to the first frames), and there is no WebKit to measure with here (Playwright's WebKit is not installed and
Safari's automation is off): the owner's iPhone, or the iOS lane's own trace, should confirm it.

`/ark` and the home hero: neither blocks. The `/ark` page imports the scene's code dynamically after its first paint
(decision 246); the hero is the embed in an iframe (now non-blocking too), and the home page paints its own poster
whatever the frame does.

### What would move the first frame (owner or other lanes)

1. **Brotli for the scripts** (deploy): the scripts go out gzip; precompressed brotli (quality 11) would be the bundle
   1,578 → 1,194 KB, the places worker 513 → 393 KB, the prebuild worker 144 → 119 KB: −529 KB on the first frame's path,
   **~2.6 s on slow 4G**, no change to anything drawn. Cloudflare compresses with brotli on the fly when the origin
   sends text uncompressed (as it already does for the API: `next.config.js` `compress: false` would make the scripts
   ~1,394 KB, −184 KB, site-wide); precompressed `.br` files served by the origin get the full saving.
2. **The bundle's data tables** (scene lanes): ~2.9 MB of the bundle's 5.1 MB raw is JSON (food links 319 KB, model
   bases 315, behaviours 249, tree attach 232, recipes 230, species 199, intelligence 195, stats 170 …). Those the first
   frame does not need (food links, recipes, intelligence) could come as their own files after it; a split bundle (ES
   modules) would let the town's code (304 KB) come with the town.
3. **The far skins** (model-set publish, owner): a far model is 62 KB, 49.5 KB of it its 512² WebP skin, which phones
   then fit to 256² on the device; the near file carries the same skin again. A 256² far skin (or a tier-sized set)
   would cut far models by ~55% (~3 MB of the ~7 MB a phone's view can ask for), and a shared skin file the near level's
   duplicate. Textures are already WebP and meshes meshopt-quantized; KTX2 would cut GPU memory, not bytes.
4. **The snapshot** (API, owner and apps): the live read is ~406 KB brotli (Cloudflare's on-the-fly level); at
   quality 11 the same JSON is ~40% smaller (the anonymised real Ark: 235 KB gzip, 142 KB br11). Per-species fields
   repeated on every animal (species id, model slug, names, scientific names, sociality: ~470 KB of the 1.68 MB) could be
   one table, and `brought_by` repeats `bringers`: a contract change for the apps, so not here.
5. **The town's worker** (~485 KB) downloads beside the wild island's workers on the first frame's path: the town lane
   (`ark-town-draws`).

### Gates (round 2)

| Gate | Result |
|---|---|
| Types | clean |
| Lint | `npm run lint` exit 0 (only the known `<img>` warnings, none in the changed files) |
| Unit and integration | after the merge with `ark-loading`: 2,651 tests, 2,649 pass, 0 fail, 2 skipped (new: the expected fog, the voyage validator) |
| Collision audit, three modes | base (`ark-perf-2` before the payload changes) and branch identical: islands v2, islands v1 and today's mode, every report the same |
| Behaviour audit and encounters | identical; "All 25 checks hold" |
| Motion CI, the default view ×2 | pace 1.03 / 0.93, backwards 0.8% / 2.4%, none over 1 s, ground turns 2.6 / 1.7 a minute; the base the same minutes: 0.96 / 1.05, 1.4% / 0.4%, none, 0.1 / 0.5. The default view's mount touches none of this round's code (no town coming, a desktop): the spread is the clock's |
| Visual CI on GitHub | run 43486664319 on 58e8850b (every change to what is drawn this round): **green**, 19/19 golden shots within tolerance (worst 0.29% of pixels), the other lanes' checks (motion metrics) green. The later commits change only the embed page and the merge brings the loading lane's own, gated with it |


### Decisions (round 2)

| Question | Options | Choice | Why |
|---|---|---|---|
| The fog-wash frame | wait for the second frame (page side); push the fog when the town is built; expect the town from the mount | the scene expects the town (`expectIsland`) from the mount | Fixed at the source: the first frame is the real view, the fog never moves when the town comes. |
| How to measure bytes | uncompressed; as the site serves them | gzip as the CDN does, slow 4G, every request timed, bytes on the wire at the first frame | The first round's 18–21 MB overstated the first frame's path ~6×; models are not on it. |
| Icons | all live kinds at layout; when drawn | when drawn, on touch devices | 3.4 MB of a phone's first minute for markers it never drew; desktop keeps its prefetch (no icon pops in). |
| Up-front far models on phones | the tier's nearest kinds; herds only; none | herds only | Their figures are drawn from afar; the rest come as they come into view, as most kinds already did. |
| The 45 s read | as is; skip parsing only; validator and 304 | a content ETag on anonymous reads, revalidated by the embed | The panel's cellular data: ~400 KB every 45 s whatever happened; signed-in reads untouched (no-store). |
| Brotli, the bundle split, far skins, the snapshot's shape | do here; recommend | recommend, with numbers | Site-wide deploy config, a model-set publish, an API contract: the owner's or other lanes'. |
| The embed's blocking script | `defer`; `async`; a module; preload and run after the first frames | preload in the head, inserted after two drawn frames (250 ms when hidden), the main script on its load | `defer` still runs before `DOMContentLoaded` and WebKit may hold the paint for it; the preload keeps the download where it was (measured: done at the same 9.2 s), only the run moves. |
| Host messages before the code runs | lost, as an app speaking before the bundle ran lost them before; kept | kept by the loading screen's script, handed over in order | Running the code later must not drop an app's early `ark:visible`/`ark:power`. |
| Building on the loading lane's embed | wait for its merge; merge it here | merged `origin/ark-loading` into `ark-perf-2` (conflicts: the embed's read, `ArkView`'s props) | The loader card and `ark:progress` live there; the integrator merges both lanes in the same round. |
