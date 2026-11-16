/**
 * Young with their real mother (3.3 batch, lane C; owner 2026-11-16: "young following and nursing their real mother").
 *
 * **Lineage.** The public snapshot's animals carry no parents (`voyage_public_v2` gives `origin`, `generation`,
 * `born_ark_day`, the parents' bringers' labels, never their ids), so until now a young one kept to a seeded adult of
 * its kind in its cluster (`ark-liveliness.ts` `pickParent`). The record does say who the parents are: every `birth`
 * event of the events read carries the young and its parents (`voyage_animals.parent_a`, `parent_b`). `Lineage` keeps
 * what the record's feed has said (this visit's births, and those of earlier visits on this device, kept in the
 * browser), and a young one whose birth it knows follows its recorded mother; any other keeps today's pick.
 * Which parent is the mother is the scene's drawn sex (the engine has none), else the record's first: the same rule as
 * the birth act (`live-births.ts`), so the young born in front of the viewer go on following the mother that bore them.
 *
 * What a server read would need to add for every viewer to agree on every young one: the two parent ids on each
 * Ark-born animal of the snapshot (`voyage_public_v2`'s `animals[]`: `'parents', jsonb_build_array(a.parent_a,
 * a.parent_b)` for `origin = 'born'`, as the engine's own state read already has). Nothing else: `setRecorded` below
 * takes exactly that.
 *
 * **Nursing.** A mammal's dependent young at its mother's heel comes to her flank to suckle in bouts: at most one in
 * each `NURSE_SLOT_MS` window of the shared clock, seeded by its id, so every viewer who has it following the same
 * adult sees the same bout. Only while she stands still (a bout she walks out of ends), never while it is carried.
 * The bouts' spacing and length are the scene's (how often to show it), not a species' stored figure.
 *
 * Pure: ids and the clock in, a place out. Nothing here decides a birth or touches the renderer.
 */

import {unit} from "@/lib/ark-clock";

/** At most one nursing bout in each window (ms). */
export const NURSE_SLOT_MS = 150_000;
/** The share of windows with a bout. */
const NURSE_CHANCE = 0.75;
/** A bout: the walk to her flank and back (ms each end), and the suckling between (ms). */
const NURSE_EASE_MS = 3_500;
const NURSE_MIN_MS = 26_000;
const NURSE_MORE_MS = 22_000;
/** Lineage kept on the device: the newest this many births. */
const KEPT = 400;

export type NurseBout = {
    /** 0 at heel … 1 at her flank. */
    level: number;
    /** At the flank, suckling (its nose under her belly). */
    suckling: boolean;
    /** The bout's own key (the log says it once). */
    key: string;
};

const smooth = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};

/** The model plans whose young suckle at the flank (`ark.json` behaviour.plan; a whale's calf nurses under water, not drawn). */
export function nurses(plan: string | null | undefined): boolean {
    return plan === "mammal";
}

/** The young one's nursing bout at `ms` of the shared clock, or null between bouts. */
export function nursingBout(youngId: string, ms: number): NurseBout | null {
    const slot = Math.floor(ms / NURSE_SLOT_MS);
    if (unit(youngId, "nurse", slot) >= NURSE_CHANCE) return null;
    const length = NURSE_EASE_MS * 2 + NURSE_MIN_MS + NURSE_MORE_MS * unit(youngId, "nurse-long", slot);
    const start = slot * NURSE_SLOT_MS + (NURSE_SLOT_MS - length) * unit(youngId, "nurse-at", slot);
    const s = ms - start;
    if (s < 0 || s >= length) return null;
    const level = Math.min(smooth(s / NURSE_EASE_MS), smooth((length - s) / NURSE_EASE_MS));
    return {level, suckling: s >= NURSE_EASE_MS && s <= length - NURSE_EASE_MS, key: `nurse:${youngId}:${slot}`};
}

/** How far the suckling young is turned in toward her from facing straight back along her (rad). */
const NURSE_TURN = 0.9;

/**
 * Where it suckles: beside her on its own seeded side, facing back along her and turned in, so its nose is under her
 * belly just ahead of her hind legs. Placed by both bodies' drawn lengths (a newborn a third of her length stands as
 * close as one nearly grown): its nose at her flank (0.12 of her length out from her middle line, a fifth of her
 * length behind her middle), its body half its own length back from there along its heading.
 */
export function nursePlace(youngId: string, mother: {x: number; z: number; yaw: number; length: number}, youngLength: number): {x: number; z: number; yaw: number} {
    const side = unit(youngId, "nurse-side") < 0.5 ? -1 : 1;
    const L = Math.max(mother.length, 0.05);
    const l = Math.min(Math.max(youngLength, 0.02), L);
    const fx = Math.sin(mother.yaw);
    const fz = Math.cos(mother.yaw);
    const rx = fz * side;
    const rz = -fx * side;
    // Its heading: back along her, turned in toward her.
    const hx = -fx * Math.cos(NURSE_TURN) - rx * Math.sin(NURSE_TURN);
    const hz = -fz * Math.cos(NURSE_TURN) - rz * Math.sin(NURSE_TURN);
    const nose = {x: mother.x + rx * L * 0.12 - fx * L * 0.2, z: mother.z + rz * L * 0.12 - fz * L * 0.2};
    return {x: nose.x - hx * l * 0.5, z: nose.z - hz * l * 0.5, yaw: Math.atan2(hx, hz)};
}

/** From its heel place to her flank by the bout's level (the heading turned the short way). */
export function nurseBlend<P extends {x: number; z: number; yaw: number}>(heel: P, flank: {x: number; z: number; yaw: number}, level: number): {x: number; z: number; yaw: number} {
    let d = flank.yaw - heel.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return {x: heel.x + (flank.x - heel.x) * level, z: heel.z + (flank.z - heel.z) * level, yaw: heel.yaw + d * level};
}

/**
 * How far its place beside her moves when she turns by `turn` (rad, the scene's yaw: a heading of (sin, cos)) where she
 * stands: (dx, dz) its offset from her before the turn. Returns the change in that offset.
 */
export function nurseTurn(dx: number, dz: number, turn: number): [number, number] {
    if (!turn) return [0, 0];
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    return [dx * c + dz * s - dx, -dx * s + dz * c - dz];
}

/** The mother among a young one's recorded parents: the one drawn female, else one not drawn male, else the record's first. */
export function motherAmong(parents: readonly string[], male: (id: string) => boolean | null | undefined, aboard: (id: string) => boolean = () => true): string | null {
    const here = parents.filter((id) => id && aboard(id));
    return here.find((id) => male(id) === false) ?? here.find((id) => male(id) !== true) ?? here[0] ?? null;
}

type Store = {get: () => string | null; set: (text: string) => void};

/** Who the record says each young one's parents are. */
export class Lineage {
    private readonly parents = new Map<string, string[]>();

    /** `store`: the device's memory of earlier visits (the browser's storage), read once; null for this visit only. */
    constructor(private readonly store: Store | null = null) {
        try {
            const kept = JSON.parse(store?.get() ?? "[]") as unknown;
            if (Array.isArray(kept)) for (const row of kept) if (Array.isArray(row) && row.length >= 2 && row.every((id) => typeof id === "string" && id.length < 64)) this.parents.set(row[0], row.slice(1, 3));
        } catch {
            // (Nothing kept, or not ours: this visit's births only.)
        }
    }

    get size(): number {
        return this.parents.size;
    }

    /** A birth of the record: the young and their parents. True when it told something new. */
    note(young: readonly string[], parents: readonly string[]): boolean {
        const known = parents.filter((id) => typeof id === "string" && id).slice(0, 2);
        if (!known.length) return false;
        let fresh = false;
        for (const id of young) {
            if (!id || known.includes(id)) continue;
            const before = this.parents.get(id);
            if (before && before.join() === known.join()) continue;
            // (Newest last: the oldest are the first forgotten.)
            this.parents.delete(id);
            this.parents.set(id, known);
            fresh = true;
        }
        if (!fresh) return false;
        while (this.parents.size > KEPT) this.parents.delete(this.parents.keys().next().value as string);
        try {
            this.store?.set(JSON.stringify(Array.from(this.parents, ([id, p]) => [id, ...p])));
        } catch {
            // (Storage full or blocked: this visit only.)
        }
        return true;
    }

    /** The parents a server read gave for every Ark-born animal (when the snapshot carries them): the record itself. */
    setRecorded(rows: ReadonlyArray<{id: string; parents?: readonly string[] | null}>): void {
        for (const row of rows) if (row.parents?.length) this.note([row.id], row.parents);
    }

    parentsOf(youngId: string): readonly string[] | null {
        return this.parents.get(youngId) ?? null;
    }

    /** Its recorded mother, among the parents still aboard; null when the record has not said (today's pick then). */
    motherOf(youngId: string, male: (id: string) => boolean | null | undefined, aboard: (id: string) => boolean): string | null {
        const parents = this.parents.get(youngId);
        return parents ? motherAmong(parents, male, aboard) : null;
    }
}
