/**
 * Rich events in the live log and the animals' own logs (AnimalDex decision 434, "the more variety in event logs the
 * better"; AnimalDex docs/ark/dung-and-logs.md). The server writes these while its `rich_events` switch is on:
 *   grown_up, grew_old            one animal (born aboard and now adult; past most of its own life)
 *   breeding_season               a kind (its stored breeding months begin, two or more aboard)
 *   carer_left, new_carer         a kept animal's place (its carer left for a few days; the new one started)
 *   grazed_bare, regrown          the kind that grazes a patch most (its ground grazed bare; green again)
 *   ate_dung                      a dung user fed on fresh dung today (one a day, a different one each day)
 * and adds facts to rows it already writes: `mated.first` (which of the pair had no litter aboard before), `mated.waited`
 * and `mated.waiter` (Ark days one of the pair waited for a mate, and which), `fed.food = "dung"` (a dung user's hunger ended on fresh dung). The server decides every one; this only says
 * them, from the row's kind, its animal and its species (no payload is sent for the new kinds), in the reader's words
 * (`ark.live`, 45 languages), English under a missing one.
 *
 * Read here from the server's rows as they come (as `escape-lines.ts`): with the scene, never in the Ark page's static
 * JavaScript. Each line is sent pre-said in `line` (signature-lines' path: said as it is).
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import type {ArkRecordNote} from "@/lib/ark-animal-status";
import {pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";

const RICH_KEYS = ["grownUp", "grewOld", "breedingSeason", "carerLeft", "newCarer", "grazedBare", "regrown", "matedFirst", "foundMate", "foundDung"] as const;
/** English, as `en.json` has it (`ark-live-words.ts`). */
export const ARK_RICH_ENGLISH = Object.fromEntries(RICH_KEYS.map((key) => [key, ARK_LIVE_ENGLISH[key]!])) as Record<(typeof RICH_KEYS)[number], string>;
export type ArkRichKey = keyof typeof ARK_RICH_ENGLISH;

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; ark_day?: unknown; species?: unknown; species_profile_id?: unknown; animal?: Animal | null; other?: Animal | null; parents?: unknown; first?: unknown; waited?: unknown; waiter?: unknown; food?: unknown};

/** The new kinds: which words, whose line (one animal, or a kind), and whether it is good news (its dot). */
const KINDS: Record<string, {key: ArkRichKey; kind: boolean; good: boolean}> = {
    grown_up: {key: "grownUp", kind: false, good: true},
    grew_old: {key: "grewOld", kind: false, good: false},
    breeding_season: {key: "breedingSeason", kind: true, good: true},
    carer_left: {key: "carerLeft", kind: false, good: false},
    new_carer: {key: "newCarer", kind: false, good: true},
    grazed_bare: {key: "grazedBare", kind: true, good: false},
    regrown: {key: "regrown", kind: true, good: true},
    ate_dung: {key: "foundDung", kind: false, good: true}
};

const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal) => (typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`);
const rowsOf = (raw: unknown): Row[] => (Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : []);
const capital = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);
const isEnglish = (locale: string) => /^en(\b|[-_])/i.test(locale) || locale.toLowerCase() === "en";

/** One line's words: an animal's or a kind's, the reader's `ark.live` words over English. */
export function arkRichText(key: ArkRichKey, name: string, words: ArkLiveText, locale: string, days?: number): string {
    const live = words.live as unknown as Partial<Record<ArkRichKey, string>>;
    return capital(fillArkWords(live[key] || ARK_RICH_ENGLISH[key], {aAnimal: arkWithArticle(name, words), animals: isEnglish(locale) ? pluralAnimalName(name) : name, days: (days ?? 0).toLocaleString(locale)}));
}

/** What one row says: its words key, who, and the days (a found mate), or null for a row that is not one of these. */
function said(row: Row): {key: ArkRichKey; name: string; animal: Animal | null; good: boolean; days?: number} | null {
    const kind = typeof row.kind === "string" ? row.kind : "";
    const spec = KINDS[kind];
    if (spec) {
        const name = spec.kind ? (typeof row.species === "string" ? row.species.slice(0, 120) : named(row.animal)) : named(row.animal);
        return name ? {key: spec.key, name, animal: spec.kind ? null : row.animal ?? null, good: spec.good} : null;
    }
    if (kind === "mated" && typeof row.waited === "number" && row.waited > 0) {
        const who = row.waiter && row.other && row.waiter === row.other.id ? row.other : row.animal;
        return named(who) ? {key: "foundMate", name: named(who), animal: who ?? null, good: true, days: Math.round(row.waited)} : null;
    }
    if (kind === "fed" && row.food === "dung" && named(row.animal)) return {key: "foundDung", name: named(row.animal), animal: row.animal ?? null, good: true};
    return null;
}

/** The rows' rich events as log items, oldest first. `from` (ms): none older; `seen`: ids already said. */
export function richItems(raw: unknown, from: number, seen: (key: string) => boolean, words: ArkLiveText, locale: string): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object") continue;
        const what = said(row);
        if (!what) continue;
        const id = `rich:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at) || at < from || seen(id)) continue;
        const a = what.animal;
        const speciesId = a ? speciesOf(a) : typeof row.species_profile_id === "string" ? row.species_profile_id : null;
        const zone = a && typeof a.zone === "string" ? (a.zone as ArkLiveItem["focus"]["zone"]) : null;
        items.push({
            id, kind: what.good ? "revived" : "gone", source: "server", key: `rich:${String(row.kind)}:${speciesId ?? what.name}`,
            animal: what.name, other: null, count: 1, eggs: null, line: arkRichText(what.key, what.name, words, locale, what.days),
            focus: {animalId: a && typeof a.id === "string" ? a.id : null, speciesId, zone}
        });
    }
    return items;
}

/** The rows' rich lines for the animals they are about (their own logs on the tap card): said, with their words. */
export function richNotes(raw: unknown, words: ArkLiveText, locale: string): ArkRecordNote[] {
    const notes: ArkRecordNote[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object") continue;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at)) continue;
        const day = typeof row.ark_day === "number" ? Math.floor(row.ark_day) : null;
        // A first litter: that parent's own "mated" line says it was its first (the plain line's id, which it replaces).
        if (row.kind === "mated" && Array.isArray(row.first)) {
            for (const a of [row.animal, row.other]) {
                const id = a && typeof a.id === "string" ? a.id : null;
                if (id && row.first.includes(id) && named(a)) notes.push({animalId: id, id: `mated:${String(row.id)}:${id}`, kind: "said", at, day, text: arkRichText("matedFirst", named(a), words, locale)});
            }
        }
        const what = said(row);
        const id = what?.animal && typeof what.animal.id === "string" ? what.animal.id : null;
        if (!what || !id) continue;
        notes.push({animalId: id, id: `rich:${String(row.id)}`, kind: "said", at, day, text: arkRichText(what.key, what.name, words, locale, what.days)});
    }
    return notes;
}
