/**
 * One animal's rhythm (lane `ark-sd-align`, owner 2026-11-15: "a live line graph comparison showing the animal's Ark
 * frequency", "if its live frequency isn't matching the System Dynamics frequency it shows a red alert"): its day in the
 * Ark worked out from its own schedule, against its kind's System Dynamics (`lib/ark-sd-rhythm.ts` sdAgreement).
 *
 * Pure function of the shared clock, its id and what the server sent (`slotPlanAt` through `planOf`), so every viewer
 * and every surface gets the same answer. Its last 24 hours read every `STRIDE`th slot (its shares and its line; a
 * slot it sleeps through needs no plan), and its last `TEMPO_SLOTS` slots one by one (its bouts). Each slot's key is
 * remembered, so a dry run stopped part way (the scene's sliced warming) goes on from where it stopped.
 */

import {awakeAt, scheduleGeneration, slotOffset, SLOT_SECONDS, type ScheduleWorld} from "@/ark-scene/behaviour-schedule";
import {planOf, type ScheduleSubject} from "@/ark-scene/animal-status";
import {followsSd, speciesSdRhythm} from "@/ark-scene/sd-rhythm";
import type {ArkCondition, ArkThrive} from "@/ark-scene/types";
import {arkActivityKey} from "@/lib/ark-animal-status";
import {arkDayOf, arkRhythmCauses, intensityLine, sdAgreement, type ArkRhythmCause, type SdAgreement, type SdFrequency} from "@/lib/ark-sd-rhythm";

/** Its last day read every this many slots (about 5 minutes apart). */
export const RHYTHM_STRIDE = 4;
/** Its bouts read from its last this many slots, one by one (two hours). */
export const RHYTHM_TEMPO_SLOTS = 90;
/** Points in its day's line. */
export const RHYTHM_LINE_POINTS = 48;
const DAY_SLOTS = Math.ceil(86_400 / SLOT_SECONDS);

export type ArkRhythmStatus = {
    id: string;
    /** Its species' page (the SD section), when known. */
    page: string | null;
    tempo: SdFrequency;
    agreement: SdAgreement;
    /** How busy it was over the last 24 hours (0–1), oldest first; `from`–`to` epoch seconds. */
    line: number[];
    from: number;
    to: number;
    /** Its mean waking bout over its last two hours (minutes), null when it was asleep for most of them. */
    boutMinutes: number | null;
    /** Why it is off its rhythm (only when it is), and whether a person's step can bring it back. */
    causes: Array<{cause: ArkRhythmCause; fixable: boolean}>;
};

let memo: {generation: number; world: ScheduleWorld | null; byId: Map<string, Map<number, string>>} = {generation: -1, world: null, byId: new Map()};

function keyAt(subject: ScheduleSubject, known: Map<number, string>, slot: number, offset: number): string {
    let key = known.get(slot);
    if (key === undefined) {
        const start = slot * SLOT_SECONDS - offset;
        if (!awakeAt(subject.profile, subject.activity, subject.hoursAt(start))) key = "sleeping";
        else {
            const plan = planOf(subject, start + 0.5);
            key = arkActivityKey({doing: plan.doing, recipe: plan.recipe, wary: plan.wary, feeding: false, flyer: subject.profile.move === "fly", still: plan.still});
        }
        known.set(slot, key);
    }
    return key;
}

/**
 * Its rhythm now, or null when its kind has no System Dynamics the Ark can act on, or it flies. `state`: the server's thrive band and
 * condition (the causes); `stepFeeds`: the server's `step_feeds` switch (a worked step feeds it), when the client knows it.
 */
export function scheduleRhythm(subject: ScheduleSubject, epoch: number, state: {thrive?: ArkThrive | null; condition?: ArkCondition | null; stepFeeds?: boolean}): ArkRhythmStatus | null {
    // (Only where its schedule follows its SD: a flyer's day is still the flight lanes', so its rhythm is not shown and
    // never promised back by a step: `sd-rhythm.ts` followsSd.)
    // (Nor a kept one's, in the town: its day is its keeper's place's.)
    const sd = followsSd(subject.profile) && !subject.animalAt(epoch).kept ? speciesSdRhythm(subject.profile.slug) : null;
    if (!sd) return null;
    if (memo.generation !== scheduleGeneration() || memo.world !== subject.world) memo = {generation: scheduleGeneration(), world: subject.world, byId: new Map()};
    let known = memo.byId.get(subject.id);
    if (!known) {
        known = new Map();
        memo.byId.set(subject.id, known);
        if (memo.byId.size > 8) memo.byId.delete(memo.byId.keys().next().value as string);
    }
    const offset = slotOffset(subject.id);
    const now = Math.floor((epoch + offset) / SLOT_SECONDS);
    // (Its sampled day on a fixed grid of slots, so a second later the same slots are read and remembered.)
    const last = now - (((now % RHYTHM_STRIDE) + RHYTHM_STRIDE) % RHYTHM_STRIDE);
    const sampled: string[] = [];
    for (let slot = last - DAY_SLOTS + RHYTHM_STRIDE; slot <= last; slot += RHYTHM_STRIDE) sampled.push(keyAt(subject, known, slot, offset));
    const recent: string[] = [];
    for (let slot = now - RHYTHM_TEMPO_SLOTS + 1; slot <= now; slot++) recent.push(keyAt(subject, known, slot, offset));
    if (known.size > DAY_SLOTS + RHYTHM_TEMPO_SLOTS * 2) known.forEach((_, slot) => {
        if (slot < now - DAY_SLOTS - RHYTHM_STRIDE) known!.delete(slot);
    });
    const day = arkDayOf(sampled, SLOT_SECONDS * RHYTHM_STRIDE);
    const bouts = arkDayOf(recent, SLOT_SECONDS);
    const wakingRecent = recent.filter((k) => k !== "sleeping").length;
    const boutMinutes = wakingRecent >= 15 ? bouts.boutMinutes : null;
    const agreement = sdAgreement({target: sd.target, tempo: sd.tempo, level: sd.level, modes: []}, {...day, boutMinutes: boutMinutes ?? NaN});
    return {
        id: subject.id,
        page: sd.page,
        tempo: sd.tempo,
        agreement,
        line: intensityLine(day.intensity, RHYTHM_LINE_POINTS),
        from: (last - DAY_SLOTS + RHYTHM_STRIDE) * SLOT_SECONDS - offset,
        to: now * SLOT_SECONDS - offset + SLOT_SECONDS,
        boutMinutes,
        causes: agreement.state === "in" ? [] : arkRhythmCauses(state.thrive ?? "ordinary", state.condition ?? null, Boolean(state.stepFeeds))
    };
}
