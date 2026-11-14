# Ark behaviours pass 2026-11: land animals on foot (lane B4)

The owner's brief: "do a full animal behaviours pass ensuring animal locomotion, predatory, hunting, hunger, behaviour
etc. is as natural as possible". This lane: how land animals move over the ground. Branch `ark-beh-land`, from landing
`origin/main` c99ff83b. Visual only: nothing here changes the server, a migration, production data or the shared
positions module.

**The short answer.** The gait engine (lane L1) draws the right gait for whatever speed an animal moves at, with
planted feet. What was wrong was the speed, the timing and the route it was given:

1. **Every animal walked at its rig's walk clip's pace in body lengths, at its true size.** An elephant "walked" at
   3.4 m/s, a giraffe at 5.1, a horse at 3.2, an ostrich at 3.3, a giant tortoise at 0.85, and the engine, reading the
   speed, drew an amble, a pace, a trot and a run. On the fixture of every catalogue land species 180 of 777
   vertebrates' everyday walk was drawn as a faster gait; 47 of 52 turtles walked faster than their own top speed.
2. **Walks had no beginning and no end.** Full speed from the first frame, a dead stop at the last; every turn on the
   spot at 90 degrees a second whatever the animal's size.
3. **Ways were ruler lines.** Four ground legs in five were one straight run; where a path had a corner, the animal
   took it at a point.
4. **The 54 sitting rigs** (rabbits, hares, wallabies, squirrels, meerkats, gibbons) slid along sitting up when they
   moved, and at rest played a two-second idle and nothing else. 56 animals of 17 such species are aboard.
5. **Small animals strolled.** A mouse, a wall lizard, a plover and a spider walked as steadily as a cow.

All five are fixed by rule (body plan, gait family, leg length, size), with tests and registered metrics.

## How it was measured

No browser: the Mac's load average was between 300 and 1,000 through the lane, so nothing was recorded or looked at
by eye. Everything below comes from the pure schedule and the gait engine's own ladders.

| Tool | What it does |
|---|---|
| `scripts/ark-ground-legs.mts` (new) | Every animal of a snapshot on the behaviour schedule, wired as the scene wires it (groups, spaced homes, threats, recipes), over twelve 10-minute windows of an island day. For every ground leg: what the slot is for, its speed, its Froude number on the hip height, the gait the legged driver draws at that speed (`gaitLadder`), its length, time, straightness and corners; its stay steps; and, sampled at 10 Hz through its moves, how it starts and stops, how it turns, whether it moves against the way it faces, and how a group's members move against their leader. `--trace` prints every trip's legs for chosen species. |
| The rig files (`~/animaldex-talking-models/rig/publish-v3`, 2,034 rigs) | Each rig's plan, pose, leg count, hip height and clips' paces, read from the files' JSON (`--rigs`), so the Froude numbers are on the rig's own legs, as the driver reads them. |
| The real snapshot (2026-11-12, read in place) | The wild island's 403 animals on the schedule: 216 species with ground legs or steps, 8,707 ground legs. (The town's animals are not in this tool's wiring.) |
| The fixture (`--validator`: two animals of every listed species; the plans mammal, reptile, turtle, frog, arthropod and snake) | 4,252 animals on the schedule, 871 species with ground legs or steps, 36,920 ground legs. |

    npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-ground-legs.mts public/ark-local/live.json --islands public/ark-local/islands-routing.json --rigs <rig-info.json> --kin 1 --list
    npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-ground-legs.mts --validator --rigs <rig-info.json> --windows 6 --kin 1 --plans mammal,reptile,turtle,frog,arthropod,snake --list

Real animals' figures: wild ungulates walk at about 1 m/s whatever their size between a gazelle and a giraffe, Froude
0.07 to 0.15 (Pennycuick 1975); animals of every size change from a walk to a trot at Froude about 0.5 and to a gallop
at 2 to 3 (Alexander and Jayes 1983); an elephant's everyday walk is about 1.2 m/s and it never has an aerial phase
(Hutchinson et al. 2003); a giant tortoise walks at about 0.3 km/h; top speeds by mass from Hirt et al. 2017
(`sprintPace`).

## The problems, worst first

Severity: **H** most viewers see it within minutes; **M** often, or obvious once seen; **L** rare or subtle.

### 1. Walking pace was the clip's, not the animal's (H)

- **Measured.** The schedule's walk is `walkPace` body lengths a second times the drawn length
  (`behaviour-profile.ts` `bodyLengthsPerSecond`), and `walkPace` was the rig's walk clip's own pace, so the baked walk
  played at its own rate. At true size (lane L4) that is no animal's pace:

  | Species | Walked at (m/s) | Froude on its rig's legs | Drawn as | The real animal's walk |
  |---|---|---|---|---|
  | giraffe | 5.14 | 1.79 | pace | about 1.3 |
  | African bush elephant | 3.41 | 0.80 | amble | about 1.2 |
  | domestic horse | 3.23 | 1.29 | trot | 1.4 to 1.8 |
  | plains zebra | 2.74 | 1.00 | trot | about 1.1 |
  | lion | 2.06 | 0.81 | trot | about 1.1 |
  | ostrich | 3.34 | 1.53 | run | about 1.1 |
  | Aldabra giant tortoise | 0.85 | 0.21 | walk | about 0.08 |
  | brown bear | 0.63 | 0.08 | walk | about 1 |
  | chimpanzee | 0.43 | 0.05 | walk | about 0.8 |

  On the fixture 151 of 371 quadrupeds walked at a Froude number over 0.5 (the trot's); 180 of 777 vertebrates' median
  walking leg was drawn as a faster gait than a walk (162 a trot, 15 a pace). On the real snapshot 22 of 149. The big
  mammals aboard (over 1.5 m, 8 species) walked at a median 2.21 m/s, 5 of them at a trot. The slow ones were as wrong
  the other way: rigs whose legs could not reach the clip's stride had been floored at Froude 0.05 (decision 202), a
  bear at 0.63 m/s.
- **Cause.** `scripts/ark-walk-pace.mts` only raised reach-limited walks to a floor; every other walk was the clip's
  `bls`. The legged driver draws any speed with planted feet, so the clip's pace no longer needs to be the walk's.

### 2. Long ways "ran" at the clip's run, past some animals' top speed (H)

- A way longer than 45% of the slot runs at `runPace` (the run clip's). An elephant ran at 9.2 m/s (its top by the
  allometry and its speed stat is 8.2, and it never gallops); a giraffe at 11.0 m/s on the rotary gallop for a walk to
  water; a zebra at 6.3 m/s. Real animals cover ground at a trot or a pace and gallop only in play, chase or flight.

### 3. Turtles and tortoises walked faster than they can run (H for anyone who knows a tortoise)

- 47 of 52 turtle species on the fixture, 12 of 13 on the real snapshot, walked faster than their own top speed
  (`sprintPace`: a sulcata tortoise at 0.64 m/s against 0.39; the real animal walks at about 0.05 to 0.1).

### 4. The sitting rigs slid, and sat like statues (H: 56 animals of 17 species aboard, 30 of them rabbits)

- **Cause.** `index.ts` `rigFor`'s ground block picks among the `walk`, `run`, `hop` and `slither` clips. A sitting rig
  has none of them: 38 have a `bound` (played only when the reactive layer flees), 16 (the sitting primates: gibbons,
  lemurs, sifakas, the mandrill) have an idle and nothing else. So on every schedule walk they kept their idle and
  slid. Their pace was the speed stat's in body lengths (no `walkPace`): a red kangaroo "walked" at 3.2 m/s.
- At rest: the baked idle, a two-second loop. The legged driver's standing life (weight shifts, looks, fidget steps)
  never reaches them (it does not take sitting rigs).

### 5. Starts and stops were instant; turns on the spot at one rate for all (M)

- **Measured.** The speed in the second tenth of a second after setting off, over the animal's speed on the way: a
  median 0.89 over the fixture's species, 0.90 for the 65 species over a metre long. `legPose`'s ground case placed
  the animal a share `u` of the time along its path: one speed from the first frame to the last. Stay steps (a grazing
  step, a peck's step, play's dashes) the same.
- A turn of more than a radian before setting off is made on the spot at `TURN_RATE`, 1.6 rad/s, for a mouse and an
  elephant alike (the legged driver's own body turn for an elephant is about 1 rad/s, so the body lagged its heading).

### 6. Ways were ruler lines with sharp corners (M)

- **Measured.** The share of a species' ground legs that are one straight run: median 0.80 (real), 0.80 (fixture).
  Chord over length: 1.00. Where a path had corners, the sharpest in a species' legs was 0.57 rad at the median species
  and 1.36 rad for the worst tenth: taken at a point, while the heading swung through it by the look-ahead.
- **Cause.** `NavGrid.path` returns the first clear straight run, else grid cells joined by straight runs; nothing
  curved it.

### 7. Every purpose was walked alike (M)

- Median leg speed over the species' own walking pace, by what the slot was for (fixture): forage 1.07, wander 1.07,
  rest 1.07, graze 1.04, browse 1.07, drink 1.07. Only long ways differed (they ran). A walk to the next mouthful and a
  walk to water were the same walk.

### 8. Small animals strolled (M)

- Mice, voles, squirrels, small lizards, plovers and spiders move in dashes and stops. Their legs were one steady walk
  like any other: 0.15 pauses a leg (the same seeded mid-way pause every species gets).

### 9. Species with no rig walked by their speed stat in body lengths (M)

- A mugger crocodile (3 m, aboard) at 4.1 m/s, drawn by the cheap gait; nineteen cattle breeds at 2.2 to 2.9 m/s; a
  bivalve at 3.7 cm/s.

### 10. Heavy snakes undulated at a metre a second (M)

- A Burmese python (3.7 m) went at 0.91 m/s, 0.245 lengths a second: just over where the legless driver switches from
  a straight creep to lateral undulation (`leglessMode`, 0.12 to 0.25), so it never crept. The 8 legless species aboard
  moved at a median 0.79 m/s.

### 11. Slow walkers were hurried to fit the slot (M)

- A trip is squeezed into its slot. `tooFarOnFoot` (decision 202) keeps goals within a slot's walk of home, but it
  skipped every animal that swims first, and a walker's swim. Traced: a pond terrapin walked 8.6 m ways at 2.9 times
  its pace; a 17 cm California legless lizard walked 31 m to a swim at 8.4 times its pace. Two goals either side of
  home are also twice the reach apart.

### 12. Standing was one slow sway for every kind (L)

- The legged driver's standing head motion was two sines, at most 0.19 rad of swing by its formula, the same for a
  hen, a zebra and a lion.

### Checked and right (no change)

- **Groups on the move.** Herds, troops and packs do not move in lockstep: each member walks to its own goal near the
  group's centre. Samples moving with exactly the leader's velocity: 0. Only flocks and schools shadow their leader,
  in the air and the water (lanes B5, B6).
- **Backwards.** 0.3% of moving samples on the fixture, 0.2% on the real snapshot after the fixes. (A pair of
  sanderlings reads high in a naive count: a flock member's slow drift by its standing leader, under a fifth of its
  walking pace. The tool now counts movement from a fifth of the walking pace.)
- **Gait ladders by family** (`gaits.ts`): elephants never trot or gallop, giraffes and camels pace, hoofed animals
  walk, trot, canter and gallop, lizards sprawl with a bending spine, frogs hop by their own driver. With the paces
  fixed each ladder is entered at the right rung.
- **Model-library plans that are wrong** (the talking models' `ark.json`, not this lane's data): the fiddler crab is
  filed as a mammal, the barnacle goose as sessile, the golden tortoise beetle as a turtle, the southern alligator
  lizard as a snake, the woodlouse as a slow invertebrate. The rig plans are right, so they are drawn right; the
  rhythm rule (which reads the model's plan) treats them as steady walkers.

## What was fixed

| | Before | After | Where |
|---|---|---|---|
| Vertebrates whose everyday walk is drawn as a faster gait (real snapshot, of 149) | 22 | 1 (an axolotl hurried on its way to a swim) | `paces.ts` `naturalPaces`, `scripts/ark-walk-pace.mts`, `behaviours.json` |
| The same on the fixture | 180 of 777 | 3 of 775 (a water bear, whose stored length is wrong; a green basilisk hurried on a long way; one sitting rig on its bound) | |
| Big mammals on the fixture (over 1.5 m): median walk; gaits | 2.28 m/s; 48 trot, 14 walk, 8 pace, 5 amble, 1 half-bound (the 76 rigged) | 0.90 m/s; all walk (105: those and 29 with no rig) | |
| Walking Froude number, 90th percentile of species (fixture) | 0.78 | 0.17 | |
| Walking Froude number, 90th percentile of species (real) | 0.79 | 0.17 | |
| Big mammals aboard (over 1.5 m): median walk; gaits | 2.21 m/s; 5 trot, 2 amble, 1 walk (the 8 rigged) | 0.95 m/s; all walk (9, one of them with no rig) | |
| Giraffe / elephant / horse / zebra / lion walk (m/s) | 5.14 / 3.41 / 3.23 / 2.74 / 2.06 | 1.34 / 1.12 / 1.15 / 1.09 / 1.07 | |
| Their long ways: pace and gait | 11.0 rotary gallop / 9.2 amble / 7.8 gallop / 6.3 gallop / 4.7 rotary gallop | 3.5 pace / 2.4 amble / 3.0 trot / 2.8 trot / 2.4 trot | |
| Turtles' median walk (real, 13 species); walking over their top speed | 0.215 m/s; 12 | 0.042 m/s; 1 (a Reeves' turtle hurried out of a long swim) | |
| The same on the fixture (52 species) | 0.206 m/s; 47 | 0.042 m/s; 4 | |
| Legless species aboard, median pace (8 species) | 0.79 m/s | 0.13 m/s; a Burmese python 0.33 m/s, creeping straight | `ark-walk-pace.mts` (by `styles.json` legless style) |
| True seals on land (8 rigged species): a harbour seal | 0.085 m/s (its flipper-legs clip's) | 0.285 m/s, a quarter of its length a second, drawn by the galumph driver | `ark-walk-pace.mts` |
| Sitting rigs on the move | their idle, sliding | their bound by the distance covered, a few bounds and a sit; the 16 with no moving clip hop | `index.ts` ground block, `sitting.ts` |
| A sitting rig's head at rest, swing over 40 s | 0 beyond its idle clip | 0.95 rad, looks held | `sitting.ts` `sitLife` |
| Speed in the second tenth of a second after setting off, over its pace on the way (legs and stay steps together): the 65 fixture species over a metre long | 0.90 | 0.59 (0.42 on the real snapshot) | `paces.ts` `groundProgress`, `legPose` |
| A 2 m animal's speed a tenth of a second after setting off / before stopping (the rule itself) | 1 / 1 | 0.21 / 0.25 | |
| Turn on the spot before setting off | 1.6 rad/s for all | 2.1/√length, 0.9 to 1.6 rad/s: an elephant 0.93 | `standTurnRate`, `tripFor` |
| Ground legs that are one straight run (median species; real / fixture) | 0.80 / 0.80 | 0.36 / 0.38 | `behaviour-nav.ts` `naturalWay` |
| Sharpest corner on the move (median species / worst tenth, real; the fixture's are within 0.01 of these) | 0.57 / 1.36 rad | 0.14 / 0.32 rad | |
| Leg speed over its own walk, by purpose (real): graze, forage / rest / wander / drink / to cover | 1.05 / 1.06 / 1.06 / 1.11 / 1.14 | 0.97 / 0.98 / 1.03 / 1.13 / 1.18 | `tripFor` (`AMBLING`, `STROLLING`) |
| A median ground leg's time (real) | 8.8 s | 11.5 s | |
| A burst mover's share of a walking leg spent moving (a mouse) | 1 | 0.6, in bursts of about 1.4 s | `gaitRhythm`, `groundProgress` |
| Unrigged: mugger crocodile / a Holstein cow walk | 4.11 / 2.92 m/s | by rule on its plan's usual legs (`unriggedWalk`) | `behaviour-profile.ts` |
| A standing grazer's head swing over 60 s | at most 0.19 rad, never held | 0.68 rad, held over 60% of the time; a lion's less, a hen's quick | `legged.ts`, `sitting.ts` `lookAbout` |
| Ground legs of 2 s or more hurried past 1.3 of their pace | not measured before (traced: a terrapin 2.9 times, a legless lizard 8.4 times) | 3.3% of legs (real), 3.9% (fixture) | `tooFarOnFoot`, `walkable` |

What each fix is:

1. **Natural paces** (`src/ark-scene/locomotion/paces.ts` `naturalPaces`; `scripts/ark-walk-pace.mts` writes them into
   `behaviours.json`'s walk and run columns for 1,649 of 1,978 rigged species). A walk is a Froude number on the rig's
   own leg length at the species' true length: hoofed 0.15, cats and dogs 0.2, bears 0.14, camels and giraffes 0.12,
   elephants 0.09, small bounders 0.24, primates 0.15, birds 0.12 to 0.22, lizards 0.12 on their reach, crocodiles
   0.05, turtles 0.003, newts 0.05; never over a third of its top speed (0.6 for one with no faster gait). Its long
   ways: the trot (1.0), a pace (0.8), an elephant's fast walk (0.4), a small mammal's half-bound (1.3), a lizard's
   sprawling run (0.8). Slow movers by name (sloths, chameleons, lorises) go at 0.09 lengths a second. The speed stat
   moves both by 10% either way. Rigs that move by a baked clip keep the clip's pace: sitting rigs their bound's,
   insects, spiders, crabs, hopping frogs, bats (with decision 202's floor as before). A true seal, which the galumph
   driver draws at any pace, humps along at a quarter of its length a second (0.6 on a long way). Snakes by their
   style: rectilinear 0.09 lengths a second, lateral 0.3, sidewinding 0.4, worms 0.06, millipedes 0.15; centipedes keep
   their clip's.
2. **A walk's shape in time** (`groundProgress`, read by `legPose`). It gets going over `startTime` (0.55 of L1's
   `accelTime`: a mouse in a fifth of a second, a horse in half a second, an elephant in 0.7) and slows over
   `stopTime`; the leg is longer by half of both, so its pace on the way is still its own. Where it runs on into the
   water or up a trunk it keeps its pace across the join. A stay step eases over a fifth of its time at each end.
3. **Bursts** (`gaitRhythm`). Bounders under half a metre (mice, voles, rats, squirrels, weasels, meerkats) 60% of a
   walking leg moving, in dashes of about 1.4 s; hares, rabbits, kangaroos and wallabies half, a few hops and a sit;
   lizards under 60 cm 45%; hopping passerines 60% and running birds under 45 cm (plovers, sandpipers, wagtails,
   larks, by the ground code in `styles.json`) 55%; spiders, scorpions, crabs, cockroaches 65%. Their walking pace is
   the bursts' speed times that share, so a mouse's dash is a trot (Froude 0.5) and its pace over the ground is still
   0.17 m/s. Seeded by the animal and the slot: the same for every viewer.
4. **Ways** (`behaviour-nav.ts` `naturalWay`, `NavGrid.wayClear`). A corner is rounded on about the animal's turning
   radius (1.2 lengths), a straight run longer than four lengths is bowed to a seeded side by 3 to 7% of its length.
   Each curve is kept only where every run of it is clear for the animal's body and on its ground; else the grid's own
   way stands.
5. **Pace by purpose** (`tripFor`). An amble between mouthfuls or to a place to lie (0.9 of its walk), a stroll about
   its range (0.95), a purposeful walk to water, cover or its roost (all of it).
6. **Sitting rigs** (`index.ts` ground block; `locomotion/sitting.ts`, called by the layer on the clip's frame). On
   the move they go by their `bound`, dropping into it and rising after (the base-pose steps the rig player already
   has). At rest they look about (a look turned to and held, every 2.4 to 6 s), breathe and flick their tails. The
   sixteen with no moving clip hop along by the distance covered.
7. **Standing** (`legged.ts`). The same held looks for standing rigs, by kind: a bird's quick and often (0.5 rad
   either way, every 1 to 3 s), a grazer's or a small mammal's wide (0.4), a predator's fewer and narrower (0.22).
8. **Reach** (`tooFarOnFoot`, `walkable`). A dry goal from a dry home is a walk for a swimmer too; a walker's swim is
   checked against its walk to the water; a way from where it stands longer than it walks in the slot is not taken
   for what it can do anywhere (feeding, wandering, resting, play). Out of reach, it feeds, rests or basks on its home
   ground instead of only wandering.

## A fault from the graphics pass: a bird's wings hung open on the ground

Reported 2026-11-14: with the locomotion layer on, a greater flamingo's and a yellow-vented bulbul's wings dropped to
the grass like a tent; with it off they were folded (clips idle and walk, rig code v7+v6, rig set v3).

- **Cause.** A v7 bird rig rests with its flight wings out at full size. Its ground clips hide them by scaling each
  wing's shoulder bone to 0.01, so only the folded wings modelled on the body show. All 635 v3 bird rigs with wings
  and an idle do so (read from the rig files: the shoulder's scale in the idle is 0.01 in every one). The legged
  driver poses from the rest pose and knows nothing of the wings, so through the layer every bird stood and walked
  with its flight wings at full size. Not a wing bone taken for a limb: the wings were never touched at all.
- **Fix** (`locomotion/layer.ts` `carryWings`). After a driver that poses from the rest pose, each wing bone and what
  it carries takes the clip frame's own transform against its parent (the scale with it), on that parent as the driver
  posed it. Through the layer on the real rig files: the flamingo's wing hands 0.14 of its width apart before (the
  rest pose's), 0.07 after (the clip's); the bulbul's 0.12 and 0.07; a mallard's and a chicken's match their clips'.
- **Test.** `ark-land-paces.test.ts` "on the ground a bird's wings keep the clip's own pose under the legged driver":
  the mallard's skeleton with a clip frame that shrinks the wings to 0.01; without the fix the wings come out at
  1.000 and the test fails.
- **The graphics pass's guard** (`rig-player.ts` `birdGroundBaked`, on its branch: a v7 bird on the ground skips the
  layer). With this fix the layer keeps the clip's wings, so the guard can come out; it has not been seen by eye
  here, so one look with `globalThis.__arkBirdGroundLoco = true` first. While the guard is in, a bird on the ground
  loses everything the layer gives it: the gait by family and speed (a sparrow's hop, a duck's waddle, a walk or a
  run with planted feet), its feet on a slope and its body following it (clip feet are put on the ground by the
  layer too), turning by stepping, the head-bob by family, its standing looks and weight shifts. It plays its baked
  walk by the distance covered instead, so its feet still keep to its speed on flat ground; no bird's own walk is
  under 0.3 of its walk clip's pace (where it would stand on its idle and slide), 260 of 642 are over 1.7 of it.

## From the hunt lane (its measures of walking paces)

- Turtles' sprint under their walk clip's pace: fixed with the paces (a turtle's walk is at most 0.6 of its top
  speed; on the fixture 47 of 52 walked over it, now 4, each hurried out of a long swim or up a climb).
- A lion at 2.07 m/s: now 1.07. A crocodile at 0.38 m/s: 0.40 for a saltwater crocodile (Froude 0.05 on its reach);
  a real crocodile's high walk is 0.3 to 0.6 m/s, so left. A harbour seal at 0.08 m/s: now 0.285 (above).
- A water strider at 0.01 m/s: an insect that keeps its clip's pace; its skating on the water is the water lane's.
- The model's plan passed where the rig's is read (`index.ts` `setChasePaces`, fixed by the hunt lane): no other
  caller of `sprintPace`, `fleePace` or `hipShare` in the scene has it (`sim.ts` and `paces.ts` pass the rig's plan;
  `unriggedWalk` and `gaitRhythm` take the model's plan by design and map it themselves). The audit tool had it for
  species with no rig (their top speed read on the default plan): fixed.

## Tests and registered metrics

- `src/lib/ark-land-paces.test.ts` (8 tests): the golden rigs' walks and long ways drawn as the right gaits; real
  animals' walking speeds in bands and the table's fastest walkers; the pace rules; a leg's shape in time and a burst
  mover's bursts; `naturalWay`; a sitting rig's looks and hop; standing looks by kind; a grounded bird's wings.
- `tests/ark-motion/metrics.json`, check `b4-land` (13 numbers; before → now): golden walks drawn as a run 7 → 0;
  the highest Froude number a golden species walks at 1.79 → 0.24; the fastest-walking steady mammal 5.14 → 1.38 m/s;
  the fastest turtle 0.85 → 0.10 m/s; species walking over 0.62 of their top speed 0; a leg's speed a tenth of a
  second after setting off 1 → 0.21 and before stopping 1 → 0.25; a burst mover's share moving 1 → 0.6; the sharpest
  turn through a right-angle corner 1.57 → 0.38 rad; a sitting rig's head swing at rest 0 → 0.95 rad and its hop
  0 → 0.07 of its height; a standing grazer's head swing 0.19 → 0.68 rad; a grounded v7 bird's flight wings 1 → 0.01
  of their size.
- Two existing tests in `ark-behaviour-schedule.test.ts` changed, with why, in the same commit:
  - "walking goes at its own pace" (it was "at its walk clip's own pace"). Each steady species' median pace ratio is
    still held to 0.8 to 1.3; a burst mover's bursts are read against its bursts' pace, from 0.7; the share of samples
    within the band was over 85% of walks at one speed and is now over 80% (83.8% measured), because the samples
    while it gets going and stops are under its pace by design.
  - "groups stay together as loose clusters, never a row": members on a walk or a run leg are left out of the row
    check. At their own paces a long way home is a trot of half a minute, and four goats trotting to their roost along
    the one way there were in file, as goats go. A row of standing animals still fails.
- `ark-town-vehicles.test.ts`, the real Ark's town animals among the moving cars (it runs only where the snapshot
  is): a moving car touched an animal in 2 of 14,400 car samples on main and in 8 with these paces (an animal against
  a waiting car 19 and 42). Animals crossing a street are on it longer at their own paces (a dog 0.74 m/s, its clip's
  was 1.18). The bound, set at the measured rate for what is left to L5, goes from at most 4 to at most 12, in its
  own commit.
- L1's guards are green: `src/lib/ark-locomotion.test.ts` 12/12, `ark-rig.test.ts` 13/13, the MA4 and L2 files.
- **One test fails on this branch: `ark-chases.test.ts` "hunts stay on clear ground"** (10 of 11 pass; 11 of 11 on
  main). A cat's one-metre rush in its pounce recipe, from 38.05,−58.81 to 37.97,−57.77, clips the corner of a
  walk-grid cell that is not walkable for about 16 cm (nothing solid there: `blocked` is false). The recipe checks
  its way every quarter metre (`behaviour-recipes.ts` `wayClear`) and its samples fall either side; the test samples
  finer. The cat's pace changed (1.37 → 1.02 lengths a second), so its seeded stalk ends elsewhere than it did. The
  fix is the recipe's (a finer check, or the leg's end): the hunt lane's file, not edited here.

## Cost

- The schedule: `groundProgress` per walking animal per pose: 20 to 70 ns for a steady leg, 250 to 440 ns for a burst
  mover's (a million calls each, three passes, Node on the shared Mac), with no allocation (one reused result object;
  a burst leg's weights are worked out once per leg). A shaped way has up to about a dozen points more. Shaping runs
  once per trip (a slot's worth): a few swept runs.
- The layer (`scripts/ark-loco-bench.mts`, the 20 golden rigs on the walk and run course, twice each, back to back):
  median 17.1 and 17.9 µs per animal per frame before, 16.1 and 17.1 µs after: no change above the noise. A standing
  rig with its looks: 22 µs. A sitting rig on its idle with its looks, breath and tail: 7 µs.

## What was left, and why

- **Not seen by eye.** No recording was made (the Mac's load). The default view gate (`scripts/ark-rig-scenes.mjs
  --island`) was not run: it needs the browser. Its pace ratio now reads a run leg against the run pace and a burst
  mover's burst against its bursts' pace (`rig-scenes-entry.ts`, two lines). Worth a look first: a rabbit's bound
  with its drop and rise at each burst; an elephant's turn on the spot; a rounded corner taken by a long animal.
- **Crabs do not walk sideways.** The heading is the way of travel everywhere (the schedule, the collisions, the
  reactive layer, the "nothing walks backwards" test at 90 degrees). It needs a body heading apart from the travel
  heading on the pose; eight true crabs are aboard.
- **Herons and egrets walk like any bird** (Froude 0.12 to 0.15: a grey heron at 0.70 m/s). A stalking walk by family
  would be a new ground code in `styles.json`.
- **Kangaroos and wallabies** have one moving clip, a bound at its own pace: a red kangaroo's everyday way is bursts
  of bounds at 6.4 m/s with sits between (2.4 m/s over the ground). Their slow five-limbed walk needs a clip.
- **Insects, spiders and crabs keep their clips' paces** (their feet already slide a few millimetres at speed:
  `locomotion.md` §6). Scuttlers now go in bursts at that pace.
- **Hurried legs remain** where a trip's swim or climb is the long part: the squeeze into the slot scales every leg
  of the trip, the walk with it. 3.3% of ground legs (real) and 3.9% (fixture) are over 1.3 of their pace; on the
  fixture 62 species have over three in ten of their legs so, nearly all slow movers: turtles and terrapins out of a
  long swim, lorises, a potto, sloths, chameleons and geckos on a climb. In metres a second they are still a fraction
  of what they were (a Reeves' turtle 0.10 m/s against 0.36).
- **Town animals** are not in the audit tool's wiring; they are on the same schedule and the same rules.
- **Tortoises and other slow walkers do less.** A home range is at most half of what the animal walks in a slot
  (`homeRadius`), so at its own pace a sulcata tortoise's is 2.3 m, and a basking rock or a burrow beyond it is no
  longer found or is out of reach: on the real snapshot ground legs to bask went 231 → 193, to drink 59 → 51, to a
  burrow 203 → 179 (the sulcata's 13 bask and 22 burrow legs to none: it grazes, rests and wanders). The natural fix
  is the needs lane's: places chosen within the animal's own reach, or a walk that takes more than one slot.

## For other lanes

- **B1 / recipes.** Recipe travel speeds come from the same walk and run paces (`behaviour-recipes.ts` `speedOf`):
  a recipe's `run`, `flee` and `clash` blocks are now the covering-ground gait times at most 2.3 (a zebra 2.5 m/s, a
  lion's fast dash 3.1 m/s), where they were the run clip's (6.3 and 6.1). A chase or a flight wants `sprintPace` or
  `fleePace` (`locomotion/flee.ts`), which the meal chases already use. The comment there says the swap is in one
  place.
- **B2.** `reactive.ts` `paceCap` caps an unhurried reaction at 1.2 of the walk and a hurried one at 1.2 of the run:
  both are the natural paces now. `fleeSpeed` is capped by the `gait` column, which is unchanged.
- **B3.** Slow walkers' far goals (above). Ground legs take longer (median 8.8 → 11.5 s), so a slot's stay is that
  much shorter.
- **B6.** A swimmer's long swim is squeezed into its slot with the rest of its trip (a Reeves' turtle's 8.3 m swim in
  62 s). The legless lizard and the axolotl take swims they walk to.
- **The model library:** five wrong plans (above).

## Rig needs (the rigging pipeline; not in this pass)

- A walk (or a slow hop and a five-limbed walk) for the 38 sitting quadrupeds, so they are not limited to their
  bound; any moving clip for the 16 sitting primates (they hop in code now).
- Ear, mane and trunk bones (an ear flick and a trunk are most of how a standing elephant or deer looks alive).
- Insects' legs fitted to their true hip positions.
