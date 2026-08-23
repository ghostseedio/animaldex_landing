/** Deterministic admin campaign-builder helpers. No LLM, no service-role, no backend rules engine. */

import {
    APPLE_DISCLAIMER,
    CANONICAL_SETTING_TAGS,
    canonicalizeSettingTag,
    canonicalizeTypeTag,
    settingTagDisplayLabel,
    typeTagDisplayLabel,
    type CampaignDraftInput,
    type ObjectiveType
} from "@/lib/sponsored-challenges-admin";

export const CAMPAIGN_TEMPLATE_IDS = [
    "venue_collector",
    "bird_challenge",
    "photography_quality",
    "activity_streak",
    "blank"
] as const;

export type CampaignTemplateId = (typeof CAMPAIGN_TEMPLATE_IDS)[number];

export const GENERATED_FIELDS = [
    "title",
    "slug",
    "publicSummary",
    "description",
    "officialRules",
    "rewardTerms",
    "presenterName",
    "startsAt",
    "endsAt",
    "timezoneIdentifier",
    "achievementSlug",
    "achievementTitle",
    "achievementDetail"
] as const;

export type GeneratedField = (typeof GENERATED_FIELDS)[number];
export type FieldOrigin = "auto" | "manual";
export type FieldOrigins = Record<GeneratedField, FieldOrigin>;

export const CONTINUOUS_AUTO_FIELDS: readonly GeneratedField[] = [
    "title",
    "slug",
    "publicSummary",
    "description",
    "officialRules",
    "rewardTerms",
    "presenterName",
    "timezoneIdentifier",
    "achievementSlug",
    "achievementTitle",
    "achievementDetail"
];

export const COPY_FIELDS: readonly GeneratedField[] = [
    "title",
    "publicSummary",
    "description",
    "officialRules",
    "rewardTerms",
    "achievementSlug",
    "achievementTitle",
    "achievementDetail"
];

export const DATE_FIELDS: readonly GeneratedField[] = ["startsAt", "endsAt"];

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

export const ADMIN_TIMEZONES = [
    "UTC",
    "Asia/Jakarta",
    "Asia/Singapore",
    "Asia/Bangkok",
    "Asia/Tokyo",
    "Europe/London",
    "America/New_York"
] as const;

/** Unambiguous country → IANA zone for countries that map to an existing admin timezone. */
export const COUNTRY_TIMEZONE: Record<string, string> = {
    ID: "Asia/Jakarta",
    SG: "Asia/Singapore",
    TH: "Asia/Bangkok",
    JP: "Asia/Tokyo",
    GB: "Europe/London"
};

export const SETTING_TAGS = ["", ...CANONICAL_SETTING_TAGS] as const;

export const GENERATED_RULES_NOTICE = "Generated from campaign settings. Review before publishing.";

export const TEMPLATE_CHANGE_CONFIRM =
    "Replace the current form with this template’s defaults? Manually edited fields will be overwritten.";

export const REGENERATE_CONFIRM =
    "Replace generated campaign copy with fresh defaults from the current settings?";

export type CampaignTemplate = {
    id: CampaignTemplateId;
    label: string;
    description: string;
    durationDays: number;
    expectsVenue: boolean;
    defaults: {
        objectiveType: ObjectiveType;
        targetCount: number;
        liveOnly: boolean;
        externalImportsAllowed: boolean;
        requiredTypeTag: string;
        requiredSettingTag: string;
        minimumCaptureGrade: number | null;
    };
};

export const CAMPAIGN_TEMPLATES: Record<CampaignTemplateId, CampaignTemplate> = {
    venue_collector: {
        id: "venue_collector",
        label: "Venue Collector",
        description: "Zoo, aquarium, wildlife park, or sanctuary collection Challenge.",
        durationDays: 30,
        expectsVenue: true,
        defaults: {
            objectiveType: "unique_indexed_entries",
            targetCount: 15,
            liveOnly: true,
            externalImportsAllowed: false,
            requiredTypeTag: "",
            requiredSettingTag: canonicalizeSettingTag("Zoo") ?? "Zoo",
            minimumCaptureGrade: null
        }
    },
    bird_challenge: {
        id: "bird_challenge",
        label: "Bird Challenge",
        description: "Collect different qualifying bird entries.",
        durationDays: 30,
        expectsVenue: false,
        defaults: {
            objectiveType: "unique_indexed_entries",
            targetCount: 20,
            liveOnly: true,
            externalImportsAllowed: false,
            requiredTypeTag: canonicalizeTypeTag("Bird") ?? "Bird",
            requiredSettingTag: "",
            minimumCaptureGrade: null
        }
    },
    photography_quality: {
        id: "photography_quality",
        label: "Photography Quality",
        description: "Complete a small number of high-grade captures.",
        durationDays: 30,
        expectsVenue: false,
        defaults: {
            objectiveType: "eligible_capture_count",
            targetCount: 5,
            liveOnly: true,
            externalImportsAllowed: false,
            requiredTypeTag: "",
            requiredSettingTag: "",
            minimumCaptureGrade: 8
        }
    },
    activity_streak: {
        id: "activity_streak",
        label: "Activity Streak",
        description: "Make qualifying captures on different days.",
        durationDays: 14,
        expectsVenue: false,
        defaults: {
            objectiveType: "active_capture_days",
            targetCount: 5,
            liveOnly: true,
            externalImportsAllowed: false,
            requiredTypeTag: "",
            requiredSettingTag: "",
            minimumCaptureGrade: null
        }
    },
    blank: {
        id: "blank",
        label: "Blank",
        description: "Minimal safe defaults only.",
        durationDays: 7,
        expectsVenue: false,
        defaults: {
            objectiveType: "unique_indexed_entries",
            targetCount: 1,
            liveOnly: true,
            externalImportsAllowed: false,
            requiredTypeTag: "",
            requiredSettingTag: "",
            minimumCaptureGrade: null
        }
    }
};

export const TEMPLATE_LIST = CAMPAIGN_TEMPLATE_IDS.map((id) => CAMPAIGN_TEMPLATES[id]);

export type GeneratedCopy = Record<GeneratedField, string>;

export type BuilderSource = {
    templateId: CampaignTemplateId;
    draft: CampaignDraftInput;
    venueName: string;
    venueCountry?: string | null;
    sponsorDisplayName?: string | null;
    achievementSlug: string;
    achievementTitle: string;
    achievementDetail: string;
    now?: Date;
};

export function emptyFieldOrigins(origin: FieldOrigin = "auto"): FieldOrigins {
    return GENERATED_FIELDS.reduce((acc, field) => {
        acc[field] = origin;
        return acc;
    }, {} as FieldOrigins);
}

export function markManual(origins: FieldOrigins, field: GeneratedField): FieldOrigins {
    if (origins[field] === "manual") return origins;
    return {...origins, [field]: "manual"};
}

export function markManualMany(origins: FieldOrigins, fields: readonly GeneratedField[]): FieldOrigins {
    let next = origins;
    for (const field of fields) next = markManual(next, field);
    return next;
}

export function isFormSubstantiallyModified(
    origins: FieldOrigins,
    extras?: {venueName?: string; achievementDetail?: string}
): boolean {
    if (GENERATED_FIELDS.some((field) => origins[field] === "manual")) return true;
    if (extras?.venueName?.trim()) return true;
    if (extras?.achievementDetail?.trim() && origins.achievementDetail === "manual") return true;
    return false;
}

export function slugifyTitle(title: string): string {
    return title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function isValidCampaignSlug(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim());
}

export function toDatetimeLocalValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDatetimeLocal(value: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function nextSensibleStart(now = new Date()): string {
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMilliseconds(0);
    next.setMinutes(0);
    next.setHours(next.getHours() + 1);
    return toDatetimeLocalValue(next);
}

export function addDurationDays(startLocal: string, days: number): string {
    const start = parseDatetimeLocal(startLocal) ?? new Date();
    return toDatetimeLocalValue(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

export function isValidDateRange(startsAt: string, endsAt: string): boolean {
    const start = parseDatetimeLocal(startsAt);
    const end = parseDatetimeLocal(endsAt);
    return Boolean(start && end && end.getTime() > start.getTime());
}

export function timezoneFromVenueCountry(countryCode?: string | null): string | null {
    const code = countryCode?.trim().toUpperCase();
    if (!code) return null;
    return COUNTRY_TIMEZONE[code] ?? null;
}

export function templateDurationDays(templateId: CampaignTemplateId): number {
    return CAMPAIGN_TEMPLATES[templateId].durationDays;
}

export function inferTemplateId(draft: {
    objectiveType: string;
    targetCount: number;
    requiredTypeTag?: string | null;
    requiredSettingTag?: string | null;
    minimumCaptureGrade?: number | null;
}): CampaignTemplateId | null {
    const type = draft.requiredTypeTag?.trim().toLowerCase() ?? "";
    const setting = draft.requiredSettingTag?.trim().toLowerCase() ?? "";
    if (draft.objectiveType === "unique_indexed_entries" && draft.targetCount === 15 && setting === "zoo") {
        return "venue_collector";
    }
    if (draft.objectiveType === "unique_indexed_entries" && draft.targetCount === 20 && type === "bird") {
        return "bird_challenge";
    }
    if (draft.objectiveType === "eligible_capture_count" && draft.targetCount === 5 && draft.minimumCaptureGrade === 8) {
        return "photography_quality";
    }
    if (draft.objectiveType === "active_capture_days" && draft.targetCount === 5) {
        return "activity_streak";
    }
    return null;
}

export function generatePresenterName(
    sponsorOrganizationId?: string | null,
    sponsorDisplayName?: string | null
): string {
    if (sponsorOrganizationId) return sponsorDisplayName?.trim() || "";
    return "AnimalDex";
}

export function generateTitle(source: BuilderSource): string {
    const venue = source.venueName.trim();
    const sponsor = source.sponsorDisplayName?.trim() || "";
    const named = venue || sponsor;
    switch (source.templateId) {
        case "venue_collector":
            return named ? `${named} Collector` : "";
        case "bird_challenge":
            return named ? `${named} Bird Challenge` : "Bird Challenge";
        case "photography_quality":
            return named ? `${named} Photography Challenge` : "Photography Quality Challenge";
        case "activity_streak":
            return named ? `${named} Activity Streak` : "Activity Streak";
        case "blank":
            return "";
        default:
            return "";
    }
}

function proseTag(value?: string | null): string {
    return value?.trim().toLowerCase() ?? "";
}

function targetOf(draft: CampaignDraftInput): number {
    return Number.isFinite(draft.targetCount) ? draft.targetCount : 0;
}

export function generatePublicSummary(source: BuilderSource): string {
    const target = targetOf(source.draft);
    const venue = source.venueName.trim();
    const type = proseTag(source.draft.requiredTypeTag);
    const grade = source.draft.minimumCaptureGrade;

    if (source.draft.objectiveType === "unique_indexed_entries") {
        if (type && venue) return `Capture ${target} different qualifying ${type} entries at ${venue}.`;
        if (type) return `Capture ${target} different qualifying ${type} entries during the Challenge.`;
        if (venue) return `Capture ${target} different qualifying AnimalDex entries at ${venue}.`;
        return `Capture ${target} different qualifying AnimalDex entries during the Challenge.`;
    }
    if (source.draft.objectiveType === "eligible_capture_count") {
        if (grade) return `Complete ${target} qualifying captures graded ${grade} or higher.`;
        return `Complete ${target} qualifying AnimalDex captures during the Challenge.`;
    }
    if (source.draft.objectiveType === "active_capture_days") {
        return `Make qualifying AnimalDex captures on ${target} different days.`;
    }
    return "";
}

export function generateDescription(source: BuilderSource): string {
    const target = targetOf(source.draft);
    const venue = source.venueName.trim();
    const type = proseTag(source.draft.requiredTypeTag);
    const grade = source.draft.minimumCaptureGrade;

    if (venue && source.draft.objectiveType === "unique_indexed_entries") {
        return `Explore ${venue} and build your AnimalDex collection by capturing ${target} different qualifying entries during the Challenge period.`;
    }
    if (source.draft.objectiveType === "unique_indexed_entries") {
        const kind = type ? `${type} entries` : "AnimalDex entries";
        return `Build your AnimalDex collection during this time-limited Challenge by completing ${target} different qualifying ${kind}.`;
    }
    if (source.draft.objectiveType === "eligible_capture_count") {
        const gradeCopy = grade ? ` graded ${grade} or higher` : "";
        return `Build your AnimalDex collection during this time-limited Challenge by completing ${target} qualifying captures${gradeCopy}.`;
    }
    if (source.draft.objectiveType === "active_capture_days") {
        return `Build your AnimalDex collection during this time-limited Challenge by making qualifying captures on ${target} different days.`;
    }
    return "";
}

function appendAppleDisclaimer(rules: string): string {
    const trimmed = rules.trim();
    if (trimmed.includes(APPLE_DISCLAIMER)) return trimmed;
    return `${trimmed}\n\n${APPLE_DISCLAIMER}`;
}

export function generateOfficialRules(source: BuilderSource): string {
    const draft = source.draft;
    const target = targetOf(draft);
    const venue = source.venueName.trim();
    const type = typeTagDisplayLabel(draft.requiredTypeTag);
    const setting = settingTagDisplayLabel(draft.requiredSettingTag);
    const grade = draft.minimumCaptureGrade;
    const hasVenue = Boolean(venue) || draft.hasVenue;
    const liveOnly = hasVenue ? true : draft.liveOnly;
    const importsAllowed = hasVenue ? false : draft.externalImportsAllowed;

    let lead = "To complete this Challenge, finish the published objective during the Challenge period.";
    if (draft.objectiveType === "unique_indexed_entries") {
        lead = `To complete this Challenge, collect ${target} different qualifying indexed AnimalDex entries during the Challenge period.`;
    } else if (draft.objectiveType === "eligible_capture_count") {
        lead = `To complete this Challenge, complete ${target} qualifying AnimalDex captures during the Challenge period.`;
    } else if (draft.objectiveType === "active_capture_days") {
        lead = `To complete this Challenge, make qualifying AnimalDex captures on ${target} different days during the Challenge period.`;
    }

    const bullets: string[] = [
        "belong to the participating AnimalDex account;",
        "be made during the published Challenge window;"
    ];
    if (liveOnly) bullets.push("be live AnimalDex captures;");
    if (venue) bullets.push(`be recorded at the configured ${venue} venue using trusted device-location evidence;`);
    if (setting) bullets.push(`satisfy the ${setting} setting requirement;`);
    if (grade != null) bullets.push(`be graded ${grade} or higher;`);
    bullets.push("satisfy AnimalDex capture-validity and authenticity requirements;");
    if (draft.objectiveType === "unique_indexed_entries") {
        bullets.push(type
            ? `resolve to an indexed AnimalDex ${type} entry.`
            : "resolve to an indexed AnimalDex entry.");
    } else {
        const last = bullets.pop() ?? "";
        bullets.push(last.replace(/;$/, "."));
    }

    const lines = [
        lead,
        "Qualifying captures must:",
        ...bullets.map((item) => `- ${item}`)
    ];
    if (draft.objectiveType === "unique_indexed_entries") {
        lines.push("Each indexed AnimalDex entry counts once.");
    }
    if (!importsAllowed) {
        lines.push("Imported or external captures do not qualify.");
    } else {
        lines.push("External or imported captures may qualify when they satisfy the published conditions.");
    }
    return appendAppleDisclaimer(lines.join("\n"));
}

export function generateRewardTerms(achievementTitle: string): string {
    const name = achievementTitle.trim() || "Challenge";
    return [
        `Complete the Challenge to unlock the “${name}” AnimalDex achievement.`,
        "The reward is deterministic and available to qualifying participants who complete the Challenge according to the official rules.",
        "No cash, Credits, sweepstakes, random drawing, or prize of chance is offered."
    ].join("\n");
}

export function generateAchievementDetail(title: string): string {
    const name = title.trim() || "this Challenge";
    return `Unlock this achievement by completing ${name}.`;
}

function dateDefaults(templateId: CampaignTemplateId, now?: Date): {startsAt: string; endsAt: string} {
    const startsAt = nextSensibleStart(now);
    return {
        startsAt,
        endsAt: addDurationDays(startsAt, templateDurationDays(templateId))
    };
}

export function generateBuilderCopy(source: BuilderSource, origins?: FieldOrigins): GeneratedCopy {
    const title = generateTitle(source);
    const titleForDependents = origins?.title === "manual"
        ? source.draft.title.trim() || title
        : title || source.draft.title.trim();
    const slug = slugifyTitle(titleForDependents);
    const presenterName = generatePresenterName(source.draft.sponsorOrganizationId, source.sponsorDisplayName);
    const timezoneIdentifier = timezoneFromVenueCountry(source.venueCountry) || DEFAULT_TIMEZONE;
    const dates = dateDefaults(source.templateId, source.now);
    const achievementTitle = origins?.achievementTitle === "manual"
        ? source.achievementTitle.trim() || titleForDependents
        : titleForDependents;
    const achievementSlug = slugifyTitle(origins?.achievementSlug === "manual"
        ? source.achievementSlug || slug || achievementTitle
        : slug || achievementTitle);
    const achievementDetail = origins?.achievementDetail === "manual"
        ? source.achievementDetail.trim() || generateAchievementDetail(achievementTitle || titleForDependents)
        : generateAchievementDetail(achievementTitle || titleForDependents || "this Challenge");
    return {
        title,
        slug,
        publicSummary: generatePublicSummary(source),
        description: generateDescription(source),
        officialRules: generateOfficialRules(source),
        rewardTerms: generateRewardTerms(achievementTitle),
        presenterName,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        timezoneIdentifier,
        achievementSlug,
        achievementTitle,
        achievementDetail
    };
}

export function currentGeneratedCopy(source: BuilderSource): GeneratedCopy {
    return {
        title: source.draft.title,
        slug: source.draft.slug,
        publicSummary: source.draft.publicSummary,
        description: source.draft.description,
        officialRules: source.draft.officialRules,
        rewardTerms: source.draft.rewardTerms,
        presenterName: source.draft.presenterName ?? "",
        startsAt: source.draft.startsAt,
        endsAt: source.draft.endsAt,
        timezoneIdentifier: source.draft.timezoneIdentifier,
        achievementSlug: source.achievementSlug,
        achievementTitle: source.achievementTitle,
        achievementDetail: source.achievementDetail
    };
}

export function nextAutoValues(
    current: GeneratedCopy,
    generated: GeneratedCopy,
    origins: FieldOrigins,
    fields: readonly GeneratedField[] = CONTINUOUS_AUTO_FIELDS
): GeneratedCopy | null {
    let changed = false;
    const next = {...current};
    for (const field of fields) {
        if (origins[field] !== "auto") continue;
        if (current[field] !== generated[field]) {
            next[field] = generated[field];
            changed = true;
        }
    }
    return changed ? next : null;
}

export function applyTemplateDefaults(
    templateId: CampaignTemplateId,
    current: CampaignDraftInput,
    now?: Date
): CampaignDraftInput {
    const template = CAMPAIGN_TEMPLATES[templateId];
    const dates = dateDefaults(templateId, now);
    return {
        ...current,
        objectiveType: template.defaults.objectiveType,
        targetCount: template.defaults.targetCount,
        liveOnly: template.defaults.liveOnly,
        externalImportsAllowed: template.defaults.externalImportsAllowed,
        requiredTypeTag: template.defaults.requiredTypeTag,
        requiredSettingTag: template.defaults.requiredSettingTag,
        minimumCaptureGrade: template.defaults.minimumCaptureGrade,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        hasVenue: template.expectsVenue ? current.hasVenue : current.hasVenue
    };
}

export function blankDraft(now?: Date): CampaignDraftInput {
    const dates = dateDefaults("blank", now);
    const template = CAMPAIGN_TEMPLATES.blank;
    return {
        slug: "",
        title: "",
        publicSummary: "",
        description: "",
        presenterName: "AnimalDex",
        sponsorOrganizationId: null,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        timezoneIdentifier: DEFAULT_TIMEZONE,
        objectiveType: template.defaults.objectiveType,
        targetCount: template.defaults.targetCount,
        officialRules: "",
        rewardTerms: "",
        requiredTypeTag: "",
        requiredSettingTag: "",
        minimumCaptureGrade: null,
        liveOnly: template.defaults.liveOnly,
        externalImportsAllowed: template.defaults.externalImportsAllowed,
        discoveryRadiusM: 25000,
        geoMode: "unrestricted",
        hasVenue: false
    };
}

export function pickCopy(copy: GeneratedCopy, fields: readonly GeneratedField[]): Partial<GeneratedCopy> {
    const next: Partial<GeneratedCopy> = {};
    for (const field of fields) next[field] = copy[field];
    return next;
}

export function mergeCopyIntoDraft(draft: CampaignDraftInput, copy: Partial<GeneratedCopy>): CampaignDraftInput {
    return {
        ...draft,
        title: copy.title ?? draft.title,
        slug: copy.slug ?? draft.slug,
        publicSummary: copy.publicSummary ?? draft.publicSummary,
        description: copy.description ?? draft.description,
        officialRules: copy.officialRules ?? draft.officialRules,
        rewardTerms: copy.rewardTerms ?? draft.rewardTerms,
        presenterName: copy.presenterName ?? draft.presenterName,
        startsAt: copy.startsAt ?? draft.startsAt,
        endsAt: copy.endsAt ?? draft.endsAt,
        timezoneIdentifier: copy.timezoneIdentifier ?? draft.timezoneIdentifier
    };
}
