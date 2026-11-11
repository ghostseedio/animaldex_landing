/**
 * Session limits and timings (design §2.5, §2.6, D2, D3).
 *
 * D2: one controlled animal per person; one controller per animal (the database lock).
 * D3: a session lasts at most 20 minutes, then the animal must rest; a 10 minute cooldown after a full session; at
 *     most 60 minutes per animal per real day (so at least 95 % of its life stays its own). A sleeping animal may be
 *     woken: it starts at half stamina and goes back to its roost on release.
 *
 * Pure.
 */

export const SESSION_LIMIT_S = 20 * 60;
export const COOLDOWN_S = 10 * 60;
export const DAY_LIMIT_S = 60 * 60;
/** A dropped controller keeps its session this long before it is released at its last accepted pose. */
export const DISCONNECT_GRACE_S = 30;
export const HEARTBEAT_S = 10;
export const LOCK_TTL_S = 30;
/** Session starts per user per minute (design §4.6 item 8). */
export const STARTS_PER_MINUTE = 3;
/** One Ark day in real seconds (`rules.ts` ARK_DAYS_PER_REAL_DAY = 365/14), and the encounter step: 15 Ark minutes. */
export const ARK_DAY_S = (86_400 * 14) / 365;
export const TRACE_STEP_S = ARK_DAY_S / 96;
export const SNAPSHOT_HZ = {high: 10, medium: 10, low: 5, lite: 2} as const;
export const METER_HZ = 2;
/** The AOI caps: the nearest controlled animals each viewer receives (design §9.4). */
export const AOI_CAP = {high: 32, medium: 24, low: 12, lite: 8} as const;
export const MAX_CONTROLLERS_PER_ROOM = 200;

export type Tier = keyof typeof SNAPSHOT_HZ;

export function isTier(value: unknown): value is Tier {
    return value === "high" || value === "medium" || value === "low" || value === "lite";
}

/** The encounter step a moment falls in (epoch seconds), on the absolute grid. */
export function traceStep(epochSeconds: number): number {
    return Math.floor(epochSeconds / TRACE_STEP_S);
}

/** Seconds left in this session and in today's allowance. */
export function timeLeft(startedAtMs: number, nowMs: number, dayUsedAtStartS: number, dayLimitS = DAY_LIMIT_S, sessionLimitS = SESSION_LIMIT_S): {sessionLeft: number; dayLeft: number} {
    const elapsed = Math.max(0, (nowMs - startedAtMs) / 1000);
    return {sessionLeft: Math.max(0, sessionLimitS - elapsed), dayLeft: Math.max(0, dayLimitS - dayUsedAtStartS - elapsed)};
}

/** A simple per-key rate limiter over a sliding minute. */
export class StartLimiter {
    private readonly starts = new Map<string, number[]>();
    constructor(private readonly perMinute = STARTS_PER_MINUTE) {}
    allow(key: string, nowMs: number): boolean {
        const list = (this.starts.get(key) ?? []).filter((at) => nowMs - at < 60_000);
        if (list.length >= this.perMinute) {
            this.starts.set(key, list);
            return false;
        }
        list.push(nowMs);
        this.starts.set(key, list);
        return true;
    }
}
