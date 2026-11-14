/**
 * Whether a new read of the Ark changes anything the scene lays out (mobile performance lane,
 * docs/ark/perf-audit-mobile-2026-11.md). The apps' panel reads the Ark every 45 s and the /ark page every few minutes;
 * each read is decoded into new objects, and the scene laid everything out again (every wild animal's place on the
 * main thread, the props' homes and nests, the schedules), even when nothing had changed: 21 s on a low phone the
 * first time (the map's sampler built on the main thread), about half a second each time after.
 *
 * Pure, no allocation: the decoder's output is plain JSON-shaped data.
 */

/** Deep equality of JSON-shaped values (objects, arrays, strings, numbers, booleans, null). */
export function sameJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
    const arrayA = Array.isArray(a);
    if (arrayA !== Array.isArray(b)) return false;
    if (arrayA) {
        const x = a as unknown[];
        const y = b as unknown[];
        if (x.length !== y.length) return false;
        for (let i = 0; i < x.length; i++) if (!sameJson(x[i], y[i])) return false;
        return true;
    }
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    let count = 0;
    for (const key in x) {
        if (!Object.prototype.hasOwnProperty.call(x, key)) continue;
        count++;
        if (!Object.prototype.hasOwnProperty.call(y, key) || !sameJson(x[key], y[key])) return false;
    }
    for (const key in y) if (Object.prototype.hasOwnProperty.call(y, key)) count--;
    return count === 0;
}

/** The Ark day's length (ms), as `src/lib/ark-clock.ts` counts it (14 a year). */
const ARK_DAY_MS = (86_400_000 * 14) / 365;

/**
 * How far (Ark days) a read's day may be from the one laid out before the read counts as new: 0.05 is ~2.7 minutes
 * of real time, far under anything the day moves (a nest's stage, a young animal's growth).
 */
export const ARK_READ_DAY_TOLERANCE = 0.05;

type ArkRead = {ark_day?: number | null; as_of?: string | null} & Record<string, unknown>;

/**
 * A new read lays out exactly as the one laid out already: every field the same (deep) but the read's own time
 * (`as_of`) and its day (`ark_day`), and the day moved less than `dayTolerance`, both as given (the young's ages) and as
 * carried forward from the read's time (the props' nests).
 */
export function sameArkRead(laid: ArkRead, read: ArkRead, dayTolerance = ARK_READ_DAY_TOLERANCE): boolean {
    if (laid === read) return true;
    const dayA = laid.ark_day;
    const dayB = read.ark_day;
    if (typeof dayA === "number" && typeof dayB === "number") {
        if (Math.abs(dayA - dayB) >= dayTolerance) return false;
        const atA = Date.parse(laid.as_of ?? "");
        const atB = Date.parse(read.as_of ?? "");
        if (Number.isFinite(atA) !== Number.isFinite(atB)) return false;
        if (Number.isFinite(atA) && Math.abs(dayA - atA / ARK_DAY_MS - (dayB - atB / ARK_DAY_MS)) >= dayTolerance) return false;
    } else if (dayA !== dayB) return false;
    let count = 0;
    for (const key in laid) {
        if (!Object.prototype.hasOwnProperty.call(laid, key) || key === "as_of" || key === "ark_day") continue;
        count++;
        if (!Object.prototype.hasOwnProperty.call(read, key) || !sameJson(laid[key], read[key])) return false;
    }
    for (const key in read) if (Object.prototype.hasOwnProperty.call(read, key) && key !== "as_of" && key !== "ark_day") count--;
    return count === 0;
}

/**
 * A host's pushed read lays out as the one it pushed before (graphics and performance pass, 2026-11). The apps' panel
 * is handed the whole Ark by its host (`ark:snapshot`) each time the host reads it, every 45 s, changed or not (the
 * iOS and Android apps released before the hosts learned to skip it will go on doing so): the page decoded all of
 * it into new objects and handed it to the list and the scene, to find there that nothing had changed (one task of
 * 53 to 99 ms on the phone profile at each push).
 *
 * The wire's shape, before decoding (the day is inside `voyage`): the same rule as `sameArkRead`, nothing decoded.
 * Walking 2 MB of it in one go is itself 27 to 59 ms on that profile, so the walk is cut into slices of `sliceMs`
 * with the page's frames in between (`pause`): an unchanged push costs no frame anything. The answer comes a few
 * frames later; a push that did change is decoded then.
 */
export type SlicedOptions = {sliceMs?: number; now?: () => number; pause?: () => Promise<void>; dayTolerance?: number};

export async function sameArkPush(before: unknown, next: unknown, options: SlicedOptions = {}): Promise<boolean> {
    if (before === next) return true;
    const row = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
    const a = row(before);
    const b = row(next);
    const voyageA = row(a?.voyage);
    const voyageB = row(b?.voyage);
    if (!a || !b || !voyageA || !voyageB) return false;
    // The read's own time and day first (`sameArkRead`'s rule, on those two alone), then everything else in slices.
    const time = (whole: Record<string, unknown>, voyage: Record<string, unknown>): ArkRead => ({ark_day: typeof voyage.ark_day === "number" ? voyage.ark_day : null, as_of: typeof whole.as_of === "string" ? whole.as_of : null});
    if (!sameArkRead(time(a, voyageA), time(b, voyageB), options.dayTolerance)) return false;
    const rest = (whole: Record<string, unknown>, voyage: Record<string, unknown>) => {
        const {ark_day: day, ...voyageRest} = voyage;
        const {as_of: at, ...wholeRest} = whole;
        void day;
        void at;
        return {...wholeRest, voyage: voyageRest};
    };
    return sameJsonSliced(rest(a, voyageA), rest(b, voyageB), options);
}

/** `sameJson`, a slice at a time: `sliceMs` of walking (3 by default), then the page's own work (`pause`), and so on. */
export async function sameJsonSliced(a: unknown, b: unknown, options: SlicedOptions = {}): Promise<boolean> {
    const sliceMs = options.sliceMs ?? 3;
    const now = options.now ?? (() => performance.now());
    const pause = options.pause ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    const stack: unknown[] = [a, b];
    let sliceFrom = now();
    let steps = 0;
    while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        if (++steps % 64 === 0 && now() - sliceFrom >= sliceMs) {
            await pause();
            sliceFrom = now();
        }
        if (x === y) continue;
        if (typeof x !== "object" || typeof y !== "object" || x === null || y === null) {
            if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) continue;
            return false;
        }
        const arrayX = Array.isArray(x);
        if (arrayX !== Array.isArray(y)) return false;
        if (arrayX) {
            const p = x as unknown[];
            const q = y as unknown[];
            if (p.length !== q.length) return false;
            for (let i = 0; i < p.length; i++) stack.push(p[i], q[i]);
            continue;
        }
        const p = x as Record<string, unknown>;
        const q = y as Record<string, unknown>;
        let count = 0;
        for (const key in p) {
            if (!Object.prototype.hasOwnProperty.call(p, key)) continue;
            count++;
            if (!Object.prototype.hasOwnProperty.call(q, key)) return false;
            stack.push(p[key], q[key]);
        }
        for (const key in q) if (Object.prototype.hasOwnProperty.call(q, key)) count--;
        if (count !== 0) return false;
    }
    return true;
}
