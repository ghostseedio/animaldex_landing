/**
 * The Diary (iOS `ProblemDiary.swift`, owner 2026-11-03): your own profile's
 * diary of every problem you have worked through with your animals
 * (`my_problem_diary_v1`, migration 20261103140000), newest first. One entry
 * per problem: the problem in your own words, the animal you brought it to,
 * the debates (who weighed in, the way chosen, the solution), the steps with
 * what you said and how they went, and any Power it earned. Private: only its
 * owner ever reads it.
 *
 * Pure: the route decodes with it, the Diary tab and its entry screen word
 * it, and the tests read it. A row that does not read is dropped on its own,
 * never the list.
 */

import {decodeStepRecords, type StepRecord, type StepRecordMedia} from "@/lib/your-step";

export type ProblemDiaryStatus = "working" | "done" | "moved_on";
export type StepOutcome = "worked" | "partly" | "didnt_work";

export type ProblemDiaryStep = {
    record: StepRecord;
    isDone: boolean;
    setAt: string | null;
    /** How it went, as the animal heard it; null before outcomes were kept. */
    outcome: StepOutcome | null;
    /** Its photo or video, signed for the reader by the route. */
    media?: StepRecordMedia[];
};

export type ProblemDiaryChosen = {animal: string; way: string | null; at: string | null};
export type ProblemDiarySolved = {account: string | null; used: string[]; at: string | null};

export type ProblemDiaryDebate = {
    id: string;
    createdAt: string | null;
    animals: string[];
    chosen: ProblemDiaryChosen | null;
    solved: ProblemDiarySolved | null;
    /** Ways chosen before that did not work, oldest first. */
    tried: ProblemDiaryChosen[];
};

export type ProblemDiaryPower = {animal: string; powerName: string; earnedAt: string | null};

export type ProblemDiaryEntry = {
    key: string;
    problem: string;
    status: ProblemDiaryStatus;
    startedAt: string | null;
    lastAt: string | null;
    speciesProfileId: string | null;
    animal: string;
    /** Their newest card of the animal: where its chat opens. */
    captureId: string | null;
    nickname: string | null;
    steps: ProblemDiaryStep[];
    debates: ProblemDiaryDebate[];
    powers: ProblemDiaryPower[];
    /** The species' icon-art slug (added by the route), when known. */
    slug?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function uuid(value: unknown): string | null {
    const candidate = text(value);
    return candidate && UUID.test(candidate) ? candidate.toLowerCase() : null;
}

function strings(value: unknown): string[] {
    return list(value).flatMap((item) => {
        const value = text(item);
        return value ? [value] : [];
    });
}

export function stepOutcome(value: unknown): StepOutcome | null {
    const wire = text(value);
    return wire === "worked" || wire === "partly" || wire === "didnt_work" ? wire : null;
}

function diaryStatus(value: unknown): ProblemDiaryStatus {
    const wire = text(value);
    return wire === "done" || wire === "moved_on" ? wire : "working";
}

function chosen(value: unknown): ProblemDiaryChosen | null {
    const row = object(value);
    const animal = text(row?.animal);
    return row && animal ? {animal, way: text(row.way), at: text(row.at)} : null;
}

function decodeStep(value: unknown): ProblemDiaryStep | null {
    const row = object(value);
    const record = row ? decodeStepRecords([row])[0] : undefined;
    if (!row || !record) return null;
    return {record, isDone: text(row.status) === "done", setAt: text(row.set_at), outcome: stepOutcome(row.outcome)};
}

function decodeDebate(value: unknown): ProblemDiaryDebate | null {
    const row = object(value);
    const id = uuid(row?.id);
    if (!row || !id) return null;
    const solved = object(row.solved);
    return {
        id,
        createdAt: text(row.created_at),
        animals: strings(row.animals),
        chosen: chosen(row.chosen),
        solved: solved ? {account: text(solved.account), used: strings(solved.used), at: text(solved.at)} : null,
        tried: list(row.tried).flatMap((item) => {
            const way = chosen(item);
            return way ? [way] : [];
        })
    };
}

/** One entry, or null without a key or a problem. */
export function decodeProblemDiaryEntry(value: unknown): ProblemDiaryEntry | null {
    const row = object(value);
    const key = text(row?.key);
    const problem = text(row?.problem);
    if (!row || !key || !problem) return null;
    return {
        key,
        problem,
        status: diaryStatus(row.status),
        startedAt: text(row.started_at),
        lastAt: text(row.last_at),
        speciesProfileId: uuid(row.species_profile_id),
        animal: text(row.animal) ?? "",
        captureId: uuid(row.capture_id),
        nickname: text(row.nickname),
        steps: list(row.steps).flatMap((item) => {
            const step = decodeStep(item);
            return step ? [step] : [];
        }),
        debates: list(row.debates).flatMap((item) => {
            const debate = decodeDebate(item);
            return debate ? [debate] : [];
        }),
        powers: list(row.powers).flatMap((item) => {
            const power = object(item);
            const powerName = text(power?.power_name);
            return power && powerName ? [{animal: text(power.animal) ?? "", powerName, earnedAt: text(power.earned_at)}] : [];
        }),
        slug: text(row.slug)
    };
}

/** iOS `ProblemDiaryEntry.decodeList`: `[entry]`, or `{entries: [...]}`. */
export function decodeProblemDiary(raw: unknown): ProblemDiaryEntry[] {
    const rows = Array.isArray(raw) ? raw : list(object(raw)?.entries);
    return rows.flatMap((item) => {
        const entry = decodeProblemDiaryEntry(item);
        return entry ? [entry] : [];
    });
}

/** "Luna", or the animal. */
export function diaryAnimalName(entry: Pick<ProblemDiaryEntry, "nickname" | "animal">): string {
    return entry.nickname?.trim() || entry.animal;
}

/** Done, and it worked (a step told before outcomes were kept counts). */
export function stepWorked(step: Pick<ProblemDiaryStep, "isDone" | "outcome">): boolean {
    return step.isDone && (step.outcome === null || step.outcome === "worked");
}

function findLast<T>(items: T[], test: (item: T) => boolean): T | undefined {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        if (test(items[index])) return items[index];
    }
    return undefined;
}

export type ProblemDiaryOutcome =
    | {kind: "earned"; power: string}
    | {kind: "solved"}
    | {kind: "triedWay"; animal: string}
    | {kind: "stepDone"; step: string}
    | {kind: "stepOpen"; step: string}
    | {kind: "partly"; step: string}
    | {kind: "didntWork"; step: string}
    | {kind: "debated"; count: number}
    | {kind: "talking"; animal: string}
    | {kind: "movedOn"};

/**
 * iOS `ProblemDiaryEntry.outcome`: the one line that tells how it went. What
 * worked, a Power first; else the step they are on; else how the last one
 * went; else the way they chose, the debate, or the talk itself.
 */
export function diaryOutcome(entry: ProblemDiaryEntry): ProblemDiaryOutcome {
    const solved = entry.debates.some((debate) => debate.solved !== null);
    const worked = findLast(entry.steps, stepWorked);
    if (solved || worked) {
        if (entry.powers.length > 0) return {kind: "earned", power: entry.powers[0].powerName};
        if (solved) return {kind: "solved"};
        if (worked) return {kind: "stepDone", step: worked.record.step};
    }
    const open = findLast(entry.steps, (step) => !step.isDone);
    if (open) return {kind: "stepOpen", step: open.record.step};
    const last = findLast(entry.steps, (step) => step.isDone);
    if (last) return last.outcome === "partly" ? {kind: "partly", step: last.record.step} : {kind: "didntWork", step: last.record.step};
    const chosenWay = findLast(entry.debates.flatMap((debate) => (debate.chosen ? [debate.chosen] : [])), () => true);
    if (chosenWay) return {kind: "triedWay", animal: chosenWay.animal};
    const debate = entry.debates[entry.debates.length - 1];
    if (debate) return {kind: "debated", count: debate.animals.length};
    return entry.status === "moved_on" ? {kind: "movedOn"} : {kind: "talking", animal: diaryAnimalName(entry)};
}

/** The good news is neon: a Power, a solution, a step done. */
export function diaryOutcomeIsWin(outcome: ProblemDiaryOutcome): boolean {
    return outcome.kind === "earned" || outcome.kind === "solved" || outcome.kind === "stepDone";
}

export type ProblemDiaryEvent =
    | {kind: "brought"; animal: string; at: string | null}
    | {kind: "debate"; debate: ProblemDiaryDebate}
    | {kind: "chose"; chosen: ProblemDiaryChosen; debateId: string}
    | {kind: "solved"; solved: ProblemDiarySolved; debateId: string}
    | {kind: "stepSet"; step: ProblemDiaryStep}
    | {kind: "stepDone"; step: ProblemDiaryStep}
    | {kind: "earned"; power: ProblemDiaryPower};

export function diaryEventAt(event: ProblemDiaryEvent): string | null {
    switch (event.kind) {
        case "brought": return event.at;
        case "debate": return event.debate.createdAt;
        case "chose": return event.chosen.at;
        case "solved": return event.solved.at;
        case "stepSet": return event.step.setAt;
        case "stepDone": return event.step.record.doneAt ?? event.step.setAt;
        case "earned": return event.power.earnedAt;
    }
}

export function diaryEventId(event: ProblemDiaryEvent): string {
    switch (event.kind) {
        case "brought": return "brought";
        case "debate": return `debate-${event.debate.id}`;
        case "chose": return `chose-${event.debateId}-${event.chosen.animal}-${event.chosen.at ?? ""}`;
        case "solved": return `solved-${event.debateId}`;
        case "stepSet": return `set-${event.step.record.id}`;
        case "stepDone": return `done-${event.step.record.id}`;
        case "earned": return `earned-${event.power.powerName}-${event.power.animal}`;
    }
}

function time(value: string | null): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * iOS `ProblemDiaryEntry.events`: what happened, in the order it happened.
 * The problem brought, each debate (with the ways tried, the way chosen and
 * the solution), the steps, the Powers; what has no date keeps its place.
 */
export function diaryEvents(entry: ProblemDiaryEntry): ProblemDiaryEvent[] {
    const events: ProblemDiaryEvent[] = [{kind: "brought", animal: diaryAnimalName(entry), at: entry.startedAt}];
    for (const debate of entry.debates) {
        events.push({kind: "debate", debate});
        for (const tried of debate.tried) events.push({kind: "chose", chosen: tried, debateId: debate.id});
        if (debate.chosen) events.push({kind: "chose", chosen: debate.chosen, debateId: debate.id});
        if (debate.solved) events.push({kind: "solved", solved: debate.solved, debateId: debate.id});
    }
    for (const step of entry.steps) events.push(step.isDone ? {kind: "stepDone", step} : {kind: "stepSet", step});
    for (const power of entry.powers) events.push({kind: "earned", power});
    return events
        .map((event, offset) => ({event, offset, at: time(diaryEventAt(event))}))
        .sort((a, b) => (a.at !== null && b.at !== null && a.at !== b.at ? a.at - b.at : a.offset - b.offset))
        .map(({event}) => event);
}

/** Neon only for what worked. */
export function diaryEventIsWin(event: ProblemDiaryEvent): boolean {
    if (event.kind === "solved" || event.kind === "earned") return true;
    return event.kind === "stepDone" && stepWorked(event.step);
}

// MARK: - Words

/** profile.diary.* in the locale files (iOS `ProblemDiaryCopy`). */
export type ProblemDiaryWords = {
    emptyTitle: string;
    loadFailed: string;
    tryAgain: string;
    statusWorking: string;
    statusDone: string;
    statusMovedOn: string;
    earned: string;
    solvedYourWay: string;
    triedWay: string;
    stepDone: string;
    stepOpen: string;
    partlyWorked: string;
    didntWork: string;
    itPartlyWorked: string;
    itDidntWork: string;
    animalsWeighedIn: string;
    talkingWith: string;
    movedOn: string;
    brought: string;
    weighedIn: string;
    chose: string;
    solvedTitle: string;
    usedIdeas: string;
    stepDoneTitle: string;
    youSaid: string;
    powerTitle: string;
    openDebate: string;
    didIt: string;
    back: string;
};

export const PROBLEM_DIARY_WORD_KEYS: Array<keyof ProblemDiaryWords> = [
    "emptyTitle", "loadFailed", "tryAgain", "statusWorking", "statusDone", "statusMovedOn",
    "earned", "solvedYourWay", "triedWay", "stepDone", "stepOpen", "partlyWorked", "didntWork",
    "itPartlyWorked", "itDidntWork", "animalsWeighedIn", "talkingWith", "movedOn", "brought",
    "weighedIn", "chose", "solvedTitle", "usedIdeas", "stepDoneTitle", "youSaid", "powerTitle",
    "openDebate", "didIt", "back"
];

export const PROBLEM_DIARY_WORDS_EN: ProblemDiaryWords = {
    emptyTitle: "Your diary is empty",
    loadFailed: "Couldn't load this",
    tryAgain: "Try again",
    statusWorking: "Working on it",
    statusDone: "Done",
    statusMovedOn: "Moved on",
    earned: "Earned {power}",
    solvedYourWay: "Solved it your way",
    triedWay: "Tried {animal}'s way",
    stepDone: "Done: {step}",
    stepOpen: "Your step: {step}",
    partlyWorked: "Partly worked: {step}",
    didntWork: "Didn't work: {step}",
    itPartlyWorked: "It partly worked",
    itDidntWork: "It didn't work",
    animalsWeighedIn: "{count} animals weighed in",
    talkingWith: "Talking it through with {animal}",
    movedOn: "Moved on",
    brought: "You brought it to {animal}",
    weighedIn: "{names} weighed in",
    chose: "You chose {animal}'s way",
    solvedTitle: "You solved it your way",
    usedIdeas: "You used ideas from {names}",
    stepDoneTitle: "Step done",
    youSaid: "You said: “{words}”",
    powerTitle: "{power} is yours",
    openDebate: "See the debate",
    didIt: "I've done it",
    back: "Back"
};

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** iOS `ListFormatter.localizedString(byJoining:)`: "Owl, Fox and Bee" in the reader's language. */
export function joinNames(names: string[], locale: string): string {
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(names);
    } catch {
        return names.join(", ");
    }
}

export function diaryStatusText(status: ProblemDiaryStatus, words: ProblemDiaryWords): string {
    return status === "done" ? words.statusDone : status === "moved_on" ? words.statusMovedOn : words.statusWorking;
}

/** iOS `ProblemDiaryOutcome.text`. */
export function diaryOutcomeText(outcome: ProblemDiaryOutcome, words: ProblemDiaryWords): string {
    switch (outcome.kind) {
        case "earned": return fill(words.earned, {power: outcome.power});
        case "solved": return words.solvedYourWay;
        case "triedWay": return fill(words.triedWay, {animal: outcome.animal});
        case "stepDone": return fill(words.stepDone, {step: outcome.step});
        case "stepOpen": return fill(words.stepOpen, {step: outcome.step});
        case "partly": return fill(words.partlyWorked, {step: outcome.step});
        case "didntWork": return fill(words.didntWork, {step: outcome.step});
        case "debated": return fill(words.animalsWeighedIn, {count: outcome.count});
        case "talking": return fill(words.talkingWith, {animal: outcome.animal});
        case "movedOn": return words.movedOn;
    }
}

/** A moment's title in the problem's story (iOS `ProblemDiaryEventRow.title`). */
export function diaryEventTitle(event: ProblemDiaryEvent, words: ProblemDiaryWords, locale: string): string {
    switch (event.kind) {
        case "brought": return fill(words.brought, {animal: event.animal});
        case "debate": return fill(words.weighedIn, {names: joinNames(event.debate.animals, locale)});
        case "chose": return fill(words.chose, {animal: event.chosen.animal});
        case "solved": return words.solvedTitle;
        case "stepSet": return fill(words.stepOpen, {step: event.step.record.step});
        case "stepDone": return event.step.record.step;
        case "earned": return fill(words.powerTitle, {power: event.power.powerName});
    }
}

/** The lines under a moment's title (iOS `ProblemDiaryEventRow.detail`), or null. */
export function diaryEventDetail(event: ProblemDiaryEvent, words: ProblemDiaryWords, locale: string): string | null {
    switch (event.kind) {
        case "chose": return event.chosen.way;
        case "solved": {
            const used = event.solved.used.length > 0 ? fill(words.usedIdeas, {names: joinNames(event.solved.used, locale)}) : null;
            const said = event.solved.account ? fill(words.youSaid, {words: event.solved.account}) : null;
            const lines = [used, said].filter((line): line is string => Boolean(line));
            return lines.length > 0 ? lines.join("\n") : null;
        }
        case "stepDone": {
            const went = event.step.outcome === "partly" ? words.itPartlyWorked : event.step.outcome === "didnt_work" ? words.itDidntWork : null;
            const said = event.step.record.account ? fill(words.youSaid, {words: event.step.record.account}) : null;
            const lines = [went, said].filter((line): line is string => Boolean(line));
            return lines.length > 0 ? lines.join("\n") : null;
        }
        default: return null;
    }
}
