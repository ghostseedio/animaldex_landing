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
/** Its fall onto its side (s): the last part of the dying act. */
export const DEATH_FALL_SECONDS = 2.6;
/**
 * The dying act (V1; the audit's §2.4 "a dying act: weaken, lie down, stillness, then fade. No wound"): from the
 * act's start (the record's release and its hold, `ark-act-hold.ts`: nothing is acted before the server has said it)
 * it weakens where it stands for `DEATH_WEAKEN_SECONDS` (its head sinks, it sways, a flyer comes down), then goes
 * over onto its side over `DEATH_FALL_SECONDS`, and lies still. `DEATH_DYING_SECONDS`: the whole of it.
 */
export const DEATH_WEAKEN_SECONDS = 6.4;
export const DEATH_DYING_SECONDS = DEATH_WEAKEN_SECONDS + DEATH_FALL_SECONDS;
/** Deaths remembered at most (the newest kept). */
const KEEP = 48;

/** Where it died: its feet's place on the ground, and how it was turned; `from`: how high it was then (a flyer on the wing, a climber), when over the ground. */
export type DeathSpot = {x: number; z: number; base: number; yaw: number; from?: number | null};

/**
 * Why it died, for the act's look (never a wound): old age and starvation are the same slow weakening; `wounds` (E5's
 * hunt styles, a bite-and-wait hunter's prey: NOT sent yet) is a hook: the same collapse, begun from its limp.
 */
export type DeathCause = "old" | "starved" | "wounds";

export type DeathRecord = {
    /** The event's key (`death:<event id>`): what the log's line taps by. */
    key: string;
    animal: ArkEventAnimal;
    /** The death's time on the shared clock (epoch s). */
    t0: number;
    /** p5 (humans): where the server judged it died (a logging death: its home in the cleared stand), when it says. */
    at?: {x: number; z: number} | null;
    /** V1: why (the act's look only); absent: old age. */
    cause?: DeathCause | null;
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
 * Its body at a moment, or null (before the act, or once it has faded). The dying act first (`DEATH_DYING_SECONDS`:
 * weakening where it stands, then over onto its side, its side seeded by the event), then still, then fading over the
 * last `DEATH_FADE_SECONDS`. Pure in the event and the clock: the same for every viewer.
 */
export function deathBodyPose(spot: DeathSpot, key: string, t0: number, epoch: number, cause: DeathCause | null = null): ActPose | null {
    if (!deathBodyShowing(t0, epoch)) return null;
    const u = epoch - t0;
    const side = unit(`${key}#side`) < 0.5 ? -1 : 1;
    const fade = smooth((u - (DEATH_BODY_SECONDS - DEATH_FADE_SECONDS)) / DEATH_FADE_SECONDS);
    if (u < DEATH_DYING_SECONDS) {
        // Weakening: its head sinks and it sways on its feet, more as it goes (one already hurt begins lower); one in the
        // air or up a tree comes down to the ground first. Then over onto its side, slowly.
        const weak = smooth(u / DEATH_WEAKEN_SECONDS);
        const hurt = cause === "wounds" ? 0.35 : 0;
        const sway = Math.sin(u * 2.3 + unit(`${key}#sway`) * 6.283) * 0.05 * Math.min(weak + hurt, 1) * (1 - smooth((u - DEATH_WEAKEN_SECONDS) / DEATH_FALL_SECONDS));
        const high = typeof spot.from === "number" && spot.from > spot.base + 0.3 ? spot.from : null;
        const down = high === null ? 1 : smooth(u / (DEATH_WEAKEN_SECONDS * 0.6));
        const base = high === null || down >= 1 ? spot.base : high + (spot.base - high) * down;
        const lying = side * smooth((u - DEATH_WEAKEN_SECONDS) / DEATH_FALL_SECONDS);
        return {x: spot.x, z: spot.z, base, yaw: spot.yaw, pitch: 0.16 * Math.min(weak + hurt, 1), roll: sway, scale: 1, dim: 0, hidden: false, state: high !== null && down < 0.98 ? "glide" : u < DEATH_WEAKEN_SECONDS ? "weaken" : "lie", speed: 0, lying};
    }
    return {x: spot.x, z: spot.z, base: spot.base, yaw: spot.yaw, pitch: 0, roll: 0, scale: 1, dim: fade, hidden: fade >= 0.999, state: "lie", speed: 0, lying: side};
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
            if (d.ghost) this.host.setAct(d.ghost, deathBodyPose(spot, d.key, d.t0, epoch, d.cause ?? null));
        }
    }

    /** Every body dropped (a new scene, a replay). */
    clear() {
        for (const d of this.deaths) if (d.ghost) this.host.drop(d.ghost);
        this.deaths = [];
    }

    /** Whether a body lies (or is dying) for this animal now: the scene's departure fade leaves it to the act. */
    has(id: string, epoch: number): boolean {
        return this.deaths.some((d) => d.animal.id === id && epoch < d.t0 + DEATH_BODY_SECONDS);
    }

    /**
     * ARK-ANTS: the bodies lying now where they died (real carcasses: the record's deaths), food for the ants whose own
     * text says they take dead insects or carrion. From the fall to the fade (`from`, `until`, epoch s).
     */
    bodies(epoch: number): Array<{key: string; name: string; x: number; z: number; base: number; from: number; until: number}> {
        const out: Array<{key: string; name: string; x: number; z: number; base: number; from: number; until: number}> = [];
        for (const d of this.deaths) {
            if (epoch < d.t0 || epoch > d.t0 + DEATH_BODY_SECONDS) continue;
            const spot = this.place(d);
            if (!spot) continue;
            out.push({key: d.key, name: d.animal.name, x: spot.x, z: spot.z, base: spot.base, from: d.t0 + DEATH_DYING_SECONDS, until: d.t0 + DEATH_BODY_SECONDS - DEATH_FADE_SECONDS});
        }
        return out;
    }

    debug(): Array<{key: string; id: string; t0: number; spot: DeathSpot | null; drawn: boolean}> {
        return this.deaths.map((d) => ({key: d.key, id: d.animal.id, t0: d.t0, spot: d.spot, drawn: Boolean(d.ghost)}));
    }
}
