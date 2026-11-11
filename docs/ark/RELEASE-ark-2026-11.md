# Ark release, November 2026 (DRAFT, kept up to date as rounds land)

Handover §6.3. **Nothing in this document is deployed.** Every server, bucket, web and app step below waits for the
owner's approval of this release as a whole. Exception already approved: the rig `v2` upload, once its checks pass.

- **Web release branch:** landing `ark-release`. Its head is in §1; it is merged round by round (m1–m4 so far).
- **Live today:** web landing main `76a4f5d1` (rollback sha `b0e6c20c463911969725fa001170e6add313483b`); server
  migrations up to `20261113160000` plus `20261111140000/160000/170000` and `20261110130000_web_ark_events`; functions
  voyage-world v1, dispatch-ark-digest-push v1, delete-account v64, generate-applied-insight v143; bucket
  `talking-models/ark-rig/v1/` (1,971 rigs, inert until a web build reads them).

## 1. What is included

### Web (landing `ark-release`, round m4: 877ae2c5 and on)
Each lane's branch head as merged. "Pending" heads have newer work not yet in the release.

| Lane | Branch | Merged head | What it brings |
|---|---|---|---|
| Graphics (terrain, water, sky) | `ark-graphics` | fd3cb1ac | Batches 1–6: sculpted terrain and range, sky and moon, underwater light and shafts, near fade, tree and conifer lighting, asset rocks, wheat and crop fields, forest floor and litter, still lake and river, warm sand, close-range bark, the ground for the prebuild worker |
| Assets | `ark-assets` | 2d31d846 (via graphics) | Trees (33 variants), plants (76), rocks (21), forest floor (13): all generated in-repo, CC0 |
| Reef | `ark-graphics-reef` | 84226995 | Corals, sponges, anemones, kelp, seagrass, 15 ambient fish schools that split round hunters |
| Attach points | `ark-graphics-attach` | b97ef1d7 | Attach points on the drawn trees, rocks, ledges, hollows, eaves, limbs, fence posts; `snow.ts`; sliced `prepareAttachPoints`; true-size close-up cameras |
| Map | `ark-map` | a7b33484 | B3/B4 placement for every type, the spawn validator, grips, partners on hosts, the hamlet (home plots, residents, indoor/outdoor rotation) |
| Props | `ark-props` | 5774c2b1 | Nests by species (growing), homes, area details, home layout, fence posts, per-plot yards and gardens, the coop, hamlet buildings per plot, thinned crops under reserved plots |
| Behaviour | `ark-behaviour` | 5f985348 | The shared schedule: goals, grazing beats, land↔water crossings, predator spacing (≥ 20 m), wariness by sight, variety, shore haul-outs, no teleports, resting at roost, hamlet plots in the walk grid |
| Behaviour recipes | `ark-behaviour-recipes` | d1568d42 | 71 blocks, recipes for 2,555 species (fishing birds, contests, nest building, murmurations, digging, swarms, mixed flocks, molehills, bats hanging and their dusk emergence), seeded sex and the duller sex, sitters on nests, coats from wallows |
| Intelligence | `ark-intelligence-web` | 859b854d | The local reactive layer near the camera: head look, perception, fleeing, camera habituation, storm alarms |
| Rig player | `ark-rig-publish` | 918e0384 | The v2 rig set first with the v1 fallback, flight gated by the manifest, flight/look/beat/recipe clips, head look on the rig's bones |
| Sea depth | `ark-sea-depth` | 8e859a65 | Depth bands for 449 water species, breathing |
| Animal look | `ark-animal-look` | fea457ce | Fur, feathers, scales, eyes, wet and dust, contact shadows, close-up skins (when uploaded) |
| Liveliness wiring | `ark-liveliness-wiring` | 39d22ccb | WebAudio engine (tap only), weather visuals (rain, fog, lightning), sheltering, young, tide, per-instance variation, traces |
| Ambient sound | `ark-ambient` | e0f92416 | 13 beds and 2 thunder claps (public domain and CC0) |
| Runtime | `ark-runtime-web` | 0da735b6 | Live budget (`arkOutside`, resting first, rule E zone capacity), shared clock, worker prebuild (scenery, places, ground), visibility/idle/power, memory, camera, visual CI |
| Founders (web) | `ark-founders-web` | 97fe9811 | Named founders, stories, the one-tap 18+ confirmation |
| Release fixes | `ark-release` | — | Water animals in their depth band under the schedule (`schedule-water.ts`); grass press; attribute renames (`arkCoat`, `lookChain`); shader-compose test; tree-attach regenerated; the recipes' nest and fish wiring |

Not yet in the release: `ark-thrive-web` (captures + thrive, Deliverable 2), `ark-scale-test`, `ark-home-growth` (the bigger home
district), newer rig-publish. The behaviour audit harness (`ark-audit`) is merged with its CI job (§9).

### Server (AnimalDex, not applied)
| Branch | Head | What |
|---|---|---|
| `ark-founders-server` | 041af963 | Migration `20261114100000_voyage_founders`, function `voyage-founder-story` |
| `ark-captures-thrive` | a002fd2a | Captures bring animals aboard, steps make them thrive: module, `voyage-world` routing, migrations `20261115100000`–`160000` (owner-approved design, D1–D12) |
| `ark-aware-chat` | 55eb1114 | **Held** (owner decisions open): migration `20261114130000`, chat changes behind `ark_kin_activity` |
| `ark-rigging` | dc7d9182 | Rig v5 tooling; the v2 set is produced from it (§5) |
| `ark-closeup-textures` | a501b005 | Close-up skin tooling (the 678 MiB set is built locally) |

### Apps (3.3, not submitted)
| App | Branches | Notes |
|---|---|---|
| iOS (AnimalDex repo) | `ark-founders-ios` b906ab9a, `ark-thrive-ios` 764fc681, `ark-runtime-ios` (runtime bridge, in progress) | main `3bf8a4be` already has 3.3 with the Ark panel behind `ark_panel` |
| Android | `ark-founders-android` 5425029, `ark-thrive-android` 31075a3, `ark-runtime-android` (in progress) | main `799b928` has 3.3.0 (27) |

## 2. Flags and their defaults
Server flags live in `voyage_config` (flip with the SQL in AnimalDex `docs/ark/DEPLOY-CHECKLIST.md` §G). Every new flag
ships OFF; while off, every read answers exactly as today.

| Flag | Default | Where | What |
|---|---|---|---|
| `realm_filter` | on (live) | server | Predators eat only prey sharing a realm |
| `tick_enabled` | off (live) | server | The hourly world tick |
| `chat_mention` | off (live) | server | An animal that ate may mention it once |
| `public_story` | off (live) | server | Public debate stories |
| `ark_digest`, `small_steps`, `intelligence_style` | off (live) | server | 3.3 digest push, small steps, chat intelligence style |
| `founder_names` | off (new) | server, founders migration | Founders named (18+ confirmed); off = "Voyager N" everywhere |
| `capture_arrivals` | off (new) | server, captures+thrive | The processor takes capture rows only when on |
| `thrive` | absent = off (new) | server, captures+thrive | The condition rules (JSON config row) |
| `ark_score_v3` | off (new) | server, captures+thrive | Which Ark Score the reads return |
| `ark_kin_activity` | off (held) | server, ark-aware chat | Ark-aware chat; not shipped in this release |
| `ark_panel` | no row = off | apps | The 3.3 Ark panel |
| Rig set | v2 then v1 | web (`rig-clips.ts`) | The web asks `ark-rig/v2/manifest.json` first (404 until the upload), then v1 per species |
| Close-up skins | on, when present | web (`closeUpBase`) | Read beside the model set (`…/v1/ark-closeup`); 404 until uploaded, then the near models only |
| Live budget | on | web (`arkOutside`, runtime) | How many animals are live per tier; the rest rest out of sight |

Development-only switches (never in production): `?fixture=`, `?feed=1` (the live HUD's made-up feed), `?models=local`, `?rigv=`, `__arkDebug`, `__arkGoldenCamera`. The embed's live HUD is opt-in: `?hud=1|log|bars` (`docs/ark/live-hud.md`).

## 3. Server migrations, in order (owner runs; never `db push`)
Each with `supabase/scripts/db-migrate.sh rehearse <version>` first (chained rehearsal builders under
`supabase/scripts/*-rehearsal/build.py`), then `apply <version>`. Rollbacks are in `supabase/rollbacks/`.

| # | Version | Branch | What | Rollback |
|---|---|---|---|---|
| 1 | `20261114100000_voyage_founders` | ark-founders-server | Founder names and stories behind `founder_names` | Prefer switching the flag off (hides all names and stories, loses nothing). The migration's rollback DROPS stories and choices |
| — | function `voyage-founder-story` | ark-founders-server | `supabase functions deploy voyage-founder-story --use-api`; 403 while the flag is off | Previous version / delete |
| 2 | function `voyage-world` (thrive-aware) | ark-captures-thrive | Deploy before the migrations; inert while `thrive` is absent | The previous version number |
| 3 | `20261115100000_voyage_capture_source` | ark-captures-thrive | Outbox `id`/`source`/`capture_id`; functions re-created against them | Refuses while capture rows exist; else restores `step_id` PK and the old bodies |
| 4 | `20261115110000_voyage_area_model` | ark-captures-thrive | `voyage_animals.area`, `ark_model_published_at`, `voyage_mark_ark_models_v1` | Drop columns and function |
| 5 | `20261115120000_voyage_capture_qualifies` | ark-captures-thrive | Qualifies predicate, `voyage_apply_capture_arrival`, `voyage_capture_state_v1` (no triggers) | Drop the functions |
| 6 | `20261115130000_voyage_thrive_schema` | ark-captures-thrive | Conditions, step points, world load and commit | Previous bodies verbatim; drop tables (refuse with rows unless forced) |
| 7 | `20261115140000_voyage_thrive_reads` | ark-captures-thrive | `thrive`, `lineage` on the public reads | Previous read bodies |
| 8 | `20261115150000_voyage_backfill_captures` | ark-captures-thrive | The bounded backfill (×7, 500 each), only with the web release that has the live budget and chunked mount | By `backfill_run` |
| 9 | flags: `thrive` on | — | After the backfill | Flip off |
| 10 | `20261115160000_voyage_capture_triggers` | ark-captures-thrive | **The switch**: the capture triggers, last, with the owner | Drop both triggers (queued rows stay harmless) |
| — | `20261114130000_voyage_ark_kin_activity` | ark-aware-chat | **Held** (owner decisions) | — |
| — | Ark Score v3 migration | ark-captures-thrive | After the score review; not written yet | — |

## 4. Web deploy (owner, on the VM)
1. Merge `ark-release` into landing `main` (only after approval).
2. Build the image: `gh workflow run build-selfhost-image.yml --ref main` (about 20 min).
3. On the VM:
   ```
   gcloud compute ssh animaldex-production --zone asia-northeast3-c
   sudo docker ps    # someone else deploying? (container only seconds old)
   curl -fsSL https://raw.githubusercontent.com/ghostseedio/animaldex_landing/main/scripts/deploy-selfhost.sh | sudo bash -s -- <full sha>
   ```
4. Rollback: the script prints the command; the previous known-good sha is `76a4f5d1` (and `b0e6c20c…` before it).
5. **Check on the VM:** /ark loads the built worker files in `public/ark/` (`ark-prebuild-worker.js`, `ark-prebuild-places-worker.js`). They are made by the `prebuild` script, which `npm run build` runs (the Dockerfile's build step does). Locally `next start` answered every URL with a 308 to itself (the site's routing, not the Ark): open /ark and the embed on the VM after the deploy to be sure.

## 5. Bucket steps (`talking-models`)
1. **Rig `v2`** (owner-approved once checks pass): `ARK_FLIGHT_APPROVED=1 python3 publish_rig.py --prefix ark-rig/v2 --no-facing`, dry run first, then `--apply`. Inert until a web build reads it (this release reads v2 first).
2. **The 14 turned birds' near/far** (`publish_ark.py`): only **with or after** the web deploy (the live web turns them itself; uploading first turns them twice). `publish_rig.py --apply` runs it first and refuses if anything else changed.
3. **Close-up skins** (678 MiB, 2,630 species; `export_closeup.py`): **still needs the owner's approval.** Read only near the camera; 404s until uploaded.

## 6. Apps (3.3)
- Merge `ark-founders-ios` / `ark-founders-android` (founders + the 18+ confirmation), `ark-thrive-ios` / `ark-thrive-android` (offer and arrival lines, the Ark Score explainer), and the runtime bridge branches (`ark:visible`, `ark:power`: `docs/ark/runtime-bridge.md`) into each app's main, then the owner builds and submits.
- The apps read new server keys when present and behave as before without them; the server can go first.
- Never `gradlew --stop`. Android `DebateFlowTest` is a known load-sensitive flake.

## 7. Order on approval
1. Server: founders migration (switch off) and `voyage-founder-story`; then the thrive function and migrations 3–7 (§3).
2. Bucket: rig `v2`.
3. Web: merge, build, deploy (§4); with it or after it, the 14 turned birds.
4. Server: the captures backfill (needs this web build), then `thrive` on, then the capture triggers.
5. Apps: merge and submit.
6. Publish the privacy and terms change (`docs/ark/founders-privacy.md`).
7. Flags the owner chooses, one at a time.

## 8. Known issues (at m4)
- **Flight and grazing clips** need rig `v2`: with v1 no flight clip and no graze clip passes (wings closed in the air, no head-down graze).
- **No entry/exit motion** at the water's edge until v2's `enter_water`/`exit_water` clips.
- Shared-layer reaction to predators is a glance; the full reaction (alert, flee) runs only near the camera (reactive layer).
- Golden checks: the reef's upper water reads as a flat teal band; mountain rock ledges can read as boxy slabs; `ant_bark`'s trunk is untextured grey (graphics batch 6).
- At 3× the captures population the hamlet's crowding check fails in 5 one-metre cells (map lane; 1× passes).
- Two puffins once shared a spot (fixed in map a7b33484); recheck after each map round.
- Ambient beds need a human listen (forest_day repeat call, wind_trees bassy). Surf and waterfall are Public Domain Mark (not CC0). The live chat's "shore" bank credits an uploader whose Commons files were nominated for deletion; keep it out of the Ark.
- See the integrator's latest round report for the test and audit numbers.

## 9. Checks (CI)
- `ark-map-validator.yml`: the spawn validator and the placement tests.
- `ark-visual.yml`: golden shots against baselines, then the hooks in `tests/ark-visual/hooks.json`.
- `ark-behaviour-audit.yml`: the behaviour audit's key checks (problems 1–7) at today's merged values, the reactive encounter scenario and the map validator; thresholds in `tests/ark-audit/thresholds.json`.

## 10. Owner questions still open (from the lanes)
- **Founders (Android):** story "Not now" (Android remembers per device; iOS/web hide for the visit); after Remove (iOS re-asks; Android/web don't); 403 not_yours/under_18/disabled (Android hides the line; iOS shows an error).
- **Rigging:** the `flight_held` list after the flight sheets; neck lengthening cap 1.45× ok?; squash-and-stretch wanted?
- **Attach:** make a caterpillar model? (the leaf shot uses a cabbage white)
- **Props:** nest scale (1.35× off the ground, bird-sized on it)?; empty colony nests keep?; buried/burrow eggs hidden OK?
- **Ambient:** keep the Public Domain Mark surf and waterfall?; the live "shore" bank's credits.
- **Animal look:** approve the 678 MiB close-up upload; fur shells desktop-only OK?; minimum camera distance 4 m?
- **Reef:** seagrass meadows off the beach keep?; kelp only off rocky cliff coasts OK?
- **Rig player:** head look on v1 rigs (within limits) OK?
- **Map:** freshwater fish all in the lake (not the river)?; shore perchers forage by the water by day and roost in trees at night?; launch points count.
- **Behaviour:** variety metric (flocks asleep together count as the same?); animals unseen 0.3–1.5 s at load OK?
- **Intelligence:** the gait cap (deer flee about 2 m/s until v5 run clips); bateleur as an aerial threat?; invertebrates rarely react.
- **Recipes:** the pair rule (any two / male+female everywhere / male+female for the 2,103 dimorphic); 1,400 decorative murmuration birds OK?; eggs only from server events OK?
- **Standing:** Ark-aware chat decisions; the privacy and terms text; Indonesian and Filipino strings; which flags after release; a real mid-range Android phone test; rotate `CLAUDE_API_KEY_2` and the Zernio key.

## 11. Media (to fill)
- **2-minute flythrough:** _placeholder_ (`node scripts/ark-flythrough.mjs` on the final head).
- **Golden-shot pack:** _placeholder_ (`node scripts/ark-golden-shots.mjs --label release --devices desktop,phone` on the final head; plus props and animal close-ups).
