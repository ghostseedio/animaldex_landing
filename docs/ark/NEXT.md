# Ark motion 100x pass: integration (`ark-next`)

The running integration doc for landing branch `ark-next` (integrator lane). The owner's brief and the lane contract are in the
handover folder: `ark/queued/motion-100x-brief.md`, `ark/queued/motion-100x-contract.md`; decisions in AnimalDex
`docs/ark/DECISIONS.md` (29 onwards). `ark-next` started from landing `origin/main` 7764fe12 (the live release 1323a70d plus
the privacy text).

## Gates (every merge)

| Gate | Command | Pass |
|---|---|---|
| Unit and integration tests | `npm test` | all pass |
| Types | `npx tsc --noEmit -p tsconfig.json` | clean (the two `header-menu.tsx` svg errors show only before `next lint` has written `next-env.d.ts`) |
| Lint | `npm run lint` | exit 0 (the known `<img>` warnings) |
| Map spawn validator | `npx tsx --test src/lib/ark-map.test.ts` | 0 failures |
| Visual CI | `nice -n 10 npx tsx scripts/ark-visual.mts` | 19/19; a new baseline only after two identical renders and a look |
| Default view | `nice -n 10 node scripts/ark-rig-scenes.mjs --island --seconds 60 --label <run> --out <dir>` (twice) | pace ratio median ~1, backwards share low, nothing backwards over 1 s, ground turns low (release: 0.99; 0.1–0.2%; 0.2–0.4 a minute) |
| Motion metrics | `npx tsx scripts/ark-motion-ci.mts` (also a visual-CI hook) | every registered number within its limit |

## Merges

| # | Lane | Branch head | `ark-next` head | Gates |
|---|---|---|---|---|
| 1 | L5 collisions (API surface: `collide/`, `ark-collide-bodies.mts`, `behaviourHomePlots()`) | `ark-collisions` 39adcbd8 | 521c3de4 | tests 2,260/2,260 (validator 0 failures); tsc: the 2 known; lint 0. Nothing imports `collide/` yet, so the picture and the default view are main's (visual CI and the default view run on merge 2) |
| 2 | L1 locomotion (interface + the live pose layer: `locomotion/`, `ARK_RIG_LIVE`, `rigLivePose` after `matrix.compose`) | `ark-locomotion` fc694a84 | 0e5e526e | tests 2,260/2,260; tsc clean; lint 0; visual CI (Mac, SwiftShader): 13/13 desktop shots pass against the release baselines (worst changed 0.73%), the run then timed out mounting the high tier at load ~130 |
| — | Integrator: the motion CI summary (`scripts/ark-motion-ci.mts`, `tests/ark-motion/metrics.json`, `src/lib/ark-motion-metrics.ts`, a visual-CI hook) | — | 851c56fd, 6a723ada, 73e1a747 | — |
| 3 | L2 flight, swim, legless (midpoint; includes L1 fc694a84) | `ark-flight-swim` 3cb18604 | 7f2108dd | tests 2,279/2,279 (L2's 18 in); tsc clean; lint 0; default view ×2: pace ratio median 0.93 / 0.99, backwards 0.2% / 0.2% (none over 1 s), ground turns median 0.2 / 0.0 a minute, bullfrog 2.35× / 3.12× (release 2.2×); motion summary 13/13; visual CI (Mac): 18/19 pass, `desktop-reef_underwater-day` fails on its turtles' new swim (looked at: flippers mid-stroke, bodies lower, no broken geometry) |
| 4 | L4 true scale | `ark-true-scale` f6a1e8f8 | 893832a7 | clean merge; tests 2,279/2,280 (the frog pace, known); tsc, lint 0; motion 13/13; default view ×2: pace 0.97 / 1.01, backwards 0.2% / 3.1%, turns 0 / 0.6, bullfrog 9.1× (true size meets the old 5 cm floor) |
| 5 | L6 scenery | `ark-scenery` c5812a75 | c579bc62 (+ b71cebde: L6's numbers in the summary) | `tests/ark-visual/hooks.json` conflict: both hooks kept, scenery's first; tests 2,280/2,289: the 3 attach floors (expected before generator 7), the frog pace and the bear's validator spot (known), and 3 that fail on L6's own head too (stags clash 5.23 m apart, snow leopard 15 m from a goat, pigs vs zebras asleep), routed to L6; motion 20/20 |
| 6 | L3 grounding | `ark-grounding` fda84235 | 8d90308a + 3900a81d | conflicts: generator number (7), sampler imports (both), index.ts (L2's sidewind yaw, then L3's stand), the attach files from L6's side then regenerated; `node scripts/ark-tree-attach.mjs` (1,784 points), `ARK_ATTACH_BASELINE=update`, floors ~15% under (see the fixes below); tests 2,289/2,296 (the 3 L6, the duck sitter, the 2 known); default view ×2: pace 1.00 / 0.94, backwards 5.3% / 4.9% (none over 1 s), turns 1.2 / 0.0 |
| 7 | L1 locomotion final | `ark-locomotion` 314927d0 | e813bd21 + a9ecfffd (`setLocoGround(drawnGround)`, L1's tests in the summary) | clean; tsc 0 |
| 8 | L2 final | `ark-flight-swim` 2cf309e3 | af146487 + f1037423 (L2's numbers in the summary) | clean; motion 21/21 |
| 9 | L7 chases | `ark-chases` 30dbbf9e | cc82a1bc + 356d0fc4 (its three wirings) | clean; tsc 0 |
| 10 | Part B streaming | `ark-streaming` 366f985b | 77c3f2f5 | conflicts: `asset-trees.ts` (Part B's chunk cull, then L6's level hand-over by size), `index.ts` (entry: L2's `l2` and Part B's `streamAt`; the debug handle: Part B's `library` and L3's grounding report); tsc 0, lint 0 |
| 11 | Encounter scene | `ark-encounter-scene` 35eb7d35 | 93b9c1b1 + 385e8921 (`Array.from` in `ark-hunting.test.ts`, TS2802) | clean; inert while the server's `hunting` is `pool` |
| 12 | Town island (T2) | `ark-town-island` bdcd9ff1 | 084c07f6 | clean; new files under `src/ark-scene/islands/`, its own visual set in `tests/ark-visual/town/` |
| 13 | Encounter scene (the same `Array.from` fix) | `ark-encounter-scene` 9fcbb049 | 34524f02 | clean |
| 14 | T3 islands scene (town animals, one island at a time, the switch, `?focus=` and My animals across islands) | `ark-islands-scene` 439cd5f3 | 1c508857 | clean; tsc 0, lint 0; tests 2,280/2,332: 46 locale tests on the new `ark.islands.*` keys (routed: `ark-islands-i18n`), the positions atlas (routed: `ark-positions-atlas`), L7's file timeout, the L6 two, the known two |
| 15 | L5 collisions final | `ark-collisions` 512211ba, then 37de0b1d | a9af1cc8, 7930ec2e | conflicts: the debug handle (Part B's `library`, L3's grounding report, L5's `collisions` stats), the schedule test's import (`SAFE_MOST` and `bodyRadiusOf`), the walk mask (regenerated) |
| 16 | L6 fix (open country's sparse fill, scree under 0.45 m not solid) | `ark-scenery` a7cee4a7 | 6a8cefe5 + 7fa9a4ca | the walk mask regenerated, the attach baseline updated, the leaf/bark/branch floors re-derived (below); a new validator failure: jacksons-chameleon's burrow entrance inside a drawn rock (routed: L6) |
| 17 | L1 (`--start-at`, pinnipeds and sirenians keep their clips) | `ark-locomotion` a0d507a4 | aaad9473 | clean; `sampler.ts` keeps both imports |
| 18 | L7 fix (the sitter, asserts with messages, the stags clear of a boulder) | `ark-chases` dddad0a0 | ce245fd8 | conflict in `walkable()`: L5's climb-foot check and L7's sitter rule (sitter first); recipes 28/29 (the mallard set-off) |
| 19 | L6 fix (the chameleon by a hole lands on the hole, not in a rock) | `ark-scenery` 2d1d2895 | 0de78f61 | clean; spawn validator 15/15 (no bear, no chameleon) |
| 20 | Positions atlas v2 (encounter lane) | `ark-positions-atlas` cba0594d | 342097c9 | clean; positions tests pass |
| 21 | T3 (one world, town animals on the schedule, town colliders via `setIslandColliders`, zoo feeding, one sea; NavGrid per-island extents on L5's grid) | `ark-islands-scene` e76158a5 | 9df003b3 + 5388b309 (the foot ground per island in one world) | T3 resolved `behaviour-nav.ts` itself on ce245fd8; full suite 2,318/2,368: 45 locale tests, the mallard set-off, the frog pace, the emperor penguin's breaths, the barn swallow's miss (all routed); validator 0; motion all pass |
| 22 | Part B multi-island streaming, the fog push | `ark-streaming-islands` 2f7f6fa3 | b9446a3d | clean; tsc 0 |
| 23 | T3: the upright phone looks across to the town (decision 154), the director over both islands | `ark-islands-scene` 4468d2a4 | e043745b | clean |
| 24 | L5 nav start | `ark-collisions-navstart` 7533ab4e | 7ab61a51 | clean; tsc 0 |
| 25 | L7 swallow fix (the set-off test exclusion never landed, decision 155) | `ark-chases` 772d9bcb | e9c69cd2 (cherry-pick), e43139cb | chases 11/11 |
| 26 | L5 two-island colliders | `ark-collisions-town` 2d939850 | 491a4692~ | collide + town 7/7 |
| 27 | i18n: `ark.islands.*`, then Meadow | `ark-islands-i18n` 95193387, 33306e20 | 491a4692, 60f41b2f | ark-languages 49/49 |
| 28 | L1 frog pace and penguin breaths | `ark-l1-fixes` 5cab18f6 | e922c08f | schedule + breath 28/28 |
| 29 | T3 blocker 1: the town in a worker after the first frame | `ark-islands-scene` e21ae0a3 | 31fdcbcb | `npm run build` emits `ark-town-worker.js` |
| 30 | L6 decision 155: the mallard's nook opened | `ark-scenery` 017c5572 | 9d089ea4 | set-off test passes |
| 31 | The wild island without its hamlet (islands mode) | `ark-wild-no-hamlet` 7d3ee5b5, 98a30984 | f098c301, 03dfd120 | 18 locale conflicts: the i18n lane's words kept; no-hamlet + languages 54/54 |
| 32 | T3 Meadow in the panels | `ark-islands-scene` 57014b78 | 5cd8efff | **the islands release candidate 03dfd120**: suite 2,381/2,382, 0 fail |
| 33 | L5 collide gate (the audit green in both modes) | `ark-collide-gate` e056ef12 | 412fa2e3 (+ b22d4b4c: the workflow's YAML quoted) | suite 2,381/2,382, 0 fail; collisions workflow green on GitHub |
| 34 | T3 warm-up guard | `ark-islands-scene` 0a98e0de | f0cf2f1f | 8/8; default view and the town probe: no page errors |
| — | Linux visual baselines (decision 147), the intelligence hook CI-only skip (decision 209), the release doc | — | 1a2781af, 643a5d9f, cb91a9f1, **471c8d76 (the release head)** | 19 golden + 4 town shots looked at |

## After the islands release (the next web-only deploy)

| # | Lane | Branch head | `ark-next` head | Gates |
|---|---|---|---|---|
| 35 | L1 decisions 201–202 (reactions capped at 1.2× the walk or run pace; Froude walk and run floors for reach-limited rigs; goals out of a slot's reach not taken; unreachable roosts become a home-ground bed; a stay never jumps) | `ark-l1-walkpace` 86b15179 (contains `ark-l1-pace` f21ad63b) | c42708cb | clean |
| 36 | Behaviour: backwards (a foal faces home, a sleeper keeps its heading, turns at TURN_RATE) | `ark-behaviour-backwards` cef5c27d | — | clean |
| 37 | L5 decision 204: the separation push eased between 4 s moments, still bodies weigh more | `ark-collide-ease` 50760287 | 772f60e1 | clean; tsc 0; tests 2,385/2,387 (the dens test, fixed in 39) |
| 38 | T3: the apps' embed mounts the archipelago | `ark-islands-embed` ca3d9098 | 4c1cf930 | clean; tsc 0 |
| 39 | L1: 202c beds follow the den rule; the default view measures layer-drawn walks against the schedule's pace | `ark-l1-dens` 3224649c | 9757fe5b | map + schedule 42/42 |
| 40 | L5: flights clear what they would cross low (the masked owl); a walk goal the body can't stand at is not taken (the tenkile) | `ark-collide-owl` 453ccb23 | ed508601 | suite 2,386/2,387, 0 fail; motion all pass; default view ×2: pace 1.02 / 0.97, backwards 1.2% / 0.7%, turns 0.6 / 0.5 a minute, only a zebra 1.6× once, no page errors; collisions: islands-mode overlaps +0.26% over L5's limit (L5 re-deriving on this tree) |

| 41 | T3: the idle drift sways ±0.12 rad in islands mode (the phone kept the town in frame) | `ark-islands-drift` 9d820def | 0b082f91 | clean; tsc 0; golden shots unaffected (islands off, frozen clock) |

| 42 | L5: collision limits re-derived on ed508601 (L1's dry-land beds moved sleepers) | `ark-collide-limits` ba79e797 | 4ee5c2ad | collisions workflow green (both modes) |
| 43 | The town built in its worker alongside the wild prebuild (joins 0.13 s after the first frame on the phone profile) | `ark-town-worker-speed` c5558bcd | c7112bd6 | **the follow-up deploy's code**: suite 2,390/2,391, 0 fail; tsc 0; lint 0; motion all pass; default view ×2: pace 1.04 / 1.02, backwards 1.5% / 2.6% (a zebra 1.1 s, a puffin 1.6 s), turns 0.6 / 0.6, a zebra 1.63× and a cheetah 1.76×, no page errors; T3's embed check on c7112bd6 (two islands and one): no page errors, every host message right, the zoo focus link flown to once joined; visual: run 43165446837 re-accepted (9cbc3871) |

## The v2 round (decision 226; held for decision 234)

| # | Lane | Branch head | `ark-next` head | Gates |
|---|---|---|---|---|
| 44 | W1: the bigger wild island, v2 the islands default | `ark-wild-island-next` 75419a2c | bdf8d811 (prepared as 37f0b8db) | conflicts: behaviour-schedule imports (both), the drift (W1's `wildFrame().driftSway`, v1 `driftSway` 0.12), `archipelago.ts` with the town worker (both; `setArkWorld("v2")` before the town starts, so the town sits at v2's origin); suite 2,418/2,419, 0 fail; motion all pass; default view ×2 pace 1.02 / 1.00, backwards 0.7% / 0.9%; islands-off golden shots unchanged (run 43171782625: ≤ 0.11% against 9cbc3871, so the baselines stay) |
| 45 | Positions atlas v3 (encounter lane; inert) | `ark-positions-atlas-v3` a2e30ce4 | b2e5655a | positions 3/3; served atlas sha256 72442b16…; collisions green |
| 46 | T3: the other island map style, never out; the one sea only under drawn town chunks | `ark-islands-town-map` 63acc25a | dd9410fa | streaming + islands + town 49/49; default view ×2 pace 1.00 / 0.97, backwards 1.9% / 0.9%; islands-off renders unchanged (Mac before/after 0.006% / 0.002%) |

| 47 | T3, decision 234: v2's portrait view from 900 m at polar 1.0 toward the town; fog pushed from 520 m of reach on v2 (v1 700) | `ark-islands-v2-phone-view` 6dfd7cb3 | 840af3d3 (**the v2 deploy's code**) | streaming + islands + town + wild 78/78; tsc 0; default view ×2 pace 0.98 / 0.97, backwards 2.1% / 1.6% (a puffin 1.9 s and 1.1 s), turns 1.8 / 0.6, no page errors (T3's one-off "reading 'at'" not seen); islands-off renders unchanged (Mac 0.007% / 0.0%), so no new visual run |

- Decision 234 (T3): on the phone the town's middle went from 41% to 15% fog (near half 33% → 10%) at low and medium;
  the wild island's middle 0%.

- For W1's merge later: its drift lines conflict with 41; resolve with W1b's `wildFrame().driftSway` and set v1's
  `driftSway` in `islands/views.ts` to 0.12 (null there today), or v1 in islands mode orbits again (T3).
- Known: the clawed frog's `dive_in` leap reads 3.67× under the layer (a 0.5 s leap with no `enter_water` clip, drawn
  as walk steps).

- L1's 202c `roostOf` home-ground bed (a roost off the animal's own ground, or too far to walk in a slot, becomes a
  seeded bed on its home ground, the same for every caller) **replaces decision 205's plan** for the roost jumps.
- Held: W1 `ark-wild-island-next` (W1b clearing v2's gates); T3's embed islands support (`public/ark/embed.html`
  ignores the islands today) comes next.

### Wirings and fixes the integrator made (allowed by the coordinator)

- `setLocoGround(drawnGround)` at the top of `mountArk` (L3's request to L1, `docs/ark/grounding.md`).
- L7's three (`docs/ark/chases.md`): `setRecipeColliders({segmentClear: collideSegmentClear, blocked: collideBlocked})`;
  `setChasePaces` from L1's `sprintPace`/`fleePace` (plan from the model library) and L2's `swimPaces(...).burst` (only for a
  species with a swim style) and `flightSpec(...).dive`; `!collideBlocked(x, z, 0.3)` in the meal's `chaseGround`.
- `setLocoGround` per island: on another island, a ground query from the island's own `heightAt` (the normal from its
  slope, 25 cm), never the wild island's drawn ground (07c3a64b).
- The visual CI on GitHub (decisions 134, 147): golden shots up to 150 min, hooks up to 90 min, Chromium with its headless
  shell for the hooks (the intelligence scenarios), the hooks artifact carries the town's own set.
- Not done: `GaitState.feet` into L3's `groundingCheck` is not a one-liner (a planted foot's height carries a sole offset
  and needs its own record kind): a known issue.
- Test-only: after L6 a7cee4a7, leaf/bark/branch 984/528/704 (> 835/450/600; decision 131's 990 failed at 984).
- Test-only: the attach floors at about 15% under the merged counts (true-size trees plus generator 7): tree points 3,583
  (> 3,000), leaf/bark/branch 1,164/618/824 (> 990/525/700), limbs 649 (> 550), forest limbs 342 on 45 trees (> 290 on
  > 38), hangs 370 (> 310); the attach test composes the renderer's matrix from `assetTreePlacement(item).y` (L6 sinks a
  tree's foot into its slope; this failed on L6's own head too, behind the floors); `Array.from(h.predators)` in
  `ark-hunting.test.ts` (the encounter lane carries the same).
- Not done: the duck sitter. It is not the nest spot: on the merged tree the mallard never takes the `incubate_sit` trip
  (on L7's own head the test passes); routed to L7 with the recipes file's timeout.

## Motion metrics (one CI summary)

Each lane's metrics join CI as they arrive; before is the live release (7764fe12), after is `ark-next`.

| Metric | Lane | Before | After | CI threshold |
|---|---|---|---|---|
| L1: planted-foot slide per step, walk (median mm, 20 golden species) | L1 | 19 | 0.05 | ≤ 2% of the leg (`ark-locomotion.test.ts`) |
| L1: slide, turning half round on the spot | L1 | 622 | 0.26 | ≤ 2% of the leg |
| L1: slide, a 15° slope over a ridge | L1 | 1,200 | 4.0 | ≤ 5% of the leg |
| L1: planted sole height, slope (median mm) | L1 | 80 | 1.2 | ≤ 2.5% of the leg |
| L2: wing-beat exponent against length (651 birds) | L2 | −0.598 | −0.975 | −1.1 to −0.8 |
| L2: bank error against tan φ = vω/g (rad) | L2 | 0.397 | 0 | ≤ 0.01 |
| L2: up-and-down swimmers breaking the surface | L2 | 35 of 39 | 0 | 0 |
| L2: upstroke span over downstroke (mallard / eagle) | L2 | 1 / 1 | 0.76 / 0.78 | ≤ 0.85 |
| L3: floating / sinking (real snapshot, near) | L3 | 145 / 280 | 0 / 0 | 0 (`ark-grounding.test.ts`, all species) |
| L3: inside scenery at rest (real snapshot) | L3 | 298 | 175 | ≤ 556 on the validator's population |
| L3: perched hidden in a crown (samples) | L3 | 412 | 0 | — |
| L4: species drawn more than 2× off their true length (the old curve, floor and cap) | L4 | 1,283 of 2,630 | 0: every species at its stored or data-gap length (humpback 3.5 → 14 m, ladybird 0.18 m → 7.5 mm) | `ark-stats.test.ts` |
| L4: overlapping pairs (real snapshot) / open ocean | L4 | 96 / 1 | 63 / 0 | — |
| L6: trees growing into each other | L6 | 971 | 0 | 0 (`ark-scenery.test.ts`) |
| L6: props floating / in each other | L6 | 284 / 14 | 0 / 0 | 0 |
| L5: pass-throughs and overlaps | L5 | — | — | the final L5 has not landed (API only) |

All of it runs as one table: `npx tsx scripts/ark-motion-ci.mts` (the visual CI's hooks job runs it too): 21 numbers and
the L1, L2 and L6 tests, all pass on `ark-next`.

Lanes put their measured numbers into the table with `recordMotionMetric(lane, id, value)` (`src/lib/ark-motion-metrics.ts`);
until they do, a test-file check shows pass/fail per metric test.

## Recordings index

Under `~/animaldex-ark-handover-2026-11-11/ark/motion/next/` (none yet).

## Open issues

- Fragile test (L6, for the map lane): stats "someone rare stands behind cover" depends on the snow leopard's mountain
  spot (it passes with scree solid from 0.30 and from 0.45 m).
- The town has no colliders yet: on another island the behaviour world is not built (`scheduleOn` is false), so L5's
  layer and L7's recipe colliders pass through. When T3 puts town animals on the schedule, the colliders must be the
  island's own.
- The harbour seal walks at about 2.5× its flipper-legs clip (0.21 units/s) at true-scale speed; cosmetic now that seals
  keep their baked clips (L1 a0d507a4).
- The backwards share: L1 found it is one zebra (`e9779d`) in a sleep-then-play bout, the same with the layer on and off;
  routed to the behaviour lane (`ark-behaviour-backwards`).

- Routed: L6's three tests (stags, snow leopard, pigs/zebras asleep); L1's backwards share (0.2% at the release, ~5%
  since L6/L3 in the default view; nothing backwards over 1 s); L7's duck sitter and the recipes test file's timeout.
- The visual CI now runs on GitHub Actions (decision 134): `gh workflow run ark-visual.yml --ref ark-next`. Its first run
  is the first Linux render of the baselines (they were all made on the Mac).
- The shared Mac ran at load 80–137 on 16 cores during merges 2–3: SwiftShader shots took 2–20 min each (normally ~2).
- L1 (observation, for the lane): with no driver taking an animal, `LocoLayer.pose` still runs `plantClipFeet` for grounded
  clip feet, so "no driver" is not byte-for-byte the baked pose (within the visual tolerances so far). The driver's share
  ramps by frame `dt`, which is 0 with reduced motion and in the frozen-clock golden shots.

## Web deploy: decision 264's round (SEO, the landing page, the minimal /ark, the town's look)

From landing main 970b0461 (live). Head: see the last row; rollback: redeploy **970b0461**.

| # | Lane | Branch head | `ark-next` head | Notes |
|---|---|---|---|---|
| 48 | S3: SEO pages and technical fixes | `seo-pages` de6f815f | d2e72e51 | clean |
| 49 | Two keys in the 43 Ark bundles | `seo-ark-i18n` 07f453cb | 408cc350 | clean |
| 50 | S2: the landing page | `landing-redesign` 8b4808c3 | 577ef598 | clean |
| 51 | U1: full-screen /ark, minimal overlay, performance (with U2's card activity) | `ark-hud-minimal` af26ba4d | b63a19fe | clean |
| 52 | U2's keys in 44 languages | `ark-card-i18n` 08a0b340 | 9a98a11c | clean |
| 53 | GA: the town's ground, streets and night light | `town-ground` e0fa6b62 | ff8f6b9e | clean |
| 54 | TB: aquarium, pets, grounding, resting figures, jellyfish size | `town-bugs` 0cc0b50a, aba53bd2 | c5b8efa5, 61d92813~ | the town doc (GA §11, TB §12) and the town prebuild digests resolved to the merged tree's values |
| 55 | U1's 8 `ark.hud.*` keys | `ark-hud-i18n` e53dd177 | 61d92813 | clears the 45 locale failures |
| 56 | T3: the selection kept when the town joins | `ark-keep-selection` ffd115de | 3612966f + 3c8fe38a (`Array.from` in its test, TS2802) | |
| 57 | GC: trees, hedges, canal, farm, zoo barriers, heap releases | `town-nature` cb62a642 | 64f40fde | digests: GC's, with TB's places |
| 58 | GB: cars, parking, moving traffic, facades, windows, shopfronts | `town-built` 6e0c9277 | 2874e112 | combined with GC in `render/index.ts` and `entry.ts` (vehicles replace the old car set; narrowboats and library trees kept; `townWeather` then `patchBuildingSurfaces`); GB's section numbered 14; merged digests |
| 59 | GB's review fix: surface markers can't misread a plain colour | `town-built-review` 68bf07d4 | 11901a6a | `sceneryAndBuildings` ba0d2904 |
| 60 | L5: the collision audit takes `--world`; CI audits islands v2 (live), islands v1 (rollback) and today's mode | `ark-collide-limits2` 88731319 | 640b0062 | collisions workflow green in all three modes (run 43279200835) |
| — | The town set's Linux baselines | — | b9200c87 | all 4 town shots changed by design, looked at |

Visual (run 43276477553 on 11901a6a): the 19 golden shots are unchanged (at most 0.06% against 9cbc3871, no page errors), so
their baselines stay; the town's 4 re-accepted. /ark's layout and the landing page are not in the golden set.

Gates on 2874e112: suite 2,494/2,496, 0 fail (the quoted glob); tsc 0; lint 0; motion all pass; default view ×2 pace
1.01 / 0.99, backwards 1.6% / 1.5% (a capybara 1.9 s, a clawed frog 2.9 s, a zebra 1.9 s), turns 1.1 / 1.4 a minute, no
page errors. On 11901a6a: tsc 0, town tests 43/43. Production heap, the low phone profile, islands on, the real
snapshot, everything merged (2874e112): heap 214–286 MB, peak 265–300 MB against the 384 MB budget; 46.6 / 57.8 fps (run 0
had 80 long tasks after the first frame on a loaded Mac, run 1 had 10; the longest after the first frame 189–220 ms).

Deploy checks:
- Done (the coordinator, before the deploy): the live web container has `SUPABASE_SERVICE_ROLE_KEY` set (the food links;
  the variable names checked, not their values).
- After the deploy: `cf-cache-status: HIT` on `/api/ark/landing/snapshot.bin`; `/ark/assets/town-v1/vehicles.bin`
  served (306 KB).

## Web deploy: decision 285's round (waterbirds, rock tops, select aim, the lake ghost; without MA1)

Branch `ark-round-283`, from landing main d8ee89f0 (live). Head: see the push below; rollback: redeploy **d8ee89f0**.
Lane MA1 (`ark-flight-physics`) is left out: its flyers (462), circling (8.1%) and turns (2.04) are regressions it
fixes on its own branch and brings to the next round, built on `ark-next` 135282f6 / af4ef02b. Nothing of MA1's is
here (7c266935 and a8726780 are not ancestors; rock-tops takes its own `index.ts` lines, no `airStage`).

| # | Lane | Branch head | `ark-round-283` head | Notes |
|---|---|---|---|---|
| 61 | MA3: waterbirds (fly water to water, come ashore by swimming; town walk-first birds off the roads) | `ark-waterbirds` 852147e2 | 765e3568 | clean; carries its amphibian limit 420 -> 375 with why |
| 62 | Rock tops: an animal on a raised schedule spot is drawn on it, never sunk into the rock | `ark-v2-rock-tops` 18b19422 | 0843651f | clean |
| 63 | Select aim: `ark:select` and a row tap fly to where the animal is drawn now | `ark-select-aim` b0e8ae3e | 79c8f959 | clean |
| 64 | MA3: the v2 lake's teal ghost (the high tier's ambient occlusion) | `ark-lake-ghost` a91bc845 | e2386114 | clean |
| — | The behaviour audit keeps its folder (`include-hidden-files: true`; `.ark-audit` starts with a dot) | — | dfd83278 | the artifact now uploads (run 43316302402) |
| — | Audit limits: circling 1 -> 2.8, never move 800 -> 840, each with why | — | 12f893b8 | main already 2.2 (all swifts and swallows) and 819; MA3 adds 0.6 circling |

Gates on dfd83278: suite 2,506/2,508, 0 fail, 2 skipped (the quoted glob); tsc 0; lint 0; motion all pass (42 numbers);
default view ×2 pace 0.99 / 1.11, backwards 1.9% / 2.5% (none over 1 s), ground turns 0.4 / 0.5 a minute, no page
errors (over 1.5: the harbor seal's baked run hauling out and slipping in, 2.5–2.8; an alligator's walk 1.54 in one run).

Behaviour audit (run 43316302402 on dfd83278; the limits above on 12f893b8 pass all 23): flyers 615 (≥ 580), circling
2.8%, turns 0.75 a minute (≤ 0.85), never move 828, amphibians 384 (≥ 375), snapped 0, heads 99.4%, predators within
5 m 122, prey react 96.7% / flee 69.7% near the camera; encounters react 62.1%, close flee 58.9%, median 0.1 s. These
are MA3's own numbers (ark-waterbirds alone: 615 / 2.8 / 0.75 / 828 / 384).

Collisions (run 43316309748 on dfd83278), green in all three modes: islands v2 0 / 0 / 8 / 1,030,088; islands v1
(rollback) 0 / 0 / 208 / 3,139,948; today's mode 0 / 0 / 217 / 2,951,413 (pass-throughs / fence crossings / cliffs /
overlaps).

Visual (accept run 43316317093 on dfd83278, hooks job green): all 19 golden shots within the limits against main's
baselines (at most 0.26%: the river pond, its waterbirds placed differently; the two high-tier shots 0.03% and
0.08%), looked at, no page errors, so the baselines stay. The v2 lake is not in the golden set.

Production heap, the low phone profile, islands on, the real snapshot read in place (dfd83278): heap 256.5–282.2 MB,
peak 257.8–282.1 MB against the 384 MB budget; 52 / 57.4 fps (a loaded Mac).

Deploy checks after the deploy: on /ark (v2), no animal inside a boulder where it basks (the komodo); no teal duplicate
beside a bird on the lake on a high-tier device; tapping an animal in the list flies the camera to it.

## Web deploy: decision 287's round (MA1's flight physics 2, the audit's check step, MA2's v3 rigs)

Branch `ark-round-287`, from landing main 486cb701 (live). Rollback: redeploy **486cb701**. The rig set moves v2 → v3
(`ARK_RIG_VERSION = "v3"`, decision 289: `ark-rig/v3` uploaded, 2,034 rig files, manifest version 3, flight on); the
undo for the rigs alone is a build with `ARK_RIG_VERSION = "v2"` (the v2 set stays in the bucket).

| # | Lane | Branch head | `ark-round-287` head | Notes |
|---|---|---|---|---|
| 65 | MA1: flight physics 2 (birds back in the air at their true speed; the hawkers counted apart) | `ark-flight-physics-2` 254c1ef9 | 744d5ece | thresholds: MA1's split kept (circling ≤ 1 and turns ≤ 0.85 on all but the `aerial_hawk` hawkers, the hawkers' own ≤ 40% / ≤ 8.5), main's never-move 840 kept with its reason, main's all-flyers circling 2.8 dropped (the split replaces it); MA1's collision limits (+0.06% / +0.44% / +0.30% overlaps) with its why |
| — | The audit's "Against the thresholds" step fails when a check is worse (`set -o pipefail` before `\| tee`) | — | 352cf903 | under `bash -e` the step took tee's exit: a worse never-move (828 against 800) exited 0 before, 1 after; green on the real run 43337721948 |
| 66 | MA2: the v3 rigs (the birds re-rigged, rig code v7) | `ark-rigs-v3` a0906006 | 4474ab0f | clean |

Gates on 352cf903: suite 2,518/2,520, 0 fail (the quoted glob); tsc 0; lint 0; motion all pass (43 numbers); default
view ×2 pace 1.02 / 1.05, backwards 0.7% / 0.1% (none over 1 s), no page errors.

Behaviour audit (run 43337721948 on 352cf903; models off, so the rigs do not change it): flyers 682 (≥ 580); all but
the hawkers circling 0% (≤ 1), turns 0.67 a minute (≤ 0.85); the hawkers 36% (≤ 40), 7.77 (≤ 8.5); never move 832
(≤ 840); amphibians 419 (≥ 375); snapped 0; heads 99.7%; predators within 5 m 129; near the camera prey react 96.2% /
flee 68%; encounters react 62.1%, close flee 58.9%, median 0.1 s. All 25 pass, and the step is green.

Collisions (run 43337725661 on 352cf903, models off), green at the merged limits with no re-baseline: islands v2
0 / 0 / 0 / 1,030,332; islands v1 0 / 0 / 208 / 3,159,352; today's mode 0 / 0 / 217 / 2,956,755.

Visual (accept run 43337730880 on 352cf903): all 19 golden shots within the limits against main's baselines (at most
0.31%, the river pond; more birds in the air), looked at, no page errors; the baselines stay.

On 4474ab0f (the v3 rigs): suite 2,518/2,520, 0 fail; tsc 0; lint 0; motion all pass. Default view ×2 pace 0.89 /
1.07, backwards 1.8% (an alligator 1.3 s) / 1.4%, no page errors. Every `/ark-rig/` request logged: the page reads
`ark-rig/v3/manifest.json` and takes every rig file from v3 (11 a run, all 200); the v1 manifest is read only as the
fallback list (as on v2), and no v1 rig file is fetched. The flight scene's mallard plays idle → takeoff → flap → glide
→ land → walk → graze on its v3 rig, no page errors.

Visual (accept run 43345256555 on 4474ab0f, hooks job green): all 19 golden shots within the limits (at most 0.26%
against main's baselines, at most 0.07% against 352cf903: the birds by the pond and the house on their v3 rigs), looked
at, no page errors; the baselines stay.

Production heap (decision 292: the budget is the post-GC heap at the first frame after the prebuild and in steady
play; the low phone profile, islands, the v2 world, the prebuild, the real snapshot read in place; 2 runs each, the
other lanes' jobs still running, load average 5–14):

| | First frame (post-GC) | Steady, ~130 s (post-GC) | 30 s later (post-GC) | Pre-GC peak (information) |
|---|---|---|---|---|
| main 486cb701 (live) | 195.5 / 195.4 MB | 262.9 / 267.6 MB | – | 330 / 396 MB |
| 4474ab0f (this round) | 193.4 / 195.2 MB | 262.8 / 267.6 MB | 262.9 MB (+0.4 MB retained, compiled code) | 317 / 409 MB |

Both points well under the 384 MB budget and the same as live. Heap snapshots 30 s apart in steady play retain no
growth on either (main 275.6 → 276.1 → 275.5 MB post-GC over 100 s): the pre-GC climb to 400–450 MB on a busy Mac is
headless Chrome putting off its major GC, not a leak. The measure page's own "in view" never completes on v2 (the
runtime's `viewComplete`), so its "in view" times read null there.

### The heap gate measured v1 (decision 287)

The measure page (`src/ark-scene/runtime/measure-entry.ts`) mounts `mountArk` directly, not through
`mountArchipelago`, so `--islands` alone never switched to the v2 wild island (only `?world=v2` does): every
heap gate since the v2 release measured the v1 island with the town (about 150 models, 10–25 chunks), not what is
live (v2 and the prebuild: about 80 models). The integrator's gate now runs `--islands --world v2 --prebuild`, 90 s,
and (decision 292) judges the budget on the post-GC heap at the first frame and in steady play. Routed: the harness's
`--islands` default to v2 (`measure-entry.ts`).

## Web deploy: decision 295's round (MA1 flight 3, MA3 water 2, MA4 motion, small fixes, town night, card truth)

Branch `ark-round-295`, from landing main 75e32ce1. Released as landing main 02109ea0 (decision 295; image build
43386830135). Rollback: redeploy **75e32ce1**.

| # | Lane | Branch head | `ark-round-295` head | Notes |
|---|---|---|---|---|
| 67 | MA1: flight 3 (the canopy in the flight floor, a smoothed soar altitude) | `ark-flight-3` 51e288dd | 4cca7caa | clean |
| 68 | MA3: water 2 (geese, the afloat test, rings on water, wetland ducks, goal room, swim speed, cranes) | `ark-water-2` 475908c9 | de15361a | clean; `behaviour-schedule.ts` merged on its own with MA1 (air legs and swim targets in different hunks) |
| 69 | MA4: head-bob by family, the seal galumph, frog and toad saltation, bird ground gaits, the motion CI groups, rig-coverage fixtures | `ark-motion-ma4` 79fd0b9b | 9bec77b5 | clean |
| — | Rig coverage per rig set (decision 296) | — | 051b14d3, daa17341 | the test's limits keyed by the fixture's version (v2 18 / 7 / 12 / 70 / 108; v3 1 / 0 / 0 / 70 / 109, the red-necked phalarope new in v3, its water clips queued); `ARK_RIG_VERSION as string` (TS2367); the motion CI rows at v3's counts |
| 70 | Small fixes: the measure harness on the live v2 world (`--gc-points`, `--production`, v2 in-view times); icons (`noIcon` beside `/api/ark/voyage`) | `ark-small-fixes` 39905499 | b4584e07 | clean |
| 71 | The owner's report: no light streaks across the town at night; wet grass and crops not mirror-shiny | `town-night-streaks` ba53e122 | 846208c2 | clean; the town's `homes_night` Linux baseline 515c7e45 (looked at: the streaks gone) |
| 72 | The owner's reports: card truth (decision 301: the stalk wording, the fed and energy bars from the schedule, no next-hunt chip, the condition chip only when not well-fed; 6 keys × 45 locales, `nextHunt` removed) | `ark-card-truth` d7947d69 | fd3a8468 | clean, no locale conflicts |
| 73 | MA3: a fly-away fits a flight worth its take-off and landing (MA1's `flightWorth`), else a round; swim-first birds fly it only as often as they fly | `ark-water-2` fc162bb6 | 02109ea0 | MA4's time budget 23 → 18 (≤ 20): the black-necked swan's and the buffy fish owl's slow flights (MA3's 475908c9 had taken it from 20 to 23) |

Gates on 02109ea0: suite 2,541/2,543, 0 fail (the quoted glob); tsc 0; lint 0; motion all pass (103 numbers: the time
budget 18 under 0.35 of cruise, median 0.851, p10 0.452); default view pace 1.05, backwards 1.5% (a house sparrow
1.1 s), ground turns 0.7 a minute, no page errors.

Behaviour audit (run 43379606438): flyers 690; all but the hawkers circling 0%, turns 0.69 a minute; the hawkers 36% /
7.77; never move 828; amphibians 428; snapped 0; heads 97.5%; near the camera prey react 97.5% / flee 71.8%;
encounters react 62.1%, close flee 58.9%, median 0.1 s. All 25 pass; the spawn validator and the check step green.

Collisions (run 43379611712), green at the existing limits: islands v2 0 / 0 / 0 / 1,001,703; islands v1
0 / 0 / 209 / 3,147,072; today's mode 0 / 0 / 218 / 2,956,737.

Visual (accept run 43379615520): all 19 golden shots within the limits (at most 0.26%, the river pond's waterbirds),
looked at, no page errors, so the baselines stay; the hooks job green (motion all pass; the town set's four shots pass,
`homes_night` against its new baseline).

Production heap with the harness (decision 292 as corrected with 5736e007: `--islands --prebuild --production
--gc-points`, 90 s, the low phone profile, world v2, the real snapshot read in place), on 846208c2 (the card truth and
MA3's fly-away commits came after; neither was asked to re-measure):

| | After GC, the first drawn frame | After GC, steady (80 s) | Pre-GC peak (information) | fps |
|---|---|---|---|---|
| 846208c2 (this round) | 262.4 / 262.3 MB | 264.5 / 264.5 MB | 338 / 309 MB | 59.4 |
| 39905499 (live 75e32ce1 + the harness) | 262.0 / 261.6 MB | 266.9 / 262.9 MB | 330 / 319 MB | 58.9 / 59.2 |

Both points under the 384 MB budget and the same as live. (heap-snap.mjs's earlier "first frame" of about 195 MB
fired during the shader warm-up: a mount reading.)
