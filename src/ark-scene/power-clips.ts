/**
 * Powers you can see (decision 420): the Blender Power-act clips (lane POWERCLIPS-SHIP, `power-clips.json` beside the
 * v3 rig set; its FORMAT.md). Loaded lazily, in the Power layer's chunk: the list once, when an animal first shows its
 * Power near the camera, then a species' bin on its first such moment. Played on the rig (`RigLibrary.addPowerClips`)
 * in place of the coded act; while any of it is missing, or the rig is not the one the clips were made on, the coded
 * act plays (`power-show.ts`).
 */

import type {RigClip} from "@/ark-scene/rig-clips";

export type ArkPowerClipSpec = RigClip & {name: string; row: number; rows: number; flight?: boolean};
export type ArkPowerClipSpecies = {rig: string; file: string; bones: number; rows: number; bytes: number; mechanism: string | null; clips: ArkPowerClipSpec[]};

/** What the scene lends the clips (index.ts): the rig set's folder and its loaded rigs. */
export type ArkPowerClipRigs = {
    /** The v3 rig set's folder (`rigBaseFrom(modelBase, "v3")`), or null (no rigs: never loaded). */
    base: string | null;
    /** The species' rig loaded now (or asked for: `first`), its set's version string, its clips. */
    loaded: (slug: string) => {set: number; version: string | undefined; bones: number; has: (name: string) => boolean} | null;
    request: (slug: string) => void;
    /** Whether flight clips may play on this species' rig (the set's and the species' approval). */
    flight: (slug: string) => boolean;
    add: (slug: string, rig: string, bin: ArrayBuffer, clips: ArkPowerClipSpec[]) => boolean;
};

/** Reads `power-clips.json` (FORMAT.md section 2): unknown keys ignored; a malformed species left out. */
export function decodePowerClips(raw: unknown): Map<string, ArkPowerClipSpecies> | null {
    const root = raw as {kind?: unknown; version?: unknown; species?: Record<string, unknown>} | null;
    if (!root || root.kind !== "ark-power-clips" || root.version !== 1 || !root.species || typeof root.species !== "object") return null;
    const out = new Map<string, ArkPowerClipSpecies>();
    for (const [slug, value] of Object.entries(root.species)) {
        const s = value as Record<string, unknown> | null;
        if (!s || typeof s.rig !== "string" || typeof s.file !== "string" || !/^[0-9a-f]{12}\.power\.bin$/.test(s.file)) continue;
        const bones = Number(s.bones);
        const rows = Number(s.rows);
        if (!Number.isInteger(bones) || bones < 1 || !Number.isInteger(rows) || rows < 2) continue;
        const clips: ArkPowerClipSpec[] = [];
        for (const c of Array.isArray(s.power_clips) ? (s.power_clips as Array<Record<string, unknown>>) : []) {
            if (!c || typeof c.name !== "string" || (c.file !== undefined && c.file !== s.file)) continue;
            const row = Number(c.row);
            const clipRows = Number(c.rows);
            const seconds = Number(c.duration);
            if (!Number.isInteger(row) || !Number.isInteger(clipRows) || clipRows < 2 || row + clipRows > rows || !(seconds > 0)) continue;
            clips.push({...(c as object), name: c.name, row, rows: clipRows, seconds, loop: c.loop === true, flight: c.flight === true} as ArkPowerClipSpec);
        }
        if (clips.length) out.set(slug, {rig: s.rig, file: s.file, bones, rows, bytes: Number(s.bytes) || 0, mechanism: typeof s.mechanism === "string" ? s.mechanism : null, clips});
    }
    return out;
}

export type ArkPowerClips = {
    /** Its Power clip `t` s into its act when it is on its rig now (asking for what is missing), else null: the coded act. */
    clipFor: (slug: string, t: number) => string | null;
    dispose: () => void;
};

export function createArkPowerClips(rigs: ArkPowerClipRigs): ArkPowerClips {
    let list: Map<string, ArkPowerClipSpecies> | null = null;
    let listing = false;
    const abort = new AbortController();
    // (Per species: a bin asked for, added, or given up on.)
    const state = new Map<string, "loading" | "added" | "off">();
    const ready = new Map<string, {main: string; seconds: number; hold: string | null}>();
    let disposed = false;

    const fetchList = () => {
        if (listing || !rigs.base) return;
        listing = true;
        fetch(`${rigs.base}/power-clips.json`, {signal: abort.signal})
            .then((response) => (response.ok ? response.json() : null))
            .then((raw) => {
                if (!disposed) list = decodePowerClips(raw) ?? new Map();
            })
            .catch(() => {
                if (!disposed) list = new Map();
            });
    };

    const fetchBin = (slug: string, spec: ArkPowerClipSpecies) => {
        state.set(slug, "loading");
        fetch(`${rigs.base}/${encodeURIComponent(slug)}/${spec.file}`, {signal: abort.signal})
            .then((response) => (response.ok ? response.arrayBuffer() : null))
            .then((bin) => {
                if (disposed) return;
                const rig = rigs.loaded(slug);
                const clips = spec.clips.filter((clip) => !clip.flight || rigs.flight(slug));
                if (!bin || !rig || bin.byteLength !== spec.rows * spec.bones * 24 || !clips.length || !rigs.add(slug, spec.rig, bin, clips)) {
                    // (A rig let go before its bin came is asked again on its next Power moment.)
                    if (rig) state.set(slug, "off");
                    else state.delete(slug);
                    return;
                }
                state.set(slug, "added");
                // The main act (the first), then, when it ends in a pose of its own, that pose's loop held (FORMAT.md: `ends`,
                // `base`): a crouch then crouched, a withdraw then withdrawn.
                const main = clips[0];
                const ends = (main as {ends?: unknown}).ends;
                const hold = !main.loop && typeof ends === "string" ? clips.find((clip) => clip.loop && (clip as {base?: unknown}).base === ends) : undefined;
                ready.set(slug, {main: main.name, seconds: main.seconds, hold: hold?.name ?? null});
            })
            .catch(() => {
                if (!disposed) state.set(slug, "off");
            });
    };

    return {
        clipFor: (slug, t) => {
            if (!rigs.base) return null;
            if (!list) {
                fetchList();
                return null;
            }
            const spec = list.get(slug);
            if (!spec) return null;
            const rig = rigs.loaded(slug);
            if (!rig) {
                rigs.request(slug);
                return null;
            }
            // (Made on another rig: the clips would bend the wrong bones. Coded act until they are made again.)
            if (rig.set !== 3 || rig.version !== spec.rig || rig.bones !== spec.bones) return null;
            const act = ready.get(slug);
            if (act && rig.has(act.main)) return act.hold && t > act.seconds && rig.has(act.hold) ? act.hold : act.main;
            // (The rig was let go and loaded again without them: add them again.)
            if (act) {
                ready.delete(slug);
                state.delete(slug);
            }
            if (!state.has(slug)) fetchBin(slug, spec);
            return null;
        },
        dispose: () => {
            disposed = true;
            abort.abort();
            state.clear();
            ready.clear();
            list = null;
        }
    };
}
