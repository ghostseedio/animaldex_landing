/**
 * Which hearts rule the server runs now (AnimalDex docs/ark/hearts-escape.md, "Public read"; lane HEARTS-CLIENTS). Pure.
 *
 * The server says it in `voyage_hearts_rules_v1()` (and the events read's `hearts_rules`): `{hearts, escape, oldAge}`.
 *   - `hearts`: `ark_hearts` is on (a card's hearts are lives of the animal it brought aboard).
 *   - `escape`: `hearts_escape` is on too: a heart is a SURVIVED ATTACK. A hunt on an animal that holds a heart is its wounded
 *     escape (it lies up and returns, the hunter is not fed), a starving one is found weak and taken into care, nothing dies
 *     and comes back. Off: today's rule, a heart is another life (it dies, is away a day, and returns).
 *   - `oldAge`: with `escape` on, `final` (hearts do not hold old age back) or `return` (`hearts_escape_rules.oldAge`: an
 *     old-age death still spends a heart and returns as a young adult). Meaningless with `escape` off.
 *
 * Every string that describes what a heart does follows this, so nothing is redeployed when the switch changes. A read that
 * is missing, or says nothing about `escape`, is today's rule: the words are exactly as they were.
 */

export type ArkHeartsRules = {hearts: boolean; escape: boolean; oldAge: "return" | "final"};

/** The server's `hearts_rules`, checked; null when it is absent or not an object. */
export function decodeArkHeartsRules(raw: unknown): ArkHeartsRules | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.hearts !== "boolean") return null;
    const escape = row.hearts && row.escape === true;
    return {hearts: row.hearts, escape, oldAge: escape && row.oldAge !== "return" ? "final" : "return"};
}

/** A heart is a survived attack now (the switch is on, with hearts). */
export function arkHeartsEscape(rules: ArkHeartsRules | null | undefined): boolean {
    return Boolean(rules && rules.hearts && rules.escape);
}

/** Old age is final: no heart is spent on it and nothing returns from it. Only said while the escape rule is on. */
export function arkOldAgeFinal(rules: ArkHeartsRules | null | undefined): boolean {
    return arkHeartsEscape(rules) && rules!.oldAge === "final";
}

/**
 * A rule-dependent string: the `escape` variant for the state of old age while a heart is a survived attack (`escapeFinal`: old
 * age is final; `escapeReturn`: it still returns), else `plain`. A variant that is missing leaves `plain` (never the other
 * state's, which would say what is not true).
 */
export function arkHeartsVariant<T>(rules: ArkHeartsRules | null | undefined, plain: T, escapeFinal: T | undefined | null, escapeReturn?: T | undefined | null): T {
    if (!arkHeartsEscape(rules)) return plain;
    return (rules!.oldAge === "return" ? escapeReturn : escapeFinal) ?? plain;
}
