# Ark release: the motion pass, Part B and the second island (draft, for the owner's approval)

**Nothing in this document is deployed.** The owner chose "ship what's ready today" (decision 136). The web release
branch is landing `ark-next`. The previous web release, and the rollback, is landing `main` **7764fe12** (the release
1323a70d plus the privacy text).

Status of this draft: **(pending)** marks a part that waits for a lane: the final L5 collisions, T3's town animals and
island switching (`ark-islands-scene`), the encounter lane's server activation, and the routed fixes in §6.

## 0. At a glance

| Repo | Branch | Head | What |
|---|---|---|---|
| landing (web) | `ark-next` | **the head this document is committed at** | Every lane in §1, merged by the integrator (`docs/ark/NEXT.md`) |
| AnimalDex (server) | `ark-islands-server` | 66b33a72 | The two islands: migrations `20261117100000`–`130000` and `voyage-world` **applied, inert**; the switch-on script (lane T1, `docs/ark/islands-server.md`) |
| AnimalDex (server) | `ark-encounter` | 9d8f0303 | Encounter hunting: the islands migrations plus `20261118100000`, `110000` (lower priority today; the scene side is inert without it) |
| Bucket `talking-models` | unchanged | — | No upload is needed. Part B's far-model pack is optional (§4.3) |

Lane heads merged into `ark-next`:

| Lane | Branch | Head | Merged as |
|---|---|---|---|
| L5 collisions | `ark-collisions` 37de0b1d, `-navstart` 7533ab4e, `-town` 2d939850, `ark-collide-gate` e056ef12 | — | 521c3de4 (API), a9af1cc8, 7930ec2e, 7ab61a51, two-island colliders, 412fa2e3 |
| L4 true scale | `ark-true-scale` | f6a1e8f8 | 893832a7 |
| L6 scenery | `ark-scenery` | 017c5572 | c579bc62, 6a8cefe5, 0de78f61, 9d089ea4 |
| L3 grounding and perching | `ark-grounding` | fda84235 | 8d90308a, generator 7 re-run 3900a81d |
| L1 locomotion | `ark-locomotion` a0d507a4, `ark-l1-fixes` 5cab18f6 | — | e813bd21, aaad9473, e922c08f; wiring a9ecfffd, 07c3a64b, 5388b309 |
| L2 flight, swimming, legless | `ark-flight-swim` | 2cf309e3 | af146487 |
| L7 chases | `ark-chases` | 772d9bcb | cc82a1bc, ce245fd8, e43139cb; wiring 356d0fc4 |
| Part B streaming | `ark-streaming` 366f985b, `ark-streaming-islands` 2f7f6fa3 | — | 77c3f2f5, b9446a3d |
| Encounter hunting, scene side | `ark-encounter-scene` | 9fcbb049 | 93b9c1b1, 34524f02 |
| The positions atlas v2 (encounter lane) | `ark-positions-atlas` | cba0594d | 342097c9 (pinned to AnimalDex `ark-encounter` 8f9bc465) |
| The second island (T2) | `ark-town-island` | bdcd9ff1 | 084c07f6 |
| Town animals, one world, the schedule, zoo feeding, the town worker (T3) | `ark-islands-scene` | 57014b78 | 1c508857, 9df003b3, e043745b, 31fdcbcb, 5cd8efff |
| The `ark.islands.*` and Meadow strings (i18n lane) | `ark-islands-i18n` | 33306e20 | 491a4692, 60f41b2f |
| The wild island without its hamlet (islands mode) | `ark-wild-no-hamlet` | 98a30984 | f098c301, 03dfd120 |

Player control is not in this release.

## 1. What is included

The owner's motion brief (handover `ark/queued/motion-100x-brief.md`), lane by lane. Visual only: the server and the
ecology are unchanged, except the islands (§5).

- **Natural locomotion (L1, `docs/ark/locomotion.md`).** A gait engine on the rigs, posed on the CPU into a live pose
  texture for the rigged near animals (at most 24): gaits by body plan and speed (walk, trot, pace, gallops, bound, hop,
  insect tripod), strides and cadence matched to speed so planted feet don't slide, two-bone foot IK on the drawn ground,
  body bob, sway and roll in time with the gait, head steadying and bird head-bob, tail springs, turning by stepping,
  sprint and flee paces and zigzag flee paths for the chases.
- **Flight, swimming, legless (L2).** Wing beats by size and effort (downstroke power, upstroke fold, flap-glide,
  bounding, soaring trims, hovering), coordinated banking, take-off hard flaps and the landing flare; swimming by mode
  (eel, fish, ray, whale up and down) with the tail-beat rate from speed and swimmers kept under the surface unless
  breathing; snakes along their own track without slip, sidewinding, rectilinear crawl.
- **Grounding and perching (L3, `docs/ark/grounding.md`).** True base and sole heights from every live model, standing on
  the drawn ground and leaning to slopes, perchers drawn on their branch surface with their soles on the wood, outer-crown
  perches (tree-attach generator 7), the grounding audit, the validator's grounding checks and a runtime check.
- **True relative sizing (L4, `docs/ark/true-scale.md`).** Every species at its stored or data-gap length in metres: no
  curve, floor or cap (humpback 3.5 → 14 m, blue whale 6.7 → 25 m, house mouse 0.28 → 0.15 m, ladybird 0.18 m → 7.5 mm).
  Find-dots for small animals, "My animals" and `?focus=` meet a beetle from 12 cm, camera ranges and the sea reserved for
  big swimmers.
- **Collisions (L5).** Colliders from fences, buildings, solid props, trunks, rocks, logs, hay and lamp posts, and body
  shapes from each model; baked into navigation (paths round them, climbs only for climbers, walk cells for fences, hay,
  lamp posts and plot props, routed hamlet doors) and a runtime layer that keeps animals out of anything solid and eases
  them off each other (about 0.8 ms a frame at 1,200 animals on desktop). Its 2-hour audit runs in `ark-collisions.yml`.
  The town's colliders come through `setIslandColliders` (T3).
- **Scenery (L6).** Trees at real heights, kept apart by trunk and crown, rocks made in code that sit into their slopes
  (crags, boulders, scree), nothing floating or standing in anything, the real-size cottage and fence.
- **Chases (L7, `docs/ark/chases.md`).** Visual hunts of ambient prey (cats pounce, raptors stoop, herons strike, dolphins
  and seals chase fish, swallows hawk insects), real meal events acted out as full chases from the encounter positions
  where the server sends them, prey nearby scattering.
- **Part B streaming (`docs/ark/streaming.md`).** The world in chunks, render distance and haze per tier, memory budgets
  measured on the real Ark, the tier from device memory, the far-model pack reader (inert until a pack is uploaded),
  true scale past the render distance (a whale keeps its model while 6 px or more on screen).
- **Encounter hunting, scene side.** The shared positions module and its atlas, the meal's encounter geometry, the
  hunting read. Inert while the server's `hunting` is `pool`.
- **The second island (T2, `docs/ark/town-island.md`).** The town, countryside and zoo island under
  `src/ark-scene/islands/` (12.4 ha: canal, old town, 119 buildings, 10 farms, the zoo's 35 plots), loaded only when a
  crossing asks. **T3:** one world with both islands (the town across a 250 m strait, one sea, the view panning over
  both; decisions 141–143), town animals placed and on the behaviour schedule (households, farms, zoo enclosures with
  feeding and enrichment), the toolbar switch, `?focus=` across islands, the population panel's "Both islands", "My
  animals" across both. With `islands` off on the server the town is empty and the wild island is as before.

## 2. Checks

On the release candidate's tree (03dfd120 = 5cd8efff):

| Check | Result |
|---|---|
| Unit and integration tests (`npm test`, every `src/lib` test) | **2,381 of 2,382 pass, 0 fail** (1 skipped) |
| tsc | clean (after `next lint` has written `next-env.d.ts`) |
| lint | 0 errors |
| The map's spawn validator | 0 failures (islands off and, per the hamlet lane, islands on) |
| The motion summary (`npx tsx scripts/ark-motion-ci.mts`) | all pass: 42 rows (L1, L2, L5 and L6 tests and numbers) |
| The collision audit (`ark-collisions.yml`; CI fixture, 2 island hours at 4 s) | islands mode (what goes live): pass-throughs 0, fence crossings 0, cliffs 1,276, overlaps 3.22 M; today's mode: 0 / 0 / 861 / 3.07 M; both within their limits (`tests/ark-collide/thresholds-islands.json`, `thresholds.json`) |
| Visual CI (GitHub Actions, decisions 134 and 147: Linux SwiftShader baselines) | **(pending)**: the accept run on the release head, after a look at every shot |
| The default view, twice (`ark-rig-scenes.mjs --island`) | walk pace ratio median 1.12 / 1.11; backwards 4.1% / 1.2%, nothing backwards for over 1 s; ground turns 0.8 / 1.8 a minute; over 1.5× its clip: an American alligator (2.3×), the harbour seal (2.5×, its flipper clip), the clawed frog (1.6×); no page errors |
| The production build emits the workers | `node scripts/build-ark-bundle.mjs` (the `prebuild` of `npm run build`): `ark-prebuild-worker.js`, `ark-prebuild-places-worker.js`, `ark-town-worker.js` (828 KB) |

## 3. Before and after

Before is the live release (7764fe12), after is `ark-next`. The per-lane detail is in `docs/ark/NEXT.md`.

| Measure | Before | After |
|---|---|---|
| Planted-foot slide per step, walk (median, 20 golden species) | 19 mm | 0.05 mm |
| Slide turning half round on the spot | 622 mm | 0.26 mm |
| Slide on a 15° slope over a ridge | 1,200 mm | 4.0 mm |
| Planted sole height on the slope (median) | 80 mm | 1.2 mm |
| Wing-beat rate against length, fitted exponent (651 birds; the literature's about −0.96) | −0.60 | −0.975 |
| Bank against the coordinated turn, worst error | 0.40 rad | 0 |
| Up-and-down swimmers breaking the surface, not breathing | 35 of 39 | 0 |
| Floating / sinking animals (real snapshot, near) | 145 / 280 | 0 / 0 |
| Inside scenery at rest (real snapshot) | 298 | 175 (beside trunks and rock feet; L5's runtime layer to come) |
| Perched hidden inside a crown (samples) | 412 | 0 |
| Species drawn more than 2× off their true length | 1,283 of 2,630 | 0 |
| Overlapping pairs (real snapshot) / in the open ocean | 96 / 1 | 63 / 0 |
| Trees growing into each other | 971 pairs | 0 |
| Props floating / standing in each other | 284 / 14 | 0 / 0 |
| Pass-throughs of solid things (true scale, real snapshot, 2 h / 1 h) | 194,000 samples | 0 |
| Fence crossings (2 h) | 638 | 0 (CI fixture, both modes) |

Performance per tier (Part B, the real Ark, headless Chromium with Metal; `docs/ark/streaming.md` §7): desktop high /
medium / low 59 / 60 / 60 fps, view complete 10.4–10.9 / 8.3–9.0 / 5.6–9.0 s; the phone profile (360×800, DPR 2, 4× CPU
throttle) medium 42–52 fps, low 56–58 fps. L1's posing costs about 0.85 ms a frame for 24 rigged animals.

## 4. Web deploy (owner, on the VM)

1. Merge `ark-next` into landing `main` (only after approval; fast-forward or a merge commit, no rebase).
2. Build the image: `gh workflow run build-selfhost-image.yml --ref main` (about 20 minutes).
3. On the VM:
   ```
   gcloud compute ssh animaldex-production --zone asia-northeast3-c
   sudo docker ps    # someone else deploying? (container only seconds old)
   curl -fsSL https://raw.githubusercontent.com/ghostseedio/animaldex_landing/main/scripts/deploy-selfhost.sh | sudo bash -s -- <full sha>
   ```
4. Check on the VM: /ark and the embed load; the built workers in `public/ark/` are there (`npm run build` runs
   `prebuild`, which runs `scripts/build-ark-bundle.mjs`: `ark-prebuild-worker.js`, `ark-prebuild-places-worker.js` and
   the town's `ark-town-worker.js`; without the town worker the town builds on the main thread and phones stall 5–9 s);
   a whale and a mouse at their
   sizes; the encounter atlas static file is served (the bundle build copies it).
5. **Rollback:** the script prints the command; the previous known-good sha is **7764fe12** (landing `main` today).

### 4.3 Optional: Part B's far-model pack (bucket, owner-approved only)

Not needed for this release: without a pack in the manifest every kind loads its single file, as today. If wanted later:
`node scripts/ark-model-pack.mjs --out <dir> --kinds <kinds.json> --serve-layout --verify`, then the dry run
`node scripts/ark-model-pack.mjs upload --out <dir>`, then the upload with the owner's approval
(`docs/ark/streaming.md` §6). Rollback: the previous manifest.

## 5. Server (AnimalDex; never `db push`, use `db-migrate.sh`)

### 5.1 The two islands (lane T1, `docs/ark/islands-server.md` §3 on AnimalDex `ark-islands-server` 66b33a72)

The server side is **already applied and inert** (the coordinator, 2026-11-12): the migrations `20261117100000`–`130000`
and `voyage-world` from `ark-islands-server`; `islands` stays off, so the reads, the cache and the ecology are
byte-identical. What is left, in order:

1. Deploy the web (§4). While `islands` is off, `'wild'` is the whole Ark and `'town'` is empty, so the web is safe to go
   first; with the islands off the scene is unchanged (checked by the visual CI, §2).
2. **The switch-on, confirmed by the owner right before** (it moves every living animal to its island: a production data
   change), from the `ark-islands-server` worktree:
   ```
   supabase db query --linked -f supabase/scripts/islands-release/2_switch_on.sql
   supabase db query --linked -f supabase/scripts/islands-release/3_after_switch_check.sql
   supabase db query --linked "SELECT public.voyage_islands_verify_v1('islands-2026-11-12')"
   ```
   About 2 s; it refuses unless verification passes; quiet (no events, no pushes). Expected (rehearsed): `islands` true;
   wild/wildlife 707, town/wildlife 727, town/house 1,063, town/farm 149, town/zoo 499 (plus arrivals since); 32 zoo
   enclosures; every public-read animal has island keys; `kept_eaten_since_switch` 0.
3. Undo: `supabase/scripts/islands-release/9_rollback_data.sql` (islands off, every home restored); the migration
   rollbacks and `voyage-world` v3 (3986f80a) only if wanted (`docs/ark/islands-server.md` §3).

### 5.2 Encounter hunting (lower priority today)

The scene side is in and inert while the server's `hunting` is `pool`. The server activation (`20261118100000`,
`110000` on `ark-encounter`, and its switch) comes from the encounter lane: **(pending)**.

## 6. Known issues

Listed for the owner instead of polished today (decision 136):
- Small animals' pace: old length floors in `behaviour-recipes.ts` `pace()` / `speedOf` and `behaviour-schedule.ts`
  `Math.max(length, 0.05)` meet true size (L1 capped walking legs at 1.2× the walk pace, so the walk-pace test passes;
  the clawed frog still reads 1.6× in the default view, the bullfrog more).
- Carried prey sits off the beak.
- `GaitState.feet` is not in the grounding check (not a one-line wiring: a planted foot's height carries a sole offset).
- The rhino's wallow wobbles.
- Cranes and storks perch on limbs.
- The house cricket lies on its back.
- Emergent trees stand as tall as the mountain.
- Dolphins overlap in chases.
- The osprey's and the swallow's poses.
- In the default view some animals move faster than their clips: the American alligator (about 2.3×), the clawed frog
  (about 1.6×), the bullfrog, and the harbour seal (about 2.5×, its flipper-legs clip; seals keep their baked clips).
  Three causes (L1): the reactive layer moves reactions in metres with no cap from the animal's own clips (fixed after
  the release: `ark-l1-pace` f21ad63b caps them at 1.2× the walk or run pace); the default-view metric compares with
  the baked clip even where the locomotion layer draws the feet (fixed in the tool in the same branch); and schedule
  trips too long for their slot are sped up past 1.2× (bullfrog, alligators, goats, the komodo dragon; being reworked
  under decision 202).
- Ground turns of 2–4 a minute in the default view (lions, seals, zebras): the collisions layer's separation pushes
  positions without turning the bodies (L5's facing fix comes after the release).
- Some animals jump onto their roost at the night's first sleep slot (a camel by 2.6–41 m, an emperor penguin by
  3.7–6 m).
- Walking backwards: 0.2% at the release, 1–5% on this head (nothing over 1 s on the ground); the behaviour lane's fix
  (`ark-behaviour-backwards` cef5c27d: a foal faces its way home, a sleeper keeps its heading across slots, no snapping
  round) brings it to 3.2% in the replay and comes right after the release.
- Perched sleepers share crowns: the collision audit's overlaps (3.2 M body samples over 2 hours) are mostly sleepers
  in their postures and perched animals held where they are; the limit is "at most today's".
- Arriving at the town on the phone profile leaves two main-thread tasks of 0.5–0.6 s after the first frame (decision
  163): profile them on a real phone after the release.
- The town's walk ways are new (T3): watch for town animals crossing garden fences in the first hours.

Right after the release (merged in this order, then a web-only deploy): L1's reactive pace cap (`ark-l1-pace`
f21ad63b), the behaviour lane's backwards fix (cef5c27d), L1's schedule pace (decision 202), L5's separation facing, and
the bigger wild island (W1, `ark-wild-island-next`).

## 7. Rollback

- Web: redeploy **7764fe12** with the deploy script (§4, step 5).
- Islands: `supabase/scripts/islands-release/9_rollback_data.sql`, then the migration rollbacks if wanted (§5.1).
- Nothing else in this release touches the server or the bucket.
