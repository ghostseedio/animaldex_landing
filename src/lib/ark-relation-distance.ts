/**
 * Lane ARK-DIST: the distance chip at the middle of each relation line (`ark-scene/relation-lines.ts`). Owner: "on the
 * lines that show food chain and potential mates, can we show a distance figure too in the center of them".
 * Pure helpers so the unit tests run in `npm test` (src/lib); the drawing stays in the lazily loaded lines module.
 */

/** At most this many chips at once: the nearest lines'; the rest are left unlabelled so a crowd stays readable. */
export const ARK_DISTANCE_MAX_LABELS = 8;

/** A distance in metres as the chip says it, metric always: "12 m" under 1000 m, "1.4 km" from there, "14 km" from 10 km. */
export function formatArkDistance(metres: number): string {
    if (!Number.isFinite(metres) || metres < 0) return "";
    const m = Math.round(metres);
    if (m < 1000) return `${m} m`;
    const km = metres / 1000;
    if (km < 9.95) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}

/** The horizontal (ground) distance between two world points in metres: across islands too, height left out. */
export function arkHorizontalDistance(a: {x: number; z: number}, b: {x: number; z: number}): number {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Where the chip goes on a line drawn on screen from (ax, ay) to (bx, by): its middle, or null when a chip that wide
 * would touch either end's icon (radius `endR`, plus a small gap) — a short line keeps its ends clear and goes unlabelled.
 */
export function arkDistanceChipAt(ax: number, ay: number, bx: number, by: number, chipW: number, chipH: number, endR: number, out: {x: number; y: number}): boolean {
    const length = Math.hypot(bx - ax, by - ay);
    // (The chip's half-extent along the line, whatever its slant: the box's support in that direction.)
    const ux = length > 1e-6 ? Math.abs(bx - ax) / length : 1;
    const uy = length > 1e-6 ? Math.abs(by - ay) / length : 0;
    const half = (chipW / 2) * ux + (chipH / 2) * uy;
    if (length / 2 < half + endR + 4) return false;
    out.x = (ax + bx) / 2;
    out.y = (ay + by) / 2;
    return true;
}

/** Which of `count` lines get a chip: the `max` nearest by `distances` (ties keep their order); writes 1/0 into `keep`. */
export function arkNearestLabels(distances: ArrayLike<number>, count: number, max: number, keep: Uint8Array): void {
    for (let i = 0; i < count; i++) {
        keep[i] = 0;
        const d = distances[i];
        if (!Number.isFinite(d)) continue;
        let nearer = 0;
        for (let j = 0; j < count && nearer < max; j++) {
            const e = distances[j];
            if (Number.isFinite(e) && (e < d || (e === d && j < i))) nearer++;
        }
        keep[i] = nearer < max ? 1 : 0;
    }
}
