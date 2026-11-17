# Ark people: what a replacement figure renderer must provide

The procedural figures in `figures.ts` (`HumanFigures`) are a stand-in. A rigged-model renderer (MakeHuman/MPFB2) can
replace them without changing anything that decides where people are or what they do: the town (`town-humans.ts`,
`pavements.ts`, `dog-walks.ts`, `couples.ts`), the beach props (`beach-props.ts`) and the forest crews
(`forestry/forest-crews.ts`, `forest-scene.ts`) only produce `HumanInstance` lists.

## Privacy (owner's fixed rule)

- Every person is a generic body chosen from a seed: the Ark animal's id, via `humanLook(id, child)`.
- Never the capture photo, a face taken from it, or the subject's name.
- A tap shows only "Human" and the capturer.
- There is one figure per real human capture, and no invented crowds.
- Model faces must be generic: the same few presets for everyone, picked by the seed.

## Input per frame

`HumanFigures.setFrame(list: HumanInstance[], camera: Vector3, seconds: number)`. Keep this signature. Each instance
carries:

| Field | Meaning |
|---|---|
| `x`, `y`, `z` | Root position in world metres. The root is at the feet, at ground or floor level (a sitter's root comes from `sitRootY(seatY, scale)`). |
| `yaw` | Facing: forward is (sin yaw, cos yaw). |
| `pose` | One of the `HumanPoseKind` values below. |
| `phase` | Seconds offset; add `seconds` to get the animation time. |
| `look` | A `HumanLook`, all from the seed: `height` (adults 1.52–1.94 m, children 0.95–1.4 m), `build` (0.86–1.2), the `skin`, `hair`, `top` and `bottom` colours (sRGB, 0–1), and the flags `longHair`, `sleeves`, `trousers`, `bald`, `child`. On the beach the town passes swimwear (`sleeves = 0`, `trousers = 0`). |
| `scale?` | A child's growth factor (0.3–1), multiplied on top of the look's height. |
| `lean?` | Extra waist lean in radians (a driver ducking under a car roof). |
| `light?` | 0–1: indoor lamp or TV glow at night (emissive). |
| `tilt?` | Lying on a slope: how far the head end is raised, in radians. |

## Poses used

| Pose | Used for |
|---|---|
| `walk` | Pavements, the beach, dog walks. Stride cadence `WALK_CADENCE`; ground pace `WALK_PACE` m/s, matched so feet do not slide. |
| `stand` | Pauses and spotters. |
| `sit` | Benches, sofas, car passengers. Hips on the seat. |
| `drive` | Car and speedboat helm. Hands at the wheel. |
| `sunback` | Lying on the back, hands behind the head. |
| `sunside` | Lying on a side, knees drawn up. |
| `sunsit` | Sitting on a towel, reading. |
| `lie` | Legacy lying pose. |
| `paddle` | Standing in the shallows. |
| `sleep` | In bed, on a side. |
| `chop` | Axe swing. |
| `saw` | Chainsaw held at waist height. |
| `plant` | Kneeling and bent to the soil. |
| `carry` | Arms forward, carrying. |

## Hands the scene reads

- **Dog lead** (`town-humans.ts`, `WalkedDog.hand`): the hand on the dog's side, about 0.25 m out and 0.84 m up at the walker's scale. A rig should give the real hand bone instead.
- **Forest tools** (`forestry/forest-tools.ts`, `posedArmPoint`): a JS mirror of today's joint pivots (`JOINTS`) and angles (`posePerson`). A rig should give the hand bones' world matrices so the axe or chainsaw can attach to them.

## Levels of detail and budget

- Near body within `HUMAN_NEAR` (40 m), casting shadows.
- Coarse body out to `HUMAN_FAR` (250 m); nothing beyond.
- At most `HUMAN_MAX` drawn, the nearest first.
- The live record has 112 humans. Today's budget is about 2,700 triangles near and 570 far.
- Phone heap budget is +8 MB for the whole humans lane.
- Draw instanced (or as a few skinned batches); allocate nothing per frame.
- Keep posed figures out of the high tier's ambient-occlusion pass (`userData.gtaoSkip = true`, see `post.ts`). That pass draws the rest pose otherwise.

## Tests that pin the contract

- `src/lib/ark-humans.test.ts`: looks hold no identity fields; every pose gives finite joints; the triangle budget (to be replaced with the new model's).
- `src/lib/ark-dog-walks.test.ts`
- `src/lib/ark-forestry.test.ts`: the tool matches the pose.
