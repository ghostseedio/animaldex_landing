/**
 * The reader's Wild Profile, as far as Ask AnimalDex uses it. Ported from
 * `AnimalPowerAskSupport.wildProfileSummary` and `decoratedFollowUps` on iOS.
 *
 * A Wild Profile names three animals for one person — where they come from,
 * what they are under pressure, what they are right now. Given those, "how do I
 * use this in my life?" can be answered for THIS person rather than for anyone.
 *
 * Pure on purpose: no fetching. `@/data/ask-wild-profile` reads the row.
 */

/** In the order iOS sends them, with the labels the prompt's rule names. */
const WILD_PROFILE_ROLES: Array<[key: string, label: string]> = [
    ["origin", "Origin"],
    ["apex", "Apex"],
    ["active", "Active"]
];

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;
}

/** Capped like every other reader-derived line that reaches the prompt. */
const SUMMARY_MAX = 900;

/**
 * "Origin: The Patient Builder | Apex: …", or null when the report names
 * nothing. A role's title is preferred; its meaning stands in when the title is
 * missing.
 */
export function wildProfileSummary(privateReport: unknown): string | null {
    if (!privateReport || typeof privateReport !== "object") return null;
    const report = privateReport as Record<string, unknown>;

    const lines = WILD_PROFILE_ROLES.flatMap(([key, label]) => {
        const role = report[key];
        if (!role || typeof role !== "object") return [];
        const fields = role as Record<string, unknown>;
        const value = text(fields.title)
            ?? text(fields.what_this_says_about_you)
            ?? text(fields.what_you_are_becoming)
            ?? text(fields.current_life_signal)
            ?? text(fields.meaning);
        return value ? [`${label}: ${value}`] : [];
    });

    const joined = lines.join(" | ");
    return joined ? joined.slice(0, SUMMARY_MAX) : null;
}

/**
 * Offered after an answer when the account has no Wild Profile, so the
 * personalisation prompt never costs the reader the answer they asked for.
 */
export const WILD_PROFILE_FOLLOW_UP = "Set up Wild Profile";
export const WILD_PROFILE_PATH = "/app/train/wild-profile";

export function isWildProfileFollowUp(prompt: string) {
    return prompt.trim() === WILD_PROFILE_FOLLOW_UP;
}

/**
 * The model's own follow-ups, plus the Wild Profile offer for a signed-in
 * reader who has none.
 *
 * Three chips is the display cap, so the offer TAKES a slot rather than being
 * appended past the end and never shown. A signed-out reader is left alone: a
 * Wild Profile belongs to an account, and the chip would lead them to a sign-in
 * wall instead of a questionnaire.
 */
export function decorateFollowUps(
    offers: string[],
    viewer: {signedIn: boolean; hasWildProfile: boolean}
): string[] {
    if (!viewer.signedIn || viewer.hasWildProfile || offers.some(isWildProfileFollowUp)) {
        return offers.slice(0, 3);
    }
    return [...offers.slice(0, 2), WILD_PROFILE_FOLLOW_UP];
}
