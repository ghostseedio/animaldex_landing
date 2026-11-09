/**
  * Life Sim (Ark Score) on the web's own chat: a port of the apps' edge lane,
  * `supabase/functions/_shared/ark-sim.ts` (AnimalDex 5a1ff095), held to it by
  * `ask-animaldex-your-step-parity.test.ts` and its fixture
  * (`scripts/generate-your-step-parity-fixture.mts`). docs/life-sim/CONTRACT.md
  * sections 4 to 7:
  *
  * - Step tags (section 5): after a step is saved, ONE fast JSON call tags it
  *   and writes the 2-3 beat story and the animal's reaction the reveal shows.
  *   A step set without a chat turn (a Trials card, a debate way) is tagged
  *   lazily on the person's next chat turn, while its reveal is still to come.
  * - Detection (section 6) lives in the memory call (`companion.ts`
  *   buildAskMemoryDeltaPrompts); this file loads the steps it judges
  *   (`ark_recent_revealed_steps`) and acts on the answer, the flag first.
  * - Revisions mentioned once (section 4), and the visitor's view of its owner
  *   (section 7).
  *
  * The edge's Diary draft (`runDiaryPublicDraft`) is not ported: the web calls
  * the edge action `diary_public_draft`. Nothing here writes an animal's words.
  * The code is the edge's, re-indented; iterable spreads are `Array.from`
  * (this project compiles to ES5).
  */

import {ASK_CRISIS_PATTERN as CRISIS_PATTERN, type AskStepOutcomeDelta as StepOutcomeDelta} from "@/lib/ask-animaldex/companion";

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
// The few calls this file makes on the service-role client.
export type ArkAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
    from: (table: string) => any;
};

// fastJSON's shape (debate-models.ts), injectable for tests.
export type FastJSONCall = (params: { prompt: string; feature: string; timeoutMs: number; maxTokens?: number }) => Promise<
    Record<string, unknown>
>;

export const STEP_SIM_TAGS_FEATURE = "step_sim_tags";

export const ARK_COSTS = ["money", "relationships", "energy", "reputation"] as const;
export type ArkCost = typeof ARK_COSTS[number];
export const STEP_SIZES = ["small", "medium", "large"] as const;
export type StepSize = typeof STEP_SIZES[number];

// The tags set_animal_step_sim_tags stores (section 5's JSON, exactly).
export type StepSimTags = {
    size: StepSize;
    costs: ArkCost[];
    sensitive: boolean;
    story: string[];
    reaction: string | null;
};

const STORY_BEAT_MAX = 200;
const REACTION_MAX = 200;

function clean(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const text = value
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(?:[-*•]+|\d+[.)])\s*/, "")
        .replace(/^["“'‘]+|["”'’]+$/g, "")
        .trim();
    if (!text) return null;
    return text.length > max ? text.slice(0, max).trimEnd() : text;
}

// Money said out loud ("£600", "$5", "600 euros"): allowed in the story, never
// in the reaction (section 5).
const AMOUNT = /[£$€¥₹]\s?\d|\d[\d,.]*\s?(?:pounds|quid|dollars|bucks|euros|yen|rupees)\b/i;
// What the app counts is the app's to show: a beat never reads out scores.
const APP_COUNTS = /\b(?:ark score|xp|stats?|points?|level up)\b/i;
// A hidden line or a card never belongs in the reveal.
const MARKUP = /```|animaldex-card|^(?:FOCUS|TRIAL|DONE|REFER|DEBATE(?:_OFFER)?):/i;

function storyBeat(value: unknown): string | null {
    const beat = clean(value, STORY_BEAT_MAX);
    if (!beat || beat.length < 3 || MARKUP.test(beat) || APP_COUNTS.test(beat)) return null;
    return beat;
}

// The fast model's answer, or null when it cannot be used (the step stays
// untagged and reveals with the default medium band). A hard problem keeps
// nothing but the flag: no story, no reaction, no costs.
export function parseStepSimTags(raw: unknown): StepSimTags | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const sizeWord = typeof row.size === "string" ? row.size.trim().toLowerCase() : "";
    const size = (STEP_SIZES as readonly string[]).includes(sizeWord) ? sizeWord as StepSize : null;
    const beats = (Array.isArray(row.story) ? row.story : []).map(storyBeat).filter((beat): beat is string => beat !== null)
        .slice(0, 3);
    const reactionText = clean(row.reaction, REACTION_MAX);
    const crisis = [...beats, reactionText ?? ""].some((text) => CRISIS_PATTERN.test(text));
    const sensitive = row.sensitive === true || crisis;
    if (sensitive) return { size: size ?? "medium", costs: [], sensitive: true, story: [], reaction: null };
    if (!size) return null;
    const costs = Array.from(new Set((Array.isArray(row.costs) ? row.costs : [])
        .map((cost) => typeof cost === "string" ? cost.trim().toLowerCase() : "")
        .filter((cost): cost is ArkCost => (ARK_COSTS as readonly string[]).includes(cost))));
    const reaction = reactionText && reactionText.length >= 3 && !AMOUNT.test(reactionText) && !MARKUP.test(reactionText) &&
            !APP_COUNTS.test(reactionText)
        ? reactionText
        : null;
    return { size, costs, sensitive: false, story: beats.length >= 2 ? beats : [], reaction };
}

// What set_animal_step_sim_tags receives as p_tags.
export function simTagsPayload(tags: StepSimTags): Record<string, unknown> {
    return {
        size: tags.size,
        costs: tags.costs,
        sensitive: tags.sensitive,
        story: tags.story,
        reaction: tags.reaction,
    };
}

// A debate way the step came from (the report's way, fits_when and costs).
export type StepDebateWay = { animal: string | null; way: string | null; fits_when: string | null; costs: string | null };

// Who is tagging and how it speaks.
export type StepTagAnimal = {
    animalName: string;
    nickname?: string | null;
    powerName?: string | null;
    lesson?: string | null;
    languageName?: string | null;
    // From its voice card: how it meets people and how it talks.
    stance?: string | null;
    speechHabits?: string[] | null;
};

export type StepTagInput = StepTagAnimal & {
    step: string;
    problem: string | null;
    debateWay?: StepDebateWay | null;
};

function quoted(text: string | null | undefined, max: number): string {
    return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// The one fast call's instructions (section 5).
export function buildStepSimTagsPrompt(input: StepTagInput): string {
    const name = input.nickname ? `${input.nickname}, a ${input.animalName}` : `a ${input.animalName}`;
    const language = input.languageName?.trim() || "English";
    const way = input.debateWay && (input.debateWay.way || input.debateWay.costs || input.debateWay.fits_when)
        ? [
            "",
            `This step is the way they chose in a debate${input.debateWay.animal ? `, ${quoted(input.debateWay.animal, 60)}'s way` : ""}:`,
            ...(input.debateWay.way ? [`<way>${quoted(input.debateWay.way, 400)}</way>`] : []),
            ...(input.debateWay.fits_when ? [`It fits when <fits_when>${quoted(input.debateWay.fits_when, 300)}</fits_when>.`] : []),
            ...(input.debateWay.costs ? [`It costs <costs>${quoted(input.debateWay.costs, 300)}</costs>. Read costs from this first.`] : []),
        ]
        : [];
    const habits = (input.speechHabits ?? []).map((habit) => quoted(habit, 80)).filter(Boolean).slice(0, 3);
    return [
        "AnimalDex has a life sim: when a person takes on a step an animal set them for a real problem, the app shows how",
        "trying it might move their life (money, relationships, energy, reputation). The app works out the numbers. You tag",
        "the step and write the few lines the app shows with them.",
        "",
        `The animal: ${name}${input.powerName ? `, whose Power is ${quoted(input.powerName, 80)}` : ""}.${
            input.lesson ? ` Its lesson: ${quoted(input.lesson, 300)}` : ""
        }`,
        ...(input.stance ? [`How it meets people: ${quoted(input.stance, 200)}`] : []),
        ...(habits.length > 0 ? [`How it talks: ${habits.join("; ")}`] : []),
        `Their problem: <problem>${quoted(input.problem, 600) || "(not said)"}</problem>`,
        `The step: <step>${quoted(input.step, 400)}</step>`,
        ...way,
        "",
        "1. size: small (minutes, low stakes, easy to undo), medium (a real conversation or an hour or two, some exposure)",
        "   or large (a big decision, real money or a relationship on the line, hard to undo).",
        "2. costs: which of money, relationships, energy and reputation taking this step really spends or puts at risk:",
        "   spending or risking money is money; a hard conversation or saying no to someone is relationships; tiring or",
        "   time-consuming is energy; being seen to fail or stand out is reputation. Only what the step itself costs, not",
        "   what the problem is about. Often one or none.",
        "3. sensitive: true when the problem involves bereavement or grief, serious illness (theirs or someone close to",
        "   them), abuse, self-harm or a crisis, or persistent hopelessness. Not for ordinary hard problems (a breakup,",
        "   losing a job, money stress, a bad day). When unsure, true. When true, story is [] and reaction is \"\".",
        "4. story: 2 or 3 short beats, one sentence each, under 140 characters: what trying this step could look like in",
        "   their real life, as the animal sees it, said to them. The moment it asks something of them, and what it could",
        "   open up. Never say how it turned out, and never mention scores, stats, points or the app. Real amounts from",
        "   their problem may appear here, and only here.",
        "5. reaction: one line, the animal's own reaction to them taking the step on, the way only it would put it,",
        "   under 140 characters. No amounts, no scores.",
        `Write story and reaction in ${language}, in the animal's voice, as itself. Keys and the words for size and costs`,
        "stay in English.",
        "",
        'Return JSON only: {"size": "small|medium|large", "costs": ["money"|"relationships"|"energy"|"reputation"], "sensitive": false, "story": ["...", "..."], "reaction": "..."}',
    ].join("\n");
}

// The edge lane's own tag columns (migration 20261109100000; all NULL, no
// default). sim_sensitive, sim_reveal_at and sim_reveal_skipped are the
// database's and say nothing about tags.
const SIM_TAG_COLUMNS = ["sim_size", "sim_costs", "sim_story", "sim_reaction"] as const;

// Whether the step row says it is tagged: sim_tagged_at when the row has it;
// otherwise "tagged" when any tag column has a value. "unknown" when the row
// has no tag columns (the migration is not applied yet), so nothing is asked for.
export function simTagState(row: Record<string, unknown> | null | undefined): "tagged" | "untagged" | "unknown" {
    if (!row) return "unknown";
    if ("sim_tagged_at" in row) return row.sim_tagged_at ? "tagged" : "untagged";
    const keys = SIM_TAG_COLUMNS.filter((key) => key in row);
    if (keys.length === 0) return "unknown";
    return keys.some((key) => {
        const value = row[key];
        if (value === null || value === undefined) return false;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    })
        ? "tagged"
        : "untagged";
}

// Whether a problem (animal_companion_focus) or a step is flagged as a hard one.
export function rowIsSensitive(row: Record<string, unknown> | null | undefined): boolean {
    return row?.sensitive === true || row?.sim_sensitive === true;
}

export type StepForTagging = {
    id: string;
    step: string;
    status: string | null;
    focusId: string | null;
    problem: string | null;
    focusSensitive: boolean;
    tagState: "tagged" | "untagged" | "unknown";
    // The reveal has run (or was skipped) already (sim_reveal_at): its numbers
    // and story are fixed, so a late tag would change nothing.
    revealAttempted: boolean;
};

export async function loadStepForTagging(admin: ArkAdmin, params: { userId: string; stepId: string }): Promise<StepForTagging | null> {
    const { data, error } = await admin.from("animal_companion_trials").select("*")
        .eq("id", params.stepId).eq("user_id", params.userId).maybeSingle();
    if (error || !data || typeof data !== "object") {
        if (error) console.warn("step_sim_tags: step read failed", error.message);
        return null;
    }
    const row = data as Record<string, unknown>;
    const focusId = typeof row.focus_id === "string" ? row.focus_id : null;
    let focus: Record<string, unknown> | null = null;
    if (focusId) {
        const read = await admin.from("animal_companion_focus").select("*").eq("id", focusId).eq("user_id", params.userId).maybeSingle();
        if (read.error) console.warn("step_sim_tags: focus read failed", read.error.message);
        focus = read.data && typeof read.data === "object" ? read.data as Record<string, unknown> : null;
    }
    return {
        id: String(row.id),
        step: typeof row.step === "string" ? row.step : "",
        status: typeof row.status === "string" ? row.status : null,
        focusId,
        problem: typeof focus?.focus === "string" ? focus.focus : null,
        focusSensitive: rowIsSensitive(focus) || rowIsSensitive(row),
        tagState: simTagState(row),
        revealAttempted: typeof row.sim_reveal_at === "string" && row.sim_reveal_at.length > 0,
    };
}

// The way chosen in the debate a step came from, from that debate's report.
export function debateWayFromReport(report: unknown, seat: number | null, animal: string | null): StepDebateWay | null {
    if (seat === null || !report || typeof report !== "object") return null;
    const ways = (report as Record<string, unknown>).ways;
    if (!Array.isArray(ways)) return null;
    const entry = ways.find((item) => item && typeof item === "object" && Number((item as Record<string, unknown>).seat) === seat) as
        | Record<string, unknown>
        | undefined;
    if (!entry) return null;
    const text = (value: unknown) => clean(value, 400);
    const way = { animal, way: text(entry.way), fits_when: text(entry.fits_when), costs: text(entry.costs) };
    return way.way || way.fits_when || way.costs ? way : null;
}

// The debate way behind a step (animal_step_source_debate), or null.
export async function loadStepDebateWay(admin: ArkAdmin, params: { userId: string; stepId: string }): Promise<StepDebateWay | null> {
    try {
        const source = await admin.rpc("animal_step_source_debate", { p_user_id: params.userId, p_trial_id: params.stepId });
        const debateId = typeof source.data === "string" ? source.data : null;
        if (source.error || !debateId) return null;
        const debate = await admin.from("debates").select("report, asker_way_participant_id").eq("id", debateId).maybeSingle();
        const participantId = typeof debate.data?.asker_way_participant_id === "string" ? debate.data.asker_way_participant_id : null;
        if (debate.error || !participantId) return null;
        const seat = await admin.from("debate_participants").select("seat, animal_name").eq("id", participantId).maybeSingle();
        if (seat.error || !seat.data) return null;
        const seatNumber = Number(seat.data.seat);
        return debateWayFromReport(
            debate.data?.report,
            Number.isFinite(seatNumber) ? seatNumber : null,
            typeof seat.data.animal_name === "string" ? seat.data.animal_name : null,
        );
    } catch (error) {
        console.warn("step_sim_tags: debate way unavailable", error instanceof Error ? error.message : String(error));
        return null;
    }
}

// Lazy tags already asked for in this isolate: a step whose call failed is
// asked again on a later turn in a new isolate, not on every message.
const LAZY_ASKED = new Set<string>();

// Tags one step (section 5) and stores them; flags its problem when it is a
// hard one. `fresh`: the step was just set in this reply (a TRIAL line), so it
// is tagged without checking; otherwise only an open, untagged step is, once.
// Never throws; returns what was stored.
export async function tagStepForSim(
    admin: ArkAdmin,
    params: {
        userId: string;
        stepId: string;
        animal: StepTagAnimal;
        fresh: boolean;
        // Known already (a step set in this reply never came from a debate).
        debateWay?: StepDebateWay | null;
    },
    deps: { fastJSON: FastJSONCall; asked?: Set<string> },
): Promise<StepSimTags | null> {
    const asked = deps.asked ?? LAZY_ASKED;
    const key = params.stepId.toLowerCase();
    if (!params.fresh && asked.has(key)) return null;
    try {
        const step = await loadStepForTagging(admin, params);
        if (!step || !step.step) return null;
        // A hard problem is flagged already: nothing to write, and no call made.
        if (step.focusSensitive) return null;
        // Lazily: an open, untagged step whose reveal is still to come (a Trials
        // card's step reveals at once, so it is not worth a call afterwards).
        if (!params.fresh && (step.status !== "open" || step.tagState !== "untagged" || step.revealAttempted)) return null;
        if (params.fresh && step.tagState === "tagged") return null;
        asked.add(key);
        const debateWay = params.debateWay === undefined ? await loadStepDebateWay(admin, params) : params.debateWay;
        const raw = await deps.fastJSON({
            prompt: buildStepSimTagsPrompt({ ...params.animal, step: step.step, problem: step.problem, debateWay }),
            feature: STEP_SIM_TAGS_FEATURE,
            timeoutMs: 12_000,
            maxTokens: 500,
        });
        const parsed = parseStepSimTags(raw);
        if (!parsed) {
            console.warn("step_sim_tags: unusable answer", params.stepId);
            return null;
        }
        // Crisis words in their own problem or step make it a hard one, whatever the model said.
        const tags: StepSimTags = CRISIS_PATTERN.test(`${step.problem ?? ""} ${step.step}`)
            ? { size: parsed.size, costs: [], sensitive: true, story: [], reaction: null }
            : parsed;
        const saved = await admin.rpc("set_animal_step_sim_tags", {
            p_user_id: params.userId,
            p_step_id: step.id,
            p_tags: simTagsPayload(tags),
        });
        if (saved.error) console.warn("set_animal_step_sim_tags failed", saved.error.message);
        if (tags.sensitive && step.focusId) await markFocusSensitive(admin, { userId: params.userId, focusId: step.focusId });
        return tags;
    } catch (error) {
        console.warn("step_sim_tags failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
        return null;
    }
}

// Sticky: once set it never unsets, so there is no call to unset it.
export async function markFocusSensitive(admin: ArkAdmin, params: { userId: string; focusId: string }): Promise<void> {
    const { error } = await admin.rpc("mark_focus_sensitive", { p_user_id: params.userId, p_focus_id: params.focusId });
    if (error) console.warn("mark_focus_sensitive failed", error.message);
}

// ---------------------------------------------------------------------------
// Detection (section 6): the steps the memory call judges
// ---------------------------------------------------------------------------

// `focusId` is for the server only (a problem flagged this turn drops its
// steps' outcomes); the memory call is shown the rest.
export type RecentRevealedStep = {
    id: string;
    step: string;
    animal: string;
    status: string | null;
    outcome: string | null;
    focusId: string | null;
    // The reveal's kind (earned | lesson), when the ledger says it.
    kind?: string | null;
};

export const REVEALED_STEP_DAYS = 30;
const REVEALED_STEP_MAX = 12;

// ark_recent_revealed_steps' rows (migration 20261109110000: sensitive steps
// already left out, newest first) as the memory call's recent_steps.
export function revealedStepsFromLedger(raw: unknown, exclude?: Iterable<string>): RecentRevealedStep[] {
    if (!Array.isArray(raw)) return [];
    const excluded = new Set(Array.from(exclude ?? []).map((id) => id.toLowerCase()));
    const seen = new Set<string>();
    const out: RecentRevealedStep[] = [];
    for (const item of raw) {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const id = typeof row?.step_id === "string" ? row.step_id : null;
        const step = clean(row?.step, 300);
        if (!row || !id || !step || excluded.has(id.toLowerCase()) || seen.has(id.toLowerCase())) continue;
        // Sensitive ones are the database's to leave out; one that says so anyway is dropped too.
        if (row.sensitive === true) continue;
        seen.add(id.toLowerCase());
        out.push({
            id,
            step,
            animal: clean(row.animal, 80) ?? "one of their animals",
            status: typeof row.status === "string" ? row.status : null,
            outcome: typeof row.outcome === "string" ? row.outcome : null,
            focusId: typeof row.focus_id === "string" ? row.focus_id : null,
            kind: typeof row.kind === "string" ? row.kind : null,
        });
        if (out.length >= REVEALED_STEP_MAX) break;
    }
    return out;
}

// A PostgREST / Postgres error that means the function is not there (a
// database without migration 20261109110000), as opposed to one that failed.
export function isMissingFunctionError(error: { message?: string; code?: string } | null | undefined): boolean {
    if (!error) return false;
    if (error.code === "PGRST202" || error.code === "42883") return true;
    return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

// The fallback for a database without ark_recent_revealed_steps: rows of
// animal_companion_trials (with their problems and animals) taken on
// (accepted, which is when the reveal runs) in the last 30 days, open or
// done, never on a hard problem (those are never revised), newest first, at
// most 12.
export function revealedStepsFromRows(params: {
    trials: Array<Record<string, unknown>>;
    focuses: Array<Record<string, unknown>>;
    animals: Array<Record<string, unknown>>;
    exclude?: Iterable<string>;
    now?: Date;
}): RecentRevealedStep[] {
    const since = (params.now ?? new Date()).getTime() - REVEALED_STEP_DAYS * 24 * 60 * 60 * 1000;
    const excluded = new Set(Array.from(params.exclude ?? []).map((id) => id.toLowerCase()));
    const sensitiveFocus = new Set(params.focuses.filter((row) => rowIsSensitive(row)).map((row) => String(row.id)));
    const names = new Map(params.animals.map((row) => [
        String(row.id),
        clean(row.display_name, 80) ?? clean(row.animal_name, 80) ?? "one of their animals",
    ]));
    return params.trials
        .filter((row) => typeof row.id === "string" && typeof row.step === "string")
        .filter((row) => !excluded.has(String(row.id).toLowerCase()))
        .filter((row) => row.status === "open" || row.status === "done")
        .filter((row) => typeof row.accepted_at === "string" && Date.parse(row.accepted_at) >= since)
        .filter((row) => !rowIsSensitive(row) && !(typeof row.focus_id === "string" && sensitiveFocus.has(row.focus_id)))
        .sort((a, b) => Date.parse(String(b.accepted_at)) - Date.parse(String(a.accepted_at)))
        .slice(0, REVEALED_STEP_MAX)
        .map((row) => ({
            id: String(row.id),
            step: clean(row.step, 300) ?? "",
            animal: names.get(String(row.species_profile_id)) ?? "one of their animals",
            status: typeof row.status === "string" ? row.status : null,
            outcome: typeof row.outcome === "string" ? row.outcome : null,
            focusId: typeof row.focus_id === "string" ? row.focus_id : null,
        }));
}

// Their revealed steps from every animal (section 6), from
// ark_recent_revealed_steps; only a database without that function falls
// back to the accepted-steps read. Any failure is no steps, which leaves the
// memory call exactly as it was.
export async function loadRecentRevealedSteps(
    admin: ArkAdmin,
    params: { userId: string; exclude?: Iterable<string>; now?: Date },
): Promise<RecentRevealedStep[]> {
    try {
        const revealed = await admin.rpc("ark_recent_revealed_steps", { p_user_id: params.userId, p_days: REVEALED_STEP_DAYS });
        if (!revealed.error) return revealedStepsFromLedger(revealed.data, params.exclude);
        if (!isMissingFunctionError(revealed.error)) {
            console.warn("ark_recent_revealed_steps failed", revealed.error.message);
            return [];
        }
        return await acceptedStepsFallback(admin, params);
    } catch (error) {
        console.warn("ark revealed steps unavailable", error instanceof Error ? error.message : String(error));
        return [];
    }
}

async function acceptedStepsFallback(
    admin: ArkAdmin,
    params: { userId: string; exclude?: Iterable<string>; now?: Date },
): Promise<RecentRevealedStep[]> {
    {
        const now = params.now ?? new Date();
        const since = new Date(now.getTime() - REVEALED_STEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin.from("animal_companion_trials").select("*")
            .eq("user_id", params.userId)
            .in("status", ["open", "done"])
            .gte("accepted_at", since)
            .order("accepted_at", { ascending: false })
            .limit(20);
        if (error) {
            console.warn("ark revealed steps read failed", error.message);
            return [];
        }
        const trials = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
        if (trials.length === 0) return [];
        const focusIds = Array.from(new Set(trials.map((row) => row.focus_id).filter((id): id is string => typeof id === "string")));
        const speciesIds = Array.from(new Set(trials.map((row) => row.species_profile_id).filter((id): id is string => typeof id === "string")));
        const [focuses, animals] = await Promise.all([
            focusIds.length > 0
                ? admin.from("animal_companion_focus").select("*").eq("user_id", params.userId).in("id", focusIds)
                : Promise.resolve({ data: [], error: null }),
            speciesIds.length > 0
                ? admin.from("species_profiles").select("id, display_name, animal_name").in("id", speciesIds)
                : Promise.resolve({ data: [], error: null }),
        ]);
        // Without the problems it cannot be told which are hard ones: none, to be safe.
        if (focuses.error) {
            console.warn("ark revealed steps: focus read failed", focuses.error.message);
            return [];
        }
        return revealedStepsFromRows({
            trials,
            focuses: (focuses.data ?? []) as Array<Record<string, unknown>>,
            animals: (animals.data ?? []) as Array<Record<string, unknown>>,
            exclude: params.exclude,
            now,
        });
    }
}

// One revision per clear outcome (section 4/6), keyed to the message that said it.
export async function applyStepRevision(
    admin: ArkAdmin,
    params: {
        userId: string;
        stepId: string;
        direction: "better" | "worse";
        source: "chat" | "report";
        statement: string;
        chatMessageRef: string | null;
        // The animal whose chat it was said in, so that animal mentions it next.
        chatSpeciesProfileId?: string | null;
    },
): Promise<unknown> {
    const { data, error } = await admin.rpc("ark_apply_step_revision", {
        p_user_id: params.userId,
        p_step_id: params.stepId,
        p_direction: params.direction,
        p_source: params.source,
        p_statement: params.statement.slice(0, 200),
        p_chat_message_ref: params.chatMessageRef ? params.chatMessageRef.slice(0, 200) : null,
        p_chat_species_profile_id: params.chatSpeciesProfileId ?? null,
    });
    if (error) {
        console.warn("ark_apply_step_revision failed", error.message);
        return null;
    }
    // {change, skipped}: a skip (not_revealed, duplicate, a cap...) is an answer, not a failure.
    const skipped = data && typeof data === "object" ? (data as Record<string, unknown>).skipped : null;
    if (typeof skipped === "string" && skipped !== "none") console.info("ark revision skipped", skipped, params.stepId);
    return data;
}

// What the memory call's answer asks of the life sim this turn (section 6):
// the problem to flag (sticky; a false never unsets) and the revisions to
// make. A problem flagged now, or already, keeps its steps unrevised.
export function lifeSimActions(params: {
    stepOutcomes: StepOutcomeDelta[];
    focusSensitive: boolean;
    revealed: RecentRevealedStep[];
    // The problem the model was asked about (null when it was not asked).
    checkedFocus: { id: string; sensitive?: boolean } | null;
    // Their message: crisis words flag the problem whatever the model said.
    message: string;
}): { markFocusId: string | null; revisions: StepOutcomeDelta[] } {
    const focus = params.checkedFocus;
    const flagNow = Boolean(focus && focus.sensitive !== true && (params.focusSensitive || CRISIS_PATTERN.test(params.message)));
    const hardFocus = focus && (flagNow || focus.sensitive === true) ? focus.id : null;
    const focusOf = new Map(params.revealed.map((step) => [step.id, step.focusId]));
    const revisions = params.stepOutcomes.filter((outcome) =>
        focusOf.has(outcome.step_id) && !(hardFocus && focusOf.get(outcome.step_id) === hardFocus)
    );
    return { markFocusId: flagNow ? focus!.id : null, revisions };
}

// Carries them out: the flag first, so a revision can never land on a problem
// that has just turned hard.
export async function applyLifeSimActions(
    admin: ArkAdmin,
    params: {
        userId: string;
        actions: { markFocusId: string | null; revisions: StepOutcomeDelta[] };
        chatMessageRef: string | null;
        chatSpeciesProfileId?: string | null;
    },
): Promise<void> {
    if (params.actions.markFocusId) await markFocusSensitive(admin, { userId: params.userId, focusId: params.actions.markFocusId });
    for (const outcome of params.actions.revisions) {
        await applyStepRevision(admin, {
            userId: params.userId,
            stepId: outcome.step_id,
            direction: outcome.direction,
            source: "chat",
            statement: outcome.statement,
            chatMessageRef: params.chatMessageRef,
            chatSpeciesProfileId: params.chatSpeciesProfileId ?? null,
        });
    }
}

// The report's outcome as a revision direction (section 4): worked is better,
// didn't work is worse, partly changes nothing.
export function reportRevisionDirection(outcome: string | null | undefined): "better" | "worse" | null {
    return outcome === "worked" ? "better" : outcome === "didnt_work" ? "worse" : null;
}

// Whether record_animal_step_outcome_v1 handles the report's revision itself
// (migration 20261109110000): its answer carries the `ark_revision` key, even
// as null (skipped, with ark_revision_skipped). Only an older database, whose
// answer has no such key, leaves the revision to the edge.
export function outcomeAlreadyRevised(recorded: unknown): boolean {
    if (!recorded || typeof recorded !== "object" || Array.isArray(recorded)) return false;
    return "ark_revision" in (recorded as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Revisions the animal may mention once (section 4)
// ---------------------------------------------------------------------------

export type ArkRevisionMention = {
    id: string;
    step: string | null;
    animal: string | null;
    direction: "better" | "worse" | null;
    statement: string | null;
    changes: Array<{ stat: string; delta: number }>;
    money: "up" | "down" | null;
    experience: number;
    focusId: string | null;
    sensitive: boolean;
};

function revisionRows(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
        const row = raw as Record<string, unknown>;
        for (const key of ["revisions", "changes", "items"]) {
            if (Array.isArray(row[key])) return row[key] as unknown[];
        }
    }
    return [];
}

// ark_unmentioned_revisions' answer: a list of ledger entries (or an object
// holding one), each read defensively. Undone entries are dropped.
export function parseUnmentionedRevisions(raw: unknown): ArkRevisionMention[] {
    return revisionRows(raw).flatMap((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        if (!row || typeof row.id !== "string") return [];
        if (row.kind === "undone" || (typeof row.undone_at === "string" && row.undone_at)) return [];
        const changes = (Array.isArray(row.changes) ? row.changes : []).flatMap((change) => {
            const entry = change && typeof change === "object" ? change as Record<string, unknown> : null;
            const delta = Number(entry?.delta);
            return entry && typeof entry.stat === "string" && Number.isFinite(delta) && delta !== 0
                ? [{ stat: entry.stat, delta: Math.round(delta) }]
                : [];
        });
        const money = row.money && typeof row.money === "object" ? Number((row.money as Record<string, unknown>).delta_cents) : 0;
        const experience = Number(row.experience_delta) || 0;
        const net = changes.reduce((sum, change) => sum + change.delta, 0) + Math.sign(money || 0);
        const said = typeof row.direction === "string" ? row.direction.toLowerCase() : "";
        const direction = said === "better" || said === "worse" ? said : net > 0 ? "better" : net < 0 ? "worse" : null;
        return [{
            id: row.id,
            step: clean(row.step, 300),
            animal: clean(row.animal, 80),
            direction,
            statement: clean(row.statement, 200),
            changes,
            money: money > 0 ? "up" : money < 0 ? "down" : null,
            experience: Math.max(0, Math.round(experience)),
            focusId: typeof row.focus_id === "string" ? row.focus_id : null,
            sensitive: row.sensitive === true,
        }];
    });
}

export async function loadUnmentionedRevisions(
    admin: ArkAdmin,
    params: { userId: string; speciesProfileId: string },
): Promise<ArkRevisionMention[]> {
    try {
        const { data, error } = await admin.rpc("ark_unmentioned_revisions", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
        });
        if (error) {
            console.warn("ark_unmentioned_revisions failed", error.message);
            return [];
        }
        return parseUnmentionedRevisions(data);
    } catch (error) {
        console.warn("ark revisions unavailable", error instanceof Error ? error.message : String(error));
        return [];
    }
}

export async function markRevisionsMentioned(admin: ArkAdmin, params: { userId: string; ids: string[] }): Promise<void> {
    if (params.ids.length === 0) return;
    const { error } = await admin.rpc("ark_mark_revisions_mentioned", { p_user_id: params.userId, p_ids: params.ids });
    if (error) console.warn("ark_mark_revisions_mentioned failed", error.message);
}

// What the animal is told of the life sim this turn: the revisions it may
// mention once (never one on a hard problem), and, on a hard problem, that
// nothing the app counts is spoken of. Empty when there is nothing, so the
// prompt is unchanged for everyone else.
export function arkRevisionPromptLines(params: {
    revisions: ArkRevisionMention[];
    focus: { id: string; sensitive?: boolean } | null | undefined;
}): string[] {
    const hardFocus = params.focus?.sensitive === true ? params.focus.id : null;
    const shown = params.revisions.filter((revision) => !revision.sensitive && !(hardFocus && revision.focusId === hardFocus))
        .slice(0, 3);
    return [
        shown.length > 0
            ? `life_sim_changes — since you last spoke, what they said about how a step went moved their life sim in the app (their words are statement; the app shows the numbers). You may mention it once, in this reply, in your own words and only where it fits what they are saying now; never list the numbers like a report, and never as the opening line if they have brought something else:\n${
                JSON.stringify(shown.map((revision) => ({
                    ...(revision.step ? { step: revision.step } : {}),
                    ...(revision.animal ? { with: revision.animal } : {}),
                    ...(revision.direction ? { went: revision.direction } : {}),
                    ...(revision.statement ? { statement: revision.statement } : {}),
                    ...(revision.changes.length > 0 ? { changes: revision.changes } : {}),
                    ...(revision.money ? { money: revision.money } : {}),
                    ...(revision.experience > 0 ? { experience: revision.experience } : {}),
                })))
            }`
            : "",
        hardFocus
            ? "life_sim — what they are working through with you is a hard one: never mention scores, stats, the Ark Score, Experience or anything else the app counts about it."
            : "",
    ].filter(Boolean);
}

// A chat message's reference for its revision card (section 4): the id the
// message is stored under when the app sent one, else when it was asked.
export function chatMessageRefFor(messageId: string | null, askedAt: Date): string {
    // Stored as text of at most 200 characters.
    return (messageId?.trim() || askedAt.toISOString()).slice(0, 200);
}

// ---------------------------------------------------------------------------
// The visitor's view of the owner (section 7)
// ---------------------------------------------------------------------------

// Everything a visitor's animal may know of its owner, by name. The owner's
// diary, problems, steps and life sim are never among them; approved public
// summaries (public_diary) only when the owner's diary is public.
const VISITOR_OWNER_KEYS = [
    "owner_name",
    "owner_username",
    "share_journey",
    "journey",
    "has_spoken",
    "trials",
    "applications",
    "training_passed",
    "battles",
] as const;

export const VISITOR_PUBLIC_DIARY_MAX = 5;

function publicSummaries(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (typeof item === "string") return clean(item, 400);
            const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
            return clean(row?.public_summary ?? row?.summary ?? row?.text, 400);
        })
        .filter((text): text is string => text !== null && text.length >= 10 && !CRISIS_PATTERN.test(text))
        .slice(0, VISITOR_PUBLIC_DIARY_MAX);
}

// The owner context (animal_chat_owner_context) as the visitor's prompt gets
// it: the known keys only, and public_diary only as approved public
// summaries while the diary is public (a database that says otherwise, or a
// teen owner, gets none).
export function visitorOwnerContext(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    const out: Record<string, unknown> = {};
    for (const key of VISITOR_OWNER_KEYS) {
        if (key in raw) out[key] = raw[key];
    }
    const visibility = typeof raw.diary_visibility === "string" ? raw.diary_visibility : "public";
    const summaries = visibility === "public" && raw.owner_teen !== true ? publicSummaries(raw.public_diary) : [];
    if (summaries.length > 0) out.public_diary = summaries;
    return out;
}
