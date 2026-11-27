/**
 * BROODS: a parent's drive-off clips (lane BROODS-SCENE's Blender clips, `drive-clips.json` beside the v3 rig set, made
 * as the Power clips are: `power-clips.ts`, FORMAT.md). A mallard's or a fox's charge, a songbird's or a plover's mob,
 * a plover's broken-wing display. Loaded lazily, in the brood layer's chunk: the list when a drive-off is first acted
 * near, then a species' bin. Played on the rig (`RigLibrary.addDriveClips`) while the act names one
 * (`live-broods.ts` `drive_*` states); while any of it is missing, or the rig is not the one they were made on, the
 * act's own pose plays on the rig's ordinary clips.
 */

import type {RigClip} from "@/ark-scene/rig-clips";
import type {ArkPowerClipRigs} from "@/ark-scene/power-clips";

export type ArkDriveClipSpec = RigClip & {name: string; row: number; rows: number; flight?: boolean; moving?: [number, number]; distance?: number};
export type ArkDriveClipSpecies = {rig: string; file: string; bones: number; rows: number; clips: ArkDriveClipSpec[]};

/** What the act needs of a clip: its length (s), and the share of it over which it moves on (`moving`, of 0..1) and how far (m, at the rig's drawn size). */
export type ArkDriveClipUse = {name: string; seconds: number; loop: boolean; moving: [number, number] | null; distance: number};

/** Reads `drive-clips.json` (as `power-clips.json`: unknown keys ignored, a malformed species left out). */
export function decodeDriveClips(raw: unknown): Map<string, ArkDriveClipSpecies> | null {
    const root = raw as {kind?: unknown; version?: unknown; species?: Record<string, unknown>} | null;
    if (!root || root.kind !== "ark-drive-clips" || root.version !== 1 || !root.species || typeof root.species !== "object") return null;
    const out = new Map<string, ArkDriveClipSpecies>();
    for (const [slug, value] of Object.entries(root.species)) {
        const s = value as Record<string, unknown> | null;
        if (!s || typeof s.rig !== "string" || typeof s.file !== "string" || !/^[0-9a-f]{12}\.drive\.bin$/.test(s.file)) continue;
        const bones = Number(s.bones);
        const rows = Number(s.rows);
        if (!Number.isInteger(bones) || bones < 1 || !Number.isInteger(rows) || rows < 2) continue;
        const clips: ArkDriveClipSpec[] = [];
        for (const c of Array.isArray(s.drive_clips) ? (s.drive_clips as Array<Record<string, unknown>>) : []) {
            if (!c || typeof c.name !== "string" || !/^drive_[a-z]+$/.test(c.name) || (c.file !== undefined && c.file !== s.file)) continue;
            const row = Number(c.row);
            const clipRows = Number(c.rows);
            const seconds = Number(c.duration);
            if (!Number.isInteger(row) || !Number.isInteger(clipRows) || clipRows < 2 || row + clipRows > rows || !(seconds > 0)) continue;
            const m = Array.isArray(c.moving) && c.moving.length === 2 ? c.moving.map(Number) : null;
            const moving: [number, number] | undefined = m && m[0] >= 0 && m[1] > m[0] && m[1] <= 1 ? [m[0], m[1]] : undefined;
            const distance = Number(c.distance);
            clips.push({...(c as object), name: c.name, row, rows: clipRows, seconds, loop: c.loop === true, flight: c.flight === true, moving, distance: distance > 0 ? distance : undefined} as ArkDriveClipSpec);
        }
        if (clips.length) out.set(slug, {rig: s.rig, file: s.file, bones, rows, clips});
    }
    return out;
}

export type ArkDriveClips = {
    /** The species' clip `name` when it is on its rig now (asking for what is missing), else null: the act's own pose. */
    clipFor: (slug: string, name: string) => ArkDriveClipUse | null;
    dispose: () => void;
};

export function createArkDriveClips(rigs: Omit<ArkPowerClipRigs, "add"> & {add: (slug: string, rig: string, bin: ArrayBuffer, clips: ArkDriveClipSpec[]) => boolean}): ArkDriveClips {
    let list: Map<string, ArkDriveClipSpecies> | null = null;
    let listing = false;
    const abort = new AbortController();
    // (Per species: a bin asked for, added, or given up on; and the clips added.)
    const state = new Map<string, "loading" | "added" | "off">();
    const added = new Map<string, Map<string, ArkDriveClipUse>>();
    let disposed = false;

    const fetchList = () => {
        if (listing || !rigs.base) return;
        listing = true;
        fetch(`${rigs.base}/drive-clips.json`, {signal: abort.signal})
            .then((response) => (response.ok ? response.json() : null))
            .then((raw) => {
                if (!disposed) list = decodeDriveClips(raw) ?? new Map();
            })
            .catch(() => {
                if (!disposed) list = new Map();
            });
    };

    const fetchBin = (slug: string, spec: ArkDriveClipSpecies) => {
        state.set(slug, "loading");
        fetch(`${rigs.base}/${encodeURIComponent(slug)}/${spec.file}`, {signal: abort.signal})
            .then((response) => (response.ok ? response.arrayBuffer() : null))
            .then((bin) => {
                if (disposed) return;
                const rig = rigs.loaded(slug);
                const clips = spec.clips.filter((clip) => !clip.flight || rigs.flight(slug));
                if (!bin || !rig || bin.byteLength !== spec.rows * spec.bones * 24 || !clips.length || !rigs.add(slug, spec.rig, bin, clips)) {
                    // (A rig let go before its bin came is asked again on its next drive-off.)
                    if (rig) state.set(slug, "off");
                    else state.delete(slug);
                    return;
                }
                state.set(slug, "added");
                added.set(slug, new Map(clips.map((clip) => [clip.name, {name: clip.name, seconds: clip.seconds, loop: clip.loop === true, moving: clip.moving ?? null, distance: clip.distance ?? 0}])));
            })
            .catch(() => {
                if (!disposed) state.set(slug, "off");
            });
    };

    return {
        clipFor: (slug, name) => {
            if (!rigs.base) return null;
            if (!list) {
                fetchList();
                return null;
            }
            const spec = list.get(slug);
            if (!spec || !spec.clips.some((clip) => clip.name === name)) return null;
            const rig = rigs.loaded(slug);
            if (!rig) {
                rigs.request(slug);
                return null;
            }
            // (Made on another rig: the clips would bend the wrong bones. The act's own pose until they are made again.)
            if (rig.set !== 3 || rig.version !== spec.rig || rig.bones !== spec.bones) return null;
            const have = added.get(slug);
            const use = have?.get(name);
            if (use && rig.has(name)) return use;
            // (The rig was let go and loaded again without them: add them again.)
            if (have && !rig.has(have.keys().next().value as string)) {
                added.delete(slug);
                state.delete(slug);
            }
            if (!state.has(slug)) fetchBin(slug, spec);
            return null;
        },
        dispose: () => {
            disposed = true;
            abort.abort();
            state.clear();
            added.clear();
            list = null;
        }
    };
}
