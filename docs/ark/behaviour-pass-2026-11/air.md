# Ark behaviours pass, lane B5: air (2026-11-14)

The owner's brief: "do a full animal behaviours pass ensuring animal locomotion, predatory, hunting, hunger, behaviour
etc. is as natural as possible". This lane: everything that flies. How often and why it takes off, where it goes, how
high, in what pattern, alone or in a flock, and what it does between flights.

Branch `ark-beh-air`, off landing main c99ff83b. Visual only: nothing here touches the server, a migration, production
data or the positions module. No API was called and nothing was pushed.

**The short answer.** Flight speed, take-off and landing were fixed in the movement rounds. What was still wrong was
the *shape of a flyer's day*: every bird that flies first chose a new goal every 80 s and flew to it, so a buzzard, a
kingfisher, a heron and a parrot all took off 26 to 61 times an awake hour, 2 to 4 s and 7 to 25 m at a time, and none
ever flew for more than a minute. Now each flyer has a way of life in the air (by family and how it hunts): it keeps
to a station and flies off it with purpose, a thermal soarer soars for minutes at a time in the warm hours and only
then, an aerial feeder is on the wing for most of its day in long sweeps, a small bird flits twig to twig, and a flock
goes up and comes down together.

## How it was measured

| Tool | What it does | Command |
|---|---|---|
| Flight budget (new, `scripts/ark-flight-budget.mts`) | The time budget's wiring with a one-second step and a record per flight. Per flying species: flights per awake hour, a flight's seconds and metres, its height, the kinds of flight (a hop, perch to perch, up to a perch, a round, a soar, hawking, with its flock), the hours flown, how many of a flock are up with their leader on a flight that goes somewhere and how far from it, whether a follower hangs in the air beside a perched leader, and what follows a landing. Medians by way of life first. `--trips <slug>` lists an animal's trips slot by slot. | `npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-flight-budget.mts public/ark-local/live.json --islands public/ark-local/islands-routing.json` (the real snapshot's wild island: 154 flying animals, 99 species; about 2 min) or `--validator` (every catalogue flyer with a spawn: 1,328 animals, 664 species; about 7 min) |
| Time budget (`scripts/ark-time-budget.mts`) | MA4's registered numbers (air speed over cruise, ground birds' air share), unchanged. | as in `docs/ark/movement-audit-2026-11-13.md` |
| Behaviour audit (`scripts/ark-behaviour-audit.mts`) | CI's 25 checks; its circling and turns now count the thermal soarers apart (below). | as in `tests/ark-audit/thresholds.json` |

The time budget's ten-second step had hidden the size of the problem: a two-second hop is seen one time in five, so
its "15 to 30 take-offs an hour" was really 30 to 60.

The town island was not measured: the flight budget builds the wild island's world only, and the town's birds at rest
are static figures (decision 255). The change is in the shared schedule, so the town's scheduled birds get it too.

## The audit: what was wrong, worst first

Measured on live main c99ff83b. "Wild" is the real snapshot's wild island, "validator" every catalogue flyer.
Severity: **H** most viewers see it within minutes; **M** often, or obvious once seen; **L** rare or subtle.

### 1. Every bird that flies first takes off 26 to 61 times an awake hour, whatever it is (H)

| Way of life (wild, main) | Species | Flights an awake hour (median, range) | A flight | Longest | Sits between |
|---|---|---|---|---|---|
| Sit and wait (kingfishers, robins, shrikes, a sparrowhawk) | 11 | 41.1 (36.6–54.3) | 3 s / 16 m | 46 s | 68 s |
| Soarers (buzzards, hawks, kites, the osprey) | 6 | 36.0 (0–60.6) | 3 s / 14 m | 63 s | 66 s |
| Vulture (turkey vulture) | 1 | 33.7 | 3 s / 23 m | 31 s | 69 s |
| Waders (herons, egrets, ibises, cranes, the flamingo) | 13 | 34.3 (6.9–45.7) | 4 s / 26 m | 44 s | 75 s |
| Shorebirds (sandpipers, lapwings, the killdeer) | 6 | 35.4 (24.6–41.1) | 3 s / 17 m | 42 s | 79 s |
| Parrots and other commuters | 13 | 39.0 (29.4–44.6) | 3 s / 18 m | 40 s | 74 s |
| Small birds in cover | 11 | 39.4 (28.6–53.1) | 3 s / 14 m | 25 s | 74 s |
| Ground feeders (thrushes, wagtails, munias, the myna) | 9 | 37.7 (30.9–40.6) | 3 s / 16 m | (a murmuration) | 78 s |
| Woodpeckers and the nuthatch | 4 | 43.4 (37.1–44.6) | 2 s / 8 m | 18 s | 67 s |
| Pelican | 1 | 32.0 | 3 s / 14 m | 38 s | 75 s |
| Birds that walk or swim first (MA3's) | 22 | 0.3–1.1 | 14–15 s / 140–150 m | 42 s | whole windows |

The common buzzard took off 60.6 times an hour, the white-throated kingfisher 54.3, the grey heron 33.7, the glossy
ibis 45.7, the turkey vulture 33.7, the great white pelican 32.0, the hyacinth macaw 41.7. Every one sat a median of
66 to 79 s between flights: one schedule slot.

- **Cause (code).** `behaviour-schedule.ts`: one goal a slot (`SLOT_SECONDS` 80), chosen afresh from the profile's
  weights, and for a bird that flies first nearly every goal is a flight: `fly`, `perch` and `soar` by definition,
  `forage` and `wander` in "air" mode, a drink, a rest in the shade. About three slots in four. MA3 gave birds that
  walk or swim first a low appetite for flying (`airShare`); a bird that flies first had none of it.
- **Real birds.** A buzzard or an eagle perch-hunting changes its perch a few times an hour; a kingfisher sits and
  plunges; a heron stands or stalks for half an hour and more; a sandpiper runs; a parrot clambers in one tree for a
  quarter of an hour; only a tit or a warbler really moves every few seconds, and then from twig to twig.

### 2. Nothing soars: the longest flight on the island is 63 s, and noon is like dawn (H)

- Soars were 4 to 30% of a raptor's flights, each one sweep inside its slot. The longest flight of any soarer in three
  sampled hours: common buzzard 63 s, red-tailed hawk 42 s, turkey vulture 31 s, great white pelican 38 s.
- Share of the awake time in the air in the warm hours (10 to 16) against the cool ones (6 to 9, 17 to 19): soarers
  10.0% / 8.3%, the vulture 10.7% / 5.2%. A real vulture is hardly up before the air warms and on the wing for hours
  after.
- **Cause.** A slot's flight ends on something within the slot (`airborneDoing`: "flights are goals, they land"), and
  the `soar` weight's hour curve (0.3 + 1.5 at midday) only shifts a pick among many.
- The behaviour audit guards circling at 1% of air time for all but the hawkers, because every bird used to circle
  over its own spot at 6 to 12 m. Thermal soaring is circling by nature, so the guard had to change deliberately
  (below).

### 3. Aerial feeders are mostly perched, and their time in the air is a 1.2 m circle (M)

Validator, main: the swallows and martins, nightjars and insect-hawking bats (14 species) are in the air 8.8% of their
awake time and the swifts (4) 23.9%; the barn swallow 9.0%, the common swift 22.4%, Kuhl's pipistrelle 8.0%. 58% of
the barn swallow's air time and 69% of the common swift's is the recipes' "air stay": a circle of six body lengths'
radius (1.2 m at the least) about the point its last sally ended at. Turns a minute: 8.7 and 10.2.

### 4. A flock's member hangs in the air beside its perched leader, and follows hops, not moves (M)

- A flock member "follows" whenever its leader's intent is a flight at the member's own slot start: a hop to the next
  twig as much as a move. Following, it keeps its place beside its leader for the slot (`shadowPoint`) at its
  leader's height, so beside a leader on a perch it stood in the air. Measured with the first station code (before the
  flock fix): the African grey parrot was beside its leader, both down, 35% of its awake time, and off the ground
  with nothing under it for 43% of that.
- On main a member was up with its leader for 48 to 70% of its leader's air time (parrots, the sanderling), 3.4 to
  4.6 lengths away at the median and 26 to 57 at the 90th percentile.
- A leader's real move was followed only when it happened to leave after its member's slot began: about two in five.

### 5. Waders and shorebirds live like songbirds (M)

Herons, egrets, ibises and the flamingo took 26 to 46 flights an hour, 9 to 24% of them up to a perch; the time
budget on main has the grey heron up on a perch 59% of its day and the masked lapwing 65%. A sanderling flew 40 times
an hour at 6.3 m. Their flights cruise at the songbirds' 6 m.

### 6. The murmuration takes birds that do not murmurate, and flies through the trees (M)

- The common wood pigeon (it walks first; fly weight 0.03) and Wilson's phalarope carry `murmuration` from a phrase of
  their text. `murmurationPose` is laid over everything for the whole window (17:27 to 18:15), so the wood pigeon was
  in the air for 600 s of a 600 s window through its rest, its feeding and its watch: 20.1% of the validator's sampled
  day aloft, 11.7 turns a minute. This is the queue's "wood pigeon `murmuration.6`" (decision 293) and MA4's
  registered 0.083 worst air share for a ground bird.
- The flock rides 14 to 30 m over its roost's ground. On the bigger island the woods are 20 to 25 m tall: the common
  hill myna spent 79% of its time in the air inside crowns.

### 7. A perched bird's call or preen ends with a second "in the air" (L)

A stay recipe's way back to where it began is a `fly` block for a flyer up on a perch. It goes nowhere, but it is
flagged aloft for about a second, so the rig starts a flight on the spot. Rare before (birds were seldom still on a
perch); it would have been common once they sat.

### 8. Rounds: a boxed bird's own flight is a 42 s loop out and back (L)

A bird whose range is capped by a predator's ground flies MA1's round for every `fly` pick: the great blue heron's
flights were all rounds (6.9 an hour, 41 s, 530 m), the Javan pond heron's 40%, the barn owl's 18 of 32 on the
validator. A round goes nowhere. It stays as the only flight a boxed bird has, but it is now one foray in many slots.

### 9. What the audit found right, or outside this lane

- Speed, take-off and landing (MA1): air legs at the cruise, runs and skis. Not re-measured beyond MA4's metrics.
- Birds that walk or swim first (MA3): 0.0 to 1.1 flights an hour on the wild island, flights of 14 to 16 s. The
  validator's worst are 2.4 to 4.8 an hour (western crowned pigeon 4.8, bufflehead 4.2, the smew 2.4). Left as they
  are; see "Left".
- Owls and nightjars fly at night and dusk only (their activity); bats by night.
- **Insects.** Only 2 flying-insect species are on the behaviour schedule on the validator's Ark; the rest are micro
  animals at their plant (`micro.ts`, not this lane's). Butterflies, bees, dragonflies and moths are therefore not
  changed here beyond the ways table's rows for them (`flower`, `dragon`, `bug`, all without stations).
- **Pairs.** A pair is not a group in the placement (`GROUPED` has no "pair"), so pairs do not fly as pairs. Not
  changed (placement is the server's).

## What was fixed

### A. Ways of life in the air (`scripts/ark-flight-ways.mts`, `locomotion/flight-ways.json`, `FLIGHT_WAYS`)

A new generated table gives each of the 692 species that fly first one of 17 ways of life, by rule: its family (from
`data/ark/locomotion-styles.json`), how it hunts (`intelligence-profiles.json`: `aerial_hawk`, `perch_wait`), its
body plan and diet (`behaviour-profiles.json`). Committed inputs only; the reason for each row is in
`data/ark/flight-ways.json`.

| Way | Who | Species | Station | Bout (slots of 80 s) | Foray share | In the air |
|---|---|---|---|---|---|---|
| `soar` | buzzards, eagles, kites, harriers, the osprey | 28 | a perch, one of the highest third near it | 30 | 0.025 | thermal soars, 55% of bouts in the warm hours, 8–16 slots |
| `vulture` | vultures, condors, frigatebirds | 14 | a perch (high) | 36 | 0.015 | thermal soars, 90% of bouts, 24–36 slots |
| `stork` | storks, pelicans | 15 | the shallows | 24 | 0.02 | thermal soars, 30% of bouts, 10–18 slots |
| `perch` | kingfishers, bee-eaters, rollers, flycatchers, shrikes, falcons, sparrowhawks, owls, frogmouths, cuckoos, cormorants | 83 | a perch | 12 | 0.07 | its recipe's sallies and plunges |
| `aerial` | swallows, martins, nightjars, the pratincole, bats that hawk insects | 14 | a perch | 14 | 0.25 | hawking sweeps, 90% of bouts, 8–13 slots |
| `swift` | swifts | 4 | a perch | 30 | 0.25 | hawking sweeps, every bout, all of it |
| `flit` | tits, warblers, wrens, white-eyes, sunbirds, bulbuls, manakins | 58 | a perch | 4 | 0.12 | flits to a twig nearby every slot, 1 to 3 hops |
| `tree` | woodpeckers, nuthatches | 9 | a perch | 5 | 0.05 | flits 60% of slots |
| `ground` | thrushes, sparrows, finches, wagtails, starlings, crows | 78 | by turns the ground and a perch | 4 | 0.1 | flits 30% of slots on a perch |
| `commute` | parrots, hornbills, toucans, birds of paradise, fruit bats | 95 | a perch | 10 | 0.03, 0.22 at dawn and dusk | flits 20% of slots |
| `wader` | herons, egrets, ibises, cranes, flamingos | 42 | the shallows | 24 | 0.02 | |
| `shore` | sandpipers, plovers, stilts, jacanas | 32 | the ground | 8 | 0.06 | cruises at 2.5 m |
| `patrol` | gulls, terns, gannets, petrels, albatrosses, auks | 39 | a perch (rock, post, ledge) | 10 | 0.1 | |
| `hover` | hummingbirds | 8 | a perch | 6 | 0.12 | |
| `flower`, `dragon`, `bug` | insects | 173 | none | 0 | 1 | as before |

A bird that walks or swims first has no row: it flies as MA3 set it.

### B. Stations (`behaviour-schedule.ts` `stationed`, wrapping `rawIntent`)

- Time is cut into bouts for each animal (the way's length, 0.7 to 1.3 of it by the animal's own seed). A bout has a
  station: a perch from a thinned list (no two within 4 m or ten body lengths, so a new station is the same perch or a
  real move, never a metre along a branch), the shallows, or a patch of ground.
- Of what the schedule picks for a slot, the bird flies off for only its way's share (a foray: out, and back the next
  slot). The rest it does at its station: it sits (the stay beats, and the recipes' calls, preens and stretches, which
  run on a stay), walks its patch (1 to 6 m across its radius; one resting place a bout), stands in its shallows, or
  flits.
- Its recipes are most of why it flies with purpose, so they have their own share (`recipes`: 0.12 for the soarers,
  0.3 to 0.5 for most, 0.6 for waders and shorebirds): a kingfisher's plunge from a perch by the water, a heron's wade
  and spear, a bathe, a nest to build. A recipe that runs from a perch (a flycatcher's `hawk_insects`) runs from the
  station's perch every time it is picked.
- Only while it is awake by the hour: a flock's night watch and every sleeping slot are untouched.
- Sleep, the way to roost, a wary watch of a predator in sight and a sitter on its nest are untouched.
- One down on the ground or in the shallows between two spots walks up to 15 m (`AFOOT_MOST`), and further where
  MA1's own rule has it walk (a way its flight would crawl over), for as long as its walk takes most of a slot; it
  flies a longer way. In the shallows it stands at its station: its wading is its recipe's.
- A heavy bird's stations are a flight worth its take-off and landing apart where its range has the room.
- What it shows as at its station: its own rest, preen or watch; feeding, as it feeds there (watching from a perch
  or the shallows, pecking about on the ground); a flight it does not take, looking about; a wander or a drink it
  does not take, preening. So a flock at its station is not all one state.
- Its way's cruising height where it sets one (`shore` 2.5 m, `aerial` 4, `wader` 5).

### C. Thermal soaring (`locomotion/flight.ts` `soarAt`, `behaviour-schedule.ts` `soaring`, `soarTrip`)

- A soarer's bout that starts in the warm hours (`THERMAL_HOURS` 10:00 to 16:30) starts, for its way's share of them,
  with a soar: up from its station in the first slot, on its track for the next ones, down to its new station in the
  last. The slots between end in the air (`Intent.aloft`): the first flights on the schedule that do not land in
  their slot. Up into it, it flies out along a tangent of its circle; down out of it, it turns at its bank's radius
  until it heads for its landing and flies straight in, with a turn or more extra where it needs the way to come down
  over.
- `soarAt` is a pure function of the seed, the home and the world time, with no memory: thermals of 130 to 190 s
  within 110 m of home (never past the range cap where that leaves room), each drifting with one island wind
  (0.35 m/s). The bird joins a thermal's circle on a tangent, circles its own way round at its glide's pace banked
  24 degrees (radius v²/(g tan 24°): a common buzzard 17 m, a turkey vulture 23 m, a pelican 40 m), rising, leaves
  on the tangent to the next thermal and glides there at its cruise, sinking.
- Its height: a floor 18 m over its home's ground plus its lift (to 36 m for the hawks, 50 for the vultures, 40 for
  storks), aiming for 8 m over the ground, the rocks and the crowns under it (looked for every 2 m of its way), eased
  3 m/s at most.
- A flock soars as a kettle: the same thermals, each member a few seconds behind on its own radius and height.
- **Not the old failure.** That was every bird in a circle of 6 to 12 m over its own spot, followers on the leader's
  circle. A soar is at least 12 m in radius, rises, drifts, belongs to three ways of life and to the warm hours, and a
  member is never at its leader's side (tested: 0 of 10,800 samples within 4 m on the same heading).
- For lane B1: `soarAt(seed, home, spec, time, member)` and `hawkAt(...)` are the pure soar and quarter primitives,
  `flightHop(paces, from, to, height)` a hop's take-off and landing profile (position, height, speed and stage at t
  seconds), and `stationPerch(...)` (exported from the schedule) a perch that suits a body within a radius.

### D. Hawking on the wing (`hawkAt`, the `aerial` and `swift` ways)

- An aerial feeder's bouts start with time on the wing whenever it is awake: long sweeps in a figure of eight over a
  patch that wanders about its home, turning one way and then the other, quickest through the middle, low over what is
  under it (1.6 to 4.8 m, a swift 2.4 to 7.2 m). The patch is centred on the most open of nine spots about its home
  (`openPatch`); over a wood it keeps over the crowns.
- The recipes' "air stay" (after a sally) is the same shape, small: a figure of eight 3 to 12 m each way, not a circle
  of 1.2 m.

### E. Flocks (`stationed`, `shadowOf`, `flockDown`, `shadowPoint`)

- A flock keeps one station: its leader's bout, each member its own place by it (a twig of the same tree within the
  flock's spread, its own side of the patch).
- A member flies with its leader on a flight that goes somewhere (a move to the next station, a foray), in its leader's
  slot now or the one that starts during its own: it waits and takes off with it. Nine times in ten (`FLOCK_FOLLOWS`).
  A hop to the next twig is each bird's own.
- It comes down with its leader: over the last 4 s of its leader's flight it eases to its own landing place, which is
  its own place at the new station.
- Beside a leader that is down it is on the ground under its own place, never in the air at its leader's height.

### F. Flits (`flitLegs`)

A way that flits every slot (tits, warblers, bulbuls) makes one to three hops a slot, twig to twig within 3 m or 25
body lengths of where it is going, with a look round or a peck on each. Each hop is straight. Only a bird under a
kilo flits (one that springs off at more than half a g): a macaw or a hornbill clambers.

### G. A flyer drawn without a rig (`unriggedFlightPitch`, `index.ts` the scheduled pose)

The graphics pass reported a greater flamingo with no rig flying as its standing mesh pitched head down. Real: the
scheduled pose pitched every flyer 0.95 rad nose down and banked it 0.35 rad to one side for the whole of every flight
(the first scene's "glide"); a rig's own attitude replaced it, a bird with no rig showed it. Now its body is level in
level flight, 0.2 rad nose up on its run and climb, 0.1 rad nose down on its glide-in (eased), and its wings level. The
house starlings' murmuration and the unscheduled circle lose the same constant.

### H. Recipes (`behaviour-recipes.ts`)

- `murmurationOf`: only a bird that flies first (the wood pigeon and Wilson's phalarope are out), and its centre's
  level is high enough to keep its lowest birds over the tallest crown within its spread.
- `keyPose`: a travel block that goes nowhere is not "aloft".
- `airStay`: the figure of eight (D).

## Before and after

Flight budget, one-second steps, main c99ff83b against this branch. "Wild": the real snapshot's wild island (154
flying animals, 99 species, twelve 15-minute windows through a day). "Validator": every catalogue flyer with a spawn
(1,328 animals, 664 species, eight 10-minute windows). Medians over a way's species; warm / cool is the share of the
awake time in the air at 10:00 to 16:00 against 06:00 to 09:00 and 17:00 to 19:00.

The tables are from the last full runs. After them the way a soar comes down changed (a turn and a straight) and how
finely it looks under itself; the wild island's soarers were run again on the final code: soarers 5.1 flights an awake
hour (5 species in that run; the common buzzard 7.6, 17.1% of its awake time in the air), the turkey vulture 3.4 and
42.5%, the great white pelican 2.3 and 15.0%.

**Wild island (real snapshot)**

| Way | Species | Flights an awake hour | In the air | Longest flight | Height in the air | Sits between | Warm / cool |
|---|---|---|---|---|---|---|---|
| `soar` | 6 | 36.0 → 3.4 | 9.6% → 12.0% | 63 → 900 s | 22.5 → 41.2 m | 66 → 616 s | 10.0 / 8.3% → 26.6 / 0.4% |
| `vulture` | 1 | 33.7 → 3.4 | 8.3% → 42.3% | 31 → 900 s | 18.5 → 50.8 m | 69 → 703 s | 10.7 / 5.2% → 66.9 / 0.1% |
| `stork` (the pelican) | 1 | 32.0 → 2.3 | 11.7% → 14.6% | 38 → 643 s | 22.4 → 59.5 m | 75 → 900 s | 13.7 / 9.6% → 10.2 / 0.0% |
| `perch` | 11 | 41.1 → 10.3 | 5.7% → 1.1% | 46 → 43 s | 7.5 → 10.7 m | 68 → 136 s |  |
| `flit` | 11 | 39.4 → 33.1 | 5.0% → 1.7% | 25 → 16 s | 7.7 → 12.0 m | 74 → 78 s |  |
| `tree` | 4 | 43.4 → 26.9 | 2.6% → 1.0% | 18 → 5 s | 7.8 → 12.1 m | 67 → 84 s |  |
| `ground` | 9 | 37.7 → 17.7 | 5.0% → 1.6% | (a murmuration) | 7.4 → 8.3 m | 78 → 134 s |  |
| `commute` | 13 | 39.0 → 14.3 | 5.3% → 1.2% | 40 → 18 s | 6.7 → 12.6 m | 74 → 119 s |  |
| `wader` | 13 | 34.3 → 1.7 | 6.8% → 0.1% | 44 → 17 s | 6.1 → 2.9 m | 75 → 900 s |  |
| `shore` | 6 | 35.4 → 8.1 | 5.2% → 0.8% | 42 → 42 s | 6.9 → 2.6 m | 79 → 251 s |  |
| `patrol` (the silver gull) | 1 | 36.0 → 9.1 | 5.1% → 1.1% | 16 → 12 s | 6.0 → 6.9 m | 74 → 138 s |  |
| `hover` (the coquette) | 1 | 36.0 → 9.7 | 5.1% → 1.2% | 19 → 12 s | 6.8 → 16.1 m | 77 → 229 s |  |
| walks or swims first | 22 | 0.6 → 0.6 | 0.2% → 0.2% | 42 → 42 s | 1.8 → 1.8 m | 900 → 900 s |  |

(900 s is the whole window: a flight still on when it ends.)

| Species (wild) | Way | Flights an awake hour | In the air | Longest flight | Height |
|---|---|---|---|---|---|
| common buzzard | soar | 60.6 → 7.6 | 15.8% → 17.0% | 63 → 702 s | 9.3 → 41.6 m |
| red-tailed hawk | soar | 38.3 → 6.3 | 13.2% → 14.7% | 42 → 900 s | 24.6 → 40.8 m |
| osprey | soar | 45.7 → 5.1 | 8.2% → 3.8% | 31 → 171 s | 14.0 → 56.9 m |
| turkey vulture | vulture | 33.7 → 3.4 | 8.3% → 42.3% | 31 → 900 s | 18.5 → 50.8 m |
| great white pelican | stork | 32.0 → 2.3 | 11.7% → 14.6% | 38 → 643 s | 22.4 → 59.5 m |
| white-throated kingfisher | perch | 54.3 → 24.0 | 4.9% → 1.7% | 22 → 9 s | 6.0 → 6.1 m |
| common kingfisher | perch | 50.3 → 22.9 | 3.7% → 1.7% | 43 → 6 s | 5.6 → 8.9 m |
| laughing kookaburra | perch | 38.3 → 8.0 | 7.3% → 1.1% | 44 → 43 s | 23.8 → 25.8 m |
| European robin | perch | 48.6 → 15.8 | 5.7% → 1.2% | 26 → 17 s | 8.4 → 10.7 m |
| grey heron | wader | 33.7 → 1.7 | 6.9% → 0.4% | 28 → 17 s | 6.7 → 5.0 m |
| great egret | wader | 25.8 → 2.1 | 2.6% → 0.2% | 44 → 4 s | 3.7 → 2.3 m |
| glossy ibis | wader | 45.7 → 9.7 | 9.8% → 0.8% | 24 → 4 s | 7.3 → 1.6 m |
| limpkin | wader | 43.0 → 2.0 | 9.8% → 0.7% | 29 → 15 s | 6.0 → 5.0 m |
| greater flamingo | wader | 34.3 → 0.3 | 5.8% → 0.1% | 26 → 12 s | 7.6 → 5.0 m |
| sanderling | shore | 40.5 → 12.7 | 5.8% → 1.0% | 18 → 12 s | 6.3 → 1.9 m |
| southern lapwing | shore | 32.5 → 0.3 | 5.1% → 0.4% | 42 → 42 s | 20.0 → 3.4 m |
| scarlet macaw | commute | 42.9 → 7.4 | 5.4% → 1.2% | 16 → 15 s | 10.6 → 18.3 m |
| hyacinth macaw | commute | 41.7 → 12.6 | 8.2% → 1.8% | 40 → 15 s | 6.8 → 14.2 m |
| African grey parrot | commute | 40.9 → 21.4 | 5.6% → 1.3% | 16 → 14 s | 6.7 → 12.2 m |
| great tit | flit | 39.4 → 26.9 | 5.7% → 2.4% | 17 → 16 s | 8.7 → 11.2 m |
| downy woodpecker | tree | 43.4 → 25.1 | 3.3% → 1.3% | 17 → 5 s | 8.0 → 10.6 m |
| silver gull | patrol | 36.0 → 9.1 | 5.1% → 1.1% | 16 → 12 s | 6.0 → 6.9 m |

**Validator (every catalogue flyer)**

| Way | Species | Flights an awake hour | In the air | Longest flight | Height in the air | Warm / cool |
|---|---|---|---|---|---|---|
| `soar` | 28 | 14.7 → 1.2 | 9.4% → 4.7% | 66 → 600 s | 20.0 → 41.3 m | 11.8 / 6.8% → 11.6 / 0.0% |
| `vulture` | 13 | 35.4 → 2.4 | 9.1% → 33.5% | 42 → 600 s | 22.6 → 53.1 m | 11.3 / 7.5% → 82.9 / 0.1% |
| `stork` | 15 | 25.2 → 1.8 | 7.7% → 1.1% | 42 → 600 s | 21.3 → 48.1 m | 9.5 / 6.7% → 2.9 / 0.0% |
| `perch` | 83 | 31.2 → 6.0 | 4.8% → 0.4% | 50 → 43 s | 8.9 → 10.7 m |  |
| `aerial` | 14 | 38.4 → 11.7 | 8.8% → 68.7% | 318 → 600 s | 4.9 → 15.3 m |  |
| `swift` | 4 | 31.8 → 8.7 | 23.9% → 83.5% | 256 → 600 s | 4.9 → 14.3 m |  |
| `flit` | 58 | 29.1 → 29.1 | 3.6% → 1.2% | 42 → 137 s | 8.2 → 11.0 m |  |
| `tree` | 9 | 34.8 → 22.2 | 5.5% → 0.9% | 42 → 40 s | 15.3 → 9.5 m |  |
| `ground` | 78 | 29.4 → 12.9 | 5.2% → 0.9% | (murmurations) | 8.1 → 8.3 m |  |
| `commute` | 95 | 33.0 → 12.6 | 5.9% → 0.9% | 44 → 43 s | 8.8 → 11.4 m |  |
| `wader` | 42 | 29.1 → 0.9 | 6.2% → 0.1% | 44 → 43 s | 9.4 → 2.5 m |  |
| `shore` | 31 | 32.4 → 4.8 | 4.7% → 0.6% | (murmurations) | 6.7 → 2.5 m |  |
| `patrol` | 37 | 30.6 → 8.4 | 5.9% → 0.9% | 45 → 44 s | 6.6 → 6.0 m |  |
| `hover` | 8 | 22.8 → 7.2 | 4.7% → 0.5% | 41 → 40 s | 8.2 → 7.6 m |  |
| walks or swims first | 147 | 0.6 → 0.6 | 0.0% → 0.0% | (murmurations) | 2.1 → 1.8 m |  |

(600 s is the whole window.)

Other numbers (validator unless said):

- Barn swallow: in the air 9.0% → 77.2% of its awake time, 8.7 → 3.5 turns a minute, 58% → 0% of its air time on the
  "air stay" circle. Common swift 22.4% → 92.9%, 10.2 → 3.5 turns a minute. Kuhl's pipistrelle 8.0% → 81.8%. European
  nightjar 12.6% → 64.7%.
- Barn owl 19.2 → 1.2 flights an hour; golden eagle 10.2 → 0.6, its longest 42 → 297 s; white-bellied sea eagle 0.0 → 3.6
  (its range is pinned to 0.3 m by its prey's spacing: decision 302's queue; it soars now, 16.8% of its awake time in
  the air); Andean condor 37.8 → 2.4, 9.1% → 35.2% in the air.
- Common wood pigeon: 20.1% → 0.1% of the sampled day in the air (no murmuration). The common hill myna's murmuration:
  79% → 5% of its air time over woods inside crowns (wild).
- Hover-and-drop hunts (the hunt lane's count: a common buzzard 97 a day): segments in the air under `hover_drop` in
  100 sampled minutes of two animals: common buzzard 26 → 12, common kestrel 39 → 21, American kestrel 46 → 24,
  black-shouldered kite 43 → 12. The recipe is one of a stationed bird's outings now (`recipes` share).
- Flocks: a member up with its leader on a flight that goes somewhere, wild: red lory 89%, blue-fronted amazon 93%,
  African grey parrot 83%, sanderling 82% (main, over all of its leader's air time: 50%, 48%, 67%, 70%). Median over
  flocking species: 83.3% wild, 73.1% validator; 11.6 and 12.3 body lengths from its leader at the median (their
  flights are 3 to 15 s, most of it easing out of and into their own places). A follower off the ground with nothing
  under it: 1.3% of its awake time at the worst on the wild island, 2.1% on the validator.
- Species seen to fly at all in the validator's 80 sampled minutes: 579 → 542 of 664. The ones that now sit through
  the sample, by way: walk or swim first 71, wader 14, perch 13, soar 5, ground 5, commute 5, patrol 4, stork 3, flit 1, tree 1.
- MA1's fixture numbers (`ark-flight-physics.test.ts`): air speed over cruise, median 0.80, slowest 0.47 (the grey
  heron; limit 0.35); take-off and landing acceleration 1.060 of its mass's cap (limit 1.08), big birds 0.520 g (limit
  0.54); cruise inside crowns 2.8%, with room to be over them 0.2% (limit 1%).
- MA4's time budget on the validator (`ark-time-budget.mts`): flying species under 0.35 of their cruise 18 (main, from
  NEXT.md, over every air leg) → 1 over flights that go somewhere (the wandering albatross, 0.34); median 0.851 →
  0.869, tenth percentile 0.452 → 0.567; a ground bird's worst share of the day in the air 0.083 → 0.024; its worst
  take-offs an hour 3.43, unchanged (the smew); the coot 98.1% and the great crested grebe 71.3% of the day on the
  water.
- Behaviour audit, CI's configuration (the run before the last refinements of the sat-out states and the landing
  curve): flyer species that fly 690 (main, NEXT.md) → 684; everyone but the hawkers and the soarers, circling 0%,
  0.67 turns a minute; the hawkers 36% → 25.3% and 7.77 → 3.48 turns a minute, in the air 18,739 s → 116,789 s of the
  hour; never move 828; amphibians 428 → 423; a whole group does the same 16.1%; near the camera prey react 95%, flee
  66.7%. 24 of 25 checks inside the old limits; the 25th is the variety limit (below).

## Guards

| Guard | Where | Limit (measured) |
|---|---|---|
| Each way's row and rule; bouts cover every slot; a soar's share of bouts | `src/lib/ark-flight-ways.test.ts` | table rows for 29 reference species |
| A soar is wide, rises, drifts, never jumps | same (`soarAt`, a buzzard's and a vulture's, 30 min at 4 Hz) | radius ≥ 12 m; never sinks in a thermal; a quarter second's step ≤ 1.3 of its glide; heading step ≤ 0.3 rad; a minute's track wider than its circle |
| A kettle's member never at its leader's side | same | 0 of 10,800 samples within 4 m on the same heading |
| An aerial feeder turns both ways | same (`hawkAt`) | left over right turning ≥ 0.7; pace 0.35 to 1.3 of cruise |
| On the fixture: soarers soar for minutes in the warm hours and not at dawn; no jump or snap where slots meet | same | longest ≥ 480 s; warm share ≥ 0.12; ≤ 9 flights an hour; ≤ 120 s at 07:30; a second's step ≤ 1.35 of cruise; heading ≤ 1.2 rad a second; ≥ 4 m over ground, rocks and crowns (5.7 measured; it aims for 8) |
| Sit-and-wait birds and waders fly a few times an hour | same | ≤ 14 and ≤ 8 an hour |
| A hop from A to B for the hunt lane (`flightHop`) | same | rest to rest, within its mass's acceleration |
| A flyer without a rig is level in level flight | same (`unriggedFlightPitch`, and `index.ts` holds no constant pitch in the air) | 0 rad in cruise, ≤ 0.25 rad in any stage |
| The motion summary: `b5-flight-ways` (10 numbers from the tests above) and `b5-flight-budget` (11 numbers: the validator's flights an hour by way, air shares, flock cohesion, hanging, species that fly) | `tests/ark-motion/metrics.json` | see the registry |
| The thermal soarers' circling, apart; everyone else's at the old limits | `tests/ark-audit/thresholds.json`, `src/lib/ark-audit/metrics.ts` | everyone else ≤ 1% circling (0), ≤ 0.85 turns a minute (0.67); the hawkers ≤ 30% (25.3) and ≤ 4.5 (3.48) |
| The old failure on the soarers themselves: a full turn in a minute inside 12 m | `src/lib/ark-behaviour-schedule.test.ts` | < 1% of their air time |


## Thresholds and baselines changed

| What | Was | Now | Why |
|---|---|---|---|
| Behaviour audit, circling and turns "all but the hawkers" (`tests/ark-audit/thresholds.json`, `src/lib/ark-audit/metrics.ts`) | every flyer but the hawkers | every flyer but the hawkers and the thermal soarers (`AuditSubject.soarer`: the `soar`, `vulture` and `stork` ways); limits unchanged (≤ 1%, ≤ 0.85) | A soar circles by nature. The old failure stays guarded on everyone else at the same limits, and on the soarers by the 12 m test. |
| Behaviour audit, the hawkers' own limits | circling ≤ 40%, turns ≤ 8.5 a minute (36% and 7.77 on main) | ≤ 30%, ≤ 4.5 (25.3% and 3.48) | Figure-of-eight sweeps in place of the 1.2 m circle; they are aloft 116,789 s of the audit's hour where it was 18,739 s. |
| Behaviour audit, the soarers' own numbers | | reported (`roaming.soaring`), no limit | CI's flight hour is 06:00 to 07:00, before the thermals: 0% and 0.04 there. Their guards are the two tests. |
| Behaviour audit, the hawkers' flag | intelligence hunt `aerial_hawk` | that, or the `aerial` or `swift` way | A pratincole feeds on the wing whatever its hunt row says. |
| `ark-flight-physics.test.ts` (MA1): take-off and landing acceleration, touch-down | every air leg's two ends | not the end of a soar's leg that is up in the air there | No take-off or landing there. |
| same: "a flight of its own goes far enough" | `own > 5` flights | any there are | A flight for its own sake is a foray now; the fixture's day may hold none between two spots on the ground. |
| same: crown clearance sample | `cruise > 1000` quarter seconds | `> 600` | 969 measured: birds sit between flights. The crown shares themselves are better (1.9% inside, 0.1% with room; limit 1%). |
| same: up at touch-down on a level flight | ≤ 0.02 m/s where it lands no more than 30 cm higher | ≤ 0.05 m/s where it lands no more than 5 cm higher | A house sparrow's hops to a twig 10 to 30 cm up end going up at 0.03 to 0.16 m/s: their line's own slope, a hop up. |
| same: heavy birds' climbs measured | `climbs > 5` | any there are | The fixture's eagles soar or fly perch to perch and its herons walk; every species' climb angle is asserted in the planner's test. |
| `ark-behaviour-schedule.test.ts`: "not round in circles" | every flyer, `air > 3600` s | the soarers apart (their own check: a full turn a minute inside 12 m under 1% of their air time), `air > 1000` s | As the audit. |
| Motion summary | | `b5-flight-ways` (10) and `b5-flight-budget` (11) added | New guards. |
| Behaviour audit, "a whole group does the same" | ≤ 16% | ≤ 16.5% | A flock at its station sits out together most of what each bird would have flown for. 16.4% measured with every flight not taken shown as a perch or a rest, 16.1% with those shown as a watch; a wander or a drink not taken is now a preen, which can only lower it (not re-measured: the Mac was swapping and the audit took 36 minutes). Main was not re-measured by this lane. |
| Motion summary, MA4's time budget: air speed over cruise (`scripts/ark-time-budget.mts`) | every air leg | air legs over 6 m and twenty body lengths | A flit to the next twig or a hop about a station is a spring and a landing with no cruise between; they are most of a small bird's air legs now. Flying species under 0.35 of their cruise: 18 on main (every air leg), 1 now (the wandering albatross, 0.34); the limit comes down from 20 to 5. Median 0.851 → 0.869, tenth percentile 0.452 → 0.567. |
| Motion summary, MA4's "ground birds' worst air share" | ≤ 0.084 (the wood pigeon's murmuration) | ≤ 0.03 | 0.024 measured: the murmuration is for birds that fly first. |


## Left, and why

- **The town island** was not measured (the flight budget builds the wild island only).
- **Insects.** Butterflies, bees, dragonflies and moths are micro animals off the behaviour schedule (`micro.ts`),
  outside this lane's files. The ways table has their rows (`flower`, `dragon`, `bug`) for when they are scheduled.
- **Pairs do not fly as pairs.** A pair is not a group in the placement.
- **Formations.** The V and line recipe (`v_formation`, 43 species) is unchanged and plays on a follower's flight. Its
  geese, swans and cranes fly a few times a day, so it is seldom seen. Not measured here.
- **Walk-first and swim-first birds** (MA3's): unchanged. The smew measured 2.4 flights an hour on the validator
  (decision 293's 3.43), all rounds: its range is boxed, so each flight of its own is a round. The registry's limit
  stays 3.5.
- **Species the catalogue has walking first that fly first in life** (the galah, the budgerigar, some doves): their
  primary move is the profiles generator's (lane B3).
- **The murmuration's members.** The common hill myna and four other mynas carry `murmuration` from the family rule in
  `scripts/ark-behaviour-compose.mts` (Sturnidae with a flocking text), and Wilson's phalarope from its text; mynas
  gather at a roost but do not murmurate as starlings do. A data change (the recipes generator), not made here.
- **Hover hunts.** The hunt lane proposed `often: 0.3` on `hover_drop` and to keep it to hovering flight styles. Not
  done: stations already cut it (above), and a kestrel's hover is its way of hunting. The common buzzard keeps the
  recipe: buzzards do hang on the wind.
- **Soaring height.** A soar rides 18 to 68 m over its home's ground. Real soarers go far higher; the island is small
  and the camera near. The numbers are `SOAR_FLOOR` and each way's `span`.
- **A quieter sky.** The perching birds' share of the awake time in the air went from about 5% to about 1% (they sit,
  as the real ones do); soarers, vultures, swallows and swifts are up far more. If the owner wants more birds on the
  wing, each way's `bout` and `foray` in `FLIGHT_WAYS` are the dials.
- **Rig needs (the rigging pipeline's).** A soar needs a `soar` or `glide` clip and both bank clips to read well: the
  soar ways' rigs without them hold their wings at the flap's mid-downstroke. A flyer with no rig at all is level now,
  but still a standing mesh with folded wings in the air.
- **Not verified by eye.** Nothing in this lane was recorded in a browser (the Mac's load average was 50 to 1,000
  through the session). Every number is from the headless schedule.

