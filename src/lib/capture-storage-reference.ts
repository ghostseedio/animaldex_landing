/**
 * Which storage objects the public capture image and video routes may sign.
 *
 * Those routes take a bucket and a path from the query string and sign them
 * with the service role, which can read every bucket in the project. Without a
 * check here the routes were a signing service for anything whose path could be
 * worked out — and owner folders are keyed by user id, which profiles display,
 * so a proof at `<user id>/animal-trials/<species>-low/clip.mp4` was one guess
 * away.
 *
 * Capture media lives in exactly two buckets, under `<owner id>/<capture id>/`.
 * Measured on production on 2026-09-29 across every reference the Discover
 * feed, trade history and challenge history carry (about 2,300): all of them
 * fit this shape, so nothing that renders today is refused.
 *
 * This decides what may be signed at all. It does not decide who may see a
 * given capture: a private capture's media is still reachable by somebody who
 * holds its exact path, which is two unguessable ids.
 */

/** The buckets `attach_capture_image_v1` accepts, which is every bucket capture media is written to. */
export const CAPTURE_MEDIA_BUCKETS = ["captures", "capture-media"] as const;

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A file or folder name: no separators, no traversal, nothing that needs decoding to understand. */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_PATH_LENGTH = 512;

export function isCaptureMediaBucket(bucket: string | null | undefined) {
    return (CAPTURE_MEDIA_BUCKETS as readonly string[]).includes(bucket?.trim() ?? "");
}

/**
 * True for `<owner id>/<capture id>/<file>` and nothing looser: both folders
 * must be ids, and what follows must be plain names.
 */
export function isCaptureMediaPath(path: string | null | undefined) {
    const value = path?.trim() ?? "";
    if (!value || value.length > MAX_PATH_LENGTH) return false;

    const segments = value.split("/");
    if (segments.length < 3 || segments.length > 5) return false;
    if (!UUID_SEGMENT.test(segments[0]) || !UUID_SEGMENT.test(segments[1])) return false;

    return segments.slice(2).every((segment) => SAFE_SEGMENT.test(segment) && !segment.includes(".."));
}

export function isServableCaptureMediaReference(
    bucket: string | null | undefined,
    path: string | null | undefined
) {
    return isCaptureMediaBucket(bucket) && isCaptureMediaPath(path);
}
