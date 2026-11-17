/**
 * The town's couples in the live log (p5 humans; AnimalDex decision 380): the record's `dated` and `moved_in` events
 * ("Two humans started dating", "Two humans moved in together"). The server decides every one (its courtship, slow as
 * the owner asked: "it should take a very long time (due to dating etc. like in real life)"); this only says it. No
 * names: a human in the Ark is a generic figure, never the person photographed. A parting is not said; a child's
 * birth is the record's own `birth` line.
 *
 * Read here from the server's rows as they come, with their own words (as `escape-lines.ts`): with the scene, never in
 * the Ark page's static JavaScript.
 */

import type {ArkLiveItem} from "@/lib/ark-live-log";

const WORDS: Record<string, string> = {dated: "Two humans started dating", moved_in: "Two humans moved in together"};

type Row = {id?: unknown; kind?: unknown; at?: unknown; species_profile_id?: unknown};

/** The rows' courtship events as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function humanItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const rows: Row[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
    const items: ArkLiveItem[] = [];
    for (const row of rows) {
        if (!row || typeof row !== "object" || typeof row.kind !== "string" || !WORDS[row.kind]) continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!Number.isFinite(at) || at < from || said(id)) continue;
        // (Its place in the queue and its dot are a pairing's. Its words are its own, `say`; no animal is named.)
        items.push({id, kind: "mated", say: row.kind as "dated" | "moved_in", source: "server", key: `${row.kind}:${String(row.id)}`, animal: "Human", other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: typeof row.species_profile_id === "string" ? row.species_profile_id : null, zone: "farm_garden"}});
    }
    return items;
}

/** A courtship line's words, or null for any other line. */
export function humanText(line: Partial<Pick<ArkLiveItem, "say">>): string | null {
    return line.say === "dated" || line.say === "moved_in" ? WORDS[line.say] : null;
}
