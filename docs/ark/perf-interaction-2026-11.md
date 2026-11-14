# The Ark while it is used: performance audit and fixes (2026-11-14)

The owner asked for a full graphics and performance pass "on the maps and animals … both web and apps". Rounds 332 and
339 (`perf-audit-mobile-2026-11.md`, `town-draws-2026-11.md`) measured the opening view, the untouched page and the
town view. This lane (`gfx-perf`) measured what a reader feels while using the world: zooming in to an animal and
back, panning, picking animals, long sessions, the panel hidden and shown, resizing, the loading path. Rendering
only: nothing here changes the server, the shared world or what happens in it.

## 1. How it was measured

- **The harness** (`scripts/ark-runtime-measure.mjs --page embed --scenario …`, new: `scripts/ark-runtime-scenarios.mjs`):
  the embed page (the apps' panel, the archipelago mount with its workers), the production bundle, the real Ark read
  from the live public endpoint on 2026-11-14 (3,247 animals, 951 species; kept outside the repo), headless Chromium on
  Metal. A scenario drives the world as a reader does: the host's `ark:select` (close up) and `ark:reset`, real
  touches and wheel through the DevTools protocol. Each action leaves a mark; each phase's frames are reported
  (interval p50 / p95 / p99, worst, frames over 50 and 100 ms, runs of dropped frames, the frame's own main-thread
  time, allocation and collections), with what the page asked of the GPU meanwhile, counted in the page before its
  script runs: programs linked and the time the page waited on each (with the defines that say which state made the
  variant), texture uploads and their bytes (big ones with their call stack), buffer uploads, render targets made.
  The scene's profiler (`?perf=1`) now keeps every slow frame with its sections, so a hitch is read against the part
  of the frame it was in. `--profile` adds a CPU profile (names kept).
- **Profiles**: *desktop* 1440×900, 1× CPU; *phone* 360×800 @2, 4× CPU throttle, 8 cores / 4 GB; *low phone* the same
  screen, 6×, 4 cores / 3 GB. The host's power is said to be calm (`ark:power`), because the Mac's own CPU pressure
  is not the device's (see §5, the desktop).
- **Before and after**: the baseline is c99ff83b with the same harness, built from its own worktree; runs alternate
  (base, branch, base, branch …), one run each a round. The Mac was shared with other lanes all day (load average in
  the hundreds), so wall-clock frame rates swing between rounds; the counts (programs, uploads, render targets, model
  and eviction counts) and the slow frames' sections are steadier than the intervals, and each claim below says which
  it rests on. What I could not repeat is listed in §6, not here.
- **The CPU throttle slows the main thread only.** The Mac's GPU compiles a shader in ~15 ms and takes a 16 MB
  texture in under 1 ms; a phone's does neither. Fixes aimed at GPU work (§3, B and C) are measured here by what
  the page asks for, not by frame time; the real web views are the `ios` and `android` lanes'.

## 2. What a reader feels, ranked (before: c99ff83b)

| # | Symptom | Where | Cause | Measured (before) |
|---|---|---|---|---|
| 1 | **Tap an animal: the world stops, then moves** | every device, every tap on an animal on its schedule | The card's status works out the animal's last 90 waking slots for its "fed" bar in one call, each a path-searched plan (`animal-status.ts` scheduleFed, added 2026-11-13) | One frame of 0.6–0.75 s at 4×, 0.7–1.9 s at 6×, ~0.2 s on a desktop core; again for an open card after every re-wiring of the schedules |
| 2 | **The animal you flew to is not there yet** (an icon or the far model, then the near one, then it starts to move) | zoom-in from afar, first visit | The near model was asked for when the camera came within 48 m, the rig once the near model was in and the camera within 20 m: each a fetch after the flight | Low phone: the chosen animal's own near model drawn 3.1–3.7 s after the tap, rigged at 3.8–4.9 s (median of 8 animals) |
| 3 | **A hitch as the camera arrives** | town and wild island, both visits | (a) the town's close-up detail built all at once inside the render after a "jump" (225 cells); (b) ground tiles coming within the render distance all built in that frame; (c) every nearby animal whose 80 s slot had turned over working out its next trip in the same frame | Phone 4×: render 350–700 ms, stream 70–260 ms, schedule 150–360 ms in single frames |
| 4 | **Second visit as slow as the first; draw distance shrinks; a tier lost** | long sessions, all devices | The far skins are never let go and pass the skins' ceiling by themselves (951 species), so every near level was let go 3 s after its last draw; the memory check read the heap before collection (mostly garbage) and pulled the render distance to 60% | Desktop high, 4 minutes of zooming: 902 kinds loaded, 801 near levels let go (5 a second), render distance 960 → 576 m; phone profiles: render distance at 60% within a minute of opening |
| 5 | **The world stops for 0.65 s when the tier changes** | memory check's drop | The drop was applied in the middle of a frame, whose draw then compiled every program for the new tier | Desktop: one frame of 650 ms, 119 programs |
| 5b | **A desktop on the low tier within a minute** | desktops left to choose | The tier check judged the start; then the memory check (above) | high → medium at 3.5 s, → low at 42 s, at 60 fps with 6–10 ms frames |
| 6 | **Back from a covered panel: tier lost for good** | phones held at 30 fps, panel covered ≥ 15 s | The pacing counted the time away as time "locked at 30 by the script" | Phone: medium → low 0.1 s after `ark:visible` true, 112 programs compiled again |
| 7 | **New kinds coming into view on a phone** | moving through the world | Each icon that loads re-sent the whole 2048² atlas (16 MB and its mipmaps) | 12–18 whole-atlas uploads in 8 zooms, 285–365 MB of texture uploads |
| 8 | **First draw of a new material waits on its shader** | close-up detail, a burrow's cutaway, effects | Only the animals' meshes were held back until compiled | 20–25 programs in 8 zooms, each waited for in the frame that first drew it (0.25–3.6 s in all on this Mac's GPU, depending on what else it was doing) |
| 9 | **Every visit asks for everything again** | repeat visits, the apps' panel each time it opens | `/ark/assets` (308 `.glb`), the sky, the transcoder and the positions atlas are served `max-age=0` and not kept by the CDN | Live site: 308 conditional requests on a second visit, the first frame no sooner than on the first |
| 10 | **Steady frame cost** | town in view | three r170 looks a batch's program up on every draw (a property it reads does not exist) | ~30 look-ups a frame, 4.5% of the phone profile's main thread at the island view |
| 11 | Window drag, phone turn | resize | Every size change re-made the drawing buffer and all render targets | Desktop high: 652 framebuffers and renderbuffers and ~620 MB of target allocations per 20-step drag |
| 12 | Uneven frames on fast displays | 120 Hz phones and laptops | Drawn at every refresh: a frame a little over 8.3 ms alternates 8 and 17 ms | Not measurable here (headless is 60 Hz); logic and tests only |
| 13 | **Every iPhone draws the low tier**: soft, stair-stepped edges, lit windows that twinkle, no shadows, no grass | every iPhone, in the apps' panel and in Safari | WebKit answers 4 cores for every iPhone (all have six) and nothing of its memory; the tier rule took 4 cores on touch for a weak device | The iOS lane's finding: a 402×874 canvas on a 1206×2622 screen. Here, a page given an iPhone's answers in Chromium |
| 14 | **A stall every 45 s in the apps' panel** | iOS and Android apps, every read of the host's | The host hands the page the whole Ark (2 MB) at each read, changed or not; the page decoded all of it and passed it to the list and the scene, which then found nothing changed | Phone 4×: 22–89 ms of script inside the bridge call and one task of 53–99 ms per push; a frame gap of 50–100 ms |
| 15 | **Sent to a wild animal from a chat: half a minute before it is there** | the apps' default path (`ark:select` close up at `ark:ready`), phones | A wild animal cannot be drawn until the wild island's behaviour world is built and its schedule wired; the build ran one 6 ms slice a drawn frame | From `ark:ready` to the animal on its rig: 24.1 / 22.2 s (phone), 29.2 s (low phone); the build is 6.7–7.9 s of main-thread work stretched over 18.7 s |

What stays the largest cost and is not mine to change: **working out a trip** (`behaviour-schedule.ts` tripAt). On the
phone profile it is 11–15% of the busy main thread while zooming, one cold trip is 60–290 ms at 4× in a single frame,
and after the fixes below "schedule" is the largest section in most of the remaining slow frames (§6).

## 3. What changed

Everything is off in a recording (`options.recording`: the golden shots, the director's clips), which builds and
compiles at once as before.

**A. The tap and the arrival**

1. *The status a little a frame* (`index.ts` warmStatus, tellStatus, animalStatus). The status's functions remember
   each slot as it is worked out and ask the subject for its animal once per plan, before the schedule's own code is
   entered. A dry run through a subject that stops there after 6 ms (12 with the view at rest) leaves what it did
   remembered; the next frame's run goes on from it; the status itself is asked for when a run comes through. Until
   then the card has a light status (as an animal off the schedule gets) and the bars over the animal are not shown.
   The same answers. `animal-status.ts` is not edited.
2. *The rig asked for at the tap*, first in the rigs' queue (`index.ts` select). The chosen kind's models are asked
   for at the tap by the round's `library.urgent` (animal-models); my own equivalent went at the merge.
3. *A new trip waits for a frame with room* (`index.ts`, the animal loop), as a first step already did: one frame's
   worth of cold trips a frame (6 ms, so one), the others held at the pose they were last drawn at, 0.5 s at most
   close by and 1.5 s further off; never the animal chosen or followed; never one whose pose is not its trip's (a
   foray). The same trips and poses, a few frames later.
4. *The town's close-up detail ten cells a frame after a jump too*, nearest first (`islands/town/render/near.ts`).
5. *Ground tiles two a frame*, nearest to what the camera looks at first; a tile is drawn as the map (a sixteenth of
   the vertices, with its skirt) until its full geometry is built (`streaming/ground-tiles.ts`).
6. *No resting warm-up ask during a flight or a touch* (`index.ts` prewarmResting): owed asks are kept and paid one
   a frame at rest.

**B. Shaders and textures**

7. *No frame waits on a new shader* (`runtime/hold.ts`). The renderer's own draw call is watched for materials never
   drawn: the object is left out of the frame, its shader asked for after the frame (compiled in parallel, as the
   first frame's are), and it is drawn from the first frame its program is ready, one held material a frame, or after
   3 s whatever happens. A material drawn once is never looked at again (one set lookup a draw). Only the scene's own
   pass; where the browser cannot compile in parallel nothing is held.
8. *An icon sends its own cell* (`icons.ts` flush): 64 KB and the mipmaps made again, not the atlas's 16 MB; more than
   four at once go as one whole upload, at most every 300 ms.
9. *Town batches answer three's `colorTexture` question* (`islands/town/render/batches.ts`): no program look-up per
   batch per frame.

**C. Memory and tiers**

10. *The memory check reads the heap's floor* over the last half minute, and the scenery's GPU bytes without the
    animal models' (which keep to their own ceiling) (`runtime/memory.ts` HeapFloor, `index.ts`).
11. *A tier drop it asks for is made at the frame's end*, where the pacing's own are, so the new tier's shaders are
    compiled beside the frames.
11b. *A desktop's tier check waits for the start to be over* (`index.ts`, the frame loop), as the phones' pacing does,
    and draws at the full rate for the seconds it measures.
12. *Far skins give up their GPU copy* when the skins are over their ceiling and the kind has been out of view half a
    minute (`runtime/budgets.ts` idleFarSkins): the model and its picture stay loaded and the renderer sends the
    skin again the frame the kind is next drawn; one sent again is left alone five minutes. *The near levels keep a
    floor* (96 / 48 / 16 MB) below which none is let go for the skins' sake.
13. *Time away is not time locked* (`runtime/pace.ts` resume): the pacing starts its measuring over after a pause.
14. *The pacing tries a failed resolution or rate again more and more rarely*: a scale's ceiling lasts twice as long
    each time the same scale fails (90 s … 15 min), tries at 60 are up to 300 s apart, and a failed try goes back to
    the resolution the steady 30 held in one step.

**D. The page**

15. *A 100 Hz+ display is drawn every other refresh* (`runtime/governor.ts`): 120 → 60, 144 → 72, 240 → 60; 60, 75
    and 90 Hz as before. The refresh rate is read off the animation frames' own times.
16. *Resizes are coalesced* (`index.ts` sizeView / sizeBuffers): the view's shape follows the element at once; the
    drawing buffer and the render targets are made again when the size stands still (120 ms), at most every 400 ms
    of a drag.
17. *The embed's 45 s read stops while the host says the panel is covered* (`public/ark/embed.html`).
18. *Cache headers* (`next.config.js`): `/ark/assets`, `/ark/graphics`, `/ark/basis`, `/ark/sound` a day in the
    browser, stale-while-revalidate a month; the hashed positions atlas immutable. Takes effect at the next deploy.

**E. iPhones, and the apps' pushes** (after the iOS lane's report)

19. *A hidden core count is not a weak device* (`streaming/tiers.ts`). `?cores=` is read beside `?mem=` (the apps'
    own figures win, and with both the tier is the device's answer as on Android). A count the browser hides (iOS
    and iPadOS WebKit saying 4 or less) is unknown and counts as six, which every iPhone since 2017 has. With its
    memory unknown too, a 3× screen starts on the medium tier (pixel ratio 1.5, shadows, grass, the finish); a 2×
    screen stays on the low tier, because that is where the 3 GB devices are (the XR, the second SE, most iPads
    before 2022) and 3 GB is the low tier on touch by the rule there already was.
20. *That medium tier is on trial* (`runtime/trial.ts`, `post.ts`). The frames: the pacing gives up resolution, then
    the rate, then the tier, once, and nothing raises it again that session. The memory, which a page in WebKit
    cannot read: a page that goes away without a goodbye during its first 90 s on screen (the system ended its
    process) starts on the low tier next time. Either failure is remembered on the device: the low tier from the
    start for a week, twice as long each time, to eight weeks, then one more try. A device that has held the tier
    through those 90 s before needs two losses in a row (an app swiped away mid-load looks the same from the page).
21. *The low tier earns resolution* (`runtime/pace.ts` rule 4, `index.ts` scaleTop). On a screen denser than the low
    tier draws, once the start is over and the frames have been on time for 10 s at the rate they hold, the drawing
    buffer steps up to 1.25 and then 1.5 buffer pixels a CSS pixel (never past the screen's own density). A step that
    makes the frames late is taken back within seconds and stays out of reach for 6 minutes, then 12, then 15. It
    starts at 1 as before, so a phone with nothing to spare never leaves it; not under battery saver or heat, not
    with the lighter view asked for. With the top at 1 the pacing is step for step what it was.
21b. *A tier on trial must hold the display's rate* (`pace.ts` rule 5). A device that said what it is and whose GPU
    cannot draw the medium tier at 60 at any resolution is left there at a steady 30, as before. One on trial goes
    down the tier after 15 s of that, back to where it drew before this change, and the device remembers.
22. *An unchanged push is dropped undecoded* (`runtime/same.ts` sameArkPush, `public/ark/embed.html`). The host's push
    is compared with its last one as it came, 3 ms at a time between frames, and dropped when only its time moved.
    A newer push overtakes an older one; a read of the page's own in between makes the next push count as new.
23. *The overlay* (`?perf=1`) shows a scale above 1 (`low  dpr 1.5 (x1.5)`) and, on touch devices, one more line:
    `bench <ms>` (the main-thread benchmark, over 9.5 ms starts on the low tier) and the trial's state (`trial`,
    `held`, or why the low tier: `pace`, `lost`, `memory`).

**F. The wild arrival** (after the arrival lane's report)

24. *The behaviour world in longer slices while a reader waits on it* (`index.ts`, the frame loop and
    `stepWorldBuild`). While a selection waits for an animal that cannot be drawn yet and the view is still (the
    round's `arriving`; no flight, no finger down), the build's and the spacing's slice is 40 ms, not 6, and the
    town's world waits for the wild animals' spacing in flight instead of having it thrown away and made again. The
    same world and schedules, to the bit: `behaviour-schedule.ts` and `behaviour-build.ts` are not edited.

## 4. Before and after

Evidence is in the pass's scratchpad (`evidence/perf/`); the folder of each table is named with it. "c99ff83b" is
the live build with the same harness. Frames' own work is main-thread time inside the scene's frame.

**Zooming in to eight animals and back, twice** (phone, 4×; `ab-zoom2-phone`, three rounds turn about; the branch
before the merge with round 343; "slow frames" are those with 60 ms or more of their own work among the three slowest
of each stop):

| | c99ff83b | branch |
|---|---|---|
| slow frames, and the time in them | 51 / 65 / 49: 8.9 / 13.3 / 7.7 s | 47 / 39 / 55: 5.4 / 4.3 / 7.8 s |
| worst frame's own work | 501 / 791 / 796 ms | 390 / 232 / 420 ms |
| worst status in a frame | 625 / 717 / 751 ms | none over 60 ms |
| worst render in a frame (the close-up detail) | 396 / 703 / 348 ms | 173 / 78 / 35 ms |
| zoom-ins (of 16) with a wait over 250 ms | 7 / 9 / 6 | 6 / 1 / 4 |
| frames a second while zooming in, first / second visit | 24.4 / 27.2 (medians) | 24.6 / 27.3 |
| frames over 100 ms, first / second visit | 26 / 22 (23–69 / 16–27) | 32 / 24 (25–49 / 11–26) |
| whole-atlas uploads; texture MB uploaded | 17 / 18 / 15; 351 / 365 / 315 | 3 / 3 / 1; 139 / 143 / 109 |
| ms the page waited on new programs | 1,345 / 1,064 / 281 | 355 / 166 / 163 |

The frame rate and the count of frames over 100 ms did not move: at 4× the frame's steady cost (render ~13 ms, the
animals ~3 ms, the schedule ~2.5 ms) and the single cold trips decide them. What moved is the worst frames.

**The same on the low phone, timing the chosen animal's arrival** (6×; `ab-arrive-phone-low`, two rounds; the branch
before the merge):

| | c99ff83b | branch |
|---|---|---|
| tap to the animal's own near model drawn, first visit (median of 8) | 3,710 / 3,072 ms | 1,591 / 1,813 ms |
| tap to rigged, first visit | 4,940 / 3,834 ms | 1,747 / 2,447 ms |
| the same, second visit | 1,598 / 1,479 and 2,072 / 1,728 ms | 1,286 / 1,228 and 1,166 / 1,582 ms |
| worst status in a frame | 1,828 / 689 ms | 231 / 43 ms |
| worst render in a frame | 423 / 384 ms | 291 / 209 ms |
| worst stream (ground tiles) in a frame | 206 / 140 ms | 16 / 34 ms |
| zoom-ins (of 16) with a wait over 250 ms | 11 / 16 | 7 / 5 |
| worst schedule in a frame | 288 / 338 ms | 352 / 286 ms |

**Panning, orbiting, crossing** (phone, 4×; `pan-phone-base`, `pan-phone-after`, one run each, the merged tree).
Orbiting the island view, orbiting and panning at mid height, flying to the town and back: no frame over 83 ms on
either build (work p95 16–25 ms, a steady 30 or 60). The two zooms were the exception: zooming to mid height 283 ms
and back out 417 ms on c99ff83b (the ground's tiles), 83 and 67 ms on the branch.

**Picking twelve animals in quick succession** (low phone; `select-phone-low-*`): the status frame is gone (1,286 ms
→ none over 60 ms). The run's other numbers are not comparable: the branch's run crossed a five-minute rotation step
(§5) and the baseline's did not.

**Resizing** (`resize-desktop-*`, high tier, a window dragged 40% narrower and back in 20 steps, three times):
framebuffers and renderbuffers made per drag 652 → 128–161; render-target allocation 619–634 MB → 134–177 MB. No
frame over 50 ms on either build on this Mac. A phone turned on its side (low tier): 4 either way.

**The town's batches** (`scene-probe-phone-low*.json`, a development build, program look-ups counted for six
seconds): the island view 1,892 → 336 a second, a close-up in the town 659 → 240.

**A long session** (low phone, ten minutes of mixed use with a forced collection every minute; `long-phone-low-after`,
the merged tree): the heap after a collection 327 MB in the first minute, then 345 to 374 MB with no trend (354, 372,
345, 374, 348, 354, 353, 353, 374) while the kinds loaded went 0 → 308; programs 134–135 throughout; textures
226 → 428 and geometries 534 → 856 with the models; timers 2 and listeners 52–54 throughout; the render distance
whole for all ten minutes (on c99ff83b it is at 60% within a minute or two of every phone run above); 46 near levels
let go; one tier and no resolution change. 188 frames over 100 ms (one every 3 s): 173 of the 343 slow frames are a
trip, 109 the render, 12 the status (worst 81 ms), 7 the rotation step (worst 0.62 s).
The same seven minutes on c99ff83b (`long2-phone-low-base`): 310, 334, 324, 344, 348, 350, 353 MB after a
collection with 195 kinds loaded and the render distance at 60% from the 24th second on. The heap in use is not new
with this branch; it is what the gate's untouched view does not show (§5, 9). The final tree over the same seven
minutes (`long2-phone-low-after`): 330, 362, 374, 345, 352, 372, 352 MB with 274 kinds loaded, the render distance
whole throughout, 26 near levels let go; the resolution tried 1.25 once (112 s) and gave it back eight seconds
later. One frame of 2.25 s (a resting animal picked: §5, 4) and one of 1.0 s (the rotation step: §5, 3).

**The town close up after round 343's resting models** (the coordinator's question; a house yard's dog chosen close
up, 130 s, the last 40 s measured; `townclose-*`): on the phone's medium tier c99ff83b draws 142–143 calls and
0.51 M triangles a frame, the round 191 calls (+48) and 0.82 M; the frame's own work 26.1 / 27.9 ms (p95 31.2 /
32.2) against 23.4 / 24.9 ms (p95 27.6 / 28.7), a steady 30 on both, two pairs of runs. On the low phone's low
tier: 126 calls on both, 22.8 ms on both. The cost is acceptable as it is; each resting kind is one instanced call
already, so fewer calls would mean batching different species into one mesh with a shared skin atlas, which is
not worth it for 48 calls.

**A desktop session of zooming** (high tier pinned; `base-zoom-desktop`, 12 animals, against `check4`, 8 animals, the
merged tree): c99ff83b loaded 902 kinds, let 801 near levels go and pulled the render distance to 576 m; the branch
loaded 919 kinds (470 MB of skins), kept 250 to 327 MB of them on the GPU (1,137 far skins' copies let go and sent
again as needed), let 427 near levels go (those loaded ahead within 48 m and never drawn near) and kept the render
distance whole.

**The heap gate** (low phone, islands mount, world v2, prebuild, 90 s, forced collections, three runs; the merged
tree): 265.0 / 266.1 / 266.1 MB at the first frame, 260.3 / 260.5 / 261.5 MB in steady play (384 allowed; c99ff83b
at its release: 258–263 / 257–259).

**The loading path, live** (`live-cache-embed.json`, the live embed, a phone's user agent, two visits in one
browser): 356 requests, 12.0 MB on the first; on the second all 308 `/ark/assets/**.glb`, the sky, the transcoder's
wasm and the 2.4 MB positions atlas were asked for again (`Cache-Control: public, max-age=0`, `cf-cache-status:
DYNAMIC`), and the first frame came no sooner. The scripts (4 h), the bucket's models (a year) and icons (an hour)
came from the cache. Thirteen tree `.card.glb` files are fetched twice a visit (two loaders). The header rule added
here is the one `/ark/poster/` already has live (checked with `curl -I`); I did not make a production build to
serve it.

**An iPhone's answers** (`ios-probe/iphone.json`; Chromium given an iPhone's user agent, 4 cores, no memory, a
402×874 screen at 3×; there is no iPhone here, see §6):

| | tier at the start | overlay | memo on the device |
|---|---|---|---|
| c99ff83b (by its rule, and the iOS lane's panel) | low, 402×874 buffer | | |
| first visit | medium, pixel ratio 1.5 (603×1311) | `bench 4.7 ms  trial` | open |
| the page lost without a goodbye 8 s in, next visit | low | `bench 5.0 ms  lost` | failed, once, a week |
| the app says `?mem=3&cores=6` | low | `bench 4.8 ms` | none |
| the app says `?mem=6&cores=6` | medium | `bench 5.1 ms` | none |

**The low tier's resolution** (`ios-probe/sharp.json`, the low phone profile, 360×800 at 2×, 6×; pictures
`sharp-scale-1.png`, `sharp-scale-1.5.png`): locked at a steady 30 by its script from the start, 360×800 for the
first 110 s (the start, then 10 s of frames on time); 450×1000 at 112 s, 540×1200 at 122 s; at 142 s the frames
ran late (p95 42–49 ms; the Mac was shared) and it went back to 450×1000, where it stayed for the minute left.
Battery saver said: 360×800 within the next frames. In the pictures the houses' edges, the trees and the rocks are
plainly sharper at 1.5. On model devices over ten minutes (the pacing alone, simulated): a phone with frames to spare
changes resolution twice in all; one that holds 60 at 1 and not at 1.25 tries it at 31 s and again at 6.5 min, 2 s
each time; with the top at 1 every model device does exactly what it did before.

**A wild animal chosen at `ark:ready`** (`evidence/perf/wild/`, `perf-scratch/wild-probe.mjs`; the production bundle,
the embed, the host's `ark:select` close up sent the moment the page says ready; a grey crowned crane in the
wetland; the tree with round 343 at 80c625b7 merged in):

| | phone (4×) | low phone (6×) |
|---|---|---|
| `ark:ready` to the animal on its rig, before | 24.1 / 22.2 s | 29.2 s (the arrival lane's own runs: 27–33 s) |
| the same, after | 17.2 / 17.2 / 17.6 / 17.9 / 18.0 / 18.6 s | 22.4 / 24.0 / 24.1 / 24.1 / 25.1 s |
| the wild world's build, before | 6.7–7.5 s of work in 441–446 slices: 18.7 s | 10.5 s in 451 slices: 25.1 s |
| after | 7.3–7.9 s in 166–195 slices: 14.7–15.9 s | 10.3–11.4 s in 182–195 slices: 19.0–21.6 s |
| frames meanwhile (median interval) | 33 → 77–85 ms | 46 → 104–111 ms |

A third of the wait is gone, not most of it: the build is 7 to 11 s of main-thread work on these profiles whatever
the slices, and the frames drawn beside it take the rest. A 60 ms slice measured no better than 40 (three runs), and
neither did holding the display's rate through it (four runs): both left out. The work itself is the behaviours
pass's (§6).

**The host's unchanged push** (`ios-probe/push-before`, `push-after`; phone 4×, six pushes of the same Ark, each
freshly parsed with its time moved on 45 s):

| | script inside the bridge call | longest task after it | worst gap between frames |
|---|---|---|---|
| before | 22–89 ms (median 47) | 53–99 ms | 50–100 ms |
| after, the host's first push (nothing to compare it with) | 39 ms | 50 ms | 67 ms |
| after, each push from the second on | 3–4 ms | none over 50 ms (one of 54 ms beside a tier change) | 17 ms |

**The final tree against c99ff83b** (89d9885d: both merges with round 343 and everything in §3 but rule 5, which
only touches a tier on trial; `ab-zoom4-phone`, two rounds, and `ab-arrive3-phone-low`, one). The Mac was busier
than in the morning: on both builds the phone profile gave up the medium tier for the low one within the first
minute of every run, so these are low-tier runs, and the baseline's status frames were shorter than in the morning
(fewer of the chosen animals were on a plan at that hour).

| Zooming in to eight animals and back, twice (phone, 4×) | c99ff83b | branch |
|---|---|---|
| zoom-ins (of 16) with a wait over 250 ms | 8 / 6 | 1 / 1 |
| worst frame's own work | 423 / 370 ms | 318 / 340 ms |
| worst render / stream / status in a frame | 241, 159, 119 / 276, 94, 118 ms | 129, 16, 16 / 134, 20, 14 ms |
| frames with 60 ms or more of their own work, and the time in them | 89 / 93: 10.2 / 9.8 s | 95 / 131: 7.8 / 12.7 s |
| frames a second while zooming in, first and second visit | 21.1–26.3 and 27.9–28.6 | 26.3–28.3 and 27.5–28.1 |
| frames over 100 ms, first and second visit | 38 / 16 and 11 / 16 | 15 / 34 and 3 / 16 |
| whole-atlas uploads; texture MB uploaded | 23 / 30; 610 / 732 | 4 / 4; 184 / 167 |
| ms the page waited on new programs | 608 / 327 | 391 / 254 |

| The low phone, timing the chosen animal (6×, one round) | c99ff83b | branch |
|---|---|---|
| tap to its own near model drawn, first visit (median of 8) | 2,890 ms | 1,720 ms |
| tap to rigged, first visit | 4,434 ms | 1,687 ms |
| the same, second visit | 1,416 and 1,318 ms | 1,503 and 1,503 ms |
| chosen animals never rigged within 12 s (of 8), first / second visit | 5 / 5 | 1 / 1 |
| worst status / render / stream in a frame | 199 / 525 / 121 ms | 23 / 55 / 37 ms |
| worst schedule in a frame | 303 ms | 399 ms |
| zoom-ins (of 16) with a wait over 250 ms | 5 | 14 |

The last two rows are the trips, and they go by the run, not by the build: over the three low-phone rounds of the
day the zoom-ins with a wait over 250 ms were 11 / 16 / 5 on c99ff83b and 7 / 5 / 14 on the branch, and the frames
with 250 ms or more of "schedule" in them 4 / 16 / 1 and 5 / 2 / 14. A CPU profile of the final tree
(`prof-arrive-final`) shows each of them to be one trip worked out cold (`tripAt` → `tripFor` → `finishOf` →
`intent`, 230–370 ms at 6×): §6's first row. The second visit gained nothing in this round (the models were in
memory on both builds). What is repeatable across every round: the status, render and stream frames, the uploads,
the first visit's model and rig.

**The same run's memory check** (§5, 9): on the low tier with 341 kinds loaded in 106 s the branch pulled the render
distance to 60% as well.

## 5. Other findings (measured, not changed)

1. **A desktop whose CPU is busy with other work loses the Ark's tier and half its frames.** Chrome's Compute
   Pressure reading (`runtime/power.ts`): "critical" for 20 s is taken as heat "serious", which caps the rate at
   30 and asks for the low tier. On this Mac, shared with a dozen agents, a desktop run left to itself went to the
   low tier at 43 s and to 30 frames a second at 57 s (`t0`), and the live `/ark` reported `low` on a desktop
   profile (`live-hud.json`). The owner's own Mac while agents run is such a desktop. Left as it is (it is by design
   for a laptop on battery; whether a mains-powered desktop should give up its tier for other programs' load is a
   product choice); the harness now says the power is calm.
2. **A capable desktop ended on the low tier within a minute (fixed).** Left to choose its tier with the power said
   calm, c99ff83b went high → medium 3.5 s after its first frame (the tier check judged the two seconds in which
   the behaviour world is built and the first models handed over: 37 ms of work a frame, 12 frames a second), then
   medium → low at 42 s while drawing 60 frames a second with 6–10 ms of work (the memory check: the heap before a
   collection against 512 MB, the GPU estimate with every loaded model in it against 320) (`tiers-desktop-base`).
   With the memory check's readings fixed it stays on medium (`tiers-desktop-after`); with the tier check judged once
   the start is over it stays on high, at 45–55 frames a second on this Mac that day (`tiers2-desktop-wip`).
3. **The five-minute rotation step is a held frame for every viewer.** The layout at the step works out a trip for
   each animal that comes out (`newEntry` → `tripAt`) and asks the roost question for the ones the warm-up had not
   reached: 0.26–0.40 s on the phone profile (CPU profile `prof-rotation`: 203 ms in `newEntry`'s trips, 107 ms in
   `restingAtRoost`), 0.57–0.62 s on the low one, 1.43 s on the desktop's high tier (more animals come out), and
   after it every schedule's memo is cold (`forgetSchedules`). Behaviour's functions; handed over.
4. **Picking a resting animal re-wires every schedule.** `select` of an animal not drawn (the panel's list picks
   them) pins it, lays the Ark out again and re-wires: frames of 2.0–2.8 s in "world" on the low phone profile
   (`ab-arrive-phone-low/after-2`, `select-phone-low-after`), then every memo cold. Not seen in every run (it depends
   on who is out at that step). Handed over.
5. **The page around the canvas is light** (`live-hud.json`, the live `/ark`, desktop): twelve animals picked from
   the panel in ten seconds cost 109 renders of the page's React tree, 65 ms of layout and 130 ms of style in all;
   the longest click handler 29 ms; with a card open and its status ticking, 0 renders in 12 s. On a phone profile
   my clicks did not reach the collapsed panel: not measured there.
6. **Hidden means stopped.** Covered by the host or the page hidden, for a minute: 1–2 animation-frame callbacks,
   no draws; two timers stay (the live panels' 500 ms tick and one more: ~5 runs a second). The embed's 45 s read
   went on while the host said covered (now stopped). Coming back cost one frame of 0.42 s (the rotation that had
   come due) and, on c99ff83b, the tier (§2, 6). The final tree (`hide2-phone-after`): 1–2 callbacks and 23–29 ms
   of script in a minute hidden, no tier or resolution change on coming back, one frame of 0.12 s and one of
   0.47 s. That run and its baseline were both on the low tier already (the Mac was busy), so the tier kept on
   coming back rests on the morning's run and the pacing's test.
7. **Night, rain and snow** (`weather-*-after`): on the desktop's high tier the frame's own work at the island view
   is 19.5 ms by day and night, 26 ms in rain, 25 ms in snow; on the phone's medium tier 21–27 ms in all of them.
   The first night frame links 11–14 programs and the first clear day after it 16–19 (0.1–0.3 s once each on the
   phone profile). Snow adds 60–100 draw calls on the medium tier. For the lights lane.
8. **The finish on the high tier**: the ambient occlusion draws the scene a second time (the draw calls double) at
   full resolution; that and SMAA are the passes a half-resolution version would save most on. Not timed (the Mac's
   GPU is not the bottleneck here) and a picture change: the lights lane's.
9. **In use, the low phone's heap after a collection is 345–375 MB**, not the 260 MB the gate reads in an untouched
   view at 80 s: the gate holds with 3 to 10% to spare once 300 kinds are loaded. And the memory check, which reads
   the heap before a collection (its floor over half a minute), does pass the low tier's 384 MB once more kinds are
   in: in the final zoom runs (`ab-zoom4-phone`), a phone that had dropped to the low tier and loaded 341 kinds in
   106 s read 391 MB and pulled the render distance to 60% in four steps, six seconds, as c99ff83b does within the
   first half minute of every run. Pulling the distance in frees none of it (the models' far levels and pictures
   are never let go: §6), so it stays there. In WebKit there is no heap reading at all and only the GPU estimate
   counts.
10. **Two Ark canvases on one page**: none on the public pages (the home page has the hero's frame only, and tells
    it when it scrolls out of view; `/ark` has one). `components/ark/ark-panel.tsx` not checked.

## 6. What is left

| What | Why not here | Measured |
|---|---|---|
| The behaviour world built on the main thread after the first frame, every visit (`ScheduleWorldBuild`: the map's places and the walk grid, the same for every reader) | Behaviour's files. Built in the prebuild worker, baked into a file beside the positions atlas, or kept in the page's cache, the wild arrival falls to a few seconds and the wild animals are on the island 15 to 25 s sooner for everyone | 6.7–7.9 s of the phone profile's main thread, 10.3–11.4 s of the low one's; 17–18 s and 22–25 s from `ark:ready` to a wild animal even with the longer slices |
| Working out a trip (`behaviour-schedule.ts` tripAt → intent → placedIntent, walkChain, threatAt; under it the colliders' `near` / `distance` / `path` and the town's ground sampler) | Behaviour's files (the boundary) | 11–15% of the phone profile's busy main thread while zooming; one cold trip 60–290 ms at 4× in one frame; the largest section in most remaining slow frames |
| The status's plans themselves (`scheduleFed`: 90 path-searched plans for one bar) | `animal-status.ts`; sliced from outside instead | With the slicing the card is whole 1–3.5 s after the tap on the phone profiles (one plan, 10–30 ms, a frame), and one plan can still be a 230 ms frame at 6× |
| The rotation step and a resting animal picked (§5, 3 and 4) | Behaviour's and the layout's | 0.3–1.4 s and 2–2.8 s frames |
| Far levels never let go (their geometry and their picture in memory) | `models.ts` and everything that holds a model; only the skins' GPU copies go here | 919 kinds, 470 MB of skins loaded in a desktop session |
| `updateMatrixWorld` over ~900 objects, 57% of them in hidden subtrees | The owners' objects (static scenery could say `matrixAutoUpdate = false`) | 4.6–7.2% of the phone profile's main thread |
| Program look-ups left: the rocks' material shared by geometries with 3- and 4-component vertex colours, visible instanced meshes with no instances | Map's materials | 336–720 a second |
| The trees' level re-sort on every 1.5 m the camera moves, also from 900 m up | Map's | 2.9–6.9% of the phone profile's main thread while moving |
| 308 scenery files as 308 requests; the tree cards fetched twice | A pack format; two loaders | 4.4 MB, 308 requests on a first visit |
| Uneven frames on 120 Hz displays, and what the cap gives | No 120 Hz display here | Logic and tests only; `scene.runtime().display` reports the measured rate and the cap on a device |
| Whether an iPhone holds the medium tier: its frames and, above all, its memory | No iPhone here; WebKit gives a page no memory reading. The tier rule, the trial's memo and the pacing are logic, tests and a Chromium given an iPhone's answers | The iOS lane's simulator: 620–710 MB in the page's process and 225 MB in the GPU's, on the low tier. The medium tier adds to the GPU's side (skins' ceiling 128 MB against 64, a 1024² shadow map, the finish's targets at 1.5×); the page's own heap is the same on both tiers here (327–374 MB in use) |
| The benchmark's figure on real iPhones (`bench` on the overlay) | The same | It only matters above 9.5 ms (the low tier from the start); an iPhone should read 2 to 5 |
| The low tier with no anti-aliasing after a drop from medium | The context is made without multisampling when the page starts on medium (the lights lane's note) | Rule 4 softens it where frames allow (1.5× supersampling); a phone that dropped for its frames may not earn it |
| GPU-side cost of the icon atlas and of a shader compile on a phone | The Mac's GPU does both in under a millisecond or two | By bytes and waits only |

## 7. Decisions

| Question | Options | Choice | Why |
|---|---|---|---|
| The status's 90 plans in the tap's frame | leave to behaviour; a light status and the full one later in one go; a dry run stopped by its subject | the dry run, 6 ms a frame (12 at rest), a light status meanwhile | No edit to behaviour's files, the same answers, no frame held; the later-in-one-go version only moves the held frame into the flight |
| A new trip in a frame already holding one | all at once (as was); hold the animal at its last pose; hide it | hold, 0.5 s at most near and 1.5 s far, never the one watched | The pose is a pure function of time: a held animal resumes exactly where it should be |
| New materials | compile in the frame (as was); hold the object until compiled | hold, 3 s at most, one release a frame; stand-ins never (`arkNoHold`), loaded-but-undrawn meshes compiled ahead | A late leaf is not seen; a held frame is |
| The close-up detail and the ground tiles after a jump | all at once; a few a frame nearest first | a few a frame in a live view, all at once in a recording | Stills and golden shots unchanged |
| Far skins over the ceiling | leave (near levels thrash, GPU unbounded); let far levels go; let their GPU copies go | GPU copies, by when each was last drawn, down to 0.7 of the ceiling | Contained in the runtime: no holder of a model changes; the picture is the same the frame it is drawn |
| The memory check's heap reading | this moment's; the floor of the last 30 s; none | the floor | This moment's is mostly garbage (and in Chrome outside a harness it is quantized and up to 20 minutes old); the floor is still above what a collection leaves, said in §5 |
| The memory check's GPU reading | everything; less the models | the scenery only, the models left out by identity | The models have their own ceiling; pulling the render distance in frees none of them |
| Fast displays | every refresh; every other from 100 Hz | every other from 100 Hz (120 → 60, 144 → 72); 90 Hz as is | A steady 60 over an uneven 60–120 and half the heat; applies to desktops too |
| Resizes | every change; when it stands still | 120 ms still, at most every 400 ms of a drag | The shape follows at once, so nothing looks stretched |
| The scenery's cache headers | immutable; a day and stale-while-revalidate; leave | a day in the browser, a month stale-while-revalidate | The files are redrawn in place under `v1`; a day is the longest a changed file waits |
| The pacing's retries | as were (90 s ceilings, tries to 120 s); rarer | ceilings double to 15 min, tries to 300 s, one step back | Every change of resolution re-makes the render targets and is seen |
| The desktop's tier check and the CPU-pressure cap | change; report | report (§5, 1 and 2) | No quiet desktop to measure the effect on |
| An iPhone's tier | leave on low; medium for all; by the screen; a measured warm-up before choosing | six cores where the count is hidden; medium on 3× screens, low on 2× ones when the memory is unknown; the app's `?mem=` / `?cores=` win | Every 3× iPhone on iOS 17+ has 4 GB or more; the 2× ones include the 3 GB devices, which the rule already keeps on low. A warm-up at a candidate tier is what starting there and stepping down already is |
| The opposite failure (an iPhone that cannot hold medium) | trust the pacing as it is; stricter on trial; remember | on trial the tier must hold the display's rate (resolution first, then 15 s at 30, then the tier, once); a drop, or a page lost in its first 90 s on screen, is remembered for a week, doubling | Before this change that phone drew the low tier at its display's rate: it must not end up worse; and it must not walk into the same wall at every visit. Never raised again in a session, so no oscillation |
| The low tier's resolution | 1 for all (as was); 1.5 for all dense screens; earned | earned: 1 → 1.25 → 1.5 after 10 s on time, given back when late, tried again after 6, 12, 15 min | The low tier is where the weakest GPUs are: none of them pays for it unasked |
| A host's unchanged push | decode and let the scene find out (as was); compare whole; compare in slices | in slices of 3 ms between frames, against the host's last push kept as it came | The whole compare is itself 27–59 ms on the phone profile; kept raw costs the page one more copy of the Ark's JSON (a few MB) in the apps only |

## 8. Gates

- `npx tsc --noEmit -p tsconfig.json`: exit 0 on the branch's head.
- `npm run lint`: exit 0 (the repository's standing `<img>` warnings only).
- `npm test`: 2,705 tests, 2,703 pass, 0 fail, 2 skipped (run on 427c8071; the two merges of the round after it and
  the arrival slices were followed by the 84 tests of every file touched here and by the round's own: all pass).
- The heap gate (low phone, islands mount, world v2, prebuild, 90 s, forced collections, three runs, 89d9885d):
  266.1 / 265.9 / 265.5 MB at the first frame, 261.6 / 262.6 / 264.1 MB in steady play (384 allowed).
- Page errors: none in any run above.
- Golden shots: none expected to change. Everything here is off in a recording (no pacing, no shader hold, no
  slicing, the build and the wiring at once), a pinned tier is never on trial, and the desktop's tiers are chosen as
  before.
- The behaviour and collision audits were not run: no file they read is edited (`src/lib/ark-audit/*`, the schedule,
  the colliders).
