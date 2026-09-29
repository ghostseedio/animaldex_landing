/**
 * What the waiting line says while an answer is being written.
 *
 * Ported from `AskThinkingPhases` on iOS, and for the same reason: the status
 * has to appear before the model has produced a single token, so it cannot come
 * from the model. It is derived instead from the question and from the content
 * this species actually has — naming the real domain, the real failure mode,
 * the real state transition it is about to read, rather than cycling the same
 * three lines whatever was asked.
 *
 * Every line is a claim about what is being consulted, so each one is gated on
 * that content existing. It can never promise to read something that is not
 * there.
 */

export type AskThinkingHints = {
    animalName: string | null;
    principleName: string | null;
    /** Cross-domain titles this species is actually mapped into. */
    domains: string[];
    /** Named failure modes, in the order the System Dynamics card shows them. */
    failureModes: string[];
    transition: {from: string; to: string} | null;
    hasDynamics: boolean;
    /** The reader has a Wild Profile, so an application question is matched to it. */
    hasWildProfile?: boolean;
};

export const EMPTY_ASK_THINKING_HINTS: AskThinkingHints = {
    animalName: null,
    principleName: null,
    domains: [],
    failureModes: [],
    transition: null,
    hasDynamics: false
};

function matches(question: string, needles: string[]): boolean {
    return needles.some((needle) => question.includes(needle));
}

/**
 * The cross-domain entry this question names, if any. Matched against the
 * domains this species is actually mapped into.
 */
function matchedDomain(question: string, domains: string[]): string | null {
    for (const title of domains) {
        const lowered = title.toLowerCase();
        if (question.includes(lowered)) return title;
        // "Money & Finance" should also match "money" or "finance".
        const words = lowered.split(/[^a-z]+/i).filter((word) => word.length > 3);
        if (words.some((word) => question.includes(word))) return title;
    }
    return null;
}

/** Ordered status lines for one question. At most three. */
export function askThinkingPhases(question: string, hints: AskThinkingHints): string[] {
    const normalized = question.toLowerCase();
    const phases: string[] = [];
    const add = (line: string) => {
        if (!phases.includes(line)) phases.push(line);
    };

    const animalName = hints.animalName?.trim() || null;
    const principleName = hints.principleName?.trim() || null;

    // A named domain wins over everything: the reader asked to go somewhere
    // specific, so say that place by its own name.
    const domain = matchedDomain(normalized, hints.domains);
    if (domain) add(`Reading its ${domain.toLowerCase()} equivalent…`);

    if (matches(normalized, ["fail", "break", "wrong", "risk", "danger", "collapse", "downside"])
        && hints.failureModes[0]) {
        add(`Checking “${hints.failureModes[0]}”…`);
    }

    if (matches(normalized, ["state", "switch", "trigger", "shift", "change", "phase", "when does"])
        && hints.transition) {
        add(`Tracing ${hints.transition.from} → ${hints.transition.to}…`);
    }

    if (matches(normalized, ["too much", "too far", "shadow", "excess", "overdo", "dark side", "downside"])
        && principleName) {
        add(`Reading the ${principleName} continuum…`);
    }

    if (matches(normalized, ["compare", "versus", " vs ", "difference", "unlike", "other animal"])) {
        add("Lining it up against its contrasts…");
    }

    if (matches(normalized, ["my life", "my work", "apply", "use this", "how do i", "should i", "my "])) {
        add(hints.hasWildProfile ? "Matching it to your Wild Profile…" : "Working out how it applies to you…");
    }

    if (matches(normalized, ["simple", "simply", "eli5", "explain", "what is", "what does", "mean"])) {
        add("Finding the plainest way to say it…");
    }

    if (matches(normalized, ["eat", "diet", "habitat", "live", "sleep", "predator", "lifespan", "hunt"])) {
        add(animalName ? `Reading ${animalName}'s field guide…` : "Reading the field guides…");
    }

    if (matches(normalized, ["where", "see them", "spot", "find one", "visit", "range", "travel"])) {
        add("Checking where they are found…");
    }

    // Always end somewhere honest, and never show a single line that would sit
    // unchanged for the whole wait.
    if (animalName && principleName) {
        add(`Reading ${animalName}'s ${principleName} profile…`);
    } else if (animalName) {
        add(`Reading ${animalName}'s field guide…`);
    } else {
        add("Searching the species catalogue…");
    }
    if (hints.hasDynamics) add("Checking its system dynamics…");
    add("Putting the answer together…");

    return phases.slice(0, 3);
}
