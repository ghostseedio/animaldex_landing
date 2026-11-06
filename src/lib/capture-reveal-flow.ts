/**
 * The reveal's beats and words (iOS `CaptureRevealFlowView`,
 * `CaptureRevealTimeline`): identify, lock, the discovery ceremony for a
 * first-time species (catalog, morph), then the animal (`companion`).
 */

export type CaptureRevealPhase = "identify" | "locked" | "catalog" | "morph" | "companion";

type HeaderWords = {
    notSureYet: string;
    newSpecies: string;
    identified: string;
    newAnimalDiscovered: string;
    reanalyzeFree: string;
    matched: string;
    subjectLocked: string;
    addedToYourAnimalDex: string;
};

/** iOS `headerTitle` / `headerDetail`. Not a confident identification is said plainly. */
export function captureRevealHeader(input: {phase: CaptureRevealPhase; isNewSpecies: boolean; isUncertain: boolean; words: HeaderWords}): {title: string; detail: string} {
    const {phase, words} = input;
    if (input.isUncertain && (phase === "identify" || phase === "locked")) {
        // Re-analysis is free for every account, and it lives on the card.
        return {title: words.notSureYet, detail: words.reanalyzeFree};
    }
    switch (phase) {
        case "identify": return {title: input.isNewSpecies ? words.newSpecies : words.identified, detail: words.matched};
        case "locked": return {title: input.isNewSpecies ? words.newSpecies : words.identified, detail: words.subjectLocked};
        case "catalog":
        case "morph": return {title: words.newAnimalDiscovered, detail: words.addedToYourAnimalDex};
        default: return {title: "", detail: ""};
    }
}

/**
 * The beats after the first frame, each with how long it waits after the one
 * before (iOS `CaptureRevealTimeline.durations`). `done` hands over to the
 * animal, or to the card when there is no Power to show.
 */
export function captureRevealTimeline(input: {discovery: boolean; reduceMotion: boolean}): Array<{phase: Exclude<CaptureRevealPhase, "identify" | "companion"> | "done"; afterMs: number}> {
    const durations = input.reduceMotion
        ? {lockFallback: 200, briefDwell: 250, catalogScroll: 850, morph: 600, discoveryDwell: 250}
        : {lockFallback: 800, briefDwell: 450, catalogScroll: 2250, morph: 1650, discoveryDwell: 500};
    if (!input.discovery) {
        return [
            {phase: "locked", afterMs: durations.lockFallback},
            {phase: "done", afterMs: durations.briefDwell}
        ];
    }
    return [
        {phase: "locked", afterMs: durations.lockFallback},
        {phase: "catalog", afterMs: durations.briefDwell},
        {phase: "morph", afterMs: durations.catalogScroll},
        {phase: "done", afterMs: durations.morph + durations.discoveryDwell}
    ];
}
