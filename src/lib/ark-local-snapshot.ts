/**
 * Development's `/ark?snapshot=/ark-local/real.json` (owner, 2026-11-11: "only use real player data and animals"):
 * a snapshot file under `public/` read as the Ark's answer, so the owner sees the real population locally before the
 * captures backfill runs in production. The file is a `voyage_public_v2` answer (or `/api/ark/voyage`'s
 * `{snapshot, founders}`), founders and all. It holds real usernames: `public/ark-local/` is gitignored, and such a
 * file is never committed.
 *
 * Never in production: there the path is ignored and the page reads the live Ark.
 */

import type {ArkSnapshot} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkFoundersOf, type ArkFounders} from "@/lib/ark-founders";

/** One path under /public: segments of letters, digits, dot, dash and underscore, ending in `.json`; nothing that climbs. */
const LOCAL_PATH = /^\/[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\.json$/;

/** The `?snapshot=` path to read, or null: only in development, and only a plain `.json` path under /public. */
export function arkLocalSnapshotPath(asked: unknown, development: boolean): string | null {
    if (!development || typeof asked !== "string" || asked.length > 200) return null;
    if (!LOCAL_PATH.test(asked) || asked.split("/").some((part) => part === "." || part === "..")) return null;
    return asked;
}

/** A local file's answer, decoded as the live read is: the snapshot, and its founders beside it. */
export function arkLocalSnapshotOf(raw: unknown): {snapshot: ArkSnapshot; founders: ArkFounders} | null {
    // (`/api/ark/voyage`'s shape too: `{snapshot, founders}`; the founders are read from the snapshot either way.)
    const body = raw && typeof raw === "object" && !Array.isArray(raw) && "snapshot" in raw ? (raw as {snapshot: unknown}).snapshot : raw;
    const snapshot = decodeArkSnapshot(body);
    return snapshot ? {snapshot, founders: arkFoundersOf(body)} : null;
}
