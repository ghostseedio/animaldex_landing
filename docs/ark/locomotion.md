# Ark locomotion layer (motion 100x pass, lane L1)

The owner's complaint: "walking and flying look robotic and unnatural." This layer is the fix for **legged** animals
(brief §1). Lane L2 builds flight, swimming and legless motion on the same interface.

Code: `src/ark-scene/locomotion/`. Tests and CI: `src/lib/ark-locomotion.test.ts`, `.github/workflows/ark-locomotion.yml`.
Tools: `scripts/ark-loco-metrics.mts` (metrics before and after on the local rig set, and the CI fixtures),
`scripts/ark-loco-bench.mts` (CPU cost), and the course recordings in `scripts/ark-rig-scenes.mjs`
(`--query "cast=slug:plan,...&loco=0"`).

## 1. How it works

The rig player already plays every species' baked clips (bone matrices in a texture) on the GPU for the animals near
the camera: at most 24 animals and 12 species (8 and 4 in lite mode). Those clips are fixed loops: one walk, one
run (a trot), feet planted only at the clip's own pace, a stiff body, and turning on the spot like a statue.

Now every rigged animal is **posed on the CPU each frame**:

1. The baked frame is the base. `layer.ts` `bakedRow` blends it exactly as the shader would.
2. The first **driver** that takes the animal poses it in mesh space (`LocoDriver.pose`). The legged driver
   (`legged.ts`) takes any rig with two or more legs, on the ground, whose clip is `walk`, `run`, `hop` or `idle`. It
   starts from the rest pose and makes the whole gait itself.
3. Any other clip (graze, scan, call, groom, fight, `sleep_stand` and so on) plays as baked, with its **feet planted
   on the real ground** (`plantClipFeet`: each sole moved to the terrain under it, keeping however high the clip
   lifts it; the body lowered if a foot can't reach; IK).
4. Switching between a driver and a clip cross-fades over 0.25 s.
5. The pose is written to the species' **live pose texture** (`pose-texture.ts`, one row per instance). The shader
   (`animal-material.ts`, `ARK_RIG_LIVE`) reads that row when the instance's clip row is negative
   (`liveRowCode`). With the layer off (`globalThis.__arkLoco = false`), or past the texture's 32 rows, it plays the
   baked rows exactly as before.

**Visual only.** Positions come from the shared schedule as before; the layer never moves an animal. Its own state
(planted feet, springs, the body's turn) is per-frame smoothing. Fidgets come from the shared clock and the
animal's seed, so every viewer sees the same.

## 2. The legged driver

- **Gaits per body plan** (`gaits.ts`), chosen by the Froude number Fr = v²/(g·h). Animals of every size change gait
  at about the same Fr (Alexander and Jayes 1983).

  | Who | Gaits, slowest first (Fr where each starts) |
  |---|---|
  | Hoofed (deer, horses, zebras, cattle, goats…) | walk (lateral sequence), trot 0.5, canter 1.4, transverse gallop 2.6 |
  | Dogs, wolves, foxes, hyenas | walk, trot 0.45, rotary gallop 2.2 |
  | Cats | walk, trot 0.55, rotary gallop 1.6 (big spine flex) |
  | Giraffes, camels, llamas | walk, pace 0.4, rotary gallop 2.0 |
  | Bears, badgers | walk, pace 0.45, rotary gallop 1.5 |
  | Elephants | walk, amble 0.25 (never a gallop, no aerial phase) |
  | Small mammals (mice, squirrels, weasels, rabbits…) | walk, trot 0.35, half-bound 0.9, bound 2.4 |
  | Primates | diagonal-sequence walk, half-bound 0.8, bound 2.2 |
  | Lizards | sprawling walk (diagonal pairs, S-bend of the spine), sprawling run 0.35 |
  | Turtles | slow diagonal-sequence walk |
  | Frogs / toads | hop (hind feet together) / sprawling walk, hop 0.6 |
  | Birds | walk, run 0.55; hopping passerines hop; ducks and geese waddle, run 0.5; penguins waddle |
  | Insects | wave (slow), tripod (L1 R2 L3 against R1 L2 R3) |
  | Spiders, crabs | wave (back-to-front on each side, very slow), alternating tetrapod |

  Footfall offsets follow the classic tables (walk LH LF RH RF at quarters, trot diagonals, pace laterals, bound by
  pairs). Moving from one gait to the next eases the offsets over about a third of a second, with 20% hysteresis.
- **Stride and cadence.** Stride is λ = 2.3·h·Fr^0.3 (Alexander 1976) times the gait's own share, and cadence is
  speed / stride. Each foot's sweep is kept within what the rig's legs reach with the body lowered at most 8%; past
  that, cadence rises. Cadence is at most 14 Hz, and every swing lasts at least two frames, so legs never alias into
  a shimmer. For a sprawling leg, h is the leg's reach rather than its hip height. The stride is set by the
  **fastest hip** (the body's speed plus its turn), so the outside legs of a turn take longer steps.
- **Planted feet.** A foot lands where its hip will be over it at mid-stance (predicted from that hip's velocity),
  on the ground's height and slope. It stays locked there, keeping the heading it landed with, until it lifts.
  **Feet do not slide**, whatever the pace.
- **Turning by stepping.** The body turns at its own pace, at most about 0.4·√(g/h) rad/s standing (slower for big
  animals), and never more than 35° behind the drawn heading (the head's looks are measured from it). While it turns or drifts standing, the foot furthest
  from under its hip steps, aimed ahead of the turn. Two feet can step together (diagonals, or three of six), and a
  foot that can't be reached steps at once. A fidget step comes now and then.
- **Foot IK** (`ik.ts`): analytic two-bone IK. The knee bends toward its rest pole, carried with the body. The foot
  turns to the slope (a long flat foot, such as a duck's web, turns less), and its toe tips down in the swing. An
  upright foot (a bird's tarsus, a hoofed cannon) leans with the leg like a pendulum.
- **Body.** It crouches for reach and has a little give in legs that the rig fitted dead straight. It bobs with the
  feet (vaulting walks, bouncing runs, up in aerial phases), sways and rolls toward the supporting side (the pelvic
  list lowers the body as much as the roll lifts a hip), and rocks and flexes its spine in gallops and bounds. A
  lizard's spine makes an S. The body follows the slope fore and hind, and leans into turns and accelerations. Standing,
  the weight shifts slowly.
- **Head.** Predators and birds hold it steadiest (0.9), others less; it counters the body's rock, flex and roll and
  leads into turns. Hoofed animals nod with their forelegs at the walk. Head-bobbing birds (pigeons, chickens and
  other fowl, rails, herons, crows, starlings, plovers…) hold the head still in the air for 60% of each step, then
  thrust it forward.
- **Secondary motion** (`secondary.ts`): tails on damped springs (1/120 s fixed substeps, so the motion is the same
  at any frame rate). A tail swings out of a turn, sways against the hips, rides up at speed and lags the bob. The
  neck lags the bob on long necks.

## 3. Fast movement and flight from danger (for L7, `flee.ts`)

- `sprintPace({plan, slug, length, speedStat})`: top running speed in m/s from Hirt et al. 2017,
  v = 25.5·M^0.26·(1 − e^(−22·M^−0.6)) km/h. M comes from the length (L = 0.33·M^(1/3)), and the speed stat moves it
  ±30%. Plans have their own caps: insects, crabs, lizards, frogs, turtles, birds on foot, and penguins.
- `burstPace` (×1.08, a pounce or a dart) and `fleePace` (×0.65).
- `fleeAt(input, clock)`: a flee path as a pure function of the clock. Straight for big animals; a zigzag (25–45°
  cuts every 0.5–1.1 s) for mid-size prey; a dart (60–110° cuts and short freezes) for small ones. It speeds up over
  `accelTime(length)` and slows into tight cuts.
- `froudeAt` says which gait a speed reads as. `rampedProgress` gives the speed-up and slow-down shape for a
  schedule leg; the schedule's owner can adopt it.

The gait follows whatever speed the pose moves at, so a chase at sprint speed gallops or bounds without a new clip.

## 4. Metrics and CI

Measured from where the soles really are: the posed bones through the instance (`metrics.ts`), over scripted runs
(`sim.ts`): walk, trot, run, accel, turn, spin (turning half round on the spot), a 15° slope with a ridge, and smooth
steps. Speeds are by Froude number, capped at the species' top speed.

| Metric | Definition | CI threshold (visible legs) |
|---|---|---|
| Foot sliding | the drift of a planted foot from touch-down to lift-off, per step (mm, and as a share of the gait length) | ≤ 2% of the leg (walk, spin), 2.5% (run), 5% (slope) |
| Stride/speed mismatch | \|stride taken ÷ its time − body speed\| ÷ speed | ≤ 0.12 |
| Foot height error | a planted sole's distance from the ground (mm) | ≤ 1.5% of the leg (walk, spin), 2.5% (run, slope) |
| Joint limits | leg-frames with a knee folded past 20°, past straight, bent the wrong way, or a leg swung over 80° from rest | ≤ 2% (4% run, 3% slope) |

Insects, spiders and crabs are held to loose thresholds (§6).

Before (the baked clips played by distance, as the scene played them) and after, median over the vertebrates of the
20 golden species (planted-foot slide per step, mm):

| Scenario | Slide before → after | Worst before → after | Planted sole height, median before → after (mm) |
|---|---|---|---|
| walk | 19 → 0.05 | 2,160 → 3.2 | 1.2 → 0 |
| trot | 12.3 → 0.04 | 4,320 → 5.0 | 1.3 → 0.01 |
| run | 9.3 → 0.24 | 7,200 → 6.8 | 1.4 → 0.06 |
| speeding up and slowing down | 17.6 → 0.47 | 4,800 → 4.2 | 1.3 → 0.17 |
| a turning walk | 41 → 0.04 | 1,975 → 3.3 | 1.2 → 0 |
| turning half round on the spot | 622 → 0.26 | 2,959 → 3.2 | 0.9 → 0.03 |
| a 15° slope over a ridge | 1,200 → 4.0 | 5,795 → 33 | 80 → 1.2 |
| smooth steps | 62 → 1.1 | 1,379 → 4.8 | 12 → 0.4 |

(The worst before is the emperor penguin, which has no walk clip and glides along still.)

The numbers for every species and scenario are in
`~/animaldex-ark-handover-2026-11-11/ark/motion/L1/metrics/metrics-final.json`; the summary is in the lane's report.

## 5. Interface for the other lanes (`locomotion/index.ts`)

- `LocoDriver`, `registerLocoDriver(driver, first = true)`: L2's flight, swim and legless drivers are asked before
  the legged one. `LocoInput` carries the instance, scale, yaw, dt, the shared clock, the seed, the ground query,
  `grounded`, and the clip now, the clip fading out and its phase, plus the act's state and speed from L7.
- `LocoRig`: bones (parents, rest), legs (upper, lower, foot, the sole from the mesh), hips, chest, neck, head, tail,
  wings, chain, extents, leg height and gait length, `sitting`, and `missing` bones.
- `GaitState`: gait, phase, cadence, stride, duty, speed, acceleration, turn, Froude, and the feet in world space with
  whether each is planted. L3 can use the feet for its runtime checks.
- `setLocoGround(query)`: L3 and L6 can add rock tops, decks or logs to the ground the feet stand on (the default is
  the terrain on a cached 25 cm grid).

Hooks outside L1's files (small and named): `animal-material.ts` reads the live rows (`ARK_RIG_LIVE`). `index.ts`
passes `pose: rig.loco?.live.texture` to the rig material and calls `rigLivePose(...)` once per rigged instance after
its matrix is composed.

## 6. What the rigs don't have, and known limits

- **No ear, mane or trunk bones** in any rig. The v5 skeleton is hips, chest, neck, head, three-bone legs, three tail
  bones, and wings or a chain. Ears, manes and trunks can't move on their own: elephants' trunks and lions' manes ride
  on the head. `LocoRig.missing` lists them per rig. Necks have one bone, so they lag but don't curve.
- **Sitting rigs** (`pose` set: meerkats, hares, rabbits, kangaroos, squirrels, 54 species): their legs run through an
  upright trunk and can't step, so they keep their baked `bound` and idle.
- **Insects, spiders and crabs**: the rigger fitted their legs short and sometimes oddly placed (the ant's middle legs
  sit at its back), and at running speed their feet move faster than the frame rate can show. Their slides are a few
  millimetres and their front legs swing past 80°. That is out of sight at their size, so their CI thresholds are
  loose.
- **The mallard** and other ducks have legs dead straight at rest and long webbed feet. Running, they keep about 2% of
  slide; on slopes, 4%.
- **The body's own turn** means the drawn body can lag the schedule's heading by up to 35° in a fast turn on the
  spot. The position is unchanged; the body comes round within a second.
- **The emperor penguin** and the other turned birds are never rigged in the scene today. Their rig files are turned
  (`facing_deg`) but the live near models aren't yet (`publish_ark.py` waits for the release), so the rig player
  keeps them procedural. The penguin's skeleton is in the CI set; the recordings use the domestic pigeon instead.

## 7. Cost

The layer runs only for rigged animals: at most 24 on desktop tiers and 8 in lite mode.

- **CPU:** median time per animal per frame is 11–59 µs, about 35 µs typical (`scripts/ark-loco-bench.mts`, Node on
  the shared M3 under a load average of about 100, 20 golden species). That is about 0.85 ms a frame for 24 rigged
  animals and 0.3 ms for 8. A phone CPU 4× slower comes to about 1.1 ms for its 8, inside the 16.7 ms budget for
  60 fps.
- **Upload:** each species with rigged animals uploads one live texture a frame (bones × 3 texels × 32 rows,
  RGBA32F). That is 29 KB for a 19-bone rig: at most about 350 KB a frame on desktop and 120 KB in lite mode.
- **In the browser** (`scripts/ark-rig-scenes.mjs --perf`, the crowd of 24 grazers; the shared Mac under heavy load):
  desktop high tier, 15 rigged: 60 fps either way, the frame's own work 4.5 ms with the layer against 3.7 ms
  without. Phone profile (4× CPU throttle, medium tier, 12 rigged): 60 fps either way, 12.0 ms against 13.2 ms, so
  no difference above the noise. The default view (`--island`, 30 s, high tier) stays at 60 fps with or without the
  layer.
