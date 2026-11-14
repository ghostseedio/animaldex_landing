# Ark behaviours pass, lane B6: life in the water (2026-11-14)

Owner, 2026-11-14: "do a full animal behaviours pass ensuring animal locomotion, predatory, hunting, hunger, behaviour
etc. is as natural as possible". This lane: everything that lives in or uses the water (fish, sharks and rays, whales,
dolphins and seals, sea turtles, crocodilians, jellyfish, octopus and squid, crabs and other invertebrates, frogs and
newts, otters, beavers, hippos, capybaras). Waterbirds were lane MA3's (2026-11-13) and are not redone here.

Branch `ark-beh-water` on landing main c99ff83b. Visual only: nothing here changes the server, its data or the shared
positions module. No API was called, nothing was uploaded.

## How it was measured

`scripts/ark-water-audit.mts` (new, a sibling of the movement audit's `ark-time-budget.mts`: the same wiring of the
pure behaviour schedule, the same twelve 10-minute windows across an island day, read every 2 s). Per species:

- where it is, awake and asleep: swimming, hanging still in mid-water, still on the bottom, at the surface (afloat or
  up for air), wading, ashore, in the air;
- its speed while it swims in body lengths a second, against its kind's cruise and burst (`locomotion/swim.ts`
  swimPaces, lane L2's), and how fast it turns;
- metres an hour, its range from home, how straight each 10 minutes was;
- for a school or a pod: nearest-neighbour distance and spread in body lengths, how aligned the headings are, the share
  of moments most members are moving, how far the group travels;
- for air breathers: breaths an hour, the usual gap, the share of the time at the surface;
- shore crossings a day and at how many places; a water-only animal out of the water.

Run on the real snapshot (`live.json` + `islands-routing.json`, the wild island's 186 animals of 117 species that swim,
wade or live in the water) and on the spawn validator's animals (every catalogue species, two of each) with schools
added (`--school slug:n`). `--taxonomy species.json` adds class, order and family to the JSON.

    npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-water-audit.mts public/ark-local/live.json --islands public/ark-local/islands-routing.json
    npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-water-audit.mts --ci      # the motion CI's run

The town's aquarium and home tanks are not on the schedule: their animals swim a fixed loop in their tank
(`islands/town/tanks.ts` tankPose, the town lane's). Read, not changed: see "Left".

A note on the brief's numbers: the time budget's "into/out of water 10/9" for the harbour seal is over its two sampled
hours, not a day. Scaled to a day the seal crossed its shore 288 times.

## What was wrong, worst first (the real snapshot on main c99ff83b)

Medians over the species of each way of life, awake:

| Way of life (species aboard) | swimming | still in mid-water | on the bottom | at the surface | ashore | asleep and swimming | shore crossings a day (median, most) | in the water |
|---|---|---|---|---|---|---|---|---|
| cruiser (6) | 32% | 68% | | | | 0% | | 100% |
| cetacean (1, the sperm whale) | 18% | 78% | | 5% | | 0% | | 100% |
| rover (14) | 9% | 86% | | | | 0% | | 100% |
| reef (12) | 29% | 60% | | | | 0% | | 100% |
| bottom (4) | 20% | 34% | 33% | | | 0% | | 100% |
| ambush (7) | 4% | 96% | | | | 0% | | 100% |
| sea turtle (2) | 26% | 71% | | 3% | | 0% | | 100% |
| seal (1) | 40% | 40% | | 4% | 16% | 0% | 288 | 47% |
| crocodilian (4) | | | | 13% | 87% | 0% | 192, 318 | 7% |
| terrapin (6) | 28% | 20% | | | 45% | 0% | 216, 480 | 63% |
| otter (3) | | | | 48% | 52% | | 300, 468 | 28% |
| wallower (2: capybara, coypu) | | | | 12% | 88% | | 104, 124 | 7% |
| dipper (3: boar, elk, a legless lizard) | | | | 27% | 73% | | 204, 528 | 8% |
| aquatic amphibian (2: clawed frog, axolotl) | | | | 35% | 65% | | 162, 228 | 35% |
| skater (1, the whirligig) | | | | 59% | 41% | | 252 | 76% |

("In the water" and a crossing count water a quarter of its length deep, 0.3 m at most: a boar walking through a
puddle has not crossed a shore. Shares are of the waking day; a crossing seen in the two sampled hours is 12 a day.)

1. **Nothing in the water keeps swimming.** Every swimmer's slot was the same: a dash of a few seconds to a seeded
   spot, then the rest of its 80 s hanging there on a land animal's stay beats (`peck`, `step`, `scan`: drawn as its
   swim clip, so not a land pose, but it does not move). The bull shark swam 12% of its waking day and hung still for
   88%; the giant manta 12%; the pilchard 65%, the anchovy 63%; a perch 20%, a chub 4%, a discus 6%; the sperm whale
   18%, ranging two body lengths. Cause: `behaviour-schedule.ts` tripFor's water leg is the straight way to the goal
   at 1.4 times its free pace, and every goal has a stay.
2. **Every fish sleeps on the spot** (asleep: hover 100%), tunas, sharks and pilchards included, which never stop.
3. **The shore is crossed every few minutes.** Each slot chooses afresh between a goal in the water and one ashore:
   the harbour seal 288 crossings a day, the crocodiles 132 to 318, the otters 204 to 468, freshwater turtles 176 to
   480, the capybara 84, the coypu 124, a wild boar 528, the whirligig beetle (which lives on the surface) 252.
4. **Crocodilians live on land.** Awake 73 to 94% ashore, asleep 100% ashore (their profile's roost is a crevice and
   their swim is one behaviour among a dozen): 7% of the day in the water, median (4 to 13%). The common hippopotamus has no
   swim at all in its profile (its text, "They rest in water by day", was not read as swimming): it never entered
   the water.
5. **One breath rhythm for every diver**: one breath on every third slot, 240 s apart, for a sperm whale, a turtle
   and a seal alike (a dolphin breathes every half minute; a great whale blows several times and then dives for
   minutes).
6. **Swimming speed is a dash**: a swim leg goes at 1.4 times the free pace from the speed stat, then stops. While
   they moved, cruisers went at 0.58 of L2's cruise for their size (median), the bull shark at 1.3 times it, an
   arowana above it; the median over a 10-minute window is far lower because they mostly hang.
7. **Schools do not travel.** A school's members keep by their leader (nearest neighbour 1.8 lengths, headings
   aligned while moving), which is right, but the leader hangs still four fifths of the time, so the school does:
   moving 21 to 23% of moments, travelling about 140 lengths an hour.
8. **Bed animals of fresh water walk ashore.** A crawler whose depth band is the pond bed but whose profile has no
   bed flag (the Danube river snail, the generic bivalve, the medicinal leech) is not "aquatic" to the schedule: the
   snail spent its whole waking day on the bank.
9. **A fish of the bed has no moving clip.** In its band a ray, a flatfish or a sturgeon is a "walker" of the floor;
   with no walk clip its rig fell through to its idle and slid.

Not wrong, checked: nobody in a depth band was drawn above the surface (0 samples); water-only animals out of the
water: 29 samples, all the giant mud crab at the tide's edge (1% of its day); solitary fish keep apart; ambushers
(pike, gar, snakeheads) hang still 96 to 98% of the time, which is theirs.

## What was changed

### Ways of life (`water-life.ts`, `water-life.json`, `scripts/ark-water-life.mts`)

Each water species has a way of life, from its stored family, order or class (and the stored text's "never stops
swimming" and "ambush"), the reason kept in `data/ark/water-life.json` (440 species), else from its behaviour profile:

| Way of life | Who | In the water |
|---|---|---|
| cruiser (47) | tunas, mackerel, herrings, pilchards, anchovies, jacks, billfish, mullet, open-water sharks, mantas and eagle rays | swims all slot long on a patrol, at 0.8 of its cruise |
| cetacean (22) | whales, dolphins, porpoises | the same at 0.6 of its cruise; its own breath rhythm |
| rover (the default) | most other fish | patrols 45 to 85% of a slot at 0.45 of its cruise, then hangs |
| sea turtle (6), sirenian (4), seal at sea (15), squid and cuttlefish (11) | | as a rover, each at its own share and pace |
| reef (89) | damselfish, wrasses, parrotfish, angelfish, triggerfish, puffers, gobies, seahorses, and the fish of cover in fresh water | 25 to 55% of a slot about a patch 0.4 of its range wide |
| bottom (41) | rays, flatfish, sturgeons, catfish, loaches, gurnards, the sharks that lie up | 15 to 40% of a slot, slowly |
| ambush (64) | pike, gars, snakeheads, groupers, scorpionfish, stonefish, frogfish, anglerfish, morays, wobbegongs | as before: still, a short swim now and then |
| drifter (18) | jellyfish, comb jellies, sea butterflies, the sunfish | drifts all slot long at 0.12 of its pace |
| den (6), walker | octopus; crabs, lobsters, stars, urchins | as before |

The animals of the shore (seal, crocodilian, terrapin, hippo, otter, beaver, wallower, dipper, frog, aquatic
amphibian, skater) are below.

### Patrols (`water-patrol.ts`; `behaviour-schedule.ts` waterPatrol in tripFor)

A swimmer whose way of life has a patrol goes from where the slot finds it to the slot's goal by a round through its
range instead of the straight line: points about its range's middle, each a sixth to a quarter turn on from the last,
the way it is already heading, until the way is as long as its pace covers in its time; it sets off the way it faces
and (one that never stops) comes in on the heading the next slot starts from, so slot after slot is one unbroken swim.
Every point and every run is over water deep enough for it; the way is walked at even steps and its corners rounded.
Its pace is L2's cruise for its size and style times its way of life's share. Where its water gives no room for a
round, it swims straight as before.

One that never stops has no rest on the spot (a "rest" is a swim on). Asleep it hangs at its roost as on main: a slow
round asleep was built, measured (the "asleep and swimming" figures below) and withdrawn before hand-back, see Left.

### Breaths (`breath-trip.ts`, `water-life.ts` breathRhythm)

A whale, a dolphin, a seal, a sea turtle and a manatee breathe on their own rhythm wherever their trip has them in the
water, a pure function of the clock and the animal: a dolphin or a porpoise (under 4.5 m) rolls up every 20 to 40 s for
about a second; a great whale blows 3 to 5 times 14 to 18 s apart and then dives for 4 to 8 minutes (longer the bigger);
a seal at sea dives 2 to 4 minutes and bottles for half a minute; a sea turtle comes up every 3 to 5.5 minutes, a
manatee every 2.5 to 4. A pod's members come up with their leader, within 3 s of it. The every-third-slot breathe
trip stays the penguins' and the other divers'. Asleep, the clock's slow cycle as before.

### The shore (`water-life.ts` shoreSide; `behaviour-schedule.ts` keepToSide)

An animal of the shore keeps to one side of the water's edge for a bout:

| | Its bouts |
|---|---|
| seal, sea lion, walrus | 3 hours: at sea 45% of them by day, 70% by night; hauled out at its roost the rest |
| crocodilian | on its bank from 7:30 to 11:00 (and, one day in three, 14:30 to 16:30); in the water the rest |
| terrapin (23 freshwater turtles) | out on the bank an hour at a time, two hours in five, between 8:00 and 16:30; in the water otherwise and all night |
| hippo | in the water from 5:30 to 18:30, ashore by night |
| beaver | in the water from 18:00 to 6:00 |
| otter | an hour and a half: fishing two bouts in five; the sea otter always on the water |
| wallower (capybara, coypu, tapir, rakali, desman) | 40 minutes: in the water 35% of them by day, 20% by night |
| frog, newt | half an hour: in the water 45% of them |
| dipper (any other land mammal, lizard or snake that swims) | 10 minutes: in the water 4% of them |
| skater, aquatic amphibian (axolotl, clawed frogs, mudpuppy, sirens, giant salamanders), sea turtle | always in the water |

Each animal's hour is its own by up to half an hour, so a colony does not turn as one. A goal on its side is kept; a
goal on the other side, or none, becomes its own resting place on its side (its spot in the water off its home; its
roost, or for a crocodile and a terrapin its own point on the bank), so where it is never depends on more than the
slot, like any other goal. A recipe whose place is on its side is kept (a bask on the bank in a bout ashore); one on
the other side waits for its bout.

Asleep, each is at its roost as every animal is: the sides are for waking hours. So that a crocodilian, the hippo and
an amphibian that never leaves the water sleep in it, the profile generator gives them a roost in the water (24 rows:
13 crocodilians, the common hippopotamus, 10 amphibians); a seal sleeps hauled out at its shore roost as on main.

### Smaller

- The profile generator reads "rests in water" and "spends the day submerged" as swimming: the common hippopotamus
  gets `swim` (the only row that rule changed).
- A swimmer with no swimming style of its own (a seal, a sea turtle, a squid) patrols at a swimmer's cruise for its
  size: its free pace is held to its walk clip's cadence, and a sea lion swam at 0.1 m/s.
- A crawler whose own depth band is the bed (the Danube river snail, a mussel, a leech) is kept in the water
  (`keepInWater` bedBound).
- A fish of the bed swims along it while it moves (`index.ts` rigFor, the water branch).

## After

The same audit on the same real snapshot, this branch (medians as above; main in brackets):

| Way of life | swimming | still in mid-water | ashore | asleep and swimming | shore crossings a day (median, most) | in the water |
|---|---|---|---|---|---|---|
| cruiser (6) | 100% (32%) | 0% (68%) | | 100% (0%) | | 100% |
| cetacean (the sperm whale) | 93% (18%) | 3% (78%) | | 97% (0%) | | 100% |
| rover (14) | 48% (9%) | 49% (86%) | | 0% | | 100% |
| reef (12) | 38% (29%) | 59% (60%) | | 0% | | 100% |
| bottom (4) | 27% (20%) | 34% | | 0% | | 100% |
| ambush (7) | 4% (4%) | 96% | | 0% | | 100% |
| sea turtle (2) | 48% (26%) | 49% (71%) | | 0% | | 100% |
| seal (1) | 17% (40%) | 18% (40%) | 57% (16%) | 0% | 0 (288) | 58% (47%) |
| crocodilian (4) | | | 0% awake (87%) | | 6, 234 (192, 318) | 83% (7%) |
| terrapin (6) | 35% (28%) | 38% (20%) | 15% (45%) | 0% | 0, 132 (216, 480) | 92% (63%) |
| otter (3) | | | 63% (52%) | | 24, 168 (300, 468) | 22% (28%) |
| wallower (2) | | | 77% (88%) | | 40, 60 (104, 124) | 14% (7%) |
| dipper (3) | | | 100% (73%) | | 0, 276 (204, 528) | 0% (8%) |
| aquatic amphibian (2) | | | 0% (65%) | | 0 (162, 228) | 100% (35%) |
| skater (1) | | | 0% (41%) | | 0 (252) | 100% (76%) |

By species, main to this branch:

| | swimming, awake | asleep and swimming | metres an hour | else |
|---|---|---|---|---|
| european pilchard | 65% to 100% | 0% to 100% | 215 to 1,259 | 2.3 lengths a second awake (cruise 2.7), 1.1 asleep |
| european anchovy | 63% to 100% | 0% to 100% | 110 to 1,046 | |
| bull shark | 12% to 96% | (awake all day in the snapshot) | 930 to 4,573 | 0.60 lengths a second (cruise 0.70) |
| giant oceanic manta | 12% to 100% | | 877 to 6,457 | |
| sperm whale | 22% to 97% | 0% to 97% | 830 to 6,589 | breath gap 240 s to 18 s between blows, then a dive |
| european perch | 20% to 64% | 0% | 39 to 231 | |
| european chub | 4% to 45% | 0% | 8 to 212 | |
| blue discus | 6% to 40% | 0% | 8 to 125 | |
| northern pike, alligator gar | 4%, 3% (unchanged) | 0% | 50, 7 | ambushers: left still |
| harbour seal | | | | shore crossings 288 to 0 in the sampled windows (8 a day at most by its rule); breath gap 222 s to 146 s with half a minute at the surface |
| american crocodile | | | | in the water 8% to 83% of the day; crossings 168 to 12 |
| mugger, spectacled caiman | | | | in the water 7% and 4% to 100% and 83%; crossings 216 and 132 to 0 |
| saltwater crocodile (2) | | | | in the water 13% to 71%; crossings 318 to 234 (see Left) |
| otters | | | | crossings 468, 300, 204 to 168, 24, 12 |
| capybara, coypu | | | | crossings 84, 124 to 60, 20 |
| red-eared slider, snapping turtle | | | | crossings 176, 480 to 40, 0; in the water 83%, 55% to 91%, 83% |
| whirligig beetle, african clawed frog | | | | in the water 76%, 64% to 100%; crossings 252, 228 to 0 |
| Danube river snail, bivalve, medicinal leech | | | | in the water 42%, 62%, 71% to 100% |

Speed while swimming: never-stop swimmers 0.89 of L2's cruise for their size, median (the patrols' paths come out a
little longer than asked); no swimmer's 95th percentile is over 0.37 of its burst. Turning: cruisers' and the whale's
95th percentile is 0.37 rad/s at most over 2 s.

### Schools, pods and the fixture

The motion CI's run (`--ci`: the validator's Ark, 40 species of every way of life, with schools of 12 pilchards, 12
mackerel, 8 tuna, 6 perch, 10 neon tetras, 8 chromis, 8 moon jellyfish and a pod of 6 spinner dolphins), main to this
branch:

| | main | this branch |
|---|---|---|
| never-stop swimmers, least share of the waking day swimming | 8% | 90% |
| the same asleep | 0% | 100% in this run; 0% as handed back (withdrawn, see Left) |
| their speed over L2's cruise, median | 1.06 (a dash, then still) | 0.89 |
| never-stop schools: share of moments most of the school is moving, least | 16% (the tuna) | 100% |
| headings aligned while moving, least (1: all one way) | 0.86 | 0.97 |
| nearest neighbour, body lengths: mackerel, tuna, pilchard | 2.3, 2.5, 5.5 | 2.4, 2.0, 4.4 |
| the school's travel, lengths an hour: mackerel, pilchard, tuna | 537, 821, 171 | 6,276, 5,560, 2,540 |
| the dolphin pod: nearest neighbour, alignment | 8.1 lengths, 0.26 | 2.1 lengths, 0.85 |
| the spinner dolphin's usual gap between breaths | 230 s | 40 s |
| the great whales' (humpback, sperm, orca) | 238 s | 18 s between blows, then a dive |
| seals and sea lions, most shore crossings a day | 168 | 54 (the california sea lion; the harbour seal 0) |
| crocodilians, least share of the day in the water | 9% | 72% |
| the common hippopotamus in the water | never (no swim in its profile) | 56% of the day |
| the european perch swimming, awake | 32% | 49% |
| ambushers swimming, awake, most | 8% | 8% |

Schools keep closer (0.6 of a flock's spacing; a small fish's spacing has a floor in metres, so a 20 cm pilchard's is
4.4 of its lengths) and a pod of whales or dolphins travels as a school does, each by its leader, where each
member swam its own round about the group's middle. A never-stop school or pod has no watch turn (one member in
turn hung still for a slot: a mackerel in twelve at any moment, a dolphin in six): this was changed after the run
above, so its swim shares are a little under what the code now gives (not re-measured: see Left).

As handed back (the `b6-water` check's last run, schools measured awake only, sleep at the roost): never-stop
swimmers swim 93% of the waking day at least and 0.89 of cruise; never-stop schools are moving in 100% of awake
moments, aligned 0.93 at least, nearest neighbour 5.0 lengths at most (the pilchard); the dolphin's breath gap 40 s;
seals' crossings 54 a day at most; crocodilians in the water 37% of the day at least (see Left); the hippo 56%; the
perch swims 50% of its waking day. All 20 numbers pass.

In the fixture the crocodilians still cross a 0.3 m depth line 168 to 216 times a day and the hippo 456 times (41
places): not run down (see Left).

## Guards

- `src/lib/ark-water-life.test.ts`: the ways of life of 40 species; who patrols; the breath rhythms' gaps; the shore's
  bouts (a seal at most 8 changes a day, a crocodile at least three quarters of the day in the water and on its bank
  at 9, a hippo two changes); the patrol route (length, over water, set-off and coming-in headings, corners).
- `src/lib/ark-breath-trip.test.ts`: changed. The turtles, seals and whales there now breathe on their rhythm, not
  on a breathe trip: for them it checks no breath out of the water, at least a breath per ten minutes in the water and
  under a turn in any 20 s; the penguins keep the old checks.
- `tests/ark-motion/metrics.json` check `b6-water` (`scripts/ark-water-audit.mts --ci`): never-stop swimmers' swim share awake and asleep, their speed over cruise and their turning; rovers' and ambushers' swim share; schools' nearest neighbour, alignment and moving share; the dolphin's breath gap, no whale never up; seals' and crocodilians' shore crossings, crocodilians' and the hippo's share of the day in the water; no water-only animal out of the water, none in a band over the surface. 21 numbers, each with main's value as `before`; limits are this branch's values with slack.

## Left, and why

- **Crocodilians asleep.** The tables' 71 to 100% of the day in the water were measured while the side rule also
  moved sleepers into the water. That was withdrawn for the same guards as the sleep round (asleep means at its
  roost), and the water roost was put in their profiles instead; but a crocodile with a den from the map
  (`scheduleRoost`, its text's burrow or bank) sleeps there, ashore, whatever its profile says. As handed back the
  fixture's least is 37% of the day in the water (main 9%); awake they are in the water outside their basking hours as
  measured. The real snapshot was not re-measured after this. To finish it: the map's den for a crocodilian at the
  water's edge or in it (the map lane's `place.ts`).

- **Never-stop swimmers still sleep on the spot.** A slow round asleep, from the roost back to it, was built and is in
  the tables above (asleep and swimming 100%), then withdrawn: it broke two of the schedule's own guards
  (`ark-behaviour-schedule.test.ts`: asleep means at its roost; asleep it keeps its heading slot after slot), and the
  second was a real fault, a turn of 0.2 to 0.6 rad at each slot's end where the closed round came in off its heading.
  It needs a round that closes exactly (or sleep's guards to know a swimmer that sleeps on the move): with lane B3.

- **Not seen by eye.** Nothing here was recorded in a browser (the shared Mac's load average was 300 to 1,000
  through the session; a headless run of this audit took 5 to 25 minutes). Everything above is from the pure
  schedule. To look at first: a sleeping cruiser (it moves on its patrol while its rig plays its sleep posture or
  idle; the body wave is L2's, by distance); a bed fish swimming along the bed (`rigFor`); a seal bottling for half a
  minute; a whale's run of blows.
- **A patrol's coming-in heading in tight water.** A never-stop swimmer comes in on the heading its next slot starts
  from where there is room for the straight run in (a sixth of the way). In the unit test's worst case, several laps
  of a 20 m lake, 12 of 40 patrols come in more than 0.3 rad off it, which is a turn of that size at the slot's end;
  in open water none of 40. On the real snapshot the worst turn over 2 s among cruisers is the bull shark's, 1.06 rad/s
  (2.1 rad in 2 s, once in its day); the sperm whale's 0.9.
- **A patrol found no room** in a few slots (the bull shark 4% of its day, the sperm whale 3%): it swims straight and
  hangs as before for that slot.
- **The saltwater crocodiles** still cross a 0.3 m depth line 234 times a day between them: in their water bouts
  they go to and from goals in the shallows at the edge (a recipe's place or a drink), which this audit counts as
  leaving the water. Their share of the day in the water is 71% (13% on main).
- **The european otter** 168 crossings a day (468 on main), the **wild boar** 276 (528), and in the fixture the
  crocodilians 168 to 216 and the hippo 456: not run down. The boar's and the hippo's goals are ashore in their land
  bouts, so these are most likely walks between dry goals through shallow water (the walk grid wades, and the audit's
  line is 0.3 m deep for a big animal); where a walk to a goal in the water is judged too winding the schedule keeps
  the animal where it is (`walkable`), which can hold a crocodile ashore in a water bout.
- **The last changes were not re-measured on the real snapshot.** After the runs above: the watch turn was taken
  from never-stop schools and pods; sleep went back to the roost for every animal (with the water roost for
  crocodilians, the hippo and the aquatic amphibians in their profiles), where the side rule had moved sleepers; seals,
  sea turtles and squid got a swimmer's cruise; a diver does not breathe on its rhythm during a recipe's episode. The
  tests and the `b6-water` check were run after them (see the hand-back); the tables above were not.
- **Ambushers** are as on main: still 96% of the time, a short swim now and then. No lunge (lane B1's).
- **Octopus and morays in holes** are not on the schedule's trips at all (`waterMotion` hole): an octopus never
  leaves its den to forage. Not changed.
- **Depth through the day.** A swimmer's depth is its band's slow cycle, the same day and night: no reef fish down in
  the reef at night, no deep scattering layer rising at dusk, no ray buried in the sand. Not changed.
- **No current** in the river, and nothing checks brackish water at the river mouth.
- **Schools** were right already in their spacing and alignment (see the CI numbers); what changed is that they
  travel. A school is still a loose cluster offset in the world's frame, not a body that folds and streams.
- **The town's tanks** (`islands/town/tanks.ts`, the town lane's): every tank animal swims a fixed ellipse at a fixed
  pace, an ambusher as well as a tuna. Its water life could be read there the same way (`waterLife`).
- **Memory.** A patrol's path is 20 to 120 points (a plain swim's was 2 to 10), and the schedule remembers each
  animal's last 24 to 32 trips: about 2 KB a trip, some megabytes for a few hundred swimmers. Not measured on a phone:
  for the heap gate.

For the rigging pipeline (no clip today): a jellyfish's pulse, a squid's and a cuttlefish's jet (backwards), an
octopus's crawl and jet, a scallop's clap, a crab's sideways walk in the water, a seahorse upright and holding on, a
whale's fluke-up dive and a dolphin's porpoise, a seal's bottling posture, a crocodile's float with only eyes and
nostrils out (today: its float line, 0.85 of its height under), a hippo's submerged walk. Queued already (decision
295): 70 legged swimmers without a stroke clip, 108 without water entry and exit clips.

For the server (a proposal, nothing done): none needed for this lane.

## For the other lanes

- **Hunt (B1).** The depth functions were not changed (`sea-depth.ts` is as on main: in the water the band still wins
  over the schedule's height, so a lake predator's foray is drawn in its band as before). A turn limit for swimmers is
  in `water-patrol.ts`, not `locomotion/swim.ts`: `patrolRoute` swims a way a step at a time and turns at most
  `STEP_TURN` (0.4 rad) a step, a turning circle of two and a half steps; it is not by body length. A foray's loop
  could be laid with it (it takes the two ends, their headings, a middle, a radius and a water test). A wrong-side
  `stalk` slot of a shore animal becomes a swim in its water bout (`keepToSide`). The otter's `chase_fish`: the
  recipe's own rate was not changed, but a recipe whose place is in the water now waits for the otter's water bouts
  (two bouts in five of an hour and a half), so its chases should fall to about two fifths of the 102 a day the hunt
  lane counted. Not counted here. About 30 to 50 a day would be this lane's guess at right for a river otter.
- **Prey (B2).** A never-stop swimmer's wary watch (a slot at the far side of its range facing the predator, hanging
  still) is as on main; it should be swum. The group watch turn was taken from never-stop schools and pods here.
- **Needs (B3).** What rest and sleep look like in the water is decided here by way of life, not by weights: a
  never-stop swimmer's "rest" is a swim on and its sleep is a slow patrol; a crocodilian, the hippo and the always-aquatic amphibians
  sleep at a roost in the water (their profile's roost, set in the generator's water-life roost rules). Sleep hours
  and where everything else sleeps are untouched. The profile generator's two edits: `movesOf` (the swim phrases) and
  the roost rule just before `src` is assembled in `profile()`.
- **Land (B4).** Two guards in `tripFor` skip a patrol leg (the turn-on-the-spot pause and the four-fifths squeeze),
  and its look-ahead is its own. The boar's and the hippo's many shore crossings look like walks through shallows.

