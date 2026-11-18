/**
 * Release to the Wild in the live log (AnimalDex P1-8, docs/ark/release-p1-8.md): the record's `released` events, an
 * owner's zoo animal moved to live free ("A Eurasian Lynx was released into the wild"). The server writes every one, in
 * the transaction that moves the animal; this only says it. No person and no price: the event carries neither. A tap
 * flies to the animal: it is alive, and by the next read it is drawn where it lives now.
 *
 * Read here from the server's rows as they come, with their own words (as `escape-lines.ts`): with the scene, never in
 * the Ark page's static JavaScript.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";

const ENGLISH = "{aAnimal} was released into the wild";

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; animal?: Animal | null};

/** The rows' releases as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function releaseItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const rows: Row[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
    const items: ArkLiveItem[] = [];
    for (const row of rows) {
        if (!row || typeof row !== "object" || row.kind !== "released") continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const animal = row.animal;
        const name = animal && typeof animal.name === "string" && animal.name ? animal.name.slice(0, 120) : "";
        if (!animal || !name || !Number.isFinite(at) || at < from || said(id)) continue;
        const species = typeof animal.species_profile_id === "string" && animal.species_profile_id ? animal.species_profile_id : `slug:${String(animal.model_slug ?? "")}`;
        const zone = typeof animal.zone === "string" ? (animal.zone as ArkLiveItem["focus"]["zone"]) : null;
        // (Its place in the queue and its dot are an arrival's: it has come to the wild. Its words are its own, `say`.)
        items.push({id, kind: "arrival", say: "released", source: "server", key: `released:${String(row.id)}`, animal: name, other: null, count: 1, eggs: null, focus: {animalId: typeof animal.id === "string" ? animal.id : null, speciesId: species, zone}});
    }
    return items;
}

/** A release line's words, or null for any other line. */
export function releaseText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText): string | null {
    if (line.say !== "released") return null;
    const text = fillArkWords(words.live.released ?? ENGLISH, {aAnimal: arkWithArticle(line.animal, words)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
