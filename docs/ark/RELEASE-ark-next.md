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
| AnimalDex (server) | `ark-islands-server` | c4ad9389 | The two islands: migrations `20261117100000`–`130000`, `voyage-world` (lane T1, `docs/ark/islands-server.md`) |
| AnimalDex (server) | `ark-encounter` | 9d8f0303 | Encounter hunting: the islands migrations plus `20261118100000`, `110000` (lower priority today; the scene side is inert without it) |
| Bucket `talking-models` | unchanged | — | No upload is needed. Part B's far-model pack is optional (§4.3) |

Lane heads merged into `ark-next`:

| Lane | Branch | Head | Merged as |
|---|---|---|---|
| L5 collisions (API) | `ark-collisions` | 39adcbd8 | 521c3de4 (final L5: **pending**) |
| L4 true scale | `ark-true-scale` | f6a1e8f8 | 893832a7 |
| L6 scenery | `ark-scenery` | c5812a75 | c579bc62 |
| L3 grounding and perching | `ark-grounding` | fda84235 | 8d90308a, generator 7 re-run 3900a81d |
| L1 locomotion | `ark-locomotion` | 314927d0 | e813bd21, wiring a9ecfffd |
| L2 flight, swimming, legless | `ark-flight-swim` | 2cf309e3 | af146487 |
| L7 chases | `ark-chases` | 30dbbf9e | cc82a1bc, wiring 356d0fc4 |
| Part B streaming | `ark-streaming` | 366f985b | 77c3f2f5 |
| Encounter hunting, scene side | `ark-encounter-scene` | 35eb7d35 | 93b9c1b1 |
| The second island (T2) | `ark-town-island` | bdcd9ff1 | 084c07f6 |
| Town animals and island switching (T3) | `ark-islands-scene` | **pending** | — |

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
- **Collisions (L5).** The collide API (colliders from fences, buildings, solid props, trunks, rocks, logs, hay, lamp
  posts; body shapes from each model), used by L7's chases. The runtime separation and the walk-grid changes are in the
  final L5 (**pending**).
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
  crossing asks. T3's town animals and island switching: **pending**.

## 2. Checks

| Check | Result on `ark-next` |
|---|---|
| Unit and integration tests | **(pending the final head)**. On 3900a81d (L4, L6, L3): 2,289 of 2,296; the failures are listed in §6 |
| tsc | clean (after `next lint` has written `next-env.d.ts`) |
| lint | 0 errors |
| The map's spawn validator | 1 failure, the known Asiatic black bear spot beside a leaned rock (§6) |
| The motion summary (`npx tsx scripts/ark-motion-ci.mts`) | all pass: 21 numbers plus the L1, L2 and L6 tests |
| Visual CI (GitHub Actions, decision 134; one render per shot plus a look, decision 136) | **(pending)** run 43137765861 |
| The default view, twice | **(pending the final head)**. On 3900a81d: walk pace ratio median 1.00 / 0.94, backwards 5.3% / 4.9% (none over 1 s), ground turns 1.2 / 0.0 a minute |

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
| Pass-throughs of fences and rocks | — | **(pending the final L5)** |

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
4. Check on the VM: /ark and the embed load; the built workers in `public/ark/` are there; a whale and a mouse at their
   sizes; the encounter atlas static file is served (the bundle build copies it).
5. **Rollback:** the script prints the command; the previous known-good sha is **7764fe12** (landing `main` today).

### 4.3 Optional: Part B's far-model pack (bucket, owner-approved only)

Not needed for this release: without a pack in the manifest every kind loads its single file, as today. If wanted later:
`node scripts/ark-model-pack.mjs --out <dir> --kinds <kinds.json> --serve-layout --verify`, then the dry run
`node scripts/ark-model-pack.mjs upload --out <dir>`, then the upload with the owner's approval
(`docs/ark/streaming.md` §6). Rollback: the previous manifest.

## 5. Server (AnimalDex; never `db push`, use `db-migrate.sh`)

### 5.1 The two islands (lane T1, `docs/ark/islands-server.md` §3 on `ark-islands-server`)

1. Apply `20261117100000_voyage_islands_schema`, `110000_voyage_islands_route`, `120000_voyage_islands_reads`,
   `130000_voyage_islands_assign` with `db-migrate.sh rehearse` then `apply`, in order. Byte-identical for players while
   `islands` is off. The ALTER TABLE on `voyage_animals` needs its lock within 5 s; retry if the cache refresh or the
   minute job holds it.
2. Deploy `voyage-world` from `ark-islands-server`, merged with whatever else is live. Before step 4.
3. Deploy the web (§4).
4. In the town's release window, with the owner's approval (it moves every living animal: a production data change):
   `SELECT public.voyage_islands_switch_on_v1('islands-YYYY-MM-DD');` (it refuses unless verification passes; quiet, no
   events or pushes).
5. Check: `SELECT public.voyage_islands_verify_v1('<run>')` returns `ok`; `voyage_public_v3('first','town')` has the town.
6. Undo: `SELECT public.voyage_islands_rollback_v1('<run>');`, then the migration rollbacks in reverse if wanted.

**(pending)** T1's final order, if it differs.

### 5.2 Encounter hunting (lower priority today)

The scene side is in and inert while the server's `hunting` is `pool`. The server activation (`20261118100000`,
`110000` on `ark-encounter`, and its switch) comes from the encounter lane: **(pending)**.

## 6. Known issues

Listed for the owner instead of polished today (decision 136):
- The African clawed frog's and the American bullfrog's pace: old length floors in `behaviour-recipes.ts` `pace()` /
  `speedOf` and `behaviour-schedule.ts` `Math.max(length, 0.05)` meet true size (the walk-pace test fails on the frog,
  1.44; the bullfrog walks at about 9× its clip in the default view).
- Carried prey sits off the beak.
- `GaitState.feet` is not in the grounding check (not a one-line wiring: a planted foot's height carries a sole offset).
- The rhino's wallow wobbles.
- Cranes and storks perch on limbs.
- The house cricket lies on its back.
- Emergent trees stand as tall as the mountain.
- The Asiatic black bear's validator spot is beside a leaned rock (the spawn validator's one failure).
- Dolphins overlap in chases.
- The osprey's and the swallow's poses.
- Fences and rocks can be walked through until the final L5 lands **(pending)**.

Routed to lanes, to be fixed or listed here before approval **(pending)**:
- L6: three tests fail on L6's own head: stags clash 5.23 m apart, a snow leopard within 15 m of a goat (safe 20 m),
  piled pigs vs a zebra herd asleep (1.08 vs 1.53 body lengths).
- L1: the share of walking backwards in the default view (0.2% at the release, about 5% since the scenery and grounding
  merges; nothing backwards for over 1 s). One of the owner's original complaints, so not listed as known yet.
- L7: the duck sitter (on the merged tree the mallard never takes its nest trip) and the recipes test file's timeout.

## 7. Rollback

- Web: redeploy **7764fe12** with the deploy script (§4.5).
- Islands: `voyage_islands_rollback_v1`, then the migration rollbacks (§5.1.6).
- Nothing else in this release touches the server or the bucket.
