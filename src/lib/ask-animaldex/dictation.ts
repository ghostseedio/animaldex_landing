/**
 * Dictation's pure half (DECISIONS section 9): how what was heard joins what
 * was already in the field, and the strip's clock. The hook is
 * `components/ask-animaldex/use-dictation.ts`.
 */

/** Joins what was in the field with what was heard, a space between them. */
export function dictatedText(before: string, heard: string): string {
    const said = heard.replace(/\s+/g, " ").trim();
    if (!said) return before;
    if (!before.trim()) return said;
    return /\s$/.test(before) ? `${before}${said}` : `${before} ${said}`;
}

/** "0:07": how long they have been dictating. */
export function dictationClock(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
