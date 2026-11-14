# Ark intelligence: the 30-species review, the reactive layer measured, and `arkLook`

Lane `ark-intelligence-web` (landing). Everything here is visual only: the server decides every meal, birth and death. Nothing here deploys.

**Since then (the behaviours pass, 2026-11-14, lane B2):** what prey do about a predator was reworked (who is a threat by body mass, the response by what the predator is doing, the flight as a dash at the locomotion lane's pace with no `gait` cap, styles by rule, vigilance in groups). Where this review's reaction numbers and rules differ, `docs/ark/flee-envelope.md` and `docs/ark/behaviour-pass-2026-11/prey.md` are the ones that hold.

This document covers:

- **The 30-species review.** 30 species across every body plan, each intelligence profile read field by field against its stored text. Claude Code did the reading itself, with no API calls.
- **Problems (5) and (6).** The owner's "no head movement" and "prey ignore predators", measured on the reactive layer.
- **The recordings.** What the scenario recordings showed, and the fixes they led to.
- **Performance.**
- **`arkLook`.** The head-look contract for the rig player lane.

The flee envelope (detection, flight, speed, duration, refuges, and how the shared schedule yields) is in `docs/ark/flee-envelope.md`.

## 1. What changed in this pass

| Commit | Change |
|---|---|
| c0f5b0e4 | **Sentinel test (red before): the test was wrong, not the logic.** The test's raptor was the bateleur. The profile review in 209e2170 made the bateleur a carrion-first eater with no hunting default, so its only hunt is scavenge, and the reactive layer rightly doesn't treat a soaring scavenger as a threat. The test now uses the martial eagle: the meerkat's main aerial predator, with mongooses named in its stored diet, and a swooping profile. It also asserts that someone is on watch (before, that was an `if`). |
| 1e0b5ba5 | `docs/ark/flee-envelope.md`, for the behaviour lane. |
| 19e57ac7 | `scripts/ark-intelligence-encounters.mts`: problems (5) and (6) measured in node (§3). |
| 7b911cf6 | Flight distance scales with the threat: a bigger predator, or one coming at the prey, sets it off sooner; a still one, later (after Stankowich & Blumstein 2005). Flee speed comes from the speed stat, so a tortoise no longer dashes like a deer. Armoured animals withdraw instead of running. Sessile animals never move. |
| 55f75e13 | After running, prey hold their ground while the predator is still in view. Running, they look where they run, with a glance back now and then. |
| d692e15f | Sentinel, curious-camera and squirrel tuning (§4), plus a new `heads_closeup` scenario. |
| cd771596, dc775f20 | Profile rule fixes from this review (§2). |
| 8425b513 | Perception reaches as far as an animal could see a bird against the sky; the sentinel sees further still. |
| 4f87b2aa, f26cfa47 | An alarm about a far-off threat on the ground puts the herd on alert instead of sending it running. They run when the threat is within 1.3x their flight distance, when their group runs, or when it is a raptor. |
| 8da02b0b | Cost cut (§5). |
| e4b57211, 9b080199 | The sentinel sees all round. The live weather's fog, which the scene does not draw, no longer blinds the animals. A later alarm call no longer interrupts a reaction. |
| f14ade01, f9895ec9 | `look_probe` (forced `arkLook`), the rig state in the samples, and videos that keep the page's clock. |
| 6e28f828 | A water animal's offset keeps it in the water at its depth: the mirror of the land check (`offsetShare`), for the integrator. |
| 6753cb55 | Near a still camera, grazers glance up and get used to it in a few seconds; a camera walking at them gets their attention (§3.3), for the rig player lane. |
| 1f207ad4 | Composes with the behaviour lane's shared wariness. The flee speed is capped at the rig's `gait × 2.5` (agreed). The step waits for the sliced world sampler. `flee-envelope.md` matches behaviour 67d6ddf3. |

**The 08:02 wip snapshot** (`wip/ark-intelligence-web-2026-11-11`, ec320cc7) is fully superseded.

- It added the four profile files at an earlier state. 6b66ca52 committed the same profiles plus the plan column.
- 209e2170 then made deliberate review fixes over it: the Power-name filter, own chases only, chemical defence only as defence, no curiosity from observer advice, and apex hunters standing their ground.
- Nothing in it was lost. `scripts/ark-intelligence-reviewed.json` is identical.

## 2. The 30-species review

**Method.**

1. `review30.py` (handover folder) prints each profile with the phrase or rule behind every field. It was re-run on the data as it stands now; the draft had been printed before 209e2170's fixes.
2. Each field was read against the species' stored text and what is known of the animal.
3. Bugs in the generator's rules were fixed in the generator (`scripts/ark-intelligence-profiles.mts`), never by hand-editing data. The data was regenerated from the same inputs as 209e2170: `export.json` (06:29), and the traits lane's `food_links.json` and `traits.json` (handover folder `ark/`).
4. Before any change, the unchanged generator reproduced HEAD's outputs byte for byte.

**Rule fixes this pass** (cd771596, dc775f20):

| Rule | Was | Now | Species changed |
|---|---|---|---|
| Power name in a sentence | The whole sentence was dropped ("Nuts, seeds, cones … support Stashing because …"), losing the diet | Only the Power's clause is cut | red squirrel and others (fruit +1, seed_pick +3) |
| Freeze | Any "mimic", any "freezing", any camouflage | Keeping still as a defence. **Not:** mimicry of wasps or of sounds; ice or temperature; a hunter's camouflage ("camouflage-based ambush", "waits motionless for prey"). **Still counts:** crypsis (resembling a twig, leaf or seaweed; "ghost mimic") | 50 freezes removed. The marmosets' ("freeze … when a bird of prey passes") and the corn snake's are kept |
| Burrow sight (×0.5) | Any burrow-roosting digger | Only nocturnal or truly burrowing animals. A meerkat or a prairie dog keeps watch by eye | 59 species (meerkat 11 → 22 m) |
| Large hunter stands its ground | Not if carrion came first in its diet | Any large animal with a way of catching prey (a Komodo dragon). A vulture still doesn't | +1 |
| Sessile | "Flee to cover" by default | Closes up (armour), "other" plan only: the behaviour profile also calls the barnacle goose sessile, from its name | 15 |
| Cleaners | Got a "chase prey" hunting default | No hunting default | cleaner wrasse, cleaner goby |
| Aerial insect-eaters | Got a gleaning default | None: they feed on the wing (swifts, swallows, nightjars, bee-eaters) | 16 |

**Verdicts:**

- **Right:** 20, of which 2 carry a behaviour-lane data error.
- **Fixed this pass:** 7.
- **Right with one miss:** 1.
- **Partly:** 1.
- **Wrong because of behaviour-lane data:** 1.

| # | Species | Plan | Verdict |
|---|---|---|---|
| 1 | Red Deer | quadruped | Right |
| 2 | Eurasian Wolf | quadruped | Right |
| 3 | Meerkat | quadruped | Fixed (this pass) |
| 4 | Red Squirrel | quadruped | Fixed (this pass) |
| 5 | African Lion | quadruped | Right |
| 6 | Plains Zebra | quadruped | Right |
| 7 | Sea Otter | quadruped | Wrong: behaviour lane |
| 8 | Chimpanzee | primate | Right; social wrong in the behaviour profile |
| 9 | Common Raven | flying_bird | Right |
| 10 | New Caledonian Crow | flying_bird | Right, one miss |
| 11 | Barn Owl | flying_bird | Right |
| 12 | Common Swift | flying_bird | Fixed (this pass) |
| 13 | Cattle Egret | flying_bird | Right |
| 14 | Common Kingfisher | flying_bird | Right |
| 15 | Himalayan Snowcock | walking_bird | Right |
| 16 | King Penguin | flightless_bird | Right |
| 17 | Kuhl's Pipistrelle Bat | bat | Right |
| 18 | Komodo Dragon | lizard | Fixed (this pass) |
| 19 | Western Hognose Snake | legless | Right |
| 20 | Green Sea Turtle | turtle | Right |
| 21 | Cane Toad | amphibian | Right |
| 22 | Great White Shark | fish | Right; social wrong in the behaviour profile |
| 23 | Banded Archerfish | fish | Partly |
| 24 | Bluestreak Cleaner Wrasse | fish | Fixed (this pass) |
| 25 | Coconut Octopus | cephalopod_jelly | Right |
| 26 | Boxer Crab | crustacean | Right |
| 27 | Red Harvester Ant | insect | Right |
| 28 | Marmalade Hoverfly | flying_insect | Fixed (this pass) |
| 29 | Brown Recluse | arachnid | Right |
| 30 | Acorn Barnacle | other | Fixed (this pass) |

**Still open:**

- **Behaviour lane's data.** See §7.
- **In this generator, low impact.**
  - *Problem solving.* "In experiments" was dropped from the solver rule because it matched barnacle and wrasse experiments, and the New Caledonian crow lost its solver flag with it. The scene draws tools, not the solver flag.
  - *Archerfish.* Its spitting hunt has no style in the vocabulary.
  - *Archetype defaults.* The octopus's "pursuit" and the owl's gleaning are body-plan defaults; both are harmless in the scene.

The 30 entries are in the appendix.

## 3. The owner's problems (5) and (6), measured

**Method.**

- **Script:** `scripts/ark-intelligence-encounters.mts`. It runs the real `ReactiveLayer` in node, with no rendering, no network and no randomness.
- **Sample:** 299 prey species, a seeded sample stratified by body plan. Each meets a predator of its own zone that the food links say can eat it. Each species has its own id, and so its own seeded personality, as in the scene. (The first runs gave every prey one shared id; the "before" column was run that way.)
- **Encounters:** walking passes at closest distances of 2, 4, 6, 9, 13, 18 and 24 m, and the predator standing still at 4, 10 and 20 m.
- **Definitions** (the audit lane's, `ark-audit` `src/lib/ark-audit/metrics.ts`): an encounter is an awake predator on the ground within 25 m; a close one is under 6 m.
- **Reaction time:** counted from the start of the encounter. It is 0 when the prey already saw the predator coming from further than 25 m.

### 3.1 Problem (6): prey react to predators

**The owner's targets**, before this pass (209e2170 plus the sentinel fix) and after (6753cb55); high tier, open ground:

| Target | Before | After |
|---|---|---|
| Most encounters end in a look (> 50%) | 60.5% | **60.9%** |
| Most close ones end in a flee (> 50%) | 63.2% | **56.9%** (63.3% with any defence of its own: freezing, withdrawing, a display) |
| Median reaction under 3 s | 0.07 s | **0.1 s** (close ones 0.3 s) |

**The audit's trial number for comparison:** 3.5% of encounters with a look and 0 flights. That was measured on the shared layer alone, without the reactive layer, which only runs near the camera.

The phone tier (`--tier low`) gives the same three numbers: 60.9%, 56.9% and 0.1 s.

**This pass made the reactions right rather than more frequent:**

- A tortoise withdraws instead of dashing.
- A herd no longer walks back toward a lion still in view.
- An alarm about a lion 30 m off no longer sends the whole herd out of the frame.

**Why close flight fell from 63% to 57%.** Mostly the measurement: each species now has its own seeded personality, so the bold ones let a predator come closer, as in the scene. It is still above the target.

**By distance and by plan** (after):

| Group | Encounters | React | Close | Close: flee | Close: any defence | Median s to react |
|---|---|---|---|---|---|---|
| Walking past | 2,093 | 69.8% | 598 | 61.7% | 68.7% | 0 |
| Standing still | 897 | 40.0% | 299 | 47.2% | 52.5% | 0.23 |
| pass 2 m | 299 | 96.3% | 299 | 71.6% | 77.6% | 4.2 |
| pass 4 m | 299 | 87.6% | 299 | 51.8% | 59.9% | 2.5 |
| pass 9 m | 299 | 66.2% | – | – | – | 0 |
| pass 18 m | 299 | 51.8% | – | – | – | 0 |
| pass 24 m | 299 | 45.8% | – | – | – | 0 |
| quadruped | 560 | 86.3% | 168 | 94.6% | 95.2% | 0 |
| primate | 100 | 92.0% | 30 | 100% | 100% | 0 |
| flying_bird (on the ground) | 740 | 88.8% | 222 | 88.3% | 89.6% | 0 |
| walking / flightless bird | 110 | 93.6% | 33 | 97.0% | 97.0% | 0 |
| lizard | 140 | 50.0% | 42 | 31.0% | 47.6% | 11.0 |
| legless | 110 | 30.0% | 33 | 33.3% | 42.4% | 14.3 |
| turtle | 70 | 52.9% | 21 | 14.3% | 42.9% (they withdraw) | 10.9 |
| amphibian | 90 | 33.3% | 27 | 33.3% | 37.0% | 18.2 |
| fish | 360 | 45.6% | 108 | 45.4% | 57.4% | 9.4 |
| insect / flying insect / arachnid / crustacean | 600 | 10–34% | 180 | 0% | 0–29% | 20–26 |

**Reading it:**

- **Vertebrates that see far** (mammals, birds) react to nearly every encounter, mostly before the predator is within 25 m, and flee from nearly every close one.
- **Lizards, snakes, amphibians and fish** see 7 to 13 m, so they react later and closer. Their median reaction time is long only because the predator takes that long to walk in from 25 m; they react at about 6 to 12 m.
- **Invertebrates** see and hear 2 to 4 m and have flight distances of about 0.5 m. A 2 m pass is 10 of their body lengths, so most don't react. That is real behaviour, not a bug: the owner sees mammals and birds at viewing distance. The audit's fixed 6 m "close" was set for vertebrates.

### 3.2 Problem (5): heads turn

Same sample, 269 species with a head that turns (crabs, spiders, jellies and the "other" plan have none, by design in `head-look.ts`):

| Check | Result |
|---|---|
| Heads turn on their own when calm (no threat, camera 30 m off; turned over 10% of the time across more than 0.2 rad) | **81%** of species. The rest are fish (head yaw limit 0.12 rad) and some insects, by design |
| Look changes a minute (median) | 12. Grazers about 4 (head down, up to look round every 10 to 20 s); birds and primates 16 |
| Looks at the threat once it reacts | 76.1% of the frames after the first reaction, while the predator is within 25 m, have the head on it (88.1% before). The drop is on purpose: while running, the head looks ahead, with glances back |
| Looks at the camera within 6 m (still camera, 40 s) | **34%** of species glance at it (median 5% of the time), down from 47% of species and 32% of the time before the habituation (§3.3). The instinct band has no repertoire for it |

### 3.3 Grazers near the camera (from the rig player lane)

The rig player lane, which now draws the look and the watching state, found deer within 14 m of the camera spending much of their time watching it or backing off, so there was far less grazing where the owner looks. The fix (6753cb55):

- **Habituation per animal.** Near a still camera, it gets used to it in its own 3 to 7 s: half as long again for a shy one, and up to 2.5x as long for a very curious species (6e27fa92). It forgets over a minute away from the camera.
- **A first look.** On first noticing the camera, it looks up for 1 to 2.5 s.
- **Ignorers.** Some animals pay a still camera no attention at all: seeded, 25% plus 50% × (1 − the species' curiosity).
- **Investigating** is for curious species' bold animals only. Shy ones back off from a camera coming at them, until they are used to it.
- **An approaching camera** (closing faster than 0.3 m/s) renews everyone's attention.

Measured by `scripts/ark-intelligence-encounters.mts` (`nearCamera`): 60 grazer and browser species, alone, the camera at 5, 8, 11 and 14 m, 60 s each.

| Camera | Grazing | Watching or investigating | Backing off | Looking round, other |
|---|---|---|---|---|
| Still, within 14 m: before | 57.2% | 12.0% | 2.6% | 28.2% |
| Still, within 14 m: after | **69.0%** | **1.2%** | **0.1%** | 29.7% |
| Still at 5 m: before → after | 51.7% → 69.4% | 14.2% → 1.6% | 8.8% → 0.4% | |
| Walking in from 14 m to 5 m: before → after | 55.3% → 63.7% | 14.0% → 5.4% | 9.0% → 7.0% | |

The test "near a still camera grazers get used to it …" holds it.

### 3.4 Drawn, not just computed

The reactive layer only produces the angles. The animal material draws them on the near models, and on rigs through the `head` and `neck` bones (`arkLook`, §6).

- **The audit's "0 of 113" rigs that ever turn** was measured on ark-release, which didn't have the reactive layer (6b66ca52 onward).
- **Checked by eye in close-ups this pass.** `look_probe` forces `arkLook` on a rigged zebra (rig weight 1, idle clip). Yaw ±0.9 turns the head away from or toward the camera, pitch −0.5 lowers the nose, and +0.35 lifts the head (stills in §4).
- **In `heads_closeup`**, three zebras graze with their heads down, lift them as the lion appears 30+ m off, and follow it.

## 4. The recordings

**Method.** `node scripts/ark-intelligence-scenarios.mjs --out <dir> [--perf]` drives cached Chromium headless through each scenario on the v2 fixture with the scenario cast only.

- **Before** (the code at the start of this pass): `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-before/`.
- **After** (the full run at f9895ec9; the reruns are listed under "Final runs"): `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-last/`.

Each folder has an mp4, five stills and the sampled reactive state (json) per scenario. Copies of the key sheets are in `/Users/lennybeadle/animaldex-ark-handover-2026-11-11/intel-web/pass-2026-11-11/`, which outlasts the scratchpad.

I looked at every clip and still. What each scenario showed, and what was fixed:

| Scenario | Before | Fix | After |
|---|---|---|---|
| `predator_herd`: a lion walks past a zebra herd | The herd ran 7.4 m, then **walked back toward the lion** (from 7.4 m to 3.5 m in 2 s) while it was still in view, then ran again. Heads were held at the 57° limit toward the lion the whole run | Reacting and recovering animals keep the flee reach. Running, the head looks ahead, glancing back every 2.2 s (55f75e13) | The herd runs, holds off, and watches; it never comes back toward the lion. The reaction spreads over about 0.1 to 0.5 s (calls, then flight), not on one frame |
| `pack_hunt`: three wolves stalk a deer group | The deer alert as the wolves come in (2.3 s) and run when they get close (10.7 s). Two of the three wolves stalk; one plays first. They stop short (`minGap`) | – | Unchanged, and reads right |
| `squirrel_cache` | The squirrels were specks at 6 m, and the 20 s run ended before any return | Camera at 3.6 m; the run is 45 s | Each one buries food (moves off a step, head down), feeds, looks round, and **comes back to dig it up** after 20 s (`cache_return`). One investigates the camera between |
| `avoid_spot`: a lion stands 14 m off for 5 s, then leaves | The herd ran, then walked back toward the lion, as in `predator_herd` | Same fix | The herd keeps to the far side of where the lion stood, and stays watchful |
| `parents_shield` | The mare puts herself between the foal and the lion; the foal keeps behind her (`shield_young`, `hide_behind_parent`) | – | Unchanged. At the tap distance it is small: worth a closer camera in a later pass |
| `storm` | The herd goes to the shade of the tree and keeps low | – | Unchanged, and reads right |
| `curious_camera`: chimps, the camera arriving | Three of five chimps played non-stop. The curious one came only 1.6 m closer | Adults play in their own bouts (a seeded 45 s window). A curious animal comes up to 2.5x its calm reach (d692e15f). Then camera habituation (6753cb55, 6e27fa92), with the camera now walking in from 20 m to 7 m | As the camera arrives, every chimp looks up at it (1.7 to 2.6 s). The bold one walks up to it (3 to 10 s), two shy ones step back. By 11 to 14 s all are back to play and looking round (`/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-cam2/`) |
| `sentinel_raptor`: meerkats, and a martial eagle crossing at 10 m/s | The bateleur was never treated as a threat (the red test). With the martial eagle: no-one noticed it until 20 to 28 m, everyone at once, and the mob bunched in the open | Four changes: sky silhouettes are seen further, the sentinel sees all round at 1.6x, and an aerial threat sends them to cover (8425b513, e4b57211). The live weather's fog, which the scene doesn't draw, is no longer applied (9b080199) | **The sentinel alerts and calls with the eagle 62 m off; the mob is on alert 0.6 s later and runs.** A 3.6 s stall in one recording hid the run: the page hitched as the run clips loaded |
| `heads_closeup` (new): three zebras, and a lion walking past 18 m beyond them | The first version had every zebra running out of the frame on an alarm about a lion 34 m off | An alarm about a ground threat sends a listener running only within 1.3x its flight distance (4f87b2aa, f26cfa47) | **Heads come up from grazing (pitch −0.55 → 0) and turn to follow the lion (yaw to the 1.0 limit, then the body turns).** They hold, watching, and one runs only when the lion comes to about 20 m |
| `look_probe` (new): `arkLook` forced on one rigged zebra (rig weight 1, idle clip) | – | – | **The look is drawn on the rig:** yaw +0.9 turns the head away from the camera, yaw −0.9 toward it, pitch −0.5 puts the nose down, pitch +0.35 lifts the head. Stills: `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-probe/fr/shots-row.jpg` |

**Final runs.**

- `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-last/`: all nine scenarios plus `--perf`, at f9895ec9.
- `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-cam2/`: `curious_camera` after the habituation.
- `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-probe/`: `look_probe`, `sentinel_raptor` and `heads_closeup`.
- `/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/intelligence-web/scen-last/sheet-sentinel-heads.jpg`: the sentinel (top row, at 8, 10, 11 and 12.5 s) and the heads (bottom row, at 6, 9, 12 and 20 s).

**The videos' clock.** The mp4s from before f9895ec9 were written at the average frame rate, so the times in a note drifted by seconds in the video. For those, use the five stills (taken on the wall clock) or the json samples. From f9895ec9 on, the videos keep the page's clock, and `summary.json` gives each video's start offset.

## 5. Performance

**Budget.** On the phone tier (the phone proxy runs the low or medium tier), the reactive layer should take at most 1 ms a frame at p50 and 2 ms at p95, about a tenth of a 60 fps frame.

**In the scene.** `node scripts/ark-intelligence-scenarios.mjs --perf`, at f9895ec9:

- **Setup:** `predator_herd` with its 9 animals reacting.
- **Machine:** headless Chromium on this shared Mac, with about 17 other agents running.
- **Phone proxy:** 360×800, DPR 2, CPU throttled 4×.

| Device | Tier | Reactive layer ms (p50 / p95) | Frame interval ms (p50 / p95) | Scene frame ms |
|---|---|---|---|---|
| desktop | high | 0.2 / 0.4 | 16.7 / 33.3 | 3.6 |
| desktop | medium | 0.2 / 0.3 | 16.7 / 16.7 | 3.0 |
| desktop | low | 0.1 / 0.3 | 16.7 / 16.7 | 2.6 |
| phone proxy | high | 0.8 / 2.4 | 33.3 / 33.4 | 17.1 |
| phone proxy | medium | 0.7 / 1.9 | 16.7 / 16.7 | 11.8 |
| phone proxy | low | 0.7 / 1.6 | 16.7 / 16.7 | 10.1 |

**Phone tiers are within budget** (low and medium). The high tier on the phone proxy is held at 30 fps by the scene's own 17 ms frame, not by this layer.

**Worst case.** `npx tsx scripts/ark-reactive-bench.mts`: 130 animals packed round the camera, CPU time a frame, p50 / p95, with lines of sight, after 8da02b0b:

| Tier | Before (209e2170) | After |
|---|---|---|
| low (20 acting, within 32 m) | 0.37 / 1.75 ms | 0.32 / 0.60 ms |
| medium (48 within 50 m) | 0.90 / 5.42 ms | 0.85 / 1.68 ms |
| high (90 within 70 m) | 2.53 / 17.0 ms | 2.25 / 5.94 ms |

At the phone proxy's 4×, the low tier's worst case is about 1.3 / 2.4 ms. That is at the budget, with 20 animals all reacting within 32 m.

**What was cut:**

- **Sight lines spread out.** The p95 spikes were every pair's line of sight falling due on the same frame. Each pair now keeps its line for its own 0.5 to 1 s.
- **Terrain heights cached.** The noise terrain was sampled again for every line; heights are now cached per half-metre cell.
- **Wide lookups.** A sentinel's or a sky-watcher's wide look walks the occupied grid cells instead of up to 600 empty ones.
- **Fewer allocations.** Head limits are cached, and the memory arrays are no longer rebuilt every frame.

**Where it is spent now.** Perception (once every 2 to 4 frames per animal, staggered) and the calm choice are most of it. The next lever, if a tier needs it, is fewer agents: `REACTIVE_BUDGET`.

## 6. `arkLook`: the head look, for the rig player lane

Each near instance carries one `InstancedBufferAttribute` named `arkLook`, a `vec3`:

| Component | Meaning |
|---|---|
| `x` | **Head yaw**, in radians, relative to the body (after the body's own extra turn, `bodyYaw`). Positive turns the head toward the model's **+x**: a rotation about **+y**, with the model facing +z. |
| `y` | **Head pitch**, in radians. Positive lifts the nose (+y). |
| `z` | **Weight**, from 0 to 1: how much of the look to draw. It fades out as the animal falls asleep (`headWeight × (1 − rest)`); it is 0 for plans without a turning head, and on the far level. |

- **Limits.** The limits per plan (and the owl's wider ones) are already applied in `head-look.ts` before the values are written. A rig's own head-chain limits from the v2 manifest may only narrow them further.
- **Order.** Pitch first, then yaw, both about the neck joint. That is the shader's order in `animal-material.ts`.
- **Today in the shader:**
  - *Rigged mesh.* The vertices skinned to `head` (all of their weight) and `neck` (60% of their weight) turn about the neck joint, as the current clip poses it (`arkNeckBone`, `arkNeckPivot`, `arkHead`).
  - *Unrigged mesh.* The front of the body turns about a neck point, at 62% of the height and 30% of the body run back from the front.
- **Asked of the rig player lane** (step 5 of its list). When it turns the head bones per instance instead, it should:
  1. read the same three numbers and keep this shape;
  2. split the turn along the manifest's neck chain (for example 40% neck and 60% head);
  3. drop the shader's vertex turn for that mesh, so the head doesn't turn twice.
- **Shape is stable.** Any later change to the shape will be additive (a fourth value goes in a new attribute), so `arkLook` keeps its meaning.
- **`ReactiveOut`** (`reactive.ts`) also gives:
  - `action`, for clip choices: `flee` plays run or gallop, `sentinel` plays scan or upright, and `withdraw` and `freeze` play idle, low;
  - `crouch` (0 to 1), already applied as a small lowering of the body;
  - `looking`: an animal's id, `camera`, `sound`, `spot`, `ahead`, or null.

## 7. For other lanes

- **Behaviour (data in `data/ark/behaviour-profiles.json`):**
  - The sea otter has move `walk` with no `swim`, and diet `insects`. So it digs and flees to its den instead of diving and fleeing into the water.
  - The great white shark's social is `colony`.
  - The chimpanzee's social is empty: chimps live in communities.
  - The barnacle goose is `sessile`, from the word "barnacle" in its slug. The intelligence side guards against it, but the schedule may keep it still.
  - The common swift's diet is `filter` (reported before).
  - The flee-envelope items are agreed (§6.2 and §6.3 of `flee-envelope.md`, behaviour 67d6ddf3). The local layer composes with the shared wariness (`doing: "watch"`).
- **Rig player:**
  - `arkLook` (§6).
  - Play a run clip when the drawn speed (offset included) is a flee.
  - Play `scan` or upright for `sentinel`.
  - Play idle, low, for `withdraw`.
  - The flee speed is capped at `gait × 2.5` body lengths a second (agreed with behaviour), so the walk clip at speed does not slide. A run clip from the v5 rigs raises `gait`, and with it the cap.
  - Near a still camera, grazers now glance and go back to grazing (§3.3). `watch_camera` and `back_off_camera` are brief.
- **Graphics:** the scene draws no weather fog, so the reactive layer is passed fog 0 (9b080199). When fog is drawn, pass the drawn amount to `reactiveWeather.fog` in `index.ts` (one line), so animals see less only in a fog the viewer sees too.
- **Audit:**
  - The audit measures the shared layer, island-wide. The reactive layer only acts within the tier's radius of the camera, so the audit's problem 6 numbers can't see it.
  - `scripts/ark-intelligence-encounters.mts` uses the audit's own definitions (25 m, 6 m) on the reactive layer. Consider adding it to the audit's CI with the targets in §3.

## Appendix: the 30 profiles, with verdicts

Each entry lists every field with the stored phrase or rule that decided it. **default** marks a body-plan default, flagged in the profile's `defaults`.

#### 1. Red Deer (`red-deer`, quadruped)

- **Mind:** stat 44 (sharp), 7 kinds of behaviour; curiosity 0.55, play 0.49, learning 0.59; problem solving no
- **Senses:** sight 30 m, hearing 32 m, smell 28 m, night 67%, main sense hearing (rule: plan quadruped, size 58; night: rule: activity crepuscular)
- **Hunting:** —
- **Foraging:** graze ← “Outside the rut, hinds and stags graze in separate groups” (traits); browse ← rule: diet browser (behaviour profile)
- **Defence:** group ← rule: social group (behaviour profile); flee_open ← **default:** a large herd animal: runs in the open
- **Tools:** none (no stored mention)
- **Social:** alarm calls ← **default:** social group, plan quadruped: warns its group; many eyes (group-living)
- **Flight distance:** 10 m ← rule: plan quadruped, size 58
- **Food links:** eats —; is in deer, ungulates, small mammals, mammals, vertebrates
- **Defaults:** perception, flee, alarm
- **Verdict: Right.** Senses, grazing, running in the open with the herd and the alarm (red deer bark) all fit. Its defaults are flagged.

#### 2. Eurasian Wolf (`eurasian-wolf`, quadruped)

- **Mind:** stat 61 (brilliant), 9 kinds of behaviour; curiosity 0.76, play 0.68, learning 0.81; problem solving no
- **Senses:** sight 28 m, hearing 30 m, smell 26 m, night 67%, main sense hearing (rule: plan quadruped, size 46; night: rule: activity crepuscular)
- **Hunting:** pack ← rule: social pack (behaviour profile) and a meat or fish eater; scavenge ← “It also eats hares, beavers, carrion and unguarded livestock” (diet)
- **Foraging:** —
- **Defence:** flee_cover ← **default:** roost den: back to it
- **Tools:** none (no stored mention)
- **Social:** leader ← rule: social pack: the scene's leader and followers; many eyes (group-living)
- **Flight distance:** 4.3 m ← rule: plan quadruped, size 46
- **Food links:** eats beavers, rabbits/hares, livestock; by name: red-deer, reindeer, roe-deer, wild-boar; is in small mammals, mammals, vertebrates
- **Defaults:** perception, forage, flee
- **Verdict: Right.** Pack hunting with its prey named in its diet. "Back to its den" is a default and acceptable. Since 209e2170 it gets no warning-call default, because big hunters don't.

#### 3. Meerkat (`meerkat`, quadruped)

- **Mind:** stat 58 (sharp), 7 kinds of behaviour; curiosity 0.73, play 0.64, learning 0.77; problem solving no
- **Senses:** sight 22 m, hearing 24 m, smell 20 m, night 22%, main sense hearing (rule: plan quadruped, size 14; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** dig ← rule: digs soil (behaviour profile interaction)
- **Defence:** group ← “Burrow mob life: safety is organized around tunnels, calls, and group roles” (traits); flee_cover ← **default:** roost burrow: back to it
- **Tools:** none (no stored mention)
- **Social:** sentinel ← “Rotating sentries: individuals take watch while others forage” (traits); alarm calls ← “Meerkats use different alarm calls for different kinds of threats” (facts); many eyes (group-living)
- **Flight distance:** 4.7 m ← rule: plan quadruped, size 14
- **Food links:** eats insects, lizards, small mammals, spiders, scorpions; is in mongooses, small mammals, mammals, vertebrates
- **Defaults:** perception, flee
- **Verdict: Fixed (this pass).** The burrow rule had halved its sight to 11 m. A day-active sentinel keeps watch by eye, so it now has 22 m, and the one on watch sees 1.6x that. Sentinel duty and alarm calls come from stored text.

#### 4. Red Squirrel (`red-squirrel`, quadruped)

- **Mind:** stat 43 (sharp), 7 kinds of behaviour; curiosity 0.54, play 0.48, learning 0.72; problem solving no; learning: “Sharp memory tied to hidden stores” (traits)
- **Senses:** sight 21 m, hearing 23 m, smell 20 m, night 22%, main sense hearing (rule: plan quadruped, size 10; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** fruit ← “Nuts, seeds, cones, fungi, fruit, buds, and occasional eggs” (diet); seed_pick ← “Nuts, seeds, cones, fungi, fruit, buds, and occasional eggs” (diet); cache ← “Red Squirrels cache food so they can survive leaner seasons” (facts); browse ← rule: diet browser (behaviour profile)
- **Defence:** flee_tree ← **default:** roost tree: up its tree
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 4.2 m ← rule: plan quadruped, size 10
- **Food links:** eats —; is in squirrels, rodents, small mammals, mammals, vertebrates
- **Defaults:** perception, flee
- **Verdict: Fixed (this pass).** The Power-name filter had dropped its whole diet sentence ("... support Stashing because ..."), taking seeds and fruit with it. Now only that clause is cut. Caching comes from the facts and the hand-checked list; up its tree is the default.

#### 5. African Lion (`african-lion`, quadruped)

- **Mind:** stat 58 (sharp), 7 kinds of behaviour; curiosity 0.73, play 0.64, learning 0.77; problem solving no
- **Senses:** sight 30 m, hearing 33 m, smell 28 m, night 67%, main sense hearing (rule: plan quadruped, size 62; night: rule: activity crepuscular)
- **Hunting:** scavenge ← “Carnivorous, hunting ungulates and scavenging when opportunities arise” (diet); stalk ← **default:** Felidae: stalk and pounce; ambush ← **default:** Felidae: stalk and pounce
- **Foraging:** —
- **Defence:** group ← rule: social group (behaviour profile); threat ← **default:** a large hunter (size 62): stands its ground
- **Tools:** none (no stored mention)
- **Social:** many eyes (group-living)
- **Flight distance:** 5.2 m ← rule: plan quadruped, size 62
- **Food links:** eats ungulates; is in small mammals, mammals, vertebrates
- **Defaults:** perception, hunt, forage, flee
- **Verdict: Right.** It stands its ground (threat), which 209e2170 fixed (before, it fled up a tree). Stalk and ambush are the cat-family default, and it has no warning-call default. Not represented: pride hunting (the pack style only comes from social "pack"). Minor.

#### 6. Plains Zebra (`plains-zebra`, quadruped)

- **Mind:** stat 42 (sharp), 7 kinds of behaviour; curiosity 0.53, play 0.47, learning 0.56; problem solving no
- **Senses:** sight 29 m, hearing 31 m, smell 27 m, night 56%, main sense hearing (rule: plan quadruped, size 55; night: rule: activity any)
- **Hunting:** —
- **Foraging:** graze ← rule: diet grazer (behaviour profile)
- **Defence:** group ← “Group vigilance, kicks, running, and visual blending reduce danger” (predators); flee_open ← **default:** a large herd animal: runs in the open
- **Tools:** none (no stored mention)
- **Social:** alarm calls ← **default:** social herd, plan quadruped: warns its group; leader ← rule: social herd: the scene's leader and followers; many eyes (group-living)
- **Flight distance:** 9.6 m ← rule: plan quadruped, size 55
- **Food links:** eats —; is in zebras, ungulates, small mammals, mammals, vertebrates
- **Defaults:** perception, flee, alarm
- **Verdict: Right.** Since 209e2170 its curiosity no longer comes from the story's stripes, and its flight distance (9.6 m) comes from its size.

#### 7. Sea Otter (`sea-otter`, quadruped)

- **Mind:** stat 68 (brilliant), 9 kinds of behaviour; curiosity 0.85, play 0.76, learning 1; problem solving yes; learning: “Floating, cracking shells, dense fur, and kelp-forest feeding turn problem solving into daily survival” (spotlight); solver: “Floating, cracking shells, dense fur, and kelp-forest feeding turn problem solving into daily survival” (spotlight)
- **Senses:** sight 25 m, hearing 27 m, smell 23 m, night 22%, main sense hearing (rule: plan quadruped, size 32; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** dig ← **default:** diet insects, plan quadruped
- **Defence:** flee_cover ← **default:** roost den: back to it
- **Tools:** stones to break shellfish ← “Uses stones and other hard objects to break open shellfish” (traits)
- **Social:** —
- **Flight distance:** 6.8 m ← rule: plan quadruped, size 32
- **Food links:** eats invertebrates, crabs, snails/slugs, urchins, bivalves; is in small mammals, mammals, vertebrates
- **Defaults:** perception, forage, flee
- **Verdict: Wrong: behaviour lane.** Its foraging is "dig" (diet insects) and it flees to its den. It should dive for shellfish and flee into the water. The cause is its behaviour profile: move walk with no swim, diet insects. The tool (stones) is right.

#### 8. Chimpanzee (`chimpanzee`, primate)

- **Mind:** stat 96 (brilliant), 9 kinds of behaviour; curiosity 1, play 1, learning 1; problem solving no; learning: “Chimpanzees are diurnal, feeding and traveling by day before building tree nests each night with learned forest skill” (sleep)
- **Senses:** sight 48 m, hearing 26 m, smell 12 m, night 22%, main sense sight (rule: plan primate, size 48; sight: “sharp eyes, and a social mind to solve problems, share, and build tools in the forest” (story); night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** fruit ← “Fruit, leaves, seeds, termites, ants, meat, and nuts” (diet); seed_pick ← “Fruit, leaves, seeds, termites, ants, meat, and nuts” (diet); browse ← rule: diet browser (behaviour profile)
- **Defence:** flee_tree ← **default:** plan primate, climbs
- **Tools:** termite-fishing stems, nut-cracking hammers, leaf sponges ← “They make and use tools: stripped stems to fish termites from mounds, stone and wooden hammers to” (spotlight)
- **Social:** —
- **Flight distance:** 6.8 m ← rule: plan primate, size 48
- **Food links:** eats ants; by name: termite; is in primates, small mammals, mammals, vertebrates
- **Defaults:** flee
- **Verdict: Right; social wrong in the behaviour profile.** Tools, up a tree, sight 48 m. Social is "–" because the behaviour profile has it solitary, but chimps live in communities (behaviour lane). Problem solving reads "no": only its story says so, and the story isn't read for that. Tools cover it in the scene.

#### 9. Common Raven (`common-raven`, flying_bird)

- **Mind:** stat 92 (brilliant), 9 kinds of behaviour; curiosity 1, play 1, learning 1; problem solving yes; learning: “Common Ravens are among the most intelligent birds” (facts); solver: “Flexible intelligence: they solve problems across wild, mountain, coastal, and human-edge habitats” (traits); curious: “Ravens are active by day, often traveling, calling, caching, and investigating” (sleep); play: “They use varied calls, play behavior, and social learning” (facts)
- **Senses:** sight 35 m, hearing 21 m, smell 3 m, night 22%, main sense sight (rule: plan flying_bird, size 28; night: rule: activity diurnal)
- **Hunting:** scavenge ← “Carrion, insects, eggs, small animals, grains, fruit, and human scraps” (diet)
- **Foraging:** fruit ← “Carrion, insects, eggs, small animals, grains, fruit, and human scraps” (diet); cache ← “Food caching: ravens hide surplus meals for later use” (traits)
- **Defence:** fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 3.7 m ← “Ravens are active by day, often traveling, calling, caching, and investigating” (sleep)
- **Food links:** eats insects; is in songbirds, birds, vertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** Scavenging and caching, plus curiosity and play, from stored text; it flies off. 209e2170 removed the perch-and-wait default for a carrion eater.

#### 10. New Caledonian Crow (`new-caledonian-crow`, flying_bird)

- **Mind:** stat 84 (brilliant), 9 kinds of behaviour; curiosity 1, play 0.93, learning 1; problem solving no; learning: “it forages, crafts, and learns by day, resting in trees when tool use and visual searching stop” (sleep)
- **Senses:** sight 33 m, hearing 20 m, smell 2 m, night 22%, main sense sight (rule: plan flying_bird, size 18; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** glean ← **default:** diet insects, plan flying_bird
- **Defence:** fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** hooked twigs and leaf strips ← “It extracts hidden prey from dead wood and crevices using tools it makes, hooked twigs and stepped strips cut from pandanus leaves” (diet)
- **Social:** —
- **Flight distance:** 4.3 m ← rule: plan flying_bird, size 18
- **Food links:** eats insects, beetles, snails/slugs; is in songbirds, birds, vertebrates
- **Defaults:** perception, forage, flee
- **Verdict: Right, one miss.** Tools (hooked twigs, leaf strips) come from stored text. Problem solving was lost when "in experiments" left the solver rule (it matched barnacle and wrasse experiments). Low impact: the scene draws tools, not the solver flag. Curiosity no longer comes from the observer advice ("Explore ...").

#### 11. Barn Owl (`barn-owl`, flying_bird)

- **Mind:** stat 38 (practical), 5 kinds of behaviour; curiosity 0.48, play 0.42, learning 0.51; problem solving no
- **Senses:** sight 33 m, hearing 39 m, smell 2 m, night 89%, main sense hearing (rule: plan flying_bird, size 19; hearing: rule: Tytonidae: an owl's hearing; night: rule: activity nocturnal)
- **Hunting:** aerial_swoop ← “and talons show darkness becoming readable through sound” (spotlight)
- **Foraging:** glean ← **default:** diet insects, plan flying_bird
- **Defence:** fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 4.4 m ← rule: plan flying_bird, size 19
- **Food links:** eats birds, insects, mice, voles; is in birds, raptors, vertebrates
- **Defaults:** forage, flee
- **Verdict: Right.** Owl hearing (2x), night vision 89%, and the swoop. The gleaning default for insects is weak, since it mostly takes voles and mice, but it's harmless: only caching is drawn from the forage styles.

#### 12. Common Swift (`common-swift`, flying_bird)

- **Mind:** stat 38 (practical), 5 kinds of behaviour; curiosity 0.48, play 0.42, learning 0.51; problem solving no
- **Senses:** sight 31 m, hearing 18 m, smell 2 m, night 22%, main sense sight (rule: plan flying_bird, size 10; night: rule: activity diurnal)
- **Hunting:** aerial_hawk ← **default:** Apodidae: catches insects in the air
- **Foraging:** —
- **Defence:** group ← rule: social flock (behaviour profile); fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** alarm calls ← **default:** social flock, plan flying_bird: warns its group; leader ← rule: social flock: the scene's leader and followers; many eyes (group-living)
- **Flight distance:** 3.5 m ← rule: plan flying_bird, size 10
- **Food links:** eats insects, spiders; is in birds, vertebrates
- **Defaults:** perception, hunt, forage, flee, alarm
- **Verdict: Fixed (this pass).** It no longer gets a gleaning default (it feeds only on the wing); its hunt is aerial hawking. Still open: the behaviour profile tags its diet "filter" (behaviour lane, reported before).

#### 13. Cattle Egret (`cattle-egret`, flying_bird)

- **Mind:** stat 44 (sharp), 7 kinds of behaviour; curiosity 0.55, play 0.49, learning 0.59; problem solving no
- **Senses:** sight 35 m, hearing 21 m, smell 3 m, night 22%, main sense sight (rule: plan flying_bird, size 28; night: rule: activity diurnal)
- **Hunting:** stalk ← “short stalking steps, and quick strikes show how attention can turn another animal’s disturbance into your opening” (spotlight)
- **Foraging:** graze ← “Hoof-following foraging: it catches prey flushed by livestock or wild grazers” (traits)
- **Defence:** group ← rule: social colony (behaviour profile); fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** alarm calls ← **default:** social colony, plan flying_bird: warns its group; many eyes (group-living); mixed company (grazers) ← “Cattle Egrets often feed near cattle, horses, buffalo, or tractors” (facts)
- **Flight distance:** 5.3 m ← rule: plan flying_bird, size 28
- **Food links:** eats frogs/toads, lizards, beetles, flies, grasshoppers, ticks; is in waterbirds, birds, vertebrates
- **Defaults:** perception, flee, alarm
- **Verdict: Right.** Mixed company with grazers (it follows them), and stalking. "Graze" comes from the word "grazers" in "hoof-following", which is harmless.

#### 14. Common Kingfisher (`common-kingfisher`, flying_bird)

- **Mind:** stat 37 (practical), 5 kinds of behaviour; curiosity 0.46, play 0.41, learning 0.49; problem solving no
- **Senses:** sight 43 m, hearing 19 m, smell 2 m, night 22%, main sense sight (rule: plan flying_bird, size 12; sight: “sharp eyes, blue-orange body, and sudden dive show that clean action begins with patient observation” (spotlight); night: rule: activity diurnal)
- **Hunting:** perch_wait ← “The Common Kingfisher uses sharp eyes and a pointed bill to watch water from a branch before shooting down like a flash” (story)
- **Foraging:** fish ← “Sharp pointed bill for catching fish below the surface” (traits)
- **Defence:** fly_off ← **default:** plan flying_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 3.7 m ← rule: plan flying_bird, size 12
- **Food links:** eats frogs/toads, insects, fish, crustaceans; is in birds, vertebrates
- **Defaults:** flee
- **Verdict: Right.** Perch-and-wait fishing, and keen sight from stored text.

#### 15. Himalayan Snowcock (`himalayan-snowcock`, walking_bird)

- **Mind:** stat 40 (practical), 5 kinds of behaviour; curiosity 0.5, play 0.2, learning 0.53; problem solving no
- **Senses:** sight 31 m, hearing 19 m, smell 3 m, night 22%, main sense sight (rule: plan walking_bird, size 26; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** seed_pick ← “Snowcock feeds on grasses, shoots, seeds, bulbs, and alpine plant parts” (diet); graze ← rule: diet grazer (behaviour profile); browse ← rule: diet browser (behaviour profile); dig ← rule: digs soil (behaviour profile interaction)
- **Defence:** group ← rule: social flock (behaviour profile); fly_off ← **default:** plan walking_bird: takes to the air
- **Tools:** none (no stored mention)
- **Social:** sentinel ← “A bird on lookout gives an alarm call and the covey scatters” (predators); alarm calls ← “A bird on lookout gives an alarm call and the covey scatters” (predators); leader ← rule: social flock: the scene's leader and followers; many eyes (group-living)
- **Flight distance:** 5.1 m ← rule: plan walking_bird, size 26
- **Food links:** eats —; is in birds, vertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** Sentinel and alarm calls from one stored sentence ("A bird on lookout gives an alarm call and the covey scatters").

#### 16. King Penguin (`king-penguin`, flightless_bird)

- **Mind:** stat 44 (sharp), 7 kinds of behaviour; curiosity 0.55, play 0.22, learning 0.59; problem solving no
- **Senses:** sight 41 m, hearing 20 m, smell 4 m, night 22%, main sense sight (rule: plan flightless_bird, size 36; night: rule: activity diurnal)
- **Hunting:** pursuit ← “Powerful underwater pursuit diving for fish and squid” (traits)
- **Foraging:** fish ← rule: diet fish (behaviour profile)
- **Defence:** group ← rule: social colony (behaviour profile); flee_water ← **default:** plan flightless_bird, swims
- **Tools:** none (no stored mention)
- **Social:** many eyes (group-living)
- **Flight distance:** 6.1 m ← rule: plan flightless_bird, size 36
- **Food links:** eats fish, cephalopods; is in penguins, seabirds, birds, vertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** Pursuit diving, fleeing to the water, a colony.

#### 17. Kuhl's Pipistrelle Bat (`kuhls-pipistrelle-bat`, bat)

- **Mind:** stat 32 (practical), 5 kinds of behaviour; curiosity 0.4, play 0.36, learning 0.43; problem solving no
- **Senses:** sight 6 m, hearing 29 m, smell 7 m, night 89%, main sense hearing (rule: plan bat, size 4; night: rule: activity nocturnal)
- **Hunting:** aerial_hawk ← **default:** Vespertilionidae: catches insects in the air
- **Foraging:** —
- **Defence:** group ← rule: social colony (behaviour profile); fly_off ← **default:** plan bat: takes to the air
- **Tools:** none (no stored mention)
- **Social:** many eyes (group-living)
- **Flight distance:** 1.7 m ← rule: plan bat, size 4
- **Food links:** eats insects, flies, ants; is in bats, small mammals, mammals, vertebrates
- **Defaults:** perception, hunt, forage, flee
- **Verdict: Right.** Aerial hawking, hearing 29 m (echolocation), and no digging default since 209e2170.

#### 18. Komodo Dragon (`komodo-dragon`, lizard)

- **Mind:** stat 52 (sharp), 7 kinds of behaviour; curiosity 0.65, play 0.26, learning 0.69; problem solving no
- **Senses:** sight 17 m, hearing 9 m, smell 14 m, night 22%, main sense sight (rule: plan lizard, size 62; smell: “Long, yellow, deeply forked tongue flicks out constantly” (traits); night: rule: activity diurnal)
- **Hunting:** ambush ← “Camouflage-based ambush movement” (traits); scavenge ← “Carnivorous, feeding on carrion and live prey including deer, pigs, birds, and smaller dragons” (diet)
- **Foraging:** —
- **Defence:** threat ← **default:** a large hunter (size 62): stands its ground
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 2.6 m ← rule: plan lizard, size 62
- **Food links:** eats birds, deer, pigs; is in lizards, reptiles, vertebrates
- **Defaults:** forage, flee
- **Verdict: Fixed (this pass).** Freeze came from "camouflage-based ambush movement" (a hunter's camouflage), and as a carrion-first eater it fled to a crevice. Now it stands its ground. Smell from the forked tongue is right.

#### 19. Western Hognose Snake (`western-hognose-snake`, legless)

- **Mind:** stat 28 (practical), 5 kinds of behaviour; curiosity 0.35, play 0.14, learning 0.37; problem solving no
- **Senses:** sight 7 m, hearing 5 m, smell 11 m, night 22%, main sense smell (rule: plan legless, size 18; night: rule: activity diurnal)
- **Hunting:** ambush ← **default:** plan legless: wait for prey to come close
- **Foraging:** dig ← rule: digs soil (behaviour profile interaction)
- **Defence:** threat ← “Bluff, burrowing, and death-feigning reduce the need for real combat” (predators); play_dead ← “Western Hognose Snakes are famous for playing dead when threatened” (facts); flee_cover ← **default:** roost crevice: back to it
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 2.6 m ← rule: plan legless, size 18
- **Food links:** eats frogs/toads, lizards, amphibians, rodents; is in snakes, reptiles, vertebrates
- **Defaults:** perception, hunt, flee
- **Verdict: Right.** Threat display and playing dead, from stored text and the hand-checked list. Since 209e2170, "play" no longer comes from "playing dead", and pursuit no longer from "the chase is not worth it".

#### 20. Green Sea Turtle (`green-sea-turtle`, turtle)

- **Mind:** stat 32 (practical), 5 kinds of behaviour; curiosity 0.4, play 0.16, learning 0.43; problem solving no
- **Senses:** sight 14 m, hearing 6 m, smell 10 m, night 22%, main sense sight (rule: plan turtle, size 48; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** graze ← “Adults graze mainly on seagrasses and algae, cropping them with the finely serrated edge of the jaw” (diet)
- **Defence:** flee_water ← **default:** plan turtle, swims
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 4.4 m ← rule: plan turtle, size 48
- **Food links:** eats invertebrates, jellyfish; is in turtles, reptiles, vertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** It grazes seagrass and flees to the water.

#### 21. Cane Toad (`cane-toad`, amphibian)

- **Mind:** stat 36 (practical), 5 kinds of behaviour; curiosity 0.45, play 0.18, learning 0.48; problem solving no
- **Senses:** sight 8 m, hearing 8 m, smell 3 m, night 89%, main sense sight (rule: plan amphibian, size 12; night: rule: activity nocturnal)
- **Hunting:** ambush ← **default:** plan amphibian: wait for prey to come close
- **Foraging:** glean ← **default:** diet insects, plan amphibian
- **Defence:** chemical ← “Snakes, birds, mammals, crocodilians, and other predators may test it, but the toxin changes the bargain” (predators); flee_water ← **default:** plan amphibian, swims
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 2.2 m ← rule: plan amphibian, size 12
- **Food links:** eats insects, invertebrates; is in frogs/toads, amphibians, vertebrates
- **Defaults:** perception, hunt, forage, flee
- **Verdict: Right.** Chemical defence from the predators text. Fleeing to the water is a weak default for a mostly land toad, but harmless.

#### 22. Great White Shark (`great-white-shark`, fish)

- **Mind:** stat 48 (sharp), 7 kinds of behaviour; curiosity 0.6, play 0.24, learning 0.64; problem solving no
- **Senses:** sight 14 m, hearing 12 m, smell 12 m, night 67%, main sense sight (rule: plan fish, size 78; touch: “They use electroreception through jelly-filled pores on the snout to sense the weak electric fields of animals” (facts); night: rule: activity crepuscular)
- **Hunting:** scavenge ← “Feeds on fish, rays, seals, sea lions, carrion, and other marine prey depending on age and size” (diet); pursuit ← **default:** plan fish: chase prey
- **Foraging:** fish ← “Feeds on fish, rays, seals, sea lions, carrion, and other marine prey depending on age and size” (diet)
- **Defence:** group ← rule: social colony (behaviour profile); threat ← **default:** a large hunter (size 78): stands its ground
- **Tools:** none (no stored mention)
- **Social:** many eyes (group-living)
- **Flight distance:** 3.1 m ← rule: plan fish, size 78
- **Food links:** eats seals, fish; is in sharks, fish, vertebrates
- **Defaults:** hunt, flee
- **Verdict: Right; social wrong in the behaviour profile.** Hunting and standing its ground are right. "group ← social colony" is wrong: the behaviour profile has the great white as a colony (behaviour lane).

#### 23. Banded Archerfish (`banded-archerfish`, fish)

- **Mind:** stat 36 (practical), 5 kinds of behaviour; curiosity 0.45, play 0.18, learning 0.63; problem solving no; learning: “Their accuracy can improve with experience, and young fish learn partly by watching skilled shooters” (facts)
- **Senses:** sight 9 m, hearing 8 m, smell 8 m, night 22%, main sense sight (rule: plan fish, size 10; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** —
- **Defence:** flee_cover ← **default:** plan fish: into cover
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 2.1 m ← rule: plan fish, size 10
- **Food links:** eats insects, spiders, crustaceans; is in fish, vertebrates
- **Defaults:** perception, forage, flee
- **Verdict: Partly.** Its spitting hunt has no style in the vocabulary, so nothing is drawn for it. Fleeing to cover is right. 209e2170 removed the chemical defence that had come from "water squirt gun".

#### 24. Bluestreak Cleaner Wrasse (`bluestreak-cleaner-wrasse`, fish)

- **Mind:** stat 45 (sharp), 7 kinds of behaviour; curiosity 0.56, play 0.23, learning 0.6; problem solving no
- **Senses:** sight 9 m, hearing 8 m, smell 8 m, night 22%, main sense sight (rule: plan fish, size 9; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** fish ← rule: diet fish (behaviour profile)
- **Defence:** flee_cover ← **default:** roost crevice: back to it
- **Tools:** none (no stored mention)
- **Social:** cleaner ← “each cleaner ate on average about 1,200 parasites and inspected more than 2,000 client fish a day” (facts)
- **Flight distance:** 2 m ← rule: plan fish, size 9
- **Food links:** eats —; is in wrasses, fish, vertebrates
- **Defaults:** perception, flee
- **Verdict: Fixed (this pass).** No hunting default now: it picks parasites off its clients. Its cleaner role comes from stored text. Since 209e2170, problem solving no longer comes from "in experiments this touch lowered the clients' stress hormone".

#### 25. Coconut Octopus (`coconut-octopus`, cephalopod_jelly)

- **Mind:** stat 74 (brilliant), 9 kinds of behaviour; curiosity 0.93, play 0.37, learning 1; problem solving yes; learning: “Problem-solving behavior unusual enough to feel planned” (traits); solver: “Problem-solving behavior unusual enough to feel planned” (traits)
- **Senses:** sight 12 m, hearing 3 m, smell 5 m, night 22%, main sense sight (rule: plan cephalopod_jelly, size 12; night: rule: activity diurnal)
- **Hunting:** pursuit ← **default:** plan cephalopod_jelly: chase prey
- **Foraging:** fish ← rule: diet fish (behaviour profile)
- **Defence:** flee_cover ← **default:** plan cephalopod_jelly: into cover
- **Tools:** carries shells as a portable shelter ← “Use of coconut shells or bivalve shells as portable shelter” (traits)
- **Social:** —
- **Flight distance:** 2.2 m ← rule: plan cephalopod_jelly, size 12
- **Food links:** eats fish, crabs, bivalves, shrimp/krill; is in cephalopods, molluscs, invertebrates
- **Defaults:** perception, hunt, flee
- **Verdict: Right.** Shells as a portable shelter (hand-checked) and problem solving, both from stored text. The hunting default "pursuit" is a body-plan default; octopuses mostly pounce. Minor.

#### 26. Boxer Crab (`boxer-crab`, crustacean)

- **Mind:** stat 28 (practical), 5 kinds of behaviour; curiosity 0.35, play 0.14, learning 0.37; problem solving no
- **Senses:** sight 4 m, hearing 2 m, smell 6 m, night 89%, main sense smell (rule: plan crustacean, size 2; night: rule: activity nocturnal)
- **Hunting:** filter ← rule: diet filter (behaviour profile)
- **Foraging:** filter ← rule: diet filter (behaviour profile)
- **Defence:** flee_cover ← **default:** plan crustacean: into cover
- **Tools:** holds anemones in its claws ← “Small crab body that carries anemones in both claws” (traits)
- **Social:** anemone partner ← “Boxer Crabs are also called pom-pom crabs because of the anemones they hold” (facts)
- **Flight distance:** 0.5 m ← rule: plan crustacean, size 2
- **Food links:** eats —; is in crabs, crustaceans, arthropods, invertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** Anemones held in its claws (a tool and a partner), filter feeding, fleeing to cover.

#### 27. Red Harvester Ant (`red-harvester-ant`, insect)

- **Mind:** stat 20 (practical), 5 kinds of behaviour; curiosity 0.25, play 0.1, learning 0.27; problem solving no
- **Senses:** sight 3 m, hearing 2 m, smell 4 m, night 22%, main sense smell (rule: plan insect, size 1; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** seed_pick ← “Seeds of grasses and desert annuals make up almost all the food, carried home one at a time in the jaws” (diet); cache ← “Red Harvester Ants collect, sort, and store seeds using trails and organized labor” (spotlight); graze ← rule: diet grazer (behaviour profile)
- **Defence:** chemical ← “Workers defend the nest with a very painful sting, and entrances are plugged with soil in bad conditions” (predators); group ← rule: social colony (behaviour profile); flee_cover ← **default:** roost burrow: back to it
- **Tools:** none (no stored mention)
- **Social:** many eyes (group-living)
- **Flight distance:** 0.4 m ← rule: plan insect, size 1
- **Food links:** eats —; is in ants, insects, arthropods, invertebrates
- **Defaults:** perception, flee
- **Verdict: Right.** The colony stores seeds (cache), and the sting is its chemical defence. "Graze" comes from the behaviour profile's diet, which is harmless.

#### 28. Marmalade Hoverfly (`marmalade-hoverfly`, flying_insect)

- **Mind:** stat 10 (instinct), 3 kinds of behaviour; curiosity 0.13, play 0.05, learning 0.13; problem solving no
- **Senses:** sight 7 m, hearing 2 m, smell 6 m, night 22%, main sense sight (rule: plan flying_insect, size 3; night: rule: activity diurnal)
- **Hunting:** —
- **Foraging:** flower ← “Adults feed on nectar and pollen” (diet)
- **Defence:** fly_off ← **default:** plan flying_insect: takes to the air
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 0.5 m ← rule: plan flying_insect, size 3
- **Food links:** eats bugs; is in hoverflies, flies, insects, arthropods, invertebrates
- **Defaults:** perception, flee
- **Verdict: Fixed (this pass).** Freeze came from "wasp-like mimicry" (and then from "flower mimic"). A Batesian mimic doesn't keep still. It now has only fly_off.

#### 29. Brown Recluse (`brown-recluse`, arachnid)

- **Mind:** stat 20 (practical), 5 kinds of behaviour; curiosity 0.25, play 0.1, learning 0.27; problem solving no
- **Senses:** sight 2 m, hearing 3 m, smell 1 m, night 89%, main sense hearing (rule: plan arachnid, size 5; night: rule: activity nocturnal)
- **Hunting:** ambush ← **default:** plan arachnid: wait for prey to come close
- **Foraging:** —
- **Defence:** flee_cover ← **default:** roost crevice: back to it
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 0.6 m ← rule: plan arachnid, size 5
- **Food links:** eats arthropods, moths/butterflies, grasshoppers, cockroaches; by name: silverfish; is in spiders, arthropods, invertebrates
- **Defaults:** perception, hunt, forage, flee
- **Verdict: Right.** The ambush default (it hunts at night from its retreat) and back to its crevice.

#### 30. Acorn Barnacle (`acorn-barnacle`, other)

- **Mind:** stat 2 (instinct), 3 kinds of behaviour; curiosity 0.03, play 0.01, learning 0.1; problem solving no
- **Senses:** sight 0 m, hearing 0 m, smell 1 m, night 56%, main sense touch (rule: plan other, size 3; night: rule: activity any)
- **Hunting:** —
- **Foraging:** tide_pool ← “A crustacean that spends its adult life glued head-down inside a white cone of plates on intertidal rock” (spotlight)
- **Defence:** armour ← **default:** sessile: closes up where it is
- **Tools:** none (no stored mention)
- **Social:** —
- **Flight distance:** 0.5 m ← rule: plan other, size 3
- **Food links:** eats —; is in barnacles, crustaceans, arthropods, invertebrates
- **Defaults:** perception, flee
- **Verdict: Fixed (this pass).** Freeze came from "survive part of its body water freezing during winter" (ice, not a defence), and it was given "flee to cover". Now it closes up (armour, sessile), and the reactive layer never moves a sessile animal.
