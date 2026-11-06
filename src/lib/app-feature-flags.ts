/**
 * The apps' remote switches on the web (AnimalDex migration
 * 20261104161000_app_feature_flags): `app_feature_flags_v1()` answers
 * `{"key": true|false, ...}` to anyone, anon included. A key the answer
 * lacks, or an answer that cannot be read, is off, as in the apps: a client
 * never shows a feature the server has not switched on.
 *
 * Development only: `ANIMALDEX_DEV_ALL_FLAGS=1` turns every switch the
 * website reads on, the web's version of the apps' DEBUG all-flags-on
 * override. Never in production.
 *
 * Pure; the server read is `data/app-feature-flags.ts`, the browser's
 * `components/use-app-feature-flag.ts`.
 */

export type AppFeatureFlags = Readonly<Record<string, boolean>>;

const KEY = /^[a-z][a-z0-9_]{1,62}$/;

/** The switches the website reads. */
export const WEB_FEATURE_FLAGS = ["talk_front_door"] as const;
export type WebFeatureFlag = typeof WEB_FEATURE_FLAGS[number];

/** The RPC's answer as switches: only real keys with a boolean value. */
export function decodeAppFeatureFlags(raw: unknown): AppFeatureFlags {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (KEY.test(key) && typeof value === "boolean") flags[key] = value;
    }
    return flags;
}

/** On only when the server said true for this key. */
export function isAppFeatureOn(flags: AppFeatureFlags | null | undefined, key: string): boolean {
    return flags?.[key] === true;
}

/** Whether the development override is on: never in production, whatever the environment says. */
export function devAllFlagsOn(env: {NODE_ENV?: string; ANIMALDEX_DEV_ALL_FLAGS?: string}): boolean {
    return env.NODE_ENV !== "production" && env.ANIMALDEX_DEV_ALL_FLAGS === "1";
}

/** The switches with the development override applied: every switch the website reads, on. */
export function withDevOverride(flags: AppFeatureFlags, allOn: boolean): AppFeatureFlags {
    if (!allOn) return flags;
    return {...flags, ...Object.fromEntries(WEB_FEATURE_FLAGS.map((key) => [key, true]))};
}
