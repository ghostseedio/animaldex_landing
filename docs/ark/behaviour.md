# Ark behaviour: walk check, the state fix, and NPC-style behaviour

Branches (landing): `ark-behaviour-state` (Part 2, small, ships alone) and `ark-behaviour` (Part 3, on top of Part 2, `ark-rig-publish` and `ark-graphics`). Visual only: the server and the ecology still decide every arrival, meal, birth and death.

## Part 1: rigging readiness (the walks in the real Ark scene)

### From the rigging run (v4, `~/animaldex-talking-models/rig/manifest.json`)

2,465 species: 2,080 passed, 271 partial, 114 fallback. Grouped by what each can do in the scene today (the flight clips stay held, `ARK_FLIGHT_APPROVED` unset):

| Readiness | Species |
|---|---|
| Roam now: a passing walk/run/slither/swim/hop with feet sliding under 0.1 of a stride | 1,648 |
| Roam, feet slide 0.1–0.25 of a stride (fine at tap distance, visible very close) | 264 |
| Shader motion by design (fish without a swim clip, jellies, cephalopods, "other": no clips made for these plans) | 377 |
| Fallback (nothing that moves passed: shader motion and a glide) | 114 |
| Stationary: sitting rest pose, idle only | 54 |
| Stationary or perch only (idle/perch, no ground clip) | 5 |
| Clips pass but missing from the publish build (3 flightless birds) | 3 |

Per body plan:

| Plan | Roam now | Roam (slide) | Shader by design | Fallback | Sitting | Idle/perch only |
|---|---|---|---|---|---|---|
| quadruped | 359 | 43 | | 33 | 38 | 1 |
| flying_bird (walk/hop/perch; flight held) | 456 | 115 | | 2 | | |
| fish | 27 (swim) | | 278 | | | |
| flying_insect (walk; flight held) | 166 | 9 | | 13 | | |
| insect | 154 | 13 | | 9 | | |
| lizard | 84 | 20 | | 6 | | |
| legless | 84 | | | 11 | | |
| arachnid | 75 | 6 | | 2 | | |
| primate | 52 | 9 | | 1 | 16 | 3 |
| amphibian | 40 | 12 | | 15 | | 1 |
| turtle | 45 | 12 | | 6 | | |
| walking_bird | 44 | 11 | | 7 | | |
| crustacean | 51 | 6 | | 3 | | |
| flightless_bird | 7 | 5 (+3 unpublished) | | 5 | | |
| bat | 4 | 3 | | 1 | | |
| cephalopod_jelly | | | 28 | | | |
| other | | | 71 | | | |

**All 114 fallbacks** are listed with their failure reasons in `scratchpad/behaviour/part1/fallbacks.json` (by plan: quadruped 33, amphibian 15, flying_insect 13, legless 11, insect 9, walking_bird 7, lizard 6, turtle 6, flightless_bird 5, crustacean 3, arachnid 2, flying_bird 2, bat 1, primate 1). Every species' readiness group is in `scratchpad/behaviour/part1/readiness-lists.json`.

Loop seams: no clip in the manifest has a seam over 0.02 of its length.

### In the scene (43 species, the rig lane's player on the graphics batch 1 terrain)

Method: `scratchpad/behaviour/part1/rig-check.mjs`. The 43 species (2–8 per plan, smallest to largest, a partial in each plan that has one, two fallbacks) were put aboard in their zones at noon. The camera flew to each, the rig lane's own wander was made to walk it three body lengths, and for 6 s the script recorded the rig's weight and clip, the root's speed, and the ground under its front, back and sides. Then a close shot and a tap-distance shot. Contact sheets: `scratchpad/ark/web-shots/behaviour/part1/sheet-close-{1,2,3}.jpg`, `sheet-tap-{1,2,3}.jpg`; numbers: `results.json`.

| Plan | Species | Rig | In scene | Walk (body lengths/s) | Speed-stat pace | Ground gap front/back (m) |
|---|---|---|---|---|---|---|
| quadruped | eurasian-harvest-mouse | passed | walk | 0.25 | 0.94 | 0.01 |
| quadruped | eastern-gray-squirrel | passed | walk | 0.24 | 1.13 | 0.03 |
| quadruped | bush-dog | passed | walk | 0.26 | 1.36 | 0.06 |
| quadruped | serval | passed | walk | 0.15 | 1.52 | 0.13 |
| quadruped | walia-ibex | passed | walk | 0.09 | 1.29 | **0.40** |
| quadruped | bairds-tapir | passed | walk | 0.07 | 1.33 | 0.02 |
| quadruped | african-bush-elephant | passed | walk | **0.05** | 1.13 | 0.20 |
| quadruped | ords-kangaroo-rat | partial (sitting) | idle | – | 1.10 | 0.00 |
| flying_bird | bee-hummingbird | passed | idle on its flower | – | 1.33 | 0.00 |
| flying_bird | bali-myna | passed | walk | **0.04** | 1.37 | 0.00 |
| flying_bird | roadside-hawk | passed | perch (canopy) | – | 1.40 | 0.01 |
| flying_bird | wandering-albatross | passed | idle (afloat) | – | 1.52 | 0 |
| flying_bird | great-horned-owl | partial | hop | 0.48 | 1.41 | 0.19 |
| primate | mohol-bushbaby | passed | walk | 0.10 | 1.22 | 0.00 |
| primate | mountain-gorilla | passed | walk | **0.02** | 1.23 | 0.27 |
| primate | philippine-tarsier | partial | walk | 0.23 | 1.08 | 0.01 |
| lizard | cape-dwarf-chameleon | passed | walk | 0.18 | 0.71 | 0.01 |
| lizard | saltwater-crocodile | passed | walk | **0.01** | 1.19 | 0.02 |
| lizard | eastern-collared-lizard | partial | idle (microhabitat) | – | 1.37 | 0.06 |
| insect | big-headed-ant | passed | walk/idle (microhabitat crawl) | – | 0.71 | 0 |
| insect | moss-mimic-stick-insect | passed | walk/idle (microhabitat) | – | 0.73 | 0.03 |
| insect | brazilian-treehopper | partial | walk | 0.04 | 0.80 | 0 |
| arachnid | assassin-spider | passed | walk/idle (microhabitat) | – | 0.70 | 0 |
| arachnid | japanese-spider-crab | passed | **no rig at sea** | – | 0.77 | – |
| crustacean | common-pill-woodlouse | passed | walk/idle (microhabitat) | – | 0.66 | 0 |
| crustacean | american-lobster | passed | **no rig at sea** | – | 0.85 | – |
| amphibian | american-toad | passed | walk | 0.13 | 0.92 | 0.00 |
| amphibian | mossy-frog | partial | idle/walk (microhabitat) | – | 0.87 | 0 |
| walking_bird | common-wood-pigeon | passed | walk | **0.04** | 1.41 | 0.06 |
| walking_bird | great-tinamou | partial | walk | 0.04 | 1.43 | 0.01 |
| flightless_bird | gentoo-penguin | passed | **rig refused (facing)** | – | 1.16 | 0.04 |
| flightless_bird | african-penguin | partial | idle | – | 1.05 | 0.12 |
| bat | egyptian-fruit-bat | passed | walk | 0.50 | 1.37 | 0.01 |
| flying_insect | peacock-butterfly | passed | walk/idle on a flower | – | 0.99 | 0 |
| flying_insect | asian-honey-bee | partial | walk/idle | – | 1.02 | 0 |
| legless | common-rotifer | passed | idle, no rig | – | 0.61 | 0.02 |
| legless | green-anaconda | passed | **slither never faded in** | – | 0.92 | 0.04 |
| turtle | common-spider-tortoise | passed | walk | 0.28 | 0.68 | 0.01 |
| turtle | leatherback-sea-turtle | passed | idle | – | 1.13 | 0 |
| fish | commersons-dolphin | passed | under water: not checked from above | – | 1.50 | – |
| fish | blue-whale | passed | swim (under water) | – | 1.19 | – |
| legless | bobbit-worm (fallback) | fallback | shader | – | 0.73 | – |
| flightless_bird | macaroni-penguin (fallback) | fallback | shader | – | 1.05 | 0.04 |

What I saw on the sheets and in the numbers:

1. **Wrong speed for size (every rig).** The walk clips have very short strides: the median passing walk moves 6% of the body length a stride, at 0.05–0.2 body lengths a second (flying birds 0.05, lizards 0.06, walking birds 0.04, quadrupeds 0.19). The speed stat's pace is 0.6–2.2 body lengths a second. In the scene the player moves the feet by the distance walked, so nothing slides, but an elephant crosses 0.18 m a second and a crocodile barely moves. The stride tuning in v4 (walk 0.55 → 0.4 → 0.28 → 0.2 of leg height) made the walks shorter still. **Fix needed in the rig run:** longer walk strides (towards 0.3–0.5 body lengths for quadrupeds), with the checks re-run. Until then, the behaviour schedule never moves an animal faster than 2.5× its rig's fastest ground clip (the cap above which the player's feet slide; `gait` in `behaviours.json`). Its home area shrinks so every trip still fits in its time.
2. **Slopes: the body stays level.** On mountain and bank slopes the front or back feet float or sink 0.2–0.4 m (walia ibex 0.40 over 1.4 m, gorilla 0.27, elephant 0.20, owl 0.19). Part 3 pitches walkers to the ground's slope along their heading (±0.45 rad).
3. **Turned birds lose their rig.** The rig player refuses a rig whose facing differs from the near model's (`rig.facingDeg` vs `model.facing`). The 14 birds that `rig_ark.py` turned (three penguins, owls, the steppe eagle…) stay procedural; the gentoo penguin is one of them. This is a rig-lane fix: read the facing node, or re-export those near.glb files turned.
4. **Sea floor and under water.** Crabs and lobsters in the sea zones get no rig (the player only walks rigs on land), so their passing walks are never seen. Swimmers were not checked from above the water: the camera only goes under for a selected swimmer.
5. **Legless.** The anaconda's slither loaded but never faded in. It is placed in the wetland's water (`place.water`), and the player only plays ground clips on dry land.
6. **Small animals at their microhabitats** (ant, spider, woodlouse, butterfly, bee, mossy frog) load their rigs but crawl by the microhabitat motion, not the rig's wander. Close up, the camera ends up inside grass blades and flower petals that are huge at their scale. The graphics lane's near detail swaps are the fix for that.
7. Nothing looked broken at tap distance (10–15 m) for the land walkers. The sitting partials (kangaroo rat) idle correctly. No visible loop pops.

### Recommendation

- **Roam now (ground walking on the schedule):** the 1,648 "roam now" species, and the 264 with 0.1–0.25 slide (at tap distance and further). That holds with two caveats: they walk slowly until the strides are lengthened, and on slopes they need the Part 3 pitch.
- **Stay on their spot, idle or shader motion:** the 54 sitting-pose species, the 5 idle/perch-only ones, the 114 fallbacks, and the 377 shader-by-design swimmers and "other". Part 3 still moves them on the schedule (swimmers swim, sessile ones stay put) with the shader motion, which is how they look today.
- **Flyers:** walk/hop/perch rigs only. Flight stays the shader glide until the owner clears the wing cards.
- **Before turning rigs on widely:** fix the turned birds' facing (14 species), let rigs play on the sea floor and in shallow water, and re-run the walks with longer strides.

Many species are not broken: 1,912 have a usable ground clip. So Part 3 went ahead.

## Part 2: one behaviour state (the hawk bug)

**Branch:** `ark-behaviour-state` (ed156b50), small, so it can ship on its own.

**Cause.**
- The scene sent a selected flyer down to its spot. For canopy birds that spot is a tree, so the hawk "jumped into a tree" when tapped.
- Separately, the tap card worked out "Asleep now" from a clock of its own.

**Fix.**
- Each animal has one state (`behaviour-state.ts`), and the animation targets, the card (`onBehaviour`, `handle.behaviour`) and follow all read it.
- Selecting or following is not an input to it. A flying bird stays in the air and the camera goes up to it. A moth at the porch light stays there.

**Test.**
- `ark-behaviour-state.test.ts` takes a fixture sample over 48 hours of the day: the animation and the card always agree.
- An in-scene check made 50 selections over 5 hours and found 0 mismatches.

On `ark-behaviour` the state comes from the schedule (below): asleep is the schedule's sleep, flying is its pose in the air, breathing is the sea's breath cycle. The same test still holds.

## Part 3: NPC-style behaviour (branch `ark-behaviour`)

### Behaviour profiles (all species, stored data only)

- **Generator.** `scripts/ark-behaviour-profiles.mts` uses deterministic keyword rules and taxon priors, with no AI calls. Its inputs are all stored data:
  - a read-only export of the live catalogue: `voyage_species`, `voyage_species_traits`, `species_field_guide`, taxonomy, and the parent species' text for breeds;
  - the rig manifest (body plan, the clips that passed, the gait);
  - the map lane's B1 microhabitat inventory;
  - `voyage_food_links`, for predator spacing.
- **Output.**
  - Full profiles with a source for every field: `data/ark/behaviour-profiles.json` (2,626 species; 2,555 aboard and not excluded). A source is one of:
    - `{field, phrase}`: the verbatim stored phrase that decided it;
    - `{rule}`: from the body plan or the taxonomy;
    - `{default}`: no data, so the body-plan default, flagged in `defaults`.
  - The compact rows the scene reads: `src/ark-scene/behaviours.json`.
  - Who eats whom, as the scene needs it: `src/ark-scene/food-links.json`.
- **Fields.**
  - movement: primary and secondary;
  - activity and day rhythm (two peaks, siesta);
  - roost; social structure; diet;
  - behaviour weights: rest, wander, forage, graze, drink, perch, soar, fly, swim, dive, bask, burrow, climb, groom, hide, flee, flock, visit_flowers, circle_light, stalk;
  - places used: drink_edge, bask_rock, graze_grass, perch_branch, perch_rock, dig_soil, leaf_litter, flower, porch_light, cave_mouth, cliff_ledge, sea_dive, tide_pool, bark, wall, burrow_mouth, reeds, water_surface, reef, shade;
  - flight altitude band; surface crawling (any surface, or upside down too);
  - air-breathing; seabed walking;
  - size, speed, dominance, and the rig's gait.
- **Defaults.** The fields most often filled from body-plan defaults, among live species, are social and roost, followed by activity and diet. Each is flagged.
- **Hand-read audits.** Two Sonnet subagents each read 50 random profiles against their stored text.
  - The first audit drove the rule fixes: taxon priors, larval sentences ignored, words about prey or anatomy no longer counted, roost word collisions fixed, flower visits only for nectar feeders.
  - The second audit (after the fixes) found these fields WRONG or MISSING out of 50: move 7, activity 3, roost 7, social 3, diet 6, behaviour weights 13, places 19.
  - Its rule bugs were fixed in the generator: family extras, the large-bird soar default, nectar from "flowers", "pack ice", "dig a nest", negations like "cannot", the spider/gecko upside-down rule, eels and seals, bottom-dwellers, insect swarms.

### Performance (fixture page; headless Chrome, Metal; machine shared with other lanes, load average about 30)

| | 200 on | 200 off | 1,000 on | 1,000 off |
|---|---|---|---|---|
| Desktop 1440×900, whole Ark: fps (p95 frame ms) | 77 (28.9) | 75.6 (30.2) | 78 (28.5) | 65.8 (33.5) |
| Desktop, close: fps (p95) | 100 (23.5) | 112.7 (14.5) | 104 (16.0) | 85.5 (25.6) |
| Phone proxy (412×915 at 2.6×, CPU 4× slower), whole: fps | 75.3 | 50.6 | 29.0 | 20.5 |
| Phone proxy, close: fps | 73.6 | 71.9 | 32.5 | 27.1 |
| Schedule main-thread ms a frame (desktop / phone) | 0.10–0.18 / 0.58 | – | 0.45–1.0 / 3.9–4.5 | – |

- **Level of detail.** Near animals and the one looked at are posed every frame; far models twice a second; icons once a second. It is the same function at every rate, so nothing jumps.
- **Memo.** Intents and trips are memoised per world, clock, animal and slot.
- **Cost (fixed).** Before the level-of-detail fix, icons were posed every frame: 9–10 ms a frame at 1,000 animals on desktop, and 47 ms on the phone proxy.
- **Load.** Building the places and the walk grid takes 0.58 s on desktop and 2.6 s on the phone proxy, once at load. That is a main-thread stall; it is the next thing to move to a worker or chunk.
- **Noise.** The on/off differences are within the noise of the shared machine.

### Recording and stills

- `scratchpad/ark/web-shots/behaviour/day-night/day-night.mp4`: four moments at 10× (dawn, midday, dusk, night) and a whole island day in 20 s, with the island hour and the counts of what the animals are doing written over it.
- `sheet-day-night.jpg`.
- `still-{graze,drink,perch,swim,watch,sleep,stalk}.png` and `sheet-stills.jpg`.
