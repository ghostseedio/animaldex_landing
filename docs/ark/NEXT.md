# Ark motion 100x pass: integration (`ark-next`)

The running integration doc for landing branch `ark-next` (integrator lane). The owner's brief and the lane contract are in the
handover folder: `ark/queued/motion-100x-brief.md`, `ark/queued/motion-100x-contract.md`; decisions in AnimalDex
`docs/ark/DECISIONS.md` (29 onwards). `ark-next` started from landing `origin/main` 7764fe12 (the live release 1323a70d plus
the privacy text).

## Gates (every merge)

| Gate | Command | Pass |
|---|---|---|
| Unit and integration tests | `npm test` | all pass |
| Types | `npx tsc --noEmit -p tsconfig.json` | only the two known `header-menu.tsx` svg errors |
| Lint | `npm run lint` | exit 0 (the known `<img>` warnings) |
| Map spawn validator | `npx tsx --test src/lib/ark-map.test.ts` | 0 failures |
| Visual CI | `nice -n 10 npx tsx scripts/ark-visual.mts` | 19/19; a new baseline only after two identical renders and a look |
| Default view | `nice -n 10 node scripts/ark-rig-scenes.mjs --island --seconds 60 --out <dir>` | pace ratio median ~1, backwards share low, ground turns low |

## Merges

| # | Lane | Branch head | `ark-next` head | Gates |
|---|---|---|---|---|
| 1 | L5 collisions (API surface: `collide/`, `ark-collide-bodies.mts`, `behaviourHomePlots()`) | `ark-collisions` 39adcbd8 | 521c3de4 | tests 2,260/2,260 (validator 0 failures); tsc: the 2 known; lint 0. Nothing imports `collide/` yet, so the picture and the default view are main's (visual CI and the default view run on merge 2) |

## Motion metrics (one CI summary)

Each lane's metrics join CI as they arrive; before is the live release (7764fe12), after is `ark-next`.

| Metric | Lane | Before | After | CI threshold |
|---|---|---|---|---|

## Recordings index

Under `~/animaldex-ark-handover-2026-11-11/ark/motion/next/` (none yet).

## Open issues
