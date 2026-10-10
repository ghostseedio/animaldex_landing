/**
 * iOS `ProfileCaptureGridGrouping`: one grid cell per AnimalDex index, newest
 * capture first; captures without an index each keep their own cell.
 */

export type ProfileGridCapture = {
    id: string;
    animalName: string;
    capturedAt: string | null;
    href: string;
    imageSrc: string;
    animalDexNumber: number | null;
    isMovingMedia: boolean;
};

export type ProfileGridItem<T extends ProfileGridCapture = ProfileGridCapture> = {
    id: string;
    representative: T;
    animalDexNumber: number | null;
    captureCount: number;
    isMovingMedia: boolean;
};

const time = (value: string | null) => (value ? Date.parse(value) || 0 : 0);

/** iOS pads to three digits: #007, #042, #1234. */
export function formatAnimalDexNumber(value: number) {
    return `#${String(value).padStart(3, "0")}`;
}

export function buildProfileGridItems<T extends ProfileGridCapture>(captures: T[], sort: "recent" | "index"): ProfileGridItem<T>[] {
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
