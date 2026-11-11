# Ark behaviour recipes: the engine, the recipes, the specific behaviours

Branch `ark-behaviour-recipes` (landing), on top of `ark-behaviour`. The brief is the owner's "rich animal behaviours from our stored data", saved at `animaldex-ark-handover-2026-11-11/ark/queued/behaviour-recipes-brief.md`. Step 1, the data, is in `docs/ark/behaviour-data-report.md`. The review sample of 40 species is in `docs/ark/recipes-review-40.md`.

**Visual only:**
- The server's ecology decides every arrival, meal, birth and death; nothing here reads or writes the server.
- Everything that varies is seeded from ids, slots and the time, so every viewer sees the same thing.
- No `Math.random`, no per-viewer state in the shared layer.

## Files

| File | What it is |
|---|---|
| `src/ark-scene/behaviour-blocks.ts` | the 71 building blocks: motion, named animation states, far beat, attitude, near-only detail |
| `src/ark-scene/recipe-templates.ts` | the 48 recipe templates: block sequences as data (targets, timings, catches, carried things, when they may run), plus crossing styles and sleeping postures |
| `src/ark-scene/behaviour-recipes.ts` | the engine (pure): species rows, seeded sex, goals for the schedule, episodes laid over the schedule's pose, pairs, murmurations, V-formations, crossings, postures, nests, marks; the other lanes' sources |
| `src/ark-scene/recipes.json` | the compact rows the scene reads (234 KB, 2,555 species) |
| `data/ark/behaviour-recipes.json` | the full data: every behaviour found with its phrase, and every recipe with its source |
| `src/ark-scene/recipe-scene.ts` | the near-only detail (three.js) |
| `scripts/ark-behaviour-recipes.mts` (+ `-text`, `-load`, `-compose`) | the generator, its validation (it stops on an unknown block, template, style or posture), `--summary`, `--review` |
| `src/ark-scene/recipes-entry.ts`, `scripts/ark-recipe-clips.mjs` | the clip page and recorder (development only) |
| `src/lib/ark-behaviour-recipes.test.ts` | the tests |

**Regenerate** (read-only exports; the queries are in `ark-behaviour-load.mts`):
```
npx tsx scripts/ark-behaviour-recipes.mts species.json extra.json intel.json [--summary out.json] [--review docs/ark/recipes-review-40.md]
```
Recipes are regenerated whenever a species' stored text changes: the rows come from the text by rules, with no hand edits.

## How it works

1. **Goals.** The schedule asks for a slot's goal through one hook in `rawIntent`, `recipeIntent(…)`.
   - A recipe may take the slot only when the schedule picked a behaviour the template `replaces`. A kingfisher's forage or perch becomes "perch_plunge"; a goose's forage becomes "dabble". So each species keeps its profile's time budget.
   - The chance is the recipe's weight × 0.7 × its season factor, with the hour and the sex checked first.
   - The goal is a place: a low perch with open water within reach, the water's edge, open water, bare ground, bark, a rock top, or its nest. The trip there is the schedule's own, and the stay has no steps, so where the slot ends is unchanged.
2. **Episodes.** `poseOnTrip` is now `episodePose(basePoseOnTrip(…))`.
   - An episode is a list of keys: block, from, to, start and end, heading, carried thing, catch, prey. It is built once per trip (memoised) from the template:
     - targets are resolved in the world, seeded by the animal and the slot;
     - travel times come from distance and the animal's own pace, by block;
     - hold times are drawn in the template's bounds;
     - steps loop while time allows, then the tail.
   - It starts from the schedule's pose. Its last key goes to the schedule's live pose, and the last 0.6 s blend, so nothing ever snaps.
   - A stay with no recipe goal (rest, groom, perch, bask, watch) may still run a "here" template: groom, preen and stretch, stretch and yawn, call, bask broadside to the sun, dry its wings, bury itself.
3. **Pairs** (contests, courtship, grooming each other).
   - `wireRecipes` pairs each male with the nearest other male of its species within 45 m (contests), a male with the nearest female (courtship), and neighbours in rank in a group (allogrooming). It is deterministic from ids and homes, and runs from the scene's `wireSchedules`.
   - A pair meets in a window of world time: one per 10-minute period in its mating season, one in four periods when no season is stored, none out of season. The window is seeded by the pair's key, so both sides work out the same one.
   - The keys' timings come from the pair's seed and the pair's own geometry, at the slower one's pace, so both sides stay in step: they meet, clash and part together.
   - Roles: "a" is the dominant (the dominance stat, then the id) or the male; "b" retreats after a contest. A step for the other role is a hold of the same length.
4. **Flocks.**
   - A murmuration (starlings) runs over its flock leader's roost at dusk (island hours 17.45–18.25). Each bird is a point of a closed-form shape that stretches, turns and drifts, with the birds circling inside it and density waves through it. Catalogue birds use their own index; the scene adds 360 ambient flockmates from the same function near the camera.
   - V-formation (geese, cranes, ibises): a follower in the air takes its V slot behind its leader, easing in and out over 8 s.
5. **Crossings, after and postures.**
   - On the schedule's enter-water and exit-water legs, the species' style replaces the plain wade:
     - in: slide (penguins), slip (crocodiles, monitors, turtles, seals), dive (otters, beavers, frogs, cormorants) or launch (ducks, coots, grebes);
     - out: haul (seals) or hop (penguins).
   - After climbing out: shake (mammals; never turtles), preen (birds), bask (reptiles), dry the wings (cormorants) or nothing (hippos, elephants, amphibians).
   - Asleep: its posture (one leg, head tucked, hanging, curled, afloat, standing, huddled) as the act's state: head down for a hanging bat, upside down for a sloth.
6. **Near and far.**
   - Positions and attitudes are the same function at every level of detail, so nothing jumps.
   - The far version is the block's `beat`, which the existing clips and the far shader motion already read.
   - Near the camera (the scene's near level, within about 45–90 m), `recipe-scene.ts` adds the carried catch or material, splashes, dirt and dust, holes, mounds and hollows (pure from its last slots, so a late viewer sees the same ones), nests growing, the ambient school it chases, insects, and a murmuration's flockmates.

### Hooks in other lanes' files

**`behaviour-schedule.ts`** (behaviour lane), kept small:
- `recipe` and `owner` on intents and trips;
- the `recipeIntent` call in `rawIntent`;
- `poseOnTrip` wrapping the renamed `basePoseOnTrip` (internal callers use the base);
- `forgetSchedules` also forgets recipe memos;
- three small exports: `tripEpisode`, `recipeMarks`, `recipeNest`;
- the `KIT` object at the end.

**`index.ts`:**
- the `RecipeScene` (made, stepped, cleared, disposed);
- `wireRecipes` in `wireSchedules`;
- the act's pitch and roll added to the schedule pose's (the bird models stand, so flight's 0.95 stays and a plunge adds 1.35);
- the water band skipped while an act owns the pose (a diving seal, a wading heron);
- the seeded sex's size on the drawn length.

### Rules the code keeps

- **Behaviour-only catches are ambient.** Templates can only catch `fish`, `insect`, `worm`, `shellfish`, `nut` or `seed` (`PreyKind`). The scene draws those as decoration (`recipe-scene.ts`: a small school, insects), never as catalogue animals. A test checks every template. A catalogue animal still only disappears through the server's meal event, acted out with the chase in `acts.ts` (unchanged).
- **Contests are non-lethal.** They are all between males of one species, in its mating season where stored. The worst outcome is the loser walking away.
- **Turned off** (`setRecipesEnabled(false)`), the schedule's pose stands exactly (tested).

## The building blocks

The named states are the rig player lane's to map to clips. Unmapped, a block plays its beat's clip (bite, scan, shake, enter_water…) or the shader motion. All 70 states:

`bask, bathe, beat_prey, box, bury, call, carry, charge, clash, climb, crawl, crouch, dance, dig, display, dive, dive_in, drum, dust_bathe, eat, fight, float_back, fly, freeze, glide, groom, groom_other, haul_out, hop_out, hover, incubate, land, launch, leap, mark, peck, perch, pick_up, place, plunge, probe, pull, push, pushup, rear, rest, roll, run, scan, scoop, shake, sleep, slide, slip_in, stalk, stretch, strike, strike_feet, surface, sweep, swim, swipe, takeoff, tool, upend, wade, walk, wallow, wing_dry, yawn`

| Block | What | Motion | States | Far / fallback beat | Near-only detail |
|---|---|---|---|---|---|
| `walk` | walk to | travel (ground) | walk | walk | - |
| `run` | run to | travel (ground) | run | run | - |
| `stalk` | stalk (low, slow) | travel (ground) | stalk | stalk | - |
| `swim` | swim to | travel (line) | swim | swim | - |
| `fly` | fly to | travel (arc) | fly, glide | fly | - |
| `climb` | climb to | travel (line) | climb | climb | - |
| `crawl` | crawl to | travel (ground) | crawl | walk | - |
| `wade` | wade (slow steps in the shallows) | travel (ground) | wade | walk | - |
| `take_off` | take off | travel (rise) | takeoff | fly | - |
| `land` | land | travel (line) | land | fly | - |
| `go` | go there its own way (fly, swim, climb or walk: chosen by the engine) | travel (ground) | walk | walk | - |
| `follow` | follow (in line or beside) | travel (ground) | walk | walk | - |
| `flee` | flee (to cover, water or a tree) | travel (ground) | run | run | - |
| `leap` | leap (a pounce, a mousing jump) | travel (leap) | leap | play | - |
| `dive_air` | dive from the air into the water | travel (plunge) | plunge | glide | splash (end) |
| `dive_feet` | drop feet-first onto the water | travel (plunge) | strike_feet | glide | splash (end) |
| `dive` | dive from the surface | travel (dive) | dive | swim | bubbles (start) |
| `surface` | surface | travel (line) | surface | swim | spray (end) |
| `slide_in` | slide in on the belly | travel (line) | slide | enter_water | splash (end) |
| `slip_in` | slip in low and slow | travel (line) | slip_in | enter_water | - |
| `dive_in` | dive in from the bank | travel (leap) | dive_in | enter_water | splash (end) |
| `launch` | launch onto the water (paddling) | travel (line) | launch | enter_water | spray (during) |
| `haul_out` | haul out | travel (line) | haul_out | exit_water | - |
| `hop_out` | leap out onto the shore | travel (leap) | hop_out | exit_water | spray (start) |
| `scan` | look and scan | hold | scan | scan | - |
| `ambush` | wait in ambush (still) | hold | crouch | pause | - |
| `hover` | hover | hold | hover | fly | - |
| `strike` | strike (a lunge of the head or bill) | hold | strike | bite | - |
| `swipe` | swipe with a paw | hold | swipe | bite | splash (during) |
| `scoop` | scoop with the bill | hold | scoop | bite | splash (start) |
| `sweep` | sweep the bill side to side | hold | sweep | peck | spray (during) |
| `upend` | up-end (head under, tail up) | hold | upend | bite | spray (start) |
| `probe` | probe the ground with the bill | hold | probe | peck | dirt (during) |
| `pull` | pull (a worm from the ground) | hold | pull | bite | - |
| `peck` | peck | hold | peck | peck | - |
| `drum` | drum or hammer on wood | hold | drum | peck | chips (during) |
| `eat` | swallow or eat | hold | eat | chew | - |
| `beat_prey` | beat the catch on a branch or rock | hold | beat_prey | bite | - |
| `pick_up` | pick up | hold | pick_up | peck | - |
| `carry` | carry (in the mouth, bill, feet or on the back) | travel (ground) | carry | walk | - |
| `place` | drop or place | hold | place | peck | - |
| `dig` | dig (dirt flies; a hole or a mound) | hold | dig | peck | dirt (during); hole |
| `push` | push or roll an object | travel (ground) | push | walk | - |
| `tool` | use a tool (a stone, a stick) | hold | tool | bite | - |
| `display` | display (posture, wings, crest, tail, throat) | hold | display | scan | - |
| `pushup` | push-up display | hold | pushup | scan | - |
| `dance` | courtship dance (bow, leap, turn) | hold | dance | play | - |
| `call` | call | hold | call | scan | - |
| `fight` | fight, non-lethal (clash, push, wrestle) | hold | fight | play | dust (during) |
| `clash` | run at a rival and clash | travel (ground) | charge, clash | run | dust (end) |
| `rear` | rear up | hold | rear | play | - |
| `box` | box or kick standing up | hold | box | play | - |
| `scent_mark` | scent mark (rub, scrape) | hold | mark | peck | dirt (during) |
| `groom` | groom or preen itself | hold | groom | preen | - |
| `groom_other` | groom another | hold | groom_other | preen | - |
| `bathe` | bathe (splash in the shallows) | hold | bathe | shake | splash (during) |
| `bury` | bury itself (sand, mud) | hold | bury | rest | sand (start); hollow |
| `shake_off` | shake off water | hold | shake | shake | spray (start) |
| `roll` | roll on the ground | hold | roll | rest | dust (during) |
| `dust_bathe` | dust or sand bathe | hold | dust_bathe | rest | dust (during); hollow |
| `wallow` | wallow in mud or water | hold | wallow | rest | mud (during); hollow |
| `bask` | bask (flat, broadside to the sun) | hold | bask | rest | - |
| `wing_dry` | spread the wings to dry | hold | wing_dry | preen | - |
| `stretch` | stretch | hold | stretch | rest | - |
| `yawn` | yawn | hold | yawn | rest | - |
| `float_back` | float on the back | hold | float_back | rest | - |
| `sleep_pose` | sleep in its posture (one leg, head tucked, hanging, curled, afloat) | hold | sleep | sleep | - |
| `freeze` | freeze | hold | freeze | pause | - |
| `perch` | perch | hold | perch | rest | - |
| `rest` | rest | hold | rest | rest | - |
| `incubate` | sit on the nest | hold | incubate | rest | - |

## The recipe templates

Species counts are of the 2,555 aboard: by phrase, by taxon rule, or as a flagged body-plan default.

| Template | What | Species | Kind | Goal | Stands in for | When | Blocks |
|---|---|---|---|---|---|---|---|
| `perch_plunge` | plunge-dives from a perch for fish | 8 (5 phrase, 3 rule, 0 default) | stay | perch_water | forage, perch, fly, wander, hunt | day | perch → scan → take_off → dive_air → surface → take_off → fly → beat_prey → eat (repeat from step 1) |
| `air_plunge` | plunge-dives from the air (terns, gannets, boobies, the brown pelican) | 13 (10 phrase, 3 rule, 0 default) | stay | water | forage, fly, soar, swim, wander | day | take_off → fly → hover → dive_air → surface → eat → swim (repeat from step 1) |
| `talon_grab` | snatches fish feet-first (the osprey, fish eagles) | 8 (7 phrase, 1 rule, 0 default) | stay | perch_water | forage, perch, fly, soar, hunt | day | perch → take_off → fly → hover → dive_feet → take_off → fly → eat |
| `wade_spear` | wades and spears fish (herons, egrets, storks) | 29 (26 phrase, 3 rule, 0 default) | stay | edge | forage, drink, wander, hunt | - | wade → ambush → strike → eat → wade → wade (repeat from step 2) |
| `bill_sweep` | sweeps its bill through the shallows (spoonbills, avocets, flamingos) | 7 (4 phrase, 3 rule, 0 default) | stay | edge | forage, drink, wander | - | wade → sweep → wade → wade (repeat from step 2) |
| `pouch_scoop` | scoops fish with its pouch (pelicans) | 5 (5 phrase, 0 rule, 0 default) | stay | water | forage, swim, fly | day | swim → scan → scoop → eat → swim (repeat from step 2) |
| `dabble` | dabbles and up-ends (ducks, swans) | 53 (27 phrase, 26 rule, 0 default) | stay | water | forage, swim, graze | - | swim → upend → swim → swim (repeat from step 2) |
| `surface_dive` | dives from the surface for fish (grebes, cormorants, loons) | 20 (9 phrase, 11 rule, 0 default) | stay | water | forage, swim, dive | - | swim → dive → surface → eat → swim → swim (repeat from step 2) |
| `chase_fish` | chases fish underwater (penguins, seals, otters, dolphins) | 52 (25 phrase, 27 rule, 0 default) | stay | water | forage, swim, dive, hunt, wander | - | dive → swim → strike → swim → strike → surface → eat → swim (repeat from step 1) |
| `river_fish` | fishes at the river (bears, the fishing cat) | 5 (3 phrase, 2 rule, 0 default) | stay | edge | forage, drink, hunt | - | wade → ambush → swipe → eat → wade → wade → shake_off → walk (repeat from step 2) |
| `shell_tool` | floats on its back and cracks shellfish on a stone (sea otters) | flock or crossing | stay | water | forage, swim, dive, rest | - | dive → surface → float_back → tool → eat → float_back (repeat from step 1) |
| `pounce` | stalks and pounces (a mousing leap) | 56 (27 phrase, 29 rule, 0 default) | stay | ground | forage, stalk, wander, hunt | - | stalk → freeze → scan → leap → dig → eat (repeat from step 1) |
| `hawk_insects` | sallies from a perch to snap insects in the air | 74 (58 phrase, 16 rule, 0 default) | stay | perch | forage, perch, fly | day | perch → take_off → fly → fly → beat_prey → eat (repeat from step 1) |
| `hover_drop` | hovers and drops onto prey in the grass (kestrels) | 4 (4 phrase, 0 rule, 0 default) | stay | ground | forage, fly, soar, hunt | day | take_off → fly → hover → leap → eat (repeat from step 1) |
| `worm_pull` | runs, stops, listens and pulls worms | 16 (12 phrase, 4 rule, 0 default) | stay | ground | forage, graze | day | run → scan → probe → pull → eat (repeat from step 1) |
| `probe_feed` | probes mud and soil with its bill | 40 (33 phrase, 7 rule, 0 default) | stay | ground | forage, graze, wander | - | walk → probe → probe (repeat from step 1) |
| `root_dig` | digs and roots for food | 132 (126 phrase, 6 rule, 0 default) | stay | ground | forage, graze, wander | - | walk → dig → eat (repeat from step 1) |
| `drum_bark` | drums and chisels on bark (woodpeckers) | 7 (5 phrase, 2 rule, 0 default) | stay | bark | forage, climb, perch | day | drum → scan → drum → peck (repeat from step 1) |
| `cache_food` | buries food to come back to (squirrels, jays) | 59 (55 phrase, 4 rule, 0 default) | stay | ground | forage, wander | day | pick_up → go → dig → place → dig → scan → go (repeat from step 1) |
| `stick_tool` | uses a stick to probe for food (crows, chimpanzees) | 10 (10 phrase, 0 rule, 0 default) | stay | bark | forage | day | pick_up → tool → eat → tool → place |
| `groom_self` | grooms or preens | 1016 (54 phrase, 0 rule, 962 default) | stay | here | rest, groom, perch, watch | - | groom → scan → groom |
| `preen_stretch` | preens, stretches a wing, ruffles | 680 (41 phrase, 0 rule, 639 default) | stay | here | rest, groom, perch | - | groom → stretch → groom → shake_off |
| `stretch_yawn` | stretches and yawns | 687 (2 phrase, 0 rule, 685 default) | stay | here | rest, groom, watch | - | stretch → yawn → rest |
| `bathe` | bathes in the shallows, then shakes and preens | 581 (0 phrase, 0 rule, 581 default) | stay | edge | drink, groom, rest | day | walk → bathe → walk → shake_off → groom |
| `dust_bathe` | dust-bathes in a scraped hollow | 52 (4 phrase, 48 rule, 0 default) | stay | bare | groom, rest, bask | day | dig → dust_bathe → shake_off → groom |
| `wallow` | wallows in mud at the water's edge | 47 (35 phrase, 12 rule, 0 default) | stay | edge | groom, rest, drink | - | wallow → walk → shake_off |
| `roll` | rolls on the ground | 9 (0 phrase, 9 rule, 0 default) | stay | bare | groom, rest | day | roll → shake_off → rest |
| `bask_sun` | basks broadside to the sun | 227 (148 phrase, 79 rule, 0 default) | stay | here | bask | day | bask |
| `wing_dry` | spreads its wings to dry | 5 (4 phrase, 1 rule, 0 default) | stay | perch | perch, rest, bask | day | wing_dry → groom |
| `bury_sand` | buries itself in sand or mud | 49 (49 phrase, 0 rule, 0 default) | stay | here | rest, hide | - | bury |
| `pushup` | push-up display on a rock | 36 (10 phrase, 26 rule, 0 default) | stay | rock | bask, rest, watch | day, male | pushup → display → scan (repeat from step 1) |
| `strut_display` | struts and displays (tail, wings, crest, pouch) | 86 (86 phrase, 0 rule, 0 default) | stay | ground | wander, forage, rest | day, mating, male | display → walk → display → call (repeat from step 1) |
| `call_bout` | calls or sings | 699 (699 phrase, 0 rule, 0 default) | stay | here | rest, perch, watch, groom | - | call → scan → call → rest (repeat from step 1) |
| `scent_mark` | scent-marks its ground | 25 (25 phrase, 0 rule, 0 default) | stay | ground | wander | - | walk → scent_mark → scan → walk → scent_mark |
| `antler_clash` | stags roar, walk side by side and clash antlers (the rut) | 20 (12 phrase, 8 rule, 0 default) | pair | here | - | dawn_dusk, mating, males | walk → call → call → walk → walk → fight → fight → flee(b) → call(a) |
| `horn_clash` | rams rear and run head-on into each other | 66 (16 phrase, 50 rule, 0 default) | pair | here | - | day, mating, males | walk → display → rear → clash → shake_off → walk → rear → clash → shake_off → flee(b) |
| `jaw_spar` | gape and push chest to chest (hippos, elephant seals) | 5 (3 phrase, 2 rule, 0 default) | pair | here | - | mating, males | walk → display → walk → fight → display → flee(b) |
| `box_spar` | stand up and box (kangaroos, hares) | 14 (3 phrase, 11 rule, 0 default) | pair | here | - | mating, males | walk → rear → box → flee(b) |
| `lizard_contest` | rival males bob, show their sides and wrestle | 41 (11 phrase, 30 rule, 0 default) | pair | here | - | day, mating, males | walk → pushup → display → pushup → walk → fight → flee(b) |
| `wrestle` | rival males grapple and push | 89 (89 phrase, 0 rule, 0 default) | pair | here | - | mating, males | walk → display → walk → fight → flee(b) |
| `court_display` | a male displays to a female | 268 (268 phrase, 0 rule, 0 default) | pair | here | - | day, mating, mixed | walk → display(a) → scan(b) → dance(a) → rest(b) → call(a) → groom(b) |
| `court_dance` | a pair dances together (cranes, grebes, albatrosses) | 30 (22 phrase, 8 rule, 0 default) | pair | here | - | day, mating, mixed | walk → dance → call → dance |
| `allogroom` | two of a group groom each other | 64 (14 phrase, 50 rule, 0 default) | pair | here | - | any | walk → groom_other(a) → rest(b) → rest(a) → groom_other(b) |
| `murmuration` | a murmuration over the roost at dusk | 9 (9 phrase, 0 rule, 0 default) | flock | here | - | dusk | fly |
| `v_formation` | flies in a V or a line behind its leader | 43 (5 phrase, 38 rule, 0 default) | flock | here | - | - | fly |
| `nest_build` | carries material to its nest; the nest grows over the days | 309 (309 phrase, 0 rule, 0 default) | stay | nest | forage, perch, wander, rest | day, nesting | scan → go → pick_up → go → place → incubate (repeat from step 2) |
| `beach_nest` | hauls out at night, digs a pit in the sand and covers it | 9 (9 phrase, 0 rule, 0 default) | stay | edge | rest, swim, forage, sleep | night, nesting | crawl → dig → rest → dig → crawl |
| `dig_burrow` | digs at its burrow, throwing out a mound of earth | 55 (35 phrase, 20 rule, 0 default) | stay | ground | burrow, forage, rest, hide | - | walk → dig → scan → dig |

## Seeded sex

- **Assignment.** `sexLook(id, slug)` gives each animal its sex at the stored ratio. A hermaphrodite gets none. A colony insect is a worker: female, 2% male. A parthenogenetic species is (nearly) all female.
- **Size.** Drawn length is ×√ratio for the bigger sex and ÷√ratio for the other, so the species' mean size is unchanged. A stag at ×1.2 is about 1.1 times a hind's length, and a female hawk is bigger than the male.
- **Colour.** The duller sex gets `saturation` 0.72 and `value` 0.94 in `sexLook`. It is not applied in the renderer yet: the liveliness wiring lane owns per-instance colour.
- **Features** (antlers, mane, crest, dewlap, train…) are in the data for 486 species. Models are single meshes from photos, so a hind drawn from a stag's model still has its antlers. Drawing them needs per-sex model variants (assets lane).

**Requiring a male and a female to breed was not changed.** Breeding is the server's. What such a rule would do is in "What a male + female pair rule would do" below.

## Measured

**Cost** (Node, the fixture's 130 animals all posed every frame, the shared machine under load):

| Recipes | Pose time a frame |
|---|---|
| off | 0.93–1.07 ms |
| on | 1.73–2.17 ms |

- About 24 animals are in an act at a time.
- In the scene only near animals are posed every frame (far ones twice a second, icons once), so the real cost is a fraction of this.
- Episodes are memoised per trip, pair episodes per window.

## For the other lanes

### Rig player (`ark-rig-publish`)
- **Map the named states to clips.** The act's state is in `pose.act.state` for a scheduled animal, and `entry.recipeAct` for a house starling. The list is `ARK_RECIPE_STATES` (70), in the table above.
- **What you get until a state is mapped.** `pose.beat` is already the block's fallback beat (bite, scan, shake, enter_water…), so today's clip mapping keeps working.
- **States with the most use, in order:**
  1. `perch`, `scan`, `groom`, `call`, `fly`, `takeoff`, `land`, `plunge`;
  2. `wade`, `strike`, `eat`, `fight`, `display`, `dig`, `dust_bathe`, `wallow`;
  3. `upend`, `dive`, `surface`, `slide`, `slip_in`, `dive_in`, `launch`, `haul_out`, `hop_out`.
- **Body attitude.** The recipe already supplies it (`act.pitch`, `act.roll`, added to the schedule pose's in `fromSchedule`), so a clip needs only the limbs and head.

### Props (`ark-props`): nests
- **Wiring the props' nests.** Once the props' `nest-growth.ts` is in, add one line after the props mount in `index.ts`:
  ```ts
  setNestSource(nestSourceFromProps({sites: nestSites, stage: nestStage, arkDayAt: (epoch) => /* the Ark day at epoch, as props/index.ts arkDayNow */}));
  ```
- **What changes then.**
  - A builder carries its material to the props' nest for it (`sitter` = its id), and builds only while that nest's stage is under 1.
  - The fallback nest that `recipe-scene.ts` draws switches itself off (`hasNestSource()`).
  - Eggs and chicks stay the server's (`laid`/`birth` events, `nests.ts`): nothing here lays an egg.
- **Calendars.** The props stage runs on the Ark day (1 Ark year = 14 real days), while this branch's fallback runs on the stored nesting months of the real calendar. With the source wired, the props' calendar decides.

### Reef (`ark-graphics-reef`): fish schools
- **Wiring the schools.** Add one line when the reef lane is in:
  ```ts
  setFishSource((pos, radius, epoch) => fishSchoolsNear(pos, radius, epoch))
  ```
- **What changes then.** A chase and a plunge go to the nearest school, where it will be by then. A bait ball (`mode: "mill"`) is the obvious target for dolphins and gannets. With no school near (the lake has none yet), the recipe uses its own small ambient school, drawn by `recipe-scene.ts`.
- **Scattering (an input for their API, not done in their file).** Every frame, `recipeScene.chasers` lists where hunters are, as `{x, y, z, r}`. If `fish-render.ts` pushes each fish away from those points (as `recipe-scene.ts` does for its own school), the reef's schools will split round a seal and rejoin behind it. It stays pure: the chasers' positions are the shared schedule's.

### Intelligence (`ark-intelligence-web`)
- **Defence data.** The stored defences are extracted per species in `data/ark/behaviour-recipes.json` (`behaviours.freeze`, `flee_cover`, `flee_water`, `flee_tree`, `curl_shell`, `ink`, `stott`, each with its phrase). The flee envelope can use them to choose cover, water or a tree. Nothing here reacts to predators: that is `reactive.ts`.

### Liveliness wiring
- **Sex colour.** `sexLook(id, slug)` gives `saturation` and `value` for the duller sex (185 species), for the per-instance colour.
- **Wet and muddy looks.** A wallow and a bathe could drive a wet or muddy look: `act.recipe` is `wallow` or `bathe`, then its trip's stay continues.

### Behaviour (`ark-behaviour`)
- **Sea otter profile.** The sea otter's profile is `move: walk` with no swim, so the schedule walks it on land. Its stored text says it floats and dives for shellfish. With the profile fixed (`move: swim`, `moves: walk`), its `shell_tool` recipe takes over.
- **Starlings.** House starlings are micro animals (`microhabitats.json`: house), so they are off the schedule. Their murmuration is the one hook in `pose()` for micro animals.

## Clips (looked at frame by frame)

**How they were made.**
- `node scripts/ark-recipe-clips.mjs --out <dir> --clips kingfisher,stags,murmuration,nest,heron`, at 1280×720, high tier, headless Chromium on Metal.
- Each clip is a cast-only snapshot at a pinned hour. The page finds the moment with the engine's own pure functions, then steps a controlled clock frame by frame. The world time per frame is exact, so a one-second dive gets its every frame; the kingfisher is at half speed.
- Frames, video and contact sheets are in the lane's scratch folder `recipes/clips/` (the report gives the absolute paths). They are not committed.

| Clip | What it shows |
|---|---|
| **Kingfisher plunge-dive** (`common-kingfisher`, river_lake, 10:00) | Perched on a low branch on the bank, about 3.6 m over the water. It scans, takes off, and drops body-vertical, nose down (the plunge pitch on the standing model), into the water about 5.6 m out. It comes up with a fish crossways in its bill, flies back low with it, beats it on the branch and swallows. |
| **Stags clashing** (`red-deer`, 8 cast, 6 of them males by seeded sex; 6 October, 06:24, in the rut) | Two stags of the group leave it, walk to each other, roar and walk side by side. Then they turn head to head, antlers locked and heads down, pushing for about 8 s. They part, the loser walks off and the other roars. The clip is staged in the grassland for an open view (red deer live in the woodland zone, where trunks hid it). |
| **Murmuration** (`european-starling`, house starlings, 17:48) | Over the trees behind the cottage at dusk, 1,400 ambient flockmates and the catalogue starlings make one dense cloud. Over 30 s it changes shape: a long band at +5 s, a wide drifting cloud at +17 s, turned again at +28 s, with density waves through it. Seen from 90 m against the sunset. |
| **Nest growing** (`barn-swallow`, from 1 April, its nesting months) | The swallow flies in with mud, lands on its nest, places it and flies off. Stills on days 0.3, 1, 2, 3, 4 and 5.5 show the nest from a few pieces to a full ring with walls. Here it was on a rock: no house wall was within 12 m of its home. This drawing is the fallback until the props lane's nests are wired. |
| **Heron fishing** (`grey-heron`, wetland, 09:00) | It wades into the shallows, feet on the bottom, and stands still with small fish under the water round its legs. It strikes, and the school splits away from its bill. It holds a fish crossways, swallows, then wades on. |

**What I fixed from looking:**
- The plunge was too fast from a high bank (about 30 m/s at the water); it is now 4–20 m/s by height, gathering speed.
- Dives went to the water's very edge; they now go to open water at least 0.45 m deep.
- Perches by the water were 13 m up; they are now low first.
- The fish school popped in only at the strike; it is now there while the hunter waits. The fish were too big and above the surface; they are now sized to the hunter and kept under the surface.
- Nests were deep in tree crowns; they are now on low branches first.
- The murmuration was too sparse to read, and its flat birds vanished edge-on. It now has 1,400 birds, each with a body silhouette from the side, banking, at least a few pixels on screen, and the flock is over the treetops.

## What is left

**Not built:**
- **Insect clips in the scene's micro layer.** A house bee's swarm is drawn round its spot. The bee itself stays at its microhabitat; it does not fly in the swarm.
- **A cluster crawling on a wall.** Clusters (firebugs, lady beetles) are drawn on the ground at the animal's spot; a wall needs the surface normal.

**Needs another lane:**
- the rig clips for the named states;
- per-sex model variants (antlers, manes, trains): a hind is drawn from a stag's model;
- the props' nests wired, with their egg counts (`nestSourceFromProps`, one line).

**Data:**
- Shaking off, bathing and rolling have no phrases; they are body-plan rules or defaults.
- 625 species have nothing but calls in their stored text: body-plan defaults, flagged.

## What a male + female pair rule would do (harness; breeding NOT changed)

**What was run.**
- The real ecology module and harness (AnimalDex `supabase/functions/_shared/ark-ecology`, `scripts/ark/simulate.ts`), copied into this lane's scratch folder. Nothing in either repo changed.
- 40 seeds × 10 Ark years per scenario, breeding fallback `estimate`. Inputs were the traits and food links in the handover folder (2,507 species).
- **Today's rule:** the oldest adult pairs with the next oldest, whatever their sex.
- **The tested rule:** the oldest male with the oldest female, and so on. Sexes are seeded exactly as the scene seeds them (`sexLook`, from the animal's id and the stored ratio). Hermaphrodite and parthenogenetic species pair as today.

Medians over the 40 seeds:

| Scenario | Measure | Today | Male + female | Change |
|---|---|---|---|---|
| small (5 users) | births | 886 | 451 | −49% |
| | predator births | 45 | 4 | −91% |
| | meals | 910 | 476 | −48% |
| | animals at the end | 46 | 40 | −13% |
| | species at the end | 17.5 | 17.5 | 0 |
| | Ark health at the end | 81 | 88 | +7 |
| medium (50 users) | births | 7,795 | 3,461 | −56% |
| | predator births | 1,030 | 249 | −76% |
| | meals | 8,504 | 4,451 | −48% |
| | starved | 152 | 116 | −24% |
| | animals at the end | 331 | 319 | −4% |
| | species at the end | 163.5 | 162.5 | −1 |
| predator-heavy | births | 1,185 | 588 | −50% |
| | predator births | 266 | 78 | −71% |
| | meals | 1,858 | 1,192 | −36% |
| | animals at the end | 116 | 115.5 | 0 |
| | species extinct at the end | 6% | 5% | |

**Unchanged:**
- the harness verdicts (small PASS, medium PASS, predator-heavy WARN on predators, as today);
- the extinction and loss criteria;
- natural deaths;
- the species that were ever present.

**What it means:**
- **Births about halve, predators' most.** Over all the daily checks, more than half (11.1 million of 20.9 million) found the species' adults all one sex, and 2,083 species were blocked that way at least once. A species with two animals aboard has an even chance of never breeding.
- **Populations hardly change.** The population cap holds them, and the predators, with fewer young, eat about 40% fewer meals. So the Ark looks the same size, with about half the birth and egg events in the feed and story.
- **Colony insects nearly stop breeding.** Their animals are workers, 2% males; they would need their own rule (a queen, a colony) if the owner wants pairs.
- **Seasonal breeders lose more, with nothing in between.** Under the tested rule a pair, as well as a season, is needed.

**For the owner to decide:**
1. keep today's rule;
2. require a male and a female (births halve, as above);
3. require them only for species with sex differences stored (2,103 species) and keep "any two" for the rest.

This is a server change (ecology tick), so it needs its own migration and harness run if chosen.

## Round 2 (the coordinator's list, 2026-11-11)

### What each item does

| Item | What it does | Where |
|---|---|---|
| **Insect swarms** | 30 insect species get a swarm (17 by day: bees, wasps, hornets, locusts, dragonflies; 9 at dusk: mayflies, termites, ants) or a crawling cluster (4: firebugs, boxelder bugs, lady beetles). Their ambient flock-mates are drawn near the camera only (within 35 m): 90 insects a swarm, 40 a cluster, at least a pixel or so. Positions are pure in the time and the spot. | `swarm`, `swarm_dusk`, `cluster` templates; `swarmFlock`, `swarmPoint` |
| **Mixed flocks** | 24 species (tits, bulbuls, monkeys, impala, nilgai…) join the nearest flock, troop or herd of another species within 40 m, birds with birds. For 150 s a period, by day, a follower takes its own place at the other's side, in the air if it flies too, easing in and out over 12 s. | `mixed_follow`; `wireMixed`, `mixedPose` |
| **Molehills** | 7 species (moles, golden moles, mole-rats, zokors; not desmans). Burrow-placed animals are off the schedule, so the mounds are pure in the mole's id, its burrow and the time: a new mound every 5 minutes, 0.6–3 m from the burrow, shrinking into the ground over 40 minutes. Drawn within 50 m. | `molehills`; `molehillsOf`; the burrow loop in `stepRecipeScene` |
| **The duller sex** | The duller sex (185 species) is drawn greyer through the material's own dim (`arkInstance.y`, a grey-ward mix): `sexDim` = 1.1 × the saturation drop, at most 0.4. | `sexDim`; the `setXYZ` line in `index.ts` |
| **A sitter on its nest** | With the props lane's nests wired, a sitter with eggs or chicks has every slot go to its nest. Awake it sits (the `incubate_sit` episode); asleep it sleeps there. When the eggs hatch and the chicks leave, it goes about as before. | `sitterIntent`, one hook at the top of `plannedIntent`; `nestSourceFromProps` now carries `eggs` and `chicks` |
| **Bats hang** | Hangers (bats, sloths: posture "hang") roost under limbs, on the attach lane's `canopy_hang` points (891 on the fixture island): `recipeRoostTags`, one hook in `roostOf`. By day a bat sleeps there head down from its feet (a quarter turn nose down about the limb point); a sloth hangs level, upside down. | `world-sampler.ts` now maps `canopy_hang`, with `clearBelow` and `radius` |
| **The dusk emergence** | From 17:21 to 18:36 a bat's roost streams with 180 ambient roost-mates, pure in the time: each leaves on its own heading with a flutter, climbs, and is gone by about 60 m. The catalogue bats leave on their schedule. | `bat_emergence`; `emergenceFlock`, `emergencePoint` |
| **Night hunting** | Insect-eating bats sally after ambient insects at night (`bat_hawk`), and the greater bulldog bat trawls the water feet-first for fish (`bat_trawl`). Between sallies a flyer whose stay is a place in the air circles slowly (`airStay`), so a bat never hangs in mid-air. | `bat_hawk`, `bat_trawl`, `airStay` |
| **The coat** | A wallow leaves the coat muddy (wet 0.55, dust 0.9, drying over 20 minutes); a dust bath or a roll leaves it dusty (15 minutes); a bathe, a dive or a plunge leaves it wet (6 minutes, halved by a shake). It is pure in the animal's last 16 slots. | `coatOf`, `recipeCoat`, `applyRecipeCoat` |
| **The reef's schools** | Wired: `setFishSource(fishSchoolsNear)` at mount. | `index.ts` |

### For the integrator
- **Coat.** On release, `applyRecipeCoat(mesh.geometry, index, recipeNear.get(entry.animal.id)?.coat)` must come after `look.instance(...)`, which writes `arkCoat` first. It writes the larger of the look pass's value and the recipe's, so the two add up.
- **Sex colour.** The dim sits beside release's `arkVary` (saturation and brightness multipliers); the two compose. If the owner prefers it there, fold it into `varyOf`'s saturation and brightness instead (×0.72 and ×0.94 for the duller sex, from `sexLook`).
- **Props' nests.** Wire them with `setNestSource(nestSourceFromProps({sites: nestSites, stage: nestStage, arkDayAt}))`, with `sites` including each site's `eggs` and `chicks` (the props' `NestSiteInfo` has both). Then this branch's own nest drawing switches itself off (`fallbackNests()`).
- **Build test.** `ark-behaviour-build.test.ts`'s reference build maps `canopy_hang` too, as `world-sampler.ts` now does.

### Round-2 clips (looked at)
- **Swarm** (`giant-burrowing-mayfly`, 17:48): a cloud of pale mayflies dancing about 1.4 m over the ground in front of a dark trunk, shifting frame to frame. The insects are pale and lit, so the swarm reads at dusk; dark specks vanished against the ground.
- **Sitter on its nest** (`mallard`): the female, with 8 eggs in a stand-in props source, sits on her nest at the water's edge for the whole clip, settling now and then. Without eggs it went back to its day. She is drawn a little greyer than a drake: the duller-sex dim.
- **Bats:**
  - By day, the flying fox and the pipistrelles hang head down under the acacias' limbs, as dark folded bodies (`bats-day-crop.jpg`). A half-roll hang read as a bat lying on the limb, so bats now pitch nose down a quarter turn and sloths keep the half roll.
  - At dusk the roost's bats stream out against the sunset sky, wings beating, up and away (`bats-sky.jpg`).
  - Inside rainforest and woodland crowns the camera sees only leaves, so the clip is staged on the grassland's acacias.

## No spinning (the owner's "animals moving in circles", 2026-11-11)

Behaviour fixed the schedule's own circling (aa330fa8). On the merged release the remaining full turns all came from recipe episodes: 5.3% of moving windows against a limit under 1%. The causes:
- every key snapped the heading to its leg's direction (a hold started facing north);
- loop legs picked a spot anywhere round the anchor, so a seal chasing fish crossed a 4 m disc back and forth;
- every homecoming turned round on the spot to face the way it first arrived, just before its schedule set off another way;
- holds rocked big bodies 10–18 cm back and forth;
- strikes lunged out and back;
- a heron paced a short strip of shallows, hooking round at each end;
- a hawk shuttled nest material every 10 s;
- an eagle's every flight became a fishing trip;
- a camel cached food ("humps storing fat").

The rules now, all in `behaviour-recipes.ts`, pure and seeded as before:
- **Movers face their travel direction.** A leg is a curve that leaves along the heading it came in with (a quadratic; a hook out to the turning side when the target is behind, never a fold-back). It faces along the curve, its turn summed along it.
- **No snaps.** Each key starts from the last key's heading (`yawIn`); the first from its schedule pose's (`yaw0`). The build takes each key's exit heading from the pose function itself.
- **Eased turns at a rate by body size**: `turnRate(length)` = 1.8 / length^0.4 rad/s, between 0.7 and 3.5. A hold turns to what it faces (the water nearest its heading, the sun, its rival) at that rate. A solo leg takes at least as long as its turn needs.
- **Arrivals keep the heading they came in on.** A recipe stay's episode records `endYaw` and keeps it until the slot ends; the next slot turns from it as it sets off (`settingOff`). A walk to meet a rival comes in facing it. The leg home comes in along the schedule pose's heading when it arrives from behind it.
- **Chases pass through.** Loop legs go ahead (within 0.2 rad for prey, 0.3–0.35 for foraging), bending towards one slow loop over the episode (`plan`), so it comes back round rather than out and back. At the edge of its patch it bends back on the anchor's side. A small step with nothing ahead stays put.
- **Foraging goes mostly forward.** On the spot the body holds still: a dig, a peck, a sweep or a scrape is the head's and the clip's, and a dust bath is the roll's. (Rocking the body, even by 2.5 cm, turned a foraging meerkat's movement direction 33 times a minute; it is now 0.6.) It only bobs, and a strike lunges forward and goes on from there.
- **Timing:**
  - a long stay's episode ends 10 s before its slot, so the homecoming and the schedule's set-off are two turns kept apart;
  - an episode stops while it can still get home at its own pace (pairs keep their shared reserve);
  - a swimmer that flies swims from water to water.
- **Data:**
  - `talon_grab` replaces only forage and hunt (not flights or perching), half as often (a template's `often`): each fishing trip is an out-and-back U-turn in the air;
  - nest material trips come every half minute;
  - the caching rule no longer reads "storing fat", "buried prey" or "buried food", "burying seeds", "an open larder", or "reserves, caches". 51 real cachers keep `cache_food` (squirrels, jays, nutcrackers, kangaroo rats, hamsters, tits, corvids, mustelids, lynx, wolverine, the red fox, owls and kestrels with surplus prey).

Measured on this branch (fixture snapshot v2, every 20 s window of a day, as behaviour's test):

| | even-indexed (the test) | every animal | recipes off, every animal |
|---|---|---|---|
| facing loops | 0.28% | 0.32% | 0.18% |
| travel loops | 0.04% | 0.06% | 0.01% |

Flyers' turns a minute in the air: under 0.45 here (limit 0.5; 0.392 with recipes off).

On `origin/ark-release` 49345ee4 with this branch merged (local only, not pushed), every animal: facing loops 0.20%, travel 0.08%. Flyers: 0.458 turns a minute (0.441 with recipes off: the release's own flights turn more than this branch's). The behaviour, recipe, water, state and build tests pass there: 55/55. The merge's only conflict is the `behaviour-schedule` import line in `index.ts`: take the release's side, which already has every name this branch adds.

Tests: `no spinning` (six recipe species, every 20 s of their episodes under a full turn, no 0.2 s step over 0.9 rad) and `only real cachers cache`.

For behaviour: the landing at the end of a schedule flight can snap round (149° in a second, a fish eagle onto its perch). `settle` faces from home when none of the last four slots had a goal, not from where it flew in from. Behaviour's file; not changed here.

## Plunge dives and clip pace (after the home growth, 2026-11-11)

- **A kingfisher's dive went through a bank.** The home area grew, and its plunge perch ended up on a bank 11 m over the lake and 5 m back from it, so a third of its dives' midpoints were under the ground.
  - A plunge perch (`perch_water`) now needs open water within reach, a drop the diver dives from, and a clear way down (`plungeDrops`: about 4 body lengths up to 40, between 0.6 m and 12 m). The way down is the dive's own path, checked against the ground under it (`clearPlunge`).
  - A dive's target needs the same clear way down.
  - From too low, too high, or with nothing clear, it flies out over the water, hovers 1–2.5 s and plunges from there.
  - Plunges go straight down their line, with no leg curve.
  - Across four homes and three species (4,711 dives), none went through the ground, and 1,353 came after a hover. The kingfisher now fishes from a rock top in the lake.
- **Clip pace** (the release's rig check: a harbour seal swam its chase at 2.1× its clip's pace, at a fixed 0.3 m/s). A recipe's legs now go no faster than behaviour's corrected clip paces:
  - walking at `bodyLengthsPerSecond` (its walk's pace × 1.5);
  - running at that times `runFactor`;
  - swimming, diving and surfacing at its schedule's own swimming pace (`freeBodyLengthsPerSecond` × length × 1.4), with no floors;
  - a strike lunges no further than it runs in the strike's shortest time.
- **How the legs are timed:**
  - A solo leg is timed by its curve's length, not the straight distance. A template's upper time bound no longer speeds it up; pairs keep their bounds, the same on both sides.
  - Each leg's reach is scaled to about 8 s of its own pace (`LEG_SECONDS`).
- **The seal's chase:** median 0.165 m/s, its swimming pace (it was 0.3). Its chases are short and close: it covers little ground at that pace. Other swimmers sit at their caps: penguin 0.28, puffin about 1.1, mallard 1.8 m/s.
- **The loop plan is a half loop now:** out, round and back towards where it began, so the way home lies ahead.

Circling on this branch (with home growth b95b0026): every animal 0.18% facing, 0.06% travel; the test's half 0.10% / 0.04%. Flyers 0.446 turns a minute. New tests: `a plunge dive never goes through the ground`, `a recipe's legs go no faster than its clips carry it`.

## Turns on the spot, set-off and blocked ground (behaviour 16a098d1, release 3a6afbc5)

- **Turn on the spot first.** A solo leg more than 1.2 rad off its heading first turns on the spot, then sets off nearly straight. The turn is a `turn` hold, eased, no faster than 1.6 rad/s (behaviour's `TURN_RATE`); its rig plays its stand, through the `freeze` state's pause. A red fox's stalk round behind it had been a slow loop.
- **The leg home is a gentle arc.** It turns on the spot first when it must. A stay that keeps its homecoming heading comes in along its way; otherwise it lines up only when its way in is within 60° of that heading, so it never loops. A walk to meet a rival still lines up within 90°.
- **Set-off.** Behaviour's set-off now turns on the spot. So a recipe stay turns on the spot in its last seconds, from its homecoming heading to the way its next slot sets off (`departureYaw`). It keeps that heading through behaviour's own turn pause, or the first 0.85 s, then follows its schedule; it never turns on the move. A short stay's episode ends 5.5 s before its slot, which leaves time for that turn.
- **Turning budget:** a solo step that would turn it more than 3.2 rad in 20 s ends the loop, and it heads home with one turn. A puffin in the shallows had turned round to dive back, then again to go home.
- **Blocked ground:** recipe legs use the nav's own rule (a walkable cell, and `sampler.blocked` clear: the garden pond, rocks, buildings).
  - Ground targets need a clear straight way.
  - Curves are checked every quarter metre.
  - A blocked leg tries a gentle arc round either side, else stops at the edge.
- **Holds:** no hold shuffles the body (see above).

Measured with the release merged: circling, every animal, 0.15% facing and 0.02% travel. Flyers 0.464 turns a minute. Full npm test 2,243/2,243. New test: setting off after a recipe stay.

## Under one turn a minute in place (release 20cb95d1, the v2 clip pace)

- **A minute's turning budget.** A solo step may not take the last 60 s of turning past 5.4 rad (`MINUTE_BUDGET`). The count includes its way home as it would go from there, `homeTurning`: a turn on the spot and the curve's own turning, a detour round the shore included. Within its slot's last minute it also includes its last turn to the way it sets off. Steps are budgeted on the turning drawn along their keys (`keyTurning`), not just where they end up facing. The 20 s budget (3.2 rad) stays.
- **No pivot after arriving.** A stay that keeps its homecoming heading uses that heading on its leg home, even with nowhere left to go (it had turned on the spot to the stay's first heading as the episode ended). It heads for its fixed place, so its schedule pose bobbing on the water only moves it, never swings it round.
- **Stags square up.** A pair's walk up to its rival ends turning on the spot to face it, for the same time on both sides (`1.5π` over the larger one's turn rate, at most 1.6 rad/s), before the clash. With the new pace they had reached their fight still turning.
- **Measured** (behaviour's "an in-place activity barely turns", 13,763 minutes): 1 over, a grey heron's plain `watch` slot. It has no recipe and fails with recipes off too: behaviour's arrival turn and glances. The release had 184 minutes over.
- **Circling**, every animal: 0.17% facing, 0.01% travel. Flyers: 0.463 turns a minute.
- **New test:** no in-place episode turns more than once in any minute (nine species and recipes, sliding minutes, the last turn included).
