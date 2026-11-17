/**
 * The one capture grade's value (GRADING-1): the server's stored
 * `analysis_results.capture_grade`, an integer from 1 to 10. A tiny module with
 * no imports so a client component can read a grade without bundling the
 * breakdown engine (`stored-capture-grade.ts`).
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
