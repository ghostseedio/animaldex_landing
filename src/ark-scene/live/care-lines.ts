/**
 * Gifts as Ark care in the live log and the animals' own logs (AnimalDex GIFTS-CARE, owner decision 387). The server
 * writes no new kind: a visitor's meal is a `fed` row with `source: "gift"`, a shelter that stopped a hunt is an
 * `escaped` row with `reason: "shelter"` (the predator is `other`), and a mating that used nesting help is a `mated`
 * row with `nest: true`. The public read never carries who gave it; the lines say "a visitor". Said in the reader's
 * words (`ark.live`, 45 languages), English under a missing one.
 *
 * A shelter's escape is said here, not as a plain escape (`escape-lines.ts` leaves it out); the scene still acts the
 * missed chase. Read with the scene, never in the Ark page's static JavaScript.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import type {ArkRecordNote} from "@/lib/ark-animal-status";
import {fillArkWords} from "@/lib/ark-words";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";

type CareKey = "giftMeal" | "giftShelter" | "giftNest";
type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; ark_day?: unknown; animal?: Animal | null; other?: Animal | null; source?: unknown; reason?: unknown; nest?: unknown};

const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal) => (typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`);
const rowsOf = (raw: unknown): Row[] => (Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : []);
const capital = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

/** Whether a row is a gift's care (and which words). */
export function careKey(row: Row | null | undefined): CareKey | null {
    if (!row || typeof row !== "object") return null;
    if (row.kind === "fed" && row.source === "gift") return "giftMeal";
    if (row.kind === "escaped" && row.reason === "shelter") return "giftShelter";
    if (row.kind === "mated" && row.nest === true) return "giftNest";
    return null;
}

/** One care line, in the reader's words over English. */
export function careText(key: CareKey, animal: string, other: string, words: ArkLiveText): string {
    const live = words.live as unknown as Partial<Record<CareKey, string>>;
    const template = live[key] || ARK_LIVE_ENGLISH[key]!;
    return capital(fillArkWords(template, {aAnimal: arkWithArticle(animal, words), aPrey: arkWithArticle(animal, words), aPredator: other ? arkWithArticle(other, words) : ""}));
}

function said(row: Row): {key: CareKey; animal: Animal; other: string} | null {
    const key = careKey(row);
    if (!key || !named(row.animal)) return null;
    if (key === "giftShelter" && !named(row.other)) return null;
    return {key, animal: row.animal!, other: named(row.other)};
}

/** The rows' care as log items, oldest first. `from` (ms): none older; `seen`: ids already said. */
export function careItems(raw: unknown, from: number, seen: (key: string) => boolean, words: ArkLiveText): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        const what = row && typeof row === "object" ? said(row) : null;
        if (!what) continue;
        const id = `care:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at) || at < from || seen(id)) continue;
        const a = what.animal;
        const name = named(a);
        items.push({
            id, kind: "revived", source: "server", key: `care:${what.key}:${speciesOf(a)}`, animal: name, other: null, count: 1, eggs: null,
            line: careText(what.key, name, what.other, words),
            focus: {animalId: typeof a.id === "string" ? a.id : null, speciesId: speciesOf(a), zone: typeof a.zone === "string" ? (a.zone as ArkLiveItem["focus"]["zone"]) : null}
        });
    }
    return items;
}

/** The rows' care lines for the animals they are about (their own logs on the tap card). */
export function careNotes(raw: unknown, words: ArkLiveText): ArkRecordNote[] {
    const notes: ArkRecordNote[] = [];
    for (const row of rowsOf(raw)) {
        const what = row && typeof row === "object" ? said(row) : null;
        const id = what && typeof what.animal.id === "string" ? what.animal.id : null;
        const at = typeof row?.at === "string" ? Date.parse(row.at) : NaN;
        if (!what || !id || !Number.isFinite(at)) continue;
        const day = typeof row.ark_day === "number" ? Math.floor(row.ark_day) : null;
        notes.push({animalId: id, id: `care:${String(row.id)}`, kind: "said", at, day, text: careText(what.key, named(what.animal), what.other, words)});
    }
    return notes;
}
