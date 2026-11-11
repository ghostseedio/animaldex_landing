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
| 2 | L1 locomotion (interface + the live pose layer: `locomotion/`, `ARK_RIG_LIVE`, `rigLivePose` after `matrix.compose`) | `ark-locomotion` fc694a84 | 0e5e526e | tests 2,260/2,260; tsc clean; lint 0; visual CI: running (9/19 pass so far, worst changed 0.73%) |
| — | Integrator: the motion CI summary (`scripts/ark-motion-ci.mts`, `tests/ark-motion/metrics.json`, `src/lib/ark-motion-metrics.ts`, a visual-CI hook) | — | 851c56fd, 6a723ada, 73e1a747 | — |
| 3 | L2 flight, swim, legless (midpoint; includes L1 fc694a84) | `ark-flight-swim` 3cb18604 | 7f2108dd | tests 2,279/2,279 (L2's 18 in); tsc clean; lint 0; default view ×2: pace ratio median 0.93 / 0.99, backwards 0.2% / 0.2% (none over 1 s), ground turns median 0.2 / 0.0 a minute, bullfrog 2.35× / 3.12× (release 2.2×); motion summary 13/13; visual CI: queued behind merge 2's (flyer and swimmer shots change on purpose) |

## Motion metrics (one CI summary)

Each lane's metrics join CI as they arrive; before is the live release (7764fe12), after is `ark-next`.

| Metric | Lane | Before | After | CI threshold |
|---|---|---|---|---|
| L2 tests (`ark-motion-l2`, `-l2-drivers`): wing-beat by size, beat cap, stroke shape, coordinated bank, tail beat by speed, surface guard, no-slip undulation; rigs: upstroke flex, level head in a bank, insect wings, snake chain slip, sidewinder lift and fluke beat | L2 | — | 18/18 pass | `src/lib/ark-motion-l2-thresholds.ts` |

Lanes put their measured numbers into the table with `recordMotionMetric(lane, id, value)` (`src/lib/ark-motion-metrics.ts`);
until they do, a test-file check shows pass/fail per metric test.

## Recordings index

Under `~/animaldex-ark-handover-2026-11-11/ark/motion/next/` (none yet).

## Open issues

- The shared Mac ran at load 80–137 on 16 cores during merges 2–3: SwiftShader shots took 2–20 min each (normally ~2).
- L1 (observation, for the lane): with no driver taking an animal, `LocoLayer.pose` still runs `plantClipFeet` for grounded
  clip feet, so "no driver" is not byte-for-byte the baked pose (within the visual tolerances so far). The driver's share
  ramps by frame `dt`, which is 0 with reduced motion and in the frozen-clock golden shots.
