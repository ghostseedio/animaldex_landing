import {computeCaptureGradeBreakdown, type CaptureGradeBreakdown, type CaptureGradeSource} from "@/lib/capture-grade";

/**
 * The one capture grade (GRADING-1).
 *
 * The server owns the grade: `analysis_results.capture_grade`, an integer from
 * 1 to 10 on a true /10 scale. It is fixed by the first delivered result, it
 * ignores endorsements and community stars, a likely non-live photo is capped
 * at 2, and a person or no-animal result is 1. Every surface on the site shows
 * that stored value. Nothing here, or anywhere a grade is drawn, computes one:
 * a payload that carries no stored grade shows no grade.
 */

export const MIN_CAPTURE_GRADE = 1;
export const MAX_CAPTURE_GRADE = 10;

/** A stored grade, or null when the payload carries none (or something that is not a 1-10 grade). */
export function storedCaptureGrade(value: unknown): number | null {
    if (value == null || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return null;
    const grade = Math.round(number);
    return grade >= MIN_CAPTURE_GRADE && grade <= MAX_CAPTURE_GRADE ? grade : null;
}

export type StoredGradeFields = {
    /** The stored grade, null when the payload has none. */
    captureGrade: number | null;
    /**
     * Why the grade is what it is: the factors, bonuses and penalties from the
     * analysis, headed by the stored grade. Null when there is no stored grade,
     * so the badge shows no grade and offers no breakdown for one.
     */
    gradeBreakdown: CaptureGradeBreakdown | null;
};

/**
 * The grade fields for one capture's payload. The stored grade is the grade;
 * the breakdown only explains it (and is left out when nothing is stored).
 */
export function storedGradeFields(source: CaptureGradeSource | null | undefined): StoredGradeFields {
    const captureGrade = storedCaptureGrade(source?.capture_grade);
    if (captureGrade == null || !source) return {captureGrade: null, gradeBreakdown: null};
    return {
        captureGrade,
        gradeBreakdown: computeCaptureGradeBreakdown({...source, capture_grade: captureGrade})
    };
}
