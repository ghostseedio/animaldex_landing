/**
 * MATE-FINDING in the live log (AnimalDex decision 432, docs/ark/mate-finding.md): the record's `mate_found` rows, a wild
 * animal that travelled to a far partner ("A Geometer Moth travelled 220 m to find a mate"), and the trips the scene acts
 * out (`live-journeys.ts`). The engine decides the find and moves the home; this only says it and hands the trip on. No
 * person: the row carries none.
 *
 * Read here from the server's rows as they come, with their own words (as `release-lines.ts`): with the scene, never in
 * the Ark page's static JavaScript.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";

const ENGLISH = "{aAnimal} travelled {distance} m to find a mate";

export type JourneyWay = "air" | "water" | "ground";
export type Journey = {key: string; id: string; from: {x: number; z: number}; to: {x: number; z: number}; distance: number; way: JourneyWay; t0: number};

type Animal = {id?: unknown; name?: unknown; species_profile_id?: unknown; model_slug?: unknown; zone?: unknown};
type Row = {id?: unknown; kind?: unknown; at?: unknown; animal?: Animal | null; journey?: unknown};

const rowsOf = (raw: unknown): Row[] => (Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as {events?: unknown}).events) ? (raw as {events: Row[]}).events : []);
const point = (p: unknown): {x: number; z: number} | null => {
    const o = p && typeof p === "object" ? (p as Record<string, unknown>) : null;
    return o && typeof o.x === "number" && typeof o.z === "number" && Number.isFinite(o.x) && Number.isFinite(o.z) ? {x: o.x, z: o.z} : null;
};

/** A trip's metres as said: to the nearest 10 m (5 m under 50). Pure. */
export function journeyMetres(distance: number): number {
    return distance < 50 ? Math.max(5, Math.round(distance / 5) * 5) : Math.round(distance / 10) * 10;
}

/** The rows' trips: `mate_found` with a usable `journey` (from and to in metres), at or after `from` (ms). Pure. */
export function journeysOf(raw: unknown, from = -Infinity): Journey[] {
    const out: Journey[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object" || row.kind !== "mate_found") continue;
        const j = row.journey && typeof row.journey === "object" ? (row.journey as Record<string, unknown>) : null;
        const a = point(j?.from), b = point(j?.to);
        const id = typeof row.animal?.id === "string" ? row.animal.id : null;
        const t0 = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        if (!j || !a || !b || !id || !Number.isFinite(t0) || t0 < from) continue;
        const way: JourneyWay = j.way === "air" || j.way === "water" ? j.way : "ground";
        const distance = typeof j.distance === "number" && j.distance > 0 ? j.distance : Math.hypot(b.x - a.x, b.z - a.z);
        out.push({key: `mate_found:${String(row.id)}`, id, from: a, to: b, distance, way, t0: t0 / 1000});
    }
    return out;
}

/** The rows' finds as log items, oldest first. `from` (ms): none older; `said`: ids already said. */
export function mateItems(raw: unknown, from: number, said: (key: string) => boolean): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const row of rowsOf(raw)) {
        if (!row || typeof row !== "object" || row.kind !== "mate_found") continue;
        const id = `event:${String(row.id)}`;
        const at = typeof row.at === "string" ? Date.parse(row.at) : NaN;
        const animal = row.animal;
        const name = animal && typeof animal.name === "string" && animal.name ? animal.name.slice(0, 120) : "";
        const j = row.journey && typeof row.journey === "object" ? (row.journey as Record<string, unknown>) : null;
        const distance = typeof j?.distance === "number" && j.distance > 0 ? j.distance : NaN;
        if (!animal || !name || !Number.isFinite(at) || at < from || !Number.isFinite(distance) || said(id)) continue;
        const species = typeof animal.species_profile_id === "string" && animal.species_profile_id ? animal.species_profile_id : `slug:${String(animal.model_slug ?? "")}`;
        const zone = typeof animal.zone === "string" ? (animal.zone as ArkLiveItem["focus"]["zone"]) : null;
        // (Its queue place and dot are an arrival's: it has come to its partner. `count` carries the metres as said.)
        items.push({id, kind: "arrival", say: "mate_found", source: "server", key: `mate_found:${String(row.id)}`, animal: name, other: null, count: journeyMetres(distance), eggs: null, focus: {animalId: typeof animal.id === "string" ? animal.id : null, speciesId: species, zone}});
    }
    return items;
}

/** A find's line words, or null for any other line. */
export function mateText(line: Pick<ArkLiveItem, "animal" | "count"> & Partial<Pick<ArkLiveItem, "say">>, words: ArkLiveText): string | null {
    if (line.say !== "mate_found") return null;
    const text = fillArkWords(words.live.mateFound ?? ENGLISH, {aAnimal: arkWithArticle(line.animal, words), distance: String(line.count)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
