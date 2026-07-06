import type {DailyJournalLog} from "@/data/daily-companion";
import {DailyCompanionCopy} from "@/lib/daily-companion-copy";

export function localLogDate() {
    const formatter = new Intl.DateTimeFormat("en-CA", {year: "numeric", month: "2-digit", day: "2-digit"});
    return formatter.format(new Date());
}

export function dayPart(logDate: string) {
    return logDate.slice(-2);
}

export function monthPart(logDate: string) {
    return logDate.slice(5, 7);
}

export function moveTodayDisplayText(log: Pick<DailyJournalLog, "moveTodayText" | "generatedInsight">) {
    const trimmed = log.moveTodayText?.trim();
    if (trimmed) return trimmed;
    const insight = log.generatedInsight ?? "";
    for (const marker of ["Today's Task:", "Move Today:"]) {
        const index = insight.toLowerCase().indexOf(marker.toLowerCase());
        if (index >= 0) {
            const tail = insight.slice(index + marker.length).trim();
            if (tail) return tail;
        }
    }
    return null;
}

export function isAlignmentCompleted(log: Pick<DailyJournalLog, "alignmentProofStatus">) {
    return log.alignmentProofStatus === "accepted";
}

export function journalTimelineSubtitle(log: DailyJournalLog) {
    if (isAlignmentCompleted(log)) {
        const parts: string[] = [DailyCompanionCopy.taskComplete];
        if (log.alignmentScore != null) parts.push(`Score ${log.alignmentScore}`);
        if (log.alignmentTier) parts.push(log.alignmentTier);
        return parts.join(" · ");
    }
    if (log.completionState === "completed") {
        return log.alignmentTier ?? "Plan ready";
    }
    if (log.completionState === "formula_ready") {
        return "Animal plan ready";
    }
    return "In progress";
}

export function companionRoleLabel(role?: string | null) {
    const trimmed = role?.trim() ?? "";
    if (!trimmed) return "Companion";
    const titled = trimmed
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    return titled.toLowerCase().includes("companion") ? titled : `${titled} Companion`;
}

export function statBoostRewardLabel(amount: number, statRaw?: string | null, domains: string[] = []) {
    if (amount <= 0) return null;
    const stat = resolveTrainableStat(statRaw, domains);
    const label = stat.charAt(0).toUpperCase() + stat.slice(1);
    return `+${amount} ${label}`;
}

function resolveTrainableStat(statRaw: string | null | undefined, domains: string[]) {
    const normalized = statRaw?.trim().toLowerCase();
    if (normalized === "dominance" || normalized === "speed" || normalized === "intelligence") return normalized;
    for (const domain of domains) {
        const stat = statForDomain(domain);
        if (stat) return stat;
    }
    return "intelligence";
}

function statForDomain(domain: string) {
    switch (domain.trim().toLowerCase()) {
        case "focus":
        case "observation":
        case "calmness":
        case "patience":
        case "discipline":
            return "intelligence";
        case "execution":
        case "adaptability":
        case "communication":
            return "speed";
        case "boundaries":
        case "resilience":
        case "recovery":
        case "leadership":
            return "dominance";
        default:
            return null;
    }
}

export function completionDisplay(state: DailyJournalLog["completionState"]) {
    switch (state) {
        case "formula_ready":
            return "Animal plan ready";
        case "completed":
            return "Plan completed";
        case "archived":
            return "Archived";
        default:
            return "Draft";
    }
}

export function proofStatusLabel(status: DailyJournalLog["alignmentProofStatus"]) {
    switch (status) {
        case "accepted":
            return "Proof accepted";
        case "pending":
            return "Proof pending";
        case "rejected":
            return "Proof rejected";
        default:
            return "Proof not started";
    }
}
