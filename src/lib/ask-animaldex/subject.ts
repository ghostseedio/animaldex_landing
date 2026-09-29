/**
 * What the assistant is being asked *about*.
 *
 * One drawer is mounted for the whole site, so the subject cannot be a prop on
 * a species page — it has to be resolvable from wherever the reader happens to
 * be. A page that knows its own subject declares it (see `AskSubjectBridge`);
 * anything else falls back to reading the route, which is enough to tell a
 * species page from an article from the collection.
 */

import type {AskThinkingHints} from "@/lib/ask-animaldex/thinking-phases";

export type AskSubjectKind =
    | "species"
    | "comparison"
    | "location"
    | "article"
    | "capture"
    | "collection"
    | "site";

export type AskSubject = {
    /** `species` answers from one animal's canonical content; `general` from the catalogue. */
    scope: "species" | "general";
    kind: AskSubjectKind;
    /** Species slug, when the subject is one animal. */
    slug: string | null;
    /** The animal's name, when known, else the page's own title. */
    name: string | null;
    /** The reader's own capture, when they are looking at one. */
    captureId: string | null;
    /** Their own photo of this animal is on screen, so the photo medium is offered. */
    hasReaderPhoto: boolean;
    title: string | null;
    summary: string | null;
    /** Route path with the locale prefix removed. */
    path: string;
};

/** Everything the drawer needs to write honest suggestions and waiting lines. */
export type AskHints = AskThinkingHints & {
    archetypeName: string | null;
    transition: {
        kind: "phaseChange" | "trigger";
        from: string;
        to: string;
        fromFrequency: string | null;
        toFrequency: string | null;
    } | null;
    frequencyBehavior: string | null;
    primaryFrequency: string | null;
};

export const EMPTY_ASK_HINTS: AskHints = {
    animalName: null,
    principleName: null,
    archetypeName: null,
    domains: [],
    failureModes: [],
    transition: null,
    frequencyBehavior: null,
    primaryFrequency: null,
    hasDynamics: false
};

export function emptyAskSubject(path = "/"): AskSubject {
    return {
        scope: "general",
        kind: "site",
        slug: null,
        name: null,
        captureId: null,
        hasReaderPhoto: false,
        title: null,
        summary: null,
        path
    };
}

const LOCALE_PREFIX = /^\/[a-z]{2}(-[A-Z]{2})?(?=\/|$)/;

/** Strips the locale segment so route matching is written once. */
export function askPathWithoutLocale(path: string): string {
    const withoutQuery = path.split(/[?#]/)[0] || "/";
    const stripped = withoutQuery.replace(LOCALE_PREFIX, "");
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

/**
 * Best-effort subject from the route alone.
 *
 * Deliberately conservative: it sets `scope: "species"` only for
 * `/animals/<slug>`, where the slug really is one species. A comparison or a
 * location page mentions several animals, so those stay general and let the
 * question pick the subject.
 */
export function askSubjectFromPath(rawPath: string): AskSubject {
    const path = askPathWithoutLocale(rawPath);
    const segments = path.split("/").filter(Boolean);
    const base = emptyAskSubject(path);

    if (segments[0] === "animals" && segments[1]) {
        return {...base, scope: "species", kind: "species", slug: segments[1], name: null};
    }
    if (segments[0] === "comparisons" && segments[1]) {
        return {...base, kind: "comparison"};
    }
    if (segments[0] === "locations" && segments[1]) {
        return {...base, kind: "location"};
    }
    if (segments[0] === "blog" && segments[1]) {
        return {...base, kind: "article"};
    }
    if (segments[0] === "app" && segments[1] === "capture" && segments[2]) {
        return {...base, kind: "capture", captureId: segments[2]};
    }
    if (segments[0] === "app") {
        return {...base, kind: "collection"};
    }
    return base;
}

export type AskSuggestion = {
    /** Short label for the chip. */
    title: string;
    /** The question actually sent. */
    prompt: string;
};

/**
 * Openers for a blank thread.
 *
 * Ported from `LearnAskPromptLibrary.suggestions` on iOS: when the species has
 * System Dynamics, the openers name its real states and failure modes, because
 * a card that already holds that content asking "Why this Power?" is the less
 * informed surface.
 */
export function askSuggestions(subject: AskSubject, hints: AskHints): AskSuggestion[] {
    if (subject.scope !== "species") return generalSuggestions(subject);

    const name = hints.animalName?.trim() || subject.name?.trim() || "this animal";
    const principleName = hints.principleName?.trim() || null;

    if (!hints.hasDynamics) {
        // The Animal Power defaults, in the order iOS offers them.
        return [
            {
                title: "Understand",
                prompt: principleName ? `Why is its Power ${principleName}?` : `Why does AnimalDex read ${name} this way?`
            },
            {
                title: "Apply",
                prompt: principleName
                    ? `How could I use ${principleName} in my life?`
                    : `How could I use ${name}'s pattern in my life?`
            },
            {
                title: "Explore",
                prompt: principleName
                    ? `What happens when ${principleName} goes too far?`
                    : `Where does ${name}'s pattern go too far?`
            }
        ];
    }

    const system = hints.archetypeName?.trim() || principleName || `${name}'s system`;
    const simply: AskSuggestion = {
        title: "Explain this simply",
        prompt: `Explain ${name}'s system, ${system}, in simple terms.`
    };
    const failure: AskSuggestion = {
        title: "What's the failure mode?",
        prompt: hints.failureModes[0]
            ? `What happens when ${name} hits “${hints.failureModes[0]}”?`
            : `What is the failure mode of ${system}?`
    };
    const apply: AskSuggestion = {
        title: "Apply",
        prompt: principleName
            ? `How could I use ${principleName} in my life?`
            : `How could I use ${name}'s pattern in my life?`
    };

    const transition = hints.transition;
    if (transition) {
        if (transition.kind === "phaseChange") {
            return [
                {
                    title: "What triggers the phase change?",
                    prompt: `What pushes ${name} from its ${transition.from.toLowerCase()} state into its ${transition.to.toLowerCase()} state?`
                },
                {
                    title: "Why does it change state?",
                    prompt: transition.fromFrequency && transition.toFrequency
                        ? `Why does ${name} shift from a ${transition.fromFrequency.toLowerCase()}-frequency pattern to a ${transition.toFrequency.toLowerCase()}-frequency pattern, and is it reversible?`
                        : `Why does ${name} change operating state, and is it reversible?`
                },
                apply
            ];
        }
        return [
            simply,
            {
                title: "When does it switch?",
                prompt: `When does ${name} switch from ${transition.from.toLowerCase()} into ${transition.to.toLowerCase()}, and what brings it back?`
            },
            apply
        ];
    }

    switch (hints.frequencyBehavior) {
        case "adaptive":
            return [
                simply,
                {
                    title: "How does it switch states?",
                    prompt: `How does ${name} decide when to change its operating state?`
                },
                apply
            ];
        case "bimodal":
        case "multimodal":
            return [
                simply,
                {
                    title: "How do its modes work together?",
                    prompt: `How do ${name}'s operating modes work together?`
                },
                apply
            ];
        default: {
            const frequency = hints.primaryFrequency && hints.primaryFrequency !== "UNKNOWN"
                ? hints.primaryFrequency.toLowerCase()
                : null;
            return [
                simply,
                {
                    title: frequency ? `Why ${frequency} frequency?` : "Why this frequency?",
                    prompt: frequency
                        ? `Why is ${name} a ${frequency}-frequency system?`
                        : `Why does ${name} operate at this frequency?`
                },
                hints.domains[0]
                    ? {
                        title: "Where else does this appear?",
                        prompt: `Where does the ${system} pattern show up in ${hints.domains[0].toLowerCase()}?`
                    }
                    : failure
            ];
        }
    }
}

/**
 * Openers when the reader is not on one animal's page.
 *
 * These name the page they are on where there is one, because "ask me anything"
 * on a blank thread is the same dead end as a reflective follow-up question.
 */
function generalSuggestions(subject: AskSubject): AskSuggestion[] {
    const title = subject.title?.trim() || null;

    switch (subject.kind) {
        case "article":
            return [
                title
                    ? {title: "Explain this simply", prompt: `Explain the main idea of “${title}” in simple terms.`}
                    : {title: "Explain this simply", prompt: "Explain what this article is getting at in simple terms."},
                {title: "Which animals?", prompt: "Which animals on AnimalDex does this apply to?"},
                {title: "Go deeper", prompt: "What is the biology behind this?"}
            ];
        case "comparison":
            return [
                {
                    title: "Who actually wins?",
                    prompt: title
                        ? `In ${title}, which one's body and behaviour actually decide it?`
                        : "Which one's body and behaviour actually decide this matchup?"
                },
                {title: "How do they differ?", prompt: "What is the biggest real difference between these two animals?"},
                {title: "Compare their Powers", prompt: "How do these two animals' Powers differ?"}
            ];
        case "location":
            return [
                {
                    title: "What should I look for?",
                    prompt: title ? `What should I look for in ${title}?` : "What should I look for here?"
                },
                {title: "Best time to go", prompt: "When are the animals here most active?"},
                {title: "Hardest to spot", prompt: "Which animal here is hardest to spot, and why?"}
            ];
        case "capture":
        case "collection":
            return [
                {title: "Explain my animal", prompt: "Explain this animal's Power in simple terms."},
                {title: "What's it good for?", prompt: "Where would this animal's pattern actually help me?"},
                {title: "What breaks it?", prompt: "What makes this animal's pattern fail?"}
            ];
        default:
            return [
                {title: "How Powers work", prompt: "How does AnimalDex turn an animal's behaviour into a Power?"},
                {title: "Ask about an animal", prompt: "What makes the mantis shrimp's strike so fast?"},
                {title: "Compare two animals", prompt: "Compare a wolf and a hyena as hunting systems."}
            ];
    }
}
