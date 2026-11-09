/**
 * Life Sim: Ark Score (AnimalDex docs/life-sim/CONTRACT.md, sections 1, 3, 4,
 * 7, 8, 9 and 10). "I'll do it" on a Your step plays a reveal and moves five
 * stats; later chats and the step's report can revise it; the Diary keeps
 * the history; the profile leads with Ark Score.
 *
 * Pure: the routes decode with it, the chat, the Diary and the profile word
 * and order with it, and the tests read it. Every field is read tolerantly:
 * a server without the Ark migration sends none of it, and a malformed field
 * is dropped on its own, never the whole read.
 *
 * The server computes every number. Nothing here invents a change: the
 * client only shows what the ledger says, and works out the Money bar and
 * Ark Score only to draw a count-up between two values the server sent.
 */

export const ARK_LIFE_STATS = ["money", "relationships", "energy", "reputation"] as const;
export const ARK_STATS = [...ARK_LIFE_STATS, "experience"] as const;
export type ArkLifeStat = (typeof ARK_LIFE_STATS)[number];
export type ArkStat = (typeof ARK_STATS)[number];

export type ArkKind = "earned" | "lesson" | "revised" | "undone";
export type ArkSource = "tap" | "chat" | "report";
export type ArkSize = "small" | "medium" | "large";
export type ArkRevealSkip = "sensitive" | "animal_cap" | "daily_cap" | "already";
export type ArkDiaryVisibility = "public" | "private";
export type ArkDiaryState = "earned" | "lesson" | "revised";

/** One stat's move, in bar points (Money's is its 0–100 bar when the server sends it here). */
export type ArkStatChange = {stat: ArkStat; before: number; after: number; delta: number};
export type ArkMoneyChange = {beforeCents: number; afterCents: number; deltaCents: number};

/** One ledger row: a reveal (`earned` / `lesson`), a revision (`revised`) or an undo (`undone`). */
export type ArkChange = {
    id: string;
    kind: ArkKind;
    source: ArkSource;
    /** A revision's original reveal. */
    parentId: string | null;
    stepId: string | null;
    focusId: string | null;
    speciesProfileId: string | null;
    animal: string;
    size: ArkSize | null;
    changes: ArkStatChange[];
    money: ArkMoneyChange | null;
    experienceDelta: number;
    arkScore: {before: number; after: number} | null;
    /** The story beats, in the animal's voice, as the model wrote them. Empty: the numbers alone. */
    story: string[];
    reaction: string | null;
    /** A revision's trigger: what they said. */
    statement: string | null;
    /** A chat revision's message: its id, or its timestamp. */
    chatMessageRef: string | null;
    createdAt: string | null;
    undoneAt: string | null;
};

export type ArkBars = {
    /** Null when the viewer may not see the life bars (contract section 7). */
    money: {bar: number; balanceCents: number} | null;
    relationships: number | null;
    energy: number | null;
    reputation: number | null;
    experience: number;
};

export type ArkSteps = {total: number; worked: number; partly: number; didntWork: number};

/** `ark_stats_v1`: the viewer's own, or someone else's within section 7. */
export type ArkStats = {
    arkScore: number;
    isSelf: boolean;
    barsVisible: boolean;
    bars: ArkBars;
    lastChanges: Partial<Record<ArkStat, {delta: number; at: string | null}>>;
    steps: ArkSteps;
    powersEarned: number;
    /**
     * Not in the contract's shape: the profile-wide switch and teen mode,
     * read here when the server adds them (`diary_visibility`, `teen`), so
     * the Diary can say which it is. Null when the server does not say.
     */
    diaryVisibility: ArkDiaryVisibility | null;
    teen: boolean | null;
};

/** `accept_animal_step_v1`: the step, and the reveal it played (or why none). */
export type ArkAcceptResult<TStep> = {step: TStep | null; reveal: ArkChange | null; revealSkipped: ArkRevealSkip | null};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            return object(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown): unknown[] {
    if (typeof value === "string") {
        try {
            return list(JSON.parse(value));
        } catch {
            return [];
        }
    }
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

function number(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
    const parsed = number(value);
    return parsed === null ? null : Math.round(parsed);
}

function count(value: unknown): number {
    const parsed = integer(value);
    return parsed !== null && parsed > 0 ? parsed : 0;
}

export function arkStat(value: unknown): ArkStat | null {
    const wire = text(value)?.toLowerCase();
    return wire && (ARK_STATS as readonly string[]).includes(wire) ? wire as ArkStat : null;
}

export function arkKind(value: unknown): ArkKind | null {
    const wire = text(value)?.toLowerCase();
    return wire === "earned" || wire === "lesson" || wire === "revised" || wire === "undone" ? wire : null;
}

function arkSource(value: unknown): ArkSource {
    const wire = text(value)?.toLowerCase();
    return wire === "chat" || wire === "report" ? wire : "tap";
}

export function arkSize(value: unknown): ArkSize | null {
    const wire = text(value)?.toLowerCase();
    return wire === "small" || wire === "medium" || wire === "large" ? wire : null;
}

export function arkRevealSkip(value: unknown): ArkRevealSkip | null {
    const wire = text(value)?.toLowerCase();
    return wire === "sensitive" || wire === "animal_cap" || wire === "daily_cap" || wire === "already" ? wire : null;
}

export function arkDiaryVisibility(value: unknown): ArkDiaryVisibility | null {
    const wire = text(value)?.toLowerCase();
    return wire === "public" || wire === "private" ? wire : null;
}

export function arkDiaryState(value: unknown): ArkDiaryState | null {
    const wire = text(value)?.toLowerCase();
    return wire === "earned" || wire === "lesson" || wire === "revised" ? wire : null;
}

function statChange(value: unknown): ArkStatChange | null {
    const row = object(value);
    const stat = arkStat(row?.stat);
    if (!row || !stat) return null;
    const before = integer(row.before);
    const after = integer(row.after);
    const given = integer(row.delta);
    const delta = given ?? (before !== null && after !== null ? after - before : null);
    if (delta === null) return null;
    const from = before ?? (after !== null ? after - delta : 0);
    return {stat, before: from, after: after ?? from + delta, delta};
}

function moneyChange(value: unknown): ArkMoneyChange | null {
    const row = object(value);
    if (!row) return null;
    const before = integer(row.before_cents);
    const after = integer(row.after_cents);
    const given = integer(row.delta_cents);
    if (before === null && after === null) return null;
    const from = Math.max(0, before ?? (after ?? 0) - (given ?? 0));
    const to = Math.max(0, after ?? from + (given ?? 0));
    return {beforeCents: from, afterCents: to, deltaCents: given ?? to - from};
}

function strings(value: unknown, max: number): string[] {
    return list(value).flatMap((item) => {
        const line = text(item);
        return line ? [line] : [];
    }).slice(0, max);
}

/** One ledger entry (or a reveal: the same shape). Null without an id and a kind. */
export function decodeArkChange(raw: unknown): ArkChange | null {
    const row = object(raw);
    const id = uuid(row?.id);
    const kind = arkKind(row?.kind);
    if (!row || !id || !kind) return null;
    const score = object(row.ark_score);
    const scoreBefore = integer(score?.before);
    const scoreAfter = integer(score?.after);
    return {
        id,
        kind,
        source: arkSource(row.source),
        parentId: uuid(row.parent_id),
        stepId: uuid(row.step_id),
        focusId: uuid(row.focus_id),
        speciesProfileId: uuid(row.species_profile_id),
        animal: text(row.animal) ?? "",
        size: arkSize(row.size),
        changes: list(row.changes).flatMap((item) => {
            const change = statChange(item);
            return change ? [change] : [];
        }),
        money: moneyChange(row.money),
        experienceDelta: count(row.experience_delta),
        arkScore: scoreBefore !== null && scoreAfter !== null ? {before: scoreBefore, after: scoreAfter} : null,
        story: strings(row.story, 6),
        reaction: text(row.reaction),
        statement: text(row.statement),
        chatMessageRef: text(row.chat_message_ref),
        createdAt: text(row.created_at),
        undoneAt: text(row.undone_at)
    };
}

/** `ark_changes_v1`: `{changes: [...]}` or the list itself, newest first. */
export function decodeArkChanges(raw: unknown): ArkChange[] {
    const rows = Array.isArray(raw) ? raw : list(object(raw)?.changes);
    return rows.flatMap((item) => {
        const change = decodeArkChange(item);
        return change ? [change] : [];
    });
}

/** `accept_animal_step_v1` (or `set_animal_step_from_trial_v1`): `{step, reveal, reveal_skipped}`; an old server sends `{step}` alone. */
export function decodeArkAccept<TStep>(raw: unknown, decodeStep: (raw: unknown) => TStep | null): ArkAcceptResult<TStep> {
    const row = object(raw);
    const reveal = decodeArkChange(row?.reveal);
    return {
        step: decodeStep(raw),
        // A reveal is a reveal: a revision or an undo here is not one.
        reveal: reveal && (reveal.kind === "earned" || reveal.kind === "lesson") ? reveal : null,
        revealSkipped: reveal ? null : arkRevealSkip(row?.reveal_skipped)
    };
}

function bar(value: unknown, min: number, fallback: number | null): number | null {
    const parsed = integer(value);
    return parsed === null ? fallback : Math.max(min, Math.min(100, parsed));
}

/** `ark_stats_v1`. Null when it does not read (an old server): the profile then shows without it. */
export function decodeArkStats(raw: unknown): ArkStats | null {
    const row = object(raw);
    if (!row) return null;
    const score = integer(row.ark_score);
    const bars = object(row.bars);
    if (score === null || !bars) return null;
    const barsVisible = row.bars_visible !== false;
    const money = object(bars.money);
    const moneyBar = bar(money?.bar, 0, null);
    const balance = integer(money?.balance_cents);
    const changes = object(row.last_changes) ?? {};
    const lastChanges: ArkStats["lastChanges"] = {};
    for (const stat of ARK_STATS) {
        const change = object(changes[stat]);
        const delta = integer(change?.delta);
        if (delta !== null && delta !== 0) lastChanges[stat] = {delta, at: text(change?.at)};
    }
    const steps = object(row.steps);
    return {
        arkScore: Math.max(0, Math.min(500, score)),
        isSelf: row.is_self === true,
        barsVisible,
        bars: {
            money: barsVisible && money && (moneyBar !== null || balance !== null)
                ? {bar: moneyBar ?? arkMoneyBar(balance ?? 0), balanceCents: Math.max(0, balance ?? 0)}
                : null,
            relationships: barsVisible ? bar(bars.relationships, 0, null) : null,
            energy: barsVisible ? bar(bars.energy, 0, null) : null,
            reputation: barsVisible ? bar(bars.reputation, 0, null) : null,
            experience: bar(bars.experience, 0, 0) ?? 0
        },
        lastChanges,
        steps: {total: count(steps?.total), worked: count(steps?.worked), partly: count(steps?.partly), didntWork: count(steps?.didnt_work)},
        powersEarned: count(row.powers_earned),
        diaryVisibility: arkDiaryVisibility(row.diary_visibility),
        teen: typeof row.teen === "boolean" ? row.teen : typeof row.is_teen === "boolean" ? row.is_teen : null
    };
}

// MARK: - The numbers (contract section 1), only to draw what the server sent

/** The Money bar: `min(100, floor(100 * log10(1 + usd) / log10(1 + 100000)))`. */
export function arkMoneyBar(balanceCents: number): number {
    const usd = Math.max(0, balanceCents) / 100;
    return Math.min(100, Math.floor((100 * Math.log10(1 + usd)) / Math.log10(1 + 100000)));
}

/** The bars a viewer sees, top to bottom: all five on their own or a public diary, else Experience alone. */
export function arkVisibleStats(stats: Pick<ArkStats, "isSelf" | "barsVisible">): ArkStat[] {
    return stats.isSelf || stats.barsVisible ? [...ARK_STATS] : ["experience"];
}

/** A bar's value as a viewer may see it, or null. */
export function arkBarValue(stats: ArkStats, stat: ArkStat): number | null {
    if (stat === "money") return stats.bars.money?.bar ?? null;
    return stats.bars[stat];
}

/** A change's rows in the order they are drawn: the life stats, Money, then Experience. */
export function arkChangeRows(change: ArkChange): Array<{stat: ArkStat; before: number; after: number; delta: number}> {
    const rows: Array<{stat: ArkStat; before: number; after: number; delta: number}> = [];
    for (const stat of ["relationships", "energy", "reputation"] as const) {
        const found = change.changes.find((item) => item.stat === stat);
        if (found && found.delta !== 0) rows.push(found);
    }
    const money = change.changes.find((item) => item.stat === "money");
    if (change.money && change.money.deltaCents !== 0) {
        rows.push(money ?? {
            stat: "money",
            before: arkMoneyBar(change.money.beforeCents),
            after: arkMoneyBar(change.money.afterCents),
            delta: arkMoneyBar(change.money.afterCents) - arkMoneyBar(change.money.beforeCents)
        });
    } else if (money && money.delta !== 0) {
        rows.push(money);
    }
    const experience = change.changes.find((item) => item.stat === "experience");
    if (experience && experience.delta !== 0) rows.push(experience);
    else if (change.experienceDelta > 0) rows.push({stat: "experience", before: 0, after: change.experienceDelta, delta: change.experienceDelta});
    return rows;
}

/** A row is a loss when the stat fell (Money: when the balance fell). */
export function arkRowIsLoss(change: ArkChange, row: {stat: ArkStat; delta: number}): boolean {
    if (row.stat === "money" && change.money) return change.money.deltaCents < 0;
    return row.delta < 0;
}

/** Any stat fell. */
export function arkChangeHasLoss(change: ArkChange): boolean {
    return arkChangeRows(change).some((row) => row.stat !== "experience" && arkRowIsLoss(change, row));
}

/** A revision went better or worse (or changed nothing), from what it moved. */
export function arkRevisionDirection(change: ArkChange): "better" | "worse" | "none" {
    const net = arkChangeRows(change)
        .filter((row) => row.stat !== "experience")
        .reduce((sum, row) => sum + (row.stat === "money" && change.money
            // A Money move too small to shift the bar still counts, by its sign.
            ? Math.sign(change.money.deltaCents) * Math.max(1, Math.abs(row.delta))
            : row.delta), 0);
    return net > 0 ? "better" : net < 0 ? "worse" : "none";
}

/** A revision the chat shows: one that is a revision (an undo is its own row). */
export function arkIsRevision(change: ArkChange): boolean {
    return change.kind === "revised" && change.parentId !== null;
}

/** A reveal: the tap's own row. */
export function arkIsReveal(change: ArkChange): boolean {
    return (change.kind === "earned" || change.kind === "lesson") && change.parentId === null;
}

// MARK: - Money, in the display currency

/** Integer cents part of the way from `before` to `after` (an ease-out count-up or count-down). */
export function arkCountAt(before: number, after: number, progress: number): number {
    const t = Math.max(0, Math.min(1, progress));
    const eased = 1 - Math.pow(1 - t, 3);
    return Math.round(before + (after - before) * eased);
}

/** The Money change as a share of the balance before, to one decimal (analytics `money_pct`). */
export function arkMoneyPercent(money: ArkMoneyChange | null): number {
    if (!money || money.beforeCents <= 0) return 0;
    return Math.round((money.deltaCents / money.beforeCents) * 1000) / 10;
}

/** "+3", "−2" (a true minus), "0". */
export function arkSignedNumber(delta: number, locale?: string): string {
    const magnitude = new Intl.NumberFormat(locale, {maximumFractionDigits: 0}).format(Math.abs(delta));
    return delta > 0 ? `+${magnitude}` : delta < 0 ? `−${magnitude}` : magnitude;
}

/**
 * A signed money change in the display currency: "+£45", "−$60". `format`
 * is the site's own (`formatDisplayMoney`, USD in, the reader's currency
 * out), passed in so this file stays free of the currency table.
 */
export function arkSignedMoney(deltaCents: number, format: (usd: number) => string): string {
    const amount = format(Math.abs(deltaCents) / 100);
    return deltaCents > 0 ? `+${amount}` : deltaCents < 0 ? `−${amount}` : amount;
}

// MARK: - Where a change shows in the chat

type ThreadMessage = {id: string; role: string; createdAt: string; status?: string; companionEvent?: {stepSet?: {id: string | null} | undefined} | undefined};

/**
 * The user message a revision belongs under (contract section 4): the one
 * whose id is its `chat_message_ref`, or, for a thread without stable ids,
 * the person's message nearest that time (within ten minutes). Null when the
 * message is not in the loaded thread: the Diary still has it.
 */
export function arkRevisionAnchorId(change: Pick<ArkChange, "chatMessageRef">, messages: readonly ThreadMessage[]): string | null {
    const ref = change.chatMessageRef?.trim();
    if (!ref) return null;
    const byId = messages.find((message) => message.role === "user" && message.id.toLowerCase() === ref.toLowerCase());
    if (byId) return byId.id;
    if (UUID.test(ref)) return null;
    const at = Date.parse(ref);
    if (Number.isNaN(at)) return null;
    let best: {id: string; gap: number} | null = null;
    for (const message of messages) {
        if (message.role !== "user") continue;
        const sent = Date.parse(message.createdAt);
        if (Number.isNaN(sent)) continue;
        const gap = Math.abs(sent - at);
        if (gap <= 10 * 60_000 && (!best || gap < best.gap)) best = {id: message.id, gap};
    }
    return best?.id ?? null;
}

/** The reply that set a step: its reveal goes right under it. Null when it is not in the loaded thread. */
export function arkRevealAnchorId(stepId: string, messages: readonly ThreadMessage[]): string | null {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== "assistant" || (message.status && message.status !== "complete")) continue;
        const id = message.companionEvent?.stepSet?.id;
        if (id && id.toLowerCase() === stepId.toLowerCase()) return message.id;
    }
    return null;
}

/** The newest reveal per step, and every revision, from a newest-first ledger read for one animal. */
export function arkThreadChanges(changes: readonly ArkChange[]): {reveals: Map<string, ArkChange>; revisions: ArkChange[]} {
    const reveals = new Map<string, ArkChange>();
    const revisions: ArkChange[] = [];
    for (const change of changes) {
        if (arkIsReveal(change) && change.stepId && !reveals.has(change.stepId)) reveals.set(change.stepId, change);
        if (arkIsRevision(change)) revisions.push(change);
    }
    // Oldest first, as the thread reads.
    revisions.reverse();
    return {reveals, revisions};
}

// MARK: - The Diary (contract section 7)

/** The Diary's own state for an entry: the server's, else from its changes. */
export function arkEntryState(ark: {state: ArkDiaryState | null; changes: ArkChange[]} | null | undefined): ArkDiaryState | null {
    if (!ark) return null;
    if (ark.state) return ark.state;
    if (ark.changes.some((change) => arkIsRevision(change) && !change.undoneAt)) return "revised";
    if (ark.changes.some((change) => arkIsReveal(change) && (change.kind === "lesson" || arkChangeHasLoss(change)))) return "lesson";
    return ark.changes.some(arkIsReveal) ? "earned" : null;
}

/** The choices the profile-wide switch offers: a teen has no public option. */
export function arkDiaryVisibilityChoices(teen: boolean): ArkDiaryVisibility[] {
    return teen ? ["private"] : ["public", "private"];
}

/** What the switch shows: a teen is always private; the contract's default is public. */
export function arkEffectiveVisibility(visibility: ArkDiaryVisibility | null, teen: boolean): ArkDiaryVisibility {
    return teen ? "private" : visibility ?? "public";
}

/**
 * Whether an entry shows on the public diary: the switch is public, not a
 * teen, its summary approved, not hidden, not sensitive.
 */
export function arkEntryIsPublic(entry: {publicSummary: string | null; hidden: boolean; sensitive: boolean}, visibility: ArkDiaryVisibility, teen: boolean): boolean {
    return !teen && visibility === "public" && Boolean(entry.publicSummary) && !entry.hidden && !entry.sensitive;
}

// MARK: - The profile's Stats order (contract section 9)

export type ArkProfileSection =
    | "arkScore"
    | "bars"
    | "stepsPowers"
    | "qualities"
    | "crew"
    | "problems"
    | "follows"
    | "weekly"
    | "collecting"
    | "bodyStats";

/**
 * The Stats tab, top to bottom. `ark` is false on a server without Ark:
 * its three sections drop out and the rest keep their order. The Diary
 * counts show on your own profile, and on someone else's when they have
 * public debates to link to.
 */
export function arkProfileSections(params: {ark: boolean; isSelf: boolean; hasPublicDiary?: boolean; hasFollows?: boolean; hasWeek?: boolean}): ArkProfileSection[] {
    const sections: ArkProfileSection[] = [];
    if (params.ark) sections.push("arkScore", "bars", "stepsPowers");
    sections.push("qualities", "crew");
    if (params.isSelf || params.hasPublicDiary) sections.push("problems");
    if (params.hasFollows !== false) sections.push("follows");
    if (params.hasWeek !== false) sections.push("weekly");
    sections.push("collecting", "bodyStats");
    return sections;
}

/** The business header (DEFAULT): Ark Score · Powers · Steps. */
export const ARK_HEADER_FIGURES = ["arkScore", "powers", "steps"] as const;

// MARK: - Analytics (contract section 10)

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export function arkRevealShownParams(reveal: ArkChange, speciesProfileId: string | null): AnalyticsParams {
    return {
        size: reveal.size ?? "medium",
        kind: reveal.kind,
        animal_species_id: reveal.speciesProfileId ?? speciesProfileId ?? undefined,
        money_pct: arkMoneyPercent(reveal.money)
    };
}

export function arkRevisionShownParams(revision: ArkChange): AnalyticsParams {
    return {direction: arkRevisionDirection(revision), source: revision.source};
}

export const ARK_EVENTS = {
    revealShown: "ark_reveal_shown",
    revealSkipped: "ark_reveal_skipped",
    revisionShown: "ark_revision_shown",
    revisionUndone: "ark_revision_undone",
    diaryVisibilityChanged: "diary_visibility_changed",
    diarySummaryApproved: "diary_summary_approved",
    diaryEntryHidden: "diary_entry_hidden"
} as const;

// MARK: - Problems the Ark calls raise

export const ARK_PROBLEM_CODES = [
    "not_authenticated",
    "change_not_found",
    "not_a_revision",
    "already_undone",
    "focus_not_found",
    "invalid_visibility",
    "teen_private",
    "summary_too_long",
    "summary_not_safe",
    "sensitive_problem"
] as const;

export type ArkProblemCode = (typeof ARK_PROBLEM_CODES)[number] | "ark_unavailable";

export function arkProblemCode(message: unknown): ArkProblemCode {
    const said = typeof message === "string" ? message.toLowerCase() : "";
    return ARK_PROBLEM_CODES.find((code) => said.includes(code)) ?? "ark_unavailable";
}

/** The public summary as it is approved: whitespace folded, at most 400 characters (contract section 7). */
export const ARK_PUBLIC_SUMMARY_MAX = 400;
export function cleanArkSummary(raw: string): string {
    return raw.replace(/\s+/g, " ").trim().slice(0, ARK_PUBLIC_SUMMARY_MAX);
}
