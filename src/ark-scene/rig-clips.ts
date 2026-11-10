/**
 * Rigged clips (the rig pipeline, `~/animaldex-talking-models/rig/manifest.json`)
 * in the scene: which a species may use. Only a clip of a species whose rig
 * **passed** its checks, and that the manifest lists as a clip (an object
 * with its frames, not a name in a failed rig's list), is ever read. Anything
 * else (no manifest, a fallback rig, a clip that is not there) is null, and
 * the scene keeps its procedural motion (the glide, the arc, the sway).
 *
 * The rig output is not published to the model bucket yet, so the scene has
 * no manifest (`ARK_RIG_MANIFEST` is null) and every animal moves
 * procedurally. When it ships, the published manifest goes here and the
 * players read `rigClip` only.
 */

export type RigClip = {frames: number; loop: boolean; seconds: number; ground_speed?: number; stride?: number};
export type RigManifest = {species: Record<string, {state?: string; clips?: Record<string, RigClip> | string[]} | undefined>};

/** The published rig manifest: none yet. */
export const ARK_RIG_MANIFEST: RigManifest | null = null;

/** A species' clip, only when its rig passed and the clip is listed with its frames; else null (procedural motion). */
export function rigClip(manifest: RigManifest | null, slug: string, clip: string): RigClip | null {
    const entry = manifest?.species[slug];
    if (!entry || entry.state !== "passed" || !entry.clips || Array.isArray(entry.clips)) return null;
    const found = entry.clips[clip];
    return found && typeof found === "object" && Number.isFinite(found.frames) && found.frames > 0 ? found : null;
}
