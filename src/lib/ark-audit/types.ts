/**
 * The behaviour audit's shapes: one model per tree (live main's rules, or the
 * behaviour schedule's), sampled the same way, measured by `metrics.ts`.
 */

import type {AuditProfile} from "./fixture";

export type AuditSubject = {
    id: string;
    slug: string;
    profile: AuditProfile;
    /** The model's talking-model plan (`ark.json` behaviour.plan: bird, mammal, fish...). */
    modelPlan: string | null;
    /** Drawn body length (m). */
    length: number;
    /** Where the scene placed it. */
    home: {x: number; y: number; z: number};
    zone: string;
    /** Another animal it keeps to (the scene's cluster leader), if any. */
    leader: string | null;
    /** How the scene moves it: "schedule", or live main's procedural kinds. */
    driver: string;
};

/** One animal at one moment, as the scene would draw it. */
export type AuditSample = {
    /** The one behaviour state: asleep, awake, flying, breathing. */
    state: string;
    /** What it is doing (the behaviour schedule's label), or null where the tree has none. */
    doing: string | null;
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Drawn up in the air. */
    aloft: boolean;
    /** Moving along now (walking, flying, swimming). */
    moving: boolean;
    /** A wing pose is drawn (a flap or glide clip, or a wing shader): false = the model's resting (closed) wings. */
    wingsOpen: boolean;
    /** The rig clip it would play close to the camera, or null (procedural / no rig). */
    clip: string | null;
    /** A grazing pose is drawn (head down at the grass). */
    headDown: boolean;
    /** In the water (under or on the surface). */
    inWater: boolean;
    /** Resting on a raised scenery point (a branch, a rock top, a wall, a ledge): off the ground on purpose. */
    raised: boolean;
};

export type AuditFeatures = {
    /** The behaviour schedule drives positions. */
    schedule: boolean;
    /** Rigged clips can play (a manifest is read). */
    rigs: boolean;
    /** Flight clips (flap/glide/takeoff/land) may play. */
    flightClips: boolean;
    /** Birds with a shader wing motion ("flap" in the model's behaviour). */
    wingShaderSpecies: number;
    /** Prey turns towards a predator: the rule's reach (m) and whether the predator must be moving; null: no such rule. */
    preyLook: {within: number; predatorMoving: boolean; nearCameraOnly: number} | null;
    /** Prey runs from a predator. */
    preyFlee: boolean;
    /** A head (or neck) turns on its own, apart from the whole body. */
    headLook: boolean;
    /** A grazing pose (head down) exists. */
    grazePose: boolean;
    /** Spawn keeps predators away from their prey. */
    spawnSeparation: boolean;
    /** Per-individual personality/variation is wired into the scene. */
    individualVariation: boolean;
};

export type AuditModel = {
    label: string;
    tree: string;
    commit: string;
    subjects: AuditSubject[];
    features: AuditFeatures;
    /** Ground height (m; under 0 is water). */
    heightAt(x: number, z: number): number;
    /** Island hour (0–24) at a world time (s). */
    hoursAt(epoch: number): number;
    /** Sample animal i at world time `epoch` (s); calls come in time order per animal, `dt` since its last call. */
    sample(i: number, epoch: number, dt: number): AuditSample;
    /** Interaction points near a spot, by tag (null: the tree has no attach points). */
    attachCount: ((tag: string, x: number, z: number, r: number) => number) | null;
    /**
     * Pass C, where the tree has the local reactive layer (`reactive.ts`, near the camera only): the layer run at the
     * scene's frame rate round a camera at each stop (pass A's encounters), as `stepReactive` feeds it. Absent: none.
     */
    cameraPass?: (stops: CameraStop[], hunts: (hunter: string, prey: string) => boolean) => CameraResult;
};

/** A camera stop: a prey animal a hunter came near in pass A, at that moment. */
export type CameraStop = {epoch: number; prey: number; hunter: number};

export type CameraResult = {
    stops: number;
    frames: number;
    secondsPerStop: number;
    tier: string;
    /** Problem 5: awake animals the layer ran for, how many turned their heads (weight > 0.15) at least once, and the share of their frames turned. */
    heads: {animals: number; turned: number; turnedPct: number | null; framesTurnedPct: number | null};
    /** Problem 6: prey with one of its hunters (awake, on the ground) within 25 m of it while the layer ran for it. */
    hunts: {encounters: number; reacted: number; fled: number; reactPct: number | null; fleePct: number | null; medianSecondsToReact: number | null};
    /** Problem 7: frames in which a group (3+ of a species, all awake) all took the same action. */
    variety: {groupFrames: number; allSame: number; allSamePct: number | null};
    /** Share of awake agent-frames per action. */
    actions: Record<string, number>;
    ms: number;
};
