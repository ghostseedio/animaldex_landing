import "server-only";

import {decorateCapture, type AppCapture} from "@/data/authenticated-app";
import {getTrainDailyCompanionState, type TrainDailyCompanionState} from "@/data/train-modules";
import {getUserCaptures} from "@/data/user-captures";
import {localLogDate} from "@/lib/daily-companion-utils";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type NatureFormulaSlot = {
    animal: string;
    role: string;
    traits: string[];
    progressDomains: string[];
    archetypes?: string[] | null;
    substitutes?: string[] | null;
};

export type NatureUsedFormulaSlot = {
    captureId: string;
    animalName: string;
    displayName: string;
    traits: string[];
    progressDomains: string[];
    rarity: number;
    imageGrade: string;
    imageGradeMultiplier: number;
    bestMatchRole?: string | null;
    compatibility: number;
    archetypes?: string[] | null;
    strategicValue?: number | null;
    contributionReason?: string | null;
};

export type JournalCompletionState = "draft" | "formula_ready" | "completed" | "archived";
export type AlignmentProofStatus = "not_started" | "pending" | "accepted" | "rejected";

export type DailyJournalLog = {
    id: string;
    logDate: string;
    userProblem: string;
    requestedFormula: NatureFormulaSlot[];
    usedFormula: NatureUsedFormulaSlot[];
    slottedCaptureIds: string[];
    generatedInsight: string | null;
    alignmentScore: number | null;
    alignmentTier: string | null;
    dominantTraits: string[];
    unlockedProgressDomains: string[];
    completionState: JournalCompletionState;
    moveTodayText: string | null;
    alignmentProofStatus: AlignmentProofStatus;
    alignmentCompletedAt: string | null;
    alignmentXpAwarded: number;
    proofStatBoostStat: string | null;
    proofRewardDomains: string[];
    createdAt: string;
    updatedAt: string;
};

export type DailyJournalProofSummary = {
    id: string;
    journalLogId: string;
    status: string;
    caption: string | null;
    verificationScore: number | null;
    verificationReason: string | null;
    alignmentXpAwarded: number;
    statBoostStat: string | null;
    rewardDomains: string[];
    timelineSummary: string | null;
    shareToTimeline: boolean;
    rewardedCaptureId: string | null;
    createdAt: string;
    completedAt: string | null;
};

export type NatureAlignmentProgress = {
    domain: string;
    points: number;
    level: number;
    journalCount: number;
    lastJournalLogId: string | null;
    lastProgressAt: string | null;
};

export type DailyCompanionPageData = {
    today: DailyJournalLog | null;
    recentLogs: DailyJournalLog[];
    proofsByLogId: Record<string, DailyJournalProofSummary>;
    progress: NatureAlignmentProgress[];
    captures: AppCapture[];
    companion: TrainDailyCompanionState;
    localDate: string;
};

type QueryRow = Record<string, unknown>;

function asString(value: unknown) {
    return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFormulaSlots(value: unknown): NatureFormulaSlot[] {
    if (!Array.isArray(value)) return [];
    const slots: NatureFormulaSlot[] = [];
    for (const slot of value) {
        if (!slot || typeof slot !== "object") continue;
        const row = slot as QueryRow;
        const animal = asString(row.animal);
        const role = asString(row.role);
        if (!animal || !role) continue;
        slots.push({
            animal,
            role,
            traits: asStringArray(row.traits),
            progressDomains: asStringArray(row.progress_domains ?? row.progressDomains),
            archetypes: asStringArray(row.archetypes),
            substitutes: asStringArray(row.substitutes)
        });
    }
    return slots;
}

function parseUsedFormulaSlots(value: unknown): NatureUsedFormulaSlot[] {
    if (!Array.isArray(value)) return [];
    const slots: NatureUsedFormulaSlot[] = [];
    for (const slot of value) {
        if (!slot || typeof slot !== "object") continue;
        const row = slot as QueryRow;
        const captureId = asString(row.capture_id ?? row.captureId);
        if (!captureId) continue;
        slots.push({
            captureId,
            animalName: asString(row.animal_name ?? row.animalName),
            displayName: asString(row.display_name ?? row.displayName) || asString(row.animal_name ?? row.animalName),
            traits: asStringArray(row.traits),
            progressDomains: asStringArray(row.progress_domains ?? row.progressDomains),
            rarity: asNumber(row.rarity),
            imageGrade: asString(row.image_grade ?? row.imageGrade) || "C",
            imageGradeMultiplier: asNumber(row.image_grade_multiplier ?? row.imageGradeMultiplier, 1),
            bestMatchRole: asString(row.best_match_role ?? row.bestMatchRole) || null,
            compatibility: asNumber(row.compatibility),
            archetypes: asStringArray(row.archetypes),
            strategicValue: row.strategic_value == null && row.strategicValue == null ? null : asNumber(row.strategic_value ?? row.strategicValue),
            contributionReason: asString(row.contribution_reason ?? row.contributionReason) || null
        });
    }
    return slots;
}

function parseJournalLog(row: QueryRow): DailyJournalLog {
    const completionState = asString(row.completion_state) as JournalCompletionState;
    const proofStatus = asString(row.alignment_proof_status) as AlignmentProofStatus;
    return {
        id: asString(row.id),
        logDate: asString(row.log_date),
        userProblem: asString(row.user_problem),
        requestedFormula: parseFormulaSlots(row.requested_formula),
        usedFormula: parseUsedFormulaSlots(row.used_formula),
        slottedCaptureIds: asStringArray(row.slotted_capture_ids),
        generatedInsight: asString(row.generated_insight) || null,
        alignmentScore: row.alignment_score == null ? null : asNumber(row.alignment_score),
        alignmentTier: asString(row.alignment_tier) || null,
        dominantTraits: asStringArray(row.dominant_traits),
        unlockedProgressDomains: asStringArray(row.unlocked_progress_domains),
        completionState: completionState || "draft",
        moveTodayText: asString(row.move_today_text) || null,
        alignmentProofStatus: proofStatus || "not_started",
        alignmentCompletedAt: asString(row.alignment_completed_at) || null,
        alignmentXpAwarded: asNumber(row.alignment_xp_awarded),
        proofStatBoostStat: asString(row.proof_stat_boost_stat) || null,
        proofRewardDomains: asStringArray(row.proof_reward_domains),
        createdAt: asString(row.created_at),
        updatedAt: asString(row.updated_at)
    };
}

function parseProofSummary(row: QueryRow): DailyJournalProofSummary | null {
    const id = asString(row.id);
    const journalLogId = asString(row.journal_log_id);
    if (!id || !journalLogId) return null;
    return {
        id,
        journalLogId,
        status: asString(row.status) || "pending",
        caption: asString(row.caption) || null,
        verificationScore: row.verification_score == null ? null : asNumber(row.verification_score),
        verificationReason: asString(row.verification_reason) || null,
        alignmentXpAwarded: asNumber(row.alignment_xp_awarded),
        statBoostStat: asString(row.stat_boost_stat) || null,
        rewardDomains: asStringArray(row.reward_domains),
        timelineSummary: asString(row.timeline_summary) || null,
        shareToTimeline: Boolean(row.share_to_timeline),
        rewardedCaptureId: asString(row.rewarded_capture_id) || null,
        createdAt: asString(row.created_at),
        completedAt: asString(row.completed_at) || null
    };
}

function parseProgress(row: QueryRow): NatureAlignmentProgress | null {
    const domain = asString(row.domain);
    if (!domain) return null;
    return {
        domain,
        points: asNumber(row.points),
        level: asNumber(row.level),
        journalCount: asNumber(row.journal_count),
        lastJournalLogId: asString(row.last_journal_log_id) || null,
        lastProgressAt: asString(row.last_progress_at) || null
    };
}

function indexProofs(proofs: DailyJournalProofSummary[]) {
    const indexed: Record<string, DailyJournalProofSummary> = {};
    for (const proof of proofs) {
        const existing = indexed[proof.journalLogId];
        if (!existing || proof.createdAt > existing.createdAt) {
            indexed[proof.journalLogId] = proof;
        }
    }
    return indexed;
}

export async function fetchDailyCompanionData(limit = 30): Promise<DailyCompanionPageData | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    const localDate = localLogDate();

    const [todayResult, recentResult, proofsResult, progressResult, captures, companion] = await Promise.all([
        supabase
            .from("daily_journal_logs")
            .select("*")
            .eq("user_id", user.id)
            .eq("log_date", localDate)
            .neq("completion_state", "archived")
            .limit(1)
            .maybeSingle(),
        supabase
            .from("daily_journal_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("log_date", {ascending: false})
            .order("created_at", {ascending: false})
            .limit(Math.max(1, limit)),
        supabase
            .from("daily_journal_proofs")
            .select("id,journal_log_id,status,caption,verification_score,verification_reason,alignment_xp_awarded,stat_boost_stat,reward_domains,timeline_summary,share_to_timeline,rewarded_capture_id,created_at,completed_at")
            .eq("user_id", user.id)
            .order("created_at", {ascending: false})
            .limit(40),
        supabase
            .from("user_nature_alignment_progress")
            .select("domain,points,level,journal_count,last_journal_log_id,last_progress_at")
            .eq("user_id", user.id)
            .order("points", {ascending: false}),
        getUserCaptures(120).then((rows) => rows.map(decorateCapture)),
        getTrainDailyCompanionState()
    ]);

    const today = todayResult.data ? parseJournalLog(todayResult.data as QueryRow) : null;
    const recentLogs = ((recentResult.data ?? []) as QueryRow[]).map(parseJournalLog);
    const proofs = ((proofsResult.data ?? []) as QueryRow[])
        .map(parseProofSummary)
        .filter((proof): proof is DailyJournalProofSummary => Boolean(proof));
    const progress = ((progressResult.data ?? []) as QueryRow[])
        .map(parseProgress)
        .filter((entry): entry is NatureAlignmentProgress => Boolean(entry));

    return {
        today,
        recentLogs,
        proofsByLogId: indexProofs(proofs),
        progress,
        captures,
        companion,
        localDate
    };
}

export async function getDailyCompanionPageData(): Promise<DailyCompanionPageData> {
    const data = await fetchDailyCompanionData();
    return data ?? {
        today: null,
        recentLogs: [],
        proofsByLogId: {},
        progress: [],
        captures: [],
        companion: {completedToday: false, journalCount: 0, recentJournalDate: null},
        localDate: localLogDate()
    };
}

export function parseJournalLogFromApi(row: unknown): DailyJournalLog | null {
    if (!row || typeof row !== "object") return null;
    return parseJournalLog(row as QueryRow);
}
