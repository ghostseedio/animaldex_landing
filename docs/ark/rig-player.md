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

The recipes lane's 70 named states (`ARK_RECIPE_STATES`, `docs/ark/behaviour-recipes.md`), mapped to the rig contract's clips: v5 (sections 3–4) and the v6 clips (section 8 on AnimalDex `ark-rigging-v6`).

- A test (`src/lib/ark-rig.test.ts`) holds every state to exactly one of `RECIPE_CLIPS` and `RECIPE_FALLBACK`.
- A mapped state whose clip a rig doesn't have (a v1 or v5 file, or another species) plays its block's beat, as a fallback state does.
- v6 clips with a `base` (lying, side, leaning) are entered and left only through their transitions (`baseStep`): `lie_down` / `get_up` (`get_up_fast` when startled), `side_down` / `side_up`, `drop` / `rise`.
- Aliases (`alias`) play the stand-in under the missing clip's name.

### Mapped (`RECIPE_CLIPS`, 63 states)

| State(s) | Clip (first the rig has) | Plays |
|---|---|---|
| walk | walk, slither, hop | by distance |
| run, charge | run, walk | by distance |
| clash | run, walk while it charges; `clash` where they meet (v6) | by distance, then once |
| stalk, crawl, carry, push | walk (crawl: or slither) | by distance |
| wade | walk, paddle (v6) | by distance |
| climb | climb | by distance |
| swim | swim, slither (loop), paddle (v6, by distance) | |
| leap | leap | once |
| fly | flap, glide (the flight machine when it is in the air on its rig) | loop |
| glide / hover | glide, soar / hover | loop |
| takeoff, land | takeoff, land | once |
| plunge | `plunge` (v6), also in the air | loop |
| slide, slip_in, dive_in, launch | enter_water | once |
| haul_out, hop_out | exit_water | once |
| surface | surface | once |
| dive | `dive` (v6), then the swim's paddle | once |
| upend | `upend` (v6) | loop |
| scan | scan | loop |
| peck, eat, pick_up, place | graze (head down) | loop |
| perch | perch | loop |
| shake, bathe | shake_off | once |
| sleep | sleep_one_leg, sleep_tuck, sleep_hang, sleep_curl, sleep_float, sleep_stand, sleep_side, sleep (v6) | loop |
| rest, incubate | lie, bask, rest_one_leg (v6) | loop |
| bask | bask, lie (v6) | loop |
| float_back | sleep_float (v6) | loop |
| groom, groom_other, wing_dry | groom (v6) | loop |
| call | call (v6) | loop |
| pushup | display, call (v6) | loop |
| display, dance | display (v6) | loop |
| strike, swipe, scoop, beat_prey, pull, probe, tool | strike (v6) | once |
| fight, box, rear | fight (v6) | loop |
| dig, mark, bury | dig (v6) | loop |
| dust_bathe, wallow, roll | dust_bathe, wallow, roll (v6) | loop |

### Fallback: no clip in v5 or v6 (`RECIPE_FALLBACK`, 7 states)

| State | Fallback beat | What plays |
|---|---|---|
| sweep, drum | peck | graze (head down) |
| crouch, freeze | pause | idle (with the reactive crouch) |
| stretch, yawn | rest | idle |
| strike_feet | glide | glide on a flying rig, else the procedural flight |

### Clips that would still add the most (for the rigging lane)

- **`stretch` and `yawn`:** short one-shots on standing and lying bases.
- **`sweep`:** the bill side to side, for spoonbills and avocets.
- **`drum`:** hammering, for woodpeckers.
- **`strike_feet`:** an osprey's feet-first drop.
- **A crouch:** for ambush and freeze.

### Asleep (the scene's state, not a recipe)

An animal asleep plays its rig's own sleep posture:
- `sleep_hang` when it hangs from the canopy, `sleep_float` on the water;
- else the first of sleep_one_leg, sleep_tuck, sleep_curl, sleep_stand and sleep that the file has (only its species' postures are in it), lying down first where the posture lies.

Without one, its idle, slowed. The `ark-sleep` lane codes against the same names.

### Sitting rigs

A rig whose entry has `pose` (54 species: meerkats, hares, kangaroos, squirrels, gibbons…) has no bone look at all, and the shader's turn is off for it too. Its chain runs through an upright trunk, so it would turn the chest (contract section 5).

Fleeing, such a rig plays `drop`, `bound` (by distance) and `rise` when its file has them (v6). Without a walk, a sitting rig isn't rigged while it moves: the cheap gait carries it.

## Lying and neck gates (lane ARK-POSE)

Checked as each rig loads (`prepareRigPoses` in `rig-player.ts`), on the rest mesh and the rows that will be drawn. No rig file changes.

### Lying (`locomotion/pose-gate.ts`)

Every lying clip of a four-legged rig is measured, a pilot rig's own included (they were never measured before):

- **Rump and shoulder:** each end's hip joints, lying over standing. A rump above 72% of its standing height fails, and so does one more than 22% higher than the shoulder came down to.
- **Support:** the lowest point of the rear half and of the front half, each within 5% of the standing height of the ground.
- **Hind paw:** no hind knee, ankle or sole more than 5% above its hip joint, and each hind leg's lowest point within 13% of the ground.

What a rig lies in:

1. Its own lying clip, when that passes and the posed lie is not at least 8% lower at the rump.
2. Else the posed lie (`locomotion/lie-pose.ts`), when it passes its own check and the gate. Each pair of folded legs is turned out by the least that takes it out from under the belly (`solveSplay`), so the belly meets the ground. A rig the solved turn fails is tried at the one fixed turn (25°), then with the tucked fold.
3. Else it stands (as the oryx): its lying clips are removed, and the scene sleeps it on its feet (`sleep.ts` `sleepsOnFeet`).

When the posed lie replaces a rig's own lying clip, the rig's other clips on that lying pose (the lion's lying `feed`, `groom`, `yawn`) are removed with it. A rig with no lying clip of its own keeps its `wallow` and `roll`; the gate does not measure those.

### Neck (`locomotion/neck-gate.ts`)

The measure is the 99th percentile of the neck's and the head's skin edges over their rest lengths. Edges under 1% of the mesh's size (slivers, as for the birds) and edges a limb holds are left out. The limit is 1.6. The head's own skin (edges both of whose ends the head holds by half or more: the face) is read the same way against 1.25.

- **The look's caps, per class:** primates 80° yaw, grazers and browsers (a rig with a `graze` or `browse` clip) 60°, the other four-legged rigs 70°. The neck's share of the turn is the one of 0.45, 0.6, 0.3, 0.75 (and the file's own) that keeps the rig furthest inside the two limits.
- **A rig over the limit at its caps** gets them lowered by 0.85 a step, down to a quarter of the class's.
- **A clip's share of the look** (`RigClipData.lookShare`): a clip that holds the head 25° or more from rest takes the largest of 1, 0.6, 0.3, 0 of the look that keeps the neck within the limit (or within 3% of what the clip alone does). A clip that holds the head 60° or more from rest (the posed sit, a graze, a drink) takes none: the look's axes are the rest pose's, and on a bowed head they are no longer its yaw and pitch. `rigLookShare` applies the share where the scene sets the look.
- **The primates' posed sit** (`locomotion/sit-sleep-pose.ts` `SIT_SHAPES`): the first shape bends the neck's one joint 110° to 130°. A rig whose neck that tears takes the bend on the head's joint, then a smaller bend with the back hunched further forward.

- **The clips' own head turns** (`bird-neck.ts` `capHeadYawRows`): a row whose head is turned further round from the chest than the rig's look goes (a groom back to the flank is 75° on most rigs) has its neck's and head's yaw scaled back to that cap. A row within the cap is left exactly as it is.

Not changed: how far a clip takes the head down or up (a graze or a drink reaches the ground, 90° to 100° from rest). The scan reports each clip's stretch.

### The scan

```
npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-census.mts <dir of <slug>.glb> <out.jsonl> [--off] [--part k/n]
npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-sheet.mts <dir> <out.png> <slug,slug> <clip,clip> [--off]
```

`--off` (`globalThis.__arkPoseGate = false`, the harness's `?posegate=0`) is the load as it was before the lane. The sheet draws any clip from three sides without a browser.

## Recordings

```
node scripts/ark-rig-scenes.mjs --set <publish dir> --out <dir> [--scenes duck_flight,duck_flight_far,duck_water,deer_graze,deer_look,herd_flee,meerkat_sentinel] [--stills 3,6] [--perf]
```

- The page script is `src/ark-scene/rig-scenes-entry.ts`. It uses a cast-only snapshot with pinned shared paths, a local rig set as v2, and the live v1 set as the fallback (read only). Nothing is uploaded.
- It writes a video, stills a little after each clip change, and a per-frame trace of each watched animal's clip, head yaw and reactive action.
- `--perf` measures a crowd of 24 grazers with rigs on and off, on the desktop and on the phone proxy.
- With `--query cast=<slug>:<plan>`: `pose_<slug>` (stand, walk, rest, sleep; `orbit=19,27` takes the camera once round the sleeper) and `look_<slug>` (its head turned as far as its look goes, standing, then asleep).
