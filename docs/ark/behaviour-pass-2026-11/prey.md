# Ark behaviours pass, lane B2: prey and bystanders (2026-11-14)

Owner, 2026-11-14: "do a full animal behaviours pass ensuring animal locomotion, predatory, hunting, hunger, behaviour
etc. is as natural as possible". This lane: how prey and bystanders respond to predators, to each other and to the
viewer near the camera (`src/ark-scene/reactive.ts`), who counts as a predator, vigilance in groups, and how predators
and prey are kept apart at rest.

Audited on landing `origin/main` c99ff83b. Branch `ark-beh-prey`. Visual only: nothing here touches the server, a
migration, production data or the shared positions module. No API was called and nothing was uploaded or deployed.
Nothing was recorded in a browser: every number is from the reactive layer itself, run in node.

**The short answer.** Before the pass a prey animal had one answer to every predator: once it saw one it stood
staring at it for as long as it was in sight, whatever the predator was doing, and ran when the predator was inside one
fixed distance. Seven causes, worst first:

1. **The response did not fit the threat.** A predator lying up 12 m off kept its prey `alert` for the whole minute it
   was measured (68 of the 76 species that noticed it), a creeping predator counted as a walking one and was seen from
   further off (23 m against 20 m), and a herd called the alarm every 8 seconds for as long as lions lay in sight.
2. **A flight was not a flight.** The flee speed was capped by `gait`, the first rig set's clip figure, which today's
   rigs no longer match: the median flight ran at 0.8 m/s, a chital at 0.15, an alpine marmot at 0.06, an impala at
   1.1. And the action stayed `flee` for as long as the predator was inside the flight distance: all 57 species that
   ran from a predator resting 6 m off were still "fleeing", standing at the edge of their reach, a minute later.
3. **The wrong animals were predators.** Who threatens whom went by the food links and the size stat. The stat ranks
   animals within their own kind, so a giraffe ran from a rock python at 17 m, a roe deer from a rat snake, a hedgehog
   watched a mantis and a meerkat a tarantula (32 of the fixture's 180 prey were paired with a hunter smaller than
   them by the stat), while a stoat was no threat to a rabbit. Pets have no food links at all: no cat watched a bird.
4. **Every species had the same style.** The threat display could never be reached (a flight always came first), so a
   buffalo ran from a lion like a zebra; a cryptic animal froze for 2.5 to 4.5 s and then ran at its full flight
   distance; a meerkat ran to the middle of its mob, not to its bolt-hole.
5. **A herd had no eyes.** In a group of five or more a head was up 2.5 to 2.7% of the time and somebody's 4% of the
   time (alone: 33%), the same at the edge as in the middle.
6. **It snapped back.** The calming counted from the start of the reaction, so after any encounter longer than about
   15 s the animal was calm 3 s after the predator had gone, whether it had glanced at it or been chased.
7. **The town.** 1,215 of the town island's 2,438 animals stand within 25 m of something the layer takes for their
   hunter, 349 within 5 m: zoo cockatiels and the buzzard of their aviary, house pets and the python next door.

All seven are fixed by rule in the reactive layer and the intelligence generator, with tests. What is left is listed
at the end: mobbing, a real take-off for flushed birds, wider predator spacing in the schedule, and the eyes-on check.

## How it was measured

Everything runs the real `ReactiveLayer` in node at 20 or 30 frames a second: no rendering, no network, no randomness.

| Tool | What it does |
|---|---|
| `scripts/ark-prey-audit.mts fixture` (new) | Every prey species with a predator of its zone (a seeded sample by body plan, `--limit`, plus the animals a reader would check first, by name), in open ground, feeding, against the predator in each state: asleep 6 m off; resting awake at 25, 12, 6 and 3 m for a minute; walking past at 20, 10 and 4 m; walking straight at it from 35 m; stalking it (the schedule's `stalk`, a creep at 0.35 of its walk) from 30 m; chasing past at 6 m. Then the predator is gone and the run goes on 90 s. Per run: when and how far off it first reacts, the shares of the exposure by action and by response, whether, where, how fast and which way it runs, whether it calls, how long until it is calm and until it feeds again, and where it ends up. |
| `… groups` (new) | Herds of 1, 5 and 12 of 24 herd-living grazers, 12 flocking birds and 8 sentinel species: two calm minutes (head-up share by group size and by place in the group), then a predator walking at the group: who notices, when, who runs, whether the group closes up, how many calls. |
| `… real` (new) | The real snapshot's wild island on the schedule through a day (twelve 10-minute windows, every 30 s): every prey animal on the ground with a hunter of it within 25 m, by the hunter's state and the distance; who rests or sleeps within 5 m of a resting hunter; the schedule's own wariness; hunters' nearest prey homes; and the layer run for 40 s round 80 of those moments, 5 per state and distance band, with the island's terrain and cover. |
| `… town` (new) | The real snapshot's town island where its animals are placed: every animal with a hunter of it within 25, 10 and 5 m, by who keeps the two. |
| `scripts/ark-intelligence-encounters.mts` | The existing encounter harness (CI's `encounters` source). Its pairs now go by the layer's own links. |
| `scripts/ark-reactive-bench.mts` | The layer's cost per frame for 130 animals round the camera, per tier. |
| `scripts/ark-behaviour-audit.mts` (CI's configuration) | The near-camera pass on the audit's fixture, and `tests/ark-audit/thresholds.json`. |

The fixture's pairs are the encounter harness's: the first seeded hunter of the prey's zone that the layer takes for a
threat. On main that is the food links and the size stat; on this branch the food links and body mass (problem 3), so
the two columns below do not hold the same pairs: 25 of 91 prey in a first comparison had lost their hunter entirely
(the giraffe's python), and now meet one that could take them.

## What was wrong (main c99ff83b)

### The fixture: 180 prey species, 1,980 runs

| Predator | React | Median m when it reacts | Flee | Median m when it runs | Share of the exposure reacting | feeding | alert | fleeing | Call | Calm after it is gone, median s |
|---|---|---|---|---|---|---|---|---|---|---|
| asleep 6 m | 3.3% | 6 | 1.7% | 6 | 2.8% | 66.8% | 1.1% | 1.6% | 0.6% | 0 |
| resting 25 m | 6.1% | 25 | 0% | – | 6.1% | 61.5% | 6% | 0% | 3.3% | 0 |
| resting 12 m | 42.2% | 12 | 2.2% | 12 | 42% | 39.8% | 39.7% | 2.2% | 25% | 0 |
| resting 6 m | 61.1% | 6 | 31.7% | 6.1 | 60.9% | 28.6% | 28.3% | 31.2% | 25.6% | 3 |
| resting 3 m | 82.8% | 3 | 62.2% | 3.1 | 82.4% | 12.2% | 16% | 61.1% | 30% | 3 |
| passing 20 m | 56.1% | 31.8 | 0% | – | 39.5% | 38.3% | 39.3% | 0% | 29.4% | 0 |
| passing 10 m | 71.1% | 28.5 | 18.3% | 11.4 | 51.8% | 29.7% | 47.8% | 3.6% | 30% | 0 |
| passing 4 m | 88.9% | 26.1 | 62.2% | 9.8 | 58.3% | 21% | 42.6% | 14.4% | 30% | 0 |
| walking at it | 95.6% | 20.2 | 73.9% | 8.8 | 59.8% | 29% | 29.2% | 27.6% | 30% | 3 |
| stalking it | 89.4% | 23.1 | 71.7% | 9.1 | 60.9% | 27.9% | 35.1% | 23.9% | 30% | 3 |
| chasing past 6 m | 86.1% | 25.7 | 61.7% | 11.8 | 61.2% | 22.6% | 38.1% | 20.2% | 30% | 2.5 |

Read with the real animals in mind:

- **Resting predators.** The share reacting equals the share that noticed: whoever saw a predator lying still 12 m off
  watched it for the rest of the minute (68 of 76 species at `alert` for 95% of it or more). A zebra 12 m from a
  resting lion: `alert` 99%. Zebras, wildebeest and gazelles graze in sight of lions lying up and keep an eye on
  them; they do not stand and stare for an hour.
- **A stalker is no different from a walker,** and is seen a little further off. A creeping predator is the one prey
  see last, and the one they bolt from as soon as they do.
- **`flee` as a state.** At 6 m from a resting predator 31.7% of species ran, and the action was `flee` for 31.2% of
  the minute: every one of them "fled" for the whole exposure, standing at the edge of its reach. A cape buffalo with
  a lion resting 12 m off: `flee` 99%.
- **The flight itself.** Median flee speed over the 686 runs with a flight: 0.8 m/s; 146 under 0.5 m/s, 402 under
  1 m/s. Walking birds and lizards 0.1 m/s, primates and flying birds on foot 0.5, quadrupeds 1.4. The same animals in
  a meal's chase (`acts.ts`) run at the locomotion lane's pace: a zebra 11.6 m/s.
- **After.** Calm 3 s after the predator vanishes, in every scenario, a chase included (the 3 s is the time to drop a
  threat no longer perceived; the calming clock had run out during the encounter).
- **Styles** (by the prey's first stored defence, the four close scenarios): `threat` first: display 0%, flee 60%;
  `freeze` first: frozen 4.8% of the exposure, flee 69%; `group` first: reacting 84.5% of the exposure, calling in 75%
  of runs, feeding 9.5%.

Detection distance against body size is as the generator sets it (sight by body plan and size, flee-envelope.md §2):
walking at it, quadrupeds first react at a median 30.4 m (size under 15: 21.4 m; 50 and over: 34.6 m), flying birds
31.8 m, primates 34.6 m, fish 12.8 m, lizards 7.2 m, amphibians 6.2 m, insects 2.2 m. That scaling is kept.

### Groups

| Group | Head up, each | at the edge / inside | Somebody's head up | Calls as a predator walks up | Closest the group gets (spread against grazing) |
|---|---|---|---|---|---|
| herd animal alone | 32.7% | | 32.7% | 4 | |
| herd of 5 | 2.7% | 2.5% / 2.7% | 3.9% | 20 | 0.76 |
| herd of 12 | 2.5% | 2.7% / 2.5% | 4% | 39 | 0.79 |
| flock of 5 | 2.8% | 2.8% / 2.7% | 3.9% | 21 | 0.82 |
| flock of 12 | 2.5% | 2.5% / 2.5% | 3.9% | 56 | 0.89 |
| sentinel species, 5 | 23.2% | | 100% | 21 | 0.7 |
| sentinel species, 12 | 11.9% | | 100% | 46 | 0.86 |

The many-eyes rule divided an animal's wish to look up by the square root of its group, and feeding then won nearly
every choice: a herd of twelve had nobody's head up 96% of the time. Real grazers scan a few seconds every half
minute or so; each less in a bigger group, the group as a whole more (Roberts 1996), and more at the edge (Elgar
1989). The sentinel species' rota works (one on watch at a time). Every member noticed and ran (100%), and each called
again every 8 s: 39 calls from a herd of 12 while one lion walked up.

### The real wild island (707 animals, 403 on the schedule, 275 kinds)

- At any moment 165 animals on the ground have something the layer takes for their hunter within 25 m: asleep 43%,
  resting 14%, busy at something on the spot 30%, walking 10%, stalking 3%. The hunter is still or asleep 87% of the
  time and on the move 13%, so the layer's answer to a still predator is most of what a viewer sees.
- Run round 80 of those moments: with the hunter resting 3 to 6 m off the prey spent 63% of 40 s reacting (40%
  `alert`, 20% `flee`); busy 3 to 6 m off, 98% (95% `alert`); walking 6 to 12 m off, 73%. Over all 80: reacted 72.5%,
  fled 36.3%, 55% of the time reacting.
- **Two tables of who eats whom.** The layer reacted to 5,413 pairs of kinds aboard; the schedule keeps homes apart
  (`spaceHomes`) by 1,843 (`food-links.json`: vertebrate predators of size 15 and up and prey from 0.15 to 1.2 of
  their size, from the per-species links); 1,505 are in both. So `spaceHomes` moved 48 predators, and 9 animals at a
  time rest or sleep within 5 m of a resting or sleeping hunter the schedule does not know is one: a Burmese python by
  a saltwater crocodile (205 of 240 moments), a green-cheeked conure by a reticulated python, a rabbit by a spectacled
  caiman, a leopard gecko by a bearded dragon, and fish of one water. Of 120 hunters, 11 have a prey home within 5 m and 31
  within 10 m; 10 of the 11 are fish, frogs and turtles of one water.
- **The schedule's own wariness** (`threatAt`, `wireThreats`: a prey animal that sees a top predator at its slot's
  start watches it from the far side of its range) takes 1.2% of awake prey time (645 of 55,701 animal-moments). It was
  left as it is.

### The town island (2,438 animals: 1,063 at houses, 149 on farms, 499 in the zoo, 727 of the town's own)

1,215 animals have something the layer takes for their hunter within 25 m, 643 within 10 m, 349 within 5 m: 1,543
pairs inside one zoo enclosure (a green iguana and a sulcata tortoise with the reptile house's python, cockatiels with
their aviary's buzzard), 1,750 between enclosures, 424 between house pets. And nothing told the layer an animal was
kept: the camera backed shy pets off and woke them as it would a deer.

## What was changed

All in `src/ark-scene/reactive.ts` unless said. The contract with the schedule (`docs/ark/flee-envelope.md`) is
rewritten to match: §2.1, §3 and §4 are new, §6.3.4 changed.

1. **Who is a threat** (`intelligence-profile.ts` `foodLinked`, `canTake`, `bodyMass`, `huntCompany`,
   `huntsByBuild`; `ReactiveLayer.relation`, `hunts`, `threatens`). The food links, then body mass in place of the size
   stat: a hunter alone takes prey up to 4 times its own weight, one that lives in a group 8, a pack hunter 12, a bird
   of prey 1.5, a snake its own weight; by this individual's own drawn length, so a cub is no threat to a zebra. A pet
   with no food links is read by its build (a cat the garden's birds, a dog a hen). A ground hunter gives way to
   another at least 2.5 times its weight (a cheetah to a lion, a cat to a dog).
2. **The response fits what the predator is doing** (`menaceOf`, `threatScale`, the appraisal in `stepAgent`).
   Resting 0.6 of the flight distance, passing 1, coming 1.3, stalking 1.5, chasing 1.6. A predator lying up or going
   by, outside the flight distance, is watched for a few seconds (longer the nearer) and then tolerated: the animal
   feeds on, warily, where it is; one a little too near is walked away from first. One that gets up, turns its way,
   creeps or comes much nearer is watched afresh. A creeping predator is the hardest to see and hear (`perceive`). The
   sighting itself no longer counts as "a predator remembered" (every flight distance was 1.25 times its rule).
   A hunter near the camera creeps at its prey only when the schedule has it hunting or up, about and hungry; one
   lying up only watches (before, a hunter with prey in sight crept at it whatever it was doing, as soon as the
   layer's hunger for it passed a quarter; its prey now reads that creep as stalking).
3. **A flight is a dash** (`fleeSpeed`, `Agent.dash`): at the locomotion lane's `fleePace`, the pace the prey of a
   meal's chase runs at (never more than 8 m/s over so short a run), up to speed over its first strides, one direction
   chosen as it starts, to the edge of the flee reach. Then it holds there, facing the predator; then the watch and
   the tolerance start from where it stands. Distances are from where the animal is drawn.
4. **Styles by rule** (`styleOf`, `standsTo`, `armed`, `closeUp`, `fleeDirection`). Armed animals (a stored chemical
   defence, or armour and a threat display) and dominant ones at least half the predator's weight stand their ground
   and face it; cryptic ones hold still, low, until the predator is within 0.45 of the flight distance (0.7 if it is
   coming), then bolt; small animals that live in a burrow, a den or a crevice make for cover first and keep low
   there; a herd closes up while it watches and runs one way, for a point past its middle on the far side from the
   predator (from a chase each still goes its own way, `SCATTER`).
5. **Vigilance** (`choose`). In a group each animal lifts its head in bouts of its own: `0.3 / size^0.4` of the time
   (one moment in six in five, one in nine in twelve), times 0.7 to 1.4 from the middle of the group to its edge, 1.8
   with a predator about, half where a sentinel keeps the watch. An animal with its head down notices a predator only
   when it next looks up (1 to 5 s, less the nearer it is); one of its group stopped and staring has it look up too.
   It calls once each time it takes a fresh look at a predator. Alone and tolerating a predator, its extra looks come
   in bouts too (a quarter of the time), so it feeds between them: the first version had it looking round 96% of the
   time. And `browse` was missing from the layer's feeding doings: a browsing deer or giraffe near the camera never
   fed at all (249 species have the browser diet).
6. **Calming in proportion** (`Agent.scare`, `dangerAt`, `wary`): `(5 + 28·scare) s` from when the danger ended, the
   scare from 0.2 for a look to 0.75 for a run and 1 for a chase; then wary for as long again, still where it ran to;
   then back to its place at a walk.
7. **Kept animals** (`ReactiveInput.kept`, `apart`; `index.ts`, the lines that feed the layer `roost` and `kept`). A
   zoo animal is apart from everything; animals of homes and farms are used to one another; between kept and wild
   nothing changes. A hunter still watches across the fence or the room and never stalks. The camera never backs a
   kept animal off or wakes it.
   The same lines now feed a meal's hunter as awake, as stalking while its act stalks, and as moving by its act's own
   speed ("For other lanes", B1).
8. **The generator** (`scripts/ark-intelligence-profiles.mts`, section "The profile", `defenceOf` and the flight
   distance). Skunks (Mephitidae) get their chemical defence and porcupines (Hystricidae, Erethizontidae) their quills
   and display by family; a big running bird with no stored flight (ostrich, emu, rhea, cassowaries) runs in the open;
   a giant (not a hunter, size 60 and dominance 80 or more) lets things nearer, not further: an elephant's flight
   distance 14 m to 8.4, a rhinoceros's 12.8 to 7.7, a buffalo's 10.9 to 6.6. 23 rows changed.
   Before that, the table was regenerated against today's behaviour profiles with no rule change: 491 of 2,555 rows
   had gone stale since 2026-11-11 (commit 58b7e20f has the breakdown).

## Before and after

Before: main c99ff83b. After: branch `ark-beh-prey`. The fixture, the groups, the real island, the town and the
encounter harness were run at dbc17840; the CI audit and the bench at a63e34e8, the commit after it (the scene's feed
of a meal's hunter, which none of these runs has, and one cached look-up in place of four, with the same answers).

### The fixture (180 prey species, 1,980 runs each side; the after pairs by the new links)

| Predator | React | Median m when it reacts | Flee | Share of the exposure reacting | feeding | Calm after it is gone, median / p90 s |
|---|---|---|---|---|---|---|
| asleep 6 m | 3.3% → 2.2% | 6 → 6 | 1.7% → 0% | 2.8% → 0.3% | 66.8% → 67.4% | 0 / 0 → 0 / 0 |
| resting 25 m | 6.1% → 3.3% | 25 → 25 | 0% → 0% | 6.1% → 0.2% | 61.5% → 64.7% | 0 / 0 → 0 / 0 |
| resting 12 m | 42.2% → 42.2% | 12 → 12 | 2.2% → 0% | 42% → 2.7% | 39.8% → 49% | 0 / 3 → 0 / 0 |
| resting 6 m | 61.1% → 60% | 6 → 6 | 31.7% → 3.3% | 60.9% → 8.1% | 28.6% → 40.8% | 3 / 3 → 0 / 27.3 |
| resting 3 m | 82.8% → 82.8% | 3 → 3 | 62.2% → 33.9% | 82.4% → 25% | 12.2% → 25.8% | 3 / 3 → 0 / 30.7 |
| passing 20 m | 56.1% → 57.8% | 31.8 → 28.8 | 0% → 0% | 39.5% → 6.9% | 38.3% → 44.2% | 0 / 3 → 0 / 0 |
| passing 10 m | 71.1% → 70% | 28.5 → 26.1 | 18.3% → 3.9% | 51.8% → 23% | 29.7% → 33.8% | 0 / 3 → 0 / 0 |
| passing 4 m | 88.9% → 89.4% | 26.1 → 23.1 | 62.2% → 42.2% | 58.3% → 39.2% | 21% → 24.5% | 0 / 3 → 0 / 0 |
| walking at it | 95.6% → 95.6% | 20.2 → 19.9 | 73.9% → 62.8% | 59.8% → 53.1% | 29% → 32.1% | 3 / 6.4 → 27.3 / 32.5 |
| stalking it | 89.4% → 75% | 23.1 → 9.1 | 71.7% → 57.8% | 60.9% → 24.5% | 27.9% → 51.9% | 3 / 3 → 29.2 / 32.5 |
| chasing past 6 m | 86.1% → 86.1% | 25.7 → 25.7 | 61.7% → 52.8% | 61.2% → 61.1% | 22.6% → 22.3% | 2.5 / 5.9 → 29.4 / 38.2 |

(The calm time is 0 where the animal was tolerating the predator when it went: it was calm already.)

After, by how it takes the predator (`ReactiveOut.response`, share of the exposure):

| Predator | tolerating | watching | moving off | frozen | running | holding where it ran (of which low at its refuge) | standing its ground | pulled in |
|---|---|---|---|---|---|---|---|---|
| resting 25 m | 3% | 0.1% | 0% | 0% | 0% | 0% | 0% | 0% |
| resting 12 m | 38.5% | 2.5% | 0% | 0.2% | 0% | 0% | 0% | 0% |
| resting 6 m | 51.2% | 4.7% | 0.6% | 1.5% | 0.1% | 0.3% | 0.9% | 0% |
| resting 3 m | 57.1% | 4.1% | 1.1% | 6.1% | 0.8% | 5.2% (0.7%) | 6.6% | 1.1% |
| passing 20 m | 30.9% | 6.6% | 0% | 0.3% | 0% | 0% | 0% | 0% |
| passing 10 m | 26.1% | 17.5% | 1.4% | 1.7% | 0.1% | 1.4% | 0.9% | 0% |
| passing 4 m | 16.1% | 17.8% | 0.7% | 4% | 1.5% | 12.3% (1.7%) | 2.5% | 0.4% |
| walking at it | 1.3% | 25.3% | 0% | 4.3% | 3.6% | 14.1% (1.8%) | 4.1% | 1.6% |
| stalking it | 0% | 4.5% | 0% | 2.1% | 1.7% | 12.2% (1.4%) | 2.8% | 1.2% |
| chasing past 6 m | 0% | 27.5% | 0% | 3.2% | 6.1% | 22.4% (3.2%) | 1.3% | 0.5% |

- **Resting predators.** Of the 76 species that noticed a predator lying up 12 m off, none is now `alert` for 95% of
  the minute (68 before): they look for a few seconds, then feed on warily (reacting 42% of the minute to 2.7%;
  feeding 39.8% to 49%).
- **A stalker** is first seen at a median 9.1 m, a walker at 19.9 m (23.1 and 20.2 before); fewer see it at all (75%),
  and those that run do so a median 0.65 s after they first see it (10.9 s for a predator walking at them, which
  they watch come).
- **The flight.** 462 runs with a flight (686 before: fewer run from a resting or passing predator). Median speed
  while moving 3.7 m/s (0.8); 5 under 0.5 m/s (146): a painted turtle's and a common frog's; 39 under 1 m/s (402). Of
  the 6 species that still run from a predator resting 6 m off, the median share of the minute spent in `flee` is
  2.1% (98.8%).
- **Styles** (the four close scenarios, by first stored defence). `threat` first: display 0% to 16.7% of the
  exposure, flee 60% to 26.7% of runs. `chemical` first: flee 29.2% to 0%, display 9%. `freeze` first: frozen 4.8%
  to 21.9% of the exposure, flee 69.3% to 39.3%. `group` first: reacting 84.5% to 47% of the exposure, feeding 9.5%
  to 23.6%.
- **Named animals** (after): a zebra with a lion lying up 12 m off tolerates it for 92% of the minute; with the lion
  walking at it, it watches from 32.8 m, bolts at 10.1 m, covers its 8.9 m at up to 7 m/s and holds there. A rabbit,
  a meerkat and a marmot run 2.4 to 3.1 m at 3.2 to 4.1 m/s and keep low at their refuge. A cape buffalo, a wild
  boar, a crested porcupine and a striped skunk face the cat and never run. A hedgehog and a tortoise pull in. A
  giraffe no longer meets a rock python as its hunter: it meets a lion, and runs.

### Groups

| Group | Head up, each | at the edge / inside | Somebody's head up | Calls as a predator walks up | Closest the group gets (spread against grazing) | All calm after it is gone, s |
|---|---|---|---|---|---|---|
| herd animal alone | 32.7% → 34.2% | | 32.7% → 34.2% | 4 → 1 | | 3 → 30.7 |
| herd of 5 | 2.7% → 25% | 2.5 / 2.7 → 23.8 / 23.2 | 3.9% → 74.2% | 20 → 5 | 0.76 → 0.5 | 10.2 → 30.7 |
| herd of 12 | 2.5% → 15.8% | 2.7 / 2.5 → 17.3 / 15.2 | 4% → 80.8% | 39 → 12 | 0.79 → 0.53 | 11.9 → 32.8 |
| flock of 5 | 2.8% → 23.9% | 2.8 / 2.7 → 24.3 / 24.9 | 3.9% → 74.7% | 21 → 5 | 0.82 → 0.52 | 12.5 → 31.2 |
| flock of 12 | 2.5% → 13.8% | 2.5 / 2.5 → 17.3 / 11 | 3.9% → 81.3% | 56 → 12 | 0.89 → 0.51 | 12.9 → 33.6 |
| sentinel species, 5 | 23.2% → 30% | 18.9 / 28.6 → 21.9 / 38.1 | 100% → 100% | 21 → 5 | 0.7 → 0.48 | 12.3 → 30.7 |
| sentinel species, 12 | 11.9% → 17% | 15.5 / 12.5 → 19.9 / 17.2 | 100% → 100% | 46 → 12 | 0.86 → 0.56 | 11.5 → 33.8 |

In a herd of five somebody's head is up three quarters of the time (4% before), each animal's a quarter of the time;
in twelve each looks up less (15.8%) and the herd more (80.8%). The edge shows in the twelves (17.3% against 15.2%
and 11%), not in the fives, where nobody is inside. Each animal calls once as the predator comes. The herd closes to
half its spread while it watches, and its flights start within 2.3 s of one another in a herd of five (5.9 s
before) and 3.9 s in twelve (7.2 s). Every member still notices and runs when the predator walks right up. The first
of a herd of twelve sees a predator walking in at 35.4 m (39.3 m before: one with its head down notices later).

### The real wild island

The layer run for 40 s round 80 moments where a prey animal has a hunter within 25 m (5 per hunter state and distance
band; each side's moments by its own links, so not the same 80):

| Hunter | Distance | Reacting, share of the 40 s | At its own business | `alert` | `flee` | Ran at all |
|---|---|---|---|---|---|---|
| resting | under 3 m | 55.2% → 36.8% | 38.5% → 54.5% | 14.2% → 25.8% | 39.7% → 10.4% | 80% → 80% |
| resting | 3 to 6 m | 63.2% → 28% | 36.8% → 72.1% | 39.8% → 18.8% | 19.6% → 1.7% | 20% → 20% |
| resting | 6 to 12 m | 4.7% → 7.9% | 88% → 92.2% | 4.7% → 7.9% | 0% → 0% | 0% → 0% |
| busy on the spot | 3 to 6 m | 98% → 15.9% | 1.9% → 82.9% | 95.1% → 15.9% | 0% → 0% | 0% → 0% |
| walking | 3 to 6 m | 68.5% → 44.4% | 31.1% → 51.6% | 33.4% → 30.3% | 35.1% → 14.1% | 80% → 80% |
| walking | 6 to 12 m | 72.9% → 42.8% | 26.2% → 50.5% | 43.4% → 40.1% | 29.6% → 2.7% | 40% → 40% |
| stalking | under 3 m | 79.7% → 70.4% | 15.3% → 11.1% | 16.2% → 51.2% | 61.2% → 6% | 100% → 100% |
| all 80 | | 55.1% → 27.1% | 42.6% → 67% | 35.2% → 23% | 19.2% → 2.8% | 36.3% → 28.8% |

Reacted at all 72.5% → 71.3%; median time to the first reaction 0.4 s → 1.1 s. A prey animal near a hunter now spends
two thirds of its time at its own business (43% before) and 3% of it in `flee` (19%): the runs are dashes.

Prey with a hunter of theirs within 25 m: 164.6 at a time → 155.6 (the links changed: 5,413 pairs of kinds → 4,889;
body mass drops a python's giraffe and adds a stoat's rabbit). Resting within 5 m of a resting hunter: 9 at a time →
9.1 (`spaceHomes` is unchanged: "What is left", 5).

### The town island

Animals with something the layer takes for their hunter within 25 / 10 / 5 m: 1,215 / 643 / 349 → 673 / 357 / 152.
Zoo animals are out of it altogether (3,293 pairs within 25 m before, 438 of them within 5 m inside one enclosure). The
pets are now hunters by their build, which makes 6,824 pairs between house animals within 25 m (a hen and the cat next
door) that the household rule keeps apart, and 3,678 between the town's own animals and a house pet that it does not
(659 within 10 m, 172 within 5 m: pigeons and house geckos by cats and dogs): the garden's birds now keep an eye on the
cat, and it watches them.

### The encounter harness (CI's `encounters` source, 150 pairs) and the reactive bench

| | Main | After |
|---|---|---|
| Encounters where the prey reacts | 62.1% | 61.7% |
| Close ones (under 6 m) where it runs | 58.9% | 38.9% (a still predator 4 m off: 50.7% → 17.3%; one walking past at 2 to 4 m: 63% → 49.7%) |
| Close ones where it uses any defence of its own | 62.9% | 56.9% |
| Median seconds to react, from when the predator is within 25 m | 0.1 | 0.67 (tolerating prey are feeding when it crosses 25 m; their next look is what is timed) |
| Species whose heads turn on their own | 81.3% | 81.3% |
| Time stopped for a still predator 10 m or more off | 99% of the 20 s | 18.2% |
| Median flight speed | 1.93 m/s (this harness did not pass the rig's `gait`; with it, 0.8) | 3.71 m/s |
| Calls per calling animal in an encounter | 4.3 | 1.1 |
| Grazers near a still camera: feeding | 65.3% | 65.3% |

The reactive bench (`scripts/ark-reactive-bench.mts`: 130 animals of 8 kinds in a block, lions and wolves among the
herds, CPU ms a frame, median, with and without sight lines; the machine was heavily loaded, so three runs of main
interleaved with the branch's):

| Tier (agents) | Main c99ff83b | Branch |
|---|---|---|
| high (90) | 0.92 to 1.23 | 1.37 to 1.66 |
| medium (48) | 0.32 to 0.35 | 0.43 |
| low (20) | 0.13 to 0.14 | 0.15 to 0.16 |

About a third more at the phone tiers in this worst case, where every prey animal has predators all round it. The
layer is bounded as before (the tier's nearest agents, perception every 2 to 4 frames, sight lines cached per pair).
The extra is more linked pairs (sight checks a frame at the high tier 34 → 57: wolves and zebras, lions and
chimpanzees are now hunter and prey) and the appraisal each reacting animal makes of its predator. Nothing new is
allocated per frame for a calm animal.

### The CI audit (`scripts/ark-behaviour-audit.mts`, CI's configuration, its fixture of 5,328 animals)

Near the camera (8 stops of 35 s beside a hunter, 238 prey with a hunter within 25 m):

| | Main c99ff83b | Branch a63e34e8 |
|---|---|---|
| Prey that react to a hunter | 97.5% | 92% |
| Prey that run from one | 71.8% | 42.9% |
| Median seconds to react | 0.3 | 0.6 |
| Time in `flee` | 33.2% | 4% |
| Time `alert` | 46.4% | 57.4% |
| Time looking round | 9.4% | 22.8% |
| Time feeding | 5.5% | 7.2% |
| Moments a whole group does the same | 72.9% | 66.5% |
| Animals that turn their heads | 97.5% | 97.5% |

The audit's fixture stands every hunter beside its prey and each stop starts a fresh layer, so most of a stop is the
first watch and the stop where it ran to: `alert` goes up as `flee` comes down. On the real island, where hunters are
mostly still and further off, the same animals spend two thirds of their time at their own business (above). Every
other check is as on main (the schedule is untouched): predators with prey within 5 m at spawn 129, animals that
never move 828, all 28 checks hold with the limits below.

Limits changed in `tests/ark-audit/thresholds.json`, each with its reason in the file:

| Check | Main | Now | Limit was | Limit is |
|---|---|---|---|---|
| near camera: prey that react to a hunter | 97.5% | 92% | ≥ 90 | ≥ 87 |
| near camera: prey that flee a hunter | 71.8% | 42.9% | ≥ 55 | ≥ 38 |
| encounters: close prey that flee | 58.9% | 38.9% | ≥ 53 | ≥ 35 |
| encounters: median seconds to react | 0.1 | 0.67 | ≤ 0.5 | ≤ 1.5 |
| encounters: time stopped for a still predator 10 m or more off (new) | 99% | 18.2% | | ≤ 30 |
| encounters: median flight speed, m/s (new) | 1.93 | 3.71 | | ≥ 3 |
| encounters: calls per calling animal in an encounter (new) | 4.3 | 1.1 | | ≤ 2 |


## What is left

1. **Nothing was looked at in a browser.** Every number is the layer's own, in node. What to look at first, on the
   real Ark with the camera by a herd: a flight (a zebra now covers its 8.9 m in about a second and a half at up to
   8 m/s, where it ambled at 2; the run clip is played by the distance covered, so the feet should hold, but nobody has
   seen it); the stop at the end of a dash; a herd closing up to half its spread; a buffalo's `threat_display` (the rig
   has no clip for it: it is the idle, facing the predator, head on it); and the town's birds with the cats and dogs.
2. **Mobbing is not built.** Small birds do not gather at a perched owl or hawk, meerkats do not mob a snake. The
   layer has no response that goes toward a predator except the heavy animal's few steps at it. It needs one
   (flocking, alarm-calling birds within about two flight distances of a raptor or owl that is `resting`: a few come
   to just outside its reach and call), and a sound for it.
3. **A flushed bird still runs.** `fly_off` birds on the ground run or hop off within their reach (2 to 4 m). A real
   flush needs a `lift` output and the flight clips (flee-envelope.md §6.4): lane B5's and the scene's rig block.
4. **Up the tree, into the water, down the burrow.** The local layer stops at the trunk, the edge and the entrance: a
   monkey runs to its tree and holds there, a frog to the bank, a meerkat crouches at its hole. Going up, in or down is
   the shared layer's (an offset cannot leave the ground it is on).
5. **Predators and prey at rest are placed as before.** `spaceHomes` keeps apart only the pairs in the schedule's own
   table. On the real wild island 9 animals at a time rest within 5 m of a resting hunter the schedule does not take
   for one. A what-if (`ark-prey-audit.mts real … --homes-only --wide-spacing`: homes also spaced by the layer's links
   where both live on land and the hunter is 0.4 m or longer): hunters with a prey home within 5 m 11 to 8 and within
   10 m 30 to 22 (what is left is fish and frogs of one water), predators moved 48 to 65, but animals with a capped
   range 93 to 161 and capped under 2 m 34 to 55. The island is too full for a 20 m safe distance round more pairs:
   three homes cleared for twenty-one more animals that can hardly move. Not done. Near the camera the layer now does
   the rest itself: a prey animal that finds itself beside a resting hunter moves off to the edge of its reach and
   stays there. The better fix is one table of who eats whom for the schedule and the layer (lane B3's generator makes
   `food-links.json`), and fewer animals per hectare is the server's.
6. **The schedule's wariness** (`threatAt`) still treats a top predator lying still like one walking, inside the
   shorter distance at which a still one is seen: it costs prey 1.2% of their awake time on the real island, so it was
   left alone.
7. **Dangers that are not predators.** A monkey pays a cobra no mind, an antelope an elephant walking through it:
   only what would eat an animal (or a much bigger hunter) is a threat.
8. **The young.** A parent shields its young and the young hide behind it where the scene gives the link (born on the
   Ark). There is no rule that puts a herd's young in its middle.
9. **The town is measured where its animals are placed,** not through a day on its schedule (the wild island is).
10. **The camera** is as it was for wild animals: shy individuals back off a step from one walking at them and
    sleepers wake to it; it is no predator. Kept animals no longer do either.

## For other lanes

- **B1 (hunt).** What the layer reads of a hunter, all of it from `stepReactive`'s inputs in `index.ts`:
  - `chasing`: the act's role is `hunter` and the act's speed is over 1.2 body lengths a second (0.36 m/s at least).
    Prey and anything not much bigger scatter at once, in one dash, and then stand (they dash again only if the
    chaser comes within 0.3 of their flight distance).
  - `shared.doing === "stalk"`: read as a predator creeping. It is seen from 0.4 of the distance a walking one is
    (conspicuousness 0.5 against 1.25) and heard like a still one, and once seen it sets prey off from 1.5 flight
    distances. It is fed from the schedule's `doing`, and (new here, a63e34e8) from a meal act's own state: a hunter
    whose act's `state` is `stalk` or `freeze` is fed as stalking, and as awake whatever its schedule says. So with
    the hunt lane's meal (a stalk of about 4.8 s over 2.5 m, then the rush) the quarry's neighbours see the stalker
    late and bolt when they do, where on main a hunter whose schedule had it asleep was no threat until it ran. A
    stalk at 0.52 m/s is under the `chasing` line for any hunter 0.44 m long or longer; a shorter one's stalk reads
    as a chase.
  - `shared.moving`: the act's speed over 0.3 m/s for a meal's hunter, else the schedule's. A hunter on a foray to
    its meal (`hunting.ts`) is drawn walking while its schedule's `moving` may be false: prey then read it as lying
    up. Not fixed (the foray's pose has no speed the feed can read); worth a `moving` on the foray's pose.
  - `shared.yaw`: a hunter heading within 40° of an animal is `coming` at it, else `passing`.
  - The local stalk (the crouch and the few steps toward prey near the camera) now runs only when the schedule's
    `doing` is `stalk`, or `wander` or `forage` with the layer's hunger over 0.5; a hunter doing anything else only
    watches.
  - A pack that goes with its hunting leader is read animal by animal, by the same inputs.
- **B3 (needs).** `intelligence.json` reads `data/ark/behaviour-profiles.json` and had not been regenerated since
  2026-11-11: 491 rows were stale. It needs regenerating whenever the behaviour profiles are
  (`npx tsx scripts/ark-intelligence-profiles.mts <export.json> <food_links.json> <traits.json>`, inputs in the
  handover folder: `intel-web/export.json`, `ark/food_links.json`, `ark/traits.json`). And the two tables of who eats
  whom (item 5 above): 4,889 pairs of kinds aboard the real wild island by the layer's links, 1,843 by
  `food-links.json`, 1,447 in both. `spaceHomes` already caps 93 of that island's 403 scheduled animals' ranges, 34 of
  them under 2 m.
- **B4 (land).** A flight is now up to 8 m/s through the reactive offset (it was capped by `gait`, mostly under
  2 m/s), with a ramp of `accelTime(L) / 3` and an eased stop. The scene plays the run clip by the distance covered
  (`reactiveClip`); at these speeds that is worth a look. `ReactiveInput.gait` is no longer read by the layer.
- **B5 (air).** Item 3 above: the flush.
- **B6 (water).** Fish of one water cannot be spaced apart and are not; a school closes up while it watches a
  predator (`closeUp`) and runs for a point past its middle, inside `offsetShare`'s water rule as before.
- **The audit lane.** `src/lib/ark-audit/model-schedule.ts` `cameraPass` mirrors `stepReactive`'s inputs without
  `speed`, `walkPace`, `runPace`, `roost` or `kept`: in the audit every animal flees at the middle of the speed
  scale and nothing goes to ground.

## What guards it

- `src/lib/ark-reactive.test.ts`, 39 tests, 11 of them new: who is a threat by body size (the giraffe and the python,
  the rabbit and the stoat, a cub, a pet by its build); a herd tolerating lions lying up and one animal alone doing
  the same, then watching one that gets up, closing up and running; a creeping predator seen later and bolted from
  at once; the flight as a dash at the chase's pace with a ramp, the stop and the settling after; a buffalo, a boar,
  a porcupine and a skunk standing their ground while a zebra and a rabbit run; a pheasant holding still until
  flushed and a meerkat going to ground at its bolt-hole; calming in proportion to the scare; vigilance by herd size
  and at the edge; a grazer with its head down noticing later than one on watch; kept animals; a cheetah giving way
  to a lion. Four older tests follow the new rules (the threat factors, the herd's first dash and its closing up,
  what a remembered predator changes, the armoured animal).
- `src/lib/ark-sleep.test.ts` and `src/lib/ark-chases.test.ts`: fixtures updated (a wolf walking up heads the way it
  walks; a creeping wolf wakes a sleeper later than a walking one; a chase's scatter is one dash each, across more
  than a radian).
- `tests/ark-audit/thresholds.json`: the changed limits and three new checks (below), each with its reason.

## Decisions made in this lane (the owner may want another)

1. **Zoo animals do not react to predators at all,** not even to one in their own enclosure (the aviary's buzzard
   and its cockatiels are taken to be used to each other). A hunter still watches across the fence.
2. **Pets hunt by their build.** The ecology gives cats and dogs no food links; the layer now has the town's birds,
   geckos and small animals wary of them, and a cat watching (and, when it is up and hungry, creeping at) the
   garden's birds. Nothing is ever caught.
3. **Prey feed in sight of a resting predator** from 1.15 times their flight distance for one lying still (which is
   0.6 of the stored distance): a zebra grazes from 4 to 9 m off a lion lying up, by its boldness (6.6 m for a
   middling one). The scene's distances are short; a viewer may find that close.
4. **A flight is up to 8 m/s** (it was under 2 m/s for most, by an old cap), over at most 9 m.
5. **Who stands its ground:** armed animals, and dominant ones (dominance 60 or more with a threat display, or 68 or
   more) at least half the predator's weight. That makes buffalo, boar, bears, moose, elk, eland, camels and musk
   oxen stand before big cats and wolves, and leaves zebra, deer and antelope running.
6. **Who can take whom by weight:** 4 times its own alone, 8 in a group, 12 in a pack, 1.5 for a bird of prey, 1 for
   a snake. A lion (in a group) is a threat to a giraffe by that, just; a lone leopard to a boar.
7. **How watchful a herd is:** a head up a quarter of the time in a herd of five, a sixth in twelve.
8. **Predator spacing was left as it is** ("What is left", 5).
