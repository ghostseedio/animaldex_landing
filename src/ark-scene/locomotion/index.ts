/**
 * The locomotion layer (lane L1; docs/ark/locomotion.md): its public interface for the other lanes.
 *
 * - L2 (flight, swim, legless): implement `LocoDriver` and `registerLocoDriver(driver)` (drivers registered with
 *   `first` are asked before the legged one); read `LocoRig` (wings, chain, tail, neck, head).
 * - L3 (grounding): `setLocoGround(query)` for rock tops and decks; `GaitState.feet` for the runtime checks.
 * - L7 (chases): `sprintPace`, `burstPace`, `fleePace`, `fleeAt` (zigzag, darting), `froudeAt`; the gait follows
 *   the speed the pose moves at.
 */

export type {BodyPlan, FootTarget, GaitName, GaitState, GroundQuery, GroundSample, LocoBone, LocoDriver, LocoInput, LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";
export {buildLocoRig, forward, rotateAbout, rotateSubtree, translateSubtree, skinRow, rowToWorld, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
export {GAITS, gaitFor, gaitLadder, headBobs, legOffset, strideFor} from "@/ark-scene/locomotion/gaits";
export {leggedDriver, GAIT_CLIPS} from "@/ark-scene/locomotion/legged";
export {LocoLayer, registerLocoDriver, locoDrivers, newLocoAnimal, plantClipFeet, CLIP_NO_PLANT, type LocoAnimal} from "@/ark-scene/locomotion/layer";
export {locoGround, setLocoGround, terrainGround, flatGround} from "@/ark-scene/locomotion/ground";
export {sprintPace, burstPace, fleePace, fleeAt, fleeStyle, froudeAt, accelTime, rampedProgress, type FleeInput, type FleePoint, type FleeStyle, type PaceInput} from "@/ark-scene/locomotion/flee";
export {newSpring, stepSpring, newChain, stepChain, type Spring, type SpringChain} from "@/ark-scene/locomotion/secondary";
export {solveLeg, restPole} from "@/ark-scene/locomotion/ik";
export {LIVE_ROWS, liveRowCode} from "@/ark-scene/locomotion/pose-texture";
