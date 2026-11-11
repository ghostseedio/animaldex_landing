# Ark rig player (`ark-rig-publish`)

The web side of the rigged animals: `src/ark-scene/rig-clips.ts` (the rules), `src/ark-scene/rig-player.ts` (the library, the clip choices, the look chain), `rigFor` in `src/ark-scene/index.ts` (which clip plays, frame by frame), and the rig blocks of `src/ark-scene/animal-material.ts` (skinning and the head look on the bones).

## What it reads

- **The contract** is AnimalDex `docs/ark/rig-v2-manifest.md` (branch `ark-rigging`).
- **Sets.** `ark-rig/v2/manifest.json` first (`ARK_RIG_VERSION`), then `ark-rig/v1` (`ARK_RIG_FALLBACK`) for every species v2 doesn't list, and for any v2 file that fails to load.
  - A v2 manifest counts only when it says `version: 2`.
  - Until v2 is uploaded, everything is read from v1. That costs one 404 per visit.
- **Flight** plays only when the manifest says `flight: true` **and** the species' entry says `flight_approved: true`.
- **Look.** The look turns the entry's `look` chain: `M_neck · R_neck` and `M_head · R_neck · R_head`, rotations in the rest pose about each joint. It is clamped to the chain's `limits_deg` and split by `share`.
  - A v1 file has no `look`. Its own `neck` and `head` bones are turned within the contract's per-plan limits.
  - Its input is intelligence's `arkLook` (yaw +x, pitch + up, weight; `docs/ark/intelligence-review-30.md` section 6).
  - On a rigged mesh that has a chain, the shader's vertex turn is off, so the head never turns twice.
- **Development.**
  - `?models=local` reads the local build. `?rigv=vN` reads another set; `?rig=0` turns rigs off.
  - `ARK_RIG_DEV_ROOT=<build dir>` serves a test set's `rig/publish-vN` through the dev route.

## Which clip plays (`rigFor`)

In this order:

1. **In the air on a rig that flies.** A take-off as it leaves the ground. Then `flightClip`: flap to climb, glide down, `bank_l`/`bank_r` into a turn, soar, hover, and flap and glide by turns in the species' `glide_share` on the shared clock. Then a landing as it comes down, after which it walks with its wings closed.
   - **No open-wing loop.** A flyer with no flap holds an open-wing loop (`flight_fallback_open`). With no open-wing loop either, it holds its take-off's last frame.
   - **Range.** A flying rig is drawn near, and rigged, 20 m further off than the near level, through its landing.
2. **Places and water.** Canopy, microhabitat, burrow, the depth band in the water, and walking on land.
3. **The reactive layer's action** (`reactiveClip`).
   - `flee` plays run, or walk while still slow, by distance. The distance pace allows up to 3.5×; flee is capped at the gait's 2.5×.
   - `sentinel` plays scan, or the upright idle when there is no scan.
   - `withdraw` and `freeze` play the idle, and the reactive crouch lowers the body.
4. **Watching.** An animal watching something (scan, the camera, alert, sentinel, kin, a predator) doesn't play graze, browse or scan, so the look lifts its head. While it does graze or browse, the look only turns the head sideways.
5. **A behaviour recipe's named state** (`recipeClip`, the table below).
6. **The schedule's beat** (`beatClip`):
   - bite and chew play graze, or browse while it browses (the two are never swapped);
   - peck and drink play graze;
   - scan plays scan, and shake plays `shake_off`;
   - `enter_water` and `exit_water` play their clips.
7. **Otherwise the idle.**

The clip is chosen on a pace eased over about 0.2 s, so a stepped path never flips clips frame by frame. The phase of a moving clip follows the real distance covered.

Take-off, landing and the water clips have their own body offset taken off (`PATH_CARRIED_CLIPS`). The path, and the depth band in the water, keep the body's place.

## Behaviour recipe states: mapped vs fallback

The recipes lane's 70 named states (`ARK_RECIPE_STATES`, `docs/ark/behaviour-recipes.md`). A test (`src/lib/ark-rig.test.ts`) holds every state to exactly one of the two lists.

### Mapped: a clip expresses it (`RECIPE_CLIPS`, 32 states)

| State(s) | Clip (first the rig has) | Plays |
|---|---|---|
| walk | walk, slither, hop | by distance |
| run, charge, clash | run, walk | by distance |
| stalk, crawl, wade, carry, push | walk (crawl: or slither) | by distance |
| climb | climb | by distance |
| swim | swim, slither | loop |
| leap | leap | once |
| fly | flap, glide | loop (the flight machine when it is in the air on its rig) |
| glide | glide, soar | loop |
| hover | hover | loop |
| takeoff, land | takeoff, land | once |
| slide, slip_in, dive_in, launch | enter_water | once |
| haul_out, hop_out | exit_water | once |
| surface | surface | once |
| scan | scan | loop |
| peck, eat, pick_up, place | graze (head down) | loop |
| perch | perch | loop |
| shake, bathe | shake_off | once |

### Fallback: no clip yet, so the block's beat plays (`RECIPE_FALLBACK`, 38 states)

| State | Fallback beat | What plays today |
|---|---|---|
| strike, swipe, scoop, upend, pull, beat_prey, tool | bite | graze (head down) |
| sweep, probe, drum, dig, mark | peck | graze (head down) |
| display, pushup, call | scan | scan |
| dance, fight, rear, box | play | idle |
| groom, groom_other, wing_dry | preen | idle |
| bury, roll, dust_bathe, wallow, bask, stretch, yawn, float_back, rest, incubate | rest | idle |
| sleep | sleep | idle, slowed (and the material's droop) |
| crouch, freeze | pause | idle (with the reactive crouch) |
| plunge, strike_feet | glide | glide on a flying rig, else the procedural flight |
| dive | swim | the water branch's swim or idle |

### Clips that would add the most (for the rigging lane)

Ordered by the recipes' use (`behaviour-recipes.md`, "States with the most use"). The first items are the biggest gains:

1. **groom** (a preen: the head to the flank or back). It also serves `groom_other` and `wing_dry` (with the wings half open).
2. **call** (the head up, the bill or mouth open). `display` and `pushup` can use a variant of it.
3. **strike** (a fast lunge of the head). `scoop`, `swipe` and `beat_prey` are close relatives.
4. **fight / clash** (the heads down and pushing: the stags' rut).
5. **display** (the posture: the wings, crest or tail spread).
6. **dig** (the forepaws scraping). `mark` is a scrape too.
7. **dust_bathe, wallow, roll** (lying down and rolling).
8. **upend** (dabbling: the head under, the tail up) and **dive** (from the surface).
9. **plunge** (wings folded, nose down; the recipe already gives the attitude).
10. **bask, sleep** (lying flat, and the head tucked).

## Recordings

```
node scripts/ark-rig-scenes.mjs --set <publish dir> --out <dir> [--scenes duck_flight,duck_flight_far,duck_water,deer_graze,deer_look,herd_flee,meerkat_sentinel] [--stills 3,6] [--perf]
```

- The page script is `src/ark-scene/rig-scenes-entry.ts`. It uses a cast-only snapshot with pinned shared paths, a local rig set as v2, and the live v1 set as the fallback (read only). Nothing is uploaded.
- It writes a video, stills a little after each clip change, and a per-frame trace of each watched animal's clip, head yaw and reactive action.
- `--perf` measures a crowd of 24 grazers with rigs on and off, on the desktop and on the phone proxy.
