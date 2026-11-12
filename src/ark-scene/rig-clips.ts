/**
 * Rigged clips (the rig pipeline, AnimalDex `scripts/talking-models/rig/`)
 * in the scene: which clips of a species may ever play.
 *
 * The contract is AnimalDex `docs/ark/rig-v2-manifest.md` (branch
 * `ark-rigging`). A rig set is `ark-rig/<vN>/`: its `manifest.json`
 * (written by `publish_rig.py`) is small: per species, its rig file's
 * version, and (v2) the set-wide `flight` switch. Each rig file carries its
 * own entry (`extras.ark_rig.rig`: state, plan, pose, facing, the clips that
 * passed their own checks, and in v2 `flight_approved`,
 * `flight_fallback_open` and the `look` chain). The manifest is read at
 * runtime, so a rig republish needs no web deploy, and an empty manifest
 * turns every rig off.
 *
 * The scene reads v2 first and v1 for every species v2 does not list
 * (`rigBasesFrom`, `RigLibrary`): v1 files are never removed, and each file
 * is self-contained.
 *
 * `rigClip` is the one rule every player reads, whatever a manifest says:
 *   - only a rig whose state is `passed`, or `partial` (then only its
 *     individually passing clips);
 *   - only a clip listed with its frames and marked `pass: true`;
 *   - a flight clip (flap, glide, soar, bank_l, bank_r, hover, takeoff,
 *     land) only when the set's manifest says `flight: true` AND the
 *     species' own entry says `flight_approved: true` (the owner's approval,
 *     `ARK_FLIGHT_APPROVED`); a v1 set or entry never has either;
 *   - never a movement clip (flight and water clips included) of a rig whose
 *     rest pose is sitting (`pose`): it keeps its idle.
 * Anything else (no manifest, a fallback rig, a clip that is not there) is
 * null, and the scene keeps its procedural motion.
 */

export type RigClip = {
    frames: number;
    loop: boolean;
    seconds: number;
    /** Model units a second the root moves at (the feet stay planted at this speed). */
    ground_speed?: number;
    stride?: number;
    /** walk, run, climb: the share of the cycle each foot is planted, and how far it sweeps back then (v2: `stride` = sweep / duty). */
    duty?: number;
    sweep?: number;
    /** Whether the clip passed its own checks (a partial rig's other clips are false or absent). */
    pass?: boolean;
    /** The clip's first row in the rig's bone texture, and how many rows (its frames plus the closing one). */
    row?: number;
    rows?: number;
    held?: string;
    /** flap, hover: wing beats a second. */
    flap_hz?: number;
    /** glide, soar: the share of the time the species glides (soar 1). */
    glide_share?: number;
    /** bank_l (+25), bank_r (−25): the roll into the turn (degrees). */
    bank_deg?: number;
    /** takeoff, land: the body rises this many mesh heights by the end of takeoff (land: from there to the ground). */
    rise_h?: number;
    /** graze: how far the head goes down (degrees). */
    head_down_deg?: number;
    /** enter_water, exit_water: wade, slide or launch. */
    mode?: string;
    /** enter_water, exit_water: the body ends (enter) or starts (exit) this many mesh heights below the bank. */
    depth_h?: number;
    /** v6 (contract 8.1): the base pose a loop is held in (lying, side, leaning), a transition's start and end, the posture. */
    base?: string;
    starts?: string;
    ends?: string;
    posture?: string;
    /** v6 (contract 8.1): how far the lying clips lower the body (mesh heights), and a sleep or rest loop's breaths a second. */
    drop_h?: number;
    breath_hz?: number;
};

/** One bone of the look chain, in the rig's rest pose (glTF space: +y up, the animal faces +z, its left is +x). */
export type RigLookBone = {head: [number, number, number]; axis?: [number, number, number]; up?: [number, number, number]};

/**
 * The head and neck chain for look-at (contract section 5): yaw about +y
 * (positive toward the animal's left, +x), pitch about +x (positive down),
 * clamped to `limits_deg`, split between the bones by `share`.
 */
export type RigLook = {
    bones: string[];
    rest: Record<string, RigLookBone>;
    limits_deg: {yaw: number; pitch_up: number; pitch_down: number};
    share: Record<string, number>;
};

export type RigEntry = {
    /** Entry format: 2 in a v2 file, absent in a v1 file (then: no flight, no look, v1 gait numbers). */
    version?: number;
    code?: string;
    state?: string;
    plan?: string | null;
    clips?: Record<string, RigClip> | string[];
    /** The rig file's version: `<rigBase>/<slug>/<v>.rig.glb`. */
    v?: string;
    /** A sitting (or upright) rest pose: movement held, idle only. */
    pose?: string | null;
    /** Degrees about up the rig's mesh is turned from the Ark model as first exported. */
    facing_deg?: number;
    bones?: number;
    bytes?: number;
    /** v2: this species' flight clips are approved and in the file (`false` or absent: none play). */
    flight_approved?: boolean;
    /** v2: a flyer with no playable flap: in the air its wings are drawn open, never the closed rest pose. */
    flight_fallback_open?: boolean;
    /** v2: the head and neck chain for look-at; absent in v1. */
    look?: RigLook | null;
    /** v6: a clip this species was meant to have that failed, and the clip that stands in for it (`{"sleep": "sleep_stand"}`). */
    alias?: Record<string, string> | null;
};

/** A rig set's manifest as the rules read it: `flight` is the set-wide switch (v2; absent or false: no flight anywhere). */
export type RigManifest = {flight?: boolean; species: Record<string, RigEntry | undefined>};

/** Flight clips: played only when the set and the species' entry both say flight is approved. */
export const FLIGHT_CLIPS: ReadonlySet<string> = new Set(["flap", "glide", "soar", "bank_l", "bank_r", "hover", "takeoff", "land"]);
/** Clips that move the animal along (water clips included): held on a sitting rig, with the flight clips. */
export const MOVING_CLIPS: ReadonlySet<string> = new Set(["walk", "run", "climb", "leap", "hop", "hang", "burrow", "emerge", "slither", "swim", "surface", "enter_water", "exit_water", "dive", "paddle"]);
/** What the rig pipeline holds on a sitting rest pose (contract section 4: the moving clips and every flight clip). */
const SIT_HELD: ReadonlySet<string> = new Set(Array.from(MOVING_CLIPS).concat(Array.from(FLIGHT_CLIPS)));

/** Whether a rig set and a species' entry both approve flight (contract 3.1, rule 4). */
export function flightApproved(manifest: RigManifest | null | undefined, slug: string): boolean {
    return manifest?.flight === true && manifest.species?.[slug]?.flight_approved === true;
}

/** A species' clip, when the rules above allow it; else null (procedural motion). */
export function rigClip(manifest: RigManifest | null | undefined, slug: string, clip: string): RigClip | null {
    const entry = manifest?.species?.[slug];
    if (!entry || (entry.state !== "passed" && entry.state !== "partial")) return null;
    if (FLIGHT_CLIPS.has(clip) && !flightApproved(manifest, slug)) return null;
    if (!entry.clips || Array.isArray(entry.clips) || typeof entry.clips !== "object") return null;
    if (entry.pose && SIT_HELD.has(clip)) return null;
    const found = entry.clips[clip];
    if (!found || typeof found !== "object") return null;
    if (found.pass !== true) return null;
    if (!Number.isFinite(found.frames) || found.frames <= 0 || !Number.isFinite(found.seconds) || found.seconds <= 0) return null;
    return found;
}

/** Whether a species has any clip the scene may play (a rig worth loading). */
export function rigPlayable(manifest: RigManifest | null | undefined, slug: string): boolean {
    const entry = manifest?.species?.[slug];
    if (!entry?.clips || Array.isArray(entry.clips)) return false;
    return Object.keys(entry.clips).some((name) => rigClip(manifest, slug, name) !== null);
}

/**
 * The rig set the scene reads first: `ark-rig/<version>/`. A re-made set
 * (new strides, more clips) goes up under a new version beside the old one
 * (`publish_rig.py --version v3`), and the release that is made for
 * it moves this, so a web build never reads a set it was not made for.
 * Until that set is up (its manifest missing, malformed or not its version)
 * every species reads the fallback set, and a species the new set does not
 * list reads it too.
 */
export const ARK_RIG_VERSION = "v3";   // v3 (MA2): the birds re-rigged (rig code v7: bills and skulls on the head bone, folding wings); every other species' file as v2
/** The set every species falls back to: v1 is never overwritten or removed (contract section 6). */
export const ARK_RIG_FALLBACK = "v1";

/**
 * The rig folder for a model folder: `…/talking-models/v1/ark` →
 * `…/talking-models/ark-rig/<version>` (the dev route's `/api/dev/ark-models/v1/ark`
 * likewise). Null when the model folder has another shape.
 */
export function rigBaseFrom(modelBase: string, version: string = ARK_RIG_VERSION): string | null {
    const trimmed = modelBase.replace(/\/+$/, "");
    if (!/^v[0-9]{1,3}$/.test(version)) return null;
    return /\/v1\/ark$/.test(trimmed) ? trimmed.replace(/\/v1\/ark$/, `/ark-rig/${version}`) : null;
}

/**
 * The rig sets the scene reads, in order: `first` (the page's own folder,
 * or the release's set beside the model set), then the fallback set beside
 * the model set. Empty when rigs are off (`first` null).
 */
export function rigBasesFrom(modelBase: string, first?: string | null): string[] {
    if (first === null) return [];
    const main = first === undefined ? rigBaseFrom(modelBase) : first.replace(/\/+$/, "");
    const fallback = rigBaseFrom(modelBase, ARK_RIG_FALLBACK);
    const out: string[] = [];
    for (const base of [main, fallback]) if (base && !out.includes(base)) out.push(base);
    return out;
}

/** The set version a rig folder names (`…/ark-rig/v2` → 2); null for another folder (a development override). */
export function rigSetVersion(base: string): number | null {
    const found = /\/ark-rig\/v([0-9]{1,3})\/*$/.exec(base);
    return found ? Number(found[1]) : null;
}

/** The published manifest: each species' rig file version (`<rigBase>/<slug>/<version>.rig.glb`). */
export type RigIndex = Record<string, string>;

const VERSION = /^[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/** The manifest as read from the network: anything malformed is no manifest (every animal procedural); a bad row is left out. */
export function decodeRigIndex(raw: unknown): RigIndex | null {
    if (!raw || typeof raw !== "object") return null;
    const species = (raw as {species?: unknown}).species;
    if (!species || typeof species !== "object" || Array.isArray(species)) return null;
    const index: RigIndex = {};
    for (const [slug, version] of Object.entries(species as Record<string, unknown>)) {
        if (SLUG.test(slug) && typeof version === "string" && VERSION.test(version)) index[slug] = version;
    }
    return index;
}

/** A rig set's manifest: its rig files, and whether the set publishes flight. */
export type RigSetIndex = {version: number; flight: boolean; index: RigIndex};

/**
 * A set's manifest, read for the version its folder names (`expected`):
 * a v2 folder's manifest counts only when it says `version: 2` (anything
 * else is no manifest: the species fall back to v1). Flight is on only when
 * a v2-or-later manifest says `flight: true`. A folder with no version in
 * its name (a development override) takes the manifest's own.
 */
export function decodeRigSet(raw: unknown, expected: number | null): RigSetIndex | null {
    const index = decodeRigIndex(raw);
    if (!index) return null;
    const stated = (raw as {version?: unknown}).version;
    const version = typeof stated === "number" && Number.isInteger(stated) ? stated : 1;
    if (expected !== null && expected >= 2 && version !== expected) return null;
    if ((raw as {kind?: unknown}).kind !== undefined && (raw as {kind?: unknown}).kind !== "ark-rig") return null;
    const flight = version >= 2 && (raw as {flight?: unknown}).flight === true;
    return {version: expected ?? version, flight, index};
}

/** A rig file's own entry (`extras.ark_rig.rig`), when it is one. */
export function decodeRigEntry(raw: unknown): RigEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as RigEntry;
    if (typeof entry.state !== "string" || !entry.clips || typeof entry.clips !== "object" || Array.isArray(entry.clips)) return null;
    return entry;
}

const finite3 = (value: unknown): value is [number, number, number] =>
    Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));

/** An entry's look chain (contract section 5) when it is whole: the bones, each one's rest pivot, the limits. Else null. */
export function decodeRigLook(raw: unknown): RigLook | null {
    if (!raw || typeof raw !== "object") return null;
    const look = raw as Partial<RigLook>;
    if (!Array.isArray(look.bones) || !look.bones.length || look.bones.length > 2 || !look.bones.every((b) => typeof b === "string")) return null;
    if (!look.rest || typeof look.rest !== "object") return null;
    for (const bone of look.bones) if (!finite3(look.rest[bone]?.head)) return null;
    const limits = look.limits_deg;
    if (!limits || ![limits.yaw, limits.pitch_up, limits.pitch_down].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 180)) return null;
    const share = look.share && typeof look.share === "object" ? look.share : {};
    return {bones: look.bones, rest: look.rest, limits_deg: limits, share};
}

/**
 * The look limits per body plan (contract section 5; `rig_ark.py`
 * LOOK_LIMITS): yaw either way, pitch up, pitch down (degrees) and the
 * neck's share. A v1 file has no `look`; its `neck` and `head` bones are
 * turned within these.
 */
export const RIG_LOOK_LIMITS: Record<string, [number, number, number, number]> = {
    quadruped: [70, 30, 45, 0.45],
    primate: [80, 40, 40, 0.4],
    flying_bird: [110, 45, 60, 0.6],
    walking_bird: [110, 45, 60, 0.6],
    flightless_bird: [100, 45, 60, 0.6],
    bat: [45, 30, 30, 0.4],
    lizard: [35, 25, 20, 0.5],
    turtle: [45, 30, 30, 0.6],
    amphibian: [20, 15, 15, 0.5],
    legless: [45, 30, 30, 0],
    flying_insect: [25, 15, 15, 0.3],
    insect: [25, 15, 15, 0.3],
    arachnid: [10, 8, 8, 0],
    crustacean: [15, 10, 10, 0]
};
/** Owls (Strigidae, Tytonidae) by name: they end in "owl" or "owlet" (an owlet-nightjar is not one). */
const OWL = /(^|-)owl(et)?$/;

/** The limits for a plan (owls turn furthest), as the contract's `limits_deg` and `share`. */
export function rigLookLimits(plan: string | null | undefined, slug: string): {limits_deg: RigLook["limits_deg"]; neck: number} {
    const row = RIG_LOOK_LIMITS[plan ?? ""] ?? [40, 25, 25, 0.5];
    if ((plan === "flying_bird" || plan === "walking_bird") && OWL.test(slug)) return {limits_deg: {yaw: 170, pitch_up: 45, pitch_down: 60}, neck: 0.7};
    return {limits_deg: {yaw: row[0], pitch_up: row[1], pitch_down: row[2]}, neck: row[3]};
}
