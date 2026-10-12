/**
 * The Trial Loop runtime, loaded on demand: the renderer plus the 30 KB glyph
 * table. Pages import the small `TrialMotion` shell; this chunk is fetched only
 * when a loop is about to paint, and once per page.
 */

import type {TrialMotionGlyphs} from "./engine";

export type TrialMotionRuntime = {
    engine: typeof import("./engine");
    glyphs: TrialMotionGlyphs;
};

let pending: Promise<TrialMotionRuntime> | null = null;

export function loadTrialMotionRuntime(): Promise<TrialMotionRuntime> {
    if (!pending) {
        pending = Promise.all([
            import(/* webpackChunkName: "trial-motion-runtime" */ "./engine"),
            import(/* webpackChunkName: "trial-motion-runtime" */ "./glyphs.json")
        ]).then(([engine, glyphs]) => ({
            engine,
            glyphs: ((glyphs as unknown as {default?: TrialMotionGlyphs}).default ?? glyphs) as TrialMotionGlyphs
        }));
        // A failed chunk load (offline, deploy in between) may be retried later.
        pending.catch(() => {
            pending = null;
        });
    }
    return pending;
}
