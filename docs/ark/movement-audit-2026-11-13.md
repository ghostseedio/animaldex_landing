# Ark movement audit (lane MA, 2026-11-13)

Owner, 2026-11-13: "an audit and check on the animal movements too, i think they're still lacking high quality locomotion
some animals especially birds, like coot or watever flying off the ground and ensuring wing animations are on point and
sometimes their beeks are warped and we need them to go into the water and change body position like ducks do properly"
(decision 271).

Audited on landing `ark-next` 2874e112 (branch `movement-audit`), the live rig set `ark-rig/v2` (identical to the local
`~/animaldex-talking-models/rig/publish-v2`), the real Ark (`/ark?snapshot=/ark-local/live.json&islands=/ark-local/islands-routing.json`,
world v2, islands mode). Nothing was uploaded, no API was called, no production row was written.

**The short answer.** The owner is right on all four counts, and most of it comes from five causes:

1. The schedule flies birds at their **walking pace times four**, so birds hang in the air flapping hard while drifting
   along at a twentieth to a third of their real speed. Ground birds are the worst: a coot flies at 0.40 m/s against a
   real 9 m/s. They rise almost straight up off the ground. This is "flying off the ground".
2. **Every bird that can fly has the same appetite for flying** (one line in the profile generator). A coot, a peafowl
   or a swan takes off as often as it forages: a coot 27 times an hour.
3. **Take-offs and landings have no physics.** A bird is at full speed from its first frame and stops dead at
   touchdown. It climbs at up to 78°, never runs across the water, and plays its landing clip after it has landed.
4. **The coot and 69 other swimming species aboard have no water band**, so on the water they take the ground branch
   and run on the surface.
5. **Bird bills are skinned to two bones.** The rigging pipeline splits every bill between the neck and the head (and puts
   the head's pivot on the bill), so any clip, look or head-bob that turns the neck against the head bends the bill.
   540 of 596 measurable birds warp by 5% of their bill length or more.

## How it was measured

| Tool | What it does | Where |
|---|---|---|
| Time budget (new, `scripts/ark-time-budget.mts`) | The pure behaviour schedule for every scheduled animal of a snapshot, sampled every 5 s through twelve 10-minute windows across a day. It counts air, water, land and raised time, take-offs, landings, water crossings, beats, and air-leg speed against L2's cruise speed. `--events <epoch> --species a,b` lists each animal's changes, for finding shots. | `npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-time-budget.mts public/ark-local/live.json [--islands public/ark-local/islands-routing.json] [--hours 10.5]` (about 65 s) |
| Beak audit | All 648 bird rigs: linear-blend skinning of the bill vertices in the head bone's frame, through every baked clip, under the look at its limits, and under the L1 head-bob. | `scratchpad/move-audit/beaks/audit.py`, `bob.py`, `results_beaks.csv`, `bob_*.csv`, check PNGs in `beaks/png/` |
| Clip coverage | Every flyer and swimmer rig's clips (flap, open-wing, takeoff, land, swim, paddle, upend, dive), the flight approval, and the water band per species aboard. | inline Python over `publish-v2`; `scratchpad/move-audit/noband.mts` |
| Recordings | `/ark?record=1` on the real snapshot. The director's clock runs at 1/30 s a frame and Date.now is made virtual (the schedule runs on Date.now, so a slow machine would otherwise speed the schedule past the frames). An in-page finder walks the subject's own trip legs to the next take-off, landing, water entry or swim. Every frame is traced: clip, phase, flying, pose, beat. | `scratchpad/move-audit/tools/record.mjs` (with two local, uncommitted camera hacks: a closer `meet` framing and the camera's minimum distance) |

Evidence (stills and clips) is in
`/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/move-audit/evidence/`.
Raw takes and per-frame traces are in `…/move-audit/rec1`, `rec2` and `rec3`.

**A trap for whoever records next:** `/ark?record=1` drives `performance.now` but not `Date.now`, and the schedule
(`worldMs`) reads `Date.now`. On a loaded machine, recorded animals therefore move many times faster than the frames
show. The recorder above freezes Date.now to the director's clock. The clip recorder (`scripts/ark-clips.mts`) has the
same exposure for anything moving on the schedule.

## The problems, worst first

Severity: **H** = most viewers see it within minutes; **M** = often, or obvious once seen; **L** = rare or subtle.
The lanes (MA1–MA4) are in the fix plan at the end.

### 1. Birds fly at a fraction of their real speed and rise almost vertically (H)

- **Measured.** Over 244 flying species on the wild island, the schedule's air legs run at a median 0.20 of L2's own
  cruise speed (`flightPaces`: 11.5·m^0.13). The 90th percentile is 0.33 and the best is 0.55.

  | Species | Flown at | L2 cruise | Ratio |
  |---|---|---|---|
  | eurasian-coot | 0.40 m/s | 9.0 | 0.045 |
  | domestic-pigeon | 0.27 m/s | 9.1 | 0.030 |
  | indian-peafowl | 0.92 m/s | 14.0 | 0.065 |
  | house-sparrow | 0.66 m/s | 6.6 | 0.10 |
  | mallard | 3.2 m/s | 11.1 | 0.29 |
  | mute-swan | 5.5 m/s | 14.8 | 0.37 |

  The wings beat at full rate, with take-off effort, the whole time.
- **In the scene.** Coot `00e58cf5` took off at 1794067318 (rec3 `coot-takeoff.json`). It went 0.27 m/s forward
  against 1.1–1.3 m/s up, a climb of about 78°: a helicopter lift-off. The coot's leg was 14.9 m in 34.5 s.
- **Cause (code).** `behaviour-schedule.ts` `tripAt`, `case "air"` (L1752), sets `const air = freeSpeed * 4`.
  `freeSpeed` comes from `freeBodyLengthsPerSecond` (`behaviour-profile.ts` L156), which is capped by the rig's
  ground-gait pace (`profile.gait × GAIT_CADENCE`). So a walking clip's pace sets the flight speed. The air leg's height
  (`legPose`, `case "air"`, L2068) climbs over 18% of the leg whatever the leg's speed, so a slow leg climbs steeply.
- **Fix (MA1).**
  - Fly air legs at the flyer's own cruise from `flightSpec(slug, length, plan)`: a burst out of a take-off, about 0.6
    of cruise for a hop under ~10 m.
  - Re-derive `reachOf` and `homeRadius` for flyers from the same pace.
  - Size the climb by a climb angle (about 15–30° for heavy birds, 45° for small birds), not by a share of the leg.
- **CI candidate.** The time budget's "air speed ÷ L2 cruise" median ≥ 0.6, and no species under 0.35. Climb angle out
  of a take-off ≤ 35° for birds over 1 kg.

### 2. Ground and water birds fly far too often: the owner's coot (H)

- **Measured** (time budget, real snapshot, wild island, whole day):

  | Species | Share of the day in the air | Take-offs per awake hour | Share on the water |
  |---|---|---|---|
  | eurasian-coot | 11% | 27 | 18% |
  | indian-peafowl | 10% | 34 | — |
  | domestic-pigeon | 10% | 23 | — |
  | eurasian-collared-dove | 9% | 29 | — |
  | greylag-goose | — | 21 | — |
  | black-swan | — | 15 | — |
  | canada-goose | — | 14 | — |
  | mute-swan | — | 9 | — |

  - The coot leaves the water only by flying: 21 take-offs from water, 0 walks out.
  - Real coots spend most of the day on the water and rarely fly by day. Peafowl fly up to roost. Swans and geese fly a
    few times a day.
  - Full table: `evidence/time-budget.txt`.
- **Cause (data).** `scripts/ark-behaviour-profiles.mts` L829: `if (all.has("fly")) add("fly", plan === "flying_insect" ? 0.6 : 0.5)`.
  Every species that can fly at all gets the same fly weight, 5/9, which is equal to its foraging weight. The `fly`
  doing then always takes an air trip (`behaviour-schedule.ts` L1387–1394), so about 22% of a coot's waking slots are
  flights.
- **Fix (MA3, the data owner).** A flight propensity by family and habit:
  - **Low** (fly about 0.02–0.08): Rallidae, Podicipedidae, Gaviidae, Phasianidae, Numididae, Odontophoridae,
    Megapodiidae, Meleagrididae, the ground pigeons, and the Anatidae (swans and geese lowest).
  - **High:** Hirundinidae, Apodidae, Laridae, Accipitridae, Falconidae.
  - The `rarely flies` text, which today only sets the move, also lowers the weight.
  - A waterbird's flights go water to water (`floats`) or water to its roost.
  - Regenerate `behaviours.json`.
- **CI candidate.** Time budget: for walk- or swim-primary birds, air share ≤ 2% and take-offs ≤ 3 per awake hour; the
  coot's water share ≥ 60%.

### 3. Take-offs and landings: instant speed, dead stops, no run-up, landing after touchdown (H)

- **Measured** (rec1 `swan-fly-enter.json`, the mute swan `f7b97a55`):
  - From standing it went to 3.9–4.75 m/s forward and 3.4 m/s up within one 0.2 s sample.
  - At touchdown it stopped from 4.75 m/s to 0 within one sample (about 2.4 g).
  - It was still **climbing** at +0.9 m/s when it touched down, onto a perch 6 m up in a conifer.
  - The take-off clip played for 0.30 s (`takeoff` 2.07 → `flap` 2.37), and the land clip started only after it had
    stopped (8.43 s).
  - The coot's landing (rec3 `coot-landing.json`): touchdown at 3.47 s, then **`run` and `walk` with zero speed for
    0.8 s** before its idle.
- **Causes (code).**
  - `legPose` `case "air"`: position along the route is linear in u, so the leg is at constant speed from frame one to
    the last, and the rise and fall are smoothsteps on a share of the leg.
  - `flight.ts` `flightRigFrame`: the take-off clip covers only `phase < 0.42` at rate 1.5.
  - `index.ts` L3436 `agl = where.base - max(heightAt, 0)`: the height is measured from the terrain, not from the
    surface it lands on (a perch, a rock top, the lake's level). So `landingNow`, the flare (`flareHeight`) and the
    land clip's height-driven phase never fire for perch, rock or water landings. They fall back to "no longer aloft",
    after touchdown.
  - The run in place after landing: `index.ts` L3401 eases `state.pace` from the flight speed, and `paceClip` (L3602)
    picks `run`.
- **Fix (MA1).**
  - Ramp the air leg's progress with an acceleration: take-off over about 1–2 body lengths for small birds; for heavy
    birds a run on the ground or water with flaps, lengthening with mass (swans and coots patter 5–30 m).
  - Glide in, flare, and come to a stop over about 1 body length. `locomotion/flee.ts` `rampedProgress` is the existing
    shape.
  - Measure `agl` from the leg's landing surface (`to.y`, the water's level from `water-level.ts`).
  - Reset `state.pace` when flight ends.
  - Let take-off play its full spring for heavy birds.
- **CI candidate.** Over the time budget's air legs: peak horizontal acceleration at the leg's ends ≤ 0.5 g; vertical
  speed at touchdown ≤ 0. In the rig trace, no ground clip at zero speed after a landing.

### 4. The coot (and 69 more swimming species) runs on the water (H for the coot, M overall)

- **Seen.** `evidence/01-coot-runs-on-water.jpg` and `.mp4` (coot `6bc5954b` on its swim leg at 1794067381): the
  coot stands on the lake surface, legs and lobed feet on top of the water, playing `run` (`base: stand`) for the whole
  swim.
- **Measured.** 70 species aboard that swim (159 animals) have no water band in their zone (`speciesDepth` → null), so
  they are never "in the water" to the rig player. Among them:
  - **Birds:** the coot, black-bellied and lesser whistling ducks, cape and hottentot teal, barnacle, bar-headed and
    red-breasted goose, cotton pygmy-goose, mottled duck, australian wood duck, domestic duck (15) and goose (13), the
    great cormorant, the australian pelican.
  - **Mammals and reptiles:** the otters, capybara, coypu, tapir, all the crocodilians, the freshwater turtles and
    terrapins.
  - Full list: `scratchpad/move-audit/noband.mts` output.
- **Cause (code + data).**
  - `index.ts` `rigFor`: the water branch is `entry.depth && !entry.visitor && where.water` (L3562). With no band the
    animal falls to the ground branch (`paceClip(walk, run, hop)`, L3602), and L1's legged driver plants its feet.
  - `sea-depth.ts`: the taxonomy rows cover Anatidae and Podicipedidae only where the table had them. The generator
    gave a row only to species then placed in water zones, so Rallidae, otters, crocodiles and the rest have none.
- **Fix (MA3).**
  - (a) Add bands: pond or sea surface `float` for Rallidae, Anatidae everywhere, Phalacrocoracidae and Pelecanidae
    afloat; `swim` with breaths for otters, crocodilians and turtles. Use taxonomy rules in the depth-bands generator,
    not per-species rows.
  - (b) A guard in `rigFor`: an animal whose pose is over water with no band floats, or paddles while it moves, and
    never walks or runs.
- **CI candidate.** "Swimming species aboard with no band" = 0 (today 70 species, 159 animals).

### 5. Bills bend and stretch: nearly every bird (H, close up)

- **Measured** (beak audit, 648 bird rigs, 596 with a valid bill selection; distortion = the bill's worst vertex
  displacement in the head bone's frame, as a share of bill length):

  | Threshold | Baked clips | Under the look (±110° yaw, pitch limits) |
  |---|---|---|
  | ≥ 5% | 540 | 555 |
  | ≥ 10% | 452 | 482 |
  | ≥ 20% | 275 | 282 |
  | ≥ 50% | 75 | 53 |

  - The worst clips are `plunge` (363 species), `sleep_tuck` (178), `upend`, `groom` and `dive`.
  - Reference birds, baked / look: coot 43 / 43%, brown pelican 45 / 44%, mallard 18 / 17%, golden eagle 13 / 17%,
    house sparrow 0 / 0%.
  - The worst species: galapagos hawk (its bill is 72% on the chest), magnificent bird-of-paradise, oriental honey
    buzzard, brown wood owl, loggerhead shrike: 1,113 down to 260%.
- **Under L1's walking head-bob** (θ = 0.4 rad; the driver pitches the neck +θ and the head −θ):
  - 47 of 134 head-bobbing birds warp ≥ 10% and 14 warp ≥ 20%.
  - wild turkey 54%, common wood pigeon 22%, killdeer 17%, coot 13%, chicken 12%.
  - Those whose bill is all on the head stay clean (grey heron 1%, domestic pigeon 2.5%).
- **Not scale or the head.** The head matrices are clean (column-norm deviation ≤ 0.0003). The neck bone **is** scaled
  in clips (determinant 0.85–1.45: `rig_v6.py` `head_pose` `nk.scale=(1, neck_k, 1)`; `rig_ark.py` L1746 in graze).
- **Cause (rig).** AnimalDex `origin/ark-rigging-v6:scripts/talking-models/rig/rig_ark.py`:
  1. **The head pivot** (L539–543) is placed 18% of body length behind the bill tip, on the bill base or on the bill
     itself. The skull sits behind the pivot inside the neck bone's top.
  2. **The weights** are Blender bone-heat (`heat_proxy` L704–778, `ARMATURE_AUTO`), copied by nearest-face, top-4
     (`write_weights` L794–807), so the skull and the bill base are shared between the neck and the head. The median
     head weight just behind the pivot is 0.36. `clean_weights` (L919–944) has leg and wing rules but no head rule.
     Only chain rigs force the head (`chain_weights` L841–847).
  3. **Mixed-weight vertices shear** whenever the neck and head turn differently: neck scale in clips, the look's
     0.6 / 0.4 split, and the head-bob's +θ / −θ.
- **Also found.**
  - 25 rigs with the head bone pointing backwards (`look.rest.head.axis` = [0, 0, −1]): pheasants, magpies, turkey,
    budgerigar, cormorant, sparrowhawk and others.
  - 18 with the pivot at the bill tip.
  - The water rail's mesh is a blob on a plane.
- **Fix (MA2, a re-rig plus a re-publish).**
  - Pivot at the occiput.
  - Every vertex ahead of it in the head capsule 100% on the head, blended over about 2% of L; zero chest and hips
    weight on the head.
  - No neck scale: a head translation instead.
  - Turn the 25 reversed heads round.
  - Re-run v5 skin plus the v6 clip merge for the 648 birds, publish `ark-rig/v3` (needs the owner's go for the
    upload), and move `ARK_RIG_VERSION` in `rig-clips.ts`.
  - Interim with no re-bake: rewrite only `WEIGHTS_0` (bone matrices don't depend on weights). This zeroes the bill
    warp, but not the skull or the 43 bad-pivot rigs, and it still needs a re-publish.
- **CI candidate** (rigging QA in AnimalDex): bill distortion ≥ 10% in baked clips, under the look and under the head-bob
  = 0 birds (today 452 / 482 / 47); head-axis-reversed rigs = 0.

### 6. Into and out of the water: the slide and haul-out clips are skipped (M)

- **Seen.** rec3 `goose-enter` (canada goose `6eadf33f`, enter leg at 1794067824):
  - Walking down the bank it plays `paddle` (paddling on land, y 0.54 → 0.08).
  - Through the 4 s `enter` leg it plays `paddle`.
  - `enter_water` plays for 0.13 s once it is already afloat.
- **Cause (code).** `index.ts` `rigFor`:
  - The schedule's beat (`enter_water` / `exit_water`, L3656) replaces `want` only when nothing else or the idle plays.
  - The water branch (L3562) has already set `paddle`, because `where.water` is true on the slide leg.
  - Paddle is chosen whenever the band is set, even on land.
- **Fix (MA3).**
  - On `enter` / `exit` legs, play `enter_water` / `exit_water` by the leg's progress (they are already in
    `PATH_CARRIED_CLIPS`) before the water branch.
  - Paddle only when afloat.
  - Ease the body's pitch and height from standing to floating over the slide (the "change body position" the owner
    asked for): nose down into the water, then settling to the float line.
  - The same for the seal's `haul_out` and the otter's `slip_in`, through the recipe states mapped in
    `RECIPE_CLIPS`.

### 7. Swans, geese and ducks perch in trees; grebes walk about on land; herons never wade (M)

- **Seen.** rec1: mute swan `f7b97a55` takes off from a forest floor far from water, flies 1–2 m up through the trees,
  and lands up in a conifer's crown at y 12 (`evidence/02-swan-takeoff-forest.jpg`, `03-swan-lands-in-conifer.jpg`).
- **Measured.**
  - In the profiles, mute swan, canada goose, mallard, great crested grebe and others have `perch` 0.44 with
    `perch_branch`.
  - Grebes spend 7–9% of the day on land and fly from land.
  - The grey heron and great egret are 0% in the water: no wading.
  - The bufflehead (a diving duck) gets `dabble`, not `surface_dive`. The coot gets no diving recipe at all.
- **Cause (data + code).**
  - The Anseriformes and Anatidae rows in `ark-behaviour-profiles.mts` (L359, L386) add perch.
  - The `fly` goal's `placeNear(... perchTags ...)` (`behaviour-schedule.ts` L1391) has no body-size check. Decision 79
    covered only the size-blind fallback.
- **Fix (MA3).**
  - Perching only for tree ducks (wood ducks, mandarin, muscovy, whistling ducks).
  - A perch's radius and height checked against body mass.
  - Grebes and loons ashore only to nest.
  - A wading goal (shallow water `stand` / `wade_spear`) for herons and egrets.
  - `surface_dive` for diving ducks (Aythya, Bucephala, Mergus) and coots.

### 8. Wings: flat cards, frozen wings in flight, wings hanging after landing (M)

- **The wings are flat cards.** Every v5 flyer opens a flat textured card per wing: no camber, no primaries, no
  thickness.
  - The flap clip is a symmetric cosine of that card about the shoulder, plus L2's procedural wrist fold on the upstroke.
  - From the side and from behind the wing reads as a sheet of paper (`evidence/02-swan-takeoff-forest.jpg`: the
    swan's wings as two upright white sheets; `04-coot-rig-flap-card-wings.jpg`).
  - The rigs' own previews also show **legs hanging down** in the flap. L2's `tuckLegs` swings them back 0.6 rad, but
    only for flap, glide and soar, and not in take-off or landing.
  - Rate by size and the display cap (decisions 109 and 110) are right and in CI. Banking is exact but timid on slow
    legs (decision 111 predicted this); problem 1 fixes it.
- **After landing** (L2's own review, `evidence/05-mallard-landing-L2-review.jpg`), a wing card hangs below the
  body for about a second, then both cards rise vertically over the back before folding. This is the `land` clip's
  end as baked.
- **Frozen wings.** 13 flight-approved birds have no flap and no open-wing clip, so they hold the take-off's last frame
  for the whole flight: great cormorant, brown pelican, buffy fish owl, tricolored heron, blue-rumped parrot, and 8
  more (5 aboard, 6 animals).
- **No take-off or landing clip:** 7, among them red-tailed hawk, one of `ARK_FLYERS`.
- **Not flight-approved, but flying on the schedule:** 11 (the barn owl, 3 aboard, 31 take-offs an hour; the spotted
  wood owl; the green-cheeked conure), so they fade out of their rig in the air.
- **No glide:** 60 walking birds (pigeons, chickens, pheasants, quail, swamphen: 244 animals), so they flap
  continuously. Fine for gamebirds; pigeons glide.
- **Fix (MA2, rig).**
  - Wing geometry with a cambered, tapered planform: at least a leading-edge thickness and a split primaries card, so
    the silhouette reads from every side.
  - Flap clips with the hand swept back and the wing partly folded on the upstroke in the bake itself, and a power
    stroke that sweeps forward and down.
  - Legs tucked or trailed in flap, glide, takeoff (after push-off) and land (until the reach).
  - A clean fold in `land`'s last third.
  - Flap, glide and land clips for the 13 + 7, and approval for the 11.
- **Fix (MA1, web).** `tuckLegs` in the take-off's second half.
- **CI candidate.** Flight-approved flyers with no flap or open-wing clip = 0; flyers on the schedule without approval = 0.

### 9. Floating posture: mostly right, but idle-standing on the water (L–M)

- **Seen.** Rec3 `goose-water` and `swan-water`: canada geese and mute swans afloat on the lake sit low and level and
  paddle while moving. They look right at a distance (`evidence/07-geese-swans-afloat.jpg`).
- `FLOAT_SINK` = 0.35 of the model's height is one number for everyone:
  - a swan's height includes its neck, so its body sits deeper than a duck's;
  - a grebe sits lower still, and when a grebe's band put it at y −0.2, the camera saw it from under the surface (rec3
    `grebe-water`, unclear: worth a look).
- At rest on the water every floater plays its **standing idle** under the surface, not a floating posture: legs
  straight down, the body's standing pitch. The tail is never up. Dabbling (`upend`) plays only when the floater is
  still (`rigFor`: a `loop` recipe replaces only the idle), so a drifting dabbler paddles instead.
- **Fix (MA3).**
  - A per-family float line: the body hull's share, not the whole height.
  - A `float` base pose: the v6 `paddle` held at phase 0, or the idle pitched to the water's level, tail up.
  - `upend` allowed while drifting.

### 10. Head-bob list matches by name (L)

- `gaits.ts` L145 `HEAD_BOB` matches substrings, so "crow" also matches "crowned". 18 non-bobbing birds bob as they
  walk: crowned eagle, turkey vulture, three crowned parrots, the motmot, the magpie-goose, the sandgrouse, the
  buttonquail and others.
- **Fix (MA4).** By family from the stored taxonomy, as decision 110 did for wing-beat factors: Columbidae,
  Phasianidae, Rallidae, Ardeidae, Threskiornithidae, Ciconiidae, Gruidae, Sturnidae, Corvidae, Motacillidae,
  Charadriidae.

### 11. Other body plans (brief; not re-recorded in this lane's time)

- **Quadrupeds.** L1's CI holds foot sliding to ≤ 2% of the leg on walk and spin, and it passes on `ark-next`. Nothing
  new was seen in the recordings.
  - Known: the backwards share (one zebra) and true-scale paces up to 1.6–1.8× on some walks (zebra, cheetah), from the
    default view's gate.
- **Seals.** They keep their baked flipper-legs clips (decision 145). On land they walk at about 2.5× the clip's pace
  (NEXT.md open issue). They have no `swim` clip, so in the water they play the v6 `paddle` by distance.
  - The belly-hump driver promised to L2 was never built.
  - The time budget shows harbour seals 49% in the water, with 17 entries and 21 exits a day; the haul-out is problem 6.
- **Penguins and seals** both lack `swim` (only `paddle` and `dive`): fine for porpoising if `paddle` is a swim stroke.
  Check the v6 bake.
- **Frogs.** The rigs have only `walk` and `paddle`, with no `hop` or `leap`, so L1's hop driver makes the hop. The
  clawed frog's `dive_in` still reads 3.67× (a 0.5 s leap drawn as walk steps; NEXT.md).
  - The bullfrog shot found no ground leg in 40 slots: it rests in its crevice.
- **Snakes, insects, primates, perching.** L2 and L3 metrics are in CI and pass: up-and-down swimmers breaking the
  surface 0, perched hidden 0, floating and sinking 0. Not re-audited.
  - The ant's legs sit oddly (rig) and insects slide a few millimetres (decision 120): known and accepted.
- **Sitting rigs** (54: meerkats, hares, squirrels) keep baked bounds (decision 122). Known.

### Already right (no change needed)

- Wing-beat rate by size and family, and the 10 Hz display cap (L2 CI: exponent −0.975).
- Bank angle physics.
- Upstroke span less than downstroke.
- Whales under the surface.
- Feet planted and IK on slopes.
- Gaits by Froude number.
- Floaters' heights on the lake.

## Metrics for CI (candidates)

| Metric | Today | Target | Where it runs |
|---|---|---|---|
| Air-leg speed ÷ L2 cruise, median over flying species (time budget) | 0.20 (coot 0.045) | ≥ 0.6, none < 0.35 | `scripts/ark-time-budget.mts` → `recordMotionMetric("MA", …)` |
| Air share of the day / take-offs per awake hour, walk- or swim-primary birds | coot 11% / 27, peafowl 10% / 34, greylag goose 2% / 21 | ≤ 2% / ≤ 3 | same |
| Water share of the coot and the grebes | 18% / 92% | ≥ 60% | same |
| Peak horizontal acceleration at an air leg's ends | unbounded (0 → cruise in one frame) | ≤ 0.5 g | same (add) |
| Swimming species aboard with no water band | 70 species / 159 animals | 0 | test over `speciesDepth` and the behaviour table |
| Flight-approved flyers with no flap or open-wing clip / no takeoff+land / flyers not approved | 13 / 7 / 11 | 0 | rig manifest check (AnimalDex rigging QA, or a landing test over `manifest.json`) |
| Bill distortion ≥ 10%: baked / look / head-bob | 452 / 482 / 47 birds | 0 | rigging QA (`beaks/audit.py`, `bob.py` into the pipeline) |
| Rigs with the head bone reversed | 25 | 0 | rigging QA |
| Ground clip at zero speed after a landing (rig trace) | coot 0.8 s | 0 | the recorder's trace |

The time budget is committed on this branch (`scripts/ark-time-budget.mts`) so lanes can measure before and after; it
does not register metrics yet.

## Fix plan: four lanes, file ownership

| Lane | Owns (files) | Problems | Order |
|---|---|---|---|
| **MA1: flight path, take-off and landing** (web) | `behaviour-schedule.ts` air legs (`tripAt` `case "air"`, `legPose` `case "air"`, `overSolids` timing, `reachOf` / `homeRadius` for flyers); `behaviour-profile.ts` `freeBodyLengthsPerSecond` for flyers; `locomotion/flight.ts` (agl, flare, take-off run); `index.ts` `rigFor` **flight block only** (L3405–3515: agl, landing trigger, pace reset); `l2-drivers.ts` `tuckLegs` | 1, 3, 8 (tuck in take-off) | First. It is most of "flying off the ground". |
| **MA2: rigs: bills, wings, flight clips** (AnimalDex rigging, read-only until the owner approves a v3 upload) | `scripts/talking-models/rig/rig_ark.py` (head pivot, `clean_weights` head rule, neck scale), `rig_v6.py` (`head_pose`), wing card geometry and the flap, land and takeoff bakes; `publish_rig.py --version v3`; then landing `rig-clips.ts` `ARK_RIG_VERSION` | 5, 8 | Parallel. Interim weights-only pass first (bill warp to 0), then the full re-rig. **The upload needs the owner.** |
| **MA3: waterbirds and swimmers in the water** (web + data) | `sea-depth.ts` and the depth-bands generator (bands for the 70); `scripts/ark-behaviour-profiles.mts` → `behaviours.json` (flight propensity, perch, grebes ashore, heron wading, recipes for diving ducks and coots); `index.ts` `rigFor` **water branch and beat order only** (L3562–3600, L3633–3660); `behaviour-schedule.ts` **perch goal** (`placeNear` size check, L1391); FLOAT_SINK per family | 2, 4, 6, 7, 9 | Parallel with MA1. `behaviours.json` is MA3's alone. MA1 must not edit it. |
| **MA4: other body plans + CI** (web) | `locomotion/gaits.ts` (HEAD_BOB by family), seals' belly-hump driver (`l2-drivers.ts` new driver: coordinate with MA1 on that file, or MA1 hands `tuckLegs` over first), frog hop/leap; `scripts/ark-time-budget.mts` → `recordMotionMetric`, `tests/ark-motion/metrics.json`, a test for "no swimmer without a band" and rig-manifest coverage | 10, 11, CI table | After MA1 and MA3 land their first numbers, so the CI limits are set on fixed code. |

**Shared-file rules.**

- `index.ts` `rigFor` is split by region: MA1 has the flight block, MA3 the water branch and the recipe/beat ordering.
- `behaviour-schedule.ts` is split by function: MA1 has air legs and reach, MA3 the perch goal and water edges.
- The integrator merges MA1 before MA3 when both touch the same file.
- The L1, L2 and L3 CI (`npx tsx scripts/ark-motion-ci.mts`), the spawn validator and the default view must stay
  green. MA1's speed change moves the default view's pace numbers for flyers, so re-baseline those deliberately.

**Order of value for the owner.**

1. MA1 problem 1 plus MA3 problem 2: coots stop helicoptering and stay on the water.
2. MA3 problem 4: no running on water.
3. MA2's weights-only bill fix.
4. MA1 problem 3: take-off and landing.
5. MA3 problems 6 and 9: the water entry and the float posture.
6. MA2's wing and clip re-bake.

## One-liners fixed in this lane

None. The cheapest candidate, `HEAD_BOB` by family, changes 18 species' gait and needs L1's metrics re-run, so it
stays with MA4.

## Limits of this audit

- Recordings cover the wild island only. 656 of about 800 birds aboard live in the town, which draws resting animals as
  static figures (decision 255) and floats its swimmers at their spot's surface (decision 167); the town was not
  recorded.
- Some takes framed poorly. In one case the camera did not follow the subject (`rec3/coot-takeoff`), and the otter's
  water entry was out of frame. The numbers come from the per-frame traces, which do not depend on framing.
- One possible state bug was not reproduced in a continuous run. After the finder's clock jumps, coot `00e58cf5` kept
  its `land` clip with `flying` true through the whole of its next flight (rec3 `coot-takeoff.json`): no take-off clip
  and no flap. The trigger is the `land` one-shot not reaching phase 1 when `agl` stays above 0.02, for example on a
  raised bank. Worth a test in MA1.
- Snakes, insects, primates and perching were not re-recorded. Their L1, L2 and L3 metrics are green in CI.
