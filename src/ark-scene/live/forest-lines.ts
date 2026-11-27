/**
 * Logging's deaths in the live log and the live world (p5 humans; AnimalDex decision 379): the record's `deforested`
 * events, an animal whose home the felling front reached ("A Sun Bear died: its forest was cut down"). A carded one
 * (owner 2026-11-17) loses a heart as at an old-age death: its line carries the hearts left (`forest.lives`), as a
 * death's does, and the scene brings it back on its `revived` event. The server
 * decides every one, from the shared forestry module and the animal's home; this only says it and lays its body where
 * the server judged it (the event's `forest.x`/`z`: inside the cleared stand). A tap flies to the body.
 *
 * Read here from the server's rows as they come, with their own words (as `escape-lines.ts`): with the scene, never in
 * the Ark page's static JavaScript. The rows' animals are decoded as a death's are (`decodeArkEvents` on the same row
 * read as a `death_old`), so the body and the line name it exactly as an old-age death would.
 *
 * A heart is a survived attack (behind `hearts_escape`, docs/ark/hearts-escape.md): the same record, a `deforested` row whose
 * `lives` is not final, is a LOST HOME: the animal is away until its stand has grown back, and returns. Said that way ("A Sun
 * Bear lost its home: its forest was cut down · 2 ♥ left") and, since nothing died, with no body laid in the cleared stand.
 * With the switch off it is read as it always was.
 */

import {arkHeartsLeftText, arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {decodeArkEvents, type ArkEventAnimal} from "@/lib/ark-life";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkSnapshot} from "@/ark-scene/types";

const ENGLISH = "{aAnimal} died: its forest was cut down";
const ENGLISH_LOST = "{aAnimal} lost its home: its forest was cut down";

type Spot = {x?: unknown; z?: unknown; standId?: unknown; k?: unknown; until?: unknown; lives?: {heartsLeft?: unknown; final?: unknown} | null};
/** The server's row: the judged home in `forest` (`voyage_events_since_v1`), or in `payload` (the raw event). */
type Row = {id?: unknown; kind?: unknown; at?: unknown; forest?: Spot | null; payload?: Spot | null};

function rowsOf(raw: unknown): Row[] {
    return Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : [];
}

/** The rows' logging deaths: who, when (epoch s), and where the server judged its home. None older than `from` (ms). */
export function forestDeathRecords(raw: unknown, snapshot: ArkSnapshot | null, from: number): Array<{key: string; id: string; animal: ArkEventAnimal; t0: number; spot: {x: number; z: number} | null; hearts?: number}> {
    const rows = rowsOf(raw).filter((row) => row && typeof row === "object" && row.kind === "deforested");
    if (!rows.length) return [];
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    const decoded = decodeArkEvents(rows.map((row) => ({...row, kind: "death_old"})), snapshot);
    const out: Array<{key: string; id: string; animal: ArkEventAnimal; t0: number; spot: {x: number; z: number} | null; hearts?: number}> = [];
    for (const event of decoded) {
        const at = Date.parse(event.at);
        if (!event.animal || !Number.isFinite(at) || at < from) continue;
        const row = byId.get(String(event.id));
        const p = row?.forest ?? row?.payload;
        const x = Number(p?.x);
        const z = Number(p?.z);
        // A carded animal that recovers: the hearts its card has left (a final death says none, as a death's line does).
        const left = p?.lives && p.lives.final !== true ? Number(p.lives.heartsLeft) : NaN;
        out.push({key: `death:${event.id}`, id: String(event.id), animal: event.animal, t0: at / 1000, spot: Number.isFinite(x) && Number.isFinite(z) ? {x, z} : null, ...(Number.isFinite(left) ? {hearts: left} : {})});
    }
    return out;
}

/**
 * The rows' logging deaths as log items, oldest first (a death's place, dot and tap). `lost`: a heart is a survived attack
 * (`hearts_escape` on): one that recovers (its `lives` not final) is said as a lost home.
 */
export function forestItems(raw: unknown, snapshot: ArkSnapshot | null, from: number, said: (key: string) => boolean, lost = false): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const d of forestDeathRecords(raw, snapshot, from)) {
        const id = `event:${d.id}`;
        if (said(id)) continue;
        const home = lost && d.hearts !== undefined;
        items.push({id: d.id, kind: "death", say: "deforested", source: "server", key: `deforested:${d.animal.species_profile_id}`, animal: d.animal.name, other: null, count: 1, eggs: null, ...(d.hearts !== undefined ? {hearts: d.hearts} : {}), ...(home ? {lost: true as const} : {}), focus: {animalId: null, speciesId: d.animal.species_profile_id, zone: d.animal.zone}});
    }
    return items;
}

/** A logging death's words, or null for any other line; a carded one's hearts left after it, as a death's line has them. */
export function forestText(line: Pick<ArkLiveItem, "animal"> & Partial<Pick<ArkLiveItem, "say" | "hearts" | "lost">>, words: ArkLiveText, locale = "en"): string | null {
    if (line.say !== "deforested") return null;
    const said = fillArkWords(line.lost ? words.live?.lostHome ?? ENGLISH_LOST : ENGLISH, {aAnimal: arkWithArticle(line.animal, words)});
    const text = said ? said[0].toLocaleUpperCase() + said.slice(1) : said;
    if (typeof line.hearts !== "number") return text;
    return fillArkWords(words.live?.withHearts ?? "{line} · {hearts}", {line: text, hearts: arkHeartsLeftText(line.hearts, words, locale)});
}
