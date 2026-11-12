/**
 * The locomotion layer's interface (lane L1 of the motion pass; docs/ark/locomotion.md).
 *
 * A rigged animal near the camera is posed on the CPU each frame: its baked clip (the rig file's bone rows) is the
 * base, and a driver lays procedural motion on top: legged gaits with planted feet (`legged.ts`), and (lane L2) flight,
 * swimming and legless motion. The pose goes to the GPU as one row of the species' live pose texture
 * (`pose-texture.ts`), read by the rig shader instead of the baked rows.
 *
 * Everything here is visual only: positions come from the shared schedule; this layer never moves an animal's
 * root. Its own state (planted feet, springs) is per-frame smoothing that converges the same for every viewer.
 *
 * Space: the rig file's mesh space (glTF), +y up, the animal faces +z, its left is +x. World space is the scene's.
 */

import type {Matrix4} from "three";

/** The rig contract's body plans (docs/ark/rig-v2-manifest.md section 4), plus `whale` for chain-rigged cetaceans. */
export type BodyPlan =
    | "quadruped"
    | "primate"
    | "walking_bird"
    | "flying_bird"
    | "flightless_bird"
    | "bat"
    | "flying_insect"
    | "insect"
    | "arachnid"
    | "crustacean"
    | "amphibian"
    | "lizard"
    | "turtle"
    | "legless"
    | "fish"
    | "cephalopod_jelly"
    | "other";

/**
 * Named gaits. Legged: `stand`, `walk` (lateral sequence), `ds_walk` (diagonal sequence: primates, turtles),
 * `amble` (an elephant's fast walk, no aerial phase), `trot`, `pace` (giraffes, camels), `canter`,
 * `gallop` (transverse: hoofed animals), `rotary` (rotary gallop: carnivores), `half_bound`, `bound`, `hop` (feet
 * together: small birds, frogs), `biped_walk`, `biped_run`, `waddle` (penguins), `sprawl` (lizards: diagonal pairs
 * and a bending spine), `tripod` (insects), `wave` (spiders and crustaceans slow), `tetrapod` (their faster
 * alternating tetrapod). L2 adds its own (flap, glide, swim, undulate...) under the same `GaitName` string.
 */
export type GaitName =
    | "stand"
    | "walk"
    | "ds_walk"
    | "amble"
    | "trot"
    | "pace"
    | "canter"
    | "gallop"
    | "rotary"
    | "half_bound"
    | "bound"
    | "hop"
    | "biped_walk"
    | "biped_run"
    | "waddle"
    | "sprawl"
    | "sprawl_run"
    | "tripod"
    | "wave"
    | "tetrapod"
    | (string & {});

/** The ground under a point (world space): its height and its normal (unit). `water`: a water surface over it, if any. */
export type GroundSample = {height: number; nx: number; ny: number; nz: number; water?: number | null};
export type GroundQuery = (x: number, z: number) => GroundSample;

/** A rig bone as the locomotion layer reads it (texture order). */
export type LocoBone = {
    name: string;
    /** Parent's texture index, -1 for a root (hips; its parent `root` carries no weight). */
    parent: number;
    /** Rest pose in mesh space: the bone's world matrix in the rig file (the bone rows start from it). */
    restWorld: Matrix4;
    /** Rest relative to the parent's rest (restWorld for a root). */
    restLocal: Matrix4;
};

/** One leg chain (upper, lower, foot) and where it touches the ground at rest. */
export type LocoLeg = {
    key: string;
    upper: number;
    lower: number;
    foot: number;
    /** 0 = the front pair, counting back. */
    pair: number;
    /** +1 left (+x), -1 right. */
    side: 1 | -1;
    /** Fore, hind, or a middle pair (insects, spiders, crabs). */
    end: "fore" | "hind" | "mid";
    /** Rest joint positions (mesh space): hip, knee, ankle, and the sole's contact point (the lowest skinned point of the foot). */
    hip: [number, number, number];
    knee: [number, number, number];
    ankle: [number, number, number];
    contact: [number, number, number];
    /** Segment lengths (hip-knee, knee-ankle) and the ankle-to-contact offset at rest. */
    upperLength: number;
    lowerLength: number;
    /** Hip height over its contact at rest (mesh units). */
    height: number;
};

/** A rig's skeleton and proportions for locomotion (`skeleton.ts` buildLocoRig). */
export type LocoRig = {
    slug: string;
    plan: BodyPlan;
    bones: LocoBone[];
    legs: LocoLeg[];
    /** Texture indices (-1: absent). */
    hips: number;
    chest: number;
    neck: number;
    head: number;
    tail: number[];
    /** Wing chains (L2): shoulder, forearm, hand per side, when present. */
    wings: {left: number[]; right: number[]};
    /** Chain bones of a legless or whale rig (chain0..n), front first (L2). */
    chain: number[];
    /** Mesh extents (mesh units): length along z, height, width; the rest mesh's lowest y. */
    length: number;
    height: number;
    width: number;
    minY: number;
    /** The legs' mean hip height over their contact (mesh units): the gait's leg length. 0 without legs. */
    legHeight: number;
    /**
     * The length the gait scales with (mesh units): the hip height for upright legs; for sprawling legs (insects,
     * spiders, crabs, lizards, amphibians, turtles) the hip-to-sole distance, which is what sets their stride.
     */
    gaitLength: number;
    /** Bones a full secondary layer would want and this rig lacks (ears, manes, trunks): degrade gracefully, report. */
    missing: string[];
    /** A sitting rest pose (rig contract `pose`: meerkats, hares, kangaroos): its legs can't step; its baked clips play. */
    sitting: boolean;
    /** Each bone's descendants (texture indices), for turning a bone with everything it carries. */
    below: number[][];
};

/** What drives a frame: the instance in the world, the clock, the animal's pace and what its rig is playing. */
export type LocoInput = {
    /** The instance transform as drawn (position, rotation, uniform scale): mesh space to world. */
    instance: Matrix4;
    /** Uniform scale (metres per mesh unit). */
    scale: number;
    /** The drawn heading (radians, atan2(dx, dz) convention: 0 faces +z). */
    yaw: number;
    /** Frame step (s) and the shared clock (s). */
    dt: number;
    clock: number;
    /** The animal's own seed in [0, 1) (its id's hash): offsets, idle choices. */
    seed: number;
    /** The ground query (world). */
    ground: GroundQuery;
    /** On its own feet on the ground (not in the air, the water, a branch, a wall or lying down). */
    grounded: boolean;
    /** What the rig is playing (rig-player RigState): the clip now and the one fading out. */
    clipNow: string;
    clipFrom: string | null;
    /** Where the clip now is in its cycle (0..1 a loop; 0..1 once through a one-shot): rig-player RigState.now.phase. */
    clipPhase: number;
    /** A hint from the act (`acts.ts` ActPose.state/speed, L7): its state, and the speed it asks for (m/s). */
    actState?: string | null;
    actSpeed?: number | null;
    /** On an air leg of the schedule (MA1): its stage (`flight.ts` AirStage: a run, the climb, level, the glide-in, a ski). */
    airStage?: string | null;
};

/** One foot's target this frame (world space), for debug views, metrics and L3's checks. */
export type FootTarget = {key: string; x: number; y: number; z: number; planted: boolean; ground: number};

/** A gait's state, readable by other lanes (L7's chases, L3's checks, the debug overlay). */
export type GaitState = {
    gait: GaitName;
    /** Cycles walked (the gait's phase, fractional part = where in the cycle). */
    phase: number;
    /** Cycles a second now, stride (m a cycle) and duty factor. */
    cadence: number;
    stride: number;
    duty: number;
    /** Its speed (m/s, eased), acceleration (m/s²) and turn rate (rad/s, + left). */
    speed: number;
    accel: number;
    turn: number;
    /** Froude number v²/(g·h) on its leg height. */
    froude: number;
    feet: FootTarget[];
};

/**
 * A motion driver: legged (L1), flight, swim and legless (L2). The layer asks each registered driver, in order,
 * whether it takes this frame (`takes`); the first that does poses the bones.
 */
export interface LocoDriver {
    readonly name: string;
    /** Whether it poses this animal this frame (the first registered driver that takes it does). */
    takes(rig: LocoRig, input: LocoInput): boolean;
    /** Its per-animal state (kept by the layer while the animal stays rigged). */
    init(rig: LocoRig): unknown;
    /**
     * Pose the bones. `world` holds each bone's transform in mesh space (rest to the bone's place: the bone texture's
     * row is world · rest⁻¹), set to the baked clip's frame or the rest pose (`base`); the driver changes it in place
     * (`skeleton.ts` rotateAbout / the layer's `rotateSubtree` keep children with their parents). Returns the gait
     * state it is in, for other lanes and the metrics.
     */
    pose(rig: LocoRig, input: LocoInput, world: Matrix4[], state: unknown): GaitState | null;
    /** The pose it starts from: the baked clip's frame ("clip", the default) or the rest pose ("rest"). */
    base?(rig: LocoRig, input: LocoInput): "clip" | "rest";
}
