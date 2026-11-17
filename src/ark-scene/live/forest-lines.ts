/**
 * Logging's deaths in the live log and the live world (p5 humans; AnimalDex decision 379): the record's `deforested`
 * events, an Ark-born animal whose home the felling front reached ("A Sun Bear died: its forest was cut down"). The server
 * decides every one, from the shared forestry module and the animal's home; this only says it and lays its body where
 * the server judged it (the event's `payload.x`/`z`: inside the cleared stand). A tap flies to the body.
 *
 * Read here from the server's rows as they come, with their own words (as `escape-lines.ts`): with the scene, never in
 * the Ark page's static JavaScript. The rows' animals are decoded as a death's are (`decodeArkEvents` on the same row
 * read as a `death_old`), so the body and the line name it exactly as an old-age death would.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {decodeArkEvents, type ArkEventAnimal} from "@/lib/ark-life";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkSnapshot} from "@/ark-scene/types";

const ENGLISH = "{aAnimal} died: its forest was cut down";

type Row = {id?: unknown; kind?: unknown; at?: unknown; payload?: {x?: unknown; z?: unknown; standId?: unknown} | null};

function rowsOf(raw: unknown): Row[] {
    return Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
}

/** The rows' logging deaths: who, when (epoch s), and where the server judged its home. None older than `from` (ms). */
export function forestDeathRecords(raw: unknown, snapshot: ArkSnapshot | null, from: number): Array<{key: string; id: string; animal: ArkEventAnimal; t0: number; spot: {x: number; z: number} | null}> {
    const rows = rowsOf(raw).filter((row) => row && typeof row === "object" && row.kind === "deforested");
    if (!rows.length) return [];
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    const decoded = decodeArkEvents(rows.map((row) => ({...row, kind: "death_old"})), snapshot);
    const out: Array<{key: string; id: string; animal: ArkEventAnimal; t0: number; spot: {x: number; z: number} | null}> = [];
    for (const event of decoded) {
        const at = Date.parse(event.at);
        if (!event.animal || !Number.isFinite(at) || at < from) continue;
        const p = byId.get(String(event.id))?.payload;
        const x = Number(p?.x);
        const z = Number(p?.z);
        out.push({key: `death:${event.id}`, id: String(event.id), animal: event.animal, t0: at / 1000, spot: Number.isFinite(x) && Number.isFinite(z) ? {x, z} : null});
    }
    return out;
}

/** The rows' logging deaths as log items, oldest first (a death's place, dot and tap). */
export function forestItems(raw: unknown, snapshot: ArkSnapshot | null, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const d of forestDeathRecords(raw, snapshot, from)) {
        const id = `event:${d.id}`;
        if (said(id)) continue;
        items.push({id: d.id, kind: "death", say: "deforested", source: "server", key: `deforested:${d.animal.species_profile_id}`, animal: d.animal.name, other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: d.animal.species_profile_id, zone: d.animal.zone}});
    }
    return items;
}

/** A logging death's words, or null for any other line. */
export function forestText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText): string | null {
    if (line.say !== "deforested") return null;
    const text = fillArkWords(ENGLISH, {aAnimal: arkWithArticle(line.animal, words)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
