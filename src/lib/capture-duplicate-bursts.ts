/**
 * Which of a person's captures are the same animal twice.
 *
 * Two shapes of that question, and they need different evidence.
 *
 * The first is easy: captures that already resolve to the same AnimalDex number.
 * That is the database's own pairing rule and it needs no judgement.
 *
 * The second is the one that kept coming back. A phone burst sends five photos
 * of one moth as five separate captures, each identified independently, and they
 * land at different depths — "Asota plana" on one, "Tiger Moth" on the next with
 * no scientific name at all. Only the specific one earns a number, so no
 * index-based rule can pair them: the whole problem is that the others have no
 * index.
 *
 * Time alone is not a safe substitute, and this was measured rather than
 * assumed. Pairing on a two-minute window proposed folding a capture named
 * "Anura" — a frog — into a House Fly, and eight unidentified captures into a
 * goat: 114 captures across 52 members, most of them wrong. Requiring the same
 * animal name cut it to three, and the last of those was still wrong — a Canada
 * Goose and a gull, thirty seconds apart, both displayed as "Bird".
 *
 * So a burst pairs only when all of this holds: one owner, one window, exactly
 * one resolved index among them, an identical animal name, and a name specific
 * enough that the catalog would let it hold a number. Everything here is pure so
 * those rules can be tested against the cases that produced them.
 */

export type BurstCapture = {
    captureId: string;
    userId: string;
    /** When the photo was taken; falls back to upload time upstream. */
    capturedAt: string;
    /** Name the analysis gave the animal, as shown to the member. */
    animalName: string | null;
    identityKey: string | null;
    /** AnimalDex number this capture resolves to, or null when it resolves to none. */
    animaldexNumber: number | null;
    /** Catalog entry the analysis is linked to, if any. */
    speciesProfileId: string | null;
    /** Whether the database would let auto-merge consider this capture. */
    mergeEligible: boolean;
};

export type DuplicateProposal = {
    kind: "index" | "burst";
    userId: string;
    number: number;
    parentCaptureId: string;
    /** Entry the parent resolved through, so burst children can be pointed at it. */
    parentSpeciesProfileId: string | null;
    children: string[];
    animalName: string | null;
};

/** Identity keys that mean "we could not tell", which can never evidence a match. */
export const UNIDENTIFIED_KEYS = new Set([
    "unknown_animal",
    "unknown",
    "unidentified_animal",
    "unidentified_capture",
    "unrecognized_animal"
]);

export function slugifyAnimalName(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function byTime(left: BurstCapture, right: BurstCapture) {
    return Date.parse(left.capturedAt) - Date.parse(right.capturedAt);
}

function groupByUser(captures: BurstCapture[]) {
    const byUser = new Map<string, BurstCapture[]>();

    for (const capture of captures) {
        byUser.set(capture.userId, [...(byUser.get(capture.userId) ?? []), capture]);
    }

    return byUser;
}

/**
 * Captures already resolving to the same number, for one owner.
 * The oldest is the parent: it holds the collection history the rest fold into.
 */
export function findIndexDuplicates(captures: BurstCapture[]): DuplicateProposal[] {
    const groups = new Map<string, BurstCapture[]>();

    for (const capture of captures) {
        if (!capture.mergeEligible || capture.animaldexNumber == null) continue;
        const key = `${capture.userId}|${capture.animaldexNumber}`;
        groups.set(key, [...(groups.get(key) ?? []), capture]);
    }

    const proposals: DuplicateProposal[] = [];

    for (const group of Array.from(groups.values())) {
        if (group.length < 2) continue;
        const [parent, ...children] = [...group].sort(byTime);
        proposals.push({
            kind: "index",
            userId: parent.userId,
            number: parent.animaldexNumber!,
            parentCaptureId: parent.captureId,
            parentSpeciesProfileId: parent.speciesProfileId,
            children: children.map((capture) => capture.captureId),
            animalName: parent.animalName
        });
    }

    return proposals.sort((left, right) => right.children.length - left.children.length);
}

/**
 * Bursts where one capture resolved and its identical twins did not.
 *
 * `isBroadName` is passed in rather than hardcoded so the caller can ask the
 * database the same question the indexer asks — "is this name too coarse to hold
 * a number" — instead of this file keeping a second opinion about it.
 */
export function findBurstDuplicates(
    captures: BurstCapture[],
    options: {windowSeconds: number; isBroadName: (slug: string) => boolean}
): DuplicateProposal[] {
    const proposals: DuplicateProposal[] = [];
    const windowMs = options.windowSeconds * 1000;

    for (const [userId, owned] of Array.from(groupByUser(captures))) {
        const ordered = [...owned].sort(byTime);
        let run: BurstCapture[] = [];

        const flush = () => {
            if (run.length < 2) return;

            const resolved = run.filter((capture) => capture.animaldexNumber != null);
            const distinct = new Set(resolved.map((capture) => capture.animaldexNumber));
            // Two indexes in one run and the unresolved captures could belong to
            // either, so the burst says nothing.
            if (distinct.size !== 1) return;

            const parent = [...resolved].sort(byTime)[0];
            const parentName = parent.animalName?.trim().toLowerCase() ?? "";
            if (!parentName || options.isBroadName(slugifyAnimalName(parentName))) return;

            const children = run
                .filter((capture) => capture.animaldexNumber == null)
                .filter((capture) => Boolean(capture.animalName))
                .filter((capture) => !UNIDENTIFIED_KEYS.has(capture.identityKey?.trim().toLowerCase() ?? ""))
                .filter((capture) => capture.animalName!.trim().toLowerCase() === parentName)
                .map((capture) => capture.captureId);

            const siblings = resolved
                .filter((capture) => capture.captureId !== parent.captureId)
                .map((capture) => capture.captureId);

            if (!children.length) return;

            proposals.push({
                kind: "burst",
                userId,
                number: parent.animaldexNumber!,
                parentCaptureId: parent.captureId,
                parentSpeciesProfileId: parent.speciesProfileId,
                children: [...children, ...siblings],
                animalName: parent.animalName
            });
        };

        for (const capture of ordered) {
            const previous = run[run.length - 1];
            if (!previous || Date.parse(capture.capturedAt) - Date.parse(previous.capturedAt) <= windowMs) {
                run.push(capture);
            } else {
                flush();
                run = [capture];
            }
        }

        flush();
    }

    return proposals.sort((left, right) => right.children.length - left.children.length);
}
