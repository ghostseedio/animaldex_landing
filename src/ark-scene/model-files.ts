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

// MARK: Every other read the scene makes (the ground's and the town's textures, the sky, trees, rocks, props, sound)

/**
 * Whether a failed read cannot be helped by asking again. A `ModelFileError` says so itself; three's loaders reject
 * with the HTTP answer (`error.response`) or pass on fetch's own TypeError for a dropped connection ("Failed to
 * fetch", Safari's "Load failed", Firefox's "NetworkError …"); anything else arrived and was not what was expected
 * (a file that does not parse, a picture that does not decode), or is the page going away (an abort).
 */
export function readIsFinal(error: unknown): boolean {
    if (error instanceof ModelFileError) return error.final;
    const status = (error as {response?: {status?: unknown}} | null | undefined)?.response?.status;
    if (typeof status === "number") return finalStatus(status);
    if (error instanceof TypeError) return !/fetch|network|load failed/i.test(error.message);
    return true;
}

/** `fetch`, with an answer that is not OK thrown as a `ModelFileError` (final or not by its status). */
export async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(url, init);
    if (!response.ok) throw new ModelFileError(`${url}: HTTP ${response.status}`, finalStatus(response.status));
    return response;
}

/**
 * A read made until it is in: one that only failed to arrive is made again after a wait that grows (`retrySeconds`),
 * for as long as `wanted()` says so. Rejects with the failure when it is final (`readIsFinal`) or no longer wanted,
 * so the caller's own "do without" stays as it was. Before 2026-11-14 every one of these reads was made once: a phone
 * changing from Wi-Fi to mobile data as the page loaded left the town unpaved, a kind of tree missing at one distance,
 * the sky or the sound absent, for the whole visit (`[ark] town paving Failed to fetch`, the Android web view).
 */
export async function readUntilIn<T>(label: string, read: () => Promise<T>, wanted: () => boolean = () => true, wait: (seconds: number) => Promise<void> = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))): Promise<T> {
    for (let failures = 1; ; failures++) {
        try {
            return await read();
        } catch (error) {
            if (readIsFinal(error) || !wanted()) throw error;
            console.warn(`[ark] ${label}`, error instanceof Error ? error.message : error, `(asked again in ${retrySeconds(failures)} s)`);
            await wait(retrySeconds(failures));
            if (!wanted()) throw error;
        }
    }
}

/**
 * A read tried once now and, if it only failed to arrive, again in the background until it is in. `use` takes what
 * was read either time (`late` true the second way). Resolves after the first try, in or not, so whatever waits for
 * a whole set (the trees' first picture) is not held up by one file that is slow to come.
 */
export function readNowOrLater<T>(label: string, read: () => Promise<T>, use: (value: T, late: boolean) => void, wanted: () => boolean = () => true): Promise<void> {
    return read()
        .then((value) => use(value, false))
        .catch((error: unknown) => {
            if (readIsFinal(error) || !wanted()) return;
            console.warn(`[ark] ${label}`, error instanceof Error ? error.message : error, `(asked again in ${retrySeconds(1)} s)`);
            void new Promise((resolve) => setTimeout(resolve, retrySeconds(1) * 1000))
                .then(() => readUntilIn(label, read, wanted))
                .then((value) => {
                    if (wanted()) use(value, true);
                })
                .catch(() => undefined);
        });
}
