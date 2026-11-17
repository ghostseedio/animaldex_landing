/**
 * The photo that brought an Ark animal aboard (docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2; owner, 2026-11-15:
 * "on web I think we should pull the corresponding capture media too"). THE RULE: the server decides
 * (`voyage_animal_photo_v1`: a named founder's public capture, not suspended, not reported, a server-made
 * derivative); this only reads its answer. Its paths are this site's `/api/ark/photo/<animal id>/thumb|large`,
 * which sign the derivative on request. No capture id, user id, storage path or location ever reaches the page.
 *
 * An animal BORN on the Ark has no capture of its own (owner, 2026-11-17: "yes show parent capture but ensure
 * accurate", section 2.6): the server answers its own recorded ancestor's photo, of the same species, and says
 * whose it is: `relation` (parent | grandparent | great_grandparent) and `brought_by`, the ancestor's named
 * bringer. The Ark records no sex, so the relation is never "mother" or "father". The card must say, beside such
 * a photo, that it is the ancestor's and not this animal's; a photo it cannot attribute is no photo at all
 * (`decodeArkCapturePhoto` returns null for a relation without its bringer).
 *
 * Until the migration is applied the new read is missing: the routes fall back to the old one (the animal's own
 * photo only, `relation` absent = "self"), and a born animal answers null: the card is as it was.
 */

import {decodeArkFounder, type ArkFounder} from "@/lib/ark-founders";
import {isArkUuid} from "@/lib/ark-story";

export type ArkPhotoSize = {width: number | null; height: number | null; path: string};

/** Whose photo it is: the animal's own ("self": it arrived with this capture) or its recorded ancestor's (born on the Ark). */
export const ARK_PHOTO_RELATIONS = ["self", "parent", "grandparent", "great_grandparent"] as const;
export type ArkPhotoRelation = (typeof ARK_PHOTO_RELATIONS)[number];

/**
 * A photo: its card size (`thumb`, 640 px long edge) and its larger one (`large`, 1200 px), whose it is, how many
 * generations up (0 for "self"), and, for an ancestor's, who brought that ancestor aboard (null for "self": the card
 * already names the animal's own bringer). The keys are the server's, so a decoded photo decodes to itself.
 */
export type ArkCapturePhoto = {thumb: ArkPhotoSize; large: ArkPhotoSize; relation: ArkPhotoRelation; generation: number; brought_by: ArkFounder | null};

/** The photo is an ancestor's, not the animal's own. */
export function arkPhotoIsAncestors(photo: Pick<ArkCapturePhoto, "relation">): boolean {
    return photo.relation !== "self";
}

export const ARK_PHOTO_SIZES = ["thumb", "large"] as const;
export type ArkPhotoSizeKey = (typeof ARK_PHOTO_SIZES)[number];

export function isArkPhotoSize(value: unknown): value is ArkPhotoSizeKey {
    return value === "thumb" || value === "large";
}

/** This site's path for one size of an animal's photo. */
export function arkPhotoPath(animalId: string, size: ArkPhotoSizeKey): string {
    return `/api/ark/photo/${animalId}/${size}`;
}

function dimension(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10_000 ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * The server's answer, checked: both sizes, each path exactly this site's route for this animal (anything else is no
 * photo), dimensions only when sane; its relation (absent = the old read's own photo, "self") with the matching
 * generation, and for an ancestor's photo the ancestor's bringer (no bringer, no photo: it could not be labelled).
 * Null for anything else.
 */
export function decodeArkCapturePhoto(raw: unknown, animalId: string): ArkCapturePhoto | null {
    const row = record(raw);
    if (!row || !isArkUuid(animalId) || row.animal_id !== animalId) return null;
    const relation = row.relation === undefined ? "self" : ARK_PHOTO_RELATIONS.find((known) => known === row.relation);
    if (!relation) return null;
    const generation = ARK_PHOTO_RELATIONS.indexOf(relation);
    if (row.generation !== undefined && row.generation !== generation) return null;
    const broughtBy = relation === "self" ? null : decodeArkFounder(row.brought_by);
    if (relation !== "self" && !broughtBy) return null;
    const sizes: Partial<Pick<ArkCapturePhoto, "thumb" | "large">> = {};
    for (const key of ARK_PHOTO_SIZES) {
        const size = record(row[key]);
        if (!size || size.path !== arkPhotoPath(animalId, key)) return null;
        sizes[key] = {width: dimension(size.width), height: dimension(size.height), path: size.path};
    }
    return {thumb: sizes.thumb as ArkPhotoSize, large: sizes.large as ArkPhotoSize, relation, generation, brought_by: broughtBy};
}

/** The private read's storage object for one size (the signing route's only input): a capture bucket and a path. */
export type ArkPhotoObject = {bucket: string; path: string};

const CAPTURE_BUCKETS = new Set(["captures", "capture-media"]);
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;

/** `voyage_animal_capture_media_v1`'s object for `size`, checked (a capture bucket, a plain path), or null. */
export function arkPhotoObject(raw: unknown, size: ArkPhotoSizeKey): ArkPhotoObject | null {
    const object = record(record(raw)?.[size]);
    const bucket = typeof object?.bucket === "string" ? object.bucket : "";
    const path = typeof object?.path === "string" ? object.path : "";
    if (!CAPTURE_BUCKETS.has(bucket) || !SAFE_PATH.test(path) || path.includes("..") || path.includes("//")) return null;
    return {bucket, path};
}

/** Its box's aspect ratio (width / height), 4:3 when the server had no dimensions, clamped to 1:2 .. 2:1. */
export function arkPhotoAspect(size: Pick<ArkPhotoSize, "width" | "height"> | null | undefined): number {
    const ratio = size?.width && size.height ? size.width / size.height : 4 / 3;
    return Math.min(Math.max(ratio, 0.5), 2);
}
