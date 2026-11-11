# Ark visual CI

The golden shots (`docs/ark/graphics-step1.md`) as a regression check: a set of them is rendered on every pull request that touches the Ark and compared with committed baselines, within tolerances. Workflow `.github/workflows/ark-visual.yml`; script `scripts/ark-visual.mts`; set, tolerances and baselines in `tests/ark-visual/`.

## What runs

1. **Golden shots** (job `visual`): `npx tsx scripts/ark-visual.mts`.
   - The golden-shot page itself (`src/ark-scene/golden-entry.ts`: the v2 fixture, every model preloaded, `recording: true`, calm weather at mean tide pinned), so the shots are the graphics lane's, by name.
   - WebGL on **SwiftShader** (software rendering), on the Mac and in CI alike: a GPU renders differently from another GPU, but SwiftShader is the same code everywhere, so a baseline taken on one machine holds on another (with the same Chromium build, the one `playwright-core` pins).
   - The **clock is frozen** per shot: `performance.now` and `Date.now` are the harness's; after a shot is framed, the clock is set to that shot's own fixed time and a few frames are drawn at it. Water, grass, clouds, light and the animals' schedules are then the same every run. What still differs between runs (an animal that loops on its own, a model that came in a frame later) stays inside the tolerances.
   - The set (`tests/ark-visual/config.json`): 13 desktop shots at 960×600 on the high tier (the seven places in day light, the house at dusk, the island at night, the four close-ups) and 4 phone shots at 360×800 on the medium tier. Smaller than the full golden run so it stays inside CI time on SwiftShader.
2. **Hooks** (job `hooks`): `npx tsx scripts/ark-visual.mts hooks` runs the other lanes' checks listed in `tests/ark-visual/hooks.json`, each only once every file it `requires` exists. Today: the map's spawn validator (`src/lib/ark-map.test.ts`, lane ark-map), the intelligence scenarios (`scripts/ark-intelligence-scenarios.mjs`, lane ark-intelligence-web) and the behaviour audit's checks (`src/lib/ark-audit.test.ts`, lane ark-audit). A lane adds or changes its own entry; nothing else needs touching. A hook fails the job when its command exits non-zero.

The models are read from the public model bucket (read only), as the site reads them. A change in the bucket (a new model set) changes the shots too: accept new baselines with it.

## Tolerances

Per shot, three measures against its baseline (`src/ark-scene/runtime/visual-compare.ts`):

| Measure | Default | Catches |
|---|---|---|
| `changed`: share of pixels whose largest channel difference passes `pixel` (24/255) | 1.2 % | a broad change (the light, the water, a material) |
| `mean`: mean absolute difference, 0–255 | 2.5 | a subtle change everywhere (a grade, fog, exposure) |
| `block`: the worst of 16 × 16 tiles' changed share | 35 % | a local break (a missing house, a black shard, a hole in the ground) |

A shot fails when any measure passes its tolerance. Defaults are in `config.json` → `tolerance`; one shot can have its own in `overrides`, by id (`desktop-reef_underwater-day`), when its own noise needs it. The run writes, in `.ark-golden/visual/` (the CI artifact `ark-visual`):

- `report.md` / `report.json`: every shot's measures and result (also the job summary in CI);
- `actual/<id>.webp`: this run's pictures, in the baseline's format;
- `diff/<id>.png`: for a failed shot, its picture greyed with the changed pixels in magenta.

## Accepting new baselines

A change that is meant to change the picture (a graphics batch, a new model set) fails the check until its baselines are accepted, in the same pull request:

1. **From CI** (the usual way, so the baselines come from the same Linux SwiftShader that checks them): download the run's `ark-visual` artifact, look at `diff/` and `actual/`, then
   ```
   npx tsx scripts/ark-visual.mts accept --from <the unzipped artifact> [--only desktop-island_far-day,...]
   git add tests/ark-visual/baselines && git commit
   ```
   Running the workflow by hand (Actions → Ark visual check → Run workflow, `accept` on) renders straight into `actual/` without comparing, for a set with no baselines yet.
2. **Locally** (a Mac; SwiftShader as in CI): `npx tsx scripts/ark-visual.mts --update [--only ...]` renders and writes the baselines directly. Look at them before committing.

Baselines are near-lossless WebP (every pixel within a few levels of the render), ~150–400 KB each.

A new shot: add it to `config.json` → `shots`, then accept its baseline (a shot with no baseline reports `new` and does not fail).

## Running it

- Whole set: `npx tsx scripts/ark-visual.mts` (about a minute per shot on SwiftShader on a loaded machine).
- A few: `--only desktop-coast_rocks-day,phone-house_fields-day`; one device: `--devices phone`.
- On the GPU for a quick look (not comparable with the baselines): `--gpu metal`.
- The shared Mac: one browser run at a time, under `nice -n 10`.
