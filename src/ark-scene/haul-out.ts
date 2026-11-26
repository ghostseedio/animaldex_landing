/**
 * A seal back at its usual haul-out (lane SEA-SIG, 2026-11-26; `haul-out.json`). Nothing is drawn here: the schedule
 * already brings it ashore to rest and bask on the same few spots round its own roost. This only says, for the live log,
 * when what is drawn is that: settled (basking, resting or asleep) at its roost, on dry ground, not afloat.
 */

import table from "@/ark-scene/haul-out.json";

const ROWS = (table as unknown as {species: Record<string, {line: string; field: string; quote: string}>}).species;

/** Its species' sentence for being back at its haul-out, or null (a species whose text does not say it). */
export function haulOutLineOf(slug: string | null | undefined): string | null {
    return (slug && ROWS[slug]?.line) || null;
}

export function haulOutKinds(): string[] {
    return Object.keys(ROWS);
}

/**
 * Whether it is hauled out at its own roost now: settled there (basking, resting or asleep, not moving), within two body
 * lengths of the roost (three metres at least), on dry ground (not afloat, the ground under it above the water).
 * (The live wild seal, 2026-11-26, over 400 slots: its bask and rest trips end on a ring of spots 2-17 m round its
 * roost, the nearest one, 2.3 m off, again and again; this counts that one, not the ring.)
 */
export function atHaulOut(at: {x: number; z: number; moving: boolean; afloat: boolean; ground: number; water: number}, roost: {x: number; z: number}, length: number, doing: string | null | undefined): boolean {
    if (doing !== "bask" && doing !== "rest" && doing !== "sleep") return false;
    if (at.moving || at.afloat || at.ground <= at.water + 0.02) return false;
    return Math.hypot(at.x - roost.x, at.z - roost.z) <= Math.max(3, length * 2);
}
