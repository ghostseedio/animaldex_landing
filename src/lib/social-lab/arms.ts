// The hook lab's experiment arms: every video, carousel and text post is made
// with one arm per dimension, recorded on the item, and scored later from its
// per-post numbers (bandit.ts). The instructions here go straight into the
// prompts, so each arm is a recipe the writer can follow, not a label.
//
// Why these: on TikTok our videos lost a quarter of viewers in the first
// second and two thirds by 3 seconds (Oct 2026), so every arm is about the
// opening beat, the length and the ending — the parts that decide whether a
// feed keeps pushing a post.

export type ArmSpec = {label: string; instruction: string};

export const HOOK_STYLES = {
    question: {
        label: "Question",
        instruction: `Open with a QUESTION the viewer cannot answer without watching (never yes/no, never "Did you know"). Spoken hook = the question; on-screen hook = the question, 3–7 words, ending in "?". E.g. "Which animal can't die of old age?"`
    },
    shock_number: {
        label: "Shocking number",
        instruction: `Open on ONE jaw-dropping number or record from the source, said first: "1,800 PSI." / "It ate 80% of its body weight." On-screen hook = the number plus 1–3 words, e.g. "1,800 PSI BITE".`
    },
    contrarian: {
        label: "Contrarian",
        instruction: `Open by flatly contradicting what most people believe, in under 8 words: "Sharks aren't the ocean's top killer." Then prove it. On-screen hook = the contradiction, e.g. "SHARKS AREN'T #1".`
    },
    pov: {
        label: "POV",
        instruction: `Open with "POV:" putting the viewer inside the moment, second person, present tense: "POV: a hippo just noticed you." On-screen hook starts with "POV:".`
    },
    quiz: {
        label: "Quiz / guess",
        instruction: `Open as a challenge: "Guess the animal in 3 seconds." / "Only 1 in 10 people get this." Hold the answer back until late, then reveal it. On-screen hook = the challenge, e.g. "GUESS THE ANIMAL".`
    },
    countdown: {
        label: "Countdown tease",
        instruction: `Open by teasing the top spot: "Number one isn't even a predator." Count down with each beat topping the last; pay off #1 at the end. On-screen hook names the twist, e.g. "#1 HAS NO TEETH" (never a generic "#1 WILL SHOCK YOU").`
    },
    you_vs: {
        label: "You vs the animal",
        instruction: `Open by pitting the viewer against the animal: "You vs a gorilla: you'd last 4 seconds." Keep comparing the animal to the viewer's own body and life. On-screen hook = "YOU VS <ANIMAL>".`
    },
    mystery: {
        label: "Mystery",
        instruction: `Open on the strangest true detail with the explanation withheld: "This frog freezes solid every winter. And lives." Explain why only in the second half. On-screen hook = the strange detail in 3–6 words.`
    }
} as const satisfies Record<string, ArmSpec>;
export type HookStyle = keyof typeof HOOK_STYLES;

/** Target length of an editorial (narrated photo) video. Battles and creature reveals keep their own length. */
export const VIDEO_LENGTHS = {
    short: {label: "12–18 s", instruction: "12–18 seconds: 3–4 scenes, 30–45 narrated words in total. One idea, one payoff.", scenes: [3, 4], words: [30, 45]},
    medium: {label: "20–28 s", instruction: "20–28 seconds: 5–6 scenes, 50–70 narrated words in total.", scenes: [5, 6], words: [50, 70]},
    long: {label: "32–45 s", instruction: "32–45 seconds: 7–9 scenes, 80–110 narrated words in total.", scenes: [7, 9], words: [80, 110]}
} as const satisfies Record<string, ArmSpec & {scenes: readonly [number, number]; words: readonly [number, number]}>;
export type VideoLength = keyof typeof VIDEO_LENGTHS;

export const ENDINGS = {
    loop: {
        label: "Seamless loop",
        instruction: `No call-to-action card: the video ends on the last beat and should loop. Write the final line so it flows straight back into the first line (e.g. ends "…which is exactly why" before a hook that starts "it can't die of old age"). cta_narration and cta_text: "".`
    },
    cta_card: {
        label: "CTA end card",
        instruction: `End on a short call-to-action card: cta_narration is one line that splits the audience or invites a comment ("Team lion or team tiger? Tell me."), cta_text 2–5 words.`
    }
} as const satisfies Record<string, ArmSpec>;
export type Ending = keyof typeof ENDINGS;

/** How a battle or creature video opens. */
export const OPENERS = {
    cold_open: {
        label: "Cold open (action first)",
        instruction: "Open on the most dramatic AI shot of the video for ~2 seconds under the spoken hook, before the VS / parents card. Movement in the very first frame."
    },
    card_first: {
        label: "Card first",
        instruction: "Open on the designed VS / parents card under the spoken hook, then the action."
    }
} as const satisfies Record<string, ArmSpec>;
export type Opener = keyof typeof OPENERS;

export const TEXT_FORMATS = {
    hot_take: {label: "Hot take", instruction: `A debatable, underdog take grounded in the page ("Hot take: hyenas are better hunters than lions."), then the one fact that backs it, then a question that splits people.`},
    poll: {label: "Poll", instruction: "A poll: a sharp question and 2–4 short options (max 25 characters each) that people will argue about."},
    would_you_rather: {label: "Would you rather", instruction: `"Would you rather…" with two vivid animal-powered options taken from the page, e.g. "Would you rather have a cheetah's speed or a bear's strength?"`},
    wild_fact: {label: "Wild fact", instruction: "One incredible, true fact from the page that sounds made up, in plain words, plus a one-line punchline."},
    question: {label: "Question", instruction: "A direct question to followers that is fun to answer in the replies (a pick, a ranking, a story), built on a detail from the page."}
} as const satisfies Record<string, ArmSpec>;
export type TextFormat = keyof typeof TEXT_FORMATS;

export const DIMENSIONS = {
    hookStyle: HOOK_STYLES,
    length: VIDEO_LENGTHS,
    ending: ENDINGS,
    opener: OPENERS,
    textFormat: TEXT_FORMATS
} as const;
export type Dimension = keyof typeof DIMENSIONS;

/** What an item records: the arm it used on each dimension it tested. Version bumps when the recipes change materially. */
export type Experiment = {
    version: number;
    hookStyle?: HookStyle;
    length?: VideoLength;
    ending?: Ending;
    opener?: Opener;
    textFormat?: TextFormat;
};

export const EXPERIMENT_VERSION = 1;

/** Which dimensions each kind of item tests. */
export const KIND_DIMENSIONS = {
    editorial: ["hookStyle", "length", "ending"],
    battle: ["hookStyle", "opener", "ending"],
    creature: ["hookStyle", "opener", "ending"],
    carousel: ["hookStyle"],
    text: ["textFormat"]
} as const satisfies Record<string, readonly Dimension[]>;
export type ExperimentKind = keyof typeof KIND_DIMENSIONS;

export function armLabel(dimension: Dimension, arm: string) {
    const table = DIMENSIONS[dimension] as Record<string, ArmSpec>;
    return table[arm]?.label ?? arm;
}

export function isArm(dimension: Dimension, value: unknown): boolean {
    return typeof value === "string" && Object.hasOwn(DIMENSIONS[dimension], value);
}

/** The prompt block that tells a writer which arms this item uses. */
export function experimentBrief(experiment: Experiment | null | undefined) {
    if (!experiment) return "";
    const lines: string[] = [];
    if (experiment.hookStyle) lines.push(`HOOK STYLE — ${HOOK_STYLES[experiment.hookStyle].label}: ${HOOK_STYLES[experiment.hookStyle].instruction}`);
    if (experiment.length) lines.push(`LENGTH — ${VIDEO_LENGTHS[experiment.length].instruction}`);
    if (experiment.opener) lines.push(`OPENER — ${OPENERS[experiment.opener].instruction}`);
    if (experiment.ending) lines.push(`ENDING — ${ENDINGS[experiment.ending].instruction}`);
    if (experiment.textFormat) lines.push(`FORMAT — ${TEXT_FORMATS[experiment.textFormat].label}: ${TEXT_FORMATS[experiment.textFormat].instruction}`);
    if (!lines.length) return "";
    return `THIS ITEM'S EXPERIMENT (we test what keeps viewers; follow it exactly, it overrides any default above):\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
