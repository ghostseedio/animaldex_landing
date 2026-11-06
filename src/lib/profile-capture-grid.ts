/**
 * iOS `ProfileCaptureGridGrouping`: one grid cell per AnimalDex index, newest
 * capture first; captures without an index each keep their own cell.
 */

import type {ProfileCaptureGridSort} from "@/lib/profile-editor";

export type ProfileGridCapture = {
    id: string;
    animalName: string;
    capturedAt: string | null;
    href: string;
    imageSrc: string;
    animalDexNumber: number | null;
    isMovingMedia: boolean;
    level?: number;
};

export type ProfileGridItem<T extends ProfileGridCapture = ProfileGridCapture> = {
    id: string;
    representative: T;
    animalDexNumber: number | null;
    captureCount: number;
    /** Level of the capture the cell opens (iOS `ProfileCaptureGridItem.level`). */
    level: number;
    isMovingMedia: boolean;
};

const time = (value: string | null) => (value ? Date.parse(value) || 0 : 0);

/** iOS pads to three digits: #007, #042, #1234. */
export function formatAnimalDexNumber(value: number) {
    return `#${String(value).padStart(3, "0")}`;
}

/**
 * The grid in the owner's order. Recent and index group by AnimalDex index;
 * custom (iOS `customOrderedSnapshot`) is one cell per chosen capture, in the
 * order they were tapped, and nothing else. Star order needs each card's star
 * rating, which the web does not read yet: it shows newest first.
 */
export function buildProfileGridItems<T extends ProfileGridCapture>(
    captures: T[],
    sort: ProfileCaptureGridSort,
    customCaptureIds: string[] = []
): ProfileGridItem<T>[] {
    if (sort === "custom") {
        const byId = new Map(captures.map((capture) => [capture.id.toLowerCase(), capture] as const));
        const seen = new Set<string>();
        return customCaptureIds.flatMap((raw) => {
            const id = raw.toLowerCase();
            const capture = byId.get(id);
            if (!capture || seen.has(id)) return [];
            seen.add(id);
            return [{
                id: `capture:${id}`,
                representative: capture,
                animalDexNumber: capture.animalDexNumber,
                captureCount: 1,
                level: capture.level ?? 1,
                isMovingMedia: capture.isMovingMedia
            }];
        });
    }

    const groups = new Map<string, T[]>();
    for (const capture of captures) {
        const key = capture.animalDexNumber != null ? `index:${capture.animalDexNumber}` : `capture:${capture.id.toLowerCase()}`;
        const group = groups.get(key);
        if (group) group.push(capture);
        else groups.set(key, [capture]);
    }

    const items = Array.from(groups, ([id, group]) => {
        const sorted = [...group].sort((a, b) => time(b.capturedAt) - time(a.capturedAt));
        const representative = sorted[0];
        return {
            id,
            representative,
            animalDexNumber: representative.animalDexNumber,
            captureCount: group.length,
            level: representative.level ?? 1,
            isMovingMedia: representative.isMovingMedia
        };
    });

    return items.sort((a, b) => {
        if (sort === "index") {
            const left = a.animalDexNumber ?? Number.POSITIVE_INFINITY;
            const right = b.animalDexNumber ?? Number.POSITIVE_INFINITY;
            if (left !== right) return left - right;
        }
        const byTime = time(b.representative.capturedAt) - time(a.representative.capturedAt);
        return byTime || a.id.localeCompare(b.id);
    });
}
