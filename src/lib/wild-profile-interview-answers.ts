/**
 * How the Wild Profile interview takes an answer, by question.
 *
 * identity-interview-next (deep_v2) asks for a birth date with
 * question_type "birth_date"; the answer is still saved as free text, as an
 * ISO yyyy-MM-dd the server parses. Any type this client does not know
 * falls back to the text field.
 */

import type {WildProfileInterviewQuestion} from "@/lib/wild-profile-interview-types";

export type WildProfileAnswerInput = "birth_date" | "text";

/** The youngest and oldest birth dates the picker offers. */
const MIN_AGE_YEARS = 5;
const MAX_AGE_YEARS = 120;

export function wildProfileAnswerInput(question: Pick<WildProfileInterviewQuestion, "question_type"> | null | undefined): WildProfileAnswerInput {
    return question?.question_type === "birth_date" ? "birth_date" : "text";
}

function isoDay(date: Date) {
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function yearsBefore(today: Date, years: number) {
    const date = new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
    // 29 February in a year without one rolls into March; step back to the 28th.
    if (date.getMonth() !== today.getMonth()) date.setDate(0);
    return date;
}

/** `min`/`max` for `<input type="date">`, in the reader's local calendar. */
export function wildProfileBirthDateBounds(today = new Date()): {min: string; max: string} {
    return {
        min: isoDay(yearsBefore(today, MAX_AGE_YEARS)),
        max: isoDay(yearsBefore(today, MIN_AGE_YEARS))
    };
}

/** A complete yyyy-MM-dd inside the bounds, or null. */
export function wildProfileBirthDateAnswer(value: string, today = new Date()): string | null {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    const {min, max} = wildProfileBirthDateBounds(today);
    return trimmed >= min && trimmed <= max ? trimmed : null;
}

/**
 * The deep interview's questions (name, birth date, the purpose reading and
 * the deep_* angles) are open questions about the person; the animal quick
 * chips (Forest, Speed, Pack…) belong to the playful quiz only.
 */
export function isDeepWildProfileQuestion(question: Pick<WildProfileInterviewQuestion, "dimension"> | null | undefined): boolean {
    const dimension = question?.dimension ?? "";
    return dimension === "identity_name"
        || dimension === "identity_birth_date"
        || dimension === "purpose_reading"
        || dimension.startsWith("deep_");
}
