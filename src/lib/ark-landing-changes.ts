/**
 * The home band's changes (owner 2026-11-15: "green and red arrows for the data values' % changes"). Only from real
 * numbers: a change is shown only where its earlier value is known, never guessed. The tone is what the change means,
 * not its direction: more animals or births is good, a new extinction is bad, meals are the ecology's business (neutral).
 */

export type ArkChangeTone = "good" | "bad" | "neutral";
export type ArkChange = {direction: "up" | "down"; tone: ArkChangeTone; percent: number | null; delta: number};

/** A change from `before` to `now`; null when there is none or nothing to compare with. */
export function arkChange(now: number | null | undefined, before: number | null | undefined, upIs: ArkChangeTone): ArkChange | null {
    if (typeof now !== "number" || typeof before !== "number" || !Number.isFinite(now) || !Number.isFinite(before)) return null;
    const delta = now - before;
    if (delta === 0) return null;
    const direction = delta > 0 ? "up" : "down";
    const tone: ArkChangeTone = upIs === "neutral" ? "neutral" : direction === "up" ? upIs : upIs === "good" ? "bad" : "good";
    return {direction, tone, percent: before > 0 ? (delta / before) * 100 : null, delta};
}

/** The animals aboard 24 hours ago, from the log: now less what came and went since. */
export function arkAnimalsBefore(animals: number | null | undefined, today: {arrivals: number; births: number; deaths: number} | null | undefined): number | null {
    if (typeof animals !== "number" || !today) return null;
    return animals - (today.arrivals + today.births - today.deaths);
}
