/**
 * What the tap card says beside a photo that is NOT the animal's own (docs/ark/CAPTURE-MEDIA-CONTRACT.md section 2.6;
 * owner, 2026-11-17: "ensure accurate"): an animal born on the Ark shows its recorded ancestor's capture photo, and the
 * card must always make clear whose it is: "Born on the Ark · Photo of its parent, brought aboard by @ada". The Ark
 * records no sex, so it is never "mother" or "father". Pure, so the words and the guard are tested.
 */

import {arkPhotoIsAncestors, type ArkCapturePhoto, type ArkPhotoRelation} from "@/lib/ark-capture-photo";
import {arkHandle} from "@/lib/ark-founders";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/** English, key by key, for a bundle that lacks the keys (the loaders merge English in already; this is the last net). */
const FALLBACK: Record<Exclude<ArkPhotoRelation, "self">, string> = {
    parent: "Photo of its parent, brought aboard by {name}",
    grandparent: "Photo of its grandparent, brought aboard by {name}",
    great_grandparent: "Photo of its great-grandparent, brought aboard by {name}"
};

const KEY: Record<Exclude<ArkPhotoRelation, "self">, "fromParent" | "fromGrandparent" | "fromGreatGrandparent"> = {
    parent: "fromParent",
    grandparent: "fromGrandparent",
    great_grandparent: "fromGreatGrandparent"
};

/** The sentence for this relation, `{name}` still in it; null for the animal's own photo (nothing to say). */
export function arkPhotoFromTemplate(words: Pick<ArkWords, "photo">, relation: ArkPhotoRelation): string | null {
    if (relation === "self") return null;
    return words.photo[KEY[relation]] || FALLBACK[relation];
}

/** The whole label as plain text ("Born on the Ark · Photo of its parent, brought aboard by @ada"), or null for the animal's own photo. */
export function arkPhotoLabel(words: Pick<ArkWords, "photo" | "life">, photo: ArkCapturePhoto): string | null {
    const template = arkPhotoFromTemplate(words, photo.relation);
    if (!template || !photo.brought_by) return null;
    return `${words.life.bornAboard} · ${fillArkWords(template, {name: arkHandle(photo.brought_by)})}`;
}

/**
 * The photo this card may show: an ancestor's only on an animal born on the Ark (and then it has its bringer to name),
 * the animal's own only on one that arrived. Anything else is dropped rather than shown unlabelled.
 */
export function arkPhotoShownOn(photo: ArkCapturePhoto | null, born: boolean): ArkCapturePhoto | null {
    if (!photo) return null;
    if (arkPhotoIsAncestors(photo) !== born) return null;
    return born && !photo.brought_by ? null : photo;
}
