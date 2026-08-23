/** Consumer-facing presentation helpers for the admin campaign preview. Pure, form-state only. */

import {objectiveLabel, settingTagDisplayLabel, typeTagDisplayLabel} from "@/lib/sponsored-challenges-admin";

export const PREVIEW_TABS = ["card", "detail", "joined", "completed"] as const;
export type PreviewTab = (typeof PREVIEW_TABS)[number];

export const PREVIEW_PROGRESS_NOTICE = "Preview progress is simulated. This is not live campaign data.";

export type PreviewCampaign = {
    title: string;
    publicSummary: string;
    description: string;
    presenterName: string | null;
    sponsorOrganizationId: string | null;
    sponsorDisplayName: string | null;
    startsAt: string;
    endsAt: string;
    timezoneIdentifier: string;
    objectiveType: string;
    targetCount: number;
    requiredTypeTag: string | null;
    requiredSettingTag: string | null;
    minimumCaptureGrade: number | null;
    liveOnly: boolean;
    externalImportsAllowed: boolean;
    venueName: string | null;
    rewardTitle: string | null;
    officialRules: string;
};

const PREVIEW_KEYS = [
    "title",
    "publicSummary",
    "description",
    "presenterName",
    "sponsorOrganizationId",
    "sponsorDisplayName",
    "startsAt",
    "endsAt",
    "timezoneIdentifier",
    "objectiveType",
    "targetCount",
    "requiredTypeTag",
    "requiredSettingTag",
    "minimumCaptureGrade",
    "liveOnly",
    "externalImportsAllowed",
    "venueName",
    "rewardTitle",
    "officialRules"
] as const;

export function previewCampaignKeys(): readonly string[] {
    return PREVIEW_KEYS;
}

export function isSponsoredCampaign(input: {sponsorOrganizationId?: string | null}): boolean {
    return Boolean(input.sponsorOrganizationId);
}

export function cardAuthorship(input: PreviewCampaign): {
    showSponsored: boolean;
    presentedBy: string | null;
    authorLabel: string | null;
} {
    if (isSponsoredCampaign(input)) {
        const presentedBy = input.presenterName?.trim() || input.sponsorDisplayName?.trim() || null;
        return {showSponsored: true, presentedBy, authorLabel: null};
    }
    return {
        showSponsored: false,
        presentedBy: null,
        authorLabel: input.presenterName?.trim() || "AnimalDex"
    };
}

export function previewObjectiveLabel(type: string): string {
    return objectiveLabel(type);
}

export function progressUnitLabel(type: string): "entries" | "captures" | "days" {
    if (type === "unique_indexed_entries") return "entries";
    if (type === "active_capture_days") return "days";
    return "captures";
}

export function cardObjectiveLine(input: Pick<PreviewCampaign, "objectiveType" | "targetCount" | "requiredTypeTag" | "minimumCaptureGrade" | "venueName">): string {
    const target = Number.isFinite(input.targetCount) ? input.targetCount : 0;
    const type = typeTagDisplayLabel(input.requiredTypeTag);
    if (input.objectiveType === "unique_indexed_entries") {
        const kind = type ? `${type} entries` : "AnimalDex entries";
        return `Capture ${target} different ${kind}`;
    }
    if (input.objectiveType === "eligible_capture_count") {
        if (input.minimumCaptureGrade) {
            return `Complete ${target} captures graded ${input.minimumCaptureGrade} or higher`;
        }
        return `Complete ${target} qualifying captures`;
    }
    if (input.objectiveType === "active_capture_days") {
        return `Capture on ${target} different days`;
    }
    return previewObjectiveLabel(input.objectiveType);
}

export function qualificationBullets(input: Pick<PreviewCampaign, "objectiveType" | "liveOnly" | "externalImportsAllowed" | "venueName" | "requiredTypeTag" | "requiredSettingTag" | "minimumCaptureGrade">): string[] {
    const bullets: string[] = [];
    const hasVenue = Boolean(input.venueName?.trim());
    if (input.liveOnly || hasVenue) bullets.push("Live AnimalDex captures only");
    bullets.push("Must be captured during the Challenge");
    if (hasVenue) bullets.push(`Must be recorded at ${input.venueName!.trim()}`);
    if (input.requiredTypeTag?.trim()) {
        bullets.push(`Must qualify as ${typeTagDisplayLabel(input.requiredTypeTag)}`);
    }
    if (input.requiredSettingTag?.trim()) {
        bullets.push(`Must satisfy the ${settingTagDisplayLabel(input.requiredSettingTag)} setting`);
    }
    if (input.minimumCaptureGrade != null) {
        bullets.push(`Must be graded ${input.minimumCaptureGrade} or higher`);
    }
    if (input.objectiveType === "unique_indexed_entries") {
        bullets.push("Each indexed AnimalDex entry counts once");
    }
    if (!input.externalImportsAllowed || hasVenue) {
        bullets.push("Imported captures do not qualify");
    }
    return bullets;
}

function dateParts(value: string): {year: number; month: number; day: number} | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return {year: Number(match[1]), month: Number(match[2]), day: Number(match[3])};
}

function formatMonthDay(value: string): string {
    const parts = dateParts(value);
    if (!parts) {
        const parsed = new Date(value);
        if (!Number.isFinite(parsed.getTime())) return "";
        return parsed.toLocaleDateString("en-US", {month: "short", day: "numeric"});
    }
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
        .toLocaleDateString("en-US", {month: "short", day: "numeric", timeZone: "UTC"});
}

export function formatPreviewDateRange(startsAt: string, endsAt: string): string {
    const start = formatMonthDay(startsAt);
    const end = formatMonthDay(endsAt);
    if (!start || !end) return "";
    return `${start} – ${end}`;
}

export function rewardLabel(rewardTitle?: string | null): string {
    const title = rewardTitle?.trim();
    return title ? `${title} achievement` : "Achievement";
}

export function simulatedJoinedProgress(targetCount: number): number {
    const target = Number.isFinite(targetCount) ? Math.max(0, Math.floor(targetCount)) : 0;
    if (target <= 1) return 0;
    if (target === 2) return 1;
    return Math.min(3, target - 1);
}

export function previewProgress(
    targetCount: number,
    mode: "joined" | "completed"
): {current: number; target: number} {
    const target = Number.isFinite(targetCount) ? Math.max(0, Math.floor(targetCount)) : 0;
    return {
        current: mode === "completed" ? target : simulatedJoinedProgress(target),
        target
    };
}

export function unsupportedRewardLabels(): string[] {
    return ["credits", "cash", "voucher", "sweepstakes", "prize pool", "random drawing"];
}

export function previewShowsUnsupportedReward(copy: string): boolean {
    const text = copy.toLowerCase();
    return unsupportedRewardLabels().some((label) => text.includes(label));
}

export function toPreviewCampaign(input: {
    title: string;
    publicSummary: string;
    description: string;
    presenterName?: string | null;
    sponsorOrganizationId?: string | null;
    sponsorDisplayName?: string | null;
    startsAt: string;
    endsAt: string;
    timezoneIdentifier: string;
    objectiveType: string;
    targetCount: number;
    requiredTypeTag?: string | null;
    requiredSettingTag?: string | null;
    minimumCaptureGrade?: number | null;
    liveOnly: boolean;
    externalImportsAllowed: boolean;
    venueName?: string | null;
    rewardTitle?: string | null;
    officialRules: string;
}): PreviewCampaign {
    return {
        title: input.title,
        publicSummary: input.publicSummary,
        description: input.description,
        presenterName: input.presenterName?.trim() || null,
        sponsorOrganizationId: input.sponsorOrganizationId || null,
        sponsorDisplayName: input.sponsorDisplayName?.trim() || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezoneIdentifier: input.timezoneIdentifier,
        objectiveType: input.objectiveType,
        targetCount: input.targetCount,
        requiredTypeTag: input.requiredTypeTag?.trim() || null,
        requiredSettingTag: input.requiredSettingTag?.trim() || null,
        minimumCaptureGrade: input.minimumCaptureGrade ?? null,
        liveOnly: input.liveOnly,
        externalImportsAllowed: input.externalImportsAllowed,
        venueName: input.venueName?.trim() || null,
        rewardTitle: input.rewardTitle?.trim() || null,
        officialRules: input.officialRules
    };
}
