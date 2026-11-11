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

What `perceive()` does with those ranges each time it looks:

| Sense | Range in the moment |
|---|---|
| Sight | sight × night factor × fog × how conspicuous the other is × 1.6 if this one is the sentinel on watch. **Night factor:** `1 − night·(1 − its night vision)`. **Fog:** `1 − 0.6·fog`. **Conspicuous:** moving 1.25 or still 0.7, times `(0.7 + 0.15·min(length, 3))`, times 1.8 if the other is aloft (a silhouette against the sky). It looks for others out to `2.6 × sight` (× 1.6 on watch), within the tier's reach. It only sees inside its field of view: about ±155° for prey and ±92° for a hunter. It also needs a clear line through the terrain and vegetation (`reactive-world.ts`, clear above 0.45) |
| Hearing | hearing × loudness × `(1 − 0.5·rain)` × `(1 − 0.3·wind)`. **Loudness:** a moving walker (quadruped, primate, walking or flightless bird) 1; anything else moving 0.6; either way times `(1 + 0.2·min(length, 3))`. A still animal 0.25 |
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

- **Alarm calls.** When an animal that calls (stored alarm calls, a sentinel, or a group-living default) notices the predator, it calls. The call reaches its own kind within `hearing × 1.6 × (1 − 0.4·rain)`.
- **Eavesdropping.** Other group-living species react to the call only when the caller's threat could eat them too.
- **What a call does.** A listener runs when:
  - the threat is within 1.3 times its flight distance;
  - the threat is in the air (a raptor comes fast);
  - or one of its group is already running (contagious flight).

  An alarm about a threat further off on the ground only puts it on alert: head up, looking at the caller, then where the caller looked.
- **Delay.** A call is heard after `0.09 s/m × distance + 0.08 + up to 0.22 s`. Another species hears it 0.25 s later still, plus the listener's personality.
- **Silent spread.** One of its group running from a threat sets the others off `0.15 + 0.06 s/m × distance + up to 0.25 s` later.

## 3. When it moves off

**Notice delay.** Once perceived, the threat is noticed after:

```
max(0.05, fleeDelay · (1.2 − 0.5·learning) · (0.35 if on sentinel watch) − 0.12 · memory strength)
```

- `fleeDelay` is `0.35 + 0.25·boldness`, about 0.1 to 0.6 s (`ark-clock.ts` `animalPersonality`).
- A predator it remembers makes it quicker.

**After that**, in order:

1. **It looks first.** For `0.35 + 0.4·(1 − learning)` s it is `alert`: it turns its head to the threat and the body follows past the head's limit. On an alarm call it looks at the caller first, then where the caller looked.
2. **It plays dead** if it is a stored play-dead species and the threat is very close (under 0.4 × the flight distance).
3. **It freezes** if it is a freeze species, is standing still, and the threat isn't very close. This lasts 2.5 to 4.5 s, seeded.
4. **It withdraws** if its armour is its defence (armour listed first, or armour and a speed stat under 25: tortoises, armadillos, hedgehogs, snails), or if it is sessile (barnacles, limpets, sponges), and the threat is within its flight distance. It pulls in low and stays put.
5. **It flees** when the threat is inside its flight distance, or on an alarm as above. The flight distance is `flight × fleeDistance personality (0.65–1.35) × (1 + 0.25 per predator remembered, up to 2) × threatScale`. `threatScale` follows the evidence that flight distance grows with the predator's size and the directness of its approach (Stankowich & Blumstein 2005):
   - size factor: `1 + 0.25·log2(predator length / its length)`, clamped to 0.75–1.5;
   - times 1.3 if the predator is moving toward it (heading within 40°), 1.0 if moving past, 0.85 if still.
6. **It shows a threat display** if it is a threat species and the threat is very close.
7. **Otherwise it stays alert**, watching from where it is.

A parent with young near puts itself between them and the threat; the young keep behind the parent.

**Flight distance by plan and size** (from the generator, in scene metres):

- quadruped `3 + 0.12·size`;
- birds `2.5 + 0.1·size`;
- primate `3 + 0.08·size`;
- invertebrates `0.4 + 0.03·size`;
- everything else `1.5 + 0.06·size`.

Modifiers: stored shy or wary text gives ×1.4, stored curious or bold text ×0.7, and a hunter larger than 40 ×0.5.

## 4. Flee speed, reach and duration

| | Value | At a glance |
|---|---|---|
| Flee reach (the envelope when fleeing) | `clamp(3.5·L + 1.5, 2, 9)` m, L = drawn length | mouse 2.5, sparrow 2.8, rabbit 3.8, roe deer 6.1, red deer 7.6, elephant 9 |
| Calm reach (its own business) | `clamp(0.8·L + 0.4, 0.5, 2.5)` m | mouse 0.6, deer 1.8, elephant 2.5 |
| Flee speed (`fleeSpeed`) | `min(max(L, 0.3) · (1.5 + 4·speed/100) · clamp(1/√L, 0.8, 2.2), max(L, 0.3) · gait · 2.5, 8)` m/s: the speed stat in body lengths a second (small animals cover more of their own lengths), capped by the rig's fastest clip (§6.3.4) | Before the gait cap: mouse 1.4, sparrow 2.0, rabbit 2.6, roe deer 4.3, red deer 5.7, elephant 8. With today's gaits: red deer about 2.0, roe deer 1.9, elephant 0.7. A tortoise runs about half as fast as a deer of its length, and withdraws instead |
| Body turn while fleeing | up to ±1.2 rad off the shared yaw, at 6 rad/s eased | |
| The dash | reach / speed: about 1 to 2 s | |

**Duration**, as a timeline:

1. **Notice and look:** 0.05 to 0.7 s, then 0.35 to 0.75 s of looking.
2. **Dash** to the edge of the flee reach: 1 to 2 s. Running, its head looks where it runs, with a glance back at the threat every 2.2 s (seeded).
   - It then holds there while the threat stays in view: alert, freezing or withdrawn, it keeps the flee reach and never walks back toward the threat.
   - It runs again if the threat comes inside its flight distance.
3. **Drop the threat** 3 s after it last perceived it.
4. **Recover.** The alarm level stays at 1 for `0.4·C`, then falls to 0 over `0.6·C`, where `C = 12 s · (1.4 − 0.6·learning)`: 8.4 s for the sharpest, 16.8 s for the dullest.
   - During recovery it looks at where it saw the predator. The offset shrinks by 0.5% a frame, a half-life of about 4.6 s at 30 fps.
   - Afterwards it shrinks 2% a frame (half-life about 1.2 s), and calm business takes over.
5. **Avoid the spot.** For `20 + 40·learning` s it keeps away from where it saw the predator, pushed off by up to half its calm reach, and it reacts faster the next time.

**Never a jump.** When the envelope shrinks back from the flee reach to the calm reach, the offset comes back in at the animal's walk (`moveOffset`).

## 5. Where it flees to

It takes its first stored defence that has a refuge within 3 × the flee reach (`fleeDirection`). The refuges come from the graphics lane's attach points, via `reactive-world.ts`:

| Defence | Refuge | Species aboard |
|---|---|---|
| `flee_cover`, `burrow` | shade, a burrow entrance, reeds, a cave mouth or a rock face; else its remembered roost | 984 + 9 |
| `flee_water` | the water's edge, or the pond surface | 178 |
| `flee_tree` | bark or a branch | 252 |
| `group` | its group's centre (the herd bunches) | 864 |
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
4. **The animation follows the drawn speed.** `rigFor` measures the speed from the drawn position, offset included, so a flee plays the walk or run clip by speed.
   - **Agreed with behaviour:** the flee speed is capped at `gait × 2.5` (`GAIT_CADENCE`) body lengths a second, with `gait` from `behaviours.json` (`ReactiveInput.gait`, which the scene passes). That is the schedule's own cap, so the feet never slide.
   - With today's clips (median `gait` 0.41) a red deer runs at about 2 m/s, not 5.7. The cap rises by itself when the rig lane's run clips (stride v2) raise `gait`.
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
reacting/recovering → keeps the flee reach (holds its ground); calm → the calm reach, pulled in at its walk
sessile            → envelope 0 (never moved)
asleep             → no reaction; offset, head and turn only ease back
acting (server)    → zero output
aloft              → left to the flight; offset eases back
predator stalking  → never nearer its prey than minGap = max(1.6·(Lp + Lq), 0.6·prey flight, 1.2) m
```
