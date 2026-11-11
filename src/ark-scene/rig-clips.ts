/**
 * Rigged clips (the rig pipeline, AnimalDex `scripts/talking-models/rig/`)
 * in the scene: which clips of a species may ever play.
 *
 * The published rig manifest (`<rigBase>/manifest.json`, written by
 * `publish_rig.py`) is small: per species, its rig file's version. Each rig
 * file carries its own entry (`extras.ark_rig.rig`: state, pose, facing and
 * only the clips that passed their own checks). The manifest is read at
 * runtime, so a rig republish needs no web deploy, and an empty manifest
 * turns every rig off.
 *
 * `rigClip` is the one rule every player reads, whatever a manifest says:
 *   - only a rig whose state is `passed`, or `partial` (then only its
 *     individually passing clips);
 *   - only a clip listed with its frames and marked `pass: true`;
 *   - never a flight clip (flap, glide, takeoff, land: held for the owner's
 *     review of the wing cards);
 *   - never a movement clip of a rig whose rest pose is sitting (`pose`): it
 *     keeps its idle.
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
    /** Whether the clip passed its own checks (a partial rig's other clips are false or absent). */
    pass?: boolean;
    /** The clip's first row in the rig's bone texture, and how many rows (its frames plus the closing one). */
    row?: number;
    rows?: number;
    held?: string;
};

export type RigEntry = {
    state?: string;
    clips?: Record<string, RigClip> | string[];
    /** The rig file's version: `<rigBase>/<slug>/<v>.rig.glb`. */
    v?: string;
    /** A sitting (or upright) rest pose: movement held, idle only. */
    pose?: string | null;
    /** Degrees about up the rig's mesh is turned from the Ark model as first exported. */
    facing_deg?: number;
    bones?: number;
    bytes?: number;
};

export type RigManifest = {species: Record<string, RigEntry | undefined>};

/** Held until the owner clears the wing cards (`ARK_FLIGHT_APPROVED`). Never played. */
export const FLIGHT_CLIPS: ReadonlySet<string> = new Set(["flap", "glide", "takeoff", "land"]);
/** Clips that move the animal along: held on a sitting rig. */
export const MOVING_CLIPS: ReadonlySet<string> = new Set(["walk", "run", "climb", "leap", "hop", "hang", "burrow", "emerge", "slither", "swim", "surface"]);
/** What the rig pipeline holds on a sitting rest pose (`rig_ark.py` SIT_HELD), and the rest of the moving clips with it. */
const SIT_HELD = MOVING_CLIPS;

/** A species' clip, when the rules above allow it; else null (procedural motion). */
export function rigClip(manifest: RigManifest | null | undefined, slug: string, clip: string): RigClip | null {
    if (FLIGHT_CLIPS.has(clip)) return null;
    const entry = manifest?.species?.[slug];
    if (!entry || (entry.state !== "passed" && entry.state !== "partial")) return null;
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
 * The rig folder for a model folder: `…/talking-models/v1/ark` →
 * `…/talking-models/ark-rig/v1` (the dev route's `/api/dev/ark-models/v1/ark`
 * likewise). Null when the model folder has another shape.
 */
export function rigBaseFrom(modelBase: string): string | null {
    const trimmed = modelBase.replace(/\/+$/, "");
    return /\/v1\/ark$/.test(trimmed) ? trimmed.replace(/\/v1\/ark$/, "/ark-rig/v1") : null;
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

/** A rig file's own entry (`extras.ark_rig.rig`), when it is one. */
export function decodeRigEntry(raw: unknown): RigEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const entry = raw as RigEntry;
    if (typeof entry.state !== "string" || !entry.clips || typeof entry.clips !== "object" || Array.isArray(entry.clips)) return null;
    return entry;
}
