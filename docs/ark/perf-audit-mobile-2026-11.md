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

**Caveats.** The CPU throttle slows the main thread only: the Mac's GPU draws every frame, so fill rate (DPR, the finish's
passes, shadows) is not measured here; that is what the on-device overlay is for (§5). The Mac ran 15+ other agents
(load average 55–165 during the runs), so wall times swing; every before/after pair was run back to back on the same
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
   brings waits for it. A read of the same animals keeps their places (they depend only on the animals). A recording
   lays out at once, as before. *The 21 s / 15 s stall and the 0.5 s every 45 s are gone.*
2. **Collisions: the same answer is not worked out twice** (`collide/layer.ts`). `pushOut` is a pure function of the
   colliders, the body and the pose's place, height, heading, surface points and hold; the layer keeps each animal's last
   answer and its inputs, and gives it back when they are the same (a resting or wedged animal, most of the island most
   of the time). A test compares it with a layer that forgets, moment after moment. **Animals past the render distance
   are sampled as icons** (once a second, without the collisions, as an animal out of view already was) and worked out
   with them at once when drawn as a model again. *13.3 → 0.2 ms a frame on the low phone; the 300–600 ms spikes gone.*
3. **Frame pacing on phones** (`runtime/pace.ts`, touch devices only; desktops keep the old check): GPU-bound frames
   (long frames, short work) give up resolution first, 0.1 at a time to 0.7 of the tier's pixel ratio, never back to a
   scale found too high at that rate for 90 s; script-bound frames lock to a **steady 30** (it tries the display's rate
   again only when frames are light, waiting 8, 16, 32 … 120 s after each failed try); a tier drops only once the start
   is over (the world built, the first view in) and only if 30 cannot be held, or the script keeps it at 30 for 15 s
   (a phone then trades the tier's finish for 60). The start tier on a touch device takes a 2 ms CPU benchmark into
   account (a main thread slower than ~5× a desktop core starts on the low tier, at a steady 30).
4. **The resting warm-up spread over its step**, at the rate frames are drawn, done half a minute before the step:
   about one ask every other frame. The schedules made for animals not drawn one by one are kept per snapshot (and per
   behaviour world) instead of made again every five minutes.
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

<!-- MATRIX -->

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

What to read back: the first four lines and `calls`, standing still and while dragging, on the iPhone (Safari and the
panel) and on the Android. A steady `30 fps` with `>33ms` near 0 is the pacing's lock holding; `dpr` under the tier's
(`x0.8`) means the phone's GPU is the limit; a large `render` with many `calls` is the draw-call cost (§7).

## 6. Gates

<!-- GATES -->

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
4. **The resting warm-up's asks** (runtime/behaviour): ~4 ms each on the phone profile (tens of ms under load), and it
   asks for all 3,145 animals every five minutes, while the rotation itself (`arkOutside`, `arkWithinCapacity`) asks
   only a crowded kind's members, in ring order, until its quota of awake ones is found. Warming exactly those (run the
   next step's rotation with a recording `isResting`), or answering `restingAtRoost` in a worker, would cut it by most of
   its work. Now spread (at most one ask a frame) instead of 8–19 ms a frame in the step's last minute; a world built
   late in a step still leaves the step's last half minute heavy, as before.
5. **Per-frame garbage in the animal loop** (scene): the candidates' objects, filter/sort/map chains and Sets each frame;
   pooled arrays would cut most of the remaining 15–25 MB/s.
6. **The snapshot's parse** (embed and page): the 1.6 MB read is parsed on the main thread every 45 s in the apps'
   panel (~0.3–0.5 s on the low phone profile, now with no layout after it); an `ETag` on `/api/ark/voyage` (a 304 for
   the same Ark) or the parse in a worker would remove it.
7. **On-device numbers.** Read the overlay on the owner's iPhone and Android (§5); if `dpr` sits at its floor, lower the
   medium tier's pixel-ratio cap from 1.5 for phones, or move post passes (the tilt-shift's two passes) off the medium
   tier on phones.

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
| The resolution floor and steps | 0.5; 0.6; 0.7 | 0.7 of the tier's pixel ratio, 0.1 steps, 1.5 s apart, 90 s ceilings | Below 0.7 the medium tier's 1.5 becomes ~1, visibly soft on a 3× phone. |
| The start tier | the device's answer only; a warm-up of the scene; a CPU benchmark | the device's answer, then a 3×-repeated 2 ms benchmark on touch devices: over 9.5 ms → low | A slow phone no longer builds the medium tier's scenery to drop it; calibrated on the throttled profiles (1× 1.9, 4× 7.6, 6× 11.7 ms). |
| The low tier's rate | 60 like the others; a steady 30 always | a steady 30 only on a slow main thread; else the display's, locked if needed | A phone dropped to low to reach 60 must get the chance. |
| The resting warm-up | as was; a lower budget; spread by count over the step | spread by count at the measured frame rate, done 30 s before the step | Same answers; ~one ask every other frame instead of 8–19 ms a frame for a minute. |
| Shadows on phones | every frame; half rate; static only | every other frame while the shadow box stands still, every frame when it moves | Saves half the shadow pass with nothing swimming; animals' contact shadows are separate. |
| The overlay in the apps' panel | a host message; a URL flag; a gesture | `?perf=1` remembered, and five taps on the top-left corner | The panel's URL cannot be changed by hand; no app release needed. |
| The town's draw calls | merge now; a far proxy; leave to the town lane | the town lane, with the plan and numbers (§7) | Its chunks feed streaming, near detail and window lighting; a merge belongs with its owners and its visual gate. |
