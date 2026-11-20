/**
 * The cast (V2 replay, AnimalDex docs/ark/audits/ecosystem-audit-2026-11-18.md §2.4 and §7, decision 389): the animals
 * an act names, always in the scene and always drawn while the act needs them.
 *
 * Two things, and nothing else:
 *
 * - STAND-INS. An act of the record names animals by id. Some are not in the Ark's read now: dead of old age, eaten,
 *   starved, recovering, released to the other island. For each of those the cast adds a stand-in to the roster the
 *   scene lays out, made from the server's own record of it in the event (`voyage_event_animal`: its species, model,
 *   zone, slot, area, island), so it stands where it stood, has its own day (its schedule is a pure function of the
 *   clock and its id) and is found by every live layer (`live-matings`, `live-births`, `live-escapes`, `live-meals`,
 *   `live-deaths`) exactly as a living animal is. Before, only an eaten prey had a stand-in (`live-meals` ghost), so
 *   a mating of a pair one of which has since died could not be acted at all.
 * - PINS. Every cast id is pinned: it is one of the animals drawn one by one whatever the herds (A14), the live
 *   budget (200 on the low tier) and the render distance (440 m on the low tier) would otherwise do, exactly as the
 *   selected animal and a replay's animals already are (`selection.ts` selectionPins, the frame's `pinnedNow`).
 *
 * The scene never loads this file. Whoever needs a cast (the recorder's replay, V1's live acts) loads it and hands it
 * to the scene with `handle.setCast(cast)`; the scene asks it for the roster each time it lays the animals out
 * (`ArkCastLayer`, types.ts). Pure apart from that one call: no three.js, no DOM, so it is tested in Node.
 *
 * The cast never decides anything: who is in it comes from the record. A stand-in is never counted (the counts are
 * the server's), never selectable as "yours", and gone again when its group is released.
 */

import type {ArkAnimal, ArkArea, ArkCastLayer, ArkIsland, ArkSnapshot} from "@/ark-scene/types";
import type {ArkEventAnimal} from "@/lib/ark-life";

/** An animal as an event names it, with the two fields the public read adds that `ArkEventAnimal` does not carry. */
export type ArkCastRecord = ArkEventAnimal & {island?: ArkIsland | null; enclosure?: string | null};

/** The little of the scene the cast needs: only `setCast`. */
export type ArkCastHost = {setCast?: (cast: ArkCastLayer | null) => void};

export type ArkCastGroup = {
    /** Everyone the act names (all are pinned). */
    records: ArkCastRecord[];
    /** Ids with the soft "last of its kind" ring under them. */
    marks: string[];
};

/** Kept areas are the town's (types.ts `ArkArea`); wildlife says its island itself, else it lives on the wild island. */
function islandOf(record: ArkCastRecord): ArkIsland | null {
    if (record.island === "town" || record.island === "wild") return record.island;
    const area: ArkArea | null | undefined = record.area;
    return area === "house" || area === "farm" || area === "zoo" ? "town" : null;
}

/**
 * A stand-in for an animal that is not in the read: the server's record of it as a roster animal. Never "mine", no
 * bringer (the record's event rows carry labels, never a user id, and a stand-in shows none).
 */
export function standInAnimal(record: ArkCastRecord): ArkAnimal {
    return {
        id: record.id,
        species_profile_id: record.species_profile_id,
        name: record.name,
        scientific_name: null,
        model_slug: record.model_slug,
        zone: record.zone,
        arrived_at: record.arrived_at ?? "",
        brought_by: {label: "", named: false},
        mine: false,
        origin: record.origin ?? undefined,
        generation: record.generation ?? undefined,
        slot: record.slot,
        slot_rank: record.slot_rank,
        sociality: record.sociality,
        activity: record.activity,
        area: record.area ?? null,
        island: islandOf(record),
        enclosure: record.enclosure ?? null,
        thrive: record.thrive ?? null
    };
}

export class ArkCast implements ArkCastLayer {
    private readonly groups = new Map<string, ArkCastGroup>();
    private readonly pinned = new Set<string>();
    private readonly marked = new Set<string>();
    private asOf: {epoch: number; arkDay: number | null} | null = null;
    private version = 0;
    /** The roster made for a read, by the read (and each roster back to its read). */
    private made = new WeakMap<ArkSnapshot, {version: number; roster: ArkSnapshot; standIns: string[]}>();
    private sources = new WeakMap<ArkSnapshot, ArkSnapshot>();
    private last: {standIns: string[]; dropped: number} = {standIns: [], dropped: 0};

    /** `host`: the scene's handle (or nothing, in a test: `roster` is then called by hand). */
    constructor(private readonly host: ArkCastHost | null = null) {}

    readonly pins: ReadonlySet<string> = this.pinned;
    readonly marks: ReadonlySet<string> = this.marked;
    /** V1: a short line for a marked or pinned animal's selection box ("Last one in the wild", "Lone"); null: none. */
    label: ((id: string) => string | null) | undefined = undefined;
    /** ARK-MATING-SHOWN: a bar under the line (a clutch's countdown to its hatching); null: none. */
    progress: ((id: string) => {share: number; label: string} | null) | undefined = undefined;

    /**
     * Bring a group in under a key (an act's key, `mated:17873`): everyone it names is pinned, and whoever is not in
     * the read gets a stand-in. The same key again replaces the group. Nothing is laid out until `apply`.
     */
    bring(key: string, records: readonly ArkCastRecord[], options: {marks?: readonly string[]} = {}): this {
        const seen = new Set<string>();
        const unique = records.filter((record) => Boolean(record?.id) && !seen.has(record.id) && Boolean(seen.add(record.id)));
        this.groups.set(key, {records: unique, marks: [...(options.marks ?? [])].filter((id) => seen.has(id))});
        return this.changed();
    }

    /** A group's act is over: its stand-ins leave the roster and its pins go (ids another group names stay). */
    release(key: string): this {
        return this.groups.delete(key) ? this.changed() : this;
    }

    /** Every group gone, the clock's day too. */
    clear(): this {
        if (!this.groups.size && !this.asOf) return this;
        this.groups.clear();
        this.asOf = null;
        return this.changed();
    }

    /**
     * The roster as of a moment (a replay at an event's own time): whoever came aboard after it is left out (they were
     * not there), unless the cast names them, and the Ark's day is the event's (the young are young again). Null: the
     * read as it is.
     */
    setAsOf(epochSeconds: number | null, arkDay: number | null = null): this {
        this.asOf = epochSeconds === null || !Number.isFinite(epochSeconds) ? null : {epoch: epochSeconds, arkDay: arkDay !== null && Number.isFinite(arkDay) ? arkDay : null};
        return this.changed();
    }

    /** Hand the cast as it is now to the scene, which lays the roster out again (one layout for any number of changes). */
    apply(): this {
        this.host?.setCast?.(this);
        return this;
    }

    /** Take the cast out of the scene altogether (the roster is the read again). */
    detach(): void {
        this.groups.clear();
        this.asOf = null;
        this.changed();
        this.host?.setCast?.(null);
    }

    private changed(): this {
        this.version++;
        this.pinned.clear();
        this.marked.clear();
        this.groups.forEach((group) => {
            for (const record of group.records) this.pinned.add(record.id);
            for (const id of group.marks) this.marked.add(id);
        });
        return this;
    }

    /** Everyone the cast names, each once (the newest group's record of it). */
    records(): ArkCastRecord[] {
        const byId = new Map<string, ArkCastRecord>();
        this.groups.forEach((group) => {
            for (const record of group.records) byId.set(record.id, record);
        });
        return Array.from(byId.values());
    }

    /** `ArkCastLayer`: the roster for a read. The same object back for the same read while the cast has not changed. */
    roster(read: ArkSnapshot): ArkSnapshot {
        const source = this.sources.get(read) ?? read;
        const known = this.made.get(source);
        if (known && known.version === this.version) {
            this.last = {standIns: known.standIns, dropped: source.animals.length + known.standIns.length - known.roster.animals.length};
            return known.roster;
        }
        const records = this.records();
        const asOf = this.asOf;
        if (!records.length && !asOf) {
            this.last = {standIns: [], dropped: 0};
            return source;
        }
        // (A second's grace: a litter's rows and its young's `arrived_at` are the same instant, rounded differently.)
        const before = (animal: ArkAnimal) => {
            if (!asOf || this.pinned.has(animal.id)) return true;
            const at = Date.parse(animal.arrived_at);
            return !Number.isFinite(at) || at / 1000 <= asOf.epoch + 1;
        };
        const animals = asOf ? source.animals.filter(before) : source.animals;
        const aboard = new Set(animals.map((animal) => animal.id));
        const standIns = records.filter((record) => !aboard.has(record.id)).map(standInAnimal);
        const roster: ArkSnapshot = {...source, animals: standIns.length ? animals.concat(standIns) : animals, ...(asOf && asOf.arkDay !== null ? {ark_day: asOf.arkDay} : {})};
        const ids = standIns.map((animal) => animal.id);
        this.made.set(source, {version: this.version, roster, standIns: ids});
        this.sources.set(roster, source);
        this.last = {standIns: ids, dropped: source.animals.length - animals.length};
        return roster;
    }

    /** For the recorder's report and the tests: who stands in on the roster last made, and how many later arrivals it left out. */
    report(): {pins: string[]; standIns: string[]; dropped: number} {
        return {pins: Array.from(this.pinned), standIns: [...this.last.standIns], dropped: this.last.dropped};
    }
}

/** A cast on a scene (its `setCast`): the usual way in. One cast per scene. */
export function attachArkCast(handle: ArkCastHost): ArkCast {
    return new ArkCast(handle);
}
