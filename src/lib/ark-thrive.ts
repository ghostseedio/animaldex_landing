/**
 * Captures + thrive on the web (owner, 2026-11-11): captures bring animals
 * aboard; steps make them thrive. The server's reads, decoded, and the words
 * they become. THE RULE: the server decides everything; this only reads it.
 *
 * The shapes are the frozen read contract's, exactly (AnimalDex
 * `docs/ark/captures-thrive-design.md` section 0, branch ark-captures-thrive):
 * - `voyage_capture_state_v1(p_capture_id)` (section 6): the capture page's band;
 * - `voyage_step_result_v1(p_step_id)` (section 5): the line under the reply
 *   that finished a step that worked;
 * - `lineage` on `voyage_animal_life_v1` (section 3): the tap card's family line;
 * - `thrive` on every animal: the band in plain words (`arkThriveWords`).
 *
 * Every field is read tolerantly (an older server, a malformed answer reads
 * as nothing, never as a broken band). Only the band is public, never the
 * 0–100 value; no capture location or nickname is ever read.
 */

import {arkThrive} from "@/ark-scene/thrive";
import type {ArkThrive} from "@/ark-scene/types";

export type {ArkThrive};

function record(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            return record(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function whole(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function text(value: unknown, max = 120): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return clean.length > max ? clean.slice(0, max).trimEnd() : clean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// MARK: - The band in words

/** The three bands in plain words ("In prime condition", "In good condition", "Ordinary"): the tap card's, the band's, the chat's. */
export type ArkThriveWords = {thrivePrime: string; thriveGood: string; thriveOrdinary: string};

export function arkThriveWords(band: ArkThrive, words: ArkThriveWords): string {
    return band === "prime" ? words.thrivePrime : band === "good" ? words.thriveGood : words.thriveOrdinary;
}

/**
 * The band of a read that may send it bare (`'good'`, the contract) or as an
 * object (`{band: 'good', since}`, an earlier draft of the design): either way
 * the band, else null.
 */
export function decodeArkThriveField(value: unknown): ArkThrive | null {
    return arkThrive(value) ?? arkThrive(record(value)?.band);
}

// MARK: - Lineage (the tap card's "2 young, 1 grandchild")

/** Descendants ever born (eggs not counted), by generation, and how many of them live now. */
export type ArkLineage = {young: number; grandchildren: number; later: number; living: number};

export function decodeArkLineage(raw: unknown): ArkLineage | null {
    const row = record(raw);
    if (!row) return null;
    const young = whole(row.young);
    const grandchildren = whole(row.grandchildren);
    const later = whole(row.later);
    if (young === null && grandchildren === null && later === null) return null;
    const total = (young ?? 0) + (grandchildren ?? 0) + (later ?? 0);
    return {young: young ?? 0, grandchildren: grandchildren ?? 0, later: later ?? 0, living: Math.min(whole(row.living) ?? 0, total)};
}

export type ArkLineageWords = {
    lineageYoungOne: string;
    lineageYoungOther: string;
    lineageGrandOne: string;
    lineageGrandOther: string;
    lineageLaterOne: string;
    lineageLaterOther: string;
    lineageLiving: string;
    noYoung: string;
};

/** "2 young, 1 grandchild · 2 alive now"; "None yet" with none. Counts in the reader's digits, the list in their language's way. */
export function arkLineageLine(lineage: ArkLineage, words: ArkLineageWords, locale: string): string {
    const n = (value: number) => value.toLocaleString(locale);
    const part = (value: number, one: string, other: string) => (value === 1 ? one : other).split("{count}").join(n(value));
    const parts = [
        lineage.young > 0 ? part(lineage.young, words.lineageYoungOne, words.lineageYoungOther) : null,
        lineage.grandchildren > 0 ? part(lineage.grandchildren, words.lineageGrandOne, words.lineageGrandOther) : null,
        lineage.later > 0 ? part(lineage.later, words.lineageLaterOne, words.lineageLaterOther) : null
    ].filter((item): item is string => Boolean(item));
    if (parts.length === 0) return words.noYoung;
    let list: string;
    try {
        list = new Intl.ListFormat(locale, {style: "short", type: "unit"}).format(parts);
    } catch {
        list = parts.join(", ");
    }
    // "alive now" only when it tells something: some of them, not none of one.
    return lineage.living > 0 ? `${list} · ${words.lineageLiving.split("{count}").join(n(lineage.living))}` : list;
}

/** Whether the line has anything to say beyond "None yet". */
export function arkLineageHasAny(lineage: ArkLineage | null): lineage is ArkLineage {
    return Boolean(lineage && lineage.young + lineage.grandchildren + lineage.later > 0);
}

// MARK: - The capture band (`voyage_capture_state_v1`)

export const ARK_CAPTURE_STATES = ["aboard", "was_aboard", "coming_aboard", "waiting_model", "pair_full", "not_on_ark"] as const;
export type ArkCaptureStateKind = typeof ARK_CAPTURE_STATES[number];

export const ARK_CAPTURE_REASONS = ["not_ready", "observation_only", "merged", "analysis_failed", "unidentified", "excluded", "under_13", "switched_off"] as const;
export type ArkCaptureReason = typeof ARK_CAPTURE_REASONS[number];

export type ArkCaptureState = {
    state: ArkCaptureStateKind;
    reason: ArkCaptureReason | null;
    /** The look's display name, and its kind's (a breed's parent species). */
    species: string | null;
    kindName: string | null;
    /** The reader's own living animals of the kind, 0–2. */
    livingBrought: number;
    /** Everyone's living animals of the kind. */
    aboard: number;
    /** The reader's condition for the kind. */
    thrive: ArkThrive;
    /** The animal this capture brought (`aboard`, `was_aboard`). */
    animalId: string | null;
};

function captureReason(value: unknown): ArkCaptureReason | null {
    if (typeof value !== "string") return null;
    // `excluded:<A11 reason>` in the server's predicate; the read says `excluded`.
    const bare = value.startsWith("excluded") ? "excluded" : value;
    return (ARK_CAPTURE_REASONS as readonly string[]).includes(bare) ? bare as ArkCaptureReason : null;
}

/** `voyage_capture_state_v1`'s answer. Null for null (not the reader's capture) or anything malformed. */
export function decodeArkCaptureState(raw: unknown): ArkCaptureState | null {
    const row = record(raw);
    if (!row || typeof row.state !== "string" || !(ARK_CAPTURE_STATES as readonly string[]).includes(row.state)) return null;
    const animalId = text(row.animal_id, 40);
    return {
        state: row.state as ArkCaptureStateKind,
        reason: captureReason(row.reason),
        species: text(row.species),
        kindName: text(row.kind_name),
        livingBrought: Math.min(whole(row.living_brought) ?? 0, 2),
        aboard: whole(row.aboard) ?? 0,
        thrive: decodeArkThriveField(row.thrive) ?? "ordinary",
        animalId: animalId && UUID.test(animalId) ? animalId.toLowerCase() : null
    };
}

/**
 * What the band shows for a state:
 * - `aboard` / `already` / `coming` / `waiting` / `pair_full` / `was_aboard` / `not_on_ark`: its own words;
 * - `species`: the species-level band from the public snapshot (how many aboard, yours among them), for
 *   when the server can't say about this capture (capture arrivals switched off, someone else's capture,
 *   an older server);
 * - `hidden`: nothing (still being identified, not identified, or an under-13 account: no line at all).
 */
export type ArkCaptureBandView =
    | {kind: "aboard" | "already" | "coming" | "waiting" | "pair_full" | "was_aboard" | "not_on_ark"; state: ArkCaptureState}
    | {kind: "species"}
    | {kind: "hidden"};

export function arkCaptureBandView(state: ArkCaptureState | null): ArkCaptureBandView {
    if (!state) return {kind: "species"};
    switch (state.state) {
        case "aboard":
            return {kind: "aboard", state};
        case "was_aboard":
            return {kind: "was_aboard", state};
        case "coming_aboard":
            return {kind: "coming", state};
        case "waiting_model":
            return {kind: "waiting", state};
        case "pair_full":
            return {kind: "pair_full", state};
        case "not_on_ark":
            switch (state.reason) {
                case "switched_off":
                    return {kind: "species"};
                case "excluded":
                    return {kind: "not_on_ark", state};
                // A sighting saved to a card: theirs is aboard from the card, or there's nothing to say.
                case "observation_only":
                case "merged":
                    return state.livingBrought > 0 ? {kind: "already", state} : {kind: "hidden"};
                default:
                    // not_ready, analysis_failed, unidentified, under_13, or a reason this build doesn't know.
                    return {kind: "hidden"};
            }
    }
}

// MARK: - The step's result (`voyage_step_result_v1`)

export type ArkStepResult = {
    status: "pending" | "done";
    species: string | null;
    livingBrought: number;
    thriveBefore: ArkThrive | null;
    thriveAfter: ArkThrive | null;
    /** The step's locked Ark Score points; null while pending. */
    points: number | null;
};

/** `voyage_step_result_v1`'s answer. Null for null (not the reader's step, not done + worked, not on the Ark) or anything malformed. */
export function decodeArkStepResult(raw: unknown): ArkStepResult | null {
    const row = record(raw);
    if (!row || (row.status !== "pending" && row.status !== "done")) return null;
    const done = row.status === "done";
    return {
        status: row.status,
        species: text(row.species),
        livingBrought: Math.min(whole(row.living_brought) ?? 0, 2),
        thriveBefore: done ? decodeArkThriveField(row.thrive_before) : null,
        thriveAfter: done ? decodeArkThriveField(row.thrive_after) : null,
        points: done ? whole(row.points) : null
    };
}

export type ArkStepResultWords = ArkThriveWords & {resultOne: string; resultOther: string; resultLater: string; resultPoints: string};

/**
 * The line under the reply that finished a step that worked: "Your Komodo
 * Dragons are thriving", the band it left them in, and "+30 Ark Score".
 * Null while pending (the outbox applies it within about a minute).
 */
export function arkStepResultLines(result: ArkStepResult, words: ArkStepResultWords, locale: string, plural: (name: string) => string = (name) => name): {line: string; band: string | null; points: string | null} | null {
    if (result.status !== "done" || !result.species) return null;
    const name = result.livingBrought >= 2 && locale.toLowerCase().startsWith("en") ? plural(result.species) : result.species;
    const template = result.livingBrought <= 0 ? words.resultLater : result.livingBrought >= 2 ? words.resultOther : words.resultOne;
    return {
        line: template.split("{species}").join(name),
        band: result.livingBrought > 0 && result.thriveAfter ? arkThriveWords(result.thriveAfter, words) : null,
        points: result.points !== null && result.points > 0 ? words.resultPoints.split("{points}").join(result.points.toLocaleString(locale)) : null
    };
}
