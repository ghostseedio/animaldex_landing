/**
 * Where a released animal is on its stored plan (design §3.1–3.3): the one function the page's schedule, `ark-live`
 * and the ecology tick all evaluate, so they agree.
 *
 * IMPORT-FREE on purpose: the encounter lane's `_shared/ark-positions` (AnimalDex, Deno) takes a byte-identical copy
 * of this file, and a contract test compares them.
 *
 * A plan's legs are `[t_ms, x, z, mode]` with absolute epoch milliseconds, in time order: the animal goes in a straight
 * line from each leg's point to the next at a steady pace, in the first leg's mode (0 ground, 3 swim, 4 air, 7 strait:
 * `protocol.ts` MODES). Before the first leg there is no plan yet; after the last it has arrived (`done`), and from
 * then on its home is `settle` (its own home disc when null).
 */

export type PlanLeg = [number, number, number, number];

export type ReleasePlan = {
    kind: "stay" | "homing" | "search" | "retrace" | "enclosure";
    legs: PlanLeg[];
    /** When it settles (epoch ms), and where its home disc is from then: null keeps its own home. */
    settle_at: number | null;
    settle: {x: number; z: number; r: number} | null;
    /** A retrace's strait leg takes it to this island (null: it stays on the island it was released on). */
    island?: string | null;
};

export type PlanPoint = {x: number; z: number; mode: number; yaw: number; done: boolean; moving: boolean};

export function evalPlan(plan: ReleasePlan, tMs: number): PlanPoint | null {
    const legs = plan.legs;
    if (!legs.length || tMs < legs[0][0]) return null;
    for (let i = 1; i < legs.length; i++) {
        const a = legs[i - 1];
        const b = legs[i];
        if (tMs <= b[0]) {
            const span = b[0] - a[0];
            const f = span > 0 ? (tMs - a[0]) / span : 1;
            const dx = b[1] - a[1];
            const dz = b[2] - a[2];
            const moving = dx * dx + dz * dz > 1e-6;
            return {x: a[1] + dx * f, z: a[2] + dz * f, mode: a[3], yaw: moving ? Math.atan2(dx, dz) : 0, done: false, moving};
        }
    }
    const last = legs[legs.length - 1];
    let yaw = 0;
    for (let i = legs.length - 1; i > 0; i--) {
        const dx = last[1] - legs[i - 1][1];
        const dz = last[2] - legs[i - 1][2];
        if (dx * dx + dz * dz > 1e-6) {
            yaw = Math.atan2(dx, dz);
            break;
        }
    }
    return {x: last[1], z: last[2], mode: last[3], yaw, done: true, moving: false};
}

/** When the plan ends (epoch ms), or null for an empty plan. */
export function planEnd(plan: ReleasePlan): number | null {
    return plan.legs.length ? plan.legs[plan.legs.length - 1][0] : null;
}
