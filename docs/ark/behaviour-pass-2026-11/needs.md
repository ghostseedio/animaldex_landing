# Ark behaviours pass, lane B3: needs (hunger, thirst, energy and the daily routine)

2026-11-14, landing branch `ark-beh-needs` off `origin/main` c99ff83b. Visual only: the server and its ecology still
decide every arrival, meal, birth and death. Nothing here reads or writes production; no API was called.

**The short answer.** Before this lane every animal's day was the same day. Three things made it so:

1. **One set of weights for every species.** The profile generator gave each species rest 0.25, forage 0.5, drink 0.15,
   groom 0.12 and so on, whatever it eats and however big it is. An elephant, a lion and a wren wanted the same things
   in the same amounts.
2. **Every 80-second slot was drawn on its own.** What an animal did next did not depend on what it had just done, so
   nothing came in bouts and nothing followed from anything: feeding lasted one slot (median 1.3 minutes for every
   group), what it was doing changed 28.5 times a waking hour, a just-fed animal fed again and a hungry one rested.
3. **Sleep was the sun's height against one of three thresholds.** 589 of 662 species measured slept 11 hours, 41 slept
   19 (every crepuscular one: awake 4.9 hours a day) and 32 never slept. A koala slept as long as a cow; a rabbit, a
   lion and a red deer slept 19 hours; a giraffe and a zebra never slept at all.

Now each species has a day of its own (how much of its waking time it feeds and rests, in what cycle, how often it
drinks, how long it sleeps), written by rule from its taxonomy, diet, size and zone, and the schedule turns that day
into bouts in order: a feeding bout, the rest that follows it, the time between, a trip to water at its hour, a bask
first thing for a basker. The card's fed bar runs on the same rhythm.

## How it was measured

| Tool | What it does |
|---|---|
| `scripts/ark-activity-budget.mts` (new) | The whole schedule, headless: for each species its 24 hours slot by slot as its tap card would say them (`slotPlanAt` → `arkActivityKey`), grouped as asleep, resting, feeding, drinking, travelling, grooming, social, watching; bouts a day and their lengths; changes an awake hour; the day hour by hour; the fed bar before and after a feeding bout and the energy bar at sleep and waking. `--validator` is one animal of every species the map lists, in its own zone; a snapshot with `--islands` is the wild island's animals. `--trace n` prints the need each slot answered and what the animal then did. |
| `scripts/ark-needs-day.mts` (new) | Every catalogue species' day from its needs alone (`awakeAt`, `needAt`): no world, the whole catalogue in seconds. |
| `scripts/ark-time-budget.mts` (the movement audit's) | Read, not changed. Its "sleep 42%" for nearly every species is two things: it samples twelve 10-minute windows, one every two hours, and a day animal is asleep in five of the twelve (20:00 to 04:00); and the sameness is real (cause 3 above). It prints only flyers and swimmers (173 of 275 species) by its own filter, and it keeps only the wild island's animals. |

The baseline is `origin/main` c99ff83b on the validator's animals for every species of the real snapshot the map lists
(662 species of the snapshot's 953; one animal each, a whole island day of 1,080 slots). The real snapshot has 3,145
animals: 707 on the wild island (440 species) and 2,438 in the town (1,063 in houses, 149 on the farm, 499 in the zoo,
727 in the town at large). The town's animals run the same schedule from the same profiles (their homes, their ranges
and the zoo's feeding stations are the town's), so their species are read from the validator's run; the town's own
places were not built headless (see "Not done").

## What was wrong, worst first

### 1. Nothing came in bouts, and nothing followed from anything

`behaviour-schedule.ts` `pick` drew each slot's behaviour from the profile's weights, seeded by the animal and the slot
alone. Measured on the baseline, all 662 species:

- the median feeding bout was one slot (1.3 minutes) in every group but the large mammals (two slots);
- the median rest was one slot;
- what the animal was doing changed 28.5 times a waking hour (once every 2.1 minutes), from 23 for the large hunters to
  30 for birds;
- the fed bar read 0.57 at the start of a feeding "bout" and 0.78 at its end only because a bout was one slot of a bar
  that fills in a minute; it said nothing about the animal's day.

### 2. Every species had the same budget

Share of waking time, baseline, by group (what the card would say):

| Group | Species | Asleep (h) | Feeding | Resting | Travelling | Grooming | Trips to water a day |
|---|---|---|---|---|---|---|---|
| Plant-eating mammals, large | 42 | 11.2 | 56% | 17% | 18% | 7% | 3.2 |
| Plant-eating mammals, small | 30 | 12.5 | 43% | 24% | 22% | 7% | 1.2 |
| Hunting mammals, large | 7 | 16.9 | 57% | 18% | 21% | 3% | 3.0 |
| Hunting mammals, small | 16 | 15.7 | 53% | 19% | 19% | 4% | 5.1 |
| Other mammals | 67 | 11.0 | 33% | 30% | 25% | 8% | 2.0 |
| Birds of prey and scavengers | 23 | 10.8 | 29% | 32% | 33% | 5% | 0.0 |
| Fish-eating birds | 28 | 11.4 | 33% | 31% | 32% | 4% | 4.0 |
| Small birds | 88 | 11.4 | 29% | 38% | 27% | 5% | 1.1 |
| Other birds | 120 | 11.2 | 32% | 33% | 29% | 6% | 2.1 |
| Reptiles | 85 | 11.6 | 34% | 36% | 26% | 0% | 5.4 |
| Amphibians | 13 | 10.2 | 39% | 33% | 29% | 0% | 0.0 |
| Fish and whales | 104 | 10.8 | 30% | 20% | 50% | 0% | 0.0 |
| Invertebrates | 33 | 9.2 | 33% | 29% | 37% | 0% | 0.0 |

A lion fed (its card: "looking for food", "on the prowl") through 57% of its waking time and rested 18%; a crocodile
"looked for food" a quarter of the day and rested an eighth; a bird of prey travelled a third of its day; a hummingbird
fed 11% of the day in one-slot visits.

### 3. Sleep was three curves

`awakeAt` was `isAwake(activity, sun elevation)`: by day awake above -4°, by night below 8°, crepuscular between -14°
and 22° (two windows of under two and a half hours), "any" always. So:

- every day animal slept 11.5 hours, a koala as long as a cow (real: about 20 and about 4);
- every crepuscular animal, 413 of the real Ark's 3,145 animals, was awake 4.9 hours a day: lions, tigers, house cats,
  rabbits, red deer, foxes, bears;
- every "any" animal (giraffes, zebras, Asian elephants, mallards) never slept;
- a great white shark slept 11.5 hours (its activity reads diurnal), and a saltwater crocodile, nocturnal by its
  stored text, was asleep at its roost through the hours it basks.

### 4. Water: never, or all day

Drinking was one behaviour among the rest (weight 0.15 for every land vertebrate, more at dawn and dusk). Where a
water's edge was within reach the animal went to it 16 to 70 times a day (a house cat 27, a green iguana 34, a common
snapping turtle 70, crocodiles 25 to 47); where it was not, never. 44 of the 662 species drank at all on the baseline's
day. A koala and a kangaroo rat had the same appetite for water as a cow.

### 5. A long rest could not last

A rest had no place of its own: it stayed "wherever the last slot left it", and once four such slots have gone by
`plannedIntent` sends every slot after them home as a wander, so that no slot depends on more than four before it.
Unseen while rests were one slot long; with real rests it turned every long rest into a wander (measured part-way
through this lane: a bald eagle with no perch that suits it "wandered" 30% of its day and rested 6%). A bird that
"perched" drew a new perch each slot.

### 6. The group's day watch changed every slot

One member of a group of three or more watched each slot, the turn passing every slot: each member left its grazing
every `size` slots (a herd of four's members every five minutes).

### 7. The fed bar's rate was the same for everything

`arkFedRates` ran the bar down by diet and length alone, held to half and double the metre's rate: full to its floor in
7 to 47 waking minutes for every animal, a crocodile as fast as a wren. With real bouts a lion's bar would have sat on
its floor all night. Its look-back was two waking hours, too short to remember a lion's meal.

### 8. The town's routines

- The zoo's feeding times (`islands/town/zoo-types.ts`: aviaries 08:30, hoofstock 09:30 and 15:00, big cats 16:00 with
  a fast day, the reptile house weekly at 12:00, and so on) move an enclosure's residents to the feeding station, and
  the card says "feeding time" whatever the animal does there: it drew a rest or a wander as often as not.
- **Not fixed, for the town lane:** the nocturnal house is fed at 11:00, when its residents are asleep (the card says
  asleep, they do not come). Feed it at dusk (19:00), or wake its residents for it.
- A pet dog or cat had its wild family's day.

## What was built

### The day, by rule (`scripts/ark-behaviour-profiles.mts` `dayOf` → row field 19 of `behaviours.json`)

For each species: the share of its waking time in feeding bouts, the length of one feeding cycle, the share in the rest
that follows a feeding bout, its trips to water a day, the hours it sleeps (empty: its activity's own hours by the sun,
as before), the days between its feeding days, and whether it chews the cud. One rule per taxon, with the rule as the
field's source in `data/ark/behaviour-profiles.json` (`src.day`); 187 rule lines in all, the main ones:

| Kind | Feeding | Cycle | Rest after | Water a day | Sleep |
|---|---|---|---|---|---|
| Elephants | 80% | 4 h | 8% | 1.5 | 3 h |
| Horses, zebras | 68% | 3 h | 18% | 1.5 | 3 h |
| Giraffes | 65% | 2.5 h | 25%, chewing the cud | 0.5 | 4.5 h |
| Cattle, antelope, sheep, goats, deer | 58% | 2.5 h (small ones 1.5) | 32%, chewing the cud | 1.5 (desert 0.3) | 4.5 h |
| Big cats | 12% | one hunt a waking | 68% | 1 | 13 h |
| Small cats | 25% | 4 h | 50% | 1 | 12.5 h |
| House cats and dogs and their breeds | 8% (their meals) | 6 h | 55% | 2 | 12.5 h, 9 h |
| Dogs, wolves, foxes | 30% | 4 h | 40% | 1.5 | 10 h |
| Bears | 60% | 2.5 h | 25% | 1.5 | 9 h |
| Great apes; other monkeys; leaf-eating primates | 50%; 45%; 40% | 2 h; 1 h; 2 h | 30%; 25%; 45% | 1; 1; 0 | 9.5 h; 10 h; 10 h |
| Koala | 65% | 2 h | 25% | 0 | 20 h |
| Sloths; armadillos; small bats | 45%; 70%; 70% | 2 h; 1 h; 40 min | 45%; 15%; 20% | 0; 0.5; 1 | 14 h; 17 h; 18 h |
| Small rodents; squirrels; rabbits and hares | 50%; 55%; 50% | 25; 30; 45 min | 25%; 20%; 30% | 0.5 (desert 0); 0.5; 0.3 | 12.5 h; 13 h; 8.5 h |
| Shrews | 75% | 20 min | 10% | 0.5 | 8 h |
| Whales and dolphins | 30% (baleen 45%) | 1 h (1.5) | 25% | 0 | none on the schedule |
| Hummingbirds | 28% | 9 min | 58% (on the perch) | 0 | by the sun |
| Small birds | 65% | 20 min | 15% | 1 (seed eaters 2) | by the sun |
| Birds of prey and owls; vultures | 15%; 8% | 3 h; 6 h | 60%; 55% | 0.3 | by the sun |
| Herons, storks, ibises; shorebirds | 50%; 70% | 1 h; 45 min | 35%; 20% | 0 | by the sun |
| Cormorants, pelicans, gannets | 20% | 2 h | 60% | 0 | by the sun |
| Ducks; geese and swans | 45%; 60% | 1 h; 1.5 h | 40%; 28% | 0 | by the sun |
| Gamebirds; pigeons; parrots | 50%; 35%; 35% | 45; 60; 90 min | 30%; 45%; 40% | 2; 2; 1 | by the sun |
| Crocodilians | 4%, one day in three | one bout | 80% | 0 | none on the schedule |
| Boas and pythons; other snakes | 3%, one day in five; 6%, one in three | one bout | 88%; 78% | 0.2 | by its activity |
| Lizards; plant-eating lizards; tortoises; freshwater turtles | 30%; 25%; 35%; 25% | 45 min; 3 h; 2 h; 2 h | 55%; 65%; 50%; 60% | 0.2 (desert 0); 0.2 (desert 0); 0.3 (desert 0.1); 0 | by its activity |
| Frogs, toads, salamanders | 25% | 1 h | 65% | 0 | by its activity |
| Grazing fish; plankton feeders; fish that lie in wait; hunters that cruise | 70%; 60%; 10%; 25% | 40 min; 1 h; 4 h; 2 h | 10%; 10%; 70%; 10% | 0 | by its activity; none; by its activity; none |
| Spiders and scorpions; ants and termites; nectar insects | 10%; 75%; 55% | 4 h; 30 min; 12 min | 85%; 5%; 25% | 0 | by its activity |

Then the species' own text: "rarely drinks", "gets most of its water from..." set its trips to 0; "drinks daily",
"must drink" raise them to 1.5; "sleeps N hours" sets its sleep (36 phrases in all). Only an animal that goes to water
at all (the old `drink` weight) has trips. A species the table lacks gets a day by its diet (`behaviour-profile.ts`
`DIET_DAYS`).

The figures are rounded from what is known of the wild animals: elephants feed 16 to 18 hours and sleep 2 to 4;
giraffes sleep about 4.5; horses about 3; cattle graze about 8 hours, chew the cud about 8 and sleep about 4; lions
rest about 20 hours with 13 or so asleep; koalas sleep about 20; little brown bats about 19; armadillos 17 to 18;
hummingbirds sit about 80% of the day and feed for a minute or less every ten or so; small passerines feed most of a
winter's day; cormorants fish for an hour or two and dry off; big constrictors feed every week or two.

The weights are otherwise untouched (one fine weight added: a hoofed mammal's grooming, 0.05, for 223 species). They
now decide only the mix within a need: which way it feeds, which way it rests, what it does between.

### Sleep by kind (`behaviour-schedule.ts` `awakeAt`, `wakingDay`)

From the hours written and the stored activity:

- by day: one sleep about midnight; a long sleeper naps at midday too; a short sleeper (5.5 hours or less: an elephant,
  a horse, a cow, a giraffe) sleeps three short bouts in the small hours and is up between them;
- by night: the same about noon; a long sleeper (a koala, a bat) sleeps again about midnight, so it is up at dusk and
  before dawn;
- crepuscular: a sleep through the middle of the day and one about midnight, up from before dawn into the morning and
  from late afternoon into the evening (12 hours' sleep where none is written, where the sun's height gave 19);
- any hour: none where no hours are written; else short sleeps in the night, with a midday one past six hours.

A species with no hours written and not crepuscular keeps the sun rule exactly (tested hour by hour). 799 species have
hours written; 127 of them 0 (whales, sirenians, cruising and plankton-feeding fish, crocodilians).

### Needs: what a slot is for (`behaviour-schedule.ts` `needAt`, `pick`)

A waking slot first answers a need, a pure function of the animal's id, its group leader's id, the slot's start and the
island hour: the same for every viewer, and no slot waits on another.

- **The feeding cycle.** A short cycle (under four hours) runs round the clock from the animal's own phase at its own
  length (0.85 to 1.15 of its kind's), each bout 0.8 to 1.2 of its share: a feeding bout, then its rest, then the time
  between. Busier at dawn and dusk and resting through midday where its kind is (two peaks, a siesta, a day animal on
  desert or grassland). A long cycle (a cat's, a crocodile's) is counted from its waking: up, a look round, a feeding
  bout, then rest for most of its waking. One that gorges feeds on its own days.
- **A group** keeps its leader's rhythm, each member up to three tenths of a cycle off it.
- **Water.** Its trips are its day's own, at their hours of its waking day (after its first feed, before its last
  light, then between), the whole group at once; a kind that drinks every other day does so on its own days.
- **A basker** basks first: the first hour or two of a morning's waking.
- **Winding down:** its last 20 minutes up are rest.
- **A zoo's feeding time** is a feeding bout (`ScheduleAnimal.feeding`, set on the feeding variant in
  `islands/scene.ts`).

Then its choice within the need: the need gives each kind of behaviour its share of the slot (in a feeding bout 96.5%
feeding, in a rest 96.5% resting, between them 80% travelling), and the profile's weights, the hour and the animal's own
leanings choose within the kind. A recipe may still take the slot, as before.

### Holding its ground (`workRawIntent`)

Through a spell (about 40 minutes of rest, 15 of feeding; each animal's own length and phase) the place is drawn from
the spell, not the slot: a resting animal keeps one place and one way of resting (a bird its perch, where it sits,
rests and preens; a lizard its rock; a den animal in or out of its den for the whole spell), one with no place of its
kind near gets a spot of its own near where it lives (a bird with no perch that suits it sits on the ground, a fish
holds its station), and a feeding one keeps to one patch, stepping about in it. Each slot still has its own goal (the
same one through the spell), so nothing chains. A wading bird keeps to the shallows or out of them, and to one stand,
through a spell. A school's fish feeds through its own feeding bouts. A flock no longer takes off after a leader that
is settled on its perch (its goal is the same perch slot after slot, in the air only by name: a sparrow "flying with
it" dropped 9.6 m off its own perch between two slots). A day watch is three slots (four minutes) a turn.

### The fed bar (`animal-status.ts` `scheduleFed`, `lib/ark-animal-status.ts` `arkFedRates`)

The bar runs from full to its floor in a little over the gap between two of its feeding bouts (`feedingRhythm`): a
hummingbird's 6.5 minutes, a red deer's hour, a lion's five hours of waking, a ball python's days. It looks back over a
feeding cycle and a third: the last two waking hours from what the card says the animal did, the slots before from its
needs alone (which cost no plan). Energy is unchanged: it already ran on `awakeAt`, so it now follows each kind's own
sleep.

### A server foray's wording (`animal-status.ts` `forayActivity`; from the hunt lane)

The server counts anything with a next meal as a hunter, a goose, a flamingo, a sunbird and a tortoise among them, and
their cards and the live log said "hunting" while they walked a foray. Only a species whose profile stalks (its stored
diet is meat or fish) is hunting; any other is said as its own feeding with keys the card already has: a grazer
grazing, a browser browsing, a nectar feeder at flowers, the rest looking for food. In the live log a forager's foray is
an everyday line. (The hunt lane's `huntStyle` is on its own branch; if the two disagree at integration, its style
should be the one rule and this function should read it.)

### The procedural sleep (`sleep.ts`; from the graphics pass)

Reported: a chital lowered into the ground with its legs cut off at the grass; a domestic rabbit on its back with its
legs in the air while its rig played its idle. Their styles are right (chital `sternal` by its taxon; domestic rabbit
`side`, some nights `curl`, by its text "stretched on its side"); the drawing was wrong in three ways:

1. **One drop for every body.** `POSTURE_SPECS.sternal.drop` lowered every animal by 0.4 of its height. A deer's
   underside is about half its height up, so a tenth of its height of leg stayed above the grass with the body in the
   air; a pig's belly (legs a quarter of its height) went a tenth of its height under the ground; a flamingo "sitting"
   (0.22) had its legs cut half-way. Now the body's own underside is read from the mesh it is drawn with, once per mesh
   (`bodyLegShare`: over the stretch of its length between its feet, the footprint of `grounding/base.ts`, the height
   all but the lowest twentieth of its points are above). Lying, it comes down by exactly that and a 1.5% press, so its
   chest rests on the ground with its legs under it; sitting, tucked or standing it comes down by its posture's share,
   never past its underside (a flamingo keeps its feet). `lyingDrop` also no longer leaves the low side of a wide
   leaning body under the ground (up to 7% of its height before).
2. **The side posture turned a standing mesh 72°.** Its legs cannot be laid out, so they stood out stiff, up in the
   air. A procedural body now leans 20° at most (`PROCEDURAL_ROLL_MOST`); flat on its side is a clip's (`sleep_side`).
3. **Half the roll stayed on under a clip.** `sleepDraw` kept 50% of the procedural roll when a rig's sleep clip was
   drawing the body, so a rig on its side by its own clip was turned 36° further, past its side. All of it gives way to
   a clip now.

Guard: `src/lib/ark-sleep.test.ts`, two tests: the underside read from synthetic meshes (a deer, a flamingo, a snake, a
mesh whose middle is only a tail); and every catalogue species' postures (2,555 species, both sides, undersides from 0
to 0.9 of the height, six body shapes): the roll within the limit, the torso's lowest point on the ground (neither
under nor over), lowered by no more than its underside, and nothing procedural under a clip. **Not seen in a
browser**: the read of real meshes (a tail or a neck in the middle stretch, a quantised mesh) should be looked at on
the graphics pass's sweep before it ships.

## Before and after

The same 662 species, the same tool, `origin/main` c99ff83b → this branch. Shares are of waking time, as the card would say them.

| Group | Species | Asleep (h) | Feeding | Resting | Travelling | Grooming | Changes a waking hour |
|---|---|---|---|---|---|---|---|
| Plant-eating mammals, large | 42 | 11.2 → 5.2 | 56 → 51% | 17 → 29% | 18 → 13% | 7 → 5% | 26 → 9 |
| Plant-eating mammals, small | 30 | 12.5 → 10.1 | 43 → 43% | 24 → 33% | 22 → 13% | 7 → 8% | 28 → 14 |
| Hunting mammals, large | 7 | 16.9 → 11.9 | 57 → 16% | 18 → 51% | 21 → 23% | 3 → 10% | 23 → 15 |
| Hunting mammals, small | 16 | 15.7 → 11.6 | 53 → 35% | 19 → 38% | 19 → 18% | 4 → 5% | 26 → 14 |
| Other mammals | 67 | 11.0 → 11.2 | 33 → 47% | 30 → 28% | 25 → 16% | 8 → 7% | 30 → 14 |
| Birds of prey and scavengers | 23 | 10.8 → 10.8 | 29 → 21% | 32 → 50% | 33 → 22% | 5 → 6% | 30 → 12 |
| Fish-eating birds | 28 | 11.4 → 11.4 | 33 → 33% | 31 → 41% | 32 → 21% | 4 → 5% | 30 → 14 |
| Nectar birds | 6 | 11.5 → 11.5 | 22 → 19% | 51 → 53% | 23 → 23% | 4 → 4% | 29 → 20 |
| Small birds | 88 | 11.4 → 11.2 | 29 → 51% | 38 → 28% | 27 → 17% | 5 → 3% | 30 → 14 |
| Other birds | 120 | 11.2 → 11.2 | 32 → 42% | 33 → 34% | 29 → 18% | 6 → 6% | 30 → 12 |
| Reptiles | 85 | 11.6 → 10.2 | 34 → 19% | 36 → 63% | 26 → 16% | 0 → 0% | 27 → 7 |
| Amphibians | 13 | 10.2 → 10.2 | 39 → 23% | 33 → 62% | 29 → 15% | 0 → 0% | 28 → 7 |
| Fish and whales | 104 | 10.8 → 8.7 | 30 → 42% | 20 → 28% | 50 → 29% | 0 → 0% | 27 → 11 |
| Invertebrates | 33 | 9.2 → 9.2 | 33 → 33% | 29 → 42% | 37 → 25% | 0 → 0% | 26 → 8 |
| All | 662 | 11.3 → 10.1 | 35 → 39% | 30 → 37% | 31 → 19% | 4 → 4% | 28.5 → 11.6 |

- **Bouts.** What an animal is doing changes 28.5 → 11.6 times a waking hour (between the card's categories; between feeding, moving and settled in place, the three a viewer tells apart at a glance: 9.4). The median feeding bout, over species: 1.3 → 6.7 minutes; the median rest 1.3 → 2.7 (a rest that turns into a preen and back counts as two).
- **Each kind its own budget.** Feeding's share of waking time across species, tenth percentile / median / ninetieth: 20% / 32% / 54% → 14% / 42% / 61%; resting's: 13% / 30% / 45% → 18% / 33% / 66%.
- **Sleep.** Species by hours asleep (rounded). Before: 32 at 0 h, 589 at 11 h, 41 at 19 h. After: 46 at 0 h, 5 at 3 h, 28 at 4 h, 3 at 6 h, 3 at 7 h, 15 at 8 h, 10 at 9 h, 38 at 10 h, 447 at 11 h, 42 at 12 h, 16 at 13 h, 6 at 14 h, 1 at 16 h, 1 at 17 h, 1 at 18 h.
- **Water.** Species that drink at all on the day: 44 → 18; the most trips by one animal: 70 → 2; the mean among those that drink: 30.4 → 1.1. (Fewer drink at all because a kind with one or two trips a day finds water only if it is within a slot's walk at that hour, and a kind that drinks every third day is not seen on one day; before, dozens of draws a day found it sooner or later.)
- **The bars.** The fed bar at the start of a feeding bout → at its end, mean over species: 0.57 → 0.78 before (a bout was one slot), 0.51 → 0.71 after, over bouts of minutes to hours. Energy as it falls asleep / as it wakes: 0.33 / 0.99 before, 0.34 / 0.98 after (short sleepers go to sleep less tired and wake less than full: three sleeps a night, each restoring a third).
- **Stalk slots** (the card's "on the prowl" and "waiting for prey"; the hunt lane's): 99 stalking species, median 40 → 29 slots a day, mean 45 → 36. The stalk weight is unchanged (0.25); a stalk is now drawn within a feeding bout, and now and then between.

Well-known species (share of the 24 hours; the day hour by hour from 00:00: z asleep, F feeding, r resting, t travelling, g grooming, D drinking, w watching, s social). Rows marked * were not in the snapshot run; their "before" is the first run of the same tool on the same commit.

| Species | Asleep (h) | Feeding | Resting | Travelling | Before, hour by hour | After, hour by hour |
|---|---|---|---|---|---|---|
| african-bush-elephant * | 11.5 → 2.9 | 27 → 67% | 9 → 10% | 6 → 5% | `zzzzzzFFFFFFFFFFFFzzzzzz` | `FzFFzFFrFFFdFFFFFFFFFFzz` |
| asian-elephant | 0.0 → 2.9 | 67 → 70% | 14 → 9% | 15 → 8% | `FFFFFFFFFFFFrrFFFFFFFFFF` | `FzFFzFFFFFFFFFFtFFFFFFzz` |
| plains-zebra | 0.0 → 2.9 | 61 → 58% | 20 → 12% | 12 → 12% | `FFFFFFFFFFFFFFFFFFFFFFFF` | `FzFFzFFFFtFFrFFFFFtFrFzz` |
| giraffe | 0.0 → 4.4 | 46 → 52% | 20 → 20% | 24 → 5% | `FFFFFFFFFFFFFFFFFFFFFFFF` | `rzFzzFFFrFFrFFrFrFFrFFzz` |
| cow | 11.4 → 4.4 | 29 → 36% | 9 → 26% | 10 → 15% | `zzzzzzFFFFFFtFFFFFzzzzzz` | `rztzzFFFrFrtrtFrFFFFFFzz` |
| red-deer | 19.1 → 4.4 | 17 → 38% | 2 → 28% | 1 → 14% | `zzzzzFFFzzzzzzzzzFFzzzzz` | `zztFrFFFFrFzzzrtFrFFFFrz` |
| european-rabbit | 19.1 → 8.4 | 12 → 24% | 3 → 16% | 2 → 14% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzFFFFFFtzzzzzFFFFFtFzz` |
| koala * | 10.8 → 20.0 | 12 → 10% | 11 → 3% | 27 → 2% | `ttttttzzzzzzzzzzzztttttt` | `zzzzFFzzzzzzzzzzzzztFzzz` |
| african-lion | 19.1 → 13.0 | 14 → 5% | 2 → 29% | 4 → 7% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzzFrrrrzzzzzzzrrrtFrzz` |
| bengal-tiger | 19.2 → 13.0 | 11 → 7% | 6 → 28% | 2 → 8% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzzFrrrrzzzzzzzrrrtFzzz` |
| domestic-cat | 19.1 → 12.4 | 14 → 11% | 1 → 25% | 2 → 8% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzFrrrrFzzzzzzzrrrtFFzz` |
| domestic-dog | 11.4 → 9.0 | 22 → 7% | 11 → 32% | 13 → 19% | `zzzzzztFFFFFFFFrFFzzzzzz` | `zzzzzrrrttrrrttrrrtzzzzz` |
| red-fox | 19.1 → 10.0 | 16 → 25% | 3 → 24% | 1 → 7% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzFrrFFrrzzzzzrFFrrFFzz` |
| brown-bear | 19.1 → 8.9 | 12 → 35% | 5 → 21% | 2 → 4% | `zzzzzFFzzzzzzzzzzFFzzzzz` | `zzzFrFFrFrzzzzzFFrFrFFzz` |
| chimpanzee | 11.4 → 9.5 | 17 → 30% | 22 → 21% | 10 → 5% | `zzzzzzrrFrFrrrrrFFzzzzzz` | `zzzzzFrFFFrFrFFFFFrzzzzz` |
| common-raccoon | 10.9 → 12.0 | 21 → 22% | 21 → 17% | 9 → 9% | `rFrFrrzzzzzzzzzzzzrFFrrF` | `rFFrFrzzzzzzzzzzzzFFFFrF` |
| house-mouse | 10.9 → 12.5 | 20 → 22% | 20 → 14% | 12 → 12% | `rFFFrFzzzzzzzzzzzzrrFrrF` | `FFFFFrzzzzzzzzzzzzFFFFFF` |
| great-tit | 11.4 → 11.4 | 20 → 32% | 17 → 11% | 14 → 9% | `zzzzzzrFFtFrFFrFFrzzzzzz` | `zzzzzzFFFFFFFFFFFFzzzzzz` |
| ruby-throated-hummingbird * | 11.5 → 11.5 | 11 → 8% | 25 → 33% | 14 → 8% | `zzzzzzrrrrrrrrrrrrzzzzzz` | `zzzzzzrrrrrrrrrrrrzzzzzz` |
| domestic-chicken | 11.5 → 11.5 | 18 → 23% | 14 → 9% | 10 → 8% | `zzzzzzFFFFrFrFFFrFzzzzzz` | `zzzzzzFFFFFFFFFFtFzzzzzz` |
| mallard | 0.0 → 0.0 | 37 → 49% | 17 → 34% | 39 → 10% | `FtttFtFttFFtFFttFtrFtttF` | `rFFFFFFFFFFFFFFFrFFFFFrF` |
| eurasian-coot | 11.5 → 11.5 | 24 → 30% | 11 → 14% | 14 → 4% | `zzzzzzFFFFFFFFFtFFzzzzzz` | `zzzzzzFFFFFFFFFFFFzzzzzz` |
| grey-heron | 11.4 → 11.4 | 14 → 26% | 19 → 15% | 16 → 7% | `zzzzzzrrFrrFrrrtrrzzzzzz` | `zzzzzzFFFFFFFFFFFFzzzzzz` |
| great-cormorant | 11.5 → 11.5 | 14 → 10% | 15 → 32% | 20 → 9% | `zzzzzzttrtttrttrtFzzzzzz` | `zzzzzzrFrFrrrrrrFrzzzzzz` |
| bald-eagle | – → 11.5 | – → 7% | – → 32% | – → 10% | – | `zzzzzzrrFrrtrrtFrrzzzzzz` |
| barn-owl | 10.9 → 10.9 | 13 → 8% | 24 → 33% | 16 → 11% | `rrrrrrzzzzzzzzzzzzrrrrrt` | `rtrrtrrzzzzzzzzzzztrrtrr` |
| humboldt-penguin | 11.4 → 11.4 | 16 → 10% | 10 → 21% | 25 → 21% | `zzzzzzttttttttFtttzzzzzz` | `zzzzzzrrtFrrFrtttrzzzzzz` |
| green-iguana | 11.4 → 11.4 | 10 → 11% | 19 → 35% | 20 → 5% | `zzzzzzrrrrtrtttFtrzzzzzz` | `zzzzzzrrFrrFrrrFrrzzzzzz` |
| leopard-tortoise | 11.5 → 11.5 | 27 → 15% | 16 → 33% | 10 → 4% | `zzzzzzFFFrFFFFFFFFzzzzzz` | `zzzzzzrrFrFrFrFrFrzzzzzz` |
| saltwater-crocodile | 10.9 → 0.0 | 25 → 1% | 13 → 89% | 17 → 10% | `FFFFFFzzzzzzzzzzzzFFFtFF` | `rrrrrrrrrrrrrrrrrttrrrrr` |
| green-anaconda * | 10.8 → 10.9 | 28 → 1% | 8 → 48% | 19 → 5% | `FFFFFFzzzzzzzzzzzzFFFFFF` | `rrrrrrrzzzzzzzzzzztrrrrr` |
| koi | 11.4 → 11.4 | 15 → 36% | 12 → 8% | 25 → 8% | `zzzzzzFtttttttttttzzzzzz` | `zzzzzzFFFFFFFFFFFFzzzzzz` |
| common-octopus | 10.9 → 10.9 | 18 → 14% | 9 → 31% | 27 → 10% | `tttttFzzzzzzzzzzzztttttt` | `FrrrrtzzzzzzzzzzzzrrFrrF` |

## Guards

- `src/lib/ark-needs.test.ts` (new, 10 tests): every row's day is sane; sleep hours for 14 well-known species and the
  sun rule kept where no hours are written; feeding shares, bout lengths and bouts a day (elephant, cow, lion,
  crocodile, great tit, hummingbird, python); rest follows feeding; trips to water (zebra, cow, giraffe; none for a
  koala, a kangaroo rat, a hummingbird; a herd together); the bask, the winding down, the zoo's feeding, a pinned hour;
  the fed bar's rate; and on the fixture's world: changes a waking hour, the median feeding run, grazers' feeding share,
  resting slots that stay put, the fed bar before and after a feeding bout.
- `tests/ark-motion/metrics.json` check `b3-needs`: twelve of those numbers as registered metrics. Measured: the
  sleep spread of 15 well-known species 17 hours (limit 15); an elephant's feeding share of its waking 0.85 (0.65); a
  lion's 0.12 (at most 0.2); a cow's median feeding bout 52 minutes (30); a hummingbird's feeding bouts a day 79 (50);
  a zebra's trips to water 1.6 a day (1 to 2); on the fixture, changes between feeding, moving and settled 10.6 a
  waking hour (at most 12), feeding slots in bouts of four slots and up 0.76 (0.6), grazers feeding 0.47 of four
  waking hours (0.4), resting slots that stay put 0.97 (0.85), the fed bar 0.53 before a feeding bout (at most 0.62)
  and 0.74 after it (0.68).

### The existing guards

Run on the final code, all passing: `ark-behaviour-schedule` (27 tests), `ark-behaviour-recipes` (29),
`ark-animal-status` (14), `ark-waterbirds` (9), `ark-sleep` (24), `ark-behaviour-state` (4), `ark-flight-physics`
(12), `ark-schedule-water` (4), `ark-breath-trip` (2), `ark-reactive` (28), `ark-needs` (10);
`npx tsc --noEmit -p tsconfig.json` clean; `npm run lint` exit 0.

**Not passing on this branch alone: `ark-chases.test.ts`, 3 of 11** (all 11 pass on main). They sample the first
hunts of a synthetic cat, osprey and swallow on the schedule; with feeding in bouts those are other slots from other
starts: an osprey's three hunts were all caught (the test wants a miss among them), one of a cat's runs crosses
blocked ground at 44.0, -56.1, and 9 of 286 swallow hawking samples are within a crown's reach of a tree. The hunt
recipes are the hunt lane's (`recipe-hunt.ts`, changed on its branch): to be run again once the two are merged.

The movement round's time budget on the real snapshot (`scripts/ark-time-budget.mts`, wild island, main → this
branch): ground birds' worst share of the day aloft 0.011 → 0.006 and worst take-offs an awake hour 2.57 → 0.86; the
coot on the water 0.98 → 0.92 of the day, the great crested grebe 1 → 1; air-leg speed over cruise, median 0.90 → 0.87,
tenth percentile 0.57 → 0.52; species under 0.35 of their cruise 0 → 0.

Limits moved, each with its reason where the limit lives:

| Guard | Main c99ff83b | This branch | Limit | Why |
|---|---|---|---|---|
| `metrics.json` `tb_species_under_035` (validator's animals: flying species under 0.35 of their cruise) | 17 | 32 | 20 → 34 | A big bird rests most of its day and makes far fewer flights for their own sake (the long ones, at cruise); the median of its air legs is now its 10 to 40 m ways to a feeding spot, flown at half a g well under cruise. Main flew the same legs among more commutes. The other time-budget metrics hold (median 0.85 → 0.79, limit 0.6; tenth percentile 0.45 → 0.41, limit 0.4; ground birds 0.083 and 3.43, unchanged; coot 0.98 → 1; grebe 0.71 → 0.67). |
| `thresholds.json` hawkers: air time circling | 36.0% | 53.9% | 40 → 56 | Swallows and swifts now feed through 70% of their waking time; their feeding is hawking, which circles by design (about 6,750 s → 11,070 s of 18,743 s → 20,543 s aloft). |
| `thresholds.json` hawkers: full turns per air minute | 7.77 | 11.04 | 8.5 → 11.5 | The same. |
| `thresholds.json` near camera: prey that flee a hunter | 71.8% (171 of 238) | 53.7% (201 of 374) | 55 → 51 | More prey flee than before, and more still are near a hunter without fleeing: a hunter lies still through most of its waking time now, and prey that see a still hunter watch it. Prey that react at all 97.5% → 91.4% (limit 90 kept). |
| `thresholds.json` awake moments a whole group does the same | 14.0% | 16.9% | 16 → 18 | A kind that feeds 60 to 80% of its waking time is all feeding at once more often. Distinct states in a group of 4: 2.16 → 2.10 (limit 2); species always in step 82 → 82. |
| `ark-behaviour-schedule.test.ts` a whole species in one state | under 8% | 14.6% | 8% → 17% | The same, over species. |
| `ark-behaviour-recipes.test.ts` turns in a minute of a recipe's stay | under 1 | 1.00 (an alligator's root_dig, once) | 1 → 1.02 | Its last turn, to the way it sets off, is counted; feeding in bouts changes where it sets off to. For the ground lane. |
| `ark-behaviour-recipes.test.ts` turning on the move after a recipe's stay | under 1 rad | 1.02 and 1.86 rad (a grey heron, twice in a day) | 1 → 2 rad | In a feeding bout a spear is followed by another stand along the shallows; two set-offs off a steep bank bend. For the ground lane. |

The rest of the CI audit (`scripts/ark-behaviour-audit.mts`, CI configuration, main → this branch): flyer species that
fly 690 → 671 (limit 580); all but the hawkers, full turns per air minute 0.69 → 0.64 and their time aloft in the
flight hour 226,525 s → 136,803 s; animals that never move 828 → 824; grazers' waking time grazing at the grass 31.0%
→ 33.2%; grazers that never grazed 28 → 28; amphibians that cross land and water 428 → 418 (limit 375); crossings that
snap 0 → 0; heads turning 97.5% → 96.7%; wrong surface 1.0% → 1.0%; sinking 13 → 13. The encounters half of the CI check
(`ark-intelligence-encounters.mts --limit 150`, this branch only): heads turning on their own 81.3% (limit 78), prey
that react 62.1% (58), close prey that flee 58.9% (53), median 0.1 s to react. With the four limits above moved, all
25 checks hold.

## For the other lanes

- **Hunt (B1).** The stalk weight is unchanged, but a stalk is now drawn within a feeding bout: stalk slots a day fall
  as in the table above, and they come together (a lion's in the hour after it gets up, not spread through its day).
  `forayActivity` words a forager's server foray as its feeding; the hunt lane's `huntStyle` should be the one rule.
- **Prey (B2).** The day watch of a group of three or more is three slots a turn on the shared clock
  (`DAY_WATCH_SLOTS`), no longer one. In the CI audit's camera stops fewer prey near a hunter flee (see Guards).
- **Land (B4).** Two set-offs after a heron's spear turn on the move on a bent way off a steep bank (1.02 and 1.86
  rad; `ark-behaviour-recipes.test.ts`, limit moved 1 → 2), and an alligator's root_dig stay with its last turn to the
  way it sets off sums to 1.00 turns in a minute (limit 1 → 1.02). The set-off and the episodes are unchanged; feeding
  in bouts makes these set-offs common. A trip to water is still one slot: water further than a slot's walk is never
  gone to. Two members of a flock were seen resting on the very same spot (a rest spot snapped to one walk cell).
  `behaviours.json` now holds the sea lions' and the walrus's natural walking paces (the regeneration that was owed
  since MA4).
- **Air (B5).** Flights for their own sake are far fewer for a kind that rests most of its day (birds of prey travel
  33 → about 22% of their waking time), and what a big bird's air legs average fell with them
  (`tb_species_under_035` 17 → 32 on the validator's animals; 0 → 0 on the real snapshot). A big bird with no perch
  that suits it (`perchSuits`) now rests on the ground at a spot in its range for a spell: more big limbs, or a wider
  search, would put it up. A flock follows its leader only into a real flight (an air leg of 3 s and up) and not while
  the leader is settled. Hawkers hawk through most of their waking time now (70% of it is feeding), so their circling
  share of air time is up (see Guards).
- **Water (B6).** A wading bird keeps one stand through a spell; a school's member feeds through its own feeding
  bouts and cruises between; a resting swimmer holds a station of its own; cruising and plankton-feeding fish and
  crocodilians are never asleep on the schedule.
- **Town.** The nocturnal house is fed at 11:00, when its residents are asleep (they do not come, and the card says
  asleep). `ScheduleAnimal.feeding` is set on the zoo's feeding variant (`islands/scene.ts`, one property).
- **Rig player.** A ruminant's `ArkDay.ruminates` is there to read: a `chew` beat on a lying base would show the cud.

## Not done, and why

- **Weather.** `lib/ark-clock.ts` carries weather (rain, storms, in spells of an Ark day), but the schedule is not given
  it: shelter in rain needs a `weatherAt` passed into `ScheduleWorld` from `index.ts`, which is not this lane's file.
  Shade at noon is done as far as the needs go (a midday rest on hot open ground; a rest may go to shade).
- **The town headless.** The activity budget was not run on the town's own places (its sampler, placements and
  enclosures are built by the islands scene); the town's species were measured on the wild island's world.
- **Rumination as seen.** A ruminant's rest after grazing is a rest in the schedule and on the card; the jaw working
  while it lies is the rig player's (a `chew` beat on a lying base).
- **Drinking where water is far.** A trip to water is one slot; water further than a slot's walk is not gone to
  (decision 202), so many animals still never drink. Trips of more than one slot are the ground lane's.
- **Off the schedule.** A micro animal, a reduced-motion view and the legacy herds still sleep by the sun rule
  (`isAwake` in `index.ts` and `behaviour-state.ts`), and so does the landing page's day summary (`data/ark-landing.ts`).
- **The server's sleep.** Encounter hunting (`hunting.ts`) asks the pinned positions module whether a predator is awake,
  by its stored activity alone (none stored: by day). A lion's schedule sleeps through the day; the server may still
  send it hunting then. Unchanged by this lane; it was so before.
