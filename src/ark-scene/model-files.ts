/**
 * Reading the model set's files (`models.ts`, `rig-player.ts`): what a failed read means, and when to ask again.
 * Pure, no three.js.
 *
 * A read fails in two ways. The file is not there or is not a model (an HTTP 4xx, a file that does not parse):
 * asking again cannot help, and the scene draws what it still has (the other level; with nothing, the placeholder
 * figure, owner decision A13). Or it only failed to arrive (the network dropped, a timeout, a busy or failing
 * server): that is asked for again, after a wait that grows, for as long as the scene wants the file. Before
 * 2026-11-14 both were answered the same way, once, for the whole visit: one dropped request for the manifest drew
 * every species as the clay placeholder figure, one for a far model that species, one for a near model left its
 * 600-triangle far model at close range.
 */

/** A file that did not arrive is asked for again after these waits (s), then every `RETRY_LATER_SECONDS`. */
const RETRY_SECONDS = [1, 3, 8, 20];
export const RETRY_LATER_SECONDS = 30;

/** The wait (s) before asking again, after `failures` failures in a row (1 for the first). */
export function retrySeconds(failures: number): number {
    return RETRY_SECONDS[Math.max(Math.floor(failures), 1) - 1] ?? RETRY_LATER_SECONDS;
}

/**
 * Whether an HTTP answer says the file is not there, so asking again cannot help (the bucket answers 400 or 404 for
 * a file it does not hold). A timeout (408), too early or too many requests (425, 429) and every 5xx may yet answer.
 */
export function finalStatus(status: number): boolean {
    return status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429;
}

/** A read that failed. `final`: the file is not there or is not a model; otherwise it only failed to arrive. */
export class ModelFileError extends Error {
    constructor(message: string, readonly final: boolean) {
        super(message);
        this.name = "ModelFileError";
    }
}

/** Whether a failed read is worth asking for again: anything but a `ModelFileError` marked final (a dropped connection is a plain TypeError). */
export function worthAskingAgain(error: unknown): boolean {
    return !(error instanceof ModelFileError && error.final);
}

/**
 * The model's own size from its `ark.json` (`extent`: the source mesh's width, height and length, the length 1), or
 * null. The same for both levels of detail, where their own bounding boxes differ: the far mesh has lost its thin
 * parts (an insect's legs and feelers, a butterfly's tails), so a size measured on it draws the animal too large.
 */
export function arkExtent(json: unknown): {x: number; y: number; z: number} | null {
    const extent = json && typeof json === "object" ? (json as {extent?: unknown}).extent : null;
    if (!Array.isArray(extent) || extent.length !== 3) return null;
    const [x, y, z] = extent as unknown[];
    if (![x, y, z].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) return null;
    return {x: x as number, y: y as number, z: z as number};
}
