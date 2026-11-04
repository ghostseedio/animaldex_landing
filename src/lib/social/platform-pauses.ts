import {SHARE_CONTENT_KINDS, type ShareContentKind} from "@/lib/social/auto-share-plan";
import {isSocialPlatform, SOCIAL_PLATFORMS, type SocialPlatform} from "@/lib/social/types";

// Which platforms the auto-share may post to, per kind (video, carousel, text),
// pure. Some are paused by default (Nov 2026): X fails every post with 402
// "credits depleted", Facebook posts to a Page the founder has to confirm is
// ours, Pinterest got no views and Instagram carousels 4–14 each. TikTok,
// YouTube and Instagram videos keep going.
//
// The admin turns a platform back on from /admin/story-videos; that choice is
// saved in admin_social_platform_settings (one row per platform and kind,
// supabase/migrations/20261104193000_admin_social_platform_settings.sql).
// Posting never resumes on its own: a missing row means the default, settings
// that cannot be read pause everything, and the daily caps
// (SOCIAL_DAILY_CAPS) cannot undo a pause.

/** Why each default pause is on. Shown as "Paused: <reason>". */
export const DEFAULT_PAUSES: Partial<Record<SocialPlatform, Partial<Record<ShareContentKind, string>>>> = {
    x: {video: "credits depleted", carousel: "credits depleted", text: "credits depleted"},
    facebook: {video: "check this is the AnimalDex Page", carousel: "check this is the AnimalDex Page", text: "check this is the AnimalDex Page"},
    pinterest: {video: "no views in a month", carousel: "no views in a month", text: "no views in a month"},
    instagram: {carousel: "carousels got 4–14 views"}
};

/** The reason a pause the admin sets carries. */
export const ADMIN_PAUSE_REASON = "paused in the admin";

/** When the settings cannot be read, nothing posts: a pause must never lapse because a read failed. */
export const UNREADABLE_REASON = "the platform settings could not be read";

/** A saved choice (one row of admin_social_platform_settings). */
export type PlatformSettingRow = {platform: string; kind: string; paused: boolean; reason: string | null; updated_at: string | null};

export type PauseEntry = {paused: boolean; reason: string | null; source: "default" | "admin"; updatedAt: string | null};

export type PlatformPauses = {
    /** saved: rows read (maybe none). defaults: the table is not there yet. unreadable: the read failed. */
    source: "saved" | "defaults" | "unreadable";
    entries: Record<SocialPlatform, Record<ShareContentKind, PauseEntry>>;
};

function isKind(value: unknown): value is ShareContentKind {
    return typeof value === "string" && (SHARE_CONTENT_KINDS as readonly string[]).includes(value);
}

function defaultEntry(platform: SocialPlatform, kind: ShareContentKind): PauseEntry {
    const reason = DEFAULT_PAUSES[platform]?.[kind] ?? null;
    return {paused: reason !== null, reason, source: "default", updatedAt: null};
}

/**
 * The pauses in force: each saved row overrides that platform and kind's
 * default; rows for unknown platforms or kinds are ignored. Pass null when the
 * settings could not be read: then every platform is paused.
 */
export function resolvePauses(rows: PlatformSettingRow[] | null, source: PlatformPauses["source"] = rows ? "saved" : "unreadable"): PlatformPauses {
    const entries = Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [
        platform,
        Object.fromEntries(SHARE_CONTENT_KINDS.map((kind) => [
            kind,
            source === "unreadable" ? {paused: true, reason: UNREADABLE_REASON, source: "default", updatedAt: null} : defaultEntry(platform, kind)
        ]))
    ])) as PlatformPauses["entries"];
    if (source !== "unreadable") {
        for (const row of rows ?? []) {
            if (!isSocialPlatform(row.platform) || !isKind(row.kind)) continue;
            const paused = row.paused === true;
            entries[row.platform][row.kind] = {
                paused,
                reason: paused ? row.reason?.trim() || ADMIN_PAUSE_REASON : null,
                source: "admin",
                updatedAt: row.updated_at ?? null
            };
        }
    }
    return {source, entries};
}

export function isPaused(pauses: PlatformPauses, platform: SocialPlatform, kind: ShareContentKind) {
    return pauses.entries[platform][kind].paused;
}

/** "Paused: credits depleted", or null when the platform takes that kind. */
export function pauseLabel(pauses: PlatformPauses, platform: SocialPlatform, kind: ShareContentKind) {
    const entry = pauses.entries[platform][kind];
    return entry.paused ? `Paused: ${entry.reason ?? ADMIN_PAUSE_REASON}` : null;
}

/** The platforms that may take `kind`, and the paused ones with their label. */
export function withoutPaused(platforms: readonly SocialPlatform[], kind: ShareContentKind, pauses: PlatformPauses) {
    const allowed: SocialPlatform[] = [];
    const skipped: Partial<Record<SocialPlatform, string>> = {};
    for (const platform of platforms) {
        const label = pauseLabel(pauses, platform, kind);
        if (label) skipped[platform] = label;
        else allowed.push(platform);
    }
    return {allowed, skipped};
}

type Caps = Record<SocialPlatform, Record<ShareContentKind, number>>;

/** The daily caps with every paused platform and kind at 0, so no override (SOCIAL_DAILY_CAPS) can post past a pause. */
export function applyPauses(caps: Caps, pauses: PlatformPauses): Caps {
    return Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [
        platform,
        Object.fromEntries(SHARE_CONTENT_KINDS.map((kind) => [kind, isPaused(pauses, platform, kind) ? 0 : caps[platform][kind]]))
    ])) as Caps;
}

/** Paused for every kind it posts (cap above 0): not worth a health check. */
export function fullyPaused(pauses: PlatformPauses, platform: SocialPlatform, caps: Caps) {
    const kinds = SHARE_CONTENT_KINDS.filter((kind) => caps[platform][kind] > 0);
    return kinds.length > 0 && kinds.every((kind) => isPaused(pauses, platform, kind));
}

/** Every pause in force, for the admin panel: one line per platform and kind. */
export function pausedList(pauses: PlatformPauses, caps: Caps) {
    return SOCIAL_PLATFORMS.flatMap((platform) => SHARE_CONTENT_KINDS
        .filter((kind) => caps[platform][kind] > 0 && isPaused(pauses, platform, kind))
        .map((kind) => ({platform, kind, reason: pauses.entries[platform][kind].reason ?? ADMIN_PAUSE_REASON})));
}

/**
 * A failure that will repeat on every post until a person fixes the account,
 * as a pause reason: X answers 402 "CreditsDepleted" once the API credits run
 * out. Null for anything worth retrying.
 */
export function fatalPauseReason(platform: SocialPlatform, message: string): string | null {
    if (platform === "x" && /\b402\b|credits?\s*depleted|CreditsDepleted/i.test(message)) return "credits depleted";
    return null;
}
