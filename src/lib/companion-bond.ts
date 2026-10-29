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
    mastered: "Mastered",
    livesItsLesson: "You live its lesson.",
    knowsTheLesson: "Knows the lesson",
    putsItIntoPractice: "Puts it into practice",
    changedYourLife: "Changed something in your life",
    workingOnTitle: "Working on",
    noFocus: "Tell {name} what's going on in your life and it will pick something to work on with you.",
    notThisAnyMore: "Not this any more",
    yourStep: "Your step",
    doneTogether: "Done together",
    itsPower: "Its Power",
    earnByTrial: "Complete one Trial with {name} to earn it.",
    earnAfterLessonCheck: "Pass its lesson check, then complete one Trial with {name}.",
    talkToIt: "Talk to it",
    takeLessonCheck: "Take the lesson check",
    lessonCheckMessage: "Can I take your lesson check?",
    animalTrials: "Animal Trials",
    askAboutIt: "Ask about it",
    askAboutTrialMessage: "Tell me about your {difficulty} Trial.",
    battleLocked: "Earn {name}'s Power to battle with it.",
    battleLockedDetail: "Complete one Trial with it, Animal or your own."
} as const;

/** Word for word with iOS and Android (SPEC "Phase 4"). */
export const COMPANIONS_COPY = {
    title: "Companions",
    talkToSeveral: "Talk to several animals",
    talkToSeveralIntro: "Bring two or more of your animals into one conversation and hear how each sees it.",
    empty: "Capture an animal to meet your first companion.",
    capture: "Capture",
    referralWaiting: "Sent your way: tap to hear its take",
    yourStep: "Your step: {step}",
    workingOn: "Working on: {focus}",
    sayHello: "Say hello",
    mastered: "Mastered",
    myCompanions: "My Companions",
    masteredCount: "{n} mastered",
    powersEarned: "{n} Powers earned"
} as const;

/** The bond's stages, by the key the server sends. */
export type BondStageKey = "met" | "getting_to_know_you" | "working_together" | "long_standing" | "trusted" | "mastered";

/**
 * Every word the Companions tab, the bond screens and the group picker show,
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
    /** A Trial's state, in a word, on the bond screen. */
    trialStatus: {
        completed: "Complete",
        underWay: "Under way",
        armed: "Armed",
        missed: "Missed",
        notStarted: "Not started"
    },
    difficulty: {Easy: "Easy", Medium: "Medium", Hard: "Hard"},
    /** Your own card's tabs: About · Bond · Battle. */
    card: {about: "About", bond: "Bond", battle: "Battle"},
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

/** "Level 4 · Working together", or the stage alone before levels (the card hero and chat chip). */
export function bondChipText(
    bond: {level: number | null; stage?: string | null; stageLabel: string},
    words: CompanionWords = COMPANION_WORDS_EN
): string {
    const stage = bondStageText(bond, words);
    return bond.level === null ? stage : `${fillWords(words.bond.level, {n: bond.level})} · ${stage}`;
}

/** 0...1 through the current level. */
export function bondLevelProgress(bond: Pick<AnimalBond, "xp" | "levelXp" | "nextLevelXp">): number {
    const next = bond.nextLevelXp;
    if (next === null || next <= bond.levelXp) return 1;
    return Math.min(1, Math.max(0, (bond.xp - bond.levelXp) / (next - bond.levelXp)));
}

/** The bond screen's Power line: how it was earned, or what earning it takes. */
export function bondPowerLine(
    bond: Pick<AnimalBond, "power" | "lessonCheckPassed">,
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
    return fillWords(bond.lessonCheckPassed ? words.bond.earnByTrial : words.bond.earnAfterLessonCheck, {name});
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

/** "Easy", "Medium" or "Hard", in the reader's words. */
export function trialDifficultyText(difficulty: "Easy" | "Medium" | "Hard", words: CompanionWords = COMPANION_WORDS_EN): string {
    return words.difficulty[difficulty];
}

/** Low/Mid/High frequency → Easy / Medium / Hard (SPEC "Words"). */
export function trialDifficulty(frequency: string | null | undefined): "Easy" | "Medium" | "Hard" | null {
    switch ((frequency ?? "").trim().toUpperCase()) {
        case "LOW": return "Easy";
        case "MID":
        case "MEDIUM": return "Medium";
        case "HIGH": return "Hard";
        default: return null;
    }
}
