# Ark sleep and rest (`ark-sleep`)

How sleep looks and behaves in the Ark. It's visual only: the server and ecology are unchanged. Everything that varies is seeded from ids and the shared world clock, so every viewer sees the same thing. The one exception is the local reactive layer near the camera (waking), which may differ a little between viewers, as all of `reactive.ts` does.

The shared schedule still decides who is asleep and where: `behaviour-schedule.ts` (its roost, its slot, the night watch) and `restingAtRoost`. This lane decides what that looks like.

## Files

| File | What it is |
|---|---|
| `src/ark-scene/sleep.ts` | Pure functions: the styles, the night's posture, lying down and getting up, the stirs, breath, sleeping together, the tap card's status, going into a den, `packSleep`. |
| `src/ark-scene/sleep.json` | The compact rows the scene reads (2,555 species): `posture\|other postures\|social\|flags (e eyelids, m mammal)\|breath`. |
| `data/ark/sleep-styles.json` | The full data, with every field's source: `{field: "sleep", phrase}`, `{recipe}` or `{rule}`. |
| `scripts/ark-sleep-styles.mts` | The generator. Its input is the behaviour lane's read-only species export (`sleep_pattern`, class, order, family). Run it as `npx tsx scripts/ark-sleep-styles.mts <export.json> [--audit out.tsv]`. |
| `src/lib/ark-rest-words.ts` | The tap card's words for a rest status. |
| `src/ark-scene/sleep-entry.ts`, `scripts/ark-sleep-clips.mjs` | The clip page and its recorder (development only). |
| `scripts/ark-sleep-bench.mts` | The CPU cost. |
| `src/lib/ark-sleep.test.ts` | The tests. |

## 1. Postures from stored data

Each species gets a posture from three sources, in this order, the strongest last:

1. **Taxon.** The family, then the order and body plan. The rule is the source.
   - Hoofed animals lie on their chests, legs folded.
   - Pigs lie on their sides.
   - Cats, foxes, rodents and small mammals curl.
   - Equids and elephants stand, and lie down some nights.
   - Birds sit or perch, head sunk or tucked.
   - Primates sit hunched.
   - Reptiles and amphibians lie flat.
   - Fish hang still in the water, or rest on the bottom when the profile says seabed or bottom.
   - Invertebrates keep still.
2. **The recipes lane's posture** (`recipes.json`: one_leg, tuck, hang, curl, float, stand, huddle).
3. **The species' own sleep text**, clause by clause: only clauses about rest, never about feeding or breeding. The text has to fit the animal (a fish can't stand). Negations ("rather than resting on the bottom") and larval clauses ("Caterpillars rest coiled") don't count.

For example, "rest standing in tight huddles" gives stand + huddle (emperor penguin). "Stretched on its side" gives side (domestic rabbits). "Mostly standing, sometimes lying on its side" gives stand, with side on some nights (Sri Lankan elephant).

**Counts (2,555 species):**

| Posture | Species |
|---|---|
| tuck | 621 |
| still | 581 |
| curl | 354 |
| flat | 236 |
| hover | 230 |
| sternal | 196 |
| side | 94 |
| sit | 75 |
| bottom | 72 |
| one_leg | 49 |
| stand | 23 |
| hang | 22 |
| float_back | 1 |
| bottle | 1 |

- 77 postures come from the species' own text, and 860 from the recipes lane.
- I read every text-derived row and every social row by hand (the audit TSV), and fixed the rules: negations, larval clauses, "tail coiled", and birds that "huddle on a branch" sitting in a row instead.

**Some nights, another posture.** A species may have other postures. On a given night an animal takes its usual one with 60% chance, and otherwise one of the others, seeded by its id and the 6-hour bout. A pride lies sprawled on its sides, on its chests and curled. A zebra herd stands most nights.

**Eyelids.** Mammals, birds, turtles, crocodilians, lizards with lids and frogs have them. Fish, snakes, geckos and invertebrates don't. (The goldfish's own text: "it has no eyelids, so the eyes stay open".)

**Procedural, until the rig's clips play.** These are `POSTURE_SPECS`, drawn in `index.ts` before the instance matrix, the same at every level of detail:

- **The body is lowered** until its torso (the box above the legs' share of the height) meets the ground at its roll (`lyingDrop`). The legs go under it, out of sight.
- **It rolls onto a side** for side-lying: a seeded side each night.
- **Its nose dips** for a primate's hunch, and so on.
- **The spine bends round in the vertex shader** for a curl (an arc, head and tail coming together; near only). The rig gets the same bend.
- **The head goes through the look attribute**, within the plan's head limits and allowing for the material's droop:
  - back to the flank, or chin down, or head up, for sternal;
  - turned back onto the back, or sunk, for a bird.

**Water postures.**

- **bottom:** the fish settles to the floor.
- **hover:** still, a little nose down. The loop is already slowed asleep.
- **bottle:** upright.
- **float_back:** the recipes lane's roll, now eased in and out.

**Rig v6 clips win when present.** The rig player's base-pose machine on the release (`baseStep`: `lie_down`, `get_up`, `get_up_fast`, `side_down`, `side_up`) plays the sleep clips (contract 8.2). This lane changes three things about it:

- The night's posture asks for its own clip first (`sleepPostureClips`): side → `sleep_side`; curl → `sleep_curl`; stand → `sleep_stand`; one_leg → `sleep_one_leg`; tuck → `sleep_tuck`; hang → `sleep_hang`; float_back → `sleep_float`; sternal, sit and flat → `sleep` (flat also `bask`). After that come the rig player's own choices.
- The rig sleeps only while `sleepNow.down`, so an animal woken locally gets up through `get_up_fast`, because the reactive action is urgent.
- While a sleep or lying clip plays (`entry.sleepClipped`), the procedural body, head, curl and breath give way to it in proportion to the rig's weight. The clips breathe themselves (`breath_hz`).
- The eyes stay this lane's: the clips have no lids.

## 2. Lying down and getting up (no pops)

- `stepSleepNow` moves `t` (0 up … 1 asleep) at a constant rate: it lies down in 1.1–3.5 s by size and gets up in three quarters of that, or 0.35 s when startled.
- The stages are smoothsteps within `t`, all continuous:
  - the body goes down first (0–0.7);
  - the roll and curl follow (0.25–1);
  - then the head (0.35–0.95);
  - the eyes shut last (0.75–1).

  Getting up runs them back: the eyes open first and the body comes up last.
- **No lying down on load.** An animal that is asleep the first time it is stepped (the page opening at night, or a schedule that was still building) starts lying.
- **Attitudes ease too.** The recipes lane's sleep attitudes (a bat turned over, an otter on its back) used to snap on. They now ease in with the roll stage, and back out as the animal wakes: the attitude is kept from its last sleeping frame.
- **Tests:** the largest change of any stage in one frame stays inside its rate, at 60 and 12 fps, through down, half-up, down again and a startled get-up. The stage order is tested too.

## 3. Closed eyes

The packed sleep value `arkInstance.w` (`packSleep`) carries `eyes shut 0…1`.

- **A packed component, not a new attribute.** A new attribute pushed a rigged fur-shell program past the GPU's attribute slots ("Too many attributes"), so the value rides in the instance attribute.
- **Lids cover the painted eye.** In `animal-look-shader.ts`, lids cover an almond round each eye in the rest pose (×4.2 the eyeball's radius along the head, ×2.7 up and down). The painted eye is much larger than the eyeball's dome, which first covered only the pupil (checked with a red overlay).
- **Lid colour and seam.** The lid is the skin round the eye: the texture read from a coarse mip. A darker seam runs across the middle where the lids meet.
- **What goes with the open eye:** its gloss, dome and catchlight.
- **Far models too.** Asleep herd figures shut their eyes as well.

## 4. Breath and stirs

- **Breath.** The chest rises and falls on the shared shader clock at the species' rate: a mammal's by length, about 15 breaths a minute for a lion, 10 for an elephant and 50 for a mouse; ×1.25 for birds, ×0.3 for reptiles; none through gills.
  - The movement is a bell along the body: 4.5% of height and 3% of width at full sleep.
  - Near only, rigs included, and not while a clip breathes.
- **Stirs** (`sleepStir`, shared): every 25–70 s of sleep it stirs for about 3 s.
  - The head lifts a little and the eyes half open, then it settles; or the tail flicks (in the shader's tail region).
  - Every stir settles it on a slightly new heading, eased and kept.

## 5. Sleeping together (schedule hooks in `behaviour-schedule.ts`)

- **Night watch.** At night one of the members, never the leader's empty turn, stands watch for `NIGHT_WATCH_SLOTS` = 4 slots (about five minutes). The guard changes visibly: one gets up, another lies down.
  - Before this change, one slot in every group-size had nobody up.
  - The watch is awake with full senses (the reactive layer's alarm).
- **Huddles and piles touch** (`sleepSpacing` 0.45 of the usual spread): pigs "lying close together", emperor penguins, macaques, marmosets and banded mongooses (in their den).
  - A young mammal sleeps against the adult its group keeps to: puppies, foals, cubs.
  - Near the camera, `keepApart` lets such sleepers touch.
- **Rows on a raised perch** (fairywrens, white-eyes, laughingthrushes, macaws): members sit side by side along the leader's limb (`roostOffset`, along the attach point's heading).
  - Bats with colonies in their text cluster at the leader's hang point.
  - Flocking species whose text says they sleep together roost as a group too.
  - The European bee-eater's text says rows, but it is a pair species (the scene doesn't group pairs), so it doesn't show yet.
- **Data only.** No rule goes past the stored text and the taxon. Meerkats sleep underground (their text), so no visible huddle.

## 6. Waking (`reactive.ts`, kept small)

- **Asleep it perceives less:** sight ×0.12 (eyes shut: movement within a few body lengths), hearing ×0.4, smell as awake. It checks on its own perception frames.
- **It wakes with a start** (`woke`, `startled`) at:
  - a threat it perceives inside its flight distance;
  - an alarm call it hears through its dulled hearing (its own kind's, or another's about a threat that eats it too);
  - its group running past;
  - the camera walking at it (closing at 0.6–6 m/s) inside half its flight distance. A deer wakes before a lion.
- **What never wakes it:** a still camera, a camera cut (a jump faster than 25 m/s resets the camera's velocity), and the camera flying to the animal the viewer selected or follows (`watched`).
- **Woken, it is awake here.** It reacts like any awake animal (alert, flee, watch the camera) and counts as a threat again if it hunts. The scene gets it up (`rest` → 0, `sleepNow.down` false, a quick get-up), and after 18–32 s of calm it lies down again.

## 7. The tap card

- **The scene tells the page how the selected animal rests** (`onRest`, `handle.rest(id)`, `restStatus`): asleep in its den or burrow, on its perch, hanging upside down, on its feet, on one leg, in the water, or huddled with its group; resting, resting in its den, dozing in the sun, basking, or keeping watch.
- **Card states.** On `ark-sleep` the status replaces the "Asleep now" chip (night blue while asleep). The words are `life.rest.*` in all 45 Ark languages.
- **With `ark-thrive-web`.** Its "Right now" row (`life.now`) shows the status before the condition: "Asleep in its den · Well-fed". This lands with the release merge (see the report).
- **Going into a den.** A den, burrow or cave animal whose roost is a way in (`goesIntoRoost`: `burrow:`, `burrow_entrance:` or `cave_mouth:` ids) goes down into it once settled, to sleep or rest, over 1.6 s, and comes out as it sets off.
  - It is drawn no more once it is in.
  - Looked at or followed, it stays half in at the way in.

## 8. Clips (development)

```
node scripts/ark-sleep-clips.mjs --out <dir> --clips night,den [--at 80,200 --scale 3 --compare-eyes]
```

- **night:** the grassland at 01:30. A Grevy's zebra herd asleep on its feet with one on watch, blue wildebeest lying, a pride of lions, and superb starlings. Then the camera walks at a sleeping wildebeest and it wakes.
- **den:** a pair of bat-eared foxes walk back to their burrow at dawn and go in.
- **lab and eyes:** lions asleep at midday close up. `--compare-eyes` draws each still again with the eyes open.

## Cost

See `scripts/ark-sleep-bench.mts` and the report's numbers.

- Asleep animals cost the reactive layer less than awake ones: no needs, choices, look or full perception, only the wake check.
- Animals gone into their dens aren't drawn.
- The sleep layer's own work is a few microseconds per animal per frame.
- On the GPU, the curl, breath and stirs are near only. The lid code runs only on shut eyes.
