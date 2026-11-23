/**
 * Look states held after their frames were looked at (lane SIG2, `look-states.json` `held`) are never drawn. The look-state
 * tests check their mechanism with them put back: importing this module (before `@/ark-scene/look-state`) does that.
 */
import table from "@/ark-scene/look-states.json";

const t = table as unknown as {species: Record<string, unknown>; held?: Record<string, {why: string}>};
export const HELD_LOOK_STATES = Object.keys(t.held ?? {});
for (const [slug, entry] of Object.entries(t.held ?? {})) {
    const {why: _why, ...spec} = entry;
    void _why;
    t.species[slug] ??= spec;
}
