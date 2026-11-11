# Ark release, November 2026 (DRAFT, kept up to date as rounds land)

Handover §6.3. **Nothing in this document is deployed.** Every server, bucket, web and app step below waits for the
owner's approval of this release as a whole. Exception already approved: the rig `v2` upload, once its checks pass.

- **Web release branch:** landing `ark-release`. Its head is in §1; it is merged round by round (m1–m5 so far).
- **Live today:** web landing main `76a4f5d1` (rollback sha `b0e6c20c463911969725fa001170e6add313483b`); server
  migrations up to `20261113160000` plus `20261111140000/160000/170000` and `20261110130000_web_ark_events`; functions
  voyage-world v1, dispatch-ark-digest-push v1, delete-account v64, generate-applied-insight v143; bucket
  `talking-models/ark-rig/v1/` (1,971 rigs, inert until a web build reads them).

## 1. What is included

### Web (landing `ark-release`, round m5: f7db6716 and on)
Each lane's branch head as merged. "Pending" heads have newer work not yet in the release.

| Lane | Branch | Merged head | What it brings |
|---|---|---|---|
| Graphics (terrain, water, sky) | `ark-graphics` | 642cff4e | Batches 1–6: sculpted terrain and range, sky and moon, underwater light and shafts, near fade, tree and conifer lighting, asset rocks, wheat and crop fields, forest floor and litter, still lake and river, warm sand, close-range bark, the ground for the prebuild worker |
| Assets | `ark-assets` | 874a8d84 | Trees (33 variants), plants (76), rocks (21), forest floor (13): all generated in-repo, CC0 |
| Reef | `ark-graphics-reef` | 84226995 | Corals, sponges, anemones, kelp, seagrass, 15 ambient fish schools that split round hunters |
| Attach points | `ark-graphics-attach` | 100f6f6d | Attach points on the drawn trees, rocks, ledges, hollows, eaves, limbs, fence posts; `snow.ts`; sliced `prepareAttachPoints`; true-size close-up cameras |
| Map | `ark-map` | acdfe23d | B3/B4 placement for every type, the spawn validator, grips, partners on hosts, the hamlet (home plots, residents, indoor/outdoor rotation) |
| Props | `ark-props` | 657915ea | Nests by species (growing), homes, area details, home layout, fence posts, per-plot yards and gardens, the coop, hamlet buildings per plot, thinned crops under reserved plots |
| Behaviour | `ark-behaviour` | 3d3ecc22 | The shared schedule: goals, grazing beats, land↔water crossings, predator spacing (≥ 20 m), wariness by sight, variety, shore haul-outs, no teleports, resting at roost, hamlet plots in the walk grid |
| Behaviour recipes | `ark-behaviour-recipes` | f1c88d05 | 71 blocks, recipes for 2,555 species (fishing birds, contests, nest building, murmurations, digging, swarms, mixed flocks, molehills, bats hanging and their dusk emergence), seeded sex and the duller sex, sitters on nests, coats from wallows |
| Intelligence | `ark-intelligence-web` | c1a02c45 | The local reactive layer near the camera: head look, perception, fleeing, camera habituation, storm alarms |
| Rig player | `ark-rig-publish` | a8cc915f | The v2 rig set first with the v1 fallback, flight gated by the manifest, flight/look/beat/recipe clips, head look on the rig's bones |
| Sea depth | `ark-sea-depth` | 8e859a65 | Depth bands for 449 water species, breathing |
| Animal look | `ark-animal-look` | a20f2e8d | Fur, feathers, scales, eyes, wet and dust, contact shadows, close-up skins (when uploaded) |
| Liveliness wiring | `ark-liveliness-wiring` | 36b4d8e6 | WebAudio engine (tap only), weather visuals (rain, fog, lightning), sheltering, young, tide, per-instance variation, traces |
| Ambient sound | `ark-ambient` | e0f92416 | 13 beds and 2 thunder claps (public domain and CC0) |
| Runtime | `ark-runtime-web` | 5a3598f8 | Live budget (`arkOutside`, resting first, rule E zone capacity), shared clock, worker prebuild (scenery, places, ground), visibility/idle/power, memory, camera, visual CI |
| Founders (web) | `ark-founders-web` | 97fe9811 | Named founders, stories, the one-tap 18+ confirmation |
| Captures + thrive (web) | `ark-thrive-web` | ab82aa0c | The capture band, condition and family on the tap card, Ark Score v3, the chat offer and result lines; bringers shown as `@username` linked to `/u/{handle}` (owner decision); the age question inline when `ask_age` is set |
| Home growth | `ark-home-growth` | 7588a2e8 | The bigger home area (a south lobe and east shoulder, +41% dry land), a two-street hamlet with lanes, 15 houses and 5 smallholdings planned, pets out by day, residents never herded, rule-E zone capacity (`map/capacity.ts`, wired to the runtime's `setArkZoneCapacity`) |
| Sleep | `ark-sleep` | f23db564 | Sleep postures from data for 2,555 species, lying down and getting up, closed eyes (`arkInstance.w`), breathing and stirs, social sleep with a night watch, waking in the reactive layer, den sleepers in burrows, the rest status in 45 languages |
| Live HUD | `ark-hud-live` | a83dd61e | Species and region bars (log scale, changes), the Live log of real events and seen behaviour (tap to fly there), `mated` events, arrival notices for real arrivals only, the embed's `?hud=` and `?insetTop`/`?insetBottom` safe areas |
| Release fixes | `ark-release` | — | Water animals in their depth band under the schedule (`schedule-water.ts`); grass press; attribute renames (`arkCoat`, `lookChain`); shader-compose test; tree-attach regenerated; the recipes' nest and fish wiring; m5: the hang-point drop rechecked from the recorded point (`ark-tree-attach.mjs`), worn paths wait for the schedule's world, the motion check skips undrawn frames, the scale fixture's `area`, the zone-capacity wiring, den entrances and going-in at the map's `map:` roosts |

Not yet in the release: `ark-scale-test`, newer rig-publish. The behaviour audit harness (`ark-audit`) is merged with its CI job (§9).

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
**The web build with captures + thrive ships together with the server's `capture_arrivals` flag** (captures-thrive design §10.2): the web reads the new keys, and the flag turns arrivals from captures on. Don't deploy one without the other.

1. Server: founders migration (switch off) and `voyage-founder-story`; then the thrive function and migrations 3–7 (§3).
2. Bucket: rig `v2`.
3. Web: merge, build, deploy (§4); with it or after it, the 14 turned birds.
4. Server: the captures backfill (needs this web build), then `thrive` on, then the capture triggers.
5. Apps: merge and submit.
6. Publish the privacy and terms change (`docs/ark/founders-privacy.md`).
7. Flags the owner chooses, one at a time.

## 8. Known issues (at m5)
- **Red tests on `ark-release` 8de9d06e (2,236/2,239):**
  - "the spawn validator places every catalogue species": amazonian-giant-centipede `invalid_surface` (a tree climber on the forest floor). Only on release: the map branch (0 failures) lacks assets 874a8d84's emergent crowns and their attach points. Map lane.
  - Behaviour's two, fixes coming:
  - "at the shore nothing jumps": a polar bear's walk leg over a cliff (`exit_water -> walk`, 10 m in a second).
  - "divers breathe on their way" (map's breath-trip test): an orca moves backwards in the first 0.25 s of a breath, because a trip starts by turning in place while it already swims the new way. It comes with release's behaviour (the map branch lacks behaviour 3d3ecc22).
- **Default view** (corrected check, b20469d3): backwards 0.9%, nothing backwards over 1 s, ground turns 0 a minute (median), pace ratio median 1.26, nothing over 1.61×. Circling, all mild: a plains zebra at 5.9 a minute (watch, graze), two mallards at 4.9 (forage), a harbour seal at 3.2, an emperor penguin at 3.
- **Backfill view (1×):** the pets are spread over the plots. Tiny animals no longer form herds (home growth 7588a2e8).
- **House_fields at night** (0f4e76b5): a golden retriever stood in the garden pond. Home growth 7588a2e8 keeps resident spots out of water; a roaming dog's path is with behaviour.
- **Dens** (8de9d06e): the props' entrances and the sleep lane's going-in now read the map's `map:` roost ids (they drew no den and sank no sleeper at a map roost before). Golden den_rock: the rock hyrax's den on a rock face.
- **Flight and grazing clips** need rig `v2`: with v1 no flight clip and no graze clip passes (wings closed in the air, no head-down graze).
- **No entry/exit motion** at the water's edge until v2's `enter_water`/`exit_water` clips.
- Shared-layer reaction to predators is a glance; the full reaction (alert, flee) runs only near the camera (reactive layer).
- Golden checks: the reef's upper water reads as a flat teal band; `ant_bark`'s trunk is untextured grey (graphics batch 6).
- Map scale with the home growth (f7db6716): 1× 3,140 animals, 1,198 residents on 12 plots, 11.4% out on average, no cell over the limit; 3× 9,420 animals, 3,594 residents on 22 plots, 9.8% out, no cell over the limit (the 5 crowded cells at m4 are gone), 121 wild animals resting past their zone's capacity (wetland 327/206).
- Ambient beds need a human listen (forest_day repeat call, wind_trees bassy). Surf and waterfall are Public Domain Mark (not CC0). The live chat's "shore" bank credits an uploader whose Commons files were nominated for deletion; keep it out of the Ark.

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
