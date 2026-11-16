/**
 * Escapes in the live log (AnimalDex decision 373; handover §5: "'x is hunting y', 'y ran away'"): the record's
 * `escaped` events, a prey animal that got away from a predator's attempt ("A Plains Zebra got away from an African
 * Lion"). The server decides every one, from the predator kind's published hunting success rate; this only says it.
 * A tap flies to the one that got away: it is alive.
 *
 * Read here from the server's rows as they come, with their own words (as `dormancy-lines.ts`): with the scene, never
 * in the Ark page's static JavaScript.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";

const ENGLISH = "{aPrey} got away from {aPredator}";

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; animal?: Animal | null; other?: Animal | null};

const named = (a: Animal | null | undefined) => (a && typeof a.name === "string" && a.name ? a.name.slice(0, 120) : "");
const speciesOf = (a: Animal) => (typeof a.species_profile_id === "string" && a.species_profile_id ? a.species_profile_id : `slug:${String(a.model_slug ?? "")}`);

/** The rows' escapes as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function escapeItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const rows: Row[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
    const items: ArkLiveItem[] = [];
    for (const row of rows) {
        if (!row || typeof row !== "object" || row.kind !== "escaped") continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const prey = named(row.animal);
        const predator = named(row.other);
        if (!prey || !predator || !Number.isFinite(at) || at < from || said(id)) continue;
        const zone = typeof row.animal!.zone === "string" ? (row.animal!.zone as ArkLiveItem["focus"]["zone"]) : null;
        // (Its place in the queue and its dot are a return's: it lives. Its words are its own, `say`.)
        items.push({id, kind: "revived", say: "escaped", source: "server", key: `escaped:${speciesOf(row.animal!)}:${speciesOf(row.other!)}`, animal: prey, other: predator, count: 1, eggs: null, focus: {animalId: typeof row.animal!.id === "string" ? row.animal!.id : null, speciesId: speciesOf(row.animal!), zone}});
    }
    return items;
}

/** An escape line's words, or null for any other line. */
export function escapeText(line: Pick<ArkLiveItem, "animal" | "other"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText): string | null {
    if (line.say !== "escaped" || !line.other) return null;
    const text = fillArkWords(words.live.escaped ?? ENGLISH, {aPrey: arkWithArticle(line.animal, words), aPredator: arkWithArticle(line.other, words)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
