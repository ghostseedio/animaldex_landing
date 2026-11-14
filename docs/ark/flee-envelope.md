# The flee envelope (intelligence ↔ behaviour)

**Status:** agreed with the behaviour lane (67d6ddf3): §6.2 and §6.3. Lane: `ark-intelligence-web`. Numbers come from `src/ark-scene/reactive.ts`, `src/ark-scene/intelligence.json` and `src/ark-scene/sizes.ts` as of 75cd81a3. Where a number changes later, this file changes with it.

**Changes since the first draft (1e0b5ba5):**

- the flight distance scales with the threat (§3);
- flee speed comes from the speed stat and the animal's size (§4);
- armoured animals withdraw, and sessile animals never move;
- after running, an animal holds its ground while the threat is in view;
- an alarm about a far-off ground threat puts the group on alert instead of sending it running;
- a raptor overhead sends them to cover first;
- a bird against the sky is seen further, and the sentinel further still.

**Changes in the behaviours pass (2026-11-14, lane B2; `docs/ark/behaviour-pass-2026-11/prey.md` has the audit and the numbers):**

- who is a threat goes by the food links and by body mass (`canTake`), no longer by the size stat (§2.1);
- the response fits what the predator is doing: one lying up or going by is watched and then tolerated, one coming, creeping or chasing is not (§3);
- a creeping predator is the hardest to see, and an animal with its head down notices later than one looking round (§2, §3);
- a flight is one dash at the locomotion lane's flee pace (the meal chase's), then it holds where it ran to (§4): the `gait` cap of §6.3.4 is gone;
- by rule, big and armed animals stand their ground, cryptic ones hold still until flushed, burrow dwellers go to ground (§3);
- it calms in proportion to the scare, then stays wary a while (§4);
- kept animals (houses, farms, the zoo) are used to people and to one another (§2.1).

## 1. Who owns what

There are two layers, and everything here is visual only. The server decides every meal, birth and death.

| | Shared layer: `behaviour-schedule.ts` (behaviour lane) | Local layer: `reactive.ts` (intelligence lane) |
|---|---|---|
| What it says | Where each animal is and what it is broadly doing (`doing`, `moving`, `aloft`) | What an animal near the camera does on top of that: looks, alerts, freezes, flees, shields its young, stalks, investigates the camera |
| Computed from | Time and ids only. Every viewer and the livestream see the same thing | The shared poses near the camera, plus the camera itself. There is no randomness: the same inputs give the same frames |
| Where it runs | Every animal | Only the nearest animals near the camera: high tier 90 within 70 m, medium 48 within 50 m, low 20 within 32 m, lite none |
| Moves the animal | Yes: the drawn position is the schedule's pose | Only an offset `(dx, dz)` plus a body turn, a head look and a crouch. The offset always stays inside the envelope round the shared pose |

The local layer never contradicts the shared layer:

- an animal the schedule has asleep stays asleep, and any offset only eases back;
- an animal acting out a server event (an act, a moment, the visitor) is left entirely alone (zero output);
- an animal in the air is left to its flight;
- a stalking predator always stops short of its prey (`minGap`), so nothing is ever caught.

## 2. Detection: when a prey animal knows the predator is there

The ranges are per species, in `intelligence.json`, generated from stored data by `scripts/ark-intelligence-profiles.mts`:

- **Base range.** By body plan: sight, hearing and smell in scene metres.
  - quadruped 28 / 30 / 26;
  - primate 34 / 26 / 12;
  - flying bird 40 / 24 / 3;
  - walking bird 36 / 22 / 3;
  - flightless bird 44 / 22 / 4;
  - bat 8 / 40 / 10;
  - lizard 16 / 8 / 8;
  - legless 8 / 6 / 14;
  - turtle 14 / 6 / 10;
  - amphibian 10 / 10 / 4;
  - fish 12 / 10 / 10;
  - cephalopod or jelly 16 / 4 / 6;
  - crustacean 6 / 3 / 8;
  - insect 4 / 3 / 6;
  - flying insect 10 / 3 / 8;
  - arachnid 3 / 4 / 2;
  - other 0 / 0 / 2 (touch).
- **Size.** Each base range is scaled by `0.7 + size/160`, where size is the stat from 0 to 100. A mouse gets about 0.75×, an elephant about 1.3×.
- **Family rules and stored text.** Raptors see 2×; owls hear 2×; nocturnal or truly burrowing animals see 0.5× and hear 1.3× (a day-active meerkat or prairie dog keeps its eyes). Stored "keen eyesight" gives 1.4×, and "nearly blind" 0.35×. Stored keen hearing or echolocation gives 1.5×, and keen smell 1.6×.

### 2.1 Who is a threat to whom

An animal reacts only to an animal that would hunt it (`ReactiveLayer.threatens`):

- **The food links.** The ecology's own: the hunter eats a food group the other is in, or the other by name (`foodLinked`).
- **Body mass** (`canTake`, `bodyMass`: mass from the drawn length by the catalogue's allometry, with each body plan's share of a four-legged body's weight: a bird 0.15, a snake 0.03, a lizard 0.04 rising with its length). A hunter alone takes prey up to 4 times its own weight; one that lives in a group up to 8; a pack hunter up to 12; a bird of prey 1.5; a snake its own weight. It is this individual's size that counts: a cub is no threat to a zebra.
  - Before the pass this was the size stat (prey no more than 6 points above the hunter, 18 for a pack). The stat ranks animals within their own kind, so it let a rock python (72) threaten a giraffe (78), a mantis a hedgehog and a rat snake a roe deer, and kept a stoat (11) from a rabbit (18).
- **Pets.** The ecology gives cats, dogs and a ferret no food links. A meat-eating four-legged hunter with no links at all is read by its build (`huntsByBuild`): it goes after land animals and birds, themselves no meat-eaters, up to a third of its own weight (a cat a sparrow, a pigeon, a mouse; a dog a hen, a rabbit, a duck).
- **A much bigger hunter** (`rival`): a ground hunter gives way to another at least 2.5 times its weight (a cheetah or a jackal to a lion, a fox to a wolf, a cat to a dog). The bigger pays the smaller no mind.
- **Kept animals** (`ReactiveInput.kept`, the town island's `area`; `apart`). A zoo animal is apart from everything: its fence, and the habit of the ones it shares its enclosure with. Two animals kept at homes or on farms are used to one another (the yard dog and the hens). Between a kept animal and a wild one nothing changes: the garden's sparrows and the house cat, the hens and a fox. Across a fence or a household a hunter still watches what it would hunt (`watch_prey`); it never stalks it. The camera never backs a kept animal off or wakes it.

A hunter near the camera that is not acting out a server meal creeps at its prey (the local `stalk`) only when the schedule has it hunting (`stalk`) or up and about and hungry (`forage`, `wander`); one lying up, grooming, basking or drinking only watches. Its prey can tell (§3).

What `perceive()` does with those ranges each time it looks:

| Sense | Range in the moment |
|---|---|
| Sight | sight × night factor × fog × how conspicuous the other is × 1.6 if this one is the sentinel on watch. **Night factor:** `1 − night·(1 − its night vision)`. **Fog:** `1 − 0.6·fog`. **Conspicuous:** moving 1.25, still 0.7, creeping (the schedule's `stalk`) 0.5, times `(0.7 + 0.15·min(length, 3))`, times 1.8 if the other is aloft (a silhouette against the sky). It looks for others out to `2.6 × sight` (× 1.6 on watch), within the tier's reach. It only sees inside its field of view: about ±155° for prey and ±92° for a hunter. It also needs a clear line through the terrain and vegetation (`reactive-world.ts`, clear above 0.45) |
| Hearing | hearing × loudness × `(1 − 0.5·rain)` × `(1 − 0.3·wind)`. **Loudness:** a moving walker (quadruped, primate, walking or flightless bird) 1; anything else moving 0.6; either way times `(1 + 0.2·min(length, 3))`. A still or a creeping animal 0.25 |
| Smell | smell × `(0.5 + wind)`, and only when the wind blows from the other toward this one |

**Per plan.** Medians over every species aboard, with drawn length from `sizes.ts`:

| Plan | Species | Drawn length m (p10 / median / p90) | Sight m | Hearing m | Flight distance m (p10 / median / p90) |
|---|---|---|---|---|---|
| quadruped | 604 | 0.4 / 1.2 / 1.8 | 25 | 28 | 4.1 / 6.6 / 10 |
| primate | 79 | 0.5 / 0.9 / 1.2 | 31 | 23 | 4.0 / 5.2 / 6.6 |
| flying_bird | 598 | 0.3 / 0.7 / 1.2 | 33 | 20 | 3.2 / 4.3 / 6.0 |
| walking_bird | 62 | 0.4 / 0.7 / 1.2 | 30 | 18 | 3.6 / 4.6 / 6.0 |
| flightless_bird | 20 | 0.8 / 1.0 / 1.8 | 39 | 20 | 4.7 / 5.4 / 9.1 |
| lizard | 110 | 0.4 / 0.6 / 1.7 | 13 | 7 | 2.0 / 2.5 / 3.5 |
| legless | 92 | 0.3 / 1.0 / 1.9 | 7 | 6 | 1.8 / 2.7 / 3.8 |
| turtle | 62 | 0.4 / 0.6 / 1.3 | 11 | 5 | 2.0 / 2.6 / 3.8 |
| amphibian | 67 | 0.2 / 0.4 / 0.5 | 8 | 8 | 1.7 / 2.0 / 2.6 |
| fish | 301 | 0.4 / 0.7 / 2.2 | 10 | 8 | 1.9 / 2.5 / 3.7 |
| cephalopod_jelly | 28 | 0.2 / 0.6 / 1.3 | 13 | 3 | 1.7 / 2.3 / 3.5 |
| crustacean | 55 | 0.2 / 0.3 / 0.7 | 4 | 2 | 0.5 / 0.6 / 1.0 |
| insect | 152 | 0.2 / 0.2 / 0.4 | 3 | 2 | 0.4 / 0.5 / 0.6 |
| flying_insect | 173 | 0.2 / 0.2 / 0.4 | 7 | 2 | 0.5 / 0.5 / 0.6 |
| arachnid | 77 | 0.2 / 0.2 / 0.5 | 2 | 3 | 0.4 / 0.5 / 0.8 |
| bat | 7 | 0.2 / 0.4 / 0.6 | 6 | 30 | 1.6 / 2.0 / 2.6 |
| other | 68 | 0.2 / 0.3 / 1.2 | 0 | 0 | 0.5 / 0.6 / 0.9 |

**Real pairs.** Each figure is the farthest distance at which `perceive()` says yes. The predator stands broadside, by day unless the column says night, with a light wind blowing away from the prey (so no smell) and no line-of-sight test:

| Prey | Predator | Prey drawn m | Walking predator (day) | Still predator (day) | Walking predator (night) | Flight distance | Flee reach | Flee speed m/s |
|---|---|---|---|---|---|---|---|---|
| house mouse | red fox | 0.3 | 24.6 | 13.3 | 24.6 (heard) | 3.6 | 2.5 | 1.4 |
| red squirrel | red fox | 0.4 | 25.7 | 14.0 | 25.7 | 4.2 | 3.0 | 1.9 |
| meerkat | (a jackal-sized hunter) | 0.6 | 24.2 | 14.0 | 16.8 | 4.7 | 3.5 | 2.9 |
| European rabbit | red fox | 0.6 | 41.4 | 14.7 | 41.4 | 5.2 | 3.8 | 2.6 |
| roe deer | Eurasian wolf | 1.3 | 50.9 | 16.8 | 50.9 | 7.3 | 6.1 | 4.3 |
| red deer | Eurasian wolf | 1.8 | 38.8 | 19.6 | 38.8 | 10.0 | 7.6 | 5.7 |
| plains zebra | African lion | 1.7 | 40.0 | 19.9 | 40.0 | 9.6 | 7.4 | 5.5 |
| house sparrow | domestic cat | 0.4 | 31.0 | 17.4 | 19.8 | 3.3 | 2.8 | 2.0 |
| mallard | red fox | 0.8 | 35.8 | 20.1 | 22.4 | 4.8 | 4.3 | 3.4 |
| green iguana | jaguar | 1.3 | 18.1 | 10.1 | 10.2 | 4.0 | 6.0 | 3.2 |
| green sea turtle | tiger shark | 1.5 | 18.1 | 10.1 | 7.0 | 4.4 | 6.8 | 3.6 |

- **Alarm calls.** When an animal that calls (stored alarm calls, a sentinel, or a group-living default) notices the predator, it calls: once each time it takes a fresh look at it (§3), never more than every 8 s. (Before the pass it called every 8 s for as long as the predator was in sight.) The call reaches its own kind within `hearing × 1.6 × (1 − 0.4·rain)`. One that has settled to tolerating that predator takes no notice of calls about it.
- **Eavesdropping.** Other group-living species react to the call only when the caller's threat could eat them too.
- **What a call does.** A listener runs when:
  - the threat is within 1.3 times its flight distance;
  - the threat is in the air (a raptor comes fast);
  - or one of its group is already running (contagious flight).

  An alarm about a threat further off on the ground only puts it on alert: head up, looking at the caller, then where the caller looked.
- **Delay.** A call is heard after `0.09 s/m × distance + 0.08 + up to 0.22 s`. Another species hears it 0.25 s later still, plus the listener's personality.
- **Silent spread.** One of its group running from a threat sets the others off `0.15 + 0.06 s/m × distance + up to 0.25 s` later. One of its group stopped with its head up, staring at a predator it has not settled on, has the ones that have seen nothing look up too, `0.4 + 0.1 s/m × distance + up to 1.6 s` later.

## 3. What it does about it

**Notice delay.** Once perceived, the threat is noticed after:

```
max(0.05, fleeDelay · (1.2 − 0.5·learning) · (0.35 if on watch) − 0.12 · memory strength) + attention
```

- `fleeDelay` is `0.35 + 0.25·boldness`, about 0.1 to 0.6 s (`ark-clock.ts` `animalPersonality`).
- A predator it remembers makes it quicker.
- **Attention.** An animal with its head down (feeding, drinking, dozing, grooming, at play) sees a predator only when it next looks up: its own seeded 1 to 5 s, times `0.35 + 0.65·(distance / its sight)`, times 1.5 for a predator lying still or creeping. One already looking round takes 0.3 of that. One on watch (the sentinel, or the schedule's `watch`), or with the predator within 1.5 flight distances, none. Never so long that a predator at a walk covers more than a third of the way to it.
- A chase is noticed at once.

**What the predator is doing** (`menaceOf`), as its prey reads it, and the factor on the flight distance (`threatScale`, times the size factor below):

| The predator | Read as | Factor |
|---|---|---|
| runs something down (a server meal's chase) | `chasing` | 1.6 |
| creeps its way (the schedule's `stalk` within 57° of it, or the local stalk at this very animal) | `stalking` | 1.5 |
| walks at it (heading within 40°) | `coming` | 1.3 |
| walks by | `passing` | 1.0 |
| is still (lying up, sitting, grooming, drinking, on a kill) | `resting` | 0.6 |
| is asleep | no threat | |

The flight distance is `flight × fleeDistance personality (0.65–1.35) × (1 + 0.25 per predator met before, up to 2) × threatScale`. The size factor is `1 + 0.25·log2(predator length / its length)`, clamped to 0.75–1.5 (Stankowich & Blumstein 2005). Distances are from where the animal is drawn, so the room it put between them by running counts. (Before the pass a still predator was 0.85, a creeping one counted as walking, and the sighting itself counted as "a predator remembered": every flight distance was 1.25 times what this says.)

**Zones.** With `F` the flight distance and `d` the distance to the predator:

| | Predator `resting` or `passing` | Predator `coming`, `stalking` or `chasing` |
|---|---|---|
| `d < F` | it runs (or its own way with a predator close: below) | it runs |
| `F ≤ d < 1.6·F` | it walks off, looking back, and watches from there (`move_off`) | it watches |
| beyond | it watches, then **tolerates** | it watches for as long as it comes |

- **First it looks.** For `0.35 + 0.4·(1 − learning)` s it is `alert`: head to the threat, the body following past the head's limit. On an alarm call it looks at the caller first, then where the caller looked.
- **Watching** (`alert`): head up, standing, on the predator. A herd animal closes up with its group while it watches (`bunch`: its distance from the group's middle cut to 0.65 of what it was).
- **Tolerating.** A predator lying up or going by, outside 1.15 flight distances, is watched for `(3 to 8 s, seeded) × clamp(2F / d, 0.5, 2.5) × (1.3 − 0.4·learning)` and then tolerated: the animal goes back to its own business where it is, warily (it lifts its head 1.8 times as often, about half its looks go to the predator, and it keeps the place it moved off to). Zebras graze in sight of lions lying up. It is watched afresh, with a new call, when the predator does something worse (gets up, turns its way, creeps, runs), comes inside 1.05 flight distances, or comes to 0.7 of the distance it settled at.

**Its own way with a predator close** (by rule, `styleOf`, `standsTo`), in this order:

1. **It plays dead** if it is a stored play-dead species and the threat is very close (under 0.4 × the flight distance).
2. **It pulls in** (`withdraw`) if its armour is its defence (armour listed first, or armour and a speed stat under 25: tortoises, armadillos, hedgehogs, snails), or if it is sessile. It stays put and never walks off.
3. **It stands its ground** (`threat_display`, facing the predator, from 1.6 flight distances in) if it is armed (a stored chemical defence: skunks, toads; or armour and a threat display: porcupines), or if it is a dominant animal (dominance stat 60 or more, and either a stored threat display or dominance 68 or more) at least half the predator's weight: a buffalo or a boar before a big cat, a moose before wolves. It closes up with its herd. With the predator very close and no heavier than it, it goes at it a few steps. From a chase only an armed one stands. (Before the pass the threat display could never be reached: a flight always came first.)
4. **It holds still** (`freeze`, low) if it is a cryptic species (stored freezing or camouflage) and standing: from when it sees the predator for as long as the predator is about, and it goes only when the predator is within 0.45 flight distances (0.7 if it is coming). Once flushed it runs like any other. (Before the pass a freeze lasted 2.5 to 4.5 s and then it ran at its full flight distance.)
5. **It runs** (`flee`): §4. One that lives in a burrow, a den or a crevice (`ReactiveInput.roost`) and runs for cover goes to ground: it makes for cover first, whatever its stored order, and keeps low there.

A parent with young near puts itself between them and the threat; the young keep behind the parent.

**Flight distance by plan and size** (from the generator, in scene metres):

- quadruped `3 + 0.12·size`;
- birds `2.5 + 0.1·size`;
- primate `3 + 0.08·size`;
- invertebrates `0.4 + 0.03·size`;
- everything else `1.5 + 0.06·size`.

Modifiers: stored shy or wary text gives ×1.4, stored curious or bold text ×0.7, a hunter larger than 40 ×0.5, and a giant (not a hunter, size 60 and dominance 80 or more: elephants, rhinoceroses, hippopotamuses, buffalo, gaur, bears) ×0.6.

## 4. Flee speed, reach and duration

| | Value | At a glance |
|---|---|---|
| Flee reach (the envelope when fleeing) | `clamp(3.5·L + 1.5, 2, 9)` m, L = drawn length | mouse 2.0, sparrow 2.0, rabbit 2.7, roe deer 5.9, red deer 7.4, zebra 8.9, elephant 9 |
| Calm reach (its own business) | `clamp(0.8·L + 0.4, 0.5, 2.5)` m | mouse 0.5, deer 1.7, elephant 2.5 |
| Flee speed (`fleeSpeed`) | `min(fleePace, 8)` m/s: the locomotion lane's held flee for its body (`locomotion/flee.ts`: 0.65 of the allometric sprint for its size and plan, moved ±30% by its speed stat), the pace the prey of a meal's chase runs at | zebra 8, red deer 8, impala 8, chital 8, alpine marmot 5.3, rabbit 4.5, hen 2.8, mouse 2.1, wall lizard 1.6, sparrow (on foot) 0.9, frog 0.4, tortoise 0.3 |
| Getting up to speed | `1 − exp(−t / τ)`, `τ = accelTime(L) / 3`; it eases up over the last quarter second | a zebra covers its 8.9 m in about 1.5 s |
| Body turn while fleeing | it faces the way it runs (a full turn on the spot first if that is more than 70° off) | |

**Duration**, as a timeline:

1. **Notice and look:** the notice delay (0.05 s to a few seconds: §3), then 0.35 to 0.75 s of looking.
2. **The dash:** one direction, chosen as it starts (§5), to the edge of the flee reach. Running, its head looks where it runs, with a glance back at the threat every 2.2 s (seeded).
3. **It holds** where it ran to (`alert`; one that went to ground `freeze`, low), facing the predator, and never walks back toward it. It dashes again, on round its reach, only if the predator comes within 0.6 flight distances of where it now stands.
4. **Then, with the predator still about:** if it lies up or goes by, the watch of §3 starts where the animal stopped, and it settles to tolerating it from there.
5. **Drop the threat** 3 s after it last perceived it.
6. **Calm in proportion.** It stays where it is, looking at where the predator was (`recover`), for `(5 + 28·scare) s × (1.4 − 0.6·learning)`, where the scare is 0.2 for a look, 0.3 to 0.35 for closing up or moving off, 0.4 to 0.5 for a freeze or a stand, 0.6 for pulling in, 0.75 for a run and 1 for a chase: about 10 s after a look, 30 s after a run, 40 s after a chase. The alarm level falls over that time.
7. **Wary.** For as long again it goes about its business where it ran to, lifting its head more, half its looks to the spot. Then it walks back to its own place.
8. **Avoid the spot.** For `20 + 40·learning` s after a sighting it keeps away from where it saw the predator (pushed off by up to half its calm reach), and it notices faster the next time.

(Before the pass: the flee speed was capped by `gait`, the first rig set's clip figure, which the v2 rigs no longer match: a chital fled at 0.15 m/s, an alpine marmot at 0.06, an impala at 1.1. The action stayed `flee` for as long as the predator was inside the flight distance of its shared place. And the calming counted from the start of the reaction, so after anything longer than 15 s it was calm 3 s after the predator had gone.)

**Never a jump.** When the envelope shrinks back from the flee reach to the calm reach, the offset comes back in at the animal's walk (`moveOffset`).

## 5. Where it flees to

It takes its first stored defence that has a refuge within 3 × the flee reach (`fleeDirection`), worked out once as the dash starts. One that goes to ground (§3) makes for cover before anything else. The refuges come from the graphics lane's attach points, via `reactive-world.ts`:

| Defence | Refuge | Species aboard |
|---|---|---|
| `flee_cover`, `burrow` | shade, a burrow entrance, reeds, a cave mouth or a rock face; else its remembered roost | 984 + 9 |
| `flee_water` | the water's edge, or the pond surface | 178 |
| `flee_tree` | bark or a branch | 252 |
| `group` | a point one flee reach past its group's middle, on the side away from the threat as the group sees it (the herd closes up and runs one way) | 864 |
| `flee_open`, `fly_off`, or no refuge in reach | straight away from the threat | 240 + 789 |

- **Blending.** The direction mixes "away" with "toward the refuge" at 0.7 toward the refuge. If the refuge lies toward the threat, it is 0.25 toward the refuge, bent away.
- **From a raptor overhead.** It makes for cover first (a burrow, a bush, a tree), even when its group is listed first. It bunches with its group only where there is no cover.
- **Never into the water, never out of it.** A land animal's offset shortens until it stays on land, and a water animal's until it stays in the water at its depth (`offsetShare`). So `flee_water` animals (frogs, terrapins, otters) run to the edge, and going in is the shared layer's job (`enter_water`, agreed in §6.3.5).
- **`fly_off` birds on the ground** run or hop off within their reach (2.8 to 4 m). A real take-off needs the flight clips, which stay held until the owner approves them (`ARK_FLIGHT_APPROVED`). The proposal for then is in §6.4.

## 6. How the shared schedule yields, and resumes

### 6.1 The rule

The schedule never yields per viewer. It is a pure function of time and ids, and it must stay the same for everyone. A flee is local to the viewer near the camera, so it lives entirely in the offset.

- **During a reaction.** The drawn animal is the shared pose plus the offset, and the offset stays inside the flee reach. If the schedule walks the shared pose on during a flee, the drawn animal goes with it and is never more than the flee reach from where everyone else sees it.
- **Resuming.** The offset eases back onto the shared pose (§4), at no more than the animal's walk. The schedule's own trip simply continues: there is nothing to resume on the shared side, because nothing stopped.

### 6.2 What the behaviour lane already does that this relies on (keep it)

- **Spacing** (`spaceHomes`). Predators' home ranges are kept `max(10, 6·L) + both reaches` from their prey's.
  - The reactive layer only covers what is near the camera, so the shared spacing is what keeps the whole island from looking like predators walking through herds.
  - With spacing, most shared encounters happen at 10 to 25 m, where prey look and alert. The close ones (under 6 m) are the reactive layer's flee.
- **Stalking towards the edge of its range.** The schedule's `stalk` is a shared slow walk to the edge of the predator's own range (its weight is not 0). The local layer adds on top only the crouch, the look, and at most its calm reach toward the prey, and it stops at `minGap`.
- **Shared wariness** (behaviour 67d6ddf3, `threatAt`, `wireThreats`). A prey animal that, at the start of its slot, sees an awake predator within `WARY_METRES` (35 m) goes to the far side of its range and watches it (`doing: "watch"`, facing it). The local layer composes with it and does not react twice:
  - Already watching, it notices the predator sooner (its notice delay × 0.35, as for a sentinel), and its head goes to it.
  - It adds no avoiding step of its own: the remembered-spot push is off while `doing` is `watch`, because the shared layer has done the moving away.
  - It runs only if the predator comes inside its flight distance (§3), or on its group's flight or an alarm (§2).
  - With nothing in sight it looks round (`scan` favoured while `doing` is `watch`).
  - Test: "with the shared layer's wariness …" in `ark-reactive.test.ts`.

### 6.3 What was asked of the behaviour lane, and agreed

1. **The envelope function.** `reactiveEnvelope` is replaceable: the scene can pass `envelope` to `new ReactiveLayer({envelope})`.
   - If behaviour wants different numbers (for example, the flee reach from the speed stat instead of the length), replace the function; don't fork the layer.
   - I propose keeping the numbers in §4 until the encounter scenarios (`scripts/ark-intelligence-encounters.mts`) say otherwise.
2. **Pass `doing` honestly.** The layer reads `shared.doing` to choose its calm actions (feed while `graze`/`forage`, doze while `rest`, wait its turn at `drink`). It also reads `moving` (a moving predator is easier to see and hear) and `aloft`.
   - Please keep these names stable, or tell me the new ones.
   - `flee` in `behaviours.json` is weight 0 in the schedule: the local layer does the flight near the camera. `stalk` is not 0: it is the shared slow walk in §6.2.
3. **Shared wariness.** Done by behaviour (§6.2): decided in the schedule from shared inputs only (the predator's shared position at the slot's start), never from the local layer's output.
4. **The animation follows the drawn speed.** `rigFor` measures the speed from the drawn position, offset included, so a flee plays the walk or run clip by the distance it covers.
   - **Changed in the behaviours pass (2026-11-14, lane B2):** the flee speed is the locomotion lane's `fleePace` (§4), as the prey of a meal's chase has run since `setChasePaces`. The cap at `gait × 2.5` (`GAIT_CADENCE`) is gone: `gait` is the first rig set's figure (a chital's is 0.045 against a v2 run clip of 3.08 body lengths a second), and it held flights to a crawl. `ReactiveInput.gait` is still passed and no longer read. Every other reaction keeps the walk and run clips' own pace caps (`paceCap`, decisions 201 and 202).
5. **Water. Behaviour's decision:** a fleeing amphibian stops at the water's edge locally; going into the water stays the shared layer's `enter_water`.
   - The local rule is `offsetShare` in `reactive.ts`. A land animal is never pushed into the water, and a water animal is never pushed onto a shore or out of its depth (6e28f828).

### 6.4 Later, with the flight clips: `fly_off`

When flight clips are approved, a ground bird whose defence is `fly_off` should flush: up 1 to 2 body lengths and down again at the edge of its reach, over about 1 to 1.5 s.

- That needs one more output, `lift` (metres), and the flap clip.
- It stays local, and it stays inside the envelope.
- Not built until the clips are cleared.

## 7. The contract in one block

```
drawn position     = shared pose + (dx, dz),  |(dx, dz)| ≤ reactiveEnvelope(input, fleeing)
drawn yaw          = shared yaw + bodyYaw     (|bodyYaw| ≤ 1.2 fleeing, 0.9 otherwise)
drawn height       = shared base − crouch · modelHeight · 0.08
head (arkLook)     = (headYaw, headPitch, headWeight)   see intelligence-review-30.md, "arkLook"
reacting/recovering/wary → keeps the flee reach (holds its ground); calm → the calm reach, pulled in at its walk
tolerating         → calm actions, alarmed 0, response "tolerate"; the place it moved off to is kept
kept (house/farm/zoo) → never backed off or woken by the camera; apart from other kept animals (zoo: from all)
sessile            → envelope 0 (never moved)
asleep             → no reaction; offset, head and turn only ease back
acting (server)    → zero output
aloft              → left to the flight; offset eases back
predator stalking  → never nearer its prey than minGap = max(1.6·(Lp + Lq), 0.6·prey flight, 1.2) m
```
