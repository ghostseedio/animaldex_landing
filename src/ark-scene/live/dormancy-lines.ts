/**
 * Dormancy in the live log (AnimalDex decision 370): the record's `dormant` and `woke` events, one per kind each
 * season ("Alpine Marmots have gone into their winter sleep", "Alpine Marmots are awake again"). Read here from the
 * server's rows as they come, and said with their own words, not through `ark-life.ts` / `ark-live-log.ts`: the Ark
 * page's static JavaScript is at its 200 KB budget (`ark-page-weight.test.ts`), and this loads with the scene.
 */

import type {ArkLiveItem, ArkLiveText} from "@/lib/ark-live-log";
import {pluralAnimalName} from "@/lib/ark-population";
import {fillArkWords} from "@/lib/ark-words";

const ENGLISH = {dormant: "{animals} have gone into their winter sleep", woke: "{animals} are awake again"} as const;

type Row = {id?: unknown; kind?: unknown; at?: unknown; species?: unknown; species_profile_id?: unknown};

/** The rows' dormancy events as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function dormancyItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const rows: Row[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
    const items: ArkLiveItem[] = [];
    for (const row of rows) {
        if (!row || typeof row !== "object" || (row.kind !== "dormant" && row.kind !== "woke")) continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const name = typeof row.species === "string" ? row.species.slice(0, 120) : "";
        if (!name || !Number.isFinite(at) || at < from || said(id)) continue;
        const speciesId = typeof row.species_profile_id === "string" ? row.species_profile_id : null;
        // (Its place in the queue and its dot are a return's or a going's; its words are its own, `say`.)
        items.push({id, kind: row.kind === "woke" ? "revived" : "gone", say: row.kind, source: "server", key: `${row.kind}:${speciesId ?? name}`, animal: name, other: null, count: 1, eggs: null, focus: {animalId: null, speciesId, zone: null}});
    }
    return items;
}

/** A dormancy line's words, or null for any other line. English names take their plural. */
export function dormancyText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText, locale: string): string | null {
    if (!line.say) return null;
    const english = /^en(\b|[-_])/i.test(locale) || locale.toLowerCase() === "en";
    return fillArkWords(words.live[line.say] ?? ENGLISH[line.say], {animals: english ? pluralAnimalName(line.animal) : line.animal});
}
