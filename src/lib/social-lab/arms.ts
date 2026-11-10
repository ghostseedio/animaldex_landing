// The hook lab's experiment arms: every video, carousel and text post is made
// with one arm per dimension, recorded on the item, and scored later from its
// per-post numbers (bandit.ts). The instructions here go straight into the
// prompts, so each arm is a recipe the writer can follow, not a label.
//
// Why these: on TikTok our videos lost a quarter of viewers in the first
// second and two thirds by 3 seconds (Oct 2026), so every arm is about the
// opening beat, the length and the ending — the parts that decide whether a
// feed keeps pushing a post — plus the one reaction (share, save, comment,
// watch to the end) the item is built to get.

export type ArmSpec = {label: string; instruction: string};

export const HOOK_STYLES = {
    question: {
        label: "Question",
        instruction: `Open with a QUESTION the viewer cannot answer without watching (never yes/no, never "Did you know"). Spoken hook = the question; on-screen hook = the question, 3–7 words, ending in "?". E.g. "Which animal can't die of old age?"`
    },
    shock_number: {
        label: "Shocking number",
        instruction: `Open on ONE jaw-dropping number or record from the source, made easy to feel: "It eats its own weight in one night." / "It weighs as much as a car." On-screen hook = the number in plain words, e.g. "EATS ITS WEIGHT DAILY", never units a child doesn't know (no "PSI").`
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

/**
 * Target length of an editorial (narrated photo) video. Battles and creature
 * reveals keep their own length. No long arm: by Oct 28 2026 our 43–46 s
 * videos were watched to the end by 1–2% on TikTok, the 18 s ones by 4.5%.
 * Micro (Nov 2026): our average watch was 4.75 s, and finishing is what
 * TikTok weighs most, so a 7–12 s cut is tested against the other two.
 */
export const VIDEO_LENGTHS = {
    micro: {label: "7–12 s", instruction: "7–12 seconds: exactly 3 scenes, 18–28 narrated words in total. The hook line sets up the payoff, the middle beat builds it, the last beat pays it off; nothing else.", scenes: [3, 3], words: [18, 28]},
    short: {label: "12–18 s", instruction: "12–18 seconds: 3–4 scenes, 30–45 narrated words in total. One idea, one payoff.", scenes: [3, 4], words: [30, 45]},
    medium: {label: "20–28 s", instruction: "20–28 seconds: 5–6 scenes, 50–70 narrated words in total.", scenes: [5, 6], words: [50, 70]}
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

/**
 * Whether anyone speaks (Nov 2026). Our AI-voiced videos lost 27% of TikTok
 * viewers by 1 s and 65% by 3 s; the founder's own phone uploads, with no AI
 * voice, held 45% at 3 s against 35%, and many of the animal "mentality" winners
 * are text over a song with no voice at all. So the AI voice is tested against
 * none: the viewer reads the lines over the music.
 */
export const VOICES = {
    ai_voice: {label: "AI voiceover", instruction: "A voiceover reads each shot's narration aloud."},
    no_voice: {
        label: "No voice (text + music)",
        instruction: `NO VOICEOVER: nobody speaks. The viewer READS each shot's narration as on-screen text over the music, so write it to be read, not said: at most 9 words per shot, punchy, no filler ("you see", "so", "well"), one idea per shot, and the first shot's narration is the hook itself.`
    }
} as const satisfies Record<string, ArmSpec>;
export type Voice = keyof typeof VOICES;

/**
 * Arms no new item draws. Their old items keep their scores, so the lab's
 * history stays honest. no_voice: retired Nov 10 2026 by the founder: every
 * video is voiced (the silent cuts kept being fixed by hand).
 */
export const RETIRED_ARMS: Partial<Record<Dimension, readonly string[]>> = {voice: ["no_voice"]};

/**
 * The one reaction a video or carousel is built to get. The writer follows the
 * recipe, the reviewer (review.ts) asks the question before anything is
 * rendered, and the lab judges the item on that reaction's own number.
 */
export const INTENTS = {
    share: {
        label: "Share (relatable)",
        question: "Would a viewer send this to one specific friend? Who, and with what message?",
        instruction: `Built to be SENT to a friend. Make it relatable: tie the animal to everyday life, a kind of person, a friendship, a pet owner's moment or a feeling everyone has ("This is you and your best friend.", "Every cat owner has seen this."). The viewer should think of one person within 3 seconds. End with a line that asks them to send it ("Send this to the friend who…"), never a generic "follow".`
    },
    save: {
        label: "Save (useful)",
        question: "Would a viewer save this to come back to? What would they use it for?",
        instruction: `Built to be SAVED. Make it useful later: a short list, how to tell two animals apart, what to do if you meet one, where and when to see it. Promise the payoff in the first line ("3 ways to tell a crow from a raven."), deliver it as numbered, easy beats, and end with "Save this for…" naming the moment they will need it.`
    },
    comment: {
        label: "Comment (debate)",
        question: "Would a viewer feel they have to comment? What exactly would they type?",
        instruction: `Built to make people COMMENT. Take a side people will argue with (a verdict, a ranking, an underdog pick), say it flatly in the first line and back it with true facts. Leave one honest point for the other side. End with a two-option question answerable in one word ("Lion or tiger? One word."), never "let me know your thoughts".`
    },
    stay: {
        label: "Watch to the end (news)",
        question: "Would a viewer watch to the very end? What stops them scrolling?",
        instruction: `Built so nobody scrolls away: this is NEWS. Say in the first line what just happened or is happening right now, in plain words ("Right now, bears are…"). Ask the question everyone has in the first 3 seconds and answer it only in the last beat; each beat adds one new thing, no recap.`
    }
} as const satisfies Record<string, ArmSpec & {question: string}>;
export type Intent = keyof typeof INTENTS;

/** Articles younger than this are news: their videos are built to be watched now. */
export const FRESH_ARTICLE_HOURS = 72;

/**
 * The reactions a page can honestly be built for: a battle invites comments,
 * a guide gets saved, today's news holds. Fresh news videos are always "stay";
 * a take carousel ("the usual vs the lion", "5 animals") is sent or argued over.
 */
export function intentsFor(kind: ExperimentKind, sourceType: string | null, fresh = false, carouselFormat: CarouselFormat | null = null): Intent[] {
    if (fresh && kind !== "carousel" && kind !== "text") return ["stay"];
    if (kind === "carousel" && carouselFormat && carouselFormat !== "page") return ["share", "comment"];
    const fits: Record<string, Intent[]> = {
        blog: ["share", "save", "comment"],
        comparison: ["comment", "share"],
        hybrid: ["share", "comment"],
        fusion: ["share", "comment"],
        ranking: ["comment", "save"],
        location: ["save", "share"],
        lesson: ["share", "save"],
        guess: ["comment"],
        scan: ["comment", "share"],
        you_vs: ["comment", "share"],
        would_you_rather: ["comment"],
        pokemon: ["comment", "share"]
    };
    return (sourceType ? fits[sourceType] : undefined) ?? ["share", "save", "comment"];
}

export const TEXT_FORMATS = {
    hot_take: {label: "Hot take", instruction: `A debatable, underdog take grounded in the page ("Hot take: hyenas are better hunters than lions."), then the one fact that backs it, then a question that splits people.`},
    poll: {label: "Poll", instruction: "A poll: a sharp question and 2–4 short options (max 25 characters each) that people will argue about."},
    would_you_rather: {label: "Would you rather", instruction: `"Would you rather…" with two vivid animal-powered options taken from the page, e.g. "Would you rather have a cheetah's speed or a bear's strength?"`},
    wild_fact: {label: "Wild fact", instruction: "One incredible, true fact from the page that sounds made up, in plain words, plus a one-line punchline."},
    question: {label: "Question", instruction: "A direct question to followers that is fun to answer in the replies (a pick, a ranking, a story), built on a detail from the page."},
    usual_vs_animal: {label: "The usual vs the animal", instruction: `THE USUAL VS THE <ANIMAL>: take one everyday idea from IDEAS, and one animal on the page whose real behaviour (from the page or ANIMAL RECORDS) sees it differently. Three short lines: "The usual answer: <the advice everyone gives, at most 12 words>." / "The <animal>'s take: <a different move, at most 25 words>." / "Because <the real behaviour, at most 15 words>." Then a two-option question ("Which would you try?"). The take must be a move the usual answer would not give, not the usual answer in costume.`},
    five_animals: {label: "5 animals, 1 idea", instruction: `5 ANIMALS, 1 IDEA: one everyday idea from IDEAS, then five animals from the page, one line each: "<Animal>: <its take, at most 8 words>". Every take comes from that animal's real behaviour (page or ANIMAL RECORDS) and differs from the other four. End with "Which one is you?". In the long version add each take's behaviour in a few words.`}
} as const satisfies Record<string, ArmSpec>;
export type TextFormat = keyof typeof TEXT_FORMATS;

/** Page families with five or more real animals (a countdown, a place's animals): the only ones a "5 animals" post can be built from. */
export const MULTI_ANIMAL_SOURCES = ["ranking", "location"] as const;
/** Imagined creatures have no real behaviour to build a take on. */
const IMAGINED_SOURCES = ["hybrid", "fusion"];

/** The text formats a page can honestly carry: "5 animals" needs five real animals, an animal's take needs a real one. */
export function textFormatsFor(sourceType: string | null): TextFormat[] {
    return (Object.keys(TEXT_FORMATS) as TextFormat[]).filter((format) => {
        if (format === "five_animals") return sourceType !== null && (MULTI_ANIMAL_SOURCES as readonly string[]).includes(sourceType);
        if (format === "usual_vs_animal") return sourceType === null || !IMAGINED_SOURCES.includes(sourceType);
        return true;
    });
}

/**
 * What a carousel is: one of the page-led shapes (countdown, versus, facts…)
 * the writer picks for the page, or one of the take formats, where an
 * everyday idea meets an animal's real behaviour.
 */
export const CAROUSEL_FORMATS = {
    page: {label: "Page carousel", instruction: "A carousel of the page itself: pick the shape that fits it best."},
    usual_vs_animal: {label: "The usual vs the animal", instruction: `THE USUAL VS THE <ANIMAL>: one everyday idea, the usual answer on a plain grey slide, then one animal's take built on a real behaviour it is known for, and why it sees it that way. The take must be a move the usual answer would not give.`},
    five_animals: {label: "5 animals, 1 idea", instruction: "5 ANIMALS, 1 IDEA: one everyday idea, then five animals from the page, each with its own take built on its real behaviour, all five different. The last slide asks which one is you."},
    // Nov 2026 research: "your month = your <X>" slideshows had the highest comment rate measured (6.2 per 1,000 views).
    birth_month: {label: "Your birth month = your animal", instruction: "YOUR BIRTH MONTH = YOUR ANIMAL: one slide per month, January to December, each giving that month one of the twelve animals and the one real trait people born then share with it. One month (pick it) gets a playful roast instead of praise; the last slide asks which month they are."}
} as const satisfies Record<string, ArmSpec>;
export type CarouselFormat = keyof typeof CAROUSEL_FORMATS;

/** Everyday ideas a take format starts from: ideas and decisions people actually have, never a problem to be labelled. */
export const TAKE_IDEAS = [
    "Start a podcast", "Move abroad", "Quit sugar", "Three things due tomorrow", "Ask for a raise", "Start running",
    "Learn to code", "Start a side business", "Take a gap year", "Get up earlier", "Change careers", "Throw a dinner party",
    "Write a book", "Buy a home or keep renting", "Get a dog", "Go back to school", "Start a YouTube channel",
    "Travel somewhere alone", "Save up for something big", "Join a band", "Say no to a favour", "Make friends in a new city"
] as const;

export const DIMENSIONS = {
    hookStyle: HOOK_STYLES,
    length: VIDEO_LENGTHS,
    ending: ENDINGS,
    opener: OPENERS,
    textFormat: TEXT_FORMATS,
    intent: INTENTS,
    carouselFormat: CAROUSEL_FORMATS,
    voice: VOICES
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
    intent?: Intent;
    carouselFormat?: CarouselFormat;
    voice?: Voice;
};

/** 2 (Oct 29 2026): the 5-year-old hook rule, the intent arm, no long videos, picture-first carousels. */
export const EXPERIMENT_VERSION = 2;

/** Which dimensions each kind of item tests. */
export const KIND_DIMENSIONS = {
    // Every video tests its voice too: an AI voiceover or none (text over music).
    editorial: ["intent", "hookStyle", "length", "ending", "voice"],
    battle: ["intent", "hookStyle", "opener", "ending", "voice"],
    creature: ["intent", "hookStyle", "opener", "ending", "voice"],
    // The lesson has its own hook pattern (the animal's move, then yours), so it tests only its job and ending.
    lesson: ["intent", "ending", "voice"],
    // A guess is built for one reaction (the guess in the comments); it tests how it ends.
    guess: ["intent", "ending", "voice"],
    // Our own footage: what is tested is its job and how it ends.
    scan: ["intent", "ending", "voice"],
    // The three play formats (Nov 2026): a viewer against an animal, a choice between two, a Pokémon quiz.
    you_vs: ["intent", "ending", "voice"],
    would_you_rather: ["intent", "ending", "voice"],
    pokemon: ["intent", "ending", "voice"],
    // Ark clips (Nov 2026): recorded from the live Ark with stored-data captions and no voice; only their length varies.
    ark: ["length"],
    carousel: ["carouselFormat", "intent", "hookStyle"],
    text: ["textFormat"]
} as const satisfies Record<string, readonly Dimension[]>;
export type ExperimentKind = keyof typeof KIND_DIMENSIONS;

/** Carousels made before the take formats were all page carousels: their numbers teach that arm. */
export function withCarouselFormat(kind: "carousel" | "text", experiment: Experiment | null): Experiment | null {
    if (kind !== "carousel" || !experiment || experiment.carouselFormat) return experiment;
    return {...experiment, carouselFormat: "page"};
}

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
    if (experiment.intent) lines.push(`JOB — ${INTENTS[experiment.intent].label}: ${INTENTS[experiment.intent].instruction} Every choice below serves this job; the test before posting is: ${INTENTS[experiment.intent].question}`);
    if (experiment.hookStyle) lines.push(`HOOK STYLE — ${HOOK_STYLES[experiment.hookStyle].label}: ${HOOK_STYLES[experiment.hookStyle].instruction}`);
    if (experiment.length) lines.push(`LENGTH — ${VIDEO_LENGTHS[experiment.length].instruction}`);
    if (experiment.opener) lines.push(`OPENER — ${OPENERS[experiment.opener].instruction}`);
    if (experiment.ending) lines.push(`ENDING — ${ENDINGS[experiment.ending].instruction}`);
    if (experiment.voice === "no_voice") lines.push(`VOICE — ${VOICES.no_voice.instruction}`);
    if (experiment.textFormat) lines.push(`FORMAT — ${TEXT_FORMATS[experiment.textFormat].label}: ${TEXT_FORMATS[experiment.textFormat].instruction}`);
    if (experiment.carouselFormat && experiment.carouselFormat !== "page") lines.push(`FORMAT — ${CAROUSEL_FORMATS[experiment.carouselFormat].label}: ${CAROUSEL_FORMATS[experiment.carouselFormat].instruction}`);
    if (!lines.length) return "";
    return `THIS ITEM'S EXPERIMENT (we test what keeps viewers; follow it exactly, it overrides any default above):\n${lines.map((line) => `- ${line}`).join("\n")}`;
}
