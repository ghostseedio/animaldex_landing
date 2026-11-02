/**
 * The bond with an animal (AnimalDex 20261028150000; docs/companion-loop/SPEC.md,
 * phase 2): one progress system, one level per animal. Every card of an
 * animal on your own account shows the same level, the bond's.
 *
 * Decoders for `animal_bond_v1` (the bond screen) and `animal_companions_v1`
 * (the Companions list, and the level each of your cards shows), and the
 * SPEC's words, word for word with iOS and Android. Every field decodes
 * tolerantly: until the migration is live these calls fail, and a screen
 * shows without its bond parts rather than not at all.
 */

import {companionDisplayName} from "@/lib/ask-animaldex/companion-loop";
import type {AnimalPowerRoute} from "@/lib/animal-powers";
import {decodeAnimalStep, type AnimalStep} from "@/lib/your-step";

export type BondStrands = {lesson: number; practice: number; life: number};

export type BondPower = {name: string | null; earned: boolean; via: AnimalPowerRoute | null; at: string | null};

/** `animal_bond_v1`. */
export type AnimalBond = {
    speciesProfileId: string | null;
    xp: number;
    level: number;
    levelXp: number;
    nextLevelXp: number | null;
    stage: string;
    stageLabel: string;
    mastered: boolean;
    strands: BondStrands;
    lessonCheckPassed: boolean;
    power: BondPower;
    focus: string | null;
    openTrial: string | null;
    /** The open step as the server holds it (3.2): what the Bond tab's step card acts on. */
    openStep: AnimalStep | null;
    yourTrialsDone: number;
    recentDone: Array<{step: string; doneAt: string | null}>;
};

/** One row of `animal_companions_v1`. */
export type CompanionSummary = {
    speciesProfileId: string;
    captureId: string | null;
    /** The species' icon-art slug (added by /api/app/companions), when known. */
    slug: string | null;
    animal: string;
    nickname: string | null;
    level: number;
    stage: string;
    stageLabel: string;
    mastered: boolean;
    strands: BondStrands;
    powerName: string | null;
    powerEarned: boolean;
    focus: string | null;
    openTrial: string | null;
    unread: number;
    referralWaiting: boolean;
    /** The waiting referral's id (iOS 80684c5b), when there is one: the row opens the chat on it. */
    referralId: string | null;
    lastActivity: string | null;
};

/** The chat's `done.bond`: the stage, and since 20261028150000 the level, mastery and strands. */
export type ChatBond = {
    stage: string;
    stageLabel: string;
    level: number | null;
    mastered: boolean;
    strands: BondStrands | null;
};

/** Word for word with iOS and Android (SPEC "Phase 2"). */
export const BOND_COPY = {
    level: "Level {n}",
    xp: "{xp} XP",
    /** The Bond tab's header only (newcomer UX vet, 2026-10-30, P1-2): "Bond level 7 · 12 XP". */
    bondLevel: "Bond level {n}",
    mastered: "Mastered",
    livesItsLesson: "You live its lesson.",
    knowsTheLesson: "Knows the lesson",
    putsItIntoPractice: "Puts it into practice",
    changedYourLife: "Changed something in your life",
    workingOnTitle: "Working on",
    noFocus: "Tell {name} what's going on in your life and it will pick something to work on with you.",
    notThisAnyMore: "Not this any more",
    yourStep: "Your step",
    itsPower: "Its Power",
    talkToIt: "Talk to it"
} as const;

/**
 * AnimalDex 3.2 "Your step" (docs/your-step/SPEC.md, section 2): the step the
 * animal sets, telling it how it went, the Power earned in your own life, the
 * record of what you did together, the Warmup and the Trials. Word for word
 * the same on iOS, Android and the web; the SPEC's `step.eyebrow` is
 * `journey.step.eyebrow` here.
 */
export const YOUR_STEP_COPY = {
    step: {
        eyebrow: "Your step with {name}",
        accept: "I'll do it",
        /** Was "Something else" (newcomer UX vet, 2026-10-30): says what it does. */
        other: "A different step",
        didIt: "I did it",
        otherMessage: "Can I have a different step?",
        pinnedLabel: "Your step"
    },
    report: {
        title: "What happened?",
        placeholder: "Tell {name} how it went",
        attach: "Add a photo or video",
        attachNote: "Optional. It's kept in your record with {name}, and only you can see it.",
        /** Proof bonus (owner, 2026-10-31): report mode's attach caption. Optional; a step counts without it. */
        attachBonus: "Add a photo or video of you doing it · +5 XP",
        send: "Tell {name}",
        /** The step's first button once a report is attached: it opens report mode again. */
        more: "Tell {name} more",
        /** docs/your-step/INLINE.md: the message bar's report mode, the strip above the field. */
        strip: "Telling {name} how your step went"
    },
    earned: {
        title: "{power}",
        subtitle: "{name}'s Power is yours",
        via: "Earned in your own life",
        continue: "Continue"
    },
    done: {
        chip: "Done together",
        xp: "+{xp} XP",
        /** Under the done label when the photo or video showed the step: "+5 XP for your proof". */
        proofBonus: "+{n} XP for your proof"
    },
    record: {
        title: "Your record with {name}",
        empty: "Steps you finish with {name} are kept here.",
        /** A record row whose photo or video showed the step. */
        proof: "Proof"
    },
    steps: {
        sectionTitle: "Your steps",
        row: "{name}: {step}"
    },
    warmup: {
        title: "Warmup",
        offer: "Two quick questions on {power}.",
        offerCount: "{n} quick questions on {power}.",
        take: "Take the warmup (+5 XP)",
        skip: "Skip",
        passed: "Warmup done",
        missed: "Not quite. {name} will tell you how its kind sees it.",
        resultMessage: "I got {right} of {n} on your warmup.",
        /** docs/your-step/INLINE.md: a Warmup question in the thread, shown in capitals. */
        questionLabel: "Warmup · {n} of {total}"
    },
    trial: {
        sectionTitle: "{name}'s Trials",
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
        makeStep: "Make this my step",
        pickedMessage: "I'll try your {difficulty} Trial."
    },
    power: {
        notEarnedLine: "Finish one step with {name} to earn it."
    },
    /**
     * What the chat can do, said where you act (newcomer UX vet, 2026-10-30,
     * P0-2): UI captions, never the animal's words.
     */
    chat: {
        /** The owner's field while no step is open. */
        placeholder: "Tell {name} what's on your mind…",
        /** Under the animal's header in the owner's chat, until the first done step with it. */
        caption: "Bring it something real. It answers from how its kind lives and sets you one step. Do it, and its Power is yours.",
        /** Above the field in a visitor's chat, before their first message. */
        visitorHint: "Ask it about something in your own life."
    },
    /**
     * Web only: the step RPCs' refusals (docs/your-step/SERVER.md), said
     * calmly. Nothing here is a lock or a "tomorrow".
     */
    problems: {
        signIn: "Sign in to keep going with your step.",
        stepGone: "That step isn't open any more.",
        catchFirst: "Capture this animal first to make one of its Trials your step.",
        trialGone: "That Trial isn't available any more.",
        tooShort: "Write a little more: a few words on what happened.",
        oneMedia: "Add one photo or video at most.",
        mediaFailed: "That photo or video didn't upload. Try another, or send it without one.",
        generic: "That didn't go through. Try again in a moment."
    }
} as const;

/**
 * AnimalDex 3.2 Debates (docs/debates/SPEC.md, section 2), replacing
 * Comparison Battles: word for word the same on iOS, Android and the web. The
 * SPEC's `debate.offer` is `debate.offer` here, `roster.optIn` is
 * `roster.optIn`, `heal.one` is `heal.one` and `debates.tab` is
 * `debates.tab`.
 */
export const DEBATE_COPY = {
    offer: "Want to hear how other animals would handle this?",
    /** One name for it everywhere (newcomer UX vet, 2026-10-30, P1-5); was "Compare with other animals". */
    start: "Start a debate",
    startNote: "See how other animals would handle it.",
    private: "Private",
    privateNote: "With your own animals. Only you see it.",
    public: "Public",
    publicNote: "The community votes. Other people's animals can join too.",
    pickAnimals: "Pick up to 3 animals",
    suggested: "Fits this best",
    publicText: "This is what people will see",
    publicTextNote: "Names and details are left out. Change anything you like.",
    approve: "Post the debate",
    stakeNote: "Each animal puts 1 heart on it. The winner's owner gets {credits} Credits.",
    notPublic: "This one stays private. It's too personal to post.",
    begin: "Start the debate",
    reportTitle: "Debate report",
    tryWay: "Try {name}'s way",
    catchToEarn: "Capture a {species} to earn its Power.",
    voteQuestion: "Which animal has the best way for this?",
    vote: "Vote",
    voted: "You voted",
    votesCount: "{n} votes",
    rollover: "Not enough votes yet. Voting stays open another day.",
    won: "{name}'s way won. +{credits} Credits",
    lost: "{name} lost a heart.",
    draw: "Not enough votes came in. No hearts or Credits moved.",
    cantVoteOwn: "You can't vote on a debate you're in.",
    // SPEC section 6 (owner, 2026-10-30): the offer is the animal's own words; these are the app's.
    yes: "Yes, start a debate",
    notNow: "Not now",
    privateLine: "{names}: private debate",
    publicLine: "{names}: public debate",
    fromCall: "From your call",
    // Public with your own animals (owner, 2026-10-31).
    ownOnly: "Only your animals: nothing at stake.",
    yourAnimals: "Your animals",
    othersAnimals: "Other people's animals",
    noOthers: "No one else's animals can join yet, so yours debate it and the community votes.",
    // In the thread, like Your step (docs/rich-chat/SPEC.md, section 2.6).
    setUp: "Set up the debate",
    quiet: "Debate",
    moreAnimals: "More animals",
    editingQuestion: "Editing the debate's question",
    editingPublic: "Editing what people will see",
    save: "Save",
    communityVote: "Community vote",
    votingClosesIn: "Voting closes in {time}",
    youChose: "You chose {name}'s way",
    tryFirst: "Try first: {text}",
    itsWay: "Its way:",
    fitsWhen: "Fits when {text}",
    costs: "Costs {text}",
    writingReport: "Writing the debate report",
    /** The report as a table, where the column is wide: "Animal | Its way | Fits when | Costs". */
    reportAnimal: "Animal"
} as const;

export const ROSTER_COPY = {
    optIn: "Let my animals join public debates",
    optInNote: "Only animals with their Power earned. Each debate puts 1 heart on it, and a winning animal earns you Credits.",
    /** Newcomer UX vet (2026-10-30, P1-5): says what healing costs and where, away from the card. */
    offRoster: "Out of hearts. Heal a heart for 5 Credits on its card."
} as const;

export const HEAL_COPY = {
    title: "Hearts",
    one: "Heal a heart: 5 Credits",
    full: "All 3 hearts"
} as const;

/**
 * Web only: the lines the SPEC leaves to each app (the Debates page, the
 * report's parts, a debate's state) and the RPCs' refusals said calmly.
 */
export const DEBATE_WEB_COPY = {
    myDebates: "My debates",
    open: "Open",
    past: "Past",
    empty: "No debates yet",
    emptyBody: "Debates start in a chat, once an animal's Power is yours. Bring it a problem, and when it offers a debate, say yes.",
    goToCompanions: "Go to Companions",
    withAnimal: "Debates this animal was in",
    withAnimalEmpty: "It hasn't been in a debate yet.",
    problem: "The problem",
    problemPlaceholder: "What would you like the animals to weigh in on?",
    picked: "{n} of 3",
    loadingAnimals: "Finding animals…",
    noOwnAnimals: "Private debates use your own animals. Capture another, or go public.",
    noRoster: "No animals are on the public roster right now. Private works any time.",
    writingPublic: "Writing the public version…",
    starting: "Starting…",
    posting: "Posting…",
    statusApproving: "Waiting for you to approve the public text",
    statusDebating: "The animals are talking it over",
    statusReporting: "Writing the report",
    statusVoting: "Voting is open",
    statusDone: "Report ready",
    wonBy: "{name}'s way won.",
    reportProblem: "The problem",
    reportWay: "Its way",
    reportLesson: "The lesson behind it",
    reportFits: "Where it fits",
    reportCosts: "What it costs",
    reportTryFirst: "What to try first",
    reportWriting: "Writing the report…",
    signInToVote: "Sign in to vote",
    ineligible: "You can vote once your account is a week old and has a public capture.",
    openDebate: "Open the debate",
    yourDebate: "Your debate",
    seeAll: "See all",
    rosterOn: "In public debates",
    rosterNeedsPower: "Finish one step with {name} to put it in public debates.",
    healing: "Healing…",
    /** On its own card, beside the heal button. */
    outOfHearts: "Out of hearts.",
    heal: "Heal",
    hearts: "{n} of 3 hearts",
    choosing: "Opening the chat…",
    getCredits: "Get Credits",
    tryAgain: "Try again",
    edit: "Edit",
    keepPrivate: "Keep it private",
    tryOwnWayMessage: "I'll try your way.",
    problems: {
        signIn: "Sign in to start a debate.",
        off: "Debates are paused for now.",
        powerNotEarned: "Earn its Power first: finish one step with it.",
        noHearts: "It's out of hearts. Heal it to start a public debate.",
        notOptedIn: "Turn on public debates in Settings first.",
        alreadyInDebate: "One of those animals is already in an open public debate.",
        pickOne: "Pick at least one animal.",
        tooShort: "Say a little more about it: a sentence or two.",
        animalUnavailable: "One of those animals can't join right now. Pick another.",
        draftSlow: "The public version is taking a while. Try again in a little while.",
        dailyLimit: "That's all the debates you can start today.",
        notEligible: "You can vote once your account is a week old and has a public capture.",
        votingClosed: "Voting has closed.",
        notFound: "That debate isn't available.",
        noCredits: "You need 5 Credits to heal a heart.",
        textTooLong: "Keep it to 400 characters.",
        generic: "That didn't go through. Try again in a moment."
    }
} as const;

/** Word for word with iOS and Android (SPEC "Phase 4"). */
export const COMPANIONS_COPY = {
    title: "Companions",
    empty: "Capture an animal to meet your first companion.",
    capture: "Capture",
    referralWaiting: "Sent your way: tap to hear its take",
    yourStep: "Your step: {step}",
    workingOn: "Working on: {focus}",
    /** One name for talking (newcomer UX vet, 2026-10-30, P2); was "Say hello". */
    sayHello: "Talk to it",
    mastered: "Mastered",
    myCompanions: "My Companions",
    masteredCount: "{n} mastered",
    powersEarned: "{n} Powers earned"
} as const;

/** The bond's stages, by the key the server sends. */
export type BondStageKey = "met" | "getting_to_know_you" | "working_together" | "long_standing" | "trusted" | "mastered";

/**
 * Every word the Companions tab, the bond screens and the debates show,
 * in English. The site's label files carry the same keys under `companions`
 * (en.json, id.json); `companionWords` lays a locale's over these, so a key
 * a locale lacks still reads, in English.
 */
export const COMPANION_WORDS_EN = {
    bond: BOND_COPY,
    list: COMPANIONS_COPY,
    stages: {
        met: "Met",
        getting_to_know_you: "Getting to know you",
        working_together: "Working together",
        long_standing: "Long-standing",
        trusted: "Trusted",
        mastered: "Mastered"
    } satisfies Record<BondStageKey, string>,
    /** How the Power was earned, on the bond screen. */
    earned: {
        yourTrial: "Earned in your own life",
        trial: "Earned by Trial",
        application: "Earned by applying it",
        any: "Earned"
    },
    /** 3.2 "Your step": the step card, the report, the record, the Warmup and the Trials. */
    journey: YOUR_STEP_COPY,
    /** 3.2 Debates: the chat's debate, the sheet, the report, the vote. */
    debate: DEBATE_COPY,
    /** The public roster opt-in (Settings) and its status. */
    roster: ROSTER_COPY,
    /** Hearts, healed 5 Credits a heart. */
    heal: HEAL_COPY,
    /** Explore's Debates and the card's tab. */
    debates: {tab: "Debates"},
    /** The web's own Debates lines. */
    debateWeb: DEBATE_WEB_COPY,
    /** The Companions tab's own parts: an animal's messages, muted or not. */
    tab: {
        unread: "{n} unread",
        muted: "Muted",
        mute: "Mute",
        unmute: "Unmute",
        muteFailed: "That didn't go through. Try again in a moment.",
        options: "More",
        collection: "Collection",
        /** Signed out (newcomer UX vet, 2026-10-30, P1-10): the tab says what to do instead of showing nothing. */
        signedOut: "Sign in to meet your animals, or try talking to one now.",
        signIn: "Sign in",
        tryTalking: "Try talking to one now",
        /** The empty tab's second way in (DESIGN.md section 1): the public chats. */
        meetOneNow: "Or meet one now"
    },
    /**
     * Naming your animal: "Name your {animal}" in its chat (iOS
     * AnimalCompanionNameSheet), Add/Edit Nickname on its card (Customize Card).
     */
    naming: {
        nameYour: "Name your {animal}",
        nickname: "Nickname",
        hint: "It's the nickname on the card, too.",
        failed: "Couldn't save the name. Try again.",
        cancel: "Cancel",
        save: "Save",
        addNickname: "Add Nickname",
        editNickname: "Edit Nickname",
        example: "e.g. Luna",
        leaveBlank: "Leave blank to show the identified animal name."
    },
    /** The debate picker: a second card of a species already in it. */
    picker: {
        alreadyHere: "Already here",
        alreadyHereHint: "One of this species is already in the group"
    },
    /** Your own card's tabs: About · Bond · Stats (3.2: the Battle tab is the stats, with the hearts band and its debates). */
    card: {about: "About", bond: "Bond", stats: "Stats"},
    /** "Luna the Gray Wolf" (iOS "%@ the %@"). */
    displayName: "{nickname} the {animal}"
};

type Words<T> = {[K in keyof T]: T[K] extends string ? string : Words<T[K]>};

export type CompanionWords = Words<typeof COMPANION_WORDS_EN>;

function overlay<T extends Record<string, unknown>>(base: T, raw: unknown): T {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(base).map(([key, value]) => {
        const candidate = given[key];
        if (typeof value === "string") {
            return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
        }
        return [key, overlay(value as Record<string, unknown>, candidate)];
    })) as T;
}

/** A locale's `companions` labels over the English ones: every key there, in that language where it has one. */
export function companionWords(raw: unknown): CompanionWords {
    return overlay(COMPANION_WORDS_EN as CompanionWords, raw);
}

/** "{n}"-style placeholders filled in. */
export function fillWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function knownStage(stage: string | null | undefined, words: CompanionWords): string | null {
    return stage && Object.prototype.hasOwnProperty.call(words.stages, stage)
        ? (words.stages as Record<string, string>)[stage]
        : null;
}

export function bondStageLabel(stage: string, words: CompanionWords = COMPANION_WORDS_EN): string {
    return knownStage(stage, words) ?? words.stages.met;
}

/** The stage in the reader's words: the server's label stands only for a stage this build does not know. */
export function bondStageText(bond: {stage?: string | null; stageLabel: string}, words: CompanionWords = COMPANION_WORDS_EN): string {
    return knownStage(bond.stage, words) ?? bond.stageLabel;
}

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown): string | null {
    const candidate = str(value);
    return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

function int(value: unknown, fallback: number): number {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function percent(value: unknown): number {
    return Math.max(0, Math.min(100, int(value, 0)));
}

function route(value: unknown): AnimalPowerRoute | null {
    return value === "trial" || value === "application" || value === "your_trial" ? value : null;
}

export function decodeStrands(raw: unknown): BondStrands | null {
    const row = object(raw);
    if (!row) return null;
    return {lesson: percent(row.lesson), practice: percent(row.practice), life: percent(row.life)};
}

const NO_STRANDS: BondStrands = {lesson: 0, practice: 0, life: 0};

export function decodeAnimalBond(raw: unknown): AnimalBond | null {
    const row = object(raw);
    if (!row) return null;
    const stage = str(row.stage) ?? "met";
    const power = object(row.power);
    const companion = object(row.companion);
    return {
        speciesProfileId: str(row.species_profile_id),
        xp: Math.max(0, int(row.xp, 0)),
        level: Math.max(1, int(row.level, 1)),
        levelXp: Math.max(0, int(row.level_xp, 0)),
        nextLevelXp: row.next_level_xp === null || row.next_level_xp === undefined ? null : int(row.next_level_xp, 0),
        stage,
        stageLabel: str(row.stage_label) ?? bondStageLabel(stage),
        mastered: row.mastered === true,
        strands: decodeStrands(row.strands) ?? NO_STRANDS,
        lessonCheckPassed: row.lesson_check_passed === true,
        power: {
            name: str(power?.name),
            earned: power?.earned === true,
            via: route(power?.via),
            at: str(power?.at)
        },
        focus: str(object(companion?.focus)?.focus),
        openTrial: str(object(companion?.open_trial)?.step),
        openStep: decodeAnimalStep(companion?.open_trial),
        yourTrialsDone: Math.max(0, int(companion?.your_trials_done, 0)),
        recentDone: (Array.isArray(companion?.recent_done) ? companion?.recent_done as unknown[] : []).flatMap((item) => {
            const entry = object(item);
            const step = str(entry?.step);
            return step ? [{step, doneAt: str(entry?.done_at)}] : [];
        })
    };
}

export function decodeCompanionSummaries(raw: unknown): CompanionSummary[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
        const row = object(item);
        const speciesProfileId = str(row?.species_profile_id);
        if (!row || !speciesProfileId) return [];
        const stage = str(row.stage) ?? "met";
        const power = object(row.power);
        return [{
            speciesProfileId,
            captureId: str(row.capture_id),
            slug: str(row.slug),
            animal: str(row.animal) ?? "",
            nickname: str(row.nickname),
            level: Math.max(1, int(row.level, 1)),
            stage,
            stageLabel: str(row.stage_label) ?? bondStageLabel(stage),
            mastered: row.mastered === true,
            strands: decodeStrands(row.strands) ?? NO_STRANDS,
            powerName: str(power?.name),
            powerEarned: power?.earned === true,
            focus: str(row.focus),
            openTrial: str(row.open_trial),
            unread: Math.max(0, int(row.unread, 0)),
            referralWaiting: row.referral_waiting === true,
            referralId: uuid(row.referral_id),
            lastActivity: str(row.last_activity)
        }];
    });
}

/** `done.bond` from the chat. Null when there is none or it names no stage. */
export function decodeChatBond(raw: unknown): ChatBond | null {
    const row = object(raw);
    const stage = str(row?.stage);
    if (!row || !stage) return null;
    return {
        stage,
        stageLabel: str(row.stage_label) ?? bondStageLabel(stage),
        level: typeof row.level === "number" && Number.isFinite(row.level) ? Math.max(1, Math.round(row.level)) : null,
        mastered: row.mastered === true,
        strands: decodeStrands(row.strands)
    };
}

/** "2,480 XP", grouped the way the reader's locale groups thousands. */
export function bondXpText(xp: number, locale?: string | null, words: CompanionWords = COMPANION_WORDS_EN): string {
    let grouped: string;
    try {
        grouped = new Intl.NumberFormat(locale ?? undefined).format(xp);
    } catch {
        grouped = new Intl.NumberFormat().format(xp);
    }
    return fillWords(words.bond.xp, {xp: grouped});
}

/**
 * "Level 4 · Working together", or the stage alone before levels. Since the
 * newcomer UX vet (2026-10-30, P1-2) rows and chips say the stage alone
 * (`bondStageText`); the level and XP are the Bond tab's header
 * (`bondLevelXpText`).
 */
export function bondChipText(
    bond: {level: number | null; stage?: string | null; stageLabel: string},
    words: CompanionWords = COMPANION_WORDS_EN
): string {
    const stage = bondStageText(bond, words);
    return bond.level === null ? stage : `${fillWords(words.bond.level, {n: bond.level})} · ${stage}`;
}

/** The Bond tab's header line: "Bond level 7 · 2,480 XP". */
export function bondLevelXpText(
    bond: {level: number; xp: number},
    locale?: string | null,
    words: CompanionWords = COMPANION_WORDS_EN
): string {
    return `${fillWords(words.bond.bondLevel, {n: bond.level})} · ${bondXpText(bond.xp, locale, words)}`;
}

/** 0...1 through the current level. */
export function bondLevelProgress(bond: Pick<AnimalBond, "xp" | "levelXp" | "nextLevelXp">): number {
    const next = bond.nextLevelXp;
    if (next === null || next <= bond.levelXp) return 1;
    return Math.min(1, Math.max(0, (bond.xp - bond.levelXp) / (next - bond.levelXp)));
}

/**
 * The bond screen's Power line: how it was earned, or what earning it takes.
 * Since 3.2 any first done step earns it; there is no lesson check first.
 */
export function bondPowerLine(
    bond: Pick<AnimalBond, "power">,
    name: string,
    words: CompanionWords = COMPANION_WORDS_EN
): string {
    if (bond.power.earned) {
        switch (bond.power.via) {
            case "your_trial": return words.earned.yourTrial;
            case "trial": return words.earned.trial;
            case "application": return words.earned.application;
            default: return words.earned.any;
        }
    }
    return fillWords(words.journey.power.notEarnedLine, {name});
}

export function companionSummaryName(
    row: Pick<CompanionSummary, "nickname" | "animal">,
    words: CompanionWords = COMPANION_WORDS_EN
): string {
    return companionDisplayName(row.nickname, row.animal, words.displayName);
}

/**
 * The row's one status line, the first that applies (SPEC "Companions"). The
 * unread message preview comes from the caller, which has the messages.
 */
export function companionStatusLine(
    row: Pick<CompanionSummary, "unread" | "referralWaiting" | "openTrial" | "focus">,
    unreadPreview: string | null = null,
    words: CompanionWords = COMPANION_WORDS_EN
): {text: string; unread: boolean} {
    if (row.unread > 0 && unreadPreview) return {text: unreadPreview, unread: true};
    if (row.referralWaiting) return {text: words.list.referralWaiting, unread: false};
    if (row.openTrial) return {text: fillWords(words.list.yourStep, {step: row.openTrial}), unread: false};
    if (row.focus) return {text: fillWords(words.list.workingOn, {focus: row.focus}), unread: false};
    return {text: words.list.sayHello, unread: false};
}

/**
 * Where a Companions row goes: that animal's chat on its newest card. With a
 * referral waiting it opens on the referral (`?referral=`), so the animal
 * speaks first about the problem it was sent; otherwise `?talk=1`.
 */
export function companionRowHref(row: Pick<CompanionSummary, "captureId" | "referralWaiting" | "referralId">): string | null {
    if (!row.captureId) return null;
    const base = `/app/capture/${encodeURIComponent(row.captureId)}`;
    return row.referralWaiting && row.referralId
        ? `${base}?referral=${encodeURIComponent(row.referralId)}`
        : `${base}?talk=1`;
}

/** Level by species, for every card of your own animals. */
export function companionLevelsBySpecies(rows: CompanionSummary[]): Map<string, CompanionSummary> {
    return new Map(rows.map((row) => [row.speciesProfileId.toLowerCase(), row]));
}

/** A card's species, as the surfaces that print its level know it. */
export type CardSpeciesKey = {speciesProfileId?: string | null; speciesSlug?: string | null};

/** The icon-art slug form: lower case, hyphens (identity keys use underscores). */
function slugKey(slug: string | null | undefined): string | null {
    const key = slug?.trim().toLowerCase().replace(/_/g, "-");
    return key ? key : null;
}

/**
 * The level one of your own cards shows (SPEC phase 2): its animal's bond
 * level, found by species id and then by slug (a card's species may be a
 * profile that folds into the canonical one the bond is kept under), else the
 * card's own level. Only for your own cards; the caller decides that.
 */
export function ownCardLevel(rows: CompanionSummary[], card: CardSpeciesKey, cardLevel: number): number {
    const id = card.speciesProfileId?.trim().toLowerCase();
    const slug = slugKey(card.speciesSlug);
    const row = (id ? rows.find((entry) => entry.speciesProfileId.toLowerCase() === id) : undefined)
        ?? (slug ? rows.find((entry) => slugKey(entry.slug) === slug) : undefined);
    return row ? row.level : cardLevel;
}

export type TrialDifficulty = "Easy" | "Medium" | "Hard";

/** "Easy", "Medium" or "Hard", in the reader's words (SPEC `trial.easy / medium / hard`). */
export function trialDifficultyText(difficulty: TrialDifficulty, words: CompanionWords = COMPANION_WORDS_EN): string {
    switch (difficulty) {
        case "Easy": return words.journey.trial.easy;
        case "Medium": return words.journey.trial.medium;
        case "Hard": return words.journey.trial.hard;
    }
}

/** Low/Mid/High frequency → Easy / Medium / Hard (SPEC "Words"). */
export function trialDifficulty(frequency: string | null | undefined): TrialDifficulty | null {
    switch ((frequency ?? "").trim().toUpperCase()) {
        case "LOW": return "Easy";
        case "MID":
        case "MEDIUM": return "Medium";
        case "HIGH": return "Hard";
        default: return null;
    }
}
