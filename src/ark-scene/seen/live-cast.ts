/**
 * The live world's cast (V1 "hunting and mating you can see"; AnimalDex docs/ark/audits/ecosystem-audit-2026-11-18.md
 * §2.4, §5 P1-3, §7; decision 389): everyone a record's act names is in the scene and drawn while the act needs them.
 *
 * Before, a live act found its animals only if they happened to be drawn: a mate outside the low tier's 200, a hunter
 * resting out of the rotation, a mother folded into her herd's figure, and the layer skipped the act; a mate or a
 * hunter that had died since could not be acted at all. Here every record of a kind that is acted (`mated`, a live
 * `birth`, `death_old`, `starved`, `meal`, `escaped`, and an `extinction`'s last one) brings its animals in as a group
 * of V2's cast (`replay/cast.ts`): pinned, and a stand-in for whoever has left the read, from the row's own record.
 * A group goes when its act no longer needs it (`until`): the layers' own pins hold their animals while they act.
 *
 * Also in the cast, with no act: the animals of an open crisis (`/api/ark/crises`, E4), pinned so the last of a kind
 * never rotates out of the live budget, the last one with the soft ring; and, as marks only (no pin, no ring), the
 * lone founders (`lone` in the public read, E3).
 *
 * Pure (no three.js, no DOM): the plans are V2's (`planArkEventReplay`), the rule here is only who is in, until when,
 * and how many at once. No look-ahead: only rows the public log has released are ever given to it.
 */

import {ARK_ACT_HOLD_SECONDS} from "@/lib/ark-act-hold";
import type {ArkCast, ArkCastRecord} from "@/ark-scene/replay/cast";
import {planArkEventReplay, recordOfAboard, type ArkEventReplay} from "@/ark-scene/replay/event-replay";
import type {ArkSnapshot} from "@/ark-scene/types";

/** The server's kinds that are acted with a cast (an `extinction` adds its ring to the row that ended the kind). */
export const ARK_SEEN_KINDS: ReadonlySet<string> = new Set(["mated", "birth", "death_old", "starved", "meal", "escaped", "extinction"]);

/**
 * How long after its act's start a group is kept (s). The layers pin their own animals while they act
 * (`live-*.ts` `pins()`), so a group is needed only until its layer has taken the act up; one with a stand-in (an
 * animal that has left the read) is kept for the whole of the act, since nothing else brings that animal in.
 */
const KEEP: Record<ArkEventReplay["kind"], {live: number; standIn: number}> = {
    mated: {live: 90, standIn: 21 * 60},
    birth: {live: 90, standIn: 5 * 60},
    // (A death's or a meal's own stand-in, `live-deaths.ts` and `live-meals.ts` ghosts, takes over at the act's start.)
    death: {live: 4, standIn: 4},
    extinct: {live: 4, standIn: 4},
    meal: {live: 20, standIn: 15 * 60},
    escaped: {live: 70, standIn: 70},
    last_stand: {live: 0, standIn: 0},
    released: {live: 0, standIn: 0}
};

export type ArkSeenGroup = {
    key: string;
    eventId: string;
    kind: ArkEventReplay["kind"];
    records: ArkCastRecord[];
    marks: string[];
    /** The act's start on the shared clock (epoch s), and when the group goes. */
    t0: number;
    until: number;
};

/** The group of a row's act, or null (a kind that is not acted, a row that does not name its animals). */
export function arkSeenGroup(eventId: string, rows: unknown, snapshot: ArkSnapshot | null, now: number): ArkSeenGroup | null {
    let plan: ArkEventReplay;
    try {
        plan = planArkEventReplay(eventId, rows, snapshot, {now});
    } catch {
        return null;
    }
    if (plan.provisional) return null;
    // (An extinction is acted by the row that ended the kind: its last death, or the meal its last one was eaten in.)
    const acted = plan.kind === "extinct" ? (plan.feed.meals ? "meal" : "death") : plan.kind;
    const keep = KEEP[acted];
    // (A death's or an eaten one's own stand-in takes over at the act's start: the group is not needed past it.)
    const standIn = acted !== "death" && plan.cast.some((member) => !member.aboard && !(acted === "meal" && (member.role === "prey" || member.role === "last")));
    // (A litter is one act whichever of its rows is read; an extinction shares the group of the row that ended the kind.)
    const key = plan.feed.births?.[0]?.key ?? `${acted}:${plan.kind === "extinct" ? plan.causeEventId ?? plan.eventId : plan.eventId}`;
    return {key, eventId: plan.eventId, kind: plan.kind, records: plan.cast.map((member) => member.record), marks: plan.marks, t0: plan.t0, until: plan.t0 + (standIn ? keep.standIn : keep.live)};
}

export type ArkSeenCrisis = {id: string; band: "critical" | "last"; animals: string[]};

export type ArkSeenCastOptions = {
    /** Animals the act groups may pin at once (the oldest groups go first): the low tier's live budget is 200. */
    most: number;
};

/**
 * The live cast: the act groups, the crisis pins and marks. `step` lets the expired go. Every change is batched: the
 * caller calls `apply()` when `dirty()` (one layout of the roster for any number of changes).
 */
export class ArkSeenCast {
    private readonly groups = new Map<string, ArkSeenGroup>();
    private readonly held = new Set<string>();
    private crises: ArkSeenCrisis[] = [];
    private changed = false;
    private labels = new Map<string, "critical" | "last">();
    private pinned = new Map<string, string>();

    constructor(private readonly cast: ArkCast, private readonly options: ArkSeenCastOptions) {}

    /** A row's act: its group brought in (once; a group already over is not brought). Returns it. */
    note(eventId: string, rows: unknown, snapshot: ArkSnapshot | null, now: number): ArkSeenGroup | null {
        const group = arkSeenGroup(eventId, rows, snapshot, now);
        if (!group || now / 1000 >= group.until) return null;
        const known = this.groups.get(group.key);
        if (known) {
            // (An extinction read after the death that ended the kind: the same animals, now with the ring.)
            if (group.marks.length && !known.marks.length) {
                known.marks = group.marks;
                this.cast.bring(known.key, known.records, {marks: known.marks});
                this.changed = true;
            }
            return known;
        }
        this.groups.set(group.key, group);
        this.cast.bring(group.key, group.records, {marks: group.marks});
        this.changed = true;
        this.trim();
        return group;
    }

    /** A group kept whatever its time and the budget (the one being watched). */
    hold(key: string, on: boolean): void {
        if (on) this.held.add(key);
        else this.held.delete(key);
    }

    has(key: string): boolean {
        return this.groups.has(key);
    }

    /** The groups whose act is over let go. */
    step(now: number): void {
        const epoch = now / 1000;
        this.groups.forEach((group, key) => {
            if (epoch < group.until || this.held.has(key)) return;
            this.groups.delete(key);
            this.cast.release(key);
            this.changed = true;
        });
    }

    /** No more animals pinned by act groups than the budget: the groups nearest their end go first. */
    private trim(): void {
        const count = () => {
            const ids = new Set<string>();
            this.groups.forEach((group) => group.records.forEach((record) => ids.add(record.id)));
            return ids.size;
        };
        const byEnd = Array.from(this.groups.values()).filter((group) => !this.held.has(group.key)).sort((a, b) => a.until - b.until);
        while (count() > this.options.most && byEnd.length > 1) {
            const gone = byEnd.shift()!;
            this.groups.delete(gone.key);
            this.cast.release(gone.key);
        }
    }

    /**
     * The open crises (`/api/ark/crises`): their living animals pinned, the last one of a kind with the ring. Only
     * animals in the read (a crisis is about the living; nothing is made up for one the read does not have).
     */
    setCrises(crises: readonly ArkSeenCrisis[], snapshot: ArkSnapshot | null): void {
        const aboard = new Map((snapshot?.animals ?? []).map((animal) => [animal.id, animal]));
        const next = crises.map((crisis) => ({...crisis, animals: crisis.animals.filter((id) => aboard.has(id))})).filter((crisis) => crisis.animals.length);
        const signature = (list: readonly ArkSeenCrisis[]) => list.map((crisis) => `${crisis.id}:${crisis.band}:${crisis.animals.join(",")}`).sort().join("|");
        if (signature(next) === signature(this.crises)) return;
        this.crises = next;
        this.labels = new Map();
        const records: ArkCastRecord[] = [];
        const marks: string[] = [];
        for (const crisis of next) for (const id of crisis.animals) {
            records.push(recordOfAboard(aboard.get(id)!));
            this.labels.set(id, crisis.band);
            if (crisis.band === "last") marks.push(id);
        }
        if (records.length) this.cast.bring("crises", records, {marks});
        else this.cast.release("crises");
        this.changed = true;
    }

    /** A group with no act and no end (the animals a public state names, `hooks.ts`): pinned while the read says so. */
    pin(key: string, records: readonly ArkCastRecord[]): void {
        const signature = records.map((record) => record.id).sort().join(",");
        if ((this.pinned.get(key) ?? "") === signature) return;
        if (records.length) {
            this.pinned.set(key, signature);
            this.cast.bring(key, records);
        } else {
            this.pinned.delete(key);
            this.cast.release(key);
        }
        this.changed = true;
    }

    /** An animal's crisis band, when it is one of an open crisis's. */
    band(id: string): "critical" | "last" | null {
        return this.labels.get(id) ?? null;
    }

    dirty(): boolean {
        return this.changed;
    }

    /** One layout for every change since the last. */
    apply(): void {
        if (!this.changed) return;
        this.changed = false;
        this.cast.apply();
    }

    report(): {groups: Array<{key: string; kind: string; until: number; ids: string[]}>; crises: number; pins: number} {
        return {groups: Array.from(this.groups.values()).map((group) => ({key: group.key, kind: group.kind, until: group.until, ids: group.records.map((record) => record.id)})), crises: this.crises.length, pins: this.cast.pins.size};
    }
}

/** How long before its act's start a line can be watched from (s): the whole of the hold. */
export const ARK_SEEN_WATCH_BEFORE = ARK_ACT_HOLD_SECONDS + 5;
