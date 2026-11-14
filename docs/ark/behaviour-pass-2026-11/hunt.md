# Behaviours pass 2026-11, lane B1: how predators hunt and eat, as seen

Owner, 2026-11-14: "do a full animal behaviours pass ensuring animal locomotion, predatory, hunting, hunger, behaviour
etc. is as natural as possible". This lane is the drawing of hunting. The server decides who hunts and who is eaten
(encounter hunting, live since 2026-11-12); nothing here changes that. Branch `ark-beh-hunt`, off `origin/main` c99ff83b.

## What was measured, and how

`scripts/ark-hunt-audit.mts` (new): the pure shared layer, no browser.

```
npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-hunt-audit.mts public/ark-local/live.json \
    --islands public/ark-local/islands-routing.json --hunting <voyage_hunting_v1 read.json> \
    [--part forays,handover,chases,recipes] [--step 1] [--json out.json]
npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-hunt-audit.mts --validator --part forays,chases
```

- **Forays.** Every predator the hunting read names, taken as due, through twelve 10-minute windows of a day (one
  every two hours): its speed while moving against its own walk, sprint, flight cruise or swim cruise; the share of
  time it moves; turns; a flyer's height; how far it is from the server's waypoint at each step's moment; what its
  pose says it is doing.
- **Hand-overs.** The steps into a hunt and out of one at the wake and sleep ends of its day: the hunter's motion
  against its schedule's own at the same moment, and any jump.
- **Meal chases.** `mealStage` for every predator and prey pair aboard (the scene's food links), wired as `index.ts`
  wires it, from where encounter hunting finds them (two thirds of the detection range plus half the prey's disc).
- **Recipe hunts and stalk slots.** A whole day of trips for up to two animals of every species with a catching recipe
  or a stalk in its profile.

Data: the real Ark read on 2026-11-12 (707 animals on the wild island; read in place) and production's public hunting
read fetched once on 2026-11-14 (395 predators with a next hunt). **None is due today**: the nearest next hunt is 161
Ark days off (about six real days), the median 1,137 (43 real days). The launch grace runs to about 2026-11-25. From then
a due predator walks its forays through every waking hour until it eats, so forays become most of what a hungry
predator is seen doing. Of the 394 predators with a home in the positions atlas, 277 (193 species) are on the schedule;
the other 117 are micro or underground animals drawn at their places, which never walk a foray.

## The problems, worst first

### 1. Every due predator moved the same way: a glide between waypoints (H)

`hunting.ts` `pose` drew a straight line from one waypoint to the next at whatever speed the distance gave, with one
beat (`walk`, `fly` or `swim`) and no stops.

| On the real snapshot (193 species on the schedule) | Before | After |
|---|---|---|
| Walkers moving all the time (of 95 species) | 89 | 0 |
| Walkers' share of time moving, median | 100% | 40% |
| Walkers' speed while moving ÷ own walk, median (p10) | 0.40 (0.16) | 0.79 (0.66) |
| Walkers under 0.3 of their own walk | 31 | 2 |
| Flyers in the air all the time (of 60 species) | 60 | 6 (the soarers) |
| Flyers' flight speed ÷ own cruise (95th percentile of each, median over species) | 0.06 | 0.85 |
| Flyers' heights (median per species, rounded to a metre) | 2 values, 2.6–4.5 m | 9 values, 0–26 m |
| Swimmers' speed while moving ÷ own cruise, median | 0.27 | 0.63 |
| Hunt styles drawn | 1 | 10 of 12 aboard |

- A lion walked at 0.22 m/s, a tenth of its walk's own pace, without ever stopping (its walk clip in slow motion); a
  tiger at 0.11 of its walk, a wolf at 0.17, a hyena at 0.10.
- Every flyer hung at 2.5 m plus one and a half body lengths, flapping, at a median 3% of its cruise: a buzzard, an
  osprey and a vulture at 0.35 m/s, 3.2 to 3.5 m up. This is the movement audit's problem 1 again, in the hunt.
- Herons, egrets, ibises, cranes, robins, sunbirds, kingfishers: all in the air, all the time, because the atlas sheet
  says they can fly.
- A pike and an eel swam on without pause at a fifth of their cruise.
- The heading snapped to the new leg at each waypoint (up to 49° in one sample).

The server counts many animals as hunters that are not hunters by trade: a greylag goose, a flamingo, a sunbird, a
cockatoo, a tortoise have a next hunt because they eat some catalogue animal. On a foray they must look like what they
are: a goose grazing and dabbling its way from waypoint to waypoint, not a goose "stalking".

**Fixed** (`hunting.ts`): a hunt style per species by rule, `huntStyle`, from its stored hunt style (`intelligence.json`),
how it moves, its diet, its company, its water kind and its flight style; the foray is drawn through it.

| Style | Who (rule) | What is drawn |
|---|---|---|
| `wait` | an ambusher that is no mammal, a sessile or clinging animal: crocodiles, snakes, frogs, lizards, spiders, mantises | still most of the step, looking round now and then; moves on in one brisk go; holds its place while the waypoints stay within 3.2 m of it (a grid of waiting places about its home) |
| `stalk` | a stalker, a mammal that ambushes, other pursuers: lion, tiger, marten, otter | a prowl at half its walk's pace, in one to three bouts, stopping to look |
| `forage` | everything else on foot, and fish with no hunt style: boar, monkeys, meerkats, geese, tortoises, tetras | ambles at 0.65 of its walk, in bouts, nose down between them |
| `course` | a pack hunter, a social flesh-eating pursuer: wolf, hyena | a stop to look at each waypoint, then on at a trot along a long figure of eight through the waypoints |
| `lurk` | a fish that ambushes: pike, snakehead, eel, gar | hangs still, moves on in one go |
| `cruise` | a pursuer, a scavenging shark, a filter feeder | swims on without stopping at 0.8 of its cruise, along a figure of eight |
| `soar` | a soaring bird that eats flesh: buzzard, osprey, kite, vulture | circles 16 to 34 m up at 0.6 of its cruise, each circle touching the waypoint |
| `quarter` | a bird of a raptor's size that swoops and does not soar | low figures of eight at 0.55 of its cruise, 2.5 m plus two lengths up |
| `hawk` | swallows, swifts, bats, dragonflies that hawk | quick tight circles; a bird 4 m plus eight lengths up and rising and sinking, an insect low |
| `perch` | a perch hunter, an ambushing bird, a small swooper, a dragonfly that perches: kingfisher, kookaburra, shrike, skimmers | flies from perch to perch (a branch, a post or a rock's top within 3.2 m of the waypoint) and sits and looks |
| `wade` | a wader that eats fish or meat: herons, egrets, limpkin | stands in the shallows, walks a short leg, flies a long one |
| `glean` | every other bird and flying insect: robins, ibises, cormorants, ducks' flying kin, sunbirds | flits to the next spot and pecks; walks a leg under six body lengths |

Paces are the animal's own: its walk clip's pace (`behaviour-profile.ts`), a trot at Froude 0.8 of its hip height, L2's
flight cruise and swim cruise. A leg too long for its pace is walked faster (the server moves the waypoint; it must be
there). A mover with no room for its loop (a small pond, a strip of shore) goes from waypoint to waypoint and waits for
that step.

### 2. Meal chases: every bird stooped like a falcon, and nothing else differed by kind (H)

`acts.ts` `chaseKind` sent any flying bird to the raptor's stoop.

| Of 1,845 predator and prey pairs aboard | Before | After |
|---|---|---|
| Stoops from the air | 1,072 | 449 (433 stoops, 16 low from a perch) |
| A bird taking prey on foot (creep and strike) | 0 | 243 |
| Cut-aways | 252 | 599 |
| A land rush from the same starts: stalk, then sprint (medians) | a 0.8 s crouch, no stalk; 1.3 s over 13.3 m | 4.8 s over 2.5 m; 1.1 s over 9.5 m |
| Seen eating after a land kill (median) | 1.4 s | 1.7 s (to 2.6 s) |
| Of the 449 stoops, prey from a half to three quarters of the raptor's length: carried off | 94 | 0 (eaten where it fell) |
| Land chase styles | 1 | 3 aboard (rush, course, strike; pounce by recipe) |

- A great egret, a robin and a hen stooped from 8 m; a great crested grebe stooped on an eel; a white-throated
  kingfisher (0.27 m) stooped on an agouti (0.52 m), and a red-tailed hawk carried off a silver pheasant longer than
  itself (the carry rule was three quarters of its own length).
- A snake found 40 m from its prey by the server closed the gap at up to 9 m/s (`(distance − launch) / 4.5`), and any
  far hunter's "stalk" was a run at up to 5 m/s.
- From where encounter hunting finds prey (5 to 18 m) a cat was already inside its break distance: its whole hunt was
  a half-second crouch and a one-second sprint. The stalk was never seen.
- The hunter was seen eating for 1.4 s whatever it killed.
- `index.ts` handed L1's `sprintPace` the model's plan (mammal, reptile, frog, arthropod) where it reads the rig's
  (quadruped, lizard, amphibian, insect): every one fell to the mammals' law. A bullfrog's chase sprint was 3.24 m/s
  for 1.13, a sun skink's 6.14 for 3.38, a ground beetle's 0.69 for 0.32, a Komodo dragon's 15.9 for 8.7, a great
  egret's on foot 13.4 for 6.7.

**Fixed** (`acts.ts`, `hunting.ts` `chaseStyleOf` and `swoopsOnPrey`, the meal lines of `index.ts`):
- Only a bird that hunts from the air stoops (its flight style stoops or plunges; it swoops on flesh and is no water
  bird; it hawks). A perch hunter, an ambusher and a night bird come in low from 3 m, not from 8. Other birds take prey
  on foot. A bird on the water, a stoop on prey over 1.25 times the bird's length, or a bird on foot after prey over 1.2
  times its length is a cut-away: the meal is the server's, the scene does not draw an absurd one.
- A chase style by rule: `course` (pack hunters and social pursuers: no stalk, the prey runs at its own sprint up to 86%
  of the hunter's and tires after 5 s), `pounce` (species with the pounce recipe: from three and a half lengths, a leap
  half a length high), `strike` (ambushers that are no mammal, probing strikers, waders: it creeps the last of the way
  and strikes; found far off, it comes into view near its prey and never crosses the ground to it), `rush` (the rest).
- A stalk closes at no more than 35% of the sprint over at most 7 s; a rusher breaks from 9 m at most, so it stalks in
  first.
- A lion found 13.3 m from a tapir now stalks 3.9 s over 3.4 m at 0.94 m/s, sprints 1.0 s over 14 m, and is seen
  eating for 2.6 s (before: a 0.8 s crouch, a 1.3 s sprint, 1.4 s).
- It is seen eating 1.4 to 2.6 s by the prey's size. A raptor carries off prey under half its length and eats a bigger
  kill where it fell, for that time.
- Paces by the rig's plan.

With no style given (`mealStage` called as before) every number is as it was: the old tests pass unchanged.

### 3. Hand-overs: a sprint into a hunt, and a jump when the read changed (M)

- Into a hunt and out of one the hunter covered whatever lay between its schedule's place and the waypoint in one
  step, eased (its top speed one and a half times the mean): 44 of 442 walker hand-overs over the animal's own sprint,
  the 90th percentile 7.9 times its walk; 6 jumps of over half a metre at a step's ends.
- A predator fed since the last read (its next hunt moved on) went from its foray to its schedule's place in one
  frame; so did one already out when the page's first read came (the encounter doc's "known seams").

**Fixed**: it stays on its schedule until it must leave to arrive, at its own pace, as the hunt begins; it goes back at
its own pace; either over at most three steps (`LEAD_STEPS`). A predator the new read no longer has out finishes the leg
it is on, then goes back; one already out at the first read sets off from its schedule's place. `HuntingLayer.set` takes
the scene's clock for that. The card says "hunting" on the way in only once it has left its place.

After, on the 528 hand-overs of the 277 predators on the schedule (the hunter's motion against its schedule's own):
walkers' top speed against their walk 1.18 at the median and 2.4 at the 90th percentile; no jump over half a metre
(the largest 0.40 m). 35 walker hand-overs are still over the animal's stored sprint: 28 are turtles and tortoises,
whose stored sprint is under their walk clip's pace, 5 are water striders (a walk of 0.01 m/s).

### 4. The schedule's stalk slot: every predator crept (L)

A crocodile, a snake, a frog, a mantis or a heron on a `stalk` slot on land crept forward a quarter of a body length at
a time, six times, as a cat does. **Fixed** (`behaviour-schedule.ts`, the stalk intent): one that hunts by waiting
(`waitsForPrey`, the same rule as `wait` and `wade`) lies in wait there, still, with a look round now and then, and its
card says "waiting for prey" (`SlotPlan.still` is now true when the stay has no steps, as well as when its steps cannot
move it).

### 5. Pack and pride hunters hunted alone (L)

The server pairs one hunter with one prey; its cluster stayed on its leader's schedule. **Fixed**: the members of a
hunting leader's own cluster go with it, behind and to each side by rank, eased from their own places as it sets out and
back as it returns (`huntsTogether`: pack, group or troop animals that course, stalk or forage; `HuntingLayer.beside`).

## How the encounter's agreement is kept, and how it was checked

`acts.ts` `encounterBodies` uses the scene's pose of the hunter when it is within `ENCOUNTER_AGREE` (5 m) of the meal's
waypoint, else the waypoint itself. So the hunter must be within 5 m of `forayAt(home, id, k)` at each step's moment.

- A hunter on the move, and one that stalks, forages or cruises, is **at** the waypoint at each step's moment: its
  loops and bouts all start and end there.
- One that waits or lurks is at its waiting place: at most 3.11 m off (half the diagonal of the 4.4 m grid; the cell's
  centre is used only when it is within `HUNT_STATION_AGREE`, 3.2 m, and on ground or water it can be on).
- A perch hunter sits on a perch found within 3.2 m; a bird that comes down over water it cannot stand in takes the
  nearest standable place within 3.2 m, else holds in the air over the waypoint.

Checked two ways: the audit's "off-waypoint max" over every predator and every sampled step on the real snapshot
(3.20 m, before 0.00), and the test "the encounter's agreement" over 200 steps of 27 species of every style (0.02 m for
the exact styles, 3.2 m for the rest).

## Tests

- `src/lib/ark-hunt-styles.test.ts` (8): the styles by rule; the agreement; paces, pauses and heights by style; no
  jump on a foray; into and out of a hunt and the two read seams; the same for every viewer; a companion's place.
- `src/lib/ark-chase-styles.test.ts` (4): who stoops; the chase style by rule; a courser's long chase, a striker
  that does not run, a pounce's arc, the stalk's pace, the eating time; what a raptor carries, a low glide from a perch.
- `src/lib/ark-hunting.test.ts`: the foray test follows the new drawing (at or within 3.2 m of the waypoint, the
  hand-over as late as its pace allows).
- `src/lib/ark-animal-status.test.ts`: a waiting hunter's stalk slot is still.
- `src/lib/ark-chases.test.ts` (11): unchanged, passing.

## What is left, and why

- **After the kill.** The chase ends with the hunter eating for up to 2.6 s, then the replay moves on and it is back
  on its schedule. It does not stay at its kill, guard it, carry it to cover, then rest or drink. That needs the meal's
  time to mean "now": the tick runs hours behind (the hunting read on 2026-11-14 had `ticked_to` 4.1 Ark days, 3.8 real
  hours, behind `ark_day`), so a meal is learnt long after its step. See the server notes.
- **Sit-and-wait hunters with a big range still move a third of the time.** The server moves a crocodile's or a
  python's waypoint 5 to 20 m every step, as it does a wolf's; the scene can only make the move brisk and the wait long.
- **Slow animals outpace themselves.** A tortoise's foray radius (5 to 10 m) asks 3 to 5 m of it every 34.5 s: 1.3 times
  its walk, 80% of the time.
- **Perches.** A perch hunter with no branch, post or rock's top within 3.2 m of its waypoint sits on the ground.
- **Not looked at by eye.** Nothing was recorded in a browser: the shared Mac's load was over 600 through the whole
  session. Every number is from the pure layer.
- **Recipe hunts** (ambient prey) were measured, not changed: see the numbers below.
- **A sharp turn at a waypoint for a cruising swimmer** where its loop is dropped for one step and kept for the next
  (a pond's edge): the way's direction changes at the waypoint (up to 180° in a second for a walking catfish and a
  bull shark in the audit). The fix is to ease the heading over the step's first second from the last step's.
- **The whole test suite, `npm run lint` over the project and the behaviour audit were not run** (the coordinator's):
  under the load each run of a single test file took 3 to 10 minutes. Run here: the five test files this lane touches,
  `tsc`, and eslint on the changed files.

## Recipe hunts and stalk slots, as measured

One animal of each of the 51 species with a catching recipe or a stalk in its profile, a whole day on the real
snapshot (`--part recipes --per-species 1`). 20 species hunt ambient prey; 788 hunts in all.

| Recipe | Hunts | Strikes | Caught | Median length | Night / dawn and dusk / day |
|---|---|---|---|---|---|
| `surface_dive` | 250 | 349 | 48% | 29 s | 0% / 27% / 73% |
| `chase_fish` | 204 | 311 | 52% | 25 s | 21% / 30% / 49% |
| `perch_plunge` | 105 | 105 | 53% | 19 s | 0% / 23% / 77% |
| `hover_drop` | 97 | 333 | 39% | 60 s | 0% / 22% / 78% |
| `wade_spear` | 80 | 286 | 45% | 63 s | 0% / 34% / 66% |
| `hawk_insects` | 42 | 42 | 69% | 9 s | 0% / 21% / 79% |
| `talon_grab` | 10 | 10 | 70% | 27 s | 0% / 30% / 70% |

| Animal | Hunts a day (per awake hour) | Strikes a day | Caught |
|---|---|---|---|
| asian-small-clawed-otter | 102 (8.1) | 158 | 53% |
| common-buzzard | 97 (7.7) | 333 | 39% |
| great-cormorant | 96 (7.7) | 165 | 45% |
| white-throated-kingfisher | 95 (7.6) | 95 | 56% |
| great-crested-grebe | 67 (5.4) | 81 | 48% |
| european-otter | 62 (4.7), 68% at night | 92 | 53% |
| great-egret | 29 (2.3) | 109 | 48% |
| grey-heron | 22 (1.8) | 77 | 48% |
| osprey | 10 (0.8) | 10 | 70% |
| common-kingfisher | 10 (0.8) | 10 | 30% |
| european-robin | 15 (1.2) | 15 | 80% |

- **Times of day fit.** Recipes run only while the animal is awake by its own activity: the day birds hunt by day, the
  European otter 68% at night and the rest at dawn and dusk. No bat is on the wild island.
- **A common buzzard hovers and drops 97 times a day, 333 strikes, about 130 grasshoppers.** That is a kestrel's day
  several times over, on a bird that mostly soars or sits and watches. Its `hover_drop` comes from a stored "hover"
  phrase at weight 6 with no `often`. Not changed here: the recipes' frequency moves the whole schedule and its tests,
  and the machine could not run them (see below). Proposed: `often: 0.3` on `hover_drop`, and the recipe only for
  birds whose flight style hovers (L2's `hover`), a buzzard keeping its soar.
- A small-clawed otter's 102 fish chases a day and a white-throated kingfisher's 95 plunges are at the top of what the
  animals do; a great egret's 29 hunts, a heron's 22 and an osprey's 10 are about right.
- **No pounce was seen**: the only wild-island predator with the `pounce` recipe in this snapshot is a jumping spider
  (the two-striped telamonia), a micro animal off the schedule.
- **Stalk slots**: a median 42 a day for the 51 species (80 s each: about 56 minutes a day "on the prowl" or "waiting
  for prey"), 40% of them held still in this run (made before the rule reached the stalk slots that fall back to a
  wander: a crocodile's and a python's still read as creeping in it). How many there are is the profiles' time budget (lane B3).


## For the server (proposals only; nothing here was changed)

1. **Hold a waypoint for hunters that wait.** `forayAt` gives every predator a new waypoint each step. A sit-and-wait
   hunter (a crocodile, a snake, a pike, a spider, a heron) would hold one for many steps. A `hold` by how it moves or
   hunts in the module's tuning would let the scene draw a true ambush.
2. **Foray radius against pace.** A tortoise or a snail cannot cover its foray's steps at its own pace.
3. **Who counts as a hunter.** Geese, flamingos, sunbirds, cockatoos and tortoises get a next hunt and a card that
   says "hunting". The scene now draws them foraging; the word is the server's and the card's.
4. **Food links by size.** A white-throated kingfisher eats an agouti twice its length; buzzards and hawks eat
   pheasants, egrets and ducks longer than themselves. The scene cuts away from 344 more pairs than before.
5. **The tick's lag** decides whether a kill can be shown as it happens.
