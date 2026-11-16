/**
 * The record's deaths in the live world (3.3 fix, owner 2026-11-16: "when it says an animal died of old age and i click
 * the log, it seems to zoom out and doesn't show any animal, i should see its corpse").
 *
 * A death is the server's (`death_old`, `starved` events): the scene never decides one. A dead animal has left the
 * roster, so the log's tap found nothing to select and fell back to its region. Here each death of the record is
 * remembered by its event, with where it died: where its schedule had it at the death's time (the schedule is a pure
 * function of the shared clock and its id, so every viewer who has its schedule puts it in the same place), and its
 * body is drawn there lying on its side, fading out after `DEATH_BODY_SECONDS`. The pose is a pure function of the
 * shared clock and the event (its fall, its side, its fade), the same for every viewer.
 *
 * The host gives where it was (`spotOf`) and a stand-in to draw (`ghost`, the meal acts' stand-ins for the eaten); the
 * module never touches the renderer.
 */

import type {ActPose} from "@/ark-scene/acts";
import type {ArkEventAnimal} from "@/lib/ark-life";

/** How long its body lies where it died (world seconds, about eight and a half Ark hours at the Ark's clock). */
export const DEATH_BODY_SECONDS = 20 * 60;
/** Its last stretch there, fading into the ground's haze (s). */
export const DEATH_FADE_SECONDS = 3 * 60;
/** Its fall onto its side at the death's time (s): seen only by a viewer watching at that moment. */
export const DEATH_FALL_SECONDS = 1.2;
/** Deaths remembered at most (the newest kept). */
const KEEP = 48;

/** Where it died: its feet's place on the ground, and how it was turned. */
export type DeathSpot = {x: number; z: number; base: number; yaw: number};

export type DeathRecord = {
    /** The event's key (`death:<event id>`): what the log's line taps by. */
    key: string;
    animal: ArkEventAnimal;
    /** The death's time on the shared clock (epoch s). */
    t0: number;
};

/** A seeded unit from a key (FNV-1a): the same for every viewer. */
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

const smooth = (k: number) => {
    const c = Math.min(Math.max(k, 0), 1);
    return c * c * (3 - 2 * c);
};

/** Whether its body is still there at a moment. */
export function deathBodyShowing(t0: number, epoch: number): boolean {
    return epoch >= t0 && epoch < t0 + DEATH_BODY_SECONDS;
}

/**
 * Its body at a moment, or null (before the death, or once it has faded): on its side (its side seeded by the event),
 * fallen over `DEATH_FALL_SECONDS` from the death's time, still, then fading over the last `DEATH_FADE_SECONDS`.
 */
export function deathBodyPose(spot: DeathSpot, key: string, t0: number, epoch: number): ActPose | null {
    if (!deathBodyShowing(t0, epoch)) return null;
    const u = epoch - t0;
    const side = unit(`${key}#side`) < 0.5 ? -1 : 1;
    const fade = smooth((u - (DEATH_BODY_SECONDS - DEATH_FADE_SECONDS)) / DEATH_FADE_SECONDS);
    return {x: spot.x, z: spot.z, base: spot.base, yaw: spot.yaw, pitch: 0, roll: 0, scale: 1, dim: fade, hidden: fade >= 0.999, state: "lie", speed: 0, lying: side * smooth(u / DEATH_FALL_SECONDS)};
}

export type LiveDeathsHost<E> = {
    /** Where it was at the death's time (its schedule's place), or null when the scene cannot know. */
    spotOf: (death: DeathRecord) => DeathSpot | null;
    /** A stand-in for it to draw (it has left the roster), or null. */
    ghost: (death: DeathRecord, spot: DeathSpot) => E | null;
    drop: (ghost: E) => void;
    setAct: (ghost: E, pose: ActPose | null) => void;
};

type Live<E> = DeathRecord & {spot: DeathSpot | null; asked: boolean; ghost: E | null};

/** The record's deaths: each one's place, and its body there while it lies. */
export class LiveDeaths<E> {
    private deaths: Live<E>[] = [];

    constructor(private readonly host: LiveDeathsHost<E>) {}

    /** Deaths remembered. */
    get size(): number {
        return this.deaths.length;
    }

    /** New deaths of the record (a key already known is ignored). */
    add(records: readonly DeathRecord[]) {
        for (const r of records) {
            if (!Number.isFinite(r.t0) || this.deaths.some((d) => d.key === r.key)) continue;
            this.deaths.push({...r, spot: null, asked: false, ghost: null});
        }
        this.deaths.sort((a, b) => a.t0 - b.t0);
        while (this.deaths.length > KEEP) {
            const gone = this.deaths.shift()!;
            if (gone.ghost) this.host.drop(gone.ghost);
        }
    }

    /** Where it died (worked out once, when first asked), or null when unknown. */
    spot(key: string): DeathSpot | null {
        const d = this.deaths.find((x) => x.key === key);
        return d ? this.place(d) : null;
    }

    /** The death's record by its key. */
    record(key: string): DeathRecord | null {
        return this.deaths.find((x) => x.key === key) ?? null;
    }

    private place(d: Live<E>): DeathSpot | null {
        if (!d.asked) {
            d.asked = true;
            d.spot = this.host.spotOf(d);
        }
        return d.spot;
    }

    /** A frame: each body's pose; a stand-in made while its body lies, dropped once it has faded. */
    step(epoch: number) {
        for (const d of this.deaths) {
            const showing = deathBodyShowing(d.t0, epoch);
            if (!showing) {
                if (d.ghost) {
                    this.host.drop(d.ghost);
                    d.ghost = null;
                }
                // (Its place is still worked out when its line is tapped.)
                continue;
            }
            const spot = this.place(d);
            if (!spot) continue;
            d.ghost ??= this.host.ghost(d, spot);
            if (d.ghost) this.host.setAct(d.ghost, deathBodyPose(spot, d.key, d.t0, epoch));
        }
    }

    /** Every body dropped (a new scene, a replay). */
    clear() {
        for (const d of this.deaths) if (d.ghost) this.host.drop(d.ghost);
        this.deaths = [];
    }

    debug(): Array<{key: string; id: string; t0: number; spot: DeathSpot | null; drawn: boolean}> {
        return this.deaths.map((d) => ({key: d.key, id: d.animal.id, t0: d.t0, spot: d.spot, drawn: Boolean(d.ghost)}));
    }
}
