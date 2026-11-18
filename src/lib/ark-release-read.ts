/**
 * The page's read of the released animals (`/api/ark/release`, the public `voyage_releases_public_v1`: animal ids,
 * days and a number), shared by the parts of the tapped animal's card that need it (the wild skill row, the release
 * offer, "Estimated time left"). One read for the page, again every few minutes while the server's `release_to_wild`
 * is on; while it is off the answer is null, nothing shows and it is asked again only now and then.
 *
 * Loaded only with those lazy parts: never in the Ark page's static JavaScript.
 */

import {useEffect, useSyncExternalStore} from "react";
import {arkReleasedFromApi, type ArkReleased} from "@/lib/ark-release";

type Released = Record<string, ArkReleased>;

const REFRESH_MS = 180_000;
const OFF_REFRESH_MS = 900_000;

/** undefined: not read yet. null: off (or the read is absent). */
let state: Released | null | undefined;
let readAt = 0;
let reading = false;
const listeners = new Set<() => void>();

function set(next: Released | null) {
    state = next;
    listeners.forEach((listener) => listener());
}

/** Reads the list when it has not been read, or is old. */
export function readArkReleased(now = Date.now()) {
    if (typeof window === "undefined" || reading) return;
    if (state !== undefined && now - readAt < (state === null ? OFF_REFRESH_MS : REFRESH_MS)) return;
    reading = true;
    readAt = now;
    void fetch("/api/ark/release")
        .then((response) => (response.ok ? response.json() : null))
        .then((body: {released?: unknown} | null) => set(body?.released ? arkReleasedFromApi(body.released) : null))
        .catch(() => {
            if (state === undefined) set(null);
        })
        .finally(() => {
            reading = false;
        });
}

/** A release just made by the reader: on the page at once (the next read has the server's own). */
export function noteArkReleased(entry: ArkReleased) {
    set({...(state ?? {}), [entry.animalId]: entry});
}

/** The released animals by id; null while unread, off or absent. */
export function useArkReleased(): Released | null {
    const value = useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => state ?? null,
        () => null
    );
    useEffect(() => readArkReleased(), []);
    return value;
}

/** This animal's release, if it was released and lives free. */
export function arkReleasedEntry(animal: {id: string}, released: Released | null): ArkReleased | null {
    return released?.[animal.id.toLowerCase()] ?? null;
}
