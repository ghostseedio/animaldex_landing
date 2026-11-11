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
- **Load.** Building the places and the walk grid took 0.58 s on desktop and 2.6 s on the phone proxy, in one main-thread stall at load. Since 2026-11-11 it is built a slice at a time between frames (Part 4).
- **Noise.** The on/off differences are within the noise of the shared machine.

### Recording and stills

- `scratchpad/ark/web-shots/behaviour/day-night/day-night.mp4`: four moments at 10× (dawn, midday, dusk, night) and a whole island day in 20 s, with the island hour and the counts of what the animals are doing written over it.
- `sheet-day-night.jpg`.
- `still-{graze,drink,perch,swim,watch,sleep,stalk}.png` and `sheet-stills.jpg`.

## Part 4: 2026-11-11 (sliced build, profile audit, the shore, spacing, wariness)

The scripts and files named "in the lane folder" below (the checks, the blind sample and its judgements, the scenario, the browser measurement) are in `/Users/lennybeadle/animaldex-ark-handover-2026-11-11/behaviour-2026-11-11/`. The profile generator's inputs are the same read-only export, rig manifest and B1 inventory as before.

### The places and walk grid, built between frames

- **How.** `behaviour-build.ts` cuts a build into small tasks (`SlicedBuild`). `world-sampler.ts` `sceneSamplerTasks` and `behaviour-nav.ts` `navCellTasks` are the old builds' loops as tasks, a row or a chunk each, in the same order. `ScheduleWorldBuild` (`behaviour-schedule.ts`) runs the sampler, then the grid. The scene steps it 6 ms a frame.
- **Not a Worker.** The scene is bundled twice: by Next for /ark, and by esbuild as an IIFE for the apps' WebView. A worker would need its own entry in both, and the props lane calls the graphics lane's `allAttachPoints` synchronously at mount anyway. Generators were ruled out too: the tsconfig targets es5, so `next build`'s type check rejects `function*`.
- **Identical.** `src/lib/ark-behaviour-build.test.ts` holds a verbatim copy of the old builds. It checks, sliced as finely as possible (one row or chunk a step) and all at once:
  - the places: same points, ids, order, version, obstacles, heights;
  - the walk grid: byte for byte (sha256 of walk, steep, depth, height).
- **In the scene.**
  - Animals on the schedule wait unseen until the world is built, and so does their wiring (`wireSchedules`).
  - `loading()` is true while it builds.
  - A recording (`recording: true`: the clip recorder, the golden shots) builds it at once, so recordings are unchanged.
  - `worldSampler()` asked for mid-build finishes the build at once (correct, but a stall).
  - Stats: `behaviourBuildMs`, `behaviourBuildSlices`, `behaviourBuildLongestMs`.
- **Measured.** Headless Chrome on the fixture (`?fixture=1`), two runs each, on a shared Mac with a load average of about 28. The phone proxy has its CPU 4× slower.

| | Before (one task) | After (sliced) |
|---|---|---|
| Desktop: main-thread build time | 354 / 443 ms in one stall | 333 / 395 ms in 44 / 51 slices, longest 56 / 60 ms |
| Phone proxy: main-thread build time | 1,828 / 2,287 ms in one stall | 1,366 / 1,499 ms in 139 / 164 slices, longest 218 / 254 ms |
| The page's longest task at load (the mount, which held the build) | desktop 2.37 / 2.80 s; phone 12.9 / 17.0 s | desktop 1.54 / 1.76 s; phone 7.6 / 7.7 s |

- **The longest slice** is the graphics lane's `allAttachPoints` (one task: it is theirs, and the props lane calls it too). It is 3.7 s of the 4.0 s sampler build in node under load; every other task is a few ms. Slicing it is the graphics lane's change: it has a 40,000-try `surfaceAt` loop.

### Behaviour profiles: a systematic audit, rules fixed

- **Bugs from intelligence.**
  - The phrase clipper dropped a field's first letter ("nsects"). A break that isn't found is index -1, and -1 + 2 is 1. 4,778 of 7,861 source phrases were clipped; now 0.
  - Swifts were "filter" from "aerial plankton". Filter feeding now needs a sieve: the text's filter, sieve, strain or baleen words, a baleen whale, flamingo or filter shark family, or a sessile animal. Penguins, petrels, auks and seals that catch krill are fish eaters.
- **Systematic checks.** `audit_checks.py` in the lane folder runs cross-field rules over every live species, for example:
  - a water animal with a land roost;
  - a roost taken from a feeding clause;
  - a tree roost for an animal that can't climb or fly;
  - an amphibious animal with no land place;
  - grass for a water grazer.

  Suspects: 308 of 2,555 at 3df4bcc5, and 83 after. The rest are mostly false alarms of the checks (a lizard's "basking at the mouth of the crevice" is its roost).
- **Rules fixed** (in `scripts/ark-behaviour-profiles.mts`, never species one by one):
  - **Roost.** The roost is read from the sleep text clause by clause. A clause about feeding, basking or breeding doesn't count (the starling's nest hole, the galah's "feed on the ground").
  - **Hollows.** "Hollows" is a tree's only when the text says so. Scrapes, snow hollows and hollow logs are on the ground.
  - **Water animals** never sleep on land: their crevice, burrow or cave is the bottom, or the reef on a coral reef.
  - **Haul-out.** Seals, sea lions, the walrus and penguins (and text that says "haul out", "ashore" or "on the ice") get roost and place `shore`: water edges and rock tops.
  - **Climbing.** Arboreal mammals climb first (the koala). Anything that sleeps in a tree, or in a tree nest, climbs to it. Hoofed mammals never roost in trees.
  - **Flight.** Walking-plan birds (doves, pigeons, tinamous) fly unless their text says they can't. Seabirds perch on rocks, never branches.
  - **Diet.**
    - The species' own name is masked: white-tailed deer, frogs and monkeys were "meat" from their names.
    - Prey words now include hares, voles, mice and the like.
    - An insect's or amphibian's diet leaves out sentences about its young (butterflies were "insects" from "Caterpillars eat…").
    - "Grazes algae" is algae.
    - Sea mammals' clams are fish-eater food.
  - **Activity.** "Morning and late afternoon" is a day animal's two peaks, not twilight. 60 species, cattle among them, were crepuscular from it.
  - **Social.**
    - Group words about something else don't count: "schooling fish", "swarms of krill", "colonies inside trunks", "feral colonies".
    - Social is never read from the diet text.
    - Sharing a shelter means a group.
  - **Water crustaceans.** Shrimps and prawns swim. Lobsters, crayfish and horseshoe crabs walk the bottom.
  - **Crocodilians** swim.
- **Blind sample.** 50 random live species (seed 20261111), none in either earlier audit and none I had looked at. I judged them from the stored text alone, before reading either profile, as acceptable values per field and must or must-not behaviours and places. Files: `blind50*.json`, `score_blind.py`.

| 7 fields × 50 species | Fields wrong | Species with any field wrong |
|---|---|---|
| 3df4bcc5 (before this session) | 19 of 350 (5.4%): roost 8, social 4, diet 3, places 3, activity 1 | 16 (32%) |
| After the first rules (5bb2318b), still blind | 15 of 350 (4.3%) | 13 (26%) |
| After fixing what the sample found (75368bc0), **not blind** | 1 of 350 (the humpback "school") | 1 |

  Judged this way, my error rate is lower than the second Sonnet audit's (about 17% of fields). My judgement accepts any reasonable value; theirs was stricter. Read the before and after on the same scale.

### Land and water, grazing (headless, the fixture over an island day, plus a shore cast)

The scenario script is `scenario.ts` in the lane folder. Each animal is posed every second for a day.

- **Water animals ashore.** Seals, sea lions, the walrus and penguins haul out: the cast spends 45–60% of the day on land.
  - They go in by `enter_water` slides: 54 of 57 entries for the gentoo, 63 of 63 for the California sea lion.
  - They come out by `exit_water` (57 of 57 for the gentoo) or by walking up out of the shallows. They rest and bask on the shore.
  - Sea turtles stay in the water (green turtle: 0 crossings). They come ashore only to nest, which is a server event.
- **Freshwater turtles** (slider, snapping turtle) and crocodilians cross at edges, and bask on rocks or banks.
- **Teleports fixed.**
  - A path whose ends shared a grid cell kept only its goal.
  - A route's mid-way pause from the water took no time.
  - Both snapped animals 9–15 m. The worst one-second step anywhere is now 6.9 m (a penguin swimming), and a test checks every amphibious animal second by second for four hours.
- **Grazing.** Grazers spend 84% of their grazing time head down: bite 57%, chew 27%, scan 8.5%, step 7.4%. The clips come from the rig lane: graze, browse and scan for the beats; enter_water, exit_water and shake_off at the shore.

### Spacing, variety, prey that react

- **Spacing.** Predators are kept at least `SAFE_METRES` = 20 m (was 10) beyond both reaches. On the fixture over a day, the closest predator to prey is 38.5 m at spawn and 29.2 m over the whole day. No sample is under 20 m.
  - **Lions and zebras.** The animal-look lane saw lions among zebras in golden shots on ark-release, which had 10 m spacing. On this branch the closest lion to a zebra over a whole fixture day is 29.2 m, by the island clock and at the golden shots' pinned 10.5 h alike.
  - **The drawn place moves too.** Spacing used to live only in the schedule. A moved predator's place, and its group's places by the same shift, now move with its home. A still view (reduced motion), or anything posed from the place, keeps the distance.
  - **Until spacing is wired,** every animal that goes on the schedule stays unseen, reduced motion included.
  - **Server acts** (a meal's chase) are not on the schedule, so they still play.
- **Variety.** Groups of 3 or more are all doing the same thing for 5.4% of awake moments, under the 15% target. Counting a flock or colony asleep together at night it is 24.8%: herds and troops keep a night watch, flocks sleep together.
- **Shared wariness** (`threatAt`, `wireThreats`, flee-envelope.md §6.3.3).
  - A prey animal that can see an awake predator (within `WARY_METRES` = 35 m) at its slot's start goes to the far side of its range and watches it, facing it.
  - This is decided from the predator's own schedule, so it is the same for every viewer, the livestream and the overview included.
  - Only top predators are threats (ones nothing aboard eats), so no schedule waits on one that waits on it.
  - Near the camera, the local layer adds the look, the alarm and the dash on top. The schedule never yields per viewer, as the envelope says.

### Ported from ark-release (590ac94f, by hand: ark-release must not be merged into this branch)

- **`behaviour-schedule.ts`.**
  - `keepInWater`: a water-only animal's every goal is in the water, under the surface.
  - The roost check: a water-only animal's roost point counts only under water.
  - Both are verbatim. This branch's own guard (a water-only animal gets no land roost tags) runs before them.
- **New files:** `src/ark-scene/schedule-water.ts` and `src/lib/ark-schedule-water.test.ts`, verbatim.
- **`index.ts`.** `makeSched` keeps held species (the frigatebird) off the schedule. The import line is release's own.
  - Release's pose and rig hunks use the rig player's code, which is not on this branch. They are left to merge in from release unchanged.
- **es5.** The `[...map.keys()]` fix was already here.

### Interfaces added (other lanes)

- **`behaviour-schedule.ts`.** `ScheduleWorldBuild`, `SAFE_METRES`, `WARY_METRES`, `threatAt`, `wireThreats`, `ScheduleThreat`. `ScheduleAnimal.threats` is optional and set by `wireThreats`.
- **`behaviour-nav.ts`.** `navCellTasks`, `navGridBuild`, `NavCells`, `NavGrid.cells`. `NavGrid`'s constructor takes optional prebuilt cells.
- **`world-sampler.ts`.** `sceneSamplerTasks`, `worldSamplerBuild`, `worldSamplerReady`.
- **`behaviour-profile.ts`.** Roost `shore`, and interaction `shore` (appended: index 20, `k` in `behaviours.json`). No existing name changed. `doing` names are unchanged (intelligence reads them). `stalk` is a shared slow walk to the edge of its own range on its prey's side (flee-envelope §6.2 relies on it); `flee` stays weight 0.
