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
